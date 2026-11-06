import React from 'react';
import { motion } from 'motion/react';
import SafeImage from './SafeImage';

interface GameCategoryCardProps {
  id?: string;
  title: string;
  centerTitle?: string;
  bottomLabel?: string;
  badgeTitle?: string;
  image: string;
  playerCount: number;
  onClick: () => void;
}

export default function GameCategoryCard({
  title,
  centerTitle,
  bottomLabel,
  badgeTitle = 'FREE FIRE MAX',
  image,
  playerCount,
  onClick
}: GameCategoryCardProps) {
  const displayCenter = centerTitle || title;
  const displayBottom = bottomLabel || title;

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -3, transition: { type: 'spring', stiffness: 400, damping: 25 } }}
      whileTap={{ scale: 0.96, transition: { duration: 0.1 } }}
      onClick={onClick}
      className="relative w-full aspect-[2/1] rounded-[14px] overflow-hidden border border-[#1b3464] hover:border-cyan-400/80 hover:shadow-cyan-500/20 hover:shadow-xl cursor-pointer shadow-lg shadow-black/60 bg-[#070e22] flex flex-col justify-between group select-none transition-colors duration-300"
    >
      {/* Background Esports Artwork */}
      <SafeImage
        src={image}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover"
        imgClassName="group-hover:scale-105 transition-transform duration-500 object-cover w-full h-full"
      />

      {/* Dark Esports Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#050b18] via-[#050b18]/55 to-[#050b18]/35" />

      {/* Center Esports Banner Badge - scaled compactly */}
      <div className="relative z-10 px-2 pt-2 flex flex-col items-center justify-center text-center my-auto">
        <span className="text-[6.5px] font-black uppercase tracking-[0.18em] text-cyan-300 bg-cyan-950/85 border border-cyan-500/40 px-1.5 py-0.2 rounded backdrop-blur-xs mb-0.5 leading-none">
          {badgeTitle}
        </span>
        <h4 className="text-[10.5px] sm:text-xs font-black italic uppercase tracking-tight text-white leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.95)]">
          {displayCenter}
        </h4>
        <span className="text-[7px] sm:text-[7.5px] font-black uppercase tracking-widest text-amber-400 drop-shadow leading-none mt-0.5">
          TOURNAMENT
        </span>
      </div>

      {/* Bottom Bar: Title & Live Player Indicator */}
      <div className="relative z-10 bg-[#040814]/95 backdrop-blur-md px-2.5 py-1.5 border-t border-[#16274a] flex items-center justify-between">
        <span className="text-[9.5px] sm:text-[10.5px] font-bold uppercase tracking-tight text-white truncate max-w-[62%]">
          {displayBottom}
        </span>

        {/* Live Active Player Count */}
        <div className="flex items-center gap-1 shrink-0 bg-black/45 px-1.5 py-0.5 rounded-full border border-white/5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.9)]" />
          <span className="text-[9px] sm:text-[10px] font-bold text-emerald-400 tracking-tight leading-none">
            {playerCount > 0 ? playerCount : 'LIVE'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

