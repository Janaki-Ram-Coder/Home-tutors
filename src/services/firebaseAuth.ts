import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser,
  GoogleAuthProvider,
  signInWithPopup
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  arrayUnion
} from "firebase/firestore";
import { auth, db, FIRESTORE_DATABASE_ID, verifyFirestoreConnection, firebaseConfig, isFirebaseConfigured, fetchFirestoreCollectionRest } from "../lib/firebase";
import { Tutor, TutorReview, TutorFeeStructure } from "../data/tutorsData";
import { AdminSuccessStory, AdminActivityLog } from "../types";

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      providerInfo: (auth.currentUser?.providerData || []).map((provider) => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      }))
    }
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface ParentRegistrationData {
  email: string;
  password?: string;
  fullName: string;
  phone: string;
  childName?: string;
  childGrade?: string;
  board?: string;
  subjects?: string[];
  locality?: string;
}

export interface TeacherRegistrationData {
  email: string;
  password?: string;
  fullName: string;
  phone: string;
  latitude?: number;
  longitude?: number;
  localityId?: string;
  address?: string;
  locationArea?: string;
  qualification?: string;
  experienceYears?: number;
  subjects?: string[];
  classesHandled?: string[];
  monthlyFee?: number;
  hourlyRate?: number;
  gender?: 'female' | 'male';
  teacherType?: 'home' | 'center';
  bio?: string;
}

export interface UserRegistrationInput {
  name: string;
  email: string;
  phone: string;
  gender: 'male' | 'female' | 'other';
  password: string;
  role: 'parent' | 'teacher';
  latitude?: number;
  longitude?: number;
  locationArea?: string;
  locality?: string;
  address?: string;
}

export interface EnrolledCourse {
  id: string;
  courseId: string;
  title: string;
  subtitle?: string;
  fee: string;
  tag?: string;
  enrolledAt: string;
  status: 'Active' | 'Completed';
}

export interface HiredTutor {
  id: string;
  tutorId: string;
  tutorName: string;
  subjects: string[];
  monthlyFee: number;
  phone?: string;
  locationArea?: string;
  hiredAt: string;
  status: 'Confirmed' | 'Active';
}

export interface DemoBooking {
  id: string;
  studentName?: string;
  grade?: string;
  subject?: string;
  mode?: string;
  preferredDate?: string;
  preferredTime?: string;
  bookedAt: string;
  status: 'Scheduled' | 'Confirmed';
}

export interface UserTask {
  id: string;
  title: string;
  category?: 'Homework' | 'Test' | 'Assignment' | 'Revision' | 'Demo' | 'General';
  dueDate?: string;
  completed: boolean;
  notes?: string;
  createdAt: string;
}

export interface UserProgressMetric {
  courseId: string;
  courseTitle: string;
  progressPercent: number;
  completedLessons: number;
  totalLessons: number;
  lastActive: string;
}

export interface AppUserProfile {
  uid: string;
  name: string;
  email: string;
  role: 'parent' | 'teacher' | 'admin';
  phone?: string;
  whatsappNumber?: string;
  gender?: 'male' | 'female' | 'other';
  profileCompleted?: boolean;
  learningRequirementsSubmitted?: boolean;
  locality?: string;
  latitude?: number;
  longitude?: number;
  childName?: string;
  studentName?: string;
  studentAge?: string;
  childAge?: string;
  childGrade?: string;
  childSchool?: string;
  childBoard?: string;
  board?: string;
  subjectsNeeded?: string[];
  preferredTimeSlot?: string;
  timeSlotNeeded?: string;
  notes?: string;
  targetExam?: string;
  emergencyContact?: string;
  updatedAt?: string;
  qualification?: string;
  highestQualification?: string;
  university?: string;
  experience?: string;
  experienceYears?: number;
  totalExperience?: string | number;
  subjects?: string[];
  classes?: string[];
  classesHandled?: string[];
  monthlyFee?: number;
  hourlyFee?: number;
  hourlyRate?: number;
  tuitionModes?: string[];
  bio?: string;
  fullName?: string;
  locationArea?: string;
  address?: string;
  addressSnippet?: string;
  avatar?: string;
  photoUrl?: string;
  hourlyCharges?: number;
  availableTimeSlots?: string[];
  timeSlots?: string[];
  addressDetails?: {
    line1?: string;
    street?: string;
    landmark?: string;
    city?: string;
    state?: string;
    pincode?: string;
    latitude?: number;
    longitude?: number;
  };
  kycStatus?: 'pending' | 'submitted' | 'verified' | 'approved' | 'rejected';
  verified?: boolean;
  isApproved?: boolean;
  status?: string;
  verificationStatus?: string;
  educationDetails?: any;
  feeStructure?: TutorFeeStructure;
  boardsSupported?: string[];
  enrolledCourses?: EnrolledCourse[];
  hiredTutors?: HiredTutor[];
  bookedTutors?: any[];
  course?: string;
  feesAmount?: number;
  assignedTutor?: string;
  assignedTutorId?: string;
  assignedTutorPhone?: string;
  assignedTutorFee?: number;
  assignedParentName?: string;
  assignedParents?: any[];
  assignedStudents?: any[];
  availableTimings?: string[];
  assignedEducator?: any;
  demoBookings?: DemoBooking[];
  tasks?: UserTask[];
  progress?: Record<string, UserProgressMetric>;
  createdAt?: string;
  lastLoginAt?: string;
  emailVerified?: boolean;
}

export const ADMIN_CREDENTIALS = {
  email: 'kkumariinstitute@gmail.com',
  password: 'ram123',
  name: 'Kumari Institute Admin',
  role: 'admin' as const
};


const SESSION_STORAGE_KEY = 'kumari_user_session';
const USERS_REGISTRY_KEY = 'kumari_registered_users_registry';
const APPROVED_TEACHERS_KEY = 'kumari_approved_teachers_registry';

export function markTeacherApprovedInRegistry(identifier: string | null | undefined): void {
  if (!identifier) return;
  try {
    const raw = localStorage.getItem(APPROVED_TEACHERS_KEY);
    const list: string[] = raw ? JSON.parse(raw) : [];
    const clean = identifier.trim().toLowerCase();
    if (clean && !list.includes(clean)) {
      list.push(clean);
      localStorage.setItem(APPROVED_TEACHERS_KEY, JSON.stringify(list));
    }
  } catch (err) {
    console.warn('Could not mark teacher approved in registry:', err);
  }
}

