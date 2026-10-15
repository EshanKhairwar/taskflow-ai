import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

export interface AuthRequest extends Request {
  userId?: string;
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.token as string | undefined;
  const secret = process.env.JWT_SECRET;

  // Development-only diagnostics. Never log the token or secret.
  if (process.env.NODE_ENV === "development") {
    console.log("[Auth Debug]", {
      cookiesParsed: Boolean(req.cookies),
      tokenPresent: Boolean(token),
      jwtSecretConfigured: Boolean(secret),
    });
  }

  // Check server configuration first.
  if (!secret) {
    console.error(
      "[Auth Error] JWT_SECRET is missing from the server environment.",
    );

    res.status(500).json({
      message: "Server authentication configuration error",
    });
    return;
  }

  // Ensure the browser sent the authentication cookie.
  if (!token) {
    res.status(401).json({
      message: "Authentication required",
    });
    return;
  }

  try {
    const payload = jwt.verify(token, secret);

    // This middleware expects the user ID in the JWT "sub" claim.
    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      !mongoose.isValidObjectId(payload.sub)
    ) {
      res.status(401).json({
        message: "Invalid session",
      });
      return;
    }

    // Make the authenticated user's ID available to route handlers.
    req.userId = payload.sub;

    next();
  } catch (error: unknown) {
    if (process.env.NODE_ENV === "development") {
      const reason = error instanceof Error ? error.name : "UnknownError";

      console.warn("[Auth Debug] JWT verification failed:", reason);
    }

    res.status(401).json({
      message: "Invalid or expired session",
    });
  }
}
