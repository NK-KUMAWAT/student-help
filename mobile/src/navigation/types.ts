import type { NavigatorScreenParams } from "@react-navigation/native";

export type TabParamList = {
  Overview: undefined;
  Roadmap: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Main: NavigatorScreenParams<TabParamList> | undefined;
  Practice: undefined;
  AdminWithdrawals: undefined;
  HelpCenter: undefined;
  Notifications: undefined;
};
