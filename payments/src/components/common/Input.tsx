import React from 'react';
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
  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, labelStyle]}>{label}</Text>
      )}
      <TextInput
        style={[
          styles.input,
          error && styles.inputError,
          inputStyle
        ]}
        placeholderTextColor={COLORS.GRAY}
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
    fontWeight: '600',
    color: COLORS.DARK,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.GRAY,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.DARK,
    backgroundColor: COLORS.WHITE,
    minHeight: 44,
  },
  inputError: {
    borderColor: COLORS.ERROR,
  },
  error: {
    fontSize: 14,
    color: COLORS.ERROR,
    marginTop: 4,
  },
});

export default Input;
