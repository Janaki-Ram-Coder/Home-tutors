import React, { useState } from 'react';
import {
  CreditCard,
  Search,
  CheckCircle2,
  Calendar,
  Clock,
  User,
  GraduationCap,
  Download,
  Printer,
  Filter,
  ArrowUpRight,
  Receipt,
  Phone,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  X,
  Lock
} from 'lucide-react';
import {
  ReceivedFeeRecord,
  formatINR,
  verifyFeeRecordByAdmin
} from '../services/feePaymentService';
import { useBackButtonDismiss } from '../hooks/useBackButtonDismiss';

interface AdminReceivedFeeTabProps {
  receivedFees: ReceivedFeeRecord[];
  isLoading?: boolean;
  onRefresh?: () => void;
}

export const AdminReceivedFeeTab: React.FC<AdminReceivedFeeTabProps> = ({
  receivedFees,
  isLoading = false,
  onRefresh
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [parentFilter, setParentFilter] = useState('');
  const [studentFilter, setStudentFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [datePreset, setDatePreset] = useState<'all' | 'today' | 'this_week' | 'this_month' | 'custom'>('all');
  const [methodFilter, setMethodFilter] = useState<
    'all' | 'UPI' | 'PhonePe / GPay' | 'Net Banking' | 'Debit/Credit Card' | 'Wallet' | 'Cash / Institute Desk'
  >('all');
  const [selectedFeeModal, setSelectedFeeModal] = useState<ReceivedFeeRecord | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isVerifyingFeeId, setIsVerifyingFeeId] = useState<string | null>(null);
  const [liveGatewayCheck, setLiveGatewayCheck] = useState<{
    paymentId: string;
    status: string;
    methodDetail: string;
    acquirerRef?: string;
  } | null>(null);
  const [isCheckingLiveGateway, setIsCheckingLiveGateway] = useState(false);
  const [verifyFeedback, setVerifyFeedback] = useState<string | null>(null);

  useBackButtonDismiss(Boolean(selectedFeeModal), 'admin-fee-detail-modal', () =>
    setSelectedFeeModal(null)
  );

  // Quick Date Preset Handler
  const handleDatePresetChange = (preset: 'all' | 'today' | 'this_week' | 'this_month' | 'custom') => {
    setDatePreset(preset);
    const now = new Date();
    const toISODate = (d: Date) => d.toISOString().split('T')[0];

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
    } else if (preset === 'today') {
      const todayStr = toISODate(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
    } else if (preset === 'this_week') {
      const dayOfWeek = now.getDay();
      const firstDay = new Date(now);
      firstDay.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1)); // Monday
      setStartDate(toISODate(firstDay));
      setEndDate(toISODate(now));
    } else if (preset === 'this_month') {
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toISODate(firstDayOfMonth));
      setEndDate(toISODate(now));
    }
  };

  // Helper to extract comparable date (YYYY-MM-DD) from fee record
  const getFeeDateStr = (fee: ReceivedFeeRecord): string | null => {
    if (fee.paidAt) {
      try {
        const d = new Date(fee.paidAt);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      } catch {
        // ignore
      }
    }
    if (fee.createdAt) {
      try {
        const d = new Date(fee.createdAt);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      } catch {
        // ignore
      }
    }
    if (fee.paidDate) {
      try {
        const d = new Date(fee.paidDate);
        if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      } catch {
        // ignore
      }
    }
    return null;
  };

  // Filter fees based on parent name, student name, date range, search query, and payment method
  const filteredFees = receivedFees.filter((fee) => {
    // 1. Payment method filter
    if (methodFilter !== 'all' && fee.paymentMethod !== methodFilter) {
      return false;
    }

    // 2. Specific Parent Name filter
    if (parentFilter.trim()) {
      const pQuery = parentFilter.toLowerCase().trim();
      if (!(fee.parentName || '').toLowerCase().includes(pQuery)) {
        return false;
      }
    }

    // 3. Specific Student Name filter
    if (studentFilter.trim()) {
      const sQuery = studentFilter.toLowerCase().trim();
      if (!(fee.studentName || '').toLowerCase().includes(sQuery)) {
        return false;
      }
    }

    // 4. Date Range filter (startDate & endDate)
    if (startDate || endDate) {
      const feeDateStr = getFeeDateStr(fee);
      if (feeDateStr) {
        if (startDate && feeDateStr < startDate) {
          return false;
        }
        if (endDate && feeDateStr > endDate) {
          return false;
        }
      }
    }

    // 5. General search bar keyword query
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const parentNameMatch = (fee.parentName || '').toLowerCase().includes(q);
      const studentNameMatch = (fee.studentName || '').toLowerCase().includes(q);
      const tutorNameMatch = (fee.tutorName || '').toLowerCase().includes(q);
      const receiptNoMatch = (fee.receiptNo || '').toLowerCase().includes(q);
      const txnMatch = (fee.transactionId || '').toLowerCase().includes(q);
      const rzpPayMatch = (fee.razorpayPaymentId || '').toLowerCase().includes(q);
      const rzpOrderMatch = (fee.razorpayOrderId || '').toLowerCase().includes(q);
      const methodDetailMatch = (fee.paymentMethodDetail || '').toLowerCase().includes(q);
      const acquirerMatch = (fee.acquirerRef || '').toLowerCase().includes(q);
      const phoneMatch = (fee.parentPhone || '').toLowerCase().includes(q);
      const emailMatch = (fee.parentEmail || '').toLowerCase().includes(q);
      const subjectsMatch = (fee.tutorSubjects || '').toLowerCase().includes(q);
      const periodMatch = (fee.billingPeriod || '').toLowerCase().includes(q);

      if (
        !parentNameMatch &&
        !studentNameMatch &&
        !tutorNameMatch &&
        !receiptNoMatch &&
        !txnMatch &&
        !rzpPayMatch &&
        !rzpOrderMatch &&
        !methodDetailMatch &&
        !acquirerMatch &&
        !phoneMatch &&
        !emailMatch &&
        !subjectsMatch &&
        !periodMatch
      ) {
        return false;
      }
    }

    return true;
  });

  // Calculate stats for current filtered set vs all records
  const totalCollectedFiltered = filteredFees.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const isAnyFilterActive = Boolean(
    searchTerm.trim() ||
      parentFilter.trim() ||
      studentFilter.trim() ||
      startDate ||
      endDate ||
      methodFilter !== 'all' ||
      datePreset !== 'all'
  );

  const clearAllFilters = () => {
    setSearchTerm('');
    setParentFilter('');
    setStudentFilter('');
    setStartDate('');
    setEndDate('');
    setDatePreset('all');
    setMethodFilter('all');
  };

  // Calculate cumulative stats
  const totalCollected = receivedFees.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const totalTransactions = receivedFees.length;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleVerifyFeeByAdmin = async (
    fee: ReceivedFeeRecord,
    status: 'verified_by_admin' | 'flagged'
  ) => {
    setIsVerifyingFeeId(fee.id);
    setVerifyFeedback(null);
    try {
      await verifyFeeRecordByAdmin(fee.id, status);
      const updated = {
        ...fee,
        adminVerificationStatus: status,
        verifiedByAdminAt: new Date().toISOString()
      };
      setSelectedFeeModal(updated);
      setVerifyFeedback(
        status === 'verified_by_admin'
          ? 'Payment marked Verified by Admin and saved to Firestore.'
          : 'Payment flagged for audit review.'
      );
      if (onRefresh) onRefresh();
    } catch (err: any) {
      setVerifyFeedback(err?.message || 'Unable to update verification status.');
    } finally {
      setIsVerifyingFeeId(null);
    }
  };

  const handleCheckLiveRazorpayStatus = async (paymentId: string) => {
    if (!paymentId) return;
    setIsCheckingLiveGateway(true);
    setVerifyFeedback(null);
    try {
      const res = await fetch(`/api/payments/razorpay/payment/${encodeURIComponent(paymentId)}`);
      const data = await res.json();
      if (res.ok && data?.success && data?.payment) {
        setLiveGatewayCheck({
          paymentId: data.payment.id,
          status: data.payment.status,
          methodDetail: data.payment.methodDetail,
          acquirerRef: data.payment.acquirerRef
        });
      } else {
        setVerifyFeedback(data?.message || 'Unable to fetch live Razorpay status.');
      }
    } catch (err: any) {
      setVerifyFeedback(err?.message || 'Error contacting Razorpay API.');
    } finally {
      setIsCheckingLiveGateway(false);
    }
  };


  return (
    <div className="space-y-6">
      {/* Top Banner / Stat Cards */}
      <div className="bg-slate-800/80 rounded-3xl p-6 border border-slate-700/80 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Received Fees Desk
              </h2>
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">
                Cloud Firestore Real-Time Sync
              </span>
            </div>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 max-w-2xl leading-relaxed">
            All parent tuition fee transactions paid online or recorded at the institute desk. Inspect paying parent, child details, assigned educator, exact date &amp; timestamp, Razorpay verification IDs, and 30-day billing cycles. Tutor payouts are processed separately once tutors submit Withdrawal Notices.
          </p>
        </div>

        {/* Global Summary KPI Pills */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3">
          <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-700/80 min-w-[150px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Total Fees Collected
            </span>
            <div className="text-xl sm:text-2xl font-black text-emerald-400">
              {formatINR(totalCollected)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">
              Cumulative Parent Inflows
            </span>
          </div>

          <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-700/80 min-w-[130px]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Verified Receipts
            </span>
            <div className="text-xl sm:text-2xl font-black text-white">
              {totalTransactions}
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold mt-0.5 block">
              ✓ Active Tuition Cycles
            </span>
          </div>

          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="p-3.5 rounded-2xl bg-slate-900 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer self-stretch flex items-center justify-center"
              title="Refresh received fees from Cloud Firestore"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          )}
        </div>
      </div>


      {/* Search and Advanced Filter Panel for Parent Name, Student Name, Date Range, & Mode */}
      <div className="bg-slate-850/80 rounded-2xl border border-slate-700/80 p-4 space-y-3.5 shadow-lg">
        {/* Row 1: Quick Search Bar + Filter Status / Summary */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* General Keyword Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Quick search by receipt no, UTR, parent, student, tutor, phone, or billing cycle..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/90 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/80 focus:border-emerald-400/80 transition-all shadow-inner"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 text-xs"
                title="Clear quick search"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Status Badge & Reset All Button */}
          <div className="flex items-center gap-2 shrink-0">
            {isAnyFilterActive ? (
              <>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <Filter className="w-3.5 h-3.5" />
                  <span>
                    Showing {filteredFees.length} of {receivedFees.length} payments ({formatINR(totalCollectedFiltered)})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-bold transition-all cursor-pointer"
                  title="Reset all filters to default"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Reset Filters</span>
                </button>
              </>
            ) : (
              <div className="text-xs text-slate-400 font-medium px-1">
                Showing all {receivedFees.length} payments ({formatINR(totalCollected)})
              </div>
            )}
          </div>
        </div>

        {/* Row 2: Specific Filters - Parent Name, Student Name, & Date Range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 pt-2 border-t border-slate-750/80">
          {/* Filter by Parent Name */}
          <div className="lg:col-span-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <User className="w-3 h-3 text-emerald-400" />
              <span>Parent Name</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Filter by parent name..."
                value={parentFilter}
                onChange={(e) => setParentFilter(e.target.value)}
                className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all ${
                  parentFilter.trim() ? 'border-emerald-500/70 bg-emerald-950/20' : 'border-slate-700'
                }`}
              />
              {parentFilter && (
                <button
                  type="button"
                  onClick={() => setParentFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Filter by Student Name */}
          <div className="lg:col-span-3">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <GraduationCap className="w-3 h-3 text-cyan-400" />
              <span>Student Name</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Filter by student name..."
                value={studentFilter}
                onChange={(e) => setStudentFilter(e.target.value)}
                className={`w-full bg-slate-900 border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all ${
                  studentFilter.trim() ? 'border-cyan-500/70 bg-cyan-950/20' : 'border-slate-700'
                }`}
              />
              {studentFilter && (
                <button
                  type="button"
                  onClick={() => setStudentFilter('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Filter by Date Range: From & To */}
          <div className="lg:col-span-4 sm:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-amber-400" />
                <span>Date Range (Payment Date)</span>
              </span>
              {(startDate || endDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                    setDatePreset('all');
                  }}
                  className="text-[10px] text-amber-400 hover:text-amber-300 underline font-normal"
                >
                  Clear dates
                </button>
              )}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className={`w-full bg-slate-900 border rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all ${
                    startDate ? 'border-amber-500/70 bg-amber-950/20' : 'border-slate-700'
                  }`}
                  title="From date"
                />
              </div>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setDatePreset('custom');
                  }}
                  className={`w-full bg-slate-900 border rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all ${
                    endDate ? 'border-amber-500/70 bg-amber-950/20' : 'border-slate-700'
                  }`}
                  title="To date"
                />
              </div>
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="lg:col-span-2 sm:col-span-2 flex flex-col justify-end">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
              Quick Presets
            </span>
            <div className="flex items-center gap-1 flex-wrap">
              {(
                [
                  { id: 'today', label: 'Today' },
                  { id: 'this_week', label: 'This Week' },
                  { id: 'this_month', label: 'This Month' }
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleDatePresetChange(p.id)}
                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                    datePreset === p.id
                      ? 'bg-amber-400 text-slate-950 font-black shadow-xs'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-750'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Payment Method Filter Pills */}
        <div className="pt-2 border-t border-slate-750/80 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0 flex items-center gap-1">
              <CreditCard className="w-3 h-3 text-slate-400" />
              <span>Mode:</span>
            </span>
            {(
              [
                { id: 'all', label: 'All Modes' },
                { id: 'UPI', label: 'UPI' },
                { id: 'PhonePe / GPay', label: 'PhonePe / GPay' },
                { id: 'Net Banking', label: 'Net Banking' },
                { id: 'Debit/Credit Card', label: 'Cards' },
                { id: 'Wallet', label: 'Wallets' },
                { id: 'Cash / Institute Desk', label: 'Desk / Cash' }
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethodFilter(m.id as any)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  methodFilter === m.id
                    ? 'bg-emerald-500 text-slate-950 shadow-md font-black'
                    : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-700/60'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Active Filter Pills Display */}
          {(parentFilter || studentFilter || startDate || endDate || datePreset !== 'all' || methodFilter !== 'all') && (
            <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
              {parentFilter && (
                <span className="inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md">
                  Parent: {parentFilter}
                  <button type="button" onClick={() => setParentFilter('')} className="hover:text-white ml-0.5">✕</button>
                </span>
              )}
              {studentFilter && (
                <span className="inline-flex items-center gap-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-md">
                  Student: {studentFilter}
                  <button type="button" onClick={() => setStudentFilter('')} className="hover:text-white ml-0.5">✕</button>
                </span>
              )}
              {(startDate || endDate) && (
                <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md">
                  Dates: {startDate || 'Start'} to {endDate || 'End'}
                  <button type="button" onClick={() => { setStartDate(''); setEndDate(''); setDatePreset('all'); }} className="hover:text-white ml-0.5">✕</button>
                </span>
              )}
              {methodFilter !== 'all' && (
                <span className="inline-flex items-center gap-1 bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-md">
                  Mode: {methodFilter}
                  <button type="button" onClick={() => setMethodFilter('all')} className="hover:text-white ml-0.5">✕</button>
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Received Fees Table */}
      {filteredFees.length === 0 ? (
        <div className="bg-slate-800/40 rounded-3xl p-12 text-center border border-slate-700/60 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 text-slate-400 mx-auto flex items-center justify-center">
            <Receipt className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Received Fee Records Found</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {isAnyFilterActive
              ? 'No transactions matched your specified search or filter criteria. Try clearing parent, student, date range, or keyword filters.'
              : 'When parents click "Pay Fee" on the portal or pay online, their transaction receipt will automatically populate here in real-time.'}
          </p>
          {isAnyFilterActive && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-slate-800/70 rounded-3xl border border-slate-700/80 overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900/90 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-700/80">
                <tr>
                  <th className="py-3.5 px-4">Receipt / Date</th>
                  <th className="py-3.5 px-4">Parent Details</th>
                  <th className="py-3.5 px-4">Student &amp; Class</th>
                  <th className="py-3.5 px-4">Assigned Tutor</th>
                  <th className="py-3.5 px-4">Amount Paid</th>
                  <th className="py-3.5 px-4">Gateway &amp; Verification IDs</th>
                  <th className="py-3.5 px-4">Next Due (30 Days)</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/60">
                {filteredFees.map((fee) => (
                  <tr
                    key={fee.id}
                    className="hover:bg-slate-750/50 transition-colors group"
                  >
                    {/* Receipt No & Timestamp */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-white">
                        <span>{fee.receiptNo}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(fee.receiptNo, fee.id)}
                          className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
                          title="Copy Receipt No"
                        >
                          {copiedId === fee.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{fee.paidDate} • {fee.paidTime}</span>
                      </div>
                    </td>

                    {/* Parent Name & Phone */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <User className="w-3 h-3 text-emerald-400" />
                        <span>{fee.parentName}</span>
                      </div>
                      {fee.parentPhone && (
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{fee.parentPhone}</span>
                        </div>
                      )}
                    </td>

                    {/* Student Name & Grade */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-amber-300">
                        {fee.studentName}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {fee.studentGrade || 'Class'}
                      </span>
                    </td>

                    {/* Assigned Tutor */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <GraduationCap className="w-3 h-3 text-blue-400" />
                        <span>{fee.tutorName}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        {fee.tutorSubjects || 'Home Tuition'}
                      </span>
                    </td>

                    {/* Amount & Verification Badge */}
                    <td className="py-3.5 px-4 font-mono font-black text-emerald-400 text-sm tabular-nums">
                      <span>{fee.formattedAmount || formatINR(fee.amount)}</span>
                      {fee.adminVerificationStatus === 'verified_by_admin' ? (
                        <span className="block text-[10px] font-bold text-emerald-300 uppercase">
                          ✓ Admin Verified
                        </span>
                      ) : fee.signatureVerified ? (
                        <span className="block text-[10px] font-bold text-sky-300 uppercase">
                          ✓ Razorpay HMAC Verified
                        </span>
                      ) : fee.adminVerificationStatus === 'flagged' ? (
                        <span className="block text-[10px] font-bold text-rose-400 uppercase">
                          ⚠ Flagged Review
                        </span>
                      ) : (
                        <span className="block text-[10px] font-bold text-emerald-300/80 uppercase">
                          ✓ Verified Paid
                        </span>
                      )}
                    </td>

                    {/* Payment Gateway, Razorpay IDs & Method */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {fee.paymentGateway === 'Razorpay' || fee.razorpayPaymentId ? (
                          <span className="px-1.5 py-0.5 rounded bg-sky-500/15 border border-sky-400/30 text-sky-300 text-[10px] font-bold">
                            Razorpay
                          </span>
                        ) : null}
                        <span className="font-semibold text-slate-200 text-xs">
                          {fee.paymentMethodDetail || fee.paymentMethod}
                        </span>
                      </div>
                      {(fee.razorpayPaymentId || fee.transactionId) && (
                        <div
                          className="text-[10px] font-mono text-slate-300 truncate max-w-[175px] mt-0.5"
                          title={fee.razorpayPaymentId || fee.transactionId}
                        >
                          Pay ID: {fee.razorpayPaymentId || fee.transactionId}
                        </div>
                      )}
                      {fee.razorpayOrderId && (
                        <div
                          className="text-[10px] font-mono text-slate-400 truncate max-w-[175px]"
                          title={fee.razorpayOrderId}
                        >
                          Order: {fee.razorpayOrderId}
                        </div>
                      )}
                    </td>

                    {/* Next Due (30 Days) */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 text-slate-300 text-xs">
                        <Calendar className="w-3.5 h-3.5 text-blue-400" />
                        <span>{fee.nextDueDate}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 block">30-day cycle</span>
                    </td>

                    {/* Actions: Verify / Receipt Modal */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setLiveGatewayCheck(null);
                            setVerifyFeedback(null);
                            setSelectedFeeModal(fee);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-750 text-slate-200 border border-slate-700 text-[11px] font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                          title="Inspect Razorpay Verification & Receipt"
                        >
                          <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Verify / Receipt</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          RECEIPT VOUCHER PREVIEW LIGHTBOX (Includes Nav Logo & Approve Action)
         ========================================================================= */}
      {selectedFeeModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => e.target === e.currentTarget && setSelectedFeeModal(null)}
        >
          <div className="bg-slate-900 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-700 overflow-hidden relative my-6 text-left flex flex-col">
            {/* Header with Top Nav Bar Logo */}
            <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-slate-950 p-5 sm:p-6 text-white border-b border-slate-800 relative">
              <button
                type="button"
                onClick={() => setSelectedFeeModal(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer ring-1 ring-white/20"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-2">
                <img
                  src="/Logo/kumarilogo.png"
                  alt="Kumari Institute"
                  className="h-10 w-auto max-w-[150px] object-contain p-[2px]"
                  style={{ padding: '2px' }}
                  referrerPolicy="no-referrer"
                />
                <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Verified Tuition Voucher</span>
                </div>
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Kumari Institute Fee Voucher
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Rayagada, Odisha • Official Student Fee Record
              </p>
            </div>

            {/* Receipt Details */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs text-slate-300">
              <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Receipt No:</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {selectedFeeModal.receiptNo}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Paid Date &amp; Time:</span>
                  <span className="font-semibold text-slate-200">
                    {selectedFeeModal.paidDate} at {selectedFeeModal.paidTime}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Paying Parent:</span>
                  <span className="font-bold text-white">{selectedFeeModal.parentName}</span>
                </div>
                {selectedFeeModal.parentPhone && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Parent Phone:</span>
                    <span className="font-medium text-slate-300">
                      {selectedFeeModal.parentPhone}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Student:</span>
                  <span className="font-bold text-amber-300">
                    {selectedFeeModal.studentName} ({selectedFeeModal.studentGrade || 'Class'})
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Assigned Educator:</span>
                  <span className="font-bold text-blue-300">{selectedFeeModal.tutorName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Payment Mode:</span>
                  <span className="font-semibold text-emerald-400">
                    {selectedFeeModal.paymentMethodDetail || selectedFeeModal.paymentMethod}
                  </span>
                </div>
                {selectedFeeModal.transactionId && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Txn / Payment Ref:</span>
                    <span className="font-mono text-slate-300">
                      {selectedFeeModal.transactionId}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Next Billing Renewal:</span>
                  <span className="font-bold text-blue-400">
                    {selectedFeeModal.nextDueDate} (30 Days)
                  </span>
                </div>

                <div className="flex justify-between items-baseline font-bold pt-3 border-t border-slate-800 text-sm">
                  <span className="text-white">Amount Paid:</span>
                  <span className="text-2xl font-black text-emerald-400 tabular-nums">
                    {selectedFeeModal.formattedAmount || formatINR(selectedFeeModal.amount)}
                  </span>
                </div>
              </div>

              {/* Razorpay Gateway Verification & Audit Card */}
              <div className="p-4 rounded-2xl bg-sky-950/30 border border-sky-500/30 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-sky-300">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Razorpay Gateway Verification Details</span>
                  </span>
                  {selectedFeeModal.signatureVerified ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold">
                      ✓ HMAC-SHA256 Verified
                    </span>
                  ) : null}
                </div>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400">Gateway:</span>
                    <span className="font-bold text-white">
                      {selectedFeeModal.paymentGateway || (selectedFeeModal.razorpayPaymentId ? 'Razorpay' : 'Institute Desk')}
                    </span>
                  </div>
                  {selectedFeeModal.razorpayPaymentId && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400">Razorpay Payment ID:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-sky-300">
                          {selectedFeeModal.razorpayPaymentId}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedFeeModal.razorpayPaymentId!, 'rzp-pay')}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Copy Payment ID"
                        >
                          {copiedId === 'rzp-pay' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  )}
                  {selectedFeeModal.razorpayOrderId && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400">Razorpay Order ID:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-slate-200">
                          {selectedFeeModal.razorpayOrderId}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(selectedFeeModal.razorpayOrderId!, 'rzp-ord')}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                          title="Copy Order ID"
                        >
                          {copiedId === 'rzp-ord' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  )}
                  {selectedFeeModal.gatewayPaymentStatus && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400">Gateway Status:</span>
                      <span className="font-bold uppercase text-emerald-300">
                        {selectedFeeModal.gatewayPaymentStatus}
                      </span>
                    </div>
                  )}
                  {selectedFeeModal.acquirerRef && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400">Bank / UPI RRN:</span>
                      <span className="font-mono text-slate-200">{selectedFeeModal.acquirerRef}</span>
                    </div>
                  )}
                  {(selectedFeeModal.payerEmail || selectedFeeModal.payerContact) && (
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400">Gateway Contact / Email:</span>
                      <span className="text-slate-200 truncate max-w-[240px]">
                        {[selectedFeeModal.payerContact, selectedFeeModal.payerEmail].filter(Boolean).join(' • ')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center gap-2">
                    <span className="text-slate-400">Admin Verification:</span>
                    <span
                      className={`font-bold ${
                        selectedFeeModal.adminVerificationStatus === 'verified_by_admin'
                          ? 'text-emerald-300'
                          : selectedFeeModal.adminVerificationStatus === 'flagged'
                          ? 'text-rose-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {selectedFeeModal.adminVerificationStatus === 'verified_by_admin'
                        ? 'Confirmed by Admin'
                        : selectedFeeModal.adminVerificationStatus === 'flagged'
                        ? 'Flagged for Review'
                        : 'Pending Admin Confirmation'}
                    </span>
                  </div>
                </div>

                {liveGatewayCheck && (
                  <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-[11px]">
                    <strong>Live Razorpay API Status:</strong>{' '}
                    <span className="uppercase font-bold">{liveGatewayCheck.status}</span> ·{' '}
                    {liveGatewayCheck.methodDetail}
                    {liveGatewayCheck.acquirerRef ? ` · RRN: ${liveGatewayCheck.acquirerRef}` : ''}
                  </div>
                )}

                {verifyFeedback && (
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sky-300 text-[11px]">
                    {verifyFeedback}
                  </div>
                )}

                {/* Admin Verification & Billing Reminder Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {selectedFeeModal.adminVerificationStatus !== 'verified_by_admin' && (
                    <button
                      type="button"
                      disabled={isVerifyingFeeId === selectedFeeModal.id}
                      onClick={() => handleVerifyFeeByAdmin(selectedFeeModal, 'verified_by_admin')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isVerifyingFeeId === selectedFeeModal.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      )}
                      <span>Mark Verified by Admin</span>
                    </button>
                  )}
                  {selectedFeeModal.razorpayPaymentId && (
                    <button
                      type="button"
                      disabled={isCheckingLiveGateway}
                      onClick={() => handleCheckLiveRazorpayStatus(selectedFeeModal.razorpayPaymentId!)}
                      className="px-3 py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 border border-sky-400/40 text-sky-200 font-bold text-[11px] cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isCheckingLiveGateway ? 'animate-spin' : ''}`} />
                      <span>Verify Live via Razorpay API</span>
                    </button>
                  )}
                </div>
              </div>

              {selectedFeeModal.notes && (
                <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/80 text-slate-300 text-xs">
                  <strong className="block text-slate-400 mb-0.5">Fee Notes:</strong>
                  <span>{selectedFeeModal.notes}</span>
                </div>
              )}

              {/* Bottom Actions */}
              <div className="flex items-center justify-between pt-2 gap-2 flex-wrap">
                <span className="text-[11px] text-slate-400">
                  80% Tutor Share: <strong className="text-emerald-400">{formatINR(Math.round((selectedFeeModal.amount || 0) * 0.8))}</strong> · 20% Institute Fee: <strong className="text-slate-200">{formatINR((selectedFeeModal.amount || 0) - Math.round((selectedFeeModal.amount || 0) * 0.8))}</strong>
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedFeeModal(null)}
                    className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 font-bold text-xs hover:bg-slate-800 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-semibold text-xs cursor-pointer shadow-xs flex items-center gap-1.5 border border-slate-700"
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

    </div>
  );
};
