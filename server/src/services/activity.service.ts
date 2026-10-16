
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
  | "comment.added"
  | "project.member_added"
  | "project.member_removed";

type NotificationType =
  | "task.assigned"
  | "comment.added"
  | "project.member_added"
  | "project.member_removed";

interface LogEventInput {
  actorId: string;
  projectId: string;
  taskId?: string;
  type: EventType;
  message: string;
  recipientId?: string;
  recipientIds?: string[];
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

  const recipients = Array.from(
    new Set(
      [input.recipientId, ...(input.recipientIds ?? [])]
        .filter((recipient): recipient is string => Boolean(recipient))
        .filter((recipient) => recipient !== input.actorId),
    ),
  );

  if (recipients.length > 0 && input.notificationType) {
    for (const recipientId of recipients) {
      try {
        const notification = await Notification.create({
          recipient: new mongoose.Types.ObjectId(recipientId),
          actor: new mongoose.Types.ObjectId(input.actorId),
          project: new mongoose.Types.ObjectId(input.projectId),
          task: input.taskId
            ? new mongoose.Types.ObjectId(input.taskId)
            : undefined,
          type: input.notificationType,
          message: input.message,
        });

        const populatedNotification = await Notification.findById(
          notification._id,
        )
          .populate("actor", "name email avatar")
          .populate("project", "name")
          .populate("task", "title")
          .lean();

        if (populatedNotification) {
          emitNotificationToUser(recipientId, populatedNotification);
        }
      } catch (error) {
        // Notification failure must not break the underlying task/comment action.
        console.error(
          `[Notifications] Failed to notify user ${recipientId}:`,
          error,
        );
      }
    }
  }

  return activity;
}
