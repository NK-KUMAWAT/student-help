import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ShieldCheck, Sparkles, Wallet, X } from "lucide-react-native";
import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import Toast from "react-native-toast-message";
import { adminApi, queryKeys } from "../api";
import type { AdminWithdrawalRow } from "../api/types";
import { AppHeader } from "../components/AppHeader";
import { AppButton, Avatar, EmptyState, Eyebrow, Panel, Screen, StatusChip } from "../components/ui";
import { colors, radius, spacing } from "../theme";

const formatDate = (value: string | number | Date) =>
  new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const statusTone: Record<AdminWithdrawalRow["status"], "green" | "blue" | "amber" | "pink"> = {
  requested: "amber",
  processing: "blue",
  paid: "green",
  rejected: "pink",
};

export default function AdminWithdrawalsScreen() {
  const queryClient = useQueryClient();
  const { data: requests, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.adminWithdrawals,
    queryFn: adminApi.withdrawals,
  });

  const reviewMutation = useMutation({
    mutationFn: adminApi.updateWithdrawal,
    onSuccess: async result => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.adminWithdrawals });
      Toast.show({ type: "success", text1: `Request marked ${result.status}.` });
    },
    onError: (error: unknown) =>
      Toast.show({ type: "error", text1: error instanceof Error ? error.message : "Could not update withdrawal." }),
  });

  const rows = requests || [];
  const pendingCount = rows.filter(r => r.status === "requested" || r.status === "processing").length;
  const totalPending = rows
    .filter(r => r.status === "requested" || r.status === "processing")
    .reduce((sum, r) => sum + r.amount, 0);
  const paidCount = rows.filter(r => r.status === "paid").length;

  return (
    <Screen
      contentStyle={styles.content}
      refreshing={isLoading}
      onRefresh={() => void refetch()}
    >
      <AppHeader title="Admin withdrawals" />
      <Eyebrow green>ADMIN CONSOLE</Eyebrow>
      <Text style={styles.h1}>Withdrawal approvals.</Text>
      <Text style={styles.copy}>Review verified UPI requests before rewards leave the Pathfinder wallet.</Text>

      <View style={styles.metrics}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Needs review</Text>
          <Text style={styles.metricValue}>{pendingCount}</Text>
          <Text style={styles.metricFoot}>requests in queue</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Pending value</Text>
          <Text style={styles.metricValue}>₹{totalPending}</Text>
          <Text style={styles.metricFoot}>requested or processing</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Verified payouts</Text>
          <Text style={styles.metricValue}>{paidCount}</Text>
          <Text style={styles.metricFoot}>completed withdrawals</Text>
        </View>
      </View>

      <Panel style={{ marginTop: spacing.md }}>
        <View style={styles.panelHeading}>
          <View>
            <Eyebrow>WITHDRAWAL QUEUE</Eyebrow>
            <Text style={styles.panelTitle}>Review all requests</Text>
          </View>
          <Text style={styles.panelNote}>UPI verification required</Text>
        </View>

        {isLoading ? (
          <EmptyState icon={<Sparkles size={18} color={colors.green} />} title="Loading withdrawal requests…" />
        ) : error ? (
          <EmptyState icon={<ShieldCheck size={18} color={colors.danger} />} title={error.message} />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Wallet size={20} color={colors.textMuted} />}
            title="No withdrawal requests yet"
            body="New requests will appear here after a student verifies their UPI ID."
          />
        ) : (
          rows.map(request => (
            <View key={request.id} style={styles.requestRow}>
              <View style={styles.requestTop}>
                <Avatar name={request.userName || "U"} size={32} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.requestName} numberOfLines={1}>{request.userName || "Unnamed student"}</Text>
                  <Text style={styles.requestEmail} numberOfLines={1}>{request.userEmail || "No email provided"}</Text>
                </View>
                <StatusChip label={request.status} tone={statusTone[request.status]} />
              </View>
              <View style={styles.requestDetails}>
                <View style={styles.detail}>
                  <Text style={styles.detailLabel}>AMOUNT</Text>
                  <Text style={styles.detailValue}>₹{request.amount}</Text>
                </View>
                <View style={styles.detail}>
                  <Text style={styles.detailLabel}>VERIFIED UPI</Text>
                  <Text style={styles.detailValue} numberOfLines={1}>{request.upiId || request.payoutMethod}</Text>
                </View>
                <View style={styles.detail}>
                  <Text style={styles.detailLabel}>REQUESTED</Text>
                  <Text style={styles.detailValue}>{formatDate(request.createdAt)}</Text>
                </View>
              </View>
              <View style={styles.requestActions}>
                {request.status === "requested" ? (
                  <AppButton
                    label="Approve"
                    small
                    icon={<Check size={13} color={colors.primaryForeground} />}
                    disabled={reviewMutation.isPending}
                    onPress={() => reviewMutation.mutate({ id: request.id, status: "processing" })}
                  />
                ) : null}
                {request.status === "processing" ? (
                  <AppButton
                    label="Mark paid"
                    small
                    icon={<Check size={13} color={colors.primaryForeground} />}
                    disabled={reviewMutation.isPending}
                    onPress={() => reviewMutation.mutate({ id: request.id, status: "paid" })}
                  />
                ) : null}
                {request.status === "requested" || request.status === "processing" ? (
                  <AppButton
                    label="Reject"
                    small
                    variant="danger"
                    icon={<X size={13} color={colors.danger} />}
                    disabled={reviewMutation.isPending}
                    onPress={() => reviewMutation.mutate({ id: request.id, status: "rejected" })}
                  />
                ) : null}
              </View>
            </View>
          ))
        )}
      </Panel>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingTop: spacing.md },
  h1: { fontSize: 24, fontWeight: "800", color: colors.heading, letterSpacing: -0.8, marginBottom: 6 },
  copy: { fontSize: 12, color: colors.mutedForeground, lineHeight: 18, marginBottom: spacing.lg },

  metrics: { flexDirection: "row", gap: 10 },
  metric: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  metricLabel: { fontSize: 9, fontWeight: "700", color: colors.textMuted, marginBottom: 8 },
  metricValue: { fontSize: 18, fontWeight: "800", color: colors.heading },
  metricFoot: { fontSize: 8, color: colors.textSubtle, marginTop: 4 },

  panelHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: spacing.md },
  panelTitle: { fontSize: 15, fontWeight: "800", color: colors.heading },
  panelNote: { fontSize: 9, fontWeight: "700", color: colors.textMuted },

  requestRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: 10,
    backgroundColor: "#fbfdfc",
  },
  requestTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: spacing.md },
  requestName: { fontSize: 12, fontWeight: "800", color: colors.heading },
  requestEmail: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  requestDetails: { flexDirection: "row", gap: spacing.lg, marginBottom: spacing.md },
  detail: { flex: 1 },
  detailLabel: { fontSize: 8, fontWeight: "800", letterSpacing: 0.8, color: colors.textSubtle, marginBottom: 3 },
  detailValue: { fontSize: 12, fontWeight: "800", color: colors.heading },
  requestActions: { flexDirection: "row", gap: 8 },
});
