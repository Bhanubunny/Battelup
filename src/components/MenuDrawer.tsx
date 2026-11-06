import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  User,
  Wallet,
  Trophy,
  Gift,
  HelpCircle,
  ShieldCheck,
  BarChart3,
  PlusCircle,
  ArrowDownToLine,
  Shield,
  LogOut,
  ChevronRight,
  Bell
} from 'lucide-react';
import { Page, User as UserType } from '../types';

interface MenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserType | null;
  onPageChange: (page: Page, param?: string) => void;
  onOpenRules?: () => void;
  onOpenSupport?: () => void;
  onOpenNotifications?: () => void;
}

export default function MenuDrawer({
  isOpen,
  onClose,
  user,
  onPageChange,
  onOpenRules,
  onOpenSupport,
  onOpenNotifications
}: MenuDrawerProps) {
  const isAdminUser =
    user?.isAdmin ||
    ['ksbooyah9@gmail.com', 'mahendrathakur9009@gmail.com', 'mahendrar9009@gmail.com', 'qupagaming@gmail.com'].includes(
      user?.email || ''
    );

  const menuItems = [
    ...(isAdminUser ? [{
      id: 'admin',
      label: 'Admin Control Panel',
      desc: 'Manage matches, users, wallets & settings',
      icon: Shield,
      color: 'bg-blue-600/20 text-cyan-400 border-cyan-500/30',
      action: () => {
        onClose();
        onPageChange(Page.ADMIN);
      }
    }] : []),
    {
      id: 'profile',
      label: 'My Profile & IGN',
      desc: 'Update Free Fire IGN and profile info',
      icon: User,
      color: 'bg-blue-600/20 text-blue-400 border-blue-500/30',
      action: () => {
        onClose();
        onPageChange(Page.PROFILE);
      }
    },
    {
      id: 'notifications',
      label: 'Notifications & Alerts',
      desc: 'Official updates, room alerts & offers',
      icon: Bell,
      color: 'bg-purple-600/20 text-purple-400 border-purple-500/30',
      action: () => {
        onClose();
        if (onOpenNotifications) {
          onOpenNotifications();
        }
      }
    },
    {
      id: 'wallet',
      label: 'Wallet & Passbook',
      desc: 'Check deposits, winnings and transactions',
      icon: Wallet,
      color: 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30',
      action: () => {
        onClose();
        onPageChange(Page.WALLET);
      }
    },
    {
      id: 'add_money',
      label: 'Add Cash',
      desc: 'Instant QR / UPI Deposit',
      icon: PlusCircle,
      color: 'bg-cyan-600/20 text-cyan-400 border-cyan-500/30',
      action: () => {
        onClose();
        onPageChange(Page.ADD_MONEY);
      }
    },
    {
      id: 'withdraw',
      label: 'Withdraw Cash',
      desc: 'Withdraw match winnings directly to UPI',
      icon: ArrowDownToLine,
      color: 'bg-amber-600/20 text-amber-400 border-amber-500/30',
      action: () => {
        onClose();
        onPageChange(Page.WITHDRAW);
      }
    },
    {
      id: 'tournaments',
      label: 'Esports Tournaments',
      desc: 'Browse CS, BR & Lone Wolf rooms',
      icon: Trophy,
      color: 'bg-yellow-600/20 text-yellow-400 border-yellow-500/30',
      action: () => {
        onClose();
        onPageChange(Page.TOURNAMENTS);
      }
    },
    {
      id: 'stats',
      label: 'My Career & Stats',
      desc: 'Track kills, wins and matches history',
      icon: BarChart3,
      color: 'bg-purple-600/20 text-purple-400 border-purple-500/30',
      action: () => {
        onClose();
        onPageChange(Page.GAME_STATS);
      }
    },
    {
      id: 'referral',
      label: 'Refer & Earn',
      desc: 'Invite friends & earn ₹50 bonus cash',
      icon: Gift,
      color: 'bg-pink-600/20 text-pink-400 border-pink-500/30',
      action: () => {
        onClose();
        onPageChange(Page.REFERRAL);
      }
    },
    {
      id: 'rules',
      label: 'Match Rules & FairPlay',
      desc: 'Tournament rules, bans and guidelines',
      icon: ShieldCheck,
      color: 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30',
      action: () => {
        onClose();
        if (onOpenRules) onOpenRules();
      }
    },
    {
      id: 'support',
      label: 'Customer Support',
      desc: '24/7 WhatsApp & Telegram assistance',
      icon: HelpCircle,
      color: 'bg-teal-600/20 text-teal-400 border-teal-500/30',
      action: () => {
        onClose();
        if (onOpenSupport) onOpenSupport();
      }
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
            className="relative w-full max-w-lg bg-[#071328] border-t border-[#1e3461] rounded-t-[2.5rem] p-6 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-lg flex items-center justify-center">
                  <div className="w-full h-full rounded-[14px] bg-[#071328] flex items-center justify-center text-white">
                    <Shield size={18} className="text-cyan-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-white">
                    Khel GALLI
                  </h3>
                  <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">
                    Quick Navigation Menu
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Menu List */}
            <div className="mt-4 space-y-2 overflow-y-auto no-scrollbar pr-1 flex-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={item.action}
                    className="w-full p-3.5 rounded-2xl bg-[#0b1b38]/70 hover:bg-[#10244c] border border-[#1a3466]/60 hover:border-blue-500/40 flex items-center justify-between transition-all group active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${item.color}`}>
                        <Icon size={18} />
                      </div>
                      <div className="text-left min-w-0">
                        <p className="text-xs font-black uppercase tracking-tight text-white group-hover:text-cyan-300 transition-colors truncate">
                          {item.label}
                        </p>
                        <p className="text-[10px] text-slate-400 font-medium truncate">
                          {item.desc}
                        </p>
                      </div>
                    </div>

                    <ChevronRight size={16} className="text-slate-500 group-hover:text-white transition-colors shrink-0 ml-2" />
                  </button>
                );
              })}
            </div>

            {/* Close Button */}
            <div className="mt-4 pt-3 border-t border-white/5">
              <button
                onClick={onClose}
                className="w-full py-3.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all"
              >
                Close Menu
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
