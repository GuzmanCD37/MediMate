import React, { useEffect, useState } from "react";
import { View, Text, Button, StyleSheet, Image } from "react-native";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import { TouchableOpacity } from "react-native-gesture-handler";
import Ionicons from "react-native-vector-icons/Ionicons";
import { getDoc, doc } from "firebase/firestore";
import { auth, db } from "../firebase";

export default function CustomDrawerContent({ navigation }) {
  const user = auth.currentUser;

  const [username, setUsername] = useState(user?.displayName || "");
  const [role, setRole] = useState("patient");

  useEffect(() => async () => {
    const fetchData = async () => {
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists())
        setUsername(docSnap.data().firstName, docSnap.data().lastName);
      setRole(docSnap.data().role);
    };
    fetchData();
    console.log("User data fetched:", username);
  });

  const logout = async () => {
    await auth.signOut();
    navigation.replace("Login");
  };

  return (
    <DrawerContentScrollView contentContainerStyle={{ flex: 1 }}>
      <View style={{ flex: 1, padding: 20 }}>
        {/* Profile Section */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 20,
          }}
        >
          <Image
            source={{
              uri: `https://api.dicebear.com/7.x/bottts-neutral/png?seed=${username || "mediMateUser"}`,
            }} // Default if no profile pic
            style={styles.profile}
          />
          <View>
            <Text style={{ fontSize: 16, fontWeight: "bold" }}>
              {username || "User"}
            </Text>
            <Text style={{ fontSize: 14, color: "gray" }}>{role}</Text>
          </View>
        </View>

        {role !== "caregiver" && (
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate("PatientQRCode")}
          >
            <Ionicons
              name="qr-code"
              size={24}
              color="white"
              style={styles.icon}
            />
            <Text style={styles.buttonText}>Show My QR Code</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={{ padding: 20 }}>
        <Button title="Logout" onPress={logout} />
      </View>
    </DrawerContentScrollView>
  );
}
const styles = StyleSheet.create({
  button: {
    backgroundColor: "#007BFF",
    padding: 10,
    borderRadius: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  buttonText: {
    color: "white",
    marginLeft: 10,
  },
  icon: {
    color: "white",
  },
  profile: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
    borderWidth: 2,
    borderColor: "#1e90ff",
  },
});
