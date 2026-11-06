import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, X, Trophy, Calendar, CheckCircle2, Clock, Loader2, IndianRupee, ArrowRight } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from 'firebase/firestore';
import { Page, User, Tournament } from '../types';

interface MyOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onPageChange: (page: Page, param?: string) => void;
}

interface OrderItem {
  id: string;
  matchId: string;
  title: string;
  entryFee: number;
  prizePool: string;
  mode: string;
  date: string;
  status: 'confirmed' | 'ongoing' | 'completed';
  slot?: number;
  ign?: string;
}

export default function MyOrdersModal({ isOpen, onClose, user, onPageChange }: MyOrdersModalProps) {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen || !user?.id) return;

    const fetchOrders = async () => {
      setLoading(true);
      try {
        const regQuery = query(
          collection(db, 'registrations'),
          where('userId', '==', user.id),
          orderBy('joinedAt', 'desc'),
          limit(15)
        );
        const regSnap = await getDocs(regQuery);

        const orderPromises = regSnap.docs.map(async (docSnap) => {
          const data = docSnap.data();
          let matchData: any = null;
          try {
            const mDoc = await getDoc(doc(db, 'matches', data.tournamentId));
            if (mDoc.exists()) {
              matchData = mDoc.data();
            } else {
              const legacyDoc = await getDoc(doc(db, 'tournaments', data.tournamentId));
              if (legacyDoc.exists()) {
                matchData = legacyDoc.data();
              }
            }
          } catch (err) {
            console.error('Failed to fetch match for order:', err);
          }

          return {
            id: docSnap.id,
            matchId: data.tournamentId,
            title: matchData?.title || 'Tournament Slot Pass',
            entryFee: matchData?.entryFee || data.entryFee || 0,
            prizePool: matchData?.prize || 'Pool Prize',
            mode: matchData?.mode || 'Custom',
            date: data.joinedAt?.toDate ? data.joinedAt.toDate().toLocaleDateString() : 'Recent',
            status: (matchData?.status || 'confirmed') as any,
            slot: data.slot,
            ign: data.ign || data.gameIGN || user.username
          };
        });

        const fetchedOrders = await Promise.all(orderPromises);
        setOrders(fetchedOrders);
      } catch (err) {
        console.error('Error loading orders:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [isOpen, user?.id]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-xs"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="bg-[#121f36] px-5 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                  <ShoppingCart size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold tracking-tight">My Orders & Passes</h3>
                  <p className="text-[11px] text-slate-300">Tournament entry passes and match slots</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content List */}
            <div className="p-4 overflow-y-auto no-scrollbar flex-1 space-y-3 bg-[#f8fafc]">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center text-slate-500">
                  <Loader2 size={28} className="animate-spin text-blue-600 mb-2" />
                  <p className="text-xs font-semibold">Loading your match orders...</p>
                </div>
              ) : orders.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <ShoppingCart size={28} />
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 mb-1">No Orders Yet</h4>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto mb-4">
                    You haven't purchased any tournament slot passes yet. Join an esports match to start competing!
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onPageChange(Page.TOURNAMENTS);
                    }}
                    className="bg-[#121f36] hover:bg-[#1b2e50] text-white text-xs font-bold px-4 py-2 rounded-xl transition-all inline-flex items-center gap-1.5"
                  >
                    <span>Browse Matches</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              ) : (
                orders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                          {order.mode}
                        </span>
                        <h4 className="text-sm font-bold text-slate-900 mt-1 leading-snug">
                          {order.title}
                        </h4>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-black text-slate-900">
                          ₹{order.entryFee}
                        </span>
                        <p className="text-[10px] text-slate-400">Entry Paid</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-600 pt-2 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        <Calendar size={13} className="text-slate-400" />
                        <span>{order.date}</span>
                      </div>
                      {order.slot && (
                        <span className="font-semibold text-slate-700">Slot #{order.slot}</span>
                      )}
                      <div className="flex items-center gap-1 text-emerald-600 font-bold">
                        <CheckCircle2 size={13} />
                        <span className="capitalize">{order.status}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Bottom Close Action */}
            <div className="p-3 bg-white border-t border-slate-200 text-center">
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
