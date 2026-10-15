import { Router, type Request } from "express";

import mongoose from "mongoose";

import { z } from "zod";

import Task from "../models/Task.js";

import Project from "../models/Project.js";

import { authenticate, type AuthRequest } from "../middleware/authenticate.js";

const router = Router();

const statuses = ["todo", "in_progress", "in_review", "done"] as const;

const priorities = ["low", "medium", "high"] as const;

const createTaskSchema = z

  .object({
    title: z.string().trim().min(2).max(150),

    description: z.string().trim().max(5000).optional(),

    assignee: z.string().refine(mongoose.isValidObjectId).optional(),

    status: z.enum(statuses).optional(),

    priority: z.enum(priorities).optional(),

    dueDate: z.coerce.date().nullable().optional(),

    position: z.number().min(0).max(1_000_000).optional(),
  })

  .strict();

const updateTaskSchema = z

  .object({
    title: z.string().trim().min(2).max(150).optional(),

    description: z.string().trim().max(5000).optional(),

    assignee: z.string().refine(mongoose.isValidObjectId).nullable().optional(),

    status: z.enum(statuses).optional(),

    priority: z.enum(priorities).optional(),

    dueDate: z.coerce.date().nullable().optional(),

    position: z.number().min(0).max(1_000_000).optional(),
  })

  .strict()

  .refine((data) => Object.keys(data).length > 0, {
    message: "Provide at least one field to update",
  });

const moveTaskSchema = z

  .object({
    status: z.enum(statuses),

    position: z.number().min(0).max(1_000_000),
  })

  .strict();

function getUserId(req: Request): string | undefined {
  return (req as AuthRequest).userId;
}

// Type guard: validates IDs and narrows them to a string.*

function validId(id: unknown): id is string {
  return typeof id === "string" && mongoose.isValidObjectId(id);
}

async function getAccessibleProject(projectId: string, userId: string) {
  return Project.findOne({
    _id: projectId,

    $or: [{ owner: userId }, { "members.user": userId }],
  });
}

async function isProjectMember(
  projectId: mongoose.Types.ObjectId | string,

  userId: string,
): Promise<boolean> {
  const project = await Project.exists({
    _id: projectId,

    $or: [{ owner: userId }, { "members.user": userId }],
  });

  return Boolean(project);
}

async function isValidAssignee(
  projectId: mongoose.Types.ObjectId | string,

  assigneeId: string,
): Promise<boolean> {
  const project = await Project.exists({
    _id: projectId,

    $or: [{ owner: assigneeId }, { "members.user": assigneeId }],
  });

  return Boolean(project);
}

// GET /api/v1/projects/:projectId/tasks*

