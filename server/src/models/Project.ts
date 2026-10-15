
import mongoose, { Schema } from "mongoose";

const projectMemberSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    role: {
      type: String,
      enum: ["admin", "member"],
      default: "member",
      required: true
    }
  },
  { _id: false }
);

const projectSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100
    },
    description: {
      type: String,
      default: "",
      maxlength: 3000,
      trim: true
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    members: {
      type: [projectMemberSchema],
      default: []
    },
    status: {
      type: String,
      enum: ["active", "completed", "archived"],
      default: "active",
      required: true
    },
    dueDate: {
      type: Date,
      default: undefined
    }
  },
  { timestamps: true }
);

projectSchema.index({ "members.user": 1 });
projectSchema.index({ owner: 1, updatedAt: -1 });

const Project = mongoose.model("Project", projectSchema);

export default Project;