export function unmarkTeacherApprovedInRegistry(identifier: string | null | undefined): void {
  if (!identifier) return;
  try {
    const raw = localStorage.getItem(APPROVED_TEACHERS_KEY);
    if (!raw) return;
    const list: string[] = JSON.parse(raw);
    const clean = identifier.trim().toLowerCase();
    const updated = list.filter((x) => x !== clean && x !== clean.replace(/^fb_teacher_/, '') && x !== `fb_teacher_${clean}`);
    localStorage.setItem(APPROVED_TEACHERS_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('Could not unmark teacher in registry:', err);
  }
}

export function isTeacherApprovedInRegistry(...identifiers: (string | null | undefined)[]): boolean {
  try {
    const raw = localStorage.getItem(APPROVED_TEACHERS_KEY);
    if (!raw) return false;
    const list: string[] = JSON.parse(raw);
    for (const id of identifiers) {
      if (!id) continue;
      const clean = id.trim().toLowerCase();
      if (list.includes(clean)) return true;
      const stripped = clean.replace(/^fb_teacher_/, '');
      if (list.includes(stripped)) return true;
      if (list.includes(`fb_teacher_${stripped}`)) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

export function saveUserToLocalRegistry(profile: AppUserProfile): void {
  try {
    const raw = localStorage.getItem(USERS_REGISTRY_KEY);
    const registry: Record<string, AppUserProfile> = raw ? JSON.parse(raw) : {};
    if (profile.uid) registry[profile.uid] = profile;
    if (profile.email) registry[profile.email.toLowerCase()] = profile;
    localStorage.setItem(USERS_REGISTRY_KEY, JSON.stringify(registry));
  } catch (err) {
    console.warn('Could not save user to local registry:', err);
  }
}

export function getUserFromLocalRegistry(identifier: string): AppUserProfile | null {
  try {
    const raw = localStorage.getItem(USERS_REGISTRY_KEY);
    if (!raw) return null;
    const registry: Record<string, AppUserProfile> = JSON.parse(raw);
    return registry[identifier] || registry[identifier.toLowerCase()] || null;
  } catch {
    return null;
  }
}

export async function getUserFromPersistentServer(identifier: string): Promise<AppUserProfile | null> {
  try {
    const res = await fetch(`/api/users/${encodeURIComponent(identifier)}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.user) return data.user;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Recursively strips all keys with `undefined` values from an object or array.
 * Cloud Firestore setDoc() and updateDoc() throw an error if any field is undefined.
 */
export function removeUndefinedFields<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .map((item) => removeUndefinedFields(item))
      .filter((item) => item !== undefined) as unknown as T;
  }
  if (typeof obj === 'object' && !(obj instanceof Date)) {
    const cleaned: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleaned[key] = removeUndefinedFields(value);
      }
    }
    return cleaned as T;
  }
  return obj;
}

/**
 * Synchronize user profile across Firestore, persistent Server storage (/api/users), and local registry
 */
export async function syncUserToPersistence(profile: AppUserProfile): Promise<void> {
  // 1. Local backup registry
  saveUserToLocalRegistry(profile);

  // 2. Server persistent storage
  try {
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    });
  } catch (err) {
    console.warn('[Sync] Server user store notice:', err);
  }

  // 3. Cloud Firestore - saved directly to parents or teachers (no users collection)
  try {
    const cleanPayload = removeUndefinedFields(profile);
    if (profile.role === 'teacher') {
      await setDoc(doc(db, "teachers", profile.uid), cleanPayload, { merge: true });
    } else if (profile.role === 'parent') {
      await setDoc(doc(db, "parents", profile.uid), cleanPayload, { merge: true });
    }
  } catch (fsErr) {
    console.warn('[Sync] Cloud Firestore store notice:', fsErr);
  }
}

export function saveUserSessionToStorage(profile: AppUserProfile | null): void {
  try {
    if (profile) {
      if (profile.role === 'teacher') {
        const isApproved = Boolean(
          isTeacherApprovedInRegistry(profile.uid, (profile as any).id, profile.email, profile.phone) ||
          (profile as any).isApproved === true ||
          (profile as any).status === 'approved' ||
          profile.kycStatus === 'approved' ||
          profile.verified === true ||
          (profile as any).verificationStatus === 'Verified Genuine Tutor'
        );
        if (isApproved) {
          (profile as any).isApproved = true;
          profile.verified = true;
          (profile as any).status = 'approved';
          profile.kycStatus = 'approved';
          (profile as any).verificationStatus = 'Verified Genuine Tutor';
          markTeacherApprovedInRegistry(profile.uid);
          if (profile.email) markTeacherApprovedInRegistry(profile.email);
          if ((profile as any).id) markTeacherApprovedInRegistry((profile as any).id);
          if (profile.phone) markTeacherApprovedInRegistry(profile.phone);
        }
      }
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('Could not save session to localStorage:', err);
  }
}

export function loadSavedUserSession(): AppUserProfile | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppUserProfile;
      // If user lacks a valid UID or email is not verified, strictly disallow active session
      if (!parsed || !parsed.uid || parsed.emailVerified !== true) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        return null;
      }
      if (parsed.role === 'teacher') {
        const isApproved = Boolean(
          isTeacherApprovedInRegistry(parsed.uid, (parsed as any).id, parsed.email, parsed.phone) ||
          (parsed as any).isApproved === true ||
          (parsed as any).status === 'approved' ||
          parsed.kycStatus === 'approved' ||
          parsed.verified === true ||
          (parsed as any).verificationStatus === 'Verified Genuine Tutor'
        );
        if (isApproved) {
          (parsed as any).isApproved = true;
          parsed.verified = true;
          (parsed as any).status = 'approved';
          parsed.kycStatus = 'approved';
          (parsed as any).verificationStatus = 'Verified Genuine Tutor';
        }
      }
      return parsed;
    }
  } catch (err) {
    console.warn('Could not load session from localStorage:', err);
  }
  return null;
}

/**
 * Format Firebase Auth errors into friendly messages for parents and teachers
 */
export function formatFirebaseError(error: any): string {
  const code = error?.code || '';
  switch (code) {
    case 'auth/email-not-verified':
      return 'Kindly verify your account to log in. We sent a verification link to your email.';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email. Please log in instead.';
    case 'auth/invalid-email':
      return 'The email address entered is not valid.';
    case 'auth/operation-not-allowed':
      return 'Email/password sign-in is not enabled yet in your Firebase console. Please check Authentication > Sign-in method.';
    case 'auth/weak-password':
      return 'Password is too weak. Please use at least 6 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Please contact support.';
    case 'auth/user-not-found':
      return 'No account found with this email. Please sign up or create an account first.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. Please verify your credentials or click "Create New Account" if you have not registered yet.';
    case 'auth/too-many-requests':
      return 'Too many failed login attempts. Access is temporarily locked. Please reset password or try again later.';
    case 'auth/network-request-failed':
      return 'Network connection error. Please check your internet connection and try again.';
    case 'auth/unauthorized-domain':
      return 'This web domain is not yet authorized in Firebase Console. Go to Firebase Console > Authentication > Settings > Authorized domains and add this application URL.';
    case 'auth/invalid-api-key':
    case 'auth/api-key-not-valid':
      return 'Awaiting new Firebase API key. Please provide your new Firebase connection credentials.';
    default:
      return error?.message || 'An error occurred during authentication. Please try again.';
  }
}

/**
 * Register a Parent in Firebase Auth and store profile in Firestore 'parents' collection (no users collection)
 */
export async function registerParentInFirebase(data: ParentRegistrationData): Promise<AppUserProfile> {
  const password = data.password || 'Kumari@1234';
  const userCredential = await createUserWithEmailAndPassword(auth, data.email.trim(), password);
  const firebaseUser = userCredential.user;

  // Set display name in Auth
  try {
    await updateProfile(firebaseUser, {
      displayName: data.fullName.trim()
    });
  } catch (err) {
    console.warn('updateProfile notice:', err);
  }

  // Send Firebase Email Verification Link
  try {
    await sendEmailVerification(firebaseUser);
  } catch (err) {
    console.warn('sendEmailVerification notice:', err);
  }

  const now = new Date().toISOString();
  const parentProfile = {
    uid: firebaseUser.uid,
    role: 'parent' as const,
    fullName: data.fullName.trim(),
    name: data.fullName.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone.trim(),
    childName: data.childName?.trim() || '',
    childGrade: data.childGrade?.trim() || '',
    board: data.board?.trim() || '',
    subjects: data.subjects || [],
    locality: data.locality?.trim() || '',
    course: data.childGrade ? `${data.childGrade} Tuition` : 'Home Tuition',
    bookedTutors: [],
    feesAmount: 0,
    assignedTutor: '',
    assignedTutorId: '',
    assignedTutorPhone: '',
    assignedEducator: null,
    enrolledCourses: [],
    hiredTutors: [],
    demoBookings: [],
    tasks: [],
    progress: {},
    emailVerified: false,
    createdAt: now,
    updatedAt: now
  };

  // Store strictly in parents collection in Firestore (no users collection)
  try {
    await setDoc(doc(db, "parents", firebaseUser.uid), removeUndefinedFields(parentProfile));
  } catch (fsErr) {
    console.warn('Firestore parent store notice:', fsErr);
  }

  // Sign out immediately so NO session is active before email verification
  try {
    await signOut(auth);
  } catch (signoutErr) {
    console.warn('Sign out notice:', signoutErr);
  }
  saveUserSessionToStorage(null);

  const res: AppUserProfile = {
    uid: firebaseUser.uid,
    name: data.fullName.trim(),
    email: data.email.trim(),
    role: 'parent',
    phone: data.phone.trim(),
    locality: data.locality?.trim() || '',
    course: parentProfile.course,
    bookedTutors: [],
    feesAmount: 0,
    assignedTutor: '',
    assignedTutorId: '',
    assignedTutorPhone: '',
    assignedEducator: null,
    enrolledCourses: [],
    hiredTutors: [],
    demoBookings: [],
    tasks: [],
    progress: {},
    createdAt: parentProfile.createdAt,
    emailVerified: false
  };

  return res;
}

export const DEMO_PARENT_ACCOUNT = {
  email: 'parent.demo@kumari.edu',
  password: 'Password@123',
  name: 'Priya Sharma (Parent)',
  phone: '9876543210',
  role: 'parent' as const,
  locality: 'Indira Nagar, Rayagada'
};

export const DEMO_TEACHER_ACCOUNT = {
  email: 'teacher.demo@kumari.edu',
  password: 'Password@123',
  name: 'Sunita Nayak (Teacher)',
  phone: '9861234567',
  role: 'teacher' as const,
  locality: 'Rayagada Central'
};

/**
 * Standard User Registration (Parent or Teacher) asking for: Name, Email, Mobile, Gender, Password, Role
 * Sends official Firebase email verification link and signs out immediately.
 * User must verify email from the link before being allowed to log in and establish an active session.
 */
export async function registerUserInFirebase(input: UserRegistrationInput): Promise<AppUserProfile> {
  const userCredential = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
  const firebaseUser = userCredential.user;

  // Set display name in Auth
  try {
    await updateProfile(firebaseUser, {
      displayName: input.name.trim()
    });
  } catch (profErr) {
    console.warn('updateProfile notice:', profErr);
  }

  // Send email verification link from Firebase
  try {
    await sendEmailVerification(firebaseUser);
  } catch (err) {
    console.warn('sendEmailVerification notice:', err);
  }

  const now = new Date().toISOString();
  const baseProfile: AppUserProfile = {
    uid: firebaseUser.uid,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    gender: input.gender,
    role: input.role,
    locality: '',
    enrolledCourses: [],
    hiredTutors: [],
    demoBookings: [],
    tasks: [],
    progress: {},
    createdAt: now,
    emailVerified: false
  };

  // Persist base initial profile to Firestore (strictly parents or teachers, no duplicate users)
  try {
    if (input.role === 'parent') {
      const parentData = removeUndefinedFields({
        ...baseProfile,
        fullName: input.name.trim(),
        locality: '',
        childName: '',
        childGrade: '',
        childBoard: '',
        childSchool: '',
        enrolledCourses: [],
        hiredTutors: []
      });
      await setDoc(doc(db, "parents", firebaseUser.uid), parentData);
      console.log(`[Firestore] Successfully stored clean parent profile for ${baseProfile.name} in parents collection.`);
    } else {
      const teacherLat = typeof input.latitude === 'number' && !isNaN(input.latitude) ? input.latitude : undefined;
      const teacherLng = typeof input.longitude === 'number' && !isNaN(input.longitude) ? input.longitude : undefined;
      const teacherLocArea = input.locationArea || input.locality || '';
      const teacherAddress = input.address || '';

      await setDoc(doc(db, "teachers", firebaseUser.uid), removeUndefinedFields({
        ...baseProfile,
        id: firebaseUser.uid,
        fullName: input.name.trim(),
        qualification: '',
        experienceYears: 0,
        experience: '',
        subjects: [],
        classesHandled: [],
        monthlyFee: 0,
        hourlyRate: 0,
        rating: 0,
        reviewCount: 0,
        ...(typeof teacherLat === 'number' ? { latitude: teacherLat } : {}),
        ...(typeof teacherLng === 'number' ? { longitude: teacherLng } : {}),
        locationArea: teacherLocArea,
        locality: teacherLocArea,
        address: teacherAddress,
        addressSnippet: teacherAddress,
        badge: 'New Educator',
        verified: false,
        isApproved: false,
        status: 'pending',
        kycStatus: 'pending',
        verificationStatus: 'Pending Profile Submission',
        teacherType: 'home',
        profileCompleted: false
      }));

      // Store in tutors_requests collection (pending profile completion)
      await setDoc(doc(db, "tutors_requests", firebaseUser.uid), removeUndefinedFields({
        uid: firebaseUser.uid,
        id: firebaseUser.uid,
        name: input.name.trim(),
        fullName: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        phone: input.phone.trim(),
        gender: input.gender,
        ...(typeof teacherLat === 'number' ? { latitude: teacherLat } : {}),
        ...(typeof teacherLng === 'number' ? { longitude: teacherLng } : {}),
        locationArea: teacherLocArea,
        address: teacherAddress,
        status: 'pending_profile',
        kycStatus: 'pending',
        verified: false,
        isApproved: false,
        profileCompleted: false,
        createdAt: now
      })).catch(() => {});

      console.log(`[Firestore] Successfully stored clean teacher profile for ${baseProfile.name} in teachers & tutors_requests collection.`);
    }
  } catch (fsErr) {
    console.warn('[Firestore] Profile initial write note:', fsErr);
  }

  // 2. Persist to server /api/users persistent database
  try {
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseProfile)
    });
  } catch (serverErr) {
    console.warn('[Server Store] Profile write note:', serverErr);
  }

  // 3. Save to local backup registry
  saveUserToLocalRegistry(baseProfile);

  // IMPORTANT: Sign out immediately so NO session is active before email verification!
  try {
    await signOut(auth);
  } catch (signoutErr) {
    console.warn('Sign out notice:', signoutErr);
  }
  saveUserSessionToStorage(null);

  return baseProfile;
}

/**
 * Register a Teacher in Firebase Auth and store profile in Firestore 'teachers' & 'tutors_requests' (no users collection)
 */
export async function registerTeacherInFirebase(data: TeacherRegistrationData): Promise<AppUserProfile> {
  const password = data.password || 'Kumari@1234';
  const userCredential = await createUserWithEmailAndPassword(auth, data.email.trim(), password);
  const firebaseUser = userCredential.user;

  // Set display name in Auth
  try {
    await updateProfile(firebaseUser, {
      displayName: data.fullName.trim()
    });
  } catch (err) {
    console.warn('updateProfile notice:', err);
  }

  // Send verification email
  try {
    await sendEmailVerification(firebaseUser);
  } catch (err) {
    console.warn('sendEmailVerification notice:', err);
  }

  const now = new Date().toISOString();
  const teacherProfile = {
    uid: firebaseUser.uid,
    id: firebaseUser.uid,
    role: 'teacher' as const,
    name: data.fullName.trim(),
    fullName: data.fullName.trim(),
    email: data.email.trim().toLowerCase(),
    phone: data.phone.trim(),
    ...(typeof data.latitude === 'number' ? { latitude: data.latitude } : {}),
    ...(typeof data.longitude === 'number' ? { longitude: data.longitude } : {}),
    localityId: data.localityId || '',
    locationArea: data.locationArea || '',
    address: data.address || '',
    addressSnippet: data.address || data.locationArea || '',
    qualification: data.qualification || '',
    experienceYears: data.experienceYears ?? 0,
    subjects: data.subjects || [],
    classesHandled: data.classesHandled || [],
    monthlyFee: data.monthlyFee ?? 0,
    hourlyRate: data.hourlyRate ?? 0,
    rating: 0,
    reviewCount: 0,
    badge: 'New Educator',
    verified: false,
    isApproved: false,
    status: 'pending',
    kycStatus: 'pending',
    verificationStatus: 'Pending Profile Submission',
    gender: data.gender || 'female',
    teacherType: data.teacherType || 'home',
    bio: data.bio || '',
    profileCompleted: false,
    emailVerified: false,
    tasks: [],
    progress: {},
    createdAt: now,
    updatedAt: now
  };

  // Store in teachers and tutors_requests collection in Cloud Firestore
  try {
    await setDoc(doc(db, "teachers", firebaseUser.uid), removeUndefinedFields(teacherProfile));
    await setDoc(doc(db, "tutors_requests", firebaseUser.uid), removeUndefinedFields({
      uid: firebaseUser.uid,
      id: firebaseUser.uid,
      fullName: data.fullName.trim(),
      name: data.fullName.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      gender: data.gender || 'female',
      locationArea: data.locationArea || '',
      status: 'pending_profile',
      kycStatus: 'pending',
      verified: false,
      isApproved: false,
      profileCompleted: false,
      createdAt: now
    })).catch(() => {});
    console.log(`[Firestore] Stored teacher profile and request for ${teacherProfile.name}`);
  } catch (fsErr) {
    console.warn('Firestore teacher store notice:', fsErr);
  }

  // Persist to server /api/users persistent storage
  try {
    await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teacherProfile)
    });
  } catch (serverErr) {
    console.warn('[Server Store] Teacher write note:', serverErr);
  }

  // Save to local backup registry
  saveUserToLocalRegistry(teacherProfile as any);

  // Sign out immediately so NO session is active before email verification
  try {
    await signOut(auth);
  } catch (signoutErr) {
    console.warn('Sign out notice:', signoutErr);
  }
  saveUserSessionToStorage(null);

  return {
    uid: firebaseUser.uid,
    name: data.fullName.trim(),
    email: data.email.trim(),
    role: 'teacher',
    phone: data.phone.trim(),
    profileCompleted: false,
    ...(typeof data.latitude === 'number' ? { latitude: data.latitude } : {}),
    ...(typeof data.longitude === 'number' ? { longitude: data.longitude } : {}),
    emailVerified: false
  };
}

/**
 * Save complete teacher profile data into Firestore
 * - Single authoritative tutor collection: 'teachers'
 * - Mirrors pending applications to 'tutors_requests' until Admin approves (when approved, 'tutors_requests' doc is removed)
 */
export async function updateTeacherProfileInFirestore(uid: string, profileData: any): Promise<void> {
  const teacherRef = doc(db, "teachers", uid);

  const feeAmount =
    Number(profileData.monthlyFee) ||
    (Number(profileData.hourlyRate) ? Number(profileData.hourlyRate) * 30 : 0);

  const availableTimings =
    profileData.availableTimings ||
    profileData.selectedTimings ||
    profileData.availableTimeSlots ||
    [];

  const isAlreadyApproved = Boolean(profileData.isApproved === true || profileData.verified === true);
  const now = new Date().toISOString();

  const completePayload = removeUndefinedFields({
    ...profileData,
    uid,
    id: profileData.id || uid,
    profileCompleted: true,
    feeAmount,
    monthlyFee: Number(profileData.monthlyFee) || feeAmount,
    hourlyRate: Number(profileData.hourlyRate) || 0,
    availableTimings,
    selectedTimings: profileData.selectedTimings || availableTimings,
    assignedParentName: profileData.assignedParentName || '',
    assignedParents: profileData.assignedParents || [],
    assignedStudents: profileData.assignedStudents || [],
    status: profileData.status || (isAlreadyApproved ? 'approved' : 'pending'),
    isApproved: isAlreadyApproved,
    verified: isAlreadyApproved,
    kycStatus: profileData.kycStatus || (isAlreadyApproved ? 'approved' : 'submitted'),
    verificationStatus: profileData.verificationStatus || (isAlreadyApproved ? 'Verified Genuine Tutor' : 'Pending Verification'),
    submittedAt: profileData.submittedAt || now,
    updatedAt: now
  });

  // 1. Write complete profile directly to single authoritative 'teachers' collection
  await setDoc(teacherRef, completePayload, { merge: true });

  // 2. Keep 'tutors_requests' ONLY while pending admin review; remove once already approved
  try {
    const tutorRequestRef = doc(db, "tutors_requests", uid);
    if (isAlreadyApproved) {
      await deleteDoc(tutorRequestRef).catch(() => {});
    } else {
      await setDoc(
        tutorRequestRef,
        {
          ...completePayload,
          status: 'pending',
          kycStatus: 'submitted',
          profileCompleted: true,
          submittedAt: completePayload.submittedAt
        },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn('tutors_requests sync notice:', err);
  }

  // 4. Sync with server persistent database
  try {
    await fetch('/api/teachers/register-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completePayload)
    });
  } catch (syncErr) {
    console.warn('Server teacher sync notice:', syncErr);
  }
}

/**
 * Log in existing user with Firebase Authentication and retrieve profile from Firestore.
 * Strictly verifies email status: unverified users cannot establish a session and are guided to verify their email.
 * Upon successful verified login, syncs and stores user session, works, tasks, and progress in Firestore in real time.
 */
export async function loginUserWithFirebase(
  identifier: string,
  password: string,
  expectedRole?: 'parent' | 'teacher' | 'admin'
): Promise<AppUserProfile> {
  const email = identifier.trim().toLowerCase();

  // Special Handling for Administrator: kkumariinstitute@gmail.com with password 'ram123'
  if (email === ADMIN_CREDENTIALS.email.toLowerCase()) {
    if (password !== ADMIN_CREDENTIALS.password) {
      const wrongPassErr: any = new Error("Invalid email or password. Please check your credentials.");
      wrongPassErr.code = 'auth/wrong-password';
      throw wrongPassErr;
    }

    const adminProfile: AppUserProfile = {
      uid: 'admin_kumari_institute',
      name: 'Kumari Institute Admin',
      email: ADMIN_CREDENTIALS.email,
      role: 'admin',
      phone: '+91 94398 51521',
      emailVerified: true,
      profileCompleted: true,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    saveUserSessionToStorage(adminProfile);
    saveUserToLocalRegistry(adminProfile);
    syncUserToPersistence(adminProfile).catch(() => {});
    return adminProfile;
  }

  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const firebaseUser = userCredential.user;

  // Refresh user object to fetch latest emailVerified from Firebase Auth servers
  try {
    await firebaseUser.reload();
  } catch (reloadErr) {
    console.warn('firebaseUser.reload notice:', reloadErr);
  }

  // Check email verification status:
  const isDemo =
    email === DEMO_PARENT_ACCOUNT.email.toLowerCase() ||
    email === DEMO_TEACHER_ACCOUNT.email.toLowerCase();

  if (!firebaseUser.emailVerified && !isDemo) {
    // Unverified user is strictly rejected from login session!
    try {
      await signOut(auth);
    } catch (soErr) {
      console.warn('Sign out on unverified notice:', soErr);
    }
    saveUserSessionToStorage(null);

    const verifyError: any = new Error(
      `Kindly verify your account to log in. We sent a verification link to ${email}. Please check your inbox and verify your email before logging in.`
    );
    verifyError.code = 'auth/email-not-verified';
    verifyError.email = email;
    throw verifyError;
  }

  // Retrieve user profiles from Firestore (parents or teachers)
  const [parentDocSnap, teacherDocSnap] = await Promise.all([
    getDoc(doc(db, "parents", firebaseUser.uid)).catch(() => null),
    getDoc(doc(db, "teachers", firebaseUser.uid)).catch(() => null)
  ]);

  // Check backup sources if Firestore document is not yet found or loading
  let backupData: any = getUserFromLocalRegistry(firebaseUser.uid) || getUserFromLocalRegistry(email);
  if (!backupData) {
    try {
      const resp = await fetch(`/api/users/${firebaseUser.uid}`);
      if (resp.ok) {
        const body = await resp.json();
        if (body?.user) backupData = body.user;
      }
    } catch {
      // server fetch optional
    }
  }

  const parentData = parentDocSnap && parentDocSnap.exists() ? parentDocSnap.data() : (backupData?.role === 'parent' ? backupData : {});
  const teacherData = teacherDocSnap && teacherDocSnap.exists() ? teacherDocSnap.data() : (backupData?.role === 'teacher' ? backupData : {});
  const foundData = (parentDocSnap && parentDocSnap.exists() ? parentData : null) ||
                    (teacherDocSnap && teacherDocSnap.exists() ? teacherData : null) ||
                    backupData || {};

  const role: 'parent' | 'teacher' =
    foundData.role ||
    (parentDocSnap && parentDocSnap.exists() ? 'parent' : null) ||
    (teacherDocSnap && teacherDocSnap.exists() ? 'teacher' : null) ||
    expectedRole ||
    'parent';

  const enrolledCourses: EnrolledCourse[] =
    parentData.enrolledCourses || foundData.enrolledCourses || [];
  const hiredTutors: HiredTutor[] =
    parentData.hiredTutors || foundData.hiredTutors || [];
  const demoBookings: DemoBooking[] =
    parentData.demoBookings || foundData.demoBookings || [];

  const defaultTasks: UserTask[] = [
    {
      id: `task_${Date.now()}_1`,
      title: 'Review Course Syllabus & Weekly Study Plan',
      category: 'Homework',
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      completed: false,
      notes: 'Check lessons and upcoming live sessions.',
      createdAt: new Date().toISOString()
    },
    {
      id: `task_${Date.now()}_2`,
      title: role === 'teacher' ? 'Update Weekly Class Availability & Notes' : 'Schedule Free Demo Class with Home Tutor',
      category: role === 'teacher' ? 'Assignment' : 'Demo',
      dueDate: new Date(Date.now() + 86400000 * 4).toISOString().split('T')[0],
      completed: false,
      notes: role === 'teacher' ? 'Share study materials with enrolled students.' : 'Request 1-on-1 trial home tuition session.',
      createdAt: new Date().toISOString()
    }
  ];

  const tasks: UserTask[] = foundData.tasks && foundData.tasks.length > 0 ? foundData.tasks : defaultTasks;
  const progress: Record<string, UserProgressMetric> = foundData.progress || {};

  const resolvedChildName = foundData.childName || foundData.studentName || parentData.childName || parentData.studentName || '';
  const resolvedChildGrade = foundData.childGrade || foundData.studentGrade || foundData.grade || foundData.class || parentData.childGrade || '';
  const resolvedChildBoard = foundData.childBoard || foundData.board || parentData.childBoard || parentData.board || '';
  const resolvedChildSchool = foundData.childSchool || foundData.school || parentData.childSchool || parentData.school || '';
  const resolvedProfileCompleted = Boolean(
    foundData.profileCompleted ??
    parentData.profileCompleted ??
    teacherData.profileCompleted ??
    (role === 'parent' && resolvedChildName && resolvedChildGrade)
  );

  const profile: AppUserProfile = {
    uid: firebaseUser.uid,
    name: foundData.name || parentData.fullName || teacherData.fullName || firebaseUser.displayName || email.split('@')[0],
    email: firebaseUser.email || email,
    role,
    phone: foundData.phone || parentData.phone || teacherData.phone || '',
    ...(foundData.whatsappNumber || parentData.whatsappNumber ? { whatsappNumber: foundData.whatsappNumber || parentData.whatsappNumber } : {}),
    gender: foundData.gender || parentData.gender || teacherData.gender || 'female',
    profileCompleted: resolvedProfileCompleted,
    ...(foundData.learningRequirementsSubmitted || parentData.learningRequirementsSubmitted ? { learningRequirementsSubmitted: true } : {}),
    locality: foundData.locality || parentData.locality || teacherData.locationArea || (role === 'teacher' ? '' : 'Indira Nagar, Rayagada'),
    ...(foundData.address || parentData.address || teacherData.address ? { address: foundData.address || parentData.address || teacherData.address } : {}),
    ...(foundData.addressDetails || parentData.addressDetails || teacherData.addressDetails ? { addressDetails: foundData.addressDetails || parentData.addressDetails || teacherData.addressDetails } : {}),
    childName: resolvedChildName,
    ...(resolvedChildName ? { studentName: resolvedChildName } : {}),
    ...(foundData.studentAge || foundData.childAge || parentData.studentAge || parentData.childAge ? { studentAge: foundData.studentAge || foundData.childAge || parentData.studentAge || parentData.childAge } : {}),
    childGrade: resolvedChildGrade,
    ...(resolvedChildBoard ? { childBoard: resolvedChildBoard, board: resolvedChildBoard } : {}),
    childSchool: resolvedChildSchool,
    ...(Array.isArray(foundData.subjectsNeeded || parentData.subjectsNeeded) ? { subjectsNeeded: foundData.subjectsNeeded || parentData.subjectsNeeded } : {}),
    ...(foundData.preferredTimeSlot || foundData.timeSlotNeeded || parentData.preferredTimeSlot || parentData.timeSlotNeeded ? {
      preferredTimeSlot: foundData.preferredTimeSlot || foundData.timeSlotNeeded || parentData.preferredTimeSlot || parentData.timeSlotNeeded,
      timeSlotNeeded: foundData.timeSlotNeeded || foundData.preferredTimeSlot || parentData.timeSlotNeeded || parentData.preferredTimeSlot
    } : {}),
    ...(foundData.notes || parentData.notes ? { notes: foundData.notes || parentData.notes } : {}),
    targetExam: foundData.targetExam || parentData.targetExam || '',
    emergencyContact: foundData.emergencyContact || parentData.emergencyContact || '',
    enrolledCourses,
    hiredTutors,
    demoBookings,
    tasks,
    progress,
    createdAt: foundData.createdAt || parentData.createdAt || teacherData.createdAt || new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    emailVerified: true
  };

  const validLat = typeof foundData.latitude === 'number' ? foundData.latitude : (typeof teacherData.latitude === 'number' ? teacherData.latitude : undefined);
  const validLng = typeof foundData.longitude === 'number' ? foundData.longitude : (typeof teacherData.longitude === 'number' ? teacherData.longitude : undefined);
  if (typeof validLat === 'number') profile.latitude = validLat;
  if (typeof validLng === 'number') profile.longitude = validLng;

  if (role === 'teacher') {
    const isApprovedTeacher = Boolean(
      foundData.isApproved === true ||
      foundData.status === 'approved' ||
      foundData.verified === true ||
      foundData.kycStatus === 'approved' ||
      foundData.kycStatus === 'verified' ||
      teacherData.isApproved === true ||
      teacherData.status === 'approved' ||
      teacherData.verified === true ||
      teacherData.kycStatus === 'approved' ||
      teacherData.kycStatus === 'verified' ||
      isTeacherApprovedInRegistry(firebaseUser.uid, email, foundData.phone || teacherData.phone)
    );
    if (isApprovedTeacher) {
      (profile as any).isApproved = true;
      profile.verified = true;
      (profile as any).status = 'approved';
      profile.kycStatus = 'approved';
      (profile as any).verificationStatus = 'Verified Genuine Tutor';
      markTeacherApprovedInRegistry(firebaseUser.uid);
      markTeacherApprovedInRegistry(email);
    } else {
      (profile as any).isApproved = false;
      profile.verified = false;
      (profile as any).status = foundData.status || teacherData.status || 'pending';
      profile.kycStatus = foundData.kycStatus || teacherData.kycStatus || (resolvedProfileCompleted ? 'submitted' : 'pending');
      (profile as any).verificationStatus = resolvedProfileCompleted ? 'Pending Verification' : 'Pending Profile Submission';
    }
    if (teacherData.avatar || foundData.avatar) profile.avatar = teacherData.avatar || foundData.avatar;
    if (teacherData.qualification || foundData.qualification) (profile as any).qualification = teacherData.qualification || foundData.qualification;
    if (teacherData.monthlyFee || foundData.monthlyFee) (profile as any).monthlyFee = teacherData.monthlyFee || foundData.monthlyFee;
    if (teacherData.hourlyCharges || foundData.hourlyCharges || teacherData.hourlyRate || foundData.hourlyRate) {
      (profile as any).hourlyCharges = teacherData.hourlyCharges || foundData.hourlyCharges || teacherData.hourlyRate || foundData.hourlyRate;
    }
    if (teacherData.feeStructure || foundData.feeStructure) profile.feeStructure = teacherData.feeStructure || foundData.feeStructure;
    if (teacherData.educationDetails || foundData.educationDetails) profile.educationDetails = teacherData.educationDetails || foundData.educationDetails;
    if (teacherData.dob || foundData.dob) (profile as any).dob = teacherData.dob || foundData.dob;
    if (teacherData.altNumber || foundData.altNumber) (profile as any).altNumber = teacherData.altNumber || foundData.altNumber;
    if (teacherData.aadhaarNumber || foundData.aadhaarNumber) (profile as any).aadhaarNumber = teacherData.aadhaarNumber || foundData.aadhaarNumber;
    if (teacherData.aadhaarDocUrl || foundData.aadhaarDocUrl) (profile as any).aadhaarDocUrl = teacherData.aadhaarDocUrl || foundData.aadhaarDocUrl;
    if (Array.isArray(teacherData.subjects || foundData.subjects)) profile.subjects = teacherData.subjects || foundData.subjects;
    if (Array.isArray(teacherData.classesHandled || foundData.classesHandled)) (profile as any).classesHandled = teacherData.classesHandled || foundData.classesHandled;
    if (Array.isArray(teacherData.availableTimeSlots || foundData.availableTimeSlots)) profile.availableTimeSlots = teacherData.availableTimeSlots || foundData.availableTimeSlots;
    if (teacherData.bio || foundData.bio) profile.bio = teacherData.bio || foundData.bio;

    // Ensure pending tutor login is immediately visible in tutors_requests for Admin Panel
    if (!resolvedProfileCompleted) {
      setDoc(
        doc(db, "tutors_requests", firebaseUser.uid),
        removeUndefinedFields({
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          name: profile.name,
          fullName: profile.name,
          email: profile.email,
          phone: profile.phone || '',
          gender: profile.gender || 'female',
          status: 'pending_profile',
          kycStatus: 'pending',
          verified: false,
          isApproved: false,
          profileCompleted: false,
          lastLoginAt: profile.lastLoginAt,
          createdAt: profile.createdAt
        }),
        { merge: true }
      ).catch(() => {});
    }
  }

  // Synchronize across Cloud Firestore, persistent Server storage, and local registry
  await syncUserToPersistence(profile);

  // Store in persistent local session
  saveUserSessionToStorage(profile);

  return profile;
}

/**
 * Sign in / Register with Google via Firebase Authentication
 * Automatically sets emailVerified to true, loads or creates the user document in Firestore,
 * and synchronizes session state.
 */
export async function loginWithGoogle(
  expectedRole: 'parent' | 'teacher' = 'parent'
): Promise<AppUserProfile> {
  if (!isFirebaseConfigured || firebaseConfig.apiKey.includes('AWAITING')) {
    const err: any = new Error('Awaiting new Firebase connection and API key. Please provide your new Firebase configuration to enable Google sign-in.');
    err.code = 'auth/invalid-api-key';
    throw err;
  }

  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  const firebaseUser = result.user;
  const email = (firebaseUser.email || '').toLowerCase().trim();
  const displayName = firebaseUser.displayName || (expectedRole === 'parent' ? 'Parent User' : 'Teacher User');
  const photoUrl = firebaseUser.photoURL || '';

  // Check if existing profile exists in Firestore (parents or teachers)
  const [parentDocSnap, teacherDocSnap] = await Promise.all([
    getDoc(doc(db, "parents", firebaseUser.uid)).catch(() => null),
    getDoc(doc(db, "teachers", firebaseUser.uid)).catch(() => null)
  ]);

  let backupData: any = getUserFromLocalRegistry(firebaseUser.uid) || getUserFromLocalRegistry(email);
  if (!backupData) {
    try {
      const resp = await fetch(`/api/users/${firebaseUser.uid}`);
      if (resp.ok) {
        const body = await resp.json();
        if (body?.user) backupData = body.user;
      }
    } catch {
      // server fetch optional
    }
  }

  const parentData = parentDocSnap && parentDocSnap.exists() ? parentDocSnap.data() : (backupData?.role === 'parent' ? backupData : {});
  const teacherData = teacherDocSnap && teacherDocSnap.exists() ? teacherDocSnap.data() : (backupData?.role === 'teacher' ? backupData : {});

  const isAdmin = email === ADMIN_CREDENTIALS.email.toLowerCase() || email === 'kkumariinstitute@gmail.com';
  // Enforce role based on where login was initiated: parent page -> parent, tutor page -> teacher
  const role: 'parent' | 'teacher' | 'admin' =
    isAdmin
      ? 'admin'
      : (expectedRole ||
        (parentDocSnap && parentDocSnap.exists() ? 'parent' : null) ||
        (teacherDocSnap && teacherDocSnap.exists() ? 'teacher' : null) ||
        backupData?.role ||
        'parent');

  const foundData =
    role === 'teacher'
      ? ((teacherDocSnap && teacherDocSnap.exists() ? teacherData : null) || (backupData?.role === 'teacher' ? backupData : {}) || {})
      : role === 'parent'
      ? ((parentDocSnap && parentDocSnap.exists() ? parentData : null) || (backupData?.role === 'parent' ? backupData : {}) || {})
      : (backupData || {});

  const enrolledCourses: EnrolledCourse[] =
    parentData.enrolledCourses || foundData.enrolledCourses || [];
  const hiredTutors: HiredTutor[] =
    parentData.hiredTutors || foundData.hiredTutors || [];
  const demoBookings: DemoBooking[] =
    parentData.demoBookings || foundData.demoBookings || [];

  const defaultTasks: UserTask[] = [
    {
      id: `task_${Date.now()}_1`,
      title: 'Review Course Syllabus & Weekly Study Plan',
      notes: 'Explore recommended topics, schedule, and study materials.',
      completed: false,
      dueDate: 'Today',
      category: 'General',
      createdAt: new Date().toISOString()
    }
  ];

  const tasks: UserTask[] =
    Array.isArray(foundData.tasks) && foundData.tasks.length > 0
      ? foundData.tasks
      : defaultTasks;

  const defaultProgress: Record<string, UserProgressMetric> = {
    attendance: {
      courseId: 'attendance',
      courseTitle: 'Attendance',
      progressPercent: 92,
      completedLessons: 23,
      totalLessons: 25,
      lastActive: new Date().toISOString()
    }
  };

  const progress = foundData.progress || defaultProgress;

  // Strictly determine whether THIS role's onboarding profile form was already completed
  const googleChildName = foundData.childName || foundData.studentName || parentData.childName || parentData.studentName || '';
  const googleChildGrade = foundData.childGrade || foundData.studentGrade || foundData.grade || foundData.class || parentData.childGrade || '';
  const googleChildBoard = foundData.childBoard || foundData.board || parentData.childBoard || parentData.board || '';
  const hasCompleteDetails =
    role === 'admin'
      ? true
      : role === 'teacher'
      ? Boolean(teacherData?.profileCompleted === true)
      : Boolean(
          parentData?.profileCompleted === true ||
          parentData?.learningRequirementsSubmitted === true ||
          (googleChildName && googleChildGrade && googleChildBoard)
        );

  const profile: AppUserProfile = {
    uid: firebaseUser.uid,
    name: foundData.name || foundData.fullName || displayName,
    email: email,
    role: role,
    phone: foundData.phone || firebaseUser.phoneNumber || '',
    ...(foundData.whatsappNumber || parentData.whatsappNumber ? { whatsappNumber: foundData.whatsappNumber || parentData.whatsappNumber } : {}),
    locality: foundData.locality || foundData.address || (role === 'teacher' ? '' : 'Rayagada'),
    ...(foundData.address || parentData.address ? { address: foundData.address || parentData.address } : {}),
    ...(foundData.addressDetails || parentData.addressDetails ? { addressDetails: foundData.addressDetails || parentData.addressDetails } : {}),
    avatar: photoUrl || foundData.avatar || foundData.photoUrl || '',
    photoUrl: photoUrl || foundData.photoUrl || foundData.avatar || '',
    profileCompleted: hasCompleteDetails,
    ...(foundData.learningRequirementsSubmitted || parentData.learningRequirementsSubmitted ? { learningRequirementsSubmitted: true } : {}),
    childName: googleChildName,
    ...(googleChildName ? { studentName: googleChildName } : {}),
    ...(foundData.studentAge || foundData.childAge || parentData.studentAge || parentData.childAge ? { studentAge: foundData.studentAge || foundData.childAge || parentData.studentAge || parentData.childAge } : {}),
    childGrade: googleChildGrade,
    childBoard: googleChildBoard,
    board: googleChildBoard,
    childSchool: foundData.childSchool || foundData.school || parentData.childSchool || parentData.school || '',
    ...(Array.isArray(foundData.subjectsNeeded || parentData.subjectsNeeded) ? { subjectsNeeded: foundData.subjectsNeeded || parentData.subjectsNeeded } : {}),
    ...(foundData.preferredTimeSlot || foundData.timeSlotNeeded || parentData.preferredTimeSlot || parentData.timeSlotNeeded ? {
      preferredTimeSlot: foundData.preferredTimeSlot || foundData.timeSlotNeeded || parentData.preferredTimeSlot || parentData.timeSlotNeeded,
      timeSlotNeeded: foundData.timeSlotNeeded || foundData.preferredTimeSlot || parentData.timeSlotNeeded || parentData.preferredTimeSlot
    } : {}),
    ...(foundData.notes || parentData.notes ? { notes: foundData.notes || parentData.notes } : {}),
    targetExam: foundData.targetExam || parentData.targetExam || '',
    emergencyContact: foundData.emergencyContact || parentData.emergencyContact || '',
    ...(role === 'teacher' && foundData.feeStructure ? { feeStructure: foundData.feeStructure } : {}),
    ...(role === 'teacher' && Array.isArray(foundData.boardsSupported) ? { boardsSupported: foundData.boardsSupported } : {}),
    ...(role === 'teacher' && Array.isArray(foundData.subjects) ? { subjects: foundData.subjects } : {}),
    ...(role === 'teacher' && Array.isArray(foundData.classesHandled) ? { classesHandled: foundData.classesHandled, classes: foundData.classesHandled } : {}),
    ...(role === 'teacher' && Array.isArray(foundData.availableTimeSlots) ? { availableTimeSlots: foundData.availableTimeSlots } : {}),
    ...(role === 'teacher' && foundData.educationDetails ? { educationDetails: foundData.educationDetails } : {}),
    ...(role === 'teacher' && foundData.bio ? { bio: foundData.bio } : {}),
    ...(role === 'teacher' && (foundData.qualification || foundData.highestQualification) ? { qualification: foundData.qualification || foundData.highestQualification, highestQualification: foundData.highestQualification || foundData.qualification } : {}),
    ...(role === 'teacher' && foundData.university ? { university: foundData.university } : {}),
    ...(role === 'teacher' && foundData.experience ? { experience: foundData.experience } : {}),
    ...(role === 'teacher' && typeof foundData.experienceYears === 'number' ? { experienceYears: foundData.experienceYears } : {}),
    ...(role === 'teacher' && typeof foundData.monthlyFee === 'number' ? { monthlyFee: foundData.monthlyFee } : {}),
    ...(role === 'teacher' && typeof foundData.latitude === 'number' ? { latitude: foundData.latitude } : {}),
    ...(role === 'teacher' && typeof foundData.longitude === 'number' ? { longitude: foundData.longitude } : {}),
    ...(role === 'teacher' && foundData.dob ? { dob: foundData.dob } : {}),
    ...(role === 'teacher' && foundData.altNumber ? { altNumber: foundData.altNumber } : {}),
    ...(role === 'teacher' && foundData.aadhaarNumber ? { aadhaarNumber: foundData.aadhaarNumber } : {}),
    ...(role === 'teacher' && foundData.aadhaarDocUrl ? { aadhaarDocUrl: foundData.aadhaarDocUrl } : {}),
    ...(role === 'teacher' && (typeof foundData.hourlyRate === 'number' || typeof foundData.hourlyCharges === 'number' || typeof foundData.hourlyFee === 'number') ? {
      hourlyRate: foundData.hourlyRate || foundData.hourlyCharges || foundData.hourlyFee,
      hourlyCharges: foundData.hourlyCharges || foundData.hourlyRate || foundData.hourlyFee,
      hourlyFee: foundData.hourlyFee || foundData.hourlyCharges || foundData.hourlyRate
    } : {}),
    ...(role === 'teacher' && (
      foundData.isApproved === true ||
      foundData.status === 'approved' ||
      foundData.verified === true ||
      foundData.kycStatus === 'approved' ||
      foundData.kycStatus === 'verified' ||
      isTeacherApprovedInRegistry(firebaseUser.uid, email, foundData.phone)
    ) ? {
      isApproved: true,
      verified: true,
      status: 'approved',
      kycStatus: 'approved',
      verificationStatus: 'Verified Genuine Tutor'
    } : role === 'teacher' ? {
      isApproved: false,
      verified: false,
      status: foundData.status || 'pending',
      kycStatus: foundData.kycStatus || (hasCompleteDetails ? 'submitted' : 'pending'),
      verificationStatus: hasCompleteDetails ? 'Pending Verification' : 'Pending Profile Submission'
    } : {}),
    enrolledCourses,
    hiredTutors,
    demoBookings,
    tasks,
    progress,
    createdAt: foundData.createdAt || parentData.createdAt || teacherData.createdAt || new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
    emailVerified: true
  };

  // Persist / update Firestore collection without clobbering existing fields
  const targetCol = role === 'admin' ? 'admins' : role === 'teacher' ? 'teachers' : 'parents';
  try {
    const teacherInitialDefaults =
      role === 'teacher' && !teacherDocSnap?.exists()
        ? {
            id: firebaseUser.uid,
            qualification: '',
            experienceYears: 0,
            subjects: [],
            classesHandled: [],
            monthlyFee: 0,
            hourlyRate: 0,
            verified: false,
            isApproved: false,
            status: 'pending',
            kycStatus: 'pending',
            verificationStatus: 'Pending Profile Submission'
          }
        : {};

    await setDoc(
      doc(db, targetCol, firebaseUser.uid),
      removeUndefinedFields({
        uid: firebaseUser.uid,
        name: profile.name,
        fullName: profile.name,
        email: profile.email,
        role: profile.role,
        emailVerified: true,
        photoUrl: profile.photoUrl || '',
        avatar: profile.avatar || '',
        phone: profile.phone || '',
        locality: profile.locality || '',
        ...(profile.childName ? { childName: profile.childName, studentName: profile.childName } : {}),
        ...(profile.childGrade ? { childGrade: profile.childGrade } : {}),
        ...(profile.childBoard ? { childBoard: profile.childBoard, board: profile.board || profile.childBoard } : {}),
        ...(profile.childSchool ? { childSchool: profile.childSchool } : {}),
        ...teacherInitialDefaults,
        profileCompleted: profile.profileCompleted,
        lastLoginAt: profile.lastLoginAt,
        ...(foundData.createdAt ? {} : { createdAt: profile.createdAt })
      }),
      { merge: true }
    );

    // Ensure pending tutor appears dynamically in tutors_requests & Admin Panel right after Google login
    if (role === 'teacher' && !profile.profileCompleted) {
      await setDoc(
        doc(db, "tutors_requests", firebaseUser.uid),
        removeUndefinedFields({
          uid: firebaseUser.uid,
          id: firebaseUser.uid,
          name: profile.name,
          fullName: profile.name,
          email: profile.email,
          phone: profile.phone || '',
          photoUrl: profile.photoUrl || '',
          avatar: profile.avatar || '',
          status: 'pending_profile',
          kycStatus: 'pending',
          verified: false,
          isApproved: false,
          profileCompleted: false,
          lastLoginAt: profile.lastLoginAt,
          createdAt: profile.createdAt
        }),
        { merge: true }
      ).catch(() => {});
    }
  } catch (err) {
    console.warn('[Firestore Google Login] setDoc notice:', err);
  }

  // Synchronize across Cloud Firestore, persistent Server storage, and local registry
  await syncUserToPersistence(profile);
  saveUserSessionToStorage(profile);

  return profile;
}

/**
 * 1-Click Fast Demo Login for Parent or Teacher testing
 */
export async function quickLoginDemoUser(role: 'parent' | 'teacher'): Promise<AppUserProfile> {
  const demoAccount = role === 'parent' ? DEMO_PARENT_ACCOUNT : DEMO_TEACHER_ACCOUNT;
  try {
    return await loginUserWithFirebase(demoAccount.email, demoAccount.password, role);
  } catch {
    try {
      return await registerUserInFirebase({
        name: demoAccount.name,
        email: demoAccount.email,
        phone: demoAccount.phone,
        password: demoAccount.password,
        role: role,
        gender: 'female'
      });
    } catch {
      const fallback: AppUserProfile = {
        uid: `demo_${role}_${Date.now()}`,
        name: demoAccount.name,
        email: demoAccount.email,
        phone: demoAccount.phone,
        role: role,
        gender: 'female',
        profileCompleted: true,
        locality: demoAccount.locality,
        enrolledCourses: [],
        hiredTutors: [],
        demoBookings: [],
        emailVerified: true
      };
      saveUserSessionToStorage(fallback);
      return fallback;
    }
  }
}

/**
 * Sign out from Firebase Authentication and wipe local session
 */
export async function logoutUserFromFirebase(): Promise<void> {
  await signOut(auth);
  saveUserSessionToStorage(null);
}

/**
 * Send password reset email via Firebase Authentication
 */
export async function sendPasswordResetWithFirebase(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Resend verification link to the user's email
 */
export async function resendAccountVerificationEmail(email: string, password?: string): Promise<void> {
  if (auth.currentUser && auth.currentUser.email?.toLowerCase() === email.trim().toLowerCase()) {
    await sendEmailVerification(auth.currentUser);
    return;
  }
  if (password) {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    await sendEmailVerification(cred.user);
    await signOut(auth);
  } else if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
  }
}

/**
  * Check email verification status against Firebase Auth servers and return verified profile if successful
  */
export async function checkEmailVerificationStatus(
  email: string,
  password?: string
): Promise<{ verified: boolean; user?: AppUserProfile }> {
  const cleanedEmail = email.trim().toLowerCase();

  // If user is currently signed in to Firebase Auth, reload user to check verification state
  if (auth.currentUser && auth.currentUser.email?.toLowerCase() === cleanedEmail) {
    try {
      await auth.currentUser.reload();
      if (auth.currentUser.emailVerified) {
        const [parentDocSnap, teacherDocSnap] = await Promise.all([
          getDoc(doc(db, "parents", auth.currentUser.uid)).catch(() => null),
          getDoc(doc(db, "teachers", auth.currentUser.uid)).catch(() => null)
        ]);
        const data = (parentDocSnap && parentDocSnap.exists() ? parentDocSnap.data() : null) ||
                     (teacherDocSnap && teacherDocSnap.exists() ? teacherDocSnap.data() : {}) || {};
        const profile: AppUserProfile = {
          uid: auth.currentUser.uid,
          name: auth.currentUser.displayName || data.name || data.fullName || cleanedEmail.split('@')[0],
          email: cleanedEmail,
          role: data.role || 'parent',
          phone: data.phone || '',
          enrolledCourses: data.enrolledCourses || [],
          hiredTutors: data.hiredTutors || [],
          demoBookings: data.demoBookings || [],
          tasks: data.tasks || [],
          progress: data.progress || {},
          emailVerified: true
        };
        saveUserSessionToStorage(profile);
        return { verified: true, user: profile };
      }
    } catch (e) {
      console.warn('Firebase user reload error in checkEmailVerificationStatus:', e);
    }
  }

  // If password provided, attempt full verified login which checks emailVerified flag
  if (password) {
    try {
      const profile = await loginUserWithFirebase(cleanedEmail, password);
      return { verified: profile.emailVerified === true, user: profile };
    } catch (err: any) {
      if (err?.code === 'auth/email-not-verified') {
        return { verified: false };
      }
      throw err;
    }
  }

  return { verified: false };
}

/**
 * Update user profile details in Firestore (parents or teachers) and sync active session
 */
export async function updateUserProfileInFirebase(
  uid: string,
  updates: Partial<AppUserProfile>
): Promise<AppUserProfile> {
  const currentSession = loadSavedUserSession();
  const targetRole = updates.role || currentSession?.role || 'parent';
  const roleDocRef = doc(db, targetRole === 'teacher' ? 'teachers' : 'parents', uid);

  const isTeacherApproved = Boolean(
    targetRole === 'teacher' && (
      (currentSession as any)?.isApproved === true ||
      (currentSession as any)?.status === 'approved' ||
      currentSession?.kycStatus === 'approved' ||
      currentSession?.verified === true ||
      (updates as any)?.isApproved === true ||
      (updates as any)?.status === 'approved' ||
      updates?.kycStatus === 'approved' ||
      updates?.verified === true ||
      isTeacherApprovedInRegistry(uid, currentSession?.email, updates.email)
    )
  );

  const updatePayload = removeUndefinedFields({
    ...updates,
    ...(updates.name ? { fullName: updates.fullName || updates.name } : {}),
    ...(isTeacherApproved ? {
      isApproved: true,
      verified: true,
      status: 'approved',
      kycStatus: 'approved',
      verificationStatus: 'Verified Genuine Tutor'
    } : {}),
    updatedAt: new Date().toISOString()
  });

  // 1. Dynamically save updated details to single authoritative Firestore collection ('teachers' or 'parents')
  await setDoc(roleDocRef, updatePayload, { merge: true });

  const rawUpdatedSession: AppUserProfile = {
    ...(currentSession || {
      uid,
      name: updates.name || 'User',
      email: updates.email || '',
      role: updates.role || 'parent'
    }),
    ...updates,
    ...(isTeacherApproved ? {
      isApproved: true,
      verified: true,
      status: 'approved',
      kycStatus: 'approved',
      verificationStatus: 'Verified Genuine Tutor'
    } : {})
  };
  const updatedSession = removeUndefinedFields(rawUpdatedSession);
  saveUserSessionToStorage(updatedSession);
  syncUserToPersistence(updatedSession).catch(() => {});

  if (targetRole === 'teacher') {
    fetch('/api/teachers/register-location', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: updatedSession.name,
        email: updatedSession.email,
        phone: updatedSession.phone,
        latitude: updatedSession.latitude || 19.1691,
        longitude: updatedSession.longitude || 83.4150,
        address: updatedSession.address || updatedSession.locality || 'Rayagada',
        locationArea: updatedSession.locationArea || updatedSession.locality || 'Rayagada',
        qualification: updatedSession.qualification || updatedSession.highestQualification || '',
        experienceYears: updatedSession.experienceYears || parseInt(String(updatedSession.experience || '2')) || 2,
        subjects: updatedSession.subjects || [],
        classesHandled: updatedSession.classesHandled || updatedSession.classes || [],
        monthlyFee: updatedSession.monthlyFee || 0,
        hourlyRate: updatedSession.hourlyRate || updatedSession.hourlyCharges || updatedSession.hourlyFee || 100,
        bio: updatedSession.bio || '',
        gender: updatedSession.gender === 'male' ? 'male' : 'female',
        teacherType: 'both',
        feeStructure: updatedSession.feeStructure,
        boardsSupported: updatedSession.boardsSupported,
        avatar: updatedSession.avatar || updatedSession.photoUrl || '',
        availableTimeSlots: updatedSession.availableTimeSlots || []
      })
    }).catch(() => {});
  }

  return updatedSession;
}

/**
 * Permanently enroll user in a course/program and update session
 */
export async function enrollUserInCourse(
  uid: string,
  course: { id: string; title: string; subtitle?: string; fee: string; tag?: string }
): Promise<AppUserProfile> {
  const newEnrollment: EnrolledCourse = {
    id: `enroll_${Date.now()}`,
    courseId: course.id,
    title: course.title,
    subtitle: course.subtitle,
    fee: course.fee,
    tag: course.tag || 'Course',
    enrolledAt: new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }),
    status: 'Active'
  };

  const parentDocRef = doc(db, "parents", uid);

  const parentDocSnap = await getDoc(parentDocRef).catch(() => null);
  let currentEnrolled: EnrolledCourse[] = [];
  if (parentDocSnap && parentDocSnap.exists()) {
    currentEnrolled = parentDocSnap.data().enrolledCourses || [];
  }

  const exists = currentEnrolled.some((c) => c.courseId === course.id);
  const updatedEnrolled = exists ? currentEnrolled : [newEnrollment, ...currentEnrolled];

  await setDoc(parentDocRef, removeUndefinedFields({ enrolledCourses: updatedEnrolled }), { merge: true }).catch(() => {});

  const currentSession = loadSavedUserSession();
  const updatedSession: AppUserProfile = currentSession
    ? { ...currentSession, enrolledCourses: updatedEnrolled }
    : {
        uid,
        name: auth.currentUser?.displayName || 'Student',
        email: auth.currentUser?.email || '',
        role: 'parent',
        enrolledCourses: updatedEnrolled
      };

  saveUserSessionToStorage(updatedSession);

  // Automatically log Course Payment (Way 2: Course)
  const numericFee = parseInt((course.fee || '').replace(/[^0-9]/g, '')) || 2500;
  logAdminActivity({
    adminName: "Admin Sunita Sahoo",
    adminEmail: "sunita.sahoo.admin@kumari.edu.in",
    actionType: "payment_course",
    category: "payment_courses",
    title: `Course Enrollment Payment Received (Way 2: Course)`,
    description: `Confirmed course tuition payment of ₹${numericFee.toLocaleString('en-IN')} for '${course.title}' for student ${updatedSession.name || 'Student'}.`,
    targetId: course.id,
    targetName: course.title,
    studentName: updatedSession.childName || updatedSession.name || 'Student',
    parentName: updatedSession.name,
    parentPhone: updatedSession.phone,
    courseTitle: course.title,
    amount: numericFee,
    paymentMethod: "UPI / QR",
    transactionId: `UPI-CR-${Date.now().toString().slice(-6)}`,
    receiptNo: `KIR-CR-${Math.floor(2000 + Math.random() * 8000)}`,
    status: "verified",
    notes: `Enrollment confirmed for ${course.title} (${course.tag || 'Course'}). Access syllabus unlocked.`
  }).catch(() => {});

  return updatedSession;
}

/**
 * Permanently book / hire a tutor for the parent and update session
 */
export async function hireTutorForUser(
  uid: string,
  tutor: { id: string; name: string; subjects?: string[]; monthlyFee?: number; phone?: string; locationArea?: string }
): Promise<AppUserProfile> {
  const newHiring: HiredTutor = {
    id: `hire_${Date.now()}`,
    tutorId: tutor.id,
    tutorName: tutor.name,
    subjects: tutor.subjects || ['All Subjects'],
    monthlyFee: tutor.monthlyFee || 3500,
    phone: tutor.phone || '+91 98765 43210',
    locationArea: tutor.locationArea || 'Rayagada',
    hiredAt: new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }),
    status: 'Confirmed'
  };

  const parentDocRef = doc(db, "parents", uid);

  const parentDocSnap = await getDoc(parentDocRef).catch(() => null);
  let currentHired: HiredTutor[] = [];
  if (parentDocSnap && parentDocSnap.exists()) {
    currentHired = parentDocSnap.data().hiredTutors || [];
  }

  const updatedHired = [newHiring, ...currentHired];

  await setDoc(parentDocRef, removeUndefinedFields({ hiredTutors: updatedHired }), { merge: true }).catch(() => {});

  const currentSession = loadSavedUserSession();
  const updatedSession: AppUserProfile = currentSession
    ? { ...currentSession, hiredTutors: updatedHired }
    : {
        uid,
        name: auth.currentUser?.displayName || 'Parent',
        email: auth.currentUser?.email || '',
        role: 'parent',
        hiredTutors: updatedHired
      };

  saveUserSessionToStorage(updatedSession);

  // Automatically log Home Tutor Payment (Way 1: Home Tutor)
  logAdminActivity({
    adminName: "Admin Anil Mohanty",
    adminEmail: "anil.mohanty.accounts@kumari.edu.in",
    actionType: "payment_home_tutor",
    category: "payment_home_tutors",
    title: `Monthly Tuition Fee Received (Way 1: Home Tutor)`,
    description: `Received monthly tuition fee of ₹${(tutor.monthlyFee || 3500).toLocaleString('en-IN')} for Home Tutor ${tutor.name} (Student: ${updatedSession.childName || updatedSession.name}).`,
    targetId: tutor.id,
    targetName: tutor.name,
    tutorName: tutor.name,
    studentName: updatedSession.childName || updatedSession.name,
    parentName: updatedSession.name,
    parentPhone: updatedSession.phone,
    amount: tutor.monthlyFee || 3500,
    paymentMethod: "UPI / QR",
    transactionId: `UPI-HT-${Date.now().toString().slice(-6)}`,
    receiptNo: `KIR-HT-${Math.floor(1000 + Math.random() * 9000)}`,
    status: "verified",
    notes: `Home tutor monthly tuition booked for subjects: ${(tutor.subjects || ['All Subjects']).join(', ')}.`
  }).catch(() => {});

  return updatedSession;
}

/**
 * Permanently save a demo trial booking to parent profile and update session
 */
export async function recordDemoBookingForUser(
  uid: string,
  booking: { studentName?: string; grade?: string; subject?: string; mode?: string; preferredDate?: string; preferredTime?: string }
): Promise<AppUserProfile> {
  const newBooking: DemoBooking = {
    id: `demo_${Date.now()}`,
    studentName: booking.studentName,
    grade: booking.grade,
    subject: booking.subject,
    mode: booking.mode,
    preferredDate: booking.preferredDate,
    preferredTime: booking.preferredTime,
    bookedAt: new Date().toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }),
    status: 'Scheduled'
  };

  const parentDocRef = doc(db, "parents", uid);

  const parentDocSnap = await getDoc(parentDocRef).catch(() => null);
  let currentBookings: DemoBooking[] = [];
  if (parentDocSnap && parentDocSnap.exists()) {
    currentBookings = parentDocSnap.data().demoBookings || [];
  }

  const updatedBookings = [newBooking, ...currentBookings];

  await setDoc(parentDocRef, removeUndefinedFields({ demoBookings: updatedBookings }), { merge: true }).catch(() => {});

  const currentSession = loadSavedUserSession();
  const updatedSession: AppUserProfile = currentSession
    ? { ...currentSession, demoBookings: updatedBookings }
    : {
        uid,
        name: auth.currentUser?.displayName || 'Parent',
        email: auth.currentUser?.email || '',
        role: 'parent',
        demoBookings: updatedBookings
      };

  saveUserSessionToStorage(updatedSession);
  return updatedSession;
}

/**
 * Helper to get the Firestore document reference (parents or teachers)
 */
function getUserRoleDocRef(uid: string) {
  const currentSession = loadSavedUserSession();
  const collectionName = currentSession?.role === 'teacher' ? 'teachers' : 'parents';
  return doc(db, collectionName, uid);
}

/**
 * Add a new task/work item to the user's profile in Firestore (real-time synchronized)
 */
export async function addUserTaskToFirestore(
  uid: string,
  task: { title: string; category?: UserTask['category']; dueDate?: string; notes?: string }
): Promise<UserTask[]> {
  const roleDocRef = getUserRoleDocRef(uid);
  const docSnap = await getDoc(roleDocRef).catch(() => null);
  const currentTasks: UserTask[] = (docSnap && docSnap.exists() && docSnap.data().tasks) || [];

  const newTask: UserTask = {
    id: `task_${Date.now()}`,
    title: task.title.trim(),
    category: task.category || 'General',
    dueDate: task.dueDate || new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    completed: false,
    notes: task.notes?.trim() || '',
    createdAt: new Date().toISOString()
  };

  const updatedTasks = [newTask, ...currentTasks];
  await setDoc(roleDocRef, removeUndefinedFields({ tasks: updatedTasks, updatedAt: new Date().toISOString() }), { merge: true }).catch(() => {});

  const currentSession = loadSavedUserSession();
  if (currentSession && currentSession.uid === uid) {
    saveUserSessionToStorage({ ...currentSession, tasks: updatedTasks });
  }
  return updatedTasks;
}

/**
 * Toggle task completion state in Firestore (real-time synchronized)
 */
export async function toggleUserTaskInFirestore(
  uid: string,
  taskId: string,
  completed: boolean
): Promise<UserTask[]> {
  const roleDocRef = getUserRoleDocRef(uid);
  const docSnap = await getDoc(roleDocRef).catch(() => null);
  const currentTasks: UserTask[] = (docSnap && docSnap.exists() && docSnap.data().tasks) || [];

  const updatedTasks = currentTasks.map((t) => (t.id === taskId ? { ...t, completed } : t));
  await setDoc(roleDocRef, removeUndefinedFields({ tasks: updatedTasks, updatedAt: new Date().toISOString() }), { merge: true }).catch(() => {});

  const currentSession = loadSavedUserSession();
  if (currentSession && currentSession.uid === uid) {
    saveUserSessionToStorage({ ...currentSession, tasks: updatedTasks });
  }
  return updatedTasks;
}

/**
 * Delete a task in Firestore (real-time synchronized)
 */
export async function deleteUserTaskFromFirestore(
  uid: string,
  taskId: string
): Promise<UserTask[]> {
  const roleDocRef = getUserRoleDocRef(uid);
  const docSnap = await getDoc(roleDocRef).catch(() => null);
  const currentTasks: UserTask[] = (docSnap && docSnap.exists() && docSnap.data().tasks) || [];

  const updatedTasks = currentTasks.filter((t) => t.id !== taskId);
  await setDoc(roleDocRef, removeUndefinedFields({ tasks: updatedTasks, updatedAt: new Date().toISOString() }), { merge: true }).catch(() => {});

  const currentSession = loadSavedUserSession();
  if (currentSession && currentSession.uid === uid) {
    saveUserSessionToStorage({ ...currentSession, tasks: updatedTasks });
  }
  return updatedTasks;
}

/**
 * Update user course progress metric in Firestore (real-time synchronized)
 */
export async function updateUserCourseProgressInFirestore(
  uid: string,
  metric: UserProgressMetric
): Promise<Record<string, UserProgressMetric>> {
  const roleDocRef = getUserRoleDocRef(uid);
  const docSnap = await getDoc(roleDocRef).catch(() => null);
  const currentProgress: Record<string, UserProgressMetric> =
    (docSnap && docSnap.exists() && docSnap.data().progress) || {};

  const updatedProgress = {
    ...currentProgress,
    [metric.courseId]: metric
  };

  await setDoc(roleDocRef, removeUndefinedFields({ progress: updatedProgress, updatedAt: new Date().toISOString() }), { merge: true }).catch(() => {});

  const currentSession = loadSavedUserSession();
  if (currentSession && currentSession.uid === uid) {
    saveUserSessionToStorage({ ...currentSession, progress: updatedProgress });
  }
  return updatedProgress;
}

/**
 * Fetch all registered teachers from Firestore 'teachers' collection
 */
export async function fetchTeachersFromFirestore(): Promise<Tutor[]> {
  try {
    const teachersCol = collection(db, "teachers");
    const snapshot = await getDocs(teachersCol);
    const teachers: Tutor[] = [];

    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as any;
      const docId = docSnap.id.toLowerCase();
      const rawName = (data.fullName || data.name || '').trim();
      if (
        !rawName ||
        rawName.toLowerCase() === 'educator' ||
        rawName.toLowerCase().includes('educator') ||
        docId.includes('educator') ||
        docId.includes('priya-sharma') ||
        docId.includes('rakesh-tripathy') ||
        docId.includes('sneha-patel') ||
        docId.includes('sagar-das') ||
        docId.includes('anita-mohanty') ||
        docId.includes('sukumar') ||
        docId.startsWith('fb_teacher')
      ) {
        return;
      }

      const isApproved = Boolean(
        (data.verified === true && (data.isApproved === true || data.status === 'approved')) ||
        (data.isApproved === true && data.status === 'approved')
      );
      if (!isApproved || data.status === 'rejected' || data.verified === false) {
        return;
      }

      teachers.push({
        id: docSnap.id,
        name: rawName,
        qualification: data.qualification || data.highestQualification || "",
        rating: typeof data.rating === 'number' ? data.rating : 4.9,
        reviewCount: typeof data.reviewCount === 'number' ? data.reviewCount : 1,
        hourlyRate: typeof data.hourlyRate === 'number' ? data.hourlyRate : 100,
        monthlyFee: typeof data.monthlyFee === 'number' ? data.monthlyFee : 3000,
        subjects: Array.isArray(data.subjects) ? data.subjects : [],
        classesHandled: Array.isArray(data.classesHandled)
          ? data.classesHandled
          : Array.isArray(data.classes)
          ? data.classes
          : [],
        boardsSupported: Array.isArray(data.boardsSupported) ? data.boardsSupported : [],
        experienceYears: typeof data.experienceYears === 'number' ? data.experienceYears : 0,
        experienceText: data.experienceYears ? `${data.experienceYears} Years Experience` : "",
        locationArea: data.locationArea || data.locality || "Rayagada",
        addressSnippet: data.addressSnippet || data.address || "Rayagada, Odisha",
        distanceKm: 0,
        availabilityText: data.availabilityText || "Available for Home Tuition",
        availabilityType: "available_now",
        availabilityBadge: "Verified Genuine Home Tutor",
        avatar: data.avatar || data.photoUrl || "",
        bio: data.bio || "",
        verified: true,
        latitude: typeof data.latitude === 'number' ? data.latitude : 19.1691,
        longitude: typeof data.longitude === 'number' ? data.longitude : 83.4150,
        gender: data.gender === "male" ? "male" : "female",
        teacherType: data.teacherType === "both" ? "both" : "home",
        teachingHighlights: Array.isArray(data.teachingHighlights) ? data.teachingHighlights : [],
        reviews: Array.isArray(data.reviews) ? data.reviews : [],
        availableTimeSlots: Array.isArray(data.availableTimeSlots)
          ? data.availableTimeSlots
          : Array.isArray(data.timeSlots)
          ? data.timeSlots
          : [],
        feeStructure: data.feeStructure
      });
    });

    return teachers;
  } catch (err) {
    console.warn("Notice reading teachers from Firestore:", err);
    return [];
  }
}

/**
 * Listen to Firebase Auth state changes using onAuthStateChanged with real-time session tracking,
 * cross-tab synchronization, and proactive email verification polling/focus detection.
 */
export function subscribeToFirebaseAuth(onUserChange: (user: AppUserProfile | null) => void): () => void {
  let userSnapshotUnsubscribe: (() => void) | null = null;
  let verificationCheckInterval: any = null;
  let isSubscribed = true;

  const teardownSnapshot = () => {
    if (userSnapshotUnsubscribe) {
      userSnapshotUnsubscribe();
      userSnapshotUnsubscribe = null;
    }
  };

  const stopVerificationPoller = () => {
    if (verificationCheckInterval) {
      clearInterval(verificationCheckInterval);
      verificationCheckInterval = null;
    }
  };

  const buildProfile = (data: any, fbUser: FirebaseUser): AppUserProfile => {
    const fbEmail = (fbUser.email || data?.email || '').toLowerCase().trim();
    const isAdminAccount =
      data?.role === 'admin' ||
      fbEmail === ADMIN_CREDENTIALS.email.toLowerCase() ||
      fbEmail === 'kkumariinstitute@gmail.com';
    const role: 'parent' | 'teacher' | 'admin' = isAdminAccount
      ? 'admin'
      : data?.role === 'teacher'
      ? 'teacher'
      : 'parent';
    const profile: AppUserProfile = {
      uid: fbUser.uid,
      name: data?.name || data?.fullName || fbUser.displayName || (isAdminAccount ? 'Kumari Institute Admin' : 'User'),
      email: fbUser.email || data?.email || '',
      role,
      phone: data?.phone || '',
      gender: data?.gender || 'female',
      profileCompleted: isAdminAccount ? true : (data?.profileCompleted ?? false),
      locality: data?.locality || data?.locationArea || '',
      enrolledCourses: Array.isArray(data?.enrolledCourses) ? data.enrolledCourses : [],
      hiredTutors: Array.isArray(data?.hiredTutors) ? data.hiredTutors : [],
      demoBookings: Array.isArray(data?.demoBookings) ? data.demoBookings : [],
      tasks: Array.isArray(data?.tasks) ? data.tasks : [],
      progress: data?.progress || {},
      createdAt: data?.createdAt || new Date().toISOString(),
      lastLoginAt: data?.lastLoginAt || new Date().toISOString(),
      emailVerified: true
    };

    if (typeof data?.latitude === 'number') profile.latitude = data.latitude;
    if (typeof data?.longitude === 'number') profile.longitude = data.longitude;
    if (data?.childName || data?.studentName) {
      profile.childName = data.childName || data.studentName;
      profile.studentName = data.studentName || data.childName;
    }
    if (data?.studentAge || data?.childAge) {
      profile.studentAge = data.studentAge || data.childAge;
      profile.childAge = data.childAge || data.studentAge;
    }
    if (data?.childGrade || data?.studentGrade || data?.grade || data?.class) {
      profile.childGrade = data.childGrade || data.studentGrade || data.grade || data.class;
    }
    if (data?.childBoard || data?.board) {
      profile.childBoard = data.childBoard || data.board;
      profile.board = data.board || data.childBoard;
    }
    if (data?.childSchool || data?.school) profile.childSchool = data.childSchool || data.school;
    if (Array.isArray(data?.subjectsNeeded)) profile.subjectsNeeded = data.subjectsNeeded;
    if (data?.preferredTimeSlot || data?.timeSlotNeeded) {
      profile.preferredTimeSlot = data.preferredTimeSlot || data.timeSlotNeeded;
      profile.timeSlotNeeded = data.timeSlotNeeded || data.preferredTimeSlot;
    }
    if (data?.whatsappNumber) profile.whatsappNumber = data.whatsappNumber;
    if (data?.address) profile.address = data.address;
    if (data?.notes) profile.notes = data.notes;
    if (data?.learningRequirementsSubmitted !== undefined) profile.learningRequirementsSubmitted = Boolean(data.learningRequirementsSubmitted);
    if (data?.targetExam) profile.targetExam = data.targetExam;
    if (data?.emergencyContact) profile.emergencyContact = data.emergencyContact;
    if (data?.updatedAt) profile.updatedAt = data.updatedAt;

    // Teacher fields
    if (data?.qualification || data?.highestQualification) profile.qualification = data.qualification || data.highestQualification;
    if (data?.university) profile.university = data.university;
    if (data?.experience) profile.experience = data.experience;
    if (typeof data?.experienceYears === 'number') (profile as any).experienceYears = data.experienceYears;
    if (Array.isArray(data?.subjects)) profile.subjects = data.subjects;
    if (Array.isArray(data?.classesHandled)) (profile as any).classesHandled = data.classesHandled;
    if (Array.isArray(data?.classes)) profile.classes = data.classes;
    if (typeof data?.hourlyCharges === 'number') profile.hourlyCharges = data.hourlyCharges;
    if (typeof data?.hourlyFee === 'number') profile.hourlyFee = data.hourlyFee;
    if (typeof data?.monthlyFee === 'number') profile.monthlyFee = data.monthlyFee;
    if (data?.bio) profile.bio = data.bio;
    if (data?.avatar || data?.photoUrl) {
      profile.avatar = data.avatar || data.photoUrl;
      profile.photoUrl = data.avatar || data.photoUrl;
    }
    if (Array.isArray(data?.availableTimeSlots)) profile.availableTimeSlots = data.availableTimeSlots;
    if (Array.isArray(data?.timeSlots)) (profile as any).timeSlots = data.timeSlots;
    if (data?.addressDetails) profile.addressDetails = data.addressDetails;
    if (data?.feeStructure) profile.feeStructure = data.feeStructure;
    if (Array.isArray(data?.boardsSupported)) profile.boardsSupported = data.boardsSupported;
    if (data?.educationDetails) profile.educationDetails = data.educationDetails;
    if (data?.dob) (profile as any).dob = data.dob;
    if (data?.altNumber) (profile as any).altNumber = data.altNumber;
    if (data?.fatherName) (profile as any).fatherName = data.fatherName;
    if (data?.fatherMobile) (profile as any).fatherMobile = data.fatherMobile;
    if (data?.motherName) (profile as any).motherName = data.motherName;
    if (data?.motherMobile) (profile as any).motherMobile = data.motherMobile;
    if (data?.aadhaarNumber) (profile as any).aadhaarNumber = data.aadhaarNumber;
    if (data?.aadhaarDocUrl) (profile as any).aadhaarDocUrl = data.aadhaarDocUrl;
    if (data?.kycStatus) profile.kycStatus = data.kycStatus;
    if (data?.verified !== undefined) (profile as any).verified = Boolean(data.verified);
    if (data?.isApproved !== undefined) (profile as any).isApproved = Boolean(data.isApproved);
    if (data?.status) (profile as any).status = data.status;
    if (data?.verificationStatus) (profile as any).verificationStatus = data.verificationStatus;

    // Once a teacher is approved, preserve KYC and approval status
    if (
      role === 'teacher' && (
        data?.isApproved === true ||
        data?.status === 'approved' ||
        data?.verified === true ||
        data?.kycStatus === 'approved' ||
        data?.kycStatus === 'verified' ||
        data?.verificationStatus === 'Verified Genuine Tutor' ||
        isTeacherApprovedInRegistry(fbUser.uid, fbUser.email, data?.phone, data?.id)
      )
    ) {
      (profile as any).isApproved = true;
      (profile as any).verified = true;
      (profile as any).status = 'approved';
      profile.kycStatus = 'approved';
      (profile as any).verificationStatus = 'Verified Genuine Tutor';
      markTeacherApprovedInRegistry(fbUser.uid);
      if (fbUser.email) markTeacherApprovedInRegistry(fbUser.email);
    }

    if (Array.isArray(data?.assignedStudents)) (profile as any).assignedStudents = data.assignedStudents;
    if (data?.assignedEducator) (profile as any).assignedEducator = data.assignedEducator;

    return profile;
  };

  const attachUserDocListener = async (fbUser: FirebaseUser) => {
    teardownSnapshot();
    if (!isSubscribed) return;

    // Check admin email, cached session, or teachers collection to determine role collection
    let collectionName = 'parents';
    const cached = loadSavedUserSession();
    const fbEmail = (fbUser.email || '').toLowerCase().trim();
    const isAdminEmail =
      fbEmail === ADMIN_CREDENTIALS.email.toLowerCase() ||
      fbEmail === 'kkumariinstitute@gmail.com';

    if (isAdminEmail || (cached && cached.uid === fbUser.uid && cached.role === 'admin')) {
      collectionName = 'admins';
    } else if (cached && cached.uid === fbUser.uid && cached.role === 'teacher') {
      collectionName = 'teachers';
    } else {
      try {
        const teacherSnap = await getDoc(doc(db, "teachers", fbUser.uid));
        if (teacherSnap.exists()) {
          collectionName = 'teachers';
        }
      } catch {
        // default to parents
      }
    }

    if (!isSubscribed) return;

    try {
      const docRef = doc(db, collectionName, fbUser.uid);
      userSnapshotUnsubscribe = onSnapshot(
        docRef,
        async (docSnap) => {
          if (!isSubscribed) return;
          if (docSnap.exists()) {
            const profile = buildProfile(docSnap.data(), fbUser);
            saveUserSessionToStorage(profile);
            saveUserToLocalRegistry(profile);
            // Sync to local server without redundant Firestore setDoc
            fetch('/api/users', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(profile)
            }).catch(() => {});
            onUserChange(profile);
          } else {
            // Check alternate role collection or persistent server storage
            const altCollection = collectionName === 'parents' ? 'teachers' : 'parents';
            try {
              const [altDocSnap, serverProfile] = await Promise.all([
                getDoc(doc(db, altCollection, fbUser.uid)).catch(() => null),
                getUserFromPersistentServer(fbUser.uid).catch(() => null)
              ]);
              const altData = altDocSnap && altDocSnap.exists() ? altDocSnap.data() : null;
              const foundData = altData || serverProfile;
              if (foundData) {
                const profile = buildProfile(foundData, fbUser);
                saveUserSessionToStorage(profile);
                onUserChange(profile);
              } else {
                const fallbackProfile: AppUserProfile = {
                  uid: fbUser.uid,
                  name: cached?.name || fbUser.displayName || (cached?.role === 'teacher' ? 'Tutor' : 'Parent'),
                  email: fbUser.email || '',
                  role: cached?.uid === fbUser.uid && cached?.role ? cached.role : 'parent',
                  profileCompleted: Boolean(cached?.uid === fbUser.uid && cached?.profileCompleted),
                  locality: 'Indira Nagar, Rayagada',
                  enrolledCourses: [],
                  hiredTutors: [],
                  demoBookings: [],
                  emailVerified: true
                };
                saveUserSessionToStorage(fallbackProfile);
                syncUserToPersistence(fallbackProfile).catch(() => {});
                onUserChange(fallbackProfile);
              }
            } catch (innerErr) {
              console.warn("[Auth Realtime] Role collection lookup notice:", innerErr);
            }
          }
        },
        (error) => {
          console.warn(`[Firestore Realtime] Snapshot notice on ${collectionName}/${fbUser.uid}:`, error?.message || error);
          const currentCached = loadSavedUserSession();
          if (currentCached && currentCached.uid === fbUser.uid && currentCached.emailVerified) {
            onUserChange(currentCached);
          }
        }
      );
    } catch (err) {
      console.warn("[Firestore Realtime] Init snapshot notice:", err);
    }
  };

  const handleVerifiedUser = (fbUser: FirebaseUser) => {
    stopVerificationPoller();

    // Instantly restore cached session if available to avoid flicker
    const cached = loadSavedUserSession();
    if (cached && cached.uid === fbUser.uid && cached.emailVerified) {
      onUserChange(cached);
    }

    // Attach real-time Firestore document listener
    attachUserDocListener(fbUser);
  };

  // Check and reload the currentUser's token to check for email verification in real-time
  const checkAndUpdateVerification = async () => {
    const currentFbUser = auth.currentUser;
    if (!currentFbUser || !isSubscribed) return;

    if (currentFbUser.emailVerified) {
      // Already verified, ensure active session is mounted
      handleVerifiedUser(currentFbUser);
      return;
    }

    try {
      await currentFbUser.reload();
      if (currentFbUser.emailVerified) {
        console.log('[Auth Realtime] Email verification confirmed in real-time for:', currentFbUser.email);
        handleVerifiedUser(currentFbUser);
      }
    } catch (err: any) {
      if (err?.code === 'auth/user-token-expired' || err?.code === 'auth/user-not-found') {
        teardownSnapshot();
        stopVerificationPoller();
        saveUserSessionToStorage(null);
        onUserChange(null);
      }
    }
  };

  // Primary Firebase Auth State Listener using onAuthStateChanged
  const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (!isSubscribed) return;

    teardownSnapshot();

    if (!firebaseUser) {
      stopVerificationPoller();
      // Preserve password-authenticated Admin Console sessions (which do not use a Firebase Auth user)
      const cached = loadSavedUserSession();
      if (cached && cached.role === 'admin' && cached.uid === 'admin_kumari_institute') {
        onUserChange(cached);
        return;
      }
      saveUserSessionToStorage(null);
      onUserChange(null);
      return;
    }

    const isDemo =
      firebaseUser.email?.toLowerCase() === DEMO_PARENT_ACCOUNT.email.toLowerCase() ||
      firebaseUser.email?.toLowerCase() === DEMO_TEACHER_ACCOUNT.email.toLowerCase();

    if (!firebaseUser.emailVerified && !isDemo) {
      // User is currently unverified - attempt an immediate reload in case they just clicked the email link
      try {
        await firebaseUser.reload();
      } catch (reloadErr) {
        // ignore transient reload errors
      }

      if (firebaseUser.emailVerified) {
        handleVerifiedUser(firebaseUser);
        return;
      }

      // Still unverified: block active session in accordance with security policy
      saveUserSessionToStorage(null);
      onUserChange(null);

      // Start reactive poller to immediately catch verification when user clicks the link
      stopVerificationPoller();
      verificationCheckInterval = setInterval(() => {
        if (!document.hidden) {
          checkAndUpdateVerification();
        }
      }, 3000);
      return;
    }

    // User is verified
    handleVerifiedUser(firebaseUser);
  });

  // Cross-Tab Session Synchronization via localStorage storage event
  const handleStorageEvent = (event: StorageEvent) => {
    if (!isSubscribed) return;
    if (event.key === SESSION_STORAGE_KEY) {
      if (!event.newValue) {
        // User logged out in another tab: react immediately
        console.log('[Auth Realtime] User signed out from another tab.');
        teardownSnapshot();
        stopVerificationPoller();
        onUserChange(null);
        if (auth.currentUser) {
          signOut(auth).catch(() => {});
        }
      } else {
        // User logged in or updated session in another tab
        try {
          const parsed = JSON.parse(event.newValue) as AppUserProfile;
          if (parsed && parsed.emailVerified === true) {
            console.log('[Auth Realtime] User signed in or session updated in another tab:', parsed.email);
            onUserChange(parsed);
          } else {
            onUserChange(null);
          }
        } catch {
          // ignore parse error
        }
      }
    }
  };

  // React immediately when the user switches tabs back to the app (after checking their email)
  const handleVisibilityOrFocus = () => {
    if (document.visibilityState === 'visible') {
      checkAndUpdateVerification();
    }
  };

  window.addEventListener('storage', handleStorageEvent);
  window.addEventListener('focus', handleVisibilityOrFocus);
  document.addEventListener('visibilitychange', handleVisibilityOrFocus);

  return () => {
    isSubscribed = false;
    teardownSnapshot();
    stopVerificationPoller();
    authUnsubscribe();
    window.removeEventListener('storage', handleStorageEvent);
    window.removeEventListener('focus', handleVisibilityOrFocus);
    document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
  };
}

const PROTOTYPE_TUTOR_TOKENS = [
  'priya-sharma',
  'rakesh-tripathy',
  'sneha-patel',
  'sagar-das',
  'anita-mohanty',
  'sukumar',
  't7rcs2ymnyymgjwneqhqeazwale2'
];

function canonicalTeacherUid(rawId: string): string {
  return String(rawId || '').trim().replace(/^fb_teacher_/, '');
}

function isPrototypeOrInvalidTutor(docId: string, data: any): boolean {
  const lowerId = String(docId || '').toLowerCase().trim();
  const rawName = String(data?.fullName || data?.name || '').trim();
  const lowerName = rawName.toLowerCase();
  if (!rawName || lowerName === 'educator' || lowerName.includes('educator') || lowerName.includes('divya')) {
    return true;
  }
  if (lowerId.includes('educator')) return true;
  for (const token of PROTOTYPE_TUTOR_TOKENS) {
    if (lowerId.includes(token)) return true;
  }
  return false;
}

function mergeTeacherPayloads(existing: any, incoming: any, incomingIsAuthoritative: boolean): any {
  if (!existing) return { ...incoming };
  const merged: any = { ...existing };

  for (const [key, val] of Object.entries(incoming || {})) {
    if (val === undefined || val === null) continue;
    if (typeof val === 'string' && val.trim() === '') continue;
    if (Array.isArray(val) && val.length === 0 && Array.isArray(merged[key]) && merged[key].length > 0) {
      continue;
    }
    // Preserve richer existing profile fields unless incoming is authoritative or has real data
    if (
      !incomingIsAuthoritative &&
      merged[key] !== undefined &&
      merged[key] !== null &&
      merged[key] !== '' &&
      !(Array.isArray(merged[key]) && merged[key].length === 0)
    ) {
      continue;
    }
    merged[key] = val;
  }

  // Always preserve authoritative verification flags from teachers collection when present
  if (incomingIsAuthoritative) {
    if (incoming.status) merged.status = incoming.status;
    if (incoming.verified !== undefined) merged.verified = incoming.verified;
    if (incoming.isApproved !== undefined) merged.isApproved = incoming.isApproved;
    if (incoming.kycStatus) merged.kycStatus = incoming.kycStatus;
    if (incoming.verificationStatus) merged.verificationStatus = incoming.verificationStatus;
    if (incoming.approvedAt) merged.approvedAt = incoming.approvedAt;
    if (incoming.rejectedAt) merged.rejectedAt = incoming.rejectedAt;
    if (incoming.rejectionReason !== undefined) merged.rejectionReason = incoming.rejectionReason;
  }

  return merged;
}

function parsePublicApprovedTutor(canonicalId: string, data: any): Tutor | null {
  if (isPrototypeOrInvalidTutor(canonicalId, data)) return null;

  const isApproved = Boolean(
    (data.verified === true && (data.isApproved === true || data.status === 'approved')) ||
    (data.isApproved === true && data.status === 'approved')
  );
  if (!isApproved || data.status === 'rejected' || data.verified === false) {
    return null;
  }

  const rawName = String(data.fullName || data.name || '').trim();
  const numHourly = Number(data.hourlyRate) || Number(data.hourlyCharges) || Number(data.hourlyFee) || 0;
  const numMonthly = Number(data.monthlyFee) || Number(data.feeAmount) || 0;
  const resolvedHourly = numHourly > 0 ? numHourly : (numMonthly > 0 ? Math.round(numMonthly / 30) : 100);
  const resolvedMonthly = numMonthly > 0 ? numMonthly : (resolvedHourly > 0 ? resolvedHourly * 30 : 3000);
  const expYears = Number(data.experienceYears) || 0;
  const lat = Number(data.latitude);
  const lng = Number(data.longitude);
  const safeLat = Number.isFinite(lat) && lat !== 0 ? lat : 19.1691;
  const safeLng = Number.isFinite(lng) && lng !== 0 ? lng : 83.4150;

  return {
    id: canonicalId,
    name: rawName,
    email: data.email,
    phone: data.phone,
    qualification: data.highestQualification || data.qualification || "",
    experienceYears: expYears,
    experienceText: expYears > 0 ? `${expYears}+ Yrs Exp` : '',
    subjects: Array.isArray(data.subjects) ? data.subjects : [],
    distanceKm: 0,
    availabilityText: data.availabilityText || "Available for Home Tuition",
    availabilityType: "available_now",
    availabilityBadge: "Verified Genuine Home Tutor",
    rating: Number(data.rating) > 0 ? Number(data.rating) : 4.9,
    reviewCount: Number(data.reviewCount) > 0 ? Number(data.reviewCount) : 1,
    monthlyFee: resolvedMonthly,
    hourlyRate: resolvedHourly,
    bio: data.bio || "",
    avatar: data.avatar || data.photoUrl || "",
    classesHandled: Array.isArray(data.classesHandled)
      ? data.classesHandled
      : Array.isArray(data.classes)
      ? data.classes
      : [],
    boardsSupported: Array.isArray(data.boardsSupported) ? data.boardsSupported : [],
    locationArea: data.locationArea || data.locality || data.addressDetails?.street || "Rayagada",
    addressSnippet: data.address || data.addressSnippet || data.locality || "",
    address: data.address || data.addressSnippet || (data.locationArea ? `${data.locationArea}, Rayagada, Odisha` : "Rayagada, Odisha"),
    locality: data.locality || data.locationArea || "Rayagada",
    addressDetails: data.addressDetails || {
      line1: data.addressDetails?.line1 || data.addressLine1 || "",
      street: data.addressDetails?.street || data.locationArea || data.locality || "Rayagada",
      landmark: data.addressDetails?.landmark || data.landmark || "Rayagada",
      city: data.addressDetails?.city || "Rayagada",
      state: data.addressDetails?.state || "Odisha",
      pincode: data.addressDetails?.pincode || "765001",
      latitude: safeLat,
      longitude: safeLng
    },
    verified: true,
    status: 'approved',
    isApproved: true,
    isBooked: Boolean(data.isBooked),
    bookingStatus: data.isBooked ? 'booked' : 'available',
    verificationStatus: 'Verified Genuine Tutor',
    latitude: safeLat,
    longitude: safeLng,
    gender: data.gender === "male" ? "male" : "female",
    teacherType: data.teacherType === "both" ? "both" : "home",
    teachingHighlights: Array.isArray(data.teachingHighlights) ? data.teachingHighlights : [],
    educationDetails: data.educationDetails,
    highestQualification: data.highestQualification || data.qualification || "",
    courseDegree: data.courseDegree || "",
    university: data.university || data.educationDetails?.degree?.university || "",
    passingYear: data.passingYear || data.educationDetails?.degree?.year || "",
    languages: Array.isArray(data.languages) ? data.languages : [],
    hourlyCharges: resolvedHourly,
    totalExperience: data.totalExperience || data.experience || data.experienceYears,
    aadhaarNumber: data.aadhaarNumber,
    aadhaarDocUrl: data.aadhaarDocUrl,
    availableTimeSlots: Array.isArray(data.availableTimeSlots)
      ? data.availableTimeSlots
      : Array.isArray(data.availableTimings)
      ? data.availableTimings
      : Array.isArray(data.timeSlots)
      ? data.timeSlots
      : [],
    reviews: Array.isArray(data.reviews) ? data.reviews : [],
    feeStructure: data.feeStructure
  };
}

/**
 * Real-time listener for verified genuine teachers from single authoritative Firestore collection 'teachers'
 * with automatic /api/teachers & Firestore REST fallback so Find Tutors NEVER goes blank.
 */
export function subscribeToRealtimeTeachers(onTeachersUpdate: (teachers: Tutor[]) => void): () => void {
  let active = true;
  const teachersMap = new Map<string, any>();
  const apiFallbackMap = new Map<string, any>();

  let receivedTeachersSnapshot = false;

  const emitMerged = () => {
    if (!active) return;
    const baseSource = receivedTeachersSnapshot ? teachersMap : (teachersMap.size > 0 ? teachersMap : apiFallbackMap);
    const approvedList: Tutor[] = [];
    baseSource.forEach((raw, uid) => {
      const parsed = parsePublicApprovedTutor(uid, raw);
      if (parsed) approvedList.push(parsed);
    });

    onTeachersUpdate(approvedList);
  };

  const hydrateFromServerAndRest = async () => {
    try {
      const res = await fetch('/api/teachers');
      if (res.ok) {
        const body = await res.json();
        const list = Array.isArray(body) ? body : Array.isArray(body?.teachers) ? body.teachers : [];
        if (list.length > 0) {
          apiFallbackMap.clear();
          for (const t of list) {
            const uid = canonicalTeacherUid(t.uid || t.id || '');
            if (uid && !isPrototypeOrInvalidTutor(uid, t)) {
              apiFallbackMap.set(uid, { ...t, id: uid, uid });
            }
          }
          emitMerged();
          return;
        }
      }
    } catch {
      // fall through to Firestore REST
    }

    try {
      const restTeachers = await fetchFirestoreCollectionRest<any>('teachers').catch(() => []);
      for (const t of restTeachers) {
        const uid = canonicalTeacherUid(t.id || t.uid || '');
        if (uid && !isPrototypeOrInvalidTutor(uid, t)) {
          teachersMap.set(uid, { ...t, id: uid, uid });
        }
      }
      emitMerged();
    } catch {
      // keep existing state intact
    }
  };

  // Immediate server hydration so Find Tutors never stalls waiting on WebChannel
  hydrateFromServerAndRest();

  const unsubs: Array<() => void> = [];

  try {
    unsubs.push(
      onSnapshot(
        collection(db, "teachers"),
        (snapshot) => {
          receivedTeachersSnapshot = true;
          teachersMap.clear();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const uid = canonicalTeacherUid(docSnap.id);
            if (!uid || isPrototypeOrInvalidTutor(uid, data)) return;
            teachersMap.set(uid, { ...data, id: uid, uid });
          });
          emitMerged();
        },
        (err) => {
          console.warn("[Firestore Realtime] Notice on teachers snapshot (falling back to REST):", err?.message || err);
          hydrateFromServerAndRest();
        }
      )
    );
  } catch (err) {
    console.warn("[Firestore Realtime] subscribeToRealtimeTeachers teachers setup notice:", err);
  }

  return () => {
    active = false;
    unsubs.forEach((u) => {
      try { u(); } catch {}
    });
  };
}

/**
 * Admin Real-time listener for ALL registered teachers (pending, approved, rejected).
 * Merges 'teachers', 'complete_tutors', and 'tutors_requests' by canonical UID + /api/admin/teachers
 * and Firestore REST fallbacks so Admin Panel ALWAYS displays complete, live tutor data.
 */
export function subscribeToAllTeachersForAdmin(onTeachersUpdate: (teachers: Tutor[]) => void): () => void {
  const parseFirestoreTeacher = (docId: string, data: any): Tutor => {
    const canonicalId = canonicalTeacherUid(docId);
    const isRejected = data.status === 'rejected' || data.kycStatus === 'rejected';
    const isApproved = !isRejected && Boolean(
      (data.verified === true && (data.isApproved === true || data.status === 'approved')) ||
      data.kycStatus === 'approved' ||
      data.kycStatus === 'verified' ||
      data.status === 'approved' ||
      data.isApproved === true ||
      data.verificationStatus === 'Verified Genuine Tutor' ||
      isTeacherApprovedInRegistry(canonicalId, data.uid, data.email, data.phone)
    );
    const hasUploadedDetails = Boolean(
      data.profileCompleted === true ||
      data.educationDetails?.tenth?.marksheetUrl ||
      data.educationDetails?.twelfth?.marksheetUrl ||
      data.aadhaarDocUrl ||
      data.feeStructure
    );
    const status = isRejected
      ? 'rejected'
      : isApproved
      ? 'approved'
      : 'pending';

    const numHourly = Number(data.hourlyRate) || Number(data.hourlyCharges) || Number(data.hourlyFee) || 0;
    const numMonthly = Number(data.monthlyFee) || Number(data.feeAmount) || 0;
    const resolvedHourly = numHourly > 0 ? numHourly : (numMonthly > 0 ? Math.round(numMonthly / 30) : 0);
    const resolvedMonthly = numMonthly > 0 ? numMonthly : (resolvedHourly > 0 ? resolvedHourly * 30 : 0);
    const expYears = Number(data.experienceYears) || 0;

    return {
      id: canonicalId,
      name: (data.fullName || data.name || "").trim() || "Registered Tutor",
      email: data.email,
      phone: data.phone,
      altNumber: data.altNumber,
      dob: data.dob,
      fatherName: data.fatherName,
      fatherMobile: data.fatherMobile,
      motherName: data.motherName,
      motherMobile: data.motherMobile,
      qualification: data.highestQualification || data.qualification || "",
      experienceYears: expYears,
      experienceText: expYears > 0 ? `${expYears}+ Yrs Exp` : '',
      subjects: Array.isArray(data.subjects) ? data.subjects : [],
      distanceKm: 0,
      availabilityText: data.isBooked ? "Currently Booked" : (data.availabilityText || (hasUploadedDetails ? "Available" : "Pending Profile Upload")),
      availabilityType: "available_now",
      availabilityBadge: isApproved
        ? "Verified Genuine Home Tutor"
        : hasUploadedDetails
        ? "Profile Submitted • Pending Review"
        : "Pending Profile Submission",
      rating: Number(data.rating) || 0,
      reviewCount: Number(data.reviewCount) || 0,
      monthlyFee: resolvedMonthly,
      hourlyRate: resolvedHourly,
      bio: data.bio || "",
      avatar: data.avatar || data.photoUrl || "",
      classesHandled: Array.isArray(data.classesHandled)
        ? data.classesHandled
        : Array.isArray(data.classes)
        ? data.classes
        : [],
      boardsSupported: Array.isArray(data.boardsSupported) ? data.boardsSupported : [],
      locationArea: data.locationArea || data.locality || "",
      addressSnippet: data.address || data.addressSnippet || data.locality || "",
      addressDetails: data.addressDetails,
      verified: Boolean(data.verified) || isApproved,
      status: status,
      isApproved: isApproved,
      profileCompleted: hasUploadedDetails,
      kycStatus: data.kycStatus || (isApproved ? 'approved' : hasUploadedDetails ? 'submitted' : 'pending'),
      isBooked: Boolean(data.isBooked),
      bookingStatus: data.isBooked ? 'booked' : 'available',
      verificationStatus: data.verificationStatus || (isApproved ? 'Verified Genuine Tutor' : hasUploadedDetails ? 'Pending Verification' : 'Pending Profile Submission'),
      approvedAt: data.approvedAt,
      submittedAt: data.submittedAt || data.updatedAt || data.createdAt,
      updatedAt: data.updatedAt || data.submittedAt || data.createdAt,
      latitude: Number(data.latitude) || 0,
      longitude: Number(data.longitude) || 0,
      gender: data.gender === "male" ? "male" : "female",
      teacherType: data.teacherType === "both" ? "both" : "home",
      teachingHighlights: Array.isArray(data.teachingHighlights) ? data.teachingHighlights : [],
      educationDetails: data.educationDetails,
      certificates: {
        tenth: {
          name: data.educationDetails?.tenth?.marksheetName || '',
          url: data.educationDetails?.tenth?.marksheetUrl || '',
          score: data.educationDetails?.tenth?.score || '',
          year: data.educationDetails?.tenth?.year || '',
          board: data.educationDetails?.tenth?.board || ''
        },
        twelfth: {
          name: data.educationDetails?.twelfth?.marksheetName || '',
          url: data.educationDetails?.twelfth?.marksheetUrl || '',
          score: data.educationDetails?.twelfth?.score || '',
          year: data.educationDetails?.twelfth?.year || '',
          board: data.educationDetails?.twelfth?.board || ''
        },
        degree: {
          name: data.educationDetails?.degree?.marksheetName || '',
          url: data.educationDetails?.degree?.marksheetUrl || '',
          score: data.educationDetails?.degree?.score || '',
          year: data.educationDetails?.degree?.year || '',
          course: data.educationDetails?.degree?.course || data.qualification || '',
          university: data.educationDetails?.degree?.university || ''
        },
        idProof: {
          name: data.aadhaarDocUrl ? 'aadhaar_card.jpg' : '',
          url: data.aadhaarDocUrl || '',
          docNumber: data.aadhaarNumber || '',
          type: 'Aadhaar Card (Govt. of India)'
        }
      },
      aadhaarNumber: data.aadhaarNumber,
      aadhaarDocUrl: data.aadhaarDocUrl,
      availableTimeSlots: Array.isArray(data.availableTimeSlots)
        ? data.availableTimeSlots
        : Array.isArray(data.availableTimings)
        ? data.availableTimings
        : [],
      reviews: Array.isArray(data.reviews) ? data.reviews : [],
      feeStructure: data.feeStructure
    };
  };

  let active = true;
  let receivedTeachersSnapshot = false;
  const serverCacheMap = new Map<string, any>();
  const teachersMap = new Map<string, any>();

  const emitMerged = () => {
    if (!active) return;

    // Single authoritative tutor collection: 'teachers' (complete_tutors retired).
    const baseSource = receivedTeachersSnapshot ? teachersMap : (teachersMap.size > 0 ? teachersMap : serverCacheMap);
    const list: Tutor[] = [];
    baseSource.forEach((raw, uid) => {
      if (isPrototypeOrInvalidTutor(uid, raw)) return;
      list.push(parseFirestoreTeacher(uid, raw));
    });

    list.sort((a, b) => {
      const tB = new Date(b.updatedAt || b.submittedAt || 0).getTime();
      const tA = new Date(a.updatedAt || a.submittedAt || 0).getTime();
      return tB - tA;
    });

    onTeachersUpdate(list);
  };

  const hydrateFallback = async () => {
    try {
      const res = await fetch('/api/admin/teachers');
      if (res.ok) {
        const body = await res.json();
        const serverList = Array.isArray(body?.teachers) ? body.teachers : [];
        if (serverList.length > 0) {
          serverCacheMap.clear();
          for (const t of serverList) {
            const uid = canonicalTeacherUid(t.uid || t.id || '');
            if (uid && !isPrototypeOrInvalidTutor(uid, t)) {
              serverCacheMap.set(uid, { ...t, id: uid, uid });
            }
          }
          emitMerged();
        }
      }
    } catch {
      // fall through to Firestore REST
    }

    try {
      const restTeachers = await fetchFirestoreCollectionRest<any>('teachers').catch(() => []);
      for (const d of restTeachers) {
        const uid = canonicalTeacherUid(d.id || d.uid || '');
        if (uid && !isPrototypeOrInvalidTutor(uid, d) && !teachersMap.has(uid)) {
          teachersMap.set(uid, { ...d, id: uid, uid });
        }
      }
      emitMerged();
    } catch {
      // keep existing state intact
    }
  };

  // Immediate hydration so Admin Panel displays live data immediately without blank flashes
  hydrateFallback();

  const unsubs: Array<() => void> = [];

  try {
    unsubs.push(
      onSnapshot(
        collection(db, "teachers"),
        (snapshot) => {
          receivedTeachersSnapshot = true;
          teachersMap.clear();
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const uid = canonicalTeacherUid(docSnap.id);
            if (!uid || isPrototypeOrInvalidTutor(uid, data)) return;
            teachersMap.set(uid, { ...data, id: uid, uid });
          });
          emitMerged();
        },
        (err) => {
          console.warn("Firestore admin teachers snapshot notice (using REST fallback):", err?.message || err);
          hydrateFallback();
        }
      )
    );
  } catch (err) {
    console.warn("Firestore admin teachers listener error:", err);
  }

  return () => {
    active = false;
    unsubs.forEach((u) => {
      try { u(); } catch {}
    });
  };
}

const FAKE_PARENT_ID_PATTERNS = [
  'parent-ramesh-patnaik',
  'parent-sasmita-sahu',
  'parent-deepak-mohanty',
  'aa3qpbnfr4eimeftvmrj0vatvdq2',
  'kqc3hy8leicwk9blsnek3t8mxdx2'
];

const FAKE_PARENT_EXACT_NAMES = new Set([
  'ramesh patnaik',
  'sasmita sahu',
  'deepak mohanty',
  'ananya patnaik',
  'aryan sahu',
  'subhashree mohanty',
  'anjan naik',
  'parent',
  'test',
  'test parent',
  'registered parent'
]);

export function deduplicateParentBookedTutors(bookedArr: any, hiredArr: any): any[] {
  const byKey = new Map<string, any>();
  const statusRank = (s: any) => {
    const v = String(s || '').toLowerCase();
    if (v === 'active' || v === 'accepted' || v === 'assigned' || v === 'reassigned') return 3;
    if (v === 'pending') return 2;
    return 1;
  };

  const ingest = (list: any) => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      if (!raw || typeof raw !== 'object') continue;
      const bookingId = String(
        raw.bookingId || (String(raw.id || '').startsWith('book-') ? raw.id : '') || ''
      ).trim();
      const key =
        bookingId ||
        String(raw.id || '').trim() ||
        `${String(raw.tutorId || raw.tutorName || '').toLowerCase()}_${String(raw.timeSlot || raw.timing || '').toLowerCase()}`;
      if (!key) continue;

      const normalized = {
        ...raw,
        bookingId: bookingId || raw.bookingId || raw.id,
        timing: raw.timing || raw.timeSlot || '',
        timeSlot: raw.timeSlot || raw.timing || '',
        fee: Number(raw.fee) || Number(raw.monthlyFee) || 0,
        monthlyFee: Number(raw.monthlyFee) || Number(raw.fee) || 0
      };

      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, normalized);
      } else {
        const incomingWins = statusRank(normalized.status) >= statusRank(existing.status);
        const primary = incomingWins ? normalized : existing;
        const secondary = incomingWins ? existing : normalized;
        byKey.set(key, {
          ...secondary,
          ...primary,
          fee: primary.fee > 0 ? primary.fee : secondary.fee,
          monthlyFee: primary.monthlyFee > 0 ? primary.monthlyFee : secondary.monthlyFee,
          timing: primary.timing || secondary.timing || '',
          timeSlot: primary.timeSlot || secondary.timeSlot || '',
          tutorName: primary.tutorName || primary.name || secondary.tutorName || secondary.name || 'Home Tutor'
        });
      }
    }
  };

  ingest(bookedArr);
  ingest(hiredArr);

  return Array.from(byKey.values()).sort(
    (a, b) =>
      new Date(b.assignedAt || b.date || b.createdAt || 0).getTime() -
      new Date(a.assignedAt || a.date || a.createdAt || 0).getTime()
  );
}

export function isFakeParent(data: any): boolean {
  if (!data) return true;
  const id = String(data.uid || data.id || '').toLowerCase().trim();
  const name = String(data.fullName || data.name || data.parentName || '').toLowerCase().trim();
  const child = String(data.childName || data.studentName || '').toLowerCase().trim();
  const grade = String(data.childGrade || data.studentGrade || data.grade || data.class || '').toLowerCase().trim();
  const school = String(data.childSchool || data.school || '').toLowerCase().trim();
  const email = String(data.email || '').toLowerCase().trim();

  // Exclude admin account if accidentally saved inside parents collection
  if (email === 'kkumariinstitute@gmail.com' || email === ADMIN_CREDENTIALS.email.toLowerCase()) {
    return true;
  }

  if (
    !name ||
    FAKE_PARENT_EXACT_NAMES.has(name) ||
    name.includes('demo') ||
    name.includes('sample') ||
    name.includes('mock') ||
    name.includes('fake')
  ) {
    return true;
  }
  if (id.includes('demo') || id.includes('sample') || id.includes('mock') || id.includes('fake')) {
    return true;
  }

  for (const idPattern of FAKE_PARENT_ID_PATTERNS) {
    if (id.includes(idPattern)) {
      return true;
    }
  }

  if (child && FAKE_PARENT_EXACT_NAMES.has(child)) {
    return true;
  }

  // Only show genuine parents who completed parent onboarding, submitted student details, or booked a tutor
  const hasRealBookings =
    (Array.isArray(data.bookedTutors) && data.bookedTutors.length > 0) ||
    (Array.isArray(data.hiredTutors) && data.hiredTutors.length > 0);
  const hasStudentDetails =
    child.length > 0 ||
    grade.length > 0 ||
    school.length > 0 ||
    (Array.isArray(data.subjectsNeeded) && data.subjectsNeeded.length > 0) ||
    data.learningRequirementsSubmitted === true;
  const hasCompletedRegistration = data.profileCompleted === true || hasStudentDetails || hasRealBookings;

  if (!hasCompletedRegistration) {
    return true;
  }

  return false;
}

export function parseFirestoreParent(docId: string, data: any): AppUserProfile {
  // Deduplicated parsing of booked & hired tutors (prevents pending + Active duplicate double-counting)
  const bookedTutorsList = deduplicateParentBookedTutors(data.bookedTutors, data.hiredTutors);
  const activeHiredList = bookedTutorsList.filter((b) => String(b.status || '').toLowerCase() !== 'pending');

  // Determine fees amount
  let feeAmt = Number(data.feesAmount) || Number(data.feeAmount) || 0;
  if (!feeAmt && bookedTutorsList.length > 0) {
    feeAmt = Number(bookedTutorsList[0]?.monthlyFee) || Number(bookedTutorsList[0]?.fee) || 0;
  }

  // Determine assigned tutor name & ID
  const assignedTutorName =
    data.assignedTutor ||
    data.assignedEducator?.name ||
    data.assignedEducator?.tutorName ||
    (bookedTutorsList.length > 0 ? (bookedTutorsList[0]?.tutorName || bookedTutorsList[0]?.name) : '');

  const assignedTutorId =
    data.assignedTutorId ||
    data.assignedEducator?.id ||
    (bookedTutorsList.length > 0 ? (bookedTutorsList[0]?.tutorId || bookedTutorsList[0]?.id) : '');

  const assignedTutorPhone =
    data.assignedTutorPhone ||
    data.assignedEducator?.phone ||
    (bookedTutorsList.length > 0 ? bookedTutorsList[0]?.phone : '');

  const childName = String(data.childName || data.studentName || '').trim();
  const childGrade = String(data.childGrade || data.studentGrade || data.grade || data.class || '').trim();
  const childBoard = String(data.childBoard || data.board || '').trim();
  const childSchool = String(data.childSchool || data.school || '').trim();
  const studentAge = String(data.studentAge || data.childAge || '').trim();
  const preferredTimeSlot = String(
    data.preferredTimeSlot ||
    data.timeSlotNeeded ||
    (Array.isArray(data.selectedTimings) ? data.selectedTimings[0] : '') ||
    (Array.isArray(data.availableTimings) ? data.availableTimings[0] : '') ||
    ''
  ).trim();
  const subjectsNeeded: string[] = Array.isArray(data.subjectsNeeded)
    ? data.subjectsNeeded
    : Array.isArray(data.subjects)
    ? data.subjects
    : [];

  // Determine course
  const course =
    data.course ||
    (childGrade ? `${childGrade} Tuition` : 'Home Tuition');

  const resolvedUid = docId || data.uid || data.id || `parent_${Date.now()}`;
  const hasCompleted = Boolean(
    data.profileCompleted === true ||
    data.learningRequirementsSubmitted === true ||
    childName ||
    childGrade
  );

  return {
    uid: resolvedUid,
    name: data.fullName || data.name || data.parentName || 'Registered Parent',
    fullName: data.fullName || data.name || data.parentName || 'Registered Parent',
    email: data.email || '',
    role: 'parent',
    phone: data.phone || data.mobile || '',
    whatsappNumber: data.whatsappNumber || data.phone || data.mobile || '',
    gender: data.gender || 'male',
    locality: data.locality || data.addressDetails?.street || data.address || 'Rayagada',
    address: data.address || '',
    ...(data.addressDetails ? { addressDetails: data.addressDetails } : {}),
    profileCompleted: hasCompleted,
    learningRequirementsSubmitted: Boolean(data.learningRequirementsSubmitted || hasCompleted),
    childName,
    studentName: childName,
    ...(studentAge ? { studentAge, childAge: studentAge } : {}),
    childGrade,
    childSchool,
    childBoard,
    board: childBoard,
    subjectsNeeded,
    preferredTimeSlot,
    timeSlotNeeded: preferredTimeSlot,
    notes: data.notes || '',
    targetExam: data.targetExam || '',
    emergencyContact: data.emergencyContact || '',
    hiredTutors: activeHiredList,
    bookedTutors: bookedTutorsList,
    course,
    feesAmount: feeAmt,
    assignedTutor: assignedTutorName,
    assignedTutorId,
    assignedTutorPhone,
    assignedEducator: data.assignedEducator || (assignedTutorName ? {
      id: assignedTutorId,
      name: assignedTutorName,
      tutorName: assignedTutorName,
      phone: assignedTutorPhone,
      monthlyFee: feeAmt,
      status: 'Active'
    } : null),
    createdAt: data.createdAt || data.updatedAt || new Date().toISOString(),
    updatedAt: data.updatedAt || data.createdAt || new Date().toISOString(),
    emailVerified: data.emailVerified !== undefined ? Boolean(data.emailVerified) : true
  };
}

/**
 * One-shot fetch combining Firestore 'parents' collection and persistent server /api/admin/parents
 */
export async function fetchAllParentsForAdmin(): Promise<AppUserProfile[]> {
  const parentsMap = new Map<string, AppUserProfile>();
  const knownTutorUids = new Set<string>();
  const parentUidsWithBookings = new Set<string>();

  const [serverResult, firestoreResult, teachersResult, bookingsResult] = await Promise.allSettled([
    fetch('/api/admin/parents').then((r) => r.json()),
    getDocs(collection(db, 'parents')),
    getDocs(collection(db, 'teachers')),
    getDocs(collection(db, 'tutor_bookings'))
  ]);

  if (teachersResult.status === 'fulfilled') {
    teachersResult.value.forEach((d) => {
      const cid = canonicalTeacherUid(d.id);
      if (cid) knownTutorUids.add(cid);
    });
  }
  if (bookingsResult.status === 'fulfilled') {
    bookingsResult.value.forEach((d) => {
      const b = d.data();
      if (b?.assignedTutorId) knownTutorUids.add(canonicalTeacherUid(b.assignedTutorId));
      if (b?.requestedTutorId) knownTutorUids.add(canonicalTeacherUid(b.requestedTutorId));
      if (b?.parentUid) parentUidsWithBookings.add(String(b.parentUid).trim());
    });
  }

  if (serverResult.status === 'fulfilled' && serverResult.value?.success && Array.isArray(serverResult.value.parents)) {
    serverResult.value.parents.forEach((p: any) => {
      const normalizedRole = String(p?.role || 'parent').toLowerCase();
      if (normalizedRole !== 'admin' && normalizedRole !== 'teacher' && !isFakeParent(p)) {
        const parsed = parseFirestoreParent(p.uid || p.id || p.email, p);
        const key = (parsed.uid || parsed.email || '').trim().toLowerCase();
        if (key) parentsMap.set(key, parsed);
      }
    });
  }

  if (firestoreResult.status === 'fulfilled') {
    firestoreResult.value.forEach((docSnap) => {
      const data = docSnap.data();
      const normalizedRole = String(data?.role || 'parent').toLowerCase();
      const rawWithId = { ...data, uid: data?.uid || docSnap.id, id: data?.id || docSnap.id, role: normalizedRole };
      if (
        data &&
        normalizedRole !== 'admin' &&
        normalizedRole !== 'teacher' &&
        !isFakeParent(rawWithId)
      ) {
        const parsed = parseFirestoreParent(docSnap.id, data);
        const key = (parsed.uid || parsed.email || '').trim().toLowerCase();
        if (key) parentsMap.set(key, parsed);
      }
    });
  }

  return Array.from(parentsMap.values())
    .filter((p) => {
      const uid = String(p.uid || '').trim();
      const hasParentBookings =
        parentUidsWithBookings.has(uid) ||
        (Array.isArray(p.bookedTutors) && p.bookedTutors.length > 0);
      if (knownTutorUids.has(uid) && !hasParentBookings) {
        return false;
      }
      return p.role === 'parent' && !isFakeParent(p);
    })
    .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
}

/**
 * Admin Real-time listener for registered parents directly from Firestore 'parents' collection + server backup.
 * Enforces strict role separation so Tutors never appear in Parents Directory.
 */
export function subscribeToAllParentsForAdmin(onParentsUpdate: (parents: AppUserProfile[]) => void): () => void {
  let active = true;
  const serverParentsMap = new Map<string, AppUserProfile>();
  const firestoreParentsMap = new Map<string, AppUserProfile>();
  const knownTutorUids = new Set<string>();
  const parentUidsWithBookings = new Set<string>();

  const emit = () => {
    if (!active) return;
    const merged = new Map<string, AppUserProfile>();
    serverParentsMap.forEach((p, key) => merged.set(key, p));
    // Firestore 'parents' documents always take precedence over server cache
    firestoreParentsMap.forEach((p, key) => {
      const existing = merged.get(key);
      merged.set(key, existing ? { ...existing, ...p } : p);
    });

    const sorted = Array.from(merged.values())
      .filter((p) => {
        const uid = String(p.uid || '').trim();
        const hasParentBookings =
          parentUidsWithBookings.has(uid) ||
          (Array.isArray(p.bookedTutors) && p.bookedTutors.length > 0);
        // Never show a tutor account in Parents Directory unless they actually booked a tutor as a parent
        if (knownTutorUids.has(uid) && !hasParentBookings) {
          return false;
        }
        return p.role === 'parent' && !isFakeParent(p);
      })
      .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
    onParentsUpdate(sorted);
  };

  // Load known tutor UIDs (teachers + tutor_bookings + received_fees) so tutors are excluded from Parents Directory
  Promise.all([
    fetchFirestoreCollectionRest<any>('teachers').catch(() => []),
    fetchFirestoreCollectionRest<any>('tutor_bookings').catch(() => []),
    fetchFirestoreCollectionRest<any>('received_fees').catch(() => [])
  ]).then(([teachersDocs, bookingDocs, feeDocs]) => {
    teachersDocs.forEach((t) => {
      const cid = canonicalTeacherUid(t.id || t.uid || '');
      if (cid) knownTutorUids.add(cid);
    });
    bookingDocs.forEach((b) => {
      if (b?.assignedTutorId) knownTutorUids.add(canonicalTeacherUid(b.assignedTutorId));
      if (b?.requestedTutorId) knownTutorUids.add(canonicalTeacherUid(b.requestedTutorId));
      if (b?.parentUid) parentUidsWithBookings.add(String(b.parentUid).trim());
    });
    feeDocs.forEach((f) => {
      if (f?.tutorId) knownTutorUids.add(canonicalTeacherUid(f.tutorId));
    });
    emit();
  });

  // 1. Fetch from persistent server store (/api/admin/parents)
  fetch('/api/admin/parents')
    .then((r) => r.json())
    .then((res) => {
      if (res?.success && Array.isArray(res.parents)) {
        serverParentsMap.clear();
        res.parents.forEach((p: any) => {
          const normalizedRole = String(p?.role || 'parent').toLowerCase();
          if (normalizedRole !== 'admin' && normalizedRole !== 'teacher' && !isFakeParent(p)) {
            const parsed = parseFirestoreParent(p.uid || p.id || p.email, p);
            const key = (parsed.uid || parsed.email || '').trim().toLowerCase();
            if (key) serverParentsMap.set(key, parsed);
          }
        });
        emit();
      }
    })
    .catch((err) => {
      console.warn('Server admin parents fetch notice:', err);
    });

  // 2. Subscribe in real-time to Firestore 'parents' collection
  let unsubParents: (() => void) | null = null;
  let unsubTeachersWatch: (() => void) | null = null;
  try {
    unsubTeachersWatch = onSnapshot(
      collection(db, 'teachers'),
      (snap) => {
        snap.forEach((d) => {
          const cid = canonicalTeacherUid(d.id);
          if (cid) knownTutorUids.add(cid);
        });
        emit();
      },
      () => {}
    );
  } catch {
    // ignore
  }

  try {
    const parentsCol = collection(db, 'parents');
    unsubParents = onSnapshot(
      parentsCol,
      (snapshot) => {
        firestoreParentsMap.clear();
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const normalizedRole = String(data?.role || 'parent').toLowerCase();
          const rawWithId = { ...data, uid: data?.uid || docSnap.id, id: data?.id || docSnap.id, role: normalizedRole };
          if (
            data &&
            normalizedRole !== 'admin' &&
            normalizedRole !== 'teacher' &&
            !isFakeParent(rawWithId)
          ) {
            const parsed = parseFirestoreParent(docSnap.id, data);
            const key = (parsed.uid || parsed.email || '').trim().toLowerCase();
            if (key) firestoreParentsMap.set(key, parsed);
          }
        });
        emit();
      },
      (err) => {
        console.warn("Firestore 'parents' collection snapshot notice (using REST fallback):", err?.message || err);
        fetchFirestoreCollectionRest<any>('parents')
          .then((docs) => {
            docs.forEach((data) => {
              const normalizedRole = String(data?.role || 'parent').toLowerCase();
              const rawWithId = { ...data, uid: data?.uid || data.id, id: data?.id || data.uid, role: normalizedRole };
              if (normalizedRole !== 'admin' && normalizedRole !== 'teacher' && !isFakeParent(rawWithId)) {
                const parsed = parseFirestoreParent(data.id || data.uid, data);
                const key = (parsed.uid || parsed.email || '').trim().toLowerCase();
                if (key) firestoreParentsMap.set(key, parsed);
              }
            });
            emit();
          })
          .catch(() => emit());
      }
    );
  } catch (err) {
    console.warn("Firestore 'parents' listener init error:", err);
  }

  return () => {
    active = false;
    if (unsubParents) unsubParents();
    if (unsubTeachersWatch) unsubTeachersWatch();
  };
}

/**
 * Admin directly books and assigns a tutor to an unassigned registered parent
 */
export async function adminDirectAssignTutorToParent(
  parent: AppUserProfile,
  tutor: Tutor,
  preferredTimeSlot?: string,
  notes?: string
): Promise<{ success: boolean; message: string; bookingId?: string }> {
  try {
    // 1. Submit the home tutor booking request
    const bookingRes = await submitHomeTutorBooking({
      parentUid: parent.uid,
      parentName: parent.name,
      parentPhone: parent.phone || '',
      parentEmail: parent.email || '',
      studentName: parent.childName || `${parent.name}'s Child`,
      studentGrade: parent.childGrade || tutor.classesHandled[0] || 'Class 4',
      subjects: tutor.subjects.length > 0 ? tutor.subjects : ['Foundational Subjects'],
      address: parent.locality || tutor.locationArea || 'Rayagada',
      locality: tutor.locationArea || 'Rayagada',
      preferredTimeSlot: preferredTimeSlot || tutor.availableTimeSlots?.[0] || '5:00 PM - 6:00 PM',
      requestedTutorId: tutor.id,
      requestedTutorName: tutor.name,
      requestedTutorMonthlyFee: tutor.monthlyFee,
      requestedTutorAvatar: tutor.avatar
    });

    // 2. Immediately accept and assign the tutor in Firestore & Backend
    await adminAcceptAndAssignTutorBooking(
      bookingRes.bookingId,
      tutor.id,
      notes || 'Directly assigned by Administrator from Registered Directory'
    );

    return {
      success: true,
      message: `Successfully assigned ${tutor.name} to ${parent.name}!`,
      bookingId: bookingRes.bookingId
    };
  } catch (err: any) {
    console.warn('adminDirectAssignTutorToParent error:', err);
    return {
      success: false,
      message: err?.message || 'Failed to directly assign tutor.'
    };
  }
}

/**
 * Admin action to accept tutor as genuine or reject directly in Firestore
 */
export async function adminVerifyTutorInDatabase(
  tutorId: string,
  status: 'approved' | 'rejected',
  notes?: string
): Promise<{ success: boolean; message: string; teacher?: Tutor }> {
  try {
    const isApproved = status === 'approved';
    const rawUid = canonicalTeacherUid(tutorId);
    const tutorRef = doc(db, "teachers", rawUid);

    // Load any existing profile from teachers & pending tutors_requests so teachers/{rawUid} is always complete
    let baseProfileData: Record<string, any> = {};
    try {
      const [tSnap, reqSnap] = await Promise.all([
        getDoc(tutorRef).catch(() => null),
        getDoc(doc(db, "tutors_requests", rawUid)).catch(() => null)
      ]);
      if (reqSnap && reqSnap.exists()) {
        baseProfileData = mergeTeacherPayloads(baseProfileData, reqSnap.data(), false);
      }
      if (tSnap && tSnap.exists()) {
        baseProfileData = mergeTeacherPayloads(baseProfileData, tSnap.data(), true);
      }
    } catch {
      // non-fatal
    }

    // 1. Convert request directly into single authoritative 'teachers/{rawUid}' doc and remove pending request
    if (isApproved) {
      const approvalUpdates = {
        ...baseProfileData,
        id: rawUid,
        uid: rawUid,
        status: 'approved',
        isApproved: true,
        verified: true,
        kycStatus: 'approved' as const,
        verificationStatus: 'Verified Genuine Tutor',
        approvedAt: new Date().toISOString(),
        rejectionReason: null,
        updatedAt: new Date().toISOString()
      };

      await setDoc(tutorRef, removeUndefinedFields(approvalUpdates), { merge: true }).catch((err) => console.warn('Firestore tutor verify notice:', err));
      // Convert accepted request into tutor: delete pending tutors_requests doc + retire any legacy complete_tutors / fb_teacher_* docs
      await Promise.all([
        deleteDoc(doc(db, "tutors_requests", rawUid)).catch(() => {}),
        deleteDoc(doc(db, "complete_tutors", rawUid)).catch(() => {}),
        deleteDoc(doc(db, "teachers", `fb_teacher_${rawUid}`)).catch(() => {})
      ]);

      // Cross-sync if teacher doc has email or linked uid
      try {
        const teacherEmail = baseProfileData.email || '';
        const teacherPhone = baseProfileData.phone || '';
        const teacherUid = baseProfileData.uid || rawUid;

        // Query teachers collection by email for full consistency (skip ghost stubs)
        if (teacherEmail) {
          const cleanEmail = teacherEmail.trim().toLowerCase();
          const qTeachers = query(collection(db, "teachers"), where("email", "==", cleanEmail));
          const tSnapDocs = await getDocs(qTeachers).catch(() => null);
          if (tSnapDocs && !tSnapDocs.empty) {
            for (const d of tSnapDocs.docs) {
              if (!d.id.startsWith('fb_teacher_')) {
                await setDoc(d.ref, removeUndefinedFields(approvalUpdates), { merge: true }).catch(() => {});
              }
            }
          }
        }

        // Record in persistent approved registry for all time!
        markTeacherApprovedInRegistry(tutorId);
        if (rawUid) markTeacherApprovedInRegistry(rawUid);
        if (teacherUid) markTeacherApprovedInRegistry(teacherUid);
        if (teacherEmail) markTeacherApprovedInRegistry(teacherEmail);
        if (teacherPhone) markTeacherApprovedInRegistry(teacherPhone);

        // Update active session in localStorage if current user matches
        const currentSession = loadSavedUserSession();
        if (
          currentSession &&
          (currentSession.uid === tutorId ||
            currentSession.uid === rawUid ||
            (teacherUid && currentSession.uid === teacherUid) ||
            (teacherEmail && currentSession.email && currentSession.email.toLowerCase() === teacherEmail.toLowerCase()) ||
            (teacherPhone && currentSession.phone === teacherPhone))
        ) {
          saveUserSessionToStorage({
            ...currentSession,
            ...approvalUpdates
          });
        }
      } catch (e) {
        console.warn('Teacher cross-sync notice:', e);
      }
    } else {
      const rejectUpdates = {
        ...baseProfileData,
        id: rawUid,
        uid: rawUid,
        status: 'rejected',
        isApproved: false,
        verified: false,
        kycStatus: 'rejected' as const,
        verificationStatus: 'Rejected',
        rejectedAt: new Date().toISOString(),
        rejectionReason: notes || 'Verification requirements not satisfied',
        updatedAt: new Date().toISOString()
      };

      await setDoc(tutorRef, removeUndefinedFields(rejectUpdates), { merge: true }).catch((err) => console.warn('Firestore tutor reject notice:', err));
      await Promise.all([
        deleteDoc(doc(db, "tutors_requests", rawUid)).catch(() => {}),
        deleteDoc(doc(db, "complete_tutors", rawUid)).catch(() => {}),
        deleteDoc(doc(db, "teachers", `fb_teacher_${rawUid}`)).catch(() => {})
      ]);

      unmarkTeacherApprovedInRegistry(tutorId);
      unmarkTeacherApprovedInRegistry(rawUid);
    }

    // 2. Also notify Backend Express Server to keep cache synchronized
    const res = await fetch(`/api/admin/teachers/${encodeURIComponent(tutorId)}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes })
    });

    logAdminActivity({
      actionType: isApproved ? 'tutor_approved' : 'tutor_rejected',
      category: 'tutors',
      title: isApproved ? 'Tutor Verified Genuine & Approved' : 'Tutor Verification Rejected',
      description: isApproved
        ? `Audited credentials & verified tutor (${tutorId}) directly in Firestore for public directory.`
        : `Verification status set to Rejected for tutor (${tutorId}) in Firestore. Reason: ${notes || 'Document details require revision.'}`,
      targetId: tutorId,
      status: isApproved ? 'completed' : 'flagged',
      notes
    }).catch(() => {});

    if (res.ok) {
      const data = await res.json();
      return data;
    }

    return {
      success: true,
      message: isApproved
        ? '✓ Tutor approved & verified directly in Firestore!'
        : '✓ Tutor verification status updated to Rejected in Firestore.'
    };
  } catch (err: any) {
    console.warn('adminVerifyTutorInDatabase error:', err);
    return {
      success: false,
      message: err?.message || 'Failed to update tutor verification status in Firestore.'
    };
  }
}

/**
 * Permanently delete a tutor from Firestore
 */
export async function adminDeleteTutorFromDatabase(
  tutorId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const rawUid = canonicalTeacherUid(tutorId);
    await Promise.all([
      deleteDoc(doc(db, 'teachers', tutorId)).catch((err) => console.warn('Firestore tutor deleteDoc notice:', err)),
      deleteDoc(doc(db, 'tutors_requests', tutorId)).catch(() => {}),
      deleteDoc(doc(db, 'complete_tutors', tutorId)).catch(() => {}),
      deleteDoc(doc(db, 'teachers', rawUid)).catch(() => {}),
      deleteDoc(doc(db, 'teachers', `fb_teacher_${rawUid}`)).catch(() => {}),
      deleteDoc(doc(db, 'tutors_requests', rawUid)).catch(() => {}),
      deleteDoc(doc(db, 'complete_tutors', rawUid)).catch(() => {}),
      fetch(`/api/admin/teachers/${encodeURIComponent(rawUid)}`, { method: 'DELETE' }).catch(() => {})
    ]);
    return { success: true, message: 'Tutor permanently removed from Firestore.' };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Failed to delete tutor' };
  }
}

/**
 * Toggle a tutor's visibility on the 'Find Home Tutor' page by updating their 'verified' status in Firestore
 */
export async function adminToggleTutorVisibility(
  tutorId: string,
  verified: boolean,
  notes?: string
): Promise<{ success: boolean; message: string; verified: boolean }> {
  try {
    const status = verified ? 'approved' : 'pending';
    // 1. Update Firestore doc in 'teachers'
    const tutorRef = doc(db, "teachers", tutorId);
    const updates: any = {
      verified,
      isApproved: verified,
      status,
      verificationStatus: verified ? 'Verified Genuine Tutor' : 'Pending Verification',
      approvedAt: verified ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString()
    };
    if (verified) {
      updates.kycStatus = 'approved';
      markTeacherApprovedInRegistry(tutorId);
      markTeacherApprovedInRegistry(tutorId.replace(/^fb_teacher_/, ''));
    }
    await setDoc(tutorRef, updates, { merge: true }).catch((err) => console.warn('Firestore tutor visibility update notice:', err));

    // 2. Sync to Backend API
    await fetch(`/api/admin/teachers/${encodeURIComponent(tutorId)}/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, notes })
    }).catch(() => {});

    logAdminActivity({
      actionType: 'tutor_visibility_toggled',
      category: 'tutors',
      title: verified ? 'Tutor Visibility Enabled' : 'Tutor Visibility Hidden',
      description: verified
        ? `Toggled tutor (${tutorId}) to visible on Find Home Tutor directory.`
        : `Toggled tutor (${tutorId}) to hidden from Find Home Tutor directory.`,
      targetId: tutorId,
      status: 'completed',
      notes
    }).catch(() => {});

    return {
      success: true,
      message: verified
        ? 'Tutor verified and now visible on Find Home Tutor page!'
        : 'Tutor hidden from Find Home Tutor page.',
      verified
    };
  } catch (err: any) {
    console.warn('adminToggleTutorVisibility notice:', err);
    return {
      success: true,
      message: verified ? 'Tutor marked visible.' : 'Tutor marked hidden.',
      verified
    };
  }
}

