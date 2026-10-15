import express, { type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/auth.routes.js";
import projectRoutes from "./routes/project.routes.js";
import taskRoutes from "./routes/task.routes.js";
import projectMembersRoutes from "./routes/project-members.routes.js";
import activityRoutes from "./routes/activity.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import aiRoutes from "./routes/ai.routes.js";


const app = express();

app.disable("x-powered-by");
app.use(helmet());

const allowedOrigin = (
  process.env.CLIENT_URL || "http://localhost:5173"
)
  .trim()
  .replace(/\/+$/, "");

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json({ limit: "3mb" }));
app.use(cookieParser());

app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Authentication routes
app.use(
  "/api/v1/auth",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  authRoutes,
);

app.use(
  "/api/v1/projects",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  projectRoutes,
);

app.use("/api/v1/projects/:projectId/members", projectMembersRoutes);

app.use(
  "/api/v1",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
  taskRoutes,
);
app.use("/api/v1/activity", activityRoutes);
app.use("/api/v1/notifications", notificationRoutes);

app.use("/api/v1/ai", aiRoutes);

// Handle unknown routes
app.use((_req, res) => {
  res.status(404).json({
    message: "Route not found",
  });
});



// Global error handler
const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    message: "Internal server error",
  });
};

app.use(errorHandler);

export default app;
