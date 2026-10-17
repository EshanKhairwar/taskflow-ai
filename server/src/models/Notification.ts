
import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: undefined,
    },
    type: {
      type: String,
      enum: [
        "task.assigned",
        "comment.added",
        "project.member_added",
        "project.member_removed",
        "task.reminder_due_soon",
        "task.reminder_overdue",
      ],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    readAt: {
      type: Date,
      default: null,
      index: true,
    },
    // Stable key prevents duplicate scheduled reminders across scheduler ticks.
    reminderKey: {
      type: String,
      default: undefined,
      select: false,
    },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ reminderKey: 1 }, { unique: true, sparse: true });

const Notification =
  mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);

export default Notification;
