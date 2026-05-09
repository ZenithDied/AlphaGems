import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  supabase, signInWithGoogle, signOut as supabaseSignOut,
  getMyProfile, submitMegaQuest, getMySubmissions, getAllSubmissions,
  adminAcceptSubmission, adminDeclineSubmission, adminTimeoutSubmission,
  getMyTransactions, getMyNotifications, markAllNotificationsRead, getUnreadNotifCount,
  getTotalGemsDistributed,
} from "./lib/supabase";
import type { User } from "@supabase/supabase-js";
import {
  Home,
  Trophy,
  Wallet,
  Shield,
  FileText,
  Video,
  Zap,
  Lock,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  X,
  Gem,
  Users,
  ArrowRight,
  ChevronRight,
  ChevronDown,
  Bell,
  Info,
  Sparkles,
  Rocket,
  Target,
  Star,
  Ban,
  Timer,
  Eye,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";

/* ── types ── */
type Screen = "landing" | "signin" | "app";
type Page = "home" | "earn" | "withdraw";
type NotifType = "success" | "error" | "warning" | "info";
interface Notif { id: number; msg: string; type: NotifType }

type SubmissionStatus = "pending" | "accepted" | "declined" | "timed_out";
interface Submission {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  link: string;
  status: SubmissionStatus;
  submittedAt: number;
  reason?: string;
  timeoutUntil?: number;
}

/* ── google icon SVG ── */
function GoogleIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function FloatingIcon({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (<motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className={className}>{children}</motion.div>);
}

function PulseDot({ color = "bg-ag-purple" }: { color?: string }) {
  return (<span className="relative flex h-2 w-2"><span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${color} opacity-40`} /><span className={`relative inline-flex rounded-full h-2 w-2 ${color}`} /></span>);
}

function Toast({ n, onClose }: { n: Notif; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const styles: Record<NotifType, { border: string; icon: React.ReactNode }> = {
    success: { border: "border-ag-emerald bg-ag-emerald/10", icon: <CheckCircle className="w-4 h-4 text-ag-emerald" /> },
    error: { border: "border-ag-danger bg-ag-danger/10", icon: <AlertTriangle className="w-4 h-4 text-ag-danger" /> },
    warning: { border: "border-ag-amber bg-ag-amber/10", icon: <AlertTriangle className="w-4 h-4 text-ag-amber" /> },
    info: { border: "border-ag-blue bg-ag-blue/10", icon: <Bell className="w-4 h-4 text-ag-blue" /> },
  };
  const s = styles[n.type];
  return (
    <motion.div initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 60 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md ${s.border}`}>
      {s.icon}
      <span className="text-sm text-ag-text max-w-xs">{n.msg}</span>
      <button onClick={onClose} className="ml-1 opacity-50 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════════
   LEGAL MODAL
   ══════════════════════════════════════════════════════════════════════════════ */
function LegalModal({ type, onClose }: { type: "privacy" | "terms"; onClose: () => void }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }} transition={{ type: "spring", damping: 22 }}
        className="bg-ag-card border border-ag-border rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-2xl mx-4"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-ag-border">
          <div className="flex items-center gap-2">
            {type === "privacy" ? <div className="p-1.5 rounded-lg bg-ag-cyan/10"><Shield className="w-4 h-4 text-ag-cyan" /></div> : <div className="p-1.5 rounded-lg bg-ag-indigo/10"><FileText className="w-4 h-4 text-ag-indigo" /></div>}
            <h2 className="text-lg font-bold text-white">{type === "privacy" ? "Privacy Policy" : "Terms of Service"}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4 text-ag-text-dim" /></button>
        </div>
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-70px)] text-sm text-ag-text-dim leading-relaxed space-y-4">
          {type === "privacy" ? (<>
            <p className="text-[10px] text-ag-purple font-mono uppercase tracking-widest">Last Updated: January 15, 2026 · Version 2.1.0</p>
            <h3 className="text-white font-semibold">§1. Data Encryption Protocols</h3>
            <p>AlphaGems employs AES-256-GCM encryption for all data at rest and TLS 1.3 for data in transit. Session tokens use CSPRNG with 256-bit entropy and rotate every 3,600 seconds. Cryptographic keys are stored in HSMs with FIPS 140-2 Level 3 certification.</p>
            <h3 className="text-white font-semibold">§2. Third-Party API Compliance & SOC 2 Type II</h3>
            <p>All integrations comply with SOC 2 Type II standards across all five Trust Services Criteria. Data shared with external APIs is anonymized through differential privacy (ε ≤0.01). Vendor assessments are conducted quarterly.</p>
            <h3 className="text-white font-semibold">§3. Zero-Password Guarantee</h3>
            <p>AlphaGems never requests, stores, or intercepts passwords, 2FA codes, or email credentials. Authentication is delegated exclusively to OAuth 2.0 identity providers. The auth flow occurs entirely within the provider's secure domain.</p>
            <h3 className="text-white font-semibold">§4. Cookie & Tracking Disclosure</h3>
            <p>First-party session cookies only (HttpOnly, Secure, SameSite=Strict). No third-party tracking, fingerprinting, or RTB participation. No data sold to brokers.</p>
            <h3 className="text-white font-semibold">§5. Data Retention & Deletion (GDPR/CCPA)</h3>
            <p>90-day retention post-deactivation. GDPR Art. 17 / CCPA §1798.105 deletion requests processed within 72 hours. Backup purge within 30 days. NIST SP 800-88 compliant destruction.</p>
            <h3 className="text-white font-semibold">§6. Incident Response</h3>
            <p>24/7 SOC with &lt;15min MTTD. Breach notification within 72 hours per GDPR Art. 33/34. Full regulatory reporting.</p>
          </>) : (<>
            <p className="text-[10px] text-ag-purple font-mono uppercase tracking-widest">Effective Date: January 15, 2026 · Version 2.1.0</p>
            <div className="bg-ag-danger/5 border border-ag-danger/20 rounded-lg p-3"><p className="text-ag-danger font-semibold text-xs uppercase mb-1">Alpha Clause</p><p className="text-white text-xs">AlphaGems is an Early Access Alpha Build. No rewards are guaranteed until the platform exits Alpha and achieves 100% Liquidity Reserve targets.</p></div>
            <h3 className="text-white font-semibold">§1. Platform Usage</h3>
            <p>Conversion rate: 10 Gems = 1 Robux (internal gamification mapping). Features, rewards, and parameters may change without notice. Accumulated progress may be reset during Alpha.</p>
            <h3 className="text-white font-semibold">§2. Reward Funding Disclaimer</h3>
            <p>Rewards contingent upon External Community Funding Goals and Global Engagement Milestones. No guarantee of fulfillment. Liquidity Reserve model — withdrawals enabled only when reserve targets are met.</p>
            <div className="bg-ag-purple/5 border border-ag-purple/30 rounded-lg p-3"><p className="text-white font-bold text-xs mb-1">⚡ Non-Affiliation</p><p className="text-xs">AlphaGems is independent. Not affiliated with, endorsed by, or connected to Roblox Corporation. "Robux" is used for internal gamification mapping at a 10:1 ratio.</p></div>
            <h3 className="text-white font-semibold">§3. Account Security</h3>
            <p>Users responsible for third-party credentials. AlphaGems not liable for third-party account issues. Accounts are non-transferable.</p>
            <h3 className="text-white font-semibold">§4. Community Integrity</h3>
            <p>All submissions subject to Manual Audit. System Integrity Filter has final authority — not subject to appeal. Prohibited: account farming, botting, identity spoofing. Violations = termination + gem forfeiture.</p>
            <h3 className="text-white font-semibold">§5. Limitation of Liability</h3>
            <p>SERVICE PROVIDED "AS IS." Maximum aggregate liability: 90-day gem value or $10 USD, whichever is greater. Delaware law. AAA arbitration. Class action waiver.</p>
          </>)}
        </div>
      </motion.div>
    </motion.div>
  );
}

