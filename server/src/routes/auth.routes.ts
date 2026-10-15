import { Router, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { v2 as cloudinary } from "cloudinary";

import User from "../models/User.js";
import {
  authenticate,
  type AuthRequest,
} from "../middleware/authenticate.js";

const router = Router();

// --------------------------------------------------
// Cloudinary configuration
// --------------------------------------------------

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

const hasCloudinaryConfig = () =>
  Boolean(cloudName && apiKey && apiSecret);

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

// --------------------------------------------------
// Validation schemas
// --------------------------------------------------

const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(72),
});

const profileSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    avatarDataUrl: z.string().max(3_000_000).nullable().optional(),
    removeAvatar: z.boolean().optional(),
  })
  .refine(
    (data) => !(data.removeAvatar && data.avatarDataUrl),
    {
      message: "Cannot upload and remove an avatar simultaneously",
    }
  );

// --------------------------------------------------
// Authentication helpers
// --------------------------------------------------

function issueSession(userId: string, res: Response) {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is missing");
  }

  const isProduction = process.env.NODE_ENV === "production";

  const token = jwt.sign({}, secret, {
    subject: userId,
    expiresIn: "1d",
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 24 * 60 * 60 * 1000,
  });
}

function serializeUser(user: {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl || "",
  };
}

// --------------------------------------------------
// Avatar helpers
// --------------------------------------------------

function isAllowedAvatarDataUrl(value: string) {
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(
    value
  );
}

function getImageSizeBytes(base64Content: string) {
  const padding = base64Content.endsWith("==")
    ? 2
    : base64Content.endsWith("=")
      ? 1
      : 0;

  return Math.floor((base64Content.length * 3) / 4) - padding;
}

// --------------------------------------------------
// Cloudinary diagnostic endpoint
// GET /api/v1/auth/cloudinary-test
// --------------------------------------------------

router.get("/cloudinary-test", async (_req, res) => {
  if (!hasCloudinaryConfig()) {
    res.status(500).json({
      success: false,
      message: "Cloudinary configuration is incomplete",
    });
    return;
  }

  try {
    const result = await cloudinary.api.ping();

    res.json({
      success: true,
      message: "Cloudinary API connection is working",
      result,
    });
  } catch (error: unknown) {
    const err = error as {
      message?: string;
      http_code?: number;
    };

    console.error("Cloudinary ping failed:", {
      message: err.message,
      http_code: err.http_code,
    });

    res.status(err.http_code || 500).json({
      success: false,
      message: "Cloudinary API connection failed",
      code: err.http_code ?? null,
    });
  }
});

// --------------------------------------------------
// REGISTER - POST /api/v1/auth/register
// --------------------------------------------------

router.post("/register", async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid registration data",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const existing = await User.exists({
      email: normalizedEmail,
    });

    if (existing) {
      res.status(409).json({
        message: "Email already registered",
      });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash,
      avatarUrl: "",
    });

    issueSession(user.id, res);

    res.status(201).json({
      user: serializeUser(user),
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      res.status(409).json({
        message: "Email already registered",
      });
      return;
    }

    next(error);
  }
});

// --------------------------------------------------
// LOGIN - POST /api/v1/auth/login
// --------------------------------------------------

router.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid login data",
      });
      return;
    }

    const { email, password } = parsed.data;

    const user = await User.findOne({
      email: email.toLowerCase(),
    }).select("+passwordHash");

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({
        message: "Invalid email or password",
      });
      return;
    }

    issueSession(user.id, res);

    res.json({
      user: serializeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------
// GET CURRENT USER - GET /api/v1/auth/me
// --------------------------------------------------

router.get("/me", authenticate, async (req: AuthRequest, res, next) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      res.status(401).json({
        message: "User no longer exists",
      });
      return;
    }

    res.json({
      user: serializeUser(user),
    });
  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------
// UPDATE PROFILE - PATCH /api/v1/auth/me/profile
// --------------------------------------------------

router.patch(
  "/me/profile",
  authenticate,
  async (req: AuthRequest, res, next) => {
    try {
      const parsed = profileSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          message: "Invalid profile data",
          errors: parsed.error.flatten(),
        });
        return;
      }

      const { name, avatarDataUrl, removeAvatar } = parsed.data;

      const user = await User.findById(req.userId);

      if (!user) {
        res.status(404).json({
          message: "User not found",
        });
        return;
      }

      // Upload avatar when provided
      if (avatarDataUrl) {
        if (!isAllowedAvatarDataUrl(avatarDataUrl)) {
          res.status(400).json({
            message: "Only JPG, PNG, and WEBP images are allowed",
          });
          return;
        }

        const base64Content = avatarDataUrl.split(",")[1];

        if (!base64Content) {
          res.status(400).json({
            message: "Invalid image data",
          });
          return;
        }

        const imageSize = getImageSizeBytes(base64Content);

        if (imageSize > 2 * 1024 * 1024) {
          res.status(413).json({
            message: "Profile photo must be 2 MB or smaller",
          });
          return;
        }

        if (imageSize <= 0) {
          res.status(400).json({
            message: "Image data is empty or invalid",
          });
          return;
        }

        if (!hasCloudinaryConfig()) {
          console.error("Cloudinary configuration is incomplete");

          res.status(500).json({
            message: "Image upload service is not configured",
          });
          return;
        }

        try {
          const result = await cloudinary.uploader.upload(
            avatarDataUrl,
            {
              folder: "taskflow-ai/avatars",
              resource_type: "image",
              allowed_formats: ["jpg", "jpeg", "png", "webp"],
              transformation: [
                {
                  width: 512,
                  height: 512,
                  crop: "limit",
                },
              ],
            }
          );

          user.avatarUrl = result.secure_url;
        } catch (uploadError: unknown) {
          const err = uploadError as {
            message?: string;
            http_code?: number;
            name?: string;
            error?: unknown;
          };

          console.error("Cloudinary upload failed:", {
            message: err.message,
            http_code: err.http_code,
            name: err.name,
            error: err.error,
          });

          res.status(502).json({
            message: "Cloudinary avatar upload failed",
            cloudinaryMessage:
              err.message ?? "Unknown Cloudinary error",
            cloudinaryCode: err.http_code ?? null,
          });
          return;
        }
      } else if (removeAvatar) {
        user.avatarUrl = "";
      }

      user.name = name;

      await user.save();

      res.json({
        message: "Profile updated successfully",
        user: serializeUser(user),
      });
    } catch (error) {
      next(error);
    }
  }
);

// --------------------------------------------------
// LOGOUT - POST /api/v1/auth/logout
// --------------------------------------------------

router.post("/logout", (_req, res) => {
  const isProduction = process.env.NODE_ENV === "production";

  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });

  res.json({
    message: "Logged out successfully",
  });
});

export default router;