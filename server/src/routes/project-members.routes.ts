import { Router, type Request } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import Project from "../models/Project.js";
import User from "../models/User.js";
import * as TaskModule from "../models/Task.js";
import { authenticate, type AuthRequest } from "../middleware/authenticate.js";
import { logActivity } from "../services/activity.service.js";

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
      .select("name email avatarUrl")
      .lean();

    const roleById = new Map<string, string>();
    roleById.set(project.owner.toString(), "admin");

    for (const member of project.members) {
      roleById.set(member.user.toString(), member.role);
    }

    // Include per-member task counts so the Team page can show workload.
    const assignedTasks = TaskModel && typeof TaskModel.find === "function"
      ? await TaskModel.find({
          project: project._id,
          assignee: { $in: [...memberIds] },
        })
          .select("assignee")
          .lean()
      : [];

    const taskCountByUser = new Map<string, number>();
    for (const task of assignedTasks as any[]) {
      const assigneeId = task.assignee?.toString();
      if (assigneeId) {
        taskCountByUser.set(
          assigneeId,
          (taskCountByUser.get(assigneeId) ?? 0) + 1,
        );
      }
    }

    return res.json({
      members: users.map((user: any) => ({
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        avatar: user.avatarUrl ?? "",
        role: roleById.get(user._id.toString()) ?? "member",
        isOwner: user._id.toString() === project.owner.toString(),
        assignedTaskCount: taskCountByUser.get(user._id.toString()) ?? 0,
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
      .select("name email avatarUrl")
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

    try {
      await logActivity({
        actorId: userId,
        projectId: project._id.toString(),
        type: "project.member_added",
        message: `You were added to project "${project.name}"`,
        recipientId: targetId,
        notificationType: "project.member_added",
      });
    } catch (activityError) {
      // Membership is already saved; don't report the whole operation as failed.
      console.error("[Activity] Failed to log member addition:", activityError);
    }

    return res.status(201).json({
      member: {
        id: targetId,
        name: user.name,
        email: user.email,
        avatar: user.avatarUrl ?? "",
        role: "member",
        isOwner: false,
        assignedTaskCount: 0,
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

    try {
      await logActivity({
        actorId: userId,
        projectId: project._id.toString(),
        type: "project.member_removed",
        message: `You were removed from project "${project.name}"`,
        recipientId: memberId,
        notificationType: "project.member_removed",
      });
    } catch (activityError) {
      console.error("[Activity] Failed to log member removal:", activityError);
    }

    // Remove the deleted member's task assignments in this project.
    if (!TaskModel || typeof TaskModel.updateMany !== "function") {
      throw new Error(
        "Task model export is invalid. Check server/src/models/Task.ts.",
      );
    }

    try {
      await TaskModel.updateMany(
        {
          project: project._id,
          assignee: new mongoose.Types.ObjectId(memberId),
        },
        {
          $unset: { assignee: 1 },
        },
      );
    } catch (assignmentError) {
      // The member removal already succeeded; log assignment cleanup failure.
      console.error("[Members] Failed to clear removed member task assignments:", assignmentError);
    }

    return res.json({
      message: "Member removed successfully",
      memberId,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