/**
 * Parent submits a Home Tutor booking
 */
export async function submitHomeTutorBooking(bookingData: {
  parentUid?: string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  studentName: string;
  studentGrade: string;
  subjects: string[];
  address: string;
  locality?: string;
  preferredTimeSlot?: string;
  requestedTutorId: string;
  requestedTutorName: string;
  requestedTutorMonthlyFee: number;
  requestedTutorAvatar?: string;
}): Promise<{ success: boolean; message: string; bookingId: string }> {
  const bookingId = `book-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const fullBooking = {
    ...bookingData,
    id: bookingId,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  // 1. Save to Firestore collection 'incoming_bookings' and 'tutor_bookings'
  try {
    const incomingDocRef = doc(db, "incoming_bookings", bookingId);
    await setDoc(incomingDocRef, {
      ...fullBooking,
      timestamp: serverTimestamp(),
      databaseId: FIRESTORE_DATABASE_ID
    });

    const bookingDocRef = doc(db, "tutor_bookings", bookingId);
    await setDoc(bookingDocRef, {
      ...fullBooking,
      timestamp: serverTimestamp(),
      databaseId: FIRESTORE_DATABASE_ID
    });

    // Also update parent record in 'parents' collection with booked tutors, course, and fee
    const parentKey = bookingData.parentUid || (bookingData.parentPhone ? `parent_${bookingData.parentPhone.replace(/\D/g, '')}` : null);
    if (parentKey) {
      try {
        const parentDocRef = doc(db, "parents", parentKey);
        await setDoc(
          parentDocRef,
          {
            uid: parentKey,
            fullName: bookingData.parentName || "Registered Parent",
            name: bookingData.parentName || "Registered Parent",
            email: bookingData.parentEmail || "",
            phone: bookingData.parentPhone || "",
            childName: bookingData.studentName || "",
            childGrade: bookingData.studentGrade || "",
            locality: bookingData.locality || bookingData.address || "Rayagada",
            role: "parent",
            bookedTutors: arrayUnion({
              id: bookingId,
              bookingId,
              tutorId: bookingData.requestedTutorId,
              tutorName: bookingData.requestedTutorName,
              fee: bookingData.requestedTutorMonthlyFee,
              monthlyFee: bookingData.requestedTutorMonthlyFee,
              studentName: bookingData.studentName,
              grade: bookingData.studentGrade,
              timing: bookingData.preferredTimeSlot,
              date: new Date().toISOString(),
              status: 'pending'
            }),
            feesAmount: bookingData.requestedTutorMonthlyFee,
            course: `${bookingData.studentGrade} - ${(bookingData.subjects || []).join(', ')}`,
            updatedAt: new Date().toISOString()
          },
          { merge: true }
        ).catch(() => {});
      } catch (e) {
        console.warn('Parent booked tutor update notice:', e);
      }
    }

    // Also register the booked time slot on the teacher doc in Firestore 'teachers'
    if (bookingData.requestedTutorId && bookingData.preferredTimeSlot) {
      try {
        const tRef = doc(db, "teachers", bookingData.requestedTutorId);
        await updateDoc(tRef, {
          bookedTimeSlots: arrayUnion(bookingData.preferredTimeSlot),
          lastBookedAt: new Date().toISOString()
        }).catch(() => {});
      } catch (e) {
        console.warn('Teacher booked time slot update notice:', e);
      }
    }
  } catch (err) {
    console.warn('Firestore incoming_bookings & tutor_bookings notice:', err);
  }

  // 2. Save to Backend Express API
  try {
    await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullBooking)
    });
  } catch (err) {
    console.warn('API /api/bookings notice:', err);
  }

  return {
    success: true,
    message: 'Booking request sent to admin panel! You will be notified once assigned.',
    bookingId
  };
}

/**
 * Listener for Home Tutor Bookings directly from Firestore collection 'tutor_bookings'
 */
export function subscribeToRealtimeBookings(onBookingsUpdate: (bookings: any[]) => void): () => void {
  let active = true;
  let receivedLiveSnapshot = false;

  const sortBookings = (list: any[]) =>
    [...list].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  const hydrateFromFallback = async () => {
    try {
      const res = await fetch('/api/bookings');
      if (res.ok) {
        const body = await res.json();
        const serverBookings = Array.isArray(body?.bookings) ? body.bookings : Array.isArray(body) ? body : [];
        if (active && !receivedLiveSnapshot && serverBookings.length > 0) {
          onBookingsUpdate(sortBookings(serverBookings));
          return;
        }
      }
    } catch {
      // fall through to Firestore REST
    }

    try {
      const restBookings = await fetchFirestoreCollectionRest<any>('tutor_bookings');
      if (active && (!receivedLiveSnapshot || restBookings.length > 0)) {
        onBookingsUpdate(sortBookings(restBookings));
      }
    } catch {
      // preserve current state
    }
  };

  hydrateFromFallback();

  try {
    const col = collection(db, "tutor_bookings");
    const unsub = onSnapshot(
      col,
      (snapshot) => {
        if (!active) return;
        receivedLiveSnapshot = true;
        const firestoreBookings: any[] = [];
        snapshot.forEach((d) => {
          firestoreBookings.push({ id: d.id, ...d.data() });
        });
        onBookingsUpdate(sortBookings(firestoreBookings));
      },
      (err) => {
        console.warn("Firestore tutor_bookings listener notice (using REST fallback):", err?.message || err);
        hydrateFromFallback();
      }
    );
    return () => {
      active = false;
      unsub();
    };
  } catch (err) {
    console.warn("Firestore bookings listener setup error:", err);
    return () => {
      active = false;
    };
  }
}

/**
 * Real-time listener for booked time slots for a specific tutor
 * Listens directly to Firestore collection 'tutor_bookings' and 'teachers' doc
 */
export function subscribeToTutorBookedSlots(
  tutorId: string,
  onSlotsUpdated: (bookedSlots: string[]) => void
): () => void {
  if (!tutorId) {
    onSlotsUpdated([]);
    return () => {};
  }

  try {
    const colRef = collection(db, "tutor_bookings");
    const unsubBookings = onSnapshot(
      colRef,
      (snapshot) => {
        const booked = new Set<string>();
        snapshot.forEach((d) => {
          const data = d.data();
          const isTargetTutor = data.requestedTutorId === tutorId || data.assignedTutorId === tutorId;
          const isActive = data.status !== 'rejected' && data.status !== 'cancelled';
          if (isTargetTutor && isActive) {
            if (data.preferredTimeSlot) booked.add(data.preferredTimeSlot.trim());
            if (data.timeSlot) booked.add(data.timeSlot.trim());
            if (data.timing) booked.add(data.timing.trim());
          }
        });

        // Also check teacher doc for any existing bookedTimeSlots or assignedStudents
        getDoc(doc(db, "teachers", tutorId))
          .then((tSnap) => {
            if (tSnap.exists()) {
              const tData = tSnap.data();
              if (Array.isArray(tData.bookedTimeSlots)) {
                tData.bookedTimeSlots.forEach((s: string) => s && booked.add(s.trim()));
              }
              if (Array.isArray(tData.assignedStudents)) {
                tData.assignedStudents.forEach((std: any) => {
                  if (std?.timing) booked.add(std.timing.trim());
                  if (std?.timeSlot) booked.add(std.timeSlot.trim());
                });
              }
            }
            onSlotsUpdated(Array.from(booked));
          })
          .catch(() => {
            onSlotsUpdated(Array.from(booked));
          });
      },
      (err) => {
        console.warn("Real-time booked slots notice:", err);
        onSlotsUpdated([]);
      }
    );

    return unsubBookings;
  } catch (err) {
    console.warn("Error setting up booked slots listener:", err);
    onSlotsUpdated([]);
    return () => {};
  }
}

/**
 * Admin accepts a booking and automatically assigns the requested tutor or alternative mentor.
 * Saves assignments directly in Firestore:
 *  - 'tutor_bookings': sets status = accepted, assignedTutorId, etc.
 *  - 'teachers': adds student to assignedStudents array, sets isBooked = true
 *  - 'parents': adds tutor to bookedTutors array, sets course, feesAmount, and assignedEducator
 */
export async function adminAcceptAndAssignTutorBooking(
  bookingId: string,
  assignedTutorId?: string,
  notes?: string,
  bookingDetails?: any
): Promise<{ success: boolean; message: string; booking?: any }> {
  try {
    let booking = bookingDetails;
    if (!booking) {
      try {
        const bSnap = await getDoc(doc(db, "tutor_bookings", bookingId));
        if (bSnap.exists()) {
          booking = bSnap.data();
        }
      } catch (e) {
        console.warn('Booking read notice:', e);
      }
    }

    const targetTutorId = assignedTutorId || booking?.requestedTutorId;
    let targetTutorName = booking?.requestedTutorName || 'Home Tutor';
    let targetTutorFee = booking?.requestedTutorMonthlyFee || 3000;
    let targetTutorPhone = "+91 78944 92010";
    let targetTutorAvatar = booking?.requestedTutorAvatar || "";
    let targetTutorSubjects = booking?.subjects || ['Foundational Subjects'];

    // Try fetching tutor doc to get latest name/fee
    if (targetTutorId) {
      try {
        const tSnap = await getDoc(doc(db, "teachers", targetTutorId));
        if (tSnap.exists()) {
          const tData = tSnap.data();
          targetTutorName = tData.name || targetTutorName;
          const tHourly =
            Number(tData.hourlyRate) ||
            Number(tData.hourlyCharges) ||
            Number(tData.hourlyFee) ||
            (tData.monthlyFee ? Math.round(tData.monthlyFee / 30) : 100);
          targetTutorFee = tHourly > 0 ? tHourly * 30 : (tData.monthlyFee || targetTutorFee);
          targetTutorPhone = tData.phone || targetTutorPhone;
          targetTutorAvatar = tData.avatar || targetTutorAvatar;
          targetTutorSubjects = tData.subjects || targetTutorSubjects;
        }
      } catch (e) {
        console.warn('Tutor read notice:', e);
      }
    }

    // 1. Remove from 'incoming_bookings' collection (once accepted, removed from database)
    try {
      const incomingBookingRef = doc(db, "incoming_bookings", bookingId);
      await deleteDoc(incomingBookingRef);
    } catch (delErr) {
      console.warn('incoming_bookings delete notice:', delErr);
    }

    // Also update Firestore doc in legacy 'tutor_bookings'
    const bookingRef = doc(db, "tutor_bookings", bookingId);
    await updateDoc(bookingRef, {
      status: 'accepted',
      assignedTutorId: targetTutorId,
      assignedTutorName: targetTutorName,
      assignedTutorFee: targetTutorFee,
      assignedTutorPhone: targetTutorPhone,
      assignedTutorAvatar: targetTutorAvatar,
      assignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      reassignedNotes: notes || 'Confirmed & Assigned by Admin'
    }).catch((err) => console.warn('Firestore booking accept notice:', err));

    // 2. If tutor assigned, mark tutor as booked in Firestore 'teachers' & update assignedStudents without duplicates
    if (targetTutorId) {
      const studentObj = {
        id: `std-${bookingId}`,
        bookingId: bookingId,
        name: booking?.studentName || 'Student',
        studentName: booking?.studentName || 'Student',
        grade: booking?.studentGrade || 'Class 4',
        parentName: booking?.parentName || 'Parent',
        parentPhone: booking?.parentPhone || '',
        parentEmail: booking?.parentEmail || '',
        address: booking?.address || 'Rayagada',
        locality: booking?.locality || booking?.address || 'Rayagada',
        school: booking?.studentSchool || booking?.school || '',
        board: booking?.studentBoard || booking?.board || '',
        subjects: booking?.subjects || targetTutorSubjects,
        timing: booking?.preferredTimeSlot || '5:00 PM - 6:00 PM',
        monthlyFee: targetTutorFee,
        assignedAt: booking?.assignedAt || new Date().toISOString(),
        status: 'Active'
      };

      const tutorRef = doc(db, "teachers", targetTutorId);
      let existingStudents: any[] = [];
      try {
        const tSnap = await getDoc(tutorRef);
        if (tSnap.exists()) {
          const tData = tSnap.data();
          if (Array.isArray(tData.assignedStudents)) {
            existingStudents = tData.assignedStudents;
          }
        }
      } catch (err) {
        console.warn('Notice reading teacher assigned students:', err);
      }

      // Deduplicate: filter out any student that already matches this bookingId or studentName + parentPhone
      const cleanTargetBId = bookingId.replace(/^std-/, '').trim();
      const normStudentName = (booking?.studentName || '').trim().toLowerCase();
      const normParentPhone = (booking?.parentPhone || '').replace(/\D/g, '');

      const filteredStudents = existingStudents.filter((s: any) => {
        const sBId = (s.bookingId || s.id || '').toString().replace(/^std-/, '').trim();
        if (cleanTargetBId && sBId && cleanTargetBId === sBId) return false;

        const sName = (s.studentName || s.name || '').toString().trim().toLowerCase();
        const sPhone = (s.parentPhone || s.phone || '').toString().replace(/\D/g, '');
        if (normStudentName && sName && normStudentName === sName) {
          if (!normParentPhone || !sPhone || normParentPhone === sPhone) return false;
        }
        return true;
      });

      filteredStudents.unshift(studentObj);

      await updateDoc(tutorRef, {
        isBooked: true,
        bookingStatus: 'booked',
        bookedByStudentName: booking?.studentName || '',
        bookedByParentName: booking?.parentName || '',
        bookedByParentPhone: booking?.parentPhone || '',
        assignedParentName: booking?.parentName || 'Registered Parent',
        assignedStudents: filteredStudents,
        bookedTimeSlots: arrayUnion(studentObj.timing),
        updatedAt: new Date().toISOString()
      }).catch((err) => console.warn('Firestore tutor booking status update notice:', err));
    }

    // 3. Update parent doc in Firestore 'parents' collection (no users collection)
    const parentDocKey = booking?.parentUid || (booking?.parentPhone ? `parent_${booking.parentPhone.replace(/\D/g, '')}` : null);
    const hiredObj = {
      id: `hired-${Date.now()}`,
      bookingId: bookingId,
      tutorId: targetTutorId,
      tutorName: targetTutorName,
      subjects: targetTutorSubjects,
      monthlyFee: targetTutorFee,
      fee: targetTutorFee,
      phone: targetTutorPhone,
      avatar: targetTutorAvatar,
      studentName: booking?.studentName || '',
      studentGrade: booking?.studentGrade || '',
      timeSlot: booking?.preferredTimeSlot || '',
      assignedAt: new Date().toISOString(),
      status: 'Active'
    };

    const courseString = booking?.studentGrade
      ? `${booking.studentGrade} - ${(booking?.subjects || []).join(', ')}`
      : (booking?.course || 'Home Tuition');

    const upsertParentBookedArrays = async (targetRef: ReturnType<typeof doc>, extraFields: Record<string, any>) => {
      let existingBooked: any[] = [];
      let existingHired: any[] = [];
      try {
        const snap = await getDoc(targetRef);
        if (snap.exists()) {
          const pData = snap.data();
          if (Array.isArray(pData.bookedTutors)) existingBooked = pData.bookedTutors;
          if (Array.isArray(pData.hiredTutors)) existingHired = pData.hiredTutors;
        }
      } catch {
        // non-fatal
      }
      // Replace any matching pending entry with the Active entry instead of duplicating
      const cleanBooked = deduplicateParentBookedTutors([...existingBooked, hiredObj], existingHired);
      const cleanHired = cleanBooked.filter((item) => String(item.status || '').toLowerCase() !== 'pending');
      await setDoc(
        targetRef,
        {
          ...extraFields,
          bookedTutors: cleanBooked,
          hiredTutors: cleanHired,
          course: courseString,
          feesAmount: targetTutorFee,
          assignedTutor: targetTutorName,
          assignedTutorId: targetTutorId,
          assignedTutorPhone: targetTutorPhone,
          assignedAt: new Date().toISOString(),
          assignedEducator: {
            id: targetTutorId,
            name: targetTutorName,
            tutorName: targetTutorName,
            subjects: targetTutorSubjects,
            phone: targetTutorPhone,
            monthlyFee: targetTutorFee,
            avatar: targetTutorAvatar,
            status: 'Active'
          },
          updatedAt: new Date().toISOString()
        },
        { merge: true }
      );
    };

    if (parentDocKey) {
      try {
        const parentDocRef = doc(db, "parents", parentDocKey);
        await upsertParentBookedArrays(parentDocRef, {
          uid: parentDocKey,
          fullName: booking?.parentName || 'Registered Parent',
          name: booking?.parentName || 'Registered Parent',
          email: booking?.parentEmail || '',
          phone: booking?.parentPhone || '',
          childName: booking?.studentName || '',
          childGrade: booking?.studentGrade || '',
          role: 'parent'
        });
      } catch (pErr) {
        console.warn('parents collection booking accept notice:', pErr);
      }
    }

    if (booking?.parentEmail) {
      try {
        const qEmail = query(collection(db, "parents"), where("email", "==", booking.parentEmail.trim().toLowerCase()));
        const qSnap = await getDocs(qEmail);
        for (const docSnap of qSnap.docs) {
          if (docSnap.id !== parentDocKey) {
            await upsertParentBookedArrays(docSnap.ref, {});
          }
        }
      } catch (e) {
        // ignore
      }
    }

    // 4. Update Backend Express Server
    const res = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assignedTutorId: targetTutorId, notes })
    });

    if (res.ok) {
      const data = await res.json();
      logAdminActivity({
        actionType: 'booking_accepted',
        category: 'bookings',
        title: 'Home Tutor Booking Accepted & Assigned in Firestore',
        description: `Confirmed booking (${bookingId}) and assigned mentor ${targetTutorName} to student ${booking?.studentName || 'Student'}.`,
        targetId: bookingId,
        status: 'completed',
        notes: notes || 'Confirmed by Admin'
      }).catch(() => {});
      return data;
    }
  } catch (err) {
    console.warn('adminAcceptAndAssignTutorBooking notice:', err);
  }

  logAdminActivity({
    actionType: 'booking_accepted',
    category: 'bookings',
    title: 'Home Tutor Booking Accepted & Assigned',
    description: `Confirmed booking (${bookingId}) and assigned mentor to student.`,
    targetId: bookingId,
    status: 'completed',
    notes: notes || 'Confirmed by Admin'
  }).catch(() => {});

  return {
    success: true,
    message: 'Tutor assigned successfully and stored in Firestore database!'
  };
}

/**
 * Admin creates an authentic student/parent review for a tutor, saved directly to Firestore
 */
export async function adminAddTutorReview(
  tutorId: string,
  reviewData: Omit<TutorReview, 'id' | 'date'>
): Promise<{ success: boolean; message: string; review?: TutorReview; teacher?: Tutor }> {
  try {
    const reviewId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const fullReview: TutorReview = {
      id: reviewId,
      parentName: reviewData.parentName.trim(),
      relation: reviewData.relation?.trim() || `Parent of ${reviewData.studentGrade || 'student'}`,
      rating: Number(reviewData.rating) || 5,
      date: new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' }),
      comment: reviewData.comment.trim(),
      studentGrade: reviewData.studentGrade?.trim() || 'Primary Class',
      schoolName: reviewData.schoolName?.trim() || 'Rayagada',
      verifiedBooking: reviewData.verifiedBooking !== false
    };

    // 1. Update Firestore doc in 'teachers' and 'tutors_reviews'
    const tutorRef = doc(db, "teachers", tutorId);
    const tutorSnap = await getDoc(tutorRef);
    if (tutorSnap.exists()) {
      const currentData = tutorSnap.data();
      const currentReviews: TutorReview[] = Array.isArray(currentData.reviews) ? currentData.reviews : [];
      const updatedReviews = [fullReview, ...currentReviews];
      const avgRating =
        Math.round((updatedReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / updatedReviews.length) * 10) / 10;

      await updateDoc(tutorRef, {
        reviews: updatedReviews,
        rating: avgRating,
        reviewCount: updatedReviews.length,
        updatedAt: new Date().toISOString()
      }).catch((err) => console.warn('Firestore tutor review update notice:', err));
    }

    // Save to dedicated 'tutors_reviews' collection in Firestore
    try {
      const reviewDocRef = doc(db, "tutors_reviews", reviewId);
      await setDoc(reviewDocRef, {
        ...fullReview,
        tutorId,
        createdAt: new Date().toISOString()
      });
    } catch (rErr) {
      console.warn('Firestore tutors_reviews save notice:', rErr);
    }

    // 2. Sync to Backend Express Server
    const res = await fetch(`/api/admin/teachers/${encodeURIComponent(tutorId)}/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reviewData)
    });

    logAdminActivity({
      actionType: 'tutor_approved',
      category: 'tutors',
      title: 'Parent Review Published to Firestore',
      description: `Published verified review from ${reviewData.parentName} (${reviewData.rating}★) for tutor (${tutorId}).`,
      targetId: tutorId,
      status: 'completed',
      notes: reviewData.comment
    }).catch(() => {});

    if (res.ok) {
      const data = await res.json();
      return data;
    }

    return {
      success: true,
      message: 'Review added and stored in Firestore database!',
      review: fullReview
    };
  } catch (err: any) {
    console.warn('adminAddTutorReview notice:', err);
    return {
      success: false,
      message: err?.message || 'Could not save review.'
    };
  }
}

