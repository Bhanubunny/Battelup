import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Page, Tournament } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { Gamepad2, Sparkles, Loader2 } from 'lucide-react';
import SafeImage from './SafeImage';

export interface GameMode {
  id: string;
  gameId: string;
  title: string;
  subtitle: string;
  image: string;
  category: string;
  order: number;
}

interface EsportsGamesGridProps {
  matches: Tournament[];
  onPageChange: (page: Page, param?: string) => void;
}

export default function EsportsGamesGrid({ matches, onPageChange }: EsportsGamesGridProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'tournament' | 'solo'>('all');
  const [modes, setModes] = useState<GameMode[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch real dynamic game modes configured in Admin
  useEffect(() => {
    const q = query(collection(db, 'gameModes'), orderBy('order', 'asc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedModes = snapshot.docs.map((docSnap) => ({ ...docSnap.data() } as GameMode));
        setModes(fetchedModes);
        setLoading(false);
      },
      (error) => {
        console.warn('Error listening to game modes on Home:', error);
        handleFirestoreError(error, OperationType.LIST, 'gameModes');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter modes dynamically based on active tab
  const filteredModes = modes.filter((mode) => {
    if (activeTab === 'all') return true;

    const titleUpper = (mode.title || '').toUpperCase();
    const subUpper = (mode.subtitle || '').toUpperCase();
    const isSolo =
      titleUpper.includes('SOLO') ||
      titleUpper.includes('1V1') ||
      subUpper.includes('SOLO') ||
      subUpper.includes('1V1');

    if (activeTab === 'solo') {
      return isSolo;
    }
    if (activeTab === 'tournament') {
      return !isSolo;
    }
    return true;
  });

  return (
    <section className="px-4 sm:px-5 mt-6 mb-6">
      {/* Centered Title */}
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-sm sm:text-base font-black text-white tracking-wide uppercase">
          Esports Arenas & Modes
        </h3>
        <button
          onClick={() => onPageChange(Page.GAME_MODES, 'freefire')}
          className="text-[9px] font-black uppercase text-blue-400 hover:text-blue-300 tracking-widest transition-colors"
        >
          View All
        </button>
      </div>

      {/* Dynamic Filter Tabs */}
      {modes.length > 0 && (
        <div className="w-full bg-[#0a152b] border border-[#1b2b4d] p-1 rounded-2xl flex items-center mb-4 select-none">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'all'
                ? 'bg-[#1e3461] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            ALL MODES
          </button>
          <button
            onClick={() => setActiveTab('tournament')}
            className={`flex-1 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'tournament'
                ? 'bg-[#1e3461] text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            SQUAD / DUO
          </button>
          <button
            onClick={() => setActiveTab('solo')}
            className={`flex-1 py-2 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all ${
              activeTab === 'solo'
                ? 'bg-white text-[#0f172a] shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            SOLO
          </button>
        </div>
      )}

      {/* Dynamic 3-Column Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="aspect-[1/1.2] rounded-xl sm:rounded-2xl bg-[#091326] border border-[#1b2f56]/40 animate-pulse flex items-center justify-center"
            >
              <Loader2 size={16} className="animate-spin text-blue-500/40" />
            </div>
          ))}
        </div>
      ) : modes.length === 0 ? (
        <div className="text-center py-10 bg-[#091326] border border-dashed border-[#1b2f56] rounded-2xl p-5">
          <Gamepad2 size={32} className="mx-auto mb-2 text-slate-600" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No Game Modes Added Yet</p>
          <p className="text-[9px] text-slate-500 mt-1 mb-3">Modes added in Admin Panel will appear here</p>
          <button
            onClick={() => onPageChange(Page.TOURNAMENTS, 'freefire')}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all"
          >
            <Sparkles size={12} /> Explore Tournaments
          </button>
        </div>
      ) : filteredModes.length === 0 ? (
        <div className="text-center py-8 bg-[#091326] border border-[#1b2f56] rounded-2xl p-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">No modes found in this tab</p>
          <button
            onClick={() => setActiveTab('all')}
            className="mt-2 text-[10px] text-blue-400 font-black uppercase underline"
          >
            Show All Modes
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {filteredModes.map((mode, idx) => {
            const activeMatchesCount = matches.filter(
              (m) =>
                m.status === 'upcoming' &&
                (m.modeId === mode.id ||
                  m.mode?.toLowerCase() === mode.title.toLowerCase() ||
                  m.section?.toLowerCase() === (mode.category || mode.subtitle || '').toLowerCase())
            ).length;

            return (
              <motion.div
                key={mode.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, duration: 0.25 }}
                whileHover={{ scale: 1.03, transition: { duration: 0.15 } }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onPageChange(Page.TOURNAMENTS, `${mode.gameId || 'freefire'}?mode=${mode.id}`)}
                className="group relative rounded-xl sm:rounded-2xl overflow-hidden border border-[#1b2f56] bg-[#091326] shadow-lg flex flex-col justify-end aspect-[1/1.2] cursor-pointer select-none"
              >
                {/* Background Character Graphic */}
                <div className="absolute inset-0 w-full h-full overflow-hidden">
                  <SafeImage
                    src={mode.image || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=600&auto=format&fit=crop'}
                    alt={mode.title}
                    className="w-full h-full"
                    imgClassName="group-hover:scale-110 transition-transform duration-500 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#060e1e] via-[#060e1e]/40 to-transparent" />
                </div>

                {/* Match count badge if matches are live - Absolutely positioned top-left */}
                {activeMatchesCount > 0 && (
                  <div className="absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 bg-emerald-500/90 backdrop-blur-sm rounded-md text-[7px] font-black uppercase text-white shadow-sm">
                    {activeMatchesCount} Live
                  </div>
                )}

                {/* Bottom Dark Navy Bar - Strictly pinned to bottom */}
                <div className="relative z-10 mt-auto w-full bg-[#121c33] border-t border-[#1e2f52] py-1.5 sm:py-2 px-1 text-center">
                  <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-white truncate block">
                    {mode.title}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </section>
  );
}
