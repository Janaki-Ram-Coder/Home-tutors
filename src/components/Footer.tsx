import React, { useState } from 'react';
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Send,
  CheckCircle2,
  Loader2,
  AlertCircle,
  X,
  ShieldCheck
} from 'lucide-react';
import { instituteInfo } from '../data/instituteData';
import { saveNewsletterSubscriptionToFirestore } from '../services/firebaseAuth';
import { useBackButtonDismiss } from '../hooks/useBackButtonDismiss';

interface FooterProps {
  onNavigateHome?: () => void;
  onNavigateTutors?: () => void;
  onNavigateAbout?: () => void;
  onNavigateSuccess?: () => void;
  onNavigateGallery?: () => void;
  onNavigateContact?: () => void;
  onOpenEnquiry?: () => void;
  onNavigateAuth?: (mode?: 'login' | 'parent-login' | 'teacher-login' | 'create-parent' | 'create-teacher', role?: 'parent' | 'teacher') => void;
}

type PolicyModalType = 'privacy' | 'terms' | 'conduct' | null;

const POLICY_CONTENT: Record<
  Exclude<PolicyModalType, null>,
  { title: string; subtitle: string; points: string[] }
> = {
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'How Kumari Institute safeguards parent, student, and tutor information.',
    points: [
      'Student names, academic grades, parent contact numbers, and Rayagada locality details are collected solely to arrange verified home tuition, offline batch counseling, and progress reporting.',
      'Educator verification documents (marksheets, degrees, Aadhaar verification IDs) are reviewed strictly by authorized Kumari Institute administrators and are never shared publicly.',
      'Online fee transactions are processed securely through Razorpay with HMAC-SHA256 verification. We do not store card numbers, CVVs, or UPI PINs.',
      'Parents or tutors may request profile corrections or account removal anytime via kkumariinstitute@gmail.com or +91 94398 51521.'
    ]
  },
  terms: {
    title: 'Terms of Service',
    subtitle: 'Guidelines governing Kumari Institute home tuition and classroom batches.',
    points: [
      'All home tutor bookings include a free trial assessment window coordinated by the Indira Nagar academic desk prior to regular monthly enrollment.',
      'Monthly tuition fees follow a 30-day cycle from fee settlement. Parents receive official digital receipts with transaction and validity records.',
      'Tutor assignments and batch schedules may be adjusted or reassigned by coordinators upon parent request to ensure consistent academic progress.',
      'Any scheduling changes or leave notices should be communicated in advance through your Kumari Institute coordinator.'
    ]
  },
  conduct: {
    title: 'Student Code of Conduct',
    subtitle: 'Shared standards for respectful, focused, and safe learning.',
    points: [
      'Students are expected to maintain punctuality for home tuition sessions and Indira Nagar classroom batches, and complete assigned practice worksheets.',
      'Respectful behavior toward mentors, fellow learners, and study materials is mandatory across both doorstep tutoring and institute classrooms.',
      'Regular weekly tests and monthly feedback sessions require honest participation so educators can accurately support weak areas.',
      'Parents are encouraged to maintain a quiet, well-lit study environment during home tuition sessions.'
    ]
  }
};