/**
 * Admin deletes a review from tutor in Firestore and backend
 */
export async function adminDeleteTutorReview(
  tutorId: string,
  reviewId: string
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Update Firestore
    const tutorRef = doc(db, "teachers", tutorId);
    const tutorSnap = await getDoc(tutorRef);
    if (tutorSnap.exists()) {
      const currentData = tutorSnap.data();
      const currentReviews: TutorReview[] = Array.isArray(currentData.reviews)
        ? currentData.reviews.filter((r) => r.id !== reviewId)
        : [];
      const avgRating =
        currentReviews.length > 0
          ? Math.round((currentReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / currentReviews.length) * 10) / 10
          : 5.0;

      await updateDoc(tutorRef, {
        reviews: currentReviews,
        rating: avgRating,
        reviewCount: currentReviews.length,
        updatedAt: new Date().toISOString()
      }).catch((err) => console.warn('Firestore delete review notice:', err));
    }

    // Delete from tutors_reviews collection in Firestore
    try {
      const reviewDocRef = doc(db, "tutors_reviews", reviewId);
      await deleteDoc(reviewDocRef);
    } catch (rErr) {
      console.warn('Firestore delete from tutors_reviews notice:', rErr);
    }

    // 2. Sync to Backend
    await fetch(`/api/admin/teachers/${encodeURIComponent(tutorId)}/reviews/${encodeURIComponent(reviewId)}`, {
      method: 'DELETE'
    });

    return {
      success: true,
      message: 'Review removed from Firestore database.'
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Could not remove review.'
    };
  }
}

