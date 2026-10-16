import { Router, type Response } from "express";

import bcrypt from "bcryptjs";

import jwt from "jsonwebtoken";

import { z } from "zod";

import { v2 as cloudinary } from "cloudinary";

import { randomInt, createHash, timingSafeEqual } from "node:crypto";

import { sendVerificationOtp } from "../services/email.service.js";

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



const verifyEmailSchema = z.object({
  email: z.string().trim().email().max(254),
  otp: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
});

const resendVerificationSchema = z.object({
  email: z.string().trim().email().max(254),
});

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;

function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function hashOtp(otp: string): string {
  return createHash("sha256").update(otp).digest("hex");
}

function otpMatches(candidate: string, storedHash: string): boolean {
  const candidateHash = Buffer.from(hashOtp(candidate), "hex");
  const expectedHash = Buffer.from(storedHash, "hex");
  return (
    candidateHash.length === expectedHash.length &&
    timingSafeEqual(candidateHash, expectedHash)
  );
}

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
    const existing = await User.exists({ email: normalizedEmail });

    if (existing) {
      res.status(409).json({ message: "Email already registered" });
      return;
    }

    const otp = generateOtp();
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name,
      email: normalizedEmail,
      passwordHash,
      avatarUrl: "",
      emailVerified: false,
      emailOtpHash: hashOtp(otp),
      emailOtpExpiresAt: new Date(Date.now() + OTP_TTL_MS),
      emailOtpAttempts: 0,
      emailOtpLastSentAt: new Date(),
    });

    try {
      await sendVerificationOtp(user.email, user.name, otp);
    } catch (emailError) {
      // Keep the pending account so the user can request another code.
      console.error("Verification email could not be sent:", emailError);
      res.status(503).json({
        message: "Your account was created, but the verification email could not be sent. Please try resending the code shortly.",
        requiresVerification: true,
        email: user.email,
      });
      return;
    }

    res.status(201).json({
      message: "Verification code sent. Please verify your email.",
      requiresVerification: true,
      email: user.email,
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      res.status(409).json({ message: "Email already registered" });
      return;
    }
    next(error);
  }
});

// --------------------------------------------------
// VERIFY EMAIL - POST /api/v1/auth/verify-email
// --------------------------------------------------

router.post("/verify-email", async (req, res, next) => {
  try {
    const parsed = verifyEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Enter a valid email and 6-digit verification code.",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const { otp } = parsed.data;
    const user = await User.findOne({ email }).select(
      "+emailOtpHash +emailOtpExpiresAt +emailOtpAttempts"
    );

    if (!user) {
      res.status(400).json({ message: "Invalid or expired verification code." });
      return;
    }
    if (user.emailVerified) {
      res.json({ message: "Email is already verified. You can log in." });
      return;
    }
    if (!user.emailOtpHash || !user.emailOtpExpiresAt || user.emailOtpExpiresAt.getTime() <= Date.now()) {
      res.status(400).json({ message: "Verification code expired. Please request a new code." });
      return;
    }
    if ((user.emailOtpAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
      res.status(429).json({ message: "Too many incorrect attempts. Please request a new code." });
      return;
    }

    if (!otpMatches(otp, user.emailOtpHash)) {
      user.emailOtpAttempts = (user.emailOtpAttempts ?? 0) + 1;
      await user.save();
      res.status(400).json({ message: "Invalid or expired verification code." });
      return;
    }

    user.emailVerified = true;
    user.emailOtpHash = undefined;
    user.emailOtpExpiresAt = undefined;
    user.emailOtpAttempts = 0;
    user.emailOtpLastSentAt = undefined;
    await user.save();

    res.json({ message: "Email verified successfully. You can now log in." });
  } catch (error) {
    next(error);
  }
});

// --------------------------------------------------
// RESEND VERIFICATION CODE - POST /api/v1/auth/resend-verification
// --------------------------------------------------

router.post("/resend-verification", async (req, res, next) => {
  try {
    const parsed = resendVerificationSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Enter a valid email address." });
      return;
    }

    const email = parsed.data.email.toLowerCase();
    const genericMessage = "If this account exists and needs verification, a code will be sent shortly.";
    const user = await User.findOne({ email }).select(
      "+emailOtpHash +emailOtpExpiresAt +emailOtpAttempts +emailOtpLastSentAt"
    );

    // Use a generic response to avoid disclosing whether an email is registered.
    if (!user || user.emailVerified) {
      res.json({ message: genericMessage });
      return;
    }

    if (
      user.emailOtpLastSentAt &&
      Date.now() - user.emailOtpLastSentAt.getTime() < OTP_RESEND_COOLDOWN_MS
    ) {
      res.status(429).json({ message: "Please wait 60 seconds before requesting another code." });
      return;
    }

    const otp = generateOtp();
    user.emailOtpHash = hashOtp(otp);
    user.emailOtpExpiresAt = new Date(Date.now() + OTP_TTL_MS);
    user.emailOtpAttempts = 0;
    user.emailOtpLastSentAt = new Date();
    await user.save();

    try {
      await sendVerificationOtp(user.email, user.name, otp);
    } catch (emailError) {
      console.error("Verification email could not be resent:", emailError);
      res.status(503).json({ message: "Unable to send verification email right now. Please try again later." });
      return;
    }

    res.json({ message: genericMessage });
  } catch (error) {
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



    // Legacy accounts without emailVerified set remain able to log in.
    if (user.emailVerified === false) {
      res.status(403).json({
        message: "Please verify your email before logging in.",
        requiresVerification: true,
        email: user.email,
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