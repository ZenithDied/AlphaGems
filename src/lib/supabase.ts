import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tvjetjqxywwsostrfcix.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_6u_KKtn-SycwuhikhozmKQ_upmOlRgn";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

/* ── Profiles ── */
export async function getMyProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user?.id) throw new Error("No authenticated user found.");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url, gems, created_at, updated_at")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return data;
}

export async function getProfileById(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, display_name, avatar_url, gems, created_at, updated_at")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

export async function updateProfileGems(userId: string, nextGems: number) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ gems: nextGems, updated_at: new Date().toISOString() })
    .eq("id", userId)
    .select("id, gems")
    .single();

  if (error) throw error;
  return data;
}

/* ── Auth ── */
export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin, skipBrowserRedirect: false },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/* ── Mega Quests ── */
export async function submitMegaQuest(tiktokUrl: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.id) {
    throw new Error("No authenticated user found for mega quest submission.");
  }

  // Only check pending submissions for the current user
  const { data: existing, error: existingError } = await supabase
    .from("mega_quests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .limit(1);

  if (existingError) throw existingError;

  if (existing && existing.length > 0) {
    throw new Error("You already have a pending submission. Wait for it to be reviewed.");
  }

  const payload = {
    user_id: user.id,
    tiktok_url: tiktokUrl,
    status: "pending",
  };

  console.log("Data being sent:", payload);

  const { data, error } = await supabase
    .from("mega_quests")
    .insert(payload)
    .select("id, user_id, tiktok_url, status, decline_reason, timeout_until, submitted_at, reviewed_at")
    .single();

  if (error) throw error;

  return {
    ...data,
    link: data.tiktok_url,
  };
}

export async function getMySubmissions() {
  const { data, error } = await supabase
    .from("mega_quests")
    .select("id, user_id, tiktok_url, status, decline_reason, timeout_until, submitted_at, reviewed_at")
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    link: row.tiktok_url,
  }));
}

export async function getAllSubmissions() {
  const { data, error } = await supabase
    .from("mega_quests")
    .select("id, user_id, tiktok_url, status, decline_reason, timeout_until, submitted_at, reviewed_at")
    .order("submitted_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    ...row,
    link: row.tiktok_url,
  }));
}

/* ── Admin actions (server-side via direct table updates) ── */
export async function adminAcceptSubmission(submissionId: string, userId: string) {
  // Update submission status
  const { error: subErr } = await supabase
    .from("mega_quests")
    .update({ status: "accepted", reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);
  if (subErr) throw subErr;

  // Increment gems in profiles table
  const profile = await getProfileById(userId);
  const currentGems = typeof profile.gems === "number" ? profile.gems : 0;
  await updateProfileGems(userId, currentGems + 200);

  // Audit trail in gem_transactions
  const { error: txErr } = await supabase
    .from("gem_transactions")
    .insert({ user_id: userId, amount: 200, reason: "Mega Quest Approval", source_type: "quest", source_id: submissionId });
  if (txErr) throw txErr;

  // User notification
  const { error: notifErr } = await supabase
    .from("notifications")
    .insert({ user_id: userId, title: "TikTok Approved! 🎉", message: "Your video was verified! 200 Gems have been credited.", type: "success" });
  if (notifErr) throw notifErr;
}

export async function adminDeclineSubmission(submissionId: string, userId: string) {
  const { error: subErr } = await supabase
    .from("mega_quests")
    .update({ status: "declined", decline_reason: "Your submission did not meet the requirements. You can retry in 8 hours.", reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);
  if (subErr) throw subErr;

  const { error: notifErr } = await supabase
    .from("notifications")
    .insert({ user_id: userId, title: "Submission Declined", message: "Your TikTok did not meet requirements. You can retry in 8 hours.", type: "error" });
  if (notifErr) throw notifErr;
}

export async function adminTimeoutSubmission(submissionId: string, userId: string, hours: number, reason: string) {
  const timeoutUntil = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  const msg = `Declined for ${hours}h. Reason: "${reason}". Contact support@alphagems.dev if this is an error.`;

  const { error: subErr } = await supabase
    .from("mega_quests")
    .update({ status: "timed_out", decline_reason: msg, timeout_until: timeoutUntil, reviewed_at: new Date().toISOString() })
    .eq("id", submissionId);
  if (subErr) throw subErr;

  const { error: notifErr } = await supabase
    .from("notifications")
    .insert({ user_id: userId, title: "Submission Timed Out", message: msg, type: "error" });
  if (notifErr) throw notifErr;
}

/* ── Gem Transactions ── */
export async function getMyTransactions() {
  const { data, error } = await supabase
    .from("gem_transactions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

/* ── Notifications ── */
export async function getMyNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

export async function markAllNotificationsRead() {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("read", false);
  if (error) throw error;
}

export async function getUnreadNotifCount() {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("read", false);
  if (error) return 0;
  return count || 0;
}

/* ── Stats ── */
export async function getTotalGemsDistributed() {
  const { data, error } = await supabase
    .from("gem_transactions")
    .select("amount")
    .gt("amount", 0);
  if (error) return 0;
  return (data || []).reduce((sum: number, t: { amount: number }) => sum + t.amount, 0);
}
