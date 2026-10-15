
import { apiRequest } from "./client";

export interface GeneratedTask {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  subtasks: string[];
}

interface GenerateTaskResponse {
  message: string;
  task: GeneratedTask;
}

export async function generateTask(
  projectId: string,
  prompt: string,
): Promise<GeneratedTask> {
  const cleanPrompt = prompt.trim();

  if (!projectId) {
    throw new Error("Project ID is required.");
  }

  if (cleanPrompt.length < 5) {
    throw new Error("Please describe the task in at least 5 characters.");
  }

  const response = await apiRequest<GenerateTaskResponse>(
    "/ai/generate-task",
    {
      method: "POST",
      body: JSON.stringify({
        projectId,
        prompt: cleanPrompt,
      }),
    },
  );

  if (
    !response.task ||
    typeof response.task.title !== "string" ||
    !Array.isArray(response.task.subtasks)
  ) {
    throw new Error("AI returned an invalid task suggestion.");
  }

  return {
    title: response.task.title,
    description: response.task.description ?? "",
    priority: response.task.priority,
    subtasks: response.task.subtasks.filter(
      (item): item is string => typeof item === "string",
    ),
  };
}
