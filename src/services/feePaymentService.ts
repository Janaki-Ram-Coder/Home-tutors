import {
  collection,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  arrayUnion
} from 'firebase/firestore';
import { db, fetchFirestoreCollectionRest } from '../lib/firebase';
import { AppUserProfile } from './firebaseAuth';

export type FeePaymentMethod =
  | 'UPI'
  | 'PhonePe / GPay'
  | 'Net Banking'
  | 'Debit/Credit Card'
  | 'Wallet'
  | 'Cash / Institute Desk';

export interface ReceivedFeeRecord {
  id: string;
  receiptNo: string;
  transactionId: string;
  // Parent details
  parentUid: string;
  parentName: string;
  parentEmail?: string;
  parentPhone?: string;
  // Student details
  studentName: string;
  studentGrade?: string;
  // Tutor & tuition details
  bookingId?: string;
  tutorId?: string;
  tutorName: string;
  tutorPhone?: string;
  tutorSubjects?: string;
  // Financial details
  amount: number;
  formattedAmount: string;
  billingPeriod: string; // e.g., "October 2026 Monthly Tuition"
  paymentMethod: FeePaymentMethod;
  paymentGateway?: 'Razorpay' | 'Institute Desk';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  signatureVerified?: boolean;
  gatewayPaymentStatus?: string;
  paymentMethodDetail?: string;
  acquirerRef?: string;
  payerEmail?: string;
  payerContact?: string;
  adminVerificationStatus?: 'verified_gateway' | 'verified_by_admin' | 'flagged';
  verifiedByAdminAt?: string;
  cycleDays?: number;
  status: 'paid' | 'completed';
  paidAt: string; // ISO string
  paidDate: string; // Formatted date e.g. "10 Oct 2026"
  paidTime: string; // Formatted time e.g. "03:54 PM"
  nextDueDate: string; // 30 days from paidAt
  nextDueAt: string; // ISO string
  notes?: string;
  createdAt?: string;
}

export const TUITION_CYCLE_DAYS = 30;

/**
 * Format currency in Indian Rupees (INR)
 */
export function formatINR(val: number | string): string {
  const num = typeof val === 'string' ? parseFloat(val.replace(/[^\d.]/g, '')) : val;
  if (isNaN(num)) return '₹0';
  return `₹${num.toLocaleString('en-IN')}`;
}

/**
 * Check if a tutor payment is still active/paid or due for payment based on 30-day cycle
 */
