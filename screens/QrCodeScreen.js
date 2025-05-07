// screens/QRCodeScreen.js
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { auth } from "../firebase";
import { SafeAreaView } from "react-native-safe-area-context";

export default function QRCodeScreen() {
  const user = auth.currentUser;

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Your Patient QR Code:</Text>
      {user && <QRCode value={user.uid} size={200} />}
      <Text style={styles.uid}>{user?.uid}</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    marginBottom: 20,
  },
  uid: {
    marginTop: 20,
    fontSize: 12,
    color: "gray",
    textAlign: "center",
  },
});
