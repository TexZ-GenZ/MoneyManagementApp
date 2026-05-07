import React, { useMemo, useState, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import DateTimePickerModal from 'react-native-modal-datetime-picker';
import Screen from '@/src/ui/components/Screen';
import Card from '@/src/ui/components/Card';
import Input from '@/src/components/common/Input';
import Button from '@/src/components/common/Button';
import api from '@/src/services/api';
import { tokens } from '@/src/ui/tokens';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default function CompanyPromiseScreen() {
  const params = useLocalSearchParams();
  const initialCode = params?.code || '';
  const [companyCode, setCompanyCode] = useState(initialCode);
  const [promiseDate, setPromiseDate] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const canSubmit = useMemo(() => {
    return companyCode.trim().length > 0 && DATE_RE.test(promiseDate.trim());
  }, [companyCode, promiseDate]);

  const onPickDate = (date) => {
    setPromiseDate(date.toISOString().slice(0, 10));
    setPickerOpen(false);
  };

  // If opened with a company code param, auto-open the date picker for quick selection
  useEffect(() => {
    if (initialCode && !companyCode) setCompanyCode(initialCode);
    if (initialCode && !pickerOpen) {
      // small delay to let screen render before opening modal
      const t = setTimeout(() => setPickerOpen(true), 120);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [initialCode]);

  const onSubmit = async () => {
    setError(null);
    setSuccess(null);
    const code = companyCode.trim();
    const date = promiseDate.trim();
    if (!code) {
      setError('Company code is required.');
      return;
    }
    if (!DATE_RE.test(date)) {
      setError('Use YYYY-MM-DD format.');
      return;
    }
    setLoading(true);
    try {
      await api.requestCompanyPromiseDateChange({
        companyCode: code,
        newPromiseDate: date,
      });
      setSuccess(`Promise date updated to ${date} for ${code}.`);
    } catch (e) {
      setError(e?.message || 'Failed to update promise date.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen title="Company Promise Date" subtitle="Apply a company-level promise date">
      <Card style={styles.card}>
        <Text style={styles.helperText}>
          Updates pending/partial bills with earlier dates to this promise date.
        </Text>
        <Input
          label="Company Code"
          value={companyCode}
          onChangeText={setCompanyCode}
          autoCapitalize="characters"
          placeholder="e.g. 9184"
          labelStyle={{ color: tokens.colors.text }}
          inputStyle={{
            backgroundColor: tokens.colors.cardAlt,
            borderBottomWidth: 0,
            borderWidth: 1,
            borderColor: tokens.colors.border,
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        />

        <TouchableOpacity activeOpacity={0.8} onPress={() => setPickerOpen(true)}>
          <Text style={[{ fontSize: 16, fontWeight: '400', color: tokens.colors.text, marginBottom: 8 }]}>Promise Date</Text>
          <View style={{ backgroundColor: tokens.colors.cardAlt, borderWidth: 1, borderColor: tokens.colors.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: promiseDate ? tokens.colors.text : tokens.colors.textDim }}>{promiseDate ? promiseDate : 'Pick from calendar'}</Text>
          </View>
        </TouchableOpacity>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}
        <View style={styles.actionRow}>
          <Button
            title={loading ? 'Updating...' : 'Update Promise Date'}
            onPress={onSubmit}
            disabled={!canSubmit || loading}
            loading={loading}
            variant="success"
            size="large"
            style={[styles.actionBtn, { borderRadius: 12 }]}
            textStyle={{ color: '#000' }}
          />
        </View>
      </Card>
      <DateTimePickerModal
        isVisible={pickerOpen}
        mode="date"
        onConfirm={onPickDate}
        onCancel={() => setPickerOpen(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 16 },
  helperText: {
    color: tokens.colors.textSubtle,
    fontSize: 13,
    marginBottom: 12,
  },
  errorText: { color: tokens.colors.danger, marginTop: 4 },
  successText: { color: tokens.colors.success, marginTop: 4 },
  actionRow: { marginTop: 8 },
  actionBtn: { borderRadius: 12, backgroundColor:tokens.colors.accent },
  textBtn: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.accentAlt,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  textBtnLabel: {
    color: tokens.colors.text,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