export function getTutorPaymentStatus(
  bookingId: string | undefined,
  tutorId: string | undefined,
  paymentRecords: ReceivedFeeRecord[],
  parentProfile?: AppUserProfile | null
): {
  isPaid: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  isOverdue: boolean;
  lastPayment?: ReceivedFeeRecord | any;
  nextDueDate?: string;
  nextDueTimestamp?: number;
  lastPaidDateFormatted?: string;
} {
  const CYCLE_DAYS = TUITION_CYCLE_DAYS;
  const CYCLE_MS = CYCLE_DAYS * 24 * 60 * 60 * 1000;
  const now = Date.now();

  // 1. Gather matching records from paymentRecords (Firestore 'received_fees')
  const recordMatches = (paymentRecords || []).filter((r) => {
    if (bookingId && r.bookingId && r.bookingId === bookingId) return true;
    if (tutorId && (r.tutorId === tutorId || (r as any).assignedTutorId === tutorId)) return true;
    return false;
  });

  // 2. Also check parent profile's feeReceipts from Firestore 'parents' collection
  const profileReceiptMatches: any[] = [];
  const pAny = parentProfile as any;
  if (pAny?.feeReceipts && Array.isArray(pAny.feeReceipts)) {
    pAny.feeReceipts.forEach((r: any) => {
      const isMatch =
        (bookingId && (r.bookingId === bookingId || r.id?.includes(bookingId))) ||
        (tutorId && (r.tutorId === tutorId || r.assignedTutorId === tutorId)) ||
        (!bookingId && !tutorId);
      if (isMatch) {
        profileReceiptMatches.push({
          receiptNo: r.receiptNo || r.id,
          bookingId: r.bookingId || bookingId,
          tutorId: r.tutorId || tutorId,
          tutorName: r.tutorName,
          studentName: r.studentName,
          paidAt: r.paidAt || r.date,
          paidDate: r.date?.split('•')[0]?.trim() || r.paidDate || r.date,
          paidTime: r.date?.split('•')[1]?.trim() || r.paidTime || '',
          amount: typeof r.amount === 'string' ? parseFloat(r.amount.replace(/[^\d.]/g, '')) : (r.amount || 0),
          formattedAmount: typeof r.amount === 'string' ? r.amount : `₹${r.amount}`,
          billingPeriod: r.description || 'Monthly Tuition Fee',
          paymentMethod: r.transferMethod || 'UPI',
          paymentGateway: r.paymentGateway || (r.razorpayPaymentId ? 'Razorpay' : undefined),
          razorpayOrderId: r.razorpayOrderId,
          razorpayPaymentId: r.razorpayPaymentId,
          signatureVerified: r.signatureVerified,
          paymentMethodDetail: r.paymentMethodDetail,
          transactionId: r.razorpayPaymentId || r.utrNumber || r.transactionId || r.id,
          nextDueDate: r.nextDueDate
        });
      }
    });
  }

  // Combine and find latest payment
  const allCandidates = [...recordMatches, ...profileReceiptMatches];

  // Only fall back to parent's generic lastFeePaidAt if no specific booking/tutor identifier was supplied
  if (!bookingId && !tutorId && allCandidates.length === 0 && pAny?.lastFeePaidAt) {
    allCandidates.push({
      receiptNo: pAny.lastFeeReceiptNo || 'RECENT-FEE',
      paidAt: pAny.lastFeePaidAt,
      paidDate: new Date(pAny.lastFeePaidAt).toLocaleDateString('en-IN'),
      paidTime: new Date(pAny.lastFeePaidAt).toLocaleTimeString('en-IN'),
      amount: pAny.feesAmount || 3000,
      formattedAmount: `₹${pAny.feesAmount || 3000}`,
      billingPeriod: 'Monthly Tuition Fee',
      paymentMethod: 'UPI',
      transactionId: 'TXN-PAID',
      nextDueDate: pAny.nextFeeDueDate
    });
  }

  if (allCandidates.length === 0) {
    return {
      isPaid: false,
      daysRemaining: 0,
      hoursRemaining: 0,
      isOverdue: false
    };
  }

  // Sort candidates descending by payment timestamp
  allCandidates.sort((a, b) => {
    const timeA = new Date(a.paidAt || a.createdAt || a.paidDate || 0).getTime();
    const timeB = new Date(b.paidAt || b.createdAt || b.paidDate || 0).getTime();
    return timeB - timeA;
  });

  const latest = allCandidates[0];
  const paidTimestamp = new Date(latest.paidAt || latest.createdAt || latest.paidDate || 0).getTime();

  if (isNaN(paidTimestamp) || paidTimestamp === 0) {
    return {
      isPaid: false,
      daysRemaining: 0,
      hoursRemaining: 0,
      isOverdue: false,
      lastPayment: latest
    };
  }

  // Calendar-day aligned 30-day cycle (Payment day = 30, Next day = 29, Next day = 28 ... Day 30 = 0)
  const DAY_MS = 24 * 60 * 60 * 1000;
  const paidDateObj = new Date(paidTimestamp);
  const paidStartOfDay = new Date(
    paidDateObj.getFullYear(),
    paidDateObj.getMonth(),
    paidDateObj.getDate()
  ).getTime();

  const nowDateObj = new Date(now);
  const nowStartOfDay = new Date(
    nowDateObj.getFullYear(),
    nowDateObj.getMonth(),
    nowDateObj.getDate()
  ).getTime();

  const calendarDaysElapsed = Math.max(0, Math.round((nowStartOfDay - paidStartOfDay) / DAY_MS));
  const daysRemaining = Math.max(0, CYCLE_DAYS - calendarDaysElapsed);
  const nextDueTimestamp = paidStartOfDay + CYCLE_MS;
  const timeDifferenceMs = nextDueTimestamp - now;

  const nextDueDateFormatted =
    latest.nextDueDate ||
    new Date(paidTimestamp + CYCLE_MS).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

  const lastPaidDateFormatted = paidDateObj.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Active while daysRemaining > 0 (30 -> 29 -> 28 ... -> 1)
  if (daysRemaining > 0) {
    const hoursRemaining = Math.max(1, Math.ceil(Math.max(0, timeDifferenceMs) / (1000 * 60 * 60)));
    return {
      isPaid: true,
      daysRemaining,
      hoursRemaining,
      isOverdue: false,
      lastPayment: latest,
      nextDueDate: nextDueDateFormatted,
      nextDueTimestamp,
      lastPaidDateFormatted
    };
  }

  // Reached 0 after 1 month (30 days) -> Shows Continue / Discontinue options
  return {
    isPaid: false,
    daysRemaining: 0,
    hoursRemaining: 0,
    isOverdue: true,
    lastPayment: latest,
    nextDueDate: nextDueDateFormatted,
    nextDueTimestamp,
    lastPaidDateFormatted
  };
}

