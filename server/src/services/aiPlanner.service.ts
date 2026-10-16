
import { z } from "zod";

/**
 * TaskFlow AI task suggestion service.
 *
 * Primary provider: Groq
 * Backup provider: Mistral
 *
 * Uses native fetch, so no provider-specific SDK is required.
 */

const TaskSuggestionSchema = z
  .object({
    title: z.string().trim().min(2).max(150),
    description: z.string().trim().max(5000),
    priority: z.enum(["low", "medium", "high"]),
    subtasks: z.array(z.string().trim().min(1).max(250)).max(8),
  })
  .strict();

export type TaskSuggestion = z.infer<typeof TaskSuggestionSchema>;

type ProviderName = "Groq" | "Mistral";

interface ProviderConfig {
  name: ProviderName;
  apiKey: string | undefined;
  baseUrl: string;
  model: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
}

class ProviderRequestError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderRequestError";
  }
}

const timeoutMs = Math.max(
  1000,
  Number(process.env.AI_PROVIDER_TIMEOUT_MS) || 25000,
);

const providers: ProviderConfig[] = [
  {
    name: "Groq",
    apiKey: process.env.GROQ_API_KEY,
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
  },
  {
    name: "Mistral",
    apiKey: process.env.MISTRAL_API_KEY,
    baseUrl: "https://api.mistral.ai/v1/chat/completions",
    model: process.env.MISTRAL_MODEL || "mistral-small-latest",
  },
];

const SYSTEM_PROMPT = `
You are TaskFlow AI, an assistant that creates useful project tasks.

Return only one valid JSON object with exactly these fields:
{
  "title": "A clear task title",
  "description": "A useful, actionable task description",
  "priority": "low | medium | high",
  "subtasks": ["Step one", "Step two"]
}

Rules:
- Create one realistic task based on the user's request.
- Keep the title concise and actionable.
- The description should explain the expected result.
- Choose priority based on urgency and impact.
- Generate between 3 and 6 short, actionable subtasks.
- Do not include markdown fences or extra properties.
- Subtasks are suggestions for preview only; do not claim they
  have been saved as individual tasks.
`.trim();

function isRetryableStatus(status: number): boolean {
  return (
    status === 408 ||
    status === 409 ||
    status === 425 ||
    status === 429 ||
    status >= 500
  );
}

function parseJsonContent(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new ProviderRequestError(
      "The AI provider returned invalid JSON.",
      true,
    );
  }
}

