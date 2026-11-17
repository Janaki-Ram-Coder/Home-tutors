import React, { useState } from 'react';
import {
  Users,
  User,
  GraduationCap,
  Calendar,
  Phone,
  MessageSquare,
  MapPin,
  Clock,
  BookOpen,
  School,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Check
} from 'lucide-react';
import {
  AppUserProfile,
  removeUndefinedFields,
  saveUserSessionToStorage,
  syncUserToPersistence
} from '../services/firebaseAuth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { RAYAGADA_LOCALITIES } from '../data/tutorsData';

interface ParentStudentFormProps {
  currentUser: AppUserProfile | null;
  onNavigateHome: () => void;
  onNavigateTutors?: () => void;
  onStudentDetailsSaved: (updatedUser: AppUserProfile) => void;
}

const CLASS_OPTIONS = [
  'LKG / UKG',
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
  '11th Class (Science/Commerce)',
  '12th Class (Science/Commerce)'
];

const BOARD_OPTIONS = [
  'CBSE',
  'ICSE',
  'BSE Odisha (State Board)',
  'CHSE Odisha (+2 State Board)',
  'Other State / Recognized Board'
];

const SUBJECT_OPTIONS = [
  'All Primary Subjects',
  'Mathematics',
  'Science',
  'English',
  'Odia',
  'Hindi',
  'Social Science (SST)',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science / IT'
];

const TIME_SLOT_OPTIONS = [
  '06:00 AM - 07:00 AM',
  '07:00 AM - 08:00 AM',
  '08:00 AM - 09:00 AM',
  '09:00 AM - 10:00 AM',
  '03:00 PM - 04:00 PM',
  '04:00 PM - 05:00 PM',
  '05:00 PM - 06:00 PM',
  '06:00 PM - 07:00 PM',
  '07:00 PM - 08:00 PM',
  '08:00 PM - 09:00 PM'
];

