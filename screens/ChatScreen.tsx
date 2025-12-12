// screens/ChatScreen.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useLayoutEffect, useState } from "react";
import { Alert, Button, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

// Firebase Imports
import { signOut } from "firebase/auth";
import { addDoc, onSnapshot, orderBy, query, serverTimestamp } from "firebase/firestore";
import { auth, messagesCollection } from "../firebase";

export default function ChatScreen({ navigation }: any) {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const currentUser = auth.currentUser;

  // 1. Tombol Logout di Pojok Kanan Atas
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <Button title="Logout" onPress={() => signOut(auth)} />,
    });
  }, [navigation]);

  useEffect(() => {
    // 2. LOGIKA OFFLINE: Load data dari memori HP dulu
    const loadCachedMessages = async () => {
      try {
        const cached = await AsyncStorage.getItem("chat_history");
        if (cached) setMessages(JSON.parse(cached));
      } catch (e) { console.log("Gagal load cache"); }
    };
    loadCachedMessages();

    // 3. LOGIKA ONLINE: Dengerin update realtime dari server
    const q = query(messagesCollection, orderBy("createdAt", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setMessages(list);
      // Simpan copy-an data terbaru ke memori HP
      AsyncStorage.setItem("chat_history", JSON.stringify(list));
    });

    return () => unsubscribe();
  }, []);

  const sendMessage = async () => {
    if (!message.trim()) return;
    try {
      await addDoc(messagesCollection, {
        text: message,
        user: currentUser?.email,
        senderUid: currentUser?.uid,
        createdAt: serverTimestamp(),
        type: 'text'
      });
      setMessage("");
    } catch (e) {
      Alert.alert("Gagal Kirim", "Cek koneksi internet anda");
    }
  };

  // 4. LOGIKA UPLOAD GAMBAR 
  const sendImage = async () => {
    // Minta Izin
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Izin Ditolak", "Aplikasi butuh akses galeri.");
      return;
    }

    // Buka Galeri
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.2, // Kompres biar database gak penuh
      base64: true, 
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      
      if (!asset.base64) {
        Alert.alert("Gagal", "Gagal mengambil data gambar.");
        return;
      }

      try {
        const imageContent = `data:image/jpeg;base64,${asset.base64}`;

        // Simpan ke Firestore
        await addDoc(messagesCollection, {
          text: "Mengirim gambar...",
          imageUrl: imageContent, 
          user: currentUser?.email,
          senderUid: currentUser?.uid,
          createdAt: serverTimestamp(),
          type: 'image'
        });

      } catch (error) {
        console.error("Upload error:", error);
        Alert.alert("Gagal", "Gagal menyimpan gambar ke database.");
      }
    }
  };

  const renderItem = ({ item }: any) => {
    const isMyMsg = item.senderUid === currentUser?.uid;

    return (
      <View style={[styles.msgBox, isMyMsg ? styles.myMsg : styles.otherMsg]}>
        <Text style={styles.sender}>{item.user}</Text>
        
        {item.type === 'image' && item.imageUrl ? (
           <Image source={{ uri: item.imageUrl }} style={styles.chatImage} />
        ) : (
           <Text style={styles.msgText}>{item.text}</Text>
        )}
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      <FlatList 
        data={messages} 
        renderItem={renderItem} 
        keyExtractor={(item) => item.id} 
        contentContainerStyle={{ paddingBottom: 20 }}
      />
      
      <View style={styles.inputRow}>
        <TouchableOpacity onPress={sendImage} style={styles.imgBtn}>
           <Text style={{fontSize: 20}}>📷</Text>
        </TouchableOpacity>
        
        <TextInput 
          style={styles.input} 
          placeholder="Ketik pesan..." 
          value={message} 
          onChangeText={setMessage} 
        />
        <Button title="Kirim" onPress={sendMessage} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  msgBox: { padding: 10, marginHorizontal: 10, marginVertical: 5, borderRadius: 8, maxWidth: "75%" },
  myMsg: { backgroundColor: "#d1f0ff", alignSelf: "flex-end" },
  otherMsg: { backgroundColor: "#ffffff", alignSelf: "flex-start" },
  sender: { fontSize: 10, color: '#888', marginBottom: 2 },
  msgText: { fontSize: 16 },
  chatImage: { width: 200, height: 200, borderRadius: 10, resizeMode: 'cover' },
  inputRow: { flexDirection: "row", padding: 10, backgroundColor: '#fff', alignItems: 'center', borderTopWidth: 1, borderColor: "#ddd" },
  input: { flex: 1, borderWidth: 1, marginRight: 10, padding: 8, borderRadius: 20, borderColor: '#ccc', paddingHorizontal: 15 },
  imgBtn: { padding: 10, marginRight: 5, backgroundColor: '#eee', borderRadius: 20 }
});