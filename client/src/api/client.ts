const configuredApiUrl = import.meta.env.VITE_API_URL;

const API_URL = (configuredApiUrl || "http://localhost:5000/api/v1").replace(
  /\/+$/,
  "",
);
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  let response: Response;

  try {
    response = await fetch(`${API_URL}${normalizedPath}`, {
      ...options,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error(
      "Cannot reach TaskFlow AI server. Check your connection and API URL.",
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const data: unknown = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => "");

  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : typeof data === "string" && data.trim()
          ? data.slice(0, 240)
          : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data as T;
}
