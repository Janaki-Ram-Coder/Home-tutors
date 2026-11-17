import React, { useState, useEffect, useRef } from 'react';
import {
  User,
  GraduationCap,
  Briefcase,
  FileText,
  CheckCircle2,
  Calendar,
  Phone,
  MapPin,
  UploadCloud,
  Building,
  Percent,
  X,
  AlertCircle,
  Clock,
  Loader2,
  Compass,
  Navigation,
  Check,
  ArrowRight,
  ArrowLeft,
  DollarSign,
  ShieldCheck,
  XCircle,
  BookOpen
} from 'lucide-react';
import {
  AppUserProfile,
  updateTeacherProfileInFirestore,
  saveUserSessionToStorage,
  syncUserToPersistence,
  isTeacherApprovedInRegistry,
  markTeacherApprovedInRegistry
} from '../services/firebaseAuth';
import { registerTeacherLocation, getLiveUserLocation } from '../services/tutorApi';
import { auth } from '../lib/firebase';
import {
  INDIAN_STATES_A_TO_Z,
  INDIAN_BOARDS_A_TO_Z,
  INDIAN_UNIVERSITIES_A_TO_Z,
  INDIAN_COURSES_A_TO_Z
} from '../data/educationData';
import { uploadImageToImgBB } from '../services/imgbbService';
import { compressImageToBase64 } from '../utils/imageUtils';
import {
  TutorFeeStructure,
  TUTOR_SUBJECT_OPTIONS,
  TUTOR_CLASS_OPTIONS,
  CLASS_1_TO_10_KEYS,
  SENIOR_CLASSES_KEYS,
  SENIOR_SUBJECTS_LIST,
  mergeFeeStructure,
  sanitizeFeeStructure,
  summarizeFeeStructure
} from '../data/tutorsData';
import {
  calculateFeeSplit,
  PLATFORM_FEE_PERCENT,
  TUTOR_SHARE_PERCENT
} from '../services/payoutService';

interface TeacherCompleteProfilePageProps {
  currentUser?: AppUserProfile | null;
  onBackToDashboard: () => void;
  onNavigateHome: () => void;
  onProfileSaved?: (updatedUser: AppUserProfile) => void;
}

export interface UploadedFileMeta {
  name: string;
  size: string;
  type: string;
  dataUrl?: string;
  imgbbUrl?: string;
  isUploading?: boolean;
}

// 1-Hour Interval Slots from 6:00 AM to 9:00 PM
export const AVAILABLE_1HR_SLOTS: string[] = [
  '06:00 AM - 07:00 AM',
  '07:00 AM - 08:00 AM',
  '08:00 AM - 09:00 AM',
  '09:00 AM - 10:00 AM',
  '10:00 AM - 11:00 AM',
  '11:00 AM - 12:00 PM',
  '12:00 PM - 01:00 PM',
  '01:00 PM - 02:00 PM',
  '02:00 PM - 03:00 PM',
  '03:00 PM - 04:00 PM',
  '04:00 PM - 05:00 PM',
  '05:00 PM - 06:00 PM',
  '06:00 PM - 07:00 PM',
  '07:00 PM - 08:00 PM',
  '08:00 PM - 09:00 PM'
];

