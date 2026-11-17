import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Users,
  GraduationCap,
  Loader2,
  Check,
  ArrowRight,
} from 'lucide-react';
import {
  loginWithGoogle,
  formatFirebaseError,
  AppUserProfile,
} from '../services/firebaseAuth';

export type AuthViewMode =
  | 'login'
  | 'register'
  | 'parent-login'
  | 'teacher-login'
  | 'create-parent'
  | 'create-teacher';

interface AuthPageProps {
  initialMode?: string;
  initialRole?: 'parent' | 'teacher';
  currentUser?: AppUserProfile | null;
  onNavigateHome: () => void;
  onNavigateTutors?: () => void;
  onNavigateAdmin?: () => void;
  onLoginSuccess?: (user: AppUserProfile) => void;
  onTeacherRegistered?: (teacher: { name: string; email: string; phone: string }) => void;
  onOpenProfileModal?: () => void;
  onNavigateProfile?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  initialMode = 'login',
  initialRole = 'parent',
  onNavigateHome,
  onNavigateAdmin,
  onLoginSuccess,
}) => {
  const computeInitialRole = (): 'parent' | 'teacher' => {
    if (
      initialMode === 'teacher-login' ||
      initialMode === 'create-teacher' ||
      initialRole === 'teacher'
    ) {
      return 'teacher';
    }
    return 'parent';
  };

  const [role, setRole] = useState<'parent' | 'teacher'>(computeInitialRole());
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginSuccess, setLoginSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (initialRole === 'teacher') {
      setRole('teacher');
    } else if (initialRole === 'parent') {
      setRole('parent');
    }
  }, [initialRole]);

  useEffect(() => {
    if (initialMode === 'teacher-login' || initialMode === 'create-teacher') {
      setRole('teacher');
    } else if (initialMode === 'parent-login' || initialMode === 'create-parent') {
      setRole('parent');
    }
  }, [initialMode]);

  const handleGoogleSignIn = async () => {
    setLoginError(null);
    setLoginSuccess(null);
    setIsGoogleSigningIn(true);
    try {
      const userProfile = await loginWithGoogle(role);
      setLoginSuccess(`Signed in with Google as ${userProfile.name}!`);

      if (onLoginSuccess) {
        onLoginSuccess(userProfile);
        return;
      }

      setTimeout(() => {
        if (
          userProfile.role === 'admin' ||
          userProfile.email?.toLowerCase() === 'kkumariinstitute@gmail.com'
        ) {
          if (onNavigateAdmin) onNavigateAdmin();
          else onNavigateHome();
        } else {
          onNavigateHome();
        }
      }, 500);
    } catch (err: any) {
      console.warn('Google sign-in error:', err);
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request'
      ) {
        return;
      }
      setLoginError(
        formatFirebaseError(err) ||
          'Google sign-in could not be completed. Please try again.'
      );
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const renderGoogleIcon = () => (
    <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center shrink-0">
      <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
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
  );

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col py-6 sm:py-10 px-4 sm:px-6 lg:px-10 selection:bg-blue-100 selection:text-blue-900">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        {/* Top Row: Back Button Left + Centered Colored Portal Toggle */}
        <div className="flex flex-col sm:grid sm:grid-cols-3 items-center gap-3">
          <div className="self-start sm:justify-self-start">
            <button
              type="button"
              id="auth-back-to-home-btn"
              onClick={onNavigateHome}
              className="inline-flex items-center gap-2 h-10 px-3.5 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm font-semibold text-slate-700 hover:text-[#0c2340] hover:border-slate-300 transition-colors cursor-pointer group shadow-2xs whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              <span>Back to Home</span>
            </button>
          </div>

          {/* Centered Colored Active Segmented Toggle */}
          <div
            role="tablist"
            aria-label="Select Account Type"
            className="sm:justify-self-center inline-flex items-center gap-1.5 p-1.5 bg-white border border-slate-200/90 rounded-2xl shadow-xs"
          >
            <button
              type="button"
              id="auth-toggle-parent-btn"
              role="tab"
              aria-selected={role === 'parent'}
              onClick={() => {
                setRole('parent');
                setLoginError(null);
              }}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2 ${
                role === 'parent'
                  ? 'bg-gradient-to-r from-[#0c2340] via-[#14396b] to-[#1d4ed8] text-white shadow-md shadow-blue-900/20'
                  : 'text-slate-600 hover:text-[#0c2340] hover:bg-slate-100/80'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>Parent Login</span>
            </button>

            <button
              type="button"
              id="auth-toggle-tutor-btn"
              role="tab"
              aria-selected={role === 'teacher'}
              onClick={() => {
                setRole('teacher');
                setLoginError(null);
              }}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-2 ${
                role === 'teacher'
                  ? 'bg-gradient-to-r from-[#1d4ed8] via-[#2563eb] to-[#0284c7] text-white shadow-md shadow-blue-700/25'
                  : 'text-slate-600 hover:text-[#1d4ed8] hover:bg-slate-100/80'
              }`}
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span>Tutor Login</span>
            </button>
          </div>

          <div className="hidden sm:block" aria-hidden="true" />
        </div>

        {role === 'teacher' ? (
          /* TUTOR LOGIN FLOW: 1) Earnings Poster First at Top -> 2) Sign in as a Home Tutor Card Next */
          <div className="max-w-3xl mx-auto space-y-6">
            {/* TOP: Official Tutor Earnings Poster */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-[#1d4ed8]">
                    Educator &amp; Home Tutor Portal
                  </p>
                  <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-[#0c2340]">
                    How Your Tutor Earnings Work
                  </h1>
                </div>
                <span className="text-xs sm:text-sm font-bold font-mono tabular-nums text-[#1d4ed8]">
                  80% / 20% Split
                </span>
              </div>

              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                <img
                  src="/assets/aistudio/image_4def1a4b.png"
                  alt="Teach with Kumari Institute — Tutor Earnings 80% and Kumari Institute Fee 20%"
                  className="w-full h-auto object-contain block"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* NEXT: Sign in as a Home Tutor Card Directly After the Poster */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-7 space-y-5">
              <div className="space-y-1.5">
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#0c2340]">
                  Sign in as a Home Tutor
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  Continue with your Google account to create your tutor profile, set class &amp; board fees, and receive local student bookings.
                </p>
              </div>

              {/* Alerts */}
              {loginError && (
                <div
                  id="login-error-alert"
                  role="alert"
                  className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-medium flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span className="flex-1">{loginError}</span>
                </div>
              )}

              {loginSuccess && (
                <div
                  id="login-success-alert"
                  role="status"
                  className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-medium flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span className="flex-1">{loginSuccess}</span>
                </div>
              )}

              {/* Primary Google Sign-In Button */}
              <div className="space-y-2.5">
                <button
                  type="button"
                  id="google-signin-main-btn"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleSigningIn}
                  className="w-full min-h-[52px] py-3.5 px-5 rounded-xl bg-[#0c2340] hover:bg-[#1d4ed8] text-white font-bold text-sm sm:text-base shadow-sm transition-colors flex items-center justify-center gap-3 cursor-pointer active:scale-[0.99] disabled:opacity-70"
                >
                  {isGoogleSigningIn ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-amber-300" />
                      <span>Signing in with Google...</span>
                    </>
                  ) : (
                    <>
                      {renderGoogleIcon()}
                      <span className="truncate">Continue with Google as Tutor</span>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Instant Google verification · No password required</span>
                </div>
              </div>

              {/* Tutor Benefits */}
              <div className="pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-600">
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#1d4ed8] mt-0.5 shrink-0" />
                  <span>Keep 80% of every monthly class fee</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#1d4ed8] mt-0.5 shrink-0" />
                  <span>Set class &amp; board fees (1st–12th)</span>
                </div>
                <div className="flex items-start gap-2">
                  <Check className="w-4 h-4 text-[#1d4ed8] mt-0.5 shrink-0" />
                  <span>Direct UPI &amp; bank settlements</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* PARENT LOGIN FLOW: Clean Centered Card */
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#1d4ed8] tracking-wide">
                  Parent &amp; Student Portal
                </p>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0c2340] [text-wrap:balance]">
                  Sign in to find your home tutor
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Access verified local tutors in Rayagada, view exact class fees, and manage bookings in one place.
                </p>
              </div>

              {/* Alerts */}
              {loginError && (
                <div
                  id="login-error-alert"
                  role="alert"
                  className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm font-medium flex items-start gap-2.5"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <span className="flex-1">{loginError}</span>
                </div>
              )}

              {loginSuccess && (
                <div
                  id="login-success-alert"
                  role="status"
                  className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-medium flex items-start gap-2.5"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span className="flex-1">{loginSuccess}</span>
                </div>
              )}

              {/* Primary Google Sign-In Action */}
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  id="google-signin-main-btn"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleSigningIn}
                  className="w-full min-h-[52px] py-3.5 px-5 rounded-xl bg-[#0c2340] hover:bg-[#1d4ed8] text-white font-bold text-sm sm:text-base shadow-sm transition-colors flex items-center justify-center gap-3 cursor-pointer active:scale-[0.99] disabled:opacity-70"
                >
                  {isGoogleSigningIn ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-amber-300" />
                      <span>Signing in with Google...</span>
                    </>
                  ) : (
                    <>
                      {renderGoogleIcon()}
                      <span className="truncate">Continue with Google as Parent</span>
                      <ArrowRight className="w-4 h-4 shrink-0" />
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Instant Google verification · No password required</span>
                </div>
              </div>

              {/* Clean Role Benefits Checklist */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <p className="text-xs font-bold text-slate-800">
                  Included with your Parent Account
                </p>
                <ul className="space-y-2 text-xs text-slate-600">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#1d4ed8] mt-0.5 shrink-0" />
                    <span>Browse Aadhaar &amp; degree-verified Rayagada home tutors</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#1d4ed8] mt-0.5 shrink-0" />
                    <span>View exact CBSE &amp; ICSE class fees before booking</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-[#1d4ed8] mt-0.5 shrink-0" />
                    <span>Auto-saved student profile, time slots &amp; digital fee receipts</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
