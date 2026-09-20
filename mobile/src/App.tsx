import { NavigationContainer } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast, { BaseToast, ErrorToast, type ToastConfig } from "react-native-toast-message";
import { setOnSessionExpired } from "./api/client";
import { queryKeys } from "./api";
import RootNavigator from "./navigation/RootNavigator";
import { AppDataProvider } from "./state/AppData";
import { colors } from "./theme";

const queryClient = new QueryClient();

const toastConfig: ToastConfig = {
  success: props => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: colors.greenBright, borderLeftWidth: 5 }}
      contentContainerStyle={{ paddingHorizontal: 14 }}
      text1Style={{ fontSize: 12, fontWeight: "800", color: colors.heading }}
      text2Style={{ fontSize: 11, color: colors.textMuted }}
    />
  ),
  error: props => (
    <ErrorToast
      {...props}
      style={{ borderLeftColor: colors.danger, borderLeftWidth: 5 }}
      text1Style={{ fontSize: 12, fontWeight: "800", color: colors.heading }}
      text2Style={{ fontSize: 11, color: colors.textMuted }}
    />
  ),
  info: props => (
    <BaseToast
      {...props}
      style={{ borderLeftColor: colors.blue, borderLeftWidth: 5 }}
      contentContainerStyle={{ paddingHorizontal: 14 }}
      text1Style={{ fontSize: 12, fontWeight: "800", color: colors.heading }}
      text2Style={{ fontSize: 11, color: colors.textMuted }}
    />
  ),
};

export default function App() {
  useEffect(() => {
    // When any request returns 401 the session token is already cleared by the
    // client interceptor — flip the auth cache to signed-out so the navigator
    // swaps back to the login screen.
    setOnSessionExpired(() => {
      queryClient.setQueryData(queryKeys.authMe, null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.authMe });
    });
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppDataProvider>
          <NavigationContainer>
            <StatusBar style="dark" backgroundColor={colors.background} />
            <RootNavigator />
          </NavigationContainer>
          <Toast config={toastConfig} topOffset={12} />
        </AppDataProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
