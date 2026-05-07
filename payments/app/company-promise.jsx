import React, { useMemo, useState } from 'react';
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
  const [companyCode, setCompanyCode] = useState('');
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
    <Screen
      title="Company Promise Date"
      subtitle="Apply a company-level promise date"
      rightActions={(
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Pick promise date"
          onPress={() => setPickerOpen(true)}
          style={styles.textBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.textBtnLabel}>Change Promise Date</Text>
        </TouchableOpacity>
      )}
    >
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
        />
        <Input
          label="Promise Date"
          value={promiseDate}
          placeholder="Pick from calendar"
          editable={false}
        />
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {success ? <Text style={styles.successText}>{success}</Text> : null}
        <View style={styles.actionRow}>
          <Button
            title={loading ? 'Updating...' : 'Update Promise Date'}
            onPress={onSubmit}
            disabled={!canSubmit || loading}
            loading={loading}
            style={styles.actionBtn}
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
  actionBtn: { borderRadius: 12 },
  textBtn: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.colors.cardAlt,
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
