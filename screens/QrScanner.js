import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Button } from "react-native";
import { Camera } from "expo-camera"; // Import expo-camera
//import * as ImagePicker from "expo-image-picker"; // Import expo-image-picker
import QRCodeLocalImage from "react-native-qrcode-local-image";
import { CameraView, useCameraPermissions, CameraType } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function QrScanner({ route }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const cameraRef = useRef(null);
  const navigation = useNavigation();

  // Request camera permissions
  useEffect(() => {
    const getPermission = async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === "granted");
    };
    getPermission();
  }, []);

  if (hasPermission === null) {
    return <Text>Requesting camera permission...</Text>; // Still loading permissions
  }
  if (hasPermission === false) {
    return <Text>No access to camera</Text>; // If permissions are denied
  }

  const uploadQR = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      const imageUri = result.assets[0].uri;

      QRCodeLocalImage.decode(imageUri, (err, decoded) => {
        if (err) {
          alert("Failed to read QR code.");
          console.error(err);
          return;
        }

        console.log("Decoded QR:", decoded);
        navigation.navigate("Drawer", { scannedUID: decoded });
      });
    }
  };

  const handleBarCodeScanned = ({ data }) => {
    setScanned(true);
    navigation.navigate("Drawer", { scannedUID: data });
  };
  return (
    <SafeAreaView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <View style={styles.scanBox} />
          <Text style={styles.scanText}>
            Scan a QR Code to track the patient
          </Text>
          {scanned && (
            <Button
              title="Scan Again"
              style={styles.scanText}
              onPress={() => setScanned(false)}
            />
          )}
          <Button title="Upload QR from Gallery" onPress={uploadQR} />
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  scanBox: {
    width: 250,
    height: 250,
    borderColor: "#white", // Green outline
    borderWidth: 4,
    borderRadius: 10,
    marginBottom: 20,
  },
  scanText: {
    color: "white",
    fontSize: 16,
    marginVertical: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 10,
    borderRadius: 8,
  },
});
