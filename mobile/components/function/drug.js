import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import axios from 'axios';
import { API_URL } from '../../config';

export default function DrugTab() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [analysis, setAnalysis] = useState('');

  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions');
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      uploadFile(result.assets[0]);
    }
  };

  const takePhoto = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not available', 'Camera is not available on web platform');
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera permissions');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      uploadFile(result.assets[0]);
    }
  };

  const uploadFile = async (asset) => {
    setUploading(true);
    setError(null);
    setUploadedImage(null);
    setAnalysis('');

    const formData = new FormData();
    
    if (Platform.OS === 'web') {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const file = new File([blob], asset.fileName || `photo_${Date.now()}.jpg`, { type: blob.type });
      formData.append('image', file);
    } else {
      formData.append('image', {
        uri: asset.uri,
        type: 'image/jpeg',
        name: asset.fileName || `photo_${Date.now()}.jpg`,
      });
    }
    formData.append('type', 'medicine');

    try {
      const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 600000,
      });

      setUploadedImage(response.data.file);
      setAnalysis(formatAnalysis(response.data.analysis));
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to upload image. Please try again.');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const uploadNew = () => {
    setUploadedImage(null);
    setError(null);
    setAnalysis('');
  };

  const copyUrl = async () => {
    if (uploadedImage?.fullUrl) {
      await Clipboard.setStringAsync(uploadedImage.fullUrl);
      Alert.alert('Success', 'URL copied to clipboard!');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatAnalysis = (data) => {
    if (!data) return '';
    try {
      if (typeof data === 'string') {
        const trimmed = data.trim();
        if (trimmed.startsWith('```') && trimmed.endsWith('```')) {
          const inner = trimmed.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '');
          return inner.trim();
        }
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      }
      return JSON.stringify(data, null, 2);
    } catch (err) {
      console.warn('Failed to parse analysis as JSON, showing raw text.', err);
      return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <View style={styles.uploadContainer}>
        {!uploadedImage ? (
          <View style={styles.uploadBox}>
            <Text style={styles.uploadText}>
              Select an image from gallery or take a photo
            </Text>
            <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
              <Text style={styles.buttonText}>Choose from Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.uploadButton} onPress={takePhoto}>
              <Text style={styles.buttonText}>Take Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.uploadedContent}>
            <Image
              source={{ uri: uploadedImage.fullUrl || uploadedImage.url }}
              style={styles.previewImage}
              resizeMode="contain"
            />
            <View style={styles.imageInfo}>
              <Text style={styles.infoText}>
                <Text style={styles.label}>File: </Text>
                {uploadedImage.originalName}
              </Text>
              <Text style={styles.infoText}>
                <Text style={styles.label}>Size: </Text>
                {formatFileSize(uploadedImage.size)}
              </Text>
              {analysis ? (
                <View style={styles.analysisBlock}>
                  <Text style={styles.label}>Analysis:</Text>
                  <ScrollView style={styles.analysisContent}>
                    <Text style={styles.analysisText}>{analysis}</Text>
                  </ScrollView>
                </View>
              ) : null}
              <View style={styles.buttonGroup}>
                <TouchableOpacity style={styles.btnPrimary} onPress={uploadNew}>
                  <Text style={styles.buttonText}>Upload Another</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btnSecondary} onPress={copyUrl}>
                  <Text style={styles.buttonText}>Copy URL</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {error ? (
          <View style={styles.errorMessage}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {uploading ? (
          <View style={styles.uploadProgress}>
            <ActivityIndicator size="large" color="#667eea" />
            <Text style={styles.progressText}>Uploading...</Text>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
  uploadContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 40,
    elevation: 10,
  },
  uploadBox: {
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 40,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  uploadText: {
    color: '#666',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  uploadButton: {
    backgroundColor: '#667eea',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 6,
    marginVertical: 8,
    minWidth: 200,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  uploadedContent: {
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 8,
    marginBottom: 20,
  },
  imageInfo: {
    width: '100%',
  },
  infoText: {
    marginVertical: 8,
    color: '#333',
    fontSize: 14,
  },
  label: {
    fontWeight: 'bold',
  },
  analysisBlock: {
    marginTop: 15,
  },
  analysisContent: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 15,
    maxHeight: 200,
    marginTop: 10,
  },
  analysisText: {
    color: '#c5e4ff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  btnPrimary: {
    backgroundColor: '#667eea',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    flex: 1,
    marginRight: 5,
  },
  btnSecondary: {
    backgroundColor: '#6c757d',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 6,
    flex: 1,
    marginLeft: 5,
  },
  errorMessage: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#fee',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fcc',
  },
  errorText: {
    color: '#c33',
    fontSize: 14,
  },
  uploadProgress: {
    marginTop: 20,
    alignItems: 'center',
  },
  progressText: {
    marginTop: 10,
    color: '#667eea',
    fontSize: 14,
  },
});

