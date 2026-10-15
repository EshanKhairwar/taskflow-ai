
import mongoose, { Schema } from "mongoose";

const taskSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000
    },
    project: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true
    },
    assignee: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: undefined
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    status: {
      type: String,
      enum: ["todo", "in_progress", "in_review", "done"],
      default: "todo",
      required: true
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
      required: true
    },
    dueDate: {
      type: Date,
      default: undefined
    },
    position: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, status: 1, position: 1 });
taskSchema.index({ assignee: 1, status: 1 });
taskSchema.index({ project: 1, dueDate: 1 });

const Task = mongoose.model("Task", taskSchema);

export default Task;
