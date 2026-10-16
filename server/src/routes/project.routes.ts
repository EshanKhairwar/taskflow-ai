import { Router, type Request } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import Project from "../models/Project.js";
import User from "../models/User.js";
import { logActivity } from "../services/activity.service.js";
import {
  authenticate,
  type AuthRequest,
} from "../middleware/authenticate.js";

const router = Router();

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

const addMemberSchema = z
  .object({
    userId: z.string().trim().min(1),
    role: z.enum(["member", "admin"]).optional().default("member"),
  })
  .strict();

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
  if (project.owner.toString() === userId) return true;

  return project.members.some(
    (member) =>
      member.user.toString() === userId && member.role === "admin"
  );
}

async function findAccessibleProject(projectId: string, userId: string) {
  return Project.findOne({
    _id: projectId,
    $or: [{ owner: userId }, { "members.user": userId }],
  });
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
      members: [{ user: userId, role: "admin" }],
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

    const project = await findAccessibleProject(id, userId);

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

    if (name !== undefined) project.name = name;
    if (description !== undefined) project.description = description;
    if (status !== undefined) project.status = status;

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

// POST /api/v1/projects/:id/members
// Add an existing user to a project. Only project admins can add members.
// Body: { "userId": "<MongoDB user id>", "role": "member" | "admin" }
router.post("/:id/members", authenticate, async (req, res, next) => {
  try {
    const actorId = currentUserId(req);
    const id = req.params.id;

    if (!actorId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    if (typeof id !== "string" || !isValidId(id)) {
      res.status(400).json({ message: "Invalid project ID" });
      return;
    }

    const parsed = addMemberSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid member data",
        errors: parsed.error.flatten(),
      });
      return;
    }

    const { userId: memberId, role } = parsed.data;

    if (!isValidId(memberId)) {
      res.status(400).json({ message: "Invalid user ID" });
      return;
    }

    const project = await findAccessibleProject(id, actorId);

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    if (!isProjectAdmin(project, actorId)) {
      res.status(403).json({
        message: "Only project admins can add members",
      });
      return;
    }

    const memberUser = await User.findById(memberId).select("_id name email");

    if (!memberUser) {
      res.status(404).json({ message: "User to add was not found" });
      return;
    }

    const alreadyMember = project.members.some(
      (member) => member.user.toString() === memberId
    );

    if (alreadyMember || project.owner.toString() === memberId) {
      res.status(409).json({ message: "User is already a project member" });
      return;
    }

    project.members.push({
      user: new mongoose.Types.ObjectId(memberId),
      role,
    });

    await project.save();

    try {
      await logActivity({
        actorId,
        projectId: project._id.toString(),
        type: "project.member_added",
        message: `Added ${memberUser.name ?? memberUser.email} to project "${project.name}"`,
        recipientId: memberId,
        notificationType: "project.member_added",
      });
    } catch (activityError) {
      // The membership change has succeeded; logging/notification failure
      // should not make the client believe that adding the member failed.
      console.error("[Activity] Failed to log project member addition:", activityError);
    }

    res.status(201).json({ project, message: "Project member added successfully" });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/projects/:id/members/:memberId
// Remove a project member. Only project admins can remove members.
// The project owner cannot be removed from their own project.
router.delete("/:id/members/:memberId", authenticate, async (req, res, next) => {
  try {
    const actorId = currentUserId(req);
    const id = req.params.id;
    const memberId = req.params.memberId;

    if (!actorId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    if (
      typeof id !== "string" ||
      !isValidId(id) ||
      typeof memberId !== "string" ||
      !isValidId(memberId)
    ) {
      res.status(400).json({ message: "Invalid project or member ID" });
      return;
    }

    const project = await findAccessibleProject(id, actorId);

    if (!project) {
      res.status(404).json({ message: "Project not found" });
      return;
    }

    if (!isProjectAdmin(project, actorId)) {
      res.status(403).json({
        message: "Only project admins can remove members",
      });
      return;
    }

    if (project.owner.toString() === memberId) {
      res.status(400).json({ message: "The project owner cannot be removed" });
      return;
    }

    const memberIndex = project.members.findIndex(
      (member) => member.user.toString() === memberId
    );

    if (memberIndex === -1) {
      res.status(404).json({ message: "Project member not found" });
      return;
    }

    const removedMember = project.members[memberIndex];
    project.members.splice(memberIndex, 1);
    await project.save();

    try {
      await logActivity({
        actorId,
        projectId: project._id.toString(),
        type: "project.member_removed",
        message: `You were removed from project "${project.name}"`,
        recipientId: memberId,
        notificationType: "project.member_removed",
      });
    } catch (activityError) {
      console.error("[Activity] Failed to log project member removal:", activityError);
    }

    res.json({
      message: "Project member removed successfully",
      project,
      removedMemberId: removedMember.user.toString(),
    });
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

    if (typeof id !== "string" || !isValidId(id)) {
      res.status(400).json({ message: "Invalid project ID" });
      return;
    }

    const project = await findAccessibleProject(id, userId);

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
