import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query
} from 'firebase/firestore';
import { db, fetchFirestoreCollectionRest } from '../lib/firebase';
import type { ReceivedFeeRecord } from './feePaymentService';

export interface TutorWithdrawalRequest {
  id: string;
  tutorId: string;
  tutorName: string;
  tutorEmail?: string;
  tutorPhone?: string;
  amount: number;
  paymentMethod: 'upi' | 'bank_transfer';
  upiId?: string;
  bankDetails?: {
    bankName: string;
    accountNumber: string;
    ifscCode: string;
    accountHolder: string;
  };
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  utrNumber?: string;
  transferredAmount?: number;
  transferMethod?: string;
  paymentSlipUrl?: string;
  adminNote?: string;
  verifiedEarnedAtRequest?: number;
  verifiedAvailableAtRequest?: number;
  verifiedReceiptsCount?: number;
}

const LOCAL_WITHDRAWALS_KEY = 'kumari_withdrawal_requests_registry';

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const clean: Record<string, any> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined) {
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        clean[k] = stripUndefined(v);
      } else {
        clean[k] = v;
      }
    }
  });
  return clean as T;
}

function getLocalWithdrawals(): TutorWithdrawalRequest[] {
  try {
    const raw = localStorage.getItem(LOCAL_WITHDRAWALS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLocalWithdrawals(list: TutorWithdrawalRequest[]) {
  try {
    localStorage.setItem(LOCAL_WITHDRAWALS_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Error saving local withdrawals:', err);
  }
}

export const TUTOR_SHARE_PERCENT = 80;
export const PLATFORM_FEE_PERCENT = 20;
export const TUTOR_SHARE_RATIO = 0.8;
export const PLATFORM_FEE_RATIO = 0.2;

/**
 * Splits a gross class fee using the official 80% Tutor / 20% Kumari Institute Fee structure.
 */
export function calculateFeeSplit(grossAmount: number): {
  grossFee: number;
  tutorEarnings: number;
  platformFee: number;
} {
  const safeGross = Math.max(0, Math.round(Number(grossAmount) || 0));
  const tutorEarnings = Math.round(safeGross * TUTOR_SHARE_RATIO);
  const platformFee = safeGross - tutorEarnings;
  return {
    grossFee: safeGross,
    tutorEarnings,
    platformFee
  };
}

function normalizePhoneLast10(phone?: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function expandTutorIdCandidates(ids: Array<string | undefined>): string[] {
  const set = new Set<string>();
  for (const raw of ids) {
    const trimmed = String(raw || '').trim();
    if (!trimmed) continue;
    set.add(trimmed);
    const stripped = trimmed.replace(/^fb_teacher_/, '');
    if (stripped) {
      set.add(stripped);
      set.add(`fb_teacher_${stripped}`);
    }
  }
  return Array.from(set);
}

/**
 * Determines whether a verified parent fee payment belongs to a specific tutor.
 */
export function doesFeeRecordBelongToTutor(
  fee: ReceivedFeeRecord,
  tutorIdentity: {
    tutorId?: string;
    tutorUid?: string;
    tutorEmail?: string;
    tutorPhone?: string;
    tutorName?: string;
    bookingIds?: string[];
  }
): boolean {
  if (!fee) return false;
  const candidateIds = expandTutorIdCandidates([tutorIdentity.tutorId, tutorIdentity.tutorUid]);
  const feeAny = fee as any;
  const feeTutorIds = expandTutorIdCandidates([fee.tutorId, feeAny.assignedTutorId]);

  if (feeTutorIds.some((fid) => candidateIds.includes(fid))) {
    return true;
  }

  if (
    fee.bookingId &&
    Array.isArray(tutorIdentity.bookingIds) &&
    tutorIdentity.bookingIds.includes(fee.bookingId)
  ) {
    return true;
  }

  const feePhone = normalizePhoneLast10(fee.tutorPhone);
  const tutorPhone = normalizePhoneLast10(tutorIdentity.tutorPhone);
  if (feePhone && tutorPhone && feePhone === tutorPhone) {
    return true;
  }

  if (
    tutorIdentity.tutorEmail &&
    feeAny.tutorEmail &&
    String(feeAny.tutorEmail).trim().toLowerCase() ===
      tutorIdentity.tutorEmail.trim().toLowerCase()
  ) {
    return true;
  }

  if (
    tutorIdentity.tutorName &&
    fee.tutorName &&
    feeTutorIds.length === 0 &&
    fee.tutorName.trim().toLowerCase() === tutorIdentity.tutorName.trim().toLowerCase()
  ) {
    return true;
  }

  return false;
}

/**
 * Deduplicates withdrawal requests by ID, giving precedence to settled ('approved') records.
 */
export function deduplicateWithdrawals(
  withdrawals: TutorWithdrawalRequest[]
): TutorWithdrawalRequest[] {
  const statusRank = (s?: string) => (s === 'approved' ? 3 : s === 'rejected' ? 2 : 1);
  const map = new Map<string, TutorWithdrawalRequest>();
  for (const w of withdrawals || []) {
    if (!w || !w.id) continue;
    const prev = map.get(w.id);
    if (!prev || statusRank(w.status) >= statusRank(prev.status)) {
      map.set(w.id, w);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );
}

/**
 * Computes a tutor's financial ledger across both completed 30-day assigned cycles and verified `received_fees` payments, minus settled/pending withdrawals.
 */
export function calculateTutorVerifiedLedger(
  tutorIdentity: {
    tutorId?: string;
    tutorUid?: string;
    tutorEmail?: string;
    tutorPhone?: string;
    tutorName?: string;
    bookingIds?: string[];
  },
  allReceivedFees: ReceivedFeeRecord[] = [],
  allWithdrawals: TutorWithdrawalRequest[] = [],
  excludeWithdrawalId?: string,
  assignedStudents: any[] = [],
  tutorRates: {
    hourlyCharges?: number;
    hourlyRate?: number;
    hourlyFee?: number;
    monthlyFee?: number;
  } = {}
) {
  const candidateIds = expandTutorIdCandidates([tutorIdentity.tutorId, tutorIdentity.tutorUid]);
  const tPhone = normalizePhoneLast10(tutorIdentity.tutorPhone);
  const tEmail = (tutorIdentity.tutorEmail || '').trim().toLowerCase();
  const tName = (tutorIdentity.tutorName || '').trim().toLowerCase();

  // 1. Collect and deduplicate paid parent fees for this tutor
  const feeMap = new Map<string, ReceivedFeeRecord>();
  for (const fee of allReceivedFees || []) {
    if (!doesFeeRecordBelongToTutor(fee, tutorIdentity)) continue;
    const key = fee.receiptNo || fee.id;
    if (key && !feeMap.has(key)) {
      feeMap.set(key, fee);
    }
  }
  const tutorPaidFees = Array.from(feeMap.values()).sort(
    (a, b) => new Date(b.paidAt || b.createdAt || 0).getTime() - new Date(a.paidAt || a.createdAt || 0).getTime()
  );

  // 2. Collect and deduplicate withdrawals for this tutor
  const matchingWithdrawals = deduplicateWithdrawals(allWithdrawals).filter((w) => {
    if (excludeWithdrawalId && w.id === excludeWithdrawalId) return false;
    const wIds = expandTutorIdCandidates([w.tutorId]);
    if (wIds.some((wid) => candidateIds.includes(wid))) return true;
    if (tEmail && w.tutorEmail && w.tutorEmail.trim().toLowerCase() === tEmail) return true;
    if (tPhone && w.tutorPhone && normalizePhoneLast10(w.tutorPhone) === tPhone) return true;
    if (tName && w.tutorName && !w.tutorId && w.tutorName.trim().toLowerCase() === tName) return true;
    return false;
  });

  // 3. Reconcile using verified completed parent payments + 30-day teaching cycle rules
  const earnings = calculateTutorEarnings(
    tutorRates,
    assignedStudents,
    matchingWithdrawals,
    tutorPaidFees
  );

  return {
    tutorPaidFees,
    paidReceiptsCount: earnings.paidReceiptsCount,
    totalVerifiedGrossPaid: earnings.totalVerifiedGrossPaid,
    totalEarnedTutorShare: earnings.totalCurrentEarned,
    totalPlatformFeePaid: earnings.totalPlatformFeePaid,
    pendingAmount: earnings.pendingAmount,
    maturedStudentsCount: earnings.maturedStudentsCount,
    pendingStudentsCount: earnings.pendingStudentsCount,
    totalApprovedWithdrawn: earnings.totalApprovedWithdrawn,
    totalPendingWithdrawn: earnings.totalPendingWithdrawn,
    availableBalance: earnings.currentAvailableBalance
  };
}

/**
 * Calculates tutor earnings using the 80% Tutor / 20% Platform Fee split & 30-day teaching cycle:
 * - Unpaid bookings / assigned students do NOT add anything to Pending Parent Fee or Available Balance.
 * - Once a parent successfully completes a fee payment (`received_fees`), the tutor's 80% share goes into Pending Parent Fee (`pendingAmount`).
 * - Once 1 complete month (30 days from payment date, or explicitly marked `monthCompleted`) is taught, that 80% share moves to Matured Earnings & Available Balance (`totalCurrentEarned` / `currentAvailableBalance`).
 */
export function calculateTutorEarnings(
  tutorRates: {
    hourlyCharges?: number;
    hourlyRate?: number;
    hourlyFee?: number;
    monthlyFee?: number;
  },
  assignedStudents: any[] = [],
  withdrawals: TutorWithdrawalRequest[] = [],
  paidFeeRecords: ReceivedFeeRecord[] = []
) {
  const tutorHourly =
    Number(tutorRates.hourlyCharges) ||
    Number(tutorRates.hourlyRate) ||
    Number(tutorRates.hourlyFee) ||
    (tutorRates.monthlyFee ? Math.round(tutorRates.monthlyFee / 30) : 100);

  const defaultMonthlyPerStudent = tutorHourly * 30;
  const defaultTutorMonthlyPerStudent = Math.round(defaultMonthlyPerStudent * TUTOR_SHARE_RATIO);

  // Deduplicate and filter to valid completed parent fee payments
  const feeMap = new Map<string, ReceivedFeeRecord>();
  for (const fee of paidFeeRecords || []) {
    if (!fee) continue;
    const rawStatus = String(fee.status || '').toLowerCase();
    if (rawStatus === 'failed' || rawStatus === 'cancelled' || rawStatus === 'refunded') {
      continue;
    }
    if (Number(fee.amount) <= 0) continue;
    const key = fee.receiptNo || fee.id;
    if (key && !feeMap.has(key)) {
      feeMap.set(key, fee);
    }
  }
  const uniquePaidFees = Array.from(feeMap.values()).sort(
    (a, b) => new Date(a.paidAt || a.createdAt || 0).getTime() - new Date(b.paidAt || b.createdAt || 0).getTime()
  );

  let grossMonthlyAccrued = 0;
  let totalPlatformFeeMonthly = 0;
  let totalMonthlyAccrued = 0; // Tutor's 80% share across completed parent payments
  let totalVerifiedGrossPaid = 0; // Total gross across matured 30-day paid cycles
  let totalPlatformFeePaid = 0;
  let totalCurrentEarned = 0; // 80% share unlocked after 30 days teaching completion
  let pendingAmount = 0; // 80% share of completed parent payments still inside the 30-day teaching hold
  let pendingGrossAmount = 0;
  let maturedStudentsCount = 0;
  let pendingStudentsCount = 0;
  let nextUnlockDaysRemaining: number | null = null;

  const now = Date.now();
  const nowDate = new Date(now);
  const nowStartOfDay = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate()
  ).getTime();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const CYCLE_DAYS = 30;

  const manuallyUnlockedStudents = new Set<string>();

  for (const fee of uniquePaidFees) {
    const { grossFee, tutorEarnings, platformFee } = calculateFeeSplit(fee.amount);
    if (grossFee <= 0) continue;

    grossMonthlyAccrued += grossFee;
    totalPlatformFeeMonthly += platformFee;
    totalMonthlyAccrued += tutorEarnings;

    // Optional match to an assigned student to honor manual 1-month completion override
    const feeBookingId = String(fee.bookingId || '').replace(/^std-/, '').trim();
    const feeStudentName = String(fee.studentName || '').trim().toLowerCase();

    const matchedStudent = assignedStudents.find((s) => {
      const sBookingId = String(s.bookingId || s.id || '').replace(/^std-/, '').trim();
      const sName = String(s.studentName || s.name || '').trim().toLowerCase();
      if (feeBookingId && sBookingId && feeBookingId === sBookingId) return true;
      if (feeStudentName && sName && feeStudentName === sName) return true;
      return false;
    });

    const studentKey = matchedStudent
      ? String(matchedStudent.bookingId || matchedStudent.id || matchedStudent.studentName || matchedStudent.name || '')
      : '';

    const paidMs = new Date(fee.paidAt || fee.createdAt || now).getTime();
    let calendarDaysElapsed = 0;
    if (!isNaN(paidMs) && paidMs > 0) {
      const paidDate = new Date(paidMs);
      const paidStartOfDay = new Date(
        paidDate.getFullYear(),
        paidDate.getMonth(),
        paidDate.getDate()
      ).getTime();
      calendarDaysElapsed = Math.max(0, Math.round((nowStartOfDay - paidStartOfDay) / DAY_MS));
    }

    const isMarkedCompleted = Boolean(
      matchedStudent &&
        (matchedStudent.monthCompleted === true || matchedStudent.isMonthCompleted === true) &&
        studentKey &&
        !manuallyUnlockedStudents.has(studentKey)
    );

    if (calendarDaysElapsed >= CYCLE_DAYS || isMarkedCompleted) {
      if (isMarkedCompleted && studentKey) {
        manuallyUnlockedStudents.add(studentKey);
      }
      maturedStudentsCount += 1;
      totalVerifiedGrossPaid += grossFee;
      totalCurrentEarned += tutorEarnings;
      totalPlatformFeePaid += platformFee;
    } else {
      pendingStudentsCount += 1;
      pendingAmount += tutorEarnings;
      pendingGrossAmount += grossFee;

      const remainingDays = Math.max(1, CYCLE_DAYS - calendarDaysElapsed);
      if (nextUnlockDaysRemaining === null || remainingDays < nextUnlockDaysRemaining) {
        nextUnlockDaysRemaining = remainingDays;
      }
    }
  }

  // Deduplicate withdrawals accurately
  const uniqueWithdrawals = deduplicateWithdrawals(withdrawals);
  let totalApprovedWithdrawn = 0;
  let totalPendingWithdrawn = 0;

  uniqueWithdrawals.forEach((w) => {
    if (w.status === 'approved') {
      totalApprovedWithdrawn += Math.round(Number(w.transferredAmount ?? w.amount) || 0);
    } else if (w.status === 'pending') {
      totalPendingWithdrawn += Math.round(Number(w.amount) || 0);
    }
  });

  const currentAvailableBalance = Math.max(
    0,
    totalCurrentEarned - totalApprovedWithdrawn - totalPendingWithdrawn
  );

  return {
    tutorHourly,
    defaultMonthlyPerStudent,
    defaultTutorMonthlyPerStudent,
    grossMonthlyAccrued,
    totalPlatformFeeMonthly,
    totalMonthlyAccrued,
    pendingAmount,
    pendingGrossAmount,
    totalVerifiedGrossPaid,
    totalPlatformFeePaid,
    paidReceiptsCount: uniquePaidFees.length,
    maturedStudentsCount,
    pendingStudentsCount,
    nextUnlockDaysRemaining,
    totalCurrentEarned,
    totalApprovedWithdrawn,
    totalPendingWithdrawn,
    currentAvailableBalance,
    studentCount: assignedStudents.length,
    tutorSharePercent: TUTOR_SHARE_PERCENT,
    platformFeePercent: PLATFORM_FEE_PERCENT
  };
}

/**
 * Submit a withdrawal notice from a tutor to Kumari Institute Admin
 */
export async function submitWithdrawalRequest(
  data: Omit<TutorWithdrawalRequest, 'id' | 'createdAt' | 'status'>
): Promise<TutorWithdrawalRequest> {
  const cleanAmount = Math.round(Number(data.amount) || 0);
  if (cleanAmount <= 0) {
    throw new Error('Withdrawal amount must be greater than ₹0.');
  }
  if (data.paymentMethod === 'upi' && (!data.upiId || !data.upiId.includes('@'))) {
    throw new Error('Please enter a valid UPI ID (e.g., name@okaxis).');
  }
  if (
    data.paymentMethod === 'bank_transfer' &&
    (!data.bankDetails?.accountNumber || !data.bankDetails?.ifscCode || !data.bankDetails?.accountHolder)
  ) {
    throw new Error('Complete bank account holder, account number, and IFSC code are required.');
  }

  const id = 'WR-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(1000 + Math.random() * 9000);
  const newRequest: TutorWithdrawalRequest = stripUndefined({
    ...data,
    amount: cleanAmount,
    id,
    createdAt: new Date().toISOString(),
    status: 'pending'
  });

  // 1. Save to local storage for instant reactivity
  const list = getLocalWithdrawals();
  const updatedList = [newRequest, ...list.filter((r) => r.id !== id)];
  saveLocalWithdrawals(updatedList);

  // 2. Persist to Firestore: save in withdrawal_notices and withdrawal_requests
  try {
    const noticeDocRef = doc(db, 'withdrawal_notices', id);
    await setDoc(noticeDocRef, newRequest);

    const docRef = doc(db, 'withdrawal_requests', id);
    await setDoc(docRef, newRequest);
  } catch (err) {
    console.warn('[payoutService] Firestore write notice:', err);
  }

  return newRequest;
}

/**
 * Subscribe to withdrawal requests for a specific tutor
 */
export function subscribeToTutorWithdrawals(
  tutorId: string,
  tutorEmail: string | undefined,
  callback: (requests: TutorWithdrawalRequest[]) => void
): () => void {
  const candidateIds = expandTutorIdCandidates([tutorId]);
  const matchesTutor = (r: TutorWithdrawalRequest) =>
    candidateIds.includes(String(r.tutorId || '').trim()) ||
    Boolean(tutorEmail && r.tutorEmail?.toLowerCase() === tutorEmail.toLowerCase());

  let remoteRequests: TutorWithdrawalRequest[] = [];
  let remoteNotices: TutorWithdrawalRequest[] = [];
  let remoteComplete: TutorWithdrawalRequest[] = [];

  const emitMerged = () => {
    const localList = getLocalWithdrawals();
    const merged = deduplicateWithdrawals([
      ...remoteComplete,
      ...remoteNotices,
      ...remoteRequests,
      ...localList
    ]);
    saveLocalWithdrawals(merged);
    callback(merged.filter(matchesTutor));
  };

  emitMerged();

  try {
    const unsubReqs = onSnapshot(
      query(collection(db, 'withdrawal_requests')),
      (snapshot) => {
        remoteRequests = snapshot.docs.map((d) => d.data() as TutorWithdrawalRequest);
        emitMerged();
      },
      (err) => console.warn('[payoutService] Tutor withdrawal_requests listener notice:', err)
    );

    const unsubNotices = onSnapshot(
      query(collection(db, 'withdrawal_notices')),
      (snapshot) => {
        remoteNotices = snapshot.docs.map((d) => d.data() as TutorWithdrawalRequest);
        emitMerged();
      },
      (err) => console.warn('[payoutService] Tutor withdrawal_notices listener notice:', err)
    );

    const unsubComplete = onSnapshot(
      query(collection(db, 'complete_withdrawals')),
      (snapshot) => {
        remoteComplete = snapshot.docs.map((d) => d.data() as TutorWithdrawalRequest);
        emitMerged();
      },
      (err) => console.warn('[payoutService] Tutor complete_withdrawals listener notice:', err)
    );

    return () => {
      unsubReqs();
      unsubNotices();
      unsubComplete();
    };
  } catch (err) {
    console.warn('[payoutService] Listener setup notice:', err);
    return () => {};
  }
}

/**
 * Subscribe to all withdrawal requests for admin
 */
export function subscribeToAllWithdrawalRequests(
  callback: (requests: TutorWithdrawalRequest[]) => void
): () => void {
  let active = true;
  const emitLocal = () => {
    if (!active) return;
    const list = deduplicateWithdrawals(getLocalWithdrawals());
    callback(list);
  };
  emitLocal();

  const fallbackRest = () => {
    fetchFirestoreCollectionRest<TutorWithdrawalRequest>('withdrawal_requests')
      .then((restList) => {
        if (!active) return;
        const merged = deduplicateWithdrawals([...restList, ...getLocalWithdrawals()]);
        saveLocalWithdrawals(merged);
        callback(merged);
      })
      .catch(() => emitLocal());
  };

  try {
    const colRef = collection(db, 'withdrawal_requests');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (!active) return;
        const remoteList: TutorWithdrawalRequest[] = [];
        snapshot.forEach((d) => {
          remoteList.push({ id: d.id, ...(d.data() as TutorWithdrawalRequest) });
        });

        const merged = deduplicateWithdrawals([...remoteList, ...getLocalWithdrawals()]);
        saveLocalWithdrawals(merged);
        callback(merged);
      },
      (err) => {
        console.warn('[payoutService] Admin listener notice (using REST fallback):', err);
        fallbackRest();
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  } catch (err) {
    console.warn('[payoutService] Admin setup notice:', err);
    fallbackRest();
    return () => { active = false; };
  }
}

/**
 * Admin approves and completes a tutor withdrawal notice, recording UTR, exact amount, method, and slip
 */
export async function adminApproveWithdrawal(
  requestId: string,
  approvalData: {
    utrNumber: string;
    transferredAmount: number;
    transferMethod: string;
    paymentSlipUrl?: string;
    adminNote?: string;
    approvedBy?: string;
  },
  existingRequest?: TutorWithdrawalRequest
): Promise<TutorWithdrawalRequest> {
  const cleanAmount = Math.round(Number(approvalData.transferredAmount) || 0);
  if (cleanAmount <= 0) {
    throw new Error('Transferred amount must be greater than ₹0.');
  }
  const cleanUtr = approvalData.utrNumber.trim();
  if (cleanUtr.length < 6) {
    throw new Error('Please enter a valid Bank UTR / Transaction Reference ID (at least 6 characters).');
  }

  const updates = stripUndefined({
    status: 'approved' as const,
    approvedAt: new Date().toISOString(),
    approvedBy: approvalData.approvedBy || 'Kumari Institute Admin',
    utrNumber: cleanUtr,
    transferredAmount: cleanAmount,
    transferMethod: approvalData.transferMethod,
    paymentSlipUrl: approvalData.paymentSlipUrl || '',
    adminNote: approvalData.adminNote || ''
  });

  // 1. Resolve authoritative base record (passed object -> localStorage -> Firestore withdrawal_notices -> withdrawal_requests)
  const list = getLocalWithdrawals();
  let baseRecord: TutorWithdrawalRequest | undefined =
    existingRequest || list.find((item) => item.id === requestId);

  if (!baseRecord || !baseRecord.tutorName) {
    try {
      const noticeSnap = await getDoc(doc(db, 'withdrawal_notices', requestId));
      if (noticeSnap.exists()) {
        baseRecord = noticeSnap.data() as TutorWithdrawalRequest;
      } else {
        const reqSnap = await getDoc(doc(db, 'withdrawal_requests', requestId));
        if (reqSnap.exists()) {
          baseRecord = reqSnap.data() as TutorWithdrawalRequest;
        }
      }
    } catch (err) {
      console.warn('[payoutService] Lookup notice before approve:', err);
    }
  }

  const completeData: TutorWithdrawalRequest = stripUndefined({
    ...(baseRecord || ({ id: requestId, tutorId: '', tutorName: 'Tutor', amount: cleanAmount, paymentMethod: 'upi', createdAt: updates.approvedAt } as TutorWithdrawalRequest)),
    ...updates,
    id: requestId
  });

  // 2. Update local cache
  const updatedList = list.some((item) => item.id === requestId)
    ? list.map((item) => (item.id === requestId ? completeData : item))
    : [completeData, ...list];
  saveLocalWithdrawals(updatedList);

  // 3. Persist atomically across Firestore collections
  const completeDocRef = doc(db, 'complete_withdrawals', requestId);
  await setDoc(completeDocRef, completeData);

  const noticeDocRef = doc(db, 'withdrawal_notices', requestId);
  await deleteDoc(noticeDocRef).catch(() => {});

  const reqDocRef = doc(db, 'withdrawal_requests', requestId);
  await setDoc(reqDocRef, completeData, { merge: true }).catch(() =>
    updateDoc(reqDocRef, updates).catch(() => {})
  );

  return completeData;
}

/**
 * Admin rejects a withdrawal request and removes it from pending withdrawal_notices
 */
export async function adminRejectWithdrawal(
  requestId: string,
  reason?: string
): Promise<void> {
  const updates = {
    status: 'rejected' as const,
    approvedAt: new Date().toISOString(),
    adminNote: reason || 'Declined by Administrator'
  };

  const list = getLocalWithdrawals();
  const updated = list.map((item) =>
    item.id === requestId ? { ...item, ...updates } : item
  );
  saveLocalWithdrawals(updated);

  try {
    const noticeDocRef = doc(db, 'withdrawal_notices', requestId);
    await deleteDoc(noticeDocRef).catch(() => {});

    const docRef = doc(db, 'withdrawal_requests', requestId);
    await setDoc(docRef, updates, { merge: true }).catch(() =>
      updateDoc(docRef, updates).catch(() => {})
    );
  } catch (err) {
    console.warn('[payoutService] Firestore reject notice:', err);
  }
}

/**
 * Real-time listener specifically for pending tutor requests in Firestore collection 'withdrawal_notices'
 */
export function subscribeToWithdrawalNotices(
  callback: (notices: TutorWithdrawalRequest[]) => void
): () => void {
  let active = true;
  const fallbackRest = () => {
    fetchFirestoreCollectionRest<TutorWithdrawalRequest>('withdrawal_notices')
      .then((notices) => {
        if (!active) return;
        notices.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        callback(notices);
      })
      .catch(() => {});
  };
  try {
    const colRef = collection(db, 'withdrawal_notices');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (!active) return;
        const notices: TutorWithdrawalRequest[] = [];
        snapshot.forEach((d) => {
          notices.push({ id: d.id, ...(d.data() as TutorWithdrawalRequest) });
        });
        notices.sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        callback(notices);
      },
      (err) => {
        console.warn('[payoutService] withdrawal_notices listener notice (using REST fallback):', err);
        fallbackRest();
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  } catch (err) {
    console.warn('[payoutService] subscribeToWithdrawalNotices error:', err);
    fallbackRest();
    return () => { active = false; };
  }
}

/**
 * Real-time listener specifically for accepted tutor payouts in Firestore collection 'complete_withdrawals'
 */
export function subscribeToCompleteWithdrawals(
  callback: (withdrawals: TutorWithdrawalRequest[]) => void
): () => void {
  let active = true;
  const fallbackRest = () => {
    fetchFirestoreCollectionRest<TutorWithdrawalRequest>('complete_withdrawals')
      .then((list) => {
        if (!active) return;
        list.sort(
          (a, b) =>
            new Date(b.approvedAt || b.createdAt || 0).getTime() -
            new Date(a.approvedAt || a.createdAt || 0).getTime()
        );
        callback(list);
      })
      .catch(() => {});
  };
  try {
    const colRef = collection(db, 'complete_withdrawals');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        if (!active) return;
        const list: TutorWithdrawalRequest[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...(d.data() as TutorWithdrawalRequest) });
        });
        list.sort(
          (a, b) =>
            new Date(b.approvedAt || b.createdAt || 0).getTime() -
            new Date(a.approvedAt || a.createdAt || 0).getTime()
        );
        callback(list);
      },
      (err) => {
        console.warn('[payoutService] complete_withdrawals listener notice (using REST fallback):', err);
        fallbackRest();
      }
    );
    return () => {
      active = false;
      unsubscribe();
    };
  } catch (err) {
    console.warn('[payoutService] subscribeToCompleteWithdrawals error:', err);
    fallbackRest();
    return () => { active = false; };
  }
}