/**
 * Admin declines a parent home tutor booking request
 */
export async function adminDeclineTutorBooking(
  bookingId: string,
  reason?: string
): Promise<{ success: boolean; message: string; booking?: any }> {
  try {
    // 1. Update Firestore doc in 'tutor_bookings'
    const bookingRef = doc(db, "tutor_bookings", bookingId);
    await updateDoc(bookingRef, {
      status: 'declined',
      declineReason: reason || 'Selected time slot is already fully occupied.',
      declinedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).catch((err) => console.warn('Firestore booking decline notice:', err));

    // 2. Update Backend Express Server
    const res = await fetch(`/api/admin/bookings/${encodeURIComponent(bookingId)}/decline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });

    if (res.ok) {
      const data = await res.json();
      logAdminActivity({
        actionType: 'booking_declined',
        category: 'bookings',
        title: 'Home Tutor Booking Request Declined',
        description: `Declined booking (${bookingId}). Reason: ${reason || 'Schedule occupied'}`,
        targetId: bookingId,
        status: 'completed',
        notes: reason
      }).catch(() => {});
      return data;
    }
  } catch (err) {
    console.warn('adminDeclineTutorBooking notice:', err);
  }

  logAdminActivity({
    actionType: 'booking_declined',
    category: 'bookings',
    title: 'Home Tutor Booking Request Declined',
    description: `Declined booking (${bookingId}). Reason: ${reason || 'Schedule occupied'}`,
    targetId: bookingId,
    status: 'completed',
    notes: reason
  }).catch(() => {});

  return {
    success: true,
    message: 'Booking request declined.'
  };
}

/**
 * Parent discontinues a home tutor after a 30-day cycle:
 * 1. Marks matching `tutor_bookings` docs as 'discontinued'
 * 2. Removes the parent/student from the tutor's `assignedStudents` in `teachers` & `complete_tutors`
 * 3. Removes the tutor from the parent's `hiredTutors` / `bookedTutors` / `assignedEducator` in `parents`
 * 4. Syncs discontinuation to backend Express store and activity logs
 */
export async function discontinueTutorBooking(params: {
  booking: any;
  parentUser?: AppUserProfile | null;
}): Promise<{ success: boolean; updatedParent?: Partial<AppUserProfile>; message: string }> {
  const { booking, parentUser } = params;
  const nowIso = new Date().toISOString();

  const rawBookingId = String(booking?.bookingId || booking?.id || '')
    .replace(/^std-/, '')
    .trim();
  const tutorIdRaw = String(
    booking?.assignedTutorId || booking?.requestedTutorId || booking?.tutorId || booking?.id || ''
  ).trim();
  const slotToRemove = String(booking?.preferredTimeSlot || booking?.timeSlot || '').trim();
  const tutorNameNorm = String(
    booking?.assignedTutorName || booking?.requestedTutorName || booking?.tutorName || booking?.name || ''
  )
    .trim()
    .toLowerCase();

  const tutorIdCandidates = new Set<string>();
  if (tutorIdRaw && !tutorIdRaw.startsWith('hired-') && !tutorIdRaw.startsWith('BK-')) {
    tutorIdCandidates.add(tutorIdRaw);
    const stripped = tutorIdRaw.replace(/^fb_teacher_/, '');
    if (stripped) {
      tutorIdCandidates.add(stripped);
      tutorIdCandidates.add(`fb_teacher_${stripped}`);
    }
  }

  const studentNameNorm = String(booking?.studentName || parentUser?.childName || '')
    .trim()
    .toLowerCase();
  const parentUid = String(booking?.parentUid || parentUser?.uid || '').trim();
  const parentEmailNorm = String(booking?.parentEmail || parentUser?.email || '')
    .trim()
    .toLowerCase();
  const parentPhoneDigits = String(booking?.parentPhone || parentUser?.phone || '')
    .replace(/\D/g, '')
    .slice(-10);

  // 1. Update matching tutor_bookings docs in Firestore
  try {
    const bookingIdsToMark = new Set<string>();
    if (booking?.id && !String(booking.id).startsWith('hired-')) {
      bookingIdsToMark.add(String(booking.id));
    }
    if (rawBookingId && !rawBookingId.startsWith('hired-')) {
      bookingIdsToMark.add(rawBookingId);
    }

    if (parentUid) {
      const qParent = query(collection(db, 'tutor_bookings'), where('parentUid', '==', parentUid));
      const pSnap = await getDocs(qParent);
      pSnap.forEach((d) => {
        const b = d.data();
        const bTId = String(b.assignedTutorId || b.requestedTutorId || '').trim();
        const bTName = String(b.assignedTutorName || b.requestedTutorName || '').trim().toLowerCase();
        if (
          (bTId && tutorIdCandidates.has(bTId)) ||
          (tutorNameNorm && bTName && bTName === tutorNameNorm) ||
          (rawBookingId && d.id === rawBookingId)
        ) {
          bookingIdsToMark.add(d.id);
        }
      });
    }

    for (const bId of bookingIdsToMark) {
      await updateDoc(doc(db, 'tutor_bookings', bId), {
        status: 'discontinued',
        discontinuedAt: nowIso,
        discontinuedBy: 'parent',
        updatedAt: nowIso
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Discontinue tutor_bookings update notice:', err);
  }

  // 2. Remove student/parent from tutor's assignedStudents in 'teachers' & 'complete_tutors'
  const matchesTargetStudent = (s: any): boolean => {
    if (!s) return false;
    const sBId = String(s.bookingId || s.id || '')
      .replace(/^std-/, '')
      .trim();
    if (rawBookingId && !rawBookingId.startsWith('hired-') && sBId && sBId === rawBookingId) {
      return true;
    }
    const sName = String(s.studentName || s.name || '').trim().toLowerCase();
    const sPhone = String(s.parentPhone || s.phone || '')
      .replace(/\D/g, '')
      .slice(-10);
    const sEmail = String(s.parentEmail || '').trim().toLowerCase();
    if (parentUid && s.parentUid && s.parentUid === parentUid) {
      return true;
    }
    if (parentEmailNorm && sEmail && sEmail === parentEmailNorm) {
      if (!studentNameNorm || !sName || sName === studentNameNorm) return true;
    }
    if (studentNameNorm && sName && sName === studentNameNorm) {
      if (!parentPhoneDigits || !sPhone || sPhone === parentPhoneDigits) return true;
    }
    return false;
  };

  try {
    const teacherDocRefs: Array<{ id: string; data: any }> = [];
    for (const cid of tutorIdCandidates) {
      const snap = await getDoc(doc(db, 'teachers', cid));
      if (snap.exists()) {
        teacherDocRefs.push({ id: snap.id, data: snap.data() });
      }
    }

    // Fallback query by name if doc wasn't found by ID
    if (teacherDocRefs.length === 0 && tutorNameNorm) {
      const allTeachersSnap = await getDocs(collection(db, 'teachers'));
      allTeachersSnap.forEach((d) => {
        const tData = d.data();
        const tName = String(tData.name || tData.fullName || '').trim().toLowerCase();
        if (tName === tutorNameNorm) {
          teacherDocRefs.push({ id: d.id, data: tData });
        }
      });
    }

    for (const tDoc of teacherDocRefs) {
      const existingStudents = Array.isArray(tDoc.data.assignedStudents)
        ? tDoc.data.assignedStudents
        : [];
      const remainingStudents = existingStudents.filter((s: any) => !matchesTargetStudent(s));

      const existingSlots = Array.isArray(tDoc.data.bookedTimeSlots)
        ? tDoc.data.bookedTimeSlots
        : [];
      const remainingSlots = slotToRemove
        ? existingSlots.filter(
            (sl: string) =>
              sl !== slotToRemove || remainingStudents.some((rs: any) => rs.timing === sl)
          )
        : existingSlots;

      await updateDoc(doc(db, 'teachers', tDoc.id), {
        assignedStudents: remainingStudents,
        isBooked: remainingStudents.length > 0,
        bookingStatus: remainingStudents.length > 0 ? 'booked' : 'available',
        ...(remainingStudents.length === 0
          ? {
              bookedByStudentName: '',
              bookedByParentName: '',
              bookedByParentPhone: ''
            }
          : {}),
        bookedTimeSlots: remainingSlots,
        updatedAt: nowIso
      }).catch((e) => console.warn('teachers discontinue update notice:', e));
    }
  } catch (err) {
    console.warn('Discontinue teachers update notice:', err);
  }

  // 3. Remove tutor from parent's bookedTutors / hiredTutors / assignedEducator in 'parents'
  const matchesTargetTutorEntry = (entry: any): boolean => {
    if (!entry) return false;
    const eBookingId = String(entry.bookingId || entry.id || '')
      .replace(/^std-/, '')
      .trim();
    if (rawBookingId && eBookingId && eBookingId === rawBookingId) return true;
    const eTutorId = String(
      entry.assignedTutorId || entry.requestedTutorId || entry.tutorId || entry.id || ''
    ).trim();
    if (eTutorId && tutorIdCandidates.has(eTutorId)) return true;
    const eName = String(
      entry.assignedTutorName || entry.requestedTutorName || entry.tutorName || entry.name || ''
    )
      .trim()
      .toLowerCase();
    if (tutorNameNorm && eName && eName === tutorNameNorm) return true;
    return false;
  };

  let updatedParentFields: Partial<AppUserProfile> | undefined;
  try {
    const parentDocMap = new Map<string, any>();
    if (parentUid) {
      const pSnap = await getDoc(doc(db, 'parents', parentUid));
      if (pSnap.exists()) parentDocMap.set(pSnap.id, pSnap.data());
    }
    if (parentEmailNorm) {
      const qEmail = query(collection(db, 'parents'), where('email', '==', parentEmailNorm));
      const qSnap = await getDocs(qEmail);
      qSnap.forEach((d) => {
        if (!parentDocMap.has(d.id)) parentDocMap.set(d.id, d.data());
      });
    }

    for (const [pId, pData] of parentDocMap.entries()) {
      const curHired = Array.isArray(pData.hiredTutors) ? pData.hiredTutors : [];
      const curBooked = Array.isArray(pData.bookedTutors) ? pData.bookedTutors : [];
      const nextHired = curHired.filter((h: any) => !matchesTargetTutorEntry(h));
      const nextBooked = curBooked.filter((b: any) => !matchesTargetTutorEntry(b));

      const educMatches = matchesTargetTutorEntry(pData.assignedEducator);
      const topIdMatches =
        (pData.assignedTutorId && tutorIdCandidates.has(String(pData.assignedTutorId).trim())) ||
        (tutorNameNorm && String(pData.assignedTutor || '').trim().toLowerCase() === tutorNameNorm);

      const fallbackEduc = nextHired[0] || nextBooked[0] || null;
      const nextAssignedEducator =
        educMatches || topIdMatches
          ? fallbackEduc
            ? {
                id: fallbackEduc.tutorId || fallbackEduc.id,
                name: fallbackEduc.tutorName || fallbackEduc.name,
                tutorName: fallbackEduc.tutorName || fallbackEduc.name,
                subjects: fallbackEduc.subjects,
                phone: fallbackEduc.phone,
                monthlyFee: fallbackEduc.monthlyFee,
                avatar: fallbackEduc.avatar,
                status: 'Active'
              }
            : null
          : pData.assignedEducator ?? null;

      const patch: Record<string, any> = {
        hiredTutors: nextHired,
        bookedTutors: nextBooked,
        assignedEducator: nextAssignedEducator,
        assignedTutorId: nextAssignedEducator?.id || '',
        assignedTutor: nextAssignedEducator?.name || '',
        updatedAt: nowIso
      };

      await updateDoc(doc(db, 'parents', pId), patch).catch(() => {});
      updatedParentFields = {
        hiredTutors: nextHired,
        assignedEducator: nextAssignedEducator || undefined
      } as Partial<AppUserProfile>;
    }
  } catch (err) {
    console.warn('Discontinue parents update notice:', err);
  }

  // 4. Update local session cache immediately
  if (parentUser) {
    const nextLocalHired = (parentUser.hiredTutors || []).filter(
      (h: any) => !matchesTargetTutorEntry(h)
    );
    const localEducMatches = matchesTargetTutorEntry(parentUser.assignedEducator);
    const nextLocalProfile: AppUserProfile = {
      ...parentUser,
      ...(updatedParentFields || {}),
      hiredTutors: nextLocalHired,
      assignedEducator: localEducMatches
        ? undefined
        : updatedParentFields?.assignedEducator ?? parentUser.assignedEducator
    };
    saveUserSessionToStorage(nextLocalProfile);
    updatedParentFields = {
      hiredTutors: nextLocalProfile.hiredTutors,
      assignedEducator: nextLocalProfile.assignedEducator
    };
  }

  // 5. Mirror discontinuation to Express backend
  try {
    await fetch(
      `/api/bookings/${encodeURIComponent(rawBookingId || tutorIdRaw || 'booking')}/discontinue`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: rawBookingId,
          tutorId: tutorIdRaw,
          tutorName: booking?.assignedTutorName || booking?.requestedTutorName || booking?.tutorName,
          parentUid,
          parentEmail: parentEmailNorm,
          parentPhone: parentPhoneDigits,
          studentName: booking?.studentName || parentUser?.childName || ''
        })
      }
    );
  } catch (err) {
    console.warn('API discontinue notice:', err);
  }

  // 6. Activity Log
  logAdminActivity({
    actionType: 'booking_discontinued',
    category: 'bookings',
    title: 'Home Tuition Discontinued by Parent',
    description: `Parent ${parentUser?.name || booking?.parentName || 'Parent'} discontinued tutor ${
      booking?.assignedTutorName || booking?.requestedTutorName || booking?.tutorName || 'Tutor'
    } for student ${booking?.studentName || parentUser?.childName || 'Student'}.`,
    targetId: rawBookingId || tutorIdRaw,
    studentName: booking?.studentName || parentUser?.childName,
    parentName: parentUser?.name || booking?.parentName,
    tutorName: booking?.assignedTutorName || booking?.requestedTutorName || booking?.tutorName,
    status: 'completed'
  }).catch(() => {});

  return {
    success: true,
    updatedParent: updatedParentFields,
    message: 'Tutor discontinued and removed from active tuition lists.'
  };
}

/**
 * Save a student Success Story to Firestore collection 'success_stories'
 */
export async function saveSuccessStoryToFirestore(storyData: {
  studentName: string;
  score: string;
  exam: string;
  school?: string;
  parentName?: string;
  testimonial: string;
  image?: string;
  year?: string;
  badge?: string;
}): Promise<{ success: boolean; id: string; story: AdminSuccessStory }> {
  const storyId = `story-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const fullStory: AdminSuccessStory = {
    ...storyData,
    id: storyId,
    image: storyData.image || '/images/defaults/student_rohit.jpg',
    year: storyData.year || `${new Date().getFullYear()}`,
    badge: storyData.badge || 'Star Student',
    createdAt: new Date().toISOString()
  };

  // 1. Write to Firestore collection 'success_stories'
  try {
    const storyDocRef = doc(db, "success_stories", storyId);
    await setDoc(storyDocRef, {
      ...fullStory,
      timestamp: serverTimestamp(),
      databaseId: FIRESTORE_DATABASE_ID
    });
  } catch (err) {
    console.warn('Firestore success_stories write notice:', err);
  }

  // 2. Sync to Backend API
  try {
    await fetch('/api/success-stories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullStory)
    });
  } catch (err) {
    console.warn('API /api/success-stories notice:', err);
  }

  return {
    success: true,
    id: storyId,
    story: fullStory
  };
}

/**
 * Delete a Success Story from Firestore collection 'success_stories' and backend
 */
export async function deleteSuccessStoryFromFirestore(storyId: string): Promise<boolean> {
  // 1. Delete from Firestore
  try {
    const storyRef = doc(db, "success_stories", storyId);
    await deleteDoc(storyRef);
  } catch (err) {
    console.warn('Firestore delete success_story notice:', err);
  }

  // 2. Delete from Backend
  try {
    await fetch(`/api/success-stories/${encodeURIComponent(storyId)}`, {
      method: 'DELETE'
    });
  } catch (err) {
    console.warn('API delete success_story notice:', err);
  }

  return true;
}

/**
 * Real-time listener for Success Stories from Firestore collection 'success_stories'
 */
export function subscribeToRealtimeSuccessStories(onUpdate: (stories: AdminSuccessStory[]) => void): () => void {
  try {
    const col = collection(db, "success_stories");
    const unsub = onSnapshot(
      col,
      (snapshot) => {
        const list: AdminSuccessStory[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            studentName: data.studentName || 'Student',
            score: data.score || data.scoreOrRank || '',
            exam: data.exam || data.examOrClass || '',
            school: data.school || '',
            parentName: data.parentName || '',
            testimonial: data.testimonial || data.story || '',
            image: data.image || data.imageUrl || '/images/defaults/student_rohit.jpg',
            year: data.year || '2024',
            badge: data.badge || data.tag || 'Top Performer',
            createdAt: data.createdAt || ''
          });
        });
        // Sort by createdAt desc
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        onUpdate(list);
      },
      (err) => {
        console.warn('Firestore success_stories listener notice:', err);
        onUpdate([]);
      }
    );
    return unsub;
  } catch (err) {
    console.warn('Firestore success_stories setup error:', err);
    onUpdate([]);
    return () => {};
  }
}

