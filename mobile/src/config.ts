import Constants from "expo-constants";
import { Platform } from "react-native";

/**
 * API base URL resolution order:
 *  1. app.json -> expo.extra.apiUrl
 *  2. EXPO_PUBLIC_API_URL env var (mobile/.env or eas.json env)
 *  3. In dev, the host of the Expo dev server (works for physical devices on LAN)
 *  4. Platform emulator fallbacks (Android emulator: 10.0.2.2)
 *  5. Production placeholder (must be configured before release)
 */
function resolveApiUrl(): string {
  const extraUrl = Constants.expoConfig?.extra?.apiUrl;
  if (typeof extraUrl === "string" && extraUrl.trim()) {
    return extraUrl.trim().replace(/\/+$/, "");
  }

  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "");
  }

  if (__DEV__) {
    // Constants.expoConfig.hostUri looks like "192.168.1.5:8081" when running
    // through Expo dev tools — pointing the app at the same host hits the API
    // server running on the dev machine.
    const host = Constants.expoConfig?.hostUri?.split(":")[0];
    if (host) return `http://${host}:3001`;
    return Platform.select({
      android: "http://10.0.2.2:3001",
      default: "http://localhost:3001",
    }) as string;
  }

  // Fallback for release builds that forgot to configure an API URL.
  return "https://api.your-domain.com";
}

export const API_URL = resolveApiUrl();
