import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Code2,
  FlaskConical,
  GraduationCap,
  Layers,
  MapPin,
  Megaphone,
  MessageCircle,
  Monitor,
  Phone,
  Target,
  TrendingUp,
  UserCheck,
  Users,
  X,
  Calculator
} from 'lucide-react';
import {
  subscribeToRealtimeGallery,
  subscribeToRealtimeHeroBanners,
  saveDemoBookingToFirestore,
  saveEnquiryToFirestore,
  FirestoreHeroBanner,
  AppUserProfile
} from '../services/firebaseAuth';
import { AdminGalleryItem } from '../types';
import { useBackButtonDismiss } from '../hooks/useBackButtonDismiss';
import offlineHeroStudentImg from '../assets/images/offline_hero_student_1794737949552.jpg';
import offlineAboutBooksImg from '../assets/images/offline_about_books_1794737949423.jpg';
import offlineClassroomInteriorImg from '../assets/images/offline_classroom_interior_1794737950275.jpg';

const CALL_PHONE_RAW = '9439851521';
const CALL_PHONE_E164 = '+919439851521';
const WHATSAPP_URL = `https://wa.me/91${CALL_PHONE_RAW}?text=${encodeURIComponent(
  'Hello Kumari Institute, I would like to enquire about Offline Tuition Classes (CBSE & ICSE, Class 6 to 12) in Rayagada.'
)}`;

const HERO_STUDENT_IMG = offlineHeroStudentImg;
const ABOUT_BOOKS_IMG = offlineAboutBooksImg;
const CLASSROOM_INTERIOR_IMG = offlineClassroomInteriorImg;

interface OfflineClassesPageProps {
  currentUser?: AppUserProfile | null;
  onBack?: () => void;
  onNavigateHome: () => void;
  onNavigateTutors?: () => void;
  onNavigateExamPrep?: () => void;
  onNavigateGallery?: () => void;
  onNavigateContact?: () => void;
  onOpenProfile?: () => void;
  onNavigateAuth?: () => void;
}

const SUBJECTS_LIST = [
  {
    title: 'Mathematics',
    subtitle: 'Concept & Problem Practice',
    icon: Calculator
  },
  {
    title: 'Science',
    subtitle: '(Physics, Chemistry, Biology)',
    icon: FlaskConical
  },
  {
    title: 'English',
    subtitle: 'Grammar, Writing & Literature',
    icon: BookOpen
  },
  {
    title: 'Social Science',
    subtitle: 'History, Civics & Geography',
    icon: Users
  },
  {
    title: 'Computer Applications',
    subtitle: 'Coding & Practical Lab Support',
    icon: Code2
  },
  {
    title: 'Other Elective Subjects',
    subtitle: '(As per board)',
    icon: Layers
  }
];

const STREAMS_LIST = [
  {
    id: 'class-6-8',
    title: 'Class 6 – 8',
    stream: '',
    description: 'Foundation & Concept Building',
    icon: GraduationCap,
    bg: 'bg-[#fef6e9]',
    border: 'border-[#fde7c3]',
    iconBg: 'bg-[#fdf0d7] text-[#b45309]'
  },
  {
    id: 'class-9-10',
    title: 'Class 9 – 10',
    stream: '',
    description: 'Board Exam Preparation',
    icon: BookOpen,
    bg: 'bg-[#eef4ff]',
    border: 'border-[#dbe7fe]',
    iconBg: 'bg-[#dfeaff] text-[#1d4ed8]'
  },
  {
    id: 'class-11-12',
    title: 'Class 11 – 12',
    stream: '(Science | Commerce | Arts)',
    description: 'In-depth Subject Coaching',
    icon: Layers,
    bg: 'bg-[#ecf9f1]',
    border: 'border-[#d3f2df]',
    iconBg: 'bg-[#daf5e5] text-[#15803d]'
  }
];

