/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback, Suspense, lazy } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { HeroSection } from './components/HeroSection';
import { ChildDeservesBestSection } from './components/ChildDeservesBestSection';
import { StatsRibbon } from './components/StatsRibbon';
import { ResultsAndTestimonials } from './components/ResultsAndTestimonials';
import { FaqSection } from './components/FaqSection';
import { Footer } from './components/Footer';
import { DemoBookingModal } from './components/DemoBookingModal';
import { EnquiryModal } from './components/EnquiryModal';
import { ProgramDetailModal } from './components/ProgramDetailModal';
import { ResultsModal } from './components/ResultsModal';
import { BottomNav } from './components/BottomNav';
import { FloatingContactBadges } from './components/FloatingContactBadges';
import { FindTutorsPage } from './components/FindTutorsPage';
import { TutorProfilePage } from './components/TutorProfilePage';
import type { AuthViewMode } from './components/AuthPage';
import { Program } from './types';
import { Tutor } from './data/tutorsData';

// Resilient dynamic import helper that retries transient network/server-restart chunk fetch errors
function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 3
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await factory();
      } catch (err) {
        lastError = err;
        if (attempt < retries - 1) {
          await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
        }
      }
    }
    throw lastError;
  });
}

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  resetKey: string;
}

interface RouteErrorBoundaryState {
  hasError: boolean;
}

class RouteErrorBoundary extends React.Component<
  RouteErrorBoundaryProps,
  RouteErrorBoundaryState
> {
  declare props: RouteErrorBoundaryProps;
  declare state: RouteErrorBoundaryState;
  declare setState: (state: Partial<RouteErrorBoundaryState>) => void;

  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): RouteErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: RouteErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 min-h-[50vh] flex flex-col items-center justify-center px-4 py-20 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1 max-w-md">
            <h2 className="text-lg font-bold text-slate-900">Unable to load this view</h2>
            <p className="text-sm text-slate-600">
              A temporary connection issue interrupted loading. Please refresh to continue.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Code-split secondary subpages with retry resilience
const ContactPage = lazyWithRetry(() => import('./components/ContactPage').then(m => ({ default: m.ContactPage })));
const SuccessStoriesPage = lazyWithRetry(() => import('./components/SuccessStoriesPage').then(m => ({ default: m.SuccessStoriesPage })));
const AboutUsPage = lazyWithRetry(() => import('./components/AboutUsPage').then(m => ({ default: m.AboutUsPage })));
const GalleryPage = lazyWithRetry(() => import('./components/GalleryPage').then(m => ({ default: m.GalleryPage })));
const NavodayaExamPrepPage = lazyWithRetry(() => import('./components/NavodayaExamPrepPage').then(m => ({ default: m.NavodayaExamPrepPage })));
const OfflineClassesPage = lazyWithRetry(() => import('./components/OfflineClassesPage').then(m => ({ default: m.OfflineClassesPage })));
const AuthPage = lazyWithRetry(() => import('./components/AuthPage').then(m => ({ default: m.AuthPage })));
const ProfilePage = lazyWithRetry(() => import('./components/ProfilePage').then(m => ({ default: m.ProfilePage })));
const TeacherCompleteProfilePage = lazyWithRetry(() => import('./components/TeacherCompleteProfilePage').then(m => ({ default: m.TeacherCompleteProfilePage })));
const AdminPanel = lazyWithRetry(() => import('./components/AdminPanel').then(m => ({ default: m.AdminPanel })));
const ParentStudentForm = lazyWithRetry(() => import('./components/ParentStudentForm').then(m => ({ default: m.ParentStudentForm })));

const PageLoadingFallback = () => (
  <div className="flex-1 min-h-[50vh] flex flex-col items-center justify-center py-20 space-y-3">
    <div className="w-9 h-9 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
    <span className="text-xs font-semibold text-slate-500">Loading Kumari Institute...</span>
  </div>
);
import {
  subscribeToFirebaseAuth,
  logoutUserFromFirebase,
  loadSavedUserSession,
  AppUserProfile
} from './services/firebaseAuth';

export type CurrentUser = AppUserProfile;

export type AppTab =
  | 'home'
  | 'tutors'
  | 'gallery'
  | 'contact'
  | 'success'
  | 'about'
  | 'exam-prep'
  | 'offline-classes'
  | 'auth'
  | 'profile'
  | 'admin'
  | 'teacher-complete-profile'
  | 'parent-student-form'
  | 'tutor-profile';

