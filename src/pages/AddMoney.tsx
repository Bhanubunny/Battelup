import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, 
  Zap, 
  Loader2, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2,
  XCircle,
  HelpCircle
} from 'lucide-react';
import { Page, PaymentGateway } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, increment, runTransaction, collection, serverTimestamp } from 'firebase/firestore';
import { paymentService } from '../services/paymentService';

interface AddMoneyProps {
  onPageChange: (page: Page) => void;
}

export default function AddMoney({ onPageChange }: AddMoneyProps) {
  const [amount, setAmount] = useState('100');
  const [loading, setLoading] = useState(false);
  const [activeGateway, setActiveGateway] = useState<PaymentGateway | null>(null);
  const [pollingOrderId, setPollingOrderId] = useState<string | null>(null);
  const [pollingActive, setPollingActive] = useState(false);
  const [pollingTimedOut, setPollingTimedOut] = useState(false);

  const presetAmounts = ['50', '100', '200', '500', '1000'];

  const numericAmount = parseInt(amount, 10);
  const isAmountValid = !isNaN(numericAmount) && numericAmount >= 10 && numericAmount <= 10000;
  const isBelowMin = !isNaN(numericAmount) && numericAmount > 0 && numericAmount < 10;
  const isAboveMax = !isNaN(numericAmount) && numericAmount > 10000;

  useEffect(() => {
    let interval: any;
    let timeout: any;

    if (pollingActive && pollingOrderId) {
      setPollingTimedOut(false);
      
      // Timeout polling after 5 minutes (300,000ms)
      timeout = setTimeout(() => {
        setPollingActive(false);
        setPollingTimedOut(true);
        console.warn(`[AddMoney] Polling timed out for Order: ${pollingOrderId}`);
      }, 5 * 60 * 1000);

      const checkStatus = async () => {
        try {
          const res = await fetch('/api/zapupi/check-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order_id: pollingOrderId })
          });
          
          if (res.ok) {
            const data = await res.json();
            console.log(`[AddMoney] Polling Status for ${pollingOrderId}:`, data);
            
            // Accept success if status is 'success' or if detail shows a positive state
            const detailSt = String(data.detail?.status || data.detail?.order_status || '').toLowerCase();
            const isFinished = data.status === 'success' || detailSt === 'success' || detailSt === 'paid' || detailSt === 'completed';

            if (isFinished) {
              console.log(`[AddMoney] SUCCESS: Payment confirmed for ${pollingOrderId}.`);
              clearInterval(interval);
              clearTimeout(timeout);
              setPollingActive(false);
              setPollingOrderId(null);
              setTimeout(() => {
                window.location.href = '/wallet?payment=success';
              }, 500);
            } else if (data.status === 'failed' || detailSt === 'failed' || detailSt === 'failure') {
              console.warn(`[AddMoney] FAILED: Payment rejected for ${pollingOrderId}.`);
              clearInterval(interval);
              clearTimeout(timeout);
              setPollingActive(false);
              setPollingOrderId(null);
              window.location.href = '/wallet?payment=failed';
            }
          }
        } catch (err) {
          console.error('[AddMoney] Polling error:', err);
        }
      };

      // Initial check immediately
      checkStatus();
      
      interval = setInterval(checkStatus, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [pollingActive, pollingOrderId]);

  useEffect(() => {
    const fetchGateway = async () => {
      const g = await paymentService.getActiveGatewayAsync();
      setActiveGateway(g);
    };
    fetchGateway();
  }, []);

  const handleDeposit = async () => {
    if (!auth.currentUser || !amount) return;
    const value = parseInt(amount, 10);
    if (isNaN(value) || value < 10 || value > 10000) return;

    setLoading(true);
    try {
      // 1. Detect and "Initiate" through active gateway
      const result: any = await paymentService.initiateDeposit(value, auth.currentUser.uid);

      if (result?.order_id && result?.payment_url) {
        setPollingOrderId(result.order_id);
        setPollingActive(true);
        // Open payment in a new tab so polling can continue on this page
        window.open(result.payment_url, '_blank');
      } else {
        // Direct deposit for UPI / manual gateway
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await runTransaction(db, async (transaction) => {
          transaction.update(userRef, {
            "wallet.deposit": increment(value)
          });
          
          const transRef = doc(collection(db, 'transactions'));
          transaction.set(transRef, {
            userId: auth.currentUser!.uid,
            type: 'deposit',
            amount: value,
            status: 'completed',
            title: `Deposit via ${activeGateway?.name || 'Instant UPI'}`,
            createdAt: serverTimestamp()
          });
        });
        onPageChange(Page.WALLET);
      }
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Payment initiation failed';
      console.error('[AddMoney] Error:', error);
      alert(errorMessage);
      
      if (error?.code?.startsWith('permission-denied') || error?.code?.startsWith('unavailable')) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser?.uid}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAmountClick = (val: string) => {
    setAmount(val);
  };

  const handleClear = () => {
    setAmount('');
  };

  return (
    <div className="min-h-screen bg-[#f5f7fb] text-neutral-900 pb-20 max-w-lg mx-auto select-none relative">
      {/* ========================================================================= */}
      {/* 1. HEADER (Dark navy-blue matching Reference)                             */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-30 bg-[#0a1835] text-white shadow-lg border-b border-[#182a52] px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onPageChange(Page.WALLET)}
            className="p-1 -ml-1 text-white hover:bg-white/10 rounded-full transition-colors active:scale-95 flex items-center justify-center"
            aria-label="Back to Wallet"
          >
            <ChevronLeft size={24} className="stroke-[2.5]" />
          </button>
          <h1 className="text-base sm:text-lg font-black tracking-wide">
            Add Coins
          </h1>
        </div>

        {activeGateway && (
          <div className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase text-emerald-300 border border-emerald-400/20">
            <ShieldCheck size={12} className="text-emerald-400" />
            <span>Secure</span>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* ========================================================================= */}
        {/* 2. PAYMENT PROVIDER CARD (ZapUPI highlight card)                          */}
        {/* ========================================================================= */}
        <div className="bg-[#fcf9ff] border border-purple-200/90 rounded-2xl p-4 shadow-xs flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-100/80 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
            <Zap size={20} className="fill-purple-500 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xs sm:text-sm font-black text-purple-900 leading-tight">
              {activeGateway?.name || 'Instant UPI / QR Payment'}
            </h2>
            <p className="text-[11px] font-semibold text-purple-600/80 mt-0.5 tracking-tight">
              Secure & Fast • UPI, Cards, NetBanking
            </p>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. AMOUNT SECTION (Heading + Editable Field / Underline)                  */}
        {/* ========================================================================= */}
        <div className="pt-2">
          {/* Heading */}
          <div className="flex items-center gap-2 pb-2 border-b-2 border-slate-200">
            <span className="text-lg leading-none select-none">💵</span>
            <h3 className="text-xs sm:text-sm font-bold text-slate-500 tracking-tight">
              Amount (Min: ₹10 | Max: ₹10000)
            </h3>
          </div>

          {/* Amount Input Box */}
          <div className="mt-3 bg-white border border-neutral-200/90 rounded-2xl p-3 sm:p-4 shadow-xs flex items-center justify-between focus-within:border-orange-500 focus-within:ring-2 focus-within:ring-orange-500/20 transition-all">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-xl sm:text-2xl font-black text-neutral-800">₹</span>
              <input
                type="number"
                placeholder="Enter amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-transparent text-xl sm:text-2xl font-black text-neutral-900 placeholder:text-neutral-300 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            {amount && (
              <button
                onClick={handleClear}
                className="text-xs font-bold text-neutral-400 hover:text-neutral-600 px-2 py-1 bg-neutral-100 rounded-lg"
              >
                Clear
              </button>
            )}
          </div>

          {/* Validation Feedback */}
          {isBelowMin && (
            <p className="text-[11px] font-bold text-red-500 mt-1.5 flex items-center gap-1 pl-1">
              <AlertCircle size={13} />
              <span>Minimum deposit amount is ₹10</span>
            </p>
          )}
          {isAboveMax && (
            <p className="text-[11px] font-bold text-red-500 mt-1.5 flex items-center gap-1 pl-1">
              <AlertCircle size={13} />
              <span>Maximum deposit amount is ₹10,000</span>
            </p>
          )}
        </div>

        {/* ========================================================================= */}
        {/* 4. QUICK AMOUNT BUTTONS (3-Column Grid)                                   */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {presetAmounts.map((preset) => {
            const isSelected = amount === preset;
            return (
              <button
                key={preset}
                onClick={() => handleQuickAmountClick(preset)}
                className={`py-3 sm:py-3.5 px-2 rounded-xl text-xs sm:text-sm font-black transition-all active:scale-95 shadow-xs border ${
                  isSelected
                    ? 'bg-orange-50/60 border-orange-500 text-orange-600 ring-2 ring-orange-500/20'
                    : 'bg-white border-neutral-200/90 text-neutral-900 hover:border-neutral-300'
                }`}
              >
                ₹{preset}
              </button>
            );
          })}

          {/* Clear Button */}
          <button
            onClick={handleClear}
            className="py-3 sm:py-3.5 px-2 rounded-xl text-xs sm:text-sm font-black bg-white border border-neutral-200/90 text-neutral-900 hover:border-neutral-300 active:scale-95 shadow-xs transition-all"
          >
            Clear
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 5. MAIN PAYMENT BUTTON (Orange CTA matching Reference)                    */}
        {/* ========================================================================= */}
        <div className="pt-2">
          <button
            onClick={handleDeposit}
            disabled={loading || !isAmountValid}
            className="w-full py-4 sm:py-4.5 bg-[#f97316] hover:bg-[#ea580c] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 text-white rounded-xl sm:rounded-2xl font-black text-sm sm:text-base uppercase tracking-wider shadow-lg shadow-orange-500/25 transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                <span>PROCESSING...</span>
              </>
            ) : (
              <span>PAY WITH ZAPUPI</span>
            )}
          </button>
        </div>

        {/* ========================================================================= */}
        {/* 6. PAYMENT INFORMATION / SAFETY CARD                                      */}
        {/* ========================================================================= */}
        <div className="bg-white border border-neutral-200/90 rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-xs space-y-3.5">
          {[
            'Do not press back during payment.',
            'Wait till the payment gets confirmed.',
            'Payment is 100% secure.',
            'Accepts all payment methods.',
            'No hidden charges.',
            'Instant confirmation on successful payment.',
            'Contact support for any issues with transactions.'
          ].map((text, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f97316] mt-2 shrink-0" />
              <p className="text-xs sm:text-[13px] font-medium text-neutral-700 leading-snug">
                {text}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 7. POLLING & VERIFICATION MODAL OVERLAY                                    */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {pollingActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs"
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              className="w-full max-w-sm bg-white rounded-3xl p-6 sm:p-8 text-neutral-900 shadow-2xl text-center border border-neutral-200 relative overflow-hidden"
            >
              <div className="w-16 h-16 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center mx-auto mb-5 text-purple-600">
                <Loader2 className="animate-spin text-purple-600" size={28} />
              </div>

              <h3 className="text-base sm:text-lg font-black uppercase text-neutral-900 mb-1">
                {pollingTimedOut ? (
                  <span className="text-red-600">Verification Timed Out</span>
                ) : (
                  <>Verifying <span className="text-purple-600">Payment</span></>
                )}
              </h3>

              <p className="text-xs text-neutral-600 leading-relaxed mb-6 font-medium">
                {pollingTimedOut
                  ? "Payment verification timed out. If your funds were deducted, please reach out to support with your Order ID."
                  : "We're confirming your transaction with ZapUPI. Please do not close or refresh this page."}
              </p>

              {pollingOrderId && (
                <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 mb-6 text-[11px] font-mono text-neutral-500">
                  Order ID: <span className="font-bold text-neutral-800 select-all">{pollingOrderId}</span>
                </div>
              )}

              <button
                onClick={() => {
                  setPollingActive(false);
                  setPollingOrderId(null);
                  setPollingTimedOut(false);
                }}
                className="w-full py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors"
              >
                {pollingTimedOut ? 'Close & Return' : 'Cancel & Return to Wallet'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
