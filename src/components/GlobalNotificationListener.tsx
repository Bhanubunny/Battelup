import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Key, Trophy, Gift, ShieldCheck, Zap, Wallet, ChevronRight, CheckCircle2, Smartphone } from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { Page, AppNotification, User } from '../types';
import { 
  registerNotificationServiceWorker, 
  requestMobileNotificationPermission, 
  triggerMobileStatusBarNotification 
} from '../utils/mobileNotificationHelper';

interface GlobalNotificationListenerProps {
  user?: User | null;
  joinedMatchIds?: string[];
  onPageChange: (page: Page, id?: string) => void;
  onOpenNotificationsModal?: () => void;
}

export default function GlobalNotificationListener({
  user,
  joinedMatchIds = [],
  onPageChange,
  onOpenNotificationsModal
}: GlobalNotificationListenerProps) {
  const [activePopup, setActivePopup] = useState<AppNotification | null>(null);
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);
  const [isRequestingPermission, setIsRequestingPermission] = useState(false);

  const seenNotifIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize Service Worker & check permission on mount
  useEffect(() => {
    registerNotificationServiceWorker();

    // Check if permission is default and user hasn't dismissed it in this session
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        const dismissed = sessionStorage.getItem('kg_notif_banner_dismissed');
        if (!dismissed) {
          const timer = setTimeout(() => {
            setShowPermissionBanner(true);
          }, 2500);
          return () => clearTimeout(timer);
        }
      }
    }
  }, []);

  // Listen for navigation requests coming from Service Worker notification clicks
  useEffect(() => {
    const handleServiceWorkerMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'NAVIGATE_FROM_NOTIFICATION') {
        if (event.data.actionPage) {
          onPageChange(event.data.actionPage as Page, event.data.targetMatchId);
        } else if (onOpenNotificationsModal) {
          onOpenNotificationsModal();
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      };
    }
  }, [onPageChange, onOpenNotificationsModal]);

  // Gentle audio chime
  const playAlertSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (err) {
      // Ignore audio restriction
    }
  };

  // Sync browser notification permission status to Firestore user document
  useEffect(() => {
    if (!user?.id) return;

    if ('Notification' in window && Notification.permission === 'granted') {
      if (!user.fcmEnabled || !user.notificationsEnabled) {
        updateDoc(doc(db, 'users', user.id), {
          fcmEnabled: true,
          notificationsEnabled: true
        }).catch(() => {});
      }
    }
  }, [user?.id, user?.fcmEnabled, user?.notificationsEnabled]);

  // Listen to Firestore notifications in real-time
  useEffect(() => {
    if (!user?.id) return;

    const q = query(
      collection(db, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      if (!initialLoadDone.current) {
        // Populate initial existing IDs so we don't spam on initial load
        snapshot.docs.forEach((d) => seenNotifIds.current.add(d.id));
        initialLoadDone.current = true;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const notifId = change.doc.id;
          if (seenNotifIds.current.has(notifId)) return;
          seenNotifIds.current.add(notifId);

          const data = { id: notifId, ...change.doc.data() } as AppNotification;

          // Audience check
          let isForUser = true;
          if (data.audience === 'match' && data.targetMatchId) {
            isForUser = joinedMatchIds.includes(data.targetMatchId);
          } else if (data.audience === 'user' && data.targetUserId) {
            isForUser = user?.id === data.targetUserId;
          }

          if (isForUser) {
            // 1. In-app floating popup
            setActivePopup(data);
            playAlertSound();

            // 2. TRIGGER NATIVE MOBILE STATUS BAR NOTIFICATION
            triggerMobileStatusBarNotification(data.title, data.message, {
              tag: data.id || 'khel-galli-alert',
              targetMatchId: data.targetMatchId,
              actionPage: data.actionPage,
              icon: '/icon.svg',
              badge: '/icon.svg'
            });

            // Auto dismiss in-app popup after 6.5s
            setTimeout(() => {
              setActivePopup((curr) => (curr?.id === notifId ? null : curr));
            }, 6500);
          }
        }
      });
    }, (err) => {
      console.warn('Realtime notifications listener notice:', err);
    });

    return () => unsub();
  }, [user?.id, JSON.stringify(joinedMatchIds)]);

  const handleEnablePermission = async () => {
    setIsRequestingPermission(true);
    try {
      const res = await requestMobileNotificationPermission(user?.id);
      if (res === 'granted') {
        setShowPermissionBanner(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsRequestingPermission(false);
    }
  };

  const handleDismissPermissionBanner = () => {
    setShowPermissionBanner(false);
    sessionStorage.setItem('kg_notif_banner_dismissed', 'true');
  };

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActivePopup(null);
  };

  const handleTap = () => {
    if (!activePopup) return;
    
    // Mark as read in Firestore
    if (user?.id && activePopup.id) {
      updateDoc(doc(db, 'notifications', activePopup.id), {
        readBy: arrayUnion(user.id)
      }).catch(() => {});
    }

    if (activePopup.actionPage) {
      onPageChange(activePopup.actionPage as Page, activePopup.targetMatchId);
    } else if (onOpenNotificationsModal) {
      onOpenNotificationsModal();
    }
    setActivePopup(null);
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'room_creds': return <Key size={18} className="text-purple-400" />;
      case 'tournament': return <Trophy size={18} className="text-amber-400" />;
      case 'offer': return <Gift size={18} className="text-pink-400" />;
      case 'wallet': return <Wallet size={18} className="text-emerald-400" />;
      case 'fairplay': return <ShieldCheck size={18} className="text-teal-400" />;
      default: return <Bell size={18} className="text-purple-400" />;
    }
  };

  return (
    <>
      {/* 1. Mobile Status Bar Permission Prompt Banner */}
      <AnimatePresence>
        {showPermissionBanner && (
          <div className="fixed bottom-20 left-0 right-0 z-50 px-3 sm:px-4 pointer-events-none flex justify-center">
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.95 }}
              className="w-full max-w-md bg-[#0a0f24]/95 border border-purple-500/50 backdrop-blur-xl p-4 rounded-3xl shadow-2xl shadow-purple-950 pointer-events-auto flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-lg shadow-purple-900/50">
                  <Smartphone size={20} className="animate-pulse" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-white uppercase tracking-tight truncate">
                    Enable Mobile Status Bar Alerts
                  </h4>
                  <p className="text-[10px] text-neutral-300 font-medium truncate mt-0.5">
                    Get instant Room ID & Password in your phone notification bar!
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleEnablePermission}
                  disabled={isRequestingPermission}
                  className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-md transition-all flex items-center gap-1"
                >
                  <Bell size={12} />
                  <span>{isRequestingPermission ? 'Enabling...' : 'Allow'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismissPermissionBanner}
                  className="p-1.5 text-neutral-400 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. Floating Live In-App Notification Banner */}
      <AnimatePresence>
        {activePopup && (
          <div className="fixed top-3 left-0 right-0 z-50 px-3 sm:px-4 pointer-events-none flex justify-center">
            <motion.div
              initial={{ opacity: 0, y: -40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -30, scale: 0.95 }}
              transition={{ type: 'spring', damping: 20, stiffness: 300 }}
              onClick={handleTap}
              className="w-full max-w-md bg-[#0a0a10]/95 backdrop-blur-xl border border-purple-500/40 p-3.5 rounded-2xl shadow-2xl shadow-purple-950/80 pointer-events-auto cursor-pointer flex items-center justify-between gap-3 group active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center shrink-0 shadow-inner">
                  {getIcon(activePopup.type)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider text-purple-400">
                      Live Mobile Notification
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <h4 className="text-xs font-black text-white truncate leading-tight mt-0.5">
                    {activePopup.title}
                  </h4>
                  <p className="text-[11px] text-neutral-300 truncate leading-tight mt-0.5 font-medium">
                    {activePopup.message}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-purple-600/30 flex items-center justify-center text-neutral-400 group-hover:text-white transition-colors">
                  <ChevronRight size={15} />
                </div>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-neutral-500 hover:text-white transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
