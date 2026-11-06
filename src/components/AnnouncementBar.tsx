import React from 'react';
import { Megaphone } from 'lucide-react';

interface AnnouncementBarProps {
  text?: string;
  onClick: () => void;
}

export default function AnnouncementBar({
  text = 'KHEL GALLI — MAIN RULES & TELEGRAM CHANNEL',
  onClick
}: AnnouncementBarProps) {
  return (
    <section className="px-4 sm:px-5 mt-2.5">
      <div
        onClick={onClick}
        className="w-full bg-white rounded-lg sm:rounded-xl overflow-hidden shadow-md flex items-stretch cursor-pointer active:scale-[0.99] transition-transform select-none"
      >
        {/* Left: Bright Orange Block with Megaphone Icon */}
        <div className="w-12 sm:w-14 bg-[#FF6B00] flex items-center justify-center text-white shrink-0 py-2.5 sm:py-3">
          <Megaphone size={18} className="transform -rotate-12 fill-white stroke-white" />
        </div>

        {/* Right: White Banner with Dark Uppercase Text */}
        <div className="flex-1 bg-white px-3 py-2 flex items-center overflow-hidden">
          <div className="w-full overflow-hidden whitespace-nowrap">
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-[#0f172a] truncate">
              {text}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