export const Footer: React.FC<FooterProps> = ({
  onNavigateHome,
  onNavigateTutors,
  onNavigateAbout,
  onNavigateSuccess,
  onNavigateGallery,
  onNavigateContact,
  onOpenEnquiry,
  onNavigateAuth,
}) => {
  const [emailSub, setEmailSub] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [activePolicy, setActivePolicy] = useState<PolicyModalType>(null);

  useBackButtonDismiss(Boolean(activePolicy), 'footer-policy-modal', () =>
    setActivePolicy(null)
  );

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailSub.trim();
    if (!trimmed) return;
    setSubError(null);
    setIsSubscribing(true);
    try {
      await saveNewsletterSubscriptionToFirestore(trimmed);
      setSubscribed(true);
      setEmailSub('');
      setTimeout(() => {
        setSubscribed(false);
      }, 4500);
    } catch {
      setSubError('Could not save subscription right now. Please try again.');
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleNav = (target: 'home' | 'tutors' | 'courses' | 'about' | 'success' | 'gallery' | 'contact') => {
    if (target === 'home') {
      if (onNavigateHome) onNavigateHome();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (target === 'tutors') {
      if (onNavigateTutors) onNavigateTutors();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (target === 'courses') {
      if (onNavigateHome) onNavigateHome();
      setTimeout(() => {
        const el = document.getElementById('programs');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
        else window.scrollTo({ top: 600, behavior: 'smooth' });
      }, 100);
    } else if (target === 'about') {
      if (onNavigateAbout) onNavigateAbout();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (target === 'success') {
      if (onNavigateSuccess) onNavigateSuccess();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (target === 'gallery') {
      if (onNavigateGallery) onNavigateGallery();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (target === 'contact') {
      if (onNavigateContact) onNavigateContact();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const policyData = activePolicy ? POLICY_CONTENT[activePolicy] : null;

  return (
    <>
      <footer id="contact" className="bg-[#08182b] text-slate-300 pt-16 pb-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 pb-12 border-b border-slate-800/80">
            {/* Col 1: Brand Info */}
            <div className="lg:col-span-4">
              <div className="mb-4">
                <button
                  type="button"
                  onClick={() => handleNav('home')}
                  className="inline-block text-left cursor-pointer focus:outline-none p-0 m-0"
                >
                  <img
                    src="/Logo/kumarilogo.png"
                    alt="Kumari Institute Logo"
                    className="h-16 sm:h-20 w-auto max-w-[260px] object-contain p-[3px] hover:scale-105 transition-transform duration-200"
                    style={{ padding: '3px' }}
                    referrerPolicy="no-referrer"
                  />
                </button>
              </div>

              <p className="text-sm text-slate-400 leading-relaxed mb-6 max-w-sm">
                Empowering young minds with conceptual clarity, personalized mentoring, and dedicated faculty support from primary schooling to competitive exam triumphs in Indira Nagar, Rayagada.
              </p>

              <div className="flex items-center gap-3 text-xs text-slate-400">
                <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                <span>{instituteInfo.hours}</span>
              </div>
            </div>

            {/* Col 2: Quick Links */}
            <div className="lg:col-span-2">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                Navigation
              </h4>
              <ul className="space-y-2.5 text-sm">
                <li>
                  <button
                    type="button"
                    onClick={() => handleNav('home')}
                    className="hover:text-amber-400 transition-colors text-left cursor-pointer"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNav('tutors')}
                    className="hover:text-amber-400 text-blue-300 font-semibold transition-colors text-left cursor-pointer flex items-center gap-1.5"
                  >
                    <span>Find Home Tutors</span>
                    <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.2 rounded-full font-bold">New</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNav('courses')}
                    className="hover:text-amber-400 transition-colors text-left cursor-pointer"
                  >
                    All Courses
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNav('about')}
                    className="hover:text-amber-400 transition-colors text-left cursor-pointer"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNav('success')}
                    className="hover:text-amber-400 transition-colors text-left cursor-pointer"
                  >
                    Success Stories
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNav('gallery')}
                    className="hover:text-amber-400 transition-colors text-left cursor-pointer"
                  >
                    Gallery
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => handleNav('contact')}
                    className="hover:text-amber-400 transition-colors text-left cursor-pointer"
                  >
                    Contact Us
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigateAuth?.('login', 'parent')}
                    className="hover:text-amber-400 text-amber-300 font-semibold transition-colors text-left cursor-pointer"
                  >
                    Parent Login
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => onNavigateAuth?.('login', 'teacher')}
                    className="hover:text-purple-300 text-purple-300 font-semibold transition-colors text-left cursor-pointer"
                  >
                    Join as Tutor / Tutor Login
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 3: Programs */}
            <div className="lg:col-span-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                Our Programs
              </h4>
              <ul className="space-y-2.5 text-sm text-slate-400">
                <li
                  onClick={onOpenEnquiry}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  • Home Tuition (Class 1 to 5)
                </li>
                <li
                  onClick={onOpenEnquiry}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  • Navodaya &amp; Adarsh Vidyalaya Prep
                </li>
                <li
                  onClick={onOpenEnquiry}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  • Offline Classes (Class 6 to 10)
                </li>
                <li
                  onClick={onOpenEnquiry}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  • Higher Secondary (Class 11 &amp; 12)
                </li>
                <li
                  onClick={onOpenEnquiry}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  • Math &amp; Science Concept Batch
                </li>
              </ul>
            </div>

            {/* Col 4: Newsletter & Contact */}
            <div className="lg:col-span-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
                Stay Informed
              </h4>
              <p className="text-xs text-slate-400 mb-3 leading-relaxed">
                Subscribe to exam alerts, revision notes, and free scholarship test updates.
              </p>

              {subscribed ? (
                <div className="flex items-center gap-2 p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-xl text-emerald-300 text-xs mb-4">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Subscribed! We will share updates with you.</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="space-y-2 mb-4">
                  <div className="relative">
                    <input
                      type="email"
                      required
                      disabled={isSubscribing}
                      placeholder="Enter parent or student email"
                      value={emailSub}
                      onChange={(e) => {
                        setEmailSub(e.target.value);
                        if (subError) setSubError(null);
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-400 pr-10 disabled:opacity-60"
                    />
                    <button
                      type="submit"
                      disabled={isSubscribing}
                      className="absolute right-1.5 top-1.5 p-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                      aria-label="Subscribe"
                    >
                      {isSubscribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  {subError && (
                    <p className="text-[11px] text-rose-400 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{subError}</span>
                    </p>
                  )}
                </form>
              )}

              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <a href={`tel:${instituteInfo.phoneClean}`} className="hover:text-white font-semibold">
                    {instituteInfo.phone}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded-full bg-[#25D366] flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 32 32" className="w-2.5 h-2.5" fill="#FFFFFF" aria-hidden="true">
                      <path d="M16 3C8.82 3 3 8.72 3 15.77c0 2.52.75 4.87 2.04 6.84L3.6 28.4l5.98-1.54A13.1 13.1 0 0016 28.54c7.18 0 13-5.72 13-12.77C29 8.72 23.18 3 16 3z" />
                    </svg>
                  </span>
                  <a
                    href={`https://wa.me/${instituteInfo.whatsappNumber}?text=${encodeURIComponent(
                      'Hello Kumari Institute, I would like to enquire about classes and home tuition.'
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-emerald-300 font-semibold"
                  >
                    WhatsApp: {instituteInfo.phone}
                  </a>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <a href={`mailto:${instituteInfo.email}`} className="hover:text-white">
                    {instituteInfo.email}
                  </a>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  <span>{instituteInfo.address}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom copyright */}
          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div>
              © {new Date().getFullYear()} Kumari Institute. All rights reserved.
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6">
              <button
                type="button"
                onClick={() => setActivePolicy('privacy')}
                className="hover:text-slate-300 transition-colors cursor-pointer"
              >
                Privacy Policy
              </button>
              <button
                type="button"
                onClick={() => setActivePolicy('terms')}
                className="hover:text-slate-300 transition-colors cursor-pointer"
              >
                Terms of Service
              </button>
              <button
                type="button"
                onClick={() => setActivePolicy('conduct')}
                className="hover:text-slate-300 transition-colors cursor-pointer"
              >
                Student Code of Conduct
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Policy Modal */}
      {policyData && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="footer-policy-modal-title"
          className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setActivePolicy(null)}
        >
          <div className="bg-white text-slate-800 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden relative my-6 text-left">
            <div className="bg-[#08182b] text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
                <h3 id="footer-policy-modal-title" className="text-lg font-black text-white">
                  {policyData.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActivePolicy(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-xs font-semibold text-slate-500">{policyData.subtitle}</p>
              <ul className="space-y-3">
                {policyData.points.map((pt, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 leading-relaxed">
                    <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setActivePolicy(null)}
                className="px-5 py-2 rounded-xl bg-[#08182b] hover:bg-slate-900 text-white font-bold text-xs cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
