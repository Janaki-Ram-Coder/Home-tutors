import React, { useState } from 'react';
import { X, CheckCircle2, Phone, AlertCircle, Loader2 } from 'lucide-react';
import { instituteInfo } from '../data/instituteData';
import { saveEnquiryToFirestore } from '../services/firebaseAuth';
import { useBackButtonDismiss } from '../hooks/useBackButtonDismiss';

interface EnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EnquiryModal: React.FC<EnquiryModalProps> = ({ isOpen, onClose }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [grade, setGrade] = useState('Class 6 to 8 (Middle School)');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useBackButtonDismiss(isOpen, 'enquiry-modal', onClose);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setSubmitError('Please provide your name and phone number.');
      return;
    }
    setSubmitError(null);
    setIsSubmitting(true);
    try {
      await saveEnquiryToFirestore({
        name: name.trim(),
        phone: phone.trim(),
        grade,
        message: message.trim()
      });
      setSubmitted(true);
    } catch {
      setSubmitError('Could not submit your enquiry right now. Please try again or call +91 94398 51521.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    setSubmitted(false);
    onClose();
  };

  return (
    <div
      id="enquiry-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enquiry-modal-title"
      className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden relative my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0c2340] via-[#132e54] to-[#1e3a8a] text-white p-6 relative">
          <button
            type="button"
            id="close-enquiry-modal-btn"
            onClick={onClose}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer ring-1 ring-white/20 shadow-xs"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="mb-3">
            <img
              src="/Logo/kumarilogo.png"
              alt="Kumari Institute"
              className="h-10 sm:h-12 w-auto max-w-[170px] object-contain p-[3px]"
              style={{ padding: '3px' }}
              referrerPolicy="no-referrer"
            />
          </div>

          <h3 id="enquiry-modal-title" className="text-xl sm:text-2xl font-black text-white tracking-tight pr-10">
            Quick Enquiry
          </h3>
          <p className="text-xs sm:text-sm text-blue-100 mt-1">
            Have questions about syllabus, batches, or faculty? Send us a message.
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {submitted ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <h4 className="text-lg font-bold text-slate-900 mb-1">
                Enquiry Received!
              </h4>
              <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
                Thank you, <strong>{name}</strong>. Our counselors will call you back at <strong>{phone}</strong> within 15 minutes during operating hours.
              </p>

              <button
                onClick={handleDone}
                className="w-full py-3 px-4 rounded-xl bg-[#0b213f] text-white font-bold text-sm shadow cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Enter your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98765 00000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Interested In
                </label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option>Home Tutors (Class 1 to 5)</option>
                  <option>Class 6 to 8 (Middle School)</option>
                  <option>Class 9 & 10 (Board Exam Focus)</option>
                  <option>Class 11 & 12 (Science / Commerce)</option>
                  <option>JEE Main & Advanced Coaching</option>
                  <option>NEET Medical Exam Prep</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Message / Question (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Tell us about student's current school, subjects needed, or specific doubts..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-[#0b213f] hover:bg-slate-900 text-white font-bold text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-75"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isSubmitting ? 'Submitting...' : 'Submit Enquiry'}</span>
              </button>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Direct Hotline:</span>
                <a
                  href={`tel:${instituteInfo.phoneClean}`}
                  className="font-bold text-blue-700 flex items-center gap-1"
                >
                  <Phone className="w-3.5 h-3.5" />
                  {instituteInfo.phone}
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