export const TeacherCompleteProfilePage: React.FC<TeacherCompleteProfilePageProps> = ({
  currentUser,
  onBackToDashboard,
  onProfileSaved
}) => {
  const isFirstTimeOnboarding = Boolean(currentUser && !currentUser.profileCompleted);
  const draftKey = `teacher_profile_draft_${currentUser?.uid || 'guest'}`;

  // 1. Personal Information State
  const [fullName, setFullName] = useState(currentUser?.name || currentUser?.fullName || '');
  const [gender, setGender] = useState(currentUser?.gender || 'female');
  const [dob, setDob] = useState((currentUser as any)?.dob || '');
  const [profilePhoto, setProfilePhoto] = useState<UploadedFileMeta | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string>(
    currentUser?.avatar || currentUser?.photoUrl || ''
  );
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [mobileNumber, setMobileNumber] = useState(currentUser?.phone || '');
  const [altNumber, setAltNumber] = useState((currentUser as any)?.altNumber || '');

  // 2. Structured Address & Live Location State (Strictly tutor-entered; live GPS required)
  const [addressLine1, setAddressLine1] = useState(
    currentUser?.addressDetails?.line1 || ''
  );
  const [addressStreet, setAddressStreet] = useState(
    currentUser?.addressDetails?.street || ''
  );
  const [addressLandmark, setAddressLandmark] = useState(
    currentUser?.addressDetails?.landmark || ''
  );
  const [addressCity, setAddressCity] = useState(
    currentUser?.addressDetails?.city || ''
  );
  const [addressState, setAddressState] = useState(
    currentUser?.addressDetails?.state || ''
  );
  const [addressPincode, setAddressPincode] = useState(
    currentUser?.addressDetails?.pincode || ''
  );
  const [isLocating, setIsLocating] = useState(false);
  const [liveLocation, setLiveLocation] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
  } | null>(
    currentUser?.profileCompleted &&
      typeof currentUser?.latitude === 'number' &&
      typeof currentUser?.longitude === 'number' &&
      currentUser.latitude !== 0 &&
      currentUser.longitude !== 0
      ? { lat: currentUser.latitude, lng: currentUser.longitude }
      : null
  );
  const [locationSuccessNotice, setLocationSuccessNotice] = useState<string | null>(
    currentUser?.profileCompleted &&
      typeof currentUser?.latitude === 'number' &&
      typeof currentUser?.longitude === 'number' &&
      currentUser.latitude !== 0 &&
      currentUser.longitude !== 0
      ? `Verified Live GPS Pin: ${currentUser.latitude.toFixed(4)}° N, ${currentUser.longitude.toFixed(4)}° E`
      : null
  );

  // 3. Family Details State
  const [fatherName, setFatherName] = useState((currentUser as any)?.fatherName || '');
  const [fatherMobile, setFatherMobile] = useState((currentUser as any)?.fatherMobile || '');
  const [motherName, setMotherName] = useState((currentUser as any)?.motherName || '');
  const [motherMobile, setMotherMobile] = useState((currentUser as any)?.motherMobile || '');

  // 4. Education Details State with Individual Certificate Uploads
  // 10th
  const [tenthSchool, setTenthSchool] = useState(
    currentUser?.educationDetails?.tenth?.school || ''
  );
  const [tenthBoard, setTenthBoard] = useState(
    currentUser?.educationDetails?.tenth?.board ||
      'Board of Secondary Education, Odisha (BSE Odisha)'
  );
  const [customTenthBoard, setCustomTenthBoard] = useState('');
  const [tenthYear, setTenthYear] = useState(
    currentUser?.educationDetails?.tenth?.year || ''
  );
  const [tenthScore, setTenthScore] = useState(
    currentUser?.educationDetails?.tenth?.score || ''
  );
  const [tenthImage, setTenthImage] = useState<UploadedFileMeta | null>(() =>
    currentUser?.educationDetails?.tenth?.marksheetUrl
      ? {
          name: currentUser.educationDetails.tenth.marksheetName || '10th_marksheet.jpg',
          size: 'Uploaded',
          type: 'image/jpeg',
          imgbbUrl: currentUser.educationDetails.tenth.marksheetUrl,
          dataUrl: currentUser.educationDetails.tenth.marksheetUrl
        }
      : null
  );

  // 12th
  const [twelfthCollege, setTwelfthCollege] = useState(
    currentUser?.educationDetails?.twelfth?.college || ''
  );
  const [twelfthBoard, setTwelfthBoard] = useState(
    currentUser?.educationDetails?.twelfth?.board ||
      'Council of Higher Secondary Education, Odisha (CHSE Odisha)'
  );
  const [customTwelfthBoard, setCustomTwelfthBoard] = useState('');
  const [twelfthYear, setTwelfthYear] = useState(
    currentUser?.educationDetails?.twelfth?.year || ''
  );
  const [twelfthScore, setTwelfthScore] = useState(
    currentUser?.educationDetails?.twelfth?.score || ''
  );
  const [twelfthImage, setTwelfthImage] = useState<UploadedFileMeta | null>(() =>
    currentUser?.educationDetails?.twelfth?.marksheetUrl
      ? {
          name: currentUser.educationDetails.twelfth.marksheetName || '12th_marksheet.jpg',
          size: 'Uploaded',
          type: 'image/jpeg',
          imgbbUrl: currentUser.educationDetails.twelfth.marksheetUrl,
          dataUrl: currentUser.educationDetails.twelfth.marksheetUrl
        }
      : null
  );

  // Degree
  const [degreeCollege, setDegreeCollege] = useState(
    currentUser?.educationDetails?.degree?.university ||
      currentUser?.university ||
      ''
  );
  const [customDegreeCollege, setCustomDegreeCollege] = useState('');
  const [degreeCourse, setDegreeCourse] = useState(
    currentUser?.educationDetails?.degree?.course ||
      currentUser?.qualification ||
      ''
  );
  const [customDegreeCourse, setCustomDegreeCourse] = useState('');
  const [degreeYear, setDegreeYear] = useState(
    currentUser?.educationDetails?.degree?.year || ''
  );
  const [degreeScore, setDegreeScore] = useState(
    currentUser?.educationDetails?.degree?.score || ''
  );
  const [degreeImage, setDegreeImage] = useState<UploadedFileMeta | null>(() =>
    currentUser?.educationDetails?.degree?.marksheetUrl
      ? {
          name: currentUser.educationDetails.degree.marksheetName || 'degree_certificate.jpg',
          size: 'Uploaded',
          type: 'image/jpeg',
          imgbbUrl: currentUser.educationDetails.degree.marksheetUrl,
          dataUrl: currentUser.educationDetails.degree.marksheetUrl
        }
      : null
  );

  // 5. Subjects, Classes Handled & Structured Fees State
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(
    (currentUser as any)?.subjects || []
  );
  const [selectedClasses, setSelectedClasses] = useState<string[]>(
    (currentUser as any)?.classesHandled || []
  );
  const [feeStructure, setFeeStructure] = useState<TutorFeeStructure>(() =>
    mergeFeeStructure(currentUser?.feeStructure)
  );
  const [activeSeniorFeeTab, setActiveSeniorFeeTab] = useState<'11th' | '12th'>('11th');

  // 6. Professional Details State & Availability
  const [experienceYears, setExperienceYears] = useState(
    currentUser?.experience || '1-2 years'
  );
  const [hourlyCharges, setHourlyCharges] = useState<string>(
    currentUser?.hourlyCharges?.toString() ||
      currentUser?.hourlyFee?.toString() ||
      '100'
  );
  const [availableTimeSlots, setAvailableTimeSlots] = useState<string[]>(
    currentUser?.availableTimeSlots || []
  );
  const [languages, setLanguages] = useState<{
    english: boolean;
    hindi: boolean;
    odia: boolean;
    other: boolean;
  }>({
    english: true,
    hindi: true,
    odia: true,
    other: false
  });
  const [otherLanguageText, setOtherLanguageText] = useState('');

  // 7. About Yourself
  const [bio, setBio] = useState(currentUser?.bio || '');

  // 8. KYC Verification State
  const [aadhaarNumber, setAadhaarNumber] = useState((currentUser as any)?.aadhaarNumber || '');
  const [aadhaarImage, setAadhaarImage] = useState<UploadedFileMeta | null>(() =>
    (currentUser as any)?.aadhaarDocUrl
      ? {
          name: 'aadhaar_card.jpg',
          size: 'Uploaded',
          type: 'image/jpeg',
          imgbbUrl: (currentUser as any).aadhaarDocUrl,
          dataUrl: (currentUser as any).aadhaarDocUrl
        }
      : null
  );

  // 9. Tutor Terms & Conditions Acceptance State
  const [termsAccepted, setTermsAccepted] = useState<boolean>(
    Boolean((currentUser as any)?.termsAccepted)
  );

  // Structured fee summary helpers
  const feeSummary = React.useMemo(() => summarizeFeeStructure(feeStructure), [feeStructure]);

  const selected1to10Keys = React.useMemo(
    () =>
      CLASS_1_TO_10_KEYS.filter((clsKey) =>
        selectedClasses.some((c) => {
          const m = c.match(/(\d+)/);
          const k = clsKey.match(/(\d+)/);
          return m && k && m[1] === k[1];
        })
      ),
    [selectedClasses]
  );

  const selectedSeniorKeys = React.useMemo(
    () =>
      SENIOR_CLASSES_KEYS.filter((clsKey) =>
        selectedClasses.some((c) => {
          const m = c.match(/(\d+)/);
          const k = clsKey.match(/(\d+)/);
          return m && k && m[1] === k[1];
        })
      ),
    [selectedClasses]
  );

  useEffect(() => {
    if (selectedSeniorKeys.length > 0 && !selectedSeniorKeys.includes(activeSeniorFeeTab)) {
      setActiveSeniorFeeTab(selectedSeniorKeys[0]);
    }
  }, [selectedSeniorKeys, activeSeniorFeeTab]);

  const seniorSubjectsToRender = React.useMemo(() => {
    const existingKeys = Object.keys(
      feeStructure.classes11to12?.[activeSeniorFeeTab] || {}
    ).filter((k) => {
      const e = feeStructure.classes11to12?.[activeSeniorFeeTab]?.[k];
      return (e?.cbse && e.cbse > 0) || (e?.icse && e.icse > 0);
    });
    return Array.from(new Set([...selectedSubjects, ...existingKeys]));
  }, [selectedSubjects, feeStructure.classes11to12, activeSeniorFeeTab]);

  // Status computation for: 'Personal Info', 'Qualifications', 'Subjects & Availability', 'KYC Verification'
  const personalInfoStatus: 'completed' | 'in_progress' | 'pending' =
    fullName.trim() && mobileNumber.trim() && addressLine1.trim() && (profilePhoto || profilePhotoUrl)
      ? 'completed'
      : fullName.trim() || mobileNumber.trim()
      ? 'in_progress'
      : 'pending';

  const qualificationsStatus: 'completed' | 'in_progress' | 'pending' =
    tenthSchool.trim() && twelfthCollege.trim()
      ? 'completed'
      : tenthSchool.trim() || twelfthCollege.trim() || degreeCollege.trim()
      ? 'in_progress'
      : 'pending';

  const subjectsPricingStatus: 'completed' | 'in_progress' | 'pending' =
    selectedSubjects.length > 0 && selectedClasses.length > 0 && feeSummary.hasAnyFee
      ? 'completed'
      : selectedSubjects.length > 0 || selectedClasses.length > 0 || feeSummary.hasAnyFee
      ? 'in_progress'
      : 'pending';

  const isTeacherApproved = Boolean(
    currentUser?.verified ||
    (currentUser as any)?.isApproved === true ||
    currentUser?.kycStatus === 'approved' ||
    currentUser?.kycStatus === 'verified' ||
    (currentUser as any)?.status === 'approved' ||
    (currentUser as any)?.verificationStatus === 'Verified Genuine Tutor' ||
    isTeacherApprovedInRegistry(currentUser?.uid, (currentUser as any)?.id, currentUser?.email, (currentUser as any)?.phone)
  );

  const kycStatus: 'completed' | 'in_progress' | 'pending' =
    isTeacherApproved
      ? 'completed'
      : currentUser?.kycStatus === 'submitted' || aadhaarNumber.trim().length >= 12 || aadhaarImage
      ? 'in_progress'
      : 'pending';

  // UI & Loading States
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'info';
    message: string;
  } | null>(null);
  const [centerAlert, setCenterAlert] = useState<{
    type: 'error' | 'warning' | 'success';
    title: string;
    message: string;
    focusFieldId?: string;
  } | null>(null);

  // File Input Refs
  const photoInputRef = useRef<HTMLInputElement>(null);
  const tenthInputRef = useRef<HTMLInputElement>(null);
  const twelfthInputRef = useRef<HTMLInputElement>(null);
  const degreeInputRef = useRef<HTMLInputElement>(null);
  const aadhaarInputRef = useRef<HTMLInputElement>(null);

  // Load saved draft on initial mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.fullName) setFullName(d.fullName);
        if (d.gender) setGender(d.gender);
        if (d.dob) setDob(d.dob);
        if (d.addressLine1) setAddressLine1(d.addressLine1);
        if (d.addressStreet) setAddressStreet(d.addressStreet);
        if (d.addressLandmark) setAddressLandmark(d.addressLandmark);
        if (d.addressCity) setAddressCity(d.addressCity);
        if (d.addressState) setAddressState(d.addressState);
        if (d.addressPincode) setAddressPincode(d.addressPincode);
        if (d.mobileNumber) setMobileNumber(d.mobileNumber);
        if (d.altNumber) setAltNumber(d.altNumber);
        if (d.fatherName) setFatherName(d.fatherName);
        if (d.fatherMobile) setFatherMobile(d.fatherMobile);
        if (d.motherName) setMotherName(d.motherName);
        if (d.motherMobile) setMotherMobile(d.motherMobile);
        if (d.tenthSchool) setTenthSchool(d.tenthSchool);
        if (d.tenthBoard) {
          // Normalize legacy abbreviations if needed
          if (d.tenthBoard === 'BSE Odisha') {
            setTenthBoard('Board of Secondary Education, Odisha (BSE Odisha)');
          } else if (d.tenthBoard === 'CBSE') {
            setTenthBoard('Central Board of Secondary Education (CBSE)');
          } else if (d.tenthBoard === 'ICSE') {
            setTenthBoard('Council for the Indian School Certificate Examinations (CISCE / ICSE / ISC)');
          } else {
            setTenthBoard(d.tenthBoard);
          }
        }
        if (d.customTenthBoard) setCustomTenthBoard(d.customTenthBoard);
        if (d.tenthYear) setTenthYear(d.tenthYear);
        if (d.tenthScore) setTenthScore(d.tenthScore);
        if (d.twelfthCollege) setTwelfthCollege(d.twelfthCollege);
        if (d.twelfthBoard) {
          // Normalize legacy abbreviations if needed
          if (d.twelfthBoard === 'CHSE Odisha') {
            setTwelfthBoard('Council of Higher Secondary Education, Odisha (CHSE Odisha)');
          } else if (d.twelfthBoard === 'CBSE') {
            setTwelfthBoard('Central Board of Secondary Education (CBSE)');
          } else if (d.twelfthBoard === 'ISC') {
            setTwelfthBoard('Council for the Indian School Certificate Examinations (CISCE / ICSE / ISC)');
          } else {
            setTwelfthBoard(d.twelfthBoard);
          }
        }
        if (d.customTwelfthBoard) setCustomTwelfthBoard(d.customTwelfthBoard);
        if (d.twelfthYear) setTwelfthYear(d.twelfthYear);
        if (d.twelfthScore) setTwelfthScore(d.twelfthScore);
        if (d.degreeCollege) {
          if (d.degreeCollege === 'Berhampur University') {
            setDegreeCollege('Berhampur University, Bhanja Bihar, Berhampur, Odisha');
          } else {
            setDegreeCollege(d.degreeCollege);
          }
        }
        if (d.customDegreeCollege) setCustomDegreeCollege(d.customDegreeCollege);
        if (d.degreeCourse) {
          if (d.degreeCourse === 'B.Sc') {
            setDegreeCourse('B.Sc (Bachelor of Science - General)');
          } else if (d.degreeCourse === 'B.A') {
            setDegreeCourse('B.A (Bachelor of Arts)');
          } else if (d.degreeCourse === 'B.Com') {
            setDegreeCourse('B.Com (Bachelor of Commerce)');
          } else {
            setDegreeCourse(d.degreeCourse);
          }
        }
        if (d.customDegreeCourse) setCustomDegreeCourse(d.customDegreeCourse);
        if (d.degreeYear) setDegreeYear(d.degreeYear);
        if (d.degreeScore) setDegreeScore(d.degreeScore);
        if (d.experienceYears) setExperienceYears(d.experienceYears);
        if (d.hourlyCharges) setHourlyCharges(d.hourlyCharges);
        if (Array.isArray(d.availableTimeSlots)) setAvailableTimeSlots(d.availableTimeSlots);
        if (Array.isArray(d.selectedSubjects) && d.selectedSubjects.length > 0) {
          setSelectedSubjects(d.selectedSubjects);
        }
        if (Array.isArray(d.selectedClasses) && d.selectedClasses.length > 0) {
          setSelectedClasses(d.selectedClasses);
        }
        if (d.feeStructure) {
          setFeeStructure(mergeFeeStructure(d.feeStructure));
        }
        if (d.bio) setBio(d.bio);
      }
    } catch {
      // ignore
    }
  }, [draftKey]);

  // Autosave draft on form edits
  useEffect(() => {
    try {
      const draftData = {
        fullName,
        gender,
        dob,
        addressLine1,
        addressStreet,
        addressLandmark,
        addressCity,
        addressState,
        addressPincode,
        mobileNumber,
        altNumber,
        fatherName,
        fatherMobile,
        motherName,
        motherMobile,
        tenthSchool,
        tenthBoard,
        customTenthBoard,
        tenthYear,
        tenthScore,
        twelfthCollege,
        twelfthBoard,
        customTwelfthBoard,
        twelfthYear,
        twelfthScore,
        degreeCollege,
        customDegreeCollege,
        degreeCourse,
        customDegreeCourse,
        degreeYear,
        degreeScore,
        experienceYears,
        hourlyCharges,
        availableTimeSlots,
        selectedSubjects,
        selectedClasses,
        feeStructure,
        bio
      };
      localStorage.setItem(draftKey, JSON.stringify(draftData));
    } catch {
      // ignore
    }
  }, [
    draftKey,
    fullName,
    gender,
    dob,
    addressLine1,
    addressStreet,
    addressLandmark,
    addressCity,
    addressState,
    addressPincode,
    mobileNumber,
    altNumber,
    fatherName,
    fatherMobile,
    motherName,
    motherMobile,
    tenthSchool,
    tenthBoard,
    customTenthBoard,
    tenthYear,
    tenthScore,
    twelfthCollege,
    twelfthBoard,
    customTwelfthBoard,
    twelfthYear,
    twelfthScore,
    degreeCollege,
    customDegreeCollege,
    degreeCourse,
    customDegreeCourse,
    degreeYear,
    degreeScore,
    experienceYears,
    hourlyCharges,
    availableTimeSlots,
    selectedSubjects,
    selectedClasses,
    feeStructure,
    bio
  ]);

  // Handlers for structured fee changes
  const handleClass1to10FeeChange = (
    clsKey: (typeof CLASS_1_TO_10_KEYS)[number],
    board: 'cbse' | 'icse',
    rawVal: string
  ) => {
    const clean = rawVal.replace(/\D/g, '');
    const parsed = clean ? parseInt(clean, 10) : undefined;
    setFeeStructure((prev) => ({
      ...prev,
      classes1to10: {
        ...prev.classes1to10,
        [clsKey]: {
          ...(prev.classes1to10?.[clsKey] || {}),
          [board]: parsed && parsed > 0 ? parsed : undefined
        }
      }
    }));
  };

  const handleClass11to12FeeChange = (
    clsKey: '11th' | '12th',
    subject: string,
    board: 'cbse' | 'icse',
    rawVal: string
  ) => {
    const clean = rawVal.replace(/\D/g, '');
    const parsed = clean ? parseInt(clean, 10) : undefined;
    setFeeStructure((prev) => ({
      ...prev,
      classes11to12: {
        ...prev.classes11to12,
        [clsKey]: {
          ...(prev.classes11to12?.[clsKey] || {}),
          [subject]: {
            ...(prev.classes11to12?.[clsKey]?.[subject] || {}),
            [board]: parsed && parsed > 0 ? parsed : undefined
          }
        }
      }
    }));
  };

  // Non-blocking status toast helper (for upload progress/confirmations)
  const showToast = (type: 'success' | 'info', message: string) => {
    setToastMessage({ type, message });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Prominent Center-Screen Alert helper (used whenever any field/location/upload is missed or errors occur)
  const showCenterAlert = (
    title: string,
    message: string,
    type: 'error' | 'warning' | 'success' = 'warning',
    focusFieldId?: string
  ) => {
    setCenterAlert({ type, title, message, focusFieldId });
  };

  const handleDismissCenterAlert = () => {
    const targetId = centerAlert?.focusFieldId;
    setCenterAlert(null);
    if (targetId) {
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          if (typeof (el as HTMLElement).focus === 'function') {
            (el as HTMLElement).focus();
          }
        }
      }, 60);
    }
  };

  // Helper for photo upload with ImgBB storage
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      showToast('info', 'Please upload a JPG, JPEG, or PNG image.');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('info', 'Photo size exceeds 8MB limit.');
      return;
    }

    let localPreview = '';
    try {
      localPreview = await compressImageToBase64(file, 600, 0.85);
    } catch {
      localPreview = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve((ev.target?.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    }
    setProfilePhotoUrl(localPreview);
    setProfilePhoto({
      name: file.name,
      size: `${Math.round(file.size / 1024)} KB`,
      type: file.type,
      dataUrl: localPreview,
      isUploading: true
    });
    setIsUploadingPhoto(true);

    try {
      showToast('info', 'Processing & uploading profile photo...');
      const result = await uploadImageToImgBB(file, `teacher_profile_${Date.now()}`);
      const finalUrl = result.url || localPreview;
      setProfilePhotoUrl(finalUrl);
      setProfilePhoto({
        name: file.name,
        size: result.size || `${Math.round(file.size / 1024)} KB`,
        type: file.type,
        dataUrl: localPreview,
        imgbbUrl: finalUrl,
        isUploading: false
      });
      showToast('success', 'Profile photo saved successfully!');
    } catch (err: any) {
      console.warn('[Photo Upload] Notice:', err);
      setProfilePhoto((prev) => (prev ? { ...prev, isUploading: false, dataUrl: localPreview, imgbbUrl: localPreview } : null));
    } finally {
      setIsUploadingPhoto(false);
      if (e.target) e.target.value = '';
    }
  };

  // Helper for single educational document image upload (JPG, PNG, JPEG) with ImgBB storage
  const handleSingleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<UploadedFileMeta | null>>,
    sectionName: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validMimes = ['image/jpeg', 'image/png', 'image/jpg'];
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const validExts = ['.jpg', '.jpeg', '.png'];

    if (!validMimes.includes(file.type) && !validExts.includes(ext)) {
      showCenterAlert(
        'Invalid File Format',
        `Please upload JPG, JPEG, or PNG format for ${sectionName}.`,
        'warning'
      );
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      showCenterAlert('File Too Large', `${sectionName} exceeds the 8MB size limit.`, 'warning');
      return;
    }

    let compressedBackup = '';
    try {
      compressedBackup = await compressImageToBase64(file, 900, 0.8);
    } catch {
      compressedBackup = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve((ev.target?.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    }

    const sizeStr =
      file.size > 1024 * 1024
        ? `${(file.size / (1024 * 1024)).toFixed(1)} MB`
        : `${Math.round(file.size / 1024)} KB`;

    // Immediately show preview with isUploading flag
    setter({
      name: file.name,
      size: sizeStr,
      type: file.type || 'image/jpeg',
      dataUrl: compressedBackup,
      isUploading: true
    });

    try {
      showToast('info', `Uploading ${sectionName}...`);
      const customName = `${sectionName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
      const result = await uploadImageToImgBB(file, customName);

      if (result.success && result.url) {
        setter({
          name: file.name,
          size: result.size || sizeStr,
          type: file.type || 'image/jpeg',
          dataUrl: compressedBackup,
          imgbbUrl: result.url,
          isUploading: false
        });
        showToast('success', `${sectionName} uploaded successfully!`);
      } else {
        setter((prev) =>
          prev
            ? {
                ...prev,
                isUploading: false,
                dataUrl: compressedBackup,
                imgbbUrl: result.url || compressedBackup
              }
            : null
        );
        showToast('success', `${sectionName} attached and ready!`);
      }
    } catch (err: any) {
      console.warn(`[${sectionName} Upload] Notice:`, err);
      setter((prev) =>
        prev
          ? {
              ...prev,
              isUploading: false,
              dataUrl: compressedBackup,
              imgbbUrl: compressedBackup
            }
          : null
      );
      showToast('info', `${sectionName} attached locally.`);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  // Live Location Trigger (Required GPS lock — never pre-fills fake Rayagada address fields)
  const handleUseLiveLocation = async () => {
    setIsLocating(true);
    setLocationSuccessNotice(null);
    showToast('info', 'Acquiring precise GPS lock...');

    try {
      const geo = await getLiveUserLocation((statusMsg) => {
        showToast('info', statusMsg);
      });
      setLiveLocation({ lat: geo.latitude, lng: geo.longitude, accuracy: geo.accuracy });
      const notice = `Live GPS Verified: ${geo.latitude.toFixed(4)}° N, ${geo.longitude.toFixed(4)}° E (±${geo.accuracy}m radius)`;
      setLocationSuccessNotice(notice);
      showToast('success', `Live GPS coordinates locked (±${geo.accuracy}m radius)!`);
    } catch (err: any) {
      console.warn('Geolocation error:', err.message);
      showCenterAlert(
        'Live Location Required',
        err.message ||
          'Could not acquire your GPS location. Please enable Location / GPS permission in your browser settings and click "Use Live Location" again.',
        'error',
        'field-live-location'
      );
    } finally {
      setIsLocating(false);
    }
  };

  // Time slot toggle
  const handleToggleSlot = (slot: string) => {
    setAvailableTimeSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  // Submit complete profile
  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    // Ensure no document uploads are still in progress
    if (
      isUploadingPhoto ||
      tenthImage?.isUploading ||
      twelfthImage?.isUploading ||
      degreeImage?.isUploading ||
      aadhaarImage?.isUploading
    ) {
      showCenterAlert(
        'Upload in Progress',
        'Please wait for your certificate or photo upload to complete before submitting your profile.',
        'warning'
      );
      return;
    }

    // 1. Personal Information (All Required)
    if (!fullName.trim()) {
      showCenterAlert('Missing Full Name', 'Please enter your Full Name in Personal Information.', 'warning', 'field-fullname');
      return;
    }
    if (!dob) {
      showCenterAlert('Missing Date of Birth', 'Please select your Date of Birth.', 'warning', 'field-dob');
      return;
    }
    if (!profilePhoto && !profilePhotoUrl) {
      showCenterAlert('Profile Photo Required', 'Please upload your Profile Picture.', 'warning', 'field-photo');
      return;
    }
    if (!mobileNumber.trim() || mobileNumber.replace(/\D/g, '').length < 10) {
      showCenterAlert('Invalid Mobile Number', 'Please enter a valid 10-digit Mobile Number.', 'warning', 'field-mobile');
      return;
    }
    if (!altNumber.trim() || altNumber.replace(/\D/g, '').length < 10) {
      showCenterAlert('Alternative Number Required', 'Please enter your 10-digit WhatsApp / Alternative Number.', 'warning', 'field-alt-mobile');
      return;
    }

    // 2. Residential Address & Mandatory Live GPS Location
    if (
      !liveLocation ||
      typeof liveLocation.lat !== 'number' ||
      typeof liveLocation.lng !== 'number' ||
      isNaN(liveLocation.lat) ||
      isNaN(liveLocation.lng)
    ) {
      showCenterAlert(
        'Live Location Required',
        'Please click "Use Live Location" in Section 2 to capture your verified live GPS coordinates before submitting.',
        'warning',
        'field-live-location'
      );
      return;
    }
    if (!addressLine1.trim()) {
      showCenterAlert(
        'Missing Flat / House No.',
        'Please enter your Flat / Door / House No. & Building Name in your residential address.',
        'warning',
        'field-address-line1'
      );
      return;
    }
    if (!addressStreet.trim()) {
      showCenterAlert(
        'Missing Street / Locality',
        'Please enter your own Street / Area / Locality name.',
        'warning',
        'field-address-street'
      );
      return;
    }
    if (!addressLandmark.trim()) {
      showCenterAlert(
        'Missing Landmark',
        'Please enter a nearby Landmark for your residential address.',
        'warning',
        'field-address-landmark'
      );
      return;
    }
    if (!addressCity.trim()) {
      showCenterAlert(
        'Missing City / Town',
        'Please enter your City / Town name.',
        'warning',
        'field-address-city'
      );
      return;
    }
    if (!addressState.trim()) {
      showCenterAlert(
        'Missing State',
        'Please select your State from the dropdown.',
        'warning',
        'field-address-state'
      );
      return;
    }
    if (!/^\d{6}$/.test(addressPincode.trim())) {
      showCenterAlert(
        'Invalid PIN Code',
        'Please enter a valid 6-digit residential PIN Code.',
        'warning',
        'field-address-pincode'
      );
      return;
    }

    // 3. Family Details
    if (!fatherName.trim() || !fatherMobile.trim()) {
      showCenterAlert(
        'Family Details Missing',
        "Please enter both your Father's Name and Father's Mobile Number.",
        'warning',
        'field-father-name'
      );
      return;
    }
    if (!motherName.trim() || !motherMobile.trim()) {
      showCenterAlert(
        'Family Details Missing',
        "Please enter both your Mother's Name and Mother's Mobile Number.",
        'warning',
        'field-mother-name'
      );
      return;
    }

    // 4. 10th Standard (High School) Details
    if (!tenthSchool.trim() || !tenthYear.trim() || !tenthScore.trim()) {
      showCenterAlert(
        '10th Details Incomplete',
        'Please fill all 10th Standard details (School Name, Passing Year, Percentage/CGPA).',
        'warning',
        'field-tenth'
      );
      return;
    }
    if (tenthBoard === 'Other State / Recognized Board' && !customTenthBoard.trim()) {
      showCenterAlert(
        '10th Board Name Required',
        'Please enter your 10th Board name.',
        'warning',
        'field-tenth'
      );
      return;
    }
    if (!tenthImage && !(currentUser as any)?.educationDetails?.tenth?.marksheetUrl) {
      showCenterAlert(
        '10th Marksheet Missing',
        'Please upload your 10th Standard Marksheet / Certificate image.',
        'warning',
        'field-tenth'
      );
      return;
    }

    // 5. 12th Standard (+2 / Intermediate) Details
    if (!twelfthCollege.trim() || !twelfthYear.trim() || !twelfthScore.trim()) {
      showCenterAlert(
        '12th Details Incomplete',
        'Please fill all 12th Standard (+2) details (College Name, Passing Year, Percentage/CGPA).',
        'warning',
        'field-twelfth'
      );
      return;
    }
    if (twelfthBoard === 'Other State / Recognized Board' && !customTwelfthBoard.trim()) {
      showCenterAlert(
        '12th Board Name Required',
        'Please enter your 12th Board name.',
        'warning',
        'field-twelfth'
      );
      return;
    }
    if (!twelfthImage && !(currentUser as any)?.educationDetails?.twelfth?.marksheetUrl) {
      showCenterAlert(
        '12th Marksheet Missing',
        'Please upload your 12th Standard Marksheet / Certificate image.',
        'warning',
        'field-twelfth'
      );
      return;
    }

    // 6. Teaching Info, Structured Fee Schedule & Slots
    if (selectedSubjects.length === 0) {
      showCenterAlert(
        'Subjects Required',
        'Please select at least one subject you teach.',
        'warning',
        'field-subjects'
      );
      return;
    }
    if (selectedClasses.length === 0) {
      showCenterAlert(
        'Classes Required',
        'Please select at least one class (1st to 12th) you handle.',
        'warning',
        'field-classes'
      );
      return;
    }
    if (!feeSummary.hasAnyFee) {
      showCenterAlert(
        'Monthly Fee Structure Missing',
        'Please enter your Monthly Tuition Fee (CBSE/ICSE) for the classes you selected.',
        'warning',
        'field-fees'
      );
      return;
    }

    // Validate that each selected class has at least one board fee entered
    for (const clsLabel of selectedClasses) {
      const m = clsLabel.match(/(\d+)/);
      if (!m) continue;
      const num = m[1];
      if (num === '11' || num === '12') {
        const seniorKey = num === '11' ? '11th' : '12th';
        const subMap = feeStructure.classes11to12?.[seniorKey];
        const hasSeniorFee = subMap
          ? Object.values(subMap).some(
              (entry: { cbse?: number; icse?: number }) =>
                (entry?.cbse && entry.cbse > 0) || (entry?.icse && entry.icse > 0)
            )
          : false;
        if (!hasSeniorFee) {
          showCenterAlert(
            `Fee Missing for ${seniorKey} Class`,
            `Please enter at least one CBSE or ICSE subject fee for ${seniorKey} Class.`,
            'warning',
            'field-fees'
          );
          return;
        }
      } else {
        const ordinalKey = `${num}${num === '1' ? 'st' : num === '2' ? 'nd' : num === '3' ? 'rd' : 'th'}` as (typeof CLASS_1_TO_10_KEYS)[number];
        const row = feeStructure.classes1to10?.[ordinalKey];
        if (!((row?.cbse && row.cbse > 0) || (row?.icse && row.icse > 0))) {
          showCenterAlert(
            `Fee Missing for ${ordinalKey} Class`,
            `Please enter CBSE or ICSE monthly fee for ${ordinalKey} Class.`,
            'warning',
            'field-fees'
          );
          return;
        }
      }
    }

    if (availableTimeSlots.length === 0) {
      showCenterAlert(
        'Availability Slots Required',
        'Please select at least one 1-hour available time slot.',
        'warning',
        'field-slots'
      );
      return;
    }
    if (!bio.trim()) {
      showCenterAlert(
        'Teacher Bio Required',
        'Please write a short introduction about your teaching style in "About Yourself".',
        'warning',
        'field-bio'
      );
      return;
    }

    // 7. KYC Aadhaar Verification (Required)
    if (aadhaarNumber.replace(/\D/g, '').length !== 12) {
      showCenterAlert(
        'Aadhaar Number Required',
        'Please enter your complete 12-digit Aadhaar Card Number for KYC verification.',
        'warning',
        'field-aadhaar-number'
      );
      return;
    }
    if (!aadhaarImage && !(currentUser as any)?.aadhaarDocUrl) {
      showCenterAlert(
        'Aadhaar Document Required',
        'Please upload a clear photo of your Aadhaar Card for identity verification.',
        'warning',
        'field-aadhaar-doc'
      );
      return;
    }

    // 8. Terms & Conditions Acceptance (Required)
    if (!termsAccepted) {
      showCenterAlert(
        'Terms & Conditions Required',
        'Please read and accept the Kumari Institute Tutor Terms & Conditions (including the mandatory 1-month minimum teaching rule for fee payment) before submitting your profile.',
        'warning',
        'field-terms'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const uid = currentUser?.uid || auth.currentUser?.uid || `teacher_${Date.now()}`;

      const effectiveTenthBoard =
        tenthBoard === 'Other State / Recognized Board' && customTenthBoard.trim()
          ? customTenthBoard.trim()
          : tenthBoard;

      const effectiveTwelfthBoard =
        twelfthBoard === 'Other State / Recognized Board' && customTwelfthBoard.trim()
          ? customTwelfthBoard.trim()
          : twelfthBoard;

      const effectiveDegreeCollege =
        degreeCollege === 'Other University / College' && customDegreeCollege.trim()
          ? customDegreeCollege.trim()
          : degreeCollege;

      const effectiveDegreeCourse =
        degreeCourse === 'Other Degree / Course' && customDegreeCourse.trim()
          ? customDegreeCourse.trim()
          : degreeCourse;

      const compiledAddress = `${addressLine1.trim()}, ${addressStreet.trim()}, Landmark: ${addressLandmark.trim()}, ${addressCity.trim()}, ${addressState.trim()} - ${addressPincode.trim()}`;

      const filteredFeeInput: TutorFeeStructure = {
        classes1to10: { ...feeStructure.classes1to10 },
        classes11to12: {
          '11th': selectedSeniorKeys.includes('11th')
            ? feeStructure.classes11to12?.['11th'] || {}
            : {},
          '12th': selectedSeniorKeys.includes('12th')
            ? feeStructure.classes11to12?.['12th'] || {}
            : {}
        }
      };
      CLASS_1_TO_10_KEYS.forEach((clsKey) => {
        if (!selected1to10Keys.includes(clsKey)) {
          filteredFeeInput.classes1to10[clsKey] = {};
        }
      });

      const sanitizedFees = sanitizeFeeStructure(filteredFeeInput);
      const effectiveSummary = summarizeFeeStructure(sanitizedFees);
      const effectiveMonthlyFee = effectiveSummary.minMonthlyFee > 0 ? effectiveSummary.minMonthlyFee : (Number(hourlyCharges) || 100) * 30;
      const effectiveHourlyRate = Math.max(50, Math.round(effectiveMonthlyFee / 30));

      const teacherPayload = {
        fullName: fullName.trim(),
        name: fullName.trim(),
        gender,
        dob,
        phone: mobileNumber.trim(),
        altNumber: altNumber.trim(),
        address: compiledAddress,
        locationArea: `${addressStreet.trim()}, ${addressCity.trim()}`,
        locality: addressStreet.trim(),
        addressSnippet: compiledAddress,
        coordinates: {
          lat: liveLocation.lat,
          lng: liveLocation.lng
        },
        addressDetails: {
          line1: addressLine1.trim(),
          street: addressStreet.trim(),
          landmark: addressLandmark.trim(),
          city: addressCity.trim(),
          state: addressState.trim(),
          pincode: addressPincode.trim(),
          latitude: liveLocation.lat,
          longitude: liveLocation.lng
        },
        latitude: liveLocation.lat,
        longitude: liveLocation.lng,
        fatherName: fatherName.trim(),
        fatherMobile: fatherMobile.trim(),
        motherName: motherName.trim(),
        motherMobile: motherMobile.trim(),
        highestQualification: effectiveDegreeCourse || 'Intermediate (+2)',
        courseDegree: effectiveDegreeCourse
          ? (effectiveDegreeCollege ? `${effectiveDegreeCourse} (${effectiveDegreeCollege})` : effectiveDegreeCourse)
          : '',
        university: effectiveDegreeCollege.trim(),
        passingYear: degreeYear.trim(),
        educationDetails: {
          tenth: {
            school: tenthSchool.trim(),
            board: effectiveTenthBoard,
            year: tenthYear.trim(),
            score: tenthScore.trim(),
            marksheetName: tenthImage?.name || '',
            marksheetUrl: tenthImage?.imgbbUrl || tenthImage?.dataUrl || (currentUser as any)?.educationDetails?.tenth?.marksheetUrl || ''
          },
          twelfth: {
            college: twelfthCollege.trim(),
            board: effectiveTwelfthBoard,
            year: twelfthYear.trim(),
            score: twelfthScore.trim(),
            marksheetName: twelfthImage?.name || '',
            marksheetUrl: twelfthImage?.imgbbUrl || twelfthImage?.dataUrl || (currentUser as any)?.educationDetails?.twelfth?.marksheetUrl || ''
          },
          degree: {
            university: effectiveDegreeCollege.trim(),
            course: effectiveDegreeCourse.trim(),
            year: degreeYear.trim(),
            score: degreeScore.trim(),
            marksheetName: degreeImage?.name || '',
            marksheetUrl: degreeImage?.imgbbUrl || degreeImage?.dataUrl || (currentUser as any)?.educationDetails?.degree?.marksheetUrl || ''
          }
        },
        experienceYears: parseInt(experienceYears) || 2,
        totalExperience: experienceYears,
        experience: experienceYears,
        hourlyCharges: effectiveHourlyRate,
        hourlyRate: effectiveHourlyRate,
        hourlyFee: effectiveHourlyRate,
        monthlyFee: effectiveMonthlyFee,
        feeStructure: sanitizedFees,
        boardsSupported: feeSummary.boardsSupported,
        availableTimeSlots: availableTimeSlots,
        timeSlots: availableTimeSlots,
        tuitionModes: ['Home Tuition'],
        languages: [
          languages.english ? 'English' : '',
          languages.hindi ? 'Hindi' : '',
          languages.odia ? 'Odia' : '',
          languages.other ? otherLanguageText : ''
        ].filter(Boolean),
        bio: bio.trim(),
        avatar: profilePhoto?.imgbbUrl || profilePhotoUrl,
        photoUrl: profilePhoto?.imgbbUrl || profilePhotoUrl,
        subjects: selectedSubjects,
        classesHandled: selectedClasses,
        aadhaarNumber: aadhaarNumber.trim(),
        aadhaarDocUrl: aadhaarImage?.imgbbUrl || aadhaarImage?.dataUrl || (currentUser as any)?.aadhaarDocUrl || '',
        profileCompleted: true,
        kycStatus: isTeacherApproved ? ('approved' as const) : ('submitted' as const),
        verified: isTeacherApproved,
        status: isTeacherApproved ? 'approved' : 'pending',
        isApproved: isTeacherApproved,
        isBooked: Boolean((currentUser as any)?.isBooked),
        bookingStatus: (currentUser as any)?.bookingStatus || 'available',
        verificationStatus: isTeacherApproved ? 'Verified Genuine Tutor' : 'Pending Verification',
        termsAccepted: true,
        termsAcceptedAt: new Date().toISOString(),
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // 1. Save all teacher details to Firestore DB
      await updateTeacherProfileInFirestore(uid, teacherPayload);

      // 2. Register live location with backend search engine
      try {
        await registerTeacherLocation({
          name: fullName.trim(),
          email: currentUser?.email || auth.currentUser?.email,
          phone: mobileNumber.trim(),
          latitude: liveLocation.lat,
          longitude: liveLocation.lng,
          address: compiledAddress,
          locationArea: `${addressStreet.trim()}, ${addressCity.trim()}`,
          qualification: effectiveDegreeCourse || 'Intermediate (+2)',
          experienceYears: parseInt(experienceYears) || 2,
          subjects: selectedSubjects,
          classesHandled: selectedClasses,
          monthlyFee: effectiveMonthlyFee,
          hourlyRate: effectiveHourlyRate,
          bio: bio.trim(),
          gender: gender === 'female' ? 'female' : 'male',
          teacherType: 'both',
          feeStructure: sanitizedFees,
          boardsSupported: feeSummary.boardsSupported,
          avatar: profilePhoto?.imgbbUrl || profilePhotoUrl,
          educationDetails: teacherPayload.educationDetails,
          aadhaarNumber: aadhaarNumber.trim(),
          aadhaarDocUrl: teacherPayload.aadhaarDocUrl,
          availableTimeSlots
        });
      } catch (locErr) {
        console.warn('Location registration notice:', locErr);
      }

      // 3. Update local session profile
      const updatedProfile: AppUserProfile = {
        ...(currentUser || {
          uid,
          email: currentUser?.email || auth.currentUser?.email || 'teacher@kumari.edu',
          role: 'teacher' as const
        }),
        name: fullName.trim(),
        fullName: fullName.trim(),
        phone: mobileNumber.trim(),
        gender: gender as 'male' | 'female' | 'other',
        profileCompleted: true,
        kycStatus: isTeacherApproved ? ('approved' as const) : ('submitted' as const),
        verified: isTeacherApproved,
        isApproved: isTeacherApproved,
        status: isTeacherApproved ? 'approved' : 'pending',
        verificationStatus: isTeacherApproved ? 'Verified Genuine Tutor' : 'Pending Verification',
        locality: compiledAddress,
        qualification: effectiveDegreeCourse || 'Intermediate (+2)',
        university: effectiveDegreeCollege,
        experience: experienceYears,
        hourlyCharges: effectiveHourlyRate,
        hourlyFee: effectiveHourlyRate,
        feeStructure: sanitizedFees,
        boardsSupported: feeSummary.boardsSupported,
        availableTimeSlots: availableTimeSlots,
        bio: bio.trim(),
        avatar: profilePhoto?.imgbbUrl || profilePhotoUrl,
        photoUrl: profilePhoto?.imgbbUrl || profilePhotoUrl,
        addressDetails: teacherPayload.addressDetails,
        educationDetails: teacherPayload.educationDetails,
        latitude: liveLocation.lat,
        longitude: liveLocation.lng,
        subjects: selectedSubjects,
        classesHandled: selectedClasses,
        aadhaarNumber: aadhaarNumber.trim(),
        aadhaarDocUrl: teacherPayload.aadhaarDocUrl
      };

      if (isTeacherApproved) {
        markTeacherApprovedInRegistry(uid);
        if (currentUser?.email) markTeacherApprovedInRegistry(currentUser.email);
      }

      saveUserSessionToStorage(updatedProfile);
      await syncUserToPersistence(updatedProfile);

      // 4. Clear draft
      localStorage.removeItem(draftKey);
      showToast('success', 'Teacher profile, certificates & structured fee schedule submitted for verification!');

      setTimeout(() => {
        if (onProfileSaved) {
          onProfileSaved(updatedProfile);
        } else {
          onBackToDashboard();
        }
      }, 900);
    } catch (err: any) {
      console.error('Submission error:', err);
      showCenterAlert(
        'Submission Error',
        err?.message || 'Failed to submit profile. Please check your connection and try again.',
        'error'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 pb-20 antialiased selection:bg-blue-100 selection:text-blue-900">
      {/* Centered Validation / Missing Field Alert Modal */}
      {centerAlert && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="center-alert-title"
          aria-describedby="center-alert-desc"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleDismissCenterAlert();
          }}
        >
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 text-center space-y-4">
              <div
                className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center ${
                  centerAlert.type === 'error'
                    ? 'bg-rose-100 text-rose-600'
                    : centerAlert.type === 'success'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-amber-100 text-amber-600'
                }`}
              >
                {centerAlert.type === 'success' ? (
                  <CheckCircle2 className="w-7 h-7" />
                ) : (
                  <AlertCircle className="w-7 h-7" />
                )}
              </div>

              <div className="space-y-1.5">
                <h3 id="center-alert-title" className="text-lg font-extrabold text-slate-900">
                  {centerAlert.title}
                </h3>
                <p id="center-alert-desc" className="text-sm text-slate-600 leading-relaxed">
                  {centerAlert.message}
                </p>
              </div>

              <button
                type="button"
                onClick={handleDismissCenterAlert}
                className="w-full py-3 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer"
              >
                {centerAlert.focusFieldId ? 'OK, Go to Field' : 'OK, Got It'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subtle Non-blocking Progress / Upload Toast Banner (top-center) */}
      {toastMessage && !centerAlert && (
        <div
          role="status"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-slate-900 text-white px-4 py-2.5 rounded-2xl shadow-xl border border-slate-800 animate-in fade-in duration-200 max-w-[90vw]"
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          <span className="text-xs sm:text-sm font-medium">{toastMessage.message}</span>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {/* Back Link Button (Hidden during first-time onboarding so user completes upload before navigating) */}
        {!isFirstTimeOnboarding ? (
          <div className="mb-6">
            <button
              type="button"
              onClick={onBackToDashboard}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors group cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              <span>Back to My Profile</span>
            </button>
          </div>
        ) : (
          <div className="mb-6 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Step 1 of 1 — Complete &amp; submit your profile to unlock your Tutor Dashboard</span>
          </div>
        )}

        {/* Page Title & Subtitle */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Complete Your Teacher Profile
          </h1>
          <p className="text-sm sm:text-base text-slate-500 mt-1">
            Provide your verified educational credentials and home tuition details for parents in Rayagada.
          </p>
        </div>

        {/* Verification Status Overview: 4 Distinct Items */}
        <div className="mb-8 grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Personal Info */}
          <div className={`p-4 rounded-2xl border transition-all ${
            personalInfoStatus === 'completed'
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
              : personalInfoStatus === 'in_progress'
              ? 'bg-amber-50/60 border-amber-200 text-amber-950'
              : 'bg-rose-50/60 border-rose-200 text-rose-950'
          }`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-800">Personal Info</span>
              {personalInfoStatus === 'completed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : personalInfoStatus === 'in_progress' ? (
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${
                personalInfoStatus === 'completed' ? 'bg-emerald-500' : personalInfoStatus === 'in_progress' ? 'bg-amber-500' : 'bg-rose-500'
              }`} />
              <span className="text-[11px] font-semibold">
                {personalInfoStatus === 'completed' ? 'Completed' : personalInfoStatus === 'in_progress' ? 'In Progress' : 'Pending'}
              </span>
            </div>
          </div>

          {/* 2. Qualifications */}
          <div className={`p-4 rounded-2xl border transition-all ${
            qualificationsStatus === 'completed'
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
              : qualificationsStatus === 'in_progress'
              ? 'bg-amber-50/60 border-amber-200 text-amber-950'
              : 'bg-rose-50/60 border-rose-200 text-rose-950'
          }`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-800">Qualifications</span>
              {qualificationsStatus === 'completed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : qualificationsStatus === 'in_progress' ? (
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${
                qualificationsStatus === 'completed' ? 'bg-emerald-500' : qualificationsStatus === 'in_progress' ? 'bg-amber-500' : 'bg-rose-500'
              }`} />
              <span className="text-[11px] font-semibold">
                {qualificationsStatus === 'completed' ? 'Completed' : qualificationsStatus === 'in_progress' ? 'In Progress' : 'Pending'}
              </span>
            </div>
          </div>

          {/* 3. Subjects & Pricing */}
          <div className={`p-4 rounded-2xl border transition-all ${
            subjectsPricingStatus === 'completed'
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
              : subjectsPricingStatus === 'in_progress'
              ? 'bg-amber-50/60 border-amber-200 text-amber-950'
              : 'bg-rose-50/60 border-rose-200 text-rose-950'
          }`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-800">Subjects & Pricing</span>
              {subjectsPricingStatus === 'completed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : subjectsPricingStatus === 'in_progress' ? (
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${
                subjectsPricingStatus === 'completed' ? 'bg-emerald-500' : subjectsPricingStatus === 'in_progress' ? 'bg-amber-500' : 'bg-rose-500'
              }`} />
              <span className="text-[11px] font-semibold">
                {subjectsPricingStatus === 'completed' ? 'Completed' : subjectsPricingStatus === 'in_progress' ? 'In Progress' : 'Pending'}
              </span>
            </div>
          </div>

          {/* 4. KYC Verification */}
          <div className={`p-4 rounded-2xl border transition-all ${
            kycStatus === 'completed'
              ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
              : kycStatus === 'in_progress'
              ? 'bg-amber-50/60 border-amber-200 text-amber-950'
              : 'bg-rose-50/60 border-rose-200 text-rose-950'
          }`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-800">KYC Verification</span>
              {kycStatus === 'completed' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : kycStatus === 'in_progress' ? (
                <Clock className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${
                kycStatus === 'completed' ? 'bg-emerald-500' : kycStatus === 'in_progress' ? 'bg-amber-500' : 'bg-rose-500'
              }`} />
              <span className="text-[11px] font-semibold">
                {kycStatus === 'completed' ? 'KYC Completed' : kycStatus === 'in_progress' ? 'Under Review' : 'Pending'}
              </span>
            </div>
          </div>
        </div>

        {/* Responsive Workspace Form */}
        <form onSubmit={handleSubmitProfile} noValidate className="space-y-6">
          {/* SECTION 1: Personal Information */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Personal Information</h2>
                <p className="text-xs text-slate-500">Update your basic identification and contact details</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    id="field-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Enter your full name"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white"
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </div>

              {/* Date of Birth */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    id="field-dob"
                    type="date"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Profile Picture */}
              <div id="field-photo">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Profile Picture <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {profilePhotoUrl ? (
                      <img
                        src={profilePhotoUrl}
                        alt="Profile Preview"
                        className="w-12 h-12 rounded-full object-cover border-2 border-blue-100 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm border-2 border-blue-100 shrink-0">
                        {fullName ? fullName.charAt(0).toUpperCase() : 'T'}
                      </div>
                    )}
                    {isUploadingPhoto && (
                      <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-white" />
                      </div>
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/png, image/jpeg, image/jpg"
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      disabled={isUploadingPhoto}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                    >
                      {isUploadingPhoto ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                          <span>Uploading to ImgBB...</span>
                        </>
                      ) : (
                        <span>Choose Photo</span>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                      <span>JPG, PNG (Stored on ImgBB Cloud)</span>
                      {profilePhoto?.imgbbUrl && (
                        <span className="text-emerald-600 font-semibold">✓ ImgBB Stored</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Phone Numbers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mobile Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    id="field-mobile"
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="Enter 10-digit mobile"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  WhatsApp / Alternative Number <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    id="field-alt-mobile"
                    type="tel"
                    value={altNumber}
                    onChange={(e) => setAltNumber(e.target.value)}
                    placeholder="Enter 10-digit WhatsApp / backup mobile"
                    required
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Detailed Address & Required Live Location */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Residential Address &amp; Live Location</h2>
                  <p className="text-xs text-slate-500">
                    Enter your full residential address manually and capture your required live GPS coordinates
                  </p>
                </div>
              </div>

              {/* Required Live Location Button */}
              <button
                id="field-live-location"
                type="button"
                onClick={handleUseLiveLocation}
                disabled={isLocating}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs self-start sm:self-auto disabled:opacity-50 ${
                  liveLocation
                    ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300'
                    : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600'
                }`}
              >
                {isLocating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Compass className="w-4 h-4" />
                )}
                <span>
                  {isLocating
                    ? 'Acquiring GPS Lock...'
                    : liveLocation
                    ? 'Refresh Live Location ✓'
                    : 'Use Live Location (Required)'}
                </span>
              </button>
            </div>

            {/* Live GPS Coordinates Status Box (Strictly acquired via Use Live Location — no preset lists) */}
            <div
              className={`p-3.5 sm:p-4 rounded-xl border space-y-2 ${
                liveLocation
                  ? 'bg-emerald-50/70 border-emerald-200'
                  : 'bg-amber-50/70 border-amber-200'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Navigation className={`w-4 h-4 ${liveLocation ? 'text-emerald-600' : 'text-amber-600'}`} />
                  Live GPS Coordinates <span className="text-red-500">*</span>
                </span>
                {liveLocation ? (
                  <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-lg self-start sm:self-auto">
                    {liveLocation.lat.toFixed(4)}° N, {liveLocation.lng.toFixed(4)}° E
                    {liveLocation.accuracy ? ` (±${liveLocation.accuracy}m)` : ''}
                  </span>
                ) : (
                  <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-lg self-start sm:self-auto">
                    Pending Live GPS Capture
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                {locationSuccessNotice
                  ? locationSuccessNotice
                  : 'Click "Use Live Location" above to record your exact GPS location. Preset locations are disabled so every tutor submits their real address.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Flat / House No. & Building */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Flat / Door / House No. &amp; Building Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="field-address-line1"
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  placeholder="Enter flat / house number & building"
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              {/* Street / Road / Locality */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Street / Colony / Area Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="field-address-street"
                  type="text"
                  value={addressStreet}
                  onChange={(e) => setAddressStreet(e.target.value)}
                  placeholder="Enter your street / colony / area"
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              {/* Landmark */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Landmark <span className="text-red-500">*</span>
                </label>
                <input
                  id="field-address-landmark"
                  type="text"
                  value={addressLandmark}
                  onChange={(e) => setAddressLandmark(e.target.value)}
                  placeholder="Enter nearest well-known landmark"
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              {/* City, State & PIN Code */}
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    City / Town <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="field-address-city"
                    type="text"
                    value={addressCity}
                    onChange={(e) => setAddressCity(e.target.value)}
                    placeholder="Enter city / town"
                    required
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    State <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="field-address-state"
                    value={addressState}
                    onChange={(e) => setAddressState(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white"
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES_A_TO_Z.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    PIN Code <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="field-address-pincode"
                    type="text"
                    maxLength={6}
                    value={addressPincode}
                    onChange={(e) => setAddressPincode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit PIN code"
                    required
                    className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: Family Details */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Family Details</h2>
                <p className="text-xs text-slate-500">Emergency &amp; guardian verification contacts</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Father's Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="field-father-name"
                  type="text"
                  value={fatherName}
                  onChange={(e) => setFatherName(e.target.value)}
                  placeholder="Enter father's full name"
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Father's Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={fatherMobile}
                  onChange={(e) => setFatherMobile(e.target.value)}
                  placeholder="Enter mobile number"
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mother's Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="field-mother-name"
                  type="text"
                  value={motherName}
                  onChange={(e) => setMotherName(e.target.value)}
                  placeholder="Enter mother's full name"
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Mother's Mobile Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={motherMobile}
                  onChange={(e) => setMotherMobile(e.target.value)}
                  placeholder="Enter mobile number"
                  required
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: Education Details with Separate Image Upload for 10th, 12th, and Degree */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Education Details &amp; Certificates</h2>
                <p className="text-xs text-slate-500">
                  Fill your educational background with certificate image upload for each standard (JPG, PNG, JPEG only)
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* 1. 10th (Matriculation) Details Card */}
              <div id="field-tenth" className="border border-slate-200/90 rounded-2xl p-4 sm:p-5 bg-slate-50/40 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-[11px]">
                      1
                    </span>
                    <span>10th (Matriculation) Details</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">Secondary School</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      School Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={tenthSchool}
                        onChange={(e) => setTenthSchool(e.target.value)}
                        placeholder="School name"
                        required
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Board (A to Z) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={tenthBoard}
                      onChange={(e) => setTenthBoard(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none truncate"
                      title={tenthBoard}
                    >
                      {INDIAN_BOARDS_A_TO_Z.map((board) => (
                        <option key={board} value={board}>
                          {board}
                        </option>
                      ))}
                    </select>
                    {tenthBoard === 'Other State / Recognized Board' && (
                      <input
                        type="text"
                        value={customTenthBoard}
                        onChange={(e) => setCustomTenthBoard(e.target.value)}
                        placeholder="Enter board name"
                        className="w-full mt-1.5 px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Year of Passing <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={tenthYear}
                        onChange={(e) => setTenthYear(e.target.value)}
                        placeholder="YYYY"
                        required
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Percentage / CGPA <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Percent className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={tenthScore}
                        onChange={(e) => setTenthScore(e.target.value)}
                        placeholder="e.g. 88%"
                        required
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Dedicated 10th Certificate / Marksheet Image Upload */}
                <div className="pt-2 border-t border-slate-200/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-800">
                        10th Marksheet / Certificate Image <span className="text-red-500">*</span>
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Upload photo or scan of your 10th marksheet (JPG, PNG, JPEG only)
                      </p>
                    </div>

                    <input
                      ref={tenthInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg,.jpg,.jpeg,.png"
                      onChange={(e) => handleSingleImageUpload(e, setTenthImage, '10th Marksheet')}
                      className="hidden"
                    />

                    {tenthImage ? (
                      tenthImage.isUploading ? (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/80 border border-blue-200">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                          <div className="text-left">
                            <p className="text-xs font-bold text-blue-800 truncate max-w-[150px]">
                              {tenthImage.name}
                            </p>
                            <span className="text-[10px] text-blue-600 font-medium">Uploading to ImgBB...</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-emerald-200 shadow-2xs">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <Check className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-slate-800 truncate max-w-[140px]">
                                {tenthImage.name}
                              </p>
                              {tenthImage.imgbbUrl && (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                  ImgBB
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400">{tenthImage.size}</span>
                              {(tenthImage.imgbbUrl || tenthImage.dataUrl) && (
                                <a
                                  href={tenthImage.imgbbUrl || tenthImage.dataUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-semibold text-blue-600 hover:underline"
                                >
                                  View
                                </a>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setTenthImage(null)}
                            className="p-1 text-slate-400 hover:text-red-500 cursor-pointer ml-1"
                            title="Remove file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => tenthInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-blue-700 text-xs font-bold transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
                      >
                        <UploadCloud className="w-4 h-4 text-blue-600" />
                        <span>Upload 10th Certificate</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. 12th / Plus Two Details Card */}
              <div id="field-twelfth" className="border border-slate-200/90 rounded-2xl p-4 sm:p-5 bg-slate-50/40 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center text-[11px]">
                      2
                    </span>
                    <span>Plus Two (+2 / 12th) Details</span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">Higher Secondary</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      College Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={twelfthCollege}
                        onChange={(e) => setTwelfthCollege(e.target.value)}
                        placeholder="College name"
                        required
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Board (A to Z) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={twelfthBoard}
                      onChange={(e) => setTwelfthBoard(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none truncate"
                      title={twelfthBoard}
                    >
                      {INDIAN_BOARDS_A_TO_Z.map((board) => (
                        <option key={board} value={board}>
                          {board}
                        </option>
                      ))}
                    </select>
                    {twelfthBoard === 'Other State / Recognized Board' && (
                      <input
                        type="text"
                        value={customTwelfthBoard}
                        onChange={(e) => setCustomTwelfthBoard(e.target.value)}
                        placeholder="Enter board name"
                        className="w-full mt-1.5 px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Year of Passing <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={twelfthYear}
                        onChange={(e) => setTwelfthYear(e.target.value)}
                        placeholder="YYYY"
                        required
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Percentage / CGPA <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Percent className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={twelfthScore}
                        onChange={(e) => setTwelfthScore(e.target.value)}
                        placeholder="e.g. 84%"
                        required
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Dedicated 12th Certificate / Marksheet Image Upload */}
                <div className="pt-2 border-t border-slate-200/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-800">
                        12th Marksheet / Certificate Image <span className="text-red-500">*</span>
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Upload photo or scan of your 12th marksheet (JPG, PNG, JPEG only)
                      </p>
                    </div>

                    <input
                      ref={twelfthInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg,.jpg,.jpeg,.png"
                      onChange={(e) => handleSingleImageUpload(e, setTwelfthImage, '12th Marksheet')}
                      className="hidden"
                    />

                    {twelfthImage ? (
                      twelfthImage.isUploading ? (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/80 border border-blue-200">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                          <div className="text-left">
                            <p className="text-xs font-bold text-blue-800 truncate max-w-[150px]">
                              {twelfthImage.name}
                            </p>
                            <span className="text-[10px] text-blue-600 font-medium">Uploading to ImgBB...</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-emerald-200 shadow-2xs">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <Check className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-slate-800 truncate max-w-[140px]">
                                {twelfthImage.name}
                              </p>
                              {twelfthImage.imgbbUrl && (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                  ImgBB
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400">{twelfthImage.size}</span>
                              {(twelfthImage.imgbbUrl || twelfthImage.dataUrl) && (
                                <a
                                  href={twelfthImage.imgbbUrl || twelfthImage.dataUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-semibold text-blue-600 hover:underline"
                                >
                                  View
                                </a>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setTwelfthImage(null)}
                            className="p-1 text-slate-400 hover:text-red-500 cursor-pointer ml-1"
                            title="Remove file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => twelfthInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-blue-700 text-xs font-bold transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
                      >
                        <UploadCloud className="w-4 h-4 text-blue-600" />
                        <span>Upload 12th Certificate</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 3. Degree Details Card (OPTIONAL) */}
              <div className="border border-slate-200/90 rounded-2xl p-4 sm:p-5 bg-slate-50/40 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
                  <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center text-[11px]">
                      3
                    </span>
                    <span>Degree (Graduation) Details</span>
                    <span className="ml-1.5 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                      Optional
                    </span>
                  </h3>
                  <span className="text-[11px] text-slate-400 font-medium">Undergraduate / Postgrad (Optional)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      University / College (A to Z) <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <select
                      value={degreeCollege}
                      onChange={(e) => setDegreeCollege(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none truncate"
                      title={degreeCollege}
                    >
                      <option value="">Select University / College (Optional)</option>
                      {INDIAN_UNIVERSITIES_A_TO_Z.map((uni) => (
                        <option key={uni} value={uni}>
                          {uni}
                        </option>
                      ))}
                    </select>
                    {degreeCollege === 'Other University / College' && (
                      <input
                        type="text"
                        value={customDegreeCollege}
                        onChange={(e) => setCustomDegreeCollege(e.target.value)}
                        placeholder="Enter college / university name"
                        className="w-full mt-1.5 px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Course / Degree (A to Z) <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <select
                      value={degreeCourse}
                      onChange={(e) => setDegreeCourse(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none truncate"
                      title={degreeCourse}
                    >
                      <option value="">Select Course / Degree (Optional)</option>
                      {INDIAN_COURSES_A_TO_Z.map((course) => (
                        <option key={course} value={course}>
                          {course}
                        </option>
                      ))}
                    </select>
                    {degreeCourse === 'Other Degree / Course' && (
                      <input
                        type="text"
                        value={customDegreeCourse}
                        onChange={(e) => setCustomDegreeCourse(e.target.value)}
                        placeholder="Enter course / degree name"
                        className="w-full mt-1.5 px-2 py-1 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Year of Passing <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <div className="relative">
                      <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={degreeYear}
                        onChange={(e) => setDegreeYear(e.target.value)}
                        placeholder="YYYY"
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Percentage / CGPA <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <div className="relative">
                      <Percent className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      <input
                        type="text"
                        value={degreeScore}
                        onChange={(e) => setDegreeScore(e.target.value)}
                        placeholder="e.g. 8.4 CGPA"
                        className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:border-blue-500 outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Dedicated Degree Certificate / Marksheet Image Upload */}
                <div className="pt-2 border-t border-slate-200/60">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-800">
                        Degree Marksheet / Certificate Image <span className="text-slate-400 font-normal">(Optional)</span>
                      </label>
                      <p className="text-[11px] text-slate-500">
                        Upload photo or scan of your graduation degree (Optional, JPG, PNG, JPEG only)
                      </p>
                    </div>

                    <input
                      ref={degreeInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/jpg,.jpg,.jpeg,.png"
                      onChange={(e) => handleSingleImageUpload(e, setDegreeImage, 'Degree Marksheet')}
                      className="hidden"
                    />

                    {degreeImage ? (
                      degreeImage.isUploading ? (
                        <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/80 border border-blue-200">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                          <div className="text-left">
                            <p className="text-xs font-bold text-blue-800 truncate max-w-[150px]">
                              {degreeImage.name}
                            </p>
                            <span className="text-[10px] text-blue-600 font-medium">Uploading to ImgBB...</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-2 rounded-xl bg-white border border-emerald-200 shadow-2xs">
                          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <Check className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-slate-800 truncate max-w-[140px]">
                                {degreeImage.name}
                              </p>
                              {degreeImage.imgbbUrl && (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                  ImgBB
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-400">{degreeImage.size}</span>
                              {(degreeImage.imgbbUrl || degreeImage.dataUrl) && (
                                <a
                                  href={degreeImage.imgbbUrl || degreeImage.dataUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] font-semibold text-blue-600 hover:underline"
                                >
                                  View
                                </a>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setDegreeImage(null)}
                            className="p-1 text-slate-400 hover:text-red-500 cursor-pointer ml-1"
                            title="Remove file"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => degreeInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-blue-700 text-xs font-bold transition-all cursor-pointer shadow-2xs self-start sm:self-auto"
                      >
                        <UploadCloud className="w-4 h-4 text-blue-600" />
                        <span>Upload Degree Certificate</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: Subjects, Pricing & Availability */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Briefcase className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Subjects &amp; Availability</h2>
                <p className="text-xs text-slate-500">
                  Select your subjects, classes handled, teaching experience, and available hours
                </p>
              </div>
            </div>

            {/* Subjects You Teach */}
            <div id="field-subjects">
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Subjects You Teach <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {TUTOR_SUBJECT_OPTIONS.map((subject) => {
                  const isChecked = selectedSubjects.includes(subject);
                  return (
                    <button
                      type="button"
                      key={subject}
                      onClick={() => {
                        setSelectedSubjects((prev) =>
                          prev.includes(subject)
                            ? prev.filter((s) => s !== subject)
                            : [...prev, subject]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                        isChecked
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {isChecked ? '✓ ' : '+ '}
                      {subject}
                    </button>
                  );
                })}
              </div>
              {selectedSubjects.length === 0 && (
                <p className="text-[11px] text-red-500 mt-1">Please select at least one subject</p>
              )}
            </div>

            {/* Classes Handled */}
            <div id="field-classes" className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Classes Handled (1st to 12th) <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {TUTOR_CLASS_OPTIONS.map((cls) => {
                  const isChecked = selectedClasses.includes(cls);
                  return (
                    <button
                      type="button"
                      key={cls}
                      onClick={() => {
                        setSelectedClasses((prev) =>
                          prev.includes(cls)
                            ? prev.filter((c) => c !== cls)
                            : [...prev, cls]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer whitespace-nowrap ${
                        isChecked
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {isChecked ? '✓ ' : '+ '}
                      {cls}
                    </button>
                  );
                })}
              </div>
              {selectedClasses.length === 0 && (
                <p className="text-[11px] text-red-500 mt-1">Please select at least one class</p>
              )}
            </div>

            {/* Structured Monthly Tuition Fees Section (Dynamic — only shows classes & subjects selected by tutor) */}
            <div id="field-fees" className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-900">
                    Structured Monthly Fee Schedule (₹ / Month) <span className="text-red-500">*</span>
                  </label>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Fee fields appear dynamically only for the classes you selected above (board-wise for CBSE &amp; ICSE).
                  </p>
                </div>
                {feeSummary.hasAnyFee && (
                  <span className="self-start sm:self-auto px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold font-mono tabular-nums whitespace-nowrap">
                    {feeSummary.configuredCount} fees set • From ₹{feeSummary.minMonthlyFee.toLocaleString('en-IN')}/mo
                  </span>
                )}
              </div>

              {selectedClasses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-center space-y-1">
                  <p className="text-xs font-bold text-slate-700">
                    No classes selected yet
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Tap the classes you handle (1st to 12th) above to enter CBSE &amp; ICSE monthly fees only for those classes.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Part A: Only Selected Classes from 1st to 10th */}
                  {selected1to10Keys.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                      <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-blue-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-900">
                            Selected Classes (1st–10th) — Board-Wise Monthly Fee
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                          {selected1to10Keys.length} {selected1to10Keys.length === 1 ? 'class' : 'classes'}
                        </span>
                      </div>

                      {/* Desktop Table Header */}
                      <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2 bg-white border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <div className="col-span-4">Class</div>
                        <div className="col-span-4">CBSE Board (₹ / Month)</div>
                        <div className="col-span-4">ICSE Board (₹ / Month)</div>
                      </div>

                      <div className="divide-y divide-slate-200/70">
                        {selected1to10Keys.map((clsKey) => {
                          const row = feeStructure.classes1to10?.[clsKey] || {};
                          const cbseSplit = row.cbse && row.cbse > 0 ? calculateFeeSplit(row.cbse) : null;
                          const icseSplit = row.icse && row.icse > 0 ? calculateFeeSplit(row.icse) : null;
                          return (
                            <div
                              key={clsKey}
                              className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3 px-4 py-3 items-start bg-white"
                            >
                              <div className="sm:col-span-4 flex items-center justify-between sm:justify-start gap-2 sm:pt-2.5">
                                <span className="text-xs font-bold text-slate-900">{clsKey} Class</span>
                              </div>

                              <div className="grid grid-cols-1 sm:contents gap-2.5">
                                <div className="sm:col-span-4">
                                  <label className="block sm:hidden text-[10px] font-semibold text-slate-500 mb-1">
                                    CBSE (₹/mo)
                                  </label>
                                  <div className="relative">
                                    <span className="text-xs font-bold text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                      ₹
                                    </span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={row.cbse !== undefined && row.cbse > 0 ? String(row.cbse) : ''}
                                      onChange={(e) => handleClass1to10FeeChange(clsKey, 'cbse', e.target.value)}
                                      placeholder="e.g. 2500"
                                      className="w-full h-10 pl-7 pr-3 text-xs sm:text-sm font-mono tabular-nums font-semibold rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                    />
                                  </div>
                                  {cbseSplit && (
                                    <div className="mt-1.5 rounded-lg bg-emerald-50/90 border border-emerald-200/80 px-2.5 py-1.5 text-[10.5px] leading-snug font-mono tabular-nums space-y-0.5">
                                      <div className="flex items-center justify-between gap-1 text-slate-600">
                                        <span>Entered:</span>
                                        <span className="font-semibold text-slate-900">
                                          ₹{cbseSplit.grossFee.toLocaleString('en-IN')}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between gap-1 text-slate-500">
                                        <span>Platform ({PLATFORM_FEE_PERCENT}%):</span>
                                        <span>-₹{cbseSplit.platformFee.toLocaleString('en-IN')}</span>
                                      </div>
                                      <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-emerald-200/70 text-emerald-800 font-bold">
                                        <span>You Get ({TUTOR_SHARE_PERCENT}%):</span>
                                        <span>₹{cbseSplit.tutorEarnings.toLocaleString('en-IN')}/mo</span>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                <div className="sm:col-span-4">
                                  <label className="block sm:hidden text-[10px] font-semibold text-slate-500 mb-1">
                                    ICSE (₹/mo)
                                  </label>
                                  <div className="relative">
                                    <span className="text-xs font-bold text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                      ₹
                                    </span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      value={row.icse !== undefined && row.icse > 0 ? String(row.icse) : ''}
                                      onChange={(e) => handleClass1to10FeeChange(clsKey, 'icse', e.target.value)}
                                      placeholder="e.g. 2800"
                                      className="w-full h-10 pl-7 pr-3 text-xs sm:text-sm font-mono tabular-nums font-semibold rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                    />
                                  </div>
                                  {icseSplit && (
                                    <div className="mt-1.5 rounded-lg bg-emerald-50/90 border border-emerald-200/80 px-2.5 py-1.5 text-[10.5px] leading-snug font-mono tabular-nums space-y-0.5">
                                      <div className="flex items-center justify-between gap-1 text-slate-600">
                                        <span>Entered:</span>
                                        <span className="font-semibold text-slate-900">
                                          ₹{icseSplit.grossFee.toLocaleString('en-IN')}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between gap-1 text-slate-500">
                                        <span>Platform ({PLATFORM_FEE_PERCENT}%):</span>
                                        <span>-₹{icseSplit.platformFee.toLocaleString('en-IN')}</span>
                                      </div>
                                      <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-emerald-200/70 text-emerald-800 font-bold">
                                        <span>You Get ({TUTOR_SHARE_PERCENT}%):</span>
                                        <span>₹{icseSplit.tutorEarnings.toLocaleString('en-IN')}/mo</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Part B: Only Shown If 11th or 12th Class Selected */}
                  {selectedSeniorKeys.length > 0 && (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 overflow-hidden">
                      <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
                          <span className="text-xs font-bold text-slate-900">
                            Selected Senior Classes ({selectedSeniorKeys.join(' & ')}) — Subject-Wise Fee
                          </span>
                        </div>

                        {/* Tabs Only for Selected Senior Classes */}
                        <div className="inline-flex p-1 rounded-xl bg-white border border-slate-200 self-start sm:self-auto">
                          {selectedSeniorKeys.map((clsKey) => {
                            const isTabActive = activeSeniorFeeTab === clsKey;
                            const configuredSubs = Object.values(
                              feeStructure.classes11to12?.[clsKey] || ({} as Record<string, { cbse?: number; icse?: number }>)
                            ).filter(
                              (e: { cbse?: number; icse?: number }) => (e?.cbse && e.cbse > 0) || (e?.icse && e.icse > 0)
                            ).length;
                            return (
                              <button
                                key={clsKey}
                                type="button"
                                onClick={() => setActiveSeniorFeeTab(clsKey)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                                  isTabActive
                                    ? 'bg-[#0c2340] text-white shadow-2xs'
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <span>{clsKey} Class</span>
                                {configuredSubs > 0 && (
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums ${
                                      isTabActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800'
                                    }`}
                                  >
                                    {configuredSubs}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {seniorSubjectsToRender.length === 0 ? (
                        <div className="p-4 bg-white text-center text-xs text-slate-500 font-medium">
                          Select at least one subject in &quot;Subjects You Teach&quot; above to enter subject-wise fees for {activeSeniorFeeTab} Class.
                        </div>
                      ) : (
                        <>
                          {/* Desktop Table Header for 11th/12th */}
                          <div className="hidden sm:grid grid-cols-12 gap-3 px-4 py-2 bg-white border-b border-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                            <div className="col-span-4">{activeSeniorFeeTab} Subject</div>
                            <div className="col-span-4">CBSE Board (₹ / Month)</div>
                            <div className="col-span-4">ICSE / ISC Board (₹ / Month)</div>
                          </div>

                          <div className="divide-y divide-slate-200/70">
                            {seniorSubjectsToRender.map((subject) => {
                              const entry = feeStructure.classes11to12?.[activeSeniorFeeTab]?.[subject] || {};
                              const seniorCbseSplit =
                                entry.cbse && entry.cbse > 0 ? calculateFeeSplit(entry.cbse) : null;
                              const seniorIcseSplit =
                                entry.icse && entry.icse > 0 ? calculateFeeSplit(entry.icse) : null;
                              return (
                                <div
                                  key={`${activeSeniorFeeTab}-${subject}`}
                                  className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-3 px-4 py-3 items-start bg-white"
                                >
                                  <div className="sm:col-span-4 flex items-center justify-between sm:justify-start gap-2 sm:pt-2.5">
                                    <span className="text-xs font-bold text-slate-900">{subject}</span>
                                  </div>

                                  <div className="grid grid-cols-1 xs:grid-cols-2 sm:contents gap-2.5">
                                    <div className="sm:col-span-4">
                                      <label className="block sm:hidden text-[10px] font-semibold text-slate-500 mb-1">
                                        CBSE (₹/mo)
                                      </label>
                                      <div className="relative">
                                        <span className="text-xs font-bold text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                          ₹
                                        </span>
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          value={entry.cbse !== undefined && entry.cbse > 0 ? String(entry.cbse) : ''}
                                          onChange={(e) =>
                                            handleClass11to12FeeChange(activeSeniorFeeTab, subject, 'cbse', e.target.value)
                                          }
                                          placeholder="e.g. 3500"
                                          className="w-full h-10 pl-7 pr-3 text-xs sm:text-sm font-mono tabular-nums font-semibold rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                        />
                                      </div>
                                      {seniorCbseSplit && (
                                        <div className="mt-1.5 rounded-lg bg-emerald-50/90 border border-emerald-200/80 px-2.5 py-1.5 text-[10.5px] leading-snug font-mono tabular-nums space-y-0.5">
                                          <div className="flex items-center justify-between gap-1 text-slate-600">
                                            <span>Entered:</span>
                                            <span className="font-semibold text-slate-900">
                                              ₹{seniorCbseSplit.grossFee.toLocaleString('en-IN')}
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between gap-1 text-slate-500">
                                            <span>Platform ({PLATFORM_FEE_PERCENT}%):</span>
                                            <span>-₹{seniorCbseSplit.platformFee.toLocaleString('en-IN')}</span>
                                          </div>
                                          <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-emerald-200/70 text-emerald-800 font-bold">
                                            <span>You Get ({TUTOR_SHARE_PERCENT}%):</span>
                                            <span>₹{seniorCbseSplit.tutorEarnings.toLocaleString('en-IN')}/mo</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    <div className="sm:col-span-4">
                                      <label className="block sm:hidden text-[10px] font-semibold text-slate-500 mb-1">
                                        ICSE (₹/mo)
                                      </label>
                                      <div className="relative">
                                        <span className="text-xs font-bold text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                          ₹
                                        </span>
                                        <input
                                          type="text"
                                          inputMode="numeric"
                                          value={entry.icse !== undefined && entry.icse > 0 ? String(entry.icse) : ''}
                                          onChange={(e) =>
                                            handleClass11to12FeeChange(activeSeniorFeeTab, subject, 'icse', e.target.value)
                                          }
                                          placeholder="e.g. 3800"
                                          className="w-full h-10 pl-7 pr-3 text-xs sm:text-sm font-mono tabular-nums font-semibold rounded-xl border border-slate-200 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
                                        />
                                      </div>
                                      {seniorIcseSplit && (
                                        <div className="mt-1.5 rounded-lg bg-emerald-50/90 border border-emerald-200/80 px-2.5 py-1.5 text-[10.5px] leading-snug font-mono tabular-nums space-y-0.5">
                                          <div className="flex items-center justify-between gap-1 text-slate-600">
                                            <span>Entered:</span>
                                            <span className="font-semibold text-slate-900">
                                              ₹{seniorIcseSplit.grossFee.toLocaleString('en-IN')}
                                            </span>
                                          </div>
                                          <div className="flex items-center justify-between gap-1 text-slate-500">
                                            <span>Platform ({PLATFORM_FEE_PERCENT}%):</span>
                                            <span>-₹{seniorIcseSplit.platformFee.toLocaleString('en-IN')}</span>
                                          </div>
                                          <div className="flex items-center justify-between gap-1 pt-0.5 border-t border-emerald-200/70 text-emerald-800 font-bold">
                                            <span>You Get ({TUTOR_SHARE_PERCENT}%):</span>
                                            <span>₹{seniorIcseSplit.tutorEarnings.toLocaleString('en-IN')}/mo</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Bottom Live Earnings Preview Summary After Platform Fee Deduction */}
                  {(() => {
                    const enteredRows: { label: string; board: string; gross: number }[] = [];
                    selected1to10Keys.forEach((clsKey) => {
                      const row = feeStructure.classes1to10?.[clsKey];
                      if (row?.cbse && row.cbse > 0) {
                        enteredRows.push({ label: `${clsKey} Class`, board: 'CBSE', gross: row.cbse });
                      }
                      if (row?.icse && row.icse > 0) {
                        enteredRows.push({ label: `${clsKey} Class`, board: 'ICSE', gross: row.icse });
                      }
                    });
                    selectedSeniorKeys.forEach((clsKey) => {
                      const subMap = feeStructure.classes11to12?.[clsKey] || {};
                      const allClassSubs = Array.from(
                        new Set([...seniorSubjectsToRender, ...Object.keys(subMap)])
                      );
                      allClassSubs.forEach((sub) => {
                        const entry = subMap[sub];
                        if (entry?.cbse && entry.cbse > 0) {
                          enteredRows.push({ label: `${clsKey} • ${sub}`, board: 'CBSE', gross: entry.cbse });
                        }
                        if (entry?.icse && entry.icse > 0) {
                          enteredRows.push({ label: `${clsKey} • ${sub}`, board: 'ICSE/ISC', gross: entry.icse });
                        }
                      });
                    });

                    if (enteredRows.length === 0) {
                      return (
                        <div className="rounded-xl bg-blue-50/70 border border-blue-200/80 px-3.5 py-2.5 flex items-start gap-2.5 text-[11px] text-blue-900">
                          <DollarSign className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                          <span>
                            Enter any monthly fee above to preview the entered price,{' '}
                            <strong>{PLATFORM_FEE_PERCENT}% platform fee</strong> deduction, and your{' '}
                            <strong>{TUTOR_SHARE_PERCENT}% net monthly earnings</strong> per student.
                          </span>
                        </div>
                      );
                    }

                    return (
                      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white overflow-hidden">
                        <div className="px-4 py-2.5 bg-emerald-100/70 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <DollarSign className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span className="text-xs font-extrabold text-emerald-950">
                              Your Earnings Preview (After {PLATFORM_FEE_PERCENT}% Platform Fee)
                            </span>
                          </div>
                          <span className="text-[10.5px] font-bold px-2 py-0.5 rounded-full bg-white text-emerald-800 border border-emerald-300">
                            {TUTOR_SHARE_PERCENT}% Tutor Share • {PLATFORM_FEE_PERCENT}% Platform Fee
                          </span>
                        </div>

                        <div className="divide-y divide-emerald-100 max-h-52 overflow-y-auto">
                          {enteredRows.map((item) => {
                            const split = calculateFeeSplit(item.gross);
                            return (
                              <div
                                key={`${item.label}-${item.board}`}
                                className="px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="font-bold text-slate-900 truncate">{item.label}</span>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                                    {item.board}
                                  </span>
                                </div>
                                <div className="flex flex-wrap items-center gap-3 font-mono tabular-nums text-[11px]">
                                  <span className="text-slate-600">
                                    Entered:{' '}
                                    <strong className="text-slate-900">
                                      ₹{split.grossFee.toLocaleString('en-IN')}
                                    </strong>
                                  </span>
                                  <span className="text-rose-600">
                                    Fee ({PLATFORM_FEE_PERCENT}%): -₹{split.platformFee.toLocaleString('en-IN')}
                                  </span>
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-bold">
                                    You Get: ₹{split.tutorEarnings.toLocaleString('en-IN')}/mo
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {selectedClasses.length > 0 && !feeSummary.hasAnyFee && (
                <p className="text-[11px] text-red-500">
                  Please enter monthly fees for the classes and boards you selected.
                </p>
              )}
            </div>

            {/* Total Teaching Experience */}
            <div className="pt-2 border-t border-slate-100">
              <div className="max-w-xs">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Total Teaching Experience <span className="text-red-500">*</span>
                </label>
                <select
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all bg-white"
                >
                  <option value="1-2 years">1-2 years</option>
                  <option value="3-5 years">3-5 years</option>
                  <option value="5-8 years">5-8 years</option>
                  <option value="8+ years">8+ years</option>
                </select>
              </div>
            </div>

            {/* Languages Known */}
            <div className="pt-2 border-t border-slate-100">
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Languages You Speak with Students
              </label>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={languages.english}
                    onChange={(e) =>
                      setLanguages((prev) => ({ ...prev, english: e.target.checked }))
                    }
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span>English</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={languages.hindi}
                    onChange={(e) =>
                      setLanguages((prev) => ({ ...prev, hindi: e.target.checked }))
                    }
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span>Hindi</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={languages.odia}
                    onChange={(e) =>
                      setLanguages((prev) => ({ ...prev, odia: e.target.checked }))
                    }
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span>Odia</span>
                </label>

                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={languages.other}
                    onChange={(e) =>
                      setLanguages((prev) => ({ ...prev, other: e.target.checked }))
                    }
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                  />
                  <span>Other</span>
                </label>

                {languages.other && (
                  <input
                    type="text"
                    value={otherLanguageText}
                    onChange={(e) => setOtherLanguageText(e.target.value)}
                    placeholder="e.g. Telugu"
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 outline-none focus:border-blue-500 w-28"
                  />
                )}
              </div>
            </div>

            {/* 1-Hour Availability Checklist */}
            <div id="field-slots" className="pt-2 border-t border-slate-100 space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800">
                  Available Time Slots (1-Hour Intervals) <span className="text-red-500">*</span>
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Select the hours when you can take home tuition sessions (6:00 AM to 9:00 PM)
                </p>
              </div>

              {/* 1-Hour Checklist Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                {AVAILABLE_1HR_SLOTS.map((slot) => {
                  const isSelected = availableTimeSlots.includes(slot);
                  return (
                    <label
                      key={slot}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/70 text-blue-900 font-semibold shadow-2xs'
                          : 'border-slate-200/90 hover:border-slate-300 bg-white text-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSlot(slot)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                      />
                      <Clock
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-blue-600' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{slot}</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>
                  Selected:{' '}
                  <strong className="text-blue-600 font-bold">{availableTimeSlots.length}</strong> of{' '}
                  {AVAILABLE_1HR_SLOTS.length} slots
                </span>
                {availableTimeSlots.length === 0 && (
                  <span className="text-amber-600 font-semibold">
                    Please select at least one hour slot
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 6: About Yourself */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">About Yourself</h2>
                <p className="text-xs text-slate-500">
                  Introduce your teaching style and philosophy to parents in Rayagada
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                About Yourself (Short Bio) <span className="text-red-500">*</span>
              </label>
              <textarea
                id="field-bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell parents and students about your pedagogical style, how you conduct homework revisions, and your experience..."
                required
                className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
              />
              <span className="text-[10px] text-slate-400 block mt-1">
                {bio.length} characters (min 30 recommended)
              </span>
            </div>
          </div>

          {/* SECTION 7: KYC Verification */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">KYC Verification</h2>
                <p className="text-xs text-slate-500">
                  Provide your Aadhaar ID and document for background verification
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Aadhaar Number */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Aadhaar Number (12 Digits) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    id="field-aadhaar-number"
                    type="text"
                    maxLength={14}
                    value={aadhaarNumber}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/\D/g, '').slice(0, 12);
                      const formatted = clean.replace(/(\d{4})/g, '$1 ').trim();
                      setAadhaarNumber(formatted);
                    }}
                    placeholder="XXXX XXXX XXXX"
                    className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all tracking-wider font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Encrypted and securely stored for verified tutor badge.</p>
              </div>

              {/* Aadhaar Card Upload */}
              <div id="field-aadhaar-doc">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Upload Aadhaar Card (Front/Back) <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  ref={aadhaarInputRef}
                  accept="image/jpeg,image/png,image/jpg"
                  onChange={(e) => handleSingleImageUpload(e, setAadhaarImage, 'Aadhaar_Card')}
                  className="hidden"
                />

                {aadhaarImage ? (
                  aadhaarImage.isUploading ? (
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50/80 border border-blue-200">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                      <span className="text-xs font-bold text-blue-800 truncate">Uploading Aadhaar...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div className="truncate text-xs">
                          <span className="font-semibold text-slate-800 truncate block">{aadhaarImage.name}</span>
                          <span className="text-[10px] text-slate-400">{aadhaarImage.size}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAadhaarImage(null)}
                        className="p-1 text-slate-400 hover:text-red-500 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )
                ) : (
                  <button
                    type="button"
                    onClick={() => aadhaarInputRef.current?.click()}
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-blue-600 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload Aadhaar Photo</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 8: Tutor Terms & Conditions */}
          <div
            id="field-terms"
            className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4"
          >
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Tutor Terms &amp; Conditions <span className="text-red-500">*</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Mandatory teaching, payout, and conduct guidelines for Kumari Institute Home Tutors
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 space-y-3 text-xs text-slate-700 leading-relaxed">
              <div className="p-3 rounded-lg bg-white border border-amber-200/80 space-y-1">
                <p className="font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>1. Mandatory 1-Month (30 Days) Teaching Commitment for Fee Eligibility</span>
                </p>
                <p className="text-[11px] sm:text-xs text-slate-700">
                  Once you receive and accept a parent/student tuition assignment, you <strong>must teach the student for at least 1 complete month (30 days)</strong> to receive the tuition fee. If you discontinue, abandon classes, or leave before completing 1 full month of teaching, <strong>the tuition fee will NOT be paid or released to you</strong>.
                </p>
              </div>

              <ul className="space-y-2 list-none pl-0 text-[11px] sm:text-xs text-slate-700">
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-700 shrink-0">2.</span>
                  <span>
                    <strong>80% / 20% Fee Split &amp; Payout Release:</strong> You earn <strong>80%</strong> of the parent&apos;s monthly tuition fee while <strong>20%</strong> goes toward Kumari Institute platform, verification, and coordinator support. When a parent completes fee payment successfully, your 80% share enters your <strong>Pending Parent Fee</strong> section and unlocks to <strong>Available Balance</strong> for withdrawal only after completing 1 month (30 days) of teaching.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-700 shrink-0">3.</span>
                  <span>
                    <strong>Genuine Credentials &amp; Verification:</strong> All academic marksheets (10th, 12th, Degree), residential address details, live GPS coordinates, and Aadhaar KYC documents uploaded must be 100% authentic. False or tampered information leads to immediate rejection and permanent deactivation.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-700 shrink-0">4.</span>
                  <span>
                    <strong>Punctuality, Attendance &amp; Conduct:</strong> Tutors must be punctual for all committed 1-hour home tuition slots, maintain disciplined and respectful behavior at student residences, and give prior notice to both parents and the institute coordinator before any emergency leave or termination.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="font-bold text-blue-700 shrink-0">5.</span>
                  <span>
                    <strong>Platform Payment Policy:</strong> All parent tuition fee payments must be processed strictly through Kumari Institute. Direct off-platform cash collection or bypassing the institute violates tutor agreement terms and forfeits platform support and payouts.
                  </span>
                </li>
              </ul>
            </div>

            <label
              htmlFor="accept-tutor-terms"
              className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                termsAccepted
                  ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                  : 'bg-slate-50 border-slate-200 hover:border-blue-300 text-slate-800'
              }`}
            >
              <input
                id="accept-tutor-terms"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
              />
              <span className="text-xs sm:text-sm font-semibold leading-snug">
                I have read and agree to all Kumari Institute Tutor Terms &amp; Conditions, including the mandatory <strong>1-month (30 days) minimum teaching requirement</strong> to become eligible for fee payment.
              </span>
            </label>
          </div>

          {/* Bottom Action Bar */}
          <div className={`flex items-center pt-5 border-t border-slate-200 ${isFirstTimeOnboarding ? 'justify-end' : 'justify-between'}`}>
            {!isFirstTimeOnboarding && (
              <button
                type="button"
                onClick={onBackToDashboard}
                className="inline-flex items-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm transition-all cursor-pointer shadow-2xs"
              >
                <X className="w-4 h-4 text-slate-500" />
                <span>Close</span>
              </button>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-md hover:shadow-lg disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Submitting Profile...</span>
                </>
              ) : (
                <>
                  <span>Submit Profile for Verification</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
