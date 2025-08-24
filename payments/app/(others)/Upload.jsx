import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { StorageService } from '../../src/services/storageService';
import Screen from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';

const API_BASE_URL = process.env.EXPO_PUBLIC_APP_URI;

export default function UploadScreen() {
  const [masterFile, setMasterFile] = useState(null);
  const [transactionsFile, setTransactionsFile] = useState(null);
  const [masterUploading, setMasterUploading] = useState(false);
  const [transactionsUploading, setTransactionsUploading] = useState(false);
  const [masterProgress, setMasterProgress] = useState(0);
  const [transactionsProgress, setTransactionsProgress] = useState(0);
  const [masterSuccess, setMasterSuccess] = useState(false);
  const [transactionsSuccess, setTransactionsSuccess] = useState(false);
  const timers = useRef([]);

  useEffect(() => () => timers.current.forEach(t => clearInterval(t)), []);

  const formatFileSize = (bytes = 0) => {
    if (!bytes) return '0 B';
    const k = 1024; const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const pickFile = async (type) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      if (!file.name.toLowerCase().endsWith('.dbf')) { Alert.alert('Invalid File', 'Select a .dbf file.'); return; }
      if (file.size > 15 * 1024 * 1024) { Alert.alert('Too Large', 'Max 15MB.'); return; }
      if (type === 'master') { setMasterFile(file); setMasterSuccess(false); setMasterProgress(0); }
      else { setTransactionsFile(file); setTransactionsSuccess(false); setTransactionsProgress(0); }
    } catch (e) { console.error(e); Alert.alert('Error', 'File pick failed.'); }
  };

  const removeFile = (type) => {
    if (type === 'master') { setMasterFile(null); setMasterProgress(0); setMasterSuccess(false); }
    else { setTransactionsFile(null); setTransactionsProgress(0); setTransactionsSuccess(false); }
  };

  const uploadFile = async (file, endpoint, type) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
    if (type === 'master') { setMasterUploading(true); setMasterProgress(0); }
    else { setTransactionsUploading(true); setTransactionsProgress(0); }
    try {
      const tok = await StorageService.getToken();
      if (!tok?.access_token) { Alert.alert('Auth', 'Login required'); return; }
      // Simulated progress
      const interval = setInterval(() => {
        if (type === 'master') setMasterProgress(p => Math.min(p + 7, 85));
        else setTransactionsProgress(p => Math.min(p + 7, 85));
      }, 250);
      timers.current.push(interval);
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tok.access_token}`, 'Content-Type': 'multipart/form-data' },
        body: formData,
      });
      clearInterval(interval);
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Upload failed'); }
      if (type === 'master') { setMasterProgress(100); setMasterSuccess(true); }
      else { setTransactionsProgress(100); setTransactionsSuccess(true); }
      Alert.alert('Success', `${type === 'master' ? 'Master' : 'Transactions'} file uploaded.`);
    } catch (e) {
      console.error(e);
      Alert.alert('Upload Failed', e.message || 'Failed to upload.');
      if (type === 'master') setMasterProgress(0); else setTransactionsProgress(0);
    } finally {
      if (type === 'master') setMasterUploading(false); else setTransactionsUploading(false);
    }
  };

  const UploadSection = ({ title, subtitle, file, uploading, progress, success, type, endpoint }) => (
    <Card style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconWrap}><Ionicons name="document-text-outline" size={18} color={tokens.colors.accent} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{title}</Text>
          {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
        </View>
        {success && <Ionicons name="checkmark-circle" size={22} color={tokens.colors.success} />}
      </View>
      {!file && (
        <TouchableOpacity style={styles.pickZone} activeOpacity={0.75} onPress={() => pickFile(type)}>
          <Ionicons name="cloud-upload-outline" size={42} color={tokens.colors.textDim} />
          <Text style={styles.pickZoneText}>Tap to choose .dbf file</Text>
          <Text style={styles.pickZoneHint}>Max 15MB</Text>
        </TouchableOpacity>
      )}
      {file && (
        <View style={styles.fileBlock}>
          <View style={styles.fileRow}>
            <View style={styles.fileBadge}><Ionicons name="document" size={18} color={tokens.colors.accent} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fileName} numberOfLines={1}>{file.name}</Text>
              <Text style={styles.fileMeta}>{formatFileSize(file.size)}</Text>
            </View>
            {!uploading && !success && (
              <TouchableOpacity onPress={() => removeFile(type)} style={styles.iconBtn}>
                <Ionicons name="close" size={18} color={tokens.colors.danger} />
              </TouchableOpacity>
            )}
          </View>
          {(uploading || success) && (
            <View style={styles.progressWrap}>
              <View style={styles.progressBarOuter}><View style={[styles.progressBarFill, { width: `${progress}%` }]} /></View>
              <Text style={styles.progressText}>{success ? 'Done' : `Uploading ${progress}%`}</Text>
            </View>
          )}
          {!uploading && !success && (
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => uploadFile(file, endpoint, type)}><Text style={styles.primaryBtnText}>Upload</Text></TouchableOpacity>
              <TouchableOpacity style={styles.secondaryBtn} onPress={() => removeFile(type)}><Text style={styles.secondaryBtnText}>Cancel</Text></TouchableOpacity>
            </View>
          )}
          {success && <Text style={styles.successLine}>Uploaded successfully</Text>}
        </View>
      )}
    </Card>
  );

  return (
    <Screen title="Uploads" subtitle="Master & Transactions DBF" scroll>
      <UploadSection title="Master DBF" subtitle="Company + account data" file={masterFile} uploading={masterUploading} progress={masterProgress} success={masterSuccess} type="master" endpoint="/uploads/master" />
      <UploadSection title="Transactions DBF" subtitle="Billing & payment records" file={transactionsFile} uploading={transactionsUploading} progress={transactionsProgress} success={transactionsSuccess} type="transactions" endpoint="/uploads/transactions" />
      {(masterSuccess || transactionsSuccess) && (
        <Card style={styles.bannerCard}>
          <View style={styles.bannerRow}>
            <Ionicons name="checkmark-circle" size={20} color={tokens.colors.success} />
            <Text style={styles.bannerText}>{masterSuccess && transactionsSuccess ? 'Both files uploaded successfully' : `${masterSuccess ? 'Master' : 'Transactions'} file uploaded`}</Text>
          </View>
        </Card>
      )}
      <Card style={styles.infoCard}>
        <View style={styles.infoHeader}><Ionicons name="information-circle-outline" size={18} color={tokens.colors.accent} /><Text style={styles.infoTitle}>Guidelines</Text></View>
        <Text style={styles.tip}>• Only .dbf files (max 15MB)</Text>
        <Text style={styles.tip}>• Master: company & account metadata</Text>
        <Text style={styles.tip}>• Transactions: billing & payments</Text>
        <Text style={styles.tip}>• Upload again to overwrite latest data</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 16, padding: 16 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  iconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: tokens.colors.cardAlt, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardTitle: { color: tokens.colors.text, fontSize: 15, fontWeight: '700' },
  cardSubtitle: { color: tokens.colors.textDim, fontSize: 11, marginTop: 2 },
  pickZone: { borderWidth: 1, borderColor: tokens.colors.border, borderStyle: 'dashed', paddingVertical: 30, borderRadius: 14, alignItems: 'center', backgroundColor: tokens.colors.cardAlt },
  pickZoneText: { color: tokens.colors.text, fontSize: 13, fontWeight: '600', marginTop: 10 },
  pickZoneHint: { color: tokens.colors.textDim, fontSize: 11, marginTop: 2 },
  fileBlock: { backgroundColor: tokens.colors.cardAlt, borderRadius: 12, padding: 12 },
  fileRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  fileBadge: { width: 36, height: 36, borderRadius: 10, backgroundColor: tokens.colors.card, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  fileName: { color: tokens.colors.text, fontSize: 14, fontWeight: '600' },
  fileMeta: { color: tokens.colors.textDim, fontSize: 11, marginTop: 2 },
  iconBtn: { padding: 4 },
  progressWrap: { marginTop: 4 },
  progressBarOuter: { height: 6, backgroundColor: tokens.colors.border, borderRadius: 4, overflow: 'hidden', marginBottom: 4 },
  progressBarFill: { height: '100%', backgroundColor: tokens.colors.accent },
  progressText: { color: tokens.colors.textDim, fontSize: 11 },
  actionsRow: { flexDirection: 'row', marginTop: 6 },
  primaryBtn: { flex: 1, backgroundColor: tokens.colors.accent, paddingVertical: 12, borderRadius: 12, alignItems: 'center', marginRight: 8 },
  primaryBtnText: { color: '#000', fontWeight: '700', fontSize: 13 },
  secondaryBtn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, borderWidth: 1, borderColor: tokens.colors.border, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: tokens.colors.textDim, fontWeight: '600', fontSize: 13 },
  successLine: { marginTop: 8, color: tokens.colors.success, fontSize: 12, fontWeight: '600' },
  bannerCard: { marginBottom: 16, padding: 14, borderLeftWidth: 4, borderLeftColor: tokens.colors.success },
  bannerRow: { flexDirection: 'row', alignItems: 'center' },
  bannerText: { color: tokens.colors.success, fontWeight: '700', marginLeft: 8, fontSize: 13 },
  infoCard: { padding: 16 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  infoTitle: { color: tokens.colors.text, fontSize: 13, fontWeight: '700', marginLeft: 8 },
  tip: { color: tokens.colors.textDim, fontSize: 12, marginBottom: 4 },
});