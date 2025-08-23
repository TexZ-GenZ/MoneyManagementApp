import React, { useState } from 'react';
import {
  TextInput,
  Text,
  View,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle
} from 'react-native';
import { COLORS } from '../../utils/constants';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  labelStyle?: TextStyle;
  inputStyle?: TextStyle;
  errorStyle?: TextStyle;
}

const Input: React.FC<InputProps> = ({
  label,
  error,
  containerStyle,
  labelStyle,
  inputStyle,
  errorStyle,
  ...textInputProps
}) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, focused && styles.labelFocused, labelStyle]}>{label}</Text>
      )}
      <TextInput
        style={[
          styles.input,
          focused && styles.inputFocused,
          error && styles.inputError,
          inputStyle
        ]}
        placeholderTextColor={COLORS.GRAY}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...textInputProps}
      />
      {error && (
        <Text style={[styles.error, errorStyle]}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '400',
    color: COLORS.DARK,
    marginBottom: 8,
  },
  labelFocused: {
    color: '#00BFFF',
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.12)',
    paddingHorizontal: 4,
    paddingVertical: 8,
    fontSize: 16,
    color: COLORS.DARK,
    backgroundColor: COLORS.WHITE,
    minHeight: 44,
  },
  inputFocused: {
    borderBottomColor: '#00BFFF', // light blue when active
  },
  inputError: {
    borderBottomColor: COLORS.ERROR,
  },
  error: {
    fontSize: 14,
    color: COLORS.ERROR,
    marginTop: 4,
  },
});

export default Input;
