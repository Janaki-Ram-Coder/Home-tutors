import React, { useEffect, useMemo, useState } from 'react';
import {
  Star,
  ShieldCheck,
  CheckCircle2,
  BookOpen,
  GraduationCap,
  Briefcase,
  Clock,
  ArrowLeft,
  ArrowRight,
  Home,
  Award,
  Sparkles,
  MessageSquare,
  Layers,
  Check,
  Share2,
  UserCheck,
  Languages,
  CalendarCheck,
  Heart,
  Users,
  User,
  Trophy,
  Monitor,
  Target,
  Phone,
  Calendar,
  MapPin,
  X,
  Send,
  Loader2,
} from 'lucide-react';
import { Tutor, TutorReview } from '../data/tutorsData';
import { BookHomeTutorModal } from './BookHomeTutorModal';
import {
  AppUserProfile,
  subscribeToSingleTutorRealtime,
  subscribeToRealtimeBookings,
  submitParentTutorReview,
} from '../services/firebaseAuth';
import { instituteInfo } from '../data/instituteData';
import { useBackButtonDismiss } from '../hooks/useBackButtonDismiss';

interface TutorProfilePageProps {
  tutor: Tutor;
  currentUser?: AppUserProfile | null;
  onBack: () => void;
  onNavigateHome?: () => void;
  onNavigateAuth?: (
    mode?: 'login' | 'register' | 'parent-login' | 'teacher-login' | 'create-parent' | 'create-teacher',
    role?: 'parent' | 'teacher'
  ) => void;
  onOpenEnquiry?: () => void;
  onOpenDemoBooking?: () => void;
  isBookedByParent?: boolean;
}

const FAV_TUTORS_STORAGE_KEY = 'kumari_saved_favorite_tutors';

