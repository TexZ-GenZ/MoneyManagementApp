import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { StorageService } from '../../src/services/storageService';
import Screen from '../../src/ui/components/Screen';
import { Card } from '../../src/ui/components/Card';
import { tokens } from '../../src/ui/tokens';
import { getApiUrl } from '../../src/utils/config';

// NOTE: This screen previously allowed uploading files individually.
// It now requires uploading BOTH Master and Transactions together using a single button.

export default function UploadScreen() {
  const [masterFile, setMasterFile] = useState(null);
  const [transactionsFile, setTransactionsFile] = useState(null);
  const [masterUploading, setMasterUploading] = useState(false);
  const [transactionsUploading, setTransactionsUploading] = useState(false);
  const [masterProgress, setMasterProgress] = useState(0);
  const [transactionsProgress, setTransactionsProgress] = useState(0);
  const [masterSuccess, setMasterSuccess] = useState(false);
  const [transactionsSuccess, setTransactionsSuccess] = useState(false);
  const [masterResult, setMasterResult] = useState(null);
  const [transactionsResult, setTransactionsResult] = useState(null);
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
      const lower = (file.name || '').toLowerCase();
      const allowed = lower.endsWith('.dbf') || lower.endsWith('.csv') || lower.endsWith('.xlsx');
      if (!allowed) { Alert.alert('Invalid File', 'Select a .dbf, .csv, or .xlsx file.'); return; }
      if (file.size > 15 * 1024 * 1024) { Alert.alert('Too Large', 'Max 15MB.'); return; }
      if (type === 'master') { setMasterFile(file); setMasterSuccess(false); setMasterProgress(0); }
      else { setTransactionsFile(file); setTransactionsSuccess(false); setTransactionsProgress(0); }
    } catch (e) { console.error(e); Alert.alert('Error', 'File pick failed.'); }
  };

  const removeFile = (type) => {
    if (type === 'master') { setMasterFile(null); setMasterProgress(0); setMasterSuccess(false); }
    else { setTransactionsFile(null); setTransactionsProgress(0); setTransactionsSuccess(false); }
  };

  const doUpload = async (file, endpoint, progressSetter) => {
    const formData = new FormData();
    formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
    const tok = await StorageService.getToken();
    if (!tok?.access_token) { throw new Error('Login required'); }

    progressSetter(0);

    // Use XMLHttpRequest to get real upload progress in React Native
    const url = getApiUrl(endpoint);
    const result = await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      // Set only auth header; let RN set multipart boundary automatically
      xhr.setRequestHeader('Authorization', `Bearer ${tok.access_token}`);

      // Track progress
      if (xhr.upload && typeof xhr.upload.addEventListener === 'function') {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const pct = Math.max(0, Math.min(100, Math.round((e.loaded / e.total) * 98)));
            progressSetter(pct);
          }
        });
      } else if (xhr.upload) {
        // Fallback handler in environments without addEventListener
        xhr.upload.onprogress = (e) => {
          if (e && e.total) {
            const pct = Math.max(0, Math.min(100, Math.round((e.loaded / e.total) * 98)));
            progressSetter(pct);
          }
        };
      }

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          const status = xhr.status || 0;
          if (status >= 200 && status < 300) {
            progressSetter(100);
            try {
              const json = JSON.parse(xhr.responseText || '{}');
              resolve(json);
            } catch {
              resolve(true);
            }
          } else {
            // Try to parse error message
            let msg = 'Upload failed';
            try {
              const json = JSON.parse(xhr.responseText || '{}');
              if (json && (json.message || json.detail)) msg = json.message || json.detail;
            } catch {}
            reject(new Error(msg));
          }
        }
      };

      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.onabort = () => reject(new Error('Upload aborted'));

      try {
        xhr.send(formData);
      } catch (err) {
        reject(err);
      }
    });

    return result;
  };

  const uploadBoth = async () => {
    if (!masterFile || !transactionsFile) {
      Alert.alert('Both files required', 'Please select both Master and Transactions files (.dbf/.csv/.xlsx) before uploading.');
      return;
    }
    // Prevent double-submission
    if (masterUploading || transactionsUploading) return;

    // Reset state
    setMasterSuccess(false); setTransactionsSuccess(false);
    setMasterProgress(0); setTransactionsProgress(0);
    setMasterUploading(true); setTransactionsUploading(true);

    try {
      // Upload sequentially to keep predictable UI; both must succeed.
      const masterResp = await doUpload(masterFile, '/uploads/master', setMasterProgress);
      const txnResp = await doUpload(transactionsFile, '/uploads/transactions', setTransactionsProgress);

      const okMaster = !!masterResp && masterResp.ok !== false;
      const okTxn = !!txnResp && txnResp.ok !== false;

      if (okMaster && okTxn) {
        setMasterSuccess(true);
        setTransactionsSuccess(true);
        setMasterResult(masterResp);
        setTransactionsResult(txnResp);
        Alert.alert('Success', 'Both Master and Transactions files uploaded successfully.');
      } else {
        throw new Error('Both files must be uploaded successfully.');
      }
    } catch (e) {
      console.error(e);
      // Show a single error covering the combined requirement
      Alert.alert('Upload Failed', e?.message || 'Failed to upload both files. Please try again.');
      // Reset success flags and progress to reflect failure of the combined operation
      setMasterSuccess(false);
      setTransactionsSuccess(false);
      setMasterProgress(0);
      setTransactionsProgress(0);
      setMasterResult(null);
      setTransactionsResult(null);
    } finally {
      setMasterUploading(false);
      setTransactionsUploading(false);
    }
  };

  const UploadSection = ({ title, subtitle, file, uploading, progress, success, type }) => (
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
          <Text style={styles.pickZoneText}>Tap to choose .dbf/.csv/.xlsx file</Text>
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
          {/* Individual upload/cancel buttons removed; upload is combined for both files */}
        </View>
      )}
    </Card>
  );

  const bothSelected = !!masterFile && !!transactionsFile;
  const anyUploading = masterUploading || transactionsUploading;

  return (
    <Screen title="Uploads" subtitle="Master & Transactions (DBF/CSV/XLSX)" scroll>
      <UploadSection title="Master File" subtitle="Company + account data (.dbf/.csv/.xlsx)" file={masterFile} uploading={masterUploading} progress={masterProgress} success={masterSuccess} type="master" />
      <UploadSection title="Transactions File" subtitle="Billing & payment records (.dbf/.csv/.xlsx)" file={transactionsFile} uploading={transactionsUploading} progress={transactionsProgress} success={transactionsSuccess} type="transactions" />

      <Card style={styles.bannerCard}>
        <View style={styles.bannerRow}>
          <Ionicons name="alert-circle-outline" size={20} color={tokens.colors.accent} />
          <Text style={styles.bannerText}>You must upload both Master and Transactions files together.</Text>
        </View>
      </Card>

      <Card style={styles.actionCard}>
        <TouchableOpacity
          style={[styles.primaryBtn, (!bothSelected || anyUploading) && styles.primaryBtnDisabled]}
          onPress={uploadBoth}
          disabled={!bothSelected || anyUploading}
        >
          <Text style={styles.primaryBtnText}>Upload Both Files</Text>
        </TouchableOpacity>
        {!bothSelected && (
          <Text style={styles.helperText}>Select both files to enable upload.</Text>
        )}
      </Card>

      {(masterSuccess && transactionsSuccess) && (
        <Card style={styles.bannerCard}>
          <View style={styles.bannerRow}>
            <Ionicons name="checkmark-circle" size={20} color={tokens.colors.success} />
            <Text style={styles.bannerText}>Both files uploaded successfully</Text>
          </View>
          {(masterResult || transactionsResult) && (
            <View style={{ marginTop: 10 }}>
              {masterResult && (
                <View style={{ marginBottom: 8 }}>
                  <Text style={styles.summaryTitle}>Master Summary</Text>
                  <Text style={styles.summaryItem}>Inserted: {masterResult.inserted ?? '-'}</Text>
                  <Text style={styles.summaryItem}>Updated: {masterResult.updated ?? '-'}</Text>
                  <Text style={styles.summaryItem}>Skipped: {masterResult.skipped ?? '-'}</Text>
                  {'archived' in masterResult && <Text style={styles.summaryItem}>Archived: {masterResult.archived}</Text>}
                </View>
              )}
              {transactionsResult && (
                <View>
                  <Text style={styles.summaryTitle}>Transactions Summary</Text>
                  <Text style={styles.summaryItem}>Inserted: {transactionsResult.inserted ?? '-'}</Text>
                  <Text style={styles.summaryItem}>Updated: {transactionsResult.updated ?? '-'}</Text>
                  <Text style={styles.summaryItem}>Skipped: {transactionsResult.skipped ?? '-'}</Text>
                  {'archived' in transactionsResult && <Text style={styles.summaryItem}>Archived: {transactionsResult.archived}</Text>}
                </View>
              )}
            </View>
          )}
        </Card>
      )}

      <Card style={styles.infoCard}>
        <View style={styles.infoHeader}><Ionicons name="information-circle-outline" size={18} color={tokens.colors.accent} /><Text style={styles.infoTitle}>Guidelines</Text></View>
        <Text style={styles.tip}>• Allowed formats: .dbf, .csv, .xlsx (max 15MB)</Text>
        <Text style={styles.tip}>• Master: company & account metadata</Text>
        <Text style={styles.tip}>• Transactions: billing & payments</Text>
        <Text style={styles.tip}>• You must upload Master and Transactions together</Text>
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
  // Removed per-section actionsRow and buttons as uploads are combined now
  primaryBtn: { flex: 1, backgroundColor: tokens.colors.accent, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  bannerCard: { marginBottom: 16, padding: 14, borderLeftWidth: 4, borderLeftColor: tokens.colors.accent },
  bannerRow: { flexDirection: 'row', alignItems: 'center' },
  bannerText: { color: tokens.colors.text, fontWeight: '700', marginLeft: 8, fontSize: 13 },
  summaryTitle: { color: tokens.colors.text, fontWeight: '700', fontSize: 13, marginBottom: 4 },
  summaryItem: { color: tokens.colors.textDim, fontSize: 12 },
  infoCard: { padding: 16 },
  infoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  infoTitle: { color: tokens.colors.text, fontSize: 13, fontWeight: '700', marginLeft: 8 },
  tip: { color: tokens.colors.textDim, fontSize: 12, marginBottom: 4 },
  actionCard: { padding: 16, marginBottom: 16 },
  helperText: { color: tokens.colors.textDim, fontSize: 12, marginTop: 8, textAlign: 'center' },
});
