
import mongoose, { Schema, type InferSchemaType } from "mongoose";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },

    // Optional for Firebase-managed passwords.
    // Existing password-based accounts remain compatible.
    passwordHash: {
      type: String,
      required: false,
      select: false,
    },

    // Firebase Authentication identity.
    firebaseUid: {
      type: String,
      unique: true,
      sparse: true,
      select: false,
    },

    avatarUrl: {
      type: String,
      default: "",
    },
    emailVerified: {
      type: Boolean,
      default: false,
      required: true,
    },

    // Legacy OTP fields retained during migration.
    emailOtpHash: { type: String, select: false },
    emailOtpExpiresAt: { type: Date, select: false },
    emailOtpAttempts: {
      type: Number,
      default: 0,
      select: false,
    },
    emailOtpLastSentAt: { type: Date, select: false },
  },
  { timestamps: true },
);

export type UserDocument = InferSchemaType<typeof userSchema>;

export default mongoose.model("User", userSchema);