/**
 * Record a verified parent fee payment in Firestore:
 * 1. Store in `received_fees` collection (for Admin "Received Fees" verification desk & global audit)
 * 2. Update parent document in `parents` with the receipt in `feeReceipts` array
 * 3. Update `tutor_bookings` document if present
 * 4. Update `activity_logs` so it reconciles across the entire admin audit
 */
export async function processParentFeePayment(payload: {
  parentUser: AppUserProfile;
  booking: any;
  amount: number;
  paymentMethod: FeePaymentMethod;
  utrNumber?: string;
  notes?: string;
  paymentGateway?: 'Razorpay' | 'Institute Desk';
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  signatureVerified?: boolean;
  gatewayPaymentStatus?: string;
  paymentMethodDetail?: string;
  acquirerRef?: string;
  payerEmail?: string;
  payerContact?: string;
}): Promise<{ success: boolean; record: ReceivedFeeRecord; receipt: any }> {
  const {
    parentUser,
    booking,
    amount,
    paymentMethod,
    utrNumber,
    notes,
    paymentGateway,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    signatureVerified,
    gatewayPaymentStatus,
    paymentMethodDetail,
    acquirerRef,
    payerEmail,
    payerContact
  } = payload;

  const now = new Date();
  const paidAt = now.toISOString();
  const paidDate = now.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const paidTime = now.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // Calculate next due date (30 days later)
  const nextDueDateObj = new Date(now.getTime() + TUITION_CYCLE_DAYS * 24 * 60 * 60 * 1000);
  const nextDueDate = nextDueDateObj.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
  const nextDueAt = nextDueDateObj.toISOString();

  const idSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
  const receiptNo = `KI-FEE-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${idSuffix}`;
  const transactionId = razorpayPaymentId?.trim() || utrNumber?.trim() || `TXN-${Date.now()}-${idSuffix}`;

  const tutorName =
    booking.assignedTutorName ||
    booking.requestedTutorName ||
    booking.tutorName ||
    booking.name ||
    'Assigned Home Tutor';

  const tutorId = booking.assignedTutorId || booking.requestedTutorId || booking.tutorId || booking.id || '';
  const tutorPhone = booking.assignedTutorPhone || booking.phone || '';
  const tutorSubjects = Array.isArray(booking.subjects)
    ? booking.subjects.join(', ')
    : booking.subjects || 'Home Tuition';

  const studentName = booking.studentName || parentUser.childName || parentUser.name || 'Student';
  const studentGrade = booking.studentGrade || parentUser.childGrade || '';

  const billingPeriod = `${now.toLocaleString('default', { month: 'long', year: 'numeric' })} Monthly Home Tuition`;
  const resolvedGateway: 'Razorpay' | 'Institute Desk' =
    paymentGateway || (razorpayPaymentId ? 'Razorpay' : 'Institute Desk');

  const feeRecord: ReceivedFeeRecord = {
    id: receiptNo,
    receiptNo,
    transactionId,
    parentUid: parentUser.uid || '',
    parentName: parentUser.name || (parentUser as any).fullName || 'Parent',
    parentEmail: parentUser.email || payerEmail || '',
    parentPhone: parentUser.phone || payerContact || '',
    studentName,
    studentGrade,
    bookingId: booking.id || '',
    tutorId,
    tutorName,
    tutorPhone,
    tutorSubjects,
    amount,
    formattedAmount: formatINR(amount),
    billingPeriod,
    paymentMethod,
    paymentGateway: resolvedGateway,
    razorpayOrderId: razorpayOrderId || undefined,
    razorpayPaymentId: razorpayPaymentId || undefined,
    razorpaySignature: razorpaySignature || undefined,
    signatureVerified: Boolean(signatureVerified),
    gatewayPaymentStatus: gatewayPaymentStatus || (razorpayPaymentId ? 'captured' : 'settled'),
    paymentMethodDetail: paymentMethodDetail || paymentMethod,
    acquirerRef: acquirerRef || undefined,
    payerEmail: payerEmail || parentUser.email || '',
    payerContact: payerContact || parentUser.phone || '',
    adminVerificationStatus: signatureVerified ? 'verified_gateway' : undefined,
    cycleDays: TUITION_CYCLE_DAYS,
    status: 'paid',
    paidAt,
    paidDate,
    paidTime,
    nextDueDate,
    nextDueAt,
    notes: notes || `30-day monthly fee paid via ${resolvedGateway} for ${studentName} (${tutorSubjects})`,
    createdAt: paidAt
  };

  // Strip undefined properties before writing to Firestore
  const cleanFeeRecord = Object.fromEntries(
    Object.entries(feeRecord).filter(([, v]) => v !== undefined)
  );

  const receiptForUser = {
    id: receiptNo,
    receiptNo,
    transactionId,
    bookingId: booking.id || '',
    tutorId,
    date: `${paidDate} • ${paidTime}`,
    description: `${billingPeriod} - ${tutorName}`,
    amount: formatINR(amount),
    status: 'Paid',
    transferMethod: paymentMethodDetail || paymentMethod,
    paymentGateway: resolvedGateway,
    razorpayOrderId: razorpayOrderId || '',
    razorpayPaymentId: razorpayPaymentId || '',
    signatureVerified: Boolean(signatureVerified),
    utrNumber: transactionId,
    studentName,
    tutorName,
    nextDueDate,
    paidAt
  };

  // 1. Write to Firestore `received_fees` collection
  try {
    const feeDocRef = doc(db, 'received_fees', receiptNo);
    await setDoc(feeDocRef, cleanFeeRecord);
  } catch (err) {
    console.warn('[paymentService] Firestore received_fees save notice:', err);
  }

  // 2. Update parent document in Firestore `parents` collection with the new fee receipt
  if (parentUser.uid) {
    try {
      const parentDocRef = doc(db, 'parents', parentUser.uid);
      await setDoc(
        parentDocRef,
        {
          feeReceipts: arrayUnion(receiptForUser),
          lastFeePaidAt: paidAt,
          lastFeeReceiptNo: receiptNo,
          nextFeeDueDate: nextDueDate
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[paymentService] Parent feeReceipts update notice:', err);
    }
  }

  // 3. Also annotate `tutor_bookings` document if booking ID exists
  if (booking.id) {
    try {
      const bookingDocRef = doc(db, 'tutor_bookings', booking.id);
      await updateDoc(bookingDocRef, {
        lastFeePaidAt: paidAt,
        nextFeeDueAt: nextDueAt,
        nextFeeDueDate: nextDueDate,
        lastReceiptNo: receiptNo,
        razorpayPaymentId: razorpayPaymentId || transactionId,
        paymentStatus: 'paid'
      });
    } catch {
      // Booking may originate from hiredTutors/assignedEducator without a tutor_bookings doc
    }
  }

  // 4. Update activity logs so it's fully indexed in system logs
  try {
    const logDocRef = doc(db, 'activity_logs', receiptNo);
    await setDoc(logDocRef, {
      id: receiptNo,
      category: 'payment_home_tutors',
      actionType: 'payment_home_tutor',
      description: `Received tuition fee of ${formatINR(amount)} via ${resolvedGateway} from ${feeRecord.parentName} for Tutor ${tutorName}`,
      amount,
      receiptNo,
      transactionId,
      razorpayOrderId: razorpayOrderId || '',
      razorpayPaymentId: razorpayPaymentId || '',
      signatureVerified: Boolean(signatureVerified),
      entityName: `${feeRecord.parentName} (${studentName})`,
      timestamp: paidAt,
      dateFormatted: `${paidDate} at ${paidTime}`,
      paymentMethod: paymentMethodDetail || paymentMethod,
      status: 'success'
    });
  } catch (err) {
    console.warn('[paymentService] Activity logs update notice:', err);
  }

  return {
    success: true,
    record: feeRecord,
    receipt: receiptForUser
  };
}


/**
 * Admin manually confirms / flags a received fee transaction after reviewing Razorpay verification metadata
 */
export async function verifyFeeRecordByAdmin(
  receiptNo: string,
  status: 'verified_by_admin' | 'flagged'
): Promise<void> {
  if (!receiptNo) return;
  const verifiedAt = new Date().toISOString();
  const feeDocRef = doc(db, 'received_fees', receiptNo);
  await updateDoc(feeDocRef, {
    adminVerificationStatus: status,
    verifiedByAdminAt: verifiedAt
  });
}

/**
 * Real-time subscription to `received_fees` collection for Admin and Parent
 */
export function subscribeToReceivedFees(
  callback: (records: ReceivedFeeRecord[]) => void,
  parentUidFilter?: string
): () => void {
  let active = true;
  let receivedLiveSnapshot = false;

  const filterAndSort = (rawList: any[]): ReceivedFeeRecord[] => {
    const filtered = rawList
      .map((item) => ({ ...item, id: item.id || item.receiptNo }) as ReceivedFeeRecord)
      .filter((item) => !parentUidFilter || item.parentUid === parentUidFilter);
    filtered.sort(
      (a: any, b: any) =>
        new Date(b.paidAt || b.createdAt || 0).getTime() -
        new Date(a.paidAt || a.createdAt || 0).getTime()
    );
    return filtered;
  };

  const hydrateFallback = async () => {
    try {
      const res = await fetch('/api/admin/received-fees');
      if (res.ok) {
        const body = await res.json();
        const list = Array.isArray(body?.fees) ? body.fees : Array.isArray(body) ? body : [];
        if (active && !receivedLiveSnapshot && list.length > 0) {
          callback(filterAndSort(list));
          return;
        }
      }
    } catch {
      // fall through to Firestore REST
    }

    try {
      const restList = await fetchFirestoreCollectionRest<any>('received_fees');
      if (active && (!receivedLiveSnapshot || restList.length > 0)) {
        callback(filterAndSort(restList));
      }
    } catch {
      // keep existing UI state intact
    }
  };

  hydrateFallback();

  try {
    const colRef = collection(db, 'received_fees');

    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (!active) return;
        receivedLiveSnapshot = true;
        const list: ReceivedFeeRecord[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as ReceivedFeeRecord);
        });
        callback(filterAndSort(list));
      },
      (err) => {
        console.warn('[paymentService] subscribeToReceivedFees notice (using REST fallback):', err);
        hydrateFallback();
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  } catch (err) {
    console.warn('[paymentService] Error setting up listener:', err);
    return () => {
      active = false;
    };
  }
}
