
import { apiRequest } from "./client";

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  name: string;
  email: string;
  password: string;
}

export interface AuthUser {
  _id?: string;
  id?: string;
  name?: string;
  email: string;
}

export interface AuthResponse {
  message?: string;
  user?: AuthUser;
  data?: {
    user?: AuthUser;
  };
}

/**
 * Log in and let the backend set the HTTP-only JWT cookie.
 */
export async function loginUser(
  credentials: LoginCredentials
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password,
    }),
  });
}

/**
 * Register a new account.
 * Adjust the endpoint or fields if your backend uses a different contract.
 */
export async function registerUser(
  credentials: RegisterCredentials
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: credentials.name.trim(),
      email: credentials.email.trim().toLowerCase(),
      password: credentials.password,
    }),
  });
}

/**
 * Log out and ask the backend to clear the authentication cookie.
 */
export async function logoutUser(): Promise<void> {
  await apiRequest<unknown>("/auth/logout", {
    method: "POST",
  });
}
