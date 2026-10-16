import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  reload,
} from "firebase/auth";
import { firebaseAuth } from "../firebase";
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
  avatarUrl?: string;
}

export interface AuthResponse {
  message?: string;
  user?: AuthUser;
  data?: { user?: AuthUser };
}

function friendlyFirebaseError(error: unknown): Error {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

  const messages: Record<string, string> = {
    "auth/email-already-in-use": "An account already exists for this email. Please sign in instead.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/weak-password": "Choose a stronger password (at least 8 characters).",
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/user-disabled": "This account has been disabled.",
    "auth/too-many-requests": "Too many attempts. Please wait a little and try again.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/operation-not-allowed": "Email/password sign-in is not enabled in Firebase Authentication.",
  };

  return new Error(
    messages[code] ??
      (error instanceof Error ? error.message : "Authentication failed. Please try again."),
  );
}

/** Creates a Firebase account and sends a verification link to its email. */
export async function registerUser(
  credentials: RegisterCredentials,
): Promise<{ message: string }> {
  try {
    const name = credentials.name.trim();
    const email = credentials.email.trim().toLowerCase();
    const result = await createUserWithEmailAndPassword(
      firebaseAuth,
      email,
      credentials.password,
    );

    await updateProfile(result.user, { displayName: name });
    await sendEmailVerification(result.user);
    await signOut(firebaseAuth);

    return {
      message: "Verification link sent. Check your inbox and spam folder, then sign in.",
    };
  } catch (error) {
    throw friendlyFirebaseError(error);
  }
}

/** Signs in with Firebase, verifies the email, then exchanges the ID token for the app's HTTP-only session cookie. */
export async function loginUser(
  credentials: LoginCredentials,
): Promise<AuthResponse> {
  try {
    const result = await signInWithEmailAndPassword(
      firebaseAuth,
      credentials.email.trim().toLowerCase(),
      credentials.password,
    );

    await reload(result.user);

    if (!result.user.emailVerified) {
      throw new Error(
        "Please verify your email first. Sign in again after clicking the verification link.",
      );
    }

    const idToken = await result.user.getIdToken(true);
    return await apiRequest<AuthResponse>("/auth/firebase-session", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    });
  } catch (error) {
    throw friendlyFirebaseError(error);
  }
}

/** Sends/re-sends Firebase's verification link to the currently signed-in unverified account. */
export async function resendFirebaseVerification(): Promise<void> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error("Sign in with your email and password first, then request a new verification link.");
  }

  await reload(user);

  if (user.emailVerified) {
    return;
  }

  try {
    await sendEmailVerification(user);
  } catch (error) {
    throw friendlyFirebaseError(error);
  }
}

/** Clears both the backend cookie and Firebase client session. */
export async function logoutUser(): Promise<void> {
  try {
    await apiRequest<unknown>("/auth/logout", { method: "POST" });
  } finally {
    await signOut(firebaseAuth);
  }
}
