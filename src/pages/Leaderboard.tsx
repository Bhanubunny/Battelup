import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Crown, Trophy, Wallet, ChevronRight, Zap, Star } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, getDocs, where } from 'firebase/firestore';
import { User } from '../types';
import SafeImage from '../components/SafeImage';

const APP_LOGO = "https://i.ibb.co/XxVkbcW8/logo.png";

type LeaderboardTab = 'weekly' | 'monthly';

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState<LeaderboardTab>('weekly');
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<Record<string, User>>({});
  const [periodTransactions, setPeriodTransactions] = useState<any[]>([]);

  // Real-time listener for all users
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'users'), (snap) => {
      const usersMap = snap.docs.reduce((acc, d) => {
        acc[d.id] = { id: d.id, ...d.data() } as User;
        return acc;
      }, {} as Record<string, User>);
      setAllUsers(usersMap);
    }, (error) => {
      console.warn("Leaderboard users stream notice:", error.message);
    });
    return () => unsub();
  }, []);

  // Real-time listener for period winnings
  useEffect(() => {
    setLoading(true);
    const now = new Date();
    let startDate: Date;
    
    if (activeTab === 'weekly') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(now.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
    }

    const q = query(
      collection(db, 'transactions'),
      where('type', '==', 'win'),
      where('createdAt', '>=', startDate)
    );

    const unsub = onSnapshot(q, (snap) => {
      setPeriodTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Leaderboard trans error:", error);
      setLoading(false);
    });

    return () => unsub();
  }, [activeTab]);

  // Merge and calculate leaderboard
  const displayPlayers = React.useMemo(() => {
    const userIds = new Set([
      ...Object.keys(allUsers),
      ...periodTransactions.map(t => t.userId)
    ]);

    const earningsMap: Record<string, number> = {};
    periodTransactions.forEach(t => {
      if (t.userId) {
        earningsMap[t.userId] = (earningsMap[t.userId] || 0) + (Number(t.amount) || 0);
      }
    });

    const lbData = Array.from(userIds).map(uid => {
      const user = allUsers[uid];
      const periodWin = earningsMap[uid] || 0;
      const totalWin = user?.stats?.totalWinnings || 0;
      
      return {
        ...(user || { id: uid, username: 'Unknown Gamer' }),
        periodWinnings: periodWin,
        totalWinnings: totalWin
      };
    });

    // Sort based on period winnings first, then total if same period earnings
    // This supports the Weekly/Monthly filters explicitly
    return lbData
      .sort((a, b) => {
        if (b.periodWinnings !== a.periodWinnings) {
          return b.periodWinnings - a.periodWinnings;
        }
        return (b.totalWinnings || 0) - (a.totalWinnings || 0);
      })
      .slice(0, 100);
  }, [allUsers, periodTransactions]);

  const topThree = displayPlayers.slice(0, 3);
  const remainingPlayers = displayPlayers.slice(3);

  // If we have less than 3 players, we still want to show placeholders or adjust
  const hasTopThree = topThree.length > 0;

  return (
    <div className="h-screen flex flex-col bg-[#050505] text-white max-w-lg mx-auto overflow-hidden selection:bg-purple-500/30">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-full h-[500px] bg-purple-600/10 blur-[120px] rounded-full opacity-50" />
        <div className="absolute top-[20%] left-[-20%] w-[300px] h-[300px] bg-blue-600/5 blur-[100px] rounded-full" />
        <div className="absolute bottom-[10%] right-[-20%] w-[300px] h-[300px] bg-purple-600/5 blur-[100px] rounded-full" />
      </div>

      {/* Header Container */}
      <header className="relative pt-12 pb-6 px-6 z-20 flex-none bg-[#050505]/80 backdrop-blur-md">
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 bg-purple-500/10 border border-purple-500/20 rounded-full mb-3"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-pulse" />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-purple-400">Elite Rankings</span>
          </motion.div>
          
          <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-none mb-2">
            THE <span className="text-purple-500 underline decoration-purple-500/30 decoration-4 underline-offset-4">ARENA</span> KINGS
          </h1>
          <p className="text-[10px] text-neutral-500 uppercase tracking-[0.3em] font-bold">
            Real-time Global Standings
          </p>
        </div>

        {/* Tab Selection */}
        <div className="flex bg-neutral-900/60 backdrop-blur-xl p-1.5 rounded-2xl border border-white/5 shadow-2xl relative">
          {(['weekly', 'monthly'] as LeaderboardTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-[10px] font-black uppercase tracking-[0.15em] transition-all rounded-xl relative ${
                activeTab === tab ? 'text-white' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              <AnimatePresence>
                {activeTab === tab && (
                  <motion.div
                    layoutId="active-tab-glitter"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-linear-to-r from-purple-600 to-purple-500 rounded-xl shadow-[0_0_25px_rgba(168,85,247,0.4)]"
                  />
                )}
              </AnimatePresence>
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Star size={10} className={activeTab === tab ? 'fill-current' : ''} />
                {tab}
              </span>
            </button>
          ))}
        </div>
      </header>

      {/* Main Content Area - Scrollable */}
      <main className="relative z-10 flex-1 overflow-y-auto px-6 pb-32 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-6">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="w-16 h-16 p-1 bg-linear-to-tr from-purple-500/20 to-transparent border border-purple-500/30 rounded-2xl"
            >
              <div className="w-full h-full rounded-xl overflow-hidden bg-black shadow-[0_0_20px_rgba(168,85,247,0.2)]">
                <img src={APP_LOGO} alt="Loading" className="w-full h-full scale-90" />
              </div>
            </motion.div>
            <div className="space-y-2 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 animate-pulse">Syncing Arena Data</p>
              <div className="w-32 h-1 bg-neutral-900 rounded-full mx-auto overflow-hidden">
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-full h-full bg-purple-500 shadow-[0_0_10px_purple]"
                />
              </div>
            </div>
          </div>
        ) : !hasTopThree ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 mb-6 relative">
              <div className="absolute inset-0 bg-purple-500/10 blur-2xl rounded-full" />
              <img src={APP_LOGO} alt="No Data" className="w-full h-full opacity-20 filter grayscale" />
            </div>
            <h3 className="text-xl font-black italic uppercase tracking-tighter text-neutral-600 mb-2">No Rankings Yet</h3>
            <p className="text-[10px] text-neutral-700 uppercase tracking-widest font-bold">Be the first to dominate the arena</p>
          </div>
        ) : (
          <>
            {/* Podium Section */}
            <div className="flex items-end justify-center gap-2 sm:gap-4 pt-12 mb-16 px-2">
              {/* RANK 2 - LEFT */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex-1 flex flex-col items-center"
              >
                <div className="relative mb-4 group">
                  <div className={`absolute -inset-1 ${topThree[1] ? 'bg-neutral-400/20' : 'bg-neutral-800/10'} blur opacity-75 rounded-full`} />
                  <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-[1.8rem] bg-neutral-900 border-2 ${topThree[1] ? 'border-neutral-600' : 'border-white/5'} p-1 shadow-2xl`}>
                    <div className="w-full h-full rounded-[1.5rem] overflow-hidden bg-black ring-1 ring-white/5">
                      <SafeImage src={topThree[1] ? APP_LOGO : undefined} className="w-full h-full opacity-50" showLoader={false} />
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-7 h-7 bg-neutral-700 text-black rounded-xl flex items-center justify-center border-4 border-black text-[12px] font-black italic shadow-lg">2</div>
                </div>
                <div className="text-center w-full min-h-[40px]">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 truncate px-1">
                    {topThree[1]?.username || '---'}
                  </h4>
                  {topThree[1] && (
                    <span className="text-[14px] font-black italic text-neutral-500 tracking-tighter flex items-center justify-center gap-1">
                      <Zap size={10} /> ₹{topThree[1].periodWinnings || 0}
                    </span>
                  )}
                </div>
              </motion.div>

              {/* RANK 1 - CENTER */}
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="w-28 sm:w-32 flex flex-col items-center -mt-10 relative z-20"
              >
                <div className="relative mb-6 group">
                  {topThree[0] && <div className="absolute -inset-4 bg-amber-500/20 blur-[30px] rounded-full animate-pulse" />}
                  
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute -top-12 left-1/2 -translate-x-1/2 drop-shadow-[0_0_15px_rgba(251,191,36,0.8)] flex items-center justify-center"
                  >
                    <Crown size={48} className={`${topThree[0] ? 'text-amber-400' : 'text-neutral-800'} fill-current opacity-50`} />
                  </motion.div>

                  <div className={`relative w-24 h-24 sm:w-28 sm:h-28 rounded-[2.8rem] bg-neutral-900 border-4 ${topThree[0] ? 'border-amber-400' : 'border-white/5'} p-1.5 shadow-[0_0_50px_rgba(251,191,36,0.15)] ring-4 ring-amber-400/10`}>
                    <div className="w-full h-full rounded-[2.3rem] overflow-hidden bg-black ring-1 ring-white/5">
                      <SafeImage src={topThree[0] ? APP_LOGO : undefined} className="w-full h-full" showLoader={false} />
                    </div>
                  </div>

                  <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 w-12 h-12 ${topThree[0] ? 'bg-amber-400' : 'bg-neutral-800'} text-black rounded-2xl flex items-center justify-center border-[6px] border-black text-lg font-black shadow-2xl z-20`}>
                    <Trophy size={20} />
                  </div>
                </div>

                <div className="text-center w-full min-h-[50px]">
                  <h4 className={`text-[12px] font-black uppercase tracking-[0.2em] ${topThree[0] ? 'text-amber-400' : 'text-neutral-600'} mb-1 truncate px-1`}>
                    {topThree[0]?.username || '---'}
                  </h4>
                  {topThree[0] && (
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-400/10 rounded-xl border border-amber-400/20">
                      <span className="text-xl font-black italic text-white tracking-tighter">₹{topThree[0].periodWinnings || 0}</span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* RANK 3 - RIGHT */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="flex-1 flex flex-col items-center"
              >
                <div className="relative mb-4 group">
                  <div className={`absolute -inset-1 ${topThree[2] ? 'bg-[#CD7F32]/20' : 'bg-neutral-800/10'} blur opacity-75 rounded-full`} />
                  <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-[1.8rem] bg-neutral-900 border-2 ${topThree[2] ? 'border-[#CD7F32]/60' : 'border-white/5'} p-1 shadow-2xl`}>
                    <div className="w-full h-full rounded-[1.5rem] overflow-hidden bg-black ring-1 ring-white/5">
                      <SafeImage src={topThree[2] ? APP_LOGO : undefined} className="w-full h-full opacity-50" showLoader={false} />
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -left-2 w-7 h-7 bg-[#CD7F32] text-black rounded-xl flex items-center justify-center border-4 border-black text-[12px] font-black italic shadow-lg">3</div>
                </div>
                <div className="text-center w-full min-h-[40px]">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-400 truncate px-1">
                    {topThree[2]?.username || '---'}
                  </h4>
                  {topThree[2] && (
                    <span className="text-[14px] font-black italic text-neutral-500 tracking-tighter flex items-center justify-center gap-1">
                      <Zap size={10} /> ₹{topThree[2].periodWinnings || 0}
                    </span>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Top 100 List */}
            <div className="space-y-3 mb-10">
              <div className="flex items-center justify-between px-4 mb-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Hall of Fame</span>
                <div className="h-px bg-neutral-900 flex-1 mx-4" />
                <span className="text-[8px] font-black uppercase tracking-widest text-purple-500">Top 100</span>
              </div>

              {remainingPlayers.length > 0 ? (
                remainingPlayers.map((player, index) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, y: 15 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: Math.min(index * 0.05, 0.5) }}
                    whileTap={{ scale: 0.98 }}
                    className="relative group h-20"
                  >
                    {/* Card Background with Glass Effect */}
                    <div className="absolute inset-0 bg-neutral-900/40 backdrop-blur-md rounded-[1.8rem] border border-white/5 group-hover:bg-neutral-800/60 group-hover:border-purple-500/30 transition-all duration-300" />
                    
                    {/* Glowing Edge on Hover */}
                    <div className="absolute inset-0 rounded-[1.8rem] bg-purple-600/0 group-hover:bg-purple-600/5 transition-all duration-300" />

                    <div className="relative h-full px-5 flex items-center justify-between z-10">
                      <div className="flex items-center gap-4">
                        {/* Rank Badge */}
                        <div className="w-8 flex items-center justify-center">
                          <span className="text-lg font-black italic text-neutral-600 group-hover:text-purple-400 group-hover:scale-110 transition-all">
                            #{index + 4}
                          </span>
                        </div>

                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-2xl bg-neutral-800 border border-white/5 p-1 group-hover:border-purple-500/20 transition-colors">
                          <div className="w-full h-full rounded-xl overflow-hidden bg-black shadow-inner">
                            <SafeImage src={APP_LOGO} className="w-full h-full" showLoader={false} />
                          </div>
                        </div>

                        {/* User Info */}
                        <div>
                          <h4 className="text-[13px] font-black uppercase tracking-[0.1em] text-white group-hover:text-purple-50 transition-colors">
                            {player.username}
                          </h4>
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-purple-500/40" />
                             <span className="text-[7px] font-black text-neutral-500 uppercase tracking-[0.2em]">Ranked Competitor</span>
                          </div>
                        </div>
                      </div>

                      {/* Winnings Badge */}
                      <div className="flex flex-col items-end">
                        <div className="px-4 py-2 bg-black/40 rounded-2xl border border-white/5 group-hover:border-purple-500/30 group-hover:bg-purple-950/20 transition-all">
                          <span className="text-[16px] font-black italic text-white tracking-tighter">
                            ₹{player.periodWinnings || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="py-12 bg-neutral-900/40 rounded-[1.8rem] border border-dashed border-white/5 text-center">
                   <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600">More challengers needed</p>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

