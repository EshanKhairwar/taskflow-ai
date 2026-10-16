import { apiRequest } from "./client";

export interface CommentAuthor {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  avatarUrl?: string;
}

export interface TaskComment {
  _id: string;
  task: string;
  project: string;
  author: CommentAuthor | string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export async function getTaskComments(
  taskId: string,
): Promise<{ comments: TaskComment[] }> {
  return apiRequest<{ comments: TaskComment[] }>(
    `/comments/tasks/${encodeURIComponent(taskId)}`,
  );
}

export async function createTaskComment(
  taskId: string,
  body: string,
): Promise<{ comment: TaskComment }> {
  return apiRequest<{ comment: TaskComment }>(
    `/comments/tasks/${encodeURIComponent(taskId)}`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    },
  );
}
