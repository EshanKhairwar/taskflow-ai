import Task from "../models/Task.js";
import Notification from "../models/Notification.js";
import { emitNotificationToUser } from "../socket.server.js";

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
let interval: ReturnType<typeof setInterval> | undefined;
let running = false;

function idOf(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toString" in value) {
    const id = String(value);
    return id === "[object Object]" ? undefined : id;
  }
  return undefined;
}

async function createReminder(input: {
  taskId: string;
  projectId: string;
  recipientId: string;
  title: string;
  dueDate: Date;
  type: "task.reminder_due_soon" | "task.reminder_overdue";
  message: string;
  key: string;
}) {
  const now = new Date();
  try {
    const result = await Notification.updateOne(
      { reminderKey: input.key },
      {
        $setOnInsert: {
          recipient: input.recipientId,
          actor: input.recipientId,
          project: input.projectId,
          task: input.taskId,
          type: input.type,
          message: input.message,
          readAt: null,
          reminderKey: input.key,
          createdAt: now,
          updatedAt: now,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      const notification = await Notification.findById(result.upsertedId)
        .populate("actor", "name email avatarUrl")
        .populate("project", "name")
        .populate("task", "title")
        .lean();
      if (notification) emitNotificationToUser(input.recipientId, notification);
    }
  } catch (error) {
    // A duplicate key means another scheduler tick/process already created it.
    if (!(error && typeof error === "object" && "code" in error && error.code === 11000)) {
      throw error;
    }
  }
}

/** Runs once per minute and creates at most one reminder per task/due-date/recipient. */
export async function runTaskReminderSweep(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const soon = new Date(now.getTime() + DAY);
    const dueSoonTasks = await Task.find({
      status: { $ne: "done" },
      dueDate: { $gt: now, $lte: soon },
    }).select("title project assignee createdBy dueDate").lean();

    for (const task of dueSoonTasks) {
      const projectId = idOf(task.project);
      const dueDate = task.dueDate ? new Date(task.dueDate) : undefined;
      const recipientId = idOf(task.assignee) ?? idOf(task.createdBy);
      if (!projectId || !dueDate || !recipientId) continue;
      const dueKey = dueDate.toISOString();
      await createReminder({
        taskId: String(task._id),
        projectId,
        recipientId,
        title: task.title,
        dueDate,
        type: "task.reminder_due_soon",
        message: `Reminder: “${task.title}” is due within 24 hours.`,
        key: `due-soon:${task._id}:${recipientId}:${dueKey}`,
      });
    }

    // Overdue reminders are sent once per recipient/task per local server day.
    const overdueTasks = await Task.find({
      status: { $ne: "done" },
      dueDate: { $lt: now },
    }).select("title project assignee createdBy dueDate").lean();
    const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    for (const task of overdueTasks) {
      const projectId = idOf(task.project);
      const dueDate = task.dueDate ? new Date(task.dueDate) : undefined;
      const recipientId = idOf(task.assignee) ?? idOf(task.createdBy);
      if (!projectId || !dueDate || !recipientId) continue;
      await createReminder({
        taskId: String(task._id),
        projectId,
        recipientId,
        title: task.title,
        dueDate,
        type: "task.reminder_overdue",
        message: `Overdue: “${task.title}” still needs attention.`,
        key: `overdue:${task._id}:${recipientId}:${dueDate.toISOString()}:${dayKey}`,
      });
    }
  } catch (error) {
    console.error("[Task reminders] Sweep failed:", error);
  } finally {
    running = false;
  }
}

export function startTaskReminderScheduler(): void {
  if (interval) return;
  // Run once at startup, then check every minute.
  void runTaskReminderSweep();
  interval = setInterval(() => void runTaskReminderSweep(), MINUTE);
  console.log("[Task reminders] Scheduler started (60-second interval)");
}

export function stopTaskReminderScheduler(): void {
  if (interval) clearInterval(interval);
  interval = undefined;
}
