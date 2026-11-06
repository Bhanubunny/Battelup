import React from 'react';
import { RefreshCw, Calendar, CheckSquare, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { Page, Tournament } from '../types';

interface MyMatchesProps {
  matches?: Tournament[];
  joinedMatchIds?: string[];
  onPageChange: (page: Page, param?: string) => void;
}

export default function MyMatches({ onPageChange }: MyMatchesProps) {
  const cards = [
    {
      id: 'ongoing',
      title: 'Ongoing',
      type: 'ongoing',
      actionParam: 'freefire?status=ongoing'
    },
    {
      id: 'upcoming',
      title: 'Upcoming',
      type: 'upcoming',
      actionParam: 'freefire?status=upcoming'
    },
    {
      id: 'completed',
      title: 'Completed',
      type: 'completed',
      actionParam: 'freefire?status=completed'
    }
  ];

  return (
    <section className="px-4 sm:px-5 mt-5">
      {/* Centered Section Title matching Reference */}
      <h3 className="text-center text-sm sm:text-base font-bold text-white tracking-wide mb-3">
        My Matches
      </h3>

      {/* 3 Square/Rounded White Cards */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
        {cards.map((card) => {
          return (
            <motion.div
              key={card.id}
              whileHover={{ scale: 1.03, y: -2, transition: { duration: 0.15 } }}
              whileTap={{ scale: 0.96 }}
              onClick={() => onPageChange(Page.TOURNAMENTS, card.actionParam)}
              className="bg-white rounded-2xl py-4 px-2 text-center cursor-pointer shadow-md hover:shadow-lg transition-all flex flex-col items-center justify-center gap-2 border border-slate-100 group select-none active:bg-slate-50 aspect-[1/0.95]"
            >
              {/* Custom Icon Box matching Reference */}
              {card.type === 'ongoing' && (
                <div className="w-10 h-10 rounded-full bg-[#E0F7F6] flex items-center justify-center text-[#2DD4BF] group-hover:rotate-180 transition-transform duration-500">
                  <RefreshCw size={22} className="stroke-[2.8] text-[#14B8A6]" />
                </div>
              )}

              {card.type === 'upcoming' && (
                <div className="w-10 h-10 rounded-xl bg-[#2DD4BF] flex items-center justify-center text-white shadow-xs">
                  <Calendar size={22} className="stroke-[2.5]" />
                </div>
              )}

              {card.type === 'completed' && (
                <div className="w-10 h-10 rounded-xl bg-[#10B981] flex items-center justify-center text-white shadow-xs">
                  <Check size={24} className="stroke-[3]" />
                </div>
              )}

              {/* Status Label */}
              <span className="text-xs sm:text-sm font-bold text-[#0f172a] tracking-tight leading-none">
                {card.title}
              </span>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}


