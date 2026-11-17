import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  GraduationCap,
  FileText,
  Search,
  Users,
  Eye,
  Check,
  X,
  Bell,
  Calendar,
  Phone,
  Mail,
  MapPin,
  ExternalLink,
  Plus,
  Trash2,
  ArrowRight,
  Sparkles,
  BookOpen,
  Image as ImageIcon,
  Award,
  RefreshCw,
  AlertCircle,
  ZoomIn,
  MessageSquare,
  Ban,
  Upload,
  ToggleLeft,
  ToggleRight,
  ClipboardList,
  History,
  IndianRupee,
  CreditCard,
  ArrowDownRight,
  Filter,
  Download,
  Printer,
  CheckSquare,
  Layers,
  FileCheck,
  Landmark,
  Home,
  Copy,
  Receipt,
  Star,
  UserPlus,
  SlidersHorizontal,
  Menu,
  LogOut,
  ChevronRight,
  Wallet,
  Loader2,
  Pencil,
  Flame
} from 'lucide-react';
import { Tutor, TutorReview } from '../data/tutorsData';
import {
  HomeTutorBooking,
  OfflineDemoQuery,
  AdminGalleryItem,
  AdminSuccessStory
} from '../types';
import {
  subscribeToAllTeachersForAdmin,
  adminVerifyTutorInDatabase,
  adminToggleTutorVisibility,
  adminDeleteTutorFromDatabase,
  subscribeToRealtimeBookings,
  subscribeToTutorsRequests,
  subscribeToCompleteTutors,
  subscribeToTutorsReviews,
  subscribeToOfflineDemoQueries,
  adminDeleteOfflineDemoQuery,
  subscribeToGalleryManager,
  saveGalleryItemToFirestore,
  deleteGalleryItemFromFirestore,
  adminAcceptAndAssignTutorBooking,
  adminDeclineTutorBooking,
  saveSuccessStoryToFirestore,
  deleteSuccessStoryFromFirestore,
  subscribeToRealtimeSuccessStories,
  logAdminActivity,
  adminAddTutorReview,
  adminDeleteTutorReview,
  subscribeToAllParentsForAdmin,
  fetchAllParentsForAdmin,
  adminDirectAssignTutorToParent,
  isFakeParent,
  subscribeToRealtimeHeroBanners,
  saveHeroBannerToFirestore,
  updateHeroBannerInFirestore,
  deleteHeroBannerFromFirestore,
  FirestoreHeroBanner,
  AppUserProfile
} from '../services/firebaseAuth';
import {
  TutorWithdrawalRequest,
  deduplicateWithdrawals,
  calculateTutorVerifiedLedger,
  subscribeToAllWithdrawalRequests,
  subscribeToWithdrawalNotices,
  subscribeToCompleteWithdrawals,
  adminApproveWithdrawal,
  adminRejectWithdrawal
} from '../services/payoutService';
import { compressImageToBase64 } from '../utils/imageUtils';
import { IncomingBookings } from './IncomingBookings';
import { uploadImageToImgBB } from '../services/imgbbService';
import { AdminReceivedFeeTab } from './AdminReceivedFeeTab';
import { AdminOffersTab } from './AdminOffersTab';
import { useBackButtonDismiss } from '../hooks/useBackButtonDismiss';
import {
  ReceivedFeeRecord,
  subscribeToReceivedFees
} from '../services/feePaymentService';