function loadSavedFavoriteIds(): string[] {
  try {
    const raw = localStorage.getItem(FAV_TUTORS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatClassesCompact(classesList: string[]): string {
  if (!Array.isArray(classesList) || classesList.length === 0) return '1st – 10th';
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
      return `${ordinal(min)} – ${ordinal(max)}`;
    }
  }
  return classesList
    .map((c) => c.replace(/\s*Class$/i, '').trim())
    .join(', ');
}

export const TutorProfilePage: React.FC<TutorProfilePageProps> = ({
  tutor,
  currentUser,
  onBack,
  onNavigateAuth,
  onOpenEnquiry,
  onOpenDemoBooking,
  isBookedByParent = false,
}) => {
  const [liveOverrides, setLiveOverrides] = useState<Partial<Tutor>>({});
  const [realtimeReviews, setRealtimeReviews] = useState<TutorReview[] | null>(null);
  const [bookedStudentsCount, setBookedStudentsCount] = useState<number>(0);

  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);

  useBackButtonDismiss(isBookingModalOpen, 'tutor-profile-book-modal', () =>
    setIsBookingModalOpen(false)
  );
  useBackButtonDismiss(isReviewsModalOpen, 'tutor-profile-reviews-modal', () =>
    setIsReviewsModalOpen(false)
  );

  const [copiedLink, setCopiedLink] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [realtimeBookedByParent, setRealtimeBookedByParent] = useState(false);
  const [isFavorite, setIsFavorite] = useState<boolean>(() =>
    loadSavedFavoriteIds().includes(tutor.id)
  );
  const [activeReviewIdx, setActiveReviewIdx] = useState(0);

  // Parent review submission state
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewStudentGrade, setReviewStudentGrade] = useState(
    currentUser?.childGrade ? `Parent of ${currentUser.childGrade} Student` : 'Parent'
  );
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState<string | null>(null);
  const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState(false);

  // Sync favorite & avatar state if tutor switches
  useEffect(() => {
    setLiveOverrides({});
    setRealtimeReviews(null);
    setActiveReviewIdx(0);
    setAvatarFailed(false);
    setRealtimeBookedByParent(false);
    setIsFavorite(loadSavedFavoriteIds().includes(tutor.id));
  }, [tutor.id]);

  // Keep booked status accurate even when opened via App.tsx without isBookedByParent prop
  useEffect(() => {
    if (isBookedByParent) {
      setRealtimeBookedByParent(true);
      return;
    }
    if (!currentUser || currentUser.role === 'teacher' || currentUser.role === 'admin') {
      setRealtimeBookedByParent(false);
      return;
    }

    const hasInProfile =
      (Array.isArray(currentUser.hiredTutors) &&
        currentUser.hiredTutors.some((h: any) => h?.tutorId === tutor.id)) ||
      currentUser.assignedEducator?.id === tutor.id;
    if (hasInProfile) {
      setRealtimeBookedByParent(true);
    }

    const normPhone = currentUser.phone ? currentUser.phone.replace(/\D/g, '') : '';
    const userEmail = currentUser.email ? currentUser.email.toLowerCase().trim() : '';
    const userUid = currentUser.uid || '';

    const unsub = subscribeToRealtimeBookings((allBookings) => {
      const matched = allBookings.some((b: any) => {
        const matchesTutor =
          b.requestedTutorId === tutor.id || b.assignedTutorId === tutor.id;
        if (!matchesTutor) return false;
        const isCompleted =
          b.status === 'accepted' ||
          b.status === 'assigned' ||
          b.status === 'completed' ||
          b.status === 'confirmed' ||
          b.status === 'reassigned' ||
          b.status === 'pending';
        if (!isCompleted) return false;

        const bPhone = b.parentPhone ? b.parentPhone.replace(/\D/g, '') : '';
        const bEmail = b.parentEmail ? b.parentEmail.toLowerCase().trim() : '';
        const bUid = b.parentUid || '';
        return (
          Boolean(userUid && bUid && userUid === bUid) ||
          Boolean(userEmail && bEmail && userEmail === bEmail) ||
          Boolean(
            normPhone &&
              bPhone &&
              normPhone.length >= 10 &&
              bPhone.length >= 10 &&
              normPhone.slice(-10) === bPhone.slice(-10)
          )
        );
      });
      setRealtimeBookedByParent(Boolean(hasInProfile || matched));
    });

    return () => unsub();
  }, [
    isBookedByParent,
    tutor.id,
    currentUser?.uid,
    currentUser?.email,
    currentUser?.phone,
    currentUser?.role,
    currentUser?.hiredTutors,
    currentUser?.assignedEducator?.id,
  ]);

  const effectiveIsBooked = Boolean(isBookedByParent || realtimeBookedByParent);

  // Real-time Firestore subscription to teachers/{id}, complete_tutors/{id}, and tutors_reviews
  useEffect(() => {
    const unsubscribe = subscribeToSingleTutorRealtime(
      tutor.id,
      ({ tutorUpdates, liveReviews, bookedStudentsCount: studentCount }) => {
        setLiveOverrides(tutorUpdates);
        setRealtimeReviews(liveReviews);
        setBookedStudentsCount(studentCount);
      }
    );
    return () => unsubscribe();
  }, [tutor.id]);

  const activeTutor: Tutor = useMemo(
    () => ({
      ...tutor,
      ...liveOverrides,
    }),
    [tutor, liveOverrides]
  );

  // Handle sharing tutor profile link
  const handleShare = async () => {
    const shareTitle = `${tutorName} - Kumari Institute Verified Tutor`;
    const shareText = `Check out ${tutorName}'s home tutor profile on Kumari Institute.`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: window.location.href,
        });
        return;
      } catch {
        // Fallback to clipboard copy
      }
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard
        .writeText(window.location.href)
        .then(() => {
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2500);
        })
        .catch(() => {
          // Clipboard write blocked in embedded preview
        });
    }
  };

  const handleToggleFavorite = () => {
    const current = loadSavedFavoriteIds();
    const exists = current.includes(activeTutor.id);
    const updated = exists
      ? current.filter((id) => id !== activeTutor.id)
      : [...current, activeTutor.id];
    try {
      localStorage.setItem(FAV_TUTORS_STORAGE_KEY, JSON.stringify(updated));
    } catch {}
    setIsFavorite(!exists);
  };

  // Accurate real-time Firestore tutor fields
  const tutorName = activeTutor.name || 'Verified Tutor';
  const isVerifiedTutor = Boolean(
    activeTutor.verified || activeTutor.isApproved || activeTutor.status === 'approved'
  );

  const rawExperience =
    activeTutor.experienceYears ??
    activeTutor.totalExperience ??
    (activeTutor as any).experience ??
    0;
  const experienceYearsVal =
    typeof rawExperience === 'number' && rawExperience > 0
      ? rawExperience
      : parseInt(String(rawExperience || '0').replace(/[^0-9]/g, ''), 10) || 0;

  const degreeTitle =
    activeTutor.highestQualification ||
    activeTutor.qualification ||
    activeTutor.courseDegree ||
    activeTutor.educationDetails?.degree?.course ||
    '';

  const shortDegreeTitle = degreeTitle ? degreeTitle.split('(')[0].trim() : 'Qualification Pending';

  const universityName =
    activeTutor.university ||
    activeTutor.educationDetails?.degree?.university ||
    '';

  const shortUniversityName = universityName ? universityName.split(',')[0].trim() : '';
  const degreeDisplayTitle = degreeTitle || 'Qualification Pending';
  const degreeYear = activeTutor.passingYear || activeTutor.educationDetails?.degree?.year || '';
  const degreeScore = activeTutor.educationDetails?.degree?.score || '';
  const tenthDetails = activeTutor.educationDetails?.tenth;
  const twelfthDetails = activeTutor.educationDetails?.twelfth;

  const subjectsList =
    Array.isArray(activeTutor.subjects) && activeTutor.subjects.length > 0
      ? activeTutor.subjects
      : ['Mathematics', 'Science', 'English'];

  const classesList =
    Array.isArray(activeTutor.classesHandled) && activeTutor.classesHandled.length > 0
      ? activeTutor.classesHandled
      : ['1st – 10th'];

  const boardsList =
    Array.isArray(activeTutor.boardsSupported) && activeTutor.boardsSupported.length > 0
      ? activeTutor.boardsSupported
      : ['CBSE', 'ICSE'];

  const languagesList =
    Array.isArray(activeTutor.languages) && activeTutor.languages.length > 0
      ? activeTutor.languages
      : ['English', 'Odia', 'Hindi'];

  const timeSlotsList =
    Array.isArray(activeTutor.availableTimeSlots) && activeTutor.availableTimeSlots.length > 0
      ? activeTutor.availableTimeSlots
      : Array.isArray((activeTutor as any).timeSlots) && (activeTutor as any).timeSlots.length > 0
      ? (activeTutor as any).timeSlots
      : [];

  // Real-time Firestore reviews (deduplicated from tutors_reviews & tutor.reviews)
  const allReviews: TutorReview[] = useMemo(() => {
    if (realtimeReviews !== null) {
      return realtimeReviews;
    }
    return Array.isArray(activeTutor.reviews) ? activeTutor.reviews : [];
  }, [realtimeReviews, activeTutor.reviews]);

  // Clamp carousel index cleanly when reviews list changes
  useEffect(() => {
    if (activeReviewIdx >= allReviews.length) {
      setActiveReviewIdx(0);
    }
  }, [allReviews.length, activeReviewIdx]);

  const ratingVal = useMemo(() => {
    if (allReviews.length > 0) {
      const avg =
        allReviews.reduce((sum, r) => sum + (Number(r.rating) || 5), 0) / allReviews.length;
      return Math.round(avg * 10) / 10;
    }
    return typeof activeTutor.rating === 'number' && activeTutor.rating > 0
      ? activeTutor.rating
      : 4.9;
  }, [allReviews, activeTutor.rating]);

  const reviewCountVal =
    allReviews.length > 0
      ? allReviews.length
      : typeof activeTutor.reviewCount === 'number' && activeTutor.reviewCount > 0
      ? activeTutor.reviewCount
      : 0;

  const totalStudentsCount =
    bookedStudentsCount > 0
      ? bookedStudentsCount
      : Array.isArray(activeTutor.assignedStudents) && activeTutor.assignedStudents.length > 0
      ? activeTutor.assignedStudents.length
      : 0;

  const bioText = activeTutor.bio?.trim()
    ? activeTutor.bio.trim()
    : `${tutorName} is a verified home tutor in ${
        activeTutor.locationArea || 'Rayagada'
      } with ${experienceYearsVal > 0 ? `${experienceYearsVal}+ years of experience ` : ''}teaching ${subjectsList
        .slice(0, 3)
        .join(', ')}. Focused on concept clarity, regular practice, and personalized 1-on-1 guidance for every student.`;

  const tutorSubtitle =
    activeTutor.teacherType === 'both'
      ? 'Home Tutor | Coaching & Entrance Coach'
      : `Home Tutor | ${boardsList.slice(0, 2).join(' & ')} Specialist`;

  const classesDisplay = formatClassesCompact(classesList);
  const subjectsDisplay = subjectsList.join(', ');
  const hasEntranceMeta = Boolean((activeTutor as any).entrancePrep);
  const thirdTileTitle = hasEntranceMeta ? 'Entrance Prep' : 'Boards Supported';
  const thirdTileValue = hasEntranceMeta
    ? String((activeTutor as any).entrancePrep)
    : boardsList.join(', ');
  const modeDisplay =
    activeTutor.teacherType === 'both'
      ? 'Home Tuition & Online Classes (Both)'
      : '1-on-1 Personalized Home Tuition';

  const rawDist = (activeTutor as any).liveDistanceKm ?? activeTutor.distanceKm;
  const distanceKmVal =
    typeof rawDist === 'number' && !isNaN(rawDist) && isFinite(rawDist) ? rawDist : null;

  const teachingStylePoints =
    Array.isArray(activeTutor.teachingHighlights) && activeTutor.teachingHighlights.length > 0
      ? activeTutor.teachingHighlights.slice(0, 4)
      : [
          'Concept-based learning',
          'Real-life examples',
          'Doubt clearing (anytime)',
          'Regular tests & tracking',
        ];

  const howITeachPoints =
    Array.isArray(activeTutor.dailyRoutine) && activeTutor.dailyRoutine.length > 0
      ? activeTutor.dailyRoutine.slice(0, 4).map((d) => d.step)
      : [
          'Simple & clear explanation',
          'Step-by-step approach',
          'Practice with worksheets',
          'Revision & mock tests',
        ];

  const callPhoneHref = `tel:${instituteInfo.phoneClean}`;

  const anyMobileModalOpen = Boolean(isBookingModalOpen || isReviewsModalOpen);

  const handleParentReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      if (onNavigateAuth) onNavigateAuth('parent-login', 'parent');
      return;
    }
    if (!reviewComment.trim() || reviewComment.trim().length < 8) {
      setReviewSubmitError('Please write a short review (at least 8 characters).');
      return;
    }
    setIsSubmittingReview(true);
    setReviewSubmitError(null);
    try {
      await submitParentTutorReview(activeTutor.id, {
        parentName: currentUser.name || 'Verified Parent',
        relation: reviewStudentGrade.trim() || 'Parent',
        rating: reviewRating,
        comment: reviewComment.trim(),
        studentGrade: currentUser.childGrade || classesList[0] || '',
        schoolName: currentUser.childSchool || 'Rayagada',
      });
      setReviewComment('');
      setReviewRating(5);
      setReviewSubmitSuccess(true);
      setTimeout(() => setReviewSubmitSuccess(false), 3000);
    } catch (err: any) {
      setReviewSubmitError(err?.message || 'Unable to save review right now.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f6f4fc] md:bg-slate-50/70 text-slate-800 antialiased">
      {/* =========================================================================
          MOBILE VIEW (< md) — MATCHES ATTACHED UI EXACTLY WITH LIVE FIRESTORE DATA
         ========================================================================= */}
      <div className="md:hidden pb-24">
        {/* 1. MOBILE TOP APP HEADER */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-100 h-14 px-2.5 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to All Tutors"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 active:scale-95 transition-all text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
          </button>

          <h1 className="text-[17px] font-bold text-slate-900 tracking-tight truncate">
            Teacher Profile
          </h1>

          <div className="flex items-center">
            <button
              type="button"
              onClick={handleShare}
              aria-label="Share Teacher Profile"
              className="min-w-[40px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 active:scale-95 transition-all text-slate-800 cursor-pointer relative"
            >
              <Share2 className="w-5 h-5 stroke-[1.9]" />
              {copiedLink && (
                <span className="absolute -bottom-5 right-0 px-2 py-0.5 rounded-md bg-slate-900 text-white text-[9px] font-semibold whitespace-nowrap shadow-md">
                  Copied!
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={handleToggleFavorite}
              aria-label={isFavorite ? 'Remove from saved tutors' : 'Save tutor'}
              className="min-w-[40px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-slate-100 active:scale-95 transition-all text-slate-800 cursor-pointer"
            >
              <Heart
                className={`w-5 h-5 stroke-[1.9] transition-colors ${
                  isFavorite ? 'fill-rose-500 text-rose-500' : 'text-slate-800'
                }`}
              />
            </button>
          </div>
        </header>

        {/* 2. SOFT LAVENDER HERO PROFILE BANNER */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#dad0fb] via-[#ebe5fd] to-[#f4f1fe] px-3.5 pt-4 pb-5">
          {/* Subtle Decorative Lavender Wave Accent */}
          <svg
            aria-hidden="true"
            viewBox="0 0 400 180"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none opacity-65"
          >
            <path
              d="M0,20 C120,90 260,0 400,55 L400,0 L0,0 Z"
              fill="#cfc2fa"
              fillOpacity="0.4"
            />
            <path
              d="M150,180 C250,120 330,150 400,90 L400,180 Z"
              fill="#dcd3fc"
              fillOpacity="0.45"
            />
          </svg>

          <div className="relative z-10">
            <div className="flex items-center gap-3.5">
              {/* Circular Avatar with Bottom-Right Green Verified Check */}
              <div className="relative shrink-0">
                <div className="w-[82px] h-[82px] rounded-full border-[3px] border-white shadow-[0_6px_18px_rgba(91,55,183,0.18)] overflow-hidden bg-white flex items-center justify-center">
                  {activeTutor.avatar && !avatarFailed ? (
                    <img
                      src={activeTutor.avatar}
                      alt={tutorName}
                      onError={() => setAvatarFailed(true)}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-black text-[#6d44c9]">
                      {tutorName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                {isVerifiedTutor && (
                  <span
                    aria-label="Verified Genuine Tutor"
                    className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#169b53] border-2 border-white flex items-center justify-center text-white shadow-sm"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </span>
                )}
              </div>

              {/* Name, Verified Pill, Subtitle & Rating */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1.5">
                  <div className="flex items-center gap-1 min-w-0">
                    <h2 className="text-[18px] font-extrabold text-slate-900 tracking-tight truncate">
                      {tutorName}
                    </h2>
                    {isVerifiedTutor && (
                      <svg
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                        className="w-4 h-4 text-[#1d9bf0] shrink-0"
                        fill="currentColor"
                      >
                        <path d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.71-3.998-3.818-3.998-.47 0-.92.084-1.336.25C14.818 2.415 13.51 1.5 12 1.5s-2.816.917-3.437 2.25c-.415-.165-.866-.25-1.336-.25-2.11 0-3.818 1.79-3.818 4 0 .494.083.964.237 1.4-1.272.65-2.147 2.018-2.147 3.6 0 1.495.782 2.798 1.942 3.486-.02.17-.032.34-.032.514 0 2.21 1.708 4 3.818 4 .47 0 .92-.086 1.335-.25.62 1.334 1.926 2.25 3.437 2.25 1.512 0 2.818-.916 3.437-2.25.415.163.865.248 1.336.248 2.11 0 3.818-1.79 3.818-4 0-.174-.012-.344-.033-.513 1.158-.687 1.943-1.99 1.943-3.484zm-6.616-3.334l-4.334 6.5c-.145.217-.382.334-.625.334-.143 0-.288-.04-.416-.126l-.115-.094-2.415-2.415c-.293-.293-.293-.768 0-1.06s.768-.294 1.06 0l1.77 1.767 3.825-5.74c.23-.345.696-.436 1.04-.207.346.23.44.696.21 1.04z" />
                      </svg>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/95 border border-emerald-200/80 text-[#15803d] text-[10px] font-semibold shadow-2xs shrink-0 whitespace-nowrap">
                    <Check className="w-3 h-3 text-[#16a34a] stroke-[2.8]" />
                    <span>{isVerifiedTutor ? 'Verified Tutor' : 'Pending'}</span>
                  </span>
                </div>

                {/* Subtitle */}
                <p className="text-[12.5px] text-slate-700 font-medium mt-0.5 truncate">
                  {tutorSubtitle}
                </p>

                {/* Star Rating + Reviews Count & Distance */}
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5">
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-[#f59e0b] text-[#f59e0b] shrink-0" />
                    <span className="text-[14px] font-extrabold text-slate-900 tabular-nums">
                      {reviewCountVal > 0 || activeTutor.rating ? ratingVal.toFixed(1) : 'New'}
                    </span>
                    <span className="text-[11.5px] text-slate-600 font-medium tabular-nums">
                      ({reviewCountVal} {reviewCountVal === 1 ? 'Review' : 'Reviews'})
                    </span>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11.5px] text-slate-700 font-semibold tabular-nums">
                    <MapPin className="w-3.5 h-3.5 text-[#6d44c9] shrink-0" />
                    <span>
                      {activeTutor.locationArea || 'Rayagada'}
                      {distanceKmVal !== null ? ` · ${distanceKmVal.toFixed(1)} km away` : ''}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Full-Width 3 Balanced Hero Stat Boxes */}
            <div className="grid grid-cols-3 gap-2 mt-3.5">
              {/* Box 1: Highest Qualification & University */}
              <div className="bg-white/95 rounded-2xl px-1.5 py-2.5 shadow-[0_3px_12px_rgba(91,55,183,0.08)] border border-white flex flex-col items-center text-center justify-center min-w-0">
                <div className="w-7 h-7 rounded-xl bg-[#f2edfd] text-[#6d44c9] flex items-center justify-center mb-1.5 shrink-0">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div className="text-[12px] font-extrabold text-slate-900 leading-tight truncate w-full">
                  {shortDegreeTitle}
                </div>
                <div className="text-[9.5px] text-slate-500 font-medium leading-tight w-full mt-0.5 truncate">
                  {shortUniversityName || 'Highest Qualification'}
                </div>
              </div>

              {/* Box 2: Experience */}
              <div className="bg-white/95 rounded-2xl px-2 py-2.5 shadow-[0_3px_12px_rgba(91,55,183,0.08)] border border-white flex flex-col items-center text-center justify-center min-w-0">
                <div className="w-7 h-7 rounded-xl bg-[#f2edfd] text-[#6d44c9] flex items-center justify-center mb-1.5 shrink-0">
                  <Briefcase className="w-4 h-4" />
                </div>
                <div className="text-[12px] font-extrabold text-slate-900 leading-tight truncate w-full tabular-nums">
                  {experienceYearsVal > 0 ? `${experienceYearsVal}+ Years` : 'Experience Pending'}
                </div>
                <div className="text-[10px] text-slate-500 font-medium leading-tight truncate w-full mt-0.5">
                  {experienceYearsVal > 0 ? 'Experience' : 'Home Tutor'}
                </div>
              </div>

              {/* Box 3: Students */}
              <div className="bg-white/95 rounded-2xl px-2 py-2.5 shadow-[0_3px_12px_rgba(91,55,183,0.08)] border border-white flex flex-col items-center text-center justify-center min-w-0">
                <div className="w-7 h-7 rounded-xl bg-[#f2edfd] text-[#6d44c9] flex items-center justify-center mb-1.5 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="text-[12px] font-extrabold text-slate-900 leading-tight truncate w-full tabular-nums">
                  {totalStudentsCount > 0 ? `${totalStudentsCount}+` : '1-on-1'}
                </div>
                <div className="text-[10px] text-slate-500 font-medium leading-tight truncate w-full mt-0.5">
                  {totalStudentsCount > 0 ? 'Students' : 'Coaching'}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. STACKED CONTENT CARDS */}
        <div className="px-3 pt-2.5 space-y-2.5">
          {/* CARD 1: ABOUT ME */}
          <section className="bg-white rounded-2xl p-3.5 shadow-[0_2px_10px_rgba(91,55,183,0.05)] border border-purple-100/60 text-left">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-[#6d44c9] shrink-0" />
              <h3 className="text-[15px] font-bold text-slate-900 tracking-tight">About Me</h3>
            </div>
            <p className="text-[12px] leading-[1.55] text-slate-700 mt-1.5 font-normal">
              {bioText}
            </p>
          </section>

          {/* CARD 2: TEACHING DETAILS (1-COLUMN HORIZONTAL DETAIL CARDS) */}
          <section className="bg-white rounded-2xl p-3.5 shadow-[0_2px_10px_rgba(91,55,183,0.05)] border border-purple-100/60 text-left">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[#6d44c9] shrink-0" />
              <h3 className="text-[15px] font-bold text-slate-900 tracking-tight">
                Teaching Details
              </h3>
            </div>

            <div className="flex flex-col gap-2.5 mt-3">
              {/* Row 1: Classes */}
              <div className="rounded-xl border border-purple-100/80 bg-[#fbfafe] px-3 py-2.5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#efeafd] text-[#6d44c9] flex items-center justify-center shrink-0 mt-0.5">
                  <Home className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold text-slate-900 leading-tight">
                    Classes Handled
                  </div>
                  <div className="text-[12px] leading-snug text-slate-600 font-medium mt-0.5">
                    {classesDisplay}
                  </div>
                </div>
              </div>

              {/* Row 2: Subjects */}
              <div className="rounded-xl border border-purple-100/80 bg-[#fbfafe] px-3 py-2.5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#efeafd] text-[#6d44c9] flex items-center justify-center shrink-0 mt-0.5">
                  <Layers className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold text-slate-900 leading-tight">
                    Subjects
                  </div>
                  <div className="text-[12px] leading-snug text-slate-600 font-medium mt-0.5">
                    {subjectsDisplay}
                  </div>
                </div>
              </div>

              {/* Row 3: Entrance Prep / Boards */}
              <div className="rounded-xl border border-purple-100/80 bg-[#fbfafe] px-3 py-2.5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#efeafd] text-[#6d44c9] flex items-center justify-center shrink-0 mt-0.5">
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold text-slate-900 leading-tight">
                    {thirdTileTitle}
                  </div>
                  <div className="text-[12px] leading-snug text-slate-600 font-medium mt-0.5">
                    {thirdTileValue}
                  </div>
                </div>
              </div>

              {/* Row 4: Teaching Mode */}
              <div className="rounded-xl border border-purple-100/80 bg-[#fbfafe] px-3 py-2.5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#efeafd] text-[#6d44c9] flex items-center justify-center shrink-0 mt-0.5">
                  <Monitor className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold text-slate-900 leading-tight">
                    Teaching Mode
                  </div>
                  <div className="text-[12px] leading-snug text-slate-600 font-medium mt-0.5">
                    {modeDisplay}
                  </div>
                </div>
              </div>

              {/* Row 5: Qualification & Experience */}
              <div className="rounded-xl border border-purple-100/80 bg-[#fbfafe] px-3 py-2.5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#efeafd] text-[#6d44c9] flex items-center justify-center shrink-0 mt-0.5">
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold text-slate-900 leading-tight">
                    Qualification &amp; Experience
                  </div>
                  <div className="text-[12px] leading-snug text-slate-600 font-medium mt-0.5">
                    {degreeDisplayTitle}
                    {universityName ? ` (${universityName}${degreeYear ? `, ${degreeYear}` : ''})` : ''}
                    {' · '}
                    {experienceYearsVal > 0 ? `${experienceYearsVal}+ Years Experience` : 'Experience Pending'}
                  </div>
                </div>
              </div>

              {/* Row 6: Location & Distance */}
              <div className="rounded-xl border border-purple-100/80 bg-[#fbfafe] px-3 py-2.5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#efeafd] text-[#6d44c9] flex items-center justify-center shrink-0 mt-0.5">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-bold text-slate-900 leading-tight">
                    Location &amp; Distance
                  </div>
                  <div className="text-[12px] leading-snug text-slate-600 font-medium mt-0.5 tabular-nums">
                    {activeTutor.locationArea || 'Rayagada'}
                    {distanceKmVal !== null ? ` · ${distanceKmVal.toFixed(1)} km away` : ''}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* CARD ROW 3: TEACHING STYLE + HOW I TEACH (SIDE BY SIDE) */}
          <div className="grid grid-cols-2 gap-2.5 text-left">
            {/* Left: Teaching Style */}
            <section className="bg-white rounded-2xl p-3 shadow-[0_2px_10px_rgba(91,55,183,0.05)] border border-purple-100/60">
              <div className="flex items-center gap-1.5">
                <Target className="w-4 h-4 text-[#6d44c9] shrink-0" />
                <h3 className="text-[13.5px] font-bold text-slate-900 tracking-tight truncate">
                  Teaching Style
                </h3>
              </div>

              <ul className="space-y-1.5 mt-2.5">
                {teachingStylePoints.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-full bg-[#22c55e] text-white flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-2.5 h-2.5 stroke-[3]" />
                    </span>
                    <span className="text-[10.5px] leading-snug text-slate-700 font-medium">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Right: How I Teach */}
            <section className="bg-white rounded-2xl p-3 shadow-[0_2px_10px_rgba(91,55,183,0.05)] border border-purple-100/60">
              <div className="flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-[#6d44c9] shrink-0" />
                <h3 className="text-[13.5px] font-bold text-slate-900 tracking-tight truncate">
                  How I Teach
                </h3>
              </div>

              <div className="flex items-center gap-1.5 mt-2">
                {/* Inline Tutor & Presentation Vector Illustration matching screenshot */}
                <svg
                  viewBox="0 0 64 64"
                  aria-hidden="true"
                  className="w-[46px] h-[52px] shrink-0"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  {/* Presentation Screen */}
                  <rect
                    x="22"
                    y="8"
                    width="38"
                    height="28"
                    rx="4"
                    fill="#eef2ff"
                    stroke="#818cf8"
                    strokeWidth="2"
                  />
                  <polygon points="38,16 38,28 48,22" fill="#a5b4fc" />
                  <rect x="18" y="39" width="42" height="5" rx="2.5" fill="#c7d2fe" />
                  {/* Educator Figure */}
                  <circle cx="15" cy="18" r="6" fill="#f3c6a5" />
                  <path
                    d="M9.5 17C9.5 13.5 12 11 15.5 11C18.5 11 20.5 13.2 20.5 16.5C18.5 15 12.5 15 9.5 17Z"
                    fill="#1e293b"
                  />
                  <path
                    d="M5 42C5 31 9.5 26 15 26C20.5 26 24 31 24 42H5Z"
                    fill="#6d44c9"
                  />
                  {/* Pointer Arm */}
                  <path
                    d="M19 31L29 25"
                    stroke="#6d44c9"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />
                  <circle cx="30" cy="24.5" r="2" fill="#f3c6a5" />
                </svg>

                <ul className="space-y-1 flex-1 min-w-0">
                  {howITeachPoints.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-1">
                      <Check className="w-3 h-3 text-[#16a34a] stroke-[2.8] shrink-0 mt-0.5" />
                      <span className="text-[9.5px] leading-tight text-slate-700 font-medium">
                        {step}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          {/* CARD 4: REVIEWS (REAL-TIME FROM FIRESTORE) */}
          <section className="bg-white rounded-2xl p-3.5 shadow-[0_2px_10px_rgba(91,55,183,0.05)] border border-purple-100/60 text-left">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 fill-[#f59e0b] text-[#f59e0b] shrink-0" />
                <h3 className="text-[15px] font-bold text-slate-900 tracking-tight tabular-nums">
                  Reviews ({reviewCountVal})
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsReviewsModalOpen(true)}
                className="text-[12px] font-bold text-[#6d44c9] inline-flex items-center gap-0.5 cursor-pointer py-1 px-1.5 rounded-lg hover:bg-purple-50 transition-colors"
              >
                <span>{allReviews.length > 0 ? 'View All' : 'Write Review'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {allReviews.length > 0 ? (
              <div className="mt-2.5">
                {(() => {
                  const activeRev = allReviews[activeReviewIdx] || allReviews[0];
                  return (
                    <div className="rounded-xl border border-slate-100 bg-[#fbfafe] p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-[#b7a0f6] text-white font-bold text-sm flex items-center justify-center shrink-0">
                            {(activeRev.parentName || 'P').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[12.5px] font-bold text-slate-900 truncate">
                              {activeRev.parentName}
                            </div>
                            <div className="text-[10.5px] text-slate-500 truncate">
                              {activeRev.relation || 'Parent'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <div className="flex items-center">
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`w-3 h-3 ${
                                  i < Math.round(Number(activeRev.rating) || 5)
                                    ? 'fill-[#f59e0b] text-[#f59e0b]'
                                    : 'text-slate-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-[11.5px] font-bold text-slate-800 tabular-nums ml-0.5">
                            {Number(activeRev.rating || 5).toFixed(1)}
                          </span>
                        </div>
                      </div>

                      <p className="text-[11.5px] leading-[1.5] text-slate-700 mt-2">
                        {activeRev.comment}
                      </p>
                    </div>
                  );
                })()}

                {/* Interactive Carousel Indicator Dots */}
                {allReviews.length > 1 && (
                  <div className="flex items-center justify-center gap-1.5 mt-2.5">
                    {allReviews.slice(0, 5).map((rev, idx) => (
                      <button
                        key={rev.id || idx}
                        type="button"
                        onClick={() => setActiveReviewIdx(idx)}
                        aria-label={`Show review ${idx + 1}`}
                        className={`rounded-full transition-all cursor-pointer ${
                          activeReviewIdx === idx
                            ? 'w-2 h-2 bg-[#6d44c9]'
                            : 'w-1.5 h-1.5 bg-slate-200 hover:bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-2.5 rounded-xl border border-slate-100 bg-[#fbfafe] p-3 text-center space-y-2">
                <p className="text-[11.5px] text-slate-500 font-medium">
                  No parent reviews published for {tutorName} yet.
                </p>
                <button
                  type="button"
                  onClick={() => setIsReviewsModalOpen(true)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-50 text-[#6d44c9] text-[11px] font-bold cursor-pointer"
                >
                  <Star className="w-3.5 h-3.5" />
                  <span>Be the First to Review</span>
                </button>
              </div>
            )}
          </section>

        </div>

        {/* FIXED BOTTOM DUAL ACTION BAR ("Call Now" + "Book a Class") */}
        {!anyMobileModalOpen && (
          <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-100 px-3.5 py-2.5 shadow-[0_-4px_18px_rgba(15,23,42,0.06)]">
            <div className="grid grid-cols-2 gap-3">
              <a
                href={callPhoneHref}
                className="h-11 rounded-xl border-[1.5px] border-[#6d44c9] text-[#6d44c9] bg-white font-bold text-[13.5px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <Phone className="w-4 h-4 stroke-[2.2]" />
                <span>Call Now</span>
              </a>

              {effectiveIsBooked ? (
                <div className="h-11 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-[13px] flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Booked by You</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsBookingModalOpen(true)}
                  className="h-11 rounded-xl bg-gradient-to-r from-[#6d44c9] to-[#7c3aed] hover:from-[#5b37b7] hover:to-[#6d28d9] text-white font-bold text-[13.5px] flex items-center justify-center gap-2 shadow-md shadow-purple-500/20 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Calendar className="w-4 h-4 stroke-[2.2]" />
                  <span>Book a Class</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          DESKTOP VIEW (>= md) — PRESERVED COMPREHENSIVE DESKTOP LAYOUT WITH LIVE DATA
         ========================================================================= */}
      <div className="hidden md:block pb-20">
        {/* TOP BREADCRUMBS & NAVIGATION BAR */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
          <div className="max-w-6xl mx-auto px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 min-w-0">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer shrink-0"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to All Tutors</span>
              </button>
              <span className="text-slate-300">/</span>
              <span className="text-slate-500 font-medium">Tutors</span>
              <span className="text-slate-300">/</span>
              <span className="font-bold text-[#0c2340] truncate max-w-[240px]">{tutorName}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleShare}
                className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Share profile"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span>{copiedLink ? 'Link Copied!' : 'Share Profile'}</span>
              </button>

              {effectiveIsBooked ? (
                <div className="px-3.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-bold text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Booked by You</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsBookingModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-[#1d4ed8] hover:bg-blue-800 text-white font-bold text-sm shadow-xs hover:shadow-md transition-all duration-200 cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <Home className="w-4 h-4" />
                  <span>Book Now</span>
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-6 lg:px-8 pt-7 space-y-6">
          {/* 1. HERO PROFILE CARD */}
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="h-36 bg-gradient-to-r from-[#0c2340] via-[#122e54] to-[#1d4ed8] relative">
              <div className="absolute right-6 top-5 opacity-20 pointer-events-none">
                <GraduationCap className="w-28 h-28 text-white" />
              </div>
              <div className="absolute left-6 bottom-2.5 flex items-center gap-1.5 text-white/90 text-xs font-semibold tabular-nums">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Kumari Institute Verified Home Tutor · {activeTutor.locationArea || 'Rayagada'}
                  {distanceKmVal !== null ? ` (${distanceKmVal.toFixed(1)} km away)` : ''}
                </span>
              </div>
            </div>

            <div className="p-6 lg:p-8 pt-0 relative">
              <div className="flex flex-row items-end justify-between gap-5 -mt-18 pb-6 border-b border-slate-100">
                <div className="flex flex-row items-end gap-5 min-w-0">
                  <div className="relative shrink-0">
                    {activeTutor.avatar && !avatarFailed ? (
                      <img
                        src={activeTutor.avatar}
                        alt={tutorName}
                        onError={() => setAvatarFailed(true)}
                        referrerPolicy="no-referrer"
                        className="w-32 h-32 rounded-3xl object-cover border-4 border-white shadow-lg bg-slate-100"
                      />
                    ) : (
                      <div className="w-32 h-32 rounded-3xl bg-gradient-to-br from-[#1d4ed8] to-[#0c2340] border-4 border-white shadow-lg text-white font-black text-3xl flex items-center justify-center">
                        {tutorName.charAt(0)}
                      </div>
                    )}
                    <span
                      className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white shadow-xs"
                      title="Verified Genuine Tutor"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </span>
                  </div>

                  <div className="space-y-1.5 text-left min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-2xl lg:text-3xl font-black text-[#0c2340] tracking-tight">
                        {tutorName}
                      </h1>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold shrink-0">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        Verified Genuine Tutor
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-slate-700 flex flex-wrap items-center gap-2">
                      <span className="text-[#0c2340] font-bold">{degreeDisplayTitle}</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-blue-700 font-bold">
                        {experienceYearsVal > 0 ? `${experienceYearsVal}+ Years Experience` : 'Experience Pending'}
                      </span>
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium pt-0.5">
                      <span className="flex items-center gap-1 text-amber-600 font-bold tabular-nums">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        <span>{ratingVal.toFixed(1)}</span>
                        <span className="text-slate-400 font-normal">
                          ({reviewCountVal} Parent {reviewCountVal === 1 ? 'Review' : 'Reviews'})
                        </span>
                      </span>

                      <span className="text-slate-300">·</span>

                      <span className="inline-flex items-center gap-1 text-slate-700 font-semibold tabular-nums">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        <span>
                          {activeTutor.locationArea || 'Rayagada'}
                          {distanceKmVal !== null ? ` · ${distanceKmVal.toFixed(1)} km away` : ''}
                        </span>
                      </span>

                      <span className="text-slate-300">·</span>

                      <span className="inline-flex items-center gap-1 text-slate-600 font-semibold">
                        <Clock className="w-3.5 h-3.5 text-blue-600" />
                        <span>Daily 1-on-1 Sessions</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hero Action Buttons */}
                <div className="flex flex-row items-center gap-2 self-end shrink-0">
                  {effectiveIsBooked ? (
                    <div className="py-3 px-6 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-black text-sm flex items-center justify-center gap-2 shadow-2xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Home Tutor Booked</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsBookingModalOpen(true)}
                      className="py-3 px-7 rounded-2xl bg-[#1d4ed8] hover:bg-blue-800 text-white font-extrabold text-base shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                    >
                      <Home className="w-5 h-5" />
                      <span>Book Now</span>
                    </button>
                  )}

                  {onOpenDemoBooking && (
                    <button
                      type="button"
                      onClick={onOpenDemoBooking}
                      className="py-2.5 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold text-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>Request Demo</span>
                    </button>
                  )}
                </div>
              </div>

              {/* ABOUT THE TUTOR */}
              <div className="pt-5 text-left space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                    <BookOpen className="w-3.5 h-3.5" />
                  </div>
                  <h2 className="text-base font-black text-[#0c2340] tracking-tight">
                    About the Tutor &amp; Teaching Methodology
                  </h2>
                </div>

                <p className="text-sm text-slate-600 leading-relaxed font-medium">{bioText}</p>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-semibold">
                    <Languages className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Languages: {languagesList.join(', ')}</span>
                  </div>

                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-semibold">
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>1-on-1 Personalized Attention</span>
                  </div>

                  <div className="inline-flex items-center gap-1 px-3 py-1 rounded-xl bg-slate-100 text-slate-700 font-semibold">
                    <CalendarCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span>Daily Homework Tracking &amp; Weekly Tests</span>
                  </div>
                </div>
              </div>

              {/* Quick Metrics Bar */}
              <div className="grid grid-cols-4 gap-3.5 pt-5 text-left border-t border-slate-100 mt-5">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Tuition Type
                  </div>
                  <div className="text-sm font-black text-[#0c2340] mt-0.5 flex items-center gap-1.5 truncate">
                    <Home className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="truncate">
                      {activeTutor.teacherType === 'both' ? 'Home & Online' : '1-on-1 Home Tuition'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Experience
                  </div>
                  <div className="text-sm font-black text-[#0c2340] mt-0.5 flex items-center gap-1.5 truncate">
                    <Briefcase className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span className="truncate">
                      {experienceYearsVal > 0 ? `${experienceYearsVal}+ Years` : 'Experience Pending'}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Class Reach
                  </div>
                  <div className="text-sm font-black text-[#0c2340] mt-0.5 flex items-center gap-1.5 truncate">
                    <Layers className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                    <span className="truncate">{classesList.length} Grades Covered</span>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Parent Rating
                  </div>
                  <div className="text-sm font-black text-[#0c2340] mt-0.5 flex items-center gap-1.5 truncate">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500 shrink-0" />
                    <span className="truncate">{ratingVal.toFixed(1)} / 5.0 Rating</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* MAIN TWO-COLUMN CONTENT GRID */}
          <div className="grid grid-cols-3 gap-6 text-left">
            <div className="col-span-2 space-y-6">
              {/* Classes & Boards */}
              <section className="bg-white rounded-3xl border border-slate-200/90 p-7 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
                      <Layers className="w-4 h-4" />
                    </div>
                    <h2 className="text-lg font-black text-[#0c2340] tracking-tight">
                      Classes Handled &amp; Academic Boards
                    </h2>
                  </div>
                  <span className="text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-lg">
                    {classesList.length} Classes
                  </span>
                </div>

                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Classes Available for Home Tutoring
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    {classesList.map((cls) => (
                      <div
                        key={cls}
                        className="p-3 rounded-2xl border border-slate-200 bg-slate-50/60 hover:bg-white hover:border-purple-300 transition-all text-center space-y-0.5"
                      >
                        <div className="text-sm font-black text-[#0c2340]">{cls}</div>
                        <div className="text-[10px] font-semibold text-slate-500">
                          1-on-1 Home Session
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    School Boards Supported
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {boardsList.map((board) => (
                      <span
                        key={board}
                        className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 font-bold text-xs"
                      >
                        {board}
                      </span>
                    ))}
                  </div>
                </div>
              </section>

              {/* Subjects Offered */}
              <section className="bg-white rounded-3xl border border-slate-200/90 p-7 shadow-xs space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-7 h-7 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <Award className="w-4 h-4" />
                  </div>
                  <h2 className="text-lg font-black text-[#0c2340] tracking-tight">
                    Subjects Offered
                  </h2>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {subjectsList.map((subject) => (
                    <div
                      key={subject}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-blue-300 shadow-2xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-extrabold text-[#0c2340]">{subject}</span>
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          School Curriculum
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                        Textbook coverage, conceptual problem-solving, daily homework completion,
                        and school exam preparation.
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Education & Academic Background */}
              <section className="bg-white rounded-3xl border border-slate-200/90 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                      <GraduationCap className="w-3.5 h-3.5" />
                    </div>
                    <h2 className="text-base font-black text-[#0c2340] tracking-tight">
                      Education &amp; Academic Background
                    </h2>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold flex items-center gap-1 shrink-0">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Degree Audited</span>
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="min-w-0">
                      <div className="text-sm font-black text-[#0c2340] truncate">
                        {degreeDisplayTitle}
                      </div>
                      {(universityName || degreeYear) && (
                        <div className="text-xs text-slate-600 font-semibold truncate">
                          {universityName || 'Verified Degree'}{' '}
                          {degreeYear ? `· Class of ${degreeYear}` : ''}
                        </div>
                      )}
                    </div>

                    {degreeScore && (
                      <div className="px-2 py-0.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700">
                        Score: {degreeScore}
                      </div>
                    )}
                  </div>

                  {(tenthDetails || twelfthDetails) && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60 text-[11px] text-slate-600">
                      {twelfthDetails && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200">
                          <span className="font-bold text-slate-700">12th / +2:</span>
                          <span>
                            {twelfthDetails.board || twelfthDetails.college || 'Higher Secondary'}
                          </span>
                          {twelfthDetails.score ? `(${twelfthDetails.score})` : ''}
                        </span>
                      )}
                      {tenthDetails && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-slate-200">
                          <span className="font-bold text-slate-700">10th / Matric:</span>
                          <span>{tenthDetails.board || tenthDetails.school || 'High School'}</span>
                          {tenthDetails.score ? `(${tenthDetails.score})` : ''}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="text-[11px] text-slate-500 font-medium pt-1 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>
                      Academic marksheet audited and verified by Kumari Institute Administration
                    </span>
                  </div>
                </div>
              </section>

              {/* Parent Reviews Section (Real-Time Firestore Data) */}
              <section className="bg-white rounded-3xl border border-slate-200/90 p-7 shadow-xs space-y-5">
                <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-[#0c2340] tracking-tight">
                        Parent Reviews &amp; Testimonials ({reviewCountVal})
                      </h2>
                      <p className="text-xs text-slate-500 font-medium">
                        Real-time feedback from parents for {tutorName}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-2xl">
                      <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                      <span className="text-sm font-black text-amber-900 tabular-nums">
                        {ratingVal.toFixed(1)}
                      </span>
                      <span className="text-[11px] font-semibold text-amber-800">/ 5.0</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsReviewsModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs cursor-pointer transition-colors"
                    >
                      Write Review
                    </button>
                  </div>
                </div>

                {allReviews.length > 0 ? (
                  <div className="space-y-3.5">
                    {allReviews.map((rev) => (
                      <div
                        key={rev.id}
                        className="p-5 rounded-2xl bg-white border border-slate-200 hover:border-blue-300 hover:shadow-xs transition-all space-y-2.5 text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#0c2340] to-[#1d4ed8] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                              {rev.parentName.charAt(0)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-sm text-[#0c2340]">
                                  {rev.parentName}
                                </span>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  Verified Parent
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-medium">
                                {rev.relation}
                                {rev.schoolName ? ` · ${rev.schoolName}` : ''}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <div className="flex items-center text-amber-500">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3.5 h-3.5 ${
                                    i < Math.floor(rev.rating)
                                      ? 'fill-amber-500 text-amber-500'
                                      : 'text-slate-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs font-bold text-slate-700 tabular-nums">
                              {rev.rating}
                            </span>
                          </div>
                        </div>

                        <p className="text-sm text-slate-700 leading-relaxed font-medium pl-12">
                          "{rev.comment}"
                        </p>

                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold pt-1 border-t border-slate-100 pl-12">
                          <span>Reviewed {rev.date}</span>
                          <span className="text-slate-500 font-medium">{rev.studentGrade}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                    <p className="text-sm font-semibold text-slate-600">
                      No parent reviews yet for {tutorName}.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsReviewsModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-[#1d4ed8] text-white text-xs font-bold cursor-pointer hover:bg-blue-800 transition-colors"
                    >
                      Write the First Review
                    </button>
                  </div>
                )}
              </section>
            </div>

            {/* DESKTOP RIGHT SIDEBAR */}
            <div className="space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 shadow-xs space-y-5 sticky top-20">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Ready to start?
                  </span>
                  <h3 className="text-xl font-black text-[#0c2340] tracking-tight">
                    Book {tutorName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Daily 1-on-1 home tutoring in {activeTutor.locationArea || 'Rayagada'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-2.5 text-left">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">Session Frequency:</span>
                    <span className="font-bold text-[#0c2340]">5-6 Days / Week</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">Daily Duration:</span>
                    <span className="font-bold text-[#0c2340]">60 - 90 mins / day</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600">Batch Type:</span>
                    <span className="font-bold text-blue-700">100% 1-on-1 Personalized</span>
                  </div>
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-blue-200/60">
                    <span className="font-semibold text-slate-600">Trial Class:</span>
                    <span className="font-bold text-emerald-700">Free 1st Demo Session</span>
                  </div>
                </div>

                {timeSlotsList.length > 0 && (
                  <div className="space-y-1.5 text-left">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Preferred Daily Slots
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {timeSlotsList.map((slot) => (
                        <span
                          key={slot}
                          className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200"
                        >
                          {slot}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {effectiveIsBooked ? (
                  <div className="w-full py-3.5 px-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 font-black text-sm flex items-center justify-center gap-2 shadow-2xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Already Booked by You</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsBookingModalOpen(true)}
                    className="w-full py-3.5 px-6 rounded-2xl bg-[#1d4ed8] hover:bg-blue-800 text-white font-black text-base shadow-md hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                  >
                    <Home className="w-5 h-5" />
                    <span>Book Now</span>
                  </button>
                )}

                <a
                  href={callPhoneHref}
                  className="w-full py-2.5 px-4 rounded-2xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50 text-[#1d4ed8] font-bold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4" />
                  <span>Call {instituteInfo.phone}</span>
                </a>

                {onOpenEnquiry && (
                  <button
                    type="button"
                    onClick={onOpenEnquiry}
                    className="w-full py-2.5 px-4 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Need Custom Subjects? Request Assistance
                  </button>
                )}

                <div className="pt-4 border-t border-slate-100 space-y-2.5 text-left">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Kumari Institute Guarantee
                  </div>
                  <div className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>Physical ID &amp; Police Verification Completed</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                    <UserCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <span>100% Tutor Replacement Guarantee if unsatisfied</span>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                    <Award className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>Daily attendance &amp; monthly report card tracking</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          INTERACTIVE MODALS (REVIEWS, BOOKING)
         ========================================================================= */}

      {/* 1. ALL REVIEWS & WRITE REVIEW MODAL */}
      {isReviewsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutor-reviews-modal-title"
          onClick={() => setIsReviewsModalOpen(false)}
          className="fixed inset-0 z-[60] bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 max-h-[88vh] flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 fill-[#f59e0b] text-[#f59e0b]" />
                <h2
                  id="tutor-reviews-modal-title"
                  className="text-base font-extrabold text-slate-900"
                >
                  Parent Reviews ({reviewCountVal})
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setIsReviewsModalOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              {/* Write a Real Review Form */}
              <form
                onSubmit={handleParentReviewSubmit}
                className="p-4 rounded-2xl bg-[#f7f4fe] border border-purple-200/70 space-y-3 text-left"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900">
                    Share Your Feedback for {tutorName}
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((starNum) => (
                      <button
                        key={starNum}
                        type="button"
                        onClick={() => setReviewRating(starNum)}
                        aria-label={`Rate ${starNum} stars`}
                        className="cursor-pointer p-0.5"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            starNum <= reviewRating
                              ? 'fill-[#f59e0b] text-[#f59e0b]'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {currentUser ? (
                  <>
                    <input
                      type="text"
                      value={reviewStudentGrade}
                      onChange={(e) => setReviewStudentGrade(e.target.value)}
                      placeholder="e.g. Parent of Class 8 Student"
                      className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#6d44c9]"
                    />
                    <textarea
                      rows={2}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="How was the teaching quality, concept clarity, and punctuality?"
                      className="w-full px-3 py-2 rounded-xl border border-purple-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-[#6d44c9]"
                    />
                    {reviewSubmitError && (
                      <p className="text-[11px] font-semibold text-rose-600">
                        {reviewSubmitError}
                      </p>
                    )}
                    {reviewSubmitSuccess && (
                      <p className="text-[11px] font-semibold text-emerald-700">
                        Thank you! Your review has been published live.
                      </p>
                    )}
                    <button
                      type="submit"
                      disabled={isSubmittingReview}
                      className="w-full py-2.5 rounded-xl bg-[#6d44c9] hover:bg-[#5b37b7] disabled:opacity-60 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isSubmittingReview ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Publish Review</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsReviewsModalOpen(false);
                      if (onNavigateAuth) onNavigateAuth('parent-login', 'parent');
                    }}
                    className="w-full py-2.5 rounded-xl bg-[#6d44c9] text-white text-xs font-bold cursor-pointer"
                  >
                    Log In as Parent to Write a Review
                  </button>
                )}
              </form>

              {/* All Live Reviews List */}
              {allReviews.length > 0 ? (
                <div className="space-y-3">
                  {allReviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2 text-left"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-[#b7a0f6] text-white font-bold text-xs flex items-center justify-center shrink-0">
                            {(rev.parentName || 'P').charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-slate-900 truncate">
                              {rev.parentName}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate">
                              {rev.relation}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Star className="w-3.5 h-3.5 fill-[#f59e0b] text-[#f59e0b]" />
                          <span className="text-xs font-bold text-slate-800 tabular-nums">
                            {Number(rev.rating || 5).toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-slate-700 leading-relaxed">{rev.comment}</p>
                      <div className="text-[10px] text-slate-400 font-medium">{rev.date}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-4">
                  No parent reviews have been added yet.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. DIRECT BOOKING MODAL */}
      <BookHomeTutorModal
        isOpen={isBookingModalOpen}
        tutor={activeTutor}
        currentUser={currentUser}
        onClose={() => setIsBookingModalOpen(false)}
        onNavigateAuth={
          onNavigateAuth
            ? (mode, role) => onNavigateAuth(mode, role)
            : undefined
        }
        onBookingSuccess={() => {
          setRealtimeBookedByParent(true);
        }}
      />
    </div>
  );
};
