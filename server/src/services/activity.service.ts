
import mongoose from "mongoose";
import Activity from "../models/Activity.js";
import Notification from "../models/Notification.js";
import { emitNotificationToUser } from "../socket.server.js";

type EventType =
  | "task.created"
  | "task.updated"
  | "task.status_changed"
  | "task.assigned"
  | "task.deleted"
  | "project.member_added"
  | "project.member_removed";

type NotificationType =
  | "task.assigned"
  | "project.member_added"
  | "project.member_removed";

interface LogEventInput {
  actorId: string;
  projectId: string;
  taskId?: string;
  type: EventType;
  message: string;
  recipientId?: string;
  notificationType?: NotificationType;
}

export async function logActivity(input: LogEventInput) {
  const activity = await Activity.create({
    actor: new mongoose.Types.ObjectId(input.actorId),
    project: new mongoose.Types.ObjectId(input.projectId),
    task: input.taskId
      ? new mongoose.Types.ObjectId(input.taskId)
      : undefined,
    type: input.type,
    message: input.message,
  });

  if (
    input.recipientId &&
    input.recipientId !== input.actorId &&
    input.notificationType
  ) {
    const notification = await Notification.create({
      recipient: new mongoose.Types.ObjectId(input.recipientId),
      actor: new mongoose.Types.ObjectId(input.actorId),
      project: new mongoose.Types.ObjectId(input.projectId),
      task: input.taskId
        ? new mongoose.Types.ObjectId(input.taskId)
        : undefined,
      type: input.notificationType,
      message: input.message,
    });

    try {
      const populatedNotification = await Notification.findById(
        notification._id,
      )
        .populate("actor", "name email avatar")
        .populate("project", "name")
        .populate("task", "title")
        .lean();

      if (populatedNotification) {
        emitNotificationToUser(
          input.recipientId,
          populatedNotification,
        );
      }
    } catch (error) {
      // Real-time delivery failure must not break task operations.
      console.error(
        "[Socket] Failed to prepare notification event:",
        error,
      );
    }
  }

  return activity;
}
