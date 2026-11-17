import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  Home,
  ShieldCheck,
  MapPin,
  LogIn,
  UserPlus,
  AlertCircle,
  Pencil,
  Check,
  GraduationCap,
  BookOpen,
  User,
  Phone,
  Plus,
} from 'lucide-react';
import {
  Tutor,
  CLASS_1_TO_10_KEYS,
  SENIOR_SUBJECTS_LIST,
} from '../data/tutorsData';
import {
  submitHomeTutorBooking,
  subscribeToTutorBookedSlots,
  AppUserProfile,
} from '../services/firebaseAuth';

interface BookHomeTutorModalProps {
  isOpen: boolean;
  tutor: Tutor | null;
  currentUser?: AppUserProfile | null;
  onClose: () => void;
  onBookingSuccess?: (bookingId: string) => void;
  onNavigateAuth?: (mode: 'login' | 'register', role?: 'parent' | 'teacher') => void;
}

const ALL_CLASSES_1_TO_12 = [
  '1st Class',
  '2nd Class',
  '3rd Class',
  '4th Class',
  '5th Class',
  '6th Class',
  '7th Class',
  '8th Class',
  '9th Class',
  '10th Class',
  '11th Class',
  '12th Class',
] as const;

function normalizeClassGrade(raw?: string | null, fallback?: string): string {
  const source = (raw || fallback || '4th Class').trim();
  const match = source.match(/(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 12) {
      const suffix =
        num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th';
      return `${num}${suffix} Class`;
    }
  }
  return '4th Class';
}

function normalizeBoard(raw?: string | null, gradeFallback?: string | null): 'CBSE' | 'ICSE' {
  const combined = `${raw || ''} ${gradeFallback || ''}`.toUpperCase();
  if (combined.includes('ICSE') || combined.includes('ISC')) {
    return 'ICSE';
  }
  return 'CBSE';
}

function getOrdinalKeyFromGrade(grade: string): (typeof CLASS_1_TO_10_KEYS)[number] | null {
  const m = grade.match(/(\d+)/);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  if (num < 1 || num > 10) return null;
  const suffix = num === 1 ? 'st' : num === 2 ? 'nd' : num === 3 ? 'rd' : 'th';
  return `${num}${suffix}` as (typeof CLASS_1_TO_10_KEYS)[number];
}

function getSeniorKeyFromGrade(grade: string): '11th' | '12th' | null {
  const m = grade.match(/(\d+)/);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  if (num === 11) return '11th';
  if (num === 12) return '12th';
  return null;
}