type AppModalType = 'demo' | 'enquiry' | 'results' | 'program' | null;

interface HistoryNavState {
  __kumariNav: true;
  step: number;
  tab: AppTab;
  tutorId: string | null;
  authMode: AuthViewMode;
  authRole: 'parent' | 'teacher';
  modal: AppModalType;
  programId: string | null;
}

export default function App() {
  // Home page opens by default on initial website load
  const [activeTab, setActiveTab] = useState<AppTab>('home');
  const [selectedTutorForView, setSelectedTutorForView] = useState<Tutor | null>(null);
  const [authInitialMode, setAuthInitialMode] = useState<AuthViewMode>('login');
  const [authInitialRole, setAuthInitialRole] = useState<'parent' | 'teacher'>('parent');
  // Load saved session immediately, strictly verifying email status before setting session in App.tsx
  const [currentUser, setCurrentUser] = useState<AppUserProfile | null>(() => {
    const saved = loadSavedUserSession();
    return saved && saved.emailVerified === true ? saved : null;
  });
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [isEnquiryModalOpen, setIsEnquiryModalOpen] = useState(false);
  const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState<Program | null>(null);

  // In-memory lookup caches so browser history state stays strictly JSON-serializable
  const tutorCacheRef = useRef<Map<string, Tutor>>(new Map());
  const programCacheRef = useRef<Map<string, Program>>(new Map());

  const activeTabRef = useRef<AppTab>(activeTab);
  activeTabRef.current = activeTab;
  const selectedTutorRef = useRef<Tutor | null>(selectedTutorForView);
  selectedTutorRef.current = selectedTutorForView;
  const authModeRef = useRef<AuthViewMode>(authInitialMode);
  authModeRef.current = authInitialMode;
  const authRoleRef = useRef<'parent' | 'teacher'>(authInitialRole);
  authRoleRef.current = authInitialRole;
  const currentUserRef = useRef<AppUserProfile | null>(currentUser);
  currentUserRef.current = currentUser;

  const hasAppModalOpen = Boolean(
    isDemoModalOpen || isEnquiryModalOpen || isResultsModalOpen || selectedProgram
  );

  const isAdminUser = Boolean(
    currentUser &&
      (currentUser.role === 'admin' ||
        currentUser.email?.toLowerCase() === 'kkumariinstitute@gmail.com')
  );

  // First-time non-admin users who haven't submitted their details form yet must stay on their onboarding form
  const needsOnboardingDetails = Boolean(
    currentUser &&
      currentUser.emailVerified === true &&
      !isAdminUser &&
      !currentUser.profileCompleted
  );

  const needsOnboardingRef = useRef<boolean>(needsOnboardingDetails);
  needsOnboardingRef.current = needsOnboardingDetails;

  // Lock navigation (including BottomNav) strictly until a first-time user submits their onboarding form
  const isFirstTimeOnboardingForm = Boolean(
    needsOnboardingDetails ||
      (currentUser &&
        !currentUser.profileCompleted &&
        (activeTab === 'parent-student-form' || activeTab === 'teacher-complete-profile'))
  );

  // Centralized helper to sync React view & modal state with browser history
  const commitNavState = useCallback(
    (
      next: {
        tab?: AppTab;
        tutor?: Tutor | null;
        authMode?: AuthViewMode;
        authRole?: 'parent' | 'teacher';
        modal?: AppModalType;
        program?: Program | null;
      },
      options: { replace?: boolean; scroll?: boolean } = {}
    ) => {
      const targetTab = next.tab ?? activeTabRef.current;
      const targetTutor =
        next.tutor !== undefined
          ? next.tutor
          : targetTab === 'tutor-profile'
          ? selectedTutorRef.current
          : null;
      const targetAuthMode = next.authMode ?? authModeRef.current;
      const targetAuthRole = next.authRole ?? authRoleRef.current;
      const targetModal: AppModalType = next.modal !== undefined ? next.modal : null;
      const targetProgram =
        targetModal === 'program' ? (next.program !== undefined ? next.program : null) : null;

      if (targetTutor?.id) {
        tutorCacheRef.current.set(targetTutor.id, targetTutor);
      }
      if (targetProgram?.id) {
        programCacheRef.current.set(targetProgram.id, targetProgram);
      }

      const prevTab = activeTabRef.current;

      setActiveTab(targetTab);
      setSelectedTutorForView(targetTab === 'tutor-profile' ? targetTutor : null);
      if (next.authMode !== undefined) setAuthInitialMode(targetAuthMode);
      if (next.authRole !== undefined) setAuthInitialRole(targetAuthRole);
      setIsDemoModalOpen(targetModal === 'demo');
      setIsEnquiryModalOpen(targetModal === 'enquiry');
      setIsResultsModalOpen(targetModal === 'results');
      setSelectedProgram(targetModal === 'program' ? targetProgram : null);

      try {
        const cur = window.history.state as Partial<HistoryNavState & { __kumariSubModal?: string }> | null;
        const curStep = typeof cur?.step === 'number' ? cur.step : 0;
        const hasSubModal = Boolean(cur?.__kumariSubModal);

        const isSameSnapshot =
          Boolean(cur?.__kumariNav) &&
          !hasSubModal &&
          cur?.tab === targetTab &&
          (cur?.tutorId || null) === (targetTutor?.id || null) &&
          (cur?.modal || null) === targetModal &&
          (cur?.programId || null) === (targetProgram?.id || null) &&
          cur?.authMode === targetAuthMode &&
          cur?.authRole === targetAuthRole;

        if (!isSameSnapshot) {
          // If a child drawer/sub-modal was open when navigating to a new page, replace its transient entry
          const shouldReplace = Boolean(options.replace || hasSubModal);
          const nextStep = shouldReplace ? curStep : curStep + 1;
          const payload: HistoryNavState = {
            __kumariNav: true,
            step: nextStep,
            tab: targetTab,
            tutorId: targetTutor?.id || null,
            authMode: targetAuthMode,
            authRole: targetAuthRole,
            modal: targetModal,
            programId: targetProgram?.id || null,
          };
          if (shouldReplace) {
            window.history.replaceState(payload, '');
          } else {
            window.history.pushState(payload, '');
          }
        }
      } catch {
        // Fallback smoothly if History API is unavailable
      }

      if (options.scroll !== false && targetTab !== prevTab && targetModal === null) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    []
  );

  // Initialize root history entry and listen to browser/mobile Back & Forward navigation (popstate)
  useEffect(() => {
    try {
      const existing = window.history.state as Partial<HistoryNavState> | null;
      if (!existing || !existing.__kumariNav) {
        const initial: HistoryNavState = {
          __kumariNav: true,
          step: 0,
          tab: activeTabRef.current,
          tutorId: null,
          authMode: authModeRef.current,
          authRole: authRoleRef.current,
          modal: null,
          programId: null,
        };
        window.history.replaceState(initial, '');
      }
    } catch {
      // Ignore
    }

    const handlePopState = (event: PopStateEvent) => {
      const state = event.state as Partial<HistoryNavState> | null;

      // Keep un-onboarded verified users on their required onboarding form
      if (needsOnboardingRef.current && currentUserRef.current) {
        const lockedTab: AppTab =
          currentUserRef.current.role === 'teacher'
            ? 'teacher-complete-profile'
            : 'parent-student-form';
        setActiveTab(lockedTab);
        try {
          window.history.replaceState(
            {
              __kumariNav: true,
              step: typeof state?.step === 'number' ? state.step : 0,
              tab: lockedTab,
              tutorId: null,
              authMode: 'login',
              authRole: currentUserRef.current.role === 'teacher' ? 'teacher' : 'parent',
              modal: null,
              programId: null,
            } satisfies HistoryNavState,
            ''
          );
        } catch {
          // Ignore
        }
        return;
      }

      if (!state || !state.__kumariNav) {
        setActiveTab('home');
        setSelectedTutorForView(null);
        setIsDemoModalOpen(false);
        setIsEnquiryModalOpen(false);
        setIsResultsModalOpen(false);
        setSelectedProgram(null);
        return;
      }

      const prevTab = activeTabRef.current;
      let targetTab: AppTab = state.tab || 'home';

      // Prevent back-navigation into protected onboarding/profile screens after signing out
      if (
        !currentUserRef.current &&
        (targetTab === 'profile' ||
          targetTab === 'parent-student-form' ||
          targetTab === 'teacher-complete-profile')
      ) {
        targetTab = 'home';
      }

      let restoredTutor: Tutor | null = null;
      if (targetTab === 'tutor-profile') {
        restoredTutor = state.tutorId ? tutorCacheRef.current.get(state.tutorId) || null : null;
        if (!restoredTutor) {
          targetTab = 'tutors';
        }
      }

      const targetModal: AppModalType = state.modal || null;
      const restoredProgram =
        targetModal === 'program' && state.programId
          ? programCacheRef.current.get(state.programId) || null
          : null;

      setActiveTab(targetTab);
      setSelectedTutorForView(restoredTutor);
      if (state.authMode) setAuthInitialMode(state.authMode);
      if (state.authRole) setAuthInitialRole(state.authRole);
      setIsDemoModalOpen(targetModal === 'demo');
      setIsEnquiryModalOpen(targetModal === 'enquiry');
      setIsResultsModalOpen(targetModal === 'results');
      setSelectedProgram(targetModal === 'program' && restoredProgram ? restoredProgram : null);

      if (targetTab !== prevTab) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Enforce onboarding form view whenever an incomplete verified non-admin user is logged in (including after refresh)
  useEffect(() => {
    if (needsOnboardingDetails && currentUser) {
      const targetTab =
        currentUser.role === 'teacher' ? 'teacher-complete-profile' : 'parent-student-form';
      if (activeTab !== targetTab) {
        commitNavState({ tab: targetTab, modal: null }, { replace: true });
      }
    }
  }, [needsOnboardingDetails, currentUser?.role, activeTab, commitNavState]);

  // Synchronize authenticated user state with Firebase Authentication & Firestore in real-time
  useEffect(() => {
    const unsubscribe = subscribeToFirebaseAuth((firebaseUser) => {
      // Ensure only verified accounts can establish an active session in App.tsx
      if (firebaseUser && firebaseUser.emailVerified === true) {
        setCurrentUser(firebaseUser);
        const userIsAdmin =
          firebaseUser.role === 'admin' ||
          firebaseUser.email?.toLowerCase() === 'kkumariinstitute@gmail.com';
        const prev = activeTabRef.current;
        if (userIsAdmin) {
          if (prev === 'auth') {
            commitNavState({ tab: 'admin', modal: null }, { replace: true });
          }
        } else if (!firebaseUser.profileCompleted) {
          const target =
            firebaseUser.role === 'teacher'
              ? 'teacher-complete-profile'
              : 'parent-student-form';
          if (prev !== target) {
            commitNavState({ tab: target, modal: null }, { replace: true });
          }
        } else if (prev === 'auth') {
          commitNavState({ tab: 'profile', modal: null }, { replace: true });
        }
      } else {
        setCurrentUser(null);
        // If a user signs out from another tab while on protected views, transition to home
        const prev = activeTabRef.current;
        if (
          prev === 'profile' ||
          prev === 'parent-student-form' ||
          prev === 'teacher-complete-profile'
        ) {
          commitNavState({ tab: 'home', modal: null }, { replace: true });
        }
      }
    });

    return () => unsubscribe();
  }, [commitNavState]);

  const handleGoBack = useCallback(
    (fallbackTab: AppTab = 'home') => {
      try {
        const cur = window.history.state as Partial<HistoryNavState> | null;
        if (cur?.__kumariNav && typeof cur.step === 'number' && cur.step > 0) {
          window.history.back();
          return;
        }
      } catch {
        // Fallback below
      }
      commitNavState({ tab: fallbackTab, modal: null });
    },
    [commitNavState]
  );

  const closeAppModal = useCallback(
    (modalName: Exclude<AppModalType, null>) => {
      try {
        const cur = window.history.state as Partial<HistoryNavState & { __kumariSubModal?: string }> | null;
        if (cur?.__kumariNav && !cur?.__kumariSubModal && cur?.modal === modalName && (cur.step ?? 0) > 0) {
          window.history.back();
          return;
        }
      } catch {
        // Fallback directly
      }
      if (modalName === 'demo') setIsDemoModalOpen(false);
      else if (modalName === 'enquiry') setIsEnquiryModalOpen(false);
      else if (modalName === 'results') setIsResultsModalOpen(false);
      else if (modalName === 'program') setSelectedProgram(null);
    },
    []
  );

  const handleOpenDemo = () => commitNavState({ modal: 'demo' }, { scroll: false });
  const handleOpenEnquiry = () => commitNavState({ modal: 'enquiry' }, { scroll: false });
  const handleOpenResults = () => commitNavState({ modal: 'results' }, { scroll: false });
  const handleSelectProgram = (program: Program) =>
    commitNavState({ modal: 'program', program }, { scroll: false });

  const handleNavigateHome = () => {
    commitNavState({ tab: 'home', modal: null });
  };

  const handleNavigateTutors = () => {
    commitNavState({ tab: 'tutors', modal: null });
  };

  const handleViewTutorProfile = (tutor: Tutor) => {
    commitNavState({ tab: 'tutor-profile', tutor, modal: null });
  };

  const handleNavigateExamPrep = () => {
    commitNavState({ tab: 'exam-prep', modal: null });
  };

  const handleNavigateOfflineClasses = () => {
    commitNavState({ tab: 'offline-classes', modal: null });
  };

  const handleNavigateAbout = () => {
    commitNavState({ tab: 'about', modal: null });
  };

  const handleNavigateSuccess = () => {
    commitNavState({ tab: 'success', modal: null });
  };

  const handleNavigateGallery = () => {
    commitNavState({ tab: 'gallery', modal: null });
  };

  const handleNavigateContact = () => {
    commitNavState({ tab: 'contact', modal: null });
  };

  const handleNavigateAdmin = () => {
    commitNavState({ tab: 'admin', modal: null });
  };

  const handleNavigateAuth = (
    mode: AuthViewMode = 'login',
    role: 'parent' | 'teacher' = 'parent'
  ) => {
    commitNavState({ tab: 'auth', authMode: mode, authRole: role, modal: null });
  };

  const handleNavigateProfile = () => {
    if (
      currentUser &&
      !currentUser.profileCompleted &&
      currentUser.role !== 'admin' &&
      currentUser.email?.toLowerCase() !== 'kkumariinstitute@gmail.com'
    ) {
      commitNavState({
        tab: currentUser.role === 'teacher' ? 'teacher-complete-profile' : 'parent-student-form',
        modal: null,
      });
    } else {
      commitNavState({ tab: 'profile', modal: null });
    }
  };

  const handleScrollToCourses = () => {
    commitNavState({ tab: 'home', modal: null });
    setTimeout(() => {
      const el = document.getElementById('programs');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  return (
    <div
      id="kumari-app-root"
      className={`min-h-screen flex flex-col bg-white text-slate-900 font-sans selection:bg-amber-200 selection:text-slate-900 ${
        isFirstTimeOnboardingForm || activeTab === 'tutor-profile' || activeTab === 'offline-classes' || activeTab === 'auth' ? 'pb-0' : 'pb-16 lg:pb-0'
      }`}
    >
      {/* Main Navigation (hidden on Admin when authorized, Auth login pages, Profile, and mobile Tutor Profile / Offline Classes) */}
      {!(activeTab === 'admin' && isAdminUser) && activeTab !== 'auth' && activeTab !== 'profile' && (
        <div className={activeTab === 'tutor-profile' || activeTab === 'offline-classes' ? 'hidden md:block' : ''}>
          <Navbar
            activeTab={activeTab}
            currentUser={currentUser}
            onOpenProfile={handleNavigateProfile}
            onNavigateHome={handleNavigateHome}
            onNavigateTutors={handleNavigateTutors}
            onNavigateExamPrep={handleNavigateExamPrep}
            onNavigateOfflineClasses={handleNavigateOfflineClasses}
            onNavigateAbout={handleNavigateAbout}
            onNavigateSuccess={handleNavigateSuccess}
            onNavigateGallery={handleNavigateGallery}
            onNavigateContact={handleNavigateContact}
            onNavigateAdmin={handleNavigateAdmin}
            onOpenEnquiry={handleOpenEnquiry}
            onOpenDemoBooking={handleOpenDemo}
            onNavigateAuth={handleNavigateAuth}
            hideNavigation={isFirstTimeOnboardingForm}
          />
        </div>
      )}

      {/* Main View Router */}
      <RouteErrorBoundary resetKey={activeTab}>
        <Suspense fallback={<PageLoadingFallback />}>
        {activeTab === 'admin' ? (
        isAdminUser ? (
          <main className="flex-1 bg-slate-950">
            <AdminPanel
              currentUser={currentUser}
              onNavigateHome={handleNavigateHome}
              onNavigateTutors={handleNavigateTutors}
              onLogout={async () => {
                try {
                  await logoutUserFromFirebase();
                } catch (err) {
                  console.warn('Firebase logout notice:', err);
                }
                setCurrentUser(null);
                commitNavState({ tab: 'home', modal: null }, { replace: true });
              }}
            />
          </main>
        ) : (
          <main className="flex-1 bg-slate-950 text-white flex items-center justify-center p-6">
            <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-2xl space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto font-black text-xl">
                !
              </div>
              <h2 className="text-xl font-black text-white">Administrator Access Required</h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                This dashboard is restricted to authorized Kumari Institute administrators. Please sign in with your administrator account to continue.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleNavigateHome}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-200 font-bold text-xs cursor-pointer transition-colors"
                >
                  Back to Home
                </button>
                <button
                  type="button"
                  onClick={() => handleNavigateAuth('login', 'parent')}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs cursor-pointer transition-colors"
                >
                  Sign In
                </button>
              </div>
            </div>
          </main>
        )
      ) : activeTab === 'auth' ? (
        <main className="flex-1 bg-[#f8fafc]">
          <AuthPage
            initialMode={authInitialMode}
            initialRole={authInitialRole}
            currentUser={currentUser}
            onNavigateHome={handleNavigateHome}
            onNavigateProfile={handleNavigateProfile}
            onNavigateTutors={handleNavigateTutors}
            onNavigateAdmin={handleNavigateAdmin}
            onLoginSuccess={(user) => {
              // Strictly verify email status before setting the session in App.tsx
              if (user && user.emailVerified === true) {
                setCurrentUser(user);
                if (user.role === 'admin' || user.email?.toLowerCase() === 'kkumariinstitute@gmail.com') {
                  commitNavState({ tab: 'admin', modal: null }, { replace: true });
                } else if (user.profileCompleted) {
                  // Returning completed user -> direct to Profile
                  commitNavState({ tab: 'profile', modal: null }, { replace: true });
                } else if (user.role === 'teacher') {
                  // First-time teacher -> complete profile form (nav locked)
                  commitNavState({ tab: 'teacher-complete-profile', modal: null }, { replace: true });
                } else {
                  // First-time parent -> student details form (nav locked)
                  commitNavState({ tab: 'parent-student-form', modal: null }, { replace: true });
                }
              } else {
                console.warn('Blocked unverified user session in App.tsx');
                setCurrentUser(null);
              }
            }}
            onTeacherRegistered={() => {
              // Registration requires email verification before session is set
            }}
            onOpenProfileModal={handleNavigateProfile}
          />
        </main>
      ) : activeTab === 'exam-prep' ? (
        <main className="flex-1">
          <NavodayaExamPrepPage
            onNavigateHome={handleNavigateHome}
            onNavigateTutors={handleNavigateTutors}
            onOpenEnquiry={handleOpenEnquiry}
            onOpenDemoBooking={handleOpenDemo}
          />
        </main>
      ) : activeTab === 'offline-classes' ? (
        <main className="flex-1">
          <OfflineClassesPage
            currentUser={currentUser}
            onBack={() => handleGoBack('home')}
            onNavigateHome={handleNavigateHome}
            onNavigateTutors={handleNavigateTutors}
            onNavigateExamPrep={handleNavigateExamPrep}
            onNavigateGallery={handleNavigateGallery}
            onNavigateContact={handleNavigateContact}
            onOpenProfile={handleNavigateProfile}
            onNavigateAuth={() => handleNavigateAuth('login', 'parent')}
          />
        </main>
      ) : activeTab === 'tutors' ? (
        <main className="flex-1">
          <FindTutorsPage
            currentUser={currentUser}
            onNavigateHome={handleNavigateHome}
            onOpenEnquiry={handleOpenEnquiry}
            onOpenDemoBooking={handleOpenDemo}
            onNavigateAuth={handleNavigateAuth}
            onViewTutorProfile={handleViewTutorProfile}
            onLoginSuccess={(user) => {
              setCurrentUser(user);
              if (user.role === 'admin' || user.email?.toLowerCase() === 'kkumariinstitute@gmail.com') {
                commitNavState({ tab: 'tutors', modal: null }, { replace: true });
              } else if (!user.profileCompleted) {
                // First-time user -> redirect to onboarding form for their role
                commitNavState(
                  {
                    tab: user.role === 'teacher' ? 'teacher-complete-profile' : 'parent-student-form',
                    modal: null,
                  },
                  { replace: true }
                );
              } else if (user.role === 'teacher') {
                commitNavState({ tab: 'profile', modal: null }, { replace: true });
              } else {
                // Returning completed parent -> stay on Find Tutors
                commitNavState({ tab: 'tutors', modal: null }, { replace: true });
              }
            }}
          />
        </main>
      ) : activeTab === 'tutor-profile' && selectedTutorForView ? (
        <main className="flex-1">
          <TutorProfilePage
            tutor={selectedTutorForView}
            currentUser={currentUser}
            onBack={() => handleGoBack('tutors')}
            onNavigateHome={handleNavigateHome}
            onNavigateAuth={handleNavigateAuth}
            onOpenEnquiry={handleOpenEnquiry}
            onOpenDemoBooking={handleOpenDemo}
          />
        </main>
      ) : activeTab === 'gallery' ? (
        <main className="flex-1">
          <GalleryPage
            onOpenEnquiry={handleOpenEnquiry}
            onOpenDemoBooking={handleOpenDemo}
          />
        </main>
      ) : activeTab === 'contact' ? (
        <main className="flex-1">
          <ContactPage
            onNavigateHome={handleNavigateHome}
            onNavigateAbout={handleNavigateAbout}
            onNavigateSuccess={handleNavigateSuccess}
            onOpenEnquiry={handleOpenEnquiry}
          />
        </main>
      ) : activeTab === 'success' ? (
        <main className="flex-1">
          <SuccessStoriesPage
            onNavigateHome={handleNavigateHome}
            onNavigateAbout={handleNavigateAbout}
            onOpenEnquiry={handleOpenEnquiry}
            onOpenDemoBooking={handleOpenDemo}
          />
        </main>
      ) : activeTab === 'about' ? (
        <main className="flex-1">
          <AboutUsPage
            onNavigateHome={handleNavigateHome}
            onOpenEnquiry={handleOpenEnquiry}
            onOpenDemoBooking={handleOpenDemo}
          />
        </main>
      ) : activeTab === 'profile' ? (
        <main className="flex-1">
          {currentUser && currentUser.emailVerified === true ? (
            <ProfilePage
              user={currentUser}
              onNavigateHome={handleNavigateHome}
              onNavigateCourses={handleScrollToCourses}
              onNavigateTutors={handleNavigateTutors}
              onOpenEnquiry={handleOpenEnquiry}
              onOpenDemoBooking={handleOpenDemo}
              onOpenParentStudentForm={() => commitNavState({ tab: 'parent-student-form', modal: null })}
              onCompleteTeacherProfile={() => commitNavState({ tab: 'teacher-complete-profile', modal: null })}
              onLogout={async () => {
                try {
                  await logoutUserFromFirebase();
                } catch (err) {
                  console.warn('Firebase logout notice:', err);
                }
                setCurrentUser(null);
                commitNavState({ tab: 'home', modal: null }, { replace: true });
              }}
              onProfileUpdated={(updatedUser) => setCurrentUser(updatedUser)}
            />
          ) : (
            <div className="py-24 max-w-md mx-auto px-4 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 mx-auto flex items-center justify-center border border-amber-200">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
              <p className="text-sm text-slate-600">
                Kindly verify your email and log in to access your profile and learning dashboard.
              </p>
              <button
                type="button"
                onClick={() => handleNavigateAuth('login')}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Log In with Verified Account
              </button>
            </div>
          )}
        </main>
      ) : activeTab === 'parent-student-form' ? (
        <main className="flex-1">
          <ParentStudentForm
            currentUser={currentUser}
            onNavigateHome={handleNavigateHome}
            onNavigateTutors={handleNavigateTutors}
            onStudentDetailsSaved={(updatedUser) => {
              setCurrentUser(updatedUser);
              commitNavState({ tab: 'profile', modal: null }, { replace: true });
            }}
          />
        </main>
      ) : activeTab === 'teacher-complete-profile' ? (
        <main className="flex-1">
          <TeacherCompleteProfilePage
            currentUser={currentUser}
            onBackToDashboard={() => handleGoBack('profile')}
            onNavigateHome={handleNavigateHome}
            onProfileSaved={(updatedUser) => {
              setCurrentUser(updatedUser);
              commitNavState({ tab: 'profile', modal: null }, { replace: true });
            }}
          />
        </main>
      ) : (
        <main className="flex-1">
          {/* Hero Section (Banner + Spotlight Service Boxes) */}
          <HeroSection
            onOpenCourses={handleScrollToCourses}
            onOpenDemoBooking={handleOpenDemo}
            onOpenEnquiry={handleOpenEnquiry}
            onNavigateTutors={handleNavigateTutors}
            onNavigateExamPrep={handleNavigateExamPrep}
            onNavigateOfflineClasses={handleNavigateOfflineClasses}
            onSelectProgram={handleSelectProgram}
          />

          {/* Why Choose Us Section */}
          <ChildDeservesBestSection id="why-us" onOpenDemoBooking={handleOpenDemo} />

          {/* 4 Stats Blue Ribbon */}
          <StatsRibbon />

          {/* Success Stories */}
          <ResultsAndTestimonials onViewMoreResults={handleOpenResults} />

          {/* Frequently Asked Questions */}
          <FaqSection
            onOpenDemoBooking={handleOpenDemo}
            onOpenEnquiry={handleOpenEnquiry}
          />
        </main>
      )}
        </Suspense>
      </RouteErrorBoundary>

      {/* Website Footer rendered exclusively on the home page */}
      {activeTab === 'home' && !isFirstTimeOnboardingForm && (
        <Footer
          onNavigateHome={handleNavigateHome}
          onNavigateTutors={handleNavigateTutors}
          onNavigateAbout={handleNavigateAbout}
          onNavigateSuccess={handleNavigateSuccess}
          onNavigateGallery={handleNavigateGallery}
          onNavigateContact={handleNavigateContact}
          onOpenEnquiry={handleOpenEnquiry}
          onNavigateAuth={handleNavigateAuth}
        />
      )}

      {/* Interactive Modals */}
      <DemoBookingModal
        isOpen={isDemoModalOpen}
        onClose={() => closeAppModal('demo')}
        currentUser={currentUser}
        onBookingRecorded={(updatedUser) => setCurrentUser(updatedUser)}
      />

      <EnquiryModal
        isOpen={isEnquiryModalOpen}
        onClose={() => closeAppModal('enquiry')}
      />

      <ProgramDetailModal
        program={selectedProgram}
        onClose={() => closeAppModal('program')}
        onBookDemo={() => commitNavState({ modal: 'demo' }, { replace: true, scroll: false })}
        currentUser={currentUser}
        onEnrollSuccess={(updatedUser) => setCurrentUser(updatedUser)}
        onPromptLogin={() =>
          commitNavState(
            { tab: 'auth', authMode: 'login', authRole: 'parent', modal: null },
            { replace: true }
          )
        }
      />

      <ResultsModal
        isOpen={isResultsModalOpen}
        onClose={() => closeAppModal('results')}
        onBookDemo={() => commitNavState({ modal: 'demo' }, { replace: true, scroll: false })}
      />

      {/* Floating Realistic WhatsApp & Phone Badges positioned above BottomNav (hidden on Admin, Auth, onboarding, Offline Classes mobile, and mobile Tutor Profile) */}
      {activeTab !== 'admin' && activeTab !== 'auth' && activeTab !== 'offline-classes' && !isFirstTimeOnboardingForm && !hasAppModalOpen && (
        <div className={activeTab === 'tutor-profile' ? 'hidden md:block' : ''}>
          <FloatingContactBadges isHidden={hasAppModalOpen} />
        </div>
      )}

      {/* Mobile App-Style Bottom Navigation Bar (< lg) — hidden during Admin, Auth, Offline Classes, first-time detail upload, any popup, or mobile Tutor Profile */}
      {activeTab !== 'admin' && activeTab !== 'auth' && activeTab !== 'offline-classes' && !isFirstTimeOnboardingForm && !hasAppModalOpen && (
        <div className={activeTab === 'tutor-profile' ? 'hidden md:block' : ''}>
          <BottomNav
            activeTab={activeTab}
            currentUser={currentUser}
            isPopupOpen={hasAppModalOpen}
            onNavigateHome={handleNavigateHome}
            onNavigateAbout={handleNavigateAbout}
            onNavigateSuccess={handleNavigateSuccess}
            onNavigateGallery={handleNavigateGallery}
            onNavigateTutors={handleNavigateTutors}
            onNavigateContact={handleNavigateContact}
            onNavigateProfile={() => {
              if (currentUser) {
                handleNavigateProfile();
              } else {
                handleNavigateAuth('login', 'parent');
              }
            }}
            onNavigateAuth={handleNavigateAuth}
          />
        </div>
      )}
    </div>
  );
}
