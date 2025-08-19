import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";

export default function UploadScreen() {
  const [file, setFile] = useState(null);

  const handleUpload = () => {
    // File picker logic goes here
    console.log("Pick a file...");
  };

  const handleSubmit = () => {
    if (file) {
      console.log("Uploading ID...");
    }
  };

  return (
    <View style={styles.container}>

      {/* Title */}
      <Text style={styles.title}>Upload Data</Text>
      <Text style={styles.subtitle}>
        Upload data files to database directly.
      </Text>

      {/* Upload box */}
      <TouchableOpacity style={styles.uploadBox} onPress={handleUpload}>
        <Image
          source={{ uri: "https://img.icons8.com/ios/50/upload.png" }}
          style={styles.uploadIcon}
        />
        <Text style={styles.uploadText}>Tap to upload Data</Text>
        <Text style={styles.uploadNote}>DBF or Excel Files</Text>
      </TouchableOpacity>


      {/* Submit button */}
      <TouchableOpacity
        style={[styles.submitButton, !file && styles.submitButtonDisabled]}
        disabled={!file}
        onPress={handleSubmit}
      >
        <Text
          style={[
            styles.submitButtonText,
            !file && styles.submitButtonTextDisabled,
          ]}
        >
          Upload
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    padding: 20,
  },
  skipButton: {
    alignSelf: "flex-end",
    marginBottom: 10,
  },
  skipText: {
    color: "#2563eb",
    fontWeight: "500",
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 20,
  },
  uploadBox: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
    marginBottom: 45
  },
  uploadIcon: {
    width: 40,
    height: 40,
    marginBottom: 10,
  },
  uploadText: {
    color: "#2563eb",
    fontSize: 15,
    fontWeight: "500",
  },
  uploadNote: {
    fontSize: 12,
    color: "#6b7280",
    marginTop: 4,
  },
  orText: {
    textAlign: "center",
    marginVertical: 15,
    fontSize: 14,
    color: "#6b7280",
  },
  cameraButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 25,
  },
  cameraButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 15,
  },
  submitButton: {
    backgroundColor: "#2563eb",
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  submitButtonDisabled: {
    backgroundColor: "#cbd5e1",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  submitButtonTextDisabled: {
    color: "#e5e7eb",
  },
});
