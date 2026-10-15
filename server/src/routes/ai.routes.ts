import { Router, type Request } from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import { z } from "zod";

import Project from "../models/Project.js";
import {
  authenticate,
  type AuthRequest,
} from "../middleware/authenticate.js";
import { generateTaskSuggestion } from "../services/aiPlanner.service.js";

const router = Router();

const requestSchema = z
  .object({
    projectId: z.string().refine(mongoose.isValidObjectId, {
      message: "Invalid MongoDB project ID",
    }),
    prompt: z.string().trim().min(10).max(2000),
  })
  .strict();

function getUserId(req: Request): string | undefined {
  return (req as AuthRequest).userId;
}

function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const value = error as {
    status?: number;
    statusCode?: number;
    response?: {
      status?: number;
    };
  };

  return value.status ?? value.statusCode ?? value.response?.status;
}

function isTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === "TimeoutError" ||
    error.name === "AbortError" ||
    error.name === "ETIMEDOUT" ||
    (error.name === "MongooseError" &&
      error.message.toLowerCase().includes("timed out"))
  );
}

function isConnectionError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const errorCode = (error as NodeJS.ErrnoException).code;

  return (
    [
      "APIConnectionError",
      "ECONNRESET",
      "ECONNREFUSED",
      "ENOTFOUND",
      "EAI_AGAIN",
      "UND_ERR_CONNECT_TIMEOUT",
    ].includes(error.name) ||
    [
      "ECONNRESET",
      "ECONNREFUSED",
      "ENOTFOUND",
      "EAI_AGAIN",
      "UND_ERR_CONNECT_TIMEOUT",
    ].includes(errorCode ?? "")
  );
}

router.post(
  "/generate-task",
  authenticate,
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      message: "Too many AI requests. Please try again later.",
    },
  }),
  async (req, res, next) => {
    console.log("[AI Route] Request received");

    try {
      // 1. Verify authenticated user
      const userId = getUserId(req);

      if (!userId) {
        res.status(401).json({
          message: "Authentication required",
        });
        return;
      }

      // 2. Validate request body
      const parsed = requestSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          message:
            "Invalid project ID or prompt. Prompt must contain 10–2000 characters.",
          errors: parsed.error.flatten(),
        });
        return;
      }

      const { projectId, prompt } = parsed.data;

      // 3. Verify project access
      console.log("[AI Route] Checking project access");

      const project = await Project.findOne({
        _id: projectId,
        $or: [
          { owner: userId },
          { "members.user": userId },
        ],
      })
        .select("_id")
        .maxTimeMS(5000);

      if (!project) {
        res.status(404).json({
          message: "Project not found or access denied",
        });
        return;
      }

      // 4. Generate AI task suggestion.
      // Provider configuration and fallback are handled by the service.
      console.log(
        "[AI Route] Calling AI provider with automatic fallback"
      );

      const task = await generateTaskSuggestion(prompt);

      // 5. Return the generated task
      console.log("[AI Route] Task generated successfully");

      res.status(200).json({
        message: "Task suggestion generated successfully",
        task,
      });
    } catch (error: unknown) {
      const status = getErrorStatus(error);

      console.error("[AI Route] Request failed", {
        message:
          error instanceof Error
            ? error.message
            : "Unknown error",
        status,
        name:
          error instanceof Error
            ? error.name
            : "UnknownError",
      });

      if (res.headersSent) {
        return next(error);
      }

      // AI provider configuration
      if (
        error instanceof Error &&
        error.message === "AI_NOT_CONFIGURED"
      ) {
        res.status(503).json({
          message:
            "AI service is not configured. Configure GROQ_API_KEY or MISTRAL_API_KEY.",
        });
        return;
      }

      // Invalid AI output
      if (
        error instanceof Error &&
        [
          "AI_EMPTY_RESPONSE",
          "AI_INVALID_RESPONSE",
        ].includes(error.message)
      ) {
        res.status(502).json({
          message:
            "AI returned an invalid response. Please try again.",
        });
        return;
      }

      // Request timeout
      if (isTimeoutError(error)) {
        res.status(504).json({
          message: "The AI request timed out. Please try again.",
        });
        return;
      }

      // Rate limiting or temporary provider unavailability
      if (status === 429 || status === 503) {
        res.status(503).json({
          message:
            "AI providers are temporarily busy. Please try again shortly.",
        });
        return;
      }

      // Provider connection failure
      if (isConnectionError(error)) {
        res.status(503).json({
          message:
            "Unable to connect to the AI providers. Please try again.",
        });
        return;
      }

      // Forward unexpected errors to the global error handler
      next(error);
    }
  }
);

export default router;
