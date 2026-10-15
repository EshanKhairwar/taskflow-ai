
import { Router } from "express";
import mongoose from "mongoose";
import Activity from "../models/Activity.js";
import Project from "../models/Project.js";
import { authenticate, type AuthRequest } from "../middleware/authenticate.js";

const router = Router();

router.get("/", authenticate, async (req, res, next) => {
  try {
    const userId = (req as AuthRequest).userId;

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const rawLimit = Number(req.query.limit ?? 20);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(50, Math.max(1, Math.floor(rawLimit)))
      : 20;

    const projectIds = await Project.find({
      $or: [{ owner: userId }, { "members.user": userId }],
    }).distinct("_id");

    const activities = await Activity.find({
      project: { $in: projectIds },
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("actor", "name email avatar")
      .populate("project", "name")
      .populate("task", "title")
      .lean();

    res.json({ activities });
  } catch (error) {
    next(error);
  }
});

export default router;
