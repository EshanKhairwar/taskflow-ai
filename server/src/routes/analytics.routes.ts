import { Router } from "express";
import mongoose from "mongoose";

import { authenticate, type AuthRequest } from "../middleware/authenticate.js";
import Project from "../models/Project.js";
import Task from "../models/Task.js";
import User from "../models/User.js";

const router = Router();

type MemberMetrics = {
  userId: string;
  name: string;
  email: string;
  projects: Set<string>;
  assigned: number;
  completed: number;
  inProgress: number;
  inReview: number;
  overdue: number;
  highPriority: number;
};

function idOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return value ? String(value) : "";
}

// GET /api/v1/analytics/team-productivity
// Returns task workload metrics only for projects the signed-in user can access.
router.get("/team-productivity", authenticate, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId;
    if (!userId || !mongoose.isValidObjectId(userId)) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const projects = await Project.find({
      $or: [{ owner: userId }, { "members.user": userId }],
    })
      .select("_id name owner members")
      .lean();

    const projectIds = projects.map((project) => project._id);
    if (!projectIds.length) {
      res.json({
        summary: { members: 0, assigned: 0, completed: 0, overdue: 0 },
        members: [],
      });
      return;
    }

    const tasks = await Task.find({ project: { $in: projectIds } })
      .select("_id project assignee status priority dueDate")
      .lean();

    const memberMap = new Map<string, MemberMetrics>();
    const ensureMember = (id: string, name = "Team member", email = "") => {
      if (!id) return undefined;
      let member = memberMap.get(id);
      if (!member) {
        member = {
          userId: id,
          name,
          email,
          projects: new Set<string>(),
          assigned: 0,
          completed: 0,
          inProgress: 0,
          inReview: 0,
          overdue: 0,
          highPriority: 0,
        };
        memberMap.set(id, member);
      } else {
        if (name !== "Team member" && name) member.name = name;
        if (email) member.email = email;
      }
      return member;
    };

    for (const project of projects) {
      const projectId = String(project._id);
      const ownerId = idOf(project.owner);
      const owner = ensureMember(ownerId);
      owner?.projects.add(projectId);
      for (const entry of project.members ?? []) {
        const memberId = idOf(entry.user);
        const member = ensureMember(memberId);
        member?.projects.add(projectId);
      }
    }

    const userIds = [...memberMap.keys()];
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } }).select("name email").lean()
      : [];
    for (const user of users) {
      ensureMember(String(user._id), user.name || "Team member", user.email || "");
    }

    const now = new Date();
    for (const task of tasks) {
      const assigneeId = idOf(task.assignee);
      if (!assigneeId) continue;
      const member = ensureMember(assigneeId);
      if (!member) continue;
      member.assigned += 1;
      if (task.status === "done") member.completed += 1;
      if (task.status === "in_progress") member.inProgress += 1;
      if (task.status === "in_review") member.inReview += 1;
      if (task.priority === "high" && task.status !== "done") member.highPriority += 1;
      if (task.dueDate && new Date(task.dueDate) < now && task.status !== "done") {
        member.overdue += 1;
      }
      member.projects.add(String(task.project));
    }

    const members = [...memberMap.values()]
      .map((member) => ({
        userId: member.userId,
        name: member.name,
        email: member.email,
        projectCount: member.projects.size,
        assigned: member.assigned,
        completed: member.completed,
        inProgress: member.inProgress,
        inReview: member.inReview,
        overdue: member.overdue,
        highPriority: member.highPriority,
        completionRate: member.assigned
          ? Math.round((member.completed / member.assigned) * 100)
          : 0,
      }))
      .sort((a, b) => b.assigned - a.assigned || a.name.localeCompare(b.name));

    const summary = members.reduce(
      (total, member) => ({
        members: total.members + 1,
        assigned: total.assigned + member.assigned,
        completed: total.completed + member.completed,
        overdue: total.overdue + member.overdue,
      }),
      { members: 0, assigned: 0, completed: 0, overdue: 0 },
    );

    res.json({ summary, members });
  } catch (error) {
    next(error);
  }
});

export default router;
