import { Upload } from "lucide-react-native";
import React from "react";
import { StyleSheet } from "react-native";
import { useAppData } from "../state/AppData";
import { colors } from "../theme";
import { AppButton, EmptyState } from "./ui";

/**
 * Shared "upload your resume to unlock this section" state used by
 * Roadmap, Matches and Practice — same behaviour as the web app.
 */
export function LockedState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  const { uploadResume, isExtracting } = useAppData();
  return (
    <EmptyState
      icon={icon}
      title={title}
      body={body}
      action={
        <AppButton
          label={isExtracting ? "Analyzing resume…" : "Upload resume"}
          onPress={uploadResume}
          loading={isExtracting}
          icon={<Upload size={15} color={colors.primaryForeground} />}
          style={styles.button}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  button: { marginTop: 8 },
});