router.get(
  "/projects/:projectId/tasks",
  authenticate,
  async (req, res, next) => {
    try {
      const userId = getUserId(req);

      const { projectId } = req.params;

      if (!userId) {
        res.status(401).json({ message: "Authentication required" });

        return;
      }

      if (!validId(projectId)) {
        res.status(400).json({ message: "Invalid project ID" });

        return;
      }

      const project = await getAccessibleProject(projectId, userId);

      if (!project) {
        res.status(404).json({ message: "Project not found" });

        return;
      }

      const querySchema = z.object({
        status: z.enum(statuses).optional(),

        priority: z.enum(priorities).optional(),

        assignee: z.string().refine(mongoose.isValidObjectId).optional(),

        search: z.string().trim().max(100).optional(),

        page: z.coerce.number().int().min(1).default(1),

        limit: z.coerce.number().int().min(1).max(100).default(20),
      });

      const parsed = querySchema.safeParse(req.query);

      if (!parsed.success) {
        res.status(400).json({
          message: "Invalid task filters",

          errors: parsed.error.flatten(),
        });

        return;
      }

      const { status, priority, assignee, search, page, limit } = parsed.data;

      const filter: Record<string, any> = {
        project: project._id,
      };

      if (status) filter.status = status;

      if (priority) filter.priority = priority;

      if (assignee) filter.assignee = assignee;

      if (search) {
        filter.$or = [
          { title: { $regex: escapeRegex(search), $options: "i" } },

          { description: { $regex: escapeRegex(search), $options: "i" } },
        ];
      }

      const [tasks, total] = await Promise.all([
        Task.find(filter)

          .sort({ status: 1, position: 1, createdAt: -1 })

          .skip((page - 1) * limit)

          .limit(limit)

          .populate("assignee", "name email")

          .populate("createdBy", "name email")

          .lean(),

        Task.countDocuments(filter),
      ]);

      res.json({
        tasks,

        pagination: {
          page,

          limit,

          total,

          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

// Escape user input before using it in a regular expression.*

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// POST /api/v1/projects/:projectId/tasks*

router.post(
  "/projects/:projectId/tasks",
  authenticate,
  async (req, res, next) => {
    try {
      const userId = getUserId(req);

      const { projectId } = req.params;

      if (!userId) {
        res.status(401).json({ message: "Authentication required" });

        return;
      }

      if (!validId(projectId)) {
        res.status(400).json({ message: "Invalid project ID" });

        return;
      }

      const parsed = createTaskSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          message: "Invalid task data",

          errors: parsed.error.flatten(),
        });

        return;
      }

      const project = await getAccessibleProject(projectId, userId);

      if (!project) {
        res.status(404).json({ message: "Project not found" });

        return;
      }

      const data = parsed.data;

      if (data.assignee) {
        const allowed = await isValidAssignee(project._id, data.assignee);

        if (!allowed) {
          res.status(400).json({
            message: "Assignee must be a member of this project",
          });

          return;
        }
      }

      const task = await Task.create({
        title: data.title,

        description: data.description ?? "",

        project: project._id,

        createdBy: userId,

        ...(data.assignee ? { assignee: data.assignee } : {}),

        ...(data.dueDate ? { dueDate: data.dueDate } : {}),

        status: data.status ?? "todo",

        priority: data.priority ?? "medium",

        position: data.position ?? 0,
      });

      res.status(201).json({ task });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/tasks/my-tasks*

// IMPORTANT: This static route must be registered before /tasks/:id.*

router.get("/tasks/my-tasks", authenticate, async (req, res, next) => {
  try {
    const userId = getUserId(req);

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });

      return;
    }

    // Restrict results to projects where the current user is owner/member.*

    const projects = await Project.find({
      $or: [{ owner: userId }, { "members.user": userId }],
    })

      .select("_id name")

      .lean();

    const projectIds = projects.map((project) => project._id);

    if (projectIds.length === 0) {
      res.json({ tasks: [] });

      return;
    }

    // My Tasks means tasks assigned to the authenticated user.*

    const tasks = await Task.find({
      project: { $in: projectIds },

      assignee: userId,
    })

      .sort({ status: 1, dueDate: 1, createdAt: -1 })

      .populate("project", "name")

      .populate("assignee", "name email")

      .populate("createdBy", "name email")

      .lean();

    res.json({ tasks });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/tasks/:id*

router.get("/tasks/:id", authenticate, async (req, res, next) => {
  try {
    const userId = getUserId(req);

    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });

      return;
    }

    if (!validId(id)) {
      res.status(400).json({ message: "Invalid task ID" });

      return;
    }

    const task = await Task.findById(id)

      .populate("assignee", "name email")

      .populate("createdBy", "name email");

    if (!task) {
      res.status(404).json({ message: "Task not found" });

      return;
    }

    if (!(await isProjectMember(task.project, userId))) {
      res.status(404).json({ message: "Task not found" });

      return;
    }

    res.json({ task });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/tasks/:id*

router.patch("/tasks/:id", authenticate, async (req, res, next) => {
  try {
    const userId = getUserId(req);

    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });

      return;
    }

    if (!validId(id)) {
      res.status(400).json({ message: "Invalid task ID" });

      return;
    }

    const parsed = updateTaskSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid task update",

        errors: parsed.error.flatten(),
      });

      return;
    }

    const task = await Task.findById(id);

    if (!task) {
      res.status(404).json({ message: "Task not found" });

      return;
    }

    if (!(await isProjectMember(task.project, userId))) {
      res.status(404).json({ message: "Task not found" });

      return;
    }

    const data = parsed.data;

    if (data.assignee) {
      const allowed = await isValidAssignee(task.project, data.assignee);

      if (!allowed) {
        res.status(400).json({
          message: "Assignee must be a member of this project",
        });

        return;
      }
    }

    if (data.title !== undefined) task.title = data.title;

    if (data.description !== undefined) task.description = data.description;

    if (data.status !== undefined) task.status = data.status;

    if (data.priority !== undefined) task.priority = data.priority;

    if (data.position !== undefined) task.position = data.position;

    if (data.assignee === null) {
      task.set("assignee", undefined);
    } else if (data.assignee !== undefined) {
      task.assignee = new mongoose.Types.ObjectId(data.assignee);
    }

    if (data.dueDate === null) {
      task.set("dueDate", undefined);
    } else if (data.dueDate !== undefined) {
      task.dueDate = data.dueDate;
    }

    await task.save();

    res.json({ task });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/tasks/:id/move*

router.patch("/tasks/:id/move", authenticate, async (req, res, next) => {
  try {
    const userId = getUserId(req);

    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });

      return;
    }

    if (!validId(id)) {
      res.status(400).json({ message: "Invalid task ID" });

      return;
    }

    const parsed = moveTaskSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        message: "Invalid board position",

        errors: parsed.error.flatten(),
      });

      return;
    }

    const task = await Task.findById(id);

    if (!task) {
      res.status(404).json({ message: "Task not found" });

      return;
    }

    if (!(await isProjectMember(task.project, userId))) {
      res.status(404).json({ message: "Task not found" });

      return;
    }

    task.status = parsed.data.status;

    task.position = parsed.data.position;

    await task.save();

    res.json({ task });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/tasks/:id*

router.delete("/tasks/:id", authenticate, async (req, res, next) => {
  try {
    const userId = getUserId(req);

    const { id } = req.params;

    if (!userId) {
      res.status(401).json({ message: "Authentication required" });

      return;
    }

    if (!validId(id)) {
      res.status(400).json({ message: "Invalid task ID" });

      return;
    }

    const task = await Task.findById(id);

    if (!task) {
      res.status(404).json({ message: "Task not found" });

      return;
    }

    if (!(await isProjectMember(task.project, userId))) {
      res.status(404).json({ message: "Task not found" });

      return;
    }

    const project = await Project.findById(task.project);

    if (!project) {
      res.status(404).json({ message: "Task not found" });

      return;
    }

    const isAdmin =
      project.owner.toString() === userId ||
      project.members.some(
        (member) =>
          member.user.toString() === userId && member.role === "admin",
      );

    if (!isAdmin && task.createdBy.toString() !== userId) {
      res.status(403).json({
        message:
          "Only the task creator or a project admin can delete this task",
      });

      return;
    }

    await task.deleteOne();

    res.json({
      message: "Task deleted successfully",

      taskId: id,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