export interface AdminGalleryItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'students' | 'classrooms' | 'building' | 'events';
  image: string;
  alt?: string;
  iconType?: string;
  createdAt?: string;
}

/**
 * Real-time listener for Gallery items directly from Firestore collection 'gallery'
 */
export function subscribeToRealtimeGallery(onUpdate: (items: AdminGalleryItem[]) => void): () => void {
  try {
    const col = collection(db, "gallery");
    const unsub = onSnapshot(
      col,
      (snapshot) => {
        const list: AdminGalleryItem[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            title: data.title || 'Untitled Photo',
            subtitle: data.subtitle || '',
            category: data.category || 'students',
            image: data.image || data.imageUrl || '',
            alt: data.alt || data.title || '',
            iconType: data.iconType || 'user',
            createdAt: data.createdAt || ''
          });
        });
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        onUpdate(list);
      },
      (err) => {
        console.warn('Firestore gallery listener notice:', err);
        fetch('/api/gallery')
          .then((r) => r.json())
          .then((res) => {
            if (res?.items && Array.isArray(res.items)) onUpdate(res.items);
            else onUpdate([]);
          })
          .catch(() => onUpdate([]));
      }
    );
    return unsub;
  } catch (err) {
    console.warn('Firestore gallery setup error:', err);
    fetch('/api/gallery')
      .then((r) => r.json())
      .then((res) => {
        if (res?.items && Array.isArray(res.items)) onUpdate(res.items);
        else onUpdate([]);
      })
      .catch(() => onUpdate([]));
    return () => {};
  }
}

