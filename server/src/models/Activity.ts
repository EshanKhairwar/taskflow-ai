
import mongoose, { Schema } from "mongoose";

const activitySchema = new Schema(
  {
    actor: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    task: {
      type: Schema.Types.ObjectId,
      ref: "Task",
      default: undefined,
    },
    type: {
      type: String,
      enum: [
        "task.created",
        "task.updated",
        "task.status_changed",
        "task.assigned",
        "task.deleted",
        "project.member_added",
        "project.member_removed",
      ],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

activitySchema.index({ project: 1, createdAt: -1 });
activitySchema.index({ actor: 1, createdAt: -1 });

const Activity =
  mongoose.models.Activity ||
  mongoose.model("Activity", activitySchema);

export default Activity;
