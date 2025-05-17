//app.js
import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createDrawerNavigator } from "@react-navigation/drawer";

import { auth, db } from "./firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

import CustomDrawerContent from "./components/CustomDrawerContent";
import RegisterScreen from "./screens/RegisterScreen";
import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";
import AddMedicationScreen from "./screens/AddMedicationScreen";
import EditMedication from "./screens/EditMedicationScreen";
import QrScanner from "./screens/QrScanner";
import QrCodeScreen from "./screens/QrCodeScreen";

const Stack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();
// Set default notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Register for push notifications and save token
export async function registerForPushNotificationsAsync() {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    alert("Permission for notifications not granted.");
    return;
  }

  const { data: token } = await Notifications.getExpoPushTokenAsync();

  const user = auth.currentUser;
  if (user && token) {
    await setDoc(
      doc(db, "users", user.uid),
      { expoPushToken: token },
      { merge: true }
    );
    console.log("✅ Push token registered:", token);
  }
}

// Helper to check if medication is still active
export async function checkIfStillActive(medId) {
  try {
    const user = auth.currentUser;
    if (!user) return false;

    const medRef = doc(db, "medications", user.uid, "meds", medId);
    const medSnap = await getDoc(medRef);
    if (!medSnap.exists()) return false;

    const medData = medSnap.data();

    // ✅ Safe check for endDate
    if (medData.endDate && typeof medData.endDate.toDate === "function") {
      const now = new Date();
      return now <= medData.endDate.toDate();
    } else {
      console.warn("No valid endDate set for medication:", medId);
      return false; // or return true if you want to treat missing endDate as "active"
    }
  } catch (error) {
    console.error("❌ Error checking medication status:", error);
    return false;
  }
}

export default function App() {
  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  useEffect(() => {
    const setupNotifications = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        alert("Permission for notifications not granted.");
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("medications", {
          name: "Medication Reminders",
          importance: Notifications.AndroidImportance.HIGH,
          sound: "default",
        });
      }
    };

    setupNotifications();

    const notificationListener = Notifications.addNotificationReceivedListener(
      async (notification) => {
        console.log("🔔 Notification received:", notification);
        const { medId, hour, minute } = notification.request.content.data || {};

        if (!medId || hour === undefined || minute === undefined) return;

        const stillActive = await checkIfStillActive(medId);
        if (!stillActive) return;

        const nextTime = new Date();
        nextTime.setDate(nextTime.getDate() + 1);
        nextTime.setHours(hour);
        nextTime.setMinutes(minute);
        nextTime.setSeconds(0);

        await Notifications.scheduleNotificationAsync({
          content: {
            title: "Medication Reminder 💊",
            body: `Time to take your medication`,
            sound: "default",
            data: { medId, medName, hour, minute },
          },
          trigger: {
            type: "date",
            timestamp: nextTime.getTime(),
          },
        });

        console.log("🔁 Rescheduled for next day:", nextTime.toLocaleString());
      }
    );

    const responseListener =
      Notifications.addNotificationResponseReceivedListener((response) => {
        console.log("📲 Notification tapped:", response);
      });

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  const DrawerRoutes = ({ route }) => {
    const scannedUID = route.params?.scannedUID;

    return (
      <Drawer.Navigator
        drawerContent={(props) => <CustomDrawerContent {...props} />}
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: "#FE8EDB" },
        }}
      >
        <Drawer.Screen
          name="Home"
          component={HomeScreen}
          initialParams={{ scannedUID }}
        />
      </Drawer.Navigator>
    );
  };

  return (
    <NavigationContainer>
      <StatusBar backgroundColor="black" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Drawer" component={DrawerRoutes} />
        <Stack.Screen name="AddMedication" component={AddMedicationScreen} />
        <Stack.Screen name="EditMedication" component={EditMedication} />
        <Stack.Screen name="QrScanner" component={QrScanner} />
        <Stack.Screen name="PatientQRCode" component={QrCodeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
