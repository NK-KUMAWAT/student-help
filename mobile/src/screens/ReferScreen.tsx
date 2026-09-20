import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Mail,
  MessageCircle,
  ShieldCheck,
  Trophy,
  UsersRound,
  Wallet,
  X,
} from "lucide-react-native";
import * as Clipboard from "expo-clipboard";
import React, { useState } from "react";
import { Linking, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";
import { queryKeys, referralsApi } from "../api";
import { AppHeader } from "../components/AppHeader";
import { AppButton, Avatar, EmptyState, Eyebrow, Panel, Screen, SectionHeading } from "../components/ui";
import { colors, radius, spacing } from "../theme";

const referralCode = "AARAV-PATH26";
const inviteLink = `https://pathfinder.app/join/${referralCode}`;

const fallbackRewards = [
  { id: "1", referredName: "Riya Kapoor", event: "completed sprint", amount: 100, status: "credited" as const, createdAt: "2026-09-08" },
  { id: "2", referredName: "Priya Mehta", event: "completed sprint", amount: 100, status: "credited" as const, createdAt: "2026-09-02" },
  { id: "3", referredName: "Dev Malhotra", event: "completed sprint", amount: 100, status: "credited" as const, createdAt: "2026-08-18" },
];

const fallbackLeaderboard = [
  { userId: "1", name: null, successfulReferrals: 12, totalEarned: 1200 },
  { userId: "2", name: null, successfulReferrals: 9, totalEarned: 900 },
  { userId: "3", name: null, successfulReferrals: 7, totalEarned: 700 },
];

const dateLabel = (value: string | number | Date) =>
  new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function ReferScreen() {
  const queryClient = useQueryClient();
  const [withdrawalRequested, setWithdrawalRequested] = useState(false);
  const [copied, setCopied] = useState(false);
  const [upiInput, setUpiInput] = useState("");

  const { data: referralData } = useQuery({
    queryKey: queryKeys.referralsDashboard,
    queryFn: referralsApi.dashboard,
  });

  const verifyUpi = useMutation({
    mutationFn: referralsApi.verifyUpi,
    onSuccess: async () => {
      setUpiInput("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.referralsDashboard });
      Toast.show({ type: "success", text1: "UPI ID verified. You can now request a withdrawal." });
    },
    onError: (error: unknown) =>
      Toast.show({ type: "error", text1: error instanceof Error ? error.message : "Could not verify UPI ID." }),
  });

  const requestWithdrawal = useMutation({
    mutationFn: referralsApi.requestWithdrawal,
    onSuccess: async () => {
      setWithdrawalRequested(true);
      await queryClient.invalidateQueries({ queryKey: queryKeys.referralsDashboard });
      Toast.show({ type: "success", text1: "Withdrawal request submitted for review." });
    },
    onError: (error: unknown) =>
      Toast.show({ type: "error", text1: error instanceof Error ? error.message : "Could not submit withdrawal request." }),
  });

  const copyLink = async () => {
    await Clipboard.setStringAsync(inviteLink);
    setCopied(true);
    Toast.show({ type: "success", text1: "Referral link copied." });
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () =>
    Linking.openURL(
      `https://wa.me/?text=${encodeURIComponent(`Join me on Pathfinder and get your career roadmap: ${inviteLink}`)}`,
    ).catch(() => Toast.show({ type: "error", text1: "Could not open WhatsApp." }));

  const shareEmail = () =>
    Linking.openURL(
      `mailto:?subject=${encodeURIComponent("Your Pathfinder career invite")}&body=${encodeURIComponent(`I think Pathfinder can help with your placement prep. Join here: ${inviteLink}`)}`,
    ).catch(() => Toast.show({ type: "error", text1: "Could not open the mail app." }));

  const shareNative = () =>
    Share.share({ message: `Join me on Pathfinder and get your career roadmap: ${inviteLink}` }).catch(() => {});

  const rewards = referralData?.rewards?.length ? referralData.rewards : fallbackRewards;
  const leaderboard = referralData?.leaderboard?.length ? referralData.leaderboard : fallbackLeaderboard;
  const verifiedUpi = referralData?.upiVerification?.status === "verified" ? referralData.upiVerification : null;
  const monthLabel = referralData?.monthLabel || "this month";

  const creditedTotal = rewards.filter(i => i.status === "credited").reduce((sum, i) => sum + i.amount, 0);
  const pendingTotal = rewards.filter(i => i.status === "pending").reduce((sum, i) => sum + i.amount, 0);

  const historyRows = [
    ...rewards.map(item => ({
      id: `reward-${item.id}`,
      title: `${item.referredName} ${item.event}`,
      subtitle: "Referral reward",
      date: item.createdAt,
      amount: `+₹${item.amount}`,
      status: item.status === "credited" ? "Credited" : "Pending",
    })),
    ...(referralData?.withdrawals || []).map(item => ({
      id: `withdrawal-${item.id}`,
      title: "Withdrawal request",
      subtitle: item.payoutMethod,
      date: item.createdAt,
      amount: `−₹${item.amount}`,
      status: item.status === "paid" ? "Paid" : "Processing",
    })),
  ];

  const canWithdraw = Boolean(verifiedUpi) && !withdrawalRequested && !requestWithdrawal.isPending;

  return (
    <Screen contentStyle={styles.content}>
      <AppHeader title="Refer & Earn" />
      <Eyebrow green>COMMUNITY GROWTH</Eyebrow>
      <Text style={styles.h1}>Help a friend find their path.</Text>
      <Text style={styles.copy}>Invite classmates to Pathfinder, track every reward, and see how your community is growing.</Text>

      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>REFER & EARN</Text>
        <Text style={styles.heroTitle}>₹100 for every friend{"\n"}who gets interview-ready.</Text>
        <Text style={styles.heroCopy}>Your friend gets a 14-day Pro pass. You earn wallet credit after their first completed sprint.</Text>
        <View style={styles.inviteRow}>
          <Text style={styles.inviteLink} numberOfLines={1}>{inviteLink}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={copyLink}>
            <Copy size={13} color={colors.primaryForeground} />
            <Text style={styles.copyButtonText}>{copied ? "Copied" : "Copy"}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.shareRow}>
          <TouchableOpacity style={[styles.shareButton, styles.shareWhatsApp]} onPress={shareWhatsApp}>
            <MessageCircle size={14} color="#fff" />
            <Text style={styles.shareButtonText}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.shareButton, styles.shareEmail]} onPress={shareEmail}>
            <Mail size={14} color={colors.primary} />
            <Text style={[styles.shareButtonText, { color: colors.primary }]}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.shareButton, styles.shareMore]} onPress={shareNative}>
            <UsersRound size={14} color={colors.primary} />
            <Text style={[styles.shareButtonText, { color: colors.primary }]}>More</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Total earned</Text>
          <Text style={styles.statValue}>₹{creditedTotal || 300}</Text>
          <Text style={styles.statFoot}>₹{Math.max(0, (creditedTotal || 300) - 100)} available to withdraw</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Successful referrals</Text>
          <Text style={styles.statValue}>{rewards.filter(i => i.status === "credited").length || 3}</Text>
          <Text style={styles.statFoot}>{rewards.length > 2 ? "This month" : "Keep inviting"}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Pending rewards</Text>
          <Text style={styles.statValue}>₹{pendingTotal || 100}</Text>
          <Text style={styles.statFoot}>1 friend in progress</Text>
        </View>
      </View>

      {/* How it works */}
      <Panel style={styles.panelGap}>
        <SectionHeading eyebrow="HOW IT WORKS" title="Three steps, one good nudge" />
        {[
          ["01", "Share your invite", "Send your personal link to a classmate or friend."],
          ["02", "They start their sprint", "Your friend gets a 14-day Pro pass to begin."],
          ["03", "You earn wallet credit", "₹100 lands after their first completed sprint."],
        ].map(([num, title, text]) => (
          <View key={num} style={styles.stepRow}>
            <Text style={styles.stepNum}>{num}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.stepTitle}>{title}</Text>
              <Text style={styles.stepText}>{text}</Text>
            </View>
          </View>
        ))}
      </Panel>

      {/* UPI verification + withdrawal */}
      <Panel style={styles.panelGap}>
        <View style={styles.upiCard}>
          <View style={{ flex: 1 }}>
            <Eyebrow green>WITHDRAWAL SECURITY</Eyebrow>
            <Text style={styles.upiTitle}>{verifiedUpi ? "UPI ID verified" : "Verify your UPI ID first"}</Text>
            <Text style={styles.upiSub}>
              {verifiedUpi ? verifiedUpi.upiId : "We verify the ID format before enabling withdrawals."}
            </Text>
          </View>
          {verifiedUpi ? (
            <View style={styles.verifiedPill}>
              <Check size={11} color="#1c6b4c" />
              <Text style={styles.verifiedPillText}>Verified</Text>
            </View>
          ) : null}
        </View>
        {!verifiedUpi ? (
          <View style={styles.upiInputRow}>
            <TextInput
              value={upiInput}
              onChangeText={setUpiInput}
              placeholder="name@bank"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.upiInput}
              accessibilityLabel="UPI ID"
            />
            <AppButton
              label={verifyUpi.isPending ? "Checking…" : "Verify UPI"}
              onPress={() => verifyUpi.mutate({ upiId: upiInput.trim() })}
              disabled={!upiInput.trim()}
              loading={verifyUpi.isPending}
              small
            />
          </View>
        ) : null}
        <AppButton
          label={
            withdrawalRequested
              ? "Withdrawal request pending"
              : requestWithdrawal.isPending
                ? "Submitting request…"
                : "Request withdrawal · ₹200"
          }
          variant="dark"
          icon={<Wallet size={15} color={colors.primaryForeground} />}
          disabled={!canWithdraw}
          loading={requestWithdrawal.isPending}
          onPress={() =>
            verifiedUpi &&
            requestWithdrawal.mutate({ amount: 200, payoutMethod: verifiedUpi.upiId || "UPI", upiVerificationId: verifiedUpi.id })
          }
          style={styles.withdrawButton}
        />
      </Panel>

      {/* Reward history */}
      <Panel style={styles.panelGap}>
        <SectionHeading eyebrow="REWARD HISTORY" title="Every earning, in one place" />
        {historyRows.length ? (
          historyRows.slice(0, 8).map(row => (
            <View key={row.id} style={styles.historyRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.historyTitle} numberOfLines={1}>{row.title}</Text>
                <Text style={styles.historySub}>{row.subtitle} · {dateLabel(row.date)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={styles.historyAmount}>{row.amount}</Text>
                <Text style={[styles.historyStatus, row.status === "Credited" || row.status === "Paid" ? styles.statusPositive : styles.statusPending]}>
                  {row.status}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <EmptyState
            icon={<Wallet size={18} color={colors.textMuted} />}
            title="No reward activity yet"
            body="Share your link to get started."
          />
        )}
      </Panel>

      {/* Leaderboard */}
      <Panel style={styles.panelGap}>
        <SectionHeading eyebrow="COMMUNITY LEADERBOARD" title={`Top referrers · ${monthLabel}`} />
        <View style={styles.leaderCallout}>
          <Trophy size={16} color={colors.amber} />
          <Text style={styles.leaderCalloutText}>
            Invite 2 more friends to reach <Text style={{ fontWeight: "800" }}>Campus Champion</Text>
          </Text>
        </View>
        {leaderboard.slice(0, 3).map((leader, index) => (
          <View key={leader.userId} style={[styles.leaderRow, index === 0 && styles.leaderRowTop]}>
            <Text style={styles.leaderRank}>0{index + 1}</Text>
            <Avatar name={leader.name || `R${leader.userId}`} size={30} color={index === 1 ? "#bfd7ec" : index === 2 ? "#ecc9dc" : undefined} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.leaderName} numberOfLines={1}>{leader.name || `Referrer #${leader.userId}`}</Text>
              <Text style={styles.leaderSub}>{leader.successfulReferrals} successful referrals</Text>
            </View>
            <Text style={styles.leaderAmount}>₹{leader.totalEarned}</Text>
          </View>
        ))}
        <View style={[styles.leaderRow, styles.leaderRowYou]}>
          <Text style={styles.leaderRank}>—</Text>
          <Avatar name="You" size={30} />
          <View style={{ flex: 1 }}>
            <Text style={styles.leaderName}>You</Text>
            <Text style={styles.leaderSub}>{rewards.filter(i => i.status === "credited").length || 3} successful referrals</Text>
          </View>
          <Text style={styles.leaderAmount}>₹{creditedTotal || 300}</Text>
        </View>
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md },
  h1: { fontSize: 24, fontWeight: "800", color: colors.heading, letterSpacing: -0.8, marginBottom: 6 },
  copy: { fontSize: 12, color: colors.mutedForeground, lineHeight: 18, marginBottom: spacing.lg },
  panelGap: { marginTop: spacing.md },

  hero: {
    backgroundColor: colors.sidebar,
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
  heroEyebrow: { fontSize: 9, fontWeight: "800", letterSpacing: 1.4, color: "#8ac6a6", marginBottom: 12 },
  heroTitle: { fontSize: 21, fontWeight: "800", color: "#f0fbf5", letterSpacing: -0.7, lineHeight: 26, marginBottom: 8 },
  heroCopy: { fontSize: 11, color: "#86a49b", lineHeight: 17, marginBottom: 16 },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(186,238,205,0.18)",
    borderRadius: radius.sm,
    paddingLeft: spacing.md,
    paddingRight: 6,
    paddingVertical: 6,
  },
  inviteLink: { flex: 1, fontSize: 11, color: "#d6f9e4" },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#1a7055",
    borderRadius: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  copyButtonText: { fontSize: 10, fontWeight: "800", color: colors.primaryForeground },
  shareRow: { flexDirection: "row", gap: 8, marginTop: spacing.md },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  shareWhatsApp: { backgroundColor: "#25d366" },
  shareEmail: { backgroundColor: "#e9f5ee" },
  shareMore: { backgroundColor: "#e9f5ee" },
  shareButtonText: { fontSize: 11, fontWeight: "800", color: "#fff" },

  statsRow: { flexDirection: "row", gap: 10, marginTop: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  statLabel: { fontSize: 9, fontWeight: "700", color: colors.textMuted, marginBottom: 8 },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.heading },
  statFoot: { fontSize: 8, color: colors.textSubtle, marginTop: 4 },

  stepRow: { flexDirection: "row", gap: spacing.md, paddingVertical: 9 },
  stepNum: { fontSize: 12, fontWeight: "800", color: "#8ac6a6", width: 24 },
  stepTitle: { fontSize: 12, fontWeight: "800", color: colors.heading },
  stepText: { fontSize: 10, color: colors.textMuted, marginTop: 3, lineHeight: 15 },

  upiCard: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, marginBottom: spacing.md },
  upiTitle: { fontSize: 13, fontWeight: "800", color: colors.heading },
  upiSub: { fontSize: 10, color: colors.textMuted, marginTop: 4, lineHeight: 15 },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ddf4e9",
    borderRadius: 99,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  verifiedPillText: { fontSize: 9, fontWeight: "800", color: "#1c6b4c" },
  upiInputRow: { flexDirection: "row", gap: 8, marginBottom: spacing.md },
  upiInput: {
    flex: 1,
    height: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    fontSize: 13,
    color: colors.foreground,
  },
  withdrawButton: { width: "100%" },

  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f3f1",
  },
  historyTitle: { fontSize: 12, fontWeight: "800", color: colors.heading },
  historySub: { fontSize: 10, color: colors.textMuted, marginTop: 3 },
  historyAmount: { fontSize: 13, fontWeight: "800", color: colors.heading },
  historyStatus: { fontSize: 9, fontWeight: "800", marginTop: 3 },
  statusPositive: { color: "#1c6b4c" },
  statusPending: { color: "#9a6b2a" },

  leaderCallout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fbf4e8",
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  leaderCalloutText: { flex: 1, fontSize: 11, color: "#6b5a3d" },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f3f1",
  },
  leaderRowTop: { backgroundColor: "#f7fbf8" },
  leaderRowYou: { borderBottomWidth: 0, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 6 },
  leaderRank: { width: 20, fontSize: 11, fontWeight: "800", color: colors.textMuted },
  leaderName: { fontSize: 12, fontWeight: "800", color: colors.heading },
  leaderSub: { fontSize: 9, color: colors.textMuted, marginTop: 2 },
  leaderAmount: { fontSize: 13, fontWeight: "800", color: colors.heading },
});
