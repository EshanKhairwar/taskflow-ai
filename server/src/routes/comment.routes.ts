import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import Comment from "../models/Comment.js";
import Task from "../models/Task.js";
import Project from "../models/Project.js";
import { authenticate, type AuthRequest } from "../middleware/authenticate.js";
import { logActivity } from "../services/activity.service.js";

const router = Router();

const createCommentSchema = z.object({
  body: z.string().trim().min(1, "Comment cannot be empty").max(2000),
}).strict();

function getUserId(req: AuthRequest): string | undefined {
  return req.userId;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && mongoose.isValidObjectId(value);
}

async function getAccessibleTask(taskId: string, userId: string) {
  const task = await Task.findById(taskId).select("_id project title");
  if (!task) return { error: "missing" as const };

  const hasAccess = await Project.exists({
    _id: task.project,
    $or: [{ owner: userId }, { "members.user": userId }],
  });
  if (!hasAccess) return { error: "forbidden" as const };

  return { task };
}

// GET /api/v1/comments/tasks/:taskId
router.get("/tasks/:taskId", authenticate, async (req, res, next) => {
  try {
    const userId = getUserId(req as AuthRequest);
    const { taskId } = req.params;

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    if (!validId(taskId)) {
      res.status(400).json({ message: "Invalid task ID" });
      return;
    }

    const result = await getAccessibleTask(taskId, userId);
    if ("error" in result) {
      res.status(result.error === "missing" ? 404 : 403).json({
        message: result.error === "missing" ? "Task not found" : "You do not have access to this task",
      });
      return;
    }

    const comments = await Comment.find({ task: result.task._id })
      .sort({ createdAt: 1 })
      .populate("author", "name email avatarUrl")
      .lean();

    res.json({ comments });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/comments/tasks/:taskId
router.post("/tasks/:taskId", authenticate, async (req, res, next) => {
  try {
    const userId = getUserId(req as AuthRequest);
    const { taskId } = req.params;

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }
    if (!validId(taskId)) {
      res.status(400).json({ message: "Invalid task ID" });
      return;
    }

    const parsed = createCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid comment",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const result = await getAccessibleTask(taskId, userId);
    if ("error" in result) {
      res.status(result.error === "missing" ? 404 : 403).json({
        message: result.error === "missing" ? "Task not found" : "You do not have access to this task",
      });
      return;
    }

    const comment = await Comment.create({
      task: result.task._id,
      project: result.task.project,
      author: new mongoose.Types.ObjectId(userId),
      body: parsed.data.body,
    });

    const populatedComment = await Comment.findById(comment._id)
      .populate("author", "name email avatarUrl")
      .lean();

    // Activity history is best-effort: a logging failure must not make a
    // successfully saved comment appear to fail to the user.
    try {
      const project = await Project.findById(result.task.project)
        .select("owner members.user")
        .lean();

      const recipients = new Set<string>();
      if (project?.owner) recipients.add(project.owner.toString());
      for (const member of project?.members ?? []) {
        if (member.user) recipients.add(member.user.toString());
      }
      recipients.delete(userId);

      const populatedAuthor = populatedComment?.author;
      const authorName =
        populatedAuthor &&
        typeof populatedAuthor === "object" &&
        "name" in populatedAuthor &&
        typeof populatedAuthor.name === "string"
          ? populatedAuthor.name
          : "A teammate";

      await logActivity({
        actorId: userId,
        projectId: result.task.project.toString(),
        taskId: result.task._id.toString(),
        type: "comment.added",
        message: `${authorName} commented on task "${result.task.title}"`,
        recipientIds: Array.from(recipients),
        notificationType: "comment.added",
      });
    } catch (activityError) {
      // Comment creation has already succeeded; activity/notification failures
      // must not make the saved comment appear to fail.
      console.error("[Activity] Failed to log comment/notifications:", activityError);
    }

    res.status(201).json({ comment: populatedComment });
  } catch (error) {
    next(error);
  }
});

export default router;