function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
  const items = [
    { q: "Is AlphaGems free to use?", a: "Yes, completely free. You earn Gems by completing tasks and convert them to Robux at no cost." },
    { q: "How do I earn Gems?", a: "Complete quests — currently the main quest is creating a TikTok video featuring AlphaGems. More quests coming soon." },
    { q: "How does the Robux conversion work?", a: "Every 10 Gems = 1 Robux. Earn 200 Gems from a quest = 20 Robux." },
    { q: "When can I withdraw?", a: "Withdrawals open once the community hits the Global Verification Goal." },
    { q: "Why is there a community goal?", a: "AlphaGems is funded by growth. When users post about us, it funds the reward pool. The goal ensures fair payouts." },
    { q: "Is this affiliated with Roblox?", a: "No. AlphaGems is independent and not affiliated with Roblox Corporation." },
  ];
  return (
    <div className="space-y-2">{items.map((item, i) => (
      <div key={i} className="bg-ag-card border border-ag-border rounded-xl overflow-hidden">
        <button onClick={() => setOpen(open === i ? null : i)} className="w-full flex items-center justify-between p-4 text-left hover:bg-white/[0.02] transition-colors">
          <span className="text-sm font-medium text-white pr-4">{item.q}</span>
          <motion.div animate={{ rotate: open === i ? 180 : 0 }} transition={{ duration: 0.2 }}><ChevronDown className="w-4 h-4 text-ag-text-dim flex-shrink-0" /></motion.div>
        </button>
        <AnimatePresence>{open === i && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}>
            <div className="px-4 pb-4 text-sm text-ag-text-dim leading-relaxed border-t border-ag-border pt-3">{item.a}</div>
          </motion.div>
        )}</AnimatePresence>
      </div>
    ))}</div>
  );
}

function AlphaBanner() {
  return (
    <div className="fixed bottom-4 left-4 z-[90] max-w-xs">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1, type: "spring", damping: 20 }}
        className="bg-ag-card border border-ag-purple/20 rounded-2xl p-4 shadow-xl shadow-black/30">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-ag-purple/15 flex-shrink-0 mt-0.5"><Rocket className="w-4 h-4 text-ag-purple" /></div>
          <div>
            <div className="flex items-center gap-2 mb-1"><span className="text-xs font-bold text-ag-purple uppercase tracking-wider">Early Alpha</span><PulseDot color="bg-ag-purple" /></div>
            <p className="text-[11px] text-ag-text-dim leading-relaxed">AlphaGems is in early alpha. Features & rewards may change.</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function BgOrbs() {
  return (<div className="fixed inset-0 pointer-events-none overflow-hidden z-0"><div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-ag-purple/[0.03] rounded-full blur-[120px]" /><div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] bg-ag-pink/[0.025] rounded-full blur-[100px]" /></div>);
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="p-1.5 rounded-lg bg-gradient-to-br from-ag-purple to-ag-pink"><Gem className="w-4 h-4 text-white" /></div>
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-black italic bg-gradient-to-r from-ag-purple to-ag-pink bg-clip-text text-transparent tracking-wide">ALPHAGEMS</span>
        <span className="text-[9px] text-ag-text-dim font-medium hidden md:inline">Not affiliated with Roblox</span>
      </div>
    </div>
  );
}

/* faster page transition config */
const pageTrans = { type: "tween" as const, duration: 0.15, ease: "easeOut" as const };

/* ══════════════════════════════════════════
   MAIN APP
   ══════════════════════════════════════════ */
