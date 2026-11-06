import React, { useState, useEffect } from 'react';
import { Coins, Bell } from 'lucide-react';
import { Page, User } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';

interface HomeHeaderProps {
  user: User;
  onPageChange: (page: Page, id?: string) => void;
  onOpenNotifications?: () => void;
}

export default function HomeHeader({ user, onPageChange, onOpenNotifications }: HomeHeaderProps) {
  const displayName = user?.username || 'Khel Galli';
  const totalBalance = (user?.wallet?.deposit || 0) + (user?.wallet?.winnings || 0) + (user?.wallet?.bonus || 0);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    const q = query(collection(db, 'notifications'), limit(15));
    const unsub = onSnapshot(q, (snapshot) => {
      if (!user?.id) {
        setUnreadCount(snapshot.size);
        return;
      }
      let unread = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (!data.readBy || !data.readBy.includes(user.id)) {
          unread++;
        }
      });
      setUnreadCount(unread);
    }, (err) => {
      // ignore
    });

    return () => unsub();
  }, [user?.id]);

  return (
    <header className="px-4 sm:px-5 pt-3 pb-1">
      <div className="flex items-center justify-between gap-2">
        {/* Left: Circular Avatar / Khel Galli Gaming Logo Badge */}
        <div 
          onClick={() => onPageChange(Page.PROFILE)}
          className="flex items-center cursor-pointer active:scale-95 transition-transform shrink-0"
        >
          <div className="w-11 h-11 rounded-full bg-gradient-to-b from-[#162238] to-[#0a1220] p-0.5 border border-[#223963] shadow-lg flex items-center justify-center overflow-hidden">
            <div className="w-full h-full rounded-full bg-[#050b16] flex flex-col items-center justify-center text-center p-0.5">
              <span className="text-[7px] font-black uppercase tracking-tighter text-white leading-none">KHEL</span>
              <span className="text-[6.5px] font-black uppercase tracking-tighter text-amber-400 leading-none mt-0.5">GALLI</span>
            </div>
          </div>
        </div>

        {/* Center: Welcome Back & User / App Name */}
        <div className="text-center flex-1 px-1 min-w-0">
          <p className="text-[11px] sm:text-xs font-medium text-slate-300 tracking-tight leading-tight">
            Welcome Back,
          </p>
          <h1 className="text-sm sm:text-base font-black text-white tracking-wide leading-tight truncate max-w-[180px] mx-auto mt-0.5">
            {displayName}
          </h1>
        </div>

        {/* Right: Notifications Bell + Balance Card */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenNotifications && (
            <button
              onClick={onOpenNotifications}
              className="relative w-9 h-9 rounded-xl bg-[#0f1d3b] hover:bg-[#162a54] border border-[#223963] text-slate-300 hover:text-white flex items-center justify-center active:scale-95 transition-all shadow-sm"
              title="Notifications"
            >
              <Bell size={17} />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-gradient-to-r from-red-500 to-pink-500 text-white text-[9px] font-black flex items-center justify-center shadow-md animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          )}

          {/* White Balance Card Pill with Gold Coin */}
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
      </div>
    </header>
  );
}
