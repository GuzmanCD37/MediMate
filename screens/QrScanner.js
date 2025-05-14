import React, { useState, useEffect, useRef } from "react";
import { View, Text, StyleSheet, Button } from "react-native";
import { Camera } from "expo-camera"; // Import expo-camera
//import ImagePicker from "expo-image-picker"; // Import expo-image-picker
import { CameraView, useCameraPermissions, CameraType } from "expo-camera";
import { useNavigation } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { auth, db } from "../firebase"; // Adjust path if needed
import { getDoc, doc, updateDoc } from "firebase/firestore";

export default function QrScanner({ route }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [fullName, setFullName] = useState("");
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
    console.log("Upload QR pressed");
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
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
    } catch (error) {
      console.error("Error reading QR code:", error);
    }
  };

  const handleBarCodeScanned = async ({ data }) => {
    setScanned(true);
  
    try {
      const caregiverUID = auth.currentUser.uid;
      const caregiverRef = doc(db, "users", caregiverUID);
  
      // Fetch patient info
      const patientRef = doc(db, "users", data);
      const patientSnap = await getDoc(patientRef);
  
      if (!patientSnap.exists()) {
        console.error("Patient not found in Firestore.");
        return;
      }
  
      const patientData = patientSnap.data();
      const fullName = `${patientData.firstName} ${patientData.lastName}`;
  
      setFullName(fullName);
      console.log("Full name set:", fullName);

      // Update caregiver document with tracked patient info
      await updateDoc(caregiverRef, {
        trackedPatientId: data,
        trackedPatientFullName: fullName,
      });
  
      console.log("Scanned UID and name saved to Firestore:", data, fullName);
      navigation.navigate("Drawer");
    } catch (error) {
      console.error("Error saving scanned UID:", error);
    }
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
    borderColor: "white", // Green outline
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
