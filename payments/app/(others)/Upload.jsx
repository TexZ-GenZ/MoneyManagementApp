import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { StorageService } from "../../src/services/storageService";

export default function UploadScreen() {
  const [masterFile, setMasterFile] = useState(null);
  const [transactionFile, setTransactionFile] = useState(null);
  const [masterUploading, setMasterUploading] = useState(false);
  const [transactionUploading, setTransactionUploading] = useState(false);
  const [masterProgress, setMasterProgress] = useState(0);
  const [transactionProgress, setTransactionProgress] = useState(0);
  const [masterSuccess, setMasterSuccess] = useState(false);
  const [transactionSuccess, setTransactionSuccess] = useState(false);

  const pickFile = async (type) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        
        // Check if it's a .dbf file
        if (!file.name.toLowerCase().endsWith('.dbf')) {
          Alert.alert('Invalid File', 'Please select a .dbf file only.');
          return;
        }

        // Check file size (25MB limit)
        if (file.size > 25 * 1024 * 1024) {
          Alert.alert('File Too Large', 'File size should not exceed 25MB.');
          return;
        }

        if (type === 'master') {
          setMasterFile(file);
          setMasterSuccess(false);
          setMasterProgress(0);
        } else {
          setTransactionFile(file);
          setTransactionSuccess(false);
          setTransactionProgress(0);
        }
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file. Please try again.');
    }
  };

  const uploadFile = async (file, endpoint, type) => {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.mimeType || 'application/octet-stream',
      name: file.name,
    });

    if (type === 'master') {
      setMasterUploading(true);
      setMasterProgress(0);
    } else {
      setTransactionUploading(true);
      setTransactionProgress(0);
    }

    try {
      const token = StorageService.getToken();
      
      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        if (type === 'master') {
          setMasterProgress(prev => Math.min(prev + 10, 90));
        } else {
          setTransactionProgress(prev => Math.min(prev + 10, 90));
        }
      }, 200);

      const response = await fetch(`${process.env.EXPO_PUBLIC_APP_URI}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });

      clearInterval(progressInterval);

      if (response.ok) {
        if (type === 'master') {
          setMasterProgress(100);
          setMasterSuccess(true);
        } else {
          setTransactionProgress(100);
          setTransactionSuccess(true);
        }
        
        Alert.alert(
          'Success', 
          `${type === 'master' ? 'Master' : 'Transaction'} file uploaded successfully!`
        );
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Failed', error.message || 'Failed to upload file. Please try again.');
      
      if (type === 'master') {
        setMasterProgress(0);
      } else {
        setTransactionProgress(0);
      }
    } finally {
      if (type === 'master') {
        setMasterUploading(false);
      } else {
        setTransactionUploading(false);
      }
    }
  };

  const removeFile = (type) => {
    if (type === 'master') {
      setMasterFile(null);
      setMasterProgress(0);
      setMasterSuccess(false);
    } else {
      setTransactionFile(null);
      setTransactionProgress(0);
      setTransactionSuccess(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const UploadSection = ({ title, file, uploading, progress, success, type, endpoint }) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons name="document-text" size={20} color="#184977" />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      {!file ? (
        <TouchableOpacity
          style={styles.uploadArea}
          onPress={() => pickFile(type)}
          activeOpacity={0.7}
        >
          <Ionicons name="cloud-upload-outline" size={48} color="#b2d9e8" />
          <Text style={styles.uploadText}>Tap to Choose File</Text>
          <Text style={styles.uploadSubtext}>Supported format: DBF</Text>
          <Text style={styles.uploadSubtext}>Maximum size: 25MB</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.fileContainer}>
          <View style={styles.fileInfo}>
            <View style={styles.fileIconContainer}>
              <Ionicons name="document" size={20} color="#1aa37a" />
            </View>
            <View style={styles.fileDetails}>
              <Text style={styles.fileName}>{file.name}</Text>
              <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
            </View>
            
            {success && (
              <Ionicons name="checkmark-circle" size={24} color="#1aa37a" />
            )}
            
            {!uploading && !success && (
              <TouchableOpacity
                onPress={() => removeFile(type)}
                style={styles.removeButton}
              >
                <Ionicons name="close" size={20} color="#e25656" />
              </TouchableOpacity>
            )}
          </View>

          {uploading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressText}>Uploading...</Text>
                <Text style={styles.progressPercent}>{progress}%</Text>
              </View>
              <View style={styles.progressBar}>
                <Animated.View 
                  style={[styles.progressFill, { width: `${progress}%` }]}
                />
              </View>
            </View>
          )}

          {success && (
            <View style={styles.successContainer}>
              <Ionicons name="checkmark-circle" size={16} color="#1aa37a" />
              <Text style={styles.successText}>Upload completed successfully</Text>
            </View>
          )}

          {!uploading && !success && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.uploadButton}
                onPress={() => uploadFile(file, endpoint, type)}
              >
                <Text style={styles.uploadButtonText}>Upload File</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => removeFile(type)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>File Upload</Text>
        <Text style={styles.subtitle}>Upload your master and transaction DBF files</Text>
      </View>

      <UploadSection
        title="Master Database"
        file={masterFile}
        uploading={masterUploading}
        progress={masterProgress}
        success={masterSuccess}
        type="master"
        endpoint="/uploads/master"
      />

      <UploadSection
        title="Transactions Database"
        file={transactionFile}
        uploading={transactionUploading}
        progress={transactionProgress}
        success={transactionSuccess}
        type="transactions"
        endpoint="/uploads/transactions"
      />

      {(masterSuccess || transactionSuccess) && (
        <View style={styles.successBanner}>
          <Ionicons name="checkmark-circle" size={20} color="#1aa37a" />
          <Text style={styles.successBannerText}>
            {masterSuccess && transactionSuccess 
              ? 'Both files uploaded successfully!' 
              : `${masterSuccess ? 'Master' : 'Transaction'} file uploaded successfully!`
            }
          </Text>
        </View>
      )}

      <View style={styles.guidelinesContainer}>
        <View style={styles.guidelinesHeader}>
          <Ionicons name="information-circle" size={20} color="#2279d2" />
          <Text style={styles.guidelinesTitle}>Upload Guidelines</Text>
        </View>
        <View style={styles.guidelinesList}>
          <Text style={styles.guidelineItem}>• Only .dbf files are accepted</Text>
          <Text style={styles.guidelineItem}>• Maximum file size is 25MB</Text>
          <Text style={styles.guidelineItem}>• Master database should contain company and account information</Text>
          <Text style={styles.guidelineItem}>• Transactions database should contain payment and billing records</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafd',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#184977',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#b4dcea',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#e6f2fb',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#184977',
    marginLeft: 8,
  },
  uploadArea: {
    borderWidth: 2,
    borderColor: '#b2d9e8',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    backgroundColor: '#f8fafd',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#184977',
    marginTop: 12,
    marginBottom: 8,
  },
  uploadSubtext: {
    fontSize: 13,
    color: '#666',
    marginBottom: 2,
  },
  fileContainer: {
    backgroundColor: '#f8fafd',
    borderRadius: 12,
    padding: 16,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: '#e8f5e8',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#184977',
  },
  fileSize: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  removeButton: {
    padding: 4,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 14,
    color: '#666',
  },
  progressPercent: {
    fontSize: 14,
    color: '#666',
    fontWeight: '600',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#2279d2',
    borderRadius: 4,
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  successText: {
    fontSize: 14,
    color: '#1aa37a',
    marginLeft: 8,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: '#2279d2',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#c3e6c3',
  },
  successBannerText: {
    fontSize: 16,
    color: '#1aa37a',
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  guidelinesContainer: {
    backgroundColor: '#e6f3ff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#b3d9ff',
  },
  guidelinesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2279d2',
    marginLeft: 8,
  },
  guidelinesList: {
    paddingLeft: 8,
  },
  guidelineItem: {
    fontSize: 14,
    color: '#1f5582',
    marginBottom: 4,
    lineHeight: 20,
  },
});