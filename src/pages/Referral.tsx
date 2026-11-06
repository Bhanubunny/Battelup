import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Users, Gift, Share2, Copy, CheckCircle2, ChevronRight, Award, Trophy } from 'lucide-react';
import { Page, User } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';

interface ReferralPageProps {
  user: User;
  onPageChange: (page: Page) => void;
}

export default function ReferralPage({ user, onPageChange }: ReferralPageProps) {
  const [copied, setCopied] = useState(false);
  const [appSettings, setAppSettings] = useState<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'appSettings', 'referral_support'), (snap) => {
      if (snap.exists()) {
        setAppSettings(snap.data());
      }
    }, (error) => {
      console.warn("Referral settings notice:", error.message);
    });
    return () => unsub();
  }, []);

  const referralCode = user.username;
  const baseUrl = appSettings?.referral?.baseUrl?.replace(/\/$/, '') || window.location.origin;
  const referralLink = `${baseUrl}/signup?ref=${referralCode}`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Khel Galli Referral',
          text: `Join Khel Galli using my referral code ${referralCode} and get ₹${appSettings?.referral?.newUserReward || 10} bonus!`,
          url: referralLink,
        });
      } catch (err: any) {
        // If user canceled (AbortError) or it's blocked by iframe, fallback to copy
        if (err.name !== 'AbortError') {
          console.log('Share API failed or blocked, falling back to copy');
          handleCopy(referralLink);
        }
      }
    } else {
      handleCopy(referralLink);
    }
  };

  const refReward = appSettings?.referral?.perReferralReward || 0;
  const rewardType = appSettings?.referral?.rewardType || 'bonus';
  const newUserReward = appSettings?.referral?.newUserReward || 0;

  return (
    <div className="pb-24 max-w-lg mx-auto bg-background min-h-screen">
      <div className="px-5 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={() => onPageChange(Page.PROFILE)}
            className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h2 className="text-xl font-bold tracking-tighter uppercase italic text-white leading-none">
              Refer & <span className="text-purple-500">Earn</span>
            </h2>
            <p className="text-[8px] font-black uppercase tracking-widest text-neutral-600 mt-1">Unlimited Rewards Program</p>
          </div>
        </div>

        {/* Hero Card */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden p-8 rounded-[2.5rem] bg-gradient-to-br from-purple-600 to-indigo-700 shadow-2xl shadow-purple-900/20 mb-8"
        >
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Gift size={120} />
          </div>
          <div className="relative z-10">
             <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                <Gift className="text-white" size={24} />
             </div>
             <h3 className="text-2xl font-black italic text-white uppercase leading-[0.9] mb-4">
                Invite Friends,<br />
                Get ₹{refReward} Rewards
             </h3>
             <p className="text-[10px] font-bold text-purple-100 uppercase tracking-widest opacity-80 leading-relaxed mb-6">
                Spread the word and build your gaming squad. You get ₹{refReward} {rewardType === 'both' ? 'split' : rewardType} for every friend who joins.
             </p>
             <div className="flex items-center gap-3">
                <div className="px-4 py-2 bg-black/30 rounded-lg backdrop-blur-md border border-white/10">
                   <span className="text-[12px] font-black text-white italic">{referralCode}</span>
                </div>
                <button 
                   onClick={() => handleCopy(referralCode)}
                   className="p-2 bg-white rounded-lg text-purple-600 active:scale-90 transition-transform"
                >
                   {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                </button>
             </div>
          </div>
        </motion.div>

        {/* How it works */}
        <section className="space-y-4 mb-8">
           <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">How it works</h4>
           <div className="grid grid-cols-1 gap-3">
              <Step 
                num="01" 
                title="Share your link" 
                desc="Send your unique referral link to your friends or squad members." 
                icon={Share2}
              />
              <Step 
                num="02" 
                title="Friend Registers" 
                desc={`They get ₹${newUserReward} instant bonus when they sign up using your link.`} 
                icon={Users}
              />
              <Step 
                num="03" 
                title="Earn Together" 
                desc={`You receive ₹${refReward} reward instantly in your wallet.`} 
                icon={Award}
              />
           </div>
        </section>

        {/* Share Button */}
        <button 
           onClick={handleShare}
           className="w-full py-5 bg-white text-black rounded-3xl text-sm font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl shadow-white/5 active:scale-95 transition-all mb-8"
        >
           <Share2 size={20} />
           Share Referral link
        </button>

        {/* Info Card */}
        <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-3xl border-dashed">
           <div className="flex items-center gap-3 mb-4">
              <Trophy size={20} className="text-amber-500" />
              <h4 className="text-[11px] font-black uppercase tracking-tight text-white italic">Program Guidelines</h4>
           </div>
           <ul className="space-y-3">
              {[
                'One device allowed per referral',
                'Referee must be a new user',
                'Rewards are credited instantly',
                'No limit on number of referrals'
              ].map((rule, idx) => (
                <li key={idx} className="flex items-center gap-3 text-[9px] font-bold text-neutral-500 uppercase tracking-widest">
                   <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                   {rule}
                </li>
              ))}
           </ul>
        </div>
      </div>
    </div>
  );
}

function Step({ num, title, desc, icon: Icon }: any) {
  return (
    <div className="p-5 bg-neutral-900 border border-neutral-800 rounded-3xl flex gap-5">
       <div className="flex flex-col items-center gap-2">
          <span className="text-[12px] font-black text-purple-500 italic">{num}</span>
          <div className="flex-1 w-px bg-neutral-800" />
       </div>
       <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
             <h5 className="text-[11px] font-bold uppercase tracking-tight text-white">{title}</h5>
             <Icon size={14} className="text-neutral-700" />
          </div>
          <p className="text-[9px] font-black uppercase tracking-widest text-neutral-500 leading-relaxed italic">{desc}</p>
       </div>
    </div>
  );
}