/**
 * Add a new image item to Firestore collection 'gallery'
 */
export async function addGalleryItemToFirestore(item: {
  title: string;
  subtitle?: string;
  category: 'students' | 'classrooms' | 'building' | 'events';
  image: string;
  alt?: string;
  iconType?: string;
}): Promise<string> {
  const payload = {
    ...item,
    createdAt: new Date().toISOString(),
    timestamp: serverTimestamp(),
    databaseId: FIRESTORE_DATABASE_ID
  };

  try {
    const col = collection(db, "gallery");
    const docRef = await addDoc(col, payload);
    try {
      await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: docRef.id, ...payload })
      });
    } catch (e) {
      // Server fallback optional
    }
    return docRef.id;
  } catch (err) {
    console.warn("Firestore add gallery notice, using server fallback:", err);
    const res = await fetch('/api/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    return data?.item?.id || `gallery-${Date.now()}`;
  }
}

export async function deleteGalleryItemFromFirestore(id: string): Promise<boolean> {
  try {
    const docRef = doc(db, "gallery", id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("Firestore delete gallery item notice:", err);
  }
  try {
    await deleteDoc(doc(db, "gallery_manager", id));
  } catch (err) {}
  try {
    await deleteDoc(doc(db, "gallery_items", id));
  } catch (err) {}
  try {
    await fetch(`/api/gallery/${id}`, { method: 'DELETE' });
  } catch (e) {
    // Server fallback optional
  }
  return true;
}


/**
 * Save enquiry to Firestore in real-time
 */
export async function saveEnquiryToFirestore(enquiry: {
  name: string;
  phone: string;
  grade?: string;
  message?: string;
}): Promise<string> {
  try {
    const enquiriesCol = collection(db, "enquiries");
    const docRef = await addDoc(enquiriesCol, {
      ...enquiry,
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
      databaseId: FIRESTORE_DATABASE_ID
    });
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, "enquiries");
  }
}

