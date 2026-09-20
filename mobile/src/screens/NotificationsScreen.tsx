import { Bell } from "lucide-react-native";
import React from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState, Eyebrow } from "../components/ui";
import { useAppData } from "../state/AppData";
import { colors, radius, spacing } from "../theme";

export default function NotificationsScreen() {
  const { notifications, markAllNotificationsRead, markNotificationRead } = useAppData();

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Eyebrow green>NOTIFICATIONS</Eyebrow>
          <Text style={styles.headerTitle}>Stay in the loop</Text>
        </View>
        <TouchableOpacity onPress={markAllNotificationsRead} hitSlop={8}>
          <Text style={styles.markAll}>Mark all read</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={notifications}
        keyExtractor={item => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            icon={<Bell size={20} color={colors.textMuted} />}
            title="No notifications yet"
            body="Upload your resume and activity will show up here."
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, item.read && styles.itemRead]}
            onPress={() => markNotificationRead(item.id)}
            activeOpacity={0.8}
          >
            <View style={[styles.dot, item.read && styles.dotRead]} />
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              <Text style={styles.itemBody}>{item.body}</Text>
              <Text style={styles.itemTime}>{item.time}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#345447" },
  markAll: { fontSize: 11, fontWeight: "800", color: "#3f8069" },
  list: { padding: spacing.lg },
  item: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#f7fcf8",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: 10,
  },
  itemRead: { backgroundColor: colors.card },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 99,
    backgroundColor: colors.mintDot,
    marginTop: 4,
  },
  dotRead: { backgroundColor: "#cbdad1" },
  itemTitle: { fontSize: 12, fontWeight: "800", color: "#3c594b" },
  itemBody: { fontSize: 11, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  itemTime: { fontSize: 9, color: "#a2b0a8", marginTop: 5 },
});
