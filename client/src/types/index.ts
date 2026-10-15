export const TASK_STATUSES = ["todo", "in_progress", "in_review", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = "low" | "medium" | "high";

export interface UserSummary {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  avatar?: string;
}

export interface Task {
  _id: string;
  title: string;
  description?: string;
  project: string | { _id: string };
  assignee?: string | UserSummary | null;
  createdBy?: string | UserSummary;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  position: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TasksResponse {
  tasks: Task[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MoveTaskInput {
  status: TaskStatus;
  position: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  assignee?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  position?: number;
}


