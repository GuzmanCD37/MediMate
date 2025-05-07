import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Button , Image, Platform} from "react-native";
import { Camera } from "expo-camera"; // Import expo-camera
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import jsQR from "jsqr";
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
      allowsEditing: false,
      quality: 1,
      base64: true, // We need base64 to decode it
    });
  
    if (!result.canceled) {
      const base64 = result.assets[0].base64;
      const imageUri = result.assets[0].uri;
  
      // Decode the image manually using jsQR
      const response = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
  
      const image = await Image.getSize(imageUri, (width, height) => {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        const img = new Image();
        img.src = `data:image/jpeg;base64,${response}`;
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, width, height);
          const code = jsQR(imageData.data, imageData.width, imageData.height);
          if (code) {
            navigation.navigate("Drawer", { scannedUID: code.data });
          } else {
            alert("No QR code found in the image.");
          }
        };
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
    backgroundColor: "White",
    padding: 100,
    fontSize: 18,
  },
});
