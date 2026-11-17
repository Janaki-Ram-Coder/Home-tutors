import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  Calendar,
  Loader2,
  AlertCircle,
  Lock
} from 'lucide-react';
import { AppUserProfile } from '../services/firebaseAuth';
import {
  formatINR,
  processParentFeePayment,
  ReceivedFeeRecord,
  TUITION_CYCLE_DAYS,
  FeePaymentMethod
} from '../services/feePaymentService';
import { useBackButtonDismiss } from '../hooks/useBackButtonDismiss';

interface PayTutorFeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: any;
  currentUser: AppUserProfile;
  onPaymentSuccess: (record: ReceivedFeeRecord, receipt: any) => void;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

let razorpayScriptPromise: Promise<boolean> | null = null;

function loadRazorpayCheckoutScript(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.Razorpay) {
    return Promise.resolve(true);
  }
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => {
      razorpayScriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return razorpayScriptPromise;
}

export const PayTutorFeeModal: React.FC<PayTutorFeeModalProps> = ({
  isOpen,
  onClose,
  booking,
  currentUser,
  onPaymentSuccess
}) => {
  const [statusStep, setStatusStep] = useState<
    'idle' | 'creating_order' | 'checkout_open' | 'verifying'
  >('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadRazorpayCheckoutScript();
      setErrorMsg(null);
      setStatusStep('idle');
    }
  }, [isOpen, currentUser, booking]);

  useBackButtonDismiss(isOpen && statusStep === 'idle', 'pay-tutor-fee-modal', onClose);

  if (!isOpen || !booking) return null;

  const isBusy = statusStep !== 'idle';

  const payerName = (
    currentUser?.name ||
    (currentUser as any)?.fullName ||
    booking?.parentName ||
    'Parent'
  ).trim();
  const payerEmail = (currentUser?.email || booking?.parentEmail || '').trim();
  const payerPhone = (currentUser?.phone || booking?.parentPhone || '').trim();

  const tutorName =
    booking.assignedTutorName ||
    booking.requestedTutorName ||
    booking.tutorName ||
    booking.name ||
    'Assigned Home Tutor';

  const tutorId =
    booking.assignedTutorId || booking.requestedTutorId || booking.tutorId || booking.id || '';

  const tutorFee = Number(
    booking.assignedTutorFee ||
      booking.requestedTutorMonthlyFee ||
      booking.monthlyFee ||
      booking.fee ||
      3000
  );

  const studentName =
    booking.studentName || currentUser.childName || currentUser.name || 'Student';
  const studentGrade = booking.studentGrade || currentUser.childGrade || 'All Classes';
  const tutorSubjects = Array.isArray(booking.subjects)
    ? booking.subjects.join(', ')
    : booking.subjects || 'Home Tuition';

  const handleRazorpayCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!Number.isFinite(tutorFee) || tutorFee <= 0) {
      setErrorMsg('Invalid monthly tuition fee amount.');
      return;
    }

    setStatusStep('creating_order');

    try {
      const scriptReady = await loadRazorpayCheckoutScript();
      if (!scriptReady || !window.Razorpay) {
        setErrorMsg(
          'Unable to load Razorpay Checkout SDK. Please check your internet connection and retry.'
        );
        setStatusStep('idle');
        return;
      }

      // 1. Create authentic Razorpay Order on server
      const receiptRef = `KI_${Date.now()}_${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const orderRes = await fetch('/api/payments/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: tutorFee,
          receipt: receiptRef,
          bookingId: booking.id || '',
          tutorId,
          tutorName,
          parentUid: currentUser.uid || '',
          parentName: payerName,
          studentName
        })
      });

      const orderData = await orderRes.json().catch(() => null);
      if (!orderRes.ok || !orderData?.success || !orderData?.orderId || !orderData?.keyId) {
        const msg =
          orderData?.message ||
          `Unable to start Razorpay checkout (HTTP ${orderRes.status}). Please try again.`;
        console.warn('[PayTutorFeeModal] Razorpay order initialization notice:', msg);
        setErrorMsg(msg);
        setStatusStep('idle');
        return;
      }

      const cleanPhone = payerPhone.replace(/[^\d+]/g, '').slice(-10);

      // 2. Open Razorpay Checkout Overlay
      setStatusStep('checkout_open');

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'Kumari Institute',
        description: `Monthly Home Tuition (${TUITION_CYCLE_DAYS} Days) - ${tutorName}`,
        image: `${window.location.origin}/Logo/kumarilogo.png`,
        order_id: orderData.orderId,
        prefill: {
          name: payerName,
          email: payerEmail,
          contact: cleanPhone
        },
        notes: {
          bookingId: String(booking.id || ''),
          tutorName: String(tutorName),
          studentName: String(studentName),
          cycleDays: `${TUITION_CYCLE_DAYS} Days`
        },
        theme: {
          color: '#0c2340'
        },
        modal: {
          ondismiss: () => {
            setStatusStep('idle');
          }
        },
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          setStatusStep('verifying');
          try {
            // 3. Verify payment HMAC-SHA256 signature & fetch authoritative gateway details on server
            const verifyRes = await fetch('/api/payments/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                parentName: payerName,
                studentName,
                tutorName,
                amount: tutorFee
              })
            });

            const verifyData = await verifyRes.json().catch(() => null);
            if (!verifyRes.ok || !verifyData?.verified) {
              const verifyErrMsg =
                verifyData?.message || 'Razorpay signature verification failed. Please contact support.';
              console.warn('[PayTutorFeeModal] Razorpay verification notice:', verifyErrMsg);
              setErrorMsg(verifyErrMsg);
              setStatusStep('idle');
              return;
            }

            const mappedMethod: FeePaymentMethod =
              verifyData.paymentMethodLabel || 'UPI';

            // 4. Persist verified fee record to Firestore received_fees, parents & tutor_bookings
            const saved = await processParentFeePayment({
              parentUser: {
                ...currentUser,
                name: payerName,
                email: payerEmail,
                phone: payerPhone
              },
              booking,
              amount: tutorFee,
              paymentMethod: mappedMethod,
              utrNumber: verifyData.razorpayPaymentId,
              paymentGateway: 'Razorpay',
              razorpayOrderId: verifyData.razorpayOrderId,
              razorpayPaymentId: verifyData.razorpayPaymentId,
              razorpaySignature: verifyData.razorpaySignature,
              signatureVerified: true,
              gatewayPaymentStatus: verifyData.gatewayStatus || 'captured',
              paymentMethodDetail: verifyData.paymentMethodDetail || 'Razorpay Online',
              acquirerRef: verifyData.acquirerRef || '',
              payerEmail: verifyData.paidEmail || payerEmail,
              payerContact: verifyData.paidContact || payerPhone
            });

            setStatusStep('idle');
            if (saved.success) {
              onPaymentSuccess(saved.record, saved.receipt);
            } else {
              setErrorMsg('Payment verified, but saving local receipt failed. Please refresh.');
            }
          } catch (verifyErr: any) {
            console.warn('[PayTutorFeeModal] Razorpay verify error:', verifyErr);
            setErrorMsg(
              verifyErr?.message ||
                'Payment verification failed. Please contact Kumari Institute support.'
            );
            setStatusStep('idle');
          }
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', (failureRes: any) => {
        const desc =
          failureRes?.error?.description ||
          failureRes?.error?.reason ||
          'Payment failed in Razorpay Checkout.';
        setErrorMsg(desc);
        setStatusStep('idle');
      });
      rzp.open();
    } catch (err: any) {
      console.warn('[PayTutorFeeModal] Razorpay order creation notice:', err);
      setErrorMsg(err?.message || 'Unable to start Razorpay payment. Please try again.');
      setStatusStep('idle');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200"
      onClick={(e) => e.target === e.currentTarget && !isBusy && onClose()}
    >
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden relative my-6 text-left flex flex-col">
        {/* Razorpay Branded Header */}
        <div className="bg-gradient-to-r from-[#071936] via-[#0c2340] to-[#123363] p-5 sm:p-6 text-white relative">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer ring-1 ring-white/20 disabled:opacity-40"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center justify-between gap-3 mb-3 pr-10">
            <img
              src="/Logo/kumarilogo.png"
              alt="Kumari Institute"
              className="h-9 w-auto max-w-[140px] object-contain"
              referrerPolicy="no-referrer"
            />
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2B84EA]/25 text-sky-200 border border-[#528FF0]/40 text-[11px] font-bold tracking-wide">
              <Lock className="w-3 h-3 text-sky-300" />
              <span>Secured by Razorpay</span>
            </div>
          </div>

          <h3 className="text-xl font-black text-white tracking-tight">
            Pay Monthly Tuition Fee
          </h3>
          <p className="text-xs text-sky-100/80 mt-0.5">
            Kumari Institute • {TUITION_CYCLE_DAYS}-Day Monthly Cycle
          </p>
        </div>

        {/* Body */}
        <form
          onSubmit={handleRazorpayCheckout}
          className="p-5 sm:p-6 space-y-5"
        >
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Tuition & Educator Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-xl bg-[#0c2340] text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                  {tutorName ? tutorName.slice(0, 2).toUpperCase() : 'HT'}
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-sm text-slate-900 leading-tight truncate">
                    {tutorName}
                  </h4>
                  <p className="text-xs text-slate-600 truncate">{tutorSubjects}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    Student: <strong className="text-slate-800">{studentName}</strong> ({studentGrade})
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Tuition Fee
                </span>
                <span className="text-xl sm:text-2xl font-black text-[#0c2340] tabular-nums">
                  {formatINR(tutorFee)}
                </span>
              </div>
            </div>

            <div className="pt-2.5 border-t border-slate-200/70 flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 text-slate-700 font-semibold">
                <Calendar className="w-3.5 h-3.5 text-[#2B84EA]" />
                <span>Validity: {TUITION_CYCLE_DAYS} Days</span>
              </span>
              <span className="text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md">
                Razorpay Instant Receipt
              </span>
            </div>
          </div>

          {/* Primary Pay Button */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isBusy}
              className="px-4 py-3 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isBusy}
              className="flex-1 px-5 py-3 rounded-xl bg-[#072654] hover:bg-[#0c2340] text-white font-bold text-sm shadow-lg shadow-blue-950/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
            >
              {statusStep === 'creating_order' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Initializing Razorpay...</span>
                </>
              ) : statusStep === 'checkout_open' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Complete in Razorpay...</span>
                </>
              ) : statusStep === 'verifying' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Payment...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 text-sky-300" />
                  <span className="tabular-nums">Pay Fee {formatINR(tutorFee)}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
