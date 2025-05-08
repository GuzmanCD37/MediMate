import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Button } from "react-native";
import { Camera } from "expo-camera"; // Import expo-camera
import { CameraView, useCameraPermissions, CameraType } from "expo-camera";
import QRCodeLocalImage from "react-native-qrcode-local-image";
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

      QRCodeLocalImage.decode(imageUri, (err, result) => {
        if (err) {
          alert("Failed to read QR code.");
          return;
        }
        navigation.navigate("Drawer", { scannedUID: result });
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
        //barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        style={{ flex: 1 }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <Button title="Upload QR from Gallery" onPress={uploadQR} />
        <View style={styles.overlay}>
          {scanned ? (
            <Button title="Scan Again" onPress={() => setScanned(false)} />
          ) : (
            <Text style={styles.scanText}>
              Scan a QR Code to track the patient
            </Text>
          )}
        </View>
      </CameraView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  camera: {
    flex: 1,
    width: "100%",
  },
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    //backgroundColor: "rgba(0, 0, 0, 0.5)", // Slight dark overlay for better visibility
  },
  scanText: {
    color: "white",
    padding: 100,
    fontSize: 18,
    textAlign: "center",
  },
});