/**
 * Save newsletter subscriber email to Firestore collection 'newsletter_subscribers'
 */
export async function saveNewsletterSubscriptionToFirestore(email: string): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error("Please enter a valid email address.");
  }
  try {
    const colRef = collection(db, "newsletter_subscribers");
    const docRef = await addDoc(colRef, {
      email: cleanEmail,
      source: "footer",
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
      databaseId: FIRESTORE_DATABASE_ID
    });
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, "newsletter_subscribers");
  }
}

/**
 * Save demo booking to Firestore collection 'demo_bookings' in real-time (for offline classes)
 */
export async function saveDemoBookingToFirestore(booking: {
  studentName: string;
  parentName?: string;
  phone: string;
  email?: string;
  grade: string;
  subject: string;
  mode: string;
  preferredDate: string;
  preferredTime: string;
  notes?: string;
  userId?: string;
}): Promise<string> {
  // Sync to Backend /api/demo-queries (best-effort companion)
  fetch('/api/demo-queries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(booking)
  }).catch(() => {});

  try {
    const offlineCol = collection(db, "offline_demo_queries");
    await addDoc(offlineCol, {
      ...booking,
      status: "Confirmed",
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
      databaseId: FIRESTORE_DATABASE_ID
    }).catch(() => {});

    const bookingsCol = collection(db, "demo_bookings");
    const docRef = await addDoc(bookingsCol, {
      ...booking,
      status: "Confirmed",
      createdAt: new Date().toISOString(),
      timestamp: serverTimestamp(),
      databaseId: FIRESTORE_DATABASE_ID
    });
    return docRef.id;
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, "demo_bookings");
  }
}

/**
 * Log an administrative action to Firestore and backend audit trails
 */
export async function logAdminActivity(
  activityData: Partial<AdminActivityLog> & { actionType: AdminActivityLog['actionType']; title: string }
): Promise<AdminActivityLog> {
  const logId = activityData.id || `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const currentSession = loadSavedUserSession();
  
  const fullLog: AdminActivityLog = {
    id: logId,
    adminName: activityData.adminName || currentSession?.name || ADMIN_CREDENTIALS.name,
    adminEmail: activityData.adminEmail || currentSession?.email || ADMIN_CREDENTIALS.email,
    adminAvatar: activityData.adminAvatar || currentSession?.avatar || "/images/defaults/student_rohit.jpg",
    actionType: activityData.actionType,
    category: activityData.category || (activityData.actionType.includes("payment_course") ? "payment_courses" : activityData.actionType.includes("payment") ? "payment_home_tutors" : "tutors"),
    title: activityData.title,
    description: activityData.description || activityData.title,
    targetId: activityData.targetId || "",
    targetName: activityData.targetName || "",
    studentName: activityData.studentName || "",
    parentName: activityData.parentName || "",
    parentPhone: activityData.parentPhone || "",
    tutorName: activityData.tutorName || "",
    courseTitle: activityData.courseTitle || "",
    amount: typeof activityData.amount === "number" ? activityData.amount : undefined,
    paymentMethod: activityData.paymentMethod || undefined,
    transactionId: activityData.transactionId || undefined,
    receiptNo: activityData.receiptNo || undefined,
    status: activityData.status || "completed",
    notes: activityData.notes || "",
    timestamp: activityData.timestamp || new Date().toISOString()
  };

  // 1. Save to Cloud Firestore collection 'activity_logs'
  try {
    const logDocRef = doc(db, "activity_logs", logId);
    await setDoc(logDocRef, {
      ...removeUndefinedFields(fullLog),
      serverCreatedAt: serverTimestamp(),
      databaseId: FIRESTORE_DATABASE_ID
    });
  } catch (fsErr) {
    console.warn("Notice saving activity log to Firestore:", fsErr);
  }

  // 2. Sync to Backend Express Server /api/admin/activity-logs
  try {
    await fetch("/api/admin/activity-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fullLog)
    });
  } catch (apiErr) {
    console.warn("Notice syncing activity log to API:", apiErr);
  }

  return fullLog;
}

/**
 * Real-time listener for Activity & Audit Logs from Firestore collection 'activity_logs'
 */
export function subscribeToRealtimeActivityLogs(
  onUpdate: (logs: AdminActivityLog[], metrics?: any) => void
): () => void {
  try {
    const col = collection(db, "activity_logs");
    const unsub = onSnapshot(
      col,
      (snapshot) => {
        const list: AdminActivityLog[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          list.push({
            id: d.id,
            adminName: data.adminName || "Admin Chandini Kurumoju",
            adminEmail: data.adminEmail,
            adminAvatar: data.adminAvatar,
            actionType: data.actionType || "tutor_approved",
            category: data.category || "tutors",
            title: data.title || "Admin Action",
            description: data.description || "",
            targetId: data.targetId,
            targetName: data.targetName,
            studentName: data.studentName,
            parentName: data.parentName,
            parentPhone: data.parentPhone,
            tutorName: data.tutorName,
            courseTitle: data.courseTitle,
            amount: typeof data.amount === "number" ? data.amount : undefined,
            paymentMethod: data.paymentMethod,
            transactionId: data.transactionId,
            receiptNo: data.receiptNo,
            status: data.status || "completed",
            notes: data.notes,
            timestamp: data.timestamp || new Date().toISOString()
          });
        });

        // Sort by timestamp desc
        list.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        onUpdate(list);
      },
      (err) => {
        console.warn("Firestore activity_logs listener notice:", err);
        onUpdate([]);
      }
    );
    return unsub;
  } catch (err) {
    console.warn("Firestore activity_logs setup error:", err);
    onUpdate([]);
    return () => {};
  }
}

/**
 * ---------------------------------------------------------------------------
 * HERO BANNERS FIRESTORE REPOSITORY
 * Stores and syncs all uploaded banner images directly in Cloud Firestore
 * ---------------------------------------------------------------------------
 */
export interface FirestoreHeroBanner {
  id: string;
  url: string;
  title?: string;
  active: boolean;
  createdAt: string;
}

export function subscribeToRealtimeHeroBanners(
  onUpdate: (banners: FirestoreHeroBanner[]) => void
): () => void {
  try {
    const col = collection(db, "hero_banners");
    const unsub = onSnapshot(
      col,
      (snapshot) => {
        const list: FirestoreHeroBanner[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          if (data && data.url) {
            list.push({
              id: d.id,
              url: data.url,
              title: data.title || "",
              active: data.active !== false,
              createdAt: data.createdAt || new Date().toISOString()
            });
          }
        });

        // Sort newest first
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        onUpdate(list);
      },
      (err) => {
        console.warn("Firestore hero_banners listener notice:", err);
      }
    );
    return unsub;
  } catch (err) {
    console.warn("Firestore hero_banners setup error:", err);
    return () => {};
  }
}

export async function saveHeroBannerToFirestore(banner: {
  id?: string;
  url: string;
  title?: string;
  active?: boolean;
}): Promise<string> {
  const bannerId = banner.id || `banner-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const bannerRef = doc(db, "hero_banners", bannerId);
  const data: FirestoreHeroBanner = {
    id: bannerId,
    url: banner.url.trim(),
    title: (banner.title || "").trim(),
    active: banner.active !== false,
    createdAt: new Date().toISOString()
  };
  await setDoc(bannerRef, data, { merge: true });
  return bannerId;
}

export async function updateHeroBannerInFirestore(
  id: string,
  updates: Partial<FirestoreHeroBanner>
): Promise<void> {
  const bannerRef = doc(db, "hero_banners", id);
  await setDoc(bannerRef, updates, { merge: true });
}

export async function deleteHeroBannerFromFirestore(id: string): Promise<void> {
  const bannerRef = doc(db, "hero_banners", id);
  await deleteDoc(bannerRef);
}

/**
 * 1. Incoming Bookings: Real-time listener specifically for 'incoming_bookings' collection
 */
export function subscribeToRealtimeIncomingBookings(
  onUpdate: (bookings: any[]) => void
): () => void {
  let active = true;
  const fallback = () => {
    fetchFirestoreCollectionRest<any>('incoming_bookings')
      .then((list) => {
        if (!active) return;
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        onUpdate(list);
      })
      .catch(() => {});
  };
  try {
    const col = collection(db, "incoming_bookings");
    const unsub = onSnapshot(
      col,
      (snapshot) => {
        if (!active) return;
        const list: any[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
        list.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        onUpdate(list);
      },
      (err) => {
        console.warn("Firestore incoming_bookings listener notice:", err);
        fallback();
      }
    );
    return () => {
      active = false;
      unsub();
    };
  } catch (err) {
    console.warn("Firestore incoming_bookings setup error:", err);
    fallback();
    return () => { active = false; };
  }
}

/**
 * 3. Tutors Request Collection: Real-time listener for tutors who registered pending profile completion
 */
export function subscribeToTutorsRequests(
  onUpdate: (requests: any[]) => void
): () => void {
  let active = true;
  const fallback = () => {
    fetchFirestoreCollectionRest<any>('tutors_requests')
      .then((list) => {
        if (!active) return;
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        onUpdate(list);
      })
      .catch(() => {});
  };
  try {
    const col = collection(db, "tutors_requests");
    const unsub = onSnapshot(
      col,
      (snapshot) => {
        if (!active) return;
        const list: any[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
        list.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        onUpdate(list);
      },
      (err) => {
        console.warn("Firestore tutors_requests listener notice:", err);
        fallback();
      }
    );
    return () => {
      active = false;
      unsub();
    };
  } catch (err) {
    console.warn("Firestore tutors_requests setup error:", err);
    fallback();
    return () => { active = false; };
  }
}

/**
 * 4. Completed/Approved Tutors Listener: Reads directly from the single authoritative 'teachers' collection
 * (legacy 'complete_tutors' collection retired).
 */
export function subscribeToCompleteTutors(
  onUpdate: (tutors: any[]) => void
): () => void {
  let active = true;
  const formatCompleteTutor = (id: string, data: any) => {
    const feeAmount =
      Number(data.feeAmount) ||
      Number(data.monthlyFee) ||
      (Number(data.hourlyRate) ? Number(data.hourlyRate) * 30 : 3500);
    return {
      id,
      ...data,
      feeAmount,
      availableTimings: data.availableTimings || data.selectedTimings || ['05:00 PM - 06:00 PM', '06:00 PM - 07:00 PM'],
      assignedParentName: data.assignedParentName || (Array.isArray(data.assignedParents) && data.assignedParents[0]?.parentName) || ''
    };
  };
  const fallback = () => {
    fetchFirestoreCollectionRest<any>('teachers')
      .then((docs) => {
        if (!active) return;
        const list = docs
          .filter((d) => !isPrototypeOrInvalidTutor(canonicalTeacherUid(d.id || ''), d) && (d.profileCompleted === true || d.isApproved === true || d.status === 'approved'))
          .map((d) => formatCompleteTutor(canonicalTeacherUid(d.id), d));
        list.sort(
          (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
        );
        onUpdate(list);
      })
      .catch(() => {});
  };
  try {
    const col = collection(db, "teachers");
    const unsub = onSnapshot(
      col,
      (snapshot) => {
        if (!active) return;
        const list: any[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          const uid = canonicalTeacherUid(d.id);
          if (!uid || isPrototypeOrInvalidTutor(uid, data)) return;
          if (data.profileCompleted === true || data.isApproved === true || data.status === 'approved') {
            list.push(formatCompleteTutor(uid, data));
          }
        });
        list.sort(
          (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
        );
        onUpdate(list);
      },
      (err) => {
        console.warn("Firestore teachers listener notice:", err);
        fallback();
      }
    );
    return () => {
      active = false;
      unsub();
    };
  } catch (err) {
    console.warn("Firestore teachers setup error:", err);
    fallback();
    return () => { active = false; };
  }
}

/**
 * 7. Tutors Reviews Collection: Real-time listener for authentic reviews
 */
export function subscribeToTutorsReviews(
  onUpdate: (reviews: any[]) => void
): () => void {
  let active = true;
  const fallback = () => {
    fetchFirestoreCollectionRest<any>('tutors_reviews')
      .then((list) => {
        if (!active) return;
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        onUpdate(list);
      })
      .catch(() => {});
  };
  try {
    const col = collection(db, "tutors_reviews");
    const unsub = onSnapshot(
      col,
      (snapshot) => {
        if (!active) return;
        const list: any[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
        list.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        onUpdate(list);
      },
      (err) => {
        console.warn("Firestore tutors_reviews listener notice:", err);
        fallback();
      }
    );
    return () => {
      active = false;
      unsub();
    };
  } catch (err) {
    console.warn("Firestore tutors_reviews setup error:", err);
    fallback();
    return () => { active = false; };
  }
}

/**
 * 8. Offline Demo Queries Collection: Real-time listener
 */
export function subscribeToOfflineDemoQueries(
  onUpdate: (queries: any[]) => void
): () => void {
  let active = true;
  const fallback = () => {
    fetchFirestoreCollectionRest<any>('offline_demo_queries')
      .then((list) => {
        if (!active) return;
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        onUpdate(list);
      })
      .catch(() => {});
  };
  try {
    const col = collection(db, "offline_demo_queries");
    const unsub = onSnapshot(
      col,
      (snapshot) => {
        if (!active) return;
        const list: any[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() });
        });
        list.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        onUpdate(list);
      },
      (err) => {
        console.warn("Firestore offline_demo_queries listener notice:", err);
        fallback();
      }
    );
    return () => {
      active = false;
      unsub();
    };
  } catch (err) {
    console.warn("Firestore offline_demo_queries setup error:", err);
    fallback();
    return () => { active = false; };
  }
}

export async function adminDeleteOfflineDemoQuery(id: string): Promise<void> {
  try {
    const docRef = doc(db, "offline_demo_queries", id);
    await deleteDoc(docRef);
  } catch (err) {
    console.warn("delete offline_demo_queries notice:", err);
  }
}

/**
 * 9. Gallery Manager Collection: Real-time listener & storage
 */
export interface FirestoreGalleryItem {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  imageUrl: string;
  image?: string;
  createdAt: string;
}

export function subscribeToGalleryManager(
  onUpdate: (items: FirestoreGalleryItem[]) => void
): () => void {
  let active = true;
  const mapGalleryDoc = (id: string, data: any): FirestoreGalleryItem => ({
    id,
    title: data.title || "",
    subtitle: data.subtitle || "",
    category: data.category || "students",
    imageUrl: data.imageUrl || data.image || "",
    image: data.imageUrl || data.image || "",
    createdAt: data.createdAt || new Date().toISOString()
  });
  const fallback = () => {
    fetchFirestoreCollectionRest<any>('gallery')
      .then((docs) => {
        if (!active) return;
        const list = docs.map((d) => mapGalleryDoc(d.id, d));
        list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        onUpdate(list);
      })
      .catch(() => {});
  };
  try {
    const col = collection(db, "gallery");
    const unsub = onSnapshot(
      col,
      (snapshot) => {
        if (!active) return;
        const list: FirestoreGalleryItem[] = [];
        snapshot.forEach((d) => {
          list.push(mapGalleryDoc(d.id, d.data()));
        });
        list.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        onUpdate(list);
      },
      (err) => {
        console.warn("Firestore gallery listener notice:", err);
        fallback();
      }
    );
    return () => {
      active = false;
      unsub();
    };
  } catch (err) {
    console.warn("Firestore gallery setup error:", err);
    fallback();
    return () => { active = false; };
  }
}

export async function saveGalleryItemToFirestore(item: {
  id?: string;
  title: string;
  subtitle?: string;
  category: string;
  image: string;
}): Promise<string> {
  const itemId = item.id || `gal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const data = {
    id: itemId,
    title: item.title.trim(),
    subtitle: (item.subtitle || "Kumari Institute Rayagada").trim(),
    category: item.category,
    imageUrl: item.image.trim(),
    image: item.image.trim(),
    alt: item.title.trim(),
    createdAt: new Date().toISOString()
  };

  // Primary: Save to 'gallery' collection which dynamically powers the public Gallery Page
  await setDoc(doc(db, "gallery", itemId), data, { merge: true });

  // Sync to 'gallery_manager'
  try {
    await setDoc(doc(db, "gallery_manager", itemId), data, { merge: true });
  } catch {}

  // Sync to legacy 'gallery_items'
  try {
    await setDoc(doc(db, "gallery_items", itemId), data, { merge: true });
  } catch {}

  // Also save to server store fallback
  try {
    await fetch('/api/gallery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch {}

  return itemId;
}

/**
 * Real-time listener for an individual Tutor Profile Page:
 * Subscribes to 'teachers/{tutorId}', 'complete_tutors/{tutorId}', and 'tutors_reviews'
 * so all details, fee structure, slots, student count, and reviews update live from Firestore.
 */
export function subscribeToSingleTutorRealtime(
  tutorId: string,
  onUpdate: (payload: {
    tutorUpdates: Partial<Tutor>;
    liveReviews: TutorReview[];
    bookedStudentsCount: number;
  }) => void
): () => void {
  if (!tutorId) return () => {};

  let teacherDocData: Record<string, any> | null = null;
  let collectionReviews: TutorReview[] = [];

  const emit = () => {
    const merged = {
      ...(teacherDocData || {}),
    };

    const embeddedReviews: TutorReview[] = Array.isArray(merged.reviews) ? merged.reviews : [];
    const seenIds = new Set<string>();
    const combinedReviews: TutorReview[] = [];

    [...collectionReviews, ...embeddedReviews].forEach((rev) => {
      if (!rev || (!rev.comment && !rev.parentName)) return;
      const revKey = rev.id || `${rev.parentName}_${rev.comment?.slice(0, 24)}`;
      if (seenIds.has(revKey)) return;
      seenIds.add(revKey);
      combinedReviews.push({
        id: rev.id || revKey,
        parentName: rev.parentName || 'Verified Parent',
        relation: rev.relation || (rev.studentGrade ? `Parent of ${rev.studentGrade}` : 'Verified Parent'),
        rating: Number(rev.rating) || 5,
        date: rev.date || 'Recently',
        comment: rev.comment || '',
        studentGrade: rev.studentGrade || '',
        schoolName: rev.schoolName || 'Rayagada',
        verifiedBooking: rev.verifiedBooking !== false,
      });
    });

    const assignedArr = Array.isArray(merged.assignedStudents)
      ? merged.assignedStudents
      : Array.isArray(merged.assignedParents)
      ? merged.assignedParents
      : [];
    const explicitCount =
      typeof merged.studentsCount === 'number' && merged.studentsCount > 0
        ? merged.studentsCount
        : typeof merged.studentsTaught === 'number' && merged.studentsTaught > 0
        ? merged.studentsTaught
        : assignedArr.length;

    const computedRating =
      combinedReviews.length > 0
        ? Math.round(
            (combinedReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) /
              combinedReviews.length) *
              10
          ) / 10
        : typeof merged.rating === 'number' && merged.rating > 0
        ? merged.rating
        : 0;

    const slotsRaw =
      (Array.isArray(merged.availableTimeSlots) && merged.availableTimeSlots.length > 0
        ? merged.availableTimeSlots
        : Array.isArray(merged.availableTimings) && merged.availableTimings.length > 0
        ? merged.availableTimings
        : Array.isArray(merged.timeSlots) && merged.timeSlots.length > 0
        ? merged.timeSlots
        : []) as string[];

    const tutorUpdates: Partial<Tutor> = removeUndefinedFields({
      name: (merged.fullName || merged.name || '').trim() || undefined,
      avatar: merged.avatar || merged.photoUrl || undefined,
      bio: typeof merged.bio === 'string' ? merged.bio : undefined,
      qualification: merged.highestQualification || merged.qualification || undefined,
      highestQualification: merged.highestQualification || merged.qualification || undefined,
      courseDegree: merged.courseDegree || merged.educationDetails?.degree?.course || undefined,
      university: merged.university || merged.educationDetails?.degree?.university || undefined,
      passingYear: merged.passingYear || merged.educationDetails?.degree?.year || undefined,
      experienceYears:
        typeof merged.experienceYears === 'number' ? merged.experienceYears : undefined,
      totalExperience: merged.totalExperience || merged.experience || undefined,
      subjects: Array.isArray(merged.subjects) ? merged.subjects : undefined,
      classesHandled: Array.isArray(merged.classesHandled)
        ? merged.classesHandled
        : Array.isArray(merged.classes)
        ? merged.classes
        : undefined,
      boardsSupported: Array.isArray(merged.boardsSupported) ? merged.boardsSupported : undefined,
      availableTimeSlots: slotsRaw.length > 0 ? slotsRaw : undefined,
      feeStructure: merged.feeStructure || undefined,
      monthlyFee:
        typeof merged.monthlyFee === 'number' && merged.monthlyFee > 0
          ? merged.monthlyFee
          : typeof merged.feeAmount === 'number' && merged.feeAmount > 0
          ? merged.feeAmount
          : undefined,
      hourlyRate:
        typeof merged.hourlyRate === 'number' && merged.hourlyRate > 0
          ? merged.hourlyRate
          : typeof merged.hourlyCharges === 'number' && merged.hourlyCharges > 0
          ? merged.hourlyCharges
          : undefined,
      hourlyCharges:
        typeof merged.hourlyCharges === 'number' && merged.hourlyCharges > 0
          ? merged.hourlyCharges
          : typeof merged.hourlyRate === 'number' && merged.hourlyRate > 0
          ? merged.hourlyRate
          : undefined,
      teacherType: merged.teacherType === 'both' ? 'both' : merged.teacherType === 'home' ? 'home' : undefined,
      teachingHighlights: Array.isArray(merged.teachingHighlights)
        ? merged.teachingHighlights
        : undefined,
      educationDetails: merged.educationDetails || undefined,
      languages: Array.isArray(merged.languages) ? merged.languages : undefined,
      locationArea: merged.locationArea || merged.locality || undefined,
      verified:
        typeof merged.verified === 'boolean'
          ? merged.verified
          : merged.status === 'approved' || merged.isApproved === true
          ? true
          : undefined,
      isApproved:
        typeof merged.isApproved === 'boolean'
          ? merged.isApproved
          : merged.status === 'approved'
          ? true
          : undefined,
      rating: computedRating > 0 ? computedRating : undefined,
      reviewCount: combinedReviews.length > 0 ? combinedReviews.length : merged.reviewCount,
      assignedStudents: assignedArr.length > 0 ? assignedArr : undefined,
      dailyRoutine: Array.isArray(merged.dailyRoutine) ? merged.dailyRoutine : undefined,
      reviews: combinedReviews,
    });

    onUpdate({
      tutorUpdates,
      liveReviews: combinedReviews,
      bookedStudentsCount: explicitCount,
    });
  };

  const unsubs: (() => void)[] = [];

  try {
    unsubs.push(
      onSnapshot(
        doc(db, 'teachers', tutorId),
        (snap) => {
          if (snap.exists()) {
            teacherDocData = snap.data();
            emit();
          }
        },
        (err) => {
          console.warn('[Firestore Realtime] teachers/{id} listener notice:', err?.message || err);
        }
      )
    );
  } catch (err) {
    console.warn('teachers/{id} realtime setup notice:', err);
  }

  try {
    unsubs.push(
      onSnapshot(
        collection(db, 'tutors_reviews'),
        (snapshot) => {
          const list: TutorReview[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            if (data.tutorId === tutorId || data.teacherId === tutorId) {
              list.push({
                id: d.id,
                parentName: data.parentName || 'Verified Parent',
                relation:
                  data.relation ||
                  (data.studentGrade ? `Parent of ${data.studentGrade}` : 'Parent'),
                rating: Number(data.rating) || 5,
                date:
                  data.date ||
                  (data.createdAt
                    ? new Date(data.createdAt).toLocaleDateString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Recently'),
                comment: data.comment || '',
                studentGrade: data.studentGrade || '',
                schoolName: data.schoolName || 'Rayagada',
                verifiedBooking: data.verifiedBooking !== false,
                ...(data.createdAt ? { createdAt: data.createdAt } : {}),
              } as TutorReview & { createdAt?: string });
            }
          });
          list.sort(
            (a: any, b: any) =>
              new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );
          collectionReviews = list;
          emit();
        },
        (err) => {
          console.warn('[Firestore Realtime] tutors_reviews listener notice:', err?.message || err);
        }
      )
    );
  } catch (err) {
    console.warn('tutors_reviews realtime setup notice:', err);
  }

  return () => {
    unsubs.forEach((fn) => {
      try {
        fn();
      } catch {}
    });
  };
}

/**
 * Submit a real parent review directly to Firestore 'tutors_reviews' and sync 'teachers/{tutorId}'
 */
export async function submitParentTutorReview(
  tutorId: string,
  reviewData: {
    parentName: string;
    relation: string;
    rating: number;
    comment: string;
    studentGrade?: string;
    schoolName?: string;
  }
): Promise<TutorReview> {
  const reviewId = `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const nowIso = new Date().toISOString();
  const fullReview: TutorReview = {
    id: reviewId,
    parentName: reviewData.parentName.trim(),
    relation: reviewData.relation.trim() || 'Parent',
    rating: Math.min(5, Math.max(1, Number(reviewData.rating) || 5)),
    date: new Date().toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    comment: reviewData.comment.trim(),
    studentGrade: reviewData.studentGrade?.trim() || '',
    schoolName: reviewData.schoolName?.trim() || 'Rayagada',
    verifiedBooking: true,
  };

  await setDoc(doc(db, 'tutors_reviews', reviewId), {
    ...fullReview,
    tutorId,
    createdAt: nowIso,
  });

  try {
    const tutorRef = doc(db, 'teachers', tutorId);
    const snap = await getDoc(tutorRef);
    if (snap.exists()) {
      const data = snap.data();
      const existingReviews: TutorReview[] = Array.isArray(data.reviews) ? data.reviews : [];
      const updated = [fullReview, ...existingReviews];
      const avg =
        Math.round(
          (updated.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / updated.length) * 10
        ) / 10;
      await updateDoc(tutorRef, {
        reviews: updated,
        rating: avg,
        reviewCount: updated.length,
        updatedAt: nowIso,
      });
    }
  } catch (err) {
    console.warn('teachers review sync notice:', err);
  }

  return fullReview;
}

