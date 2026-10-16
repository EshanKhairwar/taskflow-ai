import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

/**
 * Initialize Firebase Admin only when an auth request needs it.
 * This lets local development boot without Firebase credentials when desired,
 * while production must configure FIREBASE_SERVICE_ACCOUNT_JSON.
 */
export function getFirebaseAdminAuth(): Auth {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

  if (!serviceAccountJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing");
  }

  let serviceAccount: ReturnType<typeof JSON.parse>;
  try {
    serviceAccount = JSON.parse(serviceAccountJson) as ReturnType<typeof JSON.parse>;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert(serviceAccount),
    });
  }

  return getAuth();
}
