import dotenv from "dotenv";
dotenv.config({ override: true });
import crypto from "crypto";
import express from "express";
import compression from "compression";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { INITIAL_TUTORS, Tutor, RAYAGADA_LOCALITIES, findClosestLocality } from "./src/data/tutorsData.js";
import {
  generateTenthMarksheetSvg,
  generateTwelfthMarksheetSvg,
  generateDegreeCertificateSvg,
  generateAadhaarCardSvg
} from "./src/data/certificateSamples.js";

const app = express();
const PORT = 3000;

// Enable gzip / deflate response compression for fast page loading
app.use(compression());

// Enable JSON body parsing for API requests (15MB limit supports image upload proxy)
app.use(express.json({ limit: "15mb" }));

// Persistent File Paths
const USERS_DATA_FILE = path.join(process.cwd(), "data", "users.json");
const TEACHERS_DATA_FILE = path.join(process.cwd(), "data", "teachers.json");
const BOOKINGS_DATA_FILE = path.join(process.cwd(), "data", "bookings.json");
const DEMO_QUERIES_DATA_FILE = path.join(process.cwd(), "data", "demo_queries.json");
const GALLERY_DATA_FILE = path.join(process.cwd(), "data", "gallery.json");
const SUCCESS_STORIES_DATA_FILE = path.join(process.cwd(), "data", "success_stories.json");
const ACTIVITY_LOGS_DATA_FILE = path.join(process.cwd(), "data", "activity_logs.json");
const HERO_BANNERS_DATA_FILE = path.join(process.cwd(), "data", "hero_banners.json");
const PARENTS_DATA_FILE = path.join(process.cwd(), "data", "parents.json");

function ensureDirectoryExists(filePath: string) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// Hero Banners Store
export interface ServerHeroBanner {
  id: string;
  url: string;
  active: boolean;
  createdAt: string;
}

