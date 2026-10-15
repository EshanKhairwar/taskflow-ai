import { Router, type Request } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import Project from "../models/Project.js";
import User from "../models/User.js";
import * as TaskModule from "../models/Task.js";
import { authenticate, type AuthRequest } from "../middleware/authenticate.js";

const router = Router({ mergeParams: true });

// Support either a default-exported Task model or a named Task model.
const TaskModel =
  (TaskModule as any).default ??
  (TaskModule as any).Task ??
  (TaskModule as any).TaskModel;

function getUserId(req: Request): string | undefined {
  return (req as AuthRequest).userId;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && mongoose.isValidObjectId(value);
}

function isAdmin(project: any, userId: string): boolean {
  return (
    project.owner.toString() === userId ||
    project.members.some(
      (member: any) =>
        member.user.toString() === userId && member.role === "admin",
    )
  );
}

async function accessibleProject(projectId: string, userId: string) {
  return Project.findOne({
    _id: projectId,
    $or: [{ owner: userId }, { "members.user": userId }],
  });
}

// GET /api/v1/projects/:projectId/members
router.get("/", authenticate, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { projectId } = req.params;

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!validId(projectId)) {
      return res.status(400).json({
        message: "Invalid project ID",
      });
    }

    const project = await accessibleProject(projectId, userId);

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    const memberIds = new Set<string>([
      project.owner.toString(),
      ...project.members.map((member: any) => member.user.toString()),
    ]);

    const users = await User.find({
      _id: { $in: [...memberIds] },
    })
      .select("name email avatar")
      .lean();

    const roleById = new Map<string, string>();
    roleById.set(project.owner.toString(), "admin");

    for (const member of project.members) {
      roleById.set(member.user.toString(), member.role);
    }

    return res.json({
      members: users.map((user: any) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatar ?? "",
        role: roleById.get(user._id.toString()) ?? "member",
        isOwner: user._id.toString() === project.owner.toString(),
      })),
      canManageMembers: isAdmin(project, userId),
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/projects/:projectId/members
// Admin only; add an existing registered user by email.
router.post("/", authenticate, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { projectId } = req.params;

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!validId(projectId)) {
      return res.status(400).json({
        message: "Invalid project ID",
      });
    }

    const parsed = z
      .object({
        email: z.string().trim().email().max(254),
      })
      .strict()
      .safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Enter a valid email address",
      });
    }

    const project = await accessibleProject(projectId, userId);

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    if (!isAdmin(project, userId)) {
      return res.status(403).json({
        message: "Only project admins can manage members",
      });
    }

    const email = parsed.data.email.toLowerCase();

    const user = await User.findOne({ email })
      .select("name email avatar")
      .lean();

    if (!user) {
      return res.status(404).json({
        message: "No registered user found with that email",
      });
    }

    const targetId = user._id.toString();

    const alreadyMember =
      targetId === project.owner.toString() ||
      project.members.some(
        (member: any) => member.user.toString() === targetId,
      );

    if (alreadyMember) {
      return res.status(409).json({
        message: "This user is already a project member",
      });
    }

    project.members.push({
      user: new mongoose.Types.ObjectId(targetId),
      role: "member",
    } as any);

    await project.save();

    return res.status(201).json({
      member: {
        id: targetId,
        name: user.name,
        email: user.email,
        avatar: user.avatarUrl ?? "",
        role: "member",
        isOwner: false,
      },
      message: "Member added successfully",
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/projects/:projectId/members/:memberId
// Admin only.
router.delete("/:memberId", authenticate, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { projectId, memberId } = req.params;

    if (!userId) {
      return res.status(401).json({
        message: "Authentication required",
      });
    }

    if (!validId(projectId)) {
      return res.status(400).json({
        message: "Invalid project ID",
      });
    }

    if (!validId(memberId)) {
      return res.status(400).json({
        message: "Invalid member ID",
      });
    }

    const project = await accessibleProject(projectId, userId);

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    if (!isAdmin(project, userId)) {
      return res.status(403).json({
        message: "Only project admins can manage members",
      });
    }

    if (project.owner.toString() === memberId) {
      return res.status(400).json({
        message: "The project owner cannot be removed",
      });
    }

    const existing = project.members.some(
      (member: any) => member.user.toString() === memberId,
    );

    if (!existing) {
      return res.status(404).json({
        message: "Project member not found",
      });
    }

    project.members = project.members.filter(
      (member: any) => member.user.toString() !== memberId,
    ) as any;

    await project.save();

    // Remove the deleted member's task assignments in this project.
    if (!TaskModel || typeof TaskModel.updateMany !== "function") {
      throw new Error(
        "Task model export is invalid. Check server/src/models/Task.ts.",
      );
    }

    await TaskModel.updateMany(
      {
        project: project._id,
        assignee: new mongoose.Types.ObjectId(memberId),
      },
      {
        $unset: { assignee: 1 },
      },
    );

    return res.json({
      message: "Member removed successfully",
      memberId,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
