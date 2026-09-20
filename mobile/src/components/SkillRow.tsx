import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Skill } from "../state/AppData";
import { toneColors } from "../theme";
import { ProgressBar } from "./ui";

export function SkillRow({ skill }: { skill: Skill }) {
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: toneColors[skill.tone] }]} />
      <Text style={styles.name} numberOfLines={1}>
        {skill.name}
      </Text>
      <View style={styles.track}>
        <ProgressBar value={skill.level} color={toneColors[skill.tone]} height={5} />
      </View>
      <Text style={styles.level}>{skill.level}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  dot: { width: 8, height: 8, borderRadius: 99 },
  name: { width: 110, fontSize: 12, fontWeight: "700", color: "#3c594b" },
  track: { flex: 1 },
  level: { width: 38, textAlign: "right", fontSize: 11, fontWeight: "700", color: "#6b7f76" },
});
