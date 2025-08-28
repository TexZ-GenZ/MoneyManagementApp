import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View, StyleSheet } from 'react-native';

export interface TabBarIconProps {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  style?: any;
  onPress?: () => void;
}

export function TabBarIcon({ name, color, style, onPress }: TabBarIconProps) {
  const inner = <Ionicons name={name} size={28} color={color} />;
  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} style={[styles.wrap, style]} activeOpacity={0.7}>
        {inner}
      </TouchableOpacity>
    );
  }
  return <View style={[styles.wrap, style]}>{inner}</View>;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', width: 34, height: 34 },
});
