import { Router, type Request } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import Project from "../models/Project.js";
import {
  authenticate,
  type AuthRequest,
} from "../middleware/authenticate.js";

const router = Router();

// Validation schemas
const createProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(3000).optional(),
    status: z.enum(["active", "completed", "archived"]).optional(),
    dueDate: z.coerce.date().nullable().optional(),
  })
  .strict();

const updateProjectSchema = createProjectSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

// Helpers
function currentUserId(req: Request): string | undefined {
  return (req as AuthRequest).userId;
}

function isValidId(id: string): boolean {
  return mongoose.isValidObjectId(id);
}

function isProjectAdmin(
  project: {
    owner: mongoose.Types.ObjectId;
    members: Array<{
      user: mongoose.Types.ObjectId;
      role: string;
    }>;
  },
  userId: string
): boolean {
  if (project.owner.toString() === userId) {
    return true;
  }

  return project.members.some(
    (member) =>
      member.user.toString() === userId && member.role === "admin"
  );
}

// GET /api/v1/projects
// List projects owned by the user or shared with them.
router.get("/", authenticate, async (req, res, next) => {
  try {
    const userId = currentUserId(req);

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const projects = await Project.find({
      $or: [{ owner: userId }, { "members.user": userId }],
    })
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

    res.json({ projects });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/projects
// Create a project. The creator becomes its admin.
router.post("/", authenticate, async (req, res, next) => {
  try {
    const userId = currentUserId(req);

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const parsed = createProjectSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid project data",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const { name, description, status, dueDate } = parsed.data;

    const project = await Project.create({
      name,
      description: description ?? "",
      status: status ?? "active",
      ...(dueDate ? { dueDate } : {}),
      owner: userId,
      members: [
        {
          user: userId,
          role: "admin",
        },
      ],
    });

    res.status(201).json({ project });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/projects/:id
// Get a project the user owns or belongs to.
router.get("/:id", authenticate, async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const id = req.params.id;

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    // Fix: Narrow the parameter type before calling isValidId().
    if (typeof id !== "string" || !isValidId(id)) {
      res.status(400).json({ message: "Invalid project ID" });
      return;
    }

    const project = await Project.findOne({
      _id: id,
      $or: [{ owner: userId }, { "members.user": userId }],
    }).lean();

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    res.json({ project });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/projects/:id
// Only project admins may update project details.
router.patch("/:id", authenticate, async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const id = req.params.id;

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    // Fix: Narrow the parameter type before calling isValidId().
    if (typeof id !== "string" || !isValidId(id)) {
      res.status(400).json({ message: "Invalid project ID" });
      return;
    }

    const parsed = updateProjectSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid project update",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const project = await Project.findOne({
      _id: id,
      $or: [{ owner: userId }, { "members.user": userId }],
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    if (!isProjectAdmin(project, userId)) {
      res.status(403).json({
        message: "Only project admins can update this project",
      });
      return;
    }

    const { name, description, status, dueDate } = parsed.data;

    if (name !== undefined) {
      project.name = name;
    }

    if (description !== undefined) {
      project.description = description;
    }

    if (status !== undefined) {
      project.status = status;
    }

    if (dueDate === null) {
      project.set("dueDate", undefined);
    } else if (dueDate !== undefined) {
      project.dueDate = dueDate;
    }

    await project.save();

    res.json({ project });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/projects/:id
// Only project admins may delete a project.
router.delete("/:id", authenticate, async (req, res, next) => {
  try {
    const userId = currentUserId(req);
    const id = req.params.id;

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    // Fix: Narrow the parameter type before calling isValidId().
    if (typeof id !== "string" || !isValidId(id)) {
      res.status(400).json({ message: "Invalid project ID" });
      return;
    }

    const project = await Project.findOne({
      _id: id,
      $or: [{ owner: userId }, { "members.user": userId }],
    });

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    if (!isProjectAdmin(project, userId)) {
      res.status(403).json({
        message: "Only project admins can delete this project",
      });
      return;
    }

    await project.deleteOne();

    res.status(200).json({
      message: "Project deleted successfully",
      projectId: id,
    });
  } catch (error) {
    next(error);
  }
});

export default router;