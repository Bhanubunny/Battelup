import { Wallet, Bell, Search } from 'lucide-react';
import { Page, User } from '../types';
import SafeImage from './SafeImage';

interface HeaderProps {
  user: User;
  onPageChange: (page: Page) => void;
}

export default function Header({ user, onPageChange }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-black py-4 border-b border-white/5">
      <div className="flex items-center justify-between px-5 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <div 
            onClick={() => onPageChange(Page.PROFILE)}
            className="w-12 h-12 rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/10 cursor-pointer border border-white/10"
          >
            <SafeImage 
              src="https://i.ibb.co/n8jPYbMP/image.png" 
              alt="Logo" 
              className="w-full h-full"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest leading-none">Server Online</span>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
            </div>
            <h1 className="text-xl font-bold tracking-tighter uppercase leading-none text-white">
              Khel <span className="text-purple-500">Galli</span>
            </h1>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onPageChange(Page.WALLET)}
            className="flex items-center gap-3 bg-neutral-900 border border-white/5 px-4 py-2 rounded-2xl active:scale-95 transition-all shadow-xl"
          >
            <span className="text-purple-400 font-bold text-sm">₹{((user.wallet?.deposit || 0) + (user.wallet?.winnings || 0) + (user.wallet?.bonus || 0)).toLocaleString()}</span>
            <div className="p-1.5 bg-purple-500/10 rounded-lg">
              <Wallet size={16} className="text-purple-400" />
            </div>
          </button>
        </div>
      </div>
    </header>
  );
}
