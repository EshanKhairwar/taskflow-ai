import { apiRequest } from "./client";
import type { CreateTaskInput, MoveTaskInput, Task, TasksResponse, TaskStatus } from "../types";

export interface TaskFilters {
  status?: TaskStatus;
  priority?: "low" | "medium" | "high";
  assignee?: string;
  search?: string;
  page?: number;
  limit?: number;
}

function queryString(filters: TaskFilters = {}): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function getProjectTasks(projectId: string, filters: TaskFilters = {}): Promise<TasksResponse> {
  return apiRequest<TasksResponse>(`/projects/${encodeURIComponent(projectId)}/tasks${queryString(filters)}`);
}

export async function createTask(projectId: string, input: CreateTaskInput): Promise<{ task: Task }> {
  return apiRequest<{ task: Task }>(`/projects/${encodeURIComponent(projectId)}/tasks`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateTask(taskId: string, input: Partial<CreateTaskInput>): Promise<{ task: Task }> {
  return apiRequest<{ task: Task }>(`/tasks/${encodeURIComponent(taskId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function moveTask(taskId: string, input: MoveTaskInput): Promise<{ task: Task }> {
  return apiRequest<{ task: Task }>(`/tasks/${encodeURIComponent(taskId)}/move`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function deleteTask(taskId: string): Promise<void> {
  await apiRequest<unknown>(`/tasks/${encodeURIComponent(taskId)}`, { method: "DELETE" });
}