interface AdminPanelProps {
  currentUser?: AppUserProfile | null;
  onNavigateHome: () => void;
  onNavigateTutors?: () => void;
  onLogout: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  currentUser,
  onNavigateHome,
  onNavigateTutors,
  onLogout
}) => {
  // Navigation tabs - Covers all Firestore collections + Received Fees & Offers
  const [activeTab, setActiveTab] = useState<
    | 'incoming_bookings'
    | 'parents'
    | 'tutors_requests'
    | 'tutors_directory'
    | 'complete_tutors'
    | 'received_fees'
    | 'withdrawal_notices'
    | 'complete_withdrawals'
    | 'tutors_reviews'
    | 'offline_demo_queries'
    | 'gallery_manager'
    | 'success_stories'
    | 'hero_banners'
    | 'offers_manager'
    | 'activity_logs'
    | 'tutors'
    | 'assigned_tutors'
    | 'bookings'
    | 'offline_queries'
    | 'gallery'
    | 'tutor_reviews'
    | 'registered_directory'
    | 'tutor_withdrawals'
  >('incoming_bookings');

  // Received Fees state
  const [receivedFeesList, setReceivedFeesList] = useState<ReceivedFeeRecord[]>([]);
  const [isLoadingReceivedFees, setIsLoadingReceivedFees] = useState<boolean>(true);

  // 11 Dedicated Collections State
  const [tutorRequests, setTutorRequests] = useState<any[]>([]);
  const [completeTutors, setCompleteTutors] = useState<any[]>([]);
  const [withdrawalNotices, setWithdrawalNotices] = useState<TutorWithdrawalRequest[]>([]);
  const [completeWithdrawals, setCompleteWithdrawals] = useState<TutorWithdrawalRequest[]>([]);
  const [tutorsReviews, setTutorsReviews] = useState<any[]>([]);

  // Hero Banners (ImgBB & Cloud Firestore Integrated) State
  const [heroBanners, setHeroBanners] = useState<FirestoreHeroBanner[]>([]);
  const [isLoadingHeroBanners, setIsLoadingHeroBanners] = useState<boolean>(false);
  const [isAddingHeroBanner, setIsAddingHeroBanner] = useState<boolean>(false);
  const [newHeroBannerUrl, setNewHeroBannerUrl] = useState<string>('');
  const [isUploadingHeroBanners, setIsUploadingHeroBanners] = useState<boolean>(false);
  const [heroBannerUploadProgress, setHeroBannerUploadProgress] = useState<{
    current: number;
    total: number;
    fileName: string;
  } | null>(null);
  const [heroBannerNotice, setHeroBannerNotice] = useState<string | null>(null);
  const [activePreviewBannerIdx, setActivePreviewBannerIdx] = useState<number>(0);

  // Tutor Withdrawals & Payout Settlements State
  const [withdrawalRequests, setWithdrawalRequests] = useState<TutorWithdrawalRequest[]>([]);
  const [withdrawalFilter, setWithdrawalFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [withdrawalSearch, setWithdrawalSearch] = useState<string>('');
  const [selectedWithdrawalForTransfer, setSelectedWithdrawalForTransfer] = useState<TutorWithdrawalRequest | null>(null);
  const [viewingWithdrawalReceipt, setViewingWithdrawalReceipt] = useState<TutorWithdrawalRequest | null>(null);
  const [transferUtr, setTransferUtr] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferMethod, setTransferMethod] = useState('UPI Transfer');
  const [transferSlipUrl, setTransferSlipUrl] = useState('');
  const [transferAdminNote, setTransferAdminNote] = useState('');
  const [isProcessingTransfer, setIsProcessingTransfer] = useState(false);
  const [isUploadingSlip, setIsUploadingSlip] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Unified deduplicated withdrawal list across withdrawal_notices, complete_withdrawals, and withdrawal_requests
  const mergedWithdrawalsList = React.useMemo(
    () =>
      deduplicateWithdrawals([
        ...completeWithdrawals,
        ...withdrawalNotices,
        ...withdrawalRequests
      ]),
    [completeWithdrawals, withdrawalNotices, withdrawalRequests]
  );

  // Helper to resolve a tutor's assigned students and fee rates for exact 30-day cycle + fee ledger verification
  const getAssignedStudentsAndRatesForWithdrawal = (req: TutorWithdrawalRequest) => {
    const reqId = String(req.tutorId || '').trim();
    const reqEmail = String(req.tutorEmail || '').trim().toLowerCase();
    const reqPhoneDigits = String(req.tutorPhone || '').replace(/\D/g, '').slice(-10);
    const reqName = String(req.tutorName || '').trim().toLowerCase();

    const matchedTutor = [...tutors, ...completeTutors].find((t: any) => {
      const tIds = [t.id, t.uid].map((v: any) => String(v || '').trim()).filter(Boolean);
      if (reqId && tIds.includes(reqId)) return true;
      if (reqEmail && t.email && String(t.email).trim().toLowerCase() === reqEmail) return true;
      const tPhoneDigits = String(t.phone || '').replace(/\D/g, '').slice(-10);
      if (reqPhoneDigits && tPhoneDigits && reqPhoneDigits === tPhoneDigits) return true;
      if (reqName && t.name && String(t.name).trim().toLowerCase() === reqName) return true;
      return false;
    });

    const candidateTutorIds = new Set<string>(
      [reqId, matchedTutor?.id, matchedTutor?.uid].map((v) => String(v || '').trim()).filter(Boolean)
    );

    const studentsFromTutor: any[] = Array.isArray(matchedTutor?.assignedStudents)
      ? matchedTutor.assignedStudents
      : [];

    const studentsFromBookings = bookings
      .filter((b) => {
        const isActive = b.status === 'accepted' || b.status === 'assigned' || b.status === 'reassigned';
        if (!isActive) return false;
        if (b.assignedTutorId && candidateTutorIds.has(String(b.assignedTutorId).trim())) return true;
        if (b.requestedTutorId && candidateTutorIds.has(String(b.requestedTutorId).trim())) return true;
        if (reqName && b.assignedTutorName && b.assignedTutorName.trim().toLowerCase() === reqName) return true;
        return false;
      })
      .map((b) => ({
        id: b.id,
        bookingId: b.id,
        studentName: b.studentName,
        name: b.studentName,
        monthlyFee: b.assignedTutorFee || b.requestedTutorMonthlyFee || matchedTutor?.monthlyFee || 3000,
        assignedAt: b.assignedAt || b.createdAt
      }));

    const dedupMap = new Map<string, any>();
    for (const raw of [...studentsFromTutor, ...studentsFromBookings]) {
      if (!raw) continue;
      const cleanBookingId = String(raw.bookingId || raw.id || '').replace(/^std-/, '').trim();
      const normName = String(raw.studentName || raw.name || '').trim().toLowerCase();
      const key = cleanBookingId || normName || String(Math.random());
      if (!dedupMap.has(key)) {
        dedupMap.set(key, raw);
      } else {
        const prev = dedupMap.get(key);
        dedupMap.set(key, {
          ...prev,
          ...raw,
          assignedAt: raw.assignedAt || prev.assignedAt || raw.createdAt || prev.createdAt
        });
      }
    }

    return {
      assignedStudents: Array.from(dedupMap.values()),
      tutorRates: {
        hourlyCharges: matchedTutor?.hourlyCharges,
        hourlyRate: matchedTutor?.hourlyRate,
        hourlyFee: matchedTutor?.hourlyFee,
        monthlyFee: matchedTutor?.monthlyFee
      }
    };
  };

  // Registered Directory State (Parents & Tutors)
  const [registeredParents, setRegisteredParents] = useState<AppUserProfile[]>([]);
  const [isLoadingParents, setIsLoadingParents] = useState<boolean>(true);
  const [directoryRoleFilter, setDirectoryRoleFilter] = useState<'parents' | 'tutors'>('parents');
  const [parentAssignmentFilter, setParentAssignmentFilter] = useState<'all' | 'unassigned' | 'assigned' | 'pending'>('all');
  const [directorySearch, setDirectorySearch] = useState<string>('');

  // Direct Assign Modal for unassigned parent
  const [directAssignParent, setDirectAssignParent] = useState<AppUserProfile | null>(null);
  const [directAssignTutorId, setDirectAssignTutorId] = useState<string>('');
  const [directAssignSlot, setDirectAssignSlot] = useState<string>('5:00 PM - 6:00 PM');
  const [directAssignNotes, setDirectAssignNotes] = useState<string>('');
  const [isDirectAssigning, setIsDirectAssigning] = useState<boolean>(false);

  // 1. Tutors state
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [isLoadingTutors, setIsLoadingTutors] = useState(true);
  const [tutorFilter, setTutorFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [tutorSearch, setTutorSearch] = useState('');
  const [selectedTutorForReview, setSelectedTutorForReview] = useState<Tutor | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyingTutorId, setVerifyingTutorId] = useState<string | null>(null);
  const [tutorViewMode, setTutorViewMode] = useState<'grid' | 'table'>('grid');
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);

  // Certificate Lightbox Preview Modal state
  const [previewCertDoc, setPreviewCertDoc] = useState<{ title: string; url: string; details?: string } | null>(null);

  // 2. Bookings & Assignment state
  const [bookings, setBookings] = useState<HomeTutorBooking[]>([]);
  const [bookingFilter, setBookingFilter] = useState<'pending' | 'accepted' | 'declined' | 'all'>('pending');
  const [isAssigning, setIsAssigning] = useState(false);
  const [reassignModalBooking, setReassignModalBooking] = useState<HomeTutorBooking | null>(null);
  const [selectedReassignTutorId, setSelectedReassignTutorId] = useState<string>('');
  const [reassignNotes, setReassignNotes] = useState('');

  // Decline Booking Modal state
  const [declineModalBooking, setDeclineModalBooking] = useState<HomeTutorBooking | null>(null);
  const [declineReason, setDeclineReason] = useState<string>('Selected time slot is already fully occupied.');
  const [customDeclineReason, setCustomDeclineReason] = useState<string>('');
  const [isDeclining, setIsDeclining] = useState<boolean>(false);

  // Assigned Tutors search query
  const [assignedSearch, setAssignedSearch] = useState<string>('');

  // 3. Offline Demo Queries state
  const [demoQueries, setDemoQueries] = useState<OfflineDemoQuery[]>([]);

  // 4. Gallery state
  const [galleryItems, setGalleryItems] = useState<AdminGalleryItem[]>([]);
  const [isAddingGallery, setIsAddingGallery] = useState(false);
  const [newGalleryTitle, setNewGalleryTitle] = useState('');
  const [newGalleryCategory, setNewGalleryCategory] = useState<'students' | 'classrooms' | 'building' | 'events'>('students');
  const [newGalleryImage, setNewGalleryImage] = useState('');
  const [newGallerySubtitle, setNewGallerySubtitle] = useState('');
  // Gallery ImgBB Upload states
  const [galleryImageFile, setGalleryImageFile] = useState<File | null>(null);
  const [galleryImagePreview, setGalleryImagePreview] = useState<string>('');
  const [isUploadingGalleryToImgbb, setIsUploadingGalleryToImgbb] = useState<boolean>(false);
  const [isBatchUploadingGallery, setIsBatchUploadingGallery] = useState<boolean>(false);
  const [galleryUploadStatus, setGalleryUploadStatus] = useState<string>('');

  // Tutors Directory State (Approved Tutors with Connected Parents)
  const [tutorsDirectoryFilter, setTutorsDirectoryFilter] = useState<'all' | 'assigned' | 'available'>('all');
  const [tutorsDirectorySearch, setTutorsDirectorySearch] = useState<string>('');
  const [connectParentTargetTutor, setConnectParentTargetTutor] = useState<Tutor | null>(null);
  const [connectParentSelectedUid, setConnectParentSelectedUid] = useState<string>('');
  const [connectParentTimeSlot, setConnectParentTimeSlot] = useState<string>('5:00 PM - 6:00 PM');
  const [connectParentNotes, setConnectParentNotes] = useState<string>('');
  const [isConnectingParent, setIsConnectingParent] = useState<boolean>(false);

  // 5. Success Stories state
  const [successStories, setSuccessStories] = useState<AdminSuccessStory[]>([]);
  const [isAddingStory, setIsAddingStory] = useState(false);
  const [newStoryName, setNewStoryName] = useState('');
  const [newStoryScore, setNewStoryScore] = useState('');
  const [newStoryExam, setNewStoryExam] = useState('');
  const [newStorySchool, setNewStorySchool] = useState('');
  const [newStoryParent, setNewStoryParent] = useState('');
  const [newStoryTestimonial, setNewStoryTestimonial] = useState('');
  const [newStoryImage, setNewStoryImage] = useState('');
  const [newStoryBadge, setNewStoryBadge] = useState('Top Performer');
  const [newStoryYear, setNewStoryYear] = useState('2024');
  const [storyImageFile, setStoryImageFile] = useState<File | null>(null);
  const [storyImagePreview, setStoryImagePreview] = useState<string>('');
  const [isUploadingStoryImage, setIsUploadingStoryImage] = useState(false);

  // Notification Toast state
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'primary';
    onConfirm: () => Promise<void> | void;
  } | null>(null);
  const [isConfirmBusy, setIsConfirmBusy] = useState(false);

  // Real-time Notification Alert Popover State
  const isNotificationOpenRef = useRef(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const galleryFileInputRef = useRef<HTMLInputElement>(null);
  const galleryBatchInputRef = useRef<HTMLInputElement>(null);

  // Seen Notification IDs state persisted in localStorage so acknowledged alerts don't re-trigger
  const [seenNotificationIds, setSeenNotificationIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('admin_seen_notification_ids');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return new Set<string>(parsed);
      }
    } catch (e) {
      console.warn('Error reading seen notifications', e);
    }
    return new Set<string>();
  });

  const markAllCurrentNotificationsAsSeen = () => {
    const currentPendingIds = [
      ...tutors.filter((t) => t.status === 'pending' || !t.isApproved).map((t) => t.id),
      ...bookings.filter((b) => b.status === 'pending').map((b) => b.id)
    ];
    setSeenNotificationIds((prev) => {
      const updated = new Set<string>([...prev, ...currentPendingIds]);
      try {
        localStorage.setItem('admin_seen_notification_ids', JSON.stringify(Array.from(updated)));
      } catch (e) {
        console.warn('Could not save seen notifications', e);
      }
      return updated;
    });
  };

  const markSingleNotificationAsSeen = (id: string) => {
    setSeenNotificationIds((prev) => {
      const updated = new Set<string>(prev);
      updated.add(id);
      try {
        localStorage.setItem('admin_seen_notification_ids', JSON.stringify(Array.from(updated)));
      } catch (e) {
        console.warn('Could not save seen notifications', e);
      }
      return updated;
    });
  };

  // Review Creation Form State
  const [selectedReviewTutorId, setSelectedReviewTutorId] = useState<string>('');
  const [reviewParentName, setReviewParentName] = useState<string>('');
  const [reviewRelation, setReviewRelation] = useState<string>('');
  const [reviewStudentGrade, setReviewStudentGrade] = useState<string>('Class 4 (CBSE)');
  const [reviewSchoolName, setReviewSchoolName] = useState<string>('Rayagada');
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewVerifiedBooking, setReviewVerifiedBooking] = useState<boolean>(true);
  const [isPublishingReview, setIsPublishingReview] = useState<boolean>(false);
  const [reviewFilterTutorId, setReviewFilterTutorId] = useState<string>('all');
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  // Close notification popover on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setIsNotificationOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const showToast = (type: 'success' | 'info' | 'error', message: string) => {
    setToastMessage({ type, message });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Real-time Subscriptions for all Firestore collections
  useEffect(() => {
    setIsLoadingTutors(true);
    const unsubTutors = subscribeToAllTeachersForAdmin((allTutors) => {
      const cleanTutors = (allTutors || []).filter(
        (t) =>
          !t.name.toLowerCase().includes('divya') &&
          !t.id.toLowerCase().includes('t7rcs2ymnyymgjwneqhqeazwale2')
      );
      setTutors(cleanTutors);
      setSelectedTutorForReview((prev) => {
        if (!prev) return prev;
        const latest = cleanTutors.find((item) => item.id === prev.id);
        return latest || prev;
      });
      setIsLoadingTutors(false);
    });

    // 1. Unified Home Tutor Bookings collection (live real-time listener)
    const unsubBookings = subscribeToRealtimeBookings((allBookings) => {
      setBookings(allBookings);
    });

    // 3. Tutors Requests collection (registered tutors pending completion)
    const unsubTutorRequests = subscribeToTutorsRequests((reqs) => {
      setTutorRequests(reqs);
    });

    // 4. Complete Tutors collection (profile completed with timings, fees & assigned parents)
    const unsubCompleteTutors = subscribeToCompleteTutors((cTutors) => {
      setCompleteTutors(cTutors);
    });

    // 5. Withdrawal Notices collection (pending tutor requests)
    const unsubWithdrawalNotices = subscribeToWithdrawalNotices((notices) => {
      setWithdrawalNotices(notices);
    });

    // 6. Complete Withdrawals collection (accepted & settled payouts)
    const unsubCompleteWithdrawals = subscribeToCompleteWithdrawals((cw) => {
      setCompleteWithdrawals(cw);
    });

    // 7. Tutors Reviews collection
    const unsubTutorsReviews = subscribeToTutorsReviews((revs) => {
      setTutorsReviews(revs);
    });

    // 8. Offline Demo Queries collection
    const unsubOfflineQueries = subscribeToOfflineDemoQueries((queries) => {
      setDemoQueries(queries || []);
    });

    // 9. Gallery collection (real-time from Firestore)
    const unsubGalleryManager = subscribeToGalleryManager((items) => {
      setGalleryItems((items || []) as any);
    });

    // 10. Success Stories collection
    const unsubSuccessStories = subscribeToRealtimeSuccessStories((stories) => {
      setSuccessStories(stories);
    });

    // 2. Registered Parents directory in Firestore (exclusively registered parents)
    setIsLoadingParents(true);
    const unsubParents = subscribeToAllParentsForAdmin((allParents) => {
      const genuineParents = allParents.filter((p) => p.role === 'parent' && !isFakeParent(p));
      setRegisteredParents(genuineParents);
      setIsLoadingParents(false);
    });

    // Tutor Withdrawal Requests (legacy + unified)
    const unsubWithdrawals = subscribeToAllWithdrawalRequests((reqs) => {
      setWithdrawalRequests(reqs);
    });

    // 11. Hero Banners collection (live real-time Firestore listener)
    const unsubHeroBanners = subscribeToRealtimeHeroBanners((banners) => {
      setHeroBanners(banners || []);
    });

    // Received Fees collection listener
    setIsLoadingReceivedFees(true);
    const unsubReceivedFees = subscribeToReceivedFees((fees) => {
      setReceivedFeesList(fees);
      setIsLoadingReceivedFees(false);
    });

    return () => {
      unsubTutors();
      unsubBookings();
      unsubTutorRequests();
      unsubCompleteTutors();
      unsubWithdrawalNotices();
      unsubCompleteWithdrawals();
      unsubTutorsReviews();
      unsubOfflineQueries();
      unsubGalleryManager();
      unsubSuccessStories();
      unsubParents();
      unsubWithdrawals();
      unsubHeroBanners();
      unsubReceivedFees();
    };
  }, []);

  useBackButtonDismiss(Boolean(confirmDialog) && !isConfirmBusy, 'admin-confirm-dialog', () =>
    setConfirmDialog(null)
  );
  useBackButtonDismiss(Boolean(previewCertDoc), 'admin-cert-preview', () => setPreviewCertDoc(null));
  useBackButtonDismiss(Boolean(selectedTutorForReview), 'admin-tutor-review', () =>
    setSelectedTutorForReview(null)
  );
  useBackButtonDismiss(Boolean(reassignModalBooking) && !isAssigning, 'admin-reassign-modal', () =>
    setReassignModalBooking(null)
  );
  useBackButtonDismiss(Boolean(declineModalBooking) && !isDeclining, 'admin-decline-modal', () =>
    setDeclineModalBooking(null)
  );
  useBackButtonDismiss(Boolean(directAssignParent) && !isDirectAssigning, 'admin-direct-assign', () =>
    setDirectAssignParent(null)
  );
  useBackButtonDismiss(Boolean(connectParentTargetTutor) && !isConnectingParent, 'admin-connect-parent', () =>
    setConnectParentTargetTutor(null)
  );
  useBackButtonDismiss(
    Boolean(selectedWithdrawalForTransfer) && !isProcessingTransfer,
    'admin-transfer-modal',
    () => setSelectedWithdrawalForTransfer(null)
  );
  useBackButtonDismiss(Boolean(viewingWithdrawalReceipt), 'admin-withdrawal-receipt', () =>
    setViewingWithdrawalReceipt(null)
  );
  useBackButtonDismiss(isAddingGallery && !isBatchUploadingGallery, 'admin-add-gallery', () =>
    setIsAddingGallery(false)
  );
  useBackButtonDismiss(isAddingStory && !isUploadingStoryImage, 'admin-add-story', () =>
    setIsAddingStory(false)
  );

  const fetchAdminHeroBanners = async () => {
    setIsLoadingHeroBanners(true);
    try {
      const res = await fetch('/api/admin/hero-banners');
      const data = await res.json();
      if (data.success && Array.isArray(data.banners)) {
        setHeroBanners(data.banners);
      }
    } catch (err) {
      console.warn('[Admin Hero Banners] Fetch notice:', err);
    } finally {
      setIsLoadingHeroBanners(false);
    }
  };

  const handleMultiBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingHeroBanners(true);
    setHeroBannerNotice(null);

    const uploadedBanners: { url: string; title: string; active: boolean }[] = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setHeroBannerUploadProgress({
        current: i + 1,
        total: files.length,
        fileName: file.name
      });

      try {
        const result = await uploadImageToImgBB(file);
        if (result.success && result.url) {
          uploadedBanners.push({
            url: result.url,
            title: file.name.replace(/\.[^/.]+$/, ''),
            active: true
          });
          successCount++;
        } else {
          failCount++;
        }
      } catch (err) {
        console.warn('ImgBB upload error:', err);
        failCount++;
      }
    }

    if (uploadedBanners.length > 0) {
      // 1. Store in Cloud Firestore database
      for (const b of uploadedBanners) {
        try {
          await saveHeroBannerToFirestore(b);
        } catch (fErr) {
          console.warn('Firestore banner save notice:', fErr);
        }
      }

      // 2. Also sync with server API
      try {
        const res = await fetch('/api/admin/hero-banners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ banners: uploadedBanners })
        });
        const data = await res.json();
        if (data.success && Array.isArray(data.banners)) {
          setHeroBanners(data.banners);
        }
      } catch (err) {
        console.warn('Failed to save banners on server:', err);
      }

      setHeroBannerNotice(`Successfully uploaded ${successCount} image(s) to ImgBB and saved to Cloud Firestore!`);
    } else if (failCount > 0) {
      setHeroBannerNotice(`Failed to upload ${failCount} image(s). Please verify file formats and try again.`);
    }

    setIsUploadingHeroBanners(false);
    setHeroBannerUploadProgress(null);
    if (e.target) e.target.value = '';
  };

  const handleAddHeroBannerDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHeroBannerUrl.trim()) return;

    const bannerData = {
      url: newHeroBannerUrl.trim(),
      active: true
    };

    // 1. Store in Cloud Firestore database
    try {
      await saveHeroBannerToFirestore(bannerData);
    } catch (fErr) {
      console.warn('Firestore direct banner save notice:', fErr);
    }

    // 2. Sync with server API
    try {
      const res = await fetch('/api/admin/hero-banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bannerData)
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.banners)) {
        setHeroBanners(data.banners);
      }
    } catch (err) {
      console.warn('Error adding banner on server:', err);
    }

    setNewHeroBannerUrl('');
    setIsAddingHeroBanner(false);
    setHeroBannerNotice('Hero banner image successfully saved to Cloud Firestore database!');
  };

  const handleToggleHeroBanner = async (id: string, currentActive: boolean) => {
    // 1. Update in Cloud Firestore database
    try {
      await updateHeroBannerInFirestore(id, { active: !currentActive });
    } catch (fErr) {
      console.warn('Firestore toggle notice:', fErr);
    }

    // 2. Sync with server API
    try {
      const res = await fetch(`/api/admin/hero-banners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentActive })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.banners)) {
        setHeroBanners(data.banners);
      }
    } catch (err) {
      console.warn('Error toggling banner:', err);
    }
  };

  const handleDeleteHeroBanner = async (id: string) => {
    // 1. Delete from Cloud Firestore database
    try {
      await deleteHeroBannerFromFirestore(id);
    } catch (fErr) {
      console.warn('Firestore delete notice:', fErr);
    }

    // 2. Sync with server API
    try {
      const res = await fetch(`/api/admin/hero-banners/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.banners)) {
        setHeroBanners(data.banners);
      }
      setHeroBannerNotice('Banner image removed from hero carousel and Cloud Firestore.');
    } catch (err) {
      console.warn('Error deleting banner:', err);
    }
  };

  const handleAddPresetBanner = async (presetUrl: string) => {
    try {
      await saveHeroBannerToFirestore({
        url: presetUrl,
        active: true
      });
      const res = await fetch('/api/admin/hero-banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: presetUrl,
          active: true
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.banners)) {
        setHeroBanners(data.banners);
        setHeroBannerNotice('Added preset banner to Hero Banners and saved to Cloud Firestore!');
      }
    } catch (err) {
      console.warn('Failed to add preset:', err);
    }
  };

  // Filtered tutors
  const filteredTutors = tutors.filter((t) => {
    const isRejected = t.status === 'rejected';
    const isApproved = !isRejected && (t.isApproved === true || t.status === 'approved');
    const isPending = !isApproved && !isRejected;

    const matchesFilter =
      tutorFilter === 'all'
        ? true
        : tutorFilter === 'pending'
        ? isPending
        : tutorFilter === 'approved'
        ? isApproved
        : isRejected;

    const matchesSearch =
      !tutorSearch.trim() ||
      t.name.toLowerCase().includes(tutorSearch.toLowerCase()) ||
      (t.email && t.email.toLowerCase().includes(tutorSearch.toLowerCase())) ||
      t.subjects.some((s) => s.toLowerCase().includes(tutorSearch.toLowerCase())) ||
      (t.locationArea && t.locationArea.toLowerCase().includes(tutorSearch.toLowerCase())) ||
      (t.phone && t.phone.includes(tutorSearch));

    return matchesFilter && matchesSearch;
  });

  // Approved tutors available for assignment
  const approvedTutors = tutors.filter((t) => t.isApproved === true || t.status === 'approved');

  // Filtered bookings
  const pendingBookings = bookings.filter((b) => b.status === 'pending');
  const acceptedBookings = bookings.filter((b) => b.status === 'accepted' || b.status === 'reassigned');
  const declinedBookings = bookings.filter((b) => b.status === 'declined');

  const pendingBookingsCount = pendingBookings.length;
  const acceptedBookingsCount = acceptedBookings.length;
  const declinedBookingsCount = declinedBookings.length;

  const uniqueAssignedTutorsCount = new Set(
    acceptedBookings.map((b) => b.assignedTutorId || b.requestedTutorId).filter(Boolean)
  ).size;

  const totalMonthlyTuitionValue = acceptedBookings.reduce(
    (sum, b) => sum + (b.assignedTutorFee || b.requestedTutorMonthlyFee || 0),
    0
  );

  const filteredBookings = bookings.filter((b) => {
    if (bookingFilter === 'all') return true;
    if (bookingFilter === 'pending') return b.status === 'pending';
    if (bookingFilter === 'declined') return b.status === 'declined';
    return b.status === 'accepted' || b.status === 'reassigned';
  });

  // Filtered assigned bookings for dedicated Assigned Tutors section
  const filteredAssignedBookings = acceptedBookings.filter((b) => {
    if (!assignedSearch.trim()) return true;
    const q = assignedSearch.toLowerCase();
    return (
      (b.assignedTutorName && b.assignedTutorName.toLowerCase().includes(q)) ||
      (b.requestedTutorName && b.requestedTutorName.toLowerCase().includes(q)) ||
      (b.studentName && b.studentName.toLowerCase().includes(q)) ||
      (b.parentName && b.parentName.toLowerCase().includes(q)) ||
      (b.parentPhone && b.parentPhone.includes(q)) ||
      (b.address && b.address.toLowerCase().includes(q)) ||
      (b.locality && b.locality.toLowerCase().includes(q)) ||
      (b.studentGrade && b.studentGrade.toLowerCase().includes(q))
    );
  });

  // Count summaries & real-time notification alert tracking
  const pendingTutorsList = tutors.filter(
    (t) => t.status !== 'rejected' && !(t.isApproved === true || t.status === 'approved')
  );
  const awaitingProfileSubmissionCount = pendingTutorsList.filter((t) => !t.profileCompleted).length;
  const readyForVerificationCount = pendingTutorsList.filter((t) => Boolean(t.profileCompleted)).length;
  const pendingBookingsList = bookings.filter((b) => b.status === 'pending');
  const unseenPendingTutors = pendingTutorsList.filter((t) => !seenNotificationIds.has(t.id));
  const unseenPendingBookings = pendingBookingsList.filter((b) => !seenNotificationIds.has(b.id));
  const unseenAlertsCount = unseenPendingTutors.length + unseenPendingBookings.length;

  const pendingTutorsCount = pendingTutorsList.length;
  const approvedTutorsCount = tutors.filter((t) => t.status !== 'rejected' && (t.status === 'approved' || t.isApproved)).length;
  const rejectedTutorsCount = tutors.filter((t) => t.status === 'rejected').length;

  // Registered Parents Directory Analysis & Booking Status Detection
  const getParentBookingStatus = (parent: AppUserProfile): 'assigned' | 'pending' | 'unassigned' => {
    // Check bookings matching parentUid, email, or phone
    const matchedBookings = bookings.filter((b) => {
      const matchUid = Boolean(b.parentUid && parent.uid && b.parentUid === parent.uid);
      const matchEmail = Boolean(b.parentEmail && parent.email && b.parentEmail.toLowerCase() === parent.email.toLowerCase());
      const cleanBPhone = (b.parentPhone || '').replace(/\D/g, '');
      const cleanPPhone = (parent.phone || '').replace(/\D/g, '');
      const matchPhone = Boolean(cleanBPhone && cleanPPhone && cleanBPhone.slice(-10) === cleanPPhone.slice(-10));
      return matchUid || matchEmail || matchPhone;
    });

    const hasAcceptedBooking = matchedBookings.some((b) => b.status === 'accepted' || b.status === 'assigned');
    const hasPendingBooking = matchedBookings.some((b) => b.status === 'pending');
    const hasHired = (parent.hiredTutors && parent.hiredTutors.length > 0) || Boolean(parent.assignedEducator);

    if (hasAcceptedBooking || hasHired) return 'assigned';
    if (hasPendingBooking) return 'pending';
    return 'unassigned';
  };

  const getParentMatchedBooking = (parent: AppUserProfile): HomeTutorBooking | undefined => {
    return bookings.find((b) => {
      const matchUid = Boolean(b.parentUid && parent.uid && b.parentUid === parent.uid);
      const matchEmail = Boolean(b.parentEmail && parent.email && b.parentEmail.toLowerCase() === parent.email.toLowerCase());
      const cleanBPhone = (b.parentPhone || '').replace(/\D/g, '');
      const cleanPPhone = (parent.phone || '').replace(/\D/g, '');
      const matchPhone = Boolean(cleanBPhone && cleanPPhone && cleanBPhone.slice(-10) === cleanPPhone.slice(-10));
      return matchUid || matchEmail || matchPhone;
    });
  };

  const unassignedParentsCount = registeredParents.filter(
    (p) => getParentBookingStatus(p) === 'unassigned'
  ).length;

  const assignedParentsCount = registeredParents.filter(
    (p) => getParentBookingStatus(p) === 'assigned'
  ).length;

  const pendingParentsCount = registeredParents.filter(
    (p) => getParentBookingStatus(p) === 'pending'
  ).length;

  // Filtered Registered Parents list (Strictly registered parents)
  const filteredRegisteredParents = registeredParents.filter((p) => {
    if (p.role !== 'parent') return false;
    if (isFakeParent(p)) return false;

    const status = getParentBookingStatus(p);
    if (parentAssignmentFilter === 'unassigned' && status !== 'unassigned') return false;
    if (parentAssignmentFilter === 'assigned' && status !== 'assigned') return false;
    if (parentAssignmentFilter === 'pending' && status !== 'pending') return false;

    if (directorySearch.trim()) {
      const q = directorySearch.toLowerCase().trim();
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const emailMatch = (p.email || '').toLowerCase().includes(q);
      const phoneMatch = (p.phone || '').toLowerCase().includes(q) || (p.whatsappNumber || '').toLowerCase().includes(q);
      const childMatch = (p.childName || p.studentName || '').toLowerCase().includes(q);
      const gradeMatch = (p.childGrade || '').toLowerCase().includes(q);
      const schoolMatch = (p.childSchool || '').toLowerCase().includes(q);
      const boardMatch = (p.childBoard || p.board || '').toLowerCase().includes(q);
      const subjectsMatch = Array.isArray(p.subjectsNeeded) && p.subjectsNeeded.some((s) => s.toLowerCase().includes(q));
      const slotMatch = (p.preferredTimeSlot || '').toLowerCase().includes(q);
      const localityMatch = (p.locality || '').toLowerCase().includes(q) || (p.address || '').toLowerCase().includes(q);
      const courseMatch = (p.course || '').toLowerCase().includes(q);
      const tutorMatch = (p.assignedTutor || '').toLowerCase().includes(q);
      return (
        nameMatch ||
        emailMatch ||
        phoneMatch ||
        childMatch ||
        gradeMatch ||
        schoolMatch ||
        boardMatch ||
        subjectsMatch ||
        slotMatch ||
        localityMatch ||
        courseMatch ||
        tutorMatch
      );
    }
    return true;
  });

  // Filtered Tutors in Directory
  const filteredDirectoryTutors = tutors.filter((t) => {
    if (directorySearch.trim()) {
      const q = directorySearch.toLowerCase().trim();
      const nameMatch = (t.name || '').toLowerCase().includes(q);
      const emailMatch = (t.email || '').toLowerCase().includes(q);
      const phoneMatch = (t.phone || '').toLowerCase().includes(q);
      const qualMatch = (t.qualification || '').toLowerCase().includes(q);
      const subjMatch = t.subjects.some((s) => s.toLowerCase().includes(q));
      const areaMatch = (t.locationArea || '').toLowerCase().includes(q);
      return nameMatch || emailMatch || phoneMatch || qualMatch || subjMatch || areaMatch;
    }
    return true;
  });

  // Direct tutor assignment to unassigned registered parent
  const handleConfirmDirectAssign = async () => {
    if (!directAssignParent || !directAssignTutorId) {
      showToast('error', 'Please select a tutor to assign.');
      return;
    }

    const tutorObj = approvedTutors.find((t) => t.id === directAssignTutorId);
    if (!tutorObj) {
      showToast('error', 'Selected tutor not found.');
      return;
    }

    setIsDirectAssigning(true);
    try {
      const res = await adminDirectAssignTutorToParent(
        directAssignParent,
        tutorObj,
        directAssignSlot,
        directAssignNotes
      );

      if (res.success) {
        showToast('success', `✓ Successfully assigned ${tutorObj.name} to ${directAssignParent.name}!`);
        // Update local registered parents
        setRegisteredParents((prev) =>
          prev.map((p) =>
            p.uid === directAssignParent.uid
              ? {
                  ...p,
                  assignedEducator: {
                    id: tutorObj.id,
                    name: tutorObj.name,
                    phone: tutorObj.phone,
                    monthlyFee: tutorObj.monthlyFee,
                    subjects: tutorObj.subjects,
                    status: 'Active'
                  }
                }
              : p
          )
        );
        setDirectAssignParent(null);
        setDirectAssignTutorId('');
      } else {
        showToast('error', res.message);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to assign tutor.');
    } finally {
      setIsDirectAssigning(false);
    }
  };

  // Connect registered parent to tutor (initiated from Tutors Directory)
  const handleConfirmConnectParentToTutor = async () => {
    if (!connectParentTargetTutor || !connectParentSelectedUid) {
      showToast('error', 'Please select a parent family to connect.');
      return;
    }

    const parentObj = registeredParents.find((p) => p.uid === connectParentSelectedUid);
    if (!parentObj) {
      showToast('error', 'Selected parent not found.');
      return;
    }

    setIsConnectingParent(true);
    try {
      const res = await adminDirectAssignTutorToParent(
        parentObj,
        connectParentTargetTutor,
        connectParentTimeSlot,
        connectParentNotes || 'Connected from Approved Tutors Directory'
      );

      if (res.success) {
        showToast('success', `✓ Successfully connected ${connectParentTargetTutor.name} with ${parentObj.name}!`);
        // Update local registered parents
        setRegisteredParents((prev) =>
          prev.map((p) =>
            p.uid === parentObj.uid
              ? {
                  ...p,
                  assignedTutor: connectParentTargetTutor.name,
                  assignedTutorId: connectParentTargetTutor.id,
                  assignedTutorPhone: connectParentTargetTutor.phone,
                  assignedEducator: {
                    id: connectParentTargetTutor.id,
                    name: connectParentTargetTutor.name,
                    phone: connectParentTargetTutor.phone,
                    monthlyFee: connectParentTargetTutor.monthlyFee,
                    subjects: connectParentTargetTutor.subjects,
                    status: 'Active'
                  }
                }
              : p
          )
        );
        setConnectParentTargetTutor(null);
        setConnectParentSelectedUid('');
        setConnectParentNotes('');
      } else {
        showToast('error', res.message);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to connect parent to tutor.');
    } finally {
      setIsConnectingParent(false);
    }
  };



  // Handle Tutor Verification Status update (Approve / Reject) directly in Firestore
  const handleVerifyTutor = async (tutor: Tutor, status: 'approved' | 'rejected', notes?: string) => {
    if (status === 'approved' && !tutor.profileCompleted) {
      showToast(
        'error',
        `${tutor.name} has not yet uploaded their complete profile & certificates. Pending at profile submission.`
      );
      return;
    }
    setVerifyingTutorId(tutor.id);
    setIsVerifying(true);
    setVerifyNotice(null);
    try {
      const res = await adminVerifyTutorInDatabase(tutor.id, status, notes);

      if (status === 'rejected') {
        setTutors((prev) =>
          prev.map((item) =>
            item.id === tutor.id
              ? {
                  ...item,
                  status: 'rejected',
                  isApproved: false,
                  verified: false,
                  verificationStatus: 'Rejected'
                }
              : item
          )
        );
        if (selectedTutorForReview && selectedTutorForReview.id === tutor.id) {
          setSelectedTutorForReview({
            ...selectedTutorForReview,
            status: 'rejected',
            isApproved: false,
            verified: false,
            verificationStatus: 'Rejected'
          });
        }
        showToast('info', `✓ ${tutor.name}'s verification status updated to Rejected in Firestore.`);
        return;
      }

      showToast('success', `✓ ${tutor.name} approved & verified directly in Firestore!`);
      setVerifyNotice(res.message);

      // Update local state for approved
      setTutors((prev) =>
        prev.map((item) =>
          item.id === tutor.id
            ? {
                ...item,
                status: 'approved',
                isApproved: true,
                verified: true,
                verificationStatus: 'Verified Genuine Tutor'
              }
            : item
        )
      );

      // If review modal is open, update selected
      if (selectedTutorForReview && selectedTutorForReview.id === tutor.id) {
        setSelectedTutorForReview({
          ...selectedTutorForReview,
          status: 'approved',
          isApproved: true,
          verified: true,
          verificationStatus: 'Verified Genuine Tutor'
        });
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update tutor verification status in Firestore.');
    } finally {
      setIsVerifying(false);
      setVerifyingTutorId(null);
    }
  };

  // Permanently delete a tutor from Firestore
  const handleDeleteTutor = (tutor: Tutor) => {
    setConfirmDialog({
      title: 'Delete Tutor Profile?',
      message: `Are you sure you want to permanently remove "${tutor.name}" from Firestore? This action cannot be undone.`,
      confirmLabel: 'Delete Permanently',
      variant: 'danger',
      onConfirm: async () => {
        setVerifyingTutorId(tutor.id);
        try {
          const res = await adminDeleteTutorFromDatabase(tutor.id);
          if (res.success) {
            setTutors((prev) => prev.filter((item) => item.id !== tutor.id));
            if (selectedTutorForReview && selectedTutorForReview.id === tutor.id) {
              setSelectedTutorForReview(null);
            }
            showToast('info', `✓ ${tutor.name} permanently removed from Firestore database.`);
          } else {
            showToast('error', res.message);
          }
        } catch (err: any) {
          showToast('error', err?.message || 'Failed to delete tutor from Firestore.');
        } finally {
          setVerifyingTutorId(null);
        }
      }
    });
  };

  // Handle Tutor Visibility Toggle (Update 'verified' status in Firestore & toggle public Find Home Tutor visibility)
  const handleToggleVisibility = async (tutor: Tutor) => {
    const newVerified = !tutor.verified;
    if (newVerified && !tutor.profileCompleted) {
      showToast(
        'error',
        `${tutor.name} is still pending at submitting the profile and has not uploaded details & certificates yet.`
      );
      return;
    }
    setIsVerifying(true);
    try {
      const res = await adminToggleTutorVisibility(tutor.id, newVerified);
      showToast('success', res.message);

      // Update local tutor state
      setTutors((prev) =>
        prev.map((item) =>
          item.id === tutor.id
            ? {
                ...item,
                verified: newVerified,
                isApproved: newVerified,
                status: newVerified ? 'approved' : 'pending',
                verificationStatus: newVerified ? 'Verified Genuine Tutor' : 'Pending Verification'
              }
            : item
        )
      );

      // If review modal is open, sync modal state
      if (selectedTutorForReview && selectedTutorForReview.id === tutor.id) {
        setSelectedTutorForReview({
          ...selectedTutorForReview,
          verified: newVerified,
          isApproved: newVerified,
          status: newVerified ? 'approved' : 'pending',
          verificationStatus: newVerified ? 'Verified Genuine Tutor' : 'Pending Verification'
        });
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to toggle tutor visibility.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Handle Booking Acceptance (Assign requested tutor)
  const handleAcceptRequestedTutor = async (booking: HomeTutorBooking) => {
    setIsAssigning(true);
    try {
      const res = await adminAcceptAndAssignTutorBooking(booking.id, booking.requestedTutorId, 'Confirmed requested tutor by Admin.');
      showToast('success', `Home Tutor ${booking.requestedTutorName} successfully assigned to ${booking.studentName}!`);
      
      // Update local bookings
      setBookings((prev) =>
        prev.map((b) =>
          b.id === booking.id
            ? {
                ...b,
                status: 'accepted',
                assignedTutorId: booking.requestedTutorId,
                assignedTutorName: booking.requestedTutorName,
                assignedTutorFee: booking.requestedTutorMonthlyFee
              }
            : b
        )
      );

      // Update tutor as booked
      setTutors((prev) =>
        prev.map((t) =>
          t.id === booking.requestedTutorId ? { ...t, isBooked: true, bookingStatus: 'booked' } : t
        )
      );

      showToast('success', `✓ Home Tutor ${booking.requestedTutorName} automatically assigned to ${booking.studentName} and moved to 'Assigned Tutors' list!`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to accept booking.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Open Decline Modal
  const handleOpenDeclineModal = (booking: HomeTutorBooking) => {
    setDeclineModalBooking(booking);
    setDeclineReason('Selected time slot is already fully occupied.');
    setCustomDeclineReason('');
  };

  // Confirm Decline parent booking request
  const handleConfirmDecline = async () => {
    if (!declineModalBooking) return;

    setIsDeclining(true);
    const finalReason = customDeclineReason.trim() ? customDeclineReason.trim() : declineReason;

    try {
      const res = await adminDeclineTutorBooking(declineModalBooking.id, finalReason);
      showToast('info', `Booking request for ${declineModalBooking.studentName} has been declined.`);

      setBookings((prev) =>
        prev.map((b) =>
          b.id === declineModalBooking.id
            ? {
                ...b,
                status: 'declined',
                declineReason: finalReason,
                declinedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              }
            : b
        )
      );

      setDeclineModalBooking(null);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to decline booking.');
    } finally {
      setIsDeclining(false);
    }
  };

  // Open Re-assign Modal
  const handleOpenReassignModal = (booking: HomeTutorBooking) => {
    setReassignModalBooking(booking);
    // Default to first approved tutor that is not the same or available
    const available = approvedTutors.find((t) => t.id !== booking.requestedTutorId);
    setSelectedReassignTutorId(available ? available.id : approvedTutors[0]?.id || '');
    setReassignNotes(`Assigned specialized educator to match ${booking.studentName}'s schedule.`);
  };

  // Confirm Re-assignment with a new/different tutor
  const handleConfirmReassignment = async () => {
    if (!reassignModalBooking || !selectedReassignTutorId) return;

    setIsAssigning(true);
    const chosenTutor = approvedTutors.find((t) => t.id === selectedReassignTutorId);
    try {
      const res = await adminAcceptAndAssignTutorBooking(
        reassignModalBooking.id,
        selectedReassignTutorId,
        reassignNotes,
        reassignModalBooking
      );

      showToast('success', `Assigned new Home Tutor ${chosenTutor?.name} to student ${reassignModalBooking.studentName}!`);

      setBookings((prev) =>
        prev.map((b) => {
          if (b.id !== reassignModalBooking.id) return b;
          const chosenHourly =
            Number(chosenTutor?.hourlyRate) ||
            Number((chosenTutor as any)?.hourlyCharges) ||
            Number((chosenTutor as any)?.hourlyFee) ||
            (chosenTutor?.monthlyFee ? Math.round(chosenTutor.monthlyFee / 30) : 100);
          const chosenFee = chosenHourly > 0 ? chosenHourly * 30 : (chosenTutor?.monthlyFee || 3000);
          return {
            ...b,
            status: 'reassigned',
            assignedTutorId: selectedReassignTutorId,
            assignedTutorName: chosenTutor?.name || 'Assigned Tutor',
            assignedTutorFee: chosenFee,
            assignedTutorAvatar: chosenTutor?.avatar,
            reassignedNotes: reassignNotes
          };
        })
      );

      // Mark chosen tutor as booked
      setTutors((prev) =>
        prev.map((t) =>
          t.id === selectedReassignTutorId ? { ...t, isBooked: true, bookingStatus: 'booked' } : t
        )
      );

      setReassignModalBooking(null);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to assign new tutor.');
    } finally {
      setIsAssigning(false);
    }
  };

  // Offline demo query status update
  const handleUpdateQueryStatus = async (queryId: string, status: OfflineDemoQuery['status']) => {
    try {
      await fetch(`/api/admin/demo-queries/${encodeURIComponent(queryId)}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      setDemoQueries((prev) =>
        prev.map((q) => (q.id === queryId ? { ...q, status } : q))
      );
      showToast('success', `Query status updated to ${status}.`);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to update status.');
    }
  };

  // Delete offline demo query from Firestore offline_demo_queries
  const handleDeleteOfflineQuery = async (queryId: string) => {
    try {
      await adminDeleteOfflineDemoQuery(queryId);
      setDemoQueries((prev) => prev.filter((q) => q.id !== queryId));
      showToast('info', 'Offline demo query removed from Firestore.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete query.');
    }
  };

  // Handle Single Gallery File Selection & ImgBB Upload
  const handleGalleryFileSelected = async (file: File) => {
    setGalleryImageFile(file);
    const localUrl = URL.createObjectURL(file);
    setGalleryImagePreview(localUrl);

    if (!newGalleryTitle.trim()) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setNewGalleryTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }

    setIsUploadingGalleryToImgbb(true);
    setGalleryUploadStatus('Uploading image to ImgBB CDN...');
    try {
      const uploadRes = await uploadImageToImgBB(file, newGalleryTitle || file.name);
      if (uploadRes.success && uploadRes.url) {
        setNewGalleryImage(uploadRes.url);
        setGalleryUploadStatus('✓ Hosted on ImgBB Cloud');
        showToast('success', 'Image uploaded to ImgBB successfully!');
      } else {
        throw new Error(uploadRes.error || 'ImgBB upload failed');
      }
    } catch (err: any) {
      console.warn('ImgBB upload error:', err);
      setNewGalleryImage('');
      setGalleryUploadStatus('Upload failed — paste a public image URL below or configure IMGBB_API_KEY.');
      showToast('error', err?.message || 'Image hosting failed. Please paste a valid public HTTPS image URL.');
    } finally {
      setIsUploadingGalleryToImgbb(false);
    }
  };

  // Handle Multi-file Batch Upload directly to ImgBB and Firestore Gallery
  const handleBatchGalleryFilesSelected = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    setIsBatchUploadingGallery(true);
    let successCount = 0;
    let failCount = 0;
    try {
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        setGalleryUploadStatus(`Uploading ${i + 1} of ${fileList.length} photos to ImgBB...`);
        try {
          const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
          const title = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
          const uploadRes = await uploadImageToImgBB(file, title);
          if (!uploadRes.success || !uploadRes.url) {
            failCount++;
            continue;
          }

          await saveGalleryItemToFirestore({
            title: title || 'Campus & Classroom Moment',
            subtitle: 'Kumari Institute Rayagada',
            category: newGalleryCategory,
            image: uploadRes.url
          });
          successCount++;
        } catch (itemErr) {
          failCount++;
          console.warn('Error uploading batch item to ImgBB:', itemErr);
        }
      }
      if (successCount > 0) {
        showToast(
          'success',
          `✓ Uploaded ${successCount} photo(s) to ImgBB and saved to Gallery${failCount > 0 ? ` (${failCount} failed)` : '!'}`
        );
        setIsAddingGallery(false);
      } else {
        showToast('error', 'Failed to upload photos to ImgBB. Check IMGBB_API_KEY or paste an HTTPS image link.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to upload photos.');
    } finally {
      setIsBatchUploadingGallery(false);
      setGalleryUploadStatus('');
    }
  };

  // Add new gallery image directly stored in Firestore 'gallery' collection
  const handleAddGalleryItem = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newGalleryTitle.trim()) {
      showToast('error', 'Please provide a photo title.');
      return;
    }

    let finalImageUrl = newGalleryImage.trim();

    // If an image file was selected but not uploaded to ImgBB yet
    if (galleryImageFile && (!finalImageUrl || isUploadingGalleryToImgbb)) {
      setIsUploadingGalleryToImgbb(true);
      try {
        const uploadRes = await uploadImageToImgBB(galleryImageFile, newGalleryTitle.trim());
        if (uploadRes.success && uploadRes.url) {
          finalImageUrl = uploadRes.url;
          setNewGalleryImage(finalImageUrl);
        }
      } catch (err: any) {
        console.warn('ImgBB submit upload notice:', err);
      } finally {
        setIsUploadingGalleryToImgbb(false);
      }
    }

    if (!finalImageUrl) {
      showToast('error', 'Please select a photo to upload via ImgBB or enter an image link.');
      return;
    }

    try {
      const savedId = await saveGalleryItemToFirestore({
        title: newGalleryTitle.trim(),
        subtitle: newGallerySubtitle.trim() || 'Kumari Institute Rayagada',
        category: newGalleryCategory,
        image: finalImageUrl
      });

      showToast('success', '✓ Photo published and stored dynamically in Firestore gallery database!');
      setNewGalleryTitle('');
      setNewGallerySubtitle('');
      setNewGalleryImage('');
      setGalleryImageFile(null);
      setGalleryImagePreview('');
      setGalleryUploadStatus('');
      setIsAddingGallery(false);
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to add gallery image.');
    }
  };

  // Delete gallery image from Firestore 'gallery_manager'
  const handleDeleteGalleryItem = async (id: string) => {
    try {
      await deleteGalleryItemFromFirestore(id);
      await fetch(`/api/gallery/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
      setGalleryItems((prev) => prev.filter((item) => item.id !== id));
      showToast('info', 'Gallery image deleted from Firestore gallery_manager.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete gallery image.');
    }
  };

  // Add new success story with image upload & Firestore persistence
  const handleAddSuccessStory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStoryName.trim() || !newStoryTestimonial.trim()) {
      showToast('error', 'Student name and testimonial quote are required.');
      return;
    }

    setIsUploadingStoryImage(true);
    try {
      let finalImageUrl = newStoryImage.trim();

      // If user uploaded an image file from device
      if (storyImageFile) {
        showToast('info', 'Uploading image asset...');
        const uploadResult = await uploadImageToImgBB(storyImageFile, `${newStoryName}_success_story`);
        if (uploadResult.success && uploadResult.url) {
          finalImageUrl = uploadResult.url;
        } else {
          showToast('error', uploadResult.error || 'Image upload failed. Please paste a valid HTTPS image URL or leave blank for default.');
          setIsUploadingStoryImage(false);
          return;
        }
      }

      if (!finalImageUrl) {
        finalImageUrl = '/images/defaults/student_rohit.jpg';
      }

      // Persist to Cloud Firestore collection 'success_stories'
      const res = await saveSuccessStoryToFirestore({
        studentName: newStoryName.trim(),
        score: newStoryScore.trim() || 'Distinction',
        exam: newStoryExam.trim() || 'Board Examination',
        school: newStorySchool.trim() || 'Rayagada',
        parentName: newStoryParent.trim(),
        testimonial: newStoryTestimonial.trim(),
        image: finalImageUrl,
        badge: newStoryBadge.trim() || 'Top Performer',
        year: newStoryYear.trim() || `${new Date().getFullYear()}`
      });

      if (res.success) {
        setSuccessStories((prev) => [res.story, ...prev.filter((s) => s.id !== res.story.id)]);
        showToast('success', '✓ Success story persisted in Firestore and rendered in gallery!');
        setNewStoryName('');
        setNewStoryScore('');
        setNewStoryExam('');
        setNewStorySchool('');
        setNewStoryParent('');
        setNewStoryTestimonial('');
        setNewStoryImage('');
        setStoryImageFile(null);
        setStoryImagePreview('');
        setIsAddingStory(false);
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to persist success story in Firestore.');
    } finally {
      setIsUploadingStoryImage(false);
    }
  };

  // Delete success story from Firestore
  const handleDeleteSuccessStory = async (id: string) => {
    try {
      await deleteSuccessStoryFromFirestore(id);
      setSuccessStories((prev) => prev.filter((s) => s.id !== id));
      showToast('info', 'Success story removed from Firestore and public gallery.');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to delete story from Firestore.');
    }
  };

  // Total reviews count calculation
  const totalReviewsCount = tutors.reduce((acc, t) => acc + (t.reviews?.length || 0), 0);

  // Review publication handler - Stored in Firestore database
  const handlePublishReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReviewTutorId) {
      showToast('error', 'Please select a tutor from the dropdown.');
      return;
    }
    if (!reviewParentName.trim()) {
      showToast('error', 'Please enter parent / guardian name.');
      return;
    }
    if (!reviewComment.trim()) {
      showToast('error', 'Please write a review comment.');
      return;
    }

    setIsPublishingReview(true);
    try {
      const res = await adminAddTutorReview(selectedReviewTutorId, {
        parentName: reviewParentName.trim(),
        relation: reviewRelation.trim() || 'Parent',
        studentGrade: reviewStudentGrade.trim() || 'Primary Class',
        schoolName: reviewSchoolName.trim() || 'Rayagada',
        rating: Number(reviewRating) || 5,
        comment: reviewComment.trim(),
        verifiedBooking: reviewVerifiedBooking
      });

      if (res.success) {
        showToast('success', res.message || '✓ Parent review created and stored in Firestore database!');
        // Update local tutor reviews
        setTutors((prev) =>
          prev.map((t) => {
            if (t.id === selectedReviewTutorId) {
              const updatedRev = res.review ? [res.review, ...(t.reviews || [])] : (t.reviews || []);
              const newAvg = Math.round((updatedRev.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) / (updatedRev.length || 1)) * 10) / 10;
              return {
                ...t,
                reviews: updatedRev,
                rating: newAvg,
                reviewCount: updatedRev.length
              };
            }
            return t;
          })
        );
        // Reset review form
        setReviewComment('');
        setReviewParentName('');
        setReviewRelation('');
      } else {
        showToast('error', res.message || 'Failed to create review.');
      }
    } catch (err: any) {
      showToast('error', err?.message || 'Error publishing review.');
    } finally {
      setIsPublishingReview(false);
    }
  };

  // Review deletion handler - Removed directly from Firestore
  const handleDeleteReview = (tutorId: string, reviewId: string) => {
    setConfirmDialog({
      title: 'Delete Parent Review?',
      message: 'Are you sure you want to permanently remove this parent review from Firestore?',
      confirmLabel: 'Delete Review',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await adminDeleteTutorReview(tutorId, reviewId);
          if (res.success) {
            showToast('info', '✓ Review removed from Firestore database.');
            setTutors((prev) =>
              prev.map((t) => {
                if (t.id === tutorId) {
                  const remaining = (t.reviews || []).filter((r) => r.id !== reviewId);
                  const newAvg = remaining.length > 0
                    ? Math.round((remaining.reduce((acc, r) => acc + (Number(r.rating) || 5), 0) / remaining.length) * 10) / 10
                    : 5.0;
                  return {
                    ...t,
                    reviews: remaining,
                    rating: newAvg,
                    reviewCount: remaining.length
                  };
                }
                return t;
              })
            );
          } else {
            showToast('error', res.message);
          }
        } catch (err: any) {
          showToast('error', err?.message || 'Failed to delete review.');
        }
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row font-sans selection:bg-amber-400 selection:text-slate-900">
      {/* Toast Alert */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border text-sm font-semibold transition-all animate-in fade-in slide-in-from-top-2 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50'
              : toastMessage.type === 'error'
              ? 'bg-rose-950/90 text-rose-200 border-rose-500/50'
              : 'bg-blue-950/90 text-blue-200 border-blue-500/50'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : toastMessage.type === 'error' ? (
            <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-blue-400 shrink-0" />
          )}
          <span>{toastMessage.message}</span>
        </div>
      )}

      {/* MOBILE BACKDROP OVERLAY */}
      {isMobileNavOpen && (
        <div
          onClick={() => setIsMobileNavOpen(false)}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-40 lg:hidden"
        />
      )}

      {/* LEFT VERTICAL ADMIN SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 bg-slate-950 border-r border-slate-800/80 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 shrink-0 ${
          isMobileNavOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full overflow-y-auto">
          {/* Sidebar Header / Brand */}
          <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onNavigateHome}
                className="cursor-pointer focus:outline-none p-0 m-0 border-0 bg-transparent flex items-center"
                title="Kumari Institute - Go to Public Site"
              >
                <img
                  src="/Logo/kumarilogo.png"
                  alt="Kumari Institute Logo"
                  className="h-12 w-auto max-w-[170px] object-contain p-[3px]"
                  style={{ padding: '3px' }}
                  referrerPolicy="no-referrer"
                />
              </button>
              <div className="min-w-0">
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
                  Admin Console
                </span>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Admin User Info Card */}
          <div className="px-5 py-3.5 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-xs flex items-center justify-center shrink-0">
                CK
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">
                  {currentUser?.name || 'Chandini Kurumoju'}
                </p>
                <p className="text-[10px] text-slate-400 truncate">Super Admin • Rayagada</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0" title="System Operational">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-medium">Live</span>
            </div>
          </div>

          {/* Vertical Navigation Links */}
          <nav className="p-3 space-y-6 flex-1 text-xs">
            {/* Section 1: Bookings & Students */}
            {/* Section 1: Bookings & Directory (Collections 1, 2, 3, 4) */}
            <div className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Bookings &amp; Directory
              </div>

              {/* 1. Incoming Bookings */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('incoming_bookings');
                  setBookingFilter('pending');
                  setIsMobileNavOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer text-left ${
                  activeTab === 'incoming_bookings' || activeTab === 'bookings'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Bell className="w-4 h-4 shrink-0" />
                  <span className="truncate">1. Incoming Bookings</span>
                </div>
                {pendingBookingsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500 text-white animate-pulse shrink-0">
                    {pendingBookingsCount}
                  </span>
                )}
              </button>

              {/* 2. Registered Parents */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('parents');
                  setDirectoryRoleFilter('parents');
                  setIsMobileNavOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer text-left ${
                  activeTab === 'parents' || (activeTab === 'registered_directory' && directoryRoleFilter === 'parents')
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Users className="w-4 h-4 shrink-0 text-indigo-300" />
                  <span className="truncate">2. Parents Directory</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {unassignedParentsCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-500 text-white animate-pulse" title="Parents with no tutor assigned">
                      {unassignedParentsCount}
                    </span>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    activeTab === 'parents' || (activeTab === 'registered_directory' && directoryRoleFilter === 'parents')
                      ? 'bg-indigo-900/60 text-white'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}>
                    {registeredParents.length}
                  </span>
                </div>
              </button>

              {/* 3. Tutors Requests */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('tutors_requests');
                  setTutorFilter('pending');
                  setIsMobileNavOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer text-left ${
                  activeTab === 'tutors_requests' || (activeTab === 'tutors' && tutorFilter === 'pending')
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserPlus className="w-4 h-4 shrink-0" />
                  <span className="truncate">3. Tutors Request</span>
                </div>
                {pendingTutorsCount > 0 ? (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                    activeTab === 'tutors_requests' ? 'bg-slate-950 text-amber-300' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}>
                    {pendingTutorsCount} New
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-semibold">{tutorRequests.length}</span>
                )}
              </button>

              {/* 4. Tutors Directory */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('tutors_directory');
                  setIsMobileNavOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer text-left ${
                  activeTab === 'tutors_directory' || activeTab === 'complete_tutors' || activeTab === 'assigned_tutors'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <GraduationCap className="w-4 h-4 shrink-0" />
                  <span className="truncate">4. Tutors Directory</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                  activeTab === 'tutors_directory' || activeTab === 'complete_tutors' || activeTab === 'assigned_tutors'
                    ? 'bg-slate-950 text-amber-300'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {approvedTutorsCount}
                </span>
              </button>
            </div>

            {/* Section 2: Financials & Reviews (Received Fee, Collections 5, 6, 7) */}
            <div className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Financials &amp; Payments
              </div>

              {/* Received Fee Page */}
              <button
                type="button"
                id="admin-tab-received-fee"
                onClick={() => {
                  setActiveTab('received_fees');
                  setIsMobileNavOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer text-left ${
                  activeTab === 'received_fees'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <CreditCard className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span className="truncate">Received Fee</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                  activeTab === 'received_fees'
                    ? 'bg-slate-950 text-emerald-300'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {receivedFeesList.length} Paid
                </span>
              </button>

              {/* 5. Withdrawal Notices */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('withdrawal_notices');
                  setWithdrawalFilter('pending');
                  setIsMobileNavOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer text-left ${
                  activeTab === 'withdrawal_notices'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Clock className="w-4 h-4 shrink-0 text-rose-300" />
                  <span className="truncate">5. Withdrawal Notice</span>
                </div>
                {mergedWithdrawalsList.filter((r) => r.status === 'pending').length > 0 ? (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                    activeTab === 'withdrawal_notices' ? 'bg-white text-rose-600' : 'bg-rose-500 text-white animate-pulse'
                  }`}>
                    {mergedWithdrawalsList.filter((r) => r.status === 'pending').length} New
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-semibold">0</span>
                )}
              </button>

              {/* 6. Complete Withdrawals */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('complete_withdrawals');
                  setWithdrawalFilter('approved');
                  setIsMobileNavOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer text-left ${
                  activeTab === 'complete_withdrawals'
                    ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Wallet className="w-4 h-4 shrink-0" />
                  <span className="truncate">6. Complete Withdrawal</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                  activeTab === 'complete_withdrawals' ? 'bg-slate-950 text-emerald-300' : 'bg-slate-800 text-slate-300'
                }`}>
                  {mergedWithdrawalsList.filter((r) => r.status === 'approved').length}
                </span>
              </button>

              {/* 7. Tutors Reviews */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('tutors_reviews');
                  setIsMobileNavOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer text-left ${
                  activeTab === 'tutors_reviews' || activeTab === 'tutor_reviews'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Star className="w-4 h-4 shrink-0 fill-amber-400 text-amber-400" />
                  <span className="truncate">7. Tutors Review</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                  activeTab === 'tutors_reviews' || activeTab === 'tutor_reviews' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
                }`}>
                  {tutorsReviews.length || totalReviewsCount}
                </span>
              </button>
            </div>

            {/* Section 3: Coaching, Media & Banners (Collections 8, 9, 10, 11) */}
            <div className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Coaching &amp; Media
              </div>

              {/* 8. Offline Demo Queries */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('offline_demo_queries');
                  setIsMobileNavOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer text-left ${
                  activeTab === 'offline_demo_queries' || activeTab === 'offline_queries'
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span className="truncate">8. Offline Demo Queries</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                  activeTab === 'offline_demo_queries' || activeTab === 'offline_queries' ? 'bg-purple-950 text-purple-200' : 'bg-slate-800 text-slate-300'
                }`}>
                  {demoQueries.length}
                </span>
              </button>

              {/* 9. Gallery Manager */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('gallery_manager');
                  setIsMobileNavOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer text-left ${
                  activeTab === 'gallery_manager' || activeTab === 'gallery'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ImageIcon className="w-4 h-4 shrink-0" />
                  <span className="truncate">9. Gallery Manager</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                  activeTab === 'gallery_manager' || activeTab === 'gallery' ? 'bg-blue-950 text-blue-200' : 'bg-slate-800 text-slate-300'
                }`}>
                  {galleryItems.length}
                </span>
              </button>

              {/* 10. Success Stories */}
              <button
                type="button"
                onClick={() => {
                  setActiveTab('success_stories');
                  setIsMobileNavOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer text-left ${
                  activeTab === 'success_stories'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Award className="w-4 h-4 shrink-0" />
                  <span className="truncate">10. Success Stories</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                  activeTab === 'success_stories' ? 'bg-slate-950 text-slate-200' : 'bg-slate-800 text-slate-300'
                }`}>
                  {successStories.length}
                </span>
              </button>

              {/* 11. Offers & Marquee */}
              <button
                type="button"
                id="admin-tab-offers"
                onClick={() => {
                  setActiveTab('offers_manager');
                  setIsMobileNavOpen(false);
                }}
                className={`w-full px-3 py-2.5 rounded-xl font-bold flex items-center justify-between transition-all cursor-pointer text-left ${
                  activeTab === 'offers_manager'
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Flame className="w-4 h-4 shrink-0 text-amber-400" />
                  <span className="truncate">11. Offers &amp; Marquee</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                  activeTab === 'offers_manager' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
                }`}>
                  Live
                </span>
              </button>
            </div>
          </nav>

          {/* Sidebar Footer Actions */}
          <div className="p-4 border-t border-slate-800/80 space-y-2 shrink-0 bg-slate-950">

            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={onNavigateHome}
                className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-800"
                title="Preview public website"
              >
                <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                <span className="truncate">View Site</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="px-2.5 py-2 rounded-xl bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-rose-500/20"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>

            <div className="pt-2 text-center">
              <span className="text-[10px] text-slate-400">Kumari Institute • Rayagada, Odisha</span>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT WRAPPER */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-900 min-h-screen">
        {/* Streamlined Top Navigation Bar */}
        <header className="bg-slate-950/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu trigger */}
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Current Active Tab Breadcrumb Title */}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm sm:text-base font-bold text-white tracking-tight truncate">
                  {activeTab === 'incoming_bookings' || activeTab === 'bookings'
                    ? '1. Incoming Bookings (Cloud Firestore)'
                    : activeTab === 'parents' || activeTab === 'registered_directory'
                    ? '2. Parents Directory (Registered Parents)'
                    : activeTab === 'tutors_requests' || activeTab === 'tutors'
                    ? '3. Tutors Request Collection (Pending Verification)'
                    : activeTab === 'tutors_directory' || activeTab === 'complete_tutors' || activeTab === 'assigned_tutors'
                    ? '4. Tutors Directory (Approved Tutors & Assigned Parents)'
                    : activeTab === 'received_fees'
                    ? 'Received Fee • Paid Parents & Student Details'
                    : activeTab === 'withdrawal_notices'
                    ? '5. Withdrawal Notice Collection'
                    : activeTab === 'complete_withdrawals' || activeTab === 'tutor_withdrawals'
                    ? '6. Complete Withdrawal Collection'
                    : activeTab === 'tutors_reviews' || activeTab === 'tutor_reviews'
                    ? '7. Tutors Review Collection'
                    : activeTab === 'offline_demo_queries' || activeTab === 'offline_queries'
                    ? '8. Offline Demo Queries Collection'
                    : activeTab === 'gallery_manager' || activeTab === 'gallery'
                    ? '9. Gallery Manager Collection (ImgBB & Firestore)'
                    : activeTab === 'success_stories'
                    ? '10. Success Stories Collection'
                    : '11. Offers Section Manager • Ticker & Expiry (Cloud Firestore)'}
                </span>
                <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-amber-300 border border-slate-700 uppercase">
                  Rayagada
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block truncate">
                {activeTab === 'incoming_bookings' || activeTab === 'bookings'
                  ? 'Review real-time parent requests and allocate verified home educators; bookings are automatically deleted upon acceptance'
                  : activeTab === 'parents' || activeTab === 'registered_directory'
                  ? 'Overview of all genuine registered parents, student learning requirements, and home tutor allocations'
                  : activeTab === 'tutors_requests' || activeTab === 'tutors'
                  ? 'Registered tutors undergoing profile and certificate verification; approve genuine teachers to add to Tutors Directory'
                  : activeTab === 'tutors_directory' || activeTab === 'complete_tutors' || activeTab === 'assigned_tutors'
                  ? 'Approved home tutors directory with complete credentials, subjects handled, and connected parent families'
                  : activeTab === 'received_fees'
                  ? 'Real-time record of Razorpay tuition fees received from parents with student name, date/time, educator, verification IDs, and 30-day billing cycle'
                  : activeTab === 'withdrawal_notices'
                  ? 'Pending tutor payout withdrawal requests; removed once accepted & settled'
                  : activeTab === 'complete_withdrawals' || activeTab === 'tutor_withdrawals'
                  ? 'Accepted & settled tutor withdrawal requests with recorded UTR and transaction receipts'
                  : activeTab === 'tutors_reviews' || activeTab === 'tutor_reviews'
                  ? 'Authentic parent ratings and feedback stored in Firestore database'
                  : activeTab === 'offline_demo_queries' || activeTab === 'offline_queries'
                  ? 'Inquiries for offline coaching classes at Indira Nagar center'
                  : activeTab === 'gallery_manager' || activeTab === 'gallery'
                  ? 'Manage campus, student activity, and classroom imagery'
                  : activeTab === 'success_stories'
                  ? 'Publish verified exam rankers and proud student achievements'
                  : 'Publish live discounts and promotion ticker notices with automated expiration date removal'}
              </p>
            </div>
          </div>

          {/* Quick Header Tools & Alerts */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Real-time Notification Alert Bell Popover */}
            <div className="relative" ref={notificationRef}>
              <button
                type="button"
                onClick={() => {
                  if (!isNotificationOpen) {
                    markAllCurrentNotificationsAsSeen();
                    setIsNotificationOpen(true);
                  } else {
                    setIsNotificationOpen(false);
                  }
                }}
                className={`relative px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                  unseenAlertsCount > 0
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                    : 'bg-slate-800 text-slate-300 border-slate-700/60 hover:bg-slate-700'
                }`}
                title={unseenAlertsCount > 0 ? `${unseenAlertsCount} new pending action alerts` : 'No new action alerts'}
              >
                <Bell className={`w-4 h-4 ${unseenAlertsCount > 0 ? 'text-amber-400 animate-bounce' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">Alerts</span>
                {unseenAlertsCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow-lg shadow-rose-500/50 animate-pulse">
                    {unseenAlertsCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {isNotificationOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                  <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-amber-400" />
                      <h4 className="text-xs sm:text-sm font-bold text-white">Action Required</h4>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {pendingTutorsCount + pendingBookingsCount > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            markAllCurrentNotificationsAsSeen();
                          }}
                          className="px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60 transition-colors cursor-pointer"
                        >
                          Mark Seen
                        </button>
                      )}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                        {pendingTutorsCount + pendingBookingsCount} Pending Tasks
                      </span>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-800 p-2 space-y-1">
                    {pendingTutorsCount + pendingBookingsCount === 0 ? (
                      <div className="py-6 text-center text-xs text-slate-400">
                        <CheckCircle2 className="w-7 h-7 text-emerald-400 mx-auto mb-1.5" />
                        <p className="font-bold text-slate-300">All caught up!</p>
                        <p className="text-[11px] text-slate-500">No pending tutor verifications or unassigned bookings.</p>
                      </div>
                    ) : (
                      <>
                        {/* Pending Tutors List */}
                        {pendingTutorsList.length > 0 && (
                          <div className="p-1 space-y-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 px-2 block">
                              Pending Tutor Registrations ({pendingTutorsList.length})
                            </span>
                            {pendingTutorsList.map((t) => (
                              <div
                                key={t.id}
                                className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 transition-colors flex items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h5 className="font-bold text-white text-xs truncate">{t.name}</h5>
                                    {!seenNotificationIds.has(t.id) && (
                                      <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                        NEW
                                      </span>
                                    )}
                                  </div>
                                  {t.profileCompleted ? (
                                    <>
                                      <p className="text-[11px] text-emerald-300 truncate">
                                        Profile submitted • {t.qualification || 'Ready for review'}
                                      </p>
                                      <p className="text-[10px] text-slate-400 truncate">
                                        {t.locationArea || t.email || t.phone || 'Details uploaded'}
                                      </p>
                                    </>
                                  ) : (
                                    <>
                                      <p className="text-[11px] text-amber-300 truncate">
                                        Not yet uploaded details — pending at profile submission
                                      </p>
                                      <p className="text-[10px] text-slate-400 truncate">
                                        {t.email || t.phone || 'Logged in as Tutor'}
                                      </p>
                                    </>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    markSingleNotificationAsSeen(t.id);
                                    setActiveTab('tutors');
                                    setTutorFilter('pending');
                                    setSelectedTutorForReview(t);
                                    setIsNotificationOpen(false);
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold shrink-0 cursor-pointer shadow-xs"
                                >
                                  {t.profileCompleted ? 'Review' : 'View'}
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Pending Bookings List */}
                        {bookings.filter((b) => b.status === 'pending').length > 0 && (
                          <div className="p-1 space-y-1 pt-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 px-2 block">
                              Pending Parent Bookings ({bookings.filter((b) => b.status === 'pending').length})
                            </span>
                            {bookings
                              .filter((b) => b.status === 'pending')
                              .map((b) => (
                                <div
                                  key={b.id}
                                  className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800 transition-colors flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <h5 className="font-bold text-white text-xs truncate">
                                        Student: {b.studentName} ({b.studentGrade})
                                      </h5>
                                      {!seenNotificationIds.has(b.id) && (
                                        <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                          NEW
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 truncate">Parent: {b.parentName} ({b.parentPhone})</p>
                                    <p className="text-[10px] text-emerald-400">Target Tutor: {b.requestedTutorName}</p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      markSingleNotificationAsSeen(b.id);
                                      setActiveTab('incoming_bookings');
                                      setBookingFilter('pending');
                                      setIsNotificationOpen(false);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold shrink-0 cursor-pointer shadow-xs"
                                  >
                                    Assign
                                  </button>
                                </div>
                              ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onNavigateHome}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700/60 hidden sm:flex"
            >
              <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
              <span>Preview Live Site</span>
            </button>

            <button
              type="button"
              onClick={onLogout}
              className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-rose-500/30"
            >
              <span>Logout</span>
            </button>
          </div>
        </header>

        {/* MAIN ADMIN WORKSPACE */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* =========================================================================
            TAB: RECEIVED FEE (Collection: received_fees)
           ========================================================================= */}
        {activeTab === 'received_fees' && (
          <AdminReceivedFeeTab
            receivedFees={receivedFeesList}
            isLoading={isLoadingReceivedFees}
            onRefresh={() => {
              setIsLoadingReceivedFees(true);
              const unsub = subscribeToReceivedFees((fees) => {
                setReceivedFeesList(fees);
                setIsLoadingReceivedFees(false);
                unsub();
              });
            }}
          />
        )}

        {/* =========================================================================
            TAB 1: TUTORS VERIFICATION & CERTIFICATE REVIEW (Collection: tutors_requests)
           ========================================================================= */}
        {(activeTab === 'tutors' || activeTab === 'tutors_requests') && (
          <div className="space-y-6">
            {/* Header description banner */}
            <div className="bg-slate-800/80 rounded-3xl p-6 border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-white">Tutor Registrations &amp; Certificate Previews</h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Admin Approval Required
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
                  Tutors appear here as soon as they log in or register. If they haven&apos;t completed the profile form yet, they are marked as pending profile submission. Once they submit their details, fee schedule, live GPS &amp; certificates, inspect and approve them to publish on Find Home Tutors.
                </p>
                {pendingTutorsCount > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                    <span className="px-2.5 py-0.5 rounded-lg bg-orange-500/15 text-orange-300 border border-orange-500/30 font-semibold">
                      {awaitingProfileSubmissionCount} Pending Profile Submission (Details Not Uploaded)
                    </span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold">
                      {readyForVerificationCount} Profile Submitted (Ready for Certificate Verification)
                    </span>
                  </div>
                )}
              </div>

              {/* Status filter tabs */}
              <div className="flex items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-700 shrink-0 overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setTutorFilter('all')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    tutorFilter === 'all' ? 'bg-slate-700 text-white font-black shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>All ({tutors.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTutorFilter('pending')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    tutorFilter === 'pending'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span>Pending</span>
                  {pendingTutorsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-amber-300 text-[10px]">
                      {pendingTutorsCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setTutorFilter('approved')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    tutorFilter === 'approved'
                      ? 'bg-emerald-500 text-slate-950 font-black shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Verified</span>
                  <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-emerald-300 text-[10px]">
                    {approvedTutorsCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setTutorFilter('rejected')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                    tutorFilter === 'rejected' ? 'bg-rose-500 text-white font-black shadow-xs' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Rejected</span>
                  {rejectedTutorsCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-slate-950 text-rose-300 text-[10px]">
                      {rejectedTutorsCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Search Bar & View Mode Toggle */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tutorSearch}
                  onChange={(e) => setTutorSearch(e.target.value)}
                  placeholder="Search tutors by name, subject, phone, or locality in Rayagada..."
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-2xl pl-11 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>

              {/* View Switcher: Card Grid vs Table View */}
              <div className="flex items-center gap-1.5 bg-slate-800/90 p-1 rounded-2xl border border-slate-700 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setTutorViewMode('grid')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    tutorViewMode === 'grid'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Grid Card View"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTutorViewMode('table')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    tutorViewMode === 'table'
                      ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Compact Table View"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Table</span>
                </button>
              </div>
            </div>

            {/* Tutors Grid */}
            {isLoadingTutors ? (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-amber-400" />
                <p className="text-sm">Loading tutors list...</p>
              </div>
            ) : filteredTutors.length === 0 ? (
              <div className="p-12 text-center bg-slate-800/40 rounded-3xl border border-dashed border-slate-700 space-y-3">
                <ShieldCheck className="w-10 h-10 text-slate-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-200">No Tutors in this Category</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {tutorFilter === 'pending'
                    ? 'All registered tutors have been reviewed! New submissions will automatically appear here.'
                    : 'No tutors found matching your current filter.'}
                </p>
              </div>
            ) : tutorViewMode === 'table' ? (
              /* =========================================================================
                 TABLE VIEW: LIST ALL REGISTERED TUTORS WITH DIRECT APPROVE & REJECT BUTTONS
                 ========================================================================= */
              <div className="bg-slate-800/90 rounded-3xl border border-slate-700/80 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 border-b border-slate-700 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-4 px-4 font-bold">Registered Tutor</th>
                        <th className="py-4 px-4 font-bold">Qualification &amp; Exp</th>
                        <th className="py-4 px-4 font-bold">Subjects &amp; Locality</th>
                        <th className="py-4 px-4 font-bold">Monthly Fee</th>
                        <th className="py-4 px-4 font-bold">Uploaded Documents</th>
                        <th className="py-4 px-4 font-bold text-center">Status in Firestore</th>
                        <th className="py-4 px-4 font-bold text-right">Approve / Reject Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60 text-slate-300">
                      {filteredTutors.map((tutor) => {
                        const isRejected = tutor.status === 'rejected';
                        const isApproved = !isRejected && (tutor.isApproved === true || tutor.status === 'approved');
                        const isProfileSubmitted = Boolean(tutor.profileCompleted);

                        return (
                          <tr key={tutor.id} className="hover:bg-slate-750/50 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                {tutor.avatar ? (
                                  <img
                                    src={tutor.avatar}
                                    alt={tutor.name}
                                    className="w-10 h-10 rounded-xl object-cover border border-slate-600 shrink-0"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-amber-300 flex items-center justify-center font-bold text-sm border border-slate-600 shrink-0">
                                    {tutor.name?.charAt(0)?.toUpperCase() || 'T'}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-bold text-white text-xs flex items-center gap-1.5 truncate">
                                    <span className="truncate">{tutor.name}</span>
                                    {isApproved && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" title="Verified Genuine" />}
                                  </div>
                                  <div className="text-[11px] text-slate-400 truncate">
                                    {tutor.phone || tutor.email || 'Contact pending'}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              {isProfileSubmitted ? (
                                <>
                                  <div className="font-semibold text-amber-400">{tutor.qualification || 'Qualification Uploaded'}</div>
                                  <div className="text-[11px] text-slate-400">{tutor.experienceYears}+ Yrs Experience</div>
                                </>
                              ) : (
                                <>
                                  <div className="font-semibold text-orange-300">Not uploaded yet</div>
                                  <div className="text-[11px] text-slate-400">Pending profile submission</div>
                                </>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              {isProfileSubmitted ? (
                                <>
                                  <div className="font-medium text-slate-200 truncate max-w-[160px]">
                                    {tutor.subjects.length > 0 ? tutor.subjects.join(', ') : 'Not specified'}
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                                    <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                    <span className="truncate max-w-[150px]">{tutor.locationArea || 'Address submitted'}</span>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div className="font-medium text-slate-400 italic">Pending profile upload</div>
                                  <div className="text-[11px] text-slate-500">Address &amp; GPS not uploaded yet</div>
                                </>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-bold whitespace-nowrap">
                              {isProfileSubmitted && tutor.monthlyFee > 0 ? (
                                <div className="text-emerald-400">
                                  ₹{tutor.monthlyFee.toLocaleString('en-IN')}/mo
                                  {tutor.hourlyRate > 0 && (
                                    <div className="text-[10px] text-slate-400 font-normal">₹{tutor.hourlyRate}/hr • 30 hrs</div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-500 font-normal text-[11px]">Not set yet</span>
                              )}
                            </td>
                            <td className="py-3.5 px-4">
                              <button
                                type="button"
                                onClick={() => setSelectedTutorForReview(tutor)}
                                className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] inline-flex items-center gap-1 transition-colors cursor-pointer border ${
                                  isProfileSubmitted
                                    ? 'bg-slate-700/80 hover:bg-slate-700 text-slate-200 border-slate-600'
                                    : 'bg-orange-950/40 hover:bg-orange-950/60 text-orange-300 border-orange-500/30'
                                }`}
                              >
                                <Eye className={`w-3 h-3 ${isProfileSubmitted ? 'text-amber-400' : 'text-orange-400'}`} />
                                <span>{isProfileSubmitted ? 'Preview Certificates' : 'Not Uploaded Yet'}</span>
                              </button>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {isApproved ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  <span>Verified Genuine</span>
                                </span>
                              ) : isRejected ? (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center gap-1">
                                  <X className="w-3 h-3" />
                                  <span>Rejected</span>
                                </span>
                              ) : !isProfileSubmitted ? (
                                <span
                                  className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/40 inline-flex items-center gap-1"
                                  title="Tutor logged in / registered but has not yet submitted the complete profile form"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                                  <span>Pending Profile Submission</span>
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                                  <span>Profile Submitted • Review</span>
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {/* DIRECT APPROVE BUTTON IN FIRESTORE */}
                                <button
                                  type="button"
                                  disabled={(isVerifying && verifyingTutorId === tutor.id) || !isProfileSubmitted}
                                  onClick={() => handleVerifyTutor(tutor, 'approved')}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all shadow-xs ${
                                    !isProfileSubmitted
                                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-60'
                                      : isApproved
                                      ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/50 cursor-pointer'
                                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 cursor-pointer'
                                  }`}
                                  title={
                                    !isProfileSubmitted
                                      ? 'Cannot approve before tutor uploads details & certificates'
                                      : 'Update verification status to Approved directly in Firestore'
                                  }
                                >
                                  {verifyingTutorId === tutor.id && isVerifying ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Check className="w-3 h-3" />
                                  )}
                                  <span>{isApproved ? 'Approved ✓' : 'Approve'}</span>
                                </button>

                                {/* DIRECT REJECT BUTTON IN FIRESTORE */}
                                <button
                                  type="button"
                                  disabled={isVerifying && verifyingTutorId === tutor.id}
                                  onClick={() => handleVerifyTutor(tutor, 'rejected')}
                                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                    isRejected
                                      ? 'bg-rose-950/70 border border-rose-500/50 text-rose-300'
                                      : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30'
                                  }`}
                                  title="Update verification status to Rejected directly in Firestore"
                                >
                                  {verifyingTutorId === tutor.id && isVerifying ? (
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <X className="w-3.5 h-3.5" />
                                  )}
                                  <span>{isRejected ? 'Rejected ✕' : 'Reject'}</span>
                                </button>

                                {/* DELETE PERMANENTLY */}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTutor(tutor)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-700/60 transition-colors cursor-pointer"
                                  title="Permanently remove tutor from Firestore"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredTutors.map((tutor) => {
                  const isRejected = tutor.status === 'rejected';
                  const isApproved = !isRejected && (tutor.isApproved === true || tutor.status === 'approved');
                  const isPending = !isApproved && !isRejected;
                  const isProfileSubmitted = Boolean(tutor.profileCompleted);
                  const has10th = Boolean(tutor.certificates?.tenth?.url);
                  const has12th = Boolean(tutor.certificates?.twelfth?.url);
                  const hasDegree = Boolean(tutor.certificates?.degree?.url);
                  const hasIdProof = Boolean(tutor.certificates?.idProof?.url || tutor.aadhaarDocUrl);

                  return (
                    <div
                      key={tutor.id}
                      className={`bg-slate-800 rounded-3xl p-5 border flex flex-col justify-between transition-all hover:border-slate-600 ${
                        isPending && !isProfileSubmitted
                          ? 'border-orange-500/40 shadow-lg shadow-orange-500/5'
                          : isPending
                          ? 'border-amber-500/40 shadow-lg shadow-amber-500/5'
                          : isApproved
                          ? 'border-emerald-500/40'
                          : 'border-rose-500/30'
                      }`}
                    >
                      <div className="space-y-4">
                        {/* Top Tutor Info */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {tutor.avatar ? (
                              <img
                                src={tutor.avatar}
                                alt={tutor.name}
                                className="w-13 h-13 rounded-2xl object-cover border-2 border-slate-700 shrink-0"
                              />
                            ) : (
                              <div className="w-13 h-13 rounded-2xl bg-slate-900 text-amber-300 flex items-center justify-center font-black text-lg border-2 border-slate-700 shrink-0">
                                {tutor.name?.charAt(0)?.toUpperCase() || 'T'}
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-bold text-white text-base truncate">{tutor.name}</h3>
                                {isApproved && (
                                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" title="Verified Genuine" />
                                )}
                              </div>
                              <p className={`text-xs font-semibold truncate ${isProfileSubmitted ? 'text-amber-400' : 'text-orange-300'}`}>
                                {isProfileSubmitted ? (tutor.qualification || 'Profile Submitted') : 'Details Not Uploaded Yet'}
                              </p>
                              <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                <span className="truncate">
                                  {isProfileSubmitted
                                    ? (tutor.locationArea || 'Address submitted')
                                    : 'Address & Live GPS pending'}
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="shrink-0">
                            {isPending && !isProfileSubmitted && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-300 border border-orange-500/40 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                                <span>Pending Profile Upload</span>
                              </span>
                            )}
                            {isPending && isProfileSubmitted && (
                              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/40 inline-flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                                <span>Submitted • Review</span>
                              </span>
                            )}
                            {isApproved && (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-400" />
                                <span>Genuine Tutor</span>
                              </span>
                            )}
                            {isRejected && (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                Rejected
                              </span>
                            )}
                          </div>
                        </div>

                        {!isProfileSubmitted ? (
                          <div className="rounded-2xl border border-orange-500/30 bg-orange-950/30 p-3.5 space-y-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-bold text-orange-300">
                              <Clock className="w-3.5 h-3.5 shrink-0" />
                              <span>Pending at Profile Submission</span>
                            </div>
                            <p className="text-[11px] text-slate-300 leading-relaxed">
                              This tutor has logged in / registered, but has <strong>not yet uploaded their details &amp; certificates</strong>. Once they submit the complete profile form, all academic certificates, fee schedule, and live location will appear here automatically.
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Quick Stats Grid */}
                            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Experience</span>
                                <span className="font-semibold text-slate-200">{tutor.experienceYears}+ Years</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Monthly Fee</span>
                                <span className="font-bold text-emerald-400">
                                  {tutor.monthlyFee > 0 ? `₹${tutor.monthlyFee.toLocaleString('en-IN')}/mo` : 'Not set'}
                                </span>
                                {tutor.hourlyRate > 0 && (
                                  <span className="text-[9px] text-slate-400 block font-normal">
                                    ₹{tutor.hourlyRate}/hr • 30 days
                                  </span>
                                )}
                              </div>
                              <div className="col-span-2 pt-1 border-t border-slate-800/80">
                                <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Subjects Handled</span>
                                <span className="font-medium text-slate-300 truncate block">
                                  {tutor.subjects.length > 0 ? tutor.subjects.join(', ') : 'Not specified'}
                                </span>
                              </div>
                            </div>

                            {/* Certificates uploaded preview badges */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                <FileText className="w-3 h-3 text-amber-400" />
                                <span>Uploaded Certificates &amp; ID Proofs:</span>
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                                  has10th
                                    ? 'bg-emerald-900/30 text-emerald-200 border-emerald-700/40'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}>
                                  {has10th ? `✓ 10th (${tutor.certificates?.tenth?.score || 'Uploaded'})` : '10th Pending'}
                                </span>
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                                  has12th
                                    ? 'bg-emerald-900/30 text-emerald-200 border-emerald-700/40'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}>
                                  {has12th ? `✓ 12th (${tutor.certificates?.twelfth?.score || 'Uploaded'})` : '12th Pending'}
                                </span>
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                                  hasDegree
                                    ? 'bg-emerald-900/30 text-emerald-200 border-emerald-700/40'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}>
                                  {hasDegree ? '✓ Degree Certificate' : 'Degree (Optional)'}
                                </span>
                                <span className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                                  hasIdProof
                                    ? 'bg-blue-900/40 text-blue-200 border-blue-700/40'
                                    : 'bg-slate-800 text-slate-400 border-slate-700'
                                }`}>
                                  {hasIdProof ? '✓ Govt ID (Aadhaar)' : 'Aadhaar Pending'}
                                </span>
                              </div>
                            </div>
                          </>
                        )}

                        {/* Contact details */}
                        <div className="text-xs text-slate-400 space-y-1 pt-1 border-t border-slate-700/50">
                          {tutor.phone && (
                            <p className="flex items-center gap-2">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-200 font-medium">{tutor.phone}</span>
                            </p>
                          )}
                          {tutor.email && (
                            <p className="flex items-center gap-2 truncate">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-300 truncate">{tutor.email}</span>
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Approval Workflow: Visibility Toggle on 'Find Home Tutor' Page & Actions */}
                      <div className="pt-4 border-t border-slate-700/80 space-y-2.5 mt-4">
                        {/* Interactive Visibility Toggle */}
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 border border-slate-700/70">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <span
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                tutor.verified ? 'bg-emerald-400 animate-pulse' : !isProfileSubmitted ? 'bg-orange-400' : 'bg-slate-500'
                              }`}
                            />
                            <div className="truncate">
                              <span className="text-xs font-bold text-white block truncate">
                                {tutor.verified ? 'Visible on Find Tutors' : 'Hidden from Parents'}
                              </span>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {tutor.verified
                                  ? 'Verified in Firestore'
                                  : !isProfileSubmitted
                                  ? 'Awaiting Profile Submission'
                                  : 'Unverified (Approval Needed)'}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={isVerifying || (!tutor.verified && !isProfileSubmitted)}
                            onClick={() => handleToggleVisibility(tutor)}
                            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              !tutor.verified && !isProfileSubmitted
                                ? 'bg-slate-800 opacity-50 cursor-not-allowed'
                                : tutor.verified
                                ? 'bg-emerald-500 cursor-pointer'
                                : 'bg-slate-700 cursor-pointer'
                            }`}
                            title={
                              !tutor.verified && !isProfileSubmitted
                                ? 'Cannot publish before tutor uploads details & certificates'
                                : tutor.verified
                                ? 'Click to toggle visibility OFF (hide from Find Home Tutor page)'
                                : 'Click to toggle visibility ON (verify in Firestore and display on Find Home Tutor page)'
                            }
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                                tutor.verified ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </div>

                        {/* Direct Action Buttons: Approve and Reject directly updating Firestore */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => setSelectedTutorForReview(tutor)}
                            className="p-2 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer shrink-0"
                            title={isProfileSubmitted ? 'Preview all uploaded marksheets, certificates and ID proof' : 'View tutor login & pending submission status'}
                          >
                            <Eye className="w-4 h-4 text-amber-400" />
                          </button>

                          {/* DIRECT APPROVE BUTTON IN FIRESTORE */}
                          <button
                            type="button"
                            disabled={(isVerifying && verifyingTutorId === tutor.id) || !isProfileSubmitted}
                            onClick={() => handleVerifyTutor(tutor, 'approved')}
                            className={`flex-1 px-3 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs ${
                              !isProfileSubmitted
                                ? 'bg-slate-900 text-slate-500 border border-slate-700 cursor-not-allowed'
                                : isApproved
                                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/50 cursor-pointer'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 cursor-pointer'
                            }`}
                            title={
                              !isProfileSubmitted
                                ? 'Tutor must submit complete profile & certificates before approval'
                                : 'Set verification status to Approved directly in Firestore'
                            }
                          >
                            {verifyingTutorId === tutor.id && isVerifying ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>{isApproved ? 'Approved ✓' : !isProfileSubmitted ? 'Awaiting Upload' : 'Approve'}</span>
                          </button>

                          {/* DIRECT REJECT BUTTON IN FIRESTORE */}
                          <button
                            type="button"
                            disabled={isVerifying && verifyingTutorId === tutor.id}
                            onClick={() => handleVerifyTutor(tutor, 'rejected')}
                            className={`flex-1 px-3 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                              isRejected
                                ? 'bg-rose-950/70 border border-rose-500/50 text-rose-300'
                                : 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30'
                            }`}
                            title="Set verification status to Rejected directly in Firestore"
                          >
                            {verifyingTutorId === tutor.id && isVerifying ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <X className="w-3.5 h-3.5" />
                            )}
                            <span>{isRejected ? 'Rejected ✕' : 'Reject'}</span>
                          </button>

                          {/* DELETE TUTOR BUTTON */}
                          <button
                            type="button"
                            onClick={() => handleDeleteTutor(tutor)}
                            className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 border border-slate-700/60 hover:border-rose-500/40 transition-colors cursor-pointer shrink-0"
                            title="Permanently remove tutor from Firestore"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 2: INCOMING BOOKINGS (Notifications from parents with Accept & Decline)
           ========================================================================= */}
        {(activeTab === 'incoming_bookings' || activeTab === 'bookings') && (
          <IncomingBookings
            availableTutors={approvedTutors}
            onNavigateAssignedTutors={() => setActiveTab('assigned_tutors')}
            onTutorAssigned={(tutorId) => {
              setTutors((prev) =>
                prev.map((t) => (t.id === tutorId ? { ...t, isBooked: true, bookingStatus: 'booked' } : t))
              );
            }}
            showToast={showToast}
          />
        )}

        {/* =========================================================================
            TAB 4: TUTORS DIRECTORY (Approved Tutors & Connected Assigned Parents)
           ========================================================================= */}
        {(activeTab === 'tutors_directory' || activeTab === 'complete_tutors' || activeTab === 'assigned_tutors') && (
          <div className="space-y-6">
            {/* Header Description & Metrics */}
            <div className="bg-slate-800/80 rounded-3xl p-6 border border-slate-700/80 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">Approved Tutors Directory</h2>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      {approvedTutors.length} Verified Home Tutors
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
                    Comprehensive directory of all approved home educators in Rayagada. Review teacher credentials, toggle public visibility, and manage direct connections with assigned parent families and students.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('tutors_requests');
                    }}
                    className="px-4 py-2.5 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <GraduationCap className="w-4 h-4 text-amber-400" />
                    <span>Tutor Requests ({pendingTutorsCount})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('incoming_bookings');
                      setBookingFilter('pending');
                    }}
                    className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
                  >
                    <Bell className="w-4 h-4" />
                    <span>Incoming Bookings ({pendingBookingsCount})</span>
                  </button>
                </div>
              </div>

              {/* Quick Metrics Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-700/60">
                <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                    Total Approved Tutors
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black text-white">{approvedTutors.length}</span>
                    <span className="text-xs text-emerald-400 font-semibold">Verified</span>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                    Tutors with Active Students
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black text-amber-400">
                      {approvedTutors.filter((t) => {
                        const hasBooking = bookings.some((b) => (b.status === 'accepted' || b.status === 'reassigned') && (b.assignedTutorId === t.id || b.assignedTutorName === t.name || b.requestedTutorId === t.id));
                        const hasParent = registeredParents.some((p) => p.assignedTutorId === t.id || p.assignedTutor === t.name || (Array.isArray(p.hiredTutors) && p.hiredTutors.some((h: any) => h.tutorId === t.id)));
                        return hasBooking || hasParent || t.isBooked;
                      }).length}
                    </span>
                    <span className="text-xs text-slate-400">Assigned Mentors</span>
                  </div>
                </div>

                <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">
                    Available for New Parents
                  </span>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl font-black text-emerald-400">
                      {approvedTutors.filter((t) => {
                        const hasBooking = bookings.some((b) => (b.status === 'accepted' || b.status === 'reassigned') && (b.assignedTutorId === t.id || b.assignedTutorName === t.name || b.requestedTutorId === t.id));
                        const hasParent = registeredParents.some((p) => p.assignedTutorId === t.id || p.assignedTutor === t.name || (Array.isArray(p.hiredTutors) && p.hiredTutors.some((h: any) => h.tutorId === t.id)));
                        return !(hasBooking || hasParent || t.isBooked);
                      }).length}
                    </span>
                    <span className="text-xs text-slate-400">Ready to Assign</span>
                  </div>
                </div>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Status Filter Tabs */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTutorsDirectoryFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      tutorsDirectoryFilter === 'all'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                        : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    All Approved Tutors ({approvedTutors.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTutorsDirectoryFilter('assigned')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      tutorsDirectoryFilter === 'assigned'
                        ? 'bg-emerald-600 text-white font-black shadow-md'
                        : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>With Assigned Parents</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTutorsDirectoryFilter('available')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      tutorsDirectoryFilter === 'available'
                        ? 'bg-blue-600 text-white font-black shadow-md'
                        : 'bg-slate-900 border border-slate-700 text-slate-300 hover:text-white'
                    }`}
                  >
                    <span>Available / Unassigned</span>
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search by tutor, student, subject, phone, or locality..."
                    value={tutorsDirectorySearch}
                    onChange={(e) => setTutorsDirectorySearch(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-2xl pl-10 pr-9 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  {tutorsDirectorySearch && (
                    <button
                      type="button"
                      onClick={() => setTutorsDirectorySearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Approved Tutors Cards Grid */}
            {(() => {
              const filteredApprovedTutors = approvedTutors.filter((tutor) => {
                const assignedBookings = bookings.filter(
                  (b) =>
                    (b.status === 'accepted' || b.status === 'reassigned') &&
                    (b.assignedTutorId === tutor.id || b.assignedTutorName === tutor.name || b.requestedTutorId === tutor.id)
                );
                const assignedParents = registeredParents.filter(
                  (p) =>
                    p.assignedTutorId === tutor.id ||
                    p.assignedTutor === tutor.name ||
                    (Array.isArray(p.hiredTutors) && p.hiredTutors.some((h: any) => h.tutorId === tutor.id))
                );
                const hasAssigned = assignedBookings.length > 0 || assignedParents.length > 0 || tutor.isBooked;

                if (tutorsDirectoryFilter === 'assigned' && !hasAssigned) return false;
                if (tutorsDirectoryFilter === 'available' && hasAssigned) return false;

                if (tutorsDirectorySearch.trim()) {
                  const q = tutorsDirectorySearch.toLowerCase().trim();
                  const matchName = (tutor.name || '').toLowerCase().includes(q);
                  const matchQual = (tutor.qualification || '').toLowerCase().includes(q);
                  const matchLoc = (tutor.locationArea || tutor.locality || '').toLowerCase().includes(q);
                  const matchPhone = (tutor.phone || '').includes(q);
                  const matchSub = (tutor.subjects || []).some((s) => s.toLowerCase().includes(q));
                  const matchChild = assignedBookings.some(
                    (b) => (b.studentName || '').toLowerCase().includes(q) || (b.parentName || '').toLowerCase().includes(q)
                  );
                  return matchName || matchQual || matchLoc || matchPhone || matchSub || matchChild;
                }
                return true;
              });

              if (filteredApprovedTutors.length === 0) {
                return (
                  <div className="p-12 text-center bg-slate-800/40 rounded-3xl border border-dashed border-slate-700 space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-800 text-amber-400 mx-auto flex items-center justify-center">
                      <GraduationCap className="w-7 h-7" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-base font-bold text-slate-200">
                        {tutorsDirectorySearch ? 'No Tutors Match Search' : 'No Tutors in this View'}
                      </h3>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        {tutorsDirectorySearch
                          ? `No approved tutors match "${tutorsDirectorySearch}". Try clearing your search or filter.`
                          : 'Approved home tutors verified by admin will display here along with their assigned parent families.'}
                      </p>
                    </div>
                    {(tutorsDirectorySearch || tutorsDirectoryFilter !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setTutorsDirectorySearch('');
                          setTutorsDirectoryFilter('all');
                        }}
                        className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs cursor-pointer"
                      >
                        Reset Filters
                      </button>
                    )}
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {filteredApprovedTutors.map((tutor) => {
                    // Match assigned bookings for this tutor
                    const assignedBookings = bookings.filter(
                      (b) =>
                        (b.status === 'accepted' || b.status === 'reassigned') &&
                        (b.assignedTutorId === tutor.id || b.assignedTutorName === tutor.name || b.requestedTutorId === tutor.id)
                    );
                    // Match assigned parents for this tutor
                    const assignedParents = registeredParents.filter(
                      (p) =>
                        p.assignedTutorId === tutor.id ||
                        p.assignedTutor === tutor.name ||
                        (Array.isArray(p.hiredTutors) && p.hiredTutors.some((h: any) => h.tutorId === tutor.id))
                    );

                    const hasConnectedParents = assignedBookings.length > 0 || assignedParents.length > 0;

                    return (
                      <div
                        key={tutor.id}
                        className="bg-slate-800/90 rounded-3xl border border-slate-700/80 p-5 sm:p-6 shadow-xl space-y-5 transition-all hover:border-slate-600"
                      >
                        {/* Top Tutor Profile Section */}
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-700/60">
                          <div className="flex items-start gap-4">
                            {/* Avatar */}
                            <div className="relative shrink-0">
                              {tutor.avatar ? (
                                <img
                                  src={tutor.avatar}
                                  alt={tutor.name}
                                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-emerald-500/40 shadow-md"
                                />
                              ) : (
                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-950 text-white flex items-center justify-center font-black text-2xl border-2 border-slate-700">
                                  {tutor.name?.charAt(0) || 'T'}
                                </div>
                              )}
                              <span
                                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center text-xs font-black shadow-md border-2 border-slate-900"
                                title="Verified Approved Tutor"
                              >
                                ✓
                              </span>
                            </div>

                            {/* Tutor Info */}
                            <div className="space-y-1 min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-lg sm:text-xl font-black text-white">{tutor.name}</h3>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  ✓ Approved Genuine
                                </span>
                                {tutor.verified && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                    Live on Find Tutors
                                  </span>
                                )}
                              </div>

                              <div className="text-xs text-slate-300 flex items-center gap-2 flex-wrap font-medium">
                                <span className="text-amber-400 font-bold">{tutor.qualification || 'Educator'}</span>
                                {tutor.experienceYears ? (
                                  <>
                                    <span>•</span>
                                    <span>{tutor.experienceYears} Years Exp</span>
                                  </>
                                ) : null}
                                <span>•</span>
                                <span className="flex items-center gap-1 text-slate-400">
                                  <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                                  <span>{tutor.locationArea || tutor.locality || 'Address not set'}</span>
                                </span>
                              </div>

                              {/* Contact & Rate Details */}
                              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-slate-400">
                                {tutor.phone && (
                                  <a
                                    href={`tel:${tutor.phone}`}
                                    className="flex items-center gap-1 text-slate-300 hover:text-amber-400 font-mono transition-colors"
                                  >
                                    <Phone className="w-3 h-3 text-amber-400" />
                                    <span>{tutor.phone}</span>
                                  </a>
                                )}
                                {tutor.email && (
                                  <a
                                    href={`mailto:${tutor.email}`}
                                    className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors truncate max-w-xs"
                                  >
                                    <Mail className="w-3 h-3" />
                                    <span className="truncate">{tutor.email}</span>
                                  </a>
                                )}
                                {tutor.monthlyFee > 0 ? (
                                  <span className="font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                                    ₹{tutor.monthlyFee}/mo{tutor.hourlyRate > 0 ? ` (₹${tutor.hourlyRate}/hr)` : ''}
                                  </span>
                                ) : (
                                  <span className="font-semibold text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded-lg border border-slate-700">
                                    Fee not set
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Top Action Buttons */}
                          <div className="flex items-center gap-2 flex-wrap shrink-0">
                            {/* Toggle Public Visibility */}
                            <button
                              type="button"
                              onClick={() => handleToggleVisibility(tutor)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                                tutor.verified
                                  ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60'
                                  : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                              }`}
                              title={tutor.verified ? 'Visible on public Find Home Tutors page' : 'Hidden from public listing'}
                            >
                              <span className={`w-2 h-2 rounded-full ${tutor.verified ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                              <span>{tutor.verified ? 'Visible on Website' : 'Hidden from Website'}</span>
                            </button>

                            {/* View Certificates / Dossier */}
                            <button
                              type="button"
                              onClick={() => setSelectedTutorForReview(tutor)}
                              className="px-3 py-1.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5 text-amber-400" />
                              <span>Certificates &amp; ID Proof</span>
                            </button>

                            {/* Direct Connect Parent Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setConnectParentTargetTutor(tutor);
                                setConnectParentSelectedUid(registeredParents[0]?.uid || '');
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
                            >
                              <UserPlus className="w-3.5 h-3.5" />
                              <span>+ Connect Parent</span>
                            </button>
                          </div>
                        </div>

                        {/* Subjects Handled Chips */}
                        {tutor.subjects && tutor.subjects.length > 0 && (
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                              Subjects Taught:
                            </span>
                            {tutor.subjects.map((sub) => (
                              <span
                                key={sub}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-900 text-slate-200 border border-slate-700"
                              >
                                {sub}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* =========================================================================
                            CONNECTED ASSIGNED PARENTS & STUDENTS SECTION
                           ========================================================================= */}
                        <div className="pt-2 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <UserCheck className="w-4 h-4 text-emerald-400" />
                              <h4 className="font-bold text-white text-sm">
                                Connected Assigned Parents &amp; Students
                              </h4>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                hasConnectedParents
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                  : 'bg-slate-700 text-slate-400'
                              }`}>
                                {assignedBookings.length || (assignedParents.length ? assignedParents.length : 0)} Active Family Connection(s)
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setConnectParentTargetTutor(tutor);
                                setConnectParentSelectedUid(registeredParents[0]?.uid || '');
                              }}
                              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Assign Another Family</span>
                            </button>
                          </div>

                          {hasConnectedParents ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                              {/* Render from assigned bookings if available */}
                              {assignedBookings.length > 0 ? (
                                assignedBookings.map((booking) => (
                                  <div
                                    key={booking.id}
                                    className="bg-slate-900/90 rounded-2xl p-4 border border-emerald-500/30 space-y-3 relative overflow-hidden"
                                  >
                                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        <span>Active Tuition Assignment</span>
                                      </span>
                                      <span className="text-[10px] font-mono text-slate-400">
                                        REF: {booking.id}
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                                          Student
                                        </span>
                                        <span className="font-bold text-white text-sm block">
                                          {booking.studentName}
                                        </span>
                                        <span className="text-slate-300 block">{booking.studentGrade}</span>
                                      </div>

                                      <div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                                          Parent &amp; Phone
                                        </span>
                                        <span className="font-semibold text-white block truncate">
                                          {booking.parentName}
                                        </span>
                                        <a
                                          href={`tel:${booking.parentPhone}`}
                                          className="text-amber-400 font-mono text-xs inline-flex items-center gap-1 hover:underline mt-0.5"
                                        >
                                          <Phone className="w-3 h-3 text-amber-400" />
                                          <span>{booking.parentPhone}</span>
                                        </a>
                                      </div>
                                    </div>

                                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-xs space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Monthly Tuition Fee:</span>
                                        <span className="font-bold text-emerald-400">
                                          ₹{Number(booking.assignedTutorFee || booking.requestedTutorMonthlyFee || 3000).toLocaleString('en-IN')}/mo
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Daily Schedule:</span>
                                        <span className="font-medium text-slate-200">
                                          {booking.preferredTimeSlot || '5:00 PM - 6:00 PM'}
                                        </span>
                                      </div>
                                      {booking.address && (
                                        <div className="flex items-center gap-1 text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                                          <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                                          <span className="truncate">{booking.address}</span>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between gap-2 pt-1">
                                      <a
                                        href={`tel:${booking.parentPhone}`}
                                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                      >
                                        <Phone className="w-3 h-3 text-amber-400" />
                                        <span>Call Parent</span>
                                      </a>
                                      <button
                                        type="button"
                                        onClick={() => handleOpenReassignModal(booking)}
                                        className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-300 text-xs font-bold border border-amber-500/30 transition-colors cursor-pointer flex items-center gap-1"
                                      >
                                        <RefreshCw className="w-3 h-3" />
                                        <span>Reassign</span>
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                assignedParents.map((parent) => (
                                  <div
                                    key={parent.uid}
                                    className="bg-slate-900/90 rounded-2xl p-4 border border-emerald-500/30 space-y-3 relative overflow-hidden"
                                  >
                                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                        <span>Connected Family Profile</span>
                                      </span>
                                      <span className="text-[10px] font-mono text-slate-400">
                                        UID: {parent.uid.slice(0, 8)}...
                                      </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                      <div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                                          Student
                                        </span>
                                        <span className="font-bold text-white text-sm block">
                                          {parent.childName || 'Child'}
                                        </span>
                                        <span className="text-slate-300 block">{parent.childGrade || 'School Student'}</span>
                                      </div>

                                      <div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
                                          Parent &amp; Phone
                                        </span>
                                        <span className="font-semibold text-white block truncate">
                                          {parent.name}
                                        </span>
                                        <a
                                          href={`tel:${parent.phone}`}
                                          className="text-amber-400 font-mono text-xs inline-flex items-center gap-1 hover:underline mt-0.5"
                                        >
                                          <Phone className="w-3 h-3 text-amber-400" />
                                          <span>{parent.phone}</span>
                                        </a>
                                      </div>
                                    </div>

                                    <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 text-xs space-y-1">
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Residence Area:</span>
                                        <span className="font-medium text-slate-200">
                                          {parent.locality || 'Rayagada City'}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-400">Tuition Rate:</span>
                                        <span className="font-bold text-emerald-400">
                                          ₹{parent.feesAmount || tutor.monthlyFee || 3000}/mo
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between gap-2 pt-1">
                                      <a
                                        href={`tel:${parent.phone}`}
                                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                                      >
                                        <Phone className="w-3 h-3 text-amber-400" />
                                        <span>Call Parent</span>
                                      </a>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          ) : (
                            <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                                  <AlertCircle className="w-4 h-4 text-amber-400" />
                                </div>
                                <div>
                                  <span className="font-bold text-white block">
                                    No Parent Currently Assigned
                                  </span>
                                  <span className="text-slate-400 text-[11px] block">
                                    This verified educator is available for home tuition assignments in Rayagada.
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  setConnectParentTargetTutor(tutor);
                                  setConnectParentSelectedUid(registeredParents[0]?.uid || '');
                                }}
                                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20 shrink-0"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                                <span>+ Connect Registered Parent</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* =========================================================================
            TAB 3: OFFLINE DEMO CLASS QUERIES (Collection: offline_demo_queries)
           ========================================================================= */}
        {(activeTab === 'offline_queries' || activeTab === 'offline_demo_queries') && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 rounded-3xl p-6 border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">Offline Classroom Demo Queries</h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Indira Nagar Coaching Center
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
                  Inquiries from parents and students for physical classroom batches, Navodaya exam prep, and foundation classes held directly at the Kumari Institute campus.
                </p>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400">Total Offline Inquiries:</span>
                <p className="text-2xl font-black text-amber-400">{demoQueries.length}</p>
              </div>
            </div>

            {demoQueries.length === 0 ? (
              <div className="p-12 text-center bg-slate-800/40 rounded-3xl border border-dashed border-slate-700 space-y-3">
                <BookOpen className="w-10 h-10 text-slate-500 mx-auto" />
                <h3 className="text-base font-bold text-slate-200">No Offline Demo Inquiries</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  When visitors submit inquiries for classroom foundation batches, they will appear here.
                </p>
              </div>
            ) : (
              <div className="bg-slate-800 rounded-3xl border border-slate-700 overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-700">
                      <tr>
                        <th className="px-5 py-4">Student &amp; Parent</th>
                        <th className="px-5 py-4">Phone / Contact</th>
                        <th className="px-5 py-4">Grade &amp; Subject</th>
                        <th className="px-5 py-4">Preferred Slot</th>
                        <th className="px-5 py-4">Inquiry Notes</th>
                        <th className="px-5 py-4">Status &amp; Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/60 text-slate-200">
                      {demoQueries.map((query) => (
                        <tr key={query.id} className="hover:bg-slate-700/30 transition-colors">
                          <td className="px-5 py-4">
                            <span className="font-bold text-white text-sm block">{query.studentName}</span>
                            <span className="text-slate-400 text-[11px]">Parent: {query.parentName}</span>
                          </td>
                          <td className="px-5 py-4 font-mono font-semibold">
                            <a href={`tel:${query.phone}`} className="text-amber-400 hover:underline">
                              {query.phone}
                            </a>
                            {query.email && <span className="text-slate-400 block text-[11px] truncate">{query.email}</span>}
                          </td>
                          <td className="px-5 py-4">
                            <span className="font-semibold text-slate-200 block">{query.grade}</span>
                            <span className="text-slate-400 text-[11px]">{query.subject}</span>
                          </td>
                          <td className="px-5 py-4 text-slate-300">
                            <span>{query.preferredDate || 'Upcoming'}</span>
                            <span className="text-slate-400 block text-[11px]">{query.preferredTime}</span>
                          </td>
                          <td className="px-5 py-4 text-slate-400 max-w-xs truncate" title={query.notes}>
                            {query.notes || 'Inquiry for offline center batches'}
                          </td>
                          <td className="px-5 py-4">
                            <select
                              value={query.status}
                              onChange={(e) => handleUpdateQueryStatus(query.id, e.target.value as any)}
                              className="bg-slate-900 border border-slate-700 text-xs rounded-xl px-2.5 py-1.5 font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer"
                            >
                              <option value="new">New Query</option>
                              <option value="contacted">Contacted</option>
                              <option value="scheduled">Demo Scheduled</option>
                              <option value="enrolled">Enrolled</option>
                              <option value="closed">Closed</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 4: GALLERY MANAGEMENT (Collection: gallery_manager)
           ========================================================================= */}
        {(activeTab === 'gallery' || activeTab === 'gallery_manager') && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 rounded-3xl p-6 border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">Gallery Management</h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Live Website Sync
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
                  Add photos of classrooms, study sessions, student activities, and institute facilities. Newly published images appear immediately on the public Gallery page.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddingGallery(!isAddingGallery)}
                className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>{isAddingGallery ? 'Cancel' : 'Add New Gallery Photo'}</span>
              </button>
            </div>

            {/* Add Gallery Form */}
            {isAddingGallery && (
              <form onSubmit={handleAddGalleryItem} className="bg-slate-800 rounded-3xl p-6 border border-amber-500/40 space-y-4 shadow-xl">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Add Photo to Gallery</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Photo Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Science Laboratory Session"
                      value={newGalleryTitle}
                      onChange={(e) => setNewGalleryTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Category *</label>
                    <select
                      value={newGalleryCategory}
                      onChange={(e) => setNewGalleryCategory(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                    >
                      <option value="students">Students in Action</option>
                      <option value="classrooms">Classrooms &amp; Labs</option>
                      <option value="building">Campus &amp; Facilities</option>
                      <option value="events">Events &amp; Celebrations</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Subtitle / Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Interactive experiments in physics"
                      value={newGallerySubtitle}
                      onChange={(e) => setNewGallerySubtitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                {/* ImgBB Image File Upload Area */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-300">
                      Photo Upload (ImgBB Cloud CDN &amp; Firestore) *
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-amber-400 font-semibold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        <span>Powered by ImgBB API</span>
                      </span>
                    </div>
                  </div>

                  {/* Hidden File Inputs */}
                  <input
                    type="file"
                    ref={galleryFileInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleGalleryFileSelected(file);
                    }}
                  />
                  <input
                    type="file"
                    ref={galleryBatchInputRef}
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleBatchGalleryFilesSelected(e.target.files);
                      }
                    }}
                  />

                  {/* Upload Dropzone / Button */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 1. Single Photo ImgBB Upload */}
                    <div
                      onClick={() => !isUploadingGalleryToImgbb && galleryFileInputRef.current?.click()}
                      className={`p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 ${
                        isUploadingGalleryToImgbb
                          ? 'bg-amber-950/20 border-amber-500/50'
                          : newGalleryImage
                          ? 'bg-slate-900 border-emerald-500/60 hover:bg-slate-900/80'
                          : 'bg-slate-900 border-slate-700 hover:border-amber-400 hover:bg-slate-900/80'
                      }`}
                    >
                      {isUploadingGalleryToImgbb ? (
                        <>
                          <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
                          <div>
                            <span className="text-xs font-bold text-amber-300 block">Uploading to ImgBB...</span>
                            <span className="text-[11px] text-slate-400">{galleryUploadStatus || 'Hosting on Cloud CDN'}</span>
                          </div>
                        </>
                      ) : newGalleryImage ? (
                        <>
                          <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                          <div>
                            <span className="text-xs font-bold text-emerald-300 block">✓ Photo Hosted on ImgBB</span>
                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-xs block">
                              {newGalleryImage}
                            </span>
                            <span className="text-[10px] text-amber-400 hover:underline mt-1 block">
                              Click to choose another photo
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
                            <Upload className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">
                              Upload Single Photo (ImgBB)
                            </span>
                            <span className="text-[11px] text-slate-400">
                              JPG, PNG, WEBP, GIF (Auto CDN host)
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* 2. Batch Upload Multiple Photos */}
                    <div
                      onClick={() => !isBatchUploadingGallery && galleryBatchInputRef.current?.click()}
                      className={`p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-2 ${
                        isBatchUploadingGallery
                          ? 'bg-indigo-950/20 border-indigo-500/50'
                          : 'bg-slate-900 border-slate-700 hover:border-indigo-400 hover:bg-slate-900/80'
                      }`}
                    >
                      {isBatchUploadingGallery ? (
                        <>
                          <Loader2 className="w-7 h-7 text-indigo-400 animate-spin" />
                          <div>
                            <span className="text-xs font-bold text-indigo-300 block">Batch Uploading to ImgBB...</span>
                            <span className="text-[11px] text-slate-400">{galleryUploadStatus || 'Processing files...'}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-white block">
                              Batch Upload Multiple Photos
                            </span>
                            <span className="text-[11px] text-slate-400">
                              Select 2-10 photos to host &amp; publish at once
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Manual URL / Path Input Option */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                      Direct Photo URL / ImgBB Link (Auto-filled on file upload):
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="https://i.ibb.co/..."
                      value={newGalleryImage}
                      onChange={(e) => setNewGalleryImage(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 font-mono"
                    />
                  </div>

                  {/* Live Photo Preview Card */}
                  {(newGalleryImage || galleryImagePreview) && (
                    <div className="p-3 bg-slate-900/90 rounded-2xl border border-slate-700 flex items-center gap-3.5">
                      <img
                        src={newGalleryImage || galleryImagePreview}
                        alt="Preview"
                        className="w-20 h-16 rounded-xl object-cover border border-slate-700 shrink-0 shadow-md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Preview Ready</span>
                          </span>
                          <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            {newGalleryCategory}
                          </span>
                        </div>
                        <p className="text-xs text-white font-bold truncate mt-0.5">
                          {newGalleryTitle || 'Untitled Photo'}
                        </p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {newGallerySubtitle || 'Kumari Institute Rayagada'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsAddingGallery(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md"
                  >
                    Publish to Gallery
                  </button>
                </div>
              </form>
            )}

            {/* Gallery Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {galleryItems.map((item) => (
                <div key={item.id} className="bg-slate-800 rounded-3xl overflow-hidden border border-slate-700 group">
                  <div className="relative aspect-4/3 overflow-hidden bg-slate-950">
                    <img
                      src={item.image}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-3 left-3 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-950/80 text-white backdrop-blur-xs uppercase tracking-wider">
                      {item.category}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteGalleryItem(item.id)}
                      className="absolute top-3 right-3 p-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 cursor-pointer transition-colors"
                      title="Delete Image"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="p-4 space-y-1">
                    <h4 className="font-bold text-white text-sm">{item.title}</h4>
                    <p className="text-xs text-slate-400 truncate">{item.subtitle}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 5: SUCCESS STORIES MANAGEMENT
           ========================================================================= */}
        {activeTab === 'success_stories' && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 rounded-3xl p-6 border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">Success Stories &amp; Testimonials</h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Live Website Sync
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
                  Add inspirational stories of students achieving top scores, cracking Navodaya selections, or excelling in CBSE/State Boards. Newly added stories will display immediately on the public Success Stories page.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsAddingStory(!isAddingStory)}
                className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20"
              >
                <Plus className="w-4 h-4" />
                <span>{isAddingStory ? 'Cancel' : 'Add New Success Story'}</span>
              </button>
            </div>

            {/* Add Story Form */}
            {isAddingStory && (
              <form onSubmit={handleAddSuccessStory} className="bg-slate-800 rounded-3xl p-6 border border-amber-500/40 space-y-4 shadow-xl">
                <h3 className="font-bold text-white text-base flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Create Student Success Story</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Student Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Aarav Sharma"
                      value={newStoryName}
                      onChange={(e) => setNewStoryName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Score / Rank *</label>
                    <input
                      type="text"
                      placeholder="e.g. 98.4% or AIR 12"
                      value={newStoryScore}
                      onChange={(e) => setNewStoryScore(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Exam / Board</label>
                    <input
                      type="text"
                      placeholder="e.g. CBSE Class 10 (District 1st)"
                      value={newStoryExam}
                      onChange={(e) => setNewStoryExam(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Highlight Badge</label>
                    <input
                      type="text"
                      placeholder="e.g. District Topper"
                      value={newStoryBadge}
                      onChange={(e) => setNewStoryBadge(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">School / Institution</label>
                    <input
                      type="text"
                      placeholder="e.g. De Paul School, Rayagada"
                      value={newStorySchool}
                      onChange={(e) => setNewStorySchool(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Parent's Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rajesh Sharma"
                      value={newStoryParent}
                      onChange={(e) => setNewStoryParent(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Academic Year</label>
                    <input
                      type="text"
                      placeholder="e.g. 2024"
                      value={newStoryYear}
                      onChange={(e) => setNewStoryYear(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                {/* Image Upload or URL */}
                <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-200">
                      Student / Certificate Image (Upload File or Enter URL) *
                    </label>
                    {isUploadingStoryImage && (
                      <span className="text-[11px] text-amber-400 animate-pulse font-semibold flex items-center gap-1">
                        <Upload className="w-3.5 h-3.5 animate-bounce" />
                        <span>Uploading image...</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* File upload input */}
                    <div>
                      <span className="block text-[11px] text-slate-400 mb-1.5">Option A: Upload Image from Device</span>
                      <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-700 hover:border-amber-400/60 rounded-xl cursor-pointer bg-slate-950/60 transition-colors">
                        <Upload className="w-6 h-6 text-amber-400 mb-1" />
                        <span className="text-xs font-semibold text-slate-300">
                          {storyImageFile ? storyImageFile.name : 'Choose image (PNG, JPG, WebP)'}
                        </span>
                        <span className="text-[10px] text-slate-500 mt-0.5">Click to browse local files</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setStoryImageFile(file);
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setStoryImagePreview(reader.result as string);
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>

                    {/* Image URL fallback */}
                    <div>
                      <span className="block text-[11px] text-slate-400 mb-1.5">Option B: Or Enter Image URL</span>
                      <input
                        type="text"
                        placeholder="https://i.ibb.co/..."
                        value={newStoryImage}
                        onChange={(e) => {
                          setNewStoryImage(e.target.value);
                          if (e.target.value) setStoryImagePreview(e.target.value);
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Leave blank to use default high-resolution student portrait
                      </p>
                    </div>
                  </div>

                  {/* Image Preview Banner */}
                  {(storyImagePreview || newStoryImage) && (
                    <div className="flex items-center gap-3 p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                      <img
                        src={storyImagePreview || newStoryImage}
                        alt="Success Story Preview"
                        className="w-14 h-14 rounded-lg object-cover border border-slate-700 shrink-0"
                      />
                      <div className="overflow-hidden">
                        <span className="text-xs font-bold text-emerald-400 block">✓ Image Selected</span>
                        <p className="text-[11px] text-slate-400 truncate">
                          {storyImageFile ? `${storyImageFile.name} (${(storyImageFile.size / 1024).toFixed(1)} KB)` : newStoryImage}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Testimonial Quote / Story *</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Share how the student achieved this score, role of Kumari Institute mentors..."
                    value={newStoryTestimonial}
                    onChange={(e) => setNewStoryTestimonial(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingStory(false);
                      setStoryImageFile(null);
                      setStoryImagePreview('');
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploadingStoryImage}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{isUploadingStoryImage ? 'Uploading & Persisting...' : 'Persist Story in Firestore'}</span>
                  </button>
                </div>
              </form>
            )}

            {/* Stories Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {successStories.map((story) => (
                <div key={story.id} className="bg-slate-800 rounded-3xl p-5 border border-slate-700 flex flex-col justify-between space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={story.image || '/images/defaults/student_rohit.jpg'}
                          alt={story.studentName}
                          className="w-13 h-13 rounded-2xl object-cover border border-slate-700 shrink-0"
                        />
                        <div>
                          <h4 className="font-bold text-white text-base">{story.studentName}</h4>
                          <span className="text-xs font-bold text-amber-400">{story.score}</span>
                          <p className="text-[11px] text-slate-400">{story.exam}</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteSuccessStory(story.id)}
                        className="p-1.5 rounded-xl bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 cursor-pointer transition-colors"
                        title="Delete Story"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
                      "{story.testimonial}"
                    </p>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-700/60 pt-2">
                    <span>{story.school || 'Rayagada'}</span>
                    {story.parentName && <span>Parent: {story.parentName}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB: OFFERS SECTION MANAGER (Stored in Cloud Firestore with auto expiry)
           ========================================================================= */}
        {activeTab === 'offers_manager' && (
          <AdminOffersTab />
        )}



        {/* =========================================================================
            TAB 8: TUTOR REVIEWS & PARENT TRUST TESTIMONIALS (Collection: tutors_reviews)
           ========================================================================= */}
        {(activeTab === 'tutor_reviews' || activeTab === 'tutors_reviews') && (
          <div className="space-y-6">
            {/* Header description banner */}
            <div className="bg-slate-800/80 rounded-3xl p-6 border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white">Tutor Reviews &amp; Parent Trust Ratings</h2>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Direct Firestore Storage
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-slate-400 max-w-2xl">
                  Create and manage authentic parent reviews for verified home tutors. Reviews are persisted directly in the Firestore database and rendered on each tutor's detail page to establish trust with parents in Rayagada.
                </p>
              </div>

              {/* Quick stats pills */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="px-4 py-2 rounded-2xl bg-slate-900 border border-slate-700 text-center">
                  <span className="text-xs text-slate-400 block font-medium">Published Reviews</span>
                  <span className="text-lg font-black text-amber-400">{totalReviewsCount}</span>
                </div>
                <div className="px-4 py-2 rounded-2xl bg-slate-900 border border-slate-700 text-center">
                  <span className="text-xs text-slate-400 block font-medium">Reviewed Tutors</span>
                  <span className="text-lg font-black text-emerald-400">
                    {tutors.filter((t) => t.reviews && t.reviews.length > 0).length}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid Layout: Create Review Form (Left) & Existing Reviews List (Right) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Create & Publish Form */}
              <div className="lg:col-span-5 bg-slate-800/90 rounded-3xl p-6 border border-slate-700 space-y-5 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      <Star className="w-4 h-4 fill-amber-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base">Create Parent Review</h3>
                      <p className="text-[11px] text-slate-400">Published to tutor's profile page &amp; Firestore</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handlePublishReview} className="space-y-4">
                  {/* Select Verified Tutor */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Select Verified Home Tutor <span className="text-amber-400">*</span>
                    </label>
                    <select
                      value={selectedReviewTutorId}
                      onChange={(e) => setSelectedReviewTutorId(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
                    >
                      <option value="">-- Choose a verified tutor --</option>
                      {approvedTutors.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} • {t.qualification} ({t.locationArea || 'Rayagada'})
                        </option>
                      ))}
                    </select>
                    {approvedTutors.length === 0 && (
                      <p className="text-[11px] text-amber-400 mt-1">
                        No verified tutors yet. Please verify a tutor first from the Tutor Verification tab.
                      </p>
                    )}
                  </div>

                  {/* Parent Name & Relation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Parent / Guardian Name <span className="text-amber-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Rajesh Mohanty"
                        value={reviewParentName}
                        onChange={(e) => setReviewParentName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Relation to Student
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Father, Mother, Guardian"
                        value={reviewRelation}
                        onChange={(e) => setReviewRelation(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>

                  {/* Student Grade & School */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        Student Class / Grade
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Class 10 CBSE"
                        value={reviewStudentGrade}
                        onChange={(e) => setReviewStudentGrade(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-300 mb-1.5">
                        School Name
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. DAV Public School Rayagada"
                        value={reviewSchoolName}
                        onChange={(e) => setReviewSchoolName(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </div>
                  </div>

                  {/* Interactive Star Rating Selector */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Rating: <span className="text-amber-400 font-extrabold">{reviewRating} Stars</span>
                    </label>
                    <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-700">
                      {[1, 2, 3, 4, 5].map((starVal) => (
                        <button
                          key={starVal}
                          type="button"
                          onClick={() => setReviewRating(starVal)}
                          className="p-1 hover:scale-110 transition-transform cursor-pointer"
                        >
                          <Star
                            className={`w-6 h-6 ${
                              starVal <= reviewRating
                                ? 'text-amber-400 fill-amber-400'
                                : 'text-slate-600 hover:text-amber-300'
                            }`}
                          />
                        </button>
                      ))}
                      <span className="text-xs text-slate-400 ml-2 font-medium">
                        {reviewRating === 5
                          ? 'Outstanding (5/5)'
                          : reviewRating === 4
                          ? 'Very Good (4/5)'
                          : reviewRating === 3
                          ? 'Good (3/5)'
                          : 'Satisfactory'}
                      </span>
                    </div>
                  </div>

                  {/* Review Testimonial Comment */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1.5">
                      Parent Review &amp; Testimonial <span className="text-amber-400">*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="e.g. Very patient teacher! Helped my son understand fundamental Math concepts clearly and score 94% in term exams..."
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>

                  {/* Verified Booking Checkbox */}
                  <label className="flex items-center gap-2.5 bg-slate-950/60 p-3 rounded-xl border border-slate-700/80 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={reviewVerifiedBooking}
                      onChange={(e) => setReviewVerifiedBooking(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-white block">Verified Parent Booking Badge</span>
                      <span className="text-[11px] text-slate-400">Shows the green 'Verified Booking' trust badge on review card</span>
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={isPublishingReview}
                    className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-amber-500/20 disabled:opacity-60"
                  >
                    {isPublishingReview ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Publishing to Firestore...</span>
                      </>
                    ) : (
                      <>
                        <Star className="w-4 h-4 fill-slate-950" />
                        <span>Publish Review to Firestore &amp; Tutor Page</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Right Column: Existing Reviews List */}
              <div className="lg:col-span-7 space-y-4">
                {/* Search & Filter Header */}
                <div className="bg-slate-800/90 rounded-2xl p-4 border border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Filter className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-white shrink-0">Filter by Tutor:</span>
                    <select
                      value={reviewFilterTutorId}
                      onChange={(e) => setReviewFilterTutorId(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer w-full sm:w-auto"
                    >
                      <option value="all">All Tutors ({totalReviewsCount} reviews)</option>
                      {approvedTutors.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.reviews?.length || 0} reviews)
                        </option>
                      ))}
                    </select>
                  </div>

                  <span className="text-xs text-slate-400 font-medium">
                    Showing{' '}
                    <strong className="text-amber-400">
                      {reviewFilterTutorId === 'all'
                        ? totalReviewsCount
                        : tutors.find((t) => t.id === reviewFilterTutorId)?.reviews?.length || 0}
                    </strong>{' '}
                    reviews
                  </span>
                </div>

                {/* Reviews Cards List */}
                {(() => {
                  const tutorsToShow = reviewFilterTutorId === 'all'
                    ? tutors.filter((t) => t.reviews && t.reviews.length > 0)
                    : tutors.filter((t) => t.id === reviewFilterTutorId && t.reviews && t.reviews.length > 0);

                  const allReviewsList: { tutor: Tutor; review: TutorReview }[] = [];
                  tutorsToShow.forEach((t) => {
                    (t.reviews || []).forEach((r) => {
                      allReviewsList.push({ tutor: t, review: r });
                    });
                  });

                  if (allReviewsList.length === 0) {
                    return (
                      <div className="bg-slate-800/60 rounded-3xl p-12 border border-slate-700 text-center space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-700 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
                          <Star className="w-7 h-7" />
                        </div>
                        <h4 className="text-base font-bold text-white">No Parent Reviews Yet</h4>
                        <p className="text-xs text-slate-400 max-w-sm mx-auto">
                          Use the form on the left to write and publish authentic parent reviews for verified tutors in Rayagada.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      {allReviewsList.map(({ tutor, review }) => (
                        <div
                          key={review.id}
                          className="bg-slate-800/90 rounded-2xl p-5 border border-slate-700/80 hover:border-slate-600 transition-all space-y-3 shadow-lg"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0">
                                {review.parentName.charAt(0)}
                              </div>
                              <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-bold text-sm text-white">{review.parentName}</h4>
                                  {review.relation && (
                                    <span className="text-[11px] text-slate-400">({review.relation})</span>
                                  )}
                                  {review.verifiedBooking && (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                      <span>Verified Booking</span>
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400">
                                  {review.studentGrade} • {review.schoolName} • {review.date}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteReview(tutor.id, review.id)}
                              className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 border border-rose-500/30 transition-colors cursor-pointer shrink-0"
                              title="Delete review from Firestore"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Target Tutor Badge & Stars */}
                          <div className="flex items-center justify-between bg-slate-950/60 px-3.5 py-2 rounded-xl border border-slate-800">
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-slate-400">For Tutor:</span>
                              <span className="text-xs font-bold text-amber-300">{tutor.name}</span>
                              <span className="text-[10px] text-slate-400">({tutor.qualification})</span>
                            </div>

                            <div className="flex items-center gap-1">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3.5 h-3.5 ${
                                    i < review.rating
                                      ? 'text-amber-400 fill-amber-400'
                                      : 'text-slate-700'
                                  }`}
                                />
                              ))}
                              <span className="text-xs font-bold text-white ml-1">{review.rating}.0</span>
                            </div>
                          </div>

                          {/* Review Comment */}
                          <p className="text-xs text-slate-300 leading-relaxed italic bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                            "{review.comment}"
                          </p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            REGISTERED DIRECTORY TAB (ALL REGISTERED PARENTS & TUTORS - Collection: parents)
           ========================================================================= */}
        {(activeTab === 'registered_directory' || activeTab === 'parents') && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Overview & Metrics Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-300 shadow-inner">
                      <Users className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                          Registered Directory
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          Parents &amp; Tutors
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                        Comprehensive registry of all registered families and home educators in Rayagada. Use filters to identify unassigned parents who registered but have not booked any tutors yet, and allocate verified home teachers.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl">
              {/* Primary Role Filter & Search */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Role Tabs */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-slate-400" />
                    Filter User Role:
                  </span>

                  <button
                    type="button"
                    onClick={() => setDirectoryRoleFilter('parents')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      directoryRoleFilter === 'parents'
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Registered Parents ({registeredParents.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDirectoryRoleFilter('tutors')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      directoryRoleFilter === 'tutors'
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                        : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <GraduationCap className="w-3.5 h-3.5" />
                    <span>Registered Tutors ({tutors.length})</span>
                  </button>
                </div>

                {/* Search Input & Refresh */}
                <div className="flex items-center gap-2 flex-1 max-w-md">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by name, child, grade, phone, colony, tutor..."
                      value={directorySearch}
                      onChange={(e) => setDirectorySearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-9 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    {directorySearch && (
                      <button
                        type="button"
                        onClick={() => setDirectorySearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    title="Refresh registered parents from Firestore and server database"
                    onClick={async () => {
                      setIsLoadingParents(true);
                      try {
                        const genuineParents = await fetchAllParentsForAdmin();
                        setRegisteredParents(genuineParents);
                        showToast('info', `Refreshed: ${genuineParents.length} registered parents loaded.`);
                      } catch {
                        showToast('error', 'Could not refresh registered parents.');
                      } finally {
                        setIsLoadingParents(false);
                      }
                    }}
                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingParents ? 'animate-spin text-indigo-400' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Secondary Parent Booking & Assignment Status Filter */}
              {directoryRoleFilter === 'parents' && (
                <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                      Parent Status Filter:
                    </span>

                    <button
                      type="button"
                      onClick={() => setParentAssignmentFilter('all')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        parentAssignmentFilter === 'all'
                          ? 'bg-slate-700 text-white'
                          : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      All Parents ({registeredParents.length})
                    </button>

                    {/* UNASSIGNED PARENTS FILTER */}
                    <button
                      type="button"
                      onClick={() => {
                        setParentAssignmentFilter('unassigned');
                        if (directoryRoleFilter === 'tutors') setDirectoryRoleFilter('parents');
                      }}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
                        parentAssignmentFilter === 'unassigned'
                          ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 ring-2 ring-rose-400 scale-105'
                          : 'bg-rose-950/30 border border-rose-500/50 text-rose-300 hover:bg-rose-900/40 hover:text-white'
                      }`}
                      title="Show parents who registered on Kumari Home Tutors but have NOT booked or been assigned any tutor"
                    >
                      <AlertCircle className="w-3.5 h-3.5 text-rose-300" />
                      <span>Unassigned Parents (No Tutor Booked)</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-500 text-white">
                        {unassignedParentsCount}
                      </span>
                    </button>
                  </div>

                  {parentAssignmentFilter !== 'all' && (
                    <button
                      type="button"
                      onClick={() => setParentAssignmentFilter('all')}
                      className="text-xs text-slate-400 hover:text-amber-400 underline cursor-pointer"
                    >
                      Reset Status Filter
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Active Unassigned Alert Banner */}
            {parentAssignmentFilter === 'unassigned' && (
              <div className="bg-rose-950/40 border border-rose-500/40 rounded-2xl p-4 flex items-start gap-3.5 animate-in fade-in">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 flex items-center justify-center shrink-0 mt-0.5">
                  <AlertCircle className="w-5 h-5 text-rose-400" />
                </div>
                <div className="flex-1 text-xs">
                  <div className="font-bold text-white text-sm flex items-center gap-2">
                    <span>Filtering: Unassigned Parents (No Tutors Booked)</span>
                    <span className="px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                      {filteredRegisteredParents.length} parent{filteredRegisteredParents.length === 1 ? '' : 's'} found
                    </span>
                  </div>
                  <p className="text-slate-300 mt-1 leading-relaxed">
                    These parents registered on the Kumari Home Tutors portal with their student requirements, but haven't booked any teacher or been assigned an educator yet. You can click <strong>"Assign Tutor Now"</strong> on any family card to pair them directly with an approved home educator in their Rayagada locality.
                  </p>
                </div>
              </div>
            )}

            {/* DIRECTORY CONTENT: PARENTS & TUTORS */}
            <div className="space-y-6">
              {/* 1. REGISTERED PARENTS SECTION */}
              {(directoryRoleFilter === 'all' || directoryRoleFilter === 'parents') && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Users className="w-5 h-5 text-indigo-400" />
                      <h3 className="font-black text-white text-base">
                        Registered Parents ({filteredRegisteredParents.length})
                      </h3>
                      {parentAssignmentFilter === 'unassigned' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          Unassigned Filter Active
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500">
                      Showing {filteredRegisteredParents.length} of {registeredParents.length} parents
                    </span>
                  </div>

                  {isLoadingParents ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 text-xs">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400 mb-2" />
                      <span>Loading registered parents directory from database...</span>
                    </div>
                  ) : filteredRegisteredParents.length === 0 ? (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-10 text-center space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                        <Users className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-white">
                        {registeredParents.length === 0 ? 'No Registered Parents Yet' : 'No parents match current filter criteria'}
                      </h4>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        {registeredParents.length === 0
                          ? 'All sample or fake parent entries have been removed. When parents register on the portal or submit student requirements, their genuine profiles will appear here in real time.'
                          : parentAssignmentFilter === 'unassigned'
                          ? 'Great news! There are currently no unassigned parents without tutors. All registered families have either been matched or have pending booking requests.'
                          : 'Try changing your search terms or resetting the assignment status filter.'}
                      </p>
                      {registeredParents.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setParentAssignmentFilter('all');
                            setDirectorySearch('');
                          }}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                        >
                          Reset All Filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {filteredRegisteredParents.map((parent) => {
                        const status = getParentBookingStatus(parent);
                        const matchedBooking = getParentMatchedBooking(parent);
                        const assignedEducator = parent.assignedEducator || (parent.hiredTutors && parent.hiredTutors[0]);

                        return (
                          <div
                            key={parent.uid}
                            className={`rounded-3xl border p-5 transition-all relative overflow-hidden shadow-lg ${
                              status === 'unassigned'
                                ? 'bg-slate-900/90 border-rose-500/40 hover:border-rose-500/70 shadow-rose-950/20'
                                : status === 'assigned'
                                ? 'bg-slate-900/90 border-emerald-500/40 hover:border-emerald-500/60 shadow-emerald-950/20'
                                : 'bg-slate-900/90 border-blue-500/40 hover:border-blue-500/60 shadow-blue-950/20'
                            }`}
                          >
                            {/* Card Top Header */}
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-base font-black border shadow-inner ${
                                    status === 'unassigned'
                                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                      : status === 'assigned'
                                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                      : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                                  }`}
                                >
                                  {parent.name?.charAt(0).toUpperCase() || 'P'}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="text-sm font-black text-white">{parent.name}</h4>
                                    <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                      Parent
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3 text-slate-500" />
                                    <span>{parent.locality || 'Rayagada City'}</span>
                                  </p>
                                </div>
                              </div>

                              {/* Status Badge */}
                              <div>
                                {status === 'unassigned' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 shadow-sm">
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                                    <span>Unassigned • No Tutor Booked</span>
                                  </span>
                                ) : status === 'assigned' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-sm">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Assigned &amp; Active</span>
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1.5 shadow-sm">
                                    <Clock className="w-3.5 h-3.5 text-blue-400" />
                                    <span>Booking Pending</span>
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Student Requirements Box */}
                            <div className="mt-4 bg-slate-950/70 rounded-2xl p-3.5 border border-slate-800 space-y-2">
                              <div className="flex items-center justify-between text-xs gap-2">
                                <span className="text-slate-400 font-medium">Student / Ward:</span>
                                <span className="font-bold text-white text-right">
                                  {parent.childName || parent.studentName || 'Child details registered'}
                                  {(parent.studentAge || parent.childAge) ? ` (${parent.studentAge || parent.childAge} yrs)` : ''}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-800/60">
                                <div>
                                  <span className="text-slate-500 text-[11px] block">Class / Grade:</span>
                                  <span className="font-semibold text-slate-200">
                                    {parent.childGrade || 'Grade not specified'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500 text-[11px] block">School &amp; Board:</span>
                                  <span className="font-semibold text-slate-200 truncate block">
                                    {parent.childSchool
                                      ? `${parent.childSchool} (${parent.childBoard || parent.board || 'CBSE'})`
                                      : parent.childBoard || parent.board || 'CBSE Board'}
                                  </span>
                                </div>
                              </div>
                              {(Array.isArray(parent.subjectsNeeded) && parent.subjectsNeeded.length > 0) || parent.preferredTimeSlot ? (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1.5 border-t border-slate-800/60">
                                  <div>
                                    <span className="text-slate-500 text-[11px] block">Subjects Needed:</span>
                                    <span className="font-semibold text-indigo-300 block">
                                      {Array.isArray(parent.subjectsNeeded) && parent.subjectsNeeded.length > 0
                                        ? parent.subjectsNeeded.join(', ')
                                        : 'All Subjects'}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-500 text-[11px] block">Preferred Time Slot:</span>
                                    <span className="font-semibold text-slate-200 block">
                                      {parent.preferredTimeSlot || parent.timeSlotNeeded || 'Flexible Evening'}
                                    </span>
                                  </div>
                                </div>
                              ) : null}
                              {/* Course & Fee Amount */}
                              <div className="grid grid-cols-2 gap-2 text-xs pt-1.5 border-t border-slate-800/60">
                                <div>
                                  <span className="text-slate-500 text-[11px] block">Course:</span>
                                  <span className="font-semibold text-amber-300 truncate block">
                                    {parent.course || (parent.childGrade ? `${parent.childGrade} Tuition` : 'Home Tuition')}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500 text-[11px] block">Fees Amount:</span>
                                  <span className="font-bold text-emerald-400">
                                    ₹{parent.feesAmount || (parent.bookedTutors && parent.bookedTutors[0]?.fee) || 0} / month
                                  </span>
                                </div>
                              </div>
                              {parent.address && (
                                <div className="text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/60">
                                  <span className="text-slate-500">Address: </span>
                                  <span className="text-slate-300">{parent.address}</span>
                                </div>
                              )}
                              {parent.notes && (
                                <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/60 italic">
                                  Note: {parent.notes}
                                </div>
                              )}
                            </div>

                            {/* Booked Tutors Section */}
                            {Array.isArray(parent.bookedTutors) && parent.bookedTutors.length > 0 && (
                              <div className="mt-3 bg-slate-950/70 rounded-2xl p-3 border border-indigo-500/30 space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
                                  <span className="flex items-center gap-1.5">
                                    <GraduationCap className="w-3.5 h-3.5 text-indigo-400" />
                                    Booked Tutors ({parent.bookedTutors.length})
                                  </span>
                                  <span className="text-[11px] font-semibold text-emerald-400">
                                    ₹{parent.feesAmount || parent.bookedTutors[0]?.fee || parent.bookedTutors[0]?.monthlyFee || 0}/mo
                                  </span>
                                </div>
                                <div className="space-y-1.5 max-h-32 overflow-y-auto">
                                  {parent.bookedTutors.map((bt: any, idx: number) => (
                                    <div
                                      key={bt.id || idx}
                                      className="flex items-center justify-between text-[11px] bg-slate-900/80 px-2.5 py-1.5 rounded-xl border border-slate-800"
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <span className="font-bold text-white truncate">
                                          {bt.tutorName || bt.name || 'Home Tutor'}
                                        </span>
                                        {bt.timing && (
                                          <span className="text-indigo-300 text-[10px] shrink-0">
                                            ⏰ {bt.timing}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <span className="font-bold text-emerald-400">
                                          ₹{bt.fee || bt.monthlyFee || parent.feesAmount || 0}
                                        </span>
                                        <span
                                          className={`px-1.5 py-0.2 rounded-md text-[9px] font-bold ${
                                            bt.status === 'Active' || bt.status === 'accepted'
                                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                          }`}
                                        >
                                          {bt.status || 'Active'}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Contact Details */}
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span className="font-mono">{parent.phone || 'Phone pending'}</span>
                                {parent.phone && (
                                  <a
                                    href={`tel:${parent.phone}`}
                                    className="text-amber-400 hover:underline text-[11px] ml-1"
                                    title="Call parent directly"
                                  >
                                    Call
                                  </a>
                                )}
                                {parent.whatsappNumber && parent.whatsappNumber !== parent.phone && (
                                  <span className="text-[11px] text-emerald-400 font-mono">
                                    • WA: {parent.whatsappNumber}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 truncate">
                                <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                <span className="truncate">{parent.email || 'Email registered'}</span>
                              </div>
                            </div>

                            {/* Assignment Status Summary or Action Box */}
                            <div className="mt-4 pt-3 border-t border-slate-800/80">
                              {status === 'unassigned' ? (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-rose-950/20 p-3 rounded-2xl border border-rose-500/20">
                                  <div className="text-xs text-rose-300">
                                    <span className="font-bold block">⚠️ No Tutor Booked Yet</span>
                                    <span className="text-[11px] text-rose-300/80">
                                      Parent is registered and waiting for an educator allocation.
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDirectAssignParent(parent);
                                      setDirectAssignTutorId(approvedTutors[0]?.id || '');
                                    }}
                                    className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer transition-all shadow-md shrink-0"
                                  >
                                    <UserPlus className="w-4 h-4" />
                                    <span>Assign Tutor Now</span>
                                  </button>
                                </div>
                              ) : status === 'assigned' ? (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-950/20 p-3 rounded-2xl border border-emerald-500/20 text-xs">
                                  <div>
                                    <span className="text-emerald-400 font-bold block flex items-center gap-1.5">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Assigned Tutor: {parent.assignedTutor || assignedEducator?.name || matchedBooking?.assignedTutorName || 'Home Tutor'}
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                      {(parent.assignedTutorPhone || assignedEducator?.phone) ? `Phone: ${parent.assignedTutorPhone || assignedEducator?.phone} • ` : ''}
                                      {(parent.feesAmount || assignedEducator?.monthlyFee) ? `₹${parent.feesAmount || assignedEducator?.monthlyFee}/month • ` : ''}
                                      Active home tuition in progress
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveTab('assigned_tutors');
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold cursor-pointer transition-colors shrink-0"
                                  >
                                    View in Assigned Tab →
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-blue-950/20 p-3 rounded-2xl border border-blue-500/20 text-xs">
                                  <div>
                                    <span className="text-blue-300 font-bold block">
                                      Booking Request Pending for {matchedBooking?.requestedTutorName || 'Tutor'}
                                    </span>
                                    <span className="text-[11px] text-slate-400">
                                      Time Slot: {matchedBooking?.preferredTimeSlot || '5:00 PM - 6:00 PM'}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveTab('incoming_bookings');
                                      setBookingFilter('pending');
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold cursor-pointer transition-colors shrink-0"
                                  >
                                    Review Request →
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 2. REGISTERED TUTORS SECTION */}
              {(directoryRoleFilter === 'all' || directoryRoleFilter === 'tutors') && (
                <div className="space-y-4 pt-6 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <GraduationCap className="w-5 h-5 text-amber-400" />
                      <h3 className="font-black text-white text-base">
                        Registered Home Tutors ({filteredDirectoryTutors.length})
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {approvedTutorsCount} Approved Genuine
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">
                      Showing {filteredDirectoryTutors.length} of {tutors.length} tutors
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredDirectoryTutors.map((tutor) => {
                      return (
                        <div
                          key={tutor.id}
                          className="bg-slate-900 border border-slate-800 rounded-3xl p-5 hover:border-slate-700 transition-all flex flex-col justify-between shadow-lg"
                        >
                          <div className="space-y-3.5">
                            {/* Tutor Header */}
                            <div className="flex items-start gap-3">
                              {tutor.avatar ? (
                                <img
                                  src={tutor.avatar}
                                  alt={tutor.name}
                                  className="w-12 h-12 rounded-2xl object-cover border border-slate-700 shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex items-center justify-center font-bold text-base border border-slate-700 shrink-0">
                                  {tutor.name?.charAt(0) || 'T'}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <h4 className="text-sm font-bold text-white truncate">{tutor.name}</h4>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                      tutor.isApproved || tutor.status === 'approved'
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                        : tutor.status === 'rejected'
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        : !tutor.profileCompleted
                                        ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30'
                                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                                    }`}
                                  >
                                    {tutor.isApproved || tutor.status === 'approved'
                                      ? 'Genuine Approved'
                                      : tutor.status === 'rejected'
                                      ? 'Rejected'
                                      : !tutor.profileCompleted
                                      ? 'Pending Profile Upload'
                                      : 'Submitted • Review'}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-400 truncate mt-0.5">
                                  {tutor.profileCompleted ? (tutor.qualification || 'Profile Submitted') : 'Profile not uploaded yet'}
                                </p>
                                <p className="text-[11px] text-amber-400 font-medium flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3 shrink-0" />
                                  <span className="truncate">
                                    {tutor.profileCompleted ? (tutor.locationArea || 'Address uploaded') : 'Location not submitted'}
                                  </span>
                                </p>
                              </div>
                            </div>

                            {/* Subjects & Rates */}
                            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 space-y-2 text-xs">
                              <div>
                                <span className="text-slate-400 text-[11px] block">Subjects:</span>
                                <span className="text-slate-200 font-semibold line-clamp-1">
                                  {tutor.profileCompleted && tutor.subjects.length > 0
                                    ? tutor.subjects.join(', ')
                                    : 'Pending profile submission'}
                                </span>
                              </div>
                              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                                <span className="text-slate-400 text-[11px]">Monthly Fee:</span>
                                <div className="text-right">
                                  {tutor.profileCompleted && tutor.monthlyFee > 0 ? (
                                    <>
                                      <span className="text-emerald-400 font-bold">₹{tutor.monthlyFee}/mo</span>
                                      <span className="text-[10px] text-slate-400 block">
                                        ₹{tutor.hourlyRate || Math.round(tutor.monthlyFee / 30)}/hr
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-slate-500 text-[11px]">Not set yet</span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 text-[11px]">Contact:</span>
                                <span className="font-mono text-slate-300">{tutor.phone || tutor.email || 'Pending'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Card Footer Actions */}
                          <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-2 mt-4">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTutorForReview(tutor);
                              }}
                              className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-amber-400" />
                              <span>Inspect Credentials &amp; Dossier</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            TUTOR WITHDRAWALS & PAYOUT SETTLEMENTS (Collections: withdrawal_notices & complete_withdrawals)
           ========================================================================= */}
        {(activeTab === 'tutor_withdrawals' || activeTab === 'withdrawal_notices' || activeTab === 'complete_withdrawals') && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Overview & Metrics Banner */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-7 relative overflow-hidden shadow-2xl">
              <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shadow-inner shrink-0">
                    <Wallet className="w-7 h-7 text-emerald-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                        Tutor Withdrawal Requests &amp; Settlements
                      </h2>
                      <span className="px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Rayagada Educator Payouts
                      </span>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
                      Review tutor earnings withdrawal notices, transfer funds directly to their designated UPI or Bank Account, and issue official UTR receipts with payment slips. Upon approval, tutor current balances are automatically debited.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Metrics Cards */}
            {(() => {
              const pendingReqs = mergedWithdrawalsList.filter((r) => r.status === 'pending');
              const approvedReqs = mergedWithdrawalsList.filter((r) => r.status === 'approved');
              const pendingSum = pendingReqs.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
              const approvedSum = approvedReqs.reduce(
                (sum, r) => sum + (Number(r.transferredAmount || r.amount) || 0),
                0
              );

              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                        Pending Payouts
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {pendingReqs.length} Action Required
                      </span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white mt-2">
                      ₹ {pendingSum.toLocaleString('en-IN')}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Awaiting verification &amp; transfer in admin desk
                    </p>
                  </div>

                  <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                        Total Disbursed
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {approvedReqs.length} Settled
                      </span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white mt-2">
                      ₹ {approvedSum.toLocaleString('en-IN')}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Transferred with verified Bank UTR numbers
                    </p>
                  </div>

                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                        Total Notices Logged
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-800 text-slate-300 border border-slate-700">
                        All Time
                      </span>
                    </div>
                    <div className="text-2xl sm:text-3xl font-black text-white mt-2">
                      {mergedWithdrawalsList.length}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Deduplicated withdrawal notices &amp; settlements
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Filter and Search Bar */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setWithdrawalFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    withdrawalFilter === 'all'
                      ? 'bg-slate-800 text-white border border-slate-700'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  All ({mergedWithdrawalsList.length})
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawalFilter('pending')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    withdrawalFilter === 'pending'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'text-amber-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  Pending ({mergedWithdrawalsList.filter((r) => r.status === 'pending').length})
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawalFilter('approved')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    withdrawalFilter === 'approved'
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'text-emerald-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  Approved &amp; Settled ({mergedWithdrawalsList.filter((r) => r.status === 'approved').length})
                </button>
                <button
                  type="button"
                  onClick={() => setWithdrawalFilter('rejected')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    withdrawalFilter === 'rejected'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                      : 'text-rose-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  Rejected ({mergedWithdrawalsList.filter((r) => r.status === 'rejected').length})
                </button>
              </div>

              <div className="relative w-full md:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search tutor, phone, or UTR..."
                  value={withdrawalSearch}
                  onChange={(e) => setWithdrawalSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
            </div>

            {/* Withdrawal Requests List */}
            {(() => {
              const filtered = mergedWithdrawalsList.filter((r) => {
                const matchesStatus = withdrawalFilter === 'all' || r.status === withdrawalFilter;
                const q = withdrawalSearch.toLowerCase().trim();
                const matchesQuery =
                  !q ||
                  r.tutorName?.toLowerCase().includes(q) ||
                  r.tutorPhone?.toLowerCase().includes(q) ||
                  r.tutorEmail?.toLowerCase().includes(q) ||
                  r.id?.toLowerCase().includes(q) ||
                  r.utrNumber?.toLowerCase().includes(q) ||
                  r.upiId?.toLowerCase().includes(q) ||
                  r.bankDetails?.accountNumber?.toLowerCase().includes(q);
                return matchesStatus && matchesQuery;
              });

              if (filtered.length === 0) {
                return (
                  <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-3xl space-y-3">
                    <Wallet className="w-12 h-12 text-slate-600 mx-auto" />
                    <h3 className="text-base font-bold text-slate-300">
                      No Withdrawal Notices Found
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto">
                      {withdrawalSearch || withdrawalFilter !== 'all'
                        ? 'Try clearing the search query or changing the status filter.'
                        : 'When tutors earn verified 80% shares from paid parent fees and submit a withdrawal notice, it will appear here for secure verification and transfer.'}
                    </p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 gap-4">
                  {filtered.map((req) => {
                    const isPending = req.status === 'pending';
                    const isApproved = req.status === 'approved';
                    const { assignedStudents: tutorAssignedStudents, tutorRates } =
                      getAssignedStudentsAndRatesForWithdrawal(req);
                    const ledger = calculateTutorVerifiedLedger(
                      {
                        tutorId: req.tutorId,
                        tutorEmail: req.tutorEmail,
                        tutorPhone: req.tutorPhone,
                        tutorName: req.tutorName
                      },
                      receivedFeesList,
                      mergedWithdrawalsList,
                      req.id,
                      tutorAssignedStudents,
                      tutorRates
                    );
                    const exceedsVerifiedBalance = isPending && req.amount > ledger.availableBalance;

                    return (
                      <div
                        key={req.id}
                        className={`bg-slate-900 border rounded-3xl p-5 sm:p-6 transition-all shadow-xl ${
                          isPending
                            ? 'border-amber-500/40 hover:border-amber-400'
                            : isApproved
                            ? 'border-emerald-500/30'
                            : 'border-slate-800'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-base shrink-0 ${
                                isPending
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : isApproved
                                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                  : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              }`}
                            >
                              <IndianRupee className="w-6 h-6" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-base font-bold text-white">
                                  {req.tutorName}
                                </h3>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                    isPending
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
                                      : isApproved
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                  }`}
                                >
                                  {req.status === 'pending'
                                    ? 'Pending Transfer'
                                    : req.status === 'approved'
                                    ? 'Transferred & Settled'
                                    : 'Declined'}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 flex-wrap">
                                <span>Ref: <strong className="text-slate-300 font-mono">{req.id}</strong></span>
                                <span>•</span>
                                <span>
                                  Date:{' '}
                                  {new Date(req.createdAt).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between lg:justify-end gap-5">
                            <div className="text-left lg:text-right">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                Requested Amount
                              </span>
                              <span className="text-2xl font-black text-emerald-400">
                                ₹ {req.amount.toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Middle Section: Destination Accounts & Transfer Info */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4 text-xs">
                          {/* Left: Target Account Details */}
                          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <Landmark className="w-3.5 h-3.5 text-blue-400" />
                              <span>Destination Payment Method: {req.paymentMethod === 'upi' ? 'Direct UPI' : 'Bank Account (NEFT/IMPS)'}</span>
                            </span>

                            {req.paymentMethod === 'upi' ? (
                              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 border border-slate-800 mt-1">
                                <div>
                                  <span className="text-[10px] text-slate-400 block">UPI Virtual Payment Address</span>
                                  <span className="font-mono font-bold text-emerald-300 text-sm">{req.upiId}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (req.upiId) navigator.clipboard.writeText(req.upiId);
                                    showToast('success', 'UPI ID copied to clipboard!');
                                  }}
                                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Copy className="w-3 h-3" />
                                  <span>Copy</span>
                                </button>
                              </div>
                            ) : req.bankDetails ? (
                              <div className="space-y-1.5 pt-1">
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Bank Name:</span>
                                  <span className="font-semibold text-white">{req.bankDetails.bankName}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400">Account No:</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-emerald-300">{req.bankDetails.accountNumber}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(req.bankDetails!.accountNumber);
                                        showToast('success', 'Account number copied!');
                                      }}
                                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                                      title="Copy Account Number"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-400">IFSC Code:</span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono font-bold text-amber-300">{req.bankDetails.ifscCode}</span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        navigator.clipboard.writeText(req.bankDetails!.ifscCode);
                                        showToast('success', 'IFSC Code copied!');
                                      }}
                                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                                      title="Copy IFSC"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Account Holder:</span>
                                  <span className="font-semibold text-white">{req.bankDetails.accountHolder}</span>
                                </div>
                              </div>
                            ) : null}

                            {req.notes && (
                              <p className="text-[11px] text-slate-400 italic pt-1">
                                Tutor Note: "{req.notes}"
                              </p>
                            )}
                          </div>

                          {/* Right: Contact & Verification Status */}
                          <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Educator Contact &amp; Settlement Info</span>
                            </span>

                            <div className="space-y-1.5 pt-1">
                              <div className="flex justify-between">
                                <span className="text-slate-400">Tutor Mobile:</span>
                                <a
                                  href={`tel:${req.tutorPhone}`}
                                  className="text-amber-300 font-semibold hover:underline flex items-center gap-1"
                                >
                                  <Phone className="w-3 h-3" />
                                  <span>{req.tutorPhone || 'Not provided'}</span>
                                </a>
                              </div>
                              {req.tutorEmail && (
                                <div className="flex justify-between">
                                  <span className="text-slate-400">Email:</span>
                                  <span className="text-slate-300">{req.tutorEmail}</span>
                                </div>
                              )}

                              {isApproved && (
                                <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 space-y-1 mt-2">
                                  <div className="flex justify-between items-center">
                                    <span className="text-[11px] text-emerald-300 font-bold">Bank UTR / Reference:</span>
                                    <span className="font-mono font-black text-xs text-emerald-200">{req.utrNumber}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-slate-400">Disbursed Amount:</span>
                                    <span className="font-bold text-white">₹ {(req.transferredAmount || req.amount).toLocaleString('en-IN')}</span>
                                  </div>
                                  <div className="flex justify-between items-center text-[11px]">
                                    <span className="text-slate-400">Mode:</span>
                                    <span className="text-slate-300">{req.transferMethod}</span>
                                  </div>
                                  {req.approvedBy && (
                                    <div className="flex justify-between items-center text-[11px]">
                                      <span className="text-slate-400">Verified By:</span>
                                      <span className="text-emerald-300">{req.approvedBy}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Verified Tutor Financial Ledger Check (30-Day Completed Cycles & Paid Fees) */}
                        <div className={`mb-4 p-3.5 rounded-2xl border text-xs ${
                          exceedsVerifiedBalance
                            ? 'bg-rose-950/30 border-rose-500/40'
                            : 'bg-slate-950/80 border-slate-800'
                        }`}>
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Live Ledger Verification (30-Day Completed Cycles &amp; Fees • 80% / 20% Split)</span>
                            </span>
                            {isPending && (
                              exceedsVerifiedBalance ? (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                                  ⚠ Exceeds Verified Balance
                                </span>
                              ) : (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                  ✓ Verified Within Balance
                                </span>
                              )
                            )}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                            <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                              <span className="text-[10px] text-slate-400 block">Matured Cycle Fees</span>
                              <span className="font-bold text-white font-mono">
                                ₹{ledger.totalVerifiedGrossPaid.toLocaleString('en-IN')} ({ledger.maturedStudentsCount} std)
                              </span>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                              <span className="text-[10px] text-slate-400 block">80% Tutor Share</span>
                              <span className="font-bold text-emerald-300 font-mono">
                                ₹{ledger.totalEarnedTutorShare.toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                              <span className="text-[10px] text-slate-400 block">20% Institute Fee</span>
                              <span className="font-bold text-blue-300 font-mono">
                                ₹{ledger.totalPlatformFeePaid.toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
                              <span className="text-[10px] text-slate-400 block">Already Disbursed</span>
                              <span className="font-bold text-slate-200 font-mono">
                                ₹{ledger.totalApprovedWithdrawn.toLocaleString('en-IN')}
                              </span>
                            </div>
                            <div className="p-2 rounded-xl bg-slate-900/90 border border-emerald-500/30">
                              <span className="text-[10px] text-slate-400 block">Available Balance</span>
                              <span className={`font-black font-mono ${
                                exceedsVerifiedBalance ? 'text-rose-400' : 'text-emerald-400'
                              }`}>
                                ₹{ledger.availableBalance.toLocaleString('en-IN')}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-xs text-slate-400">
                            {isPending
                              ? 'Transfer funds via Bank/UPI app, then click "Process & Record Transfer".'
                              : isApproved
                              ? 'Disbursement completed and reflected in tutor transaction history.'
                              : 'This request was rejected.'}
                          </span>

                          <div className="flex items-center gap-2.5">
                            {isPending && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmDialog({
                                      title: 'Reject Withdrawal Request?',
                                      message: `Decline withdrawal request of ₹${req.amount} for ${req.tutorName}?`,
                                      confirmLabel: 'Reject Request',
                                      variant: 'danger',
                                      onConfirm: async () => {
                                        await adminRejectWithdrawal(req.id, 'Declined by Administrator');
                                        showToast('info', 'Withdrawal request rejected.');
                                      }
                                    });
                                  }}
                                  className="px-3.5 py-2 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs font-bold transition-colors cursor-pointer"
                                >
                                  Reject Request
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedWithdrawalForTransfer(req);
                                    setTransferAmount(req.amount.toString());
                                    setTransferMethod(req.paymentMethod === 'upi' ? 'UPI Transfer' : 'IMPS Bank Transfer');
                                    setTransferUtr('');
                                    setTransferSlipUrl('');
                                    setTransferAdminNote('');
                                    setTransferError(null);
                                  }}
                                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition-all cursor-pointer shadow-md shadow-emerald-600/30 flex items-center gap-2 active:scale-95"
                                >
                                  <Check className="w-4 h-4 stroke-[3]" />
                                  <span>Process &amp; Record Transfer</span>
                                </button>
                              </>
                            )}

                            {isApproved && (
                              <button
                                type="button"
                                onClick={() => setViewingWithdrawalReceipt(req)}
                                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2 border border-slate-700"
                              >
                                <Receipt className="w-4 h-4 text-emerald-400" />
                                <span>View Voucher &amp; UTR Slip</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </main>
      </div>

      {/* =========================================================================
          DETAILED TUTOR CERTIFICATE & PROFILE PREVIEW MODAL
         ========================================================================= */}
      {selectedTutorForReview && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setSelectedTutorForReview(null)}
        >
          <div className="bg-slate-900 rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-700 overflow-hidden relative my-6 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="bg-slate-950 p-6 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3.5">
                {selectedTutorForReview.avatar ? (
                  <img
                    src={selectedTutorForReview.avatar}
                    alt={selectedTutorForReview.name}
                    className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-500/40 shrink-0"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-slate-800 text-amber-300 flex items-center justify-center font-black text-xl border-2 border-amber-500/40 shrink-0">
                    {selectedTutorForReview.name?.charAt(0)?.toUpperCase() || 'T'}
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-white text-lg">{selectedTutorForReview.name}</h3>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                        selectedTutorForReview.profileCompleted
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                      }`}
                    >
                      {selectedTutorForReview.profileCompleted
                        ? selectedTutorForReview.qualification || 'Profile Submitted'
                        : 'Pending Profile Submission'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedTutorForReview.profileCompleted ? (
                      <>
                        {selectedTutorForReview.experienceYears}+ Yrs Exp •{' '}
                        {selectedTutorForReview.locationArea || 'Address Uploaded'} •{' '}
                        <span className="text-emerald-400 font-bold">
                          {selectedTutorForReview.monthlyFee > 0
                            ? `₹${selectedTutorForReview.monthlyFee}/month`
                            : 'Fee not set'}
                        </span>
                      </>
                    ) : (
                      <span>
                        Tutor account active ({selectedTutorForReview.email || selectedTutorForReview.phone || 'Logged in'}) • Has not submitted complete profile yet
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTutorForReview(null)}
                aria-label="Close"
                className="w-9 h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
              {!selectedTutorForReview.profileCompleted && (
                <div className="p-4 bg-orange-950/60 border border-orange-500/40 rounded-2xl text-orange-200 text-xs flex items-start gap-3">
                  <Clock className="w-5 h-5 text-orange-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-orange-300 text-sm">
                      Tutor Still Pending at Profile Submission
                    </p>
                    <p className="text-slate-300 leading-relaxed">
                      This tutor has logged in / registered, but has <strong>not yet uploaded their full details, residential address, live GPS location, fee schedule, or academic certificates</strong>. As soon as the tutor submits the profile completion form, all details and certificate previews will populate here dynamically in real time.
                    </p>
                  </div>
                </div>
              )}

              {verifyNotice && (
                <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 rounded-2xl text-emerald-200 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>{verifyNotice}</span>
                </div>
              )}

              {/* 1. Official Document Previews (10th, 12th, Degree, Aadhaar) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400" />
                    <span>Uploaded Certificates &amp; ID Proofs</span>
                  </h4>
                  <span className="text-xs text-slate-400">
                    {selectedTutorForReview.profileCompleted
                      ? 'Click any uploaded document to inspect full-size'
                      : 'Awaiting tutor profile submission'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* 10th Class Marksheet */}
                  <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-amber-400">10th Marksheet</span>
                      <span className={`text-[10px] font-mono ${selectedTutorForReview.certificates?.tenth?.score ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {selectedTutorForReview.certificates?.tenth?.score || 'Not uploaded'}
                      </span>
                    </div>

                    <div
                      onClick={() => {
                        if (!selectedTutorForReview.certificates?.tenth?.url) return;
                        setPreviewCertDoc({
                          title: '10th Class High School Certificate & Marksheet',
                          url: selectedTutorForReview.certificates.tenth.url,
                          details: `Board: ${selectedTutorForReview.certificates?.tenth?.board || 'Submitted'} • Year: ${selectedTutorForReview.certificates?.tenth?.year || '—'} • Score: ${selectedTutorForReview.certificates?.tenth?.score || '—'}`
                        });
                      }}
                      className={`aspect-3/4 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/80 relative group flex items-center justify-center p-1 ${
                        selectedTutorForReview.certificates?.tenth?.url ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      {selectedTutorForReview.certificates?.tenth?.url ? (
                        <>
                          <img
                            src={selectedTutorForReview.certificates.tenth.url}
                            alt="10th Marksheet"
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="px-2 py-1 bg-amber-500 text-slate-950 text-[10px] font-black rounded-lg flex items-center gap-1 shadow-md">
                              <ZoomIn className="w-3 h-3" />
                              <span>Inspect</span>
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-1 text-center px-2">
                          <FileText className="w-6 h-6 text-slate-600" />
                          <span className="text-[10px]">Not uploaded yet</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">
                      {selectedTutorForReview.certificates?.tenth?.board || 'Board not uploaded'}
                    </p>
                  </div>

                  {/* 12th Class Marksheet */}
                  <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-amber-400">+2 / 12th Marksheet</span>
                      <span className={`text-[10px] font-mono ${selectedTutorForReview.certificates?.twelfth?.score ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {selectedTutorForReview.certificates?.twelfth?.score || 'Not uploaded'}
                      </span>
                    </div>

                    <div
                      onClick={() => {
                        if (!selectedTutorForReview.certificates?.twelfth?.url) return;
                        setPreviewCertDoc({
                          title: '+2 Higher Secondary Examination Marksheet',
                          url: selectedTutorForReview.certificates.twelfth.url,
                          details: `Board: ${selectedTutorForReview.certificates?.twelfth?.board || 'Submitted'} • Year: ${selectedTutorForReview.certificates?.twelfth?.year || '—'} • Score: ${selectedTutorForReview.certificates?.twelfth?.score || '—'}`
                        });
                      }}
                      className={`aspect-3/4 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/80 relative group flex items-center justify-center p-1 ${
                        selectedTutorForReview.certificates?.twelfth?.url ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      {selectedTutorForReview.certificates?.twelfth?.url ? (
                        <>
                          <img
                            src={selectedTutorForReview.certificates.twelfth.url}
                            alt="12th Marksheet"
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="px-2 py-1 bg-amber-500 text-slate-950 text-[10px] font-black rounded-lg flex items-center gap-1 shadow-md">
                              <ZoomIn className="w-3 h-3" />
                              <span>Inspect</span>
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-1 text-center px-2">
                          <FileText className="w-6 h-6 text-slate-600" />
                          <span className="text-[10px]">Not uploaded yet</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">
                      {selectedTutorForReview.certificates?.twelfth?.board || 'Board not uploaded'}
                    </p>
                  </div>

                  {/* Degree Certificate */}
                  <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-amber-400">Degree (Optional)</span>
                      <span className={`text-[10px] font-mono ${selectedTutorForReview.certificates?.degree?.score ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {selectedTutorForReview.certificates?.degree?.score || 'Optional'}
                      </span>
                    </div>

                    <div
                      onClick={() => {
                        if (!selectedTutorForReview.certificates?.degree?.url) return;
                        setPreviewCertDoc({
                          title: 'Degree & Graduation Certificate',
                          url: selectedTutorForReview.certificates.degree.url,
                          details: `University: ${selectedTutorForReview.certificates?.degree?.university || 'Submitted'} • Course: ${selectedTutorForReview.certificates?.degree?.course || selectedTutorForReview.qualification || '—'}`
                        });
                      }}
                      className={`aspect-3/4 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/80 relative group flex items-center justify-center p-1 ${
                        selectedTutorForReview.certificates?.degree?.url ? 'cursor-pointer' : 'cursor-default'
                      }`}
                    >
                      {selectedTutorForReview.certificates?.degree?.url ? (
                        <>
                          <img
                            src={selectedTutorForReview.certificates.degree.url}
                            alt="Degree Certificate"
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="px-2 py-1 bg-amber-500 text-slate-950 text-[10px] font-black rounded-lg flex items-center gap-1 shadow-md">
                              <ZoomIn className="w-3 h-3" />
                              <span>Inspect</span>
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-1 text-center px-2">
                          <FileText className="w-6 h-6 text-slate-600" />
                          <span className="text-[10px]">Not uploaded</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 truncate">
                      {selectedTutorForReview.certificates?.degree?.university || 'Not provided (Optional)'}
                    </p>
                  </div>

                  {/* Aadhaar Card ID */}
                  <div className="bg-slate-950 rounded-2xl p-3 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-bold text-blue-400">Aadhaar ID Proof</span>
                      <span className="text-[10px] text-slate-400">Govt ID</span>
                    </div>

                    <div
                      onClick={() => {
                        const aadhaarUrl = selectedTutorForReview.certificates?.idProof?.url || selectedTutorForReview.aadhaarDocUrl;
                        if (!aadhaarUrl) return;
                        setPreviewCertDoc({
                          title: 'Government Identity Verification (Aadhaar Card)',
                          url: aadhaarUrl,
                          details: `Aadhaar Number: ${selectedTutorForReview.aadhaarNumber || 'Submitted'} • Address: ${selectedTutorForReview.locationArea || 'Submitted'}`
                        });
                      }}
                      className={`aspect-3/4 rounded-xl overflow-hidden bg-slate-900 border border-slate-700/80 relative group flex items-center justify-center p-1 ${
                        selectedTutorForReview.certificates?.idProof?.url || selectedTutorForReview.aadhaarDocUrl
                          ? 'cursor-pointer'
                          : 'cursor-default'
                      }`}
                    >
                      {selectedTutorForReview.certificates?.idProof?.url || selectedTutorForReview.aadhaarDocUrl ? (
                        <>
                          <img
                            src={selectedTutorForReview.certificates?.idProof?.url || selectedTutorForReview.aadhaarDocUrl}
                            alt="Aadhaar Card"
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="px-2 py-1 bg-blue-500 text-white text-[10px] font-black rounded-lg flex items-center gap-1 shadow-md">
                              <ZoomIn className="w-3 h-3" />
                              <span>Inspect</span>
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 gap-1 text-center px-2">
                          <FileText className="w-6 h-6 text-slate-600" />
                          <span className="text-[10px]">Not uploaded yet</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono truncate">
                      UID: {selectedTutorForReview.aadhaarNumber || 'Not uploaded yet'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 2. Personal & Teaching Dossier */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Academic & Teaching Summary */}
                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider">Teaching Credentials</h5>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Subjects Offered:</span>
                      <span className="font-semibold text-slate-200">
                        {selectedTutorForReview.subjects.length > 0
                          ? selectedTutorForReview.subjects.join(', ')
                          : 'Not uploaded yet'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Classes Handled:</span>
                      <span className="font-semibold text-slate-200">
                        {selectedTutorForReview.classesHandled.length > 0
                          ? selectedTutorForReview.classesHandled.join(', ')
                          : 'Not uploaded yet'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Tuition Mode:</span>
                      <span className="font-semibold text-emerald-400">Home Tutor (Dedicated 1-on-1 at Student Home)</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Available Slots:</span>
                      <span className="text-slate-300">
                        {selectedTutorForReview.availableTimeSlots && selectedTutorForReview.availableTimeSlots.length > 0
                          ? selectedTutorForReview.availableTimeSlots.join(', ')
                          : 'Not selected yet'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Location & Coordinates */}
                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider">GPS &amp; Residence Location</h5>
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Full Residential Address:</span>
                      <span className="font-medium text-slate-200">
                        {selectedTutorForReview.addressSnippet ||
                          selectedTutorForReview.locationArea ||
                          'Address not uploaded yet'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Live GPS Coordinates:</span>
                      {selectedTutorForReview.latitude && selectedTutorForReview.longitude ? (
                        <span className="font-mono text-emerald-300">
                          {selectedTutorForReview.latitude.toFixed(4)}° N, {selectedTutorForReview.longitude.toFixed(4)}° E
                        </span>
                      ) : (
                        <span className="text-orange-300 font-medium">Live location not captured yet</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Phone / WhatsApp:</span>
                      <span className="font-mono font-bold text-slate-200">
                        {selectedTutorForReview.phone || 'Not provided'}
                        {selectedTutorForReview.altNumber ? ` / Alt: ${selectedTutorForReview.altNumber}` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Email:</span>
                      <span className="text-slate-300 truncate block">
                        {selectedTutorForReview.email || 'Not provided'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Family & Personal Verification Details */}
              {(selectedTutorForReview.dob ||
                selectedTutorForReview.fatherName ||
                selectedTutorForReview.motherName) && (
                <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
                  <h5 className="text-xs font-bold text-white uppercase tracking-wider">Personal &amp; Family Verification</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Date of Birth:</span>
                      <span className="font-semibold text-slate-200">{selectedTutorForReview.dob || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Father&apos;s Name &amp; Mobile:</span>
                      <span className="font-semibold text-slate-200">
                        {selectedTutorForReview.fatherName || '—'}
                        {selectedTutorForReview.fatherMobile ? ` (${selectedTutorForReview.fatherMobile})` : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Mother&apos;s Name &amp; Mobile:</span>
                      <span className="font-semibold text-slate-200">
                        {selectedTutorForReview.motherName || '—'}
                        {selectedTutorForReview.motherMobile ? ` (${selectedTutorForReview.motherMobile})` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Bio & Teaching Highlights */}
              <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-2">
                <h5 className="text-xs font-bold text-white uppercase tracking-wider">Teacher Biography</h5>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedTutorForReview.bio || 'Bio not uploaded yet (pending profile submission).'}
                </p>
              </div>

              {/* Structured Monthly Fee Schedule Preview (Admin Review) */}
              {selectedTutorForReview.feeStructure && (() => {
                const fs = selectedTutorForReview.feeStructure;
                const rows1to10 = (['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'] as const).filter((c) => {
                  const r = fs.classes1to10?.[c];
                  return (r?.cbse && r.cbse > 0) || (r?.icse && r.icse > 0);
                });
                const rows11 = (
                  Object.entries(fs.classes11to12?.['11th'] || {}) as [
                    string,
                    { cbse?: number; icse?: number }
                  ][]
                ).filter(([, v]) => (v?.cbse && v.cbse > 0) || (v?.icse && v.icse > 0));
                const rows12 = (
                  Object.entries(fs.classes11to12?.['12th'] || {}) as [
                    string,
                    { cbse?: number; icse?: number }
                  ][]
                ).filter(([, v]) => (v?.cbse && v.cbse > 0) || (v?.icse && v.icse > 0));
                if (rows1to10.length === 0 && rows11.length === 0 && rows12.length === 0) return null;

                return (
                  <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
                    <h5 className="text-xs font-bold text-white uppercase tracking-wider">Structured Fee Schedule (CBSE / ICSE)</h5>
                    {rows1to10.length > 0 && (
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {rows1to10.map((c) => {
                          const r = fs.classes1to10[c];
                          return (
                            <div key={c} className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px]">
                              <div className="font-bold text-amber-300">{c} Class</div>
                              <div className="text-slate-300 font-mono tabular-nums">CBSE: {r?.cbse ? `₹${r.cbse}` : '—'}</div>
                              <div className="text-slate-300 font-mono tabular-nums">ICSE: {r?.icse ? `₹${r.icse}` : '—'}</div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {(rows11.length > 0 || rows12.length > 0) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          { label: '11th Class', rows: rows11 },
                          { label: '12th Class', rows: rows12 }
                        ].map(
                          ({ label, rows }) =>
                            rows.length > 0 && (
                              <div key={label} className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-[11px]">
                                <div className="font-bold text-blue-300">{label}</div>
                                {rows.map(([sub, v]) => (
                                  <div key={sub} className="flex justify-between text-slate-300 font-mono tabular-nums">
                                    <span className="font-sans text-slate-200">{sub}:</span>
                                    <span>
                                      CBSE {v?.cbse ? `₹${v.cbse}` : '—'} / ICSE {v?.icse ? `₹${v.icse}` : '—'}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Modal Actions */}
            <div className="bg-slate-950 p-5 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Current Status:</span>
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      selectedTutorForReview.isApproved
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : selectedTutorForReview.status === 'rejected'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : !selectedTutorForReview.profileCompleted
                        ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                        : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                    }`}
                  >
                    {selectedTutorForReview.isApproved
                      ? 'Genuine Tutor (Approved)'
                      : selectedTutorForReview.status === 'rejected'
                      ? 'Rejected'
                      : !selectedTutorForReview.profileCompleted
                      ? 'Pending Profile Submission'
                      : 'Profile Submitted • Pending Review'}
                  </span>
                </div>

                {/* Direct Visibility Toggle on 'Find Home Tutor' page */}
                <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
                  <span className="text-xs text-slate-400">Find Tutor Page:</span>
                  <button
                    type="button"
                    disabled={isVerifying || (!selectedTutorForReview.verified && !selectedTutorForReview.profileCompleted)}
                    onClick={() => handleToggleVisibility(selectedTutorForReview)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors border ${
                      !selectedTutorForReview.verified && !selectedTutorForReview.profileCompleted
                        ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                        : selectedTutorForReview.verified
                        ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60 cursor-pointer'
                        : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700 cursor-pointer'
                    }`}
                    title={
                      !selectedTutorForReview.verified && !selectedTutorForReview.profileCompleted
                        ? 'Tutor must complete profile submission first'
                        : 'Toggle public visibility on Find Home Tutor page'
                    }
                  >
                    {selectedTutorForReview.verified ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Visible to Parents</span>
                      </>
                    ) : (
                      <>
                        <Ban className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {!selectedTutorForReview.profileCompleted ? 'Awaiting Upload' : 'Hidden (Unverified)'}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {selectedTutorForReview.isApproved && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedReviewTutorId(selectedTutorForReview.id);
                      setActiveTab('tutor_reviews');
                      setSelectedTutorForReview(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors shadow-md"
                  >
                    <Star className="w-3.5 h-3.5 fill-slate-950" />
                    <span>Create Parent Review</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={() => handleVerifyTutor(selectedTutorForReview, 'rejected')}
                  className="px-4 py-2.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>Reject in Firestore</span>
                </button>

                <button
                  type="button"
                  disabled={isVerifying || !selectedTutorForReview.profileCompleted}
                  onClick={() => handleVerifyTutor(selectedTutorForReview, 'approved')}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                    !selectedTutorForReview.profileCompleted
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-lg shadow-emerald-600/20'
                  }`}
                  title={
                    !selectedTutorForReview.profileCompleted
                      ? 'Tutor must submit complete profile & certificates before approval'
                      : 'Approve and verify this tutor in Firestore'
                  }
                >
                  {isVerifying && verifyingTutorId === selectedTutorForReview.id ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>
                    {selectedTutorForReview.profileCompleted ? 'Approve in Firestore' : 'Awaiting Profile Submission'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          LIGHTBOX FOR CERTIFICATE FULL PREVIEW
         ========================================================================= */}
      {previewCertDoc && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
          onClick={() => setPreviewCertDoc(null)}
        >
          <div
            className="bg-slate-900 rounded-3xl max-w-3xl w-full border border-slate-700 shadow-2xl overflow-hidden relative my-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-sm sm:text-base">{previewCertDoc.title}</h4>
                {previewCertDoc.details && <p className="text-xs text-slate-400">{previewCertDoc.details}</p>}
              </div>
              <button
                type="button"
                onClick={() => setPreviewCertDoc(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-[75vh] overflow-auto flex items-center justify-center bg-slate-950">
              {previewCertDoc.url ? (
                <img
                  src={previewCertDoc.url}
                  alt={previewCertDoc.title}
                  className="max-h-[70vh] w-auto object-contain rounded-xl border border-slate-800 shadow-2xl"
                />
              ) : (
                <div className="p-10 text-center text-slate-400 text-sm">
                  Document has not been uploaded by the tutor yet.
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Official Academic &amp; Verification Document</span>
              {previewCertDoc.url && (
                <a
                  href={previewCertDoc.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-400 font-bold hover:underline flex items-center gap-1"
                >
                  <span>Open in New Tab</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          RE-ASSIGN TUTOR MODAL (Admin assigns new tutor to parent)
         ========================================================================= */}
      {reassignModalBooking && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
          onClick={(e) => e.target === e.currentTarget && setReassignModalBooking(null)}
        >
          <div className="bg-slate-900 rounded-3xl max-w-xl w-full border border-slate-700 shadow-2xl p-6 space-y-5 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-white text-base">Assign Home Tutor to Parent</h3>
                <p className="text-xs text-slate-400">
                  Student: <span className="text-white font-semibold">{reassignModalBooking.studentName}</span> ({reassignModalBooking.studentGrade})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReassignModalBooking(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300">
                Select Approved Genuine Home Tutor:
              </label>
              <select
                value={selectedReassignTutorId}
                onChange={(e) => setSelectedReassignTutorId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                {approvedTutors.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} • {t.qualification} • ₹{t.monthlyFee}/mo ({t.locationArea || 'Rayagada'})
                  </option>
                ))}
              </select>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Assignment Note / Confirmation Message for Parent:
                </label>
                <textarea
                  rows={2}
                  value={reassignNotes}
                  onChange={(e) => setReassignNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setReassignModalBooking(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isAssigning}
                onClick={handleConfirmReassignment}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer shadow-md"
              >
                Confirm Tutor Assignment
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DECLINE BOOKING MODAL (Admin declines parent booking request with reason)
         ========================================================================= */}
      {declineModalBooking && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
          onClick={(e) => e.target === e.currentTarget && setDeclineModalBooking(null)}
        >
          <div className="bg-slate-900 rounded-3xl max-w-xl w-full border border-rose-500/40 shadow-2xl p-6 space-y-5 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-rose-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Decline Booking Request</h3>
                  <p className="text-xs text-slate-400">
                    Parent request for student{' '}
                    <span className="text-white font-semibold">{declineModalBooking.studentName}</span> ({declineModalBooking.studentGrade})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeclineModalBooking(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Request Summary */}
            <div className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Requested Tutor:</span>
                <span className="font-bold text-white">{declineModalBooking.requestedTutorName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Parent &amp; Contact:</span>
                <span className="font-medium text-slate-200">
                  {declineModalBooking.parentName} ({declineModalBooking.parentPhone})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Class &amp; Location:</span>
                <span className="text-slate-300 truncate max-w-xs">
                  {declineModalBooking.studentGrade} • {declineModalBooking.address}
                </span>
              </div>
            </div>

            {/* Select Decline Reason */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-300">
                Select Reason for Declining:
              </label>
              <div className="space-y-2">
                {[
                  'Selected time slot is already fully occupied.',
                  'Tutor is currently not accepting new home tuition students in this area.',
                  'Location is outside tutor daily travel perimeter in Rayagada.',
                  'Subject or syllabus requirement mismatch with current availability.',
                  'Custom / Other Reason'
                ].map((reasonOption) => (
                  <label
                    key={reasonOption}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      declineReason === reasonOption
                        ? 'bg-rose-950/40 border-rose-500/50 text-white font-medium'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800/60'
                    }`}
                  >
                    <input
                      type="radio"
                      name="declineReason"
                      value={reasonOption}
                      checked={declineReason === reasonOption}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      className="mt-0.5 text-rose-500 focus:ring-rose-400 cursor-pointer"
                    />
                    <span>{reasonOption}</span>
                  </label>
                ))}
              </div>

              {declineReason === 'Custom / Other Reason' && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Specify Custom Decline Reason / Notes:
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter reason to be recorded for this booking..."
                    value={customDeclineReason}
                    onChange={(e) => setCustomDeclineReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeclineModalBooking(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeclining}
                onClick={handleConfirmDecline}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-rose-600/20"
              >
                <Ban className="w-3.5 h-3.5" />
                <span>{isDeclining ? 'Declining...' : 'Confirm Decline'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          DIRECT TUTOR ASSIGNMENT MODAL (Assign approved tutor to unassigned parent)
         ========================================================================= */}
      {directAssignParent && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
          onClick={(e) => e.target === e.currentTarget && setDirectAssignParent(null)}
        >
          <div className="bg-slate-900 rounded-3xl max-w-xl w-full border border-indigo-500/40 shadow-2xl p-6 space-y-5 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Assign Home Tutor</h3>
                  <p className="text-xs text-slate-400">
                    Pairing educator for <span className="text-white font-semibold">{directAssignParent.name}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDirectAssignParent(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Parent & Student Summary */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Parent Name &amp; Phone:</span>
                <span className="font-bold text-white">
                  {directAssignParent.name} ({directAssignParent.phone || 'No phone'})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Student &amp; Class:</span>
                <span className="font-medium text-slate-200">
                  {directAssignParent.childName || 'Child'} • {directAssignParent.childGrade || 'Primary/Middle School'} ({directAssignParent.childBoard || 'CBSE'})
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Residence Locality:</span>
                <span className="text-amber-300 font-medium">
                  {directAssignParent.locality || 'Rayagada City'}
                </span>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Select Approved Tutor */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Select Approved Home Tutor:
                </label>
                <select
                  value={directAssignTutorId}
                  onChange={(e) => setDirectAssignTutorId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="">-- Choose an approved tutor --</option>
                  {approvedTutors.map((tutor) => (
                    <option key={tutor.id} value={tutor.id}>
                      {tutor.name} • {tutor.qualification} • {tutor.subjects.slice(0, 2).join(', ')} • ₹{tutor.monthlyFee}/mo • ({tutor.locationArea || 'Rayagada'})
                    </option>
                  ))}
                </select>
                {approvedTutors.length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    No approved tutors available. Please verify and approve tutors in the "Tutor Verification" tab first.
                  </p>
                )}
              </div>

              {/* Selected Tutor Preview Box */}
              {(() => {
                const selectedTutor = approvedTutors.find((t) => t.id === directAssignTutorId);
                if (!selectedTutor) return null;
                return (
                  <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-2xl p-3 flex items-center gap-3">
                    {selectedTutor.avatar ? (
                      <img
                        src={selectedTutor.avatar}
                        alt={selectedTutor.name}
                        className="w-10 h-10 rounded-xl object-cover border border-indigo-400/40"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-indigo-900/50 text-indigo-300 flex items-center justify-center font-bold text-xs border border-indigo-400/40 shrink-0">
                        {selectedTutor.name?.charAt(0) || 'T'}
                      </div>
                    )}
                    <div className="text-xs">
                      <div className="font-bold text-white">{selectedTutor.name}</div>
                      <div className="text-[11px] text-indigo-300">
                        {selectedTutor.qualification} • {selectedTutor.locationArea || 'Rayagada'} • ₹{selectedTutor.monthlyFee}/month
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Time Slot Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Daily Teaching Time Slot:
                </label>
                <select
                  value={directAssignSlot}
                  onChange={(e) => setDirectAssignSlot(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="5:00 PM - 6:00 PM">5:00 PM - 6:00 PM (Evening Slot 1)</option>
                  <option value="6:00 PM - 7:00 PM">6:00 PM - 7:00 PM (Evening Slot 2)</option>
                  <option value="7:00 PM - 8:00 PM">7:00 PM - 8:00 PM (Evening Slot 3)</option>
                  <option value="8:00 PM - 9:00 PM">8:00 PM - 9:00 PM (Night Slot)</option>
                  <option value="7:00 AM - 8:00 AM">7:00 AM - 8:00 AM (Morning Slot)</option>
                </select>
              </div>

              {/* Assignment Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Admin Assignment Notes (Optional):
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Focus on CBSE Mathematics & Science, 5 days a week home visit."
                  value={directAssignNotes}
                  onChange={(e) => setDirectAssignNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDirectAssignParent(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDirectAssigning || !directAssignTutorId}
                onClick={handleConfirmDirectAssign}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-indigo-600/30"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{isDirectAssigning ? 'Assigning Tutor...' : 'Confirm Assignment'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CONNECT PARENT TO TUTOR MODAL (Initiated from Tutors Directory)
         ========================================================================= */}
      {connectParentTargetTutor && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in"
          onClick={(e) => e.target === e.currentTarget && setConnectParentTargetTutor(null)}
        >
          <div className="bg-slate-900 rounded-3xl max-w-xl w-full border border-amber-500/40 shadow-2xl p-6 space-y-5 my-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Connect Registered Parent</h3>
                  <p className="text-xs text-slate-400">
                    Pairing parent family with <span className="text-white font-semibold">{connectParentTargetTutor.name}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConnectParentTargetTutor(null)}
                aria-label="Close"
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Tutor Summary */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center gap-3.5">
              {connectParentTargetTutor.avatar ? (
                <img
                  src={connectParentTargetTutor.avatar}
                  alt={connectParentTargetTutor.name}
                  className="w-12 h-12 rounded-xl object-cover border border-amber-500/30 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-slate-800 text-amber-300 flex items-center justify-center font-bold text-base border border-slate-700 shrink-0">
                  {connectParentTargetTutor.name?.charAt(0) || 'T'}
                </div>
              )}
              <div className="text-xs min-w-0 flex-1">
                <div className="font-bold text-white text-sm truncate">{connectParentTargetTutor.name}</div>
                <div className="text-slate-400 truncate">
                  {connectParentTargetTutor.qualification} • {connectParentTargetTutor.locationArea || 'Rayagada'}
                </div>
                <div className="text-emerald-400 font-bold mt-0.5">
                  Fee: ₹{connectParentTargetTutor.monthlyFee || 3000}/month • {connectParentTargetTutor.subjects.slice(0, 3).join(', ')}
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Select Registered Parent */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Select Registered Parent Family:
                </label>
                <select
                  value={connectParentSelectedUid}
                  onChange={(e) => setConnectParentSelectedUid(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">-- Choose a registered parent --</option>
                  {registeredParents.map((parent) => (
                    <option key={parent.uid} value={parent.uid}>
                      {parent.name} • Child: {parent.childName || 'Student'} ({parent.childGrade || 'Grade'}) • {parent.phone} • {parent.locality || 'Rayagada'}
                    </option>
                  ))}
                </select>
                {registeredParents.length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    No registered parents available in the directory.
                  </p>
                )}
              </div>

              {/* Time Slot Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Daily Tuition Schedule / Time Slot:
                </label>
                <select
                  value={connectParentTimeSlot}
                  onChange={(e) => setConnectParentTimeSlot(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="06:00 AM - 07:00 AM">06:00 AM - 07:00 AM (Early Morning Slot)</option>
                  <option value="07:00 AM - 08:00 AM">07:00 AM - 08:00 AM (Morning Slot 2)</option>
                  <option value="08:00 AM - 09:00 AM">08:00 AM - 09:00 AM (Morning Slot 3)</option>
                  <option value="05:00 PM - 06:00 PM">05:00 PM - 06:00 PM (Evening Slot 1)</option>
                  <option value="06:00 PM - 07:00 PM">06:00 PM - 07:00 PM (Evening Slot 2)</option>
                  <option value="07:00 PM - 08:00 PM">07:00 PM - 08:00 PM (Evening Slot 3)</option>
                  <option value="08:00 PM - 09:00 PM">08:00 PM - 09:00 PM (Night Slot)</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Connection Notes / Subjects:
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Daily 1 hr home tutoring for mathematics and science foundation."
                  value={connectParentNotes}
                  onChange={(e) => setConnectParentNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConnectParentTargetTutor(null)}
                className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isConnectingParent || !connectParentSelectedUid}
                onClick={handleConfirmConnectParentToTutor}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-amber-500/20"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>{isConnectingParent ? 'Connecting...' : 'Confirm Connection'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PROCESS TUTOR SETTLEMENT TRANSFER MODAL
         ========================================================================= */}
      {selectedWithdrawalForTransfer && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setSelectedWithdrawalForTransfer(null)}
        >
          <div className="bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-700 overflow-hidden relative my-6 text-slate-200">
            {/* Attractive Header */}
            <div className="bg-gradient-to-r from-[#0c2340] via-[#132e54] to-[#1e3a8a] text-white p-6 relative">
              <button
                type="button"
                onClick={() => setSelectedWithdrawalForTransfer(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer ring-1 ring-white/20 shadow-xs"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">
                <Wallet className="w-4 h-4" />
                <span>Accounts &amp; Settlement Desk</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Process Payout Settlement
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 mt-1">
                Record bank transfer, enter UTR number, and upload payment receipt slip for {selectedWithdrawalForTransfer.tutorName}.
              </p>
            </div>

            {(() => {
              const { assignedStudents: targetStudents, tutorRates: targetRates } =
                getAssignedStudentsAndRatesForWithdrawal(selectedWithdrawalForTransfer);
              const targetLedger = calculateTutorVerifiedLedger(
                {
                  tutorId: selectedWithdrawalForTransfer.tutorId,
                  tutorEmail: selectedWithdrawalForTransfer.tutorEmail,
                  tutorPhone: selectedWithdrawalForTransfer.tutorPhone,
                  tutorName: selectedWithdrawalForTransfer.tutorName
                },
                receivedFeesList,
                mergedWithdrawalsList,
                selectedWithdrawalForTransfer.id,
                targetStudents,
                targetRates
              );

              return (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const cleanUtr = transferUtr.trim();
                if (cleanUtr.length < 6) {
                  setTransferError('Valid Bank UTR / Transaction Reference Number (at least 6 characters) is required.');
                  return;
                }
                const duplicateUtr = mergedWithdrawalsList.some(
                  (w) =>
                    w.id !== selectedWithdrawalForTransfer.id &&
                    w.status === 'approved' &&
                    w.utrNumber &&
                    w.utrNumber.trim().toLowerCase() === cleanUtr.toLowerCase()
                );
                if (duplicateUtr) {
                  setTransferError(`Duplicate UTR "${cleanUtr}" already used in a completed settlement.`);
                  return;
                }

                const num = Math.round(Number(transferAmount));
                if (isNaN(num) || num <= 0) {
                  setTransferError('Please enter a valid whole-rupee disbursement amount.');
                  return;
                }
                if (num > selectedWithdrawalForTransfer.amount) {
                  setTransferError(`Disbursed amount cannot exceed requested notice amount (₹${selectedWithdrawalForTransfer.amount.toLocaleString('en-IN')}).`);
                  return;
                }
                if (num > targetLedger.availableBalance) {
                  setTransferError(`Transfer amount ₹${num.toLocaleString('en-IN')} exceeds tutor's verified available balance ₹${targetLedger.availableBalance.toLocaleString('en-IN')} backed by paid parent fees.`);
                  return;
                }

                setIsProcessingTransfer(true);
                setTransferError(null);
                try {
                  await adminApproveWithdrawal(
                    selectedWithdrawalForTransfer.id,
                    {
                      utrNumber: cleanUtr,
                      transferredAmount: num,
                      transferMethod: transferMethod,
                      paymentSlipUrl: transferSlipUrl,
                      adminNote: transferAdminNote.trim(),
                      approvedBy: currentUser?.email || currentUser?.name || 'Kumari Institute Admin'
                    },
                    selectedWithdrawalForTransfer
                  );

                  await logAdminActivity({
                    adminName: currentUser?.name || 'Admin Accounts Desk',
                    actionType: 'payout_processed',
                    category: 'payouts',
                    title: `Tutor Payout Disbursed: ₹${num.toLocaleString('en-IN')}`,
                    description: `Transferred ₹${num.toLocaleString('en-IN')} to tutor ${selectedWithdrawalForTransfer.tutorName} via ${transferMethod}. Bank UTR: ${cleanUtr}.`
                  });

                  showToast('success', `✓ ₹${num.toLocaleString('en-IN')} payout recorded for ${selectedWithdrawalForTransfer.tutorName}!`);
                  setSelectedWithdrawalForTransfer(null);
                } catch (err: any) {
                  setTransferError(err?.message || 'Failed to record withdrawal transfer.');
                } finally {
                  setIsProcessingTransfer(false);
                }
              }}
              className="p-6 space-y-4 text-xs"
            >
              {transferError && (
                <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{transferError}</span>
                </div>
              )}

              {/* Verified Ledger Audit Box */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-950 border border-emerald-500/30">
                <div>
                  <span className="text-[10px] text-slate-400 block">Notice Requested</span>
                  <span className="font-black text-white text-sm font-mono">
                    ₹{selectedWithdrawalForTransfer.amount.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Verified Balance</span>
                  <span className={`font-black text-sm font-mono ${
                    selectedWithdrawalForTransfer.amount > targetLedger.availableBalance ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    ₹{targetLedger.availableBalance.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Total Disbursed</span>
                  <span className="font-bold text-slate-200 text-sm font-mono">
                    ₹{targetLedger.totalApprovedWithdrawn.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Target Destination Box */}
              <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex justify-between items-center text-slate-400">
                  <span>Educator:</span>
                  <strong className="text-white">{selectedWithdrawalForTransfer.tutorName} ({selectedWithdrawalForTransfer.tutorPhone || 'No Phone'})</strong>
                </div>
                <div className="flex justify-between items-center text-slate-400">
                  <span>Method Requested:</span>
                  <span className="text-emerald-400 font-bold uppercase">{selectedWithdrawalForTransfer.paymentMethod === 'upi' ? 'UPI Transfer' : 'Direct Bank NEFT/IMPS'}</span>
                </div>
                {selectedWithdrawalForTransfer.paymentMethod === 'upi' ? (
                  <div className="flex justify-between items-center pt-1 border-t border-slate-800">
                    <span className="text-slate-400">UPI Address:</span>
                    <span className="font-mono font-bold text-amber-300">{selectedWithdrawalForTransfer.upiId}</span>
                  </div>
                ) : selectedWithdrawalForTransfer.bankDetails ? (
                  <div className="pt-1 border-t border-slate-800 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Bank &amp; Holder:</span>
                      <span className="text-white font-medium">{selectedWithdrawalForTransfer.bankDetails.bankName} • {selectedWithdrawalForTransfer.bankDetails.accountHolder}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">A/C Number:</span>
                      <span className="font-mono font-bold text-amber-300">{selectedWithdrawalForTransfer.bankDetails.accountNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">IFSC Code:</span>
                      <span className="font-mono font-bold text-amber-300">{selectedWithdrawalForTransfer.bankDetails.ifscCode}</span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Amount & Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Disbursed Amount (₹) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-bold mb-1">
                    Settlement Method *
                  </label>
                  <select
                    value={transferMethod}
                    onChange={(e) => setTransferMethod(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
                  >
                    <option value="UPI Transfer">UPI Transfer (Google Pay / PhonePe / Paytm)</option>
                    <option value="IMPS Immediate Payment">IMPS Bank Transfer</option>
                    <option value="NEFT Settlement">NEFT Bank Transfer</option>
                    <option value="RTGS Settlement">RTGS Bank Transfer</option>
                    <option value="Direct Cash Handover">Cash Handover at Institute</option>
                  </select>
                </div>
              </div>

              {/* UTR / Transaction Reference Number */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Bank UTR / Transaction Reference ID *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 427819283741 or UPI/427819283741/PAY"
                  value={transferUtr}
                  onChange={(e) => setTransferUtr(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  This UTR will be recorded in the tutor's dashboard so they can verify the credit in their bank statement.
                </span>
              </div>

              {/* Payment Slip Upload / Preview */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Official Bank Transfer Slip / Proof (Optional)
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isUploadingSlip ? 'Compressing...' : 'Upload Slip Image'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setIsUploadingSlip(true);
                          try {
                            const uploaded = await uploadImageToImgBB(file, `payout-slip-${Date.now()}`);
                            if (uploaded.success && uploaded.url) {
                              setTransferSlipUrl(uploaded.url);
                              return;
                            }
                            const base64 = await compressImageToBase64(file, 800, 0.8);
                            setTransferSlipUrl(base64);
                          } catch {
                            showToast('error', 'Failed to process payment slip image. Paste a URL or try another file.');
                          } finally {
                            setIsUploadingSlip(false);
                          }
                        }}
                      />
                    </label>

                    <input
                      type="url"
                      placeholder="Or paste image URL..."
                      value={transferSlipUrl}
                      onChange={(e) => setTransferSlipUrl(e.target.value)}
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                  </div>

                  {transferSlipUrl && (
                    <div className="relative rounded-2xl border border-slate-700 p-2 bg-slate-950 max-h-40 overflow-hidden flex items-center justify-center">
                      <img
                        src={transferSlipUrl}
                        alt="Payment Slip Preview"
                        className="max-h-36 object-contain rounded-xl"
                      />
                      <button
                        type="button"
                        onClick={() => setTransferSlipUrl('')}
                        className="absolute top-2 right-2 p-1 rounded-full bg-slate-900/80 text-rose-400 hover:text-white"
                        title="Remove image"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Note */}
              <div>
                <label className="block text-slate-300 font-bold mb-1">
                  Admin Remarks (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Verified via YONO SBI NetBanking, tuition cycle month settled."
                  value={transferAdminNote}
                  onChange={(e) => setTransferAdminNote(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedWithdrawalForTransfer(null)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isProcessingTransfer || !transferUtr.trim()}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors shadow-lg shadow-emerald-600/30"
                >
                  {isProcessingTransfer ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording Transfer...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Confirm &amp; Record Transfer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
              );
            })()}
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW OFFICIAL PAYOUT VOUCHER & RECEIPT MODAL
         ========================================================================= */}
      {viewingWithdrawalReceipt && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setViewingWithdrawalReceipt(null)}
        >
          <div className="bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-700 overflow-hidden relative my-6 text-slate-200">
            {/* Header */}
            <div className="bg-gradient-to-r from-[#0c2340] via-[#132e54] to-[#1e3a8a] text-white p-6 relative">
              <button
                type="button"
                onClick={() => setViewingWithdrawalReceipt(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer ring-1 ring-white/20 shadow-xs"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-1">
                <Receipt className="w-4 h-4" />
                <span>Verified Disbursement Slip</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                Official Payout Voucher
              </h3>
              <p className="text-xs sm:text-sm text-blue-100 mt-1">
                Kumari Educational Coaching Institute • Rayagada, Odisha
              </p>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Transfer ID:</span>
                  <span className="font-mono font-bold text-white">{viewingWithdrawalReceipt.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Disbursement Date:</span>
                  <span className="font-semibold text-white">
                    {new Date(viewingWithdrawalReceipt.approvedAt || viewingWithdrawalReceipt.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Educator:</span>
                  <strong className="text-white">{viewingWithdrawalReceipt.tutorName}</strong>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Transfer Mode:</span>
                  <span className="text-blue-400 font-semibold">{viewingWithdrawalReceipt.transferMethod || viewingWithdrawalReceipt.paymentMethod}</span>
                </div>

                {/* Bank UTR Display */}
                {viewingWithdrawalReceipt.utrNumber && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex justify-between items-center mt-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 block">
                        Bank UTR / Transaction No.
                      </span>
                      <span className="font-mono font-black text-sm text-emerald-200">
                        {viewingWithdrawalReceipt.utrNumber}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(viewingWithdrawalReceipt.utrNumber!);
                        showToast('success', 'UTR copied to clipboard!');
                      }}
                      className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-[10px] cursor-pointer"
                    >
                      Copy UTR
                    </button>
                  </div>
                )}

                {viewingWithdrawalReceipt.adminNote && (
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-[11px]">
                    <strong className="block text-slate-400 mb-0.5">Admin Remarks:</strong>
                    <span>{viewingWithdrawalReceipt.adminNote}</span>
                  </div>
                )}

                <div className="flex justify-between items-baseline font-bold pt-2 border-t border-slate-800">
                  <span className="text-slate-300 text-sm">Disbursed Amount:</span>
                  <span className="text-2xl font-black text-emerald-400">
                    ₹ {(viewingWithdrawalReceipt.transferredAmount || viewingWithdrawalReceipt.amount).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              {/* Payment Slip Image Preview */}
              {viewingWithdrawalReceipt.paymentSlipUrl ? (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold text-slate-300 block">
                    Official Bank Transfer Slip / Proof:
                  </span>
                  <div className="rounded-2xl border border-slate-800 overflow-hidden bg-slate-950 max-h-56 flex items-center justify-center p-2">
                    <img
                      src={viewingWithdrawalReceipt.paymentSlipUrl}
                      alt="Payment Slip"
                      className="max-h-52 object-contain rounded-xl"
                    />
                  </div>
                </div>
              ) : null}

              {/* Actions */}
              <div className="flex items-center justify-between pt-2">
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approved &amp; Disbursed by Accounts Desk</span>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewingWithdrawalReceipt(null)}
                    className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 font-bold text-xs hover:bg-slate-800 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Voucher</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP CONFIRMATION DIALOG */}
      {confirmDialog && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[75] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && !isConfirmBusy && setConfirmDialog(null)}
        >
          <div className="bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-700 shadow-2xl space-y-4 text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-white">{confirmDialog.title}</h3>
              </div>
              <button
                type="button"
                disabled={isConfirmBusy}
                onClick={() => setConfirmDialog(null)}
                aria-label="Close"
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{confirmDialog.message}</p>
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                disabled={isConfirmBusy}
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isConfirmBusy}
                onClick={async () => {
                  setIsConfirmBusy(true);
                  try {
                    await confirmDialog.onConfirm();
                    setConfirmDialog(null);
                  } finally {
                    setIsConfirmBusy(false);
                  }
                }}
                className={`px-4 py-2 rounded-xl text-white text-xs font-bold cursor-pointer flex items-center gap-1.5 disabled:opacity-60 ${
                  confirmDialog.variant === 'danger'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {isConfirmBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{confirmDialog.confirmLabel || 'Confirm'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