export const BookHomeTutorModal: React.FC<BookHomeTutorModalProps> = ({
  isOpen,
  tutor,
  currentUser,
  onClose,
  onBookingSuccess,
  onNavigateAuth,
}) => {
  const [studentName, setStudentName] = useState('');
  const [studentGrade, setStudentGrade] = useState('4th Class');
  const [studentBoard, setStudentBoard] = useState<'CBSE' | 'ICSE'>('CBSE');
  const [studentSchool, setStudentSchool] = useState('');
  const [parentName, setParentName] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [address, setAddress] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [customSubjectInput, setCustomSubjectInput] = useState('');
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [bookedSlots, setBookedSlots] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  // Real-time listener for tutor's booked time slots from Firestore
  useEffect(() => {
    if (!tutor?.id) return;
    const unsub = subscribeToTutorBookedSlots(tutor.id, (slots) => {
      setBookedSlots(slots);
    });
    return () => unsub();
  }, [tutor?.id]);

  // Synchronize saved parent & student details from logged-in parent profile when modal opens
  useEffect(() => {
    if (!tutor || !isOpen) return;

    const savedChildName =
      currentUser?.childName || (currentUser as any)?.studentName || '';
    const savedGradeRaw =
      currentUser?.childGrade ||
      (currentUser as any)?.grade ||
      (currentUser as any)?.class ||
      '';
    const normalizedGrade = normalizeClassGrade(
      savedGradeRaw,
      tutor.classesHandled?.[0]
    );
    const savedBoard = normalizeBoard(
      currentUser?.childBoard || currentUser?.board,
      savedGradeRaw
    );
    const savedSchool =
      currentUser?.childSchool || (currentUser as any)?.school || '';
    const savedParentName =
      currentUser?.name || currentUser?.fullName || '';
    const savedPhone = currentUser?.phone || '';
    const savedEmail = currentUser?.email || '';
    const savedAddress =
      currentUser?.address ||
      currentUser?.locality ||
      tutor.locationArea ||
      'Rayagada';

    setStudentName(savedChildName);
    setStudentGrade(normalizedGrade);
    setStudentBoard(savedBoard);
    setStudentSchool(savedSchool);
    setParentName(savedParentName);
    setParentPhone(savedPhone);
    setParentEmail(savedEmail);
    setAddress(savedAddress);
    setCustomSubjectInput('');
    setFormError(null);
    setBookingSuccessId(null);

    // Show saved details read-only by default; auto-expand edit only if mandatory info is missing
    const hasEssentialDetails = Boolean(
      savedChildName.trim() && savedPhone.trim() && savedAddress.trim()
    );
    setIsEditingDetails(!hasEssentialDetails);

    const seniorKey = getSeniorKeyFromGrade(normalizedGrade);
    if (seniorKey) {
      // For 11th & 12th, prompt parent to choose/enter subjects to view exact tutor fee
      setSelectedSubjects([]);
    } else {
      const parentNeeded = Array.isArray((currentUser as any)?.subjectsNeeded)
        ? ((currentUser as any).subjectsNeeded as string[]).filter(
            (s) => !s.toLowerCase().includes('all primary')
          )
        : [];
      if (parentNeeded.length > 0) {
        setSelectedSubjects(parentNeeded.slice(0, 3));
      } else if (tutor.subjects && tutor.subjects.length > 0) {
        setSelectedSubjects([tutor.subjects[0]]);
      } else {
        setSelectedSubjects(['Mathematics']);
      }
    }
  }, [tutor?.id, isOpen, currentUser?.uid]);

  const allSlots = useMemo(() => {
    if (!tutor) return [];
    return tutor.availableTimeSlots && tutor.availableTimeSlots.length > 0
      ? tutor.availableTimeSlots
      : [
          '4:00 PM - 5:00 PM',
          '5:00 PM - 6:00 PM',
          '6:00 PM - 7:00 PM',
          '7:00 PM - 8:00 PM',
        ];
  }, [tutor?.availableTimeSlots]);

  const openSlots = useMemo(() => {
    const bookedSet = new Set(bookedSlots.map((s) => s.trim().toLowerCase()));
    const unreserved = allSlots.filter(
      (slot) => !bookedSet.has(slot.trim().toLowerCase())
    );
    if (unreserved.length > 0) return unreserved;

    const flexibleSlots = [
      'Flexible Morning (7:00 AM - 9:00 AM)',
      'Flexible Afternoon (3:00 PM - 5:00 PM)',
      'Flexible Evening (7:30 PM - 8:30 PM)',
      'Custom Timing (Tutor Coordination)',
    ];
    const availableFlexible = flexibleSlots.filter(
      (slot) => !bookedSet.has(slot.trim().toLowerCase())
    );
    return availableFlexible.length > 0
      ? availableFlexible
      : ['Custom Timing (Tutor Coordination)'];
  }, [allSlots, bookedSlots]);

  const [preferredSlot, setPreferredSlot] = useState(
    openSlots[0] || allSlots[0] || '5:00 PM - 6:00 PM'
  );

  useEffect(() => {
    if (openSlots.length > 0) {
      if (
        !preferredSlot ||
        !openSlots.some(
          (s) => s.trim().toLowerCase() === preferredSlot.trim().toLowerCase()
        )
      ) {
        setPreferredSlot(openSlots[0]);
      }
    } else {
      setPreferredSlot('');
    }
  }, [openSlots, preferredSlot]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccessId, setBookingSuccessId] = useState<string | null>(null);

  const seniorKey = useMemo(
    () => getSeniorKeyFromGrade(studentGrade),
    [studentGrade]
  );
  const ordinal1to10Key = useMemo(
    () => getOrdinalKeyFromGrade(studentGrade),
    [studentGrade]
  );
  const isSeniorClass = Boolean(seniorKey);

  // Build available subjects for selection
  const availableSubjectOptions = useMemo(() => {
    if (!tutor) return [];
    if (seniorKey) {
      const configuredMap = tutor.feeStructure?.classes11to12?.[seniorKey] || {};
      const configuredNames = Object.keys(configuredMap).filter((k) => {
        const entry = configuredMap[k];
        return (entry?.cbse && entry.cbse > 0) || (entry?.icse && entry.icse > 0);
      });
      const merged = Array.from(
        new Set([
          ...configuredNames,
          ...(tutor.subjects || []),
          ...SENIOR_SUBJECTS_LIST,
        ])
      );
      return merged;
    }
    return tutor.subjects && tutor.subjects.length > 0
      ? tutor.subjects
      : ['Mathematics', 'Science', 'English'];
  }, [tutor, seniorKey]);

  // Exact fee calculation from tutor's saved feeStructure based on Class + Board (+ Subjects for 11th/12th)
  const feeComputation = useMemo(() => {
    const boardKey = studentBoard === 'ICSE' ? 'icse' : 'cbse';
    const fs = tutor?.feeStructure;

    if (seniorKey) {
      const subMap = fs?.classes11to12?.[seniorKey] || {};
      const mapEntries = Object.entries(subMap) as [
        string,
        { cbse?: number; icse?: number },
      ][];

      const items = selectedSubjects.map((sub) => {
        const normSub = sub.toLowerCase().trim();
        const exactMatch = mapEntries.find(
          ([k]) => k.toLowerCase().trim() === normSub
        );
        const partialMatch =
          exactMatch ||
          mapEntries.find(
            ([k]) =>
              k.toLowerCase().includes(normSub) ||
              normSub.includes(k.toLowerCase())
          );
        const entry = partialMatch ? partialMatch[1] : undefined;
        const amount =
          entry && typeof entry[boardKey] === 'number' && entry[boardKey]! > 0
            ? Number(entry[boardKey])
            : 0;
        return { subject: sub, amount };
      });

      const totalFee = items.reduce((sum, item) => sum + item.amount, 0);
      return {
        isSenior: true,
        classLabel: `${seniorKey} Class`,
        boardLabel: studentBoard,
        items,
        exactFee: totalFee,
        hasConfiguredFee: items.some((it) => it.amount > 0),
      };
    }

    if (ordinal1to10Key) {
      const row = fs?.classes1to10?.[ordinal1to10Key];
      const exactBoardFee =
        row && typeof row[boardKey] === 'number' && row[boardKey]! > 0
          ? Number(row[boardKey])
          : 0;
      const otherBoardKey = boardKey === 'cbse' ? 'icse' : 'cbse';
      const otherBoardFee =
        row && typeof row[otherBoardKey] === 'number' && row[otherBoardKey]! > 0
          ? Number(row[otherBoardKey])
          : 0;

      // Fallback to tutor's flat monthlyFee only if tutor has no structured feeSchedule entries at all
      const hasAny1to10 = Boolean(
        fs?.classes1to10 &&
          Object.values(fs.classes1to10).some(
            (r: any) => (r?.cbse && r.cbse > 0) || (r?.icse && r.icse > 0)
          )
      );
      const fallbackFee =
        exactBoardFee > 0
          ? exactBoardFee
          : !hasAny1to10 && tutor?.monthlyFee && tutor.monthlyFee > 0
          ? Number(tutor.monthlyFee)
          : 0;

      return {
        isSenior: false,
        classLabel: `${ordinal1to10Key} Class`,
        boardLabel: studentBoard,
        items: [] as { subject: string; amount: number }[],
        exactFee: fallbackFee,
        otherBoardFee: exactBoardFee === 0 ? otherBoardFee : 0,
        otherBoardName: otherBoardKey.toUpperCase(),
        hasConfiguredFee: fallbackFee > 0,
      };
    }

    return {
      isSenior: false,
      classLabel: studentGrade,
      boardLabel: studentBoard,
      items: [] as { subject: string; amount: number }[],
      exactFee: 0,
      hasConfiguredFee: false,
    };
  }, [tutor, seniorKey, ordinal1to10Key, studentBoard, studentGrade, selectedSubjects]);

  const tutorPhoto =
    tutor?.avatar || (tutor as any)?.photoUrl || (tutor as any)?.image || '';
  const tutorQualText =
    tutor?.highestQualification || tutor?.qualification || 'Verified Tutor';

  const toggleSubject = (sub: string) => {
    setFormError(null);
    setSelectedSubjects((prev) => {
      if (prev.includes(sub)) {
        if (!isSeniorClass && prev.length <= 1) return prev;
        return prev.filter((s) => s !== sub);
      }
      return [...prev, sub];
    });
  };

  const handleAddCustomSubject = () => {
    const trimmed = customSubjectInput.trim();
    if (!trimmed) return;
    setFormError(null);
    setSelectedSubjects((prev) =>
      prev.some((s) => s.toLowerCase() === trimmed.toLowerCase())
        ? prev
        : [...prev, trimmed]
    );
    setCustomSubjectInput('');
  };

  const handleGradeChange = (newGrade: string) => {
    const wasSenior = Boolean(getSeniorKeyFromGrade(studentGrade));
    const willBeSenior = Boolean(getSeniorKeyFromGrade(newGrade));
    setStudentGrade(newGrade);
    setFormError(null);

    if (!wasSenior && willBeSenior) {
      setSelectedSubjects([]);
    } else if (wasSenior && !willBeSenior && selectedSubjects.length === 0) {
      setSelectedSubjects(
        tutor?.subjects && tutor.subjects.length > 0
          ? [tutor.subjects[0]]
          : ['Mathematics']
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutor) return;
    setFormError(null);

    if (!studentName.trim() || !parentPhone.trim() || !address.trim()) {
      setIsEditingDetails(true);
      setFormError('Please ensure Student Name, Phone Number, and Home Address are filled.');
      return;
    }

    if (parentPhone.replace(/\D/g, '').length < 10) {
      setIsEditingDetails(true);
      setFormError('Please enter a valid 10-digit Phone / WhatsApp number.');
      return;
    }

    if (isSeniorClass && selectedSubjects.length === 0) {
      setFormError(
        `Please select or enter at least one subject for ${seniorKey} Class to confirm the fee.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitHomeTutorBooking({
        parentUid: currentUser?.uid,
        parentName: parentName.trim() || 'Parent',
        parentPhone: parentPhone.trim(),
        parentEmail: parentEmail.trim(),
        studentName: studentName.trim(),
        studentGrade: `${studentGrade} (${studentBoard})`,
        subjects:
          selectedSubjects.length > 0
            ? selectedSubjects
            : tutor.subjects?.length
            ? tutor.subjects
            : ['All Subjects'],
        address: address.trim(),
        locality: tutor.locationArea || currentUser?.locality || 'Rayagada',
        preferredTimeSlot: preferredSlot,
        requestedTutorId: tutor.id,
        requestedTutorName: tutor.name,
        requestedTutorMonthlyFee: feeComputation.exactFee,
        requestedTutorAvatar: tutorPhoto,
      });

      setBookingSuccessId(res.bookingId);
      if (onBookingSuccess) onBookingSuccess(res.bookingId);
    } catch (err: any) {
      console.warn('Booking submit notice:', err);
      setFormError(err?.message || 'Unable to submit booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setBookingSuccessId(null);
    setFormError(null);
    onClose();
  };

  if (!isOpen || !tutor) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-tutor-modal-title"
      className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && handleResetAndClose()}
    >
      <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden relative max-h-[92vh] flex flex-col text-slate-800">
        {/* Sticky Modal Header */}
        <div className="bg-gradient-to-r from-[#0c2340] via-[#132e54] to-[#1e3a8a] text-white px-5 py-4 sm:p-5 relative shrink-0">
          <button
            type="button"
            onClick={handleResetAndClose}
            className="absolute top-3.5 right-3.5 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer ring-1 ring-white/20"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5 text-amber-300 text-[11px] font-bold uppercase tracking-wider mb-0.5">
            <Home className="w-3.5 h-3.5" />
            <span>1-on-1 Home Tuition</span>
          </div>
          <h3
            id="book-tutor-modal-title"
            className="text-lg sm:text-xl font-black tracking-tight text-white pr-10"
          >
            Book Home Tutor
          </h3>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {bookingSuccessId ? (
            /* Success View */
            <div className="p-5 sm:p-7 text-center space-y-4 animate-in zoom-in-95">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <span className="px-3 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Booking Request Sent to Admin
                </span>
                <h4 className="text-lg font-extrabold text-slate-900 pt-1">
                  Booking Confirmed!
                </h4>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                  Your request to book{' '}
                  <span className="font-bold text-slate-800">{tutor.name}</span> for{' '}
                  <span className="font-bold text-slate-800">{studentName}</span> (
                  {studentGrade} · {studentBoard}) has been sent to Kumari Institute admin.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left text-xs space-y-2 max-w-md mx-auto">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Booking ID:</span>
                  <span className="font-mono font-bold text-slate-800">
                    {bookingSuccessId}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Tutor:</span>
                  <span className="font-semibold text-slate-800">{tutor.name}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500">Class &amp; Board:</span>
                  <span className="font-semibold text-slate-800">
                    {studentGrade} ({studentBoard})
                  </span>
                </div>
                {selectedSubjects.length > 0 && (
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 shrink-0">Subjects:</span>
                    <span className="font-semibold text-slate-800 text-right">
                      {selectedSubjects.join(', ')}
                    </span>
                  </div>
                )}
                {feeComputation.exactFee > 0 && (
                  <div className="flex justify-between items-baseline pt-1 border-t border-slate-200">
                    <span className="text-slate-600 font-bold">Monthly Fee:</span>
                    <span className="font-black text-emerald-700 text-sm tabular-nums">
                      ₹{feeComputation.exactFee.toLocaleString('en-IN')}/month
                    </span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={handleResetAndClose}
                className="w-full max-w-md py-3 rounded-xl bg-[#0b213f] hover:bg-slate-900 text-white font-bold text-sm transition-colors cursor-pointer shadow-md"
              >
                Done &amp; Return
              </button>
            </div>
          ) : !currentUser ? (
            /* Parent Authentication Gate View */
            <div className="p-5 sm:p-7 space-y-5 text-center">
              {/* Tutor Snapshot Card — NO fee shown alongside qualification */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3 text-left">
                <div className="relative w-13 h-13 rounded-2xl overflow-hidden border-2 border-white bg-gradient-to-br from-blue-700 to-indigo-800 flex items-center justify-center shrink-0 shadow-xs text-white font-bold text-lg select-none">
                  <span className="absolute inset-0 flex items-center justify-center">
                    {tutor.name?.charAt(0).toUpperCase() || 'T'}
                  </span>
                  {tutorPhoto && (
                    <img
                      src={tutorPhoto}
                      alt={tutor.name}
                      className="relative z-10 w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-sm text-slate-900 truncate">
                    {tutor.name}
                  </h4>
                  <p className="text-xs text-slate-600 font-medium truncate">
                    {tutorQualText}
                  </p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
                    <span className="truncate">{tutor.locationArea || 'Rayagada'}</span>
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-left space-y-1.5">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                  <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>Parent Account Required</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  Please log in or register as a parent to book a verified home tutor.
                  Your saved student details will automatically appear here.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    handleResetAndClose();
                    if (onNavigateAuth) onNavigateAuth('login', 'parent');
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-[#0b213f] hover:bg-slate-900 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md"
                >
                  <LogIn className="w-4 h-4 text-amber-400" />
                  <span>Existing Parent: Log In</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleResetAndClose();
                    if (onNavigateAuth) onNavigateAuth('register', 'parent');
                  }}
                  className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-md"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>New Parent: Register First</span>
                </button>
              </div>
            </div>
          ) : (
            /* Booking Form */
            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 text-left">
              {/* 1. Tutor Snapshot Card — Clean, NO fees shown with qualification */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/90 flex items-center gap-3">
                <div className="relative w-12 h-12 rounded-2xl overflow-hidden border-2 border-white bg-gradient-to-br from-blue-700 to-indigo-800 flex items-center justify-center shrink-0 shadow-xs text-white font-bold text-base select-none">
                  <span className="absolute inset-0 flex items-center justify-center">
                    {tutor.name?.charAt(0).toUpperCase() || 'T'}
                  </span>
                  {tutorPhoto && (
                    <img
                      src={tutorPhoto}
                      alt={tutor.name}
                      className="relative z-10 w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = 'none';
                      }}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className="font-extrabold text-sm text-slate-900 truncate">
                      {tutor.name}
                    </h4>
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[9.5px] font-bold shrink-0">
                      Verified
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium truncate">
                    {tutorQualText}
                  </p>
                  <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-blue-600 shrink-0" />
                    <span className="truncate">{tutor.locationArea || 'Rayagada'}</span>
                  </p>
                </div>
              </div>

              {/* 2. Saved Student & Parent Details Card (Pre-filled from Parent Account + Change Option) */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                <div className="px-3.5 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <GraduationCap className="w-4 h-4 text-[#1d4ed8] shrink-0" />
                    <span className="text-xs font-extrabold text-slate-900 truncate">
                      Student &amp; Contact Details
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditingDetails((prev) => !prev)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-[#1d4ed8] text-[11px] font-bold transition-colors cursor-pointer shrink-0"
                  >
                    {isEditingDetails ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Done</span>
                      </>
                    ) : (
                      <>
                        <Pencil className="w-3 h-3" />
                        <span>Change Details</span>
                      </>
                    )}
                  </button>
                </div>

                {!isEditingDetails ? (
                  <div className="p-3.5 space-y-2.5 text-xs">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="p-2.5 rounded-xl bg-slate-50/80 border border-slate-100">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Student Name
                        </div>
                        <div className="font-bold text-slate-900 mt-0.5 truncate">
                          {studentName || 'Not set'}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-blue-50/60 border border-blue-100">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                          Class &amp; Board
                        </div>
                        <div className="font-extrabold text-[#0c2340] mt-0.5 truncate">
                          {studentGrade} · {studentBoard}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 text-slate-700">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          <strong className="text-slate-900">Parent:</strong>{' '}
                          {parentName || 'Parent'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-slate-700">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono font-semibold text-slate-900 truncate">
                          {parentPhone || 'Not set'}
                        </span>
                      </div>
                    </div>

                    {studentSchool && (
                      <div className="flex items-center gap-2 text-slate-700">
                        <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          <strong className="text-slate-900">School:</strong> {studentSchool}
                        </span>
                      </div>
                    )}

                    <div className="flex items-start gap-2 text-slate-700 pt-1 border-t border-slate-100">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="leading-snug text-[11.5px]">{address}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 space-y-3 bg-white">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Student&apos;s Full Name *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Aarav Sharma"
                          value={studentName}
                          onChange={(e) => setStudentName(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Class *
                          </label>
                          <select
                            value={studentGrade}
                            onChange={(e) => handleGradeChange(e.target.value)}
                            className="w-full h-10 px-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 cursor-pointer"
                          >
                            {ALL_CLASSES_1_TO_12.map((cls) => (
                              <option key={cls} value={cls}>
                                {cls}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Board *
                          </label>
                          <select
                            value={studentBoard}
                            onChange={(e) =>
                              setStudentBoard(
                                e.target.value === 'ICSE' ? 'ICSE' : 'CBSE'
                              )
                            }
                            className="w-full h-10 px-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 cursor-pointer"
                          >
                            <option value="CBSE">CBSE</option>
                            <option value="ICSE">ICSE</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Parent / Guardian Name
                        </label>
                        <input
                          type="text"
                          placeholder="Parent Full Name"
                          value={parentName}
                          onChange={(e) => setParentName(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Phone / WhatsApp Number *
                        </label>
                        <input
                          type="tel"
                          required
                          placeholder="+91 94398 51521"
                          value={parentPhone}
                          onChange={(e) => setParentPhone(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          School Name (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Chinmaya Vidyalaya"
                          value={studentSchool}
                          onChange={(e) => setStudentSchool(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Home Address &amp; Landmark *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Colony, Landmark, Rayagada"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. Subject Selection — Dedicated Prompt for 11th & 12th to Calculate Exact Tutor Fee */}
              {isSeniorClass ? (
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-3.5 space-y-2.5">
                  <div>
                    <label className="block text-xs font-extrabold text-indigo-950">
                      Select / Enter Subjects for {seniorKey} Class *
                    </label>
                    <p className="text-[11px] text-indigo-700 mt-0.5">
                      Choose your subjects to see the exact monthly fee charged by {tutor.name} ({studentBoard}).
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {availableSubjectOptions.map((sub) => {
                      const isSelected = selectedSubjects.includes(sub);
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => toggleSubject(sub)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#1d4ed8] text-white border-[#1d4ed8] shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {sub}
                        </button>
                      );
                    })}
                  </div>

                  {/* Allow entering any other custom subject */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={customSubjectInput}
                      onChange={(e) => setCustomSubjectInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomSubject();
                        }
                      }}
                      placeholder="Or type another subject (e.g. Accountancy)"
                      className="flex-1 h-9 px-3 rounded-xl border border-indigo-200 bg-white text-xs text-slate-800 focus:outline-none focus:border-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomSubject}
                      className="h-9 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Subjects Focus
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableSubjectOptions.map((sub) => {
                      const isSelected = selectedSubjects.includes(sub);
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => toggleSubject(sub)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {isSelected ? '✓ ' : ''}
                          {sub}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Preferred Daily Time Slot */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Preferred Daily Time Slot *
                  </label>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{openSlots.length} open</span>
                  </span>
                </div>

                <select
                  value={preferredSlot}
                  onChange={(e) => setPreferredSlot(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-600 cursor-pointer"
                  required
                >
                  {openSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>

              {/* 5. BOTTOM: Dynamic Monthly Tuition Fee Charged by Tutor for Class + Board (+ Subjects for 11th/12th) */}
              <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-[#eff6ff] via-white to-[#f8fafc] p-3.5 sm:p-4 space-y-2.5 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-[#1d4ed8] text-white flex items-center justify-center font-black text-sm shrink-0">
                      ₹
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-[#0c2340] leading-tight">
                        Monthly Fee Charged by Tutor
                      </div>
                      <div className="text-[11px] font-semibold text-blue-700 truncate">
                        {feeComputation.classLabel} · {feeComputation.boardLabel} Board
                      </div>
                    </div>
                  </div>

                  {!feeComputation.isSenior && (
                    <div className="text-right shrink-0">
                      {feeComputation.exactFee > 0 ? (
                        <div className="text-lg sm:text-xl font-black font-mono tabular-nums text-[#0c2340]">
                          ₹{feeComputation.exactFee.toLocaleString('en-IN')}
                          <span className="text-[11px] font-sans font-semibold text-slate-500">
                            /mo
                          </span>
                        </div>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[10.5px] font-bold">
                          Confirm via Admin
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {feeComputation.isSenior ? (
                  selectedSubjects.length === 0 ? (
                    <p className="text-[11.5px] text-slate-600 bg-white/80 rounded-xl px-3 py-2 border border-blue-100 font-medium">
                      Select or enter subject(s) above for {feeComputation.classLabel} to view the exact monthly fee set by {tutor.name}.
                    </p>
                  ) : (
                    <div className="space-y-1.5 pt-1 border-t border-blue-100">
                      {feeComputation.items.map((item) => (
                        <div
                          key={item.subject}
                          className="flex items-center justify-between text-xs bg-white/90 px-3 py-1.5 rounded-xl border border-slate-100"
                        >
                          <span className="font-semibold text-slate-800 truncate pr-2">
                            {item.subject} ({feeComputation.boardLabel})
                          </span>
                          <span className="font-mono font-bold tabular-nums text-slate-900 shrink-0">
                            {item.amount > 0
                              ? `₹${item.amount.toLocaleString('en-IN')}/mo`
                              : 'Admin will confirm'}
                          </span>
                        </div>
                      ))}

                      {feeComputation.exactFee > 0 && (
                        <div className="flex items-center justify-between pt-1.5 px-1">
                          <span className="text-xs font-extrabold text-[#0c2340]">
                            Total Monthly Tuition Fee
                          </span>
                          <span className="text-lg font-black font-mono tabular-nums text-[#1d4ed8]">
                            ₹{feeComputation.exactFee.toLocaleString('en-IN')}/mo
                          </span>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  feeComputation.exactFee === 0 && (
                    <p className="text-[11px] text-amber-800 bg-amber-50/80 rounded-xl px-3 py-2 border border-amber-200 font-medium">
                      {feeComputation.otherBoardFee && feeComputation.otherBoardFee > 0
                        ? `Tutor has listed ₹${feeComputation.otherBoardFee.toLocaleString('en-IN')}/mo for ${feeComputation.otherBoardName}. Admin will confirm ${feeComputation.boardLabel} fee before start.`
                        : `Fee for ${feeComputation.classLabel} (${feeComputation.boardLabel}) will be confirmed by Kumari Institute admin before classes begin.`}
                    </p>
                  )
                )}
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Notice regarding Admin Assignment */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  Your booking request goes to Kumari Institute Admin for verification and confirmation.
                </span>
              </div>

              {/* Mobile-Friendly Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="h-11 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs sm:text-sm font-bold text-slate-600 cursor-pointer transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting || openSlots.length === 0}
                  className="h-11 rounded-xl bg-[#0b213f] hover:bg-[#1d4ed8] text-white font-bold text-xs sm:text-sm transition-all shadow-md active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting
                    ? 'Sending...'
                    : openSlots.length === 0
                    ? 'Fully Booked'
                    : 'Confirm Booking'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
