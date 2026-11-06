import React from 'react';
import { motion } from 'motion/react';
import { useLocation } from 'react-router-dom';
import { Zap, Gamepad2, User as UserIcon } from 'lucide-react';
import { Page, User } from '../types';

interface BottomNavProps {
  currentPage?: Page;
  onPageChange: (page: Page, param?: string) => void;
  user?: User | null;
  onOpenRules?: () => void;
  onOpenSupport?: () => void;
}

export default function BottomNav({
  onPageChange,
  user
}: BottomNavProps) {
  const location = useLocation();

  const tabs = [
    {
      id: 'earn',
      label: 'Earn',
      icon: Zap,
      path: '/referral',
      page: Page.REFERRAL,
      color: 'text-amber-400'
    },
    {
      id: 'play',
      label: 'Play',
      icon: Gamepad2,
      path: '/home',
      page: Page.HOME,
      color: 'text-white'
    },
    {
      id: 'account',
      label: 'Account',
      icon: UserIcon,
      path: '/profile',
      page: Page.PROFILE,
      color: 'text-white'
    }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-slate-900 pb-safe z-40 shadow-2xl">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-4">
        {tabs.map((tab) => {
          const isPlay = tab.id === 'play';
          const isActive = isPlay
            ? location.pathname === '/' ||
              location.pathname.startsWith('/home') ||
              location.pathname.startsWith('/game-modes') ||
              location.pathname.startsWith('/tournaments')
            : location.pathname.startsWith(tab.path);

          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onPageChange(tab.page)}
              className={`relative flex flex-col items-center justify-center w-full h-full transition-all group ${
                isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="flex flex-col items-center justify-center">
                <div className="mb-1 transition-transform group-active:scale-90">
                  {tab.id === 'earn' ? (
                    <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center text-black shadow-xs">
                      <Zap size={14} className="fill-black stroke-black" />
                    </div>
                  ) : (
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.5 : 2}
                      className={
                        isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                      }
                    />
                  )}
                </div>
                <span
                  className={`text-[11px] font-bold tracking-tight ${
                    isActive ? 'text-white font-black' : 'text-slate-400 group-hover:text-white'
                  }`}
                >
                  {tab.label}
                </span>

                {/* Active Indicator Line */}
                {isActive && (
                  <motion.div
                    layoutId="activeBottomTab"
                    className="absolute -bottom-1 w-6 h-0.5 bg-amber-400 rounded-full shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                  />
                )}
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

