import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  LayoutDashboard,
  Target,
  UserRound,
} from "lucide-react-native";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { BrandMark } from "../components/ui";
import { useAuth } from "../hooks/useAuth";
import AdminWithdrawalsScreen from "../screens/AdminWithdrawalsScreen";
import AuthScreen from "../screens/AuthScreen";
import HelpCenterScreen from "../screens/HelpCenterScreen";
import NotificationsScreen from "../screens/NotificationsScreen";
import OverviewScreen from "../screens/OverviewScreen";
import PracticeScreen from "../screens/PracticeScreen";
import ProfileScreen from "../screens/ProfileScreen";
import RoadmapScreen from "../screens/RoadmapScreen";
import { colors } from "../theme";
import type { RootStackParamList, TabParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const TAB_ICONS: Record<keyof TabParamList, React.ComponentType<{ size?: number; color?: string }>> = {
  Overview: LayoutDashboard,
  Roadmap: Target,
  Profile: UserRound,
};

const TAB_LABELS: Record<keyof TabParamList, string> = {
  Overview: "Overview",
  Roadmap: "Roadmap",
  Profile: "Profile",
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: "#9ab4ab",
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ color, size }) => {
          const Icon = TAB_ICONS[route.name];
          return <Icon size={20} color={color} />;
        },
        tabBarLabel: TAB_LABELS[route.name],
      })}
    >
      <Tabs.Screen name="Overview" component={OverviewScreen} />
      <Tabs.Screen name="Roadmap" component={RoadmapScreen} />
      <Tabs.Screen name="Profile" component={ProfileScreen} />
    </Tabs.Navigator>
  );
}

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <BrandMark size={52} />
      <View style={{ alignItems: "center" }}>
        <Text style={styles.splashTitle}>Opening your workspace</Text>
        <Text style={styles.splashSub}>Checking your account securely…</Text>
      </View>
      <ActivityIndicator color={colors.green} />
    </View>
  );
}

export default function RootNavigator() {
  const { user, loading } = useAuth();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {loading ? (
        <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: "none" }} />
      ) : !user ? (
        <Stack.Screen name="Auth" component={AuthScreen} options={{ animation: "fade" }} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} options={{ animation: "fade" }} />
          <Stack.Screen name="Practice" component={PracticeScreen} />
          <Stack.Screen
            name="AdminWithdrawals"
            component={AdminWithdrawalsScreen}
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="HelpCenter"
            component={HelpCenterScreen}
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="Notifications"
            component={NotificationsScreen}
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: colors.sidebar,
    borderTopColor: "rgba(186,238,205,0.13)",
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
  },
  tabLabel: { fontSize: 9, fontWeight: "700" },
  splash: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  splashTitle: { fontSize: 15, fontWeight: "800", color: colors.heading },
  splashSub: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
});
