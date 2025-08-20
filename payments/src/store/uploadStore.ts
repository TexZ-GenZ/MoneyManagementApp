import * as DocumentPicker from "expo-document-picker";
import * as SecureStore from "expo-secure-store";
import { create } from "zustand";

const API_URI = process.env.EXPO_PUBLIC_API_URI;

const useUploadStore = create((set) => ({
  // State
  isUploading: false,
  uploadError: null,
  lastUploadResult: null,

  // Upload CSV
  uploadCSV: async (expoPushToken: string | null = null) => {
    set({ isUploading: true, uploadError: null });

    try {
      // Pick CSV file
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "application/dbf"],
        copyToCacheDirectory: false,
      });

      if (result.canceled) {
        set({ isUploading: false });
        return null;
      }

      const file = result.assets[0];

      // Get auth token
      let token = await SecureStore.getItemAsync("token");
      if (!token) {
        //throw new Error("No authentication token found");
        token = ""
      }

      // Prepare form data
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        type: file.mimeType || "text/csv",
        name: file.name,
      } as any);

      // Build URL
      let uploadUrl = `${API_URI}/upload-csv/`;
      if (expoPushToken) {
        uploadUrl += `?expo_push_token=${encodeURIComponent(expoPushToken)}`;
      }

      // Upload with fetch
      const response = await fetch(uploadUrl, {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.detail || errorText;
        } catch {
          errorMessage = errorText;
        }
        throw new Error(errorMessage);
      }

      const uploadResult = await response.json();

      set({
        isUploading: false,
        lastUploadResult: uploadResult,
      });

      return uploadResult;
    } catch (error: any) {
      console.log("Upload error:", error);
      set({
        isUploading: false,
        uploadError: error.message || "Upload failed",
      });
      throw error;
    }
  },

  // Reset state
  resetUpload: () => {
    set({
      isUploading: false,
      uploadError: null,
      lastUploadResult: null,
    });
  },
}));

export default useUploadStore;
