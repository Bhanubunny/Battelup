import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, X, ShieldCheck, Gift, Trophy, ArrowRight, 
  Key, Zap, Wallet, Sparkles, Check, Trash2, ExternalLink,
  Smartphone, CheckCircle2
} from 'lucide-react';
import { Page, AppNotification, User } from '../types';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useModalBackHandler } from '../hooks/useModalBackHandler';
import SafeImage from './SafeImage';
import { requestMobileNotificationPermission, triggerMobileStatusBarNotification } from '../utils/mobileNotificationHelper';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPageChange: (page: Page, id?: string) => void;
  user?: User | null;
  joinedMatchIds?: string[];
}

export default function NotificationsModal({ 
  isOpen, 
  onClose, 
  onPageChange,
  user,
  joinedMatchIds = []
}: NotificationsModalProps) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [permissionStatus, setPermissionStatus] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useModalBackHandler(isOpen, onClose);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermissionStatus(Notification.permission);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const q = query(
      collection(db, 'notifications'), 
      orderBy('createdAt', 'desc'),
      limit(30)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      } as AppNotification));

      // Filter based on audience
      const filtered = list.filter(item => {
        if (!item.audience || item.audience === 'all') return true;
        if (item.audience === 'match' && item.targetMatchId) {
          return joinedMatchIds.includes(item.targetMatchId);
        }
        if (item.audience === 'user' && item.targetUserId && user?.id) {
          return item.targetUserId === user.id;
        }
        return true;
      });

      setNotifications(filtered);
      setLoading(false);
    }, (err) => {
      console.error('Error listening to notifications:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [isOpen, user?.id, JSON.stringify(joinedMatchIds)]);

  const handleEnableMobileNotifications = async () => {
    setIsRequestingPermission(true);
    try {
      const perm = await requestMobileNotificationPermission(user?.id);
      setPermissionStatus(perm);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleSendTestNotification = async () => {
    await triggerMobileStatusBarNotification(
      '🔥 Free Fire Match Alert!',
      'Room ID: 893412 • Pass: 1234 | Match starts in 10 minutes!',
      { tag: 'test-mobile-bar-alert' }
    );
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  // Mark a single notification as read in Firestore
  const handleMarkAsRead = async (notifId?: string) => {
    if (!notifId || !user?.id) return;
    try {
      await updateDoc(doc(db, 'notifications', notifId), {
        readBy: arrayUnion(user.id)
      });
    } catch (e) {
      console.error('Could not mark as read:', e);
    }
  };

  const getIconAndStyle = (type?: string) => {
    switch (type) {
      case 'room_creds':
        return {
          icon: Key,
          color: 'bg-purple-500/20 text-purple-400 border-purple-500/40',
          badge: 'Room Credentials'
        };
      case 'tournament':
        return {
          icon: Trophy,
          color: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
          badge: 'Tournament Alert'
        };
      case 'offer':
        return {
          icon: Gift,
          color: 'bg-pink-500/20 text-pink-400 border-pink-500/40',
          badge: 'Exclusive Offer'
        };
      case 'wallet':
        return {
          icon: Wallet,
          color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
          badge: 'Wallet / Cash'
        };
      case 'fairplay':
        return {
          icon: ShieldCheck,
          color: 'bg-teal-500/20 text-teal-400 border-teal-500/40',
          badge: 'FairPlay Notice'
        };
      case 'alert':
      default:
        return {
          icon: Zap,
          color: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
          badge: 'Announcement'
        };
    }
  };

  const formatTimeAgo = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const diffSecs = Math.floor((Date.now() - date.getTime()) / 1000);
      if (diffSecs < 60) return 'Just now';
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
      return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    } catch {
      return 'Recent';
    }
  };

  // Fallback items if database notifications are empty
  const displayItems = notifications.length > 0 ? notifications : [
    {
      id: 'default_1',
      title: 'Grand Free Fire Championship',
      message: 'Join our daily Mega Clash Squad & Battle Royale tournaments. Instant room credentials and guaranteed prize distribution.',
      type: 'tournament' as const,
      audience: 'all' as const,
      actionPage: Page.TOURNAMENTS,
      actionText: 'View Arena',
      createdAt: null
    },
    {
      id: 'default_2',
      title: 'FairPlay & Anti-Cheat Active',
      message: 'All custom rooms are strictly monitored. Emulators, hacks and config files result in immediate permanent ban.',
      type: 'fairplay' as const,
      audience: 'all' as const,
      actionPage: undefined,
      actionText: undefined,
      createdAt: null
    },
    {
      id: 'default_3',
      title: 'Refer & Earn ₹50 Bonus Cash',
      message: 'Invite your Free Fire squad to Khel GALLI and earn instant cash rewards on every deposit.',
      type: 'offer' as const,
      audience: 'all' as const,
      actionPage: Page.REFERRAL,
      actionText: 'Invite Friends',
      createdAt: null
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0"
          />

          <motion.div
            initial={{ scale: 0.92, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.92, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-md bg-[#0a1226] border border-[#1e3461] rounded-[2rem] p-5 sm:p-6 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-44 h-44 bg-blue-600/15 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-white/10 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-inner">
                  <Bell size={18} />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-white flex items-center gap-1.5">
                    Notifications
                    {notifications.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30">
                        {notifications.length}
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] font-bold text-blue-400/80 uppercase tracking-wider">
                    Official Updates & Alerts
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-neutral-400 hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Mobile Status Bar Notification Card */}
            <div className="mt-3 p-3 bg-gradient-to-r from-purple-950/40 to-blue-950/40 border border-purple-500/30 rounded-2xl flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Smartphone size={16} />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-white uppercase tracking-tight truncate">
                    Mobile Notification Bar
                  </p>
                  <p className="text-[9px] text-neutral-400 truncate">
                    {permissionStatus === 'granted' 
                      ? 'Active • Alerts appear in phone status bar' 
                      : 'Disabled • Tap to enable status bar alerts'}
                  </p>
                </div>
              </div>

              {permissionStatus === 'granted' ? (
                <button
                  type="button"
                  onClick={handleSendTestNotification}
                  className="px-2.5 py-1.5 bg-emerald-600/20 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-600/30 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shrink-0 flex items-center gap-1"
                >
                  <CheckCircle2 size={11} />
                  <span>{testSent ? 'Sent!' : 'Test'}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleEnableMobileNotifications}
                  disabled={isRequestingPermission}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-sm transition-all shrink-0 active:scale-95"
                >
                  {isRequestingPermission ? '...' : 'Enable'}
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="mt-3 space-y-2.5 overflow-y-auto no-scrollbar pr-0.5 relative z-10 flex-1">
              {displayItems.map((item) => {
                const style = getIconAndStyle(item.type);
                const Icon = style.icon;
                const isRead = user?.id && item.readBy?.includes(user.id);

                return (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-2xl border transition-all shadow-md relative overflow-hidden ${
                      isRead 
                        ? 'bg-[#0b162c]/60 border-[#1a2f55]/60 opacity-80' 
                        : 'bg-[#0f1d3b] border-[#223d72] hover:border-blue-500/50'
                    }`}
                  >
                    {/* Unread Accent Pill */}
                    {!isRead && user?.id && item.id && !item.id.startsWith('default') && (
                      <div className="absolute top-3 right-3 flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                      </div>
                    )}

                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 shadow-sm ${style.color}`}>
                        <Icon size={16} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap pr-4">
                          <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md border ${style.color}`}>
                            {style.badge}
                          </span>
                          <span className="text-[8px] font-medium text-slate-400">
                            {formatTimeAgo(item.createdAt)}
                          </span>
                        </div>

                        <h4 className="text-xs font-black text-white leading-tight tracking-tight">
                          {item.title}
                        </h4>

                        <p className="text-[11px] text-slate-300 leading-relaxed font-normal mt-1 whitespace-pre-line">
                          {item.message}
                        </p>

                        {/* Attached Image if any */}
                        {item.imageUrl && (
                          <div className="mt-2.5 rounded-xl overflow-hidden border border-white/10 max-h-36">
                            <SafeImage 
                              src={item.imageUrl} 
                              alt="Notification Attachment"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* Target Match or User info if scoped */}
                        {item.targetMatchTitle && (
                          <div className="mt-2 text-[9px] font-bold text-amber-300 bg-amber-500/10 px-2 py-1 rounded-lg border border-amber-500/20 inline-block">
                            🎮 Match: {item.targetMatchTitle}
                          </div>
                        )}

                        {/* Action CTA Button */}
                        {(item.actionPage || item.actionUrl || item.actionText) && (
                          <div className="mt-2 flex items-center justify-between pt-2 border-t border-white/5">
                            <button
                              onClick={() => {
                                handleMarkAsRead(item.id);
                                onClose();
                                if (item.actionUrl) {
                                  window.open(item.actionUrl, '_blank');
                                } else if (item.actionPage) {
                                  onPageChange(item.actionPage as Page, item.targetMatchId);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-400 hover:text-cyan-300 transition-colors"
                            >
                              <span>{item.actionText || 'Open Details'}</span>
                              {item.actionUrl ? <ExternalLink size={11} /> : <ArrowRight size={12} />}
                            </button>

                            {!isRead && user?.id && item.id && !item.id.startsWith('default') && (
                              <button
                                onClick={() => handleMarkAsRead(item.id)}
                                className="text-[9px] font-bold text-slate-400 hover:text-white transition-colors"
                              >
                                Mark as Read
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Footer */}
            <div className="mt-3.5 pt-3 border-t border-white/5 flex gap-2">
              <button
                onClick={onClose}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-600/25 active:scale-[0.98]"
              >
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
