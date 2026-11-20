import React, { useState, useMemo, useEffect } from 'react';
import {
  MapPin,
  Search,
  ShieldCheck,
  Heart,
  ChevronDown,
  X,
  ArrowLeft,
  CheckCircle2,
  Phone,
  Home,
  GraduationCap,
  LocateFixed,
  Loader2,
  Check,
  AlertCircle,
  Eye,
  Compass,
  Clock
} from 'lucide-react';
import {
  Tutor,
  calculateDistanceKm
} from '../data/tutorsData';
import { BookHomeTutorModal } from './BookHomeTutorModal';
import { TutorProfilePage } from './TutorProfilePage';
import {
  getLiveUserLocation,
  LiveLocationData,
  searchNearbyTeachers
} from '../services/tutorApi';
import {
  subscribeToRealtimeTeachers,
  subscribeToRealtimeBookings,
  loginWithGoogle,
  formatFirebaseError,
  AppUserProfile
} from '../services/firebaseAuth';
import { useBackButtonDismiss } from '../hooks/useBackButtonDismiss';

interface FindTutorsPageProps {
  currentUser?: AppUserProfile | null;
  onNavigateHome: () => void;
  onOpenEnquiry: () => void;
  onOpenDemoBooking: () => void;
  onNavigateAuth?: (
    mode?: 'login' | 'parent-login' | 'teacher-login' | 'create-parent' | 'create-teacher',
    role?: 'parent' | 'teacher'
  ) => void;
  onViewTutorProfile?: (tutor: Tutor) => void;
  onLoginSuccess?: (user: AppUserProfile) => void;
}

const CONTACT_TEL_HREF = 'tel:+919439851521';
const CONTACT_PHONE_DISPLAY = '+91 94398 51521';

const CLASS_OPTIONS = [
  { value: 'All Classes', label: 'All Classes' },
  { value: '1st', label: 'Class 1' },
  { value: '2nd', label: 'Class 2' },
  { value: '3rd', label: 'Class 3' },
  { value: '4th', label: 'Class 4' },
  { value: '5th', label: 'Class 5' },
  { value: '6th', label: 'Class 6' },
  { value: '7th', label: 'Class 7' },
  { value: '8th', label: 'Class 8' },
  { value: '9th', label: 'Class 9' },
  { value: '10th', label: 'Class 10' },
  { value: '11th', label: 'Class 11' },
  { value: '12th', label: 'Class 12' }
];

const BOARD_OPTIONS = [
  { value: 'All Boards', label: 'All Boards' },
  { value: 'CBSE', label: 'CBSE Board' },
  { value: 'ICSE', label: 'ICSE Board' }
];

const SUBJECT_OPTIONS = [
  'All Subjects',
  'Mathematics',
  'Science',
  'English',
  'Odia',
  'Hindi',
  'Social Science (SST)',
  'Computer Applications',
  'Physics',
  'Chemistry',
  'Biology'
];

const FAV_TUTORS_STORAGE_KEY = 'kumari_saved_favorite_tutors';

function loadSavedFavoriteIds(): Set<string> {
  try {
    const raw = localStorage.getItem(FAV_TUTORS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function formatClassesCompact(classesList?: string[]): string {
  if (!Array.isArray(classesList) || classesList.length === 0) return 'Class 1 – 12';
  const nums = classesList
    .map((c) => {
      const m = String(c).match(/\d+/);
      return m ? parseInt(m[0], 10) : NaN;
    })
    .filter((n) => !isNaN(n))
    .sort((a, b) => a - b);

  if (nums.length >= 3) {
    const min = nums[0];
    const max = nums[nums.length - 1];
    const ordinal = (n: number) =>
      n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
    let isConsecutive = true;
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] - nums[i - 1] > 1) {
        isConsecutive = false;
        break;
      }
    }
    if (isConsecutive) {
      return `Class ${ordinal(min)} – ${ordinal(max)}`;
    }
  }
  return classesList.map((c) => c.replace(/\s*Class$/i, '').trim()).join(', ');
}

const matchSubjectName = (tutorSubjects: string[], filterSubject: string): boolean => {
  if (filterSubject === 'All Subjects') return true;
  const f = filterSubject.toLowerCase();
  const isSstFilter = f === 'social science (sst)' || f === 'social' || f === 'sst' || f === 'social science';
  const isMathFilter = f === 'mathematics' || f === 'math';
  const isCompFilter = f.includes('computer');
  const isScienceFilter = f === 'science';

  return tutorSubjects.some((raw) => {
    const sub = raw.toLowerCase().trim();
    if (sub.includes('all subject') || sub === 'all' || sub.includes('all primary')) return true;
    if (isMathFilter) return sub.includes('math');
    if (isSstFilter) {
      return sub.includes('social') || sub.includes('sst') || sub.includes('history') || sub.includes('geography') || sub.includes('civics');
    }
    if (isCompFilter) {
      return sub.includes('computer') || sub.includes('coding') || /\bit\b/.test(sub);
    }
    if (isScienceFilter) {
      const withoutOtherSciences = sub
        .replace(/social\s+science/g, '')
        .replace(/computer\s+science/g, '');
      return (
        withoutOtherSciences.includes('science') ||
        withoutOtherSciences.includes('evs') ||
        withoutOtherSciences.includes('pcb')
      );
    }
    return sub.includes(f);
  });
};

