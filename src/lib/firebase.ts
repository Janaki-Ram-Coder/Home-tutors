import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, getFirestore, doc, getDocFromServer, setLogLevel, Firestore } from "firebase/firestore";
import { getAnalytics, isSupported } from "firebase/analytics";

// Silence noisy internal network retry messages from the Firebase SDK
try {
  setLogLevel("silent");
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
 * Connected to database '(default)'.
 */
export const FIRESTORE_DATABASE_ID = "(default)";

let firestoreInstance: Firestore;
try {
  firestoreInstance = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
    }
  );
} catch {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;

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
