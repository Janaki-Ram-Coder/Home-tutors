import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore, doc, getDocFromServer, setLogLevel, Firestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// Keep fatal Firestore errors visible while avoiding verbose internal retry noise
try {
  setLogLevel("error");
} catch {
  // Ignore if already set
}

// Web app's Firebase configuration provided by the user
export const firebaseConfig = {
  apiKey: "AIzaSyCoTtguWDvtFaLc-bqtm6ndccqDX0qQPY4",
  authDomain: "kumariinstitute-80399.firebaseapp.com",
  projectId: "kumariinstitute-80399",
  storageBucket: "kumariinstitute-80399.firebasestorage.app",
  messagingSenderId: "485093703555",
  appId: "1:485093703555:web:eb5fc058cafa01ac0540b6",
  measurementId: "G-VE3J2X6D8M"
};

export const isFirebaseConfigured = true;

// Initialize Firebase app singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Authentication
export const auth = getAuth(app);

/**
 * Cloud Firestore Database Instance.
 * Connected to database '(default)' with forced long-polling for maximum reliability
 * across iframes, mobile carriers, and proxied environments where WebChannel can stall.
 */
export const FIRESTORE_DATABASE_ID = "(default)";

let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
    }
  );
} catch {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;

/**
 * Decode a single Cloud Firestore REST API typed value into a plain JavaScript value.
 */
export function decodeFirestoreRestValue(val: any): any {
  if (!val || typeof val !== "object") return undefined;
  if ("stringValue" in val) return val.stringValue;
  if ("booleanValue" in val) return Boolean(val.booleanValue);
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return Number(val.doubleValue);
  if ("timestampValue" in val) return val.timestampValue;
  if ("nullValue" in val) return null;
  if ("arrayValue" in val) {
    const arr = Array.isArray(val.arrayValue?.values) ? val.arrayValue.values : [];
    return arr.map((item: any) => decodeFirestoreRestValue(item));
  }
  if ("mapValue" in val) {
    const fields = val.mapValue?.fields || {};
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeFirestoreRestValue(v);
    }
    return out;
  }
  return undefined;
}

/**
 * Resilient HTTPS REST fallback reader for a Firestore collection.
 * Used automatically whenever WebChannel/SDK real-time listeners encounter transient network issues.
 */
export async function fetchFirestoreCollectionRest<T = Record<string, any>>(
  collectionName: string,
  pageSize = 300
): Promise<Array<T & { id: string }>> {
  const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${encodeURIComponent(
    FIRESTORE_DATABASE_ID
  )}/documents/${encodeURIComponent(collectionName)}?pageSize=${pageSize}`;

  const resp = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  if (!resp.ok) {
    throw new Error(`Firestore REST ${collectionName} HTTP ${resp.status}`);
  }
  const payload = await resp.json();
  const documents = Array.isArray(payload?.documents) ? payload.documents : [];

  return documents.map((docItem: any) => {
    const docId = String(docItem?.name || "").split("/").pop() || "";
    const fields = docItem?.fields || {};
    const parsed: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields)) {
      parsed[key] = decodeFirestoreRestValue(value);
    }
    return {
      ...parsed,
      id: docId
    } as T & { id: string };
  });
}

// Real-time connection status state for UI feedback
export interface FirestoreConnectionState {
  connected: boolean;
  databaseId: string;
  projectId: string;
  error?: string;
  lastChecked?: string;
}

/**
 * Check real-time Firestore connectivity to (default) database
 */
export async function verifyFirestoreConnection(): Promise<FirestoreConnectionState> {
  try {
    const probeRef = doc(db, "_probe", "health");
    const probePromise = getDocFromServer(probeRef);
    const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500));
    await Promise.race([probePromise, timeoutPromise]);

    return {
      connected: true,
      databaseId: FIRESTORE_DATABASE_ID,
      projectId: firebaseConfig.projectId,
      lastChecked: new Date().toISOString()
    };
  } catch (err: any) {
    const errMsg = err?.message || '';
    if (errMsg.includes('client is offline')) {
      console.warn('Please check your Firebase configuration or network connectivity.');
    }
    let friendlyError = 'Connecting to Cloud Firestore...';
    if (errMsg.includes('Native mode API is disabled') || errMsg.includes('FAILED_PRECONDITION')) {
      friendlyError = 'Database mode notice: Database requires Firestore in Native mode.';
    } else if (errMsg.includes('NOT_FOUND') || errMsg.includes('does not exist')) {
      friendlyError = `Database '${FIRESTORE_DATABASE_ID}' not found in project.`;
    }
    return {
      connected: false,
      databaseId: FIRESTORE_DATABASE_ID,
      projectId: firebaseConfig.projectId,
      error: friendlyError,
      lastChecked: new Date().toISOString()
    };
  }
}

// Run non-blocking boot connectivity test once in browser environment
if (typeof window !== "undefined") {
  verifyFirestoreConnection().catch(() => {});
}

// Initialize Analytics conditionally for browser environment
export let analytics: ReturnType<typeof getAnalytics> | null = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {
    // Analytics not supported or blocked in current environment
  });
}
