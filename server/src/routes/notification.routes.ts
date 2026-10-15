
import { Router, type Request } from "express";
import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { authenticate, type AuthRequest } from "../middleware/authenticate.js";

const router = Router();

function getUserId(req: Request): string | undefined {
  return (req as AuthRequest).userId;
}

router.get("/", authenticate, async (req, res, next) => {
  try {
    const userId = getUserId(req);


    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const rawLimit = Number(req.query.limit ?? 20);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(50, Math.max(1, Math.floor(rawLimit)))
      : 20;

    const notifications = await Notification.find({ recipient: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("actor", "name email avatar")
      .populate("project", "name")
      .populate("task", "title")
      .lean();

    res.json({ notifications });
  } catch (error) {
    next(error);
  }
});

router.get("/unread-count", authenticate, async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const count = await Notification.countDocuments({
      recipient: userId,
      readAt: null,
    });

    res.json({ count });
  } catch (error) {
    next(error);
  }
});

router.patch("/read-all", authenticate, async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    const result = await Notification.updateMany(
      { recipient: userId, readAt: null },
      { $set: { readAt: new Date() } }
    );

    res.json({ updated: result.modifiedCount });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/read", authenticate, async (req, res, next) => {
  try {
    const userId = getUserId(req);
    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });
      return;
    }

    if (!mongoose.isValidObjectId(id)) {
      res.status(400).json({ message: "Invalid notification ID" });
      return;
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, recipient: userId },
      { $set: { readAt: new Date() } },
      { new: true }
    );

    if (!notification) {
      res.status(404).json({ message: "Notification not found" });
      return;
    }

    res.json({ notification });
  } catch (error) {
    next(error);
  }
});

export default router;