export const ParentStudentForm: React.FC<ParentStudentFormProps> = ({
  currentUser,
  onNavigateHome,
  onStudentDetailsSaved
}) => {
  const isFirstTimeOnboarding = Boolean(currentUser && !currentUser.profileCompleted);
  // Student Information State
  const [studentName, setStudentName] = useState(
    currentUser?.childName || (currentUser as any)?.studentName || ''
  );
  const [studentAge, setStudentAge] = useState(
    (currentUser as any)?.studentAge || (currentUser as any)?.childAge || '9'
  );
  const [childGrade, setChildGrade] = useState(
    currentUser?.childGrade || (currentUser as any)?.class || '4th Class'
  );
  const [board, setBoard] = useState(
    currentUser?.childBoard || currentUser?.board || 'CBSE'
  );
  const [schoolName, setSchoolName] = useState(
    currentUser?.childSchool || ''
  );
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(
    (currentUser as any)?.subjectsNeeded || ['All Primary Subjects', 'Mathematics', 'Science']
  );
  const [preferredTimeSlot, setPreferredTimeSlot] = useState(
    (currentUser as any)?.preferredTimeSlot || (currentUser as any)?.timeSlotNeeded || '05:00 PM - 06:00 PM'
  );

  // Parent Contact State
  const [parentName, setParentName] = useState(
    currentUser?.name || currentUser?.fullName || ''
  );
  const [phone, setPhone] = useState(
    currentUser?.phone || ''
  );
  const [whatsappNumber, setWhatsappNumber] = useState(
    (currentUser as any)?.whatsappNumber || currentUser?.phone || ''
  );
  const [sameAsPhone, setSameAsPhone] = useState(true);

  // Address State
  const [houseNo, setHouseNo] = useState(
    (currentUser as any)?.addressDetails?.houseNo || (currentUser as any)?.addressDetails?.line1 || ''
  );
  const [locality, setLocality] = useState(
    currentUser?.locality || (currentUser as any)?.addressDetails?.street || 'Indira Nagar'
  );
  const [customLocality, setCustomLocality] = useState('');
  const [landmark, setLandmark] = useState(
    (currentUser as any)?.addressDetails?.landmark || ''
  );
  const [city] = useState('Rayagada');
  const [pincode, setPincode] = useState('765001');

  // Additional Notes
  const [notes, setNotes] = useState((currentUser as any)?.notes || '');

  // Form Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const toggleSubject = (sub: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(sub) ? prev.filter((s) => s !== sub) : [...prev, sub]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    // 1. Validation
    if (!studentName.trim()) {
      setFormError('Please enter the Student / Child Name.');
      return;
    }
    if (!studentAge.trim()) {
      setFormError('Please enter Student Age.');
      return;
    }
    if (!childGrade.trim()) {
      setFormError('Please select Student Class / Grade.');
      return;
    }
    if (!board.trim()) {
      setFormError('Please select the Education Board.');
      return;
    }
    if (!schoolName.trim()) {
      setFormError('Please enter the School Name.');
      return;
    }
    if (selectedSubjects.length === 0) {
      setFormError('Please select at least one Subject needed for tuition.');
      return;
    }
    if (!preferredTimeSlot.trim()) {
      setFormError('Please select a Preferred Tuition Time Slot.');
      return;
    }
    if (!parentName.trim()) {
      setFormError("Please enter Parent / Guardian's Full Name.");
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setFormError('Please enter a valid 10-digit Calling Phone Number.');
      return;
    }
    const finalWhatsApp = sameAsPhone ? phone.trim() : whatsappNumber.trim();
    if (!finalWhatsApp || finalWhatsApp.replace(/\D/g, '').length < 10) {
      setFormError('Please enter a valid 10-digit WhatsApp Number.');
      return;
    }
    if (!houseNo.trim()) {
      setFormError('Please enter Door / Flat / House Number.');
      return;
    }
    const effectiveLocality = locality === 'Other Colony / Area' ? customLocality.trim() : locality.trim();
    if (!effectiveLocality) {
      setFormError('Please specify your Colony / Locality in Rayagada.');
      return;
    }
    if (!landmark.trim()) {
      setFormError('Please enter a nearby Landmark.');
      return;
    }

    setIsSubmitting(true);
    try {
      const uid = currentUser?.uid || auth.currentUser?.uid || `parent_${Date.now()}`;
      const email = currentUser?.email || auth.currentUser?.email || 'parent@kumariinstitute.com';
      const compiledAddress = `${houseNo.trim()}, ${effectiveLocality}, Near ${landmark.trim()}, ${city} - ${pincode}`;

      const parentPayload = removeUndefinedFields({
        uid,
        id: uid,
        name: parentName.trim(),
        fullName: parentName.trim(),
        parentName: parentName.trim(),
        email,
        emailVerified: true,
        phone: phone.trim(),
        whatsappNumber: finalWhatsApp,
        role: 'parent' as const,
        childName: studentName.trim(),
        studentName: studentName.trim(),
        studentAge: studentAge.trim(),
        childAge: studentAge.trim(),
        childGrade: childGrade.trim(),
        grade: childGrade.trim(),
        class: childGrade.trim(),
        board: board.trim(),
        childBoard: board.trim(),
        childSchool: schoolName.trim(),
        school: schoolName.trim(),
        subjectsNeeded: selectedSubjects,
        preferredTimeSlot: preferredTimeSlot.trim(),
        timeSlotNeeded: preferredTimeSlot.trim(),
        selectedTimings: [preferredTimeSlot.trim()],
        availableTimings: [preferredTimeSlot.trim()],
        locality: effectiveLocality,
        address: compiledAddress,
        addressDetails: {
          houseNo: houseNo.trim(),
          street: effectiveLocality,
          landmark: landmark.trim(),
          city,
          pincode
        },
        notes: notes.trim(),
        profileCompleted: true,
        learningRequirementsSubmitted: true,
        updatedAt: new Date().toISOString(),
        createdAt: (currentUser as any)?.createdAt || new Date().toISOString()
      });

      // 1. Save to Cloud Firestore 'parents' collection
      try {
        await setDoc(doc(db, 'parents', uid), parentPayload, { merge: true });
      } catch (fsErr) {
        console.warn('Firestore parents save notice:', fsErr);
      }

      // 2. Sync to Server persistent storage
      try {
        await fetch('/api/parents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parentPayload)
        });
      } catch (srvErr) {
        console.warn('Server parents sync notice:', srvErr);
      }

      // 3. Update session
      const updatedProfile: AppUserProfile = {
        ...(currentUser || {
          uid,
          email,
          role: 'parent' as const
        }),
        ...parentPayload
      };

      saveUserSessionToStorage(updatedProfile);
      await syncUserToPersistence(updatedProfile);

      setFormSuccess('Student requirements saved successfully! Redirecting to your Profile...');

      setTimeout(() => {
        onStudentDetailsSaved(updatedProfile);
      }, 900);
    } catch (err: any) {
      console.error('Error saving parent student requirements:', err);
      setFormError(err?.message || 'Failed to save student details. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-20 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Top Breadcrumb Bar */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          {!isFirstTimeOnboarding ? (
            <button
              type="button"
              onClick={onNavigateHome}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-[#1d4ed8] transition-colors cursor-pointer group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span>Back to Home</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span>Step 1 of 1 — Complete Student Details to Continue</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Parent Portal</span>
            <span>/</span>
            <span className="text-[#1d4ed8] font-bold">Student Requirements</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10">
        {/* Header Hero Banner */}
        <div className="bg-gradient-to-r from-[#03132B] via-[#0c2340] to-[#1d4ed8] rounded-3xl p-6 sm:p-8 text-white shadow-xl mb-8 relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-blue-500/10 rounded-l-full blur-2xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shrink-0 border border-white/20 shadow-inner">
              <Users className="w-7 h-7 text-amber-400" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold mb-2">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Required for Home Tutor Allocation</span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight">
                Student Details &amp; Learning Requirements
              </h1>
              <p className="text-xs sm:text-sm text-blue-100/90 mt-1 max-w-xl">
                Please complete your child's academic details, preferred timing, and Rayagada address so our academic coordinator can match the most qualified home educator.
              </p>
            </div>
          </div>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-6 sm:p-8 space-y-8">
          {formError && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm font-medium flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <span className="flex-1">{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm font-medium flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <span className="flex-1">{formSuccess}</span>
            </div>
          )}

          {/* SECTION 1: STUDENT ACADEMIC DETAILS */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <GraduationCap className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-black text-slate-900">
                1. Student Academic Details
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Student Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    placeholder="e.g. Aarav Sharma"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Student Age (Years) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="number"
                    min="3"
                    max="22"
                    required
                    value={studentAge}
                    onChange={(e) => setStudentAge(e.target.value)}
                    placeholder="e.g. 9"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Class / Grade <span className="text-red-500">*</span>
                </label>
                <select
                  value={childGrade}
                  onChange={(e) => setChildGrade(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {CLASS_OPTIONS.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Education Board <span className="text-red-500">*</span>
                </label>
                <select
                  value={board}
                  onChange={(e) => setBoard(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {BOARD_OPTIONS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  School Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <School className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    placeholder="e.g. Kendriya Vidyalaya / Sacred Heart School Rayagada"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Subjects Needed */}
            <div className="pt-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                Subjects Needed for Home Tuition <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {SUBJECT_OPTIONS.map((sub) => {
                  const isSelected = selectedSubjects.includes(sub);
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => toggleSubject(sub)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {isSelected ? <Check className="w-3.5 h-3.5" /> : null}
                      <span>{sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 2: PREFERRED TIME SLOT */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Clock className="w-5 h-5 text-indigo-600" />
              <h2 className="text-base font-black text-slate-900">
                2. Preferred Tuition Time Slot
              </h2>
            </div>

            <p className="text-xs text-slate-500">
              Select the convenient 1-hour slot when the student is at home and ready for tutoring:
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {TIME_SLOT_OPTIONS.map((slot) => {
                const isSelected = preferredTimeSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setPreferredTimeSlot(slot)}
                    className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center cursor-pointer ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-500/20'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 3: PARENT & CONTACT DETAILS */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Phone className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-black text-slate-900">
                3. Parent &amp; Contact Information
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Parent / Guardian Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    value={parentName}
                    onChange={(e) => setParentName(e.target.value)}
                    placeholder="e.g. Srikant Sharma"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Calling Phone Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    WhatsApp Number <span className="text-red-500">*</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={sameAsPhone}
                      onChange={(e) => {
                        setSameAsPhone(e.target.checked);
                        if (e.target.checked) setWhatsappNumber(phone);
                      }}
                      className="w-3.5 h-3.5 text-blue-600 rounded"
                    />
                    <span>Same as Phone</span>
                  </label>
                </div>
                <div className="relative">
                  <MessageSquare className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="tel"
                    required
                    disabled={sameAsPhone}
                    value={sameAsPhone ? phone : whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="10-digit WhatsApp number"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: RESIDENTIAL ADDRESS IN RAYAGADA */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <MapPin className="w-5 h-5 text-rose-600" />
              <h2 className="text-base font-black text-slate-900">
                4. Residential Address in Rayagada
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Door No / Flat / House No <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={houseNo}
                  onChange={(e) => setHouseNo(e.target.value)}
                  placeholder="e.g. Plot No 142 / Flat 3B"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Colony / Locality <span className="text-red-500">*</span>
                </label>
                <select
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  {RAYAGADA_LOCALITIES.map((loc) => (
                    <option key={loc.name} value={loc.name}>
                      {loc.name}
                    </option>
                  ))}
                  <option value="Other Colony / Area">Other Colony / Area</option>
                </select>
                {locality === 'Other Colony / Area' && (
                  <input
                    type="text"
                    required
                    value={customLocality}
                    onChange={(e) => setCustomLocality(e.target.value)}
                    placeholder="Enter locality / area name in Rayagada"
                    className="w-full mt-2 px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Landmark <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Near Jagannath Temple / LIC Office"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    City
                  </label>
                  <input
                    type="text"
                    disabled
                    value={city}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-slate-50 text-slate-600 font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Additional Notes */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Special Learning Focus / Expectations (Optional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Needs extra focus on Math word problems, preparing for Olympiad / Navodaya entrance, etc."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-medium"
            />
          </div>

          {/* Submit Action */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#0c2340] via-[#122e54] to-[#1d4ed8] hover:from-slate-900 hover:to-blue-900 text-white font-black text-sm sm:text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-[0.99] disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                  <span>Saving &amp; Sending to Parents Directory...</span>
                </>
              ) : (
                <>
                  <span>Submit Student Details &amp; Go to Profile</span>
                  <ArrowRight className="w-5 h-5 shrink-0" />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Directly transmitted to Kumari Institute Parents Directory &amp; Coordinator</span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
