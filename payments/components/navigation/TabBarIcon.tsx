import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';

export interface TabBarIconProps {
  name: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  style?: any;
  onPress?: () => void;
}

export function TabBarIcon({ name, color, style, onPress }: TabBarIconProps) {
  const IconComponent = (
    <Ionicons name={name} size={28} color={color} style={style} />
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} style={style}>
        <Ionicons name={name} size={28} color={color} />
      </TouchableOpacity>
    );
  }

  return IconComponent;
}
