// utils/RegisterPushToken.js
import * as Notifications from "expo-notifications";
import { setDoc, doc } from "firebase/firestore";
import { db } from "../firebase"; // Adjust the import path if necessary

export const registerForPushNotifications = async (patientUID) => {
  // Ask for permission to receive push notifications
  const { status } = await Notifications.requestPermissionsAsync();

  if (status !== "granted") {
    alert("Permission for push notifications was denied");
    return;
  }

  // Get the push token
  const token = await Notifications.getExpoPushTokenAsync();
  console.log("Push token:", token.data); // Log token to verify

  // Save the token to Firestore for the patient
  try {
    await setDoc(
      doc(db, "users", patientUID),
      {
        expoPushToken: token.data, // Store the push token in Firestore
      },
      { merge: true }
    );

    console.log("Push token saved to Firestore for patient:", patientUID);
  } catch (error) {
    console.error("Error saving push token:", error);
  }
};