const matchClassNumber = (classesHandled: string[], targetClass: string): boolean => {
  if (targetClass === 'All Classes') return true;
  const targetNumMatch = targetClass.match(/\d+/);
  const targetNum = targetNumMatch ? parseInt(targetNumMatch[0], 10) : NaN;
  if (isNaN(targetNum)) return true;

  return classesHandled.some((raw) => {
    const cls = raw.toLowerCase();
    if (cls.includes('all')) return true;

    const rangeMatch = cls.match(/(\d+)\s*(?:st|nd|rd|th)?\s*(?:-|–|—|to)\s*(?:class\s*)?(\d+)/);
    if (rangeMatch) {
      const start = parseInt(rangeMatch[1], 10);
      const end = parseInt(rangeMatch[2], 10);
      if (targetNum >= start && targetNum <= end) return true;
    }

    const exactRegex = new RegExp(`\\b${targetNum}(?:st|nd|rd|th)?\\b`, 'i');
    return exactRegex.test(cls);
  });
};

interface LiveLocationState {
  lat: number;
  lng: number;
  name: string;
  subText: string;
  isGps: boolean;
  accuracy?: number;
  source?: 'gps_hardware' | 'network_wifi' | 'ip_lookup' | 'manual_hub';
  isRayagada?: boolean;
  distanceFromRayagadaKm?: number;
}

