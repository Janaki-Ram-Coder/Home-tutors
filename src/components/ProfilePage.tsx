import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  Calendar,
  MapPin,
  Video,
  Receipt,
  Phone,
  Mail,
  X,
  Printer,
  Edit3,
  Save,
  CheckCircle2,
  Clock,
  Star,
  MessageSquare,
  LogOut,
  GraduationCap,
  School,
  Loader2,
  Check,
  ChevronRight,
  BookOpen,
  Users,
  CheckSquare,
  ShieldCheck,
  AlertCircle,
  Wallet,
  IndianRupee,
  ArrowUpRight,
  UploadCloud,
  Camera,
  Search,
  CreditCard
} from 'lucide-react';
import {
  AppUserProfile,
  updateUserProfileInFirebase,
  isTeacherApprovedInRegistry,
  markTeacherApprovedInRegistry,
  saveEnquiryToFirestore,
  discontinueTutorBooking
} from '../services/firebaseAuth';
import { useBackButtonDismiss } from '../hooks/useBackButtonDismiss';
import { instituteInfo } from '../data/instituteData';
import {
  TUTOR_SUBJECT_OPTIONS,
  TUTOR_CLASS_OPTIONS,
  CLASS_1_TO_10_KEYS,
  SENIOR_CLASSES_KEYS,
  SENIOR_SUBJECTS_LIST,
  TutorFeeStructure,
  createEmptyFeeStructure,
  mergeFeeStructure,
  sanitizeFeeStructure,
  summarizeFeeStructure
} from '../data/tutorsData';
import { AVAILABLE_1HR_SLOTS } from './TeacherCompleteProfilePage';
import {
  INDIAN_BOARDS_A_TO_Z,
  INDIAN_UNIVERSITIES_A_TO_Z,
  INDIAN_COURSES_A_TO_Z
} from '../data/educationData';
import { compressImageToBase64 } from '../utils/imageUtils';
import {
  TutorWithdrawalRequest,
  calculateTutorEarnings,
  calculateFeeSplit,
  PLATFORM_FEE_PERCENT,
  TUTOR_SHARE_PERCENT,
  doesFeeRecordBelongToTutor,
  submitWithdrawalRequest,
  subscribeToTutorWithdrawals
} from '../services/payoutService';
import {
  ReceivedFeeRecord,
  getTutorPaymentStatus,
  subscribeToReceivedFees
} from '../services/feePaymentService';
import { PayTutorFeeModal } from './PayTutorFeeModal';
import { doc, onSnapshot, collection, query } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ProfilePageProps {
  user: AppUserProfile | null;
  onNavigateHome: () => void;
  onNavigateCourses: () => void;
  onNavigateTutors: () => void;
  onOpenParentStudentForm?: () => void;
  onCompleteTeacherProfile?: () => void;
  onLogout: () => void;
  onProfileUpdated?: (updatedUser: AppUserProfile) => void;
  onOpenEnquiry?: () => void;
  onOpenDemoBooking?: () => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  user,
  onNavigateHome,
  onNavigateCourses,
  onNavigateTutors,
  onOpenParentStudentForm,
  onCompleteTeacherProfile,
  onLogout,
  onProfileUpdated,
  onOpenEnquiry,
}) => {
  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [isAvailabilityModalOpen, setIsAvailabilityModalOpen] = useState(false);
  const [isLiveClassModalOpen, setIsLiveClassModalOpen] = useState(false);
  const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<{
    id: string;
    date: string;
    description: string;
    amount: string;
    status: string;
    utrNumber?: string;
    transferMethod?: string;
    paymentGateway?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    signatureVerified?: boolean;
    nextDueDate?: string;
    studentName?: string;
    tutorName?: string;
    paymentSlipUrl?: string;
    adminNote?: string;
  } | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Pay Fee Modal & Payment Success Pop-Up state for Parent
  const [payFeeModalBooking, setPayFeeModalBooking] = useState<any | null>(null);
  const [paymentSuccessPopup, setPaymentSuccessPopup] = useState<{
    record: ReceivedFeeRecord;
    receipt: any;
  } | null>(null);
  const [parentFeeRecords, setParentFeeRecords] = useState<ReceivedFeeRecord[]>([]);
  const [continuedBookings, setContinuedBookings] = useState<Record<string, boolean>>({});
  const [discontinuedBookingKeys, setDiscontinuedBookingKeys] = useState<Record<string, boolean>>({});
  const [discontinueConfirmBooking, setDiscontinueConfirmBooking] = useState<any | null>(null);
  const [isDiscontinuingBooking, setIsDiscontinuingBooking] = useState(false);
  const [discontinueToast, setDiscontinueToast] = useState<string | null>(null);
  const [, setCountdownTick] = useState(0);
  const [dismissedFeeToast, setDismissedFeeToast] = useState<boolean>(() => {
    try {
      return localStorage.getItem('parent_dismissed_fee_toast') === 'true';
    } catch {
      return false;
    }
  });

  // Withdrawal request form state
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawMethod, setWithdrawMethod] = useState<'upi' | 'bank_transfer'>('upi');
  const [withdrawUpiId, setWithdrawUpiId] = useState('');
  const [withdrawBankName, setWithdrawBankName] = useState('');
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState('');
  const [withdrawIfsc, setWithdrawIfsc] = useState('');
  const [withdrawAccountHolder, setWithdrawAccountHolder] = useState('');
  const [withdrawNotes, setWithdrawNotes] = useState('');
  const [isSubmittingWithdraw, setIsSubmittingWithdraw] = useState(false);
  const [withdrawNotice, setWithdrawNotice] = useState<string | null>(null);
  const [tutorWithdrawals, setTutorWithdrawals] = useState<TutorWithdrawalRequest[]>([]);
  const [allReceivedFeeRecords, setAllReceivedFeeRecords] = useState<ReceivedFeeRecord[]>([]);

  // Message state
  const [messageRecipient, setMessageRecipient] = useState<{
    name: string;
    role: string;
    phone?: string;
  }>({
    name: '',
    role: '',
    phone: ''
  });
  const [messageText, setMessageText] = useState('');
  const [messageSent, setMessageSent] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [liveClassNotice, setLiveClassNotice] = useState<string | null>(null);

  // Live class selected state (for parent)
  const [selectedLiveClass, setSelectedLiveClass] = useState<{
    subject: string;
    teacher: string;
    time: string;
    date: string;
  } | null>(null);

  // Common Profile fields
  const [liveUser, setLiveUser] = useState<AppUserProfile | null>(user);
  const isTeacher = (liveUser?.role || user?.role) === 'teacher';
  const [name, setName] = useState(user?.name || user?.fullName || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [locality, setLocality] = useState(user?.locality || user?.address || '');

  // Teacher Profile Picture in Edit modal
  const [avatarUrl, setAvatarUrl] = useState<string>(
    user?.avatar || user?.photoUrl || ''
  );
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Parent Specific fields
  const [childName, setChildName] = useState(user?.childName || '');
  const [childGrade, setChildGrade] = useState(user?.childGrade || '');
  const [childBoard, setChildBoard] = useState((user as any)?.childBoard || (user as any)?.board || '');
  const [childSchool, setChildSchool] = useState(user?.childSchool || '');

  // Teacher Specific fields
  const [teacherQualification, setTeacherQualification] = useState(user?.qualification || user?.highestQualification || '');
  const [teacherUniversity, setTeacherUniversity] = useState(user?.university || '');
  const [teacherExperience, setTeacherExperience] = useState(user?.experience || '');
  const [teacherHourlyFee, setTeacherHourlyFee] = useState<string>(
    user?.hourlyCharges?.toString() || user?.hourlyFee?.toString() || ''
  );
  const [teacherBio, setTeacherBio] = useState(user?.bio || '');
  const [teacherSubjects, setTeacherSubjects] = useState<string[]>(
    Array.isArray(user?.subjects) ? user.subjects : []
  );
  const [teacherClasses, setTeacherClasses] = useState<string[]>(
    Array.isArray((user as any)?.classesHandled)
      ? (user as any).classesHandled
      : Array.isArray(user?.classes)
      ? user.classes
      : []
  );
  const [teacherFeeStructure, setTeacherFeeStructure] = useState<TutorFeeStructure>(() =>
    mergeFeeStructure(user?.feeStructure)
  );
  const [activeSeniorFeeTab, setActiveSeniorFeeTab] = useState<'11th' | '12th'>('11th');

  // Teacher Availability slots for quick access & Edit Details modal
  const [teacherSlots, setTeacherSlots] = useState<string[]>(
    Array.isArray(user?.availableTimeSlots)
      ? user.availableTimeSlots
      : Array.isArray((user as any)?.timeSlots)
      ? (user as any).timeSlots
      : []
  );
  const [isSavingSlots, setIsSavingSlots] = useState(false);
  const [slotsSavedToast, setSlotsSavedToast] = useState(false);

  // Dedicated Parent Details Form Modal State
  const [isParentDetailsModalOpen, setIsParentDetailsModalOpen] = useState(false);
  const [parentDetailsToast, setParentDetailsToast] = useState<string | null>(null);
  const [isSavingParentDetails, setIsSavingParentDetails] = useState(false);

  const handleSaveParentStudentDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    setIsSavingParentDetails(true);
    setParentDetailsToast(null);
    try {
      const payload: Partial<AppUserProfile> = {
        role: 'parent',
        name: name.trim() || user.name,
        fullName: name.trim() || user.name,
        phone: phone.trim() || user.phone,
        locality: locality.trim() || user.locality,
        childName: childName.trim(),
        studentName: childName.trim(),
        childGrade: childGrade.trim(),
        childBoard: childBoard.trim() || 'CBSE',
        board: childBoard.trim() || 'CBSE',
        childSchool: childSchool.trim(),
        profileCompleted: true,
        learningRequirementsSubmitted: true
      };

      const updated = await updateUserProfileInFirebase(user.uid, payload);
      if (onProfileUpdated) {
        onProfileUpdated(updated);
      }
      setParentDetailsToast('Student and parent details successfully stored into database!');
      setTimeout(() => {
        setIsParentDetailsModalOpen(false);
      }, 900);
      setTimeout(() => {
        setParentDetailsToast(null);
      }, 4500);
    } catch (err) {
      console.error('Error saving student details:', err);
    } finally {
      setIsSavingParentDetails(false);
    }
  };

  // Keep daily countdown fresh across midnight / tab switches
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownTick((t) => t + 1);
    }, 60 * 1000);
    const onFocus = () => setCountdownTick((t) => t + 1);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const handleConfirmDiscontinue = async () => {
    if (!discontinueConfirmBooking) return;
    const target = discontinueConfirmBooking;
    const key = String(
      target.id || target.assignedTutorId || target.requestedTutorId || target.tutorId || ''
    );
    setIsDiscontinuingBooking(true);
    try {
      const res = await discontinueTutorBooking({
        booking: target,
        parentUser: activeUserData || user
      });
      if (key) {
        setDiscontinuedBookingKeys((prev) => ({ ...prev, [key]: true }));
        setContinuedBookings((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      }
      if (res.updatedParent && onProfileUpdated && (activeUserData || user)) {
        onProfileUpdated({
          ...(activeUserData || user)!,
          ...res.updatedParent
        });
      }
      const tName =
        target.assignedTutorName ||
        target.requestedTutorName ||
        target.tutorName ||
        target.name ||
        'Home Tutor';
      setDiscontinueToast(
        `${tName} has been discontinued and removed from your Booked Tutors & the tutor's Assigned Students.`
      );
      setTimeout(() => setDiscontinueToast(null), 5000);
      setDiscontinueConfirmBooking(null);
    } catch (err) {
      console.error('Error discontinuing tutor:', err);
    } finally {
      setIsDiscontinuingBooking(false);
    }
  };

  // Auto-prompt parent to complete student details if not yet completed after logging in
  useEffect(() => {
    if (!isTeacher && user?.uid) {
      const isMissing =
        !user.childName?.trim() ||
        !user.childGrade?.trim() ||
        (!user.childBoard?.trim() && !(user as any).board?.trim());
      if (isMissing) {
        const timer = setTimeout(() => {
          setIsParentDetailsModalOpen(true);
        }, 400);
        return () => clearTimeout(timer);
      }
    }
  }, [isTeacher, user?.uid, user?.childName, user?.childGrade, user?.childBoard]);

  // Live Firestore listener for active user document
  useEffect(() => {
    if (!user?.uid) return;
    const colName = isTeacher ? 'teachers' : 'parents';
    const docRef = doc(db, colName, user.uid);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const isApprovedInFirestore = Boolean(
          data.isApproved === true ||
          data.status === 'approved' ||
          data.verified === true ||
          data.kycStatus === 'verified' ||
          data.kycStatus === 'approved' ||
          data.verificationStatus === 'Verified Genuine Tutor' ||
          isTeacherApprovedInRegistry(user.uid, (user as any).id, user.email, (user as any).phone)
        );
        const updated: AppUserProfile = {
          ...user,
          ...data,
          uid: user.uid,
          name: data.fullName || data.name || user.name,
          email: data.email || user.email,
          role: (data.role || user.role) as 'parent' | 'teacher',
          phone: data.phone || '',
          locality: data.locality || data.address || '',
          childName: data.childName || '',
          childGrade: data.childGrade || '',
          childBoard: data.childBoard || data.board || '',
          childSchool: data.childSchool || '',
          qualification: data.highestQualification || data.qualification || '',
          university: data.university || '',
          experience: data.experience || '',
          hourlyCharges: data.hourlyCharges || data.hourlyRate,
          hourlyFee: data.hourlyFee || data.hourlyRate,
          monthlyFee: data.monthlyFee,
          bio: data.bio || '',
          avatar: data.avatar || data.photoUrl || '',
          subjects: Array.isArray(data.subjects) ? data.subjects : [],
          classesHandled: Array.isArray(data.classesHandled)
            ? data.classesHandled
            : Array.isArray(data.classes)
            ? data.classes
            : [],
          classes: Array.isArray(data.classes)
            ? data.classes
            : Array.isArray(data.classesHandled)
            ? data.classesHandled
            : [],
          feeStructure: data.feeStructure || undefined,
          boardsSupported: Array.isArray(data.boardsSupported) ? data.boardsSupported : undefined,
          availableTimeSlots: Array.isArray(data.availableTimeSlots)
            ? data.availableTimeSlots
            : Array.isArray(data.timeSlots)
            ? data.timeSlots
            : [],
          profileCompleted: Boolean(data.profileCompleted),
          verified: isApprovedInFirestore || Boolean(data.verified),
          kycStatus: isApprovedInFirestore ? 'approved' : (data.kycStatus || 'pending')
        };
        if (isApprovedInFirestore) {
          (updated as any).isApproved = true;
          (updated as any).status = 'approved';
          (updated as any).kycStatus = 'approved';
          (updated as any).verificationStatus = 'Verified Genuine Tutor';
          markTeacherApprovedInRegistry(user.uid);
          if (user.email) markTeacherApprovedInRegistry(user.email);
        }
        setLiveUser(updated);
        if (!isEditModalOpen) {
          setName(updated.name);
          setPhone(updated.phone || '');
          setLocality(updated.locality || '');
          if (updated.avatar) setAvatarUrl(updated.avatar);
          if (!isTeacher) {
            setChildName(updated.childName || '');
            setChildGrade(updated.childGrade || '');
            setChildBoard((updated as any).childBoard || '');
            setChildSchool(updated.childSchool || '');
          } else {
            setTeacherQualification(updated.qualification || '');
            setTeacherUniversity(updated.university || '');
            setTeacherExperience(updated.experience || '');
            setTeacherHourlyFee(updated.hourlyCharges?.toString() || updated.hourlyFee?.toString() || '');
            setTeacherBio(updated.bio || '');
            setTeacherSubjects(Array.isArray(updated.subjects) ? updated.subjects : []);
            setTeacherClasses(
              Array.isArray((updated as any).classesHandled)
                ? (updated as any).classesHandled
                : Array.isArray(updated.classes)
                ? updated.classes
                : []
            );
            setTeacherFeeStructure(mergeFeeStructure(updated.feeStructure));
            setTeacherSlots(
              Array.isArray(updated.availableTimeSlots) && updated.availableTimeSlots.length > 0
                ? updated.availableTimeSlots
                : Array.isArray((updated as any).timeSlots) && (updated as any).timeSlots.length > 0
                ? (updated as any).timeSlots
                : Array.isArray((updated as any).availableTimings) && (updated as any).availableTimings.length > 0
                ? (updated as any).availableTimings
                : Array.isArray((updated as any).selectedTimings)
                ? (updated as any).selectedTimings
                : []
            );
          }
        }
      }
    }, (err) => {
      console.warn('[ProfilePage] Firestore user document sync notice:', err);
    });
    return () => unsubscribe();
  }, [user?.uid, isTeacher, isEditModalOpen]);

  // Live Firestore listener for trial bookings and demo requests
  const [liveBookings, setLiveBookings] = useState<any[]>([]);
  useEffect(() => {
    if (!user?.uid) return;
    const bookingsCol = collection(db, 'demo_bookings');
    const q = query(bookingsCol);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const matching: any[] = [];
      snapshot.forEach((d) => {
        const b = d.data();
        if (isTeacher) {
          if (b.teacherId === user.uid || b.assignedTeacherId === user.uid) {
            matching.push({ id: d.id, ...b });
          }
        } else {
          if (b.userId === user.uid || (user.email && b.email?.toLowerCase() === user.email.toLowerCase()) || (user.phone && b.phone === user.phone)) {
            matching.push({ id: d.id, ...b });
          }
        }
      });
      setLiveBookings(matching);
    }, (err) => {
      console.warn('[ProfilePage] Demo bookings listener notice:', err);
    });
    return () => unsubscribe();
  }, [user?.uid, isTeacher, user?.email, user?.phone]);

  // Live Firestore listener for Home Tutor bookings ('tutor_bookings' collection)
  const [liveHomeTutorBookings, setLiveHomeTutorBookings] = useState<any[]>([]);
  useEffect(() => {
    if (!user?.uid) return;
    const tutorBookingsCol = collection(db, 'tutor_bookings');
    const unsubscribe = onSnapshot(tutorBookingsCol, (snapshot) => {
      const matching: any[] = [];
      snapshot.forEach((d) => {
        const b: any = { id: d.id, ...d.data() };
        if (isTeacher) {
          if (b.assignedTutorId === user.uid || b.requestedTutorId === user.uid) {
            matching.push(b);
          }
        } else {
          if (
            b.parentUid === user.uid ||
            (user.email && b.parentEmail?.toLowerCase() === user.email.toLowerCase()) ||
            (user.phone && b.parentPhone === user.phone)
          ) {
            matching.push(b);
          }
        }
      });
      matching.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setLiveHomeTutorBookings(matching);
    }, (err) => {
      console.warn('[ProfilePage] tutor_bookings listener notice:', err);
    });
    return () => unsubscribe();
  }, [user?.uid, isTeacher, user?.email, user?.phone]);

  // Real-time listener for Tutor Withdrawal Requests
  useEffect(() => {
    if (!user?.uid || !isTeacher) return;
    const unsub = subscribeToTutorWithdrawals(user.uid, user.email, (reqs) => {
      setTutorWithdrawals(reqs);
    });
    return () => unsub();
  }, [user?.uid, isTeacher, user?.email]);

  // Real-time listener for Fee Payments ('received_fees' collection) for both Parents and Tutors
  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToReceivedFees((records) => {
      setAllReceivedFeeRecords(records);
      if (!isTeacher) {
        // Find records matching current parent uid, email, or phone
        const matching = records.filter(
          (r) =>
            r.parentUid === user.uid ||
            (user.email && r.parentEmail && r.parentEmail.toLowerCase() === user.email.toLowerCase()) ||
            (user.phone && r.parentPhone === user.phone)
        );
        setParentFeeRecords(matching);
      }
    });
    return () => unsub();
  }, [user?.uid, isTeacher, user?.email, user?.phone]);

  // Section-based completion & verification calculation
  // 1. Personal Info
  // 2. Qualifications
  // 3. Subjects & Pricing
  // 4. KYC Verification
  // Status: Red for pending, Yellow for verification-in-progress, Green for completed based on form submission status.
  const activeUserData = liveUser || user;
  const isProfileSubmitted = Boolean(activeUserData?.profileCompleted || user?.profileCompleted);
  const isKycVerified = Boolean(
    activeUserData?.verified === true ||
    (activeUserData as any)?.isApproved === true ||
    (activeUserData as any)?.status === 'approved' ||
    activeUserData?.kycStatus === 'verified' ||
    activeUserData?.kycStatus === 'approved' ||
    (activeUserData as any)?.verificationStatus === 'Verified Genuine Tutor' ||
    user?.verified === true ||
    (user as any)?.isApproved === true ||
    (user as any)?.status === 'approved' ||
    user?.kycStatus === 'verified' ||
    user?.kycStatus === 'approved' ||
    (user as any)?.verificationStatus === 'Verified Genuine Tutor' ||
    isTeacherApprovedInRegistry(activeUserData?.uid, (activeUserData as any)?.id, activeUserData?.email, (activeUserData as any)?.phone) ||
    isTeacherApprovedInRegistry(user?.uid, (user as any)?.id, user?.email, (user as any)?.phone)
  );
  const isKycInProgress = isProfileSubmitted && !isKycVerified;

  const profileSectionItems = [
    {
      id: 'personal-info',
      title: 'Personal Info',
      status: isProfileSubmitted ? ('completed' as const) : ('pending' as const),
      statusLabel: isProfileSubmitted ? 'Completed' : 'Pending',
      description: isProfileSubmitted
        ? 'Name, full residential address & GPS pin saved'
        : 'Residential address & contact details required'
    },
    {
      id: 'qualifications',
      title: 'Qualifications',
      status: isProfileSubmitted ? ('completed' as const) : ('pending' as const),
      statusLabel: isProfileSubmitted ? 'Completed' : 'Pending',
      description: isProfileSubmitted
        ? '10th, 12th & Degree marksheets uploaded'
        : 'Board certificates & degree details required'
    },
    {
      id: 'subjects-pricing',
      title: 'Subjects & Pricing',
      status: isProfileSubmitted ? ('completed' as const) : ('pending' as const),
      statusLabel: isProfileSubmitted ? 'Completed' : 'Pending',
      description: isProfileSubmitted
        ? 'Hourly charges & available tuition slots set'
        : 'Hourly fee & 1-hour time slots required'
    },
    {
      id: 'kyc-verification',
      title: 'KYC Verification',
      status: isKycVerified
        ? ('completed' as const)
        : isKycInProgress
        ? ('in-progress' as const)
        : ('pending' as const),
      statusLabel: isKycVerified
        ? 'KYC Completed'
        : isKycInProgress
        ? 'Verification in Progress'
        : 'Pending',
      description: isKycVerified
        ? 'Credentials verified & tuition badge active (KYC Completed)'
        : isKycInProgress
        ? 'Verification in progress by Rayagada team'
        : 'Requires profile form submission for review'
    }
  ];

  const profileCompletionPercent = isKycVerified ? 100 : isProfileSubmitted ? 75 : 0;

  // Dynamic Teacher Assigned Students (loaded reactively from user document & tutor_bookings collection)
  const assignedStudents = React.useMemo(() => {
    const listFromUser: any[] = liveUser?.assignedStudents || user?.assignedStudents || [];
    const tutorUid = liveUser?.uid || user?.uid || liveUser?.id || user?.id || '';

    const fromBookings = liveHomeTutorBookings
      .filter((b) => {
        const isMatchedTutor = b.assignedTutorId === tutorUid || b.requestedTutorId === tutorUid;
        const isActiveStatus = b.status === 'accepted' || b.status === 'assigned';
        return isMatchedTutor && isActiveStatus;
      })
      .map((b) => ({
        id: b.id,
        bookingId: b.id,
        studentName: b.studentName,
        name: b.studentName,
        grade: b.studentGrade || 'Tuition Student',
        board: b.studentBoard || b.board || '',
        school: b.studentSchool || b.school || '',
        parentName: b.parentName || 'Parent',
        parentPhone: b.parentPhone || '',
        parentEmail: b.parentEmail || '',
        address: b.address || b.locality || 'Rayagada',
        locality: b.locality || b.address || 'Rayagada',
        subjects: b.subjects || ['Home Tuition'],
        timing: b.preferredTimeSlot || '5:00 PM - 6:00 PM',
        monthlyFee: b.assignedTutorFee || b.requestedTutorMonthlyFee || 3000,
        assignedAt: b.assignedAt || b.createdAt,
        status: 'Active'
      }));

    // Comprehensive deduplication map by canonical composite key
    const map = new Map<string, any>();
    const allCandidates = [...listFromUser, ...fromBookings];

    for (const raw of allCandidates) {
      if (!raw) continue;
      const cleanBookingId = (raw.bookingId || raw.id || '')
        .toString()
        .replace(/^std-/, '')
        .trim();
      const normName = (raw.studentName || raw.name || '')
        .toString()
        .trim()
        .toLowerCase();
      const normPhone = (raw.parentPhone || raw.phone || '')
        .toString()
        .replace(/\D/g, '');

      // Determine if an existing student matches either this cleanBookingId or normName + normPhone
      let matchedKey: string | null = null;
      for (const [k, ex] of map.entries()) {
        const exCleanBId = (ex.bookingId || ex.id || '').toString().replace(/^std-/, '').trim();
        const exNormName = (ex.studentName || ex.name || '').toString().trim().toLowerCase();
        const exNormPhone = (ex.parentPhone || ex.phone || '').toString().replace(/\D/g, '');

        if (cleanBookingId && exCleanBId && cleanBookingId === exCleanBId) {
          matchedKey = k;
          break;
        }
        if (normName && exNormName && normName === exNormName) {
          if (!normPhone || !exNormPhone || normPhone === exNormPhone) {
            matchedKey = k;
            break;
          }
        }
      }

      const targetKey = matchedKey || cleanBookingId || (normName ? `${normName}_${normPhone}` : (raw.id || String(Math.random())));

      if (map.has(targetKey)) {
        const existing = map.get(targetKey);
        map.set(targetKey, {
          ...existing,
          ...raw,
          id: existing.id || raw.id,
          name: raw.name || raw.studentName || existing.name || existing.studentName || 'Student',
          studentName: raw.studentName || raw.name || existing.studentName || existing.name || 'Student',
          grade: raw.grade || raw.studentGrade || existing.grade || 'Tuition Student',
          school: raw.school || raw.studentSchool || existing.school || '',
          locality: raw.locality || raw.address || existing.locality || existing.address || 'Rayagada',
          address: raw.address || raw.locality || existing.address || 'Rayagada',
          parentName: raw.parentName || existing.parentName || 'Parent',
          parentPhone: raw.parentPhone || existing.parentPhone || '',
          timing: raw.timing || raw.preferredTimeSlot || existing.timing || '5:00 PM - 6:00 PM',
          subjects: raw.subjects || existing.subjects || ['Home Tuition']
        });
      } else {
        map.set(targetKey, {
          id: raw.id || `std-${targetKey}`,
          bookingId: cleanBookingId || raw.bookingId || raw.id,
          name: raw.name || raw.studentName || 'Student',
          studentName: raw.studentName || raw.name || 'Student',
          grade: raw.grade || raw.studentGrade || 'Tuition Student',
          board: raw.board || raw.studentBoard || '',
          school: raw.school || raw.studentSchool || '',
          parentName: raw.parentName || 'Parent',
          parentPhone: raw.parentPhone || '',
          parentEmail: raw.parentEmail || '',
          address: raw.address || raw.locality || 'Rayagada',
          locality: raw.locality || raw.address || 'Rayagada',
          subjects: raw.subjects || ['Home Tuition'],
          timing: raw.timing || raw.preferredTimeSlot || '5:00 PM - 6:00 PM',
          monthlyFee: raw.monthlyFee || raw.assignedTutorFee || 3000,
          assignedAt: raw.assignedAt || raw.createdAt || new Date().toISOString(),
          status: raw.status || 'Active'
        });
      }
    }

    return Array.from(map.values());
  }, [liveUser?.assignedStudents, user?.assignedStudents, liveHomeTutorBookings, liveUser?.uid, user?.uid, liveUser?.id, user?.id]);

  // Deduplicated verified parent fee payments belonging to this tutor (from received_fees)
  const tutorPaidFees = React.useMemo(() => {
    if (!isTeacher || allReceivedFeeRecords.length === 0) return [] as ReceivedFeeRecord[];
    const bookingIds = assignedStudents
      .map((s) => String(s.bookingId || s.id || '').replace(/^std-/, '').trim())
      .filter(Boolean);
    const identity = {
      tutorId: (liveUser as any)?.id || (user as any)?.id || liveUser?.uid || user?.uid,
      tutorUid: liveUser?.uid || user?.uid,
      tutorEmail: liveUser?.email || user?.email,
      tutorPhone: liveUser?.phone || user?.phone || phone,
      tutorName: liveUser?.name || user?.name,
      bookingIds
    };
    const uniqueMap = new Map<string, ReceivedFeeRecord>();
    for (const fee of allReceivedFeeRecords) {
      if (!doesFeeRecordBelongToTutor(fee, identity)) continue;
      const key = fee.receiptNo || fee.id;
      if (key && !uniqueMap.has(key)) {
        uniqueMap.set(key, fee);
      }
    }
    return Array.from(uniqueMap.values()).sort(
      (a, b) => new Date(b.paidAt || b.createdAt || 0).getTime() - new Date(a.paidAt || a.createdAt || 0).getTime()
    );
  }, [isTeacher, allReceivedFeeRecords, assignedStudents, liveUser, user, phone]);

  const [markedAttendance, setMarkedAttendance] = useState<Record<string, boolean>>({});
  const [attendanceAlert, setAttendanceAlert] = useState<string | null>(null);

  const handleMarkAttendance = (studentId: string, studentName: string) => {
    setMarkedAttendance((prev) => {
      const next = !prev[studentId];
      setAttendanceAlert(
        next
          ? `Attendance recorded for ${studentName} (${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`
          : `Attendance unmarked for ${studentName}`
      );
      setTimeout(() => setAttendanceAlert(null), 3000);
      return { ...prev, [studentId]: next };
    });
  };

  // Avatar upload handler for profile picture (compresses and stores permanent Base64 data URL)
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/jpg', 'image/webp'].includes(file.type)) {
      return;
    }
    try {
      const base64Url = await compressImageToBase64(file, 500, 0.85);
      if (base64Url) {
        setAvatarUrl(base64Url);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const res = ev.target?.result as string;
        if (res) setAvatarUrl(res);
      };
      reader.readAsDataURL(file);
    }
  };

  // Toggle availability slot
  const handleToggleTeacherSlot = (slot: string) => {
    setTeacherSlots((prev) =>
      prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]
    );
  };

  // Save availability slots directly to user profile
  const handleSaveAvailability = async () => {
    if (!user) return;
    setIsSavingSlots(true);
    try {
      const updated = await updateUserProfileInFirebase(user.uid, {
        role: 'teacher',
        availableTimeSlots: teacherSlots,
        timeSlots: teacherSlots,
        availableTimings: teacherSlots,
        selectedTimings: teacherSlots
      } as any);
      setLiveUser(updated);
      if (onProfileUpdated) {
        onProfileUpdated(updated);
      }
      setSlotsSavedToast(true);
      setTimeout(() => {
        setSlotsSavedToast(false);
        setIsAvailabilityModalOpen(false);
      }, 1000);
    } catch (err) {
      console.error('Save slots error:', err);
    } finally {
      setIsSavingSlots(false);
    }
  };

  const handleWithdrawSubmit = async (e: React.FormEvent, maxAvailable: number) => {
    e.preventDefault();
    if (!user) return;
    const numAmount = Math.round(Number(withdrawAmount));
    if (isNaN(numAmount) || numAmount < 1) {
      setWithdrawNotice('Please enter a valid whole-rupee withdrawal amount (minimum ₹1).');
      return;
    }
    if (numAmount > maxAvailable) {
      setWithdrawNotice(`Amount exceeds your verified available balance of ₹${maxAvailable.toLocaleString('en-IN')}.`);
      return;
    }

    if (withdrawMethod === 'upi' && (!withdrawUpiId.trim() || !withdrawUpiId.trim().includes('@'))) {
      setWithdrawNotice('Please enter a valid UPI ID containing @ (e.g. yourname@oksbi).');
      return;
    }

    if (withdrawMethod === 'bank_transfer') {
      if (!withdrawAccountNumber.trim() || !withdrawIfsc.trim() || !withdrawAccountHolder.trim()) {
        setWithdrawNotice('Please enter your Account Number, IFSC Code, and Account Holder Name.');
        return;
      }
    }

    const latestBreakdown = calculateTutorEarnings(
      activeUserData || user || {},
      assignedStudents,
      tutorWithdrawals,
      tutorPaidFees
    );

    setIsSubmittingWithdraw(true);
    setWithdrawNotice(null);
    try {
      await submitWithdrawalRequest({
        tutorId: user.uid,
        tutorName: liveUser?.name || user.name || 'Tutor',
        tutorEmail: liveUser?.email || user.email,
        tutorPhone: liveUser?.phone || user.phone || phone,
        amount: numAmount,
        paymentMethod: withdrawMethod,
        upiId: withdrawMethod === 'upi' ? withdrawUpiId.trim() : undefined,
        bankDetails:
          withdrawMethod === 'bank_transfer'
            ? {
                bankName: withdrawBankName.trim() || 'Bank Account',
                accountNumber: withdrawAccountNumber.trim(),
                ifscCode: withdrawIfsc.trim().toUpperCase(),
                accountHolder: withdrawAccountHolder.trim()
              }
            : undefined,
        notes: withdrawNotes.trim(),
        verifiedEarnedAtRequest: latestBreakdown.totalCurrentEarned,
        verifiedAvailableAtRequest: latestBreakdown.currentAvailableBalance,
        verifiedReceiptsCount: latestBreakdown.paidReceiptsCount
      });

      setWithdrawNotice('Withdrawal notice submitted! Sent to Kumari Institute Admin for verification and transfer.');
      setTimeout(() => {
        setIsWithdrawModalOpen(false);
        setWithdrawAmount('');
        setWithdrawNotice(null);
      }, 2000);
    } catch (err: any) {
      setWithdrawNotice(err?.message || 'Failed to submit withdrawal notice.');
    } finally {
      setIsSubmittingWithdraw(false);
    }
  };

  // Saving states
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const handleToggleTeacherSubject = (subject: string) => {
    setTeacherSubjects((prev) =>
      prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]
    );
  };

  const handleToggleTeacherClass = (cls: string) => {
    setTeacherClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  };

  const handleOpenEditModal = () => {
    const src = liveUser || user;
    if (src) {
      setName(src.name || src.fullName || '');
      setPhone(src.phone || '');
      setLocality(src.locality || src.locationArea || src.address || '');
      setAvatarUrl(src.avatar || src.photoUrl || '');
      if (isTeacher) {
        setTeacherQualification(src.qualification || src.highestQualification || '');
        setTeacherUniversity(src.university || '');
        setTeacherExperience(src.experience || '');
        setTeacherHourlyFee(src.hourlyCharges?.toString() || src.hourlyFee?.toString() || '');
        setTeacherBio(src.bio || '');
        setTeacherSubjects(Array.isArray(src.subjects) ? src.subjects : []);
        setTeacherClasses(
          Array.isArray((src as any).classesHandled)
            ? (src as any).classesHandled
            : Array.isArray(src.classes)
            ? src.classes
            : []
        );
        setTeacherSlots(
          Array.isArray(src.availableTimeSlots) && src.availableTimeSlots.length > 0
            ? src.availableTimeSlots
            : Array.isArray((src as any).timeSlots) && (src as any).timeSlots.length > 0
            ? (src as any).timeSlots
            : Array.isArray((src as any).availableTimings) && (src as any).availableTimings.length > 0
            ? (src as any).availableTimings
            : Array.isArray((src as any).selectedTimings)
            ? (src as any).selectedTimings
            : []
        );
        setTeacherFeeStructure(mergeFeeStructure(src.feeStructure));
      } else {
        setChildName(src.childName || '');
        setChildGrade(src.childGrade || '');
        setChildBoard((src as any).childBoard || (src as any).board || '');
        setChildSchool(src.childSchool || '');
      }
    }
    setEditError(null);
    setSaveSuccess(false);
    setIsEditModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setEditError(null);
    setSaveSuccess(false);

    setIsSaving(true);
    try {
      const cleanedFeeStructure = sanitizeFeeStructure(teacherFeeStructure);
      const feeSummary = summarizeFeeStructure(cleanedFeeStructure);
      const computedMonthlyFee =
        feeSummary.minMonthlyFee > 0
          ? feeSummary.minMonthlyFee
          : teacherHourlyFee && Number(teacherHourlyFee) > 0
          ? Number(teacherHourlyFee) * 30
          : activeUserData?.monthlyFee || 0;
      const computedHourlyRate =
        computedMonthlyFee > 0
          ? Math.max(50, Math.round(computedMonthlyFee / 30))
          : Number(teacherHourlyFee) || activeUserData?.hourlyCharges || 100;

      const payload: Partial<AppUserProfile> = isTeacher
        ? ({
            role: 'teacher',
            hourlyCharges: computedHourlyRate,
            hourlyFee: computedHourlyRate,
            hourlyRate: computedHourlyRate,
            monthlyFee: computedMonthlyFee,
            subjects: teacherSubjects,
            classesHandled: teacherClasses,
            classes: teacherClasses,
            availableTimeSlots: teacherSlots,
            timeSlots: teacherSlots,
            availableTimings: teacherSlots,
            selectedTimings: teacherSlots,
            feeStructure: cleanedFeeStructure,
            boardsSupported:
              feeSummary.boardsSupported.length > 0
                ? feeSummary.boardsSupported
                : (activeUserData as any)?.boardsSupported || [],
            profileCompleted: true,
            ...(isKycVerified
              ? {
                  isApproved: true,
                  verified: true,
                  status: 'approved',
                  kycStatus: 'approved',
                  verificationStatus: 'Verified Genuine Tutor'
                }
              : {})
          } as any)
        : {
            role: 'parent',
            name: name.trim(),
            fullName: name.trim(),
            phone: phone.trim(),
            locality: locality.trim(),
            childName: childName.trim(),
            studentName: childName.trim(),
            childGrade: childGrade.trim(),
            childBoard: childBoard.trim() || 'CBSE',
            board: childBoard.trim() || 'CBSE',
            childSchool: childSchool.trim(),
            profileCompleted: true,
            learningRequirementsSubmitted: true
          };

      const updated = await updateUserProfileInFirebase(user.uid, payload);
      setLiveUser(updated);
      if (onProfileUpdated) {
        onProfileUpdated(updated);
      }
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsEditModalOpen(false);
      }, 900);
    } catch (err: any) {
      console.error('Save profile error:', err);
      setEditError(err?.message || 'Unable to save changes to Firestore. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || isSendingMessage) return;
    setIsSendingMessage(true);
    setMessageError(null);
    try {
      await saveEnquiryToFirestore({
        name: activeUserData?.name || user?.name || 'Portal User',
        phone: activeUserData?.phone || user?.phone || '',
        grade: isTeacher ? 'Tutor Portal Message' : 'Parent Portal Message',
        message: `To ${messageRecipient.name} (${messageRecipient.role}): ${messageText.trim()}`
      });
      setMessageSent(true);
      setMessageText('');
      setTimeout(() => {
        setMessageSent(false);
        setIsMessageModalOpen(false);
      }, 1500);
    } catch (err: any) {
      setMessageError(err?.message || 'Unable to deliver message. Please try again.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  useBackButtonDismiss(isEditModalOpen && !isSaving, 'profile-edit-modal', () =>
    setIsEditModalOpen(false)
  );
  useBackButtonDismiss(isSalaryModalOpen, 'profile-salary-modal', () => setIsSalaryModalOpen(false));
  useBackButtonDismiss(isAvailabilityModalOpen && !isSavingSlots, 'profile-slots-modal', () =>
    setIsAvailabilityModalOpen(false)
  );
  useBackButtonDismiss(isLiveClassModalOpen, 'profile-liveclass-modal', () => {
    setLiveClassNotice(null);
    setIsLiveClassModalOpen(false);
  });
  useBackButtonDismiss(isMessageModalOpen && !isSendingMessage, 'profile-message-modal', () =>
    setIsMessageModalOpen(false)
  );
  useBackButtonDismiss(isWithdrawModalOpen && !isSubmittingWithdraw, 'profile-withdraw-modal', () =>
    setIsWithdrawModalOpen(false)
  );
  useBackButtonDismiss(Boolean(selectedReceipt), 'profile-receipt-modal', () =>
    setSelectedReceipt(null)
  );
  useBackButtonDismiss(showLogoutConfirm, 'profile-logout-modal', () =>
    setShowLogoutConfirm(false)
  );
  useBackButtonDismiss(Boolean(paymentSuccessPopup), 'profile-payment-success-modal', () =>
    setPaymentSuccessPopup(null)
  );

  return (
    <div id="profile-page" className="min-h-screen bg-slate-50/60 text-slate-800 py-6 sm:py-10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 space-y-6">
        
        {/* Minimal Breadcrumb & Back */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5 font-medium">
            <button
              type="button"
              onClick={onNavigateHome}
              className="hover:text-slate-900 transition-colors cursor-pointer"
            >
              Home
            </button>
            <span>/</span>
            <span className="text-slate-900 font-semibold">Account Profile</span>
          </div>

          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
            className="text-xs font-semibold text-rose-600 hover:text-rose-700 flex items-center gap-1 cursor-pointer transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>

        {/* User Identity Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {(() => {
              const displayAvatar =
                (activeUserData?.avatar?.trim() ||
                  activeUserData?.photoUrl?.trim() ||
                  (isTeacher ? avatarUrl?.trim() : '')) ||
                null;
              const displayName = activeUserData?.name || activeUserData?.fullName || name;
              return displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={displayName}
                  className="w-16 h-16 rounded-full object-cover border-2 border-blue-100 shadow-xs ring-4 ring-slate-50 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-slate-900 text-white font-bold text-xl flex items-center justify-center shrink-0 shadow-xs ring-4 ring-slate-50">
                  {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
                </div>
              );
            })()}
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                  {activeUserData?.name || activeUserData?.fullName || name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                  {isTeacher ? 'Teacher Account' : 'Parent Account'}
                </span>
                {isTeacher && isKycVerified && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Verified Tutor</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeUserData?.email || user?.email || 'user@example.com'}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activeUserData?.phone || phone}</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start sm:self-center flex-wrap">
            {isTeacher ? (
              <>
                <button
                  type="button"
                  onClick={handleOpenEditModal}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                  <span>Edit Details</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSalaryModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Wallet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Earnings</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleOpenEditModal}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                <span>Edit Details</span>
              </button>
            )}
          </div>
        </div>

        {/* Attendance Toast Notification */}
        {attendanceAlert && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2.5 shadow-xs">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{attendanceAlert}</span>
          </div>
        )}

        {/* Parent Specific Sections */}
        {!isTeacher && (
          <div className="space-y-6">
            {/* Success Toast for Parent Details Submission */}
            {parentDetailsToast && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs sm:text-sm font-bold flex items-center gap-2.5 shadow-sm animate-in fade-in duration-200">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{parentDetailsToast}</span>
              </div>
            )}

            {/* Student & Parent Information Completion Card */}
            {(() => {
              const currentChildName = (childName || user?.childName || '').trim();
              const currentChildGrade = (childGrade || user?.childGrade || '').trim();
              const currentChildBoard = (childBoard || (user as any)?.board || (user as any)?.childBoard || '').trim();
              const isDetailsComplete = Boolean(currentChildName && currentChildGrade && currentChildBoard);

              return (
                <div
                  id="student-details-profile-card"
                  className={`p-5 sm:p-6 rounded-3xl border transition-all text-left ${
                    isDetailsComplete
                      ? 'bg-white border-slate-200/90 shadow-xs'
                      : 'bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-blue-50 border-2 border-blue-300 shadow-md'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                          isDetailsComplete
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-blue-500/20 shadow-md'
                        }`}
                      >
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-base sm:text-lg text-slate-900 tracking-tight">
                            {isDetailsComplete
                              ? `Registered Student: ${currentChildName}`
                              : 'Complete Student & Parent Details'}
                          </h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              isDetailsComplete
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
                            }`}
                          >
                            {isDetailsComplete ? '✓ Stored in Database' : 'Action Required'}
                          </span>
                        </div>

                        {isDetailsComplete ? (
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600 font-medium">
                            <span>
                              <strong>Parent:</strong> {name || user?.name}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span>
                              <strong>Class:</strong> {currentChildGrade}
                            </span>
                            <span className="text-slate-300">·</span>
                            <span>
                              <strong>Board:</strong> {currentChildBoard}
                            </span>
                            {childSchool && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span>
                                  <strong>School:</strong> {childSchool}
                                </span>
                              </>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-600 leading-relaxed max-w-xl font-medium">
                            Please provide your parent name, child name, class, and educational board so Kumari Institute can store it in the database and customize your child's tutoring syllabus.
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      type="button"
                      id="btn-fill-parent-details"
                      onClick={() => {
                        if (onOpenParentStudentForm) {
                          onOpenParentStudentForm();
                        } else {
                          setIsParentDetailsModalOpen(true);
                        }
                      }}
                      className={`px-5 py-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shrink-0 transition-all cursor-pointer active:scale-95 ${
                        isDetailsComplete
                          ? 'border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs hover:border-slate-400'
                          : 'bg-gradient-to-r from-[#0c2340] via-[#122e54] to-[#1d4ed8] hover:from-slate-900 hover:to-blue-900 text-white shadow-md hover:shadow-lg'
                      }`}
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>{isDetailsComplete ? 'Update Student Details' : 'Fill Details Form'}</span>
                    </button>
                  </div>
                </div>
              );
            })()}
            {discontinueToast && (
              <div className="p-3.5 rounded-2xl bg-slate-900 text-white text-xs font-semibold flex items-center justify-between gap-3 shadow-lg animate-in fade-in">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>{discontinueToast}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setDiscontinueToast(null)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* 3-Day Upcoming Tuition Fee Toast & Small Banner Notification */}
            {(() => {
              const rawBookingsList =
                liveHomeTutorBookings.length > 0
                  ? liveHomeTutorBookings
                  : liveUser?.hiredTutors && liveUser.hiredTutors.length > 0
                  ? liveUser.hiredTutors
                  : liveUser?.assignedEducator
                  ? [liveUser.assignedEducator]
                  : user?.assignedEducator
                  ? [user.assignedEducator]
                  : [];

              const bookingsList = rawBookingsList.filter((b: any) => {
                const st = String(b?.status || '').toLowerCase();
                if (st === 'discontinued' || st === 'cancelled') return false;
                const bKey = String(b?.id || b?.assignedTutorId || b?.requestedTutorId || b?.tutorId || '');
                if (bKey && discontinuedBookingKeys[bKey]) return false;
                return true;
              });

              // Check payment status for all assigned tutors
              const alertCandidates = bookingsList.map((b: any, idx: number) => {
                const tutorId = b.assignedTutorId || b.requestedTutorId || b.tutorId || b.id;
                const bookingActionKey = String(b.id || tutorId || idx);
                const status = getTutorPaymentStatus(b.id, tutorId, parentFeeRecords, activeUserData);
                const tutorName =
                  b.assignedTutorName || b.requestedTutorName || b.tutorName || b.name || 'Specialized Home Tutor';
                const tutorFee =
                  b.assignedTutorFee || b.requestedTutorMonthlyFee || b.monthlyFee || b.fee || 3000;
                return {
                  booking: b,
                  bookingActionKey,
                  tutorName,
                  tutorFee,
                  status
                };
              });

              // Alert 1: 3 Days Before Next Monthly Tuition Fee is Due (1, 2, or 3 days remaining)
              const dueSoonCandidate = alertCandidates.find(
                (c) => c.status.isPaid && c.status.daysRemaining <= 3 && c.status.daysRemaining > 0
              );

              // Alert 2: 30-day cycle reached 0 (Continue / Discontinue) or Unpaid active booking
              const overdueCandidate = alertCandidates.find(
                (c) => c.status.isOverdue || (!c.status.isPaid && (c.booking.status === 'accepted' || c.booking.status === 'assigned'))
              );

              const activeAlert = dueSoonCandidate || overdueCandidate;
              if (!activeAlert) return null;

              const isDueSoon = Boolean(dueSoonCandidate);
              const daysRemaining = activeAlert.status.daysRemaining;
              const isCycleZero = !isDueSoon && activeAlert.status.isOverdue;
              const hasChosenContinue = Boolean(continuedBookings[activeAlert.bookingActionKey]);

              return (
                <div className="space-y-3">
                  {/* Toast Alert on Dashboard (Interactive with dismiss) */}
                  {!dismissedFeeToast && (
                    <div
                      id="parent-fee-due-toast"
                      role="alert"
                      className={`p-4 rounded-2xl border shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
                        isDueSoon
                          ? 'bg-gradient-to-r from-amber-50 via-orange-50/80 to-amber-50 border-amber-300 text-amber-950'
                          : 'bg-gradient-to-r from-rose-50 via-red-50/80 to-rose-50 border-rose-300 text-rose-950'
                      }`}
                    >
                      <div className="flex items-start sm:items-center gap-3 min-w-0">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isDueSoon ? 'bg-amber-500 text-slate-950' : 'bg-rose-500 text-white'
                          }`}
                        >
                          <Clock className="w-5 h-5 animate-pulse" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-xs sm:text-sm">
                              {isDueSoon
                                ? `Monthly Tuition Fee Due in ${daysRemaining} ${daysRemaining === 1 ? 'Day' : 'Days'}`
                                : isCycleZero
                                ? '1-Month Tuition Cycle Completed (0 Days Left)'
                                : 'Tuition Payment Ready'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isDueSoon ? 'bg-amber-200 text-amber-900' : 'bg-rose-200 text-rose-900'
                              }`}
                            >
                              {isCycleZero ? '0 Days Left' : `Due: ${activeAlert.status.nextDueDate || 'Now'}`}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5">
                            {isCycleZero && !hasChosenContinue
                              ? `Your 1-month cycle with ${activeAlert.tutorName} (₹${activeAlert.tutorFee}/mo) is complete. Choose Continue to pay next month's fee or Discontinue.`
                              : `Tuition for ${activeAlert.tutorName} (₹${activeAlert.tutorFee}) can be paid via Razorpay to start/renew your 30-day active cycle.`}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                        {isCycleZero && !hasChosenContinue ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setContinuedBookings((prev) => ({
                                  ...prev,
                                  [activeAlert.bookingActionKey]: true
                                }))
                              }
                              className="px-3.5 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 text-white transition-all cursor-pointer shadow-md active:scale-95"
                            >
                              Continue
                            </button>
                            <button
                              type="button"
                              onClick={() => setDiscontinueConfirmBooking(activeAlert.booking)}
                              className="px-3 py-2 rounded-xl text-xs font-bold bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 transition-all cursor-pointer active:scale-95"
                            >
                              Discontinue
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            id="toast-pay-fee-now-btn"
                            onClick={() => setPayFeeModalBooking(activeAlert.booking)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95 ${
                              isDueSoon
                                ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20'
                                : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20'
                            }`}
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pay Fee Now</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            setDismissedFeeToast(true);
                            try {
                              localStorage.setItem('parent_dismissed_fee_toast', 'true');
                            } catch (e) {
                              console.warn('Could not save dismissed fee toast', e);
                            }
                          }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-black/5 transition-colors cursor-pointer"
                          title="Dismiss notification toast"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Small Banner Notification on Dashboard */}
                  <div
                    id="parent-fee-due-banner"
                    className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs ${
                      isDueSoon
                        ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                        : 'bg-rose-50/80 border-rose-200 text-rose-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Clock className={`w-4 h-4 shrink-0 ${isDueSoon ? 'text-amber-600' : 'text-rose-600'}`} />
                      <div className="text-xs">
                        <strong>
                          {isDueSoon
                            ? `Upcoming Tuition Fee (${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'} remaining):`
                            : isCycleZero
                            ? '30-Day Monthly Cycle Completed (0 Days Left):'
                            : 'Tuition Fee Pending:'}
                        </strong>{' '}
                        {isCycleZero && !hasChosenContinue ? (
                          <>
                            Choose <strong>Continue</strong> to renew <strong>{activeAlert.tutorName}</strong> (₹{activeAlert.tutorFee}) or <strong>Discontinue</strong>.
                          </>
                        ) : (
                          <>
                            Monthly tuition for <strong>{activeAlert.tutorName}</strong> (₹{activeAlert.tutorFee}) is scheduled for{' '}
                            <strong>{activeAlert.status.nextDueDate || 'renewal'}</strong>.
                          </>
                        )}
                      </div>
                    </div>
                    {isCycleZero && !hasChosenContinue ? (
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                          type="button"
                          onClick={() =>
                            setContinuedBookings((prev) => ({
                              ...prev,
                              [activeAlert.bookingActionKey]: true
                            }))
                          }
                          className="px-3 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-xs"
                        >
                          Continue
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscontinueConfirmBooking(activeAlert.booking)}
                          className="px-3 py-1.5 rounded-xl font-bold text-xs bg-white hover:bg-rose-100 text-rose-700 border border-rose-300 cursor-pointer"
                        >
                          Discontinue
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        id="banner-pay-fee-direct-btn"
                        onClick={() => setPayFeeModalBooking(activeAlert.booking)}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 cursor-pointer shadow-xs flex items-center gap-1.5 transition-all self-end sm:self-auto ${
                          isDueSoon
                            ? 'bg-amber-600 hover:bg-amber-500 text-white'
                            : 'bg-rose-600 hover:bg-rose-500 text-white'
                        }`}
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>{isDueSoon ? 'Pay Fee' : 'Pay Now'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 1. Booked Home Tutors & Assigned Educators - Real-Time from Firestore */}
            {(() => {
              // Combine liveHomeTutorBookings and hiredTutors / assignedEducator, excluding discontinued records
              const rawBookingsList =
                liveHomeTutorBookings.length > 0
                  ? liveHomeTutorBookings
                  : liveUser?.hiredTutors && liveUser.hiredTutors.length > 0
                  ? liveUser.hiredTutors
                  : liveUser?.assignedEducator
                  ? [liveUser.assignedEducator]
                  : user?.assignedEducator
                  ? [user.assignedEducator]
                  : [];

              const bookingsList = rawBookingsList.filter((b: any) => {
                const st = String(b?.status || '').toLowerCase();
                if (st === 'discontinued' || st === 'cancelled') return false;
                const bKey = String(b?.id || b?.assignedTutorId || b?.requestedTutorId || b?.tutorId || '');
                if (bKey && discontinuedBookingKeys[bKey]) return false;
                return true;
              });

              return (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                      <User className="w-4 h-4 text-blue-600" />
                      <span>Booked Home Tutors &amp; Assigned Educators</span>
                    </div>
                    {bookingsList.length > 0 ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                        {bookingsList.filter((b: any) => b.status === 'accepted' || b.status === 'assigned' || !b.status).length} Active • {bookingsList.length} Total
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500">
                        No Bookings Yet
                      </span>
                    )}
                  </div>

                  {/* 30-Day Renewal Notice Banner if countdown reached 0 */}
                  {(() => {
                    const overdueItem = bookingsList.find((b: any) => {
                      const st = getTutorPaymentStatus(
                        b.id,
                        b.assignedTutorId || b.requestedTutorId || b.tutorId || b.id,
                        parentFeeRecords,
                        activeUserData
                      );
                      return st.isOverdue;
                    });

                    if (overdueItem) {
                      const tName = overdueItem.assignedTutorName || overdueItem.requestedTutorName || overdueItem.tutorName || 'Home Tutor';
                      const overdueKey = String(
                        overdueItem.id || overdueItem.assignedTutorId || overdueItem.requestedTutorId || overdueItem.tutorId || ''
                      );
                      const hasContinuedOverdue = Boolean(continuedBookings[overdueKey]);
                      return (
                        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs animate-in fade-in">
                          <div className="flex items-center gap-2.5">
                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              <strong>30-Day Monthly Cycle Completed (0 Days Left):</strong>{' '}
                              {hasContinuedOverdue
                                ? `Click Pay Fee Now to renew ${tName} for the next 30 days.`
                                : `Your 1-month tuition cycle with ${tName} has reached 0 days. Click Continue to pay for the next month or Discontinue.`}
                            </span>
                          </div>
                          {hasContinuedOverdue ? (
                            <button
                              type="button"
                              onClick={() => setPayFeeModalBooking(overdueItem)}
                              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] shrink-0 cursor-pointer shadow-xs self-end sm:self-auto"
                            >
                              Pay Fee Now
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                              <button
                                type="button"
                                onClick={() =>
                                  setContinuedBookings((prev) => ({
                                    ...prev,
                                    [overdueKey]: true
                                  }))
                                }
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer shadow-xs"
                              >
                                Continue
                              </button>
                              <button
                                type="button"
                                onClick={() => setDiscontinueConfirmBooking(overdueItem)}
                                className="px-3 py-1.5 rounded-lg bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-[11px] cursor-pointer"
                              >
                                Discontinue
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {bookingsList.length > 0 ? (
                    <div className="space-y-3.5">
                      {bookingsList.map((item: any, idx: number) => {
                        const isAccepted = item.status === 'accepted' || item.status === 'assigned' || (!item.status && item.id);
                        const isPending = item.status === 'pending';
                        const isDeclined = item.status === 'declined';
                        const tutorIdForKey = item.assignedTutorId || item.requestedTutorId || item.tutorId || item.id;
                        const bookingActionKey = String(item.id || tutorIdForKey || idx);
                        const tutorName = item.assignedTutorName || item.requestedTutorName || item.tutorName || item.name || 'Specialized Home Tutor';
                        const tutorFee = item.assignedTutorFee || item.requestedTutorMonthlyFee || item.monthlyFee || item.fee || 3000;
                        const tutorPhone = item.assignedTutorPhone || item.phone;
                        const tutorSubjects = Array.isArray(item.subjects) ? item.subjects.join(', ') : (item.subjects || 'Home Tuition');
                        const sName = item.studentName || childName;
                        const sGrade = item.studentGrade || childGrade;
                        const bookingStartMs = new Date(item.assignedAt || item.createdAt || Date.now()).getTime();
                        const trialDaysElapsed = isNaN(bookingStartMs)
                          ? 0
                          : Math.max(0, Math.floor((Date.now() - bookingStartMs) / (1000 * 60 * 60 * 24)));
                        const payStatus = getTutorPaymentStatus(
                          item.id,
                          tutorIdForKey,
                          parentFeeRecords,
                          activeUserData
                        );
                        const hasChosenContinue = Boolean(continuedBookings[bookingActionKey]);

                        return (
                          <div
                            key={item.id || `booking-${idx}`}
                            className="p-4 rounded-xl border border-slate-200/90 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                              <div className="w-12 h-12 rounded-xl bg-blue-100 text-blue-800 font-black text-sm flex items-center justify-center shrink-0 border border-blue-200">
                                {tutorName ? tutorName.slice(0, 2).toUpperCase() : 'HT'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-bold text-sm text-slate-900 truncate">{tutorName}</h4>
                                  {isAccepted && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      ✓ Assigned &amp; Active
                                    </span>
                                  )}
                                  {isPending && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                                      3-Day Trial Booking • Verifying
                                    </span>
                                  )}
                                  {isDeclined && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                      ✕ Declined
                                    </span>
                                  )}
                                  {!isDeclined && !payStatus.isPaid && !payStatus.isOverdue && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                                      {trialDaysElapsed < 3
                                        ? `3-Day Demo • Day ${trialDaysElapsed + 1}/3`
                                        : '3-Day Trial Done • Pay Now'}
                                    </span>
                                  )}
                                  {!isDeclined && payStatus.isPaid && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 tabular-nums">
                                      Paid · {payStatus.daysRemaining} {payStatus.daysRemaining === 1 ? 'Day' : 'Days'} Left (Next due {payStatus.nextDueDate})
                                    </span>
                                  )}
                                  {!isDeclined && payStatus.isOverdue && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 tabular-nums">
                                      1-Month Cycle Completed · 0 Days Left
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-slate-600 mt-0.5">{tutorSubjects}</p>
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 mt-1">
                                  {sName && (
                                    <span>
                                      Student: <strong className="text-slate-700">{sName}</strong> {sGrade ? `(${sGrade})` : ''}
                                    </span>
                                  )}
                                  {item.preferredTimeSlot && (
                                    <span>
                                      Slot: <strong className="text-slate-700">{item.preferredTimeSlot}</strong>
                                    </span>
                                  )}
                                  {tutorFee && (
                                    <span className="text-emerald-700 font-bold tabular-nums">₹{tutorFee}/month</span>
                                  )}
                                </div>
                                {isDeclined && item.declineReason && (
                                  <p className="text-[11px] text-rose-600 font-medium mt-1">
                                    Reason: {item.declineReason}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Action Buttons Column */}
                            <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0 w-full md:w-auto">
                              {isAccepted && (
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMessageRecipient({
                                        name: tutorName,
                                        role: 'Assigned Home Tutor',
                                        phone: tutorPhone
                                      });
                                      setIsMessageModalOpen(true);
                                    }}
                                    className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5 text-blue-300" />
                                    <span>Message</span>
                                  </button>
                                  {tutorPhone && (
                                    <a
                                      href={`tel:${tutorPhone}`}
                                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-white text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                                    >
                                      <Phone className="w-3.5 h-3.5 text-slate-500" />
                                      <span>Call</span>
                                    </a>
                                  )}
                                </div>
                              )}

                              {/* Pay Now / Paid (30->0 Countdown) / Continue & Discontinue at 0 */}
                              {!isDeclined && (() => {
                                if (payStatus.isPaid) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (payStatus.lastPayment) {
                                          setSelectedReceipt({
                                            id: payStatus.lastPayment.receiptNo,
                                            date: `${payStatus.lastPayment.paidDate} • ${payStatus.lastPayment.paidTime}`,
                                            description: payStatus.lastPayment.billingPeriod,
                                            amount: payStatus.lastPayment.formattedAmount,
                                            status: 'Paid',
                                            utrNumber: payStatus.lastPayment.razorpayPaymentId || payStatus.lastPayment.transactionId,
                                            razorpayOrderId: payStatus.lastPayment.razorpayOrderId,
                                            razorpayPaymentId: payStatus.lastPayment.razorpayPaymentId,
                                            signatureVerified: payStatus.lastPayment.signatureVerified,
                                            paymentGateway: payStatus.lastPayment.paymentGateway || 'Razorpay',
                                            transferMethod: payStatus.lastPayment.paymentMethodDetail || payStatus.lastPayment.paymentMethod,
                                            nextDueDate: payStatus.nextDueDate,
                                            studentName: payStatus.lastPayment.studentName || sName,
                                            tutorName: payStatus.lastPayment.tutorName || tutorName,
                                            adminNote: `Tuition active for ${payStatus.daysRemaining} more ${payStatus.daysRemaining === 1 ? 'day' : 'days'} (next due ${payStatus.nextDueDate}).`
                                          });
                                        }
                                      }}
                                      title={`Paid via Razorpay. Countdown: ${payStatus.daysRemaining} ${payStatus.daysRemaining === 1 ? 'day' : 'days'} left (next due ${payStatus.nextDueDate}). Click to view receipt.`}
                                      className="w-full md:min-w-[200px] px-4 py-2 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-300 text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-xs"
                                    >
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                      <span className="tabular-nums">
                                        Paid ({payStatus.daysRemaining} {payStatus.daysRemaining === 1 ? 'Day' : 'Days'} Left)
                                      </span>
                                    </button>
                                  );
                                }

                                // 1 month (30 days) completed -> countdown hit 0 -> show Continue & Discontinue
                                if (payStatus.isOverdue) {
                                  if (!hasChosenContinue) {
                                    return (
                                      <div className="flex items-center gap-2 w-full md:min-w-[210px]">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setContinuedBookings((prev) => ({
                                              ...prev,
                                              [bookingActionKey]: true
                                            }))
                                          }
                                          className="flex-1 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-all"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                          <span>Continue</span>
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setDiscontinueConfirmBooking(item)}
                                          className="flex-1 px-3.5 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                          <span>Discontinue</span>
                                        </button>
                                      </div>
                                    );
                                  }

                                  // Parent clicked Continue -> show Payment button + option to discontinue
                                  return (
                                    <div className="flex flex-col items-stretch sm:items-end gap-1.5 w-full md:min-w-[210px]">
                                      <button
                                        type="button"
                                        onClick={() => setPayFeeModalBooking(item)}
                                        className="w-full px-4 py-2 rounded-xl bg-[#072654] hover:bg-[#0c2340] text-white font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-950/20 transition-all"
                                        title="Complete monthly fee payment to continue for the next 30 days"
                                      >
                                        <CreditCard className="w-3.5 h-3.5 text-sky-300" />
                                        <span className="tabular-nums">Pay Fee to Continue (₹{tutorFee})</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setDiscontinueConfirmBooking(item)}
                                        className="text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline self-center sm:self-end cursor-pointer"
                                      >
                                        Discontinue Instead
                                      </button>
                                    </div>
                                  );
                                }

                                // Initial booking payment via Razorpay
                                return (
                                  <button
                                    type="button"
                                    onClick={() => setPayFeeModalBooking(item)}
                                    className="w-full md:min-w-[180px] px-4 py-2 rounded-xl bg-[#072654] hover:bg-[#0c2340] text-white font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-950/20 hover:scale-[1.01] transition-all"
                                  >
                                    <CreditCard className="w-3.5 h-3.5 text-sky-300" />
                                    <span className="tabular-nums">Pay Now (₹{tutorFee})</span>
                                  </button>
                                );
                              })()}

                              {isDeclined && (
                                <button
                                  type="button"
                                  onClick={onNavigateTutors}
                                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold cursor-pointer"
                                >
                                  Book Another Tutor
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-6 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 p-4">
                      <User className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-bold text-slate-700">No Booked Home Tutors Yet</p>
                      <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-0.5 mb-3">
                        Connect with verified home tutors near your location in Rayagada and book 1-on-1 tutoring at home.
                      </p>
                      <button
                        type="button"
                        onClick={onNavigateTutors}
                        className="px-3.5 py-1.5 bg-[#0c2340] hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                      >
                        <Search className="w-3.5 h-3.5" />
                        <span>Find Home Tutors</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 2. Enrolled Courses & Live Classes - Came Second */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                  <span>Enrolled Courses &amp; Live Classes</span>
                </div>
                <button
                  type="button"
                  onClick={onNavigateCourses}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 cursor-pointer"
                >
                  <span>Explore Courses</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3">
                {user?.enrolledCourses && user.enrolledCourses.length > 0 ? (
                  user.enrolledCourses.map((course: any, idx: number) => (
                    <div
                      key={course.id || idx}
                      className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 font-bold text-sm">
                          {course.title ? course.title.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm text-slate-900">{course.title}</h4>
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                              {course.status || 'Active'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Batch Fee: <span className="font-medium text-slate-700">{course.fee || 'Enrolled'}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-6 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200 p-4">
                    <BookOpen className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-700">No Enrolled Courses Yet</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-0.5 mb-3">
                      Explore Rayagada foundation batches (JNVST, Sainik School) or connect with top home tutors.
                    </p>
                    <button
                      type="button"
                      onClick={onNavigateCourses}
                      className="px-3.5 py-1.5 bg-[#0c2340] hover:bg-slate-900 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Browse Batches</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Fee Receipts & Quick Access */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Fee Receipts & Statements */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                    <Receipt className="w-4 h-4 text-blue-600" />
                    <span>Fee Receipts</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-medium">All dues cleared</span>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {(() => {
                    // Combine Firestore received_fees records and user.feeReceipts
                    const combinedMap = new Map();
                    (user?.feeReceipts || []).forEach((r: any) => {
                      combinedMap.set(r.id || r.receiptNo, r);
                    });
                    (liveUser?.feeReceipts || []).forEach((r: any) => {
                      combinedMap.set(r.id || r.receiptNo, r);
                    });
                    parentFeeRecords.forEach((pr) => {
                      combinedMap.set(pr.id || pr.receiptNo, {
                        id: pr.receiptNo,
                        receiptNo: pr.receiptNo,
                        date: `${pr.paidDate} • ${pr.paidTime}`,
                        description: `${pr.billingPeriod} - ${pr.tutorName}`,
                        amount: pr.formattedAmount,
                        status: 'Paid',
                        transferMethod: pr.paymentMethodDetail || pr.paymentMethod,
                        paymentGateway: pr.paymentGateway || 'Razorpay',
                        razorpayOrderId: pr.razorpayOrderId,
                        razorpayPaymentId: pr.razorpayPaymentId,
                        signatureVerified: pr.signatureVerified,
                        utrNumber: pr.razorpayPaymentId || pr.transactionId,
                        studentName: pr.studentName,
                        tutorName: pr.tutorName,
                        nextDueDate: pr.nextDueDate,
                        adminNote: `Verified payment for ${pr.studentName} (${pr.tutorSubjects || 'Tuition'}). Next due ${pr.nextDueDate}.`
                      });
                    });

                    const allReceipts = Array.from(combinedMap.values());

                    if (allReceipts.length > 0) {
                      return allReceipts.map((receipt: any, idx: number) => (
                        <div key={receipt.id || idx} className="py-2.5 flex items-center justify-between gap-3">
                          <div>
                            <span className="font-semibold text-slate-900 block leading-snug">
                              {receipt.description || 'Tuition Fee'}
                            </span>
                            <span className="text-slate-400 block text-[11px] mt-0.5">
                              Paid on {receipt.date} • <strong className="text-emerald-700">{receipt.amount}</strong>
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedReceipt(receipt)}
                            className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer shrink-0"
                          >
                            View Receipt
                          </button>
                        </div>
                      ));
                    }

                    return (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        <Receipt className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                        <p className="font-semibold text-slate-600">No Payment Receipts Yet</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Transactions and paid invoices will appear here.</p>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-2.5">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  <span>Quick Access</span>
                </div>
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={onNavigateTutors}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left transition-all cursor-pointer"
                  >
                    <p className="text-xs font-bold text-slate-900">Find Home Tutors</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Local verified tutors</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (onOpenEnquiry) onOpenEnquiry();
                      else window.location.href = `tel:${instituteInfo.phoneClean}`;
                    }}
                    className="p-2.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left transition-all cursor-pointer"
                  >
                    <p className="text-xs font-bold text-slate-900">Help &amp; Support</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">Call or enquire</p>
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Teacher Specific View */}
        {isTeacher && (
          <div className="space-y-6">
            {/* 1. Profile Completion & Verification (Removed permanently once Admin accepts the tutor) */}
            {!isKycVerified && (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Profile Completion &amp; Verification</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-2.5 py-0.5 rounded-full">
                    {profileCompletionPercent}% Completed
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium hidden sm:inline">
                    Steps remaining
                  </span>
                </div>
              </div>

              {/* Visual Progress Bar */}
              <div className="space-y-3 pt-1">
                <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ease-out ${
                      isProfileSubmitted
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.max(profileCompletionPercent, 5)}%` }}
                  />
                </div>

                {/* 4 Distinct Items */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
                  {/* 1. Personal Info */}
                  <div
                    className={`flex items-center gap-1.5 font-semibold px-2.5 py-1.5 rounded-xl border ${
                      isProfileSubmitted
                        ? 'text-emerald-700 bg-emerald-50/80 border-emerald-200'
                        : 'text-red-700 bg-red-50/80 border-red-200'
                    }`}
                  >
                    {isProfileSubmitted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    )}
                    <span>{isProfileSubmitted ? 'Personal Info' : 'Personal Info (Pending)'}</span>
                  </div>

                  {/* 2. Qualifications */}
                  <div
                    className={`flex items-center gap-1.5 font-semibold px-2.5 py-1.5 rounded-xl border ${
                      isProfileSubmitted
                        ? 'text-emerald-700 bg-emerald-50/80 border-emerald-200'
                        : 'text-red-700 bg-red-50/80 border-red-200'
                    }`}
                  >
                    {isProfileSubmitted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    )}
                    <span>{isProfileSubmitted ? 'Qualifications' : 'Qualifications (Pending)'}</span>
                  </div>

                  {/* 3. Subjects & Pricing */}
                  <div
                    className={`flex items-center gap-1.5 font-semibold px-2.5 py-1.5 rounded-xl border ${
                      isProfileSubmitted
                        ? 'text-emerald-700 bg-emerald-50/80 border-emerald-200'
                        : 'text-red-700 bg-red-50/80 border-red-200'
                    }`}
                  >
                    {isProfileSubmitted ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    )}
                    <span>{isProfileSubmitted ? 'Subjects & Pricing' : 'Subjects & Pricing (Pending)'}</span>
                  </div>

                  {/* 4. KYC Verification */}
                  <div
                    className={`flex items-center gap-1.5 font-semibold px-2.5 py-1.5 rounded-xl border ${
                      isProfileSubmitted
                        ? 'text-amber-700 bg-amber-50/90 border-amber-300'
                        : 'text-red-700 bg-red-50/80 border-red-200'
                    }`}
                  >
                    {isProfileSubmitted ? (
                      <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    )}
                    <span>
                      {isProfileSubmitted
                        ? 'KYC (Pending Verification)'
                        : 'KYC Verification (Pending)'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 text-xs text-slate-500 bg-slate-50/80 -mx-5 -mb-5 p-4 rounded-b-2xl border-t border-slate-100">
                <div>
                  <p className="text-xs font-bold text-slate-800">
                    {isProfileSubmitted
                      ? 'Teacher Credentials & KYC Submitted'
                      : 'Complete Profile & Identity Verification Needed'}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {isProfileSubmitted
                      ? 'Your verification request is under admin review. You can review or edit your teaching details anytime.'
                      : 'Submit education details, certificates, and Aadhaar document to get verified.'}
                  </p>
                </div>
                <button
                  type="button"
                  id="complete-teacher-profile-btn"
                  onClick={() => {
                    if (onCompleteTeacherProfile) {
                      onCompleteTeacherProfile();
                    } else {
                      handleOpenEditModal();
                    }
                  }}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer self-start sm:self-center shadow-xs hover:shadow-md active:scale-98"
                >
                  <ShieldCheck className="w-4 h-4 text-blue-200" />
                  <span>{isProfileSubmitted ? 'Update Profile & Verification' : 'Complete Profile'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            )}

            {/* 2. Assigned Students Section (Deduplicated with real-time student details & attendance) */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Assigned Students</span>
                </div>
                {assignedStudents.length > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {assignedStudents.length} Active {assignedStudents.length === 1 ? 'Student' : 'Students'}
                  </span>
                )}
              </div>

              <div className="space-y-3 pt-1">
                {assignedStudents.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50/50 rounded-xl border border-dashed border-slate-200 p-6">
                    <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm font-bold text-slate-700">No Assigned Students Yet</p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                      Once parents in Rayagada book home tuition or demo sessions with you, your active students will appear here with attendance tracking.
                    </p>
                  </div>
                ) : (
                  assignedStudents.map((student) => {
                    const isMarked = markedAttendance[student.id];
                    return (
                      <div
                        key={student.id}
                        className="p-4 rounded-xl border border-slate-200/80 hover:border-slate-300 bg-slate-50/40 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="flex items-start gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-blue-100/80 border border-blue-200 text-blue-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                            {(student.name || 'ST').split(' ').filter(Boolean).map((n: string) => n[0]).join('').slice(0, 2) || 'ST'}
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-slate-900">{student.name}</h4>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                {student.grade || 'Tuition Student'} {student.board ? `• ${student.board}` : ''}
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                {Array.isArray(student.subjects) ? student.subjects.join(', ') : (student.subject || student.subjects || 'Home Tuition')}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                              {student.school && (
                                <span className="flex items-center gap-1">
                                  <School className="w-3.5 h-3.5 text-slate-400" />
                                  <span>{student.school}</span>
                                </span>
                              )}
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                <span>{student.locality || student.address || 'Rayagada'}</span>
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 pt-0.5">
                              <span className="flex items-center gap-1 text-slate-700 font-medium">
                                <Clock className="w-3 h-3 text-blue-600" />
                                <span>{student.timing}</span>
                              </span>
                              <span>•</span>
                              <span>Parent: <strong className="text-slate-700">{student.parentName}</strong></span>
                              {student.parentPhone && (
                                <>
                                  <span>•</span>
                                  <a
                                    href={`tel:${student.parentPhone}`}
                                    className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                                  >
                                    <Phone className="w-3 h-3 text-blue-500" />
                                    <span>{student.parentPhone}</span>
                                  </a>
                                </>
                              )}
                              {student.monthlyFee && (() => {
                                const fee = Number(student.monthlyFee) || 3000;
                                const { tutorEarnings } = calculateFeeSplit(fee);
                                return (
                                  <>
                                    <span>•</span>
                                    <span
                                      className="text-slate-600 font-medium font-mono tabular-nums"
                                      title={`Class Fee ₹${fee.toLocaleString('en-IN')}/mo · Tutor 80% Share: ₹${tutorEarnings.toLocaleString('en-IN')}/mo`}
                                    >
                                      Class Fee ₹{fee.toLocaleString('en-IN')}/mo
                                    </span>
                                    <span>•</span>
                                    <span className="text-emerald-700 font-bold font-mono tabular-nums">
                                      Your Share (80%): ₹{tutorEarnings.toLocaleString('en-IN')}/mo
                                    </span>
                                  </>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/60">
                          <button
                            type="button"
                            onClick={() => handleMarkAttendance(student.id, student.name)}
                            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors ${
                              isMarked
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs'
                                : 'border border-slate-200 hover:bg-white text-slate-700'
                            }`}
                          >
                            <CheckSquare className={`w-3.5 h-3.5 ${isMarked ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <span>{isMarked ? 'Attended Today' : 'Mark Attendance'}</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 4. Teacher Quick Access */}
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm border-b border-slate-100 pb-2.5">
                <BookOpen className="w-4 h-4 text-blue-600" />
                <span>Teacher Quick Access</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setIsSalaryModalOpen(true)}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Earnings &amp; Payouts</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Check accrued earnings, payouts &amp; bank slips</p>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-600 mt-2 flex items-center gap-0.5">
                    View Ledger <ChevronRight className="w-3 h-3" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAvailabilityModalOpen(true)}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Calendar className="w-3.5 h-3.5 text-blue-600" />
                      <span>Update Availability</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Manage 1-hour home tuition slots (6 AM – 9 PM)</p>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-600 mt-2 flex items-center gap-0.5">
                    Select Slots <ChevronRight className="w-3 h-3" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenEnquiry) onOpenEnquiry();
                    else window.location.href = `tel:${instituteInfo.phoneClean}`;
                  }}
                  className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-left transition-all cursor-pointer flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                      <Phone className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Teacher Helpdesk</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">Coordinator support &amp; batch queries</p>
                  </div>
                  <span className="text-[11px] font-semibold text-blue-600 mt-2 flex items-center gap-0.5">
                    Contact Coordinator <ChevronRight className="w-3 h-3" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* EDIT DETAILS MODAL */}
      {isEditModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && setIsEditModalOpen(false)}
        >
          <div className={`bg-white rounded-3xl ${isTeacher ? 'max-w-2xl' : 'max-w-md'} w-full shadow-2xl border border-slate-200 overflow-hidden text-left relative my-6`}>
            {/* Attractive Header */}
            <div className="bg-gradient-to-r from-[#0c2340] via-[#132e54] to-[#1e3a8a] text-white p-6 relative">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer ring-1 ring-white/20 shadow-xs"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider mb-1">
                <Edit3 className="w-4 h-4" />
                <span>Account Profile</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {isTeacher ? 'Edit Tutor Details, Slots & Fees' : 'Edit Profile & Student Info'}
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 mt-1">
                {isTeacher
                  ? 'Update subjects, classes handled, available time slots, and monthly fees — saved dynamically to Firestore'
                  : 'Update your details synced across your learning account'}
              </p>
            </div>

            <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
              {saveSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Details saved dynamically to Firestore!</span>
                </div>
              )}

              {editError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              {/* Teacher Teaching Fields Only (Subjects, Classes Handled, Time Slots & Structured Monthly Fees) */}
              {isTeacher && (
                <div className="space-y-4">
                  <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-[11px] text-blue-900 font-medium">
                    Update only the sections you want to change — subjects, classes, time slots, or fees. You do not have to fill or modify every section.
                  </div>

                  {/* Subjects Taught */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-900">Subjects Taught</label>
                      <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                        {teacherSubjects.length} selected
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {TUTOR_SUBJECT_OPTIONS.map((sub) => {
                        const isSelected = teacherSubjects.includes(sub);
                        return (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => handleToggleTeacherSubject(sub)}
                            className={`px-2.5 py-2 rounded-xl border text-left text-[11px] font-semibold flex items-center gap-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50 text-blue-900 shadow-2xs'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            <div
                              className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${
                                isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5" />}
                            </div>
                            <span className="truncate">{sub}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Classes Handled */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-900">Classes Handled (1st – 12th)</label>
                      <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full">
                        {teacherClasses.length} selected
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {TUTOR_CLASS_OPTIONS.map((cls) => {
                        const isSelected = teacherClasses.includes(cls);
                        return (
                          <button
                            key={cls}
                            type="button"
                            onClick={() => handleToggleTeacherClass(cls)}
                            className={`px-2.5 py-2 rounded-xl border text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-indigo-600 bg-indigo-50 text-indigo-900 shadow-2xs'
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-indigo-600 shrink-0" />}
                            <span>{cls}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Available 1-Hour Time Slots */}
                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-slate-900">Available 1-Hour Time Slots (6 AM – 9 PM)</label>
                      <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {teacherSlots.length} selected
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-2 bg-slate-50/70 rounded-xl border border-slate-200/80">
                      {AVAILABLE_1HR_SLOTS.map((slot) => {
                        const isChecked = teacherSlots.includes(slot);
                        return (
                          <label
                            key={slot}
                            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-[11px] cursor-pointer transition-all ${
                              isChecked
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-semibold'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleTeacherSlot(slot)}
                              className="rounded text-emerald-600 focus:ring-emerald-500 w-3.5 h-3.5"
                            />
                            <Clock className={`w-3 h-3 shrink-0 ${isChecked ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <span className="truncate">{slot}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Structured Monthly Fee Schedule (Dynamic by Selected Classes) */}
                  {(() => {
                    const feeStats = summarizeFeeStructure(teacherFeeStructure);
                    const selected1to10Keys = CLASS_1_TO_10_KEYS.filter((clsKey) =>
                      teacherClasses.some((c) => {
                        const m = c.match(/(\d+)/);
                        const k = clsKey.match(/(\d+)/);
                        return m && k && m[1] === k[1];
                      })
                    );
                    const selectedSeniorKeys = SENIOR_CLASSES_KEYS.filter((clsKey) =>
                      teacherClasses.some((c) => {
                        const m = c.match(/(\d+)/);
                        const k = clsKey.match(/(\d+)/);
                        return m && k && m[1] === k[1];
                      })
                    );
                    const effectiveSeniorTab = selectedSeniorKeys.includes(activeSeniorFeeTab)
                      ? activeSeniorFeeTab
                      : selectedSeniorKeys[0] || '11th';
                    const existingSeniorSubs = Object.keys(
                      teacherFeeStructure?.classes11to12?.[effectiveSeniorTab] || {}
                    ).filter((k) => {
                      const e = teacherFeeStructure?.classes11to12?.[effectiveSeniorTab]?.[k];
                      return (e?.cbse && e.cbse > 0) || (e?.icse && e.icse > 0);
                    });
                    const seniorSubjectsToShow = Array.from(
                      new Set([...teacherSubjects, ...existingSeniorSubs])
                    );

                    return (
                      <div className="pt-3 border-t border-slate-100 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <label className="font-bold text-slate-900 block">
                              Structured Monthly Tuition Fees (₹/month)
                            </label>
                            <p className="text-[11px] text-slate-500">
                              Shows only the classes selected above (CBSE / ICSE board-wise)
                            </p>
                          </div>
                          <span
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                              feeStats.hasAnyFee
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {feeStats.hasAnyFee
                              ? `${feeStats.configuredCount} fees • From ₹${feeStats.minMonthlyFee.toLocaleString('en-IN')}/mo`
                              : '0 fees entered'}
                          </span>
                        </div>

                        {teacherClasses.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-4 text-center text-[11px] text-slate-500 font-medium">
                            Select one or more classes in &quot;Classes Handled&quot; above to view and update fee fields for those classes.
                          </div>
                        ) : (
                          <>
                            {/* Part A: Only Selected Classes from 1st to 10th */}
                            {selected1to10Keys.length > 0 && (
                              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                                <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 text-[11px] font-bold text-slate-800">
                                  Selected Classes (1st–10th) — Board-Wise Monthly Fee (₹)
                                </div>
                                <div className="hidden sm:grid grid-cols-12 gap-3 px-3.5 py-2 bg-white border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                  <div className="col-span-4">Class</div>
                                  <div className="col-span-4">CBSE Board (₹ / Month)</div>
                                  <div className="col-span-4">ICSE Board (₹ / Month)</div>
                                </div>
                                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                                  {selected1to10Keys.map((clsKey) => {
                                    const row = teacherFeeStructure?.classes1to10?.[clsKey] || {};
                                    const cbseSplit = row.cbse && row.cbse > 0 ? calculateFeeSplit(row.cbse) : null;
                                    const icseSplit = row.icse && row.icse > 0 ? calculateFeeSplit(row.icse) : null;
                                    return (
                                      <div
                                        key={clsKey}
                                        className="grid grid-cols-1 sm:grid-cols-12 items-start gap-2 sm:gap-3 px-3.5 py-2.5 hover:bg-slate-50/70"
                                      >
                                        <span className="sm:col-span-4 font-bold text-slate-800 text-xs sm:pt-2">
                                          {clsKey} Class
                                        </span>
                                        <div className="grid grid-cols-1 sm:contents gap-2.5">
                                          <div className="sm:col-span-4">
                                            <span className="block sm:hidden text-[10px] font-bold text-blue-700 mb-1">
                                              CBSE (₹/mo)
                                            </span>
                                            <div className="flex items-center rounded-xl border border-slate-300 bg-white px-2.5 h-9 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                                              <span className="text-xs font-bold text-slate-400 mr-1.5 select-none pointer-events-none shrink-0">
                                                ₹
                                              </span>
                                              <input
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="e.g. 2500"
                                                value={row.cbse !== undefined && row.cbse > 0 ? String(row.cbse) : ''}
                                                onChange={(e) => {
                                                  const digits = e.target.value.replace(/\D/g, '');
                                                  const val = digits ? Number(digits) : undefined;
                                                  setTeacherFeeStructure((prev) => {
                                                    const base1to10 = prev?.classes1to10 || createEmptyFeeStructure().classes1to10;
                                                    return {
                                                      classes1to10: {
                                                        ...base1to10,
                                                        [clsKey]: {
                                                          ...(base1to10[clsKey] || {}),
                                                          cbse: val && val > 0 ? val : undefined
                                                        }
                                                      },
                                                      classes11to12: prev?.classes11to12 || { '11th': {}, '12th': {} }
                                                    };
                                                  });
                                                }}
                                                className="w-full min-w-0 bg-transparent text-xs font-semibold text-slate-900 focus:outline-none"
                                              />
                                            </div>
                                            {cbseSplit && (
                                              <div className="mt-1 rounded-lg bg-emerald-50/90 border border-emerald-200/80 px-2 py-1 text-[10px] leading-snug font-mono tabular-nums space-y-0.5">
                                                <div className="flex items-center justify-between text-slate-600">
                                                  <span>Entered:</span>
                                                  <span className="font-semibold text-slate-900">
                                                    ₹{cbseSplit.grossFee.toLocaleString('en-IN')}
                                                  </span>
                                                </div>
                                                <div className="flex items-center justify-between text-slate-500">
                                                  <span>Platform ({PLATFORM_FEE_PERCENT}%):</span>
                                                  <span>-₹{cbseSplit.platformFee.toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="flex items-center justify-between pt-0.5 border-t border-emerald-200/70 text-emerald-800 font-bold">
                                                  <span>You Get ({TUTOR_SHARE_PERCENT}%):</span>
                                                  <span>₹{cbseSplit.tutorEarnings.toLocaleString('en-IN')}/mo</span>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                          <div className="sm:col-span-4">
                                            <span className="block sm:hidden text-[10px] font-bold text-amber-700 mb-1">
                                              ICSE (₹/mo)
                                            </span>
                                            <div className="flex items-center rounded-xl border border-slate-300 bg-white px-2.5 h-9 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100">
                                              <span className="text-xs font-bold text-slate-400 mr-1.5 select-none pointer-events-none shrink-0">
                                                ₹
                                              </span>
                                              <input
                                                type="text"
                                                inputMode="numeric"
                                                placeholder="e.g. 2800"
                                                value={row.icse !== undefined && row.icse > 0 ? String(row.icse) : ''}
                                                onChange={(e) => {
                                                  const digits = e.target.value.replace(/\D/g, '');
                                                  const val = digits ? Number(digits) : undefined;
                                                  setTeacherFeeStructure((prev) => {
                                                    const base1to10 = prev?.classes1to10 || createEmptyFeeStructure().classes1to10;
                                                    return {
                                                      classes1to10: {
                                                        ...base1to10,
                                                        [clsKey]: {
                                                          ...(base1to10[clsKey] || {}),
                                                          icse: val && val > 0 ? val : undefined
                                                        }
                                                      },
                                                      classes11to12: prev?.classes11to12 || { '11th': {}, '12th': {} }
                                                    };
                                                  });
                                                }}
                                                className="w-full min-w-0 bg-transparent text-xs font-semibold text-slate-900 focus:outline-none"
                                              />
                                            </div>
                                            {icseSplit && (
                                              <div className="mt-1 rounded-lg bg-emerald-50/90 border border-emerald-200/80 px-2 py-1 text-[10px] leading-snug font-mono tabular-nums space-y-0.5">
                                                <div className="flex items-center justify-between text-slate-600">
                                                  <span>Entered:</span>
                                                  <span className="font-semibold text-slate-900">
                                                    ₹{icseSplit.grossFee.toLocaleString('en-IN')}
                                                  </span>
                                                </div>
                                                <div className="flex items-center justify-between text-slate-500">
                                                  <span>Platform ({PLATFORM_FEE_PERCENT}%):</span>
                                                  <span>-₹{icseSplit.platformFee.toLocaleString('en-IN')}</span>
                                                </div>
                                                <div className="flex items-center justify-between pt-0.5 border-t border-emerald-200/70 text-emerald-800 font-bold">
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
                              <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
                                <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                                  <span className="text-[11px] font-bold text-slate-800">
                                    Selected Senior Classes ({selectedSeniorKeys.join(' & ')}) — Subject-Wise Fee (₹)
                                  </span>
                                  <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200">
                                    {selectedSeniorKeys.map((srCls) => (
                                      <button
                                        key={srCls}
                                        type="button"
                                        onClick={() => setActiveSeniorFeeTab(srCls)}
                                        className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                                          effectiveSeniorTab === srCls
                                            ? 'bg-slate-900 text-white'
                                            : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                      >
                                        {srCls} Class
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                {seniorSubjectsToShow.length === 0 ? (
                                  <div className="p-3.5 text-center text-[11px] text-slate-500 font-medium">
                                    Select subjects in &quot;Subjects Taught&quot; above to enter subject-wise fees for {effectiveSeniorTab} Class.
                                  </div>
                                ) : (
                                  <>
                                    <div className="hidden sm:grid grid-cols-12 gap-3 px-3.5 py-2 bg-white border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                      <div className="col-span-4">{effectiveSeniorTab} Subject</div>
                                      <div className="col-span-4">CBSE Board (₹ / Month)</div>
                                      <div className="col-span-4">ICSE / ISC Board (₹ / Month)</div>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                                      {seniorSubjectsToShow.map((sub) => {
                                        const subFee = teacherFeeStructure?.classes11to12?.[effectiveSeniorTab]?.[sub] || {};
                                        const seniorCbseSplit =
                                          subFee.cbse && subFee.cbse > 0 ? calculateFeeSplit(subFee.cbse) : null;
                                        const seniorIcseSplit =
                                          subFee.icse && subFee.icse > 0 ? calculateFeeSplit(subFee.icse) : null;
                                        return (
                                          <div
                                            key={`${effectiveSeniorTab}-${sub}`}
                                            className="grid grid-cols-1 sm:grid-cols-12 items-start gap-2 sm:gap-3 px-3.5 py-2.5 hover:bg-slate-50/70"
                                          >
                                            <span className="sm:col-span-4 font-bold text-slate-800 text-xs truncate sm:pt-2">
                                              {sub}
                                            </span>
                                            <div className="grid grid-cols-1 sm:contents gap-2.5">
                                              <div className="sm:col-span-4">
                                                <span className="block sm:hidden text-[10px] font-bold text-blue-700 mb-1">
                                                  CBSE (₹/mo)
                                                </span>
                                                <div className="flex items-center rounded-xl border border-slate-300 bg-white px-2.5 h-9 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                                                  <span className="text-xs font-bold text-slate-400 mr-1.5 select-none pointer-events-none shrink-0">
                                                    ₹
                                                  </span>
                                                  <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="e.g. 3500"
                                                    value={subFee.cbse !== undefined && subFee.cbse > 0 ? String(subFee.cbse) : ''}
                                                    onChange={(e) => {
                                                      const digits = e.target.value.replace(/\D/g, '');
                                                      const val = digits ? Number(digits) : undefined;
                                                      setTeacherFeeStructure((prev) => {
                                                        const base11to12 = prev?.classes11to12 || { '11th': {}, '12th': {} };
                                                        const tabMap = base11to12[effectiveSeniorTab] || {};
                                                        return {
                                                          classes1to10: prev?.classes1to10 || createEmptyFeeStructure().classes1to10,
                                                          classes11to12: {
                                                            ...base11to12,
                                                            [effectiveSeniorTab]: {
                                                              ...tabMap,
                                                              [sub]: {
                                                                ...(tabMap[sub] || {}),
                                                                cbse: val && val > 0 ? val : undefined
                                                              }
                                                            }
                                                          }
                                                        };
                                                      });
                                                    }}
                                                    className="w-full min-w-0 bg-transparent text-xs font-semibold text-slate-900 focus:outline-none"
                                                  />
                                                </div>
                                                {seniorCbseSplit && (
                                                  <div className="mt-1 rounded-lg bg-emerald-50/90 border border-emerald-200/80 px-2 py-1 text-[10px] leading-snug font-mono tabular-nums space-y-0.5">
                                                    <div className="flex items-center justify-between text-slate-600">
                                                      <span>Entered:</span>
                                                      <span className="font-semibold text-slate-900">
                                                        ₹{seniorCbseSplit.grossFee.toLocaleString('en-IN')}
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-slate-500">
                                                      <span>Platform ({PLATFORM_FEE_PERCENT}%):</span>
                                                      <span>-₹{seniorCbseSplit.platformFee.toLocaleString('en-IN')}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between pt-0.5 border-t border-emerald-200/70 text-emerald-800 font-bold">
                                                      <span>You Get ({TUTOR_SHARE_PERCENT}%):</span>
                                                      <span>₹{seniorCbseSplit.tutorEarnings.toLocaleString('en-IN')}/mo</span>
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                              <div className="sm:col-span-4">
                                                <span className="block sm:hidden text-[10px] font-bold text-amber-700 mb-1">
                                                  ICSE (₹/mo)
                                                </span>
                                                <div className="flex items-center rounded-xl border border-slate-300 bg-white px-2.5 h-9 focus-within:border-amber-500 focus-within:ring-2 focus-within:ring-amber-100">
                                                  <span className="text-xs font-bold text-slate-400 mr-1.5 select-none pointer-events-none shrink-0">
                                                    ₹
                                                  </span>
                                                  <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    placeholder="e.g. 3800"
                                                    value={subFee.icse !== undefined && subFee.icse > 0 ? String(subFee.icse) : ''}
                                                    onChange={(e) => {
                                                      const digits = e.target.value.replace(/\D/g, '');
                                                      const val = digits ? Number(digits) : undefined;
                                                      setTeacherFeeStructure((prev) => {
                                                        const base11to12 = prev?.classes11to12 || { '11th': {}, '12th': {} };
                                                        const tabMap = base11to12[effectiveSeniorTab] || {};
                                                        return {
                                                          classes1to10: prev?.classes1to10 || createEmptyFeeStructure().classes1to10,
                                                          classes11to12: {
                                                            ...base11to12,
                                                            [effectiveSeniorTab]: {
                                                              ...tabMap,
                                                              [sub]: {
                                                                ...(tabMap[sub] || {}),
                                                                icse: val && val > 0 ? val : undefined
                                                              }
                                                            }
                                                          }
                                                        };
                                                      });
                                                    }}
                                                    className="w-full min-w-0 bg-transparent text-xs font-semibold text-slate-900 focus:outline-none"
                                                  />
                                                </div>
                                                {seniorIcseSplit && (
                                                  <div className="mt-1 rounded-lg bg-emerald-50/90 border border-emerald-200/80 px-2 py-1 text-[10px] leading-snug font-mono tabular-nums space-y-0.5">
                                                    <div className="flex items-center justify-between text-slate-600">
                                                      <span>Entered:</span>
                                                      <span className="font-semibold text-slate-900">
                                                        ₹{seniorIcseSplit.grossFee.toLocaleString('en-IN')}
                                                      </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-slate-500">
                                                      <span>Platform ({PLATFORM_FEE_PERCENT}%):</span>
                                                      <span>-₹{seniorIcseSplit.platformFee.toLocaleString('en-IN')}</span>
                                                    </div>
                                                    <div className="flex items-center justify-between pt-0.5 border-t border-emerald-200/70 text-emerald-800 font-bold">
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
                                const row = teacherFeeStructure?.classes1to10?.[clsKey];
                                if (row?.cbse && row.cbse > 0) {
                                  enteredRows.push({ label: `${clsKey} Class`, board: 'CBSE', gross: row.cbse });
                                }
                                if (row?.icse && row.icse > 0) {
                                  enteredRows.push({ label: `${clsKey} Class`, board: 'ICSE', gross: row.icse });
                                }
                              });
                              selectedSeniorKeys.forEach((clsKey) => {
                                const subMap = teacherFeeStructure?.classes11to12?.[clsKey] || {};
                                const allClassSubs = Array.from(
                                  new Set([...seniorSubjectsToShow, ...Object.keys(subMap)])
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
                                  <div className="rounded-xl bg-blue-50/70 border border-blue-200/80 px-3 py-2 text-[11px] text-blue-900">
                                    Enter a monthly fee above to see the entered price,{' '}
                                    <strong>{PLATFORM_FEE_PERCENT}% platform fee</strong> deduction, and your{' '}
                                    <strong>{TUTOR_SHARE_PERCENT}% net earnings</strong>.
                                  </div>
                                );
                              }

                              return (
                                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white overflow-hidden">
                                  <div className="px-3.5 py-2 bg-emerald-100/70 border-b border-emerald-200 flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-[11px] font-extrabold text-emerald-950">
                                      Your Earnings Preview (After {PLATFORM_FEE_PERCENT}% Platform Fee)
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-emerald-800 border border-emerald-300">
                                      {TUTOR_SHARE_PERCENT}% Tutor Share • {PLATFORM_FEE_PERCENT}% Platform Fee
                                    </span>
                                  </div>
                                  <div className="divide-y divide-emerald-100 max-h-44 overflow-y-auto">
                                    {enteredRows.map((item) => {
                                      const split = calculateFeeSplit(item.gross);
                                      return (
                                        <div
                                          key={`${item.label}-${item.board}`}
                                          className="px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-[11px]"
                                        >
                                          <div className="flex items-center gap-1.5 min-w-0">
                                            <span className="font-bold text-slate-900 truncate">{item.label}</span>
                                            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                                              {item.board}
                                            </span>
                                          </div>
                                          <div className="flex flex-wrap items-center gap-2.5 font-mono tabular-nums text-[10.5px]">
                                            <span className="text-slate-600">
                                              Entered:{' '}
                                              <strong className="text-slate-900">
                                                ₹{split.grossFee.toLocaleString('en-IN')}
                                              </strong>
                                            </span>
                                            <span className="text-rose-600">
                                              Fee ({PLATFORM_FEE_PERCENT}%): -₹{split.platformFee.toLocaleString('en-IN')}
                                            </span>
                                            <span className="px-2 py-0.5 rounded bg-emerald-600 text-white font-bold">
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
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Parent Profile Fields */}
              {!isTeacher && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Parent / Guardian Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Local address with landmarks</label>
                      <input
                        type="text"
                        value={locality}
                        onChange={(e) => setLocality(e.target.value)}
                        placeholder="e.g. Near Daily Market, Rayagada"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Parent Specific Fields */}
              {!isTeacher && (
                <>
                  <div className="pt-2 border-t border-slate-100">
                    <p className="font-bold text-slate-900 mb-2">Student Information</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Student Name</label>
                        <input
                          type="text"
                          value={childName}
                          onChange={(e) => setChildName(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Class / Standard</label>
                          <select
                            value={childGrade}
                            onChange={(e) => setChildGrade(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                          >
                            <option value="">Select Class</option>
                            <option value="Class 1">Class 1</option>
                            <option value="Class 2">Class 2</option>
                            <option value="Class 3">Class 3</option>
                            <option value="Class 4">Class 4</option>
                            <option value="Class 5">Class 5</option>
                            <option value="Class 6">Class 6</option>
                            <option value="Class 7">Class 7</option>
                            <option value="Class 8">Class 8</option>
                            <option value="Class 9">Class 9</option>
                            <option value="Class 10">Class 10</option>
                            <option value="Class 11">Class 11</option>
                            <option value="Class 12">Class 12</option>
                          </select>
                        </div>
                        <div>
                          <label className="block font-semibold text-slate-700 mb-1">Board</label>
                          <select
                            value={childBoard}
                            onChange={(e) => setChildBoard(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none bg-white"
                          >
                            <option value="">Select Board</option>
                            {INDIAN_BOARDS_A_TO_Z.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">School Attending</label>
                        <input
                          type="text"
                          value={childSchool}
                          onChange={(e) => setChildSchool(e.target.value)}
                          placeholder="School name"
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-70"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      )}

      {/* DEDICATED STUDENT & PARENT DETAILS COMPLETION MODAL */}
      {isParentDetailsModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && setIsParentDetailsModalOpen(false)}
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-200 text-left relative my-8">
            <button
              type="button"
              onClick={() => setIsParentDetailsModalOpen(false)}
              aria-label="Close"
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-slate-100">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0c2340] to-[#1d4ed8] text-white flex items-center justify-center shrink-0 shadow-md">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                  Student &amp; Parent Details
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Store details in the database to get verified home tutors in Rayagada.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveParentStudentDetails} className="space-y-4">
              {/* 1. Parent Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Parent / Guardian Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra Patnaik"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              {/* 2. Child / Student Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Child / Student Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="e.g. Aarav Patnaik"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              {/* 3. Class and Board in a 2-column grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Class / Standard <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={childGrade}
                    onChange={(e) => setChildGrade(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                  >
                    <option value="">Select Class</option>
                    <option value="Class 1">Class 1st</option>
                    <option value="Class 2">Class 2nd</option>
                    <option value="Class 3">Class 3rd</option>
                    <option value="Class 4">Class 4th</option>
                    <option value="Class 5">Class 5th</option>
                    <option value="Class 6">Class 6th</option>
                    <option value="Class 7">Class 7th</option>
                    <option value="Class 8">Class 8th</option>
                    <option value="Class 9">Class 9th</option>
                    <option value="Class 10">Class 10th</option>
                    <option value="Class 11">Class 11th</option>
                    <option value="Class 12">Class 12th</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Educational Board <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={childBoard}
                    onChange={(e) => setChildBoard(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none bg-white"
                  >
                    <option value="">Select Board</option>
                    <option value="Central Board of Secondary Education (CBSE)">CBSE (Central Board)</option>
                    <option value="Council for the Indian School Certificate Examinations (CISCE / ICSE / ISC)">ICSE / ISC</option>
                    <option value="Board of Secondary Education, Odisha (BSE Odisha)">BSE Odisha (State Board)</option>
                    <option value="Council of Higher Secondary Education, Odisha (CHSE Odisha)">CHSE Odisha (+2)</option>
                    {INDIAN_BOARDS_A_TO_Z.filter(
                      (b) =>
                        !b.includes('CBSE') &&
                        !b.includes('CISCE') &&
                        !b.includes('BSE Odisha') &&
                        !b.includes('CHSE Odisha')
                    ).map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 4. Phone Number & Locality */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Contact Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Locality in Rayagada
                  </label>
                  <input
                    type="text"
                    value={locality}
                    onChange={(e) => setLocality(e.target.value)}
                    placeholder="e.g. Indira Nagar / College Road"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* 5. School Attending */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  School Attending (Optional)
                </label>
                <input
                  type="text"
                  value={childSchool}
                  onChange={(e) => setChildSchool(e.target.value)}
                  placeholder="e.g. Deepti Convent / De Paul / Kendriya Vidyalaya"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
                />
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsParentDetailsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingParentDetails}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#0c2340] via-[#122e54] to-[#1d4ed8] hover:from-slate-900 hover:to-blue-900 text-white font-black text-xs sm:text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  {isSavingParentDetails ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving to Database...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save &amp; Store in Database</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIVE CLASS MODAL */}
      {isLiveClassModalOpen && selectedLiveClass && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && setIsLiveClassModalOpen(false)}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-slate-200 space-y-4 text-left relative my-6">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <Video className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Live Classroom</span>
                  <h3 className="text-base font-bold text-slate-900 truncate">{selectedLiveClass.subject}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLiveClassModalOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Educator:</span>
                <span className="font-semibold text-slate-900">{selectedLiveClass.teacher}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Schedule:</span>
                <span className="font-semibold text-slate-900">{selectedLiveClass.time}</span>
              </div>
            </div>

            {liveClassNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                {liveClassNotice}
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() =>
                  setLiveClassNotice(
                    `Live classroom access for ${selectedLiveClass.subject} (${selectedLiveClass.time}) is coordinated via Kumari Institute Helpdesk. Call +91 ${instituteInfo.phone} or check WhatsApp for today's active meeting link.`
                  )
                }
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Request Live Classroom Link</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLiveClassNotice(null);
                  setIsLiveClassModalOpen(false);
                }}
                className="w-full py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MESSAGE TUTOR MODAL */}
      {isMessageModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && setIsMessageModalOpen(false)}
        >
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-xl border border-slate-200 space-y-4 text-left relative my-6">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900 truncate">Message {messageRecipient.name}</h3>
                <p className="text-xs text-slate-500">{messageRecipient.role} • Leave a note or inquiry</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMessageModalOpen(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer shrink-0 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {messageSent ? (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Message delivered successfully!</span>
              </div>
            ) : (
              <form onSubmit={handleSendMessage} className="space-y-3">
                {messageError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{messageError}</span>
                  </div>
                )}

                <textarea
                  rows={3}
                  required
                  placeholder={`Type your note for ${messageRecipient.name}...`}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none resize-none"
                />

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    disabled={isSendingMessage}
                    onClick={() => setIsMessageModalOpen(false)}
                    className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingMessage}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold text-xs cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                  >
                    {isSendingMessage && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSendingMessage ? 'Sending...' : 'Send Message'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* SALARY & TRANSACTION HISTORY MODAL (FOR TEACHER) */}
      {isSalaryModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => e.target === e.currentTarget && setIsSalaryModalOpen(false)}
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-left relative">
            {/* Attractive Header */}
            <div className="bg-[#0c2340] bg-gradient-to-r from-[#0c2340] via-[#132e54] to-[#1e3a8a] text-white p-5 sm:p-6 relative shrink-0">
              <button
                type="button"
                onClick={() => setIsSalaryModalOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer ring-1 ring-white/20 shadow-xs"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">
                <Wallet className="w-4 h-4" />
                <span>Earnings &amp; Payout Dashboard</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Tutor Earnings &amp; Settlements
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 mt-1">
                Completed parent payments held during the 1-month teaching cycle, matured earnings &amp; withdrawal settlements.
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-5 flex-1 overflow-y-auto">
            {/* Salary & Earnings Key Figures */}
            {(() => {
              const breakdown = calculateTutorEarnings(
                activeUserData || user || {},
                assignedStudents,
                tutorWithdrawals,
                tutorPaidFees
              );
              const DAY_MS = 24 * 60 * 60 * 1000;
              const CYCLE_MS = 30 * DAY_MS;
              const nowMs = Date.now();

              // Combine withdrawal requests with past disbursement history
              const allTransactions = [
                ...tutorWithdrawals.map((w) => ({
                  id: w.id,
                  title: `Withdrawal Notice (${w.paymentMethod === 'upi' ? 'UPI' : 'Bank Transfer'})`,
                  date: new Date(w.createdAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  }),
                  amount: `₹ ${(w.transferredAmount || w.amount).toLocaleString('en-IN')}`,
                  rawAmount: w.amount,
                  status:
                    w.status === 'approved'
                      ? 'Approved & Transferred'
                      : w.status === 'pending'
                      ? 'Pending Admin Verification'
                      : 'Declined',
                  mode: w.transferMethod || (w.paymentMethod === 'upi' ? 'UPI Transfer' : 'Direct Bank NEFT/IMPS'),
                  utrNumber: w.utrNumber,
                  paymentSlipUrl: w.paymentSlipUrl,
                  adminNote: w.adminNote
                })),
                ...((user as any)?.payoutHistory || []).map((p: any) => ({
                  id: p.id,
                  title: p.title || 'Tuition Remuneration',
                  date: p.date,
                  amount: p.amount,
                  status: p.status || 'Settled',
                  mode: p.mode || 'Bank Transfer',
                  utrNumber: p.utrNumber,
                  paymentSlipUrl: p.paymentSlipUrl,
                  adminNote: p.adminNote
                }))
              ];

              return (
                <>
                  {/* Tutor Earnings & Payout Structure (Poster + Live 80% / 20% Calculation) */}
                  <div className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-[#0c2340]">
                          Tutor Earnings &amp; Payout Structure
                        </h4>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          80% of every completed parent fee payment goes to you · 20% Kumari Institute platform &amp; support fee
                        </p>
                      </div>
                      <span className="text-xs font-bold font-mono tabular-nums text-[#1d4ed8]">
                        80% / 20% Split
                      </span>
                    </div>

                    <div className="rounded-xl overflow-hidden border border-slate-200 bg-white">
                      <img
                        src="/assets/aistudio/image_4def1a4b.png"
                        alt="Teach with Kumari Institute — Tutor Earnings 80% and Kumari Institute Fee 20%"
                        className="w-full h-auto object-contain block"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>

                  {/* Top Key Figures: Matured Tutor Earnings (80%), Pending Parent Fee (paid < 30 days), and Available Balance (80%) */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* 1. Matured Tutor Earnings (80% after 1 month / 30 days teaching completion) */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80">
                      <span className="text-[11px] text-slate-500 font-medium block">Matured Earnings (80%)</span>
                      <span className="text-xl font-black font-mono tabular-nums text-[#0c2340] block mt-0.5">
                        ₹ {breakdown.totalCurrentEarned.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium block">
                        {breakdown.maturedStudentsCount} completed paid {breakdown.maturedStudentsCount === 1 ? 'cycle' : 'cycles'} (1+ month taught) · Gross ₹{breakdown.totalVerifiedGrossPaid.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {/* 2. Pending Parent Fee (Completed parent payments inside 1-month teaching cycle) */}
                    <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/90">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] text-amber-900 font-bold block">Pending Parent Fee (80%)</span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-amber-200/70 text-amber-800 uppercase tracking-wider shrink-0">
                          1-Month Hold
                        </span>
                      </div>
                      <span className="text-xl font-black font-mono tabular-nums text-amber-700 block mt-0.5">
                        ₹ {breakdown.pendingAmount.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] text-amber-800/80 font-medium block">
                        {breakdown.nextUnlockDaysRemaining !== null
                          ? `Moves to Available Balance in ${breakdown.nextUnlockDaysRemaining} ${breakdown.nextUnlockDaysRemaining === 1 ? 'day' : 'days'} (after 1 month teaching)`
                          : 'Updates with your 80% share once a parent completes fee payment'}
                        {breakdown.pendingGrossAmount > 0
                          ? ` · Gross Paid ₹${breakdown.pendingGrossAmount.toLocaleString('en-IN')}`
                          : ''}
                      </span>
                    </div>

                    {/* 3. Available Balance (Completed 1-month paid cycles ready for withdrawal) */}
                    <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/90 relative overflow-hidden flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-emerald-900 font-bold block">Available Balance (80%)</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-emerald-200 text-emerald-900 uppercase tracking-wider">
                            Withdrawable
                          </span>
                        </div>
                        <span className="text-xl font-black font-mono tabular-nums text-emerald-700 block mt-0.5">
                          ₹ {breakdown.currentAvailableBalance.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-emerald-800/80 font-medium block">
                          Earned ₹{breakdown.totalCurrentEarned.toLocaleString('en-IN')} − Paid ₹{breakdown.totalApprovedWithdrawn.toLocaleString('en-IN')}
                          {breakdown.totalPendingWithdrawn > 0 ? ` − Queued ₹${breakdown.totalPendingWithdrawn.toLocaleString('en-IN')}` : ''}
                        </span>
                      </div>

                      <div className="pt-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setWithdrawAmount(
                              breakdown.currentAvailableBalance > 0
                                ? breakdown.currentAvailableBalance.toString()
                                : ''
                            );
                            setWithdrawNotice(null);
                            setIsWithdrawModalOpen(true);
                          }}
                          disabled={breakdown.currentAvailableBalance <= 0}
                          className="w-full py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <IndianRupee className="w-3.5 h-3.5" />
                          <span>Withdrawal</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Completed Parent Fee Payments Ledger (80% Share Tracker) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900">
                        Verified Parent Fee Payments (80% Share)
                      </h4>
                      <span className="text-[11px] text-slate-400">
                        {tutorPaidFees.length} {tutorPaidFees.length === 1 ? 'payment' : 'payments'}
                      </span>
                    </div>

                    {tutorPaidFees.length > 0 ? (
                      <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden text-xs">
                        {tutorPaidFees.map((fee) => {
                          const { grossFee, tutorEarnings } = calculateFeeSplit(fee.amount);
                          const paidMs = new Date(fee.paidAt || fee.createdAt || nowMs).getTime();
                          const elapsedMs = isNaN(paidMs) ? 0 : Math.max(0, nowMs - paidMs);
                          const isMaturedByTime = elapsedMs >= CYCLE_MS;
                          const matchedStudent = assignedStudents.find((s) => {
                            const sBookingId = String(s.bookingId || s.id || '').replace(/^std-/, '').trim();
                            const sName = String(s.studentName || s.name || '').trim().toLowerCase();
                            const fBookingId = String(fee.bookingId || '').replace(/^std-/, '').trim();
                            const fName = String(fee.studentName || '').trim().toLowerCase();
                            return (fBookingId && sBookingId && fBookingId === sBookingId) || (fName && sName && fName === sName);
                          });
                          const isMatured = isMaturedByTime || Boolean(matchedStudent && (matchedStudent.monthCompleted === true || matchedStudent.isMonthCompleted === true));
                          const daysLeft = isMatured ? 0 : Math.max(1, Math.ceil((CYCLE_MS - elapsedMs) / DAY_MS));
                          return (
                            <div key={fee.receiptNo || fee.id} className="p-3 bg-white flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-slate-900 truncate">
                                    {fee.studentName}
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                      isMatured
                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                        : 'bg-amber-50 text-amber-800 border-amber-200'
                                    }`}
                                  >
                                    {isMatured
                                      ? 'Matured (1+ Month Taught)'
                                      : `Pending Fee · ${daysLeft}d left in 1-month cycle`}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                                  <span>Parent: {fee.parentName || 'Parent'}</span>
                                  <span>•</span>
                                  <span>Paid {fee.paidDate || new Date(fee.paidAt || nowMs).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                  <span>•</span>
                                  <span>Gross Fee ₹{grossFee.toLocaleString('en-IN')}</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <span className={`font-black font-mono tabular-nums text-sm ${isMatured ? 'text-emerald-700' : 'text-amber-700'}`}>
                                  ₹{tutorEarnings.toLocaleString('en-IN')}
                                </span>
                                <span className="text-[10px] text-slate-400 block">Your 80% Share</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-5 px-4 text-center text-slate-500 text-xs bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
                        <p className="font-semibold text-slate-700">No Completed Parent Fee Payments Yet</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Once an assigned parent completes their fee payment successfully, your 80% share immediately appears in Pending Parent Fee and unlocks after 1 month (30 days) of teaching.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Past Transaction & Withdrawal History Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900">Withdrawal Notices &amp; Payout Slips</h4>
                      <span className="text-[11px] text-slate-400">{allTransactions.length} records</span>
                    </div>

                    {allTransactions.length > 0 ? (
                      <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-xl overflow-hidden text-xs">
                        {allTransactions.map((txn: any) => (
                          <div key={txn.id} className="p-3 bg-white hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-slate-900">{txn.title}</span>
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                                    txn.status.includes('Approved') || txn.status === 'Settled'
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                      : txn.status.includes('Pending')
                                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border-rose-100'
                                  }`}
                                >
                                  {txn.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                                <span>Requested / Processed on {txn.date}</span>
                                {txn.mode && (
                                  <>
                                    <span>•</span>
                                    <span>{txn.mode}</span>
                                  </>
                                )}
                                {txn.utrNumber && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono text-slate-600">UTR: {txn.utrNumber}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="font-bold text-slate-900">{txn.amount}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedReceipt({
                                    id: txn.id,
                                    date: txn.date,
                                    description: txn.title,
                                    amount: txn.amount,
                                    status: txn.status,
                                    utrNumber: txn.utrNumber,
                                    transferMethod: txn.mode,
                                    paymentSlipUrl: txn.paymentSlipUrl,
                                    adminNote: txn.adminNote
                                  });
                                }}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 border border-blue-200 cursor-pointer transition-colors"
                              >
                                View Slip
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-slate-400 text-xs bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                        <Receipt className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                        <p className="font-semibold text-slate-600">No Withdrawal Notices Yet</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Submit a withdrawal notice from your available balance. When Admin transfers payment, UTR records and bank slips will appear here.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}

            <div className="flex items-center justify-between gap-3 pt-1 text-xs">
              <p className="text-[11px] text-slate-400">
                Your 80% share enters Pending Parent Fee once a parent pays successfully, and unlocks to Available Balance after completing 1 month (30 days) of teaching.
              </p>
              <button
                type="button"
                onClick={() => setIsSalaryModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs cursor-pointer shadow-xs shrink-0"
              >
                Close
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* TEACHER AVAILABILITY SLOTS MODAL (DIRECT TWO-WAY SYNC) */}
      {isAvailabilityModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && setIsAvailabilityModalOpen(false)}
        >
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden text-left relative my-8">
            {/* Attractive Header */}
            <div className="bg-gradient-to-r from-[#0c2340] via-[#132e54] to-[#1e3a8a] text-white p-6 relative">
              <button
                type="button"
                onClick={() => setIsAvailabilityModalOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer ring-1 ring-white/20 shadow-xs"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider mb-1">
                <Calendar className="w-4 h-4" />
                <span>Teaching Schedule</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Update Teaching Availability
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 mt-1">
                Select your 1-hour slots from morning 6:00 AM to night 9:00 PM. Directly updates your public tutor profile.
              </p>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

            {slotsSavedToast && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Availability slots updated and saved to your profile!</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-semibold text-slate-900">1-Hour Time Slots (6 AM to 9 PM)</span>
                <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                  {teacherSlots.length} of {AVAILABLE_1HR_SLOTS.length} selected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-y-auto p-1 border border-slate-100 rounded-xl">
                {AVAILABLE_1HR_SLOTS.map((slot) => {
                  const isChecked = teacherSlots.includes(slot);
                  return (
                    <label
                      key={slot}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'border-blue-500 bg-blue-50/60 text-blue-900 font-medium shadow-2xs'
                          : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleTeacherSlot(slot)}
                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <Clock className={`w-3.5 h-3.5 ${isChecked ? 'text-blue-600' : 'text-slate-400'}`} />
                      <span className="text-[11px]">{slot}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAvailabilityModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                disabled={isSavingSlots}
                onClick={handleSaveAvailability}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs cursor-pointer shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSavingSlots ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving Slots...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Availability</span>
                  </>
                )}
              </button>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* WITHDRAWAL REQUEST MODAL (FOR TEACHERS) */}
      {isWithdrawModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={(e) => e.target === e.currentTarget && setIsWithdrawModalOpen(false)}
        >
          <div className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden text-left relative">
            {/* Header (always visible, pinned above scrollable form) */}
            <div className="bg-[#0c2340] bg-gradient-to-r from-[#0c2340] via-[#132e54] to-[#1e3a8a] text-white p-5 sm:p-6 relative shrink-0">
              <button
                type="button"
                onClick={() => setIsWithdrawModalOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer ring-1 ring-white/25 shadow-xs"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1 pr-10">
                <Wallet className="w-4 h-4 shrink-0" />
                <span>Teacher Fund Withdrawal</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white pr-10">
                Withdrawal Request
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 mt-1">
                Submit a withdrawal notice for your matured 80% tuition earnings to receive transfer via UPI or Bank Account.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                const currentBreakdown = calculateTutorEarnings(
                  activeUserData || user || {},
                  assignedStudents,
                  tutorWithdrawals,
                  tutorPaidFees
                );
                handleWithdrawSubmit(e, currentBreakdown.currentAvailableBalance);
              }}
              className="p-5 sm:p-6 space-y-4 text-xs flex-1 overflow-y-auto"
            >
              {(() => {
                const currentBreakdown = calculateTutorEarnings(
                  activeUserData || user || {},
                  assignedStudents,
                  tutorWithdrawals,
                  tutorPaidFees
                );
                const maxAvailable = currentBreakdown.currentAvailableBalance;

                return (
                  <>
                    {/* Available Current Balance Notice */}
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                          Verified Available Balance (80%)
                        </span>
                        <span className="text-xl font-black text-emerald-700 font-mono tabular-nums">
                          ₹ {maxAvailable.toLocaleString('en-IN')}
                        </span>
                        <span className="text-[10px] text-emerald-800/80 block">
                          Earned ₹{currentBreakdown.totalCurrentEarned.toLocaleString('en-IN')} • Disbursed ₹{currentBreakdown.totalApprovedWithdrawn.toLocaleString('en-IN')}
                          {currentBreakdown.totalPendingWithdrawn > 0 ? ` • Pending ₹${currentBreakdown.totalPendingWithdrawn.toLocaleString('en-IN')}` : ''}
                        </span>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => setWithdrawAmount(maxAvailable > 0 ? maxAvailable.toString() : '0')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer transition-colors shadow-2xs"
                        >
                          Withdraw All
                        </button>
                        <button
                          type="button"
                          onClick={() => setWithdrawAmount(maxAvailable > 0 ? Math.round(maxAvailable / 2).toString() : '0')}
                          className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-[11px] font-bold cursor-pointer transition-colors"
                        >
                          50%
                        </button>
                      </div>
                    </div>

                    {withdrawNotice && (
                      <div className={`p-3 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                        withdrawNotice.includes('submitted')
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}>
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{withdrawNotice}</span>
                      </div>
                    )}

                    {/* Amount Input */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Withdrawal Amount (₹) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">
                          ₹
                        </span>
                        <input
                          type="number"
                          required
                          min={1}
                          step={1}
                          max={maxAvailable}
                          placeholder={`Enter amount up to ${maxAvailable}`}
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          className="w-full pl-8 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                      </div>
                    </div>

                    {/* Payment Method Selector */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Select Settlement Channel *
                      </label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <label
                          className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                            withdrawMethod === 'upi'
                              ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="withdrawMethod"
                            checked={withdrawMethod === 'upi'}
                            onChange={() => setWithdrawMethod('upi')}
                            className="rounded-full text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Direct UPI ID</span>
                        </label>

                        <label
                          className={`p-3 rounded-xl border flex items-center gap-2 cursor-pointer transition-all ${
                            withdrawMethod === 'bank_transfer'
                              ? 'border-emerald-600 bg-emerald-50/70 text-emerald-900 font-bold'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="withdrawMethod"
                            checked={withdrawMethod === 'bank_transfer'}
                            onChange={() => setWithdrawMethod('bank_transfer')}
                            className="rounded-full text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Bank Account</span>
                        </label>
                      </div>
                    </div>

                    {/* UPI Details */}
                    {withdrawMethod === 'upi' ? (
                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                          UPI ID / VPA *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 9876543210@paytm or tutor@oksbi"
                          value={withdrawUpiId}
                          onChange={(e) => setWithdrawUpiId(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 font-mono"
                        />
                        <p className="text-[11px] text-slate-400 mt-1">
                          Admin will transfer directly via Google Pay / PhonePe / Paytm / BHIM UPI.
                        </p>
                      </div>
                    ) : (
                      /* Bank Account Details */
                      <div className="space-y-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Account Holder Name *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Name as per Passbook"
                              value={withdrawAccountHolder}
                              onChange={(e) => setWithdrawAccountHolder(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Bank Name *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. State Bank of India"
                              value={withdrawBankName}
                              onChange={(e) => setWithdrawBankName(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Account Number *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="Bank Account Number"
                              value={withdrawAccountNumber}
                              onChange={(e) => setWithdrawAccountNumber(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-mono"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              IFSC Code *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. SBIN0000167"
                              value={withdrawIfsc}
                              onChange={(e) => setWithdrawIfsc(e.target.value.toUpperCase())}
                              className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white font-mono uppercase"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Optional Note */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        Optional Note to Admin
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Please settle for Class 8 tuition batch"
                        value={withdrawNotes}
                        onChange={(e) => setWithdrawNotes(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setIsWithdrawModalOpen(false)}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={isSubmittingWithdraw || maxAvailable <= 0}
                        className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isSubmittingWithdraw ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Submitting Notice...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Send Withdrawal Notice</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                );
              })()}
            </form>
          </div>
        </div>
      )}

      {/* RECEIPT & PAYOUT SLIP MODAL */}
      {selectedReceipt && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && setSelectedReceipt(null)}
        >
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden text-left relative my-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#0c2340] via-[#132e54] to-[#1e3a8a] text-white p-6 relative">
              <button
                type="button"
                onClick={() => setSelectedReceipt(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer ring-1 ring-white/20 shadow-xs"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">
                <Receipt className="w-4 h-4" />
                <span>
                  {selectedReceipt.paymentGateway === 'Razorpay' || selectedReceipt.razorpayPaymentId
                    ? 'Razorpay Verified Receipt'
                    : 'Verified Transfer Voucher'}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {selectedReceipt.paymentGateway === 'Razorpay' || selectedReceipt.razorpayPaymentId || selectedReceipt.studentName
                  ? 'Official Fee Payment Receipt'
                  : 'Official Payout Voucher'}
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 mt-1">
                Kumari Educational Coaching Institute • Rayagada, Odisha
              </p>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Receipt / Reference ID:</span>
                <span className="font-mono font-bold text-slate-900">{selectedReceipt.id}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Date &amp; Time:</span>
                <span className="font-semibold text-slate-900">{selectedReceipt.date}</span>
              </div>
              {selectedReceipt.studentName && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Student:</span>
                  <span className="font-bold text-slate-900">{selectedReceipt.studentName}</span>
                </div>
              )}
              {selectedReceipt.tutorName && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Educator:</span>
                  <span className="font-bold text-slate-900">{selectedReceipt.tutorName}</span>
                </div>
              )}
              <div className="flex justify-between items-center gap-3">
                <span className="text-slate-500 font-medium shrink-0">Payment Purpose:</span>
                <span className="font-semibold text-slate-900 text-right">{selectedReceipt.description}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-medium">Payment Method:</span>
                <span className="font-semibold text-blue-700">{selectedReceipt.transferMethod || 'Direct Bank Settlement'}</span>
              </div>
              {selectedReceipt.razorpayOrderId && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Razorpay Order ID:</span>
                  <span className="font-mono text-slate-800">{selectedReceipt.razorpayOrderId}</span>
                </div>
              )}
              {selectedReceipt.nextDueDate && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Next Renewal (30 Days):</span>
                  <span className="font-bold text-blue-700">{selectedReceipt.nextDueDate}</span>
                </div>
              )}

              {/* Razorpay Payment ID or Bank UTR Number */}
              {selectedReceipt.utrNumber ? (
                <div className="p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex justify-between items-center gap-2">
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                      {selectedReceipt.razorpayPaymentId ? 'Razorpay Payment ID' : 'Bank UTR / Transaction No.'}
                    </span>
                    <span className="font-mono font-black text-sm text-emerald-900 break-all">
                      {selectedReceipt.utrNumber}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedReceipt.utrNumber) {
                        navigator.clipboard.writeText(selectedReceipt.utrNumber);
                      }
                    }}
                    className="px-2 py-1 rounded bg-white text-emerald-800 font-bold text-[10px] border border-emerald-300 hover:bg-emerald-100 cursor-pointer shrink-0"
                  >
                    Copy ID
                  </button>
                </div>
              ) : null}

              {selectedReceipt.adminNote && (
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px]">
                  <strong className="block font-bold">Cycle &amp; Verification Note:</strong>
                  <span>{selectedReceipt.adminNote}</span>
                </div>
              )}

              <div className="flex justify-between items-baseline font-bold pt-2 border-t border-slate-200">
                <span className="text-slate-900 text-sm">
                  {selectedReceipt.razorpayPaymentId || selectedReceipt.studentName ? 'Amount Paid:' : 'Amount Transferred:'}
                </span>
                <span className="text-xl font-black text-emerald-700 tabular-nums">{selectedReceipt.amount}</span>
              </div>
            </div>

            {/* Payment Slip Image Preview */}
            {selectedReceipt.paymentSlipUrl ? (
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-700 block">
                  Official Bank Transfer Slip / Proof:
                </span>
                <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-100 max-h-56 flex items-center justify-center">
                  <img
                    src={selectedReceipt.paymentSlipUrl}
                    alt="Payment Slip"
                    className="w-full h-full object-contain max-h-56"
                  />
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified by Kumari Institute Accounts Desk</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReceipt(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Slip</span>
                </button>
              </div>
            </div>
          </div>
          </div>
        </div>
      )}

      {/* SIGN OUT MODAL */}
      {showLogoutConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-confirm-modal-title"
          className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && setShowLogoutConfirm(false)}
        >
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-slate-200 space-y-4 relative my-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <LogOut className="w-4 h-4" />
                </div>
                <h3 id="logout-confirm-modal-title" className="text-base font-bold text-slate-900">
                  Confirm Sign Out
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 text-left">
              Are you sure you want to sign out of your Kumari Institute account?
            </p>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="py-2 px-3 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
                className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs cursor-pointer transition-colors shadow-xs"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAY TUTOR FEE MODAL (RAZORPAY CHECKOUT) */}
      {payFeeModalBooking && activeUserData && (
        <PayTutorFeeModal
          isOpen={Boolean(payFeeModalBooking)}
          booking={payFeeModalBooking}
          currentUser={activeUserData}
          onClose={() => setPayFeeModalBooking(null)}
          onPaymentSuccess={(record, receipt) => {
            const paidKey = String(
              payFeeModalBooking.id ||
                payFeeModalBooking.assignedTutorId ||
                payFeeModalBooking.requestedTutorId ||
                payFeeModalBooking.tutorId ||
                ''
            );
            setPayFeeModalBooking(null);
            if (paidKey) {
              setContinuedBookings((prev) => {
                const next = { ...prev };
                delete next[paidKey];
                return next;
              });
            }
            // Optimistically update local fee records so button converts to "Paid (30 Days Left)"
            setParentFeeRecords((prev) => [
              record,
              ...prev.filter((r) => r.receiptNo !== record.receiptNo)
            ]);
            // Open dedicated Payment Success Pop-Up
            setPaymentSuccessPopup({ record, receipt });
          }}
        />
      )}

      {/* CONFIRM DISCONTINUE TUTOR MODAL */}
      {discontinueConfirmBooking && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[75] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={(e) => !isDiscontinuingBooking && e.target === e.currentTarget && setDiscontinueConfirmBooking(null)}
        >
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-4 text-left">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Discontinue Home Tutor?</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  Are you sure you want to discontinue{' '}
                  <strong>
                    {discontinueConfirmBooking.assignedTutorName ||
                      discontinueConfirmBooking.requestedTutorName ||
                      discontinueConfirmBooking.tutorName ||
                      discontinueConfirmBooking.name ||
                      'this tutor'}
                  </strong>
                  ?
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200/80 text-[11px] text-rose-900 space-y-1">
              <p className="font-bold">This action will immediately:</p>
              <ul className="list-disc pl-4 space-y-0.5">
                <li>Remove this tutor from your <strong>Booked Home Tutors</strong> list.</li>
                <li>Remove your student from the tutor&apos;s <strong>Assigned Students</strong> dashboard.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                disabled={isDiscontinuingBooking}
                onClick={() => setDiscontinueConfirmBooking(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer disabled:opacity-50"
              >
                Keep Tutor
              </button>
              <button
                type="button"
                disabled={isDiscontinuingBooking}
                onClick={handleConfirmDiscontinue}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-60"
              >
                {isDiscontinuingBooking ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Discontinuing...</span>
                  </>
                ) : (
                  <span>Yes, Discontinue</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PAYMENT SUCCESS POP-UP MODAL */}
      {paymentSuccessPopup && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setPaymentSuccessPopup(null)}
        >
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-emerald-200 overflow-hidden relative my-6 text-left">
            <div className="bg-gradient-to-br from-emerald-600 via-emerald-700 to-[#0c2340] p-6 text-white text-center relative">
              <button
                type="button"
                onClick={() => setPaymentSuccessPopup(null)}
                aria-label="Close"
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-16 h-16 rounded-full bg-white text-emerald-600 mx-auto flex items-center justify-center shadow-lg mb-3">
                <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
              </div>

              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white/15 text-emerald-100 text-[10px] font-bold uppercase tracking-wider mb-1.5">
                <ShieldCheck className="w-3 h-3" />
                <span>Razorpay Payment Verified</span>
              </span>

              <h3 className="text-2xl font-black tracking-tight text-white">
                Payment Successful!
              </h3>
              <p className="text-3xl font-black text-emerald-200 mt-1 tabular-nums">
                {paymentSuccessPopup.record.formattedAmount}
              </p>
              <p className="text-xs text-emerald-100/90 mt-1">
                Active for 30 days • Next renewal on {paymentSuccessPopup.record.nextDueDate}
              </p>
            </div>

            <div className="p-5 sm:p-6 space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500">Home Tutor:</span>
                  <span className="font-bold text-slate-900 text-right">
                    {paymentSuccessPopup.record.tutorName}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500">Student:</span>
                  <span className="font-semibold text-slate-800 text-right">
                    {paymentSuccessPopup.record.studentName}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500">Receipt No:</span>
                  <span className="font-mono font-bold text-slate-900">
                    {paymentSuccessPopup.record.receiptNo}
                  </span>
                </div>
                {paymentSuccessPopup.record.razorpayPaymentId && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-500">Razorpay Payment ID:</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {paymentSuccessPopup.record.razorpayPaymentId}
                    </span>
                  </div>
                )}
                {paymentSuccessPopup.record.razorpayOrderId && (
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-500">Razorpay Order ID:</span>
                    <span className="font-mono text-slate-700">
                      {paymentSuccessPopup.record.razorpayOrderId}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-500">Payment Mode:</span>
                  <span className="font-semibold text-blue-700">
                    {paymentSuccessPopup.record.paymentMethodDetail || paymentSuccessPopup.record.paymentMethod}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-2 pt-1.5 border-t border-slate-200/80">
                  <span className="text-slate-500">Validity Period:</span>
                  <span className="font-bold text-emerald-700">
                    30 Days (Until {paymentSuccessPopup.record.nextDueDate})
                  </span>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Your tutor card status is now marked <strong>Paid</strong> and payment verification details have been sent to Kumari Institute Admin.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const { record, receipt } = paymentSuccessPopup;
                    setPaymentSuccessPopup(null);
                    setSelectedReceipt({
                      id: receipt.receiptNo || record.receiptNo,
                      date: receipt.date,
                      description: receipt.description,
                      amount: receipt.amount,
                      status: 'Paid',
                      utrNumber: record.razorpayPaymentId || receipt.utrNumber,
                      razorpayOrderId: record.razorpayOrderId,
                      razorpayPaymentId: record.razorpayPaymentId,
                      signatureVerified: record.signatureVerified,
                      paymentGateway: record.paymentGateway || 'Razorpay',
                      transferMethod: record.paymentMethodDetail || receipt.transferMethod,
                      nextDueDate: record.nextDueDate,
                      studentName: record.studentName,
                      tutorName: record.tutorName,
                      adminNote: `Official Razorpay fee receipt for ${record.studentName} (${record.tutorSubjects}). Valid for 30 days until ${record.nextDueDate}.`
                    });
                  }}
                  className="py-2.5 px-3 rounded-xl border border-slate-200 text-slate-800 font-bold text-xs hover:bg-slate-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Receipt className="w-3.5 h-3.5 text-blue-600" />
                  <span>View Receipt</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentSuccessPopup(null)}
                  className="py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
