import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors } from '../theme';

interface Props {
  children: React.ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
}

// Full-bleed brown-café gradient backdrop with safe-area padding.
export function Screen({ children, edges = ['top', 'bottom'], style }: Props) {
  return (
    <LinearGradient colors={[colors.bg1, colors.bg2]} style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={edges}>
        <View style={[styles.fill, style]}>{children}</View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