export const FindTutorsPage: React.FC<FindTutorsPageProps> = ({
  currentUser,
  onNavigateHome,
  onOpenEnquiry,
  onOpenDemoBooking,
  onNavigateAuth,
  onViewTutorProfile,
  onLoginSuccess
}) => {
  // Gate Google Sign-in state for unauthorized parents
  const [isGateGoogleLoggingIn, setIsGateGoogleLoggingIn] = useState(false);
  const [gateAuthError, setGateAuthError] = useState<string | null>(null);

  const handleGateGoogleLogin = async () => {
    setIsGateGoogleLoggingIn(true);
    setGateAuthError(null);
    try {
      const profile = await loginWithGoogle('parent');
      if (onLoginSuccess) {
        onLoginSuccess(profile);
      }
    } catch (err: any) {
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        setIsGateGoogleLoggingIn(false);
        return;
      }
      setGateAuthError(formatFirebaseError(err) || 'Could not complete Google sign in. Please try again.');
    } finally {
      setIsGateGoogleLoggingIn(false);
    }
  };

  // Home tutor booking modal & profile view
  const [bookingTutorTarget, setBookingTutorTarget] = useState<Tutor | null>(null);
  const [selectedTutorForProfile, setSelectedTutorForProfile] = useState<Tutor | null>(null);

  useBackButtonDismiss(Boolean(bookingTutorTarget), 'find-tutors-book-modal', () =>
    setBookingTutorTarget(null)
  );
  useBackButtonDismiss(Boolean(selectedTutorForProfile), 'find-tutors-profile-view', () =>
    setSelectedTutorForProfile(null)
  );

  const handleBookHomeTutor = (tutor: Tutor) => {
    setBookingTutorTarget(tutor);
  };

  const handleViewProfileClick = (tutor: Tutor) => {
    if (onViewTutorProfile) {
      onViewTutorProfile(tutor);
    } else {
      setSelectedTutorForProfile(tutor);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Live location state
  const [currentLocation, setCurrentLocation] = useState<LiveLocationState>({
    lat: 19.1691,
    lng: 83.415,
    name: '',
    subText: '',
    isGps: false,
    source: 'manual_hub',
    isRayagada: true,
    distanceFromRayagadaKm: 0
  });

  const [locationSearchInput, setLocationSearchInput] = useState('');
  const [gpsLabel, setGpsLabel] = useState<string | null>(null);
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [gpsToast, setGpsToast] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  const currentLocationLabel = useMemo(() => {
    const input = locationSearchInput.replace(/^📍\s*/, '').trim();
    if (input && input !== 'all') return input;
    if (currentLocation.name) return currentLocation.name.replace(/^📍\s*/, '').trim();
    return 'Rayagada';
  }, [locationSearchInput, currentLocation.name]);

  // Real-time Firestore Tutors & Proximity Backend
  const [isLoadingTeachers, setIsLoadingTeachers] = useState<boolean>(true);
  const [backendNearbyTeachers, setBackendNearbyTeachers] = useState<Tutor[] | null>(null);
  const [firestoreLiveTeachers, setFirestoreLiveTeachers] = useState<Tutor[]>([]);

  useEffect(() => {
    let isCancelled = false;
    setIsLoadingTeachers(true);

    const safetyTimer = setTimeout(() => {
      if (!isCancelled) setIsLoadingTeachers(false);
    }, 6000);

    fetch('/api/teachers')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((res: any) => {
        if (isCancelled) return;
        const list = Array.isArray(res) ? res : Array.isArray(res?.teachers) ? res.teachers : [];
        if (list.length > 0) {
          const approved = list.filter((t: any) => {
            const id = (t.id || '').toLowerCase();
            const name = (t.name || '').toLowerCase().trim();
            const email = (t.email || '').toLowerCase().trim();
            if (
              !name ||
              name === 'educator' ||
              name.includes('educator') ||
              id.includes('educator') ||
              name.includes('divya') ||
              id.includes('t7rcs2ymnyymgjwneqhqeazwale2')
            ) {
              return false;
            }
            return (
              ((t.verified === true && (t.isApproved === true || t.status === 'approved')) ||
                (t.isApproved === true && t.status === 'approved')) &&
              t.verified !== false &&
              t.status !== 'rejected'
            );
          });
          setBackendNearbyTeachers(approved);
          if (approved.length > 0) {
            setIsLoadingTeachers(false);
          }
        } else {
          setBackendNearbyTeachers([]);
        }
      })
      .catch((err) => {
        if (!isCancelled) console.warn('Fetch teachers notice:', err);
      });

    const unsub = subscribeToRealtimeTeachers((liveTeachers) => {
      if (isCancelled) return;
      clearTimeout(safetyTimer);
      const cleanLive = (liveTeachers || []).filter((t: any) => {
        const id = (t.id || '').toLowerCase();
        const name = (t.name || '').toLowerCase().trim();
        return !(
          name.includes('divya') ||
          id.includes('t7rcs2ymnyymgjwneqhqeazwale2')
        );
      });
      setFirestoreLiveTeachers(cleanLive);
      setIsLoadingTeachers(false);
    });

    return () => {
      isCancelled = true;
      clearTimeout(safetyTimer);
      unsub();
    };
  }, []);

  // Real-time tracking of booked tutors for signed-in parent
  const [parentBookedTutorIds, setParentBookedTutorIds] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (currentUser && (currentUser.role === 'parent' || !currentUser.role)) {
      if (Array.isArray(currentUser.hiredTutors)) {
        currentUser.hiredTutors.forEach((h: any) => {
          if (h && h.tutorId) set.add(String(h.tutorId));
        });
      }
      if (currentUser.assignedEducator?.id) {
        set.add(String(currentUser.assignedEducator.id));
      }
    }
    return set;
  });

  const [parentPendingTutorIds, setParentPendingTutorIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!currentUser || currentUser.role === 'teacher' || currentUser.role === 'admin') {
      setParentBookedTutorIds(new Set());
      setParentPendingTutorIds(new Set());
      return;
    }

    const normPhone = currentUser.phone ? currentUser.phone.replace(/\D/g, '') : '';
    const userEmail = currentUser.email ? currentUser.email.toLowerCase().trim() : '';
    const userUid = currentUser.uid || '';

    const unsub = subscribeToRealtimeBookings((allBookings) => {
      const bookedSet = new Set<string>();
      const pendingSet = new Set<string>();
      if (Array.isArray(currentUser.hiredTutors)) {
        currentUser.hiredTutors.forEach((h: any) => {
          if (h && h.tutorId) bookedSet.add(String(h.tutorId));
        });
      }
      if (currentUser.assignedEducator?.id) {
        bookedSet.add(String(currentUser.assignedEducator.id));
      }

      allBookings.forEach((b: any) => {
        const bPhone = b.parentPhone ? b.parentPhone.replace(/\D/g, '') : '';
        const bEmail = b.parentEmail ? b.parentEmail.toLowerCase().trim() : '';
        const bUid = b.parentUid || '';

        const isMatch =
          Boolean(userUid && bUid && userUid === bUid) ||
          Boolean(userEmail && bEmail && userEmail === bEmail) ||
          Boolean(
            normPhone &&
              bPhone &&
              normPhone.length >= 10 &&
              bPhone.length >= 10 &&
              normPhone.slice(-10) === bPhone.slice(-10)
          );

        if (!isMatch) return;

        const isBookingCompleted =
          b.status === 'accepted' ||
          b.status === 'assigned' ||
          b.status === 'completed' ||
          b.status === 'confirmed' ||
          b.status === 'reassigned';

        if (isBookingCompleted) {
          if (b.requestedTutorId) bookedSet.add(String(b.requestedTutorId));
          if (b.assignedTutorId) bookedSet.add(String(b.assignedTutorId));
        } else if (b.status === 'pending') {
          if (b.requestedTutorId) pendingSet.add(String(b.requestedTutorId));
        }
      });

      setParentBookedTutorIds(bookedSet);
      setParentPendingTutorIds(pendingSet);
    });

    return () => unsub();
  }, [
    currentUser?.uid,
    currentUser?.email,
    currentUser?.phone,
    currentUser?.role,
    currentUser?.hiredTutors,
    currentUser?.assignedEducator?.id
  ]);

  // Filter state
  const [selectedClass, setSelectedClass] = useState('All Classes');
  const [selectedBoard, setSelectedBoard] = useState('All Boards');
  const [selectedSubject, setSelectedSubject] = useState('All Subjects');
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => loadSavedFavoriteIds());

  // Re-sync favorites when returning from TutorProfilePage or other tabs
  useEffect(() => {
    const syncFavs = () => setFavoriteIds(loadSavedFavoriteIds());
    window.addEventListener('storage', syncFavs);
    syncFavs();
    return () => window.removeEventListener('storage', syncFavs);
  }, [selectedTutorForProfile]);

  const fetchBackendProximityTeachers = async (lat: number, lng: number, radius = 999) => {
    try {
      const res = await searchNearbyTeachers(lat, lng, radius);
      if (res && res.success && Array.isArray(res.teachers) && res.teachers.length > 0) {
        setBackendNearbyTeachers(res.teachers);
      }
    } catch {
      // fallback silently to Firestore listener
    }
  };

  useEffect(() => {
    fetchBackendProximityTeachers(currentLocation.lat, currentLocation.lng, 999);
  }, [currentLocation.lat, currentLocation.lng]);

  const toggleFavorite = (tutorId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(tutorId)) next.delete(tutorId);
      else next.add(tutorId);
      try {
        localStorage.setItem(FAV_TUTORS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const handleUseCurrentLocation = async () => {
    setIsLocatingGps(true);
    setGpsToast({ type: 'info', message: 'Acquiring GPS location...' });
    try {
      const geo: LiveLocationData = await getLiveUserLocation((msg) => {
        setGpsToast({ type: 'info', message: msg });
      });
      const liveDisplayName = `📍 ${geo.placeName}`;
      setCurrentLocation({
        lat: geo.latitude,
        lng: geo.longitude,
        name: liveDisplayName,
        subText: geo.subText,
        isGps: true,
        accuracy: geo.accuracy,
        source: geo.source,
        isRayagada: geo.isRayagada,
        distanceFromRayagadaKm: geo.distanceFromRayagadaKm
      });
      setGpsLabel(liveDisplayName);
      setLocationSearchInput(liveDisplayName);
      await fetchBackendProximityTeachers(geo.latitude, geo.longitude, 999);
      setGpsToast({
        type: 'success',
        message: `Location detected: ${geo.placeName}. Showing tutors nearest to you.`
      });
    } catch (err: any) {
      setGpsToast({
        type: 'error',
        message: err?.message || 'Could not detect live position. Enter your locality manually.'
      });
    } finally {
      setIsLocatingGps(false);
      setTimeout(() => setGpsToast(null), 5000);
    }
  };

  // Verified genuine Firestore tutors enriched with real distance (kept in object for TutorProfilePage)
  const enrichedTutors = useMemo(() => {
    const mergedById = new Map<string, Tutor>();
    const normalizeId = (rawId: string) => String(rawId || '').trim().replace(/^fb_teacher_/, '');

    // Add live backend-synced Firestore teachers first, then overlay direct real-time Firestore snapshot
    for (const t of backendNearbyTeachers || []) {
      const uid = normalizeId(t.id);
      if (uid) mergedById.set(uid, { ...t, id: uid });
    }
    for (const t of firestoreLiveTeachers || []) {
      const uid = normalizeId(t.id);
      if (uid) {
        const existing = mergedById.get(uid);
        mergedById.set(uid, existing ? { ...existing, ...t, id: uid } : { ...t, id: uid });
      }
    }

    const approvedTutors = Array.from(mergedById.values()).filter((t) => {
      const id = (t.id || '').toLowerCase();
      const name = (t.name || '').toLowerCase().trim();
      if (!name || name === 'educator' || name.includes('educator') || id.includes('educator')) {
        return false;
      }
      if (
        id.includes('priya-sharma') ||
        id.includes('rakesh-tripathy') ||
        id.includes('sneha-patel') ||
        id.includes('sagar-das') ||
        id.includes('anita-mohanty') ||
        id.includes('sukumar') ||
        id.includes('t7rcs2ymnyymgjwneqhqeazwale2') ||
        name.includes('divya')
      ) {
        return false;
      }
      const isAccepted =
        (t.verified === true && (t.isApproved === true || t.status === 'approved')) ||
        (t.isApproved === true && t.status === 'approved');
      return isAccepted && t.verified !== false && t.status !== 'rejected';
    });

    return approvedTutors.map((tutor) => {
      const tutorLat = typeof tutor.latitude === 'number' && !isNaN(tutor.latitude) && tutor.latitude !== 0 ? tutor.latitude : 19.1691;
      const tutorLng = typeof tutor.longitude === 'number' && !isNaN(tutor.longitude) && tutor.longitude !== 0 ? tutor.longitude : 83.415;
      const liveDist = calculateDistanceKm(currentLocation.lat, currentLocation.lng, tutorLat, tutorLng);
      const travelTime = Math.max(2, Math.round((liveDist / 20) * 60));
      return {
        ...tutor,
        latitude: tutorLat,
        longitude: tutorLng,
        distanceKm: liveDist,
        liveDistanceKm: liveDist,
        travelTimeMinutes: travelTime
      };
    });
  }, [backendNearbyTeachers, firestoreLiveTeachers, currentLocation]);

  // Filter tutors
  const filteredTutors = useMemo(() => {
    const isUsingGpsLabel = Boolean(gpsLabel && locationSearchInput === gpsLabel);
    const rawQuery = isUsingGpsLabel
      ? ''
      : locationSearchInput.replace(/^📍\s*/, '').toLowerCase().replace(', rayagada', '').trim();
    const hasSpecificQuery = Boolean(
      rawQuery && rawQuery !== 'rayagada' && rawQuery !== 'all' && !rawQuery.includes('live gps')
    );
    const queryTokens = hasSpecificQuery
      ? rawQuery
          .split(/[\s,+-]+/)
          .filter((w) => w.length >= 2 && !['near', 'road', 'rd', 'street', 'dist', 'district', 'pin', 'odisha'].includes(w))
      : [];

    return enrichedTutors
      .filter((tutor) => {
        const fs = tutor.feeStructure;
        const boardKey = selectedBoard === 'CBSE' ? 'cbse' : selectedBoard === 'ICSE' ? 'icse' : null;

        if (selectedClass !== 'All Classes') {
          const matchesHandled = matchClassNumber(tutor.classesHandled || [], selectedClass);
          const isSenior = selectedClass === '11th' || selectedClass === '12th';
          const feeFor1to10 = !isSenior ? fs?.classes1to10?.[selectedClass as keyof typeof fs.classes1to10] : undefined;
          const feeFor11to12 = isSenior ? fs?.classes11to12?.[selectedClass as '11th' | '12th'] : undefined;

          const hasFeeEntryForClass = Boolean(
            (feeFor1to10 &&
              (boardKey
                ? Number(feeFor1to10[boardKey]) > 0
                : Number(feeFor1to10.cbse) > 0 || Number(feeFor1to10.icse) > 0)) ||
              (feeFor11to12 &&
                Object.values(feeFor11to12).some((entry: any) =>
                  boardKey ? Number(entry?.[boardKey]) > 0 : Number(entry?.cbse) > 0 || Number(entry?.icse) > 0
                ))
          );

          if (!matchesHandled && !hasFeeEntryForClass) return false;
        }

        if (selectedBoard !== 'All Boards' && boardKey) {
          const matchesBoardList =
            Array.isArray(tutor.boardsSupported) &&
            tutor.boardsSupported.some(
              (b) => b.toLowerCase().includes(selectedBoard.toLowerCase()) || b.toLowerCase().includes('all')
            );

          let matchesFeeBoard = false;
          if (fs) {
            if (selectedClass !== 'All Classes') {
              if (selectedClass === '11th' || selectedClass === '12th') {
                const seniorMap = fs.classes11to12?.[selectedClass] || {};
                matchesFeeBoard = Object.values(seniorMap).some((entry: any) => Number(entry?.[boardKey]) > 0);
              } else {
                const row = fs.classes1to10?.[selectedClass as keyof typeof fs.classes1to10];
                matchesFeeBoard = Number(row?.[boardKey]) > 0;
              }
            } else {
              const any1to10 = fs.classes1to10
                ? Object.values(fs.classes1to10).some((row: any) => Number(row?.[boardKey]) > 0)
                : false;
              const any11to12 = fs.classes11to12
                ? (['11th', '12th'] as const).some((clsKey) =>
                    Object.values(fs.classes11to12[clsKey] || {}).some((entry: any) => Number(entry?.[boardKey]) > 0)
                  )
                : false;
              matchesFeeBoard = any1to10 || any11to12;
            }
          }
          if (!matchesBoardList && !matchesFeeBoard) return false;
        }

        if (selectedSubject !== 'All Subjects') {
          const matchesSubList = matchSubjectName(tutor.subjects || [], selectedSubject);
          let matchesFeeSubjects = false;
          if (fs?.classes11to12) {
            const seniorClassesToCheck: ('11th' | '12th')[] =
              selectedClass === '11th' ? ['11th'] : selectedClass === '12th' ? ['12th'] : ['11th', '12th'];
            matchesFeeSubjects = seniorClassesToCheck.some((clsKey) => {
              const entries = fs.classes11to12?.[clsKey] || {};
              return Object.keys(entries).some(
                (subName) =>
                  matchSubjectName([subName], selectedSubject) &&
                  (boardKey
                    ? Number((entries[subName] as any)?.[boardKey]) > 0
                    : Number((entries[subName] as any)?.cbse) > 0 || Number((entries[subName] as any)?.icse) > 0)
              );
            });
          }
          if (!matchesSubList && !matchesFeeSubjects) return false;
        }

        if (hasSpecificQuery) {
          const tutorAddressTokens = [
            tutor.name,
            tutor.locationArea,
            tutor.addressSnippet,
            (tutor as any).address,
            (tutor as any).locality,
            (tutor as any).addressDetails?.line1,
            (tutor as any).addressDetails?.street,
            (tutor as any).addressDetails?.landmark,
            ...(tutor.subjects || []),
            ...(tutor.classesHandled || []),
            tutor.qualification
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          const matchesAddress =
            tutorAddressTokens.includes(rawQuery) ||
            (queryTokens.length > 0 && queryTokens.some((token) => tutorAddressTokens.includes(token)));
          if (!matchesAddress) return false;
        }

        return true;
      })
      .sort((a, b) => a.liveDistanceKm - b.liveDistanceKm);
  }, [enrichedTutors, selectedSubject, selectedClass, selectedBoard, locationSearchInput, gpsLabel]);

  const isAuthorizedParent = Boolean(
    currentUser &&
      (currentUser.role === 'parent' ||
        currentUser.role === 'admin' ||
        currentUser.email?.toLowerCase() === 'kkumariinstitute@gmail.com')
  );

  const hasActiveFilters =
    selectedClass !== 'All Classes' ||
    selectedBoard !== 'All Boards' ||
    selectedSubject !== 'All Subjects' ||
    Boolean(locationSearchInput.trim() && locationSearchInput !== gpsLabel);

  const resetAllFilters = () => {
    setSelectedClass('All Classes');
    setSelectedBoard('All Boards');
    setSelectedSubject('All Subjects');
    setLocationSearchInput('');
    setGpsLabel(null);
  };

  if (selectedTutorForProfile) {
    return (
      <TutorProfilePage
        tutor={selectedTutorForProfile}
        currentUser={currentUser}
        onBack={() => {
          setSelectedTutorForProfile(null);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onNavigateHome={onNavigateHome}
        onNavigateAuth={onNavigateAuth}
        onOpenEnquiry={onOpenEnquiry}
        onOpenDemoBooking={onOpenDemoBooking}
        isBookedByParent={parentBookedTutorIds.has(selectedTutorForProfile.id)}
      />
    );
  }

  return (
    <div
      id="find-tutors-page"
      className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col antialiased pb-24 lg:pb-12 selection:bg-amber-200 selection:text-slate-900"
    >
      {/* Main Directory Content */}
      <div className="flex-1 w-full max-w-6xl mx-auto px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7 space-y-5">
        {/* Compact Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onNavigateHome}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#0c2340] hover:text-[#1d4ed8] transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </button>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 tabular-nums">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {isLoadingTeachers
                ? 'Syncing Live Tutors...'
                : `${enrichedTutors.length} Verified Tutors Live`}
            </span>
          </span>
        </div>
        {!currentUser ? (
          /* GATE 1: Parent Login Required for Unauthorized Visitors */
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-5">
            <div className="space-y-2 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-[#1d4ed8] text-xs font-bold">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Parent &amp; Student Portal · {enrichedTutors.length} Verified Tutors Ready</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-[#0c2340] tracking-tight">
                Sign in as Parent to browse &amp; book home tutors
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Unlock full tutor profiles, subject &amp; board monthly fee schedules, and book a free 3-day home tuition demo in Rayagada.
              </p>
            </div>

            {gateAuthError && (
              <div
                role="alert"
                className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{gateAuthError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                id="gate-google-login-btn"
                onClick={handleGateGoogleLogin}
                disabled={isGateGoogleLoggingIn}
                className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-[#0c2340] hover:bg-[#163a6b] text-white font-bold text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-70"
              >
                {isGateGoogleLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    </span>
                    <span>Continue with Google as Parent</span>
                  </>
                )}
              </button>

              {onNavigateAuth ? (
                <button
                  type="button"
                  onClick={() => onNavigateAuth('login', 'parent')}
                  className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Sign In / Register with Email</span>
                </button>
              ) : (
                <a
                  href={CONTACT_TEL_HREF}
                  className="w-full min-h-[48px] py-3 px-4 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-xs sm:text-sm shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4 fill-slate-950" />
                  <span>Call {CONTACT_PHONE_DISPLAY}</span>
                </a>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Aadhaar &amp; Degree Verified Faculty</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Transparent Monthly Fees</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>3-Day Free Home Trial</span>
              </div>
            </div>
          </div>
        ) : !isAuthorizedParent ? (
          /* GATE 2: Logged in as Teacher */
          <div className="max-w-xl mx-auto bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center space-y-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center border border-amber-200">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-extrabold text-[#0c2340]">Parent Account Required</h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-md mx-auto">
              You are signed in as a Tutor ({currentUser.email}). Switch to a Parent account to browse full tutor profiles and book home tuition.
            </p>
            <button
              type="button"
              onClick={handleGateGoogleLogin}
              disabled={isGateGoogleLoggingIn}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0c2340] hover:bg-[#163a6b] text-white font-bold text-xs sm:text-sm cursor-pointer disabled:opacity-70"
            >
              {isGateGoogleLoggingIn ? 'Switching...' : 'Switch to Parent Account'}
            </button>
          </div>
        ) : (
          /* AUTHORIZED PARENT VIEW: SEARCH, GPS & LIVE TUTOR CARDS */
          <div className="space-y-5">
            {/* Search & Filter Panel */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs space-y-3.5">
              {gpsToast && (
                <div
                  className={`p-2.5 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 ${
                    gpsToast.type === 'success'
                      ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                      : gpsToast.type === 'error'
                      ? 'bg-rose-50 text-rose-900 border border-rose-200'
                      : 'bg-blue-50 text-blue-900 border border-blue-200'
                  }`}
                >
                  <span>{gpsToast.message}</span>
                  <button type="button" onClick={() => setGpsToast(null)} className="px-1 font-bold cursor-pointer">
                    ×
                  </button>
                </div>
              )}

              {/* Area Search + Live GPS Button (Direct input without dropdown list items) */}
              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={locationSearchInput}
                    onChange={(e) => {
                      const raw = e.target.value;
                      if (gpsLabel && raw !== gpsLabel) {
                        setGpsLabel(null);
                        setLocationSearchInput(raw.replace(/^📍\s*/, ''));
                      } else {
                        setLocationSearchInput(raw);
                      }
                    }}
                    placeholder="Search area in Rayagada (e.g. Indira Nagar, Gandhi Nagar) or tutor name..."
                    className="w-full h-11 pl-10 pr-9 rounded-xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-[#1d4ed8]"
                  />
                  {locationSearchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocationSearchInput('');
                        setGpsLabel(null);
                      }}
                      aria-label="Clear search"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isLocatingGps}
                  className="h-11 px-4 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#0c2340] border border-blue-200 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  {isLocatingGps ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#1d4ed8]" />
                  ) : (
                    <LocateFixed className="w-4 h-4 text-[#1d4ed8]" />
                  )}
                  <span>Use GPS Location</span>
                </button>
              </div>

              {/* Filter Selectors (Class, Board, Subject) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="relative">
                  <select
                    aria-label="Filter by Class"
                    value={selectedClass}
                    onChange={(e) => setSelectedClass(e.target.value)}
                    className="w-full h-10 pl-3 pr-7 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 appearance-none cursor-pointer"
                  >
                    {CLASS_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="relative">
                  <select
                    aria-label="Filter by Board"
                    value={selectedBoard}
                    onChange={(e) => setSelectedBoard(e.target.value)}
                    className="w-full h-10 pl-3 pr-7 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 appearance-none cursor-pointer"
                  >
                    {BOARD_OPTIONS.map((b) => (
                      <option key={b.value} value={b.value}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>

                <div className="relative">
                  <select
                    aria-label="Filter by Subject"
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                    className="w-full h-10 pl-3 pr-7 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800 appearance-none cursor-pointer"
                  >
                    {SUBJECT_OPTIONS.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {hasActiveFilters && (
                <div className="pt-1 flex justify-end text-xs">
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="font-bold text-[#1d4ed8] hover:underline cursor-pointer"
                  >
                    Clear All Filters
                  </button>
                </div>
              )}
            </div>

            {/* Verified Tutors Directory Grid */}
            {isLoadingTeachers ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2.5">
                <Loader2 className="w-7 h-7 animate-spin text-[#1d4ed8] mx-auto" />
                <p className="text-xs sm:text-sm font-semibold text-slate-600">
                  Loading verified home tutors from Firestore...
                </p>
              </div>
            ) : filteredTutors.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
                <Compass className="w-9 h-9 text-[#1d4ed8] mx-auto" />
                <h3 className="text-base font-extrabold text-[#0c2340]">
                  No tutors match your current filters near {currentLocationLabel}
                </h3>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                  Clear your search or filters to see all {enrichedTutors.length} verified tutors in Rayagada.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={resetAllFilters}
                    className="px-5 py-2.5 rounded-xl bg-[#0c2340] hover:bg-[#163a6b] text-white font-bold text-xs sm:text-sm cursor-pointer"
                  >
                    Show All Tutors ({enrichedTutors.length})
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTutors.map((tutor) => {
                  const isFav = favoriteIds.has(tutor.id);
                  const isBooked = parentBookedTutorIds.has(tutor.id);
                  const isPendingBooking = !isBooked && parentPendingTutorIds.has(tutor.id);

                  return (
                    <article
                      key={tutor.id}
                      className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <img
                              src={tutor.avatar || '/Logo/kumarilogo.png'}
                              alt={tutor.name}
                              onError={(e) => {
                                const img = e.currentTarget;
                                if (!img.dataset.fallbackApplied) {
                                  img.dataset.fallbackApplied = '1';
                                  img.src = '/Logo/kumarilogo.png';
                                }
                              }}
                              className="w-12 h-12 rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0 space-y-1">
                              <div className="flex items-center gap-1.5">
                                <h3 className="text-sm sm:text-base font-extrabold text-[#0c2340] truncate">
                                  {tutor.name}
                                </h3>
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-slate-600 font-semibold">
                                <MapPin className="w-3 h-3 text-[#1d4ed8] shrink-0" />
                                <span className="truncate">{tutor.locationArea || 'Rayagada'}</span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            aria-label={isFav ? 'Remove from favorites' : 'Save tutor'}
                            onClick={(e) => toggleFavorite(tutor.id, e)}
                            className="w-9 h-9 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center shrink-0 cursor-pointer"
                          >
                            <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-500 text-rose-500' : 'text-slate-400'}`} />
                          </button>
                        </div>

                        <div className="pt-2.5 border-t border-slate-100 space-y-1.5 text-xs">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-slate-500 font-medium shrink-0">Subjects:</span>
                            <span className="font-semibold text-slate-800 text-right truncate">
                              {tutor.subjects && tutor.subjects.length > 0
                                ? tutor.subjects.slice(0, 3).join(' · ') +
                                  (tutor.subjects.length > 3 ? ` +${tutor.subjects.length - 3}` : '')
                                : 'All School Subjects'}
                            </span>
                          </div>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-slate-500 font-medium shrink-0">Classes:</span>
                            <span className="font-semibold text-slate-800 text-right truncate">
                              {formatClassesCompact(tutor.classesHandled)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2.5 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleViewProfileClick(tutor)}
                          className="min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-500" />
                          <span>View Profile</span>
                        </button>

                        {isBooked ? (
                          <div className="min-h-[42px] px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-center gap-1.5">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                            <span>Booked</span>
                          </div>
                        ) : isPendingBooking ? (
                          <div className="min-h-[42px] px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 font-bold text-xs flex items-center justify-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>Requested</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleBookHomeTutor(tutor)}
                            className="min-h-[42px] px-3 py-2 rounded-xl bg-[#0c2340] hover:bg-[#163a6b] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Home className="w-3.5 h-3.5" />
                            <span>Book Tutor</span>
                          </button>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Home Tutor Direct Booking Modal */}
      <BookHomeTutorModal
        isOpen={Boolean(bookingTutorTarget)}
        tutor={bookingTutorTarget}
        currentUser={currentUser}
        onClose={() => setBookingTutorTarget(null)}
        onNavigateAuth={onNavigateAuth}
        onBookingSuccess={() => {
          if (bookingTutorTarget?.id) {
            setParentPendingTutorIds((prev) => {
              const next = new Set(prev);
              next.add(bookingTutorTarget.id);
              return next;
            });
          }
        }}
      />
    </div>
  );
};
