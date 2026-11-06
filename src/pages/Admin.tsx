import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, Shield, Users, Trophy, DollarSign, Settings, 
  Search, Ban, Unlock, Wallet, Plus, Minus, Trash2, 
  Clock, Map as MapIcon, Users as UsersIcon, LogOut,
  CheckCircle2, AlertCircle, Loader2, Save, RefreshCw,
  Edit2, Copy, Upload, Gamepad2, Key, Check, CheckCheck,
  ListChecks, FileText, Sparkles, PlusCircle, RotateCcw,
  Filter, ChevronUp, ChevronDown, Send, Bell
} from 'lucide-react';
import { Page, User, Tournament, Banner, PaymentGateway } from '../types';
import { db, auth, storage, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatMatchTime } from '../utils/dateUtils';
import SafeImage from '../components/SafeImage';
import { uploadOriginalImage } from '../utils/imageCompressor';
import AdminNotificationsTab from '../components/AdminNotificationsTab';

import { 
  collection, doc, onSnapshot, updateDoc, deleteDoc,
  addDoc, serverTimestamp, runTransaction, writeBatch,
  query, where, orderBy, getDocs, increment, setDoc
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { useModalBackHandler } from '../hooks/useModalBackHandler';

interface AdminPageProps {
  onPageChange: (page: Page, id?: string) => void;
}

enum AdminTab {
  DASHBOARD = 'dashboard',
  NOTIFICATIONS = 'notifications',
  USERS = 'users',
  MATCHES = 'matches',
  TRANSACTIONS = 'transactions',
  RULES = 'rules',
  REFERRAL = 'referral',
  BANNERS = 'banners',
  MODES = 'modes',
  PAYMENT = 'payment'
}

// Built-in rule presets for various game modes and sections
const RULE_PRESETS: Record<string, { title: string; category: string; rules: string[] }> = {
  battle_royale: {
    title: 'Battle Royale',
    category: 'Battle Royale',
    rules: [
      'Level Requirement: Only players with Level 40+ IDs are eligible to participate.',
      'Headshot Rate: Career headshot rate must not exceed 70%.',
      'Device Requirements: Strictly mobile & tablet devices only. Emulators/PC are 100% prohibited.',
      'Registration Name: Enter exact in-game IGN without font errors or unsupported special characters.',
      'Anti-Teaming Rule: Teaming with opponents is strictly prohibited and results in permanent ban.',
      'Hacking & Scripts: Zero-tolerance policy for aimbots, auto-headshots, speed hacks, or modified game files.',
      'Late Entry: Room closes 2 minutes before match start time. Late entry is not entertained.',
      'Screenshot Policy: In case of ranking/kill dispute, high-definition final match screenshot is mandatory.',
      'Match Result Policy: Scores will be verified by the admin team post-match before prize distribution.',
      'Cancellation & Refund Policy: If a match is cancelled by admin, 100% of entry fee is refunded back to wallet instantly.'
    ]
  },
  clash_squad: {
    title: 'Clash Squad (4v4 / Duo)',
    category: 'Clash Squad',
    rules: [
      'Level Requirement: Minimum Level 40 in Free Fire account.',
      'Headshot Rate: Clash Squad headshot rate must remain below 70%.',
      'Device Requirements: Mobile & Tablet only. Emulators will be immediately kicked and banned.',
      'Gun Attributes: Gun attributes and character skill settings will be as per custom room setup.',
      'Grenades & Items: Usage of limited tactical items will follow room preset rules.',
      'Teaming & Sabotage: Teaming or intentional feeding is strictly forbidden.',
      'Screenshot Policy: Winning team captain must submit end-game score screenshot in case of dispute.',
      'Prize Distribution: Winnings will be credited automatically to winning player/team wallets post verification.',
      'Admin Decision: Admin ruling will be final and binding for all participants.'
    ]
  },
  lone_wolf: {
    title: 'Lone Wolf (1v1 / 2v2)',
    category: 'Lone Wolf',
    rules: [
      'Level Requirement: Level 30+ Free Fire profile.',
      'Headshot Rate: Lone Wolf headshot rate maximum 75%.',
      'Device Requirements: Mobile / Tablet players only. No PC / Emulators.',
      'Fair Duel: One-on-one duel requires true sportsman spirit without glitch exploiting.',
      'Weapon Restrictions: Respect custom weapon restrictions if specified in room title (e.g. M1887 only, Sniper only).',
      'Disconnect Policy: If a player disconnects mid-round, rematch will only be granted if admin verifies technical glitch.',
      'Screenshot Requirement: Final victory screen screenshot mandatory for dispute settlement.',
      'Instant Payout: Winnings credited within 10-15 minutes after match confirmation.'
    ]
  },
  custom_room: {
    title: 'Custom Room / Tournament',
    category: 'Custom Room',
    rules: [
      'All standard esports tournament fairplay rules apply.',
      'Slot Assignment: Players must join ONLY their assigned slot number. Wrong slot leads to kick without refund.',
      'Room Settings: Custom room parameters (Ammo, Fall Damage, Character Skills) are set as specified in match title.',
      'No third-party crosshairs, config files, or GFX tools allowed.',
      'Admin decision is final in all dispute settlements.'
    ]
  },
  sniper_only: {
    title: 'Sniper Only Challenge',
    category: 'Sniper Only',
    rules: [
      'Only Sniper Rifles (AWM, Kar98k, M82B, Barrett) are permitted for combat.',
      'Using pistols, melee, or AR/SMG weapons will result in immediate disqualification with 0 points.',
      'No emulator or modified script allowed.',
      'Final kill feed and damage screenshot must be submitted.'
    ]
  },
  four_v_four: {
    title: '4v4 Clash Duel',
    category: '4v4 Clash',
    rules: [
      'Full squad (4 players) must be ready before room launch time.',
      'All 4 players must have registered with valid IGNs.',
      'No roof camping or out-of-bounds wall glitching.',
      'First team to win the required round count wins the contest.'
    ]
  },
  one_v_one: {
    title: '1v1 Duel Arena',
    category: '1v1 Duel',
    rules: [
      'Pure 1v1 head-to-head showdown on chosen map.',
      'Gun selection rules as specified in room rules (e.g. Desert Eagle only or Shotgun only).',
      'No wall-trapping or infinite gloo wall glitch.',
      'Proof screenshot required for claiming bounty prize.'
    ]
  }
};

export default function AdminPage({ onPageChange }: AdminPageProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>(AdminTab.DASHBOARD);
  const [users, setUsers] = useState<User[]>([]);
  const [matches, setMatches] = useState<Tournament[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState<{ isOpen: boolean, matchId: string }>({ isOpen: false, matchId: '' });
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [selectedMatchResults, setSelectedMatchResults] = useState<Tournament | null>(null);
  const [playerResults, setPlayerResults] = useState<Record<string, number>>({}); // userId -> value (kills or rank)
  const [playerPositionResults, setPlayerPositionResults] = useState<Record<string, number>>({}); // userId -> rank (for PER KILL matches)
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Dynamic Rules State for All Game Mode Sections
  const [gameRulesDocs, setGameRulesDocs] = useState<Record<string, { id: string; title: string; category?: string; section?: string; rules: string[]; updatedAt?: any }>>({});
  const [gameModesList, setGameModesList] = useState<any[]>([]);
  const [activeRuleTab, setActiveRuleTab] = useState<string>('battle_royale');
  const [activeSectionTitle, setActiveSectionTitle] = useState<string>('Battle Royale');
  const [activeSectionCategory, setActiveSectionCategory] = useState<string>('Battle Royale');
  const [ruleText, setRuleText] = useState('');
  const [ruleList, setRuleList] = useState<string[]>([]);
  const [ruleEditMode, setRuleEditMode] = useState<'interactive' | 'raw'>('interactive');
  const [newSingleRuleText, setNewSingleRuleText] = useState('');
  const [isAddSectionModalOpen, setIsAddSectionModalOpen] = useState(false);
  const [newSectionForm, setNewSectionForm] = useState({ title: '', category: '', template: 'battle_royale' });

  // Room ID & Password Declaration State
  const [isDeclareRoomModalOpen, setIsDeclareRoomModalOpen] = useState(false);
  const [selectedDeclareRoomMatch, setSelectedDeclareRoomMatch] = useState<Tournament | null>(null);
  const [declareRoomForm, setDeclareRoomForm] = useState({
    roomId: '',
    roomPassword: '',
    setStatusLive: true,
    customNotes: '',
    sendNotificationOnRoomDeclare: true
  });
  const [matchStatusFilter, setMatchStatusFilter] = useState<'all' | 'need_room' | 'room_ready' | 'live' | 'completed'>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [appSettings, setAppSettings] = useState<any>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [isBannerModalOpen, setIsBannerModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [bannerType, setBannerType] = useState<Banner['type']>('main');
  const [bannerOrder, setBannerOrder] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [paymentGateways, setPaymentGateways] = useState<PaymentGateway[]>([]);
  const [isGatewayModalOpen, setIsGatewayModalOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState<PaymentGateway | null>(null);
  const [gatewayForm, setGatewayForm] = useState({
    name: '',
    apiKey: '',
    secretKey: '',
    merchantId: '',
    webhookSecret: '',
    upiId: ''
  });

  // Modal back handlers
  useModalBackHandler(isDeleteConfirmOpen.isOpen, () => setIsDeleteConfirmOpen({ isOpen: false, matchId: '' }));
  useModalBackHandler(isResultModalOpen, () => setIsResultModalOpen(false));
  useModalBackHandler(isBannerModalOpen, () => setIsBannerModalOpen(false));
  useModalBackHandler(isDeclareRoomModalOpen, () => setIsDeclareRoomModalOpen(false));
  useModalBackHandler(isAddSectionModalOpen, () => setIsAddSectionModalOpen(false));
  const [deletingBannerId, setDeletingBannerId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      console.log("No file selected");
      return;
    }

    console.log("File picked for banner upload:", file.name);
    setIsUploading(true);
    setUploadProgress(10);
    
    try {
      const downloadURL = await uploadOriginalImage(file, (progress) => {
        setUploadProgress(progress);
      });
      console.log("Uploaded successfully at 100% original quality:", downloadURL);
      setImageUrl(downloadURL);
      setUploadProgress(100);
    } catch (error: any) {
      console.error('Upload Process Error:', error);
      alert('Upload failed, try again');
    } finally {
      setIsUploading(false);
    }
  };

  // Real-time listeners
  useEffect(() => {
    // Auth check
    const email = auth.currentUser?.email;
    const uid = auth.currentUser?.uid;
    const isAdminUser = email === 'ksbooyah9@gmail.com' ||
                       email === 'mahendrathakur9009@gmail.com' || 
                       email === 'qupagaming@gmail.com' || 
                       email === 'mahendrar9009@gmail.com' ||
                       uid === 'XoXyXcnrlzOaMIKKolXnU3mT9xn1';

    if (!isAdminUser) {
      onPageChange(Page.HOME);
      return;
    }

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as User)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'users'));

    const unsubMatches = onSnapshot(collection(db, 'matches'), (snapshot) => {
      setMatches(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tournament)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'matches'));

    const unsubTrans = onSnapshot(query(collection(db, 'transactions'), orderBy('createdAt', 'desc')), (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

    const unsubRules = onSnapshot(collection(db, 'gameRules'), (snapshot) => {
      const docsMap: Record<string, any> = {};
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        docsMap[docSnap.id] = {
          id: docSnap.id,
          title: data.title || data.section || data.type || docSnap.id.replace(/_/g, ' '),
          category: data.category || data.title || 'General',
          section: data.section || data.title || docSnap.id,
          rules: data.rules || [],
          updatedAt: data.updatedAt
        };
      });
      setGameRulesDocs(docsMap);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'gameRules'));

    const unsubModes = onSnapshot(collection(db, 'gameModes'), (snapshot) => {
      setGameModesList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'gameModes'));

    const unsubSettings = onSnapshot(doc(db, 'appSettings', 'referral_support'), (snapshot) => {
      if (snapshot.exists()) {
        setAppSettings(snapshot.data());
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'appSettings/referral_support'));

    const unsubBanners = onSnapshot(query(collection(db, 'banners'), orderBy('order', 'asc')), (snapshot) => {
      setBanners(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Banner)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'banners'));

    const unsubGateways = onSnapshot(collection(db, 'paymentSettings'), (snapshot) => {
      setPaymentGateways(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentGateway)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'paymentSettings'));

    setLoading(false);
    return () => {
      unsubUsers();
      unsubMatches();
      unsubTrans();
      unsubRules();
      unsubModes();
      unsubSettings();
      unsubBanners();
      unsubGateways();
    };
  }, [onPageChange]);

  // Dashboard Stats
  const totalUsers = users.length;
  const totalMatches = matches.length;
  const totalJoinedPlayers = matches.reduce((acc, m) => acc + (m.playersCount || 0), 0);
  const totalDeposits = transactions
    .filter(t => t.type === 'deposit')
    .reduce((acc, t) => acc + (t.amount || 0), 0);
  const totalWithdrawals = transactions
    .filter(t => t.type === 'withdrawal')
    .reduce((acc, t) => acc + (t.amount || 0), 0);

  // User Actions
  const handleBanUser = async (userId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'users', userId), { isBanned: !currentStatus });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleUpdateBalance = async (userId: string, amount: number, type: 'deposit' | 'withdrawal') => {
    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userSnap = await transaction.get(userRef);
        if (!userSnap.exists()) throw new Error('User not found');
        
        const userData = userSnap.data() as User;
        const currentDeposit = userData.wallet?.deposit || 0;
        
        if (type === 'withdrawal' && currentDeposit < amount) {
          throw new Error('Insufficient deposit balance');
        }

        const newDeposit = type === 'deposit' ? currentDeposit + amount : currentDeposit - amount;
        
        transaction.update(userRef, { "wallet.deposit": newDeposit });
        
        const transRef = doc(collection(db, 'transactions'));
        transaction.set(transRef, {
          userId,
          type,
          amount,
          status: 'completed',
          title: `Admin ${type}`,
          createdAt: serverTimestamp()
        });
      });
      alert(`Balance ${type}ed successfully`);
    } catch (e: any) {
      alert(e.message || 'Update failed');
      handleFirestoreError(e, OperationType.UPDATE, `users/${userId}`);
    }
  };

  const handleResetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`Password reset email sent to ${email}`);
    } catch (e) {
      alert('Failed to send reset email');
      console.error(e);
    }
  };


  const processDeleteMatch = async () => {
    const { matchId } = isDeleteConfirmOpen;

    if (!matchId || typeof matchId !== "string") {
      console.error("Invalid matchId provided for deletion:", matchId);
      return;
    }

    setIsProcessing(true);
    try {
      console.log("Deleting matchId:", matchId);

      await runTransaction(db, async (tx) => {
        const matchRef = doc(db, "matches", matchId);
        const matchSnap = await tx.get(matchRef);
        
        if (!matchSnap.exists()) {
           console.warn("Match document does not exist:", matchId);
           return; 
        }

        const matchData = matchSnap.data() as Tournament;
        const players = matchData.players || [];
        const entryFee = Number(matchData.entryFee || 0);

        console.log("Match Data fetched for delete:", {
          matchId,
          players,
          entryFee,
          status: matchData.status
        });

        // 1. Process Refunds - Only if NOT completed
        if (matchData.status !== 'completed' && players.length > 0 && entryFee > 0) {
          console.log(`Processing refunds for ${players.length} players...`, players);
          for (const player of players) {
            if (!player.userId || typeof player.userId !== 'string') continue;
            
            const userRef = doc(db, "users", player.userId);
            
            // Refund entry fee using increment to wallet.deposit
            tx.update(userRef, { 
              "wallet.deposit": increment(entryFee)
            });

            // Record refund transaction
            const transCol = collection(db, "transactions");
            const newTransRef = doc(transCol);
            tx.set(newTransRef, {
              userId: player.userId,
              type: 'refund',
              amount: entryFee,
              matchId,
              status: 'completed',
              title: `REFUND: ${matchData.displayId || '#000'}`,
              createdAt: serverTimestamp()
            });
          }
        } else {
          console.log("Skipping refunds (Match completed or no players/fee)");
        }

        // 2. Delete Match
        tx.delete(matchRef);
      });

      setIsDeleteConfirmOpen({ isOpen: false, matchId: '' });
      alert('Match deleted successfully and players refunded (if applicable)');
    } catch (e) {
      console.error("Error during match deletion:", e);
      handleFirestoreError(e, OperationType.DELETE, `matches/${matchId}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeclareResult = (match: Tournament) => {
    setSelectedMatchResults(match);
    setPlayerResults({});
    setPlayerPositionResults({});
    setIsResultModalOpen(true);
  };

  const handleEditMatch = (m: Tournament) => {
    console.log("Navigating to edit match:", m.id);
    if (!m.id) {
      console.error("Match ID is missing!");
      return;
    }
    onPageChange(Page.ADMIN_EDIT_MATCH, m.id);
  };

  const handleDuplicateMatch = async (m: Tournament) => {
    console.log("Navigating to duplicate match:", m.id);
    if (!m.id) {
       console.error("Duplicate failed: Match object or ID missing");
       alert("Cannot duplicate: Match data missing");
       return;
    }
    onPageChange(Page.ADMIN_CREATE_MATCH, m.id);
  };

  const handleSubmitResult = async () => {
    if (!selectedMatchResults || !selectedMatchResults.id) {
       console.error("No valid match selected for results declaration");
       return;
    }
    
    console.log("Submitting results for matchId:", selectedMatchResults.id);
    setIsProcessing(true);

    try {
      await runTransaction(db, async (tx) => {
        const matchId = selectedMatchResults.id!;
        const players = selectedMatchResults.players || [];
        
        // 1. Collect all User References and Snapshots (READS)
        const userDocs: { ref: any, snap: any, userId: string, player: any }[] = [];
        for (const player of players) {
          const userId = player.userId;
          if (!userId || typeof userId !== 'string') continue;
          const userRef = doc(db, 'users', userId);
          const snap = await tx.get(userRef);
          userDocs.push({ ref: userRef, snap, userId, player });
        }
        
        // 2. Process and Apply Updates (WRITES)
        for (const { ref: userRef, snap: uSnap, userId, player } of userDocs) {
          if (uSnap.exists()) {
            let winningAmount = 0;

            if (selectedMatchResults.section === 'Battle Royale') {
              if (selectedMatchResults.prizeType === 'perKill') {
                const playerKey = `${player.userId}_${player.slot}`;
                const kills = playerResults[playerKey] || 0;
                const killsWinning = kills * (selectedMatchResults.perKillAmount || 0);
                const rank = playerPositionResults[playerKey] || 0;
                const positionWinning = selectedMatchResults.positionPrizeDistribution?.[rank] || 0;
                winningAmount = killsWinning + positionWinning;
              } else if (selectedMatchResults.prizeType === 'survival') {
                const rank = playerResults[`${player.userId}_${player.slot}`] || 0;
                winningAmount = selectedMatchResults.prizeDistribution?.[rank] || 0;
              }
            } else {
              // For Clash Squad / Lone Wolf, if rank is 1, give them the prize pool
              const rank = playerResults[`${player.userId}_${player.slot}`] || 0;
              if (rank === 1) {
                winningAmount = selectedMatchResults.prizePool || 0;
              }
            }

            // Prepare updates object
            const updates: any = {
              'stats.matchesPlayed': increment(1)
            };

            if (winningAmount > 0) {
              updates["wallet.winnings"] = increment(winningAmount);
              updates['stats.totalWinnings'] = increment(winningAmount);

              // Create Transaction record
              const transCol = collection(db, 'transactions');
              const transRef = doc(transCol);
              tx.set(transRef, {
                userId,
                type: 'win',
                amount: winningAmount,
                matchId: matchId,
                status: 'completed',
                title: `WON IN MATCH: ${selectedMatchResults.displayId || '#000'}`,
                createdAt: serverTimestamp()
              });
            }
            
            // Add kills if applicable
            if (selectedMatchResults.prizeType === 'perKill') {
               updates['stats.totalKills'] = increment(playerResults[`${player.userId}_${player.slot}`] || 0);
            }

            tx.update(userRef, updates);
          }
        }

        // Mark match as completed and save results summary
        const matchRef = doc(db, 'matches', matchId);
        
        const resultsArray = players.map(player => {
          const playerKey = `${player.userId}_${player.slot}`;
          const score = playerResults[playerKey] || 0;
          let winningAmount = 0;

          if (selectedMatchResults.section === 'Battle Royale') {
            if (selectedMatchResults.prizeType === 'perKill') {
              const kills = score;
              const killsWinning = kills * (selectedMatchResults.perKillAmount || 0);
              const rank = playerPositionResults[playerKey] || 0;
              const positionWinning = selectedMatchResults.positionPrizeDistribution?.[rank] || 0;
              winningAmount = killsWinning + positionWinning;
            } else if (selectedMatchResults.prizeType === 'survival') {
              winningAmount = selectedMatchResults.prizeDistribution?.[score] || 0;
            }
          } else {
            if (score === 1) {
              winningAmount = selectedMatchResults.prizePool || 0;
            }
          }

          return {
            userId: player.userId,
            slot: player.slot,
            username: player.username,
            ign: player.ign,
            rankOrKills: score,
            positionRank: playerPositionResults[playerKey] || null,
            winningAmount,
            killsWinning: selectedMatchResults.prizeType === 'perKill' ? score * (selectedMatchResults.perKillAmount || 0) : 0,
            positionWinning: selectedMatchResults.prizeType === 'perKill' ? (selectedMatchResults.positionPrizeDistribution?.[playerPositionResults[playerKey] || 0] || 0) : 0
          };
        });

        const resultsRef = doc(db, 'matchResults', matchId);
        tx.set(resultsRef, {
          matchId,
          matchTitle: selectedMatchResults.title,
          section: selectedMatchResults.section,
          prizeType: selectedMatchResults.prizeType || null,
          results: resultsArray,
          createdAt: serverTimestamp()
        });

        tx.update(matchRef, { status: 'completed' });
      });

      setIsResultModalOpen(false);
      alert('Results declared successfully!');
    } catch (e) {
      console.error("Error during result submission:", e);
      handleFirestoreError(e, OperationType.UPDATE, `matches/${selectedMatchResults.id}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Extract all unique sections combining presets, gameModes, and Firestore gameRules docs
  const allAvailableRuleSections = React.useMemo(() => {
    const map: Record<string, { id: string; title: string; category: string; rulesCount: number; isPreset: boolean }> = {};

    // 1. Add standard presets
    Object.keys(RULE_PRESETS).forEach(key => {
      const p = RULE_PRESETS[key];
      const firestoreDoc = gameRulesDocs[key];
      map[key] = {
        id: key,
        title: firestoreDoc?.title || p.title,
        category: firestoreDoc?.category || p.category,
        rulesCount: firestoreDoc?.rules ? firestoreDoc.rules.length : p.rules.length,
        isPreset: true
      };
    });

    // 2. Add gameModes from Firestore
    gameModesList.forEach(m => {
      const rawKey = (m.id || m.title || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
      if (rawKey && !map[rawKey]) {
        const firestoreDoc = gameRulesDocs[rawKey];
        map[rawKey] = {
          id: rawKey,
          title: firestoreDoc?.title || m.title || m.subtitle || rawKey.replace(/_/g, ' '),
          category: firestoreDoc?.category || m.category || 'Custom Mode',
          rulesCount: firestoreDoc?.rules?.length || 0,
          isPreset: false
        };
      }
    });

    // 3. Add any existing documents from gameRulesDocs
    Object.keys(gameRulesDocs).forEach(key => {
      const docData = gameRulesDocs[key];
      if (!map[key]) {
        map[key] = {
          id: key,
          title: docData.title || key.replace(/_/g, ' '),
          category: docData.category || 'Custom Section',
          rulesCount: docData.rules?.length || 0,
          isPreset: false
        };
      } else {
        map[key].title = docData.title || map[key].title;
        map[key].category = docData.category || map[key].category;
        map[key].rulesCount = docData.rules?.length || 0;
      }
    });

    return Object.values(map);
  }, [gameRulesDocs, gameModesList]);

  // Sync active section content whenever section changes or Firestore rules update
  useEffect(() => {
    const currentDoc = gameRulesDocs[activeRuleTab];
    if (currentDoc && currentDoc.rules && currentDoc.rules.length > 0) {
      setRuleList(currentDoc.rules);
      setRuleText(currentDoc.rules.join('\n'));
      setActiveSectionTitle(currentDoc.title || activeRuleTab.replace(/_/g, ' '));
      setActiveSectionCategory(currentDoc.category || 'General');
    } else if (RULE_PRESETS[activeRuleTab]) {
      const p = RULE_PRESETS[activeRuleTab];
      setRuleList(p.rules);
      setRuleText(p.rules.join('\n'));
      setActiveSectionTitle(p.title);
      setActiveSectionCategory(p.category);
    } else {
      const defaultSample = [
        'Fair Play: No hacking, scripts or third-party tools allowed.',
        'Device Requirements: Mobile & tablet devices only. Strictly no emulators.',
        'Verification: High-definition victory/final scorecard screenshot mandatory in case of dispute.',
        'Match Entry: Room closes 2 minutes before match start time.',
        'Admin Decision: Admin decision is final and binding for all participants.'
      ];
      setRuleList(defaultSample);
      setRuleText(defaultSample.join('\n'));
      setActiveSectionTitle(activeRuleTab.replace(/_/g, ' '));
      setActiveSectionCategory('General');
    }
  }, [activeRuleTab, gameRulesDocs]);

  // Save current active section rules
  const handleSaveCurrentSectionRules = async () => {
    setIsProcessing(true);
    try {
      const finalRules = ruleEditMode === 'raw' 
        ? ruleText.split('\n').map(r => r.trim()).filter(r => r.length > 0)
        : ruleList.map(r => r.trim()).filter(r => r.length > 0);

      if (finalRules.length === 0) {
        alert('Please provide at least one rule item.');
        setIsProcessing(false);
        return;
      }

      await setDoc(doc(db, 'gameRules', activeRuleTab), {
        id: activeRuleTab,
        title: activeSectionTitle.trim() || activeRuleTab.replace(/_/g, ' '),
        section: activeSectionTitle.trim() || activeRuleTab.replace(/_/g, ' '),
        category: activeSectionCategory.trim() || 'General',
        rules: finalRules,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setRuleList(finalRules);
      setRuleText(finalRules.join('\n'));
      alert(`Rules for "${activeSectionTitle}" saved successfully!`);
    } catch (e) {
      console.error("Error saving rules:", e);
      handleFirestoreError(e, OperationType.UPDATE, `gameRules/${activeRuleTab}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Add a single rule to interactive list
  const handleAddSingleRule = () => {
    if (!newSingleRuleText.trim()) return;
    const updated = [...ruleList, newSingleRuleText.trim()];
    setRuleList(updated);
    setRuleText(updated.join('\n'));
    setNewSingleRuleText('');
  };

  // Delete a single rule from interactive list
  const handleDeleteSingleRule = (index: number) => {
    const updated = ruleList.filter((_, i) => i !== index);
    setRuleList(updated);
    setRuleText(updated.join('\n'));
  };

  // Move rule up or down
  const handleMoveRule = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === ruleList.length - 1) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    const updated = [...ruleList];
    const item = updated[index];
    updated[index] = updated[targetIdx];
    updated[targetIdx] = item;
    setRuleList(updated);
    setRuleText(updated.join('\n'));
  };

  // Load a preset template into active section
  const handleApplyPresetTemplate = (presetKey: string) => {
    if (RULE_PRESETS[presetKey]) {
      const preset = RULE_PRESETS[presetKey];
      if (confirm(`Load "${preset.title}" rules into the current section editor?`)) {
        setRuleList([...preset.rules]);
        setRuleText(preset.rules.join('\n'));
      }
    }
  };

  // Create new section rules document
  const handleAddNewSectionSubmit = async () => {
    if (!newSectionForm.title.trim()) {
      alert('Please enter a section title / name');
      return;
    }
    const cleanId = newSectionForm.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
    if (!cleanId) {
      alert('Invalid section title');
      return;
    }

    setIsProcessing(true);
    try {
      const starterTemplate = RULE_PRESETS[newSectionForm.template] || RULE_PRESETS.battle_royale;
      const initialRules = [...starterTemplate.rules];

      await setDoc(doc(db, 'gameRules', cleanId), {
        id: cleanId,
        title: newSectionForm.title.trim(),
        section: newSectionForm.title.trim(),
        category: newSectionForm.category.trim() || newSectionForm.title.trim(),
        rules: initialRules,
        updatedAt: serverTimestamp()
      }, { merge: true });

      setActiveRuleTab(cleanId);
      setActiveSectionTitle(newSectionForm.title.trim());
      setActiveSectionCategory(newSectionForm.category.trim() || newSectionForm.title.trim());
      setRuleList(initialRules);
      setRuleText(initialRules.join('\n'));
      setIsAddSectionModalOpen(false);
      setNewSectionForm({ title: '', category: '', template: 'battle_royale' });
      alert(`Section rules for "${newSectionForm.title}" created successfully!`);
    } catch (err) {
      console.error('Failed to create new rule section:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Delete custom section rules
  const handleDeleteCustomSectionRules = async (secId: string, secTitle: string) => {
    if (['battle_royale', 'clash_squad', 'lone_wolf'].includes(secId)) {
      alert('Default game mode sections cannot be deleted. You can edit their rules instead.');
      return;
    }
    if (!confirm(`Are you sure you want to delete rules for section "${secTitle}"?`)) return;

    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'gameRules', secId));
      setActiveRuleTab('battle_royale');
      alert(`Rules for section "${secTitle}" removed.`);
    } catch (err) {
      console.error('Failed to delete section rules:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Room ID & Password Modal Handlers
  const handleOpenDeclareRoomModal = (m: Tournament) => {
    setSelectedDeclareRoomMatch(m);
    setDeclareRoomForm({
      roomId: m.roomId || '',
      roomPassword: m.roomPassword || '',
      setStatusLive: m.status !== 'completed',
      customNotes: (m as any).roomNotes || '',
      sendNotificationOnRoomDeclare: true
    });
    setIsDeclareRoomModalOpen(true);
  };

  const handleSaveDeclareRoom = async () => {
    if (!selectedDeclareRoomMatch) return;
    setIsProcessing(true);
    try {
      const cleanRoomId = declareRoomForm.roomId.trim();
      const cleanPass = declareRoomForm.roomPassword.trim();

      const updates: any = {
        roomId: cleanRoomId,
        roomPassword: cleanPass,
        roomNotes: declareRoomForm.customNotes.trim(),
        roomDeclaredAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      if (declareRoomForm.setStatusLive && selectedDeclareRoomMatch.status !== 'completed') {
        updates.status = 'ongoing';
      }

      await updateDoc(doc(db, 'matches', selectedDeclareRoomMatch.id), updates);

      // Auto push notification to match players if checked
      if (declareRoomForm.sendNotificationOnRoomDeclare && cleanRoomId) {
        try {
          await addDoc(collection(db, 'notifications'), {
            title: `🔑 Room ID & Pass Ready: ${selectedDeclareRoomMatch.title}`,
            message: `Room ID: ${cleanRoomId} | Password: ${cleanPass || 'No Password'}. Join immediately in Free Fire!`,
            type: 'room_creds',
            audience: 'match',
            targetMatchId: selectedDeclareRoomMatch.id,
            targetMatchTitle: selectedDeclareRoomMatch.title,
            actionPage: Page.TOURNAMENTS,
            actionText: 'View Credentials',
            createdAt: serverTimestamp(),
            readBy: []
          });
        } catch (notifErr) {
          console.warn('Could not auto push notification:', notifErr);
        }
      }

      setIsDeclareRoomModalOpen(false);
      setSelectedDeclareRoomMatch(null);
      alert('Room ID & Password declared successfully! Players can now view credentials in their match dashboard.');
    } catch (err: any) {
      console.error('Failed to declare room:', err);
      handleFirestoreError(err, OperationType.UPDATE, `matches/${selectedDeclareRoomMatch.id}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClearRoomCredentials = async (matchId: string) => {
    if (!confirm('Are you sure you want to clear the Room ID & Password for this match?')) return;
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'matches', matchId), {
        roomId: '',
        roomPassword: '',
        roomNotes: '',
        updatedAt: serverTimestamp()
      });
      if (isDeclareRoomModalOpen) {
        setIsDeclareRoomModalOpen(false);
        setSelectedDeclareRoomMatch(null);
      }
      alert('Room credentials cleared successfully.');
    } catch (err) {
      console.error('Failed to clear room:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopyCredential = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSaveSettings = async (data: any) => {
    setIsProcessing(true);
    try {
      await setDoc(doc(db, 'appSettings', 'referral_support'), data, { merge: true });
      alert('Settings updated successfully!');
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, 'appSettings/referral_support');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveBanner = async () => {
    if (!imageUrl) return alert('Image URL is required');
    setIsProcessing(true);
    try {
      const bannerData = {
        imageUrl,
        redirectUrl: (bannerType === 'main' || bannerType === 'offer') ? redirectUrl : '',
        type: bannerType,
        order: Number(bannerOrder),
        isActive: true,
        updatedAt: serverTimestamp()
      };

      if (editingBanner?.id) {
        await updateDoc(doc(db, 'banners', editingBanner.id), bannerData);
      } else {
        await addDoc(collection(db, 'banners'), {
          ...bannerData,
          createdAt: serverTimestamp()
        });
      }
      setIsBannerModalOpen(false);
      setEditingBanner(null);
      setImageUrl('');
      setRedirectUrl('');
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'banners');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm('Are you sure you want to permanently delete this banner? This action cannot be undone.')) return;
    
    setDeletingBannerId(id);
    console.log("Deleting banner:", id);
    
    try {
      await deleteDoc(doc(db, 'banners', id));
    } catch (e) {
      console.error("Error deleting banner:", e);
      alert('Upload failed, try again');
      handleFirestoreError(e, OperationType.DELETE, `banners/${id}`);
    } finally {
      setDeletingBannerId(null);
    }
  };

  const handleToggleGateway = async (gatewayId: string, currentStatus: boolean) => {
    setIsProcessing(true);
    try {
      if (!currentStatus) {
        // Enforce only one active gateway: deactivate all others first
        const batch = writeBatch(db);
        paymentGateways.forEach(g => {
          if (g.isActive) {
            batch.update(doc(db, 'paymentSettings', g.id), { isActive: false });
          }
        });
        batch.update(doc(db, 'paymentSettings', gatewayId), { 
          isActive: true,
          updatedAt: serverTimestamp() 
        });
        await batch.commit();
      } else {
        await updateDoc(doc(db, 'paymentSettings', gatewayId), { 
          isActive: false,
          updatedAt: serverTimestamp()
        });
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `paymentSettings/${gatewayId}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveGateway = async () => {
    if (!gatewayForm.name) return alert('Name is required');
    setIsProcessing(true);
    try {
      const gId = editingGateway?.id || gatewayForm.name.toLowerCase().replace(/\s+/g, '_');
      const gatewayData = {
        ...gatewayForm,
        updatedAt: serverTimestamp()
      };

      await setDoc(doc(db, 'paymentSettings', gId), gatewayData, { merge: true });
      
      setIsGatewayModalOpen(false);
      setEditingGateway(null);
      setGatewayForm({
        name: '',
        apiKey: '',
        secretKey: '',
        merchantId: '',
        webhookSecret: '',
        upiId: ''
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'paymentSettings');
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="text-purple-500 animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="pb-24 max-w-lg mx-auto bg-background min-h-screen">
      <div className="px-5 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => onPageChange(Page.PROFILE)}
              className="p-2.5 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-500 hover:text-white transition-colors"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h2 className="text-xl font-bold tracking-tighter uppercase italic text-white leading-none">
                Admin <span className="text-purple-500">Panel</span>
              </h2>
              <p className="text-[8px] font-black uppercase tracking-widest text-neutral-600 mt-1">Production Version 2.0</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Live</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
          {Object.values(AdminTab).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border ${
                activeTab === tab 
                  ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30' 
                  : 'bg-neutral-900 border-neutral-800 text-neutral-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === AdminTab.DASHBOARD && (
            <motion.div
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <StatCard label="Total Users" value={totalUsers} icon={Users} color="text-blue-400" />
                <StatCard label="Total Matches" value={totalMatches} icon={Trophy} color="text-purple-400" />
                <StatCard label="Joined Players" value={totalJoinedPlayers} icon={UsersIcon} color="text-orange-400" />
                <StatCard label="Revenue" value={`₹${totalDeposits - totalWithdrawals}`} icon={DollarSign} color="text-emerald-400" />
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => onPageChange(Page.ADMIN_MODES)}
                  className="flex-1 p-6 bg-purple-600/10 border border-purple-500/20 rounded-3xl flex flex-col items-center gap-3 active:scale-95 transition-all shadow-xl"
                >
                  <Gamepad2 className="text-purple-500" size={32} />
                  <span className="text-[10px] font-black uppercase tracking-widest text-purple-500">Manage Game Modes</span>
                </button>
              </div>

              <div className="p-6 bg-neutral-900/60 border border-neutral-800 rounded-3xl mt-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-6 flex items-center gap-2">
                  <Shield size={12} className="text-purple-500" /> System Health
                </h4>
                <div className="space-y-4">
                  <HealthBar label="Database" status="Operational" />
                  <HealthBar label="Auth Service" status="Operational" />
                  <HealthBar label="Storage" status="Optimal" />
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === AdminTab.NOTIFICATIONS && (
            <motion.div
              key="notifications"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <AdminNotificationsTab 
                matches={matches} 
                users={users} 
                onPageChange={onPageChange} 
              />
            </motion.div>
          )}

          {activeTab === AdminTab.USERS && (
            <motion.div
              key="users"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                <input 
                  type="text"
                  placeholder="Search by username..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold outline-none focus:border-purple-500 transition-all"
                />
              </div>

              <div className="space-y-3">
                {users
                  .filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((u) => (
                  <div 
                    key={u.id}
                    onClick={() => onPageChange(Page.ADMIN_USER_PROFILE, u.id)}
                    className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-between group cursor-pointer hover:border-primary transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center text-neutral-700 border border-white/5">
                        <Users size={20} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black italic">{u.username}</h4>
                        <p className="text-[8px] font-black uppercase tracking-widest text-neutral-600">{u.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-emerald-400 italic">
                        ₹{(u.wallet?.deposit || 0) + (u.wallet?.winnings || 0) + (u.wallet?.bonus || 0)}
                      </span>
                      {u.isBanned && <Ban size={14} className="text-red-500" />}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === AdminTab.MATCHES && (
            <motion.div
              key="matches"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="space-y-4">
                <button 
                  onClick={() => onPageChange(Page.ADMIN_CREATE_MATCH)}
                  className="w-full py-5 bg-purple-600 hover:bg-purple-500 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-purple-600/30 active:scale-[0.98] transition-all text-white"
                >
                  <Plus size={18} />
                  <span className="text-xs font-black uppercase tracking-widest">Create New Match</span>
                </button>

                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={16} />
                  <input 
                    type="text"
                    placeholder="Search by Match ID, Title or Section..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl py-4 pl-12 pr-4 text-xs font-bold outline-none focus:border-purple-500 transition-all"
                  />
                </div>

                {/* Match Status Filters */}
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {[
                    { id: 'all', label: `All (${matches.length})` },
                    { 
                      id: 'need_room', 
                      label: `⚠️ Need Room ID (${matches.filter(m => (!m.roomId || !m.roomPassword) && m.status !== 'completed').length})` 
                    },
                    { 
                      id: 'room_ready', 
                      label: `🔑 Room Ready (${matches.filter(m => m.roomId && m.roomPassword && m.status !== 'completed').length})` 
                    },
                    { 
                      id: 'live', 
                      label: `⚡ Live (${matches.filter(m => m.status === 'ongoing').length})` 
                    },
                    { 
                      id: 'completed', 
                      label: `🏆 Completed (${matches.filter(m => m.status === 'completed').length})` 
                    }
                  ].map((filterItem) => (
                    <button
                      key={filterItem.id}
                      onClick={() => setMatchStatusFilter(filterItem.id as any)}
                      className={`px-3.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider whitespace-nowrap transition-all border ${
                        matchStatusFilter === filterItem.id
                          ? 'bg-purple-600/20 border-purple-500 text-purple-300 shadow-sm'
                          : 'bg-neutral-900/80 border-neutral-800 text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      {filterItem.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {matches
                  .filter(m => {
                    const matchText = (m.displayId || '') + ' ' + (m.title || '') + ' ' + (m.section || '') + ' ' + (m.map || '');
                    const matchesSearch = matchText.toLowerCase().includes(searchTerm.toLowerCase());
                    if (!matchesSearch) return false;

                    if (matchStatusFilter === 'need_room') {
                      return (!m.roomId || !m.roomPassword) && m.status !== 'completed';
                    }
                    if (matchStatusFilter === 'room_ready') {
                      return m.roomId && m.roomPassword && m.status !== 'completed';
                    }
                    if (matchStatusFilter === 'live') {
                      return m.status === 'ongoing';
                    }
                    if (matchStatusFilter === 'completed') {
                      return m.status === 'completed';
                    }
                    return true;
                  })
                  .map((m) => {
                    const hasRoomCreds = Boolean(m.roomId && m.roomPassword);
                    return (
                      <div key={m.id} className="p-5 bg-neutral-900 border border-neutral-800 rounded-3xl relative overflow-hidden group shadow-lg">
                        <div className="absolute top-0 right-0 p-4 flex gap-2">
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDuplicateMatch(m);
                            }}
                            className="p-2 bg-purple-500/10 text-purple-500 rounded-lg hover:bg-purple-500 transition-colors hover:text-white"
                            title="Duplicate Match"
                          >
                            <Copy size={14} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEditMatch(m);
                            }}
                            className="p-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500 transition-colors hover:text-white"
                            title="Edit Match"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsDeleteConfirmOpen({ isOpen: true, matchId: m.id });
                            }}
                            className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 transition-colors hover:text-white"
                            title="Delete Match"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between mb-2">
                           <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-lg border border-purple-500/20">
                               {m.displayId || '#000'}
                             </span>
                             <span className="text-[9px] font-black uppercase tracking-wider text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded-md">
                               {m.section || m.mode || 'Battle Royale'}
                             </span>
                           </div>
                           {m.status === 'completed' ? (
                            <span className="bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                              Completed
                            </span>
                          ) : m.status === 'ongoing' ? (
                            <span className="bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full animate-pulse">
                              Live / Ongoing
                            </span>
                          ) : (
                            <span className="bg-blue-500/20 border border-blue-500/30 text-blue-400 text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full">
                              Upcoming
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-black italic pr-16 mb-3 text-white">{m.title}</h4>

                        <div className="flex gap-4 mb-4">
                          <div className="flex items-center gap-1.5 text-neutral-400">
                            <Clock size={12} className="text-neutral-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest">{formatMatchTime(m.time)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-neutral-400">
                            <MapIcon size={12} className="text-neutral-500" />
                            <span className="text-[9px] font-black uppercase tracking-widest">{m.map}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between py-3 border-y border-neutral-800/80">
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-widest text-neutral-500 mb-0.5">Players Joined</p>
                            <p className="text-xs font-black italic text-white">{m.playersCount}/{m.totalSlots || m.maxPlayers}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-widest text-neutral-500 mb-0.5">Entry Fee</p>
                            <p className="text-xs font-black text-emerald-400 italic leading-none">{m.entryFee === 0 ? 'FREE' : `₹${m.entryFee}`}</p>
                          </div>
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-widest text-neutral-500 mb-0.5">Prize Pool</p>
                            <p className="text-xs font-black text-amber-400 italic leading-none">{m.prizeType === 'perKill' ? `₹${m.perKillAmount}/kill` : `₹${m.prizePool}`}</p>
                          </div>
                        </div>

                        {/* Room Credentials Banner */}
                        <div className="mt-4 p-3.5 rounded-2xl border bg-black/60 flex flex-col gap-2.5">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Key size={14} className={hasRoomCreds ? "text-emerald-400" : "text-amber-400"} />
                              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-300">Room Credentials</span>
                            </div>
                            {hasRoomCreds ? (
                              <span className="text-[8px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                Declared & Live
                              </span>
                            ) : (
                              <span className="text-[8px] font-black uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                Pending
                              </span>
                            )}
                          </div>

                          {hasRoomCreds ? (
                            <div className="grid grid-cols-2 gap-2 bg-neutral-900/90 p-2.5 rounded-xl border border-neutral-800">
                              <div className="flex items-center justify-between pr-1">
                                <div>
                                  <p className="text-[7px] font-black text-neutral-500 uppercase">Room ID</p>
                                  <p className="text-xs font-black text-white font-mono">{m.roomId}</p>
                                </div>
                                <button 
                                  onClick={() => handleCopyCredential(m.roomId!, `room_${m.id}`)}
                                  className="p-1 text-neutral-400 hover:text-white"
                                  title="Copy Room ID"
                                >
                                  {copiedKey === `room_${m.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                </button>
                              </div>
                              <div className="flex items-center justify-between pr-1 border-l border-neutral-800 pl-2">
                                <div>
                                  <p className="text-[7px] font-black text-neutral-500 uppercase">Password</p>
                                  <p className="text-xs font-black text-white font-mono">{m.roomPassword}</p>
                                </div>
                                <button 
                                  onClick={() => handleCopyCredential(m.roomPassword!, `pass_${m.id}`)}
                                  className="p-1 text-neutral-400 hover:text-white"
                                  title="Copy Password"
                                >
                                  {copiedKey === `pass_${m.id}` ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-[9px] font-bold text-neutral-500 italic">
                              Room ID & Password not declared yet. Click below to publish credentials to players.
                            </p>
                          )}

                          {/* Quick Inline Inputs */}
                          <div className="flex items-center gap-2 pt-1">
                            <input 
                              type="text" 
                              placeholder="Room ID"
                              defaultValue={m.roomId || ''}
                              id={`quick_room_${m.id}`}
                              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-purple-500 placeholder:text-neutral-600"
                            />
                            <input 
                              type="text" 
                              placeholder="Pass"
                              defaultValue={m.roomPassword || ''}
                              id={`quick_pass_${m.id}`}
                              className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-3 py-2 text-[10px] font-bold text-white outline-none focus:border-purple-500 placeholder:text-neutral-600"
                            />
                            <button
                              onClick={async () => {
                                const idInput = document.getElementById(`quick_room_${m.id}`) as HTMLInputElement;
                                const passInput = document.getElementById(`quick_pass_${m.id}`) as HTMLInputElement;
                                const rId = idInput ? idInput.value.trim() : '';
                                const rPass = passInput ? passInput.value.trim() : '';
                                const updates: any = { 
                                  roomId: rId, 
                                  roomPassword: rPass, 
                                  updatedAt: serverTimestamp() 
                                };
                                if (rId && m.status === 'upcoming') {
                                  updates.status = 'ongoing';
                                }
                                await updateDoc(doc(db, 'matches', m.id), updates);
                                alert('Room credentials updated!');
                              }}
                              className="p-2.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded-xl border border-neutral-700 active:scale-95 transition-all"
                              title="Save Credentials Quick"
                            >
                              <Save size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Action Buttons: Declare Room Modal & Declare Result */}
                        <div className="grid grid-cols-2 gap-2 mt-4">
                          <button 
                            onClick={() => handleOpenDeclareRoomModal(m)}
                            className="py-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                          >
                            <Key size={13} className="text-purple-400" />
                            {hasRoomCreds ? 'Edit Room Info' : 'Declare Room'}
                          </button>

                          {m.status !== 'completed' ? (
                            <button 
                              onClick={() => handleDeclareResult(m)}
                              className="py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                            >
                              <Trophy size={13} />
                              Declare Result
                            </button>
                          ) : (
                            <div className="py-3 bg-neutral-800/60 border border-neutral-800 rounded-xl text-[10px] font-black uppercase tracking-wider text-neutral-500 text-center flex items-center justify-center gap-1.5">
                              <CheckCheck size={13} className="text-emerald-500" />
                              Result Declared
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </motion.div>
          )}

          {activeTab === AdminTab.TRANSACTIONS && (
            <motion.div
              key="transactions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between mb-4">
                 <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500">History Log</h4>
                 <RefreshCw size={14} className="text-neutral-700 animate-spin-slow" />
              </div>
              {transactions.map((t) => (
                <div key={t.id} className="p-4 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center border border-white/5 ${
                      t.type === 'deposit' || t.type === 'refund' ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
                    }`}>
                      {t.type === 'deposit' ? <Plus size={16} /> : t.type === 'refund' ? <CheckCircle2 size={16} /> : <Minus size={16} />}
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">{t.type}</h4>
                      <p className="text-[8px] font-black uppercase tracking-widest text-neutral-600">ID: {t.id.slice(0, 8)}...</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xs font-black italic ${
                      t.type === 'deposit' || t.type === 'refund' ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {t.type === 'deposit' || t.type === 'refund' ? '+' : '-'}₹{t.amount}
                    </p>
                    <p className="text-[8px] font-black text-neutral-600 uppercase tracking-widest">
                      {t.createdAt?.toDate().toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === AdminTab.RULES && (
            <motion.div
              key="rules"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Header & Add Section Action */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black italic uppercase tracking-tight text-white flex items-center gap-2">
                    <ListChecks size={16} className="text-purple-400" />
                    Game Mode Regulations
                  </h3>
                  <p className="text-[8px] font-black uppercase tracking-widest text-neutral-500 mt-0.5">
                    Customize rules for all game mode sections
                  </p>
                </div>
                <button
                  onClick={() => setIsAddSectionModalOpen(true)}
                  className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-purple-600/20"
                >
                  <PlusCircle size={13} />
                  Add Section
                </button>
              </div>

              {/* Dynamic Horizontal Section Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                {allAvailableRuleSections.map((sec) => {
                  const isActive = activeRuleTab === sec.id;
                  return (
                    <button
                      key={sec.id}
                      onClick={() => setActiveRuleTab(sec.id)}
                      className={`px-4 py-3 rounded-2xl text-[9px] font-black uppercase tracking-wider transition-all whitespace-nowrap border flex items-center gap-2 ${
                        isActive
                          ? 'bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-600/30'
                          : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                      }`}
                    >
                      <span>{sec.title}</span>
                      <span className={`text-[8px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive ? 'bg-black/40 text-purple-200' : 'bg-neutral-800 text-neutral-500'
                      }`}>
                        {sec.rulesCount}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Active Section Rule Configuration Card */}
              <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-3xl space-y-5">
                {/* Section Meta Inputs */}
                <div className="grid grid-cols-2 gap-3 pb-4 border-b border-neutral-800">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-neutral-500">Section Title</label>
                    <input 
                      type="text"
                      value={activeSectionTitle}
                      onChange={(e) => setActiveSectionTitle(e.target.value)}
                      placeholder="e.g. Battle Royale"
                      className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest text-neutral-500">Category Tag</label>
                    <input 
                      type="text"
                      value={activeSectionCategory}
                      onChange={(e) => setActiveSectionCategory(e.target.value)}
                      placeholder="e.g. BR Esports"
                      className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs font-bold text-white outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                {/* Editor Mode Switcher */}
                <div className="flex items-center justify-between">
                  <div className="flex gap-1 p-1 bg-black rounded-xl border border-neutral-800">
                    <button
                      onClick={() => setRuleEditMode('interactive')}
                      className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${
                        ruleEditMode === 'interactive' ? 'bg-purple-600 text-white' : 'text-neutral-500'
                      }`}
                    >
                      Interactive Builder ({ruleList.length})
                    </button>
                    <button
                      onClick={() => setRuleEditMode('raw')}
                      className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${
                        ruleEditMode === 'raw' ? 'bg-purple-600 text-white' : 'text-neutral-500'
                      }`}
                    >
                      Multi-line Text
                    </button>
                  </div>

                  {/* Preset Template Loaders */}
                  <div className="relative group">
                    <button className="text-[8px] font-black uppercase tracking-wider text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1">
                      <Sparkles size={11} />
                      Load Preset
                    </button>
                    <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col bg-neutral-900 border border-neutral-800 rounded-xl p-1.5 shadow-2xl z-20 w-48 space-y-1">
                      {Object.keys(RULE_PRESETS).map(pKey => (
                        <button
                          key={pKey}
                          onClick={() => handleApplyPresetTemplate(pKey)}
                          className="text-left px-3 py-2 rounded-lg text-[9px] font-bold text-neutral-300 hover:bg-purple-600 hover:text-white transition-colors"
                        >
                          {RULE_PRESETS[pKey].title}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Interactive Builder Mode */}
                {ruleEditMode === 'interactive' ? (
                  <div className="space-y-3">
                    {/* Add Single Rule Input */}
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Add a new rule item (e.g. Device Requirement, Headshot Limit)..."
                        value={newSingleRuleText}
                        onChange={(e) => setNewSingleRuleText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddSingleRule();
                          }
                        }}
                        className="flex-1 bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-medium text-white outline-none focus:border-purple-500 placeholder:text-neutral-600"
                      />
                      <button
                        onClick={handleAddSingleRule}
                        className="px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider active:scale-95 transition-all"
                      >
                        Add
                      </button>
                    </div>

                    {/* Rule List Items */}
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1 no-scrollbar">
                      {ruleList.length === 0 ? (
                        <div className="py-8 text-center bg-black/40 rounded-2xl border border-dashed border-neutral-800">
                          <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">No rules in this section yet</p>
                          <p className="text-[8px] text-neutral-600 mt-1">Use the input above or load a starter preset</p>
                        </div>
                      ) : (
                        ruleList.map((r, idx) => (
                          <div key={idx} className="p-3.5 bg-black/60 border border-neutral-800/80 rounded-2xl flex items-start gap-3 group">
                            <span className="w-5 h-5 rounded-full bg-neutral-800 text-purple-400 text-[9px] font-black flex items-center justify-center shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="flex-1">
                              <input 
                                type="text"
                                value={r}
                                onChange={(e) => {
                                  const updated = [...ruleList];
                                  updated[idx] = e.target.value;
                                  setRuleList(updated);
                                  setRuleText(updated.join('\n'));
                                }}
                                className="w-full bg-transparent text-xs text-neutral-200 font-medium outline-none focus:text-white"
                              />
                            </div>
                            <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                              <button 
                                onClick={() => handleMoveRule(idx, 'up')}
                                disabled={idx === 0}
                                className="p-1 hover:text-purple-400 disabled:opacity-20"
                                title="Move Up"
                              >
                                <ChevronUp size={14} />
                              </button>
                              <button 
                                onClick={() => handleMoveRule(idx, 'down')}
                                disabled={idx === ruleList.length - 1}
                                className="p-1 hover:text-purple-400 disabled:opacity-20"
                                title="Move Down"
                              >
                                <ChevronDown size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteSingleRule(idx)}
                                className="p-1 hover:text-red-400 text-neutral-500"
                                title="Delete Rule"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  /* Multi-line Raw Mode */
                  <div className="space-y-2">
                    <p className="text-[8px] font-black text-neutral-500 uppercase tracking-widest">
                      Enter one rule per line ({ruleText.split('\n').filter(r => r.trim().length > 0).length} lines detected)
                    </p>
                    <textarea
                      value={ruleText}
                      onChange={(e) => {
                        setRuleText(e.target.value);
                        setRuleList(e.target.value.split('\n').filter(r => r.trim().length > 0));
                      }}
                      placeholder="Enter match rules here..."
                      className="w-full h-80 bg-black border border-neutral-800 rounded-2xl p-4 text-[11px] font-medium text-neutral-300 outline-none focus:border-purple-500 transition-all resize-none no-scrollbar leading-loose font-mono"
                    />
                  </div>
                )}

                {/* Save Regulations & Section Actions */}
                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={handleSaveCurrentSectionRules}
                    disabled={isProcessing}
                    className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
                  >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Save "{activeSectionTitle}" Regulations
                  </button>

                  {!['battle_royale', 'clash_squad', 'lone_wolf'].includes(activeRuleTab) && (
                    <button
                      onClick={() => handleDeleteCustomSectionRules(activeRuleTab, activeSectionTitle)}
                      disabled={isProcessing}
                      className="w-full py-2.5 text-red-400 hover:text-red-300 text-[8px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Trash2 size={12} />
                      Delete This Custom Section Rules
                    </button>
                  )}
                </div>
              </div>

              {/* Guidelines Info Banner */}
              <div className="p-4 bg-purple-500/5 border border-purple-500/10 rounded-2xl">
                 <p className="text-[8px] font-black text-purple-400 uppercase tracking-widest leading-relaxed flex items-center gap-1.5">
                   <Sparkles size={12} />
                   Live Sync: Rules configured here are dynamically matched to user screens by Section and Mode name.
                 </p>
              </div>
            </motion.div>
          )}

          {activeTab === AdminTab.REFERRAL && (
            <motion.div
              key="referral"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              {/* Referral Settings */}
              <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-3xl space-y-6">
                <div className="flex items-center justify-between mb-2">
                   <h3 className="text-sm font-black italic uppercase tracking-tight text-white">Referral Engine</h3>
                   <Copy size={16} className="text-purple-500" />
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 ml-1">Base Referral URL (e.g. https://khelgalli.in)</label>
                    <input 
                      type="text"
                      placeholder="https://yourapp.dom"
                      value={appSettings?.referral?.baseUrl || ''}
                      onChange={(e) => setAppSettings({
                        ...appSettings,
                        referral: { ...appSettings?.referral, baseUrl: e.target.value }
                      })}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 ml-1">Per Referral Reward (₹)</label>
                    <input 
                      type="number"
                      value={appSettings?.referral?.perReferralReward || 0}
                      onChange={(e) => setAppSettings({
                        ...appSettings,
                        referral: { ...appSettings?.referral, perReferralReward: Number(e.target.value) }
                      })}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 ml-1">Reward Type</label>
                    <select 
                      value={appSettings?.referral?.rewardType || 'deposit'}
                      onChange={(e) => setAppSettings({
                        ...appSettings,
                        referral: { ...appSettings?.referral, rewardType: e.target.value }
                      })}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500 appearance-none shadow-none ring-0"
                    >
                      <option value="deposit">Deposit Only</option>
                      <option value="bonus">Bonus Only</option>
                      <option value="both">Both (Split)</option>
                    </select>
                  </div>

                  {appSettings?.referral?.rewardType === 'both' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 ml-1">Deposit %</label>
                        <input 
                          type="number"
                          value={appSettings?.referral?.depositPercentage || 50}
                          onChange={(e) => setAppSettings({
                            ...appSettings,
                            referral: { ...appSettings?.referral, depositPercentage: Number(e.target.value) }
                          })}
                          className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 ml-1">Bonus %</label>
                        <input 
                          type="number"
                          value={appSettings?.referral?.bonusPercentage || 50}
                          onChange={(e) => setAppSettings({
                            ...appSettings,
                            referral: { ...appSettings?.referral, bonusPercentage: Number(e.target.value) }
                          })}
                          className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 ml-1">New User Reward (₹)</label>
                    <input 
                      type="number"
                      value={appSettings?.referral?.newUserReward || 0}
                      onChange={(e) => setAppSettings({
                        ...appSettings,
                        referral: { ...appSettings?.referral, newUserReward: Number(e.target.value) }
                      })}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <button 
                  onClick={() => handleSaveSettings(appSettings)}
                  disabled={isProcessing}
                  className="w-full py-4 bg-purple-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-purple-600/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save Referral configuration
                </button>
              </div>

              {/* Support Settings */}
              <div className="p-6 bg-neutral-900 border border-neutral-800 rounded-3xl space-y-6">
                <div className="flex items-center justify-between mb-2">
                   <h3 className="text-sm font-black italic uppercase tracking-tight text-white">Customer support</h3>
                   <UsersIcon size={16} className="text-blue-500" />
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600 ml-1">WhatsApp link</label>
                    <input 
                      type="text"
                      placeholder="https://wa.me/..."
                      value={appSettings?.support?.whatsapp || ''}
                      onChange={(e) => setAppSettings({
                        ...appSettings,
                        support: { ...appSettings?.support, whatsapp: e.target.value }
                      })}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600 ml-1">Telegram link</label>
                    <input 
                      type="text"
                      placeholder="https://t.me/..."
                      value={appSettings?.support?.telegram || ''}
                      onChange={(e) => setAppSettings({
                        ...appSettings,
                        support: { ...appSettings?.support, telegram: e.target.value }
                      })}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-600 ml-1">support email</label>
                    <input 
                      type="email"
                      placeholder="support@example.com"
                      value={appSettings?.support?.email || ''}
                      onChange={(e) => setAppSettings({
                        ...appSettings,
                        support: { ...appSettings?.support, email: e.target.value }
                      })}
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <button 
                  onClick={() => handleSaveSettings(appSettings)}
                  disabled={isProcessing}
                  className="w-full py-4 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/30 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Update support links
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === AdminTab.BANNERS && (
            <motion.div
              key="banners"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <button 
                onClick={() => {
                  setEditingBanner(null);
                  setImageUrl('');
                  setRedirectUrl('');
                  setBannerType('main');
                  setBannerOrder(banners.length);
                  setIsBannerModalOpen(true);
                }}
                className="w-full py-5 bg-purple-600 rounded-2xl flex items-center justify-center gap-3 shadow-lg shadow-purple-600/20 active:scale-[0.98] transition-all"
              >
                <Plus size={18} />
                <span className="text-xs font-black uppercase tracking-widest">Add Promotion Banner</span>
              </button>

              <div className="space-y-4">
                {banners.filter(b => b.isActive !== false).map((b) => (
                  <div key={b.id} className="p-4 bg-neutral-900 border border-neutral-800 rounded-3xl group">
                    <div className="relative aspect-video rounded-2xl overflow-hidden mb-4 border border-white/5">
                      <SafeImage 
                        src={b.imageUrl} 
                        alt="" 
                        className="w-full h-full"
                      />
                      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 flex items-center gap-2 z-20">
                        <div className={`w-1.5 h-1.5 rounded-full ${b.type === 'main' || b.type === 'offer' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                        <span className="text-[8px] font-black uppercase text-white tracking-widest">{b.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[8px] font-black uppercase text-neutral-600 tracking-widest mb-1">Order: {b.order}</p>
                        {b.redirectUrl && <p className="text-[8px] font-black text-purple-400 truncate max-w-[150px]">{b.redirectUrl}</p>}
                      </div>
                      <div className="flex gap-2">
                         <button 
                          onClick={() => {
                            setEditingBanner(b);
                            setImageUrl(b.imageUrl);
                            setRedirectUrl(b.redirectUrl || '');
                            setBannerType(b.type);
                            setBannerOrder(b.order);
                            setIsBannerModalOpen(true);
                          }}
                          className="p-2.5 bg-blue-500/10 text-blue-500 rounded-xl hover:bg-blue-500 hover:text-white transition-all"
                         >
                          <Edit2 size={16} />
                         </button>
                         <button 
                          onClick={() => handleDeleteBanner(b.id!)}
                          disabled={deletingBannerId === b.id}
                          className="p-2.5 bg-red-500/10 text-red-500 rounded-xl hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                         >
                          {deletingBannerId === b.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                         </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {activeTab === AdminTab.PAYMENT && (
            <motion.div
              key="payment"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="p-6 bg-purple-600/10 border border-purple-500/20 rounded-3xl flex items-center justify-between shadow-xl">
                 <div>
                   <h3 className="text-sm font-black italic uppercase tracking-tight text-white mb-1">Payment Gateways</h3>
                   <p className="text-[8px] font-black uppercase tracking-widest text-purple-500">Enable/Disable payment providers</p>
                 </div>
                 <button 
                  onClick={() => {
                    setEditingGateway(null);
                    setGatewayForm({
                      name: '',
                      apiKey: '',
                      secretKey: '',
                      merchantId: '',
                      webhookSecret: '',
                      upiId: ''
                    });
                    setIsGatewayModalOpen(true);
                  }}
                  className="p-3 bg-purple-600 rounded-xl text-white active:scale-90 transition-all shadow-lg"
                 >
                   <Plus size={20} />
                 </button>
              </div>

              <div className="space-y-4">
                {['razorpay', 'cashfree', 'transupi', 'zapupi', 'custom'].map(gId => {
                  const gateway = paymentGateways.find(g => g.id === gId);
                  const isConfigured = !!gateway;
                  const isActive = gateway?.isActive || false;

                  return (
                    <div key={gId} className={`p-5 bg-neutral-900 border rounded-3xl transition-all ${isActive ? 'border-purple-500 shadow-[0_0_20px_rgba(147,51,234,0.1)]' : 'border-neutral-800'}`}>
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${isActive ? 'bg-purple-600 border-purple-400 text-white' : 'bg-black border-neutral-800 text-neutral-600'}`}>
                            <DollarSign size={20} />
                          </div>
                          <div>
                            <h4 className="text-xs font-black italic uppercase tracking-tight">{gateway?.name || gId.toUpperCase()}</h4>
                            <div className="flex items-center gap-2">
                              <span className={`text-[8px] font-black uppercase tracking-widest ${isConfigured ? 'text-emerald-500' : 'text-neutral-600'}`}>
                                {isConfigured ? 'Configured' : 'Not Configured'}
                              </span>
                              {isActive && (
                                <span className="text-[8px] font-black uppercase tracking-widest text-purple-500 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">Active</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {isConfigured && (
                            <button 
                              onClick={() => {
                                setEditingGateway(gateway);
                                setGatewayForm({
                                  name: gateway.name,
                                  apiKey: gateway.apiKey || '',
                                  secretKey: gateway.secretKey || '',
                                  merchantId: gateway.merchantId || '',
                                  webhookSecret: gateway.webhookSecret || '',
                                  upiId: gateway.upiId || ''
                                });
                                setIsGatewayModalOpen(true);
                              }}
                              className="p-2 text-neutral-500 hover:text-white transition-colors"
                            >
                              <Settings size={16} />
                            </button>
                          )}
                          <button 
                            disabled={isProcessing || !isConfigured}
                            onClick={() => handleToggleGateway(gId, isActive)}
                            className={`w-12 h-6 rounded-full relative transition-all ${isActive ? 'bg-purple-600' : 'bg-neutral-800'} ${!isConfigured ? 'opacity-30' : ''}`}
                          >
                            <motion.div 
                              className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-lg"
                              animate={{ x: isActive ? 24 : 0 }}
                            />
                          </button>
                        </div>
                      </div>
                      
                      {isConfigured && (
                        <div className="grid grid-cols-2 gap-2 pt-4 border-t border-white/5">
                          <div>
                            <p className="text-[7px] font-black uppercase tracking-widest text-neutral-600">Merchant ID</p>
                            <p className="text-[9px] font-bold text-neutral-400 truncate">{gateway.merchantId || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-[7px] font-black uppercase tracking-widest text-neutral-600">API Key</p>
                            <p className="text-[9px] font-bold text-neutral-400 truncate">{gateway.apiKey ? '••••••••' : 'N/A'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* User Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end justify-center">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-lg bg-neutral-900 rounded-t-[3rem] p-8 pb-12 border-t border-neutral-800 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-black italic">Manage User</h3>
                <button onClick={() => setSelectedUser(null)} className="p-2 text-neutral-500 text-2xl">&times;</button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between p-4 bg-black rounded-2xl border border-neutral-800">
                  <div>
                    <p className="text-[8px] font-black uppercase tracking-widest text-neutral-600">Current Balance</p>
                    <p className="text-xl font-black italic text-emerald-400">
                      ₹{(selectedUser.wallet?.deposit || 0) + (selectedUser.wallet?.winnings || 0) + (selectedUser.wallet?.bonus || 0)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleUpdateBalance(selectedUser.id!, 100, 'deposit')}
                      className="p-3 bg-emerald-500 rounded-xl text-white shadow-lg shadow-emerald-500/20 active:scale-95"
                    >
                      <Plus size={18} />
                    </button>
                    <button 
                      onClick={() => handleUpdateBalance(selectedUser.id!, 100, 'withdrawal')}
                      className="p-3 bg-red-500 rounded-xl text-white shadow-lg shadow-red-500/20 active:scale-95"
                    >
                      <Minus size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-black rounded-2xl border border-neutral-800">
                  <div>
                    <h4 className="text-xs font-black italic mb-1">Account Safety</h4>
                    <p className="text-[8px] font-black uppercase tracking-widest text-neutral-600">
                      {selectedUser.isBanned ? 'User is Banned' : 'User is Active'}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleBanUser(selectedUser.id!, selectedUser.isBanned || false)}
                    className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border ${
                      selectedUser.isBanned 
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500' 
                        : 'bg-red-500/10 border-red-500 text-red-500'
                    } transition-all active:scale-95`}
                  >
                    {selectedUser.isBanned ? <Unlock size={14} /> : <Ban size={14} />}
                    {selectedUser.isBanned ? 'Unban' : 'Ban User'}
                  </button>
                </div>

                <div className="flex items-center justify-between p-4 bg-black rounded-2xl border border-neutral-800">
                  <div>
                    <h4 className="text-xs font-black italic mb-1">Password Management</h4>
                    <p className="text-[8px] font-black uppercase tracking-widest text-neutral-600">Send Reset Link</p>
                  </div>
                  <button 
                    onClick={() => handleResetPassword(selectedUser.email)}
                    className="px-6 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neutral-700 transition-all shadow-lg active:scale-95"
                  >
                    Reset Password
                  </button>
                </div>

                <div className="p-6 bg-black rounded-2xl border border-neutral-800">
                   <h4 className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-4">Account Details</h4>
                   <div className="space-y-4">
                      <DetailRow label="Username" value={selectedUser.username} />
                      <DetailRow label="Email" value={selectedUser.email} />
                      <DetailRow label="Phone" value={selectedUser.phone || 'N/A'} />
                      <DetailRow label="Wallet" value={`₹${(selectedUser.wallet?.deposit || 0) + (selectedUser.wallet?.winnings || 0) + (selectedUser.wallet?.bonus || 0)}`} />
                   </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteConfirmOpen.isOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-5">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs bg-neutral-900 rounded-[2.5rem] p-8 border border-neutral-800 shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-6">
                <Trash2 size={32} />
              </div>
              <h3 className="text-lg font-black italic mb-2">Delete Match?</h3>
              <p className="text-[10px] font-black uppercase tracking-widest text-neutral-500 mb-8 leading-relaxed">
                This will delete the match and refund all joined players automatically.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setIsDeleteConfirmOpen({ isOpen: false, matchId: '' })}
                  className="py-4 bg-neutral-800 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={processDeleteMatch}
                  disabled={isProcessing}
                  className="py-4 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? <Loader2 size={14} className="animate-spin" /> : 'Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Declare Result Modal */}
      <AnimatePresence>
        {isResultModalOpen && selectedMatchResults && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-5">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-neutral-900 rounded-[2.5rem] p-8 border border-neutral-800 shadow-2xl max-h-[90vh] flex flex-col"
            >
              <div className="flex justify-between items-center mb-6">
                <div>
                   <h3 className="text-lg font-black italic">Declare Result</h3>
                   <p className="text-[8px] font-black uppercase tracking-widest text-neutral-500 mt-1">{selectedMatchResults.title}</p>
                </div>
                <button onClick={() => setIsResultModalOpen(false)} className="text-neutral-500 text-2xl">&times;</button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-1">
                <div className="bg-black/40 rounded-2xl p-4 border border-white/5 space-y-2">
                   <p className="text-[9px] font-black uppercase tracking-widest text-purple-500">Match Info</p>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-[8px] text-neutral-600 uppercase font-black">Type</p>
                        <p className="text-[10px] font-black text-white italic">
                          {selectedMatchResults.section === 'Battle Royale' 
                            ? (selectedMatchResults.prizeType === 'perKill' ? 'Per Kill' : 'Survival')
                            : selectedMatchResults.section}
                        </p>
                      </div>
                      <div>
                        <p className="text-[8px] text-neutral-600 uppercase font-black">Prize Pool</p>
                        <p className="text-[10px] font-black text-emerald-400 italic">
                          {selectedMatchResults.section === 'Battle Royale'
                            ? (selectedMatchResults.prizeType === 'perKill' ? `₹${selectedMatchResults.perKillAmount}/kill` : 'Split')
                            : `₹${selectedMatchResults.prizePool}`}
                        </p>
                      </div>
                   </div>
                </div>

                <div className="space-y-3">
                   <p className="text-[9px] font-black uppercase tracking-widest text-neutral-600">Enter Results for Participants</p>
                   {selectedMatchResults.playersCount === 0 ? (
                     <div className="text-center py-10">
                        <UsersIcon size={32} className="mx-auto text-neutral-800 mb-4" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-neutral-700 italic">No players have joined this match</p>
                     </div>
                   ) : (
                     <div className="space-y-2">
                        {(selectedMatchResults.players || []).map(player => {
                            const playerKey = `${player.userId}_${player.slot}`;
                            const kills = playerResults[playerKey] || 0;
                            const rank = playerPositionResults[playerKey] || 0;
                            const killsReward = kills * (selectedMatchResults.perKillAmount || 0);
                            const posReward = selectedMatchResults.positionPrizeDistribution?.[rank] || 0;
                            const totalReward = killsReward + posReward;

                            return (
                              <div key={playerKey} className="p-4 bg-black/40 rounded-2xl border border-white/5 space-y-4">
                                <div className="flex items-center justify-between">
                                  <div 
                                    onClick={() => onPageChange(Page.ADMIN_USER_PROFILE, player.userId)}
                                    className="flex items-center gap-3 cursor-pointer group"
                                  >
                                   <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-500 border border-white/5 group-hover:bg-primary/20 group-hover:text-primary transition-colors">
                                      <UsersIcon size={16} />
                                   </div>
                                   <div>
                                     <h4 className="text-[10px] font-black italic group-hover:text-primary transition-colors leading-none mb-1">{player.ign}</h4>
                                     <p className="text-[7px] text-neutral-600 font-bold uppercase tracking-widest">{player.username}</p>
                                   </div>
                                </div>
                                {totalReward > 0 && (
                                  <div className="text-right">
                                    <p className="text-[10px] font-black text-emerald-400 italic">₹{totalReward}</p>
                                    <p className="text-[6px] text-neutral-600 font-bold uppercase">Total Winnings</p>
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <label className="text-[7px] font-black uppercase tracking-widest text-neutral-500 ml-1">
                                    {selectedMatchResults.section === 'Battle Royale' 
                                      ? (selectedMatchResults.prizeType === 'perKill' ? 'Kills' : 'Rank')
                                      : 'Rank (1=Win)'}
                                  </label>
                                  <div className="relative">
                                    <input 
                                      type="number"
                                      placeholder="0"
                                      value={playerResults[`${player.userId}_${player.slot}`] || ''}
                                      onChange={(e) => setPlayerResults({ ...playerResults, [`${player.userId}_${player.slot}`]: Number(e.target.value) })}
                                      className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-[10px] font-black italic text-white focus:border-purple-500 outline-none"
                                    />
                                    {selectedMatchResults.prizeType === 'perKill' && killsReward > 0 && (
                                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-emerald-500">₹{killsReward}</span>
                                    )}
                                  </div>
                                </div>

                                {selectedMatchResults.prizeType === 'perKill' && (
                                  <div className="space-y-1.5">
                                    <label className="text-[7px] font-black uppercase tracking-widest text-neutral-500 ml-1">Rank (Optional)</label>
                                    <div className="relative">
                                      <select 
                                        value={rank}
                                        onChange={(e) => setPlayerPositionResults({ ...playerPositionResults, [`${player.userId}_${player.slot}`]: Number(e.target.value) })}
                                        className="w-full bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-2 text-[10px] font-black italic text-white focus:border-purple-500 outline-none appearance-none"
                                      >
                                        <option value={0}>No Rank</option>
                                        {Array.from({ length: selectedMatchResults.positionWinnersCount || 0 }).map((_, idx) => (
                                          <option key={idx + 1} value={idx + 1}>Rank {idx + 1}</option>
                                        ))}
                                      </select>
                                      {posReward > 0 && (
                                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[8px] font-black text-emerald-500">₹{posReward}</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {selectedMatchResults.prizeType === 'perKill' && totalReward > 0 && (
                                <div className="pt-3 border-t border-white/5 flex justify-between items-center px-1">
                                  <div className="flex gap-3">
                                    <p className="text-[7px] text-neutral-600 font-bold uppercase tracking-tight">Kills: <span className="text-white">₹{killsReward}</span></p>
                                    {posReward > 0 && (
                                      <p className="text-[7px] text-neutral-600 font-bold uppercase tracking-tight">Rank: <span className="text-white">₹{posReward}</span></p>
                                    )}
                                  </div>
                                  <p className="text-[8px] font-black text-emerald-400 italic">Total: ₹{totalReward}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                     </div>
                   )}
                </div>
              </div>

              <button 
                onClick={handleSubmitResult}
                disabled={isProcessing || selectedMatchResults.playersCount === 0}
                className="w-full mt-8 py-5 bg-purple-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : 'Finalize & Declare Results'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Banner Management Modal */}
      <AnimatePresence>
        {isBannerModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-5">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-neutral-900 rounded-[2.5rem] p-8 border border-neutral-800 shadow-2xl overflow-y-auto no-scrollbar max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-black italic">{editingBanner ? 'Edit Banner' : 'New Banner'}</h3>
                <button onClick={() => setIsBannerModalOpen(false)} className="text-neutral-500 text-2xl transition-colors hover:text-white">&times;</button>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Banner Type</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['main', 'offer', 'freefire'].map(t => (
                      <button
                        key={t}
                        onClick={() => {
                          setBannerType(t as any);
                          // Reset image when type changes if it's not a fresh upload? No, keep it.
                        }}
                        className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                          bannerType === t 
                            ? 'bg-purple-600 border-purple-500 text-white' 
                            : 'bg-black border-neutral-800 text-neutral-500'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Banner Image</label>
                  
                  {imageUrl ? (
                    <div className="relative group aspect-video rounded-2xl overflow-hidden border border-neutral-800 bg-black">
                      <SafeImage 
                        src={imageUrl} 
                        alt="Preview" 
                        className="w-full h-full"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all z-20">
                        <button 
                          onClick={() => fileInputRef.current?.click()}
                          className="px-4 py-2 bg-white text-black text-[10px] font-black uppercase rounded-lg shadow-xl active:scale-95 transition-all"
                        >
                          Change Image
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="w-full aspect-video rounded-3xl border-2 border-dashed border-neutral-800 flex flex-col items-center justify-center gap-3 hover:border-purple-500/50 hover:bg-neutral-900/50 transition-all group"
                    >
                      {isUploading ? (
                        <Loader2 size={32} className="text-purple-500 animate-spin" />
                      ) : (
                        <>
                          <div className="w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center text-neutral-500 group-hover:text-purple-500 transition-colors">
                            <Upload size={24} />
                          </div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-neutral-600 group-hover:text-neutral-400">Upload Banner Image</p>
                        </>
                      )}
                    </button>
                  )}
                  
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  
                  {isUploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[8px] font-black text-purple-400">UPLOADING...</span>
                        <span className="text-[8px] font-black text-purple-400">{Math.round(uploadProgress)}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-black rounded-full overflow-hidden border border-white/5">
                        <motion.div 
                          className="h-full bg-purple-600"
                          initial={{ width: 0 }}
                          animate={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {(bannerType === 'main' || bannerType === 'offer') && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Redirect Link (Optional)</label>
                    <input 
                      type="text"
                      value={redirectUrl}
                      onChange={(e) => setRedirectUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Display Order</label>
                  <input 
                    type="number"
                    value={bannerOrder}
                    onChange={(e) => setBannerOrder(Number(e.target.value))}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500"
                  />
                </div>

                <button 
                  onClick={handleSaveBanner}
                  disabled={isProcessing || isUploading || !imageUrl}
                  className="w-full py-5 bg-purple-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-600/30 flex items-center justify-center gap-3 active:scale-95 transition-all mt-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : isUploading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isUploading ? 'Uploading Image...' : editingBanner ? 'Update Promotion' : 'Publish Banner'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Gateway Modal */}
      <AnimatePresence>
        {isGatewayModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-5">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg bg-neutral-900 rounded-[2.5rem] p-8 border border-neutral-800 shadow-2xl overflow-y-auto no-scrollbar max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-lg font-black italic">{editingGateway ? 'Gateway Settings' : 'Add Gateway'}</h3>
                <button onClick={() => setIsGatewayModalOpen(false)} className="text-neutral-500 text-2xl transition-colors hover:text-white">&times;</button>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 ml-1">Gateway Name</label>
                  <input 
                    type="text"
                    value={gatewayForm.name}
                    onChange={(e) => setGatewayForm({ ...gatewayForm, name: e.target.value })}
                    placeholder="Razorpay, Cashfree, etc."
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 ml-1">Merchant ID</label>
                    <input 
                      type="text"
                      value={gatewayForm.merchantId}
                      onChange={(e) => setGatewayForm({ ...gatewayForm, merchantId: e.target.value })}
                      placeholder="MID_123..."
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 ml-1">UPI ID (Optional)</label>
                    <input 
                      type="text"
                      value={gatewayForm.upiId}
                      onChange={(e) => setGatewayForm({ ...gatewayForm, upiId: e.target.value })}
                      placeholder="merchant@upi"
                      className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500 transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 ml-1">API Key</label>
                  <input 
                    type="password"
                    value={gatewayForm.apiKey}
                    onChange={(e) => setGatewayForm({ ...gatewayForm, apiKey: e.target.value })}
                    placeholder="Enter Public API Key"
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 ml-1">Secret Key / Token</label>
                  <input 
                    type="password"
                    value={gatewayForm.secretKey}
                    onChange={(e) => setGatewayForm({ ...gatewayForm, secretKey: e.target.value })}
                    placeholder="Enter Secret Key"
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-500 ml-1">Webhook Secret (Optional)</label>
                  <input 
                    type="password"
                    value={gatewayForm.webhookSecret}
                    onChange={(e) => setGatewayForm({ ...gatewayForm, webhookSecret: e.target.value })}
                    placeholder="Enter Webhook Secret"
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="pt-4">
                  <button 
                    onClick={handleSaveGateway}
                    disabled={isProcessing}
                    className="w-full py-5 bg-purple-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-600/30 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {editingGateway ? 'Save Configuration' : 'Create Gateway'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Declare Room Credentials Modal */}
      <AnimatePresence>
        {isDeclareRoomModalOpen && selectedDeclareRoomMatch && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[75] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-7 shadow-2xl overflow-hidden relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <Key size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black italic uppercase text-white tracking-wide">
                      Declare Room Credentials
                    </h3>
                    <p className="text-[8px] font-black uppercase tracking-widest text-neutral-500">
                      Match: {selectedDeclareRoomMatch.displayId || selectedDeclareRoomMatch.id.slice(0, 6)} • {selectedDeclareRoomMatch.title}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsDeclareRoomModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-4 py-5">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">
                    Custom Room ID *
                  </label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={declareRoomForm.roomId}
                      onChange={(e) => setDeclareRoomForm({ ...declareRoomForm, roomId: e.target.value })}
                      placeholder="e.g. 19284752"
                      className="w-full bg-black border border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold font-mono text-white outline-none focus:border-purple-500 transition-all placeholder:text-neutral-600"
                    />
                    {declareRoomForm.roomId && (
                      <button
                        onClick={() => handleCopyCredential(declareRoomForm.roomId, 'modal_room')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-white"
                      >
                        {copiedKey === 'modal_room' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">
                    Room Password *
                  </label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={declareRoomForm.roomPassword}
                      onChange={(e) => setDeclareRoomForm({ ...declareRoomForm, roomPassword: e.target.value })}
                      placeholder="e.g. 1234 or freefire"
                      className="w-full bg-black border border-neutral-800 rounded-2xl px-4 py-3.5 text-sm font-bold font-mono text-white outline-none focus:border-purple-500 transition-all placeholder:text-neutral-600"
                    />
                    {declareRoomForm.roomPassword && (
                      <button
                        onClick={() => handleCopyCredential(declareRoomForm.roomPassword, 'modal_pass')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-neutral-400 hover:text-white"
                      >
                        {copiedKey === 'modal_pass' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">
                    Match Status Transition
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDeclareRoomForm({ ...declareRoomForm, setStatusLive: true })}
                      className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${
                        declareRoomForm.setStatusLive
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                          : 'bg-black border-neutral-800 text-neutral-500'
                      }`}
                    >
                      ⚡ Mark Live / Ongoing
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeclareRoomForm({ ...declareRoomForm, setStatusLive: false })}
                      className={`py-3 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all ${
                        !declareRoomForm.setStatusLive
                          ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                          : 'bg-black border-neutral-800 text-neutral-500'
                      }`}
                    >
                      🕒 Keep Existing Status
                    </button>
                  </div>
                </div>

                {/* Auto Push Notification Toggle */}
                <div 
                  onClick={() => setDeclareRoomForm({ 
                    ...declareRoomForm, 
                    sendNotificationOnRoomDeclare: !declareRoomForm.sendNotificationOnRoomDeclare 
                  })}
                  className={`p-3.5 rounded-2xl border cursor-pointer flex items-center justify-between transition-all ${
                    declareRoomForm.sendNotificationOnRoomDeclare 
                      ? 'bg-purple-600/20 border-purple-500/50' 
                      : 'bg-black border-neutral-800'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      declareRoomForm.sendNotificationOnRoomDeclare 
                        ? 'bg-purple-500 text-white' 
                        : 'bg-neutral-800 text-neutral-500'
                    }`}>
                      <Bell size={14} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-white">
                        Auto Push Notification
                      </p>
                      <p className="text-[8px] text-neutral-400 font-medium">
                        Instantly alert joined players with Room ID & Pass
                      </p>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${
                    declareRoomForm.sendNotificationOnRoomDeclare 
                      ? 'bg-purple-600 border-purple-500 text-white' 
                      : 'border-neutral-700 bg-neutral-900'
                  }`}>
                    {declareRoomForm.sendNotificationOnRoomDeclare && <Check size={12} />}
                  </div>
                </div>

                <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-2xl">
                  <p className="text-[8px] font-bold text-purple-300 leading-relaxed">
                    💡 Once declared, players who joined this match will immediately see Room ID & Password on their Match Details screen and in their My Matches lobby.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  onClick={handleSaveDeclareRoom}
                  disabled={isProcessing}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Publish Room Credentials
                </button>

                {(selectedDeclareRoomMatch.roomId || selectedDeclareRoomMatch.roomPassword) && (
                  <button
                    onClick={() => handleClearRoomCredentials(selectedDeclareRoomMatch.id)}
                    disabled={isProcessing}
                    className="w-full py-2.5 text-neutral-500 hover:text-red-400 text-[9px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-1"
                  >
                    <Trash2 size={12} />
                    Clear Credentials
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add New Game Mode Section Rules Modal */}
      <AnimatePresence>
        {isAddSectionModalOpen && (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[75] flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-[2.5rem] p-7 shadow-2xl overflow-hidden relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <PlusCircle size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black italic uppercase text-white tracking-wide">
                      Create Mode Section Rules
                    </h3>
                    <p className="text-[8px] font-black uppercase tracking-widest text-neutral-500">
                      Add a new game section with tailored rules
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddSectionModalOpen(false)}
                  className="w-8 h-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white"
                >
                  &times;
                </button>
              </div>

              <div className="space-y-4 py-5">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">
                    Section Name / Game Mode *
                  </label>
                  <input 
                    type="text"
                    value={newSectionForm.title}
                    onChange={(e) => setNewSectionForm({ ...newSectionForm, title: e.target.value })}
                    placeholder="e.g. Clash Squad 2v2, Lone Wolf Pro, Daily Scrims"
                    className="w-full bg-black border border-neutral-800 rounded-2xl px-4 py-3.5 text-xs font-bold text-white outline-none focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">
                    Category Tag
                  </label>
                  <input 
                    type="text"
                    value={newSectionForm.category}
                    onChange={(e) => setNewSectionForm({ ...newSectionForm, category: e.target.value })}
                    placeholder="e.g. Custom Tournament, Duo Scrims"
                    className="w-full bg-black border border-neutral-800 rounded-2xl px-4 py-3.5 text-xs font-bold text-white outline-none focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-widest text-neutral-400 ml-1">
                    Initial Rules Preset
                  </label>
                  <select
                    value={newSectionForm.template}
                    onChange={(e) => setNewSectionForm({ ...newSectionForm, template: e.target.value })}
                    className="w-full bg-black border border-neutral-800 rounded-2xl px-4 py-3.5 text-xs font-bold text-white outline-none focus:border-purple-500 transition-all"
                  >
                    {Object.keys(RULE_PRESETS).map((pKey) => (
                      <option key={pKey} value={pKey}>
                        {RULE_PRESETS[pKey].title} ({RULE_PRESETS[pKey].rules.length} rules)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleAddNewSectionSubmit}
                  disabled={isProcessing}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
                >
                  {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <PlusCircle size={16} />}
                  Create Section & Rules
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: any) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col justify-between h-32 relative overflow-hidden group">
      <Icon size={48} className={`absolute -right-2 -bottom-2 opacity-10 ${color} group-hover:scale-110 transition-transform`} />
      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500 relative z-10">{label}</p>
      <p className="text-2xl font-black italic tracking-tighter truncate relative z-10">{value}</p>
    </div>
  );
}

function HealthBar({ label, status }: any) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[10px] font-black uppercase tracking-widest text-neutral-600">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">{status}</span>
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
      </div>
    </div>
  );
}

function DetailRow({ label, value }: any) {
  return (
    <div className="flex justify-between items-center py-3 border-b border-white/5">
      <span className="text-[9px] font-black uppercase tracking-widest text-neutral-600">{label}</span>
      <span className="text-[10px] font-bold text-neutral-300">{value}</span>
    </div>
  );
}

