
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


export interface ProjectPlanTask {
  title: string;
  description: string;
  priority: "low" | "medium" | "high";
  subtasks: string[];
}

export interface GeneratedProjectPlan {
  title: string;
  summary: string;
  tasks: ProjectPlanTask[];
}

interface GenerateProjectPlanResponse {
  plan?: {
    title?: string;
    summary?: string;
    tasks?: Array<{
      title?: unknown;
      description?: unknown;
      priority?: unknown;
      subtasks?: unknown;
    }>;
  };
  title?: string;
  summary?: string;
  tasks?: Array<{
    title?: unknown;
    description?: unknown;
    priority?: unknown;
    subtasks?: unknown;
  }>;
}

export async function generateProjectPlan(
  projectId: string,
  prompt: string,
): Promise<GeneratedProjectPlan> {
  const cleanPrompt = prompt.trim();
  if (!projectId) throw new Error("Project ID is required.");
  if (cleanPrompt.length < 10) {
    throw new Error("Describe your project in at least 10 characters.");
  }

  const response = await apiRequest<GenerateProjectPlanResponse>(
    "/ai/generate-project-plan",
    {
      method: "POST",
      body: JSON.stringify({ projectId, prompt: cleanPrompt }),
    },
  );

  const rawPlan = response.plan ?? response;
  const rawTasks = Array.isArray(rawPlan.tasks) ? rawPlan.tasks : [];
  const tasks: ProjectPlanTask[] = rawTasks
    .filter((task) => typeof task.title === "string" && task.title.trim())
    .map((task) => ({
      title: String(task.title).trim(),
      description: typeof task.description === "string" ? task.description : "",
      priority:
        task.priority === "low" || task.priority === "high"
          ? task.priority
          : "medium",
      subtasks: Array.isArray(task.subtasks)
        ? task.subtasks.filter((item): item is string => typeof item === "string")
        : [],
    }));

  if (!tasks.length) {
    throw new Error("The AI response did not contain any valid tasks. Please try a more detailed prompt.");
  }

  return {
    title: typeof rawPlan.title === "string" ? rawPlan.title : "AI project plan",
    summary: typeof rawPlan.summary === "string" ? rawPlan.summary : "",
    tasks,
  };
}