function loadSavedHeroBanners(): ServerHeroBanner[] {
  try {
    if (fs.existsSync(HERO_BANNERS_DATA_FILE)) {
      const raw = fs.readFileSync(HERO_BANNERS_DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (err) {
    console.warn("[Server Hero Banners Store] Read notice:", err);
  }
  return [
    {
      id: "banner-default-01",
      url: "/images/defaults/tutor_hero_guidance.jpg",
      active: true,
      createdAt: new Date().toISOString()
    }
  ];
}

function saveHeroBanners(banners: ServerHeroBanner[]) {
  try {
    ensureDirectoryExists(HERO_BANNERS_DATA_FILE);
    fs.writeFileSync(HERO_BANNERS_DATA_FILE, JSON.stringify(banners, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Server Hero Banners Store] Write notice:", err);
  }
}

let heroBannersDatabase: ServerHeroBanner[] = loadSavedHeroBanners();

// Live Cloud Firestore REST Reader (Keeps Express API 100% synchronized with Cloud Firestore)
const FIRESTORE_PROJECT_ID = "kumariinstitute-80399";
const FIRESTORE_DB_ID = "(default)";
const firestoreRestCache = new Map<string, { ts: number; data: any[] }>();
const FIRESTORE_CACHE_TTL_MS = 4000;

function decodeFirestoreValueServer(val: any): any {
  if (!val || typeof val !== "object") return undefined;
  if ("stringValue" in val) return val.stringValue;
  if ("booleanValue" in val) return Boolean(val.booleanValue);
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return Number(val.doubleValue);
  if ("timestampValue" in val) return val.timestampValue;
  if ("nullValue" in val) return null;
  if ("arrayValue" in val) {
    const arr = Array.isArray(val.arrayValue?.values) ? val.arrayValue.values : [];
    return arr.map((item: any) => decodeFirestoreValueServer(item));
  }
  if ("mapValue" in val) {
    const fields = val.mapValue?.fields || {};
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(fields)) {
      out[k] = decodeFirestoreValueServer(v);
    }
    return out;
  }
  return undefined;
}

async function fetchLiveFirestoreCollectionServer(collectionName: string, forceFresh = false): Promise<any[]> {
  const cached = firestoreRestCache.get(collectionName);
  if (!forceFresh && cached && Date.now() - cached.ts < FIRESTORE_CACHE_TTL_MS) {
    return cached.data;
  }
  try {
    const url = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/${encodeURIComponent(
      FIRESTORE_DB_ID
    )}/documents/${encodeURIComponent(collectionName)}?pageSize=300`;
    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const payload: any = await resp.json();
    const docs = Array.isArray(payload?.documents) ? payload.documents : [];
    const parsed = docs.map((d: any) => {
      const docId = String(d?.name || "").split("/").pop() || "";
      const fields = d?.fields || {};
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(fields)) {
        out[k] = decodeFirestoreValueServer(v);
      }
      return {
        ...out,
        _docId: docId,
        id: docId
      };
    });
    firestoreRestCache.set(collectionName, { ts: Date.now(), data: parsed });
    return parsed;
  } catch (err) {
    console.warn(`[Server Firestore Sync] ${collectionName} read notice:`, (err as any)?.message || err);
    return cached?.data || [];
  }
}

function normalizeServerTutorRecord(rawDoc: any): Tutor | null {
  if (!rawDoc) return null;
  const docId = String(rawDoc._docId || rawDoc.uid || rawDoc.id || "").trim();
  const canonicalId = docId.replace(/^fb_teacher_/, "").trim();
  const rawName = String(rawDoc.fullName || rawDoc.name || "").trim();
  if (!canonicalId || !rawName) return null;

  const isApproved = Boolean(
    (rawDoc.verified === true && (rawDoc.isApproved === true || rawDoc.status === "approved")) ||
      rawDoc.kycStatus === "approved" ||
      rawDoc.kycStatus === "verified" ||
      rawDoc.status === "approved" ||
      rawDoc.isApproved === true ||
      rawDoc.verificationStatus === "Verified Genuine Tutor"
  );
  const isRejected = rawDoc.status === "rejected";
  const status: "approved" | "pending" | "rejected" = isRejected
    ? "rejected"
    : isApproved
    ? "approved"
    : "pending";

  const hourly =
    Number(rawDoc.hourlyRate) ||
    Number(rawDoc.hourlyCharges) ||
    Number(rawDoc.hourlyFee) ||
    (Number(rawDoc.monthlyFee) ? Math.round(Number(rawDoc.monthlyFee) / 30) : 0);
  const monthly = Number(rawDoc.monthlyFee) || Number(rawDoc.feeAmount) || (hourly > 0 ? hourly * 30 : 0);
  const expYears = Number(rawDoc.experienceYears) || 0;

  const normalized: any = {
    ...rawDoc,
    id: canonicalId,
    uid: rawDoc.uid || canonicalId,
    name: rawName,
    fullName: rawName,
    email: rawDoc.email || "",
    phone: rawDoc.phone || "",
    qualification: rawDoc.highestQualification || rawDoc.qualification || "",
    experienceYears: expYears,
    experienceText: expYears > 0 ? `${expYears}+ Yrs Exp` : "",
    subjects: Array.isArray(rawDoc.subjects) ? rawDoc.subjects : [],
    classesHandled: Array.isArray(rawDoc.classesHandled)
      ? rawDoc.classesHandled
      : Array.isArray(rawDoc.classes)
      ? rawDoc.classes
      : [],
    boardsSupported: Array.isArray(rawDoc.boardsSupported) ? rawDoc.boardsSupported : [],
    monthlyFee: monthly,
    hourlyRate: hourly,
    hourlyCharges: hourly,
    bio: rawDoc.bio || "",
    avatar: rawDoc.avatar || rawDoc.photoUrl || "",
    locationArea: rawDoc.locationArea || rawDoc.locality || rawDoc.addressDetails?.street || "Rayagada",
    addressSnippet: rawDoc.address || rawDoc.addressSnippet || rawDoc.locality || "",
    latitude: typeof rawDoc.latitude === "number" && !isNaN(rawDoc.latitude) ? rawDoc.latitude : 19.1691,
    longitude: typeof rawDoc.longitude === "number" && !isNaN(rawDoc.longitude) ? rawDoc.longitude : 83.415,
    gender: rawDoc.gender === "male" ? "male" : "female",
    teacherType: rawDoc.teacherType === "both" ? "both" : "home",
    verified: isApproved && rawDoc.verified !== false,
    isApproved: isApproved && !isRejected,
    status,
    profileCompleted: Boolean(
      rawDoc.profileCompleted === true ||
        rawDoc.educationDetails?.tenth?.marksheetUrl ||
        rawDoc.educationDetails?.twelfth?.marksheetUrl ||
        rawDoc.aadhaarDocUrl ||
        rawDoc.feeStructure
    ),
    availableTimeSlots: Array.isArray(rawDoc.availableTimeSlots)
      ? rawDoc.availableTimeSlots
      : Array.isArray(rawDoc.availableTimings)
      ? rawDoc.availableTimings
      : Array.isArray(rawDoc.timeSlots)
      ? rawDoc.timeSlots
      : [],
    reviews: Array.isArray(rawDoc.reviews) ? rawDoc.reviews : [],
    teachingHighlights: Array.isArray(rawDoc.teachingHighlights) ? rawDoc.teachingHighlights : [],
    distanceKm: 0,
    availabilityText: rawDoc.availabilityText || "Available for Home Tuition",
    availabilityType: "available_now",
    availabilityBadge: isApproved ? "Verified Genuine Home Tutor" : "Pending Verification"
  };

  if (isFakeTeacherRecord(normalized)) return null;
  return normalized as Tutor;
}

async function getMergedLiveTeachersServer(): Promise<Tutor[]> {
  // Single authoritative tutor collection: 'teachers' (complete_tutors retired).
  const fsTeachers = await fetchLiveFirestoreCollectionServer("teachers");
  const teachersById = new Map<string, any>();

  for (const d of fsTeachers) {
    const rawDocId = String(d?._docId || d?.id || "").trim();
    if (rawDocId.toLowerCase().startsWith("fb_teacher_") && !d?.name && !d?.fullName) {
      continue; // Ignore nameless legacy ghost stubs
    }
    const canonicalId = String(d?.uid || rawDocId).replace(/^fb_teacher_/, "").trim();
    if (!canonicalId) continue;
    // Prefer canonical UID doc over any prefixed duplicate
    if (!teachersById.has(canonicalId) || rawDocId === canonicalId) {
      teachersById.set(canonicalId, { ...d, _docId: canonicalId, id: canonicalId, uid: canonicalId });
    }
  }

  const merged: Tutor[] = [];
  teachersById.forEach((teacherDoc) => {
    const parsed = normalizeServerTutorRecord(teacherDoc);
    if (parsed) merged.push(parsed);
  });

  if (merged.length > 0) {
    return merged.sort(
      (a: any, b: any) =>
        new Date(b.updatedAt || b.submittedAt || b.createdAt || 0).getTime() -
        new Date(a.updatedAt || a.submittedAt || a.createdAt || 0).getTime()
    );
  }

  return loadSavedTeachers().filter((t) => !isFakeTeacherRecord(t));
}

function deduplicateServerBookedTutors(bookedArr: any[], hiredArr: any[]): any[] {
  const byKey = new Map<string, any>();
  const statusRank = (s: any) => {
    const v = String(s || "").toLowerCase();
    if (v === "active" || v === "accepted" || v === "assigned" || v === "reassigned") return 3;
    if (v === "pending") return 2;
    return 1;
  };

  const ingest = (list: any[]) => {
    if (!Array.isArray(list)) return;
    for (const raw of list) {
      if (!raw || typeof raw !== "object") continue;
      const bookingId = String(raw.bookingId || (String(raw.id || "").startsWith("book-") ? raw.id : "") || "").trim();
      const key =
        bookingId ||
        String(raw.id || "").trim() ||
        `${String(raw.tutorId || raw.tutorName || "").toLowerCase()}_${String(raw.timeSlot || raw.timing || "").toLowerCase()}`;
      if (!key) continue;

      const normalized = {
        ...raw,
        bookingId: bookingId || raw.bookingId || raw.id,
        timing: raw.timing || raw.timeSlot || "",
        timeSlot: raw.timeSlot || raw.timing || "",
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
          timing: primary.timing || secondary.timing || "",
          timeSlot: primary.timeSlot || secondary.timeSlot || "",
          tutorName: primary.tutorName || primary.name || secondary.tutorName || secondary.name || "Home Tutor"
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

// Helper to exclude fake/sample parents
function isFakeParentRecord(u: any): boolean {
  if (!u) return true;
  const uid = String(u.uid || u.id || '').toLowerCase().trim();
  const name = String(u.fullName || u.name || u.parentName || '').toLowerCase().trim();
  const child = String(u.childName || u.studentName || '').toLowerCase().trim();
  const email = String(u.email || '').toLowerCase().trim();

  // Exclude institute admin account from parents directory
  if (email === 'kkumariinstitute@gmail.com') {
    return true;
  }

  // Must have a real name
  if (
    !name ||
    name === 'parent' ||
    name === 'test' ||
    name === 'test parent' ||
    name === 'registered parent' ||
    name.includes('demo') ||
    name.includes('sample') ||
    name.includes('mock') ||
    name.includes('fake')
  ) {
    return true;
  }
  if (uid.includes('demo') || uid.includes('sample') || uid.includes('mock') || uid.includes('fake')) {
    return true;
  }

  const grade = String(u.childGrade || u.studentGrade || u.grade || u.class || '').toLowerCase().trim();
  const school = String(u.childSchool || u.school || '').toLowerCase().trim();
  const hasRealBookings =
    (Array.isArray(u.bookedTutors) && u.bookedTutors.length > 0) ||
    (Array.isArray(u.hiredTutors) && u.hiredTutors.length > 0);
  const hasStudentDetails =
    child.length > 0 ||
    grade.length > 0 ||
    school.length > 0 ||
    (Array.isArray(u.subjectsNeeded) && u.subjectsNeeded.length > 0) ||
    u.learningRequirementsSubmitted === true;
  const hasCompletedRegistration = u.profileCompleted === true || hasStudentDetails || hasRealBookings;

  if (!hasCompletedRegistration) {
    return true;
  }

  return (
    uid.includes('parent-ramesh-patnaik') ||
    uid.includes('parent-sasmita-sahu') ||
    uid.includes('parent-deepak-mohanty') ||
    uid.includes('aa3qpbnfr4eimeftvmrj0vatvdq2') ||
    uid.includes('kqc3hy8leicwk9blsnek3t8mxdx2') ||
    name === 'ramesh patnaik' ||
    name === 'sasmita sahu' ||
    name === 'deepak mohanty' ||
    name === 'anjan naik' ||
    child === 'ananya patnaik' ||
    child === 'aryan sahu' ||
    child === 'subhashree mohanty'
  );
}

// Helper to exclude mock/sample tutors (e.g. Divya)
function isFakeTeacherRecord(t: any): boolean {
  if (!t) return true;
  const id = String(t.id || t.uid || '').toLowerCase();
  const name = String(t.name || t.fullName || '').toLowerCase().trim();
  if (!name || name === 'educator' || name.includes('educator') || id.includes('educator')) {
    return true;
  }
  return (
    id.includes('priya-sharma') ||
    id.includes('rakesh-tripathy') ||
    id.includes('sneha-patel') ||
    id.includes('sagar-das') ||
    id.includes('anita-mohanty') ||
    id.includes('t7rcs2ymnyymgjwneqhqeazwale2') ||
    name.includes('divya') ||
    name.includes('divya deep')
  );
}

// 1. Users Store
function loadSavedUsers(): Record<string, any> {
  try {
    if (fs.existsSync(USERS_DATA_FILE)) {
      const content = fs.readFileSync(USERS_DATA_FILE, "utf-8");
      const parsed = JSON.parse(content) || {};
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (!isFakeParentRecord(v) && !isFakeTeacherRecord(v)) {
          clean[k] = v;
        }
      }
      return clean;
    }
  } catch (err) {
    console.warn("[Server User Store] Read notice:", err);
  }
  return {};
}

function persistUsers(usersMap: Record<string, any>) {
  try {
    ensureDirectoryExists(USERS_DATA_FILE);
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(usersMap)) {
      if (!isFakeParentRecord(v) && !isFakeTeacherRecord(v)) {
        clean[k] = v;
      }
    }
    fs.writeFileSync(USERS_DATA_FILE, JSON.stringify(clean, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Server User Store] Write notice:", err);
  }
}

let usersDatabase: Record<string, any> = loadSavedUsers();

// Parents Store (Exclusively Registered Parents)
function loadSavedParents(): Record<string, any> {
  try {
    if (fs.existsSync(PARENTS_DATA_FILE)) {
      const content = fs.readFileSync(PARENTS_DATA_FILE, "utf-8");
      const parsed = JSON.parse(content) || {};
      const clean: Record<string, any> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (!isFakeParentRecord(v) && (v as any)?.role === 'parent') {
          clean[k] = v;
        }
      }
      return clean;
    }
  } catch (err) {
    console.warn("[Server Parent Store] Read notice:", err);
  }
  return {};
}

function persistParents(parentsMap: Record<string, any>) {
  try {
    ensureDirectoryExists(PARENTS_DATA_FILE);
    fs.writeFileSync(PARENTS_DATA_FILE, JSON.stringify(parentsMap, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Server Parent Store] Write notice:", err);
  }
}

let parentsDatabase: Record<string, any> = loadSavedParents();

// 2. Teachers Store (Preserving Verification, Certificates & Booking status)
function loadSavedTeachers(): Tutor[] {
  try {
    if (fs.existsSync(TEACHERS_DATA_FILE)) {
      const raw = fs.readFileSync(TEACHERS_DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
          .filter((t) => !isFakeTeacherRecord(t))
          .map((t) => enrichTeacherCertificates(t));
      }
    }
  } catch (err) {
    console.warn("[Server Teachers Store] Read notice:", err);
  }

  // Fallback to collect from usersDatabase
  const fromUsers: Tutor[] = [];
  const seenIds = new Set<string>();
  Object.values(usersDatabase).forEach((u: any) => {
    if (u && u.role === "teacher" && u.uid && !seenIds.has(u.uid) && !isFakeTeacherRecord(u)) {
      seenIds.add(u.uid);
      const rawName = (u.fullName || u.name || '').trim();
      const tutor: Tutor = {
        id: u.uid,
        name: rawName,
        qualification: u.highestQualification || u.qualification || "",
        experienceYears: typeof u.experienceYears === "number" ? u.experienceYears : 0,
        experienceText: u.experienceYears ? `${u.experienceYears}+ Yrs Exp` : "New Tutor",
        subjects: Array.isArray(u.subjects) ? u.subjects : [],
        distanceKm: 0,
        availabilityText: "Available",
        availabilityType: "available_now",
        availabilityBadge: u.badge || "Verified Home Tutor",
        rating: typeof u.rating === "number" ? u.rating : 0,
        reviewCount: typeof u.reviewCount === "number" ? u.reviewCount : 0,
        monthlyFee: (typeof u.hourlyRate === "number" && u.hourlyRate > 0) || (typeof u.hourlyCharges === "number" && u.hourlyCharges > 0)
          ? ((typeof u.hourlyRate === "number" && u.hourlyRate > 0 ? u.hourlyRate : (u.hourlyCharges as number)) * 30)
          : (typeof u.monthlyFee === "number" && u.monthlyFee > 0 ? u.monthlyFee : 3000),
        hourlyRate: typeof u.hourlyRate === "number" && u.hourlyRate > 0
          ? u.hourlyRate
          : (typeof u.hourlyCharges === "number" && u.hourlyCharges > 0
              ? u.hourlyCharges
              : (typeof u.monthlyFee === "number" && u.monthlyFee > 0 ? Math.round(u.monthlyFee / 30) : 100)),
        bio: u.bio || "",
        avatar: u.avatar || u.photoUrl || "",
        gender: u.gender === "male" ? "male" : "female",
        teacherType: u.teacherType || "home",
        classesHandled: Array.isArray(u.classesHandled) ? u.classesHandled : [],
        boardsSupported: Array.isArray(u.boardsSupported) ? u.boardsSupported : [],
        locationArea: u.locality || u.locationArea || "",
        addressSnippet: u.address || u.locality || "",
        verified: Boolean(u.verified || u.isApproved),
        status: u.status || (u.isApproved ? "approved" : "pending"),
        isApproved: Boolean(u.isApproved),
        isBooked: Boolean(u.isBooked),
        latitude: typeof u.latitude === "number" ? u.latitude : 19.1691,
        longitude: typeof u.longitude === "number" ? u.longitude : 83.4150,
        teachingHighlights: Array.isArray(u.teachingHighlights) ? u.teachingHighlights : [],
        reviews: Array.isArray(u.reviews) ? u.reviews : []
      };
      fromUsers.push(enrichTeacherCertificates(tutor));
    }
  });
  return fromUsers;
}

function enrichTeacherCertificates(t: Tutor): Tutor {
  const tenthScore = t.educationDetails?.tenth?.score || '91.2%';
  const tenthYear = t.educationDetails?.tenth?.year || '2016';
  const twelfthScore = t.educationDetails?.twelfth?.score || '88.4%';
  const twelfthYear = t.educationDetails?.twelfth?.year || '2018';
  const degreeYear = t.educationDetails?.degree?.year || '2021';
  const degreeName = t.qualification || 'Bachelor of Science (B.Sc)';

  return {
    ...t,
    status: t.status || (t.isApproved ? 'approved' : 'pending'),
    isApproved: Boolean(t.isApproved || t.status === 'approved'),
    isBooked: Boolean(t.isBooked),
    bookingStatus: t.isBooked ? 'booked' : 'available',
    certificates: {
      tenth: {
        name: t.educationDetails?.tenth?.marksheetName || `${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_10th_marksheet.jpg`,
        url: t.educationDetails?.tenth?.marksheetUrl || generateTenthMarksheetSvg(t.name, tenthYear, tenthScore, t.educationDetails?.tenth?.school || 'Rayagada High School'),
        score: tenthScore,
        year: tenthYear,
        board: t.educationDetails?.tenth?.board || 'Board of Secondary Education, Odisha'
      },
      twelfth: {
        name: t.educationDetails?.twelfth?.marksheetName || `${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_12th_marksheet.jpg`,
        url: t.educationDetails?.twelfth?.marksheetUrl || generateTwelfthMarksheetSvg(t.name, twelfthYear, twelfthScore, t.educationDetails?.twelfth?.college || 'Rayagada Autonomous College'),
        score: twelfthScore,
        year: twelfthYear,
        board: t.educationDetails?.twelfth?.board || 'Council of Higher Secondary Education, Odisha'
      },
      degree: {
        name: t.educationDetails?.degree?.marksheetName || `${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_degree_certificate.jpg`,
        url: t.educationDetails?.degree?.marksheetUrl || generateDegreeCertificateSvg(t.name, degreeName, t.educationDetails?.degree?.university || 'Berhampur University', degreeYear),
        score: t.educationDetails?.degree?.score || '85.0%',
        year: degreeYear,
        course: degreeName,
        university: t.educationDetails?.degree?.university || 'Berhampur University'
      },
      idProof: {
        name: `${t.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_aadhaar_card.jpg`,
        url: t.aadhaarDocUrl || generateAadhaarCardSvg(t.name, t.aadhaarNumber || '8492 1048 3921', t.locationArea || 'Rayagada'),
        docNumber: t.aadhaarNumber || '8492 1048 3921',
        type: 'Aadhaar Card (Govt. of India)'
      }
    }
  };
}

function saveTeachersToFile(teachers: Tutor[]) {
  try {
    ensureDirectoryExists(TEACHERS_DATA_FILE);
    const clean = (teachers || []).filter((t) => !isFakeTeacherRecord(t));
    fs.writeFileSync(TEACHERS_DATA_FILE, JSON.stringify(clean, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Server Teachers Store] Write notice:", err);
  }
}

let teachersDatabase: Tutor[] = loadSavedTeachers();

// 3. Bookings Store
function loadSavedBookings(): any[] {
  try {
    if (fs.existsSync(BOOKINGS_DATA_FILE)) {
      const raw = fs.readFileSync(BOOKINGS_DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("[Server Bookings Store] Read notice:", err);
  }
  return [];
}

function persistBookings(bookings: any[]) {
  try {
    ensureDirectoryExists(BOOKINGS_DATA_FILE);
    fs.writeFileSync(BOOKINGS_DATA_FILE, JSON.stringify(bookings, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Server Bookings Store] Write notice:", err);
  }
}

let bookingsDatabase: any[] = loadSavedBookings();

// 4. Offline Demo Queries Store
function loadSavedDemoQueries(): any[] {
  try {
    if (fs.existsSync(DEMO_QUERIES_DATA_FILE)) {
      const raw = fs.readFileSync(DEMO_QUERIES_DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("[Server Demo Queries Store] Read notice:", err);
  }
  return [];
}

function persistDemoQueries(queries: any[]) {
  try {
    ensureDirectoryExists(DEMO_QUERIES_DATA_FILE);
    fs.writeFileSync(DEMO_QUERIES_DATA_FILE, JSON.stringify(queries, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Server Demo Queries Store] Write notice:", err);
  }
}

let demoQueriesDatabase: any[] = loadSavedDemoQueries();

// 5. Gallery Store
function loadSavedGallery(): any[] {
  try {
    if (fs.existsSync(GALLERY_DATA_FILE)) {
      const raw = fs.readFileSync(GALLERY_DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("[Server Gallery Store] Read notice:", err);
  }
  return [];
}

function persistGallery(items: any[]) {
  try {
    ensureDirectoryExists(GALLERY_DATA_FILE);
    fs.writeFileSync(GALLERY_DATA_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Server Gallery Store] Write notice:", err);
  }
}

let galleryDatabase: any[] = loadSavedGallery();

// 6. Success Stories Store
function loadSavedSuccessStories(): any[] {
  try {
    if (fs.existsSync(SUCCESS_STORIES_DATA_FILE)) {
      const raw = fs.readFileSync(SUCCESS_STORIES_DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("[Server Success Stories Store] Read notice:", err);
  }
  return [];
}

function persistSuccessStories(stories: any[]) {
  try {
    ensureDirectoryExists(SUCCESS_STORIES_DATA_FILE);
    fs.writeFileSync(SUCCESS_STORIES_DATA_FILE, JSON.stringify(stories, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Server Success Stories Store] Write notice:", err);
  }
}

let successStoriesDatabase: any[] = loadSavedSuccessStories();

// 7. Activity Logs Store (Audit Trail for Admin Actions & Received Payments)
function getDefaultSeedActivityLogs(): any[] {
  return [];
}

function loadSavedActivityLogs(): any[] {
  try {
    if (fs.existsSync(ACTIVITY_LOGS_DATA_FILE)) {
      const raw = fs.readFileSync(ACTIVITY_LOGS_DATA_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn("[Server Activity Logs Store] Read notice:", err);
  }
  return [];
}

function persistActivityLogs(logs: any[]) {
  try {
    ensureDirectoryExists(ACTIVITY_LOGS_DATA_FILE);
    fs.writeFileSync(ACTIVITY_LOGS_DATA_FILE, JSON.stringify(logs, null, 2), "utf-8");
  } catch (err) {
    console.warn("[Server Activity Logs Store] Write notice:", err);
  }
}

let activityLogsDatabase: any[] = loadSavedActivityLogs();

function recordActivityLog(logData: any) {
  const fullLog = {
    id: logData.id || `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    adminName: logData.adminName || "Kumari Institute Admin",
    adminEmail: logData.adminEmail || "kkumariinstitute@gmail.com",
    adminAvatar: logData.adminAvatar || "/images/defaults/student_rohit.jpg",
    actionType: logData.actionType,
    category: logData.category || "tutors",
    title: logData.title,
    description: logData.description,
    targetId: logData.targetId || "",
    targetName: logData.targetName || "",
    studentName: logData.studentName || "",
    parentName: logData.parentName || "",
    parentPhone: logData.parentPhone || "",
    tutorName: logData.tutorName || "",
    courseTitle: logData.courseTitle || "",
    amount: typeof logData.amount === "number" ? logData.amount : undefined,
    paymentMethod: logData.paymentMethod || undefined,
    transactionId: logData.transactionId || undefined,
    receiptNo: logData.receiptNo || undefined,
    status: logData.status || "completed",
    notes: logData.notes || "",
    timestamp: logData.timestamp || new Date().toISOString()
  };

  activityLogsDatabase.unshift(fullLog);
  persistActivityLogs(activityLogsDatabase);
  console.log(`[Audit Log] Recorded: [${fullLog.actionType}] by ${fullLog.adminName}: ${fullLog.title}`);
  return fullLog;
}


/**
 * Haversine Formula:
 * Calculates the great-circle distance between two points on the Earth's surface
 * using their latitude and longitude in kilometers.
 * 
 * Formula:
 * a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
 * c = 2 * atan2(√a, √(1−a))
 * d = R * c
 * (where R = 6371 km Earth radius)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's mean radius in kilometers
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  // Round to 1 decimal place (e.g., 1.4 km)
  return Math.round(distance * 10) / 10;
}

// ---------------------------------------------------------------------------
// REST API ENDPOINTS
// ---------------------------------------------------------------------------

// 1. Health Check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "TutorConnect Location & Matching Engine",
    timestamp: new Date().toISOString(),
    totalRegisteredTeachers: teachersDatabase.length,
  });
});

// 2. Get All Approved Teachers for Public "Find Home Tutor" Search
// STRICT RULE: Only genuine tutors accepted by admin (isApproved === true) are visible to parents!
app.get("/api/teachers", async (req, res) => {
  const { subject, classLevel } = req.query;
  const currentTeachers = await getMergedLiveTeachersServer();
  // Strictly filter to genuine approved tutors only
  let filtered = currentTeachers.filter((t) => {
    if (isFakeTeacherRecord(t)) return false;
    return (t.isApproved === true || t.status === "approved") && t.verified === true && t.status !== "rejected";
  });

  if (subject && typeof subject === "string" && subject !== "All Subjects") {
    filtered = filtered.filter((t) =>
      t.subjects.some((s) => s.toLowerCase().includes(subject.toLowerCase()))
    );
  }

  if (classLevel && typeof classLevel === "string" && !classLevel.includes("All")) {
    filtered = filtered.filter((t) =>
      t.classesHandled.some((c) => c.toLowerCase().includes(classLevel.toLowerCase()))
    );
  }

  res.json({
    success: true,
    count: filtered.length,
    teachers: filtered,
  });
});

// 2b. Admin Endpoint: Get All Teachers (Pending, Approved & Rejected with full certificates)
app.get("/api/admin/teachers", async (_req, res) => {
  const realTeachers = await getMergedLiveTeachersServer();
  res.json({
    success: true,
    total: realTeachers.length,
    pendingCount: realTeachers.filter((t) => t.status !== "rejected" && !(t.status === "approved" || t.isApproved)).length,
    approvedCount: realTeachers.filter((t) => t.status !== "rejected" && (t.status === "approved" || t.isApproved)).length,
    teachers: realTeachers,
  });
});

// 2c. Admin Endpoint: Verify / Accept Tutor as Genuine or Reject
app.post("/api/admin/teachers/:id/verify", (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body; // status: 'approved' | 'rejected'

  const idx = teachersDatabase.findIndex((t) => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: "Teacher not found in database." });
  }

  const isApproved = status === "approved";
  const teacherName = teachersDatabase[idx].name;

  if (!isApproved) {
    const updatedTeacher: Tutor = {
      ...teachersDatabase[idx],
      status: "rejected",
      isApproved: false,
      verified: false,
      verificationStatus: "Rejected",
      rejectionReason: notes || "Documents require revision",
      updatedAt: new Date().toISOString()
    };
    teachersDatabase[idx] = updatedTeacher;
    saveTeachersToFile(teachersDatabase);

    if (usersDatabase[id]) {
      usersDatabase[id] = {
        ...usersDatabase[id],
        isApproved: false,
        verified: false,
        status: "rejected",
        verificationStatus: "Rejected",
      };
      persistUsers(usersDatabase);
    }

    recordActivityLog({
      adminName: req.body.adminName || "Kumari Institute Admin",
      adminEmail: req.body.adminEmail || "kkumariinstitute@gmail.com",
      actionType: "tutor_rejected",
      category: "tutors",
      title: `Tutor ${teacherName} Verification Rejected`,
      description: `Verification status set to Rejected for tutor ${teacherName}. Reason: ${notes || "Documents require revision"}.`,
      targetId: id,
      targetName: teacherName,
      tutorName: teacherName,
      status: "flagged",
      notes: notes || "Documents require revision"
    });

    console.log(`[Admin Action] Tutor ${teacherName} (${id}) status updated to Rejected in database.`);
    return res.json({
      success: true,
      message: `Tutor ${teacherName} verification status updated to Rejected directly in database.`,
      teacher: updatedTeacher
    });
  }

  const updatedTeacher: Tutor = {
    ...teachersDatabase[idx],
    status: "approved",
    isApproved: true,
    verified: true,
    kycStatus: "approved",
    verificationStatus: "Verified Genuine Tutor",
    approvedAt: new Date().toISOString(),
    rejectionReason: undefined
  };

  teachersDatabase[idx] = updatedTeacher;
  saveTeachersToFile(teachersDatabase);

  // Sync to usersDatabase if exists
  Object.keys(usersDatabase).forEach((uid) => {
    const u = usersDatabase[uid];
    if (
      uid === id ||
      u.id === id ||
      (u.email && updatedTeacher.email && u.email.toLowerCase() === updatedTeacher.email.toLowerCase()) ||
      (u.phone && updatedTeacher.phone && u.phone === updatedTeacher.phone)
    ) {
      usersDatabase[uid] = {
        ...u,
        isApproved: true,
        verified: true,
        status: "approved",
        kycStatus: "approved",
        verificationStatus: "Verified Genuine Tutor"
      };
    }
  });
  persistUsers(usersDatabase);

  // Record Admin Activity Log for auditability
  recordActivityLog({
    adminName: req.body.adminName || "Kumari Institute Admin",
    adminEmail: req.body.adminEmail || "kkumariinstitute@gmail.com",
    actionType: "tutor_approved",
    category: "tutors",
    title: `Tutor ${updatedTeacher.name} Approved Genuine`,
    description: `Audited credentials & verified tutor ${updatedTeacher.name} for subjects: ${updatedTeacher.subjects.join(', ')}.`,
    targetId: updatedTeacher.id,
    targetName: updatedTeacher.name,
    tutorName: updatedTeacher.name,
    status: "completed",
    notes: notes || "Aadhaar & educational certificates validated."
  });

  console.log(`[Admin Action] Tutor ${updatedTeacher.name} (${id}) status set to approved`);
  res.json({
    success: true,
    message: `Tutor ${updatedTeacher.name} accepted as genuine home tutor!`,
    teacher: updatedTeacher,
  });
});

// 2d. Admin Endpoint: Add Authentic Review / Testimonial for Tutor
app.post("/api/admin/teachers/:id/reviews", (req, res) => {
  const { id } = req.params;
  const { parentName, relation, rating, comment, studentGrade, schoolName, verifiedBooking } = req.body;

  if (!parentName || !comment) {
    return res.status(400).json({ success: false, error: "Parent name and review comment are required." });
  }

  const idx = teachersDatabase.findIndex((t) => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: "Tutor not found in database." });
  }

  const tutor = teachersDatabase[idx];
  const currentReviews = Array.isArray(tutor.reviews) ? [...tutor.reviews] : [];

  const newReview = {
    id: `rev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    parentName: parentName.trim(),
    relation: relation?.trim() || `Parent of ${studentGrade || "student"}`,
    rating: Number(rating) || 5,
    date: new Date().toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" }),
    comment: comment.trim(),
    studentGrade: studentGrade?.trim() || "Primary Class",
    schoolName: schoolName?.trim() || "Rayagada",
    verifiedBooking: verifiedBooking !== false,
  };

  currentReviews.unshift(newReview);
  const avgRating =
    Math.round((currentReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / currentReviews.length) * 10) / 10;

  teachersDatabase[idx] = {
    ...tutor,
    reviews: currentReviews,
    rating: avgRating,
    reviewCount: currentReviews.length,
  };
  saveTeachersToFile(teachersDatabase);

  // Sync to usersDatabase if registered
  if (usersDatabase[id]) {
    usersDatabase[id] = {
      ...usersDatabase[id],
      reviews: currentReviews,
      rating: avgRating,
      reviewCount: currentReviews.length,
    };
    persistUsers(usersDatabase);
  }

  recordActivityLog({
    adminName: req.body.adminName || "Kumari Institute Admin",
    adminEmail: req.body.adminEmail || "kkumariinstitute@gmail.com",
    actionType: "tutor_approved",
    category: "tutors",
    title: `New Verified Review Published for ${tutor.name}`,
    description: `Added review from ${parentName} (${newReview.rating}★): "${comment.slice(0, 80)}..."`,
    targetId: tutor.id,
    targetName: tutor.name,
    tutorName: tutor.name,
    status: "completed",
    notes: `Rating: ${newReview.rating} Stars`
  });

  res.json({
    success: true,
    message: `Review added successfully for Tutor ${tutor.name}!`,
    review: newReview,
    teacher: teachersDatabase[idx],
  });
});

// 2e. Admin Endpoint: Delete Review from Tutor
app.delete("/api/admin/teachers/:id/reviews/:reviewId", (req, res) => {
  const { id, reviewId } = req.params;

  const idx = teachersDatabase.findIndex((t) => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: "Tutor not found." });
  }

  const tutor = teachersDatabase[idx];
  const currentReviews = Array.isArray(tutor.reviews) ? tutor.reviews.filter((r) => r.id !== reviewId) : [];
  const avgRating =
    currentReviews.length > 0
      ? Math.round((currentReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / currentReviews.length) * 10) / 10
      : 5.0;

  teachersDatabase[idx] = {
    ...tutor,
    reviews: currentReviews,
    rating: avgRating,
    reviewCount: currentReviews.length,
  };
  saveTeachersToFile(teachersDatabase);

  res.json({
    success: true,
    message: "Review removed.",
    teacher: teachersDatabase[idx],
  });
});

// 3. Parent Proximity Search: Live-Location Nearby Teachers
// Accepts parent GPS coordinates (lat, lng), radius in km (default 20 km), and filters.
// STRICT RULE: Only genuine tutors accepted by admin (isApproved === true) are matched and shown!
app.get("/api/teachers/nearby", async (req, res) => {
  const latStr = req.query.lat as string;
  const lngStr = req.query.lng as string;
  const radiusStr = (req.query.radius as string) || "20";
  const subject = req.query.subject as string;
  const classLevel = req.query.classLevel as string;

  if (!latStr || !lngStr) {
    res.status(400).json({
      success: false,
      error: "Missing required query parameters: 'lat' and 'lng' are required.",
    });
    return;
  }

  const parentLat = parseFloat(latStr);
  const parentLng = parseFloat(lngStr);
  const radiusKm = parseFloat(radiusStr);

  if (isNaN(parentLat) || isNaN(parentLng)) {
    res.status(400).json({
      success: false,
      error: "Invalid coordinates provided. 'lat' and 'lng' must be valid floating point numbers.",
    });
    return;
  }

  // Strictly filter to genuine approved teachers ONLY (synced live from Firestore + local backup)
  const currentTeachers = await getMergedLiveTeachersServer();
  const approvedTeachers = currentTeachers.filter((t) => {
    if (isFakeTeacherRecord(t)) return false;
    return (t.isApproved === true || t.status === "approved") && t.verified === true && t.status !== "rejected";
  });

  // Calculate Haversine distance for approved teachers
  const teachersWithDistance = approvedTeachers.map((teacher) => {
    const distanceKm = calculateHaversineDistance(
      parentLat,
      parentLng,
      teacher.latitude,
      teacher.longitude
    );

    // Approximate travel time estimation (assuming typical 20 km/h city scooter / e-rickshaw speed in Rayagada)
    const travelTimeMinutes = Math.max(2, Math.round((distanceKm / 20) * 60));

    return {
      ...teacher,
      distanceKm,
      travelTimeMinutes,
    };
  });

  // Apply subject & class filters if specified
  let matchedTeachers = teachersWithDistance;

  if (subject && subject !== "All Subjects") {
    const sLow = subject.toLowerCase();
    matchedTeachers = matchedTeachers.filter((t) =>
      t.subjects.some((s) => s.toLowerCase().includes(sLow))
    );
  }

  if (classLevel && !classLevel.includes("All") && !classLevel.includes("1st to 6th")) {
    const numMatch = classLevel.match(/\d+/);
    const targetNum = numMatch ? parseInt(numMatch[0], 10) : NaN;
    if (!isNaN(targetNum)) {
      const exactRegex = new RegExp(`\\b${targetNum}(?:st|nd|rd|th)?\\b`, "i");
      matchedTeachers = matchedTeachers.filter((t) =>
        t.classesHandled.some((c) => {
          const rangeMatch = c.match(/(\d+)\s*(?:st|nd|rd|th)?\s*(?:-|to)\s*(\d+)/i);
          if (rangeMatch) {
            const start = parseInt(rangeMatch[1], 10);
            const end = parseInt(rangeMatch[2], 10);
            if (targetNum >= start && targetNum <= end) return true;
          }
          return exactRegex.test(c);
        })
      );
    }
  }

  // Filter teachers strictly within the specified radius
  const withinRadius = matchedTeachers.filter(
    (teacher) => teacher.distanceKm <= radiusKm
  );

  // Sort strictly from closest to farthest
  withinRadius.sort((a, b) => a.distanceKm - b.distanceKm);

  // If none or few within tight radius, also get the next closest 3 teachers for recommendation
  const allSorted = [...matchedTeachers].sort((a, b) => a.distanceKm - b.distanceKm);
  const nextClosestTeachers =
    withinRadius.length === 0
      ? allSorted.slice(0, 3)
      : allSorted.filter((t) => t.distanceKm > radiusKm).slice(0, 2);

  res.json({
    success: true,
    parentLocation: {
      latitude: parentLat,
      longitude: parentLng,
    },
    searchRadiusKm: radiusKm,
    totalMatchingInRadius: withinRadius.length,
    teachers: withinRadius,
    nextClosestTeachers: nextClosestTeachers,
    totalRegisteredTeachers: approvedTeachers.length,
  });
});

// 4. Teacher Live Location & Profile Registration
// When a teacher registers or updates their profile, their status goes to 'pending' first.
// The admin previews their uploaded details with certificates before accepting as genuine.
app.post("/api/teachers/register-location", (req, res) => {
  const {
    name,
    email,
    phone,
    latitude,
    longitude,
    address,
    locationArea,
    qualification,
    experienceYears,
    subjects,
    classesHandled,
    monthlyFee,
    hourlyRate,
    bio,
    gender,
    teacherType,
    educationDetails,
    aadhaarNumber,
    aadhaarDocUrl,
    availableTimeSlots,
    feeStructure,
    boardsSupported
  } = req.body;

  if (!name || typeof name !== "string") {
    res.status(400).json({ success: false, error: "Teacher name is required." });
    return;
  }

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    res.status(400).json({
      success: false,
      error: "Valid GPS coordinates (latitude and longitude numbers) are required.",
    });
    return;
  }

  // Check if teacher already exists (by email or phone)
  const existingIndex = teachersDatabase.findIndex(
    (t) => (email && t.email === email) || (email && t.bio?.includes(email)) || t.name.toLowerCase() === name.toLowerCase()
  );

  const teacherId =
    existingIndex >= 0
      ? teachersDatabase[existingIndex].id
      : `teacher-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

  const rawTeacher: Tutor = {
    id: teacherId,
    name: name.trim(),
    email: email || (existingIndex >= 0 ? teachersDatabase[existingIndex].email : undefined),
    phone: phone || (existingIndex >= 0 ? teachersDatabase[existingIndex].phone : undefined),
    qualification: qualification || "",
    experienceYears: Number(experienceYears) || 0,
    experienceText: experienceYears ? `${experienceYears} Years Experience` : "Verified Home Tutor",
    subjects: Array.isArray(subjects) ? subjects : [],
    distanceKm: 0,
    latitude: latitude,
    longitude: longitude,
    availabilityText: "Awaiting Admin Verification",
    availabilityType: "available_now",
    availabilityBadge: "Pending Verification",
    rating: 0,
    reviewCount: 0,
    hourlyRate: Number(hourlyRate) > 0 ? Number(hourlyRate) : (Number(monthlyFee) > 0 ? Math.round(Number(monthlyFee) / 30) : 100),
    monthlyFee: Number(monthlyFee) > 0 ? Number(monthlyFee) : (Number(hourlyRate) > 0 ? Number(hourlyRate) * 30 : 3000),
    feeStructure: feeStructure || (existingIndex >= 0 ? (teachersDatabase[existingIndex] as any).feeStructure : undefined),
    bio: bio || "",
    avatar:
      req.body.avatar ||
      req.body.photoUrl ||
      (existingIndex >= 0 ? teachersDatabase[existingIndex].avatar : "/images/defaults/tutor_priya.jpg"),
    gender: gender === "female" ? "female" : "male",
    teacherType: teacherType || "home",
    classesHandled: Array.isArray(classesHandled) ? classesHandled : [],
    boardsSupported: Array.isArray(boardsSupported) ? boardsSupported : [],
    locationArea: locationArea || "",
    addressSnippet: address || locationArea || "",
    verified: false,
    status: "pending",
    isApproved: false,
    isBooked: false,
    bookingStatus: "available",
    verificationStatus: "Pending Verification",
    submittedAt: new Date().toISOString(),
    aadhaarNumber: aadhaarNumber || "",
    aadhaarDocUrl: aadhaarDocUrl || "",
    availableTimeSlots: Array.isArray(availableTimeSlots) ? availableTimeSlots : ["4:00 PM - 5:00 PM", "5:00 PM - 6:00 PM"],
    educationDetails: educationDetails || (existingIndex >= 0 ? teachersDatabase[existingIndex].educationDetails : {}),
    teachingHighlights: Array.isArray(req.body.teachingHighlights) ? req.body.teachingHighlights : [
      "GPS Verified Location",
      "Certificates Submitted for Admin Review"
    ],
    reviews: [],
  };

  const enriched = enrichTeacherCertificates(rawTeacher);

  if (existingIndex >= 0) {
    teachersDatabase[existingIndex] = {
      ...teachersDatabase[existingIndex],
      ...enriched,
    };
  } else {
    teachersDatabase.unshift(enriched);
  }

  saveTeachersToFile(teachersDatabase);

  console.log(`[Teacher Registration] Registered ${enriched.name}. Status: PENDING admin certificate preview.`);
  res.status(201).json({
    success: true,
    message: "Teacher profile & certificates registered! Awaiting admin verification before appearing on Find Tutors.",
    teacher: enriched,
    totalTeachers: teachersDatabase.length,
  });
});

// ---------------------------------------------------------------------------
// 4B. PARENT HOME TUTOR BOOKINGS & ADMIN ASSIGNMENT API
// ---------------------------------------------------------------------------

// Get all bookings (for Admin Panel & notifications) - synced live with Firestore 'tutor_bookings'
app.get("/api/bookings", async (_req, res) => {
  const liveFirestoreBookings = await fetchLiveFirestoreCollectionServer("tutor_bookings");
  const mergedMap = new Map<string, any>();

  bookingsDatabase.forEach((b: any) => {
    if (b?.id) mergedMap.set(String(b.id), b);
  });
  liveFirestoreBookings.forEach((b: any) => {
    const id = String(b?.id || b?._docId || "");
    if (id) mergedMap.set(id, { ...mergedMap.get(id), ...b, id });
  });

  const allBookings = Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  res.json({
    success: true,
    total: allBookings.length,
    pendingCount: allBookings.filter((b) => b.status === "pending").length,
    bookings: allBookings,
  });
});

// Get all received fee records (for Admin Panel fallback) - synced live with Firestore 'received_fees'
app.get("/api/admin/received-fees", async (_req, res) => {
  const liveFees = await fetchLiveFirestoreCollectionServer("received_fees");
  liveFees.sort(
    (a, b) =>
      new Date(b.paidAt || b.createdAt || 0).getTime() -
      new Date(a.paidAt || a.createdAt || 0).getTime()
  );
  res.json({
    success: true,
    count: liveFees.length,
    fees: liveFees,
  });
});

// Parent submits a Home Tutor booking request (exclusively for Home Tutor!)
app.post("/api/bookings", (req, res) => {
  const {
    parentUid,
    parentName,
    parentPhone,
    parentEmail,
    studentName,
    studentGrade,
    subjects,
    address,
    locality,
    preferredTimeSlot,
    requestedTutorId,
    requestedTutorName,
    requestedTutorMonthlyFee,
    requestedTutorAvatar,
  } = req.body;

  if (!parentPhone || !studentName || !requestedTutorId) {
    return res.status(400).json({
      success: false,
      message: "Parent phone, student name, and requested tutor are required.",
    });
  }

  const bookingId = `book-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const newBooking = {
    id: bookingId,
    parentUid: parentUid || "",
    parentName: parentName || "Parent",
    parentPhone,
    parentEmail: parentEmail || "",
    studentName,
    studentGrade: studentGrade || "Primary Class",
    subjects: Array.isArray(subjects) ? subjects : ["Home Tuition"],
    address: address || locality || "Rayagada",
    locality: locality || "Rayagada",
    preferredTimeSlot: preferredTimeSlot || "5:00 PM - 6:00 PM",
    requestedTutorId,
    requestedTutorName: requestedTutorName || "Home Tutor",
    requestedTutorMonthlyFee: Number(requestedTutorMonthlyFee) || 3000,
    requestedTutorAvatar: requestedTutorAvatar || "",
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  bookingsDatabase.unshift(newBooking);
  persistBookings(bookingsDatabase);

  // Register bookedTimeSlots on teacher in teachersDatabase
  const tIndex = teachersDatabase.findIndex((t) => t.id === requestedTutorId);
  if (tIndex >= 0 && newBooking.preferredTimeSlot) {
    const curBooked = Array.isArray((teachersDatabase[tIndex] as any).bookedTimeSlots)
      ? [...(teachersDatabase[tIndex] as any).bookedTimeSlots]
      : [];
    if (!curBooked.includes(newBooking.preferredTimeSlot)) {
      curBooked.push(newBooking.preferredTimeSlot);
      (teachersDatabase[tIndex] as any).bookedTimeSlots = curBooked;
      saveTeachersToFile(teachersDatabase);
    }
  }

  console.log(`[Booking Notification] Parent ${newBooking.parentName} booked Home Tutor ${newBooking.requestedTutorName}. Notification sent to Admin.`);
  res.status(201).json({
    success: true,
    message: "Home tutor booking submitted! Admin has been notified to verify schedule and confirm your assignment.",
    booking: newBooking,
  });
});

// Admin accepts booking and assigns requested tutor OR re-assigns a new tutor as requested!
app.post("/api/admin/bookings/:id/accept", (req, res) => {
  const { id } = req.params;
  const { assignedTutorId, notes } = req.body;

  const bookingIndex = bookingsDatabase.findIndex((b) => b.id === id);
  if (bookingIndex === -1) {
    return res.status(404).json({ success: false, message: "Booking request not found." });
  }

  const booking = bookingsDatabase[bookingIndex];
  // Determine target tutor (either re-assigned new tutor or requested tutor)
  const targetTutorId = assignedTutorId || booking.requestedTutorId;
  const targetTutor = teachersDatabase.find((t) => t.id === targetTutorId);

  if (!targetTutor) {
    return res.status(404).json({ success: false, message: `Selected tutor (${targetTutorId}) not found in database.` });
  }

  // 1. Mark target tutor as booked and update assignedStudents in teachersDatabase
  const tutorIndex = teachersDatabase.findIndex((t) => t.id === targetTutorId);
  const targetHourly = Number(targetTutor.hourlyRate) || (targetTutor.monthlyFee ? Math.round(targetTutor.monthlyFee / 30) : 100);
  const targetMonthlyFee = targetHourly > 0 ? targetHourly * 30 : (targetTutor.monthlyFee || 3000);

  const assignedStudentData = {
    id: `std-${booking.id}`,
    bookingId: booking.id,
    name: booking.studentName,
    studentName: booking.studentName,
    grade: booking.studentGrade || "Primary Class",
    parentName: booking.parentName,
    parentPhone: booking.parentPhone,
    parentEmail: booking.parentEmail || "",
    address: booking.address,
    locality: booking.locality || "Rayagada",
    subjects: booking.subjects || targetTutor.subjects,
    timing: booking.preferredTimeSlot || "5:00 PM - 6:00 PM",
    monthlyFee: targetMonthlyFee,
    assignedAt: new Date().toISOString(),
    status: "Active"
  };

  if (tutorIndex >= 0) {
    const curStudents = Array.isArray(teachersDatabase[tutorIndex].assignedStudents)
      ? [...(teachersDatabase[tutorIndex].assignedStudents as any[])]
      : [];
    const cleanBId = booking.id.replace(/^std-/, '').trim();
    const filtered = curStudents.filter((s) => {
      const sId = (s.bookingId || s.id || '').toString().replace(/^std-/, '').trim();
      if (cleanBId && sId && cleanBId === sId) return false;
      if (s.studentName && booking.studentName && s.studentName.toLowerCase() === booking.studentName.toLowerCase()) {
        if (!s.parentPhone || !booking.parentPhone || s.parentPhone === booking.parentPhone) return false;
      }
      return true;
    });
    filtered.unshift(assignedStudentData);

    const curBooked = Array.isArray((teachersDatabase[tutorIndex] as any).bookedTimeSlots)
      ? [...(teachersDatabase[tutorIndex] as any).bookedTimeSlots]
      : [];
    if (booking.preferredTimeSlot && !curBooked.includes(booking.preferredTimeSlot)) {
      curBooked.push(booking.preferredTimeSlot);
    }

    teachersDatabase[tutorIndex] = {
      ...teachersDatabase[tutorIndex],
      isBooked: true,
      bookingStatus: "booked",
      bookedByStudentName: booking.studentName,
      bookedByParentName: booking.parentName,
      bookedByParentPhone: booking.parentPhone,
      assignedStudents: filtered,
      bookedTimeSlots: curBooked
    };
    saveTeachersToFile(teachersDatabase);
  }

  // Also update in usersDatabase for teacher if registered with UID
  if (usersDatabase[targetTutorId]) {
    const tUser = usersDatabase[targetTutorId];
    const uStudents = Array.isArray(tUser.assignedStudents) ? [...tUser.assignedStudents] : [];
    const cleanBId = booking.id.replace(/^std-/, '').trim();
    const filteredU = uStudents.filter((s: any) => {
      const sId = (s.bookingId || s.id || '').toString().replace(/^std-/, '').trim();
      if (cleanBId && sId && cleanBId === sId) return false;
      if (s.studentName && booking.studentName && s.studentName.toLowerCase() === booking.studentName.toLowerCase()) {
        if (!s.parentPhone || !booking.parentPhone || s.parentPhone === booking.parentPhone) return false;
      }
      return true;
    });
    filteredU.unshift(assignedStudentData);
    usersDatabase[targetTutorId] = {
      ...tUser,
      isBooked: true,
      assignedStudents: filteredU
    };
    persistUsers(usersDatabase);
  }

  // 2. Update the booking status to accepted / reassigned
  const isReassigned = Boolean(assignedTutorId && assignedTutorId !== booking.requestedTutorId);
  const updatedBooking = {
    ...booking,
    status: isReassigned ? "reassigned" : "accepted",
    assignedTutorId: targetTutor.id,
    assignedTutorName: targetTutor.name,
    assignedTutorPhone: targetTutor.phone || "+91 94371 88201",
    assignedTutorFee: targetMonthlyFee,
    assignedTutorAvatar: targetTutor.avatar,
    reassignedNotes: notes || (isReassigned ? `Assigned dedicated mentor ${targetTutor.name} by Admin.` : "Confirmed by Admin"),
    updatedAt: new Date().toISOString(),
  };

  bookingsDatabase[bookingIndex] = updatedBooking;
  persistBookings(bookingsDatabase);

  // 3. Update Parent's User Profile in usersDatabase (Assigned Educator & Hired Tutors list)
  const parentKey = booking.parentUid || booking.parentEmail?.toLowerCase();
  if (parentKey && usersDatabase[parentKey]) {
    const parent = usersDatabase[parentKey];
    const hiredList = Array.isArray(parent.hiredTutors) ? [...parent.hiredTutors] : [];
    
    // Check if not already added
    const alreadyHired = hiredList.some((h) => h.tutorId === targetTutor.id);
    if (!alreadyHired) {
      hiredList.unshift({
        id: `hired-${Date.now()}`,
        tutorId: targetTutor.id,
        tutorName: targetTutor.name,
        subjects: targetTutor.subjects,
        monthlyFee: targetMonthlyFee,
        phone: targetTutor.phone || "+91 94371 88201",
        locationArea: targetTutor.locationArea || "Rayagada",
        hiredAt: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        status: "Confirmed",
      });
    }

    usersDatabase[parentKey] = {
      ...parent,
      hiredTutors: hiredList,
      assignedEducator: {
        id: targetTutor.id,
        name: targetTutor.name,
        subjects: targetTutor.subjects,
        phone: targetTutor.phone || "+91 94371 88201",
        monthlyFee: targetMonthlyFee,
        rating: targetTutor.rating || 5.0,
        avatar: targetTutor.avatar,
        status: "Active",
      },
    };
    persistUsers(usersDatabase);
  }

  // Record Admin Activity Log
  recordActivityLog({
    adminName: req.body.adminName || "Kumari Institute Admin",
    adminEmail: req.body.adminEmail || "kkumariinstitute@gmail.com",
    actionType: isReassigned ? "booking_reassigned" : "booking_accepted",
    category: "bookings",
    title: isReassigned ? `Tutor Reassigned & Confirmed` : `Home Tutor Booking Accepted`,
    description: `Assigned Home Tutor ${targetTutor.name} to student ${booking.studentName} (${booking.studentGrade || "Grade School"}) for ${Array.isArray(booking.subjects) ? booking.subjects.join(", ") : "Tuition"}.`,
    targetId: booking.id,
    targetName: booking.studentName,
    studentName: booking.studentName,
    parentName: booking.parentName,
    parentPhone: booking.parentPhone,
    tutorName: targetTutor.name,
    amount: targetTutor.monthlyFee,
    status: "completed",
    notes: notes || "Tuition schedule and home address confirmed."
  });

  console.log(`[Admin Assignment] Booking ${id} accepted! Assigned Home Tutor ${targetTutor.name} to student ${booking.studentName}.`);
  res.json({
    success: true,
    message: `Home Tutor ${targetTutor.name} assigned & confirmed for student ${booking.studentName}!`,
    booking: updatedBooking,
    assignedTutor: targetTutor,
  });
});

// Admin declines parent home tutor booking request
app.post("/api/admin/bookings/:id/decline", (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const bookingIndex = bookingsDatabase.findIndex((b) => b.id === id);
  if (bookingIndex === -1) {
    return res.status(404).json({ success: false, message: "Booking request not found." });
  }

  const booking = bookingsDatabase[bookingIndex];
  const updatedBooking = {
    ...booking,
    status: "declined",
    declineReason: reason || "Tutor schedule currently unavailable for requested slot.",
    declinedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  bookingsDatabase[bookingIndex] = updatedBooking;
  persistBookings(bookingsDatabase);

  // Record Admin Activity Log
  recordActivityLog({
    adminName: req.body.adminName || "Kumari Institute Admin",
    adminEmail: req.body.adminEmail || "kkumariinstitute@gmail.com",
    actionType: "booking_declined",
    category: "bookings",
    title: `Home Tutor Booking Declined`,
    description: `Declined booking for student ${booking.studentName} with tutor ${booking.requestedTutorName}. Reason: ${updatedBooking.declineReason}`,
    targetId: booking.id,
    targetName: booking.studentName,
    studentName: booking.studentName,
    parentName: booking.parentName,
    parentPhone: booking.parentPhone,
    tutorName: booking.requestedTutorName,
    status: "completed",
    notes: updatedBooking.declineReason
  });

  console.log(`[Admin Action] Booking ${id} for student ${booking.studentName} was declined. Reason: ${updatedBooking.declineReason}`);
  res.json({
    success: true,
    message: `Booking request for ${booking.studentName} has been declined.`,
    booking: updatedBooking,
  });
});

// Parent discontinues a home tutor after a completed cycle
app.post("/api/bookings/:id/discontinue", (req, res) => {
  const { id } = req.params;
  const {
    bookingId,
    tutorId,
    tutorName,
    parentUid,
    parentEmail,
    parentPhone,
    studentName,
  } = req.body || {};

  const targetBId = String(bookingId || id || "").replace(/^std-/, "").trim();
  const targetTutorId = String(tutorId || "").trim();
  const targetTutorIdStripped = targetTutorId.replace(/^fb_teacher_/, "");
  const targetTutorNameNorm = String(tutorName || "").trim().toLowerCase();
  const studentNorm = String(studentName || "").trim().toLowerCase();
  const parentPhoneNorm = String(parentPhone || "").replace(/\D/g, "").slice(-10);

  // 1. Mark matching bookings as discontinued in bookingsDatabase
  bookingsDatabase = bookingsDatabase.map((b) => {
    const bId = String(b.id || "").replace(/^std-/, "").trim();
    const bTutorId = String(b.assignedTutorId || b.requestedTutorId || "").trim();
    const isMatch =
      (targetBId && bId === targetBId) ||
      (parentUid &&
        b.parentUid === parentUid &&
        ((targetTutorId &&
          (bTutorId === targetTutorId || bTutorId === targetTutorIdStripped)) ||
          (targetTutorNameNorm &&
            String(b.assignedTutorName || b.requestedTutorName || "")
              .trim()
              .toLowerCase() === targetTutorNameNorm)));
    if (isMatch) {
      return {
        ...b,
        status: "discontinued",
        discontinuedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
    return b;
  });
  persistBookings(bookingsDatabase);

  // 2. Remove student from teachersDatabase
  const matchesStudentEntry = (s: any) => {
    if (!s) return false;
    const sBId = String(s.bookingId || s.id || "").replace(/^std-/, "").trim();
    if (targetBId && !targetBId.startsWith("hired-") && sBId === targetBId) return true;
    const sName = String(s.studentName || s.name || "").trim().toLowerCase();
    const sPhone = String(s.parentPhone || s.phone || "").replace(/\D/g, "").slice(-10);
    if (studentNorm && sName === studentNorm) {
      if (!parentPhoneNorm || !sPhone || sPhone === parentPhoneNorm) return true;
    }
    return false;
  };

  let teachersUpdated = false;
  teachersDatabase = teachersDatabase.map((t: any) => {
    const tId = String(t.id || t.uid || "").trim();
    const tName = String(t.name || "").trim().toLowerCase();
    if (
      (targetTutorId && (tId === targetTutorId || tId === targetTutorIdStripped || `fb_teacher_${tId}` === targetTutorId)) ||
      (targetTutorNameNorm && tName === targetTutorNameNorm)
    ) {
      const cur = Array.isArray(t.assignedStudents) ? t.assignedStudents : [];
      const next = cur.filter((s: any) => !matchesStudentEntry(s));
      if (next.length !== cur.length) {
        teachersUpdated = true;
        return {
          ...t,
          assignedStudents: next,
          isBooked: next.length > 0,
          bookingStatus: next.length > 0 ? "booked" : "available",
        };
      }
    }
    return t;
  });
  if (teachersUpdated) saveTeachersToFile(teachersDatabase);

  // 3. Remove from usersDatabase (tutor & parent entries)
  let usersUpdated = false;
  for (const key of Object.keys(usersDatabase)) {
    const u = usersDatabase[key];
    if (!u) continue;
    if (
      key === targetTutorId ||
      key === targetTutorIdStripped ||
      (targetTutorNameNorm && String(u.name || "").trim().toLowerCase() === targetTutorNameNorm && u.role === "teacher")
    ) {
      const cur = Array.isArray(u.assignedStudents) ? u.assignedStudents : [];
      const next = cur.filter((s: any) => !matchesStudentEntry(s));
      if (next.length !== cur.length) {
        usersDatabase[key] = { ...u, assignedStudents: next, isBooked: next.length > 0 };
        usersUpdated = true;
      }
    }
    if (
      key === parentUid ||
      (parentEmail && String(u.email || "").trim().toLowerCase() === String(parentEmail).trim().toLowerCase())
    ) {
      const curHired = Array.isArray(u.hiredTutors) ? u.hiredTutors : [];
      const nextHired = curHired.filter((h: any) => {
        const hTId = String(h.tutorId || h.id || "").trim();
        const hTName = String(h.tutorName || h.name || "").trim().toLowerCase();
        return !(
          (targetTutorId && (hTId === targetTutorId || hTId === targetTutorIdStripped)) ||
          (targetTutorNameNorm && hTName === targetTutorNameNorm)
        );
      });
      usersDatabase[key] = {
        ...u,
        hiredTutors: nextHired,
        assignedEducator: nextHired[0] ? { ...nextHired[0], id: nextHired[0].tutorId || nextHired[0].id, name: nextHired[0].tutorName } : undefined,
      };
      usersUpdated = true;
    }
  }
  if (usersUpdated) persistUsers(usersDatabase);

  res.json({ success: true, message: "Tutor discontinued and removed from active records." });
});

// ---------------------------------------------------------------------------
// 4C. OFFLINE DEMO CLASS QUERIES (Admin queries for offline coaching classes)
// ---------------------------------------------------------------------------
app.get("/api/admin/demo-queries", (_req, res) => {
  res.json({
    success: true,
    total: demoQueriesDatabase.length,
    queries: demoQueriesDatabase,
  });
});

app.post("/api/demo-queries", (req, res) => {
  const { studentName, parentName, phone, email, grade, subject, preferredDate, preferredTime, notes } = req.body;
  if (!studentName || !phone) {
    return res.status(400).json({ success: false, message: "Student name and phone are required." });
  }

  const query = {
    id: `query-offline-${Date.now()}`,
    studentName,
    parentName: parentName || "Parent",
    phone,
    email: email || "",
    grade: grade || "Primary / Middle School",
    subject: subject || "Offline Coaching",
    preferredDate: preferredDate || new Date().toISOString().split("T")[0],
    preferredTime: preferredTime || "5:00 PM",
    notes: notes || "Inquiry for offline classroom coaching at Indira Nagar campus.",
    queryType: "offline_coaching",
    status: "new",
    createdAt: new Date().toISOString(),
  };

  demoQueriesDatabase.unshift(query);
  persistDemoQueries(demoQueriesDatabase);

  console.log(`[Offline Demo Query] Received offline class inquiry from ${studentName} (${phone})`);
  res.status(201).json({ success: true, message: "Demo query recorded successfully!", query });
});

app.post("/api/admin/demo-queries/:id/status", (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // 'contacted' | 'scheduled' | 'enrolled' | 'closed'
  const idx = demoQueriesDatabase.findIndex((q) => q.id === id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: "Demo query not found." });
  }

  demoQueriesDatabase[idx].status = status;
  persistDemoQueries(demoQueriesDatabase);

  const q = demoQueriesDatabase[idx];
  recordActivityLog({
    adminName: req.body.adminName || "Admin Rajesh Panda",
    adminEmail: req.body.adminEmail || "rajesh.panda.coord@kumari.edu.in",
    actionType: status === "scheduled" ? "demo_booking_scheduled" : "demo_booking_handled",
    category: "demo_bookings",
    title: status === "scheduled" ? `Offline Demo Class Scheduled` : `Demo Query Status: ${String(status).toUpperCase()}`,
    description: `Handled offline demo class inquiry for student ${q.studentName} (${q.grade}, ${q.subject}) - marked as ${status}.`,
    targetId: q.id,
    targetName: q.studentName,
    studentName: q.studentName,
    parentName: q.parentName,
    parentPhone: q.phone,
    status: "completed",
    notes: `Demo query status updated to ${status} by admin.`
  });

  res.json({ success: true, query: demoQueriesDatabase[idx] });
});

// ---------------------------------------------------------------------------
// 4D. GALLERY MANAGEMENT (Admin can add & delete gallery images)
// ---------------------------------------------------------------------------
app.get("/api/gallery", (_req, res) => {
  res.json({ success: true, count: galleryDatabase.length, items: galleryDatabase });
});

app.post("/api/gallery", (req, res) => {
  const { title, subtitle, category, image, alt, iconType } = req.body;
  if (!title || !image) {
    return res.status(400).json({ success: false, message: "Title and image URL are required." });
  }

  const newItem = {
    id: `gallery-${Date.now()}`,
    category: category || "students",
    title,
    subtitle: subtitle || "Kumari Institute Rayagada",
    image,
    alt: alt || title,
    iconType: iconType || "user",
    createdAt: new Date().toISOString(),
  };

  galleryDatabase.unshift(newItem);
  persistGallery(galleryDatabase);
  res.status(201).json({ success: true, message: "Image added to gallery!", item: newItem });
});

app.delete("/api/gallery/:id", (req, res) => {
  const { id } = req.params;
  const initialLen = galleryDatabase.length;
  galleryDatabase = galleryDatabase.filter((item) => item.id !== id);
  if (galleryDatabase.length === initialLen) {
    return res.status(404).json({ success: false, message: "Gallery item not found." });
  }

  persistGallery(galleryDatabase);
  res.json({ success: true, message: "Gallery image removed." });
});

// ---------------------------------------------------------------------------
// 4E. SUCCESS STORIES MANAGEMENT (Admin can add & delete success stories)
// ---------------------------------------------------------------------------
app.get("/api/success-stories", (_req, res) => {
  res.json({ success: true, count: successStoriesDatabase.length, stories: successStoriesDatabase });
});

app.post("/api/success-stories", (req, res) => {
  const { studentName, score, exam, school, parentName, testimonial, image, year, badge } = req.body;
  if (!studentName || !testimonial) {
    return res.status(400).json({ success: false, message: "Student name and testimonial quote are required." });
  }

  const newStory = {
    id: `story-${Date.now()}`,
    studentName,
    score: score || "Distinction",
    exam: exam || "Annual Examination",
    school: school || "Rayagada",
    parentName: parentName || "",
    testimonial,
    image: image || "/images/defaults/student_rohit.jpg",
    year: year || "2024",
    badge: badge || "Star Student",
    createdAt: new Date().toISOString(),
  };

  successStoriesDatabase.unshift(newStory);
  persistSuccessStories(successStoriesDatabase);
  res.status(201).json({ success: true, message: "Success story added successfully!", story: newStory });
});

app.delete("/api/success-stories/:id", (req, res) => {
  const { id } = req.params;
  const initialLen = successStoriesDatabase.length;
  successStoriesDatabase = successStoriesDatabase.filter((s) => s.id !== id);
  if (successStoriesDatabase.length === initialLen) {
    return res.status(404).json({ success: false, message: "Story not found." });
  }

  persistSuccessStories(successStoriesDatabase);
  res.json({ success: true, message: "Success story removed." });
});

// ---------------------------------------------------------------------------
// 4F. ACTIVITY & AUDIT LOGS MANAGEMENT
// Tracks actions taken by admins: tutor approvals, demo bookings, received payments (Way 1: Home Tutors, Way 2: Courses)
// ---------------------------------------------------------------------------
app.get("/api/admin/activity-logs", (req, res) => {
  const { category, actionType, admin, search } = req.query;

  let filtered = [...activityLogsDatabase];

  if (category && typeof category === "string" && category !== "all") {
    filtered = filtered.filter((log) => log.category === category);
  }

  if (actionType && typeof actionType === "string" && actionType !== "all") {
    filtered = filtered.filter((log) => log.actionType === actionType);
  }

  if (admin && typeof admin === "string" && admin !== "all") {
    filtered = filtered.filter((log) =>
      log.adminName.toLowerCase().includes(admin.toLowerCase()) ||
      (log.adminEmail && log.adminEmail.toLowerCase().includes(admin.toLowerCase()))
    );
  }

  if (search && typeof search === "string" && search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter((log) =>
      log.title.toLowerCase().includes(q) ||
      log.description.toLowerCase().includes(q) ||
      log.adminName.toLowerCase().includes(q) ||
      (log.studentName && log.studentName.toLowerCase().includes(q)) ||
      (log.tutorName && log.tutorName.toLowerCase().includes(q)) ||
      (log.courseTitle && log.courseTitle.toLowerCase().includes(q)) ||
      (log.transactionId && log.transactionId.toLowerCase().includes(q)) ||
      (log.receiptNo && log.receiptNo.toLowerCase().includes(q))
    );
  }

  // Calculate audit statistics
  const totalActions = activityLogsDatabase.length;
  const tutorApprovals = activityLogsDatabase.filter((l) => l.actionType === "tutor_approved" || l.actionType === "tutor_rejected").length;
  const demoBookingsHandled = activityLogsDatabase.filter((l) => l.category === "demo_bookings").length;

  const homeTutorPayments = activityLogsDatabase.filter((l) => l.category === "payment_home_tutors" || l.actionType === "payment_home_tutor");
  const homeTutorPaymentsTotal = homeTutorPayments.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const homeTutorPaymentsCount = homeTutorPayments.length;

  const coursePayments = activityLogsDatabase.filter((l) => l.category === "payment_courses" || l.actionType === "payment_course");
  const coursePaymentsTotal = coursePayments.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const coursePaymentsCount = coursePayments.length;

  const totalRevenueCollected = homeTutorPaymentsTotal + coursePaymentsTotal;

  res.json({
    success: true,
    total: filtered.length,
    logs: filtered,
    metrics: {
      totalActions,
      tutorApprovals,
      demoBookingsHandled,
      homeTutorPaymentsTotal,
      homeTutorPaymentsCount,
      coursePaymentsTotal,
      coursePaymentsCount,
      totalRevenueCollected
    }
  });
});

app.post("/api/admin/activity-logs", (req, res) => {
  const {
    adminName,
    adminEmail,
    adminAvatar,
    actionType,
    category,
    title,
    description,
    targetId,
    targetName,
    studentName,
    parentName,
    parentPhone,
    tutorName,
    courseTitle,
    amount,
    paymentMethod,
    transactionId,
    receiptNo,
    status,
    notes,
    timestamp
  } = req.body;

  if (!title || !actionType) {
    return res.status(400).json({ success: false, message: "Title and actionType are required." });
  }

  const newLog = recordActivityLog({
    adminName: adminName || "Kumari Institute Admin",
    adminEmail: adminEmail || "kkumariinstitute@gmail.com",
    adminAvatar: adminAvatar || "/images/defaults/student_rohit.jpg",
    actionType,
    category: category || (actionType.includes("payment_course") ? "payment_courses" : actionType.includes("payment") ? "payment_home_tutors" : "tutors"),
    title,
    description: description || title,
    targetId,
    targetName,
    studentName,
    parentName,
    parentPhone,
    tutorName,
    courseTitle,
    amount: typeof amount === "number" ? amount : (amount ? Number(amount) : undefined),
    paymentMethod: paymentMethod || "UPI / QR",
    transactionId: transactionId || (amount ? `TXN-${Date.now().toString().slice(-6)}` : undefined),
    receiptNo: receiptNo || (amount ? `KIR-${Math.floor(1000 + Math.random() * 9000)}` : undefined),
    status: status || "completed",
    notes,
    timestamp: timestamp || new Date().toISOString()
  });

  res.status(201).json({
    success: true,
    message: "Admin activity logged successfully!",
    log: newLog
  });
});

app.delete("/api/admin/activity-logs/:id", (req, res) => {
  const { id } = req.params;
  const initialLen = activityLogsDatabase.length;
  activityLogsDatabase = activityLogsDatabase.filter((l) => l.id !== id);
  if (activityLogsDatabase.length === initialLen) {
    return res.status(404).json({ success: false, message: "Activity log not found." });
  }
  persistActivityLogs(activityLogsDatabase);
  res.json({ success: true, message: "Activity log archived/deleted." });
});

// 5. Client IP Location Detection (Fallback only, sanitized to Indian coordinates)
app.get("/api/location/detect-ip", async (req, res) => {
  const forwardIp = req.headers["x-forwarded-for"] as string;
  const clientIp = forwardIp ? forwardIp.split(",")[0].trim() : req.socket.remoteAddress;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const url = clientIp && !clientIp.includes("127.0.0.1") && !clientIp.includes("::1")
      ? `https://freeipapi.com/api/json/${clientIp}`
      : "https://freeipapi.com/api/json";

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = (await response.json()) as any;
      // Only accept if within India; never return foreign datacenter coordinates (e.g. Canada/US)
      if (data.latitude && data.longitude && data.countryName === "India") {
        return res.json({
          success: true,
          latitude: data.latitude,
          longitude: data.longitude,
          cityName: data.cityName || "Rayagada Area",
          regionName: data.regionName || "Odisha",
          countryName: "India",
          ip: data.ipAddress || clientIp,
          source: "ip_network"
        });
      }
    }
  } catch (err: any) {
    console.warn("[Server IP Location] Primary detection notice:", err.message);
  }

  // Baseline Rayagada Hub fallback if IP lookup fails or is a foreign cloud IP
  res.json({
    success: true,
    latitude: 19.1691,
    longitude: 83.4150,
    cityName: "Rayagada",
    regionName: "Odisha",
    countryName: "India",
    source: "default_hub"
  });
});

// 6. Reverse Geocoding via OpenStreetMap Nominatim with local Rayagada landmark matching
app.get("/api/location/reverse", async (req, res) => {
  const lat = req.query.lat as string;
  const lng = req.query.lng as string;

  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng parameters are required" });
  }

  const numLat = parseFloat(lat);
  const numLng = parseFloat(lng);

  if (isNaN(numLat) || isNaN(numLng)) {
    return res.status(400).json({ error: "Valid numeric lat and lng are required" });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${numLat}&lon=${numLng}&zoom=18&addressdetails=1`;
    const response = await fetch(nominatimUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "KumariInstituteRayagadaApp/1.0",
        "Accept": "application/json"
      }
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = (await response.json()) as any;
      const addr = data.address || {};
      const suburb = addr.suburb || addr.neighbourhood || addr.residential || addr.road || addr.village || addr.hamlet || addr.quarter || "";
      const city = addr.town || addr.city || addr.municipality || addr.county || addr.state_district || "Rayagada";
      const state = addr.state || "Odisha";

      let cleanName = suburb ? `${suburb}, ${city}` : city;
      if (state && !cleanName.includes(state)) {
        cleanName = `${cleanName}, ${state}`;
      }

      return res.json({
        success: true,
        displayName: cleanName,
        fullAddress: data.display_name,
        details: {
          suburb,
          city,
          state,
          postcode: addr.postcode || "765001"
        }
      });
    }
  } catch (err: any) {
    console.warn("[Server Reverse Geocode] Notice:", err.message);
  }

  // Precise fallback based on verified Rayagada localities
  const dToRayagada = calculateHaversineDistance(numLat, numLng, 19.1691, 83.4150);
  const closest = findClosestLocality(numLat, numLng);
  const distToClosest = calculateHaversineDistance(numLat, numLng, closest.latitude, closest.longitude);

  let fallbackName = "Rayagada";
  if (distToClosest <= 1.5) {
    fallbackName = `${closest.name}, Rayagada`;
  } else if (dToRayagada < 5) {
    fallbackName = "Rayagada Town Area";
  } else if (dToRayagada < 25) {
    fallbackName = "Greater Rayagada";
  } else {
    fallbackName = `${numLat.toFixed(4)}° N, ${numLng.toFixed(4)}° E`;
  }

  res.json({
    success: true,
    displayName: fallbackName,
    fullAddress: `${fallbackName}, Odisha`,
    details: {
      suburb: closest.name,
      city: "Rayagada",
      state: "Odisha",
      postcode: "765001"
    }
  });
});

// 7. Forward Geocoding via OpenStreetMap Nominatim for searching any city, area or street
app.get("/api/location/search", async (req, res) => {
  const query = (req.query.q as string || "").trim();
  if (!query || query.length < 2) {
    return res.json({ success: true, results: [] });
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
    const response = await fetch(nominatimUrl, {
      signal: controller.signal,
      headers: {
        "User-Agent": "KumariInstituteTutorsApp/1.0",
        "Accept": "application/json"
      }
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = (await response.json()) as any[];
      const results = data.map((item) => {
        const addr = item.address || {};
        const shortName = addr.suburb || addr.neighbourhood || addr.city || addr.town || addr.village || item.display_name.split(',')[0];
        const state = addr.state || "";
        const label = state ? `${shortName}, ${state}` : shortName;

        return {
          displayName: label,
          fullAddress: item.display_name,
          latitude: parseFloat(item.lat),
          longitude: parseFloat(item.lon),
          type: item.type
        };
      });
      return res.json({ success: true, results });
    }
  } catch (err: any) {
    console.warn("[Server Forward Geocode] Notice:", err.message);
  }

  res.json({ success: true, results: [] });
});

// 8. Persistent User Account Storage & Sync APIs
// Stores every registered user, tasks, and progress permanently
app.post("/api/users", (req, res) => {
  const user = req.body;
  if (!user || (!user.uid && !user.email)) {
    return res.status(400).json({ success: false, message: "User uid or email is required." });
  }

  const userKey = user.uid || user.email.toLowerCase();
  const existing = usersDatabase[userKey] || {};

  const wasApproved = Boolean(
    existing.isApproved === true ||
    existing.kycStatus === 'approved' ||
    existing.kycStatus === 'verified' ||
    existing.status === 'approved' ||
    existing.verified === true ||
    existing.verificationStatus === 'Verified Genuine Tutor'
  );

  const updatedUser = {
    ...existing,
    ...user,
    ...(wasApproved ? {
      isApproved: true,
      verified: true,
      status: 'approved',
      kycStatus: 'approved',
      verificationStatus: 'Verified Genuine Tutor'
    } : {}),
    updatedAt: new Date().toISOString()
  };

  usersDatabase[userKey] = updatedUser;
  // Also index by email for instant lookup
  if (user.email) {
    usersDatabase[user.email.toLowerCase()] = updatedUser;
  }
  persistUsers(usersDatabase);

  // If this user is a teacher, sync with teachersDatabase
  if (updatedUser.role === 'teacher') {
    const teacherId = updatedUser.uid || `teacher-${Date.now()}`;
    const existingIdx = teachersDatabase.findIndex(
      (t) => t.id === teacherId || (updatedUser.email && t.bio?.includes(updatedUser.email))
    );
    const teacherObj: Tutor = {
      id: teacherId,
      name: updatedUser.fullName || updatedUser.name || "Home Tutor",
      qualification: updatedUser.highestQualification || updatedUser.qualification || "",
      experienceYears: typeof updatedUser.experienceYears === 'number' ? updatedUser.experienceYears : 0,
      experienceText: updatedUser.experienceYears ? `${updatedUser.experienceYears}+ Yrs Exp` : "New Tutor",
      subjects: Array.isArray(updatedUser.subjects) ? updatedUser.subjects : [],
      distanceKm: 0,
      latitude: typeof updatedUser.latitude === 'number' ? updatedUser.latitude : 19.1691,
      longitude: typeof updatedUser.longitude === 'number' ? updatedUser.longitude : 83.4150,
      availabilityText: "Available",
      availabilityType: "available_now",
      availabilityBadge: updatedUser.badge || "Verified Home Tutor",
      rating: typeof updatedUser.rating === 'number' ? updatedUser.rating : 0,
      reviewCount: typeof updatedUser.reviewCount === 'number' ? updatedUser.reviewCount : 0,
      monthlyFee: (typeof updatedUser.hourlyRate === 'number' && updatedUser.hourlyRate > 0) || (typeof updatedUser.hourlyCharges === 'number' && updatedUser.hourlyCharges > 0)
        ? ((typeof updatedUser.hourlyRate === 'number' && updatedUser.hourlyRate > 0 ? updatedUser.hourlyRate : (updatedUser.hourlyCharges as number)) * 30)
        : (typeof updatedUser.monthlyFee === 'number' && updatedUser.monthlyFee > 0 ? updatedUser.monthlyFee : 3000),
      hourlyRate: typeof updatedUser.hourlyRate === 'number' && updatedUser.hourlyRate > 0
        ? updatedUser.hourlyRate
        : (typeof updatedUser.hourlyCharges === 'number' && updatedUser.hourlyCharges > 0
            ? updatedUser.hourlyCharges
            : (typeof updatedUser.monthlyFee === 'number' && updatedUser.monthlyFee > 0 ? Math.round(updatedUser.monthlyFee / 30) : 100)),
      bio: updatedUser.bio || "",
      avatar: updatedUser.avatar || updatedUser.photoUrl || "",
      gender: updatedUser.gender === "male" ? "male" : "female",
      teacherType: updatedUser.teacherType || "home",
      classesHandled: Array.isArray(updatedUser.classesHandled) ? updatedUser.classesHandled : [],
      boardsSupported: Array.isArray(updatedUser.boardsSupported) ? updatedUser.boardsSupported : [],
      locationArea: updatedUser.locality || updatedUser.locationArea || "",
      addressSnippet: updatedUser.address || updatedUser.locality || "",
      verified: Boolean(updatedUser.verified),
      teachingHighlights: Array.isArray(updatedUser.teachingHighlights) ? updatedUser.teachingHighlights : [],
      reviews: Array.isArray(updatedUser.reviews) ? updatedUser.reviews : []
    };

    if (existingIdx >= 0) {
      teachersDatabase[existingIdx] = { ...teachersDatabase[existingIdx], ...teacherObj };
    } else {
      teachersDatabase.unshift(teacherObj);
    }
    saveTeachersToFile(teachersDatabase);
  } else if (updatedUser.role === 'parent' && !isFakeParentRecord(updatedUser)) {
    const parentUid = updatedUser.uid || userKey;
    parentsDatabase[parentUid] = {
      ...(parentsDatabase[parentUid] || {}),
      ...updatedUser,
      role: 'parent',
      updatedAt: updatedUser.updatedAt
    };
    persistParents(parentsDatabase);
  }

  console.log(`[User Store] Saved user ${user.name || userKey} (${user.email}) to persistent storage.`);
  res.json({ success: true, user: updatedUser });
});

app.get("/api/users/:identifier", (req, res) => {
  const { identifier } = req.params;
  const lower = identifier.toLowerCase();
  const user = usersDatabase[identifier] || usersDatabase[lower];

  if (!user) {
    return res.status(404).json({ success: false, message: "User not found in persistent store." });
  }
  res.json({ success: true, user });
});

app.get("/api/admin/parents", async (_req, res) => {
  const [liveFirestoreParents, liveFirestoreTeachers, liveBookings, liveFees] = await Promise.all([
    fetchLiveFirestoreCollectionServer("parents"),
    fetchLiveFirestoreCollectionServer("teachers"),
    fetchLiveFirestoreCollectionServer("tutor_bookings"),
    fetchLiveFirestoreCollectionServer("received_fees")
  ]);

  // Build set of known Tutor UIDs (active teachers + tutors referenced in bookings/fees)
  const knownTutorUids = new Set<string>();
  liveFirestoreTeachers.forEach((t: any) => {
    const cid = String(t.uid || t._docId || t.id || "").replace(/^fb_teacher_/, "").trim();
    if (cid) knownTutorUids.add(cid);
  });
  liveBookings.forEach((b: any) => {
    if (b?.assignedTutorId) knownTutorUids.add(String(b.assignedTutorId).replace(/^fb_teacher_/, "").trim());
    if (b?.requestedTutorId) knownTutorUids.add(String(b.requestedTutorId).replace(/^fb_teacher_/, "").trim());
  });
  liveFees.forEach((f: any) => {
    if (f?.tutorId) knownTutorUids.add(String(f.tutorId).replace(/^fb_teacher_/, "").trim());
  });

  // Track which parent UIDs have real parent bookings
  const parentUidsWithBookings = new Set<string>();
  liveBookings.forEach((b: any) => {
    if (b?.parentUid) parentUidsWithBookings.add(String(b.parentUid).trim());
  });

  const parentsMap = loadSavedParents();
  const mergedByUid = new Map<string, any>();

  Object.values(parentsMap).forEach((p: any) => {
    if (p && p.role === "parent" && p.uid && !isFakeParentRecord(p)) {
      mergedByUid.set(p.uid, p);
    }
  });

  // Also include any verified parent in usersDatabase with role === "parent"
  Object.values(usersDatabase).forEach((u: any) => {
    if (u && u.role === "parent" && u.uid && !mergedByUid.has(u.uid) && !isFakeParentRecord(u)) {
      mergedByUid.set(u.uid, u);
      parentsDatabase[u.uid] = u;
    }
  });

  // Live Firestore parents always take precedence
  liveFirestoreParents.forEach((fp: any) => {
    const uid = String(fp.uid || fp._docId || fp.id || "").trim();
    const normalizedRole = String(fp.role || "parent").toLowerCase();
    const dedupBooked = deduplicateServerBookedTutors(fp.bookedTutors, fp.hiredTutors);
    const record = {
      ...fp,
      uid,
      id: uid,
      role: normalizedRole,
      bookedTutors: dedupBooked,
      hiredTutors: dedupBooked.filter((b: any) => String(b.status || "").toLowerCase() !== "pending")
    };
    if (uid && normalizedRole !== "admin" && normalizedRole !== "teacher" && !isFakeParentRecord(record)) {
      const existing = mergedByUid.get(uid);
      mergedByUid.set(uid, existing ? { ...existing, ...record } : record);
    }
  });

  const parentsList = Array.from(mergedByUid.values())
    .map((p: any) => {
      const dedupBooked = deduplicateServerBookedTutors(p.bookedTutors, p.hiredTutors);
      return {
        ...p,
        bookedTutors: dedupBooked,
        hiredTutors: dedupBooked.filter((b: any) => String(b.status || "").toLowerCase() !== "pending")
      };
    })
    .filter((p: any) => {
      const uid = String(p.uid || p.id || "").trim();
      const hasParentBookings =
        parentUidsWithBookings.has(uid) ||
        (Array.isArray(p.bookedTutors) && p.bookedTutors.length > 0);
      // Exclude accounts that are tutors (present in teachers or booked as tutors) unless they actually booked a tutor as a parent
      if (knownTutorUids.has(uid) && !hasParentBookings) {
        return false;
      }
      return !isFakeParentRecord(p);
    })
    .sort(
      (a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime()
    );

  res.json({ success: true, count: parentsList.length, parents: parentsList });
});

app.post("/api/parents", (req, res) => {
  const parent = req.body;
  if (!parent || !parent.uid) {
    return res.status(400).json({ success: false, message: "Valid parent record with UID is required." });
  }

  const parentKey = parent.uid;
  const mergedParent = {
    ...(parentsDatabase[parentKey] || {}),
    ...parent,
    role: "parent",
    updatedAt: new Date().toISOString()
  };
  parentsDatabase[parentKey] = mergedParent;
  persistParents(parentsDatabase);

  // Also keep usersDatabase synchronized for this parent
  usersDatabase[parentKey] = {
    ...(usersDatabase[parentKey] || {}),
    ...mergedParent
  };
  if (mergedParent.email) {
    usersDatabase[String(mergedParent.email).toLowerCase()] = usersDatabase[parentKey];
  }
  persistUsers(usersDatabase);

  res.json({ success: true, parent: mergedParent });
});

app.get("/api/users", (_req, res) => {
  // Deduplicate users by uid
  const uniqueUsers = Object.values(
    Object.values(usersDatabase).reduce((acc: Record<string, any>, u: any) => {
      if (u.uid) acc[u.uid] = u;
      return acc;
    }, {})
  );
  res.json({ success: true, count: uniqueUsers.length, users: uniqueUsers });
});

// ---------------------------------------------------------------------------
// RAZORPAY PAYMENT GATEWAY API (SERVER-SIDE ORDER & HMAC SIGNATURE VERIFICATION)
// ---------------------------------------------------------------------------
function getRazorpayCredentials() {
  const keyId = (process.env.RAZORPAY_KEY_ID || "").trim();
  const keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();
  return { keyId, keySecret };
}

function mapRazorpayMethodLabel(
  method?: string
): 'UPI' | 'PhonePe / GPay' | 'Net Banking' | 'Debit/Credit Card' | 'Wallet' | 'Cash / Institute Desk' {
  const m = String(method || "").toLowerCase();
  if (m === "upi") return "UPI";
  if (m === "netbanking") return "Net Banking";
  if (m === "card") return "Debit/Credit Card";
  if (m === "wallet") return "Wallet";
  return "UPI";
}

function formatRazorpayMethodDetail(payment: any): string {
  if (!payment) return "Razorpay Online Checkout";
  const m = String(payment.method || "").toLowerCase();
  if (m === "upi") {
    const vpa = payment.vpa ? ` (${payment.vpa})` : "";
    const flow = payment.upi?.flow ? ` • ${String(payment.upi.flow).toUpperCase()}` : "";
    return `UPI${vpa}${flow}`;
  }
  if (m === "card") {
    const net = payment.card?.network || payment.card?.type || "Card";
    const last4 = payment.card?.last4 ? ` •••• ${payment.card.last4}` : "";
    return `${net}${last4}`;
  }
  if (m === "netbanking") {
    return payment.bank ? `NetBanking (${payment.bank})` : "Net Banking";
  }
  if (m === "wallet") {
    return payment.wallet ? `Wallet (${payment.wallet})` : "Digital Wallet";
  }
  return payment.method ? String(payment.method).toUpperCase() : "Razorpay Checkout";
}

app.post("/api/payments/razorpay/create-order", async (req, res) => {
  try {
    const { keyId, keySecret } = getRazorpayCredentials();
    if (!keyId || !keySecret) {
      return res.status(500).json({
        success: false,
        message: "Razorpay gateway credentials are not configured on the server."
      });
    }

    const {
      amount,
      receipt,
      bookingId,
      tutorId,
      tutorName,
      parentUid,
      parentName,
      studentName
    } = req.body || {};

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid positive tuition fee amount (INR) is required."
      });
    }

    const amountInPaise = Math.round(numericAmount * 100);
    const cleanReceipt = String(
      receipt || `KI_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    ).slice(0, 40);

    const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: amountInPaise,
        currency: "INR",
        receipt: cleanReceipt,
        notes: {
          bookingId: String(bookingId || "").slice(0, 120),
          tutorId: String(tutorId || "").slice(0, 120),
          tutorName: String(tutorName || "").slice(0, 120),
          parentUid: String(parentUid || "").slice(0, 120),
          parentName: String(parentName || "").slice(0, 120),
          studentName: String(studentName || "").slice(0, 120)
        }
      })
    });

    const orderData: any = await rzpResponse.json().catch(() => ({}));
    if (!rzpResponse.ok || !orderData?.id) {
      const rzpDesc = orderData?.error?.description || "Failed to initialize Razorpay order.";
      const isAuthFailure =
        rzpResponse.status === 401 ||
        String(rzpDesc).toLowerCase().includes("authentication failed");

      if (isAuthFailure) {
        console.warn(
          `[Razorpay Create Order] Authentication failed for RAZORPAY_KEY_ID="${keyId}". Verify the key & secret are active in Razorpay Dashboard.`
        );
      }

      return res.status(rzpResponse.status || 502).json({
        success: false,
        errorCode: isAuthFailure ? "RAZORPAY_AUTH_FAILED" : orderData?.error?.code || "RAZORPAY_ORDER_FAILED",
        message: isAuthFailure
          ? "Razorpay payment gateway authentication failed. Please update or regenerate active Razorpay API Key ID and Secret in .env."
          : rzpDesc
      });
    }

    return res.json({
      success: true,
      orderId: orderData.id,
      amount: orderData.amount,
      amountINR: numericAmount,
      currency: orderData.currency || "INR",
      receipt: orderData.receipt,
      keyId
    });
  } catch (err: any) {
    console.error("[Razorpay Create Order Error]", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Unexpected server error while creating Razorpay order."
    });
  }
});

app.post("/api/payments/razorpay/verify", async (req, res) => {
  try {
    const { keyId, keySecret } = getRazorpayCredentials();
    if (!keyId || !keySecret) {
      return res.status(500).json({
        success: false,
        verified: false,
        message: "Razorpay gateway credentials are not configured on the server."
      });
    }

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      parentName,
      studentName,
      tutorName,
      amount
    } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        verified: false,
        message: "Missing Razorpay order_id, payment_id, or signature."
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const sigBuffer = Buffer.from(String(razorpay_signature), "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const signatureValid =
      sigBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(sigBuffer, expectedBuffer);

    if (!signatureValid) {
      return res.status(400).json({
        success: false,
        verified: false,
        signatureVerified: false,
        message: "Invalid Razorpay payment signature."
      });
    }

    // Fetch authoritative payment metadata from Razorpay Payments API for Admin verification desk
    let paymentDetails: any = null;
    try {
      const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
      const rzpPayRes = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(String(razorpay_payment_id))}`,
        {
          method: "GET",
          headers: { Authorization: authHeader }
        }
      );
      if (rzpPayRes.ok) {
        paymentDetails = await rzpPayRes.json();
      }
    } catch (fetchErr) {
      console.warn("[Razorpay Payment Fetch Notice]", fetchErr);
    }

    const paymentMethodLabel = mapRazorpayMethodLabel(paymentDetails?.method);
    const paymentMethodDetail = formatRazorpayMethodDetail(paymentDetails);
    const acquirerRef =
      paymentDetails?.acquirer_data?.rrn ||
      paymentDetails?.acquirer_data?.upi_transaction_id ||
      paymentDetails?.acquirer_data?.bank_transaction_id ||
      paymentDetails?.acquirer_data?.auth_code ||
      "";
    const resolvedAmountINR =
      typeof paymentDetails?.amount === "number"
        ? Math.round(paymentDetails.amount / 100)
        : Number(amount) || 0;

    recordActivityLog({
      actionType: "razorpay_fee_verified",
      category: "payment_home_tutors",
      title: `Razorpay Fee Verified (${razorpay_payment_id})`,
      description: `HMAC-SHA256 verified ₹${resolvedAmountINR} from ${parentName || "Parent"} for ${tutorName || "Home Tutor"}`,
      studentName: studentName || "",
      parentName: parentName || "",
      tutorName: tutorName || "",
      amount: resolvedAmountINR,
      paymentMethod: paymentMethodDetail,
      transactionId: razorpay_payment_id,
      status: "completed",
      notes: `Order: ${razorpay_order_id} | Gateway Status: ${paymentDetails?.status || "captured"}`
    });

    return res.json({
      success: true,
      verified: true,
      signatureVerified: true,
      razorpayOrderId: String(razorpay_order_id),
      razorpayPaymentId: String(razorpay_payment_id),
      razorpaySignature: String(razorpay_signature),
      gatewayStatus: paymentDetails?.status || "captured",
      paymentMethodLabel,
      paymentMethodDetail,
      acquirerRef,
      paidEmail: paymentDetails?.email || "",
      paidContact: paymentDetails?.contact || "",
      amountINR: resolvedAmountINR,
      verifiedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.error("[Razorpay Verify Error]", err);
    return res.status(500).json({
      success: false,
      verified: false,
      message: err?.message || "Unexpected server error verifying Razorpay payment."
    });
  }
});

app.get("/api/payments/razorpay/payment/:paymentId", async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { keyId, keySecret } = getRazorpayCredentials();
    if (!keyId || !keySecret) {
      return res.status(500).json({
        success: false,
        message: "Razorpay gateway credentials are not configured."
      });
    }

    const authHeader = "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const rzpRes = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`,
      {
        method: "GET",
        headers: { Authorization: authHeader }
      }
    );
    const data: any = await rzpRes.json();
    if (!rzpRes.ok) {
      return res.status(rzpRes.status || 404).json({
        success: false,
        message: data?.error?.description || "Unable to fetch payment details from Razorpay."
      });
    }

    return res.json({
      success: true,
      payment: {
        id: data.id,
        orderId: data.order_id,
        amountINR: typeof data.amount === "number" ? Math.round(data.amount / 100) : 0,
        currency: data.currency || "INR",
        status: data.status,
        captured: Boolean(data.captured),
        method: data.method,
        methodDetail: formatRazorpayMethodDetail(data),
        email: data.email || "",
        contact: data.contact || "",
        vpa: data.vpa || "",
        acquirerRef:
          data.acquirer_data?.rrn ||
          data.acquirer_data?.upi_transaction_id ||
          data.acquirer_data?.bank_transaction_id ||
          ""
      }
    });
  } catch (err: any) {
    console.error("[Razorpay Lookup Error]", err);
    return res.status(500).json({
      success: false,
      message: err?.message || "Error querying Razorpay payment status."
    });
  }
});

// ---------------------------------------------------------------------------
// HERO BANNERS MANAGEMENT API
// ---------------------------------------------------------------------------
app.get("/api/hero-banners", (_req, res) => {
  const activeBanners = heroBannersDatabase.filter((b) => b.active !== false);
  res.json({ success: true, banners: activeBanners });
});

app.get("/api/admin/hero-banners", (_req, res) => {
  res.json({ success: true, banners: heroBannersDatabase });
});

app.post("/api/admin/hero-banners", (req, res) => {
  // Support bulk adding multiple banners at once
  if (Array.isArray(req.body.banners) && req.body.banners.length > 0) {
    const addedBanners: ServerHeroBanner[] = [];
    for (const b of req.body.banners) {
      if (b && typeof b.url === 'string' && b.url.trim()) {
        const item: ServerHeroBanner = {
          id: `banner-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url: b.url.trim(),
          active: b.active !== false,
          createdAt: new Date().toISOString()
        };
        addedBanners.push(item);
        heroBannersDatabase.unshift(item);
      }
    }
    saveHeroBanners(heroBannersDatabase);
    return res.json({ success: true, count: addedBanners.length, banners: heroBannersDatabase });
  }

  const { url, active } = req.body;
  if (!url || typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ success: false, message: "A valid image URL is required." });
  }

  const newBanner: ServerHeroBanner = {
    id: `banner-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    url: url.trim(),
    active: active !== false,
    createdAt: new Date().toISOString()
  };

  heroBannersDatabase.unshift(newBanner);
  saveHeroBanners(heroBannersDatabase);
  res.json({ success: true, banner: newBanner, banners: heroBannersDatabase });
});

app.put("/api/admin/hero-banners/:id", (req, res) => {
  const { id } = req.params;
  const { active, url } = req.body;
  const idx = heroBannersDatabase.findIndex((b) => b.id === id);
  if (idx < 0) {
    return res.status(404).json({ success: false, message: "Banner image not found." });
  }

  heroBannersDatabase[idx] = {
    ...heroBannersDatabase[idx],
    ...(active !== undefined ? { active: Boolean(active) } : {}),
    ...(url !== undefined && url ? { url: String(url).trim() } : {})
  };

  saveHeroBanners(heroBannersDatabase);
  res.json({ success: true, banner: heroBannersDatabase[idx], banners: heroBannersDatabase });
});

app.delete("/api/admin/hero-banners/:id", (req, res) => {
  const { id } = req.params;
  heroBannersDatabase = heroBannersDatabase.filter((b) => b.id !== id);
  saveHeroBanners(heroBannersDatabase);
  res.json({ success: true, banners: heroBannersDatabase });
});

// ---------------------------------------------------------------------------
// IMGBB SERVER-SIDE UPLOAD PROXY (keeps IMGBB_API_KEY off client bundle)
// ---------------------------------------------------------------------------
app.post("/api/upload-image", async (req, res) => {
  const apiKey = (process.env.IMGBB_API_KEY || process.env.VITE_IMGBB_API_KEY || "").trim();
  if (!apiKey) {
    return res.status(500).json({
      success: false,
      message: "Image upload service is not configured on the server (missing IMGBB_API_KEY)."
    });
  }

  const rawBase64 = typeof req.body?.imageBase64 === "string" ? req.body.imageBase64.trim() : "";
  const cleanName = typeof req.body?.name === "string" ? req.body.name.trim() : "upload";

  if (!rawBase64) {
    return res.status(400).json({ success: false, message: "Image payload (imageBase64) is required." });
  }

  const strippedBase64 = rawBase64.includes(",") ? rawBase64.split(",")[1] : rawBase64;

  try {
    const body = new URLSearchParams();
    body.append("image", strippedBase64);
    if (cleanName) body.append("name", cleanName);

    const upstream = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });

    const json: any = await upstream.json().catch(() => null);
    if (upstream.ok && json?.success && json?.data?.url) {
      return res.json({
        success: true,
        url: json.data.url,
        displayUrl: json.data.display_url || json.data.url,
        thumbUrl: json.data.thumb?.url,
        deleteUrl: json.data.delete_url,
        title: json.data.title || cleanName,
        size: `${Math.max(1, Math.round(Number(json.data.size || 0) / 1024))} KB`
      });
    }

    return res.status(502).json({
      success: false,
      message: json?.error?.message || `Upstream ImgBB upload failed (${upstream.status})`
    });
  } catch (err: any) {
    return res.status(502).json({
      success: false,
      message: err?.message || "Failed to connect to ImgBB upload service."
    });
  }
});

// ---------------------------------------------------------------------------
// VITE MIDDLEWARE SETUP
// ---------------------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[TutorConnect Server] Running at http://localhost:${PORT}`);
  });
}

startServer();
