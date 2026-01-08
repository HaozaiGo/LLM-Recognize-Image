import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  Alert,
  Platform,
  ActivityIndicator,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import axios from "axios";
import { API_URL } from "../../config";

export default function GeneralTab() {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [sending, setSending] = useState(false);

  const pickImage = async () => {
    if (Platform.OS !== "web") {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Please grant camera roll permissions");
        return;
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const imageToBase64 = async (uri) => {
    try {
      if (Platform.OS === "web") {
        const response = await fetch(uri);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result.split(",")[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      } else {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
        return base64;
      }
    } catch (error) {
      console.error("Error converting image to base64:", error);
      throw error;
    }
  };

  const handleSend = async () => {
    if (!message.trim() && !selectedImage) return;

    setSending(true);
    const userMessage = message.trim() || "请分析这张图片";
    const currentImage = selectedImage;
    
    try {
      let base64Image = null;
      if (currentImage) {
        base64Image = await imageToBase64(currentImage);
      }

      const response = await axios.post(`${API_URL}/ollama/chat`, {
        message: userMessage,
        image: base64Image,
        model: "gemma3",
      });

      setMessages([
        ...messages,
        { type: "user", content: userMessage, image: currentImage },
        { type: "assistant", content: response.data.content },
      ]);
      setMessage("");
      setSelectedImage(null);
    } catch (error) {
      console.error("Error sending message:", error);
      Alert.alert("Error", error.response?.data?.error || "Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.chatContainer}>
      <ScrollView
        style={styles.messagesArea}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.map((msg, index) => (
          <View key={index} style={styles.messageItem}>
            {msg.image && (
              <Image source={{ uri: msg.image }} style={styles.messageImage} />
            )}
            <Text style={styles.messageText}>{msg.content}</Text>
          </View>
        ))}
        {selectedImage && (
          <View style={styles.selectedImageContainer}>
            <Image source={{ uri: selectedImage }} style={styles.selectedImage} />
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={() => setSelectedImage(null)}
            >
              <Text style={styles.removeImageText}>×</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
      <View style={styles.inputBar}>
        <TextInput
          style={styles.input}
          placeholder="Send a message"
          placeholderTextColor="#999"
          value={message}
          onChangeText={setMessage}
        />
        <TouchableOpacity style={styles.addButton} onPress={pickImage}>
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSend}
          disabled={sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#333" />
          ) : (
            <Text style={styles.sendButtonText}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chatContainer: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 20,
  },
  chatHeader: {
    alignItems: "center",
    paddingVertical: 40,
  },
  messagesArea: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
  },
  messageItem: {
    marginBottom: 10,
  },
  messageText: {
    fontSize: 14,
    color: "#333",
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedImageContainer: {
    position: "relative",
    marginBottom: 10,
    alignSelf: "flex-start",
  },
  selectedImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
  },
  removeImageButton: {
    position: "absolute",
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ff4444",
    alignItems: "center",
    justifyContent: "center",
  },
  removeImageText: {
    color: "white",
    fontSize: 18,
    fontWeight: "bold",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  input: {
    flex: 1,
    backgroundColor: "white",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#333",
    marginRight: 8,
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  addButtonText: {
    fontSize: 20,
    color: "#333",
  },
  modelButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e0e0e0",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
  },
  modelButtonText: {
    fontSize: 12,
    color: "#333",
    marginRight: 4,
  },
  caret: {
    fontSize: 10,
    color: "#333",
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#e0e0e0",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: {
    fontSize: 18,
    color: "#333",
  },
});
