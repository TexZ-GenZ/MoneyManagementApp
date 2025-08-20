import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import useUploadStore from "../../src/store/uploadStore";

const UploadScreen = () => {
  const { uploadCSV, isUploading, uploadError, lastUploadResult, resetUpload } = useUploadStore();

  const handleUpload = async () => {
    try {
      await uploadCSV();
    } catch (e) {
      console.log("Upload failed:", e.message);
    }
  };

  return (
    <View style={styles.container}>
  
      {/* Title */}
      <Text style={styles.title}>Upload File</Text>
      <Text style={styles.subtitle}>
        Upload a CSV or DBF file for processing.
      </Text>

      {/* Upload Box */}
      <View style={styles.uploadBox}>
        <TouchableOpacity onPress={handleUpload}>
          <Text style={styles.uploadText}>
            Tap to upload file {"\n"}
            <Text style={styles.uploadHint}>CSV or DBF</Text>
          </Text>
        </TouchableOpacity>

      </View>

      {/* Bottom Upload Button */}
      <TouchableOpacity
        style={[styles.uploadButton, isUploading && { backgroundColor: "#ccc" }]}
        onPress={handleUpload}
        disabled={isUploading}
      >
        {isUploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.uploadButtonText}>Upload File</Text>
        )}
      </TouchableOpacity>

      {/* Error / Success */}
      {uploadError && <Text style={styles.errorText}>{uploadError}</Text>}
      {lastUploadResult && (
        <Text style={styles.successText}>✅ Upload successful!</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
    alignItems: "center",
  },
  skipButton: {
    alignSelf: "flex-end",
    marginBottom: 20,
  },
  skipText: {
    color: "#007bff",
    fontWeight: "500",
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
    textAlign: "center",
  },
  uploadBox: {
    width: "100%",
    padding: 30,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#aaa",
    borderRadius: 10,
    alignItems: "center",
    marginBottom: 30,
  },
  uploadText: {
    color: "#007bff",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 10,
  },
  uploadHint: {
    fontSize: 12,
    color: "#999",
  },
  uploadButton: {
    marginTop: "auto",
    backgroundColor: "#4a90e2",
    paddingVertical: 15,
    borderRadius: 8,
    width: "100%",
    alignItems: "center",
  },
  uploadButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  errorText: {
    marginTop: 10,
    color: "red",
  },
  successText: {
    marginTop: 10,
    color: "green",
  },
});

export default UploadScreen;
