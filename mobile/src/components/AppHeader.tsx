import { Bell, LifeBuoy, LogOut } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Toast from "react-native-toast-message";
import { useAuth } from "../hooks/useAuth";
import { useAppData } from "../state/AppData";
import { colors } from "../theme";
import { Avatar, BrandMark, IconButton } from "./ui";
import type { RootStackParamList } from "../navigation/types";

export function AppHeader({ title }: { title: string }) {
  const { user, logout } = useAuth();
  const { hasUnreadNotifications } = useAppData();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const handleLogout = async () => {
    try {
      await logout();
      Toast.show({ type: "success", text1: "You're logged out safely." });
    } catch (error) {
      Toast.show({ type: "error", text1: error instanceof Error ? error.message : "Could not log out. Please try again." });
    }
  };

  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <BrandMark size={26} />
        <View style={{ flex: 1 }}>
          <Text style={styles.brand}>student care help</Text>
          <Text style={styles.crumb} numberOfLines={1}>
            Workspace · <Text style={styles.crumbStrong}>{title}</Text>
          </Text>
        </View>
      </View>
      <View style={styles.actions}>
        <IconButton
          accessibilityLabel="Help Center"
          onPress={() => navigation.navigate("HelpCenter")}
        >
          <LifeBuoy size={18} color="#6c7d76" />
        </IconButton>
        <IconButton
          accessibilityLabel="Notifications"
          badge={hasUnreadNotifications}
          onPress={() => navigation.navigate("Notifications")}
        >
          <Bell size={18} color="#6c7d76" />
        </IconButton>
        <TouchableOpacity onPress={() => navigation.navigate("Main", { screen: "Profile" })} accessibilityLabel="Open profile">
          <Avatar name={user?.name || "S"} size={30} />
        </TouchableOpacity>
        <IconButton accessibilityLabel="Log out" onPress={handleLogout}>
          <LogOut size={17} color="#6c7d76" />
        </IconButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#dcebe1",
    marginBottom: 16,
  },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 9, flex: 1, minWidth: 0 },
  brand: { fontSize: 14, fontWeight: "800", color: colors.heading, letterSpacing: -0.4 },
  crumb: { fontSize: 10, color: colors.textSubtle, marginTop: 1 },
  crumbStrong: { color: "#344640", fontWeight: "800" },
  actions: { flexDirection: "row", alignItems: "center", gap: 2 },
});
