// firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyBrLVUf996lPDieakVntunOUbyIu1ccmuk",
  authDomain: "medimate-35d71.firebaseapp.com",
  projectId: "medimate-35d71",
  storageBucket: "medimate-35d71.firebasestorage.app",
  messagingSenderId: "695512623786",
  appId: "1:695512623786:web:43d725508f8ce2c2f37ed3",
  measurementId: "G-8N9RQG3NRE",
};

// Initialize Firebase app
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

/*
// Initialize Auth with AsyncStorage persistence (only ONCE)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
*/

// ✅ FIX: Use Expo-compatible persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

// Initialize Firestore
const db = getFirestore(app);

export { app, auth, db };