async function requestFromProvider(
  provider: ProviderConfig,
  prompt: string,
): Promise<TaskSuggestion> {
  if (!provider.apiKey) {
    throw new ProviderRequestError(
      `${provider.name} API key is not configured.`,
      false,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;

    try {
      response = await fetch(provider.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 1200,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      const timedOut =
        error instanceof Error && error.name === "AbortError";

      throw new ProviderRequestError(
        timedOut
          ? `${provider.name} request timed out.`
          : `${provider.name} network request failed.`,
        true,
      );
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;

      const message =
        body?.error?.message ||
        `${provider.name} returned HTTP ${response.status}.`;

      throw new ProviderRequestError(
        message,
        isRetryableStatus(response.status),
        response.status,
      );
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new ProviderRequestError(
        `${provider.name} returned an empty response.`,
        true,
      );
    }

    const parsed = parseJsonContent(content);
    const validated = TaskSuggestionSchema.safeParse(parsed);

    if (!validated.success) {
      // A different provider may produce valid task data.
      throw new ProviderRequestError(
        `${provider.name} returned a response with an invalid task structure.`,
        true,
      );
    }

    return validated.data;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Generates one task suggestion.
 *
 * The route can continue calling this function with its existing prompt.
 * The public endpoint and response wrapper do not need to change.
 */
export async function generateTaskSuggestion(
  prompt: string,
): Promise<TaskSuggestion> {
  const cleanPrompt = prompt.trim();

  if (!cleanPrompt) {
    throw new Error("A task prompt is required.");
  }

  if (cleanPrompt.length > 10000) {
    throw new Error("The task prompt is too long.");
  }

  const configuredProviders = providers.filter(
    (provider) => Boolean(provider.apiKey),
  );

  if (configuredProviders.length === 0) {
    throw new Error(
      "Configure GROQ_API_KEY and/or MISTRAL_API_KEY in the server environment.",
    );
  }

  const failures: string[] = [];

  for (const provider of configuredProviders) {
    try {
      const task = await requestFromProvider(provider, cleanPrompt);

      console.info(`[AI Planner] Success using ${provider.name}.`);
      return task;
    } catch (error) {
      const failure =
        error instanceof Error ? error.message : "Unknown provider error";

      // Do not log API keys or the complete request.
      console.warn(`[AI Planner] ${provider.name} failed: ${failure}`);
      failures.push(`${provider.name}: ${failure}`);

      const isRetryable =
        error instanceof ProviderRequestError && error.retryable;

      // Only fall back on transient errors. Configuration and other
      // non-retryable errors should be corrected instead of hidden.
      if (!isRetryable) {
        throw new Error(
          `${provider.name} could not generate a task. ${failure}`,
        );
      }
    }
  }

  throw new Error(
    `All configured AI providers failed. ${failures.join(" | ")}`,
  );
}


const ProjectPlanSchema = z
  .object({
    tasks: z.array(TaskSuggestionSchema).min(3).max(8),
  })
  .strict();

export type ProjectPlanSuggestion = z.infer<typeof ProjectPlanSchema>;

const PROJECT_PLAN_SYSTEM_PROMPT = `
You are TaskFlow AI, a project planning assistant.
Return only a valid JSON object with exactly one property named "tasks".
"tasks" must contain 3 to 8 actionable task objects. Every task must have exactly:
- title: concise actionable title (2-150 characters)
- description: clear expected outcome
- priority: low, medium, or high
- subtasks: 3 to 6 short actionable strings
Create a sensible order from setup/foundations through implementation, testing, and delivery where appropriate.
Avoid duplicate tasks. Do not include markdown or extra properties. These are drafts only; do not claim they have been saved.
`.trim();

async function requestProjectPlanFromProvider(
  provider: ProviderConfig,
  prompt: string,
): Promise<ProjectPlanSuggestion> {
  if (!provider.apiKey) {
    throw new ProviderRequestError(
      `${provider.name} API key is not configured.`,
      false,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let response: Response;
    try {
      response = await fetch(provider.baseUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${provider.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: "system", content: PROJECT_PLAN_SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 3000,
          response_format: { type: "json_object" },
        }),
        signal: controller.signal,
      });
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      throw new ProviderRequestError(
        timedOut ? `${provider.name} request timed out.` : `${provider.name} network request failed.`,
        true,
      );
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      throw new ProviderRequestError(
        body?.error?.message || `${provider.name} returned HTTP ${response.status}.`,
        isRetryableStatus(response.status),
        response.status,
      );
    }

    const data = (await response.json()) as ChatCompletionResponse;
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new ProviderRequestError(`${provider.name} returned an empty response.`, true);
    }

    const validated = ProjectPlanSchema.safeParse(parseJsonContent(content));
    if (!validated.success) {
      throw new ProviderRequestError(
        `${provider.name} returned a response with an invalid project plan structure.`,
        true,
      );
    }
    return validated.data;
  } finally {
    clearTimeout(timeout);
  }
}

/** Generate a multi-task project plan without saving it to the database. */
export async function generateProjectPlan(
  prompt: string,
): Promise<ProjectPlanSuggestion> {
  const cleanPrompt = prompt.trim();
  if (cleanPrompt.length < 10 || cleanPrompt.length > 2000) {
    throw new Error("Project plan prompt must contain 10–2000 characters.");
  }

  const configuredProviders = providers.filter((provider) => Boolean(provider.apiKey));
  if (configuredProviders.length === 0) {
    throw new Error("AI_NOT_CONFIGURED");
  }

  const failures: string[] = [];
  for (const provider of configuredProviders) {
    try {
      const plan = await requestProjectPlanFromProvider(provider, cleanPrompt);
      console.info(`[AI Planner] Project plan generated using ${provider.name}.`);
      return plan;
    } catch (error) {
      const failure = error instanceof Error ? error.message : "Unknown provider error";
      console.warn(`[AI Planner] ${provider.name} project plan failed: ${failure}`);
      failures.push(`${provider.name}: ${failure}`);
      if (!(error instanceof ProviderRequestError) || !error.retryable) {
        throw new Error(failure);
      }
    }
  }
  throw new Error(`All configured AI providers failed. ${failures.join(" | ")}`);
}
