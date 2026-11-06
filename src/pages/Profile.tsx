import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  User as UserIcon,
  Wallet,
  Gamepad2,
  ShoppingCart,
  BarChart2,
  Gift,
  Headphones,
  ShieldCheck,
  ShieldAlert,
  LogOut,
  ChevronRight,
  X
} from 'lucide-react';
import { Page, User } from '../types';
import SupportModal from '../components/SupportModal';
import RulesModal from '../components/RulesModal';
import MyOrdersModal from '../components/MyOrdersModal';

interface ProfilePageProps {
  user: User;
  onPageChange: (page: Page, param?: string) => void;
  onLogout: () => void;
}

export default function ProfilePage({ user, onPageChange, onLogout }: ProfilePageProps) {
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isLogoutDialogOpen, setIsLogoutDialogOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(() => {
    return localStorage.getItem('khelgalli_push_notifications') !== 'false';
  });

  const handleTogglePush = () => {
    setPushEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('khelgalli_push_notifications', String(next));
      return next;
    });
  };

  const isAdminUser =
    user?.isAdmin ||
    ['ksbooyah9@gmail.com', 'mahendrathakur9009@gmail.com', 'mahendrar9009@gmail.com', 'qupagaming@gmail.com'].includes(
      user?.email || ''
    );

  const totalBalance =
    (user?.wallet?.deposit || 0) + (user?.wallet?.winnings || 0) + (user?.wallet?.bonus || 0);

  const displayName = user?.username || 'mps07';
  const matchesPlayed = user?.stats?.matchesPlayed || 0;
  const totalKills = user?.stats?.totalKills || 0;
  const amountWon = user?.stats?.totalWinnings || 0;

  return (
    <div className="min-h-screen bg-[#eaeff5] text-slate-900 pb-24 select-none">
      {/* 1. Dark Navy Top Header matching Reference */}
      <header className="bg-[#162238] px-4 sm:px-5 pt-3 pb-3 border-b border-[#223963]">
        <div className="flex items-center justify-between">
          {/* Left: Circular Khel Galli Gaming Logo Badge */}
          <div
            onClick={() => onPageChange(Page.HOME)}
            className="flex items-center cursor-pointer active:scale-95 transition-transform"
          >
            <div className="w-11 h-11 rounded-full bg-gradient-to-b from-[#1b2b48] to-[#0a1220] p-0.5 border border-[#2b4475] shadow-lg flex items-center justify-center overflow-hidden">
              <div className="w-full h-full rounded-full bg-[#070e1c] flex flex-col items-center justify-center text-center p-0.5">
                <span className="text-[7px] font-black uppercase tracking-tighter text-white leading-none">
                  KHEL
                </span>
                <span className="text-[6.5px] font-black uppercase tracking-tighter text-amber-400 leading-none mt-0.5">
                  GALLI
                </span>
              </div>
            </div>
          </div>

          {/* Center: Welcome Back & User / App Name */}
          <div className="text-center flex-1 px-2">
            <p className="text-[11px] sm:text-xs font-medium text-slate-300 tracking-tight leading-tight">
              Welcome Back,
            </p>
            <h1 className="text-sm sm:text-base font-black text-white tracking-wide leading-tight truncate max-w-[200px] mx-auto mt-0.5">
              {displayName}
            </h1>
          </div>

          {/* Right: White Balance Card Pill with Gold Coin */}
          <button
            onClick={() => onPageChange(Page.WALLET)}
            className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 p-0.5 shadow-xs flex items-center justify-center text-black font-black text-[10px] leading-none shrink-0">
              🪙
            </div>
            <span className="text-xs sm:text-sm font-black text-[#0f172a] tracking-tight">
              {totalBalance.toFixed(2)}
            </span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="px-4 sm:px-5 pt-6 pb-4">
        {/* 2. Large Circular Profile Emblem */}
        <div className="flex flex-col items-center justify-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1 bg-gradient-to-b from-[#1b2b4a] via-[#101a2f] to-[#060c18] border-2 border-white shadow-xl flex items-center justify-center overflow-hidden relative group"
          >
            {/* Background Texture & Glow */}
            <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:8px_8px] opacity-20" />
            <div className="w-full h-full rounded-full bg-[#070e1c] flex flex-col items-center justify-center text-center p-2 relative z-10 border border-slate-700/60">
              <span className="text-sm sm:text-base font-black italic uppercase tracking-wider text-white leading-none">
                KHEL
              </span>
              <span className="text-xs sm:text-sm font-black italic uppercase tracking-wider text-amber-400 leading-none mt-1">
                GALLI
              </span>
              <span className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-400 leading-none mt-1">
                ESPORTS
              </span>
            </div>
          </motion.div>

          {/* Username below emblem */}
          <h2 className="text-lg sm:text-xl font-black text-[#0f172a] tracking-tight mt-3 mb-4">
            {displayName}
          </h2>
        </div>

        {/* 3. Dark Navy Stats Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="bg-[#162238] rounded-2xl border border-[#233a64] p-4 sm:p-5 shadow-lg shadow-black/10 mb-5"
        >
          <div className="grid grid-cols-3 divide-x divide-slate-700/70">
            {/* Column 1: Matches Played */}
            <div className="text-center px-1">
              <p className="text-lg sm:text-xl font-black text-white tracking-tight leading-none mb-1.5">
                {matchesPlayed}
              </p>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-300 leading-tight">
                Matches<br />Played
              </p>
            </div>

            {/* Column 2: Total Killed */}
            <div className="text-center px-1">
              <p className="text-lg sm:text-xl font-black text-white tracking-tight leading-none mb-1.5">
                {totalKills}
              </p>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-300 leading-tight">
                Total<br />Killed
              </p>
            </div>

            {/* Column 3: Amount Won */}
            <div className="text-center px-1">
              <div className="flex items-center justify-center gap-1 leading-none mb-1.5">
                <span className="text-amber-400 text-xs sm:text-sm">🪙</span>
                <p className="text-lg sm:text-xl font-black text-white tracking-tight leading-none">
                  {amountWon}
                </p>
              </div>
              <p className="text-[11px] sm:text-xs font-semibold text-slate-300 leading-tight">
                Amount<br />Won
              </p>
            </div>
          </div>
        </motion.div>

        {/* 4. White Rounded Menu Cards List */}
        <div className="space-y-2.5">
          {/* Card 1: Push Notification */}
          <div className="bg-white rounded-xl sm:rounded-2xl px-4 py-3.5 flex items-center justify-between border border-slate-200/90 shadow-xs">
            <div className="flex items-center gap-3.5">
              <div className="text-slate-900">
                <Bell size={20} className="fill-slate-900 stroke-slate-900" />
              </div>
              <span className="text-sm font-bold text-[#0f172a] tracking-tight">
                Push Notification
              </span>
            </div>
            {/* Toggle Switch */}
            <button
              type="button"
              role="switch"
              aria-checked={pushEnabled}
              onClick={handleTogglePush}
              className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-300 cursor-pointer ${
                pushEnabled ? 'bg-[#1e293b]' : 'bg-slate-300'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-300 ${
                  pushEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Card 2: My Profile */}
          <button
            onClick={() => onPageChange(Page.PROFILE_DETAILS)}
            className="w-full bg-white hover:bg-slate-50 active:bg-slate-100 rounded-xl sm:rounded-2xl px-4 py-3.5 flex items-center justify-between border border-slate-200/90 shadow-xs group transition-all"
          >
            <div className="flex items-center gap-3.5">
              <div className="text-slate-900">
                <UserIcon size={20} className="stroke-[2.5]" />
              </div>
              <span className="text-sm font-bold text-[#0f172a] tracking-tight">
                My Profile
              </span>
            </div>
            <ChevronRight size={18} className="text-slate-700 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Card 3: My Wallet */}
          <button
            onClick={() => onPageChange(Page.WALLET)}
            className="w-full bg-white hover:bg-slate-50 active:bg-slate-100 rounded-xl sm:rounded-2xl px-4 py-3.5 flex items-center justify-between border border-slate-200/90 shadow-xs group transition-all"
          >
            <div className="flex items-center gap-3.5">
              <div className="text-slate-900">
                <Wallet size={20} className="stroke-[2.2]" />
              </div>
              <span className="text-sm font-bold text-[#0f172a] tracking-tight">
                My Wallet
              </span>
            </div>
            <ChevronRight size={18} className="text-slate-700 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Card 4: My Matches */}
          <button
            onClick={() => onPageChange(Page.TOURNAMENTS)}
            className="w-full bg-white hover:bg-slate-50 active:bg-slate-100 rounded-xl sm:rounded-2xl px-4 py-3.5 flex items-center justify-between border border-slate-200/90 shadow-xs group transition-all"
          >
            <div className="flex items-center gap-3.5">
              <div className="text-slate-900">
                <Gamepad2 size={20} className="stroke-[2.2]" />
              </div>
              <span className="text-sm font-bold text-[#0f172a] tracking-tight">
                My Matches
              </span>
            </div>
            <ChevronRight size={18} className="text-slate-700 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Card 5: My Order */}
          <button
            onClick={() => setIsOrdersOpen(true)}
            className="w-full bg-white hover:bg-slate-50 active:bg-slate-100 rounded-xl sm:rounded-2xl px-4 py-3.5 flex items-center justify-between border border-slate-200/90 shadow-xs group transition-all"
          >
            <div className="flex items-center gap-3.5">
              <div className="text-slate-900">
                <ShoppingCart size={20} className="stroke-[2.2]" />
              </div>
              <span className="text-sm font-bold text-[#0f172a] tracking-tight">
                My Order
              </span>
            </div>
            <ChevronRight size={18} className="text-slate-700 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Card 6: My Statistics */}
          <button
            onClick={() => onPageChange(Page.GAME_STATS)}
            className="w-full bg-white hover:bg-slate-50 active:bg-slate-100 rounded-xl sm:rounded-2xl px-4 py-3.5 flex items-center justify-between border border-slate-200/90 shadow-xs group transition-all"
          >
            <div className="flex items-center gap-3.5">
              <div className="text-slate-900">
                <BarChart2 size={20} className="stroke-[2.2]" />
              </div>
              <span className="text-sm font-bold text-[#0f172a] tracking-tight">
                My Statistics
              </span>
            </div>
            <ChevronRight size={18} className="text-slate-700 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Card 7: My Rewards */}
          <button
            onClick={() => onPageChange(Page.REFERRAL)}
            className="w-full bg-white hover:bg-slate-50 active:bg-slate-100 rounded-xl sm:rounded-2xl px-4 py-3.5 flex items-center justify-between border border-slate-200/90 shadow-xs group transition-all"
          >
            <div className="flex items-center gap-3.5">
              <div className="text-slate-900">
                <Gift size={20} className="stroke-[2.2]" />
              </div>
              <span className="text-sm font-bold text-[#0f172a] tracking-tight">
                My Rewards
              </span>
            </div>
            <ChevronRight size={18} className="text-slate-700 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Card 8: Customer Support */}
          <button
            onClick={() => setIsSupportOpen(true)}
            className="w-full bg-white hover:bg-slate-50 active:bg-slate-100 rounded-xl sm:rounded-2xl px-4 py-3.5 flex items-center justify-between border border-slate-200/90 shadow-xs group transition-all"
          >
            <div className="flex items-center gap-3.5">
              <div className="text-slate-900">
                <Headphones size={20} className="stroke-[2.2]" />
              </div>
              <span className="text-sm font-bold text-[#0f172a] tracking-tight">
                Customer Support
              </span>
            </div>
            <ChevronRight size={18} className="text-slate-700 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Card 9: Rules & Terms */}
          <button
            onClick={() => setIsRulesOpen(true)}
            className="w-full bg-white hover:bg-slate-50 active:bg-slate-100 rounded-xl sm:rounded-2xl px-4 py-3.5 flex items-center justify-between border border-slate-200/90 shadow-xs group transition-all"
          >
            <div className="flex items-center gap-3.5">
              <div className="text-slate-900">
                <ShieldCheck size={20} className="stroke-[2.2]" />
              </div>
              <span className="text-sm font-bold text-[#0f172a] tracking-tight">
                Rules & Fair Play
              </span>
            </div>
            <ChevronRight size={18} className="text-slate-700 group-hover:translate-x-0.5 transition-transform" />
          </button>

          {/* Card 10: Admin Panel (if admin) */}
          {isAdminUser && (
            <button
              onClick={() => onPageChange(Page.ADMIN)}
              className="w-full bg-blue-50/80 hover:bg-blue-100/80 active:bg-blue-200/80 rounded-xl sm:rounded-2xl px-4 py-3.5 flex items-center justify-between border border-blue-200 shadow-xs group transition-all"
            >
              <div className="flex items-center gap-3.5">
                <div className="text-blue-600">
                  <ShieldAlert size={20} className="stroke-[2.2]" />
                </div>
                <span className="text-sm font-bold text-blue-900 tracking-tight">
                  Admin Control Panel
                </span>
              </div>
              <ChevronRight size={18} className="text-blue-600 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}

          {/* Card 11: Log Out */}
          <button
            onClick={() => setIsLogoutDialogOpen(true)}
            className="w-full bg-white hover:bg-red-50/60 active:bg-red-100/60 rounded-xl sm:rounded-2xl px-4 py-3.5 flex items-center justify-between border border-slate-200/90 shadow-xs group transition-all"
          >
            <div className="flex items-center gap-3.5">
              <div className="text-red-500">
                <LogOut size={20} className="stroke-[2.2]" />
              </div>
              <span className="text-sm font-bold text-red-600 tracking-tight">
                Log Out
              </span>
            </div>
            <ChevronRight size={18} className="text-red-400 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* Footer info */}
        <p className="mt-8 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
          Khel Galli Esports • v3.2.0
        </p>
      </div>

      {/* Modals */}
      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
        section="Battle Royale & Esports Fair Play"
        onJoin={() => setIsRulesOpen(false)}
        isJoined={true}
      />
      <MyOrdersModal
        isOpen={isOrdersOpen}
        onClose={() => setIsOrdersOpen(false)}
        user={user}
        onPageChange={onPageChange}
      />

      {/* Logout Confirmation Dialog */}
      <AnimatePresence>
        {isLogoutDialogOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsLogoutDialogOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl z-10 text-center"
            >
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                <LogOut size={22} />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">Log Out of Khel Galli?</h3>
              <p className="text-xs text-slate-500 mb-5">
                Are you sure you want to log out of your gaming account?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsLogoutDialogOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setIsLogoutDialogOpen(false);
                    onLogout();
                  }}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-colors shadow-sm"
                >
                  Yes, Log Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