const WHY_CHOOSE_LIST = [
  {
    title: 'Experienced & Friendly Teachers',
    description: 'Subject experts with academic experience.',
    icon: Users
  },
  {
    title: 'Strong Concept Clarity',
    description: 'Focus on fundamentals and real-life application.',
    icon: Target
  },
  {
    title: 'Regular Tests & Progress Tracking',
    description: 'Chapter-wise tests, mock exams and performance reports.',
    icon: ClipboardCheck
  },
  {
    title: 'Small Batch Size',
    description: 'Better interaction and personal attention.',
    icon: UserCheck
  },
  {
    title: 'Offline Classroom Learning',
    description: 'Distraction-free and focused study environment.',
    icon: Monitor
  }
];

export const OfflineClassesPage: React.FC<OfflineClassesPageProps> = ({
  currentUser,
  onBack,
  onNavigateHome
}) => {
  // Real-time Firestore state
  const [galleryPhotos, setGalleryPhotos] = useState<AdminGalleryItem[]>([]);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const [heroBanners, setHeroBanners] = useState<FirestoreHeroBanner[]>([]);
  const [heroSlideIdx, setHeroSlideIdx] = useState(0);

  // Image fallback trackers
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [booksImgFailed, setBooksImgFailed] = useState(false);
  const [classroomImgFailed, setClassroomImgFailed] = useState(false);

  // Quick Offline Batch Admission / Enquiry Sheet State
  const [isEnquiryOpen, setIsEnquiryOpen] = useState(false);

  useBackButtonDismiss(isEnquiryOpen, 'offline-classes-enquiry', () => setIsEnquiryOpen(false));
  const [studentName, setStudentName] = useState(
    currentUser?.childName || currentUser?.studentName || ''
  );
  const [parentName, setParentName] = useState(currentUser?.name || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [selectedBoard, setSelectedBoard] = useState<'CBSE' | 'ICSE'>('CBSE');
  const [selectedGrade, setSelectedGrade] = useState(
    currentUser?.childGrade || 'Class 9 – 10'
  );
  const [preferredSlot, setPreferredSlot] = useState('4:00 PM – 6:00 PM');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Subscribe to real Firestore collections
  useEffect(() => {
    const unsubGallery = subscribeToRealtimeGallery((items) => {
      setGalleryPhotos((items || []) as AdminGalleryItem[]);
    });

    const unsubBanners = subscribeToRealtimeHeroBanners((banners) => {
      setHeroBanners((banners || []).filter((b) => b.active !== false));
    });

    return () => {
      unsubGallery();
      unsubBanners();
    };
  }, []);

  // Hero highlight carousel slides
  const heroSlides = [
    {
      titleTop: 'Offline',
      titleHighlight: 'Tuition Classes',
      titleBottom: 'for CBSE & ICSE',
      gradeLabel: 'Class 6 to 12',
      subline: 'Strong Concepts • Better Practice • Higher Scores'
    },
    {
      titleTop: 'Small Batch',
      titleHighlight: 'Board Coaching',
      titleBottom: 'CBSE & ICSE Focus',
      gradeLabel: 'Class 9 & 10',
      subline: 'Chapter Tests • NCERT Mastery • Doubt Sessions'
    },
    {
      titleTop: 'Senior Secondary',
      titleHighlight: 'Stream Batches',
      titleBottom: 'Science • Commerce • Arts',
      gradeLabel: 'Class 11 & 12',
      subline: 'Daily Practice Sheets • Personal Attention'
    }
  ];

  const activeSlide = heroSlides[heroSlideIdx % heroSlides.length];

  // Combine generated classroom photo with live Firestore gallery classroom photos
  const classroomImages = [
    {
      id: 'default-classroom',
      url: CLASSROOM_INTERIOR_IMG,
      title: 'Kumari Institute Offline Classroom — Indira Nagar, Rayagada'
    },
    ...galleryPhotos
      .filter((g) => g.imageUrl || (g as any).image)
      .slice(0, 4)
      .map((g) => ({
        id: g.id,
        url: g.imageUrl || (g as any).image,
        title: g.title || 'Kumari Institute Classroom Session'
      }))
  ];

  const currentClassroomImage = classroomImages[activePhotoIndex % classroomImages.length];

  const openEnquiryWithPreset = (board?: 'CBSE' | 'ICSE', grade?: string) => {
    if (board) setSelectedBoard(board);
    if (grade) setSelectedGrade(grade);
    setSubmitSuccess(null);
    setSubmitError(null);
    setIsEnquiryOpen(true);
  };

  const handleEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const cleanPhone = phone.replace(/\D/g, '');
    if (!studentName.trim()) {
      setSubmitError('Please enter Student Name.');
      return;
    }
    if (cleanPhone.length < 10) {
      setSubmitError('Please enter a valid 10-digit Mobile Number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const results = await Promise.allSettled([
        saveDemoBookingToFirestore({
          studentName: studentName.trim(),
          parentName: parentName.trim() || studentName.trim(),
          phone: cleanPhone.slice(-10),
          email: currentUser?.email || '',
          grade: `${selectedGrade} (${selectedBoard})`,
          subject: 'Offline Tuition Classes (All Core Subjects)',
          mode: 'Offline Classroom — Indira Nagar Center',
          preferredDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
          preferredTime: preferredSlot,
          notes: notes.trim() || `Enquiry from Offline Classes Page (${selectedBoard} - ${selectedGrade})`,
          userId: currentUser?.uid
        }),
        saveEnquiryToFirestore({
          name: parentName.trim() || studentName.trim(),
          phone: cleanPhone.slice(-10),
          grade: `${selectedGrade} (${selectedBoard})`,
          message: `Offline Classes Enquiry • Student: ${studentName.trim()} • Slot: ${preferredSlot}${notes.trim() ? ` • Note: ${notes.trim()}` : ''}`
        })
      ]);

      if (results.every((r) => r.status === 'rejected')) {
        throw new Error('Could not record your offline batch enquiry.');
      }

      setSubmitSuccess('Your offline batch seat enquiry is saved! Our Rayagada center will call you shortly.');
      setTimeout(() => {
        setIsEnquiryOpen(false);
        setSubmitSuccess(null);
      }, 2200);
    } catch {
      setSubmitError('Could not submit right now. Please call us directly on 9439851521.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      id="offline-classes-page"
      className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col pb-20 lg:pb-12 antialiased selection:bg-amber-200 selection:text-slate-900"
    >
      {/* =====================================================================
          COMPACT MOBILE TOP BAR (without right-side menu icon)
         ===================================================================== */}
      <header className="md:hidden sticky top-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 flex items-center shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack || onNavigateHome}
            aria-label="Go back"
            className="min-w-[40px] min-h-[40px] -ml-1 rounded-xl flex items-center justify-center text-[#0c2856] hover:bg-slate-100 active:bg-slate-200 transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.4]" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-[#0c2856] text-white flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4 text-amber-400" />
          </div>
          <div className="min-w-0 leading-tight">
            <div className="text-[15px] font-extrabold text-[#0c2856] tracking-tight truncate">
              Kumari Institute
            </div>
            <div className="text-[10.5px] font-medium text-slate-500 truncate">
              Tuition Classes | Academic Coaching
            </div>
          </div>
        </div>
      </header>

      {/* Desktop Breadcrumb Subbar */}
      <div className="hidden md:block bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-2.5 flex items-center justify-between">
          <button
            type="button"
            onClick={onBack || onNavigateHome}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700 hover:text-[#1d4ed8] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-[#1d4ed8]" />
            <span>Back</span>
          </button>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <button type="button" onClick={onNavigateHome} className="hover:text-slate-900 cursor-pointer">
              Home
            </button>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-[#0c2856]">Offline Tuition Classes (Class 6 – 12)</span>
          </div>
        </div>
      </div>

      {/* Main Content Container: Full mobile feel on mobile, balanced 6xl container on desktop */}
      <div className="w-full max-w-6xl mx-auto md:px-6 md:pt-5 space-y-6">
        {/* ===================================================================
            1. HERO BANNER + FLOATING 3-COLUMN SUMMARY CARD
           =================================================================== */}
        <section aria-label="Offline Tuition Classes Hero">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#071f47] via-[#0e346e] to-[#1a529e] md:rounded-3xl shadow-lg">
            {/* Subtle Radial Highlight */}
            <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full bg-sky-400/15 blur-2xl pointer-events-none" />

            <div className="relative z-10 grid grid-cols-12 items-stretch min-h-[250px] sm:min-h-[290px] md:min-h-[340px]">
              {/* Left Copy & CTA */}
              <div className="col-span-7 sm:col-span-7 md:col-span-7 p-4 sm:p-6 md:p-10 pb-9 sm:pb-11 flex flex-col justify-center">
                <h1 className="text-[22px] sm:text-3xl md:text-4xl lg:text-[42px] font-extrabold text-white leading-[1.12] tracking-tight">
                  <span className="block">{activeSlide.titleTop}</span>
                  <span className="block text-[#fbbf24] font-black drop-shadow-xs">
                    {activeSlide.titleHighlight}
                  </span>
                  <span className="block text-[18px] sm:text-2xl md:text-3xl mt-0.5 font-bold">
                    {activeSlide.titleBottom}
                  </span>
                </h1>

                <div className="mt-2.5 inline-flex items-center self-start bg-[#facc15] text-[#0c2340] px-3 py-1 rounded-lg font-black text-xs sm:text-sm md:text-base shadow-sm whitespace-nowrap shrink-0">
                  {activeSlide.gradeLabel}
                </div>

                <p className="mt-2.5 text-[11px] sm:text-xs md:text-sm font-medium text-slate-100/95 leading-snug max-w-md">
                  {activeSlide.subline}
                </p>

                {/* Primary Hero CTA: Call Now only */}
                <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
                  <a
                    id="offline-hero-call-now-btn"
                    href={`tel:${CALL_PHONE_E164}`}
                    className="inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2 sm:py-2.5 min-h-[40px] rounded-full bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0c2340] font-extrabold text-xs sm:text-sm shadow-md active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
                  >
                    <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-[#0c2340] stroke-none shrink-0" />
                    <span>Call Now</span>
                  </a>
                </div>

                {/* Slide Indicator Dots */}
                <div className="mt-4 flex items-center gap-1.5">
                  {heroSlides.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      aria-label={`Hero highlight ${idx + 1}`}
                      onClick={() => setHeroSlideIdx(idx)}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        heroSlideIdx === idx ? 'w-5 bg-white' : 'w-1.5 bg-white/45 hover:bg-white/75'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Right Student Image — stretched cleanly to fit the full top section */}
              <div className="col-span-5 sm:col-span-5 md:col-span-5 relative self-stretch min-h-[250px] sm:min-h-[290px] md:min-h-[340px] overflow-hidden">
                {!heroImgFailed ? (
                  <img
                    src={heroBanners[0]?.url && heroSlideIdx === 1 ? heroBanners[0].url : HERO_STUDENT_IMG}
                    alt="Kumari Institute CBSE and ICSE Offline Tuition Student"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="absolute inset-0 w-full h-full object-cover object-top select-none"
                  />
                ) : (
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-t from-[#071f47] via-[#0e346e] to-[#1a529e] flex flex-col items-center justify-center p-4 text-center text-white/80">
                    <GraduationCap className="w-12 h-12 text-amber-400 mb-2" />
                    <span className="text-xs font-bold">Class 6 – 12 Coaching</span>
                  </div>
                )}
                <div className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-[#0e346e] via-[#0e346e]/40 to-transparent" />
              </div>
            </div>
          </div>

          {/* 3-Column Feature Strip Overlapping Hero Bottom */}
          <div className="relative z-20 -mt-5 mx-3 sm:mx-5 md:mx-8 bg-white rounded-2xl border border-slate-200/80 shadow-md grid grid-cols-3 divide-x divide-slate-200/80 py-3 sm:py-4">
            <div className="flex flex-col items-center justify-center text-center px-2">
              <GraduationCap className="w-5 h-5 sm:w-6 sm:h-6 text-[#0c2856] mb-1 stroke-[1.9]" />
              <span className="text-[11px] sm:text-xs md:text-sm font-extrabold text-[#0c2856] leading-tight">
                CBSE &amp; ICSE
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-slate-500">Boards</span>
            </div>

            <div className="flex flex-col items-center justify-center text-center px-2">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-[#0c2856] mb-1 stroke-[1.9]" />
              <span className="text-[11px] sm:text-xs md:text-sm font-extrabold text-[#0c2856] leading-tight tabular-nums">
                Class 6 – 12
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-slate-500">(All Streams)</span>
            </div>

            <div className="flex flex-col items-center justify-center text-center px-2">
              <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-[#0c2856] mb-1 stroke-[1.9]" />
              <span className="text-[11px] sm:text-xs md:text-sm font-extrabold text-[#0c2856] leading-tight">
                Offline
              </span>
              <span className="text-[10px] sm:text-xs font-medium text-slate-500">Classroom</span>
            </div>
          </div>
        </section>

        {/* Desktop 2-Column Split / Mobile Vertical Stack */}
        <div className="px-3.5 sm:px-5 md:px-0 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (Mobile Sections 2–5) */}
          <div className="lg:col-span-6 space-y-6">
            {/* ===============================================================
                2. ABOUT KUMARI INSTITUTE
               =============================================================== */}
            <section className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-2xs space-y-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#0c2856] tracking-tight">
                  About Kumari Institute
                </h2>
                <div className="w-12 h-1 bg-[#fbbf24] rounded-full mt-1" />
              </div>

              <div className="grid grid-cols-12 gap-3 items-center">
                <p className="col-span-7 sm:col-span-8 text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                  A trusted learning centre for school students with a focus on concept clarity,{' '}
                  <strong className="font-bold text-slate-900">regular practice</strong> and overall academic growth. We
                  offer offline tuition for CBSE and ICSE students from Class 6 to Class 12.
                </p>

                <div className="col-span-5 sm:col-span-4 flex justify-end">
                  {!booksImgFailed ? (
                    <img
                      src={ABOUT_BOOKS_IMG}
                      alt="School books and study pencils"
                      referrerPolicy="no-referrer"
                      onError={() => setBooksImgFailed(true)}
                      className="w-24 h-24 sm:w-28 sm:h-28 object-contain rounded-xl"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
                      <BookOpen className="w-8 h-8 text-amber-600" />
                    </div>
                  )}
                </div>
              </div>

              {/* 3-Column Feature Mini Tiles */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-[#f8fafc] border border-slate-200/80 rounded-xl p-2.5 text-center flex flex-col items-center">
                  <Target className="w-5 h-5 text-[#1d4ed8] mb-1.5 stroke-[1.9]" />
                  <span className="text-[11px] sm:text-xs font-bold text-[#0c2856] leading-tight">
                    Concept Based Learning
                  </span>
                </div>

                <div className="bg-[#f8fafc] border border-slate-200/80 rounded-xl p-2.5 text-center flex flex-col items-center">
                  <TrendingUp className="w-5 h-5 text-[#1d4ed8] mb-1.5 stroke-[1.9]" />
                  <span className="text-[11px] sm:text-xs font-bold text-[#0c2856] leading-tight">
                    Regular Assessments
                  </span>
                </div>

                <div className="bg-[#f8fafc] border border-slate-200/80 rounded-xl p-2.5 text-center flex flex-col items-center">
                  <Users className="w-5 h-5 text-[#1d4ed8] mb-1.5 stroke-[1.9]" />
                  <span className="text-[11px] sm:text-xs font-bold text-[#0c2856] leading-tight">
                    Personal Attention
                  </span>
                </div>
              </div>
            </section>

            {/* ===============================================================
                3. COURSES WE OFFER (CBSE & ICSE Static Cards - No Popup)
               =============================================================== */}
            <section className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-2xs space-y-3.5">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#0c2856] tracking-tight">
                  Courses We Offer
                </h2>
                <div className="w-12 h-1 bg-[#fbbf24] rounded-full mt-1" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-[#1d4ed8] to-[#1e40af] text-white p-4 text-center flex flex-col items-center justify-center shadow-sm min-h-[112px]">
                  <BookOpen className="w-6 h-6 text-white/95 mb-1.5 stroke-[1.9]" />
                  <span className="text-base sm:text-lg font-black tracking-tight">CBSE</span>
                  <span className="text-xs font-medium text-blue-100 mt-0.5">Tuition Classes</span>
                  <span className="text-xs font-extrabold text-[#fbbf24] mt-1 tabular-nums">
                    Class 6 – 12
                  </span>
                </div>

                <div className="rounded-2xl bg-gradient-to-br from-[#4f46e5] to-[#4338ca] text-white p-4 text-center flex flex-col items-center justify-center shadow-sm min-h-[112px]">
                  <BookOpen className="w-6 h-6 text-white/95 mb-1.5 stroke-[1.9]" />
                  <span className="text-base sm:text-lg font-black tracking-tight">ICSE</span>
                  <span className="text-xs font-medium text-indigo-100 mt-0.5">Tuition Classes</span>
                  <span className="text-xs font-extrabold text-[#fbbf24] mt-1 tabular-nums">
                    Class 6 – 12
                  </span>
                </div>
              </div>
            </section>

            {/* ===============================================================
                4. SUBJECTS COVERED (3x2 Icon Grid)
               =============================================================== */}
            <section className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-2xs space-y-3.5">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#0c2856] tracking-tight">
                  Subjects Covered
                </h2>
                <div className="w-12 h-1 bg-[#fbbf24] rounded-full mt-1" />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                {SUBJECTS_LIST.map((subj) => {
                  const Icon = subj.icon;
                  return (
                    <div
                      key={subj.title}
                      className="bg-[#f8fafc] border border-slate-200/80 rounded-xl p-2.5 sm:p-3 text-center flex flex-col items-center justify-start"
                    >
                      <Icon className="w-5 h-5 text-[#1d4ed8] mb-1.5 stroke-[1.9]" />
                      <span className="text-[11px] sm:text-xs font-extrabold text-[#0c2856] leading-tight">
                        {subj.title}
                      </span>
                      <span className="text-[9.5px] sm:text-[10.5px] text-slate-500 mt-0.5 leading-tight">
                        {subj.subtitle}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ===============================================================
                5. CLASSES & STREAMS (1 Box Per Row, 3 Boxes Stacked)
               =============================================================== */}
            <section className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-2xs space-y-3.5">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#0c2856] tracking-tight">
                  Classes &amp; Streams
                </h2>
                <div className="w-12 h-1 bg-[#fbbf24] rounded-full mt-1" />
              </div>

              <div className="grid grid-cols-1 gap-3">
                {STREAMS_LIST.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.id}
                      className={`${item.bg} border ${item.border} rounded-2xl p-3.5 sm:p-4 flex items-center gap-3.5 text-left`}
                    >
                      <div className={`w-11 h-11 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0`}>
                        <Icon className="w-5 h-5 stroke-[2]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-1.5">
                          <span className="text-sm sm:text-base font-black text-[#0c2856] leading-tight tabular-nums">
                            {item.title}
                          </span>
                          {item.stream && (
                            <span className="text-xs font-bold text-slate-700 leading-tight">
                              {item.stream}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-slate-600 mt-0.5 leading-snug">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN (Mobile Sections 6–9) */}
          <div className="lg:col-span-6 space-y-6">
            {/* ===============================================================
                6. WHY CHOOSE US?
               =============================================================== */}
            <section className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-2xs space-y-4">
              <div>
                <h2 className="text-lg sm:text-xl font-black text-[#0c2856] tracking-tight">
                  Why Choose Us?
                </h2>
                <div className="w-12 h-1 bg-[#fbbf24] rounded-full mt-1" />
              </div>

              <div className="space-y-3.5">
                {WHY_CHOOSE_LIST.map((point) => {
                  const Icon = point.icon;
                  return (
                    <div key={point.title} className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-[#1d4ed8] flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-4.5 h-4.5 stroke-[2]" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-extrabold text-[#0c2856] leading-snug">
                          {point.title}
                        </h3>
                        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{point.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ===============================================================
                7. CLASSROOM PHOTOGRAPH
               =============================================================== */}
            <section className="bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-6 shadow-2xs">
              <div className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[16/9]">
                {!classroomImgFailed ? (
                  <img
                    src={currentClassroomImage.url}
                    alt={currentClassroomImage.title}
                    referrerPolicy="no-referrer"
                    onError={() => setClassroomImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-[#0c2856] to-[#1d4ed8] flex flex-col items-center justify-center text-white p-6 text-center">
                    <GraduationCap className="w-10 h-10 text-amber-400 mb-2" />
                    <span className="text-sm font-bold">Kumari Institute Offline Classroom</span>
                  </div>
                )}

                {classroomImages.length > 1 && (
                  <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 bg-slate-950/65 backdrop-blur-xs px-2 py-1 rounded-full">
                    {classroomImages.map((img, i) => (
                      <button
                        key={img.id}
                        type="button"
                        aria-label={`Classroom photo ${i + 1}`}
                        onClick={() => {
                          setClassroomImgFailed(false);
                          setActivePhotoIndex(i);
                        }}
                        className={`h-1.5 rounded-full transition-all cursor-pointer ${
                          activePhotoIndex === i ? 'w-4 bg-amber-400' : 'w-1.5 bg-white/60 hover:bg-white'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* ===============================================================
                8. ADMISSIONS OPEN CALLOUT BANNER
               =============================================================== */}
            <section className="bg-gradient-to-r from-[#eef5ff] to-[#e0ecff] border border-[#cfe1ff] rounded-2xl p-4 sm:p-5 flex items-center gap-3.5 shadow-2xs">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white border border-blue-100 shadow-xs flex items-center justify-center shrink-0">
                <Megaphone className="w-6 h-6 sm:w-7 sm:h-7 text-[#1d4ed8]" />
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-black text-[#0c2856] leading-tight">
                  Admissions Open!
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 leading-snug">
                  Enroll now for new batches and secure your seat.
                </p>

                <button
                  type="button"
                  id="offline-admissions-join-btn"
                  onClick={() => openEnquiryWithPreset()}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 px-4 sm:px-5 py-2.5 min-h-[40px] rounded-full bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0c2340] font-black text-xs sm:text-sm shadow-sm active:scale-[0.98] transition-all cursor-pointer whitespace-nowrap"
                >
                  <span>Join Offline Classes Today</span>
                  <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* =====================================================================
          STICKY BOTTOM DUAL CTA BAR (Mobile & Tablet, matching attached image)
         ===================================================================== */}
      <div
        id="offline-sticky-bottom-cta"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 shadow-[0_-6px_22px_rgba(12,35,64,0.12)] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      >
        <div className="max-w-lg mx-auto grid grid-cols-2 gap-2.5">
          <a
            id="offline-sticky-call-btn"
            href={`tel:${CALL_PHONE_E164}`}
            className="h-11 rounded-xl bg-[#0c2340] hover:bg-[#13345e] active:scale-[0.98] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all whitespace-nowrap"
          >
            <Phone className="w-4 h-4 shrink-0" />
            <span>Call Now</span>
          </a>

          <a
            id="offline-sticky-whatsapp-btn"
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="h-11 rounded-xl bg-[#16a34a] hover:bg-[#15803d] active:scale-[0.98] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-all whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>Enquire on WhatsApp</span>
          </a>
        </div>
      </div>

      {/* =====================================================================
          OFFLINE ADMISSION / DEMO ENQUIRY MODAL (SAVES TO FIRESTORE)
         ===================================================================== */}
      {isEnquiryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Offline Classes Admission Enquiry"
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setIsEnquiryOpen(false)}
        >
          <div
            className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-[#0c2856] text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base font-black">Offline Classes Enquiry</h3>
                <p className="text-xs text-blue-200">CBSE &amp; ICSE • Class 6 to 12 • Rayagada</p>
              </div>
              <button
                type="button"
                onClick={() => setIsEnquiryOpen(false)}
                aria-label="Close enquiry modal"
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEnquirySubmit} className="p-5 space-y-3.5 overflow-y-auto">
              {submitSuccess ? (
                <div className="py-8 text-center space-y-2.5">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-extrabold text-slate-900">Enquiry Submitted</h4>
                  <p className="text-xs text-slate-600 max-w-xs mx-auto">{submitSuccess}</p>
                </div>
              ) : (
                <>
                  {submitError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                      {submitError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Student Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      placeholder="Enter student's full name"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Board</label>
                      <select
                        value={selectedBoard}
                        onChange={(e) => setSelectedBoard(e.target.value as 'CBSE' | 'ICSE')}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
                      >
                        <option value="CBSE">CBSE</option>
                        <option value="ICSE">ICSE</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Class / Stream</label>
                      <select
                        value={selectedGrade}
                        onChange={(e) => setSelectedGrade(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
                      >
                        <option value="Class 6 – 8">Class 6 – 8</option>
                        <option value="Class 9 – 10">Class 9 – 10</option>
                        <option value="Class 11 – 12 (Science)">Class 11 – 12 (Science)</option>
                        <option value="Class 11 – 12 (Commerce)">Class 11 – 12 (Commerce)</option>
                        <option value="Class 11 – 12 (Arts)">Class 11 – 12 (Arts)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Parent Name</label>
                      <input
                        type="text"
                        value={parentName}
                        onChange={(e) => setParentName(e.target.value)}
                        placeholder="Parent / Guardian"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Mobile Number <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="10-digit mobile"
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Preferred Evening Slot</label>
                    <select
                      value={preferredSlot}
                      onChange={(e) => setPreferredSlot(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
                    >
                      <option value="4:00 PM – 6:00 PM">4:00 PM – 6:00 PM</option>
                      <option value="5:00 PM – 7:00 PM">5:00 PM – 7:00 PM</option>
                      <option value="6:00 PM – 8:00 PM">6:00 PM – 8:00 PM</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Subjects / Notes (Optional)</label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Maths & Science foundation"
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1d4ed8]"
                    />
                  </div>

                  <div className="pt-2 flex items-center gap-2.5">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex-1 py-3 rounded-xl bg-[#0c2856] hover:bg-[#133875] text-white font-bold text-sm shadow-sm cursor-pointer disabled:opacity-60"
                    >
                      {isSubmitting ? 'Saving to Firestore...' : 'Book Free Offline Demo'}
                    </button>
                    <a
                      href={`tel:${CALL_PHONE_E164}`}
                      className="px-4 py-3 rounded-xl bg-[#fbbf24] hover:bg-[#f59e0b] text-[#0c2340] font-extrabold text-sm whitespace-nowrap shrink-0"
                    >
                      Call Now
                    </a>
                  </div>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