export default function App() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [page, setPage] = useState<Page>("home");
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [tiktokLink, setTiktokLink] = useState("");
  const [tiktokStatus, setTiktokStatus] = useState<"idle" | "pending" | "declined" | "timed_out">("idle");
  const [tiktokCompleted, setTiktokCompleted] = useState(false);
  const [declineMsg, setDeclineMsg] = useState("");
  const [retryAfter, setRetryAfter] = useState(0);
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);
  const [questInfoTab, setQuestInfoTab] = useState<"why" | "requirements">("requirements");
  const [questInfoOpen, setQuestInfoOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [devGems, setDevGems] = useState<number | null>(null);
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [timeoutPopup, setTimeoutPopup] = useState<string | null>(null);
  const [timeoutReason, setTimeoutReason] = useState("");
  const [timeoutHours, setTimeoutHours] = useState("24");
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [totalGemsDistributed, setTotalGemsDistributed] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [adminActioning, setAdminActioning] = useState<string | null>(null);
  const [animatingGems, setAnimatingGems] = useState(false);
  const [displayGems, setDisplayGems] = useState(0);

  // ── Supabase data state ──
  const [dbNotifications, setDbNotifications] = useState<Array<{ id: string; title: string; message: string; type: string; read: boolean; created_at: string }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifBellOpen, setNotifBellOpen] = useState(false);
  const [gemTransactions, setGemTransactions] = useState<Array<{ id: string; amount: number; reason: string; source_type: string; created_at: string }>>([]);
  const [dbSubmissions, setDbSubmissions] = useState<Array<{ id: string; user_id: string; link: string; status: string; decline_reason: string | null; timeout_until: string | null; submitted_at: string; reviewed_at: string | null }>>([]);
  const [profileGems, setProfileGems] = useState(0);

  /* DB data fetching is below, after notify and isDevUser are defined */

  // ── Global submissions queue (persisted in localStorage, visible to admins only) ──
  const [submissions, setSubmissions] = useState<Submission[]>(() => {
    try {
      const raw = localStorage.getItem("ag_submissions_queue");
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });

  // Persist submissions globally whenever they change
  useEffect(() => {
    try { localStorage.setItem("ag_submissions_queue", JSON.stringify(submissions)); } catch { /* ignore */ }
  }, [submissions]);

  // Persist and restore quest state per user
  useEffect(() => {
    if (!user?.id || user.id === "dev-guest-00000") return;
    try {
      const saved = localStorage.getItem(`ag_user_${user.id}`);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.tiktokCompleted) setTiktokCompleted(true);
        if (d.tiktokStatus) setTiktokStatus(d.tiktokStatus);
        if (d.tiktokLink) setTiktokLink(d.tiktokLink);
        if (d.declineMsg) setDeclineMsg(d.declineMsg);
        if (d.retryAfter) setRetryAfter(d.retryAfter);
      }
    } catch { /* ignore */ }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || user.id === "dev-guest-00000") return;
    try {
      localStorage.setItem(`ag_user_${user.id}`, JSON.stringify({
        tiktokCompleted, tiktokStatus, tiktokLink, declineMsg, retryAfter,
      }));
    } catch { /* ignore */ }
  }, [user?.id, tiktokCompleted, tiktokStatus, tiktokLink, declineMsg, retryAfter]);

  // Admin check — frozen list, cannot be modified at runtime by normal users
  const ADMIN_EMAILS = ["altamimyali9@gmail.com"] as const;
  const isDevUser = useMemo(() => {
    if (!user?.email) return false;
    return (ADMIN_EMAILS as readonly string[]).includes(user.email) || user.id === "dev-guest-00000";
  }, [user?.email, user?.id]);

  /* keyboard shortcuts — admin-guarded */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Shift+A — only opens for verified admin emails or dev guest
      if (e.shiftKey && e.key === "A") {
        if (!isDevUser) return; // silently ignore for normal users
        setDevPanelOpen((p) => !p);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDevUser]);

  useEffect(() => {
    let keys: number[] = [];
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "d") { keys = []; return; }
      keys.push(Date.now());
      keys = keys.filter((t) => Date.now() - t < 1500);
      if (keys.length >= 3) {
        keys = [];
        setUser({ id: "dev-guest-00000", email: "guest@alphagems.dev", user_metadata: { full_name: "Guest (Dev)" }, app_metadata: {}, aud: "authenticated", created_at: new Date().toISOString() } as User);
        setDevGems(5000);
        setPage("home");
        setScreen("app");
        setAuthLoading(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const finalizeAuthenticatedState = useCallback((authUser: User) => {
    setUser(authUser); setPage("home"); setScreen("app"); setSigningIn(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    const bootstrapAuth = async () => {
      try {
        const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
        const hp = new URLSearchParams(hash);
        const at = hp.get("access_token"), rt = hp.get("refresh_token");
        if (at && rt) {
          const { data, error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
          if (!error && data.session?.user && mounted) finalizeAuthenticatedState(data.session.user);
          window.history.replaceState({}, document.title, window.location.pathname);
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        if (session?.user) finalizeAuthenticatedState(session.user);
        else { setUser(null); setScreen("landing"); }
      } finally { if (mounted) setAuthLoading(false); }
    };
    bootstrapAuth();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (!mounted) return;
      if (session?.user) { finalizeAuthenticatedState(session.user); if (window.location.hash.includes("access_token")) window.history.replaceState({}, document.title, window.location.pathname); }
      else { setUser(null); setScreen("landing"); }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [finalizeAuthenticatedState]);

  const gemBalance = useMemo(() => {
    if (devGems !== null) return devGems;
    return profileGems;
  }, [profileGems, devGems]);
  const robux = Math.floor(gemBalance / 10);
  const globalProgress = tiktokCompleted ? 1 : 0;
  const globalGoal = 1000;

  let _nid = 0;
  const notify = useCallback((msg: string, type: NotifType) => { const id = Date.now() + ++_nid; setNotifs((p) => [...p, { id, msg, type }]); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  const dismissNotif = useCallback((id: number) => setNotifs((p) => p.filter((n) => n.id !== id)), []);

  // ── Supabase data fetching (runs after login) ──
  const refreshDbData = useCallback(async () => {
    if (!user?.id || user.id === "dev-guest-00000") return;
    try {
      const [profile, notifData, count, txns, subs] = await Promise.all([
        getMyProfile(), getMyNotifications(), getUnreadNotifCount(), getMyTransactions(), getMySubmissions(),
      ]);
      setProfileGems(typeof profile?.gems === "number" ? profile.gems : 0);
      setDbNotifications(notifData);
      setUnreadCount(count);
      setGemTransactions(txns);
      setDbSubmissions(subs);
      // Sync quest state from latest DB submission
      if (subs.length > 0) {
        const latest = subs[0];
        if (latest.status === "accepted") { setTiktokCompleted(true); setTiktokStatus("idle"); }
        else if (latest.status === "pending") { setTiktokStatus("pending"); setTiktokLink(latest.link); }
        else if (latest.status === "declined") { setTiktokStatus("declined"); setDeclineMsg(latest.decline_reason || "Declined. Retry in 8 hours."); }
        else if (latest.status === "timed_out") { setTiktokStatus("timed_out"); setDeclineMsg(latest.decline_reason || "Timed out."); if (latest.timeout_until) setRetryAfter(new Date(latest.timeout_until).getTime()); }
      } else {
        setTiktokCompleted(false);
        setTiktokStatus("idle");
      }
      // Show unread notifications as toasts
      const unread = notifData.filter((n: { read: boolean }) => !n.read);
      for (const n of unread) notify(n.message, (n.type as NotifType) || "info");
      if (unread.length > 0) { await markAllNotificationsRead(); setUnreadCount(0); setDbNotifications((p) => p.map((n) => ({ ...n, read: true }))); }
    } catch (err) { console.error("DB fetch error:", err); }
  }, [user?.id, notify]);

  useEffect(() => { refreshDbData(); }, [refreshDbData]);

  // Admin: load all submissions into dev panel
  const refreshAdminData = useCallback(async () => {
    if (!isDevUser || user?.id === "dev-guest-00000") return;
    try {
      const all = await getAllSubmissions();
      setSubmissions(all.map((s: Record<string, unknown>) => ({
        id: s.id as string, userId: s.user_id as string,
        userEmail: ((s.user_id as string) || "").slice(0, 8) + "...",
        userName: ((s.user_id as string) || "").slice(0, 8),
        link: s.link as string, status: s.status as SubmissionStatus,
        submittedAt: new Date(s.submitted_at as string).getTime(),
        reason: s.decline_reason as string | undefined,
        timeoutUntil: s.timeout_until ? new Date(s.timeout_until as string).getTime() : undefined,
      })));
    } catch (err) { console.error("Admin fetch error:", err); }
  }, [isDevUser, user?.id]);

  useEffect(() => { refreshAdminData(); }, [refreshAdminData]);

  // Fetch total gems distributed for landing page
  useEffect(() => {
    getTotalGemsDistributed().then(setTotalGemsDistributed).catch(() => {});
  }, [tiktokCompleted]);

  // Animated gem counter — counts up when balance changes
  useEffect(() => {
    if (displayGems === gemBalance) return;
    setAnimatingGems(true);
    const diff = gemBalance - displayGems;
    const steps = 20;
    const stepSize = diff / steps;
    let current = displayGems;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      current += stepSize;
      if (step >= steps) { setDisplayGems(gemBalance); setAnimatingGems(false); clearInterval(interval); }
      else { setDisplayGems(Math.round(current)); }
    }, 30);
    return () => clearInterval(interval);
  }, [gemBalance, displayGems]);

  // Supabase Realtime — admin sees new submissions pop in live
  useEffect(() => {
    if (!isDevUser) return;
    const channel = supabase
      .channel("admin-submissions")
      .on("postgres_changes", { event: "*", schema: "public", table: "mega_quests" }, () => {
        refreshAdminData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isDevUser, refreshAdminData]);

  const canRetry = tiktokStatus === "declined" || (tiktokStatus === "timed_out" && Date.now() > retryAfter);

  const handleVerify = async () => {
    if (!tiktokLink.trim()) { notify("Enter a valid TikTok URL.", "warning"); return; }
    if (!tiktokLink.includes("tiktok")) { notify("Invalid URL — must be a TikTok link.", "error"); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      if (user?.id && user.id !== "dev-guest-00000") {
        const dbSub = await submitMegaQuest(tiktokLink);
        setSubmissions((p) => [...p, {
          id: dbSub.id, userId: user.id, userEmail: user.email || "", userName: user.user_metadata?.full_name || "User",
          link: tiktokLink, status: "pending", submittedAt: Date.now(),
        }]);
      } else {
        setSubmissions((p) => [...p, {
          id: Date.now().toString(36), userId: user?.id || "unknown", userEmail: user?.email || "unknown",
          userName: user?.user_metadata?.full_name || "User", link: tiktokLink, status: "pending", submittedAt: Date.now(),
        }]);
      }
      setTiktokStatus("pending");
      notify("Video submitted! Manual verification takes 24–48 hours.", "info");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to submit.";
      notify(msg, "error");
    } finally { setSubmitting(false); }
  };

  const handleRetry = () => {
    setTiktokStatus("idle");
    setTiktokLink("");
    setDeclineMsg("");
  };

  /* ── dev panel actions — all server-side via Supabase ── */
  const handleAccept = async (subId: string) => {
    if (!isDevUser || adminActioning) return;
    const sub = submissions.find((s) => s.id === subId);
    if (!sub) return;
    setAdminActioning(subId);
    try {
      await adminAcceptSubmission(subId, sub.userId);
      setSubmissions((p) => p.map((s) => s.id === subId ? { ...s, status: "accepted" as const } : s));
      setTotalGemsDistributed((p) => p + 200);
      notify("✅ Accepted — 200 Gems credited via Supabase.", "success");
      refreshAdminData();
    } catch (err) { console.error(err); notify("Accept failed.", "error"); }
    finally { setAdminActioning(null); }
  };

  const handleDecline = async (subId: string) => {
    if (!isDevUser || adminActioning) return;
    const sub = submissions.find((s) => s.id === subId);
    if (!sub) return;
    setAdminActioning(subId);
    try {
      await adminDeclineSubmission(subId, sub.userId);
      setSubmissions((p) => p.map((s) => s.id === subId ? { ...s, status: "declined" as const } : s));
      notify("Declined.", "info");
      refreshAdminData();
    } catch (err) { console.error(err); notify("Decline failed.", "error"); }
    finally { setAdminActioning(null); }
  };

  const handleTimeoutConfirm = async (subId: string) => {
    if (!isDevUser || adminActioning) return;
    if (!timeoutReason.trim()) { notify("Enter a reason.", "warning"); return; }
    const hrs = Math.max(9, parseInt(timeoutHours) || 24);
    const sub = submissions.find((s) => s.id === subId);
    if (!sub) return;
    setAdminActioning(subId);
    try {
      await adminTimeoutSubmission(subId, sub.userId, hrs, timeoutReason);
      setSubmissions((p) => p.map((s) => s.id === subId ? { ...s, status: "timed_out" as const, reason: timeoutReason } : s));
      setTimeoutPopup(null); setTimeoutReason(""); setTimeoutHours("24");
      notify(`Timed out for ${hrs}h.`, "info");
      refreshAdminData();
    } catch (err) { console.error(err); notify("Timeout failed.", "error"); }
    finally { setAdminActioning(null); }
  };

  const handleGoogleSignIn = async () => {
    setSigningIn(true);
    try { await signInWithGoogle(); } catch { setSigningIn(false); notify("Sign-in failed.", "error"); }
  };

  const handleSignOutClick = () => setLogoutConfirm(true);

  const handleSignOutConfirm = async () => {
    setLogoutConfirm(false);
    try {
      setPage("home");
      setDevGems(null);
      // Don't reset quest state — it's persisted in localStorage per user
      await supabaseSignOut();
    } catch { notify("Sign-out failed.", "error"); }
  };

  if (authLoading) return (<div className="min-h-screen bg-ag-bg bg-grid bg-noise flex items-center justify-center"><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-ag-purple/30 border-t-ag-purple rounded-full" /></div>);

  /* ═══ SIGN-IN ═══ */
  if (screen === "signin") return (
    <div className="min-h-screen bg-ag-bg bg-grid bg-noise text-ag-text flex items-center justify-center relative px-4">
      <BgOrbs />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={pageTrans} className="w-full max-w-md relative z-10">
        <div className="bg-ag-card border border-ag-border rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/30">
          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-br from-ag-purple to-ag-pink mb-4"><Gem className="w-8 h-8 text-white" /></div>
            <h1 className="text-2xl font-bold text-white mb-1">Welcome to AlphaGems</h1>
            <p className="text-sm text-ag-text-dim">Sign in to start earning Gems</p>
          </div>
          <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={handleGoogleSignIn} disabled={signingIn}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white rounded-xl text-gray-800 font-semibold text-sm hover:bg-gray-50 transition-colors disabled:opacity-70 disabled:cursor-wait">
            {signingIn ? (<><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-gray-300 border-t-gray-800 rounded-full" /><span>Signing in...</span></>) : (<><GoogleIcon /><span>Continue with Google</span></>)}
          </motion.button>
          <div className="mt-6 text-center"><p className="text-[11px] text-ag-text-dim">By continuing, you agree to our <button onClick={() => setLegalModal("terms")} className="text-ag-purple hover:underline">Terms</button> and <button onClick={() => setLegalModal("privacy")} className="text-ag-purple hover:underline">Privacy Policy</button></p></div>
          <div className="mt-6 pt-5 border-t border-ag-border text-center"><button onClick={() => setScreen("landing")} className="text-xs text-ag-text-dim hover:text-white transition-colors">← Back to home</button></div>
        </div>
        <p className="text-center text-[10px] text-ag-text-dim mt-4">Not affiliated with Roblox Corporation</p>
      </motion.div>
      <AlphaBanner />
      <AnimatePresence>{legalModal && <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />}</AnimatePresence>
    </div>
  );

  /* ═══ LANDING ═══ */
  if (screen === "landing") return (
    <div className="min-h-screen bg-ag-bg bg-grid bg-noise text-ag-text flex flex-col relative">
      <BgOrbs />
      <header className="border-b border-ag-border bg-ag-bg/70 backdrop-blur-xl sticky top-0 z-50 relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between"><Brand /><motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setScreen("signin")} className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-ag-purple to-ag-purple-dim text-white text-sm font-bold rounded-xl hover:shadow-lg hover:shadow-ag-purple/25 transition-shadow">Sign In</motion.button></div>
      </header>
      <main className="flex-1 flex flex-col relative z-10">
        <section className="flex-1 flex items-center justify-center px-4 sm:px-6 py-16 sm:py-24">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, type: "spring", damping: 20 }}>
              <div className="relative inline-block mb-8">
                <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }} className="absolute -top-6 -left-10"><Star className="w-6 h-6 text-ag-amber/30" /></motion.div>
                <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 4, repeat: Infinity, delay: 1 }} className="absolute -top-4 -right-12"><Sparkles className="w-5 h-5 text-ag-purple/30" /></motion.div>
                <div className="inline-flex items-center gap-2 px-5 py-2 bg-ag-purple/10 border border-ag-purple/20 rounded-full text-xs text-ag-purple font-semibold uppercase tracking-wider"><PulseDot color="bg-ag-purple" /><span>Early Alpha</span></div>
              </div>
              <h1 className="text-3xl sm:text-5xl md:text-7xl font-black text-white leading-tight mb-6">Earn <span className="bg-gradient-to-r from-ag-purple via-ag-pink to-ag-purple bg-clip-text text-transparent">Robux</span> by<br />completing quests</h1>
              <p className="text-ag-text-dim text-base sm:text-lg max-w-xl mx-auto mb-10 leading-relaxed">Stack Gems through simple social tasks. <span className="text-white font-semibold">10 Gems = 1 Robux</span> — withdraw once the community goal is hit.</p>
              <div className="flex flex-col items-center gap-4">
                <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }} onClick={() => setScreen("signin")} className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-ag-purple to-ag-pink text-white font-bold rounded-2xl text-base hover:shadow-xl hover:shadow-ag-purple/30 transition-all">Join Now <ArrowRight className="w-5 h-5" /></motion.button>
                <span className="text-[11px] text-ag-text-dim">Free to join · Sign in with Google</span>
              </div>
            </motion.div>
          </div>
        </section>
        <section className="border-t border-ag-border py-14 sm:py-20 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto"><div className="text-center mb-10 sm:mb-14"><h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">How It Works</h2><p className="text-sm text-ag-text-dim max-w-lg mx-auto">Three simple steps. No tricks.</p></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[{ step: "01", title: "Sign In with Google", desc: "One click to create your account.", icon: <GoogleIcon className="w-6 h-6" />, bg: "bg-white/10", border: "border-white/10" },{ step: "02", title: "Complete Quests", desc: "Post about AlphaGems on TikTok. More quests coming soon!", icon: <Trophy className="w-6 h-6 text-ag-amber" />, bg: "bg-ag-amber/10", border: "border-ag-amber/20" },{ step: "03", title: "Withdraw Robux", desc: "10 Gems = 1 Robux. Cash out when the community goal is met.", icon: <Wallet className="w-6 h-6 text-ag-emerald" />, bg: "bg-ag-emerald/10", border: "border-ag-emerald/20" }].map((s, i) => (
                <motion.div key={s.step} initial={{ opacity: 0, y: 25 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15, type: "spring", damping: 20 }} className={`bg-ag-card border ${s.border} rounded-2xl p-7 text-center glow-card`}>
                  <div className={`w-14 h-14 rounded-2xl ${s.bg} flex items-center justify-center mx-auto mb-5`}>{s.icon}</div>
                  <div className="text-[10px] text-ag-purple font-bold uppercase tracking-widest mb-2">Step {s.step}</div>
                  <h3 className="text-white font-bold mb-2 text-lg">{s.title}</h3><p className="text-ag-text-dim text-sm leading-relaxed">{s.desc}</p>
                </motion.div>))}
            </div>
          </div>
        </section>
        <section className="border-t border-ag-border py-16 px-4 sm:px-6 bg-ag-card/20"><div className="max-w-3xl mx-auto text-center"><Sparkles className="w-6 h-6 text-ag-purple mx-auto mb-4" /><h2 className="text-xl font-bold text-white mb-3">Why do we give away Robux?</h2><p className="text-sm text-ag-text-dim leading-relaxed max-w-2xl mx-auto">AlphaGems is funded by community growth. When you post and share, you grow the platform — that growth funds bigger rewards.</p></div></section>
        <section className="border-t border-ag-border py-14 sm:py-20 px-4 sm:px-6"><div className="max-w-2xl mx-auto"><div className="text-center mb-8 sm:mb-10"><h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Frequently Asked Questions</h2><p className="text-sm text-ag-text-dim">Got questions? We've got answers.</p></div><FAQ /></div></section>
        <section className="border-t border-ag-border py-14 px-4 sm:px-6"><div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 text-center">{[{ label: "Active Users", value: "Soon..", color: "text-ag-purple" },{ label: "Gems Distributed", value: totalGemsDistributed > 0 ? totalGemsDistributed.toLocaleString() : "Soon..", color: "text-ag-cyan" },{ label: "Quests Available", value: "1", color: "text-ag-amber" },{ label: "Robux Paid Out", value: "0", color: "text-ag-emerald" }].map((s) => (<div key={s.label}><div className={`text-2xl sm:text-3xl font-black ${s.color}`}>{s.value}</div><div className="text-xs text-ag-text-dim mt-1">{s.label}</div></div>))}</div></section>
      </main>
      <footer className="border-t border-ag-border py-5 px-4 sm:px-6 relative z-10"><div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ag-text-dim"><div className="flex items-center gap-3"><span>© 2026 AlphaGems</span><span className="hidden sm:inline">·</span><span className="hidden sm:inline">Not affiliated with Roblox</span></div><div className="flex gap-4"><button onClick={() => setLegalModal("privacy")} className="hover:text-ag-purple transition-colors">Privacy Policy</button><button onClick={() => setLegalModal("terms")} className="hover:text-ag-purple transition-colors">Terms of Service</button></div></div></footer>
      <AlphaBanner />
      <AnimatePresence>{legalModal && <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />}</AnimatePresence>
    </div>
  );

  /* ═══ LOGGED-IN APP ═══ */
  return (
    <div className="min-h-screen bg-ag-bg bg-grid bg-noise text-ag-text flex flex-col relative">
      <BgOrbs />
      <header className="sticky top-0 z-50 border-b border-ag-border bg-ag-bg/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-8">
            <Brand />
            <nav className="flex items-center gap-0.5 sm:gap-1">{([{ id: "home" as Page, label: "Home", icon: <Home className="w-4 h-4" /> },{ id: "earn" as Page, label: "Quests", icon: <Trophy className="w-4 h-4" /> },{ id: "withdraw" as Page, label: "Withdraw", icon: <Wallet className="w-4 h-4" /> }]).map((item) => (<button key={item.id} onClick={() => setPage(item.id)} className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${page === item.id ? "bg-ag-purple/15 text-ag-purple" : "text-ag-text-dim hover:text-white hover:bg-white/5"}`}>{item.icon} <span className="hidden sm:inline">{item.label}</span></button>))}</nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Notification bell */}
            <div className="relative">
              <button onClick={() => setNotifBellOpen((p) => !p)} className="p-2 rounded-xl hover:bg-white/5 transition-colors relative">
                <Bell className="w-4 h-4 text-ag-text-dim" />
                {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-ag-purple text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>}
              </button>
              <AnimatePresence>
                {notifBellOpen && (
                  <motion.div initial={{ opacity: 0, y: 5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 5, scale: 0.95 }}
                    className="absolute right-0 top-12 w-72 sm:w-80 bg-ag-card border border-ag-border rounded-2xl shadow-2xl shadow-black/40 z-[100] overflow-hidden">
                    <div className="flex items-center justify-between p-3 border-b border-ag-border">
                      <span className="text-xs font-bold text-white">Notifications</span>
                      <button onClick={() => setNotifBellOpen(false)} className="p-1 hover:bg-white/5 rounded-lg"><X className="w-3.5 h-3.5 text-ag-text-dim" /></button>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {dbNotifications.length === 0 && <p className="text-xs text-ag-text-dim text-center py-6">No notifications yet.</p>}
                      {dbNotifications.map((n) => (
                        <div key={n.id} className={`px-3 py-2.5 border-b border-ag-border/50 ${n.read ? "opacity-50" : ""}`}>
                          <p className="text-xs text-white font-medium">{n.title}</p>
                          <p className="text-[11px] text-ag-text-dim mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-ag-text-dim mt-1">{new Date(n.created_at).toLocaleDateString()}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 px-2.5 sm:px-4 py-1.5 bg-ag-card border border-ag-border rounded-xl">
              <div className="flex items-center gap-1 sm:gap-1.5"><Gem className={`w-3.5 sm:w-4 h-3.5 sm:h-4 text-ag-purple ${animatingGems ? "animate-bounce" : ""}`} /><span className="text-xs sm:text-sm font-bold text-ag-purple">{displayGems.toLocaleString()}</span></div>
              <div className="w-px h-4 bg-ag-border hidden sm:block" />
              <div className="hidden sm:flex items-center gap-1.5"><span className="text-[10px] text-ag-text-dim">≈</span><span className="text-sm font-bold text-white">{robux} R$</span></div>
            </div>
            <button onClick={handleSignOutClick} className="text-xs text-ag-text-dim hover:text-white transition-colors">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 relative z-10">
        <AnimatePresence mode="wait">
          {/* HOME */}
          {page === "home" && (
            <motion.div key="home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={pageTrans} className="space-y-5 sm:space-y-6">
              <div className="rounded-2xl border border-ag-border bg-gradient-to-br from-ag-card via-ag-card to-ag-purple/[0.05] p-5 sm:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-72 h-72 bg-ag-purple/[0.06] rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3" />
                <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                  <div className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-ag-purple/20 to-ag-pink/10 border border-ag-purple/15"><Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-ag-purple" /></div>
                  <div>
                    <h1 className="text-xl sm:text-3xl font-bold text-white mb-1">Welcome, <span className="bg-gradient-to-r from-ag-purple to-ag-pink bg-clip-text text-transparent">{user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Collector"}</span></h1>
                    <p className="text-ag-text-dim text-sm sm:text-base">Complete quests to earn Gems. Every 10 Gems = 1 Robux.</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">{[{ label: "Gem Balance", value: displayGems.toLocaleString(), sub: `≈ ${robux} Robux`, icon: <Gem className="w-5 h-5" />, color: "text-ag-purple", bg: "bg-ag-purple/10", sc: "text-ag-purple" },{ label: "Quests Done", value: tiktokCompleted ? "1" : "0", sub: "of 1 available", icon: <Trophy className="w-5 h-5" />, color: "text-ag-amber", bg: "bg-ag-amber/10", sc: "text-ag-text-dim" },{ label: "Community Goal", value: globalProgress.toString(), sub: `/ ${globalGoal.toLocaleString()} verified`, icon: <Users className="w-5 h-5" />, color: "text-ag-cyan", bg: "bg-ag-cyan/10", sc: "text-ag-text-dim" }].map((s, i) => (<motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, ...pageTrans }} className="bg-ag-card border border-ag-border rounded-2xl p-4 sm:p-5 glow-card"><div className="text-ag-text-dim text-xs mb-2 sm:mb-3 flex items-center justify-between">{s.label}<div className={`p-1.5 rounded-lg ${s.bg} ${s.color}`}>{s.icon}</div></div><div className="text-xl sm:text-2xl font-bold text-white">{s.value}</div><div className={`text-sm mt-1 ${s.sc}`}>{s.sub}</div></motion.div>))}</div>
              <div className="bg-ag-card border border-ag-border rounded-2xl p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-semibold text-white flex items-center gap-2"><Zap className="w-4 h-4 text-ag-amber" />Global Community Goal</h3><span className="text-xs text-ag-purple font-bold">{((globalProgress / globalGoal) * 100).toFixed(2)}%</span></div>
                <div className="h-3 bg-ag-bg rounded-full overflow-hidden border border-ag-border"><motion.div initial={{ width: 0 }} animate={{ width: `${(globalProgress / globalGoal) * 100}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-ag-purple to-ag-pink" /></div>
                <p className="text-xs text-ag-text-dim mt-3">Withdrawals unlock at <span className="text-white font-semibold">{globalGoal.toLocaleString()}</span> verified posts.</p>
              </div>

              {/* Recent gem transactions */}
              {gemTransactions.length > 0 && (
                <div className="bg-ag-card border border-ag-border rounded-2xl p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Gem className="w-4 h-4 text-ag-purple" />Recent Transactions</h3>
                  <div className="space-y-2">
                    {gemTransactions.slice(0, 5).map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between py-2 border-b border-ag-border/30 last:border-0">
                        <div>
                          <p className="text-xs text-white font-medium">{tx.reason}</p>
                          <p className="text-[10px] text-ag-text-dim">{new Date(tx.created_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-sm font-bold ${tx.amount > 0 ? "text-ag-emerald" : "text-ag-danger"}`}>{tx.amount > 0 ? "+" : ""}{tx.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submission history from DB */}
              {dbSubmissions.length > 0 && (
                <div className="bg-ag-card border border-ag-border rounded-2xl p-4 sm:p-5">
                  <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Video className="w-4 h-4 text-ag-purple" />Your Submissions</h3>
                  <div className="space-y-2">
                    {dbSubmissions.slice(0, 5).map((s) => (
                      <div key={s.id} className="flex items-center justify-between py-2 border-b border-ag-border/30 last:border-0">
                        <div className="min-w-0 flex-1 mr-3">
                          <a href={s.link} target="_blank" rel="noopener noreferrer" className="text-xs text-ag-purple hover:underline truncate block">{s.link}</a>
                          <p className="text-[10px] text-ag-text-dim">{new Date(s.submitted_at).toLocaleDateString()}</p>
                        </div>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ${s.status === "pending" ? "bg-ag-amber/10 text-ag-amber" : s.status === "accepted" ? "bg-ag-emerald/10 text-ag-emerald" : "bg-ag-danger/10 text-ag-danger"}`}>{s.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => setPage("earn")} className="flex items-center justify-between bg-ag-card border border-ag-border rounded-2xl p-4 sm:p-5 hover:border-ag-purple/30 transition-all group text-left"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-ag-amber/10 text-ag-amber"><Trophy className="w-5 h-5" /></div><div><div className="text-sm font-semibold text-white">Start Earning</div><div className="text-xs text-ag-text-dim">1 quest available</div></div></div><ChevronRight className="w-4 h-4 text-ag-text-dim group-hover:text-ag-purple transition-colors" /></motion.button>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} onClick={() => setPage("withdraw")} className="flex items-center justify-between bg-ag-card border border-ag-border rounded-2xl p-4 sm:p-5 hover:border-ag-purple/30 transition-all group text-left"><div className="flex items-center gap-3"><div className="p-2.5 rounded-xl bg-ag-emerald/10 text-ag-emerald"><Wallet className="w-5 h-5" /></div><div><div className="text-sm font-semibold text-white">Withdraw Robux</div><div className="text-xs text-ag-text-dim">{robux} R$ available</div></div></div><ChevronRight className="w-4 h-4 text-ag-text-dim group-hover:text-ag-purple transition-colors" /></motion.button>
              </div>
            </motion.div>
          )}

          {/* EARN */}
          {page === "earn" && (
            <motion.div key="earn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={pageTrans} className="space-y-5 sm:space-y-6">
              <div><h1 className="text-2xl font-bold text-white mb-1">Quests</h1><p className="text-sm text-ag-text-dim">Complete tasks to earn Gems — 10 Gems = 1 Robux.</p></div>

              {/* TikTok mission */}
              <div className="rounded-2xl border-2 border-ag-purple/30 glass bg-gradient-to-br from-ag-card/70 via-ag-card/60 to-ag-purple/[0.06] relative overflow-hidden" style={{ boxShadow: "0 0 30px rgba(168,85,247,0.08)" }}>
                <div className="absolute top-0 right-0 w-60 h-60 bg-ag-purple/[0.05] rounded-full blur-[80px] -translate-y-1/2 translate-x-1/3" />
                <div className="relative p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                    <div className="flex items-start gap-3">
                      <FloatingIcon><div className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-br from-ag-purple/20 to-ag-pink/10 border border-ag-purple/25 flex-shrink-0"><Video className="w-5 h-5 sm:w-6 sm:h-6 text-ag-purple" /></div></FloatingIcon>
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-0.5"><h2 className="text-base sm:text-lg font-bold text-white">TikTok Mission</h2><span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 bg-ag-purple/10 text-ag-purple border border-ag-purple/20 rounded-full flex items-center gap-1"><Sparkles className="w-3 h-3" /> Only Quest</span></div>
                        <p className="text-xs sm:text-sm text-ag-text-dim">Post a TikTok featuring AlphaGems and submit the link for manual verification.</p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right flex-shrink-0 pl-11 sm:pl-0"><div className="text-xl sm:text-2xl font-black bg-gradient-to-r from-ag-purple to-ag-pink bg-clip-text text-transparent">200</div><div className="text-[10px] text-ag-text-dim uppercase tracking-wider">Gems (20 R$)</div></div>
                  </div>

                  {/* info tabs */}
                  <div className="flex items-center gap-1 mb-3">
                    <button onClick={() => { setQuestInfoTab("requirements"); setQuestInfoOpen(true); }} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${questInfoTab === "requirements" && questInfoOpen ? "bg-ag-purple/15 text-ag-purple" : "text-ag-text-dim hover:text-ag-purple"}`}><FileText className="w-3.5 h-3.5" />Requirements</button>
                    <button onClick={() => { setQuestInfoTab("why"); setQuestInfoOpen(true); }} className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors ${questInfoTab === "why" && questInfoOpen ? "bg-ag-purple/15 text-ag-purple" : "text-ag-text-dim hover:text-ag-purple"}`}><Info className="w-3.5 h-3.5" />Why does this matter?</button>
                    {questInfoOpen && <button onClick={() => setQuestInfoOpen(false)} className="ml-auto text-ag-text-dim hover:text-white"><ChevronDown className="w-4 h-4 rotate-180" /></button>}
                  </div>

                  <AnimatePresence mode="wait">
                    {questInfoOpen && questInfoTab === "requirements" && (
                      <motion.div key="req" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                        <div className="bg-ag-bg/60 border border-ag-border rounded-xl p-4 mb-4 text-xs text-ag-text-dim leading-relaxed space-y-2.5">
                          <p className="text-white font-semibold text-sm mb-1">Video Requirements</p>
                          <div className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-ag-emerald mt-0.5 flex-shrink-0" /><p><span className="text-white font-medium">Mention AlphaGems</span> — clearly talk about how AlphaGems lets users earn free Robux by completing simple quests. This is the most important part.</p></div>
                          <div className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-ag-emerald mt-0.5 flex-shrink-0" /><p><span className="text-white font-medium">Show the website</span> — include a screen recording or screenshot of the AlphaGems dashboard so viewers can see the platform is real.</p></div>
                          <div className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-ag-emerald mt-0.5 flex-shrink-0" /><p><span className="text-white font-medium">Minimum 1,000 views</span> — your video must have at least 1,000 views before we can verify it. This ensures it actually reaches people.</p></div>
                          <div className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-ag-emerald mt-0.5 flex-shrink-0" /><p><span className="text-white font-medium">Real engagement</span> — the video should have genuine likes, comments, or shares. Botted or bought engagement will be rejected.</p></div>
                          <div className="flex items-start gap-2"><CheckCircle className="w-3.5 h-3.5 text-ag-emerald mt-0.5 flex-shrink-0" /><p><span className="text-white font-medium">No misleading content</span> — don't promise things AlphaGems doesn't offer. Keep it honest: mention that we're in alpha and rewards unlock with the community goal.</p></div>
                          <div className="flex items-start gap-2"><Eye className="w-3.5 h-3.5 text-ag-amber mt-0.5 flex-shrink-0" /><p><span className="text-white font-medium">Manual review</span> — every submission is reviewed by our team. Fake, stolen, or low-effort videos will be declined. You can retry after 8 hours.</p></div>
                        </div>
                      </motion.div>
                    )}
                    {questInfoOpen && questInfoTab === "why" && (
                      <motion.div key="why" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                        <div className="bg-ag-bg/60 border border-ag-border rounded-xl p-4 mb-4 text-xs text-ag-text-dim leading-relaxed space-y-2">
                          <p><span className="text-white font-semibold">Here's the deal:</span> Robux rewards are funded by platform growth. Your TikTok helps us reach more people — more people means a bigger reward pool for everyone.</p>
                          <p>Every verified video contributes to the <span className="text-ag-purple font-semibold">Global Community Goal</span>. Once we hit {globalGoal.toLocaleString()} verified posts, withdrawals unlock.</p>
                          <p>All submissions go through <span className="text-white font-semibold">manual verification</span>. We check that the video is real, mentions AlphaGems, and meets the requirements. This typically takes 24–48 hours.</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* submission states */}
                  {(tiktokStatus === "idle" && !tiktokCompleted) && (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <div className="flex-1 relative"><input type="url" value={tiktokLink} onChange={(e) => setTiktokLink(e.target.value)} placeholder="https://www.tiktok.com/@user/video/..." className="w-full bg-ag-bg border border-ag-border rounded-xl px-4 py-3 text-sm text-white placeholder-ag-text-dim focus:outline-none focus:border-ag-purple/50 focus:ring-1 focus:ring-ag-purple/20 transition-all" /><ExternalLink className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ag-text-dim" /></div>
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={handleVerify} disabled={submitting}
                        className="px-7 py-3 bg-gradient-to-r from-ag-purple to-ag-pink text-white font-bold rounded-xl text-sm hover:shadow-lg hover:shadow-ag-purple/25 transition-shadow disabled:opacity-60 disabled:cursor-wait">
                        {submitting ? "Submitting..." : "Submit"}
                      </motion.button>
                    </div>
                  )}

                  {tiktokStatus === "pending" && (
                    <div className="flex items-center gap-3 p-4 bg-ag-amber/10 border border-ag-amber/20 rounded-xl">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}><Clock className="w-5 h-5 text-ag-amber" /></motion.div>
                      <div><span className="text-ag-amber font-bold text-sm">Pending Manual Review</span><p className="text-xs text-ag-text-dim">Our team is verifying your submission. Estimated: 24–48 hours.</p></div>
                    </div>
                  )}

                  {(tiktokStatus === "declined" || tiktokStatus === "timed_out") && (
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 p-4 bg-ag-danger/10 border border-ag-danger/20 rounded-xl">
                        <Ban className="w-5 h-5 text-ag-danger flex-shrink-0 mt-0.5" />
                        <div><span className="text-ag-danger font-bold text-sm">Submission Declined</span><p className="text-xs text-ag-text-dim mt-1">{declineMsg}</p>{tiktokStatus === "timed_out" && <p className="text-[10px] text-ag-text-dim mt-2">Need help? Contact <span className="text-ag-purple">support@alphagems.dev</span></p>}</div>
                      </div>
                      {canRetry && <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleRetry} className="w-full py-3 bg-ag-purple/10 text-ag-purple border border-ag-purple/20 rounded-xl font-bold text-sm hover:bg-ag-purple/20 transition-all">Retry Submission</motion.button>}
                    </div>
                  )}

                  {tiktokCompleted && (
                    <div className="flex items-center gap-3 p-4 bg-ag-emerald/10 border border-ag-emerald/20 rounded-xl"><CheckCircle className="w-5 h-5 text-ag-emerald" /><div><span className="text-ag-emerald font-bold text-sm">Verified & Completed</span><p className="text-xs text-ag-text-dim">200 Gems have been credited to your account.</p></div></div>
                  )}
                </div>
              </div>

              {/* more quests */}
              <div className="rounded-2xl border border-dashed border-ag-border glass p-6 sm:p-8 text-center">
                <div className="inline-flex p-3 rounded-2xl bg-ag-purple/5 mb-4"><Target className="w-8 h-8 text-ag-purple/40" /></div>
                <h3 className="text-lg font-bold text-white mb-2">More Quests Coming Soon</h3>
                <p className="text-sm text-ag-text-dim max-w-md mx-auto leading-relaxed">We're working on more ways to earn Gems — follow us on social media, referral programs, daily check-ins, and more.</p>
                <div className="mt-4 flex items-center justify-center gap-2"><PulseDot color="bg-ag-purple" /><span className="text-xs text-ag-purple font-medium">In Development</span></div>
              </div>
            </motion.div>
          )}

          {/* WITHDRAW */}
          {page === "withdraw" && (
            <motion.div key="withdraw" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={pageTrans} className="space-y-5 sm:space-y-6">
              <div><h1 className="text-2xl font-bold text-white mb-1">Withdraw</h1><p className="text-sm text-ag-text-dim">You have <span className="text-ag-purple font-semibold">{gemBalance.toLocaleString()} Gems</span> ≈ <span className="text-white font-semibold">{robux} R$</span></p></div>
              <div className="relative">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">{[{ amount: 100, gems: 1000, label: "Starter", color: "from-ag-blue to-ag-cyan" },{ amount: 500, gems: 5000, label: "Premium", color: "from-ag-purple to-ag-pink" },{ amount: 2000, gems: 20000, label: "Elite", color: "from-ag-amber to-ag-rose" }].map((opt, i) => (<motion.div key={opt.amount} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05, ...pageTrans }} className="bg-ag-card border border-ag-border rounded-2xl p-6 sm:p-7 text-center relative overflow-hidden"><div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${opt.color}`} /><div className="text-[10px] font-bold uppercase tracking-widest text-ag-purple mb-4">{opt.label}</div><div className="text-3xl sm:text-4xl font-black text-white mb-1">{opt.amount.toLocaleString()}</div><div className="text-sm text-ag-text-dim mb-1">Robux</div><div className="text-xs text-ag-text-dim mb-5 flex items-center justify-center gap-1"><Gem className="w-3 h-3 text-ag-purple" /> {opt.gems.toLocaleString()} Gems</div><button onClick={() => notify("⛔ GATEWAY OFFLINE — Community goal not reached.", "error")} className="w-full py-2.5 bg-white/5 text-ag-text-dim border border-ag-border rounded-xl font-bold text-sm cursor-not-allowed"><Lock className="w-4 h-4 inline mr-1.5 -mt-0.5" /> Redeem</button></motion.div>))}</div>
                <div className="absolute inset-0 rounded-2xl bg-ag-overlay backdrop-blur-sm flex flex-col items-center justify-center z-10 border border-ag-purple/15">
                  <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 20 }} className="text-center px-6">
                    <FloatingIcon><div className="rounded-full bg-ag-purple/10 border-2 border-ag-purple/25 flex items-center justify-center mx-auto mb-5 p-4"><Lock className="w-8 h-8 text-ag-purple" /></div></FloatingIcon>
                    <h2 className="text-lg sm:text-xl font-black text-white mb-2 uppercase tracking-wider">System Integrity Lock</h2>
                    <p className="text-sm text-ag-text-dim max-w-md mx-auto mb-5">Withdrawals unlock when the Global Community Goal is reached.</p>
                    <div className="bg-ag-card border border-ag-border rounded-xl p-4 max-w-xs mx-auto mb-5"><div className="flex justify-between text-xs mb-2"><span className="text-ag-text-dim">Progress</span><span className="text-ag-purple font-bold">{((globalProgress / globalGoal) * 100).toFixed(2)}%</span></div><div className="h-3 bg-ag-bg rounded-full overflow-hidden border border-ag-border"><motion.div initial={{ width: 0 }} animate={{ width: `${(globalProgress / globalGoal) * 100}%` }} transition={{ duration: 1, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-ag-purple to-ag-pink" /></div><div className="flex justify-between text-xs text-ag-text-dim mt-2"><span><span className="text-white font-semibold">{globalProgress}</span> verified</span><span><span className="text-white font-semibold">{globalGoal.toLocaleString()}</span> needed</span></div></div>
                    <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setPage("earn")} className="px-6 py-2.5 text-sm font-bold text-ag-purple border border-ag-purple/30 rounded-xl hover:bg-ag-purple/10 transition-all">Contribute to Goal →</motion.button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <footer className="border-t border-ag-border py-4 px-4 sm:px-6 relative z-10"><div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-ag-text-dim"><div className="flex items-center gap-2 sm:gap-3 flex-wrap justify-center"><span>© 2026 AlphaGems</span><span className="hidden sm:inline">·</span><span className="hidden sm:inline">Not affiliated with Roblox</span><button onClick={() => setLegalModal("privacy")} className="hover:text-ag-purple transition-colors">Privacy</button><button onClick={() => setLegalModal("terms")} className="hover:text-ag-purple transition-colors">Terms</button></div><div className="flex items-center gap-1.5"><PulseDot color="bg-ag-emerald" /><span>All Systems Operational</span></div></div></footer>

      <div className="fixed top-20 right-4 sm:right-6 z-[200] space-y-2"><AnimatePresence>{notifs.map((n) => <Toast key={n.id} n={n} onClose={() => dismissNotif(n.id)} />)}</AnimatePresence></div>
      <AlphaBanner />
      <AnimatePresence>{legalModal && <LegalModal type={legalModal} onClose={() => setLegalModal(null)} />}</AnimatePresence>

      {/* ── Logout confirmation ── */}
      <AnimatePresence>
        {logoutConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setLogoutConfirm(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()} className="bg-ag-card border border-ag-border rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
              <div className="text-center mb-5">
                <div className="w-12 h-12 rounded-full bg-ag-purple/10 border border-ag-purple/20 flex items-center justify-center mx-auto mb-4">
                  <AlertTriangle className="w-6 h-6 text-ag-purple" />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">Sign out?</h3>
                <p className="text-sm text-ag-text-dim">
                  Are you sure you want to sign out of{" "}
                  <span className="text-white font-medium">{user?.user_metadata?.full_name || user?.email?.split("@")[0] || "your account"}</span>?
                </p>
                <p className="text-xs text-ag-text-dim mt-2">Your progress is saved — you can pick up right where you left off next time.</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setLogoutConfirm(false)} className="flex-1 py-2.5 text-sm font-medium text-ag-text-dim border border-ag-border rounded-xl hover:bg-white/5 transition-colors">Stay</button>
                <button onClick={handleSignOutConfirm} className="flex-1 py-2.5 text-sm font-bold bg-ag-purple/10 text-ag-purple border border-ag-purple/20 rounded-xl hover:bg-ag-purple/20 transition-colors">Sign Out</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dev Panel ── */}
      <AnimatePresence>
        {devPanelOpen && isDevUser && (
          <motion.div initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ type: "spring", damping: 24, stiffness: 260 }}
            className="fixed top-0 right-0 bottom-0 w-80 sm:w-[420px] z-[300] bg-ag-card border-l border-ag-purple/20 shadow-2xl shadow-black/50 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-ag-border">
              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-ag-emerald animate-pulse" /><span className="text-sm font-bold text-white uppercase tracking-wider">Dev Panel</span></div>
              <button onClick={() => setDevPanelOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5"><X className="w-4 h-4 text-ag-text-dim" /></button>
            </div>
            <div className="p-4 border-b border-ag-border">
              <p className="text-[10px] text-ag-text-dim uppercase tracking-widest mb-1">Signed in as</p>
              <p className="text-sm text-white font-medium truncate">{user?.user_metadata?.full_name || "Unknown"}</p>
              <p className="text-xs text-ag-text-dim truncate">{user?.email}</p>
            </div>

            {/* submissions queue */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-[10px] text-ag-text-dim uppercase tracking-widest mb-2">Submissions ({submissions.length})</p>
              {submissions.length === 0 && <p className="text-xs text-ag-text-dim text-center py-8">No submissions yet.</p>}
              {submissions.map((sub) => (
                <div key={sub.id} className="bg-ag-bg border border-ag-border rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-white font-medium truncate max-w-[60%]">{sub.userName}</span>
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${sub.status === "pending" ? "bg-ag-amber/10 text-ag-amber" : sub.status === "accepted" ? "bg-ag-emerald/10 text-ag-emerald" : "bg-ag-danger/10 text-ag-danger"}`}>{sub.status}</span>
                  </div>
                  <p className="text-[10px] text-ag-text-dim truncate">{sub.userEmail}</p>
                  <a href={sub.link} target="_blank" rel="noopener noreferrer" className="text-xs text-ag-purple hover:underline truncate block">{sub.link}</a>
                  <p className="text-[10px] text-ag-text-dim">{new Date(sub.submittedAt).toLocaleString()}</p>
                  {sub.reason && <p className="text-[10px] text-ag-danger">Reason: {sub.reason}</p>}

                  {sub.status === "pending" && (
                    <div className="flex gap-2 pt-1">
                      <button onClick={() => handleAccept(sub.id)} disabled={adminActioning === sub.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-ag-emerald/10 text-ag-emerald border border-ag-emerald/20 rounded-lg text-xs font-bold hover:bg-ag-emerald/20 transition-colors disabled:opacity-40 disabled:cursor-wait">
                        <ThumbsUp className="w-3.5 h-3.5" />{adminActioning === sub.id ? "..." : "Accept"}
                      </button>
                      <button onClick={() => handleDecline(sub.id)} disabled={adminActioning === sub.id}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-ag-danger/10 text-ag-danger border border-ag-danger/20 rounded-lg text-xs font-bold hover:bg-ag-danger/20 transition-colors disabled:opacity-40 disabled:cursor-wait">
                        <ThumbsDown className="w-3.5 h-3.5" />{adminActioning === sub.id ? "..." : "Decline"}
                      </button>
                      <button onDoubleClick={() => setTimeoutPopup(sub.id)} disabled={!!adminActioning}
                        className="flex items-center justify-center gap-1 px-3 py-2 bg-ag-amber/10 text-ag-amber border border-ag-amber/20 rounded-lg text-xs font-bold hover:bg-ag-amber/20 transition-colors disabled:opacity-40" title="Double-click to timeout">
                        <Timer className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-ag-border"><p className="text-[10px] text-ag-text-dim text-center">Shift + A to toggle · Double-click ⏱ for timeout</p></div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Timeout popup */}
      <AnimatePresence>
        {timeoutPopup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[400] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setTimeoutPopup(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()}
              className="bg-ag-card border border-ag-border rounded-2xl p-6 w-full max-w-sm mx-4 shadow-2xl">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Timer className="w-5 h-5 text-ag-amber" />Timeout User</h3>
              <div className="space-y-3">
                <div><label className="text-xs text-ag-text-dim block mb-1">Duration (hours, minimum 9)</label><input type="number" min="9" value={timeoutHours} onChange={(e) => setTimeoutHours(e.target.value)} className="w-full bg-ag-bg border border-ag-border rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-ag-purple/50" /></div>
                <div><label className="text-xs text-ag-text-dim block mb-1">Reason (required)</label><textarea value={timeoutReason} onChange={(e) => setTimeoutReason(e.target.value)} rows={3} placeholder="Explain why..." className="w-full bg-ag-bg border border-ag-border rounded-lg px-3 py-2 text-sm text-white placeholder-ag-text-dim focus:outline-none focus:border-ag-purple/50 resize-none" /></div>
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setTimeoutPopup(null)} className="flex-1 py-2 text-sm text-ag-text-dim border border-ag-border rounded-lg hover:bg-white/5 transition-colors">Cancel</button>
                  <button onClick={() => handleTimeoutConfirm(timeoutPopup)} className="flex-1 py-2 text-sm font-bold bg-ag-amber/10 text-ag-amber border border-ag-amber/20 rounded-lg hover:bg-ag-amber/20 transition-colors">Confirm Timeout</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
