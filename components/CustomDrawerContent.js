import React from "react";
import { View, Text, Button } from "react-native";
import { DrawerContentScrollView } from "@react-navigation/drawer";
import { auth } from "../firebase";

export default function CustomDrawerContent({ navigation }) {
  const user = auth.currentUser;

  const logout = async () => {
    await auth.signOut();
    navigation.replace("Login");
  };

  return (
    <DrawerContentScrollView contentContainerStyle={{ flex: 1 }}>
      <View style={{ flex: 1, padding: 20 }}>
        <Text>Welcome,</Text>
        <Text>{user?.email}</Text>
        <Button
          title="Show My QR Code"
          onPress={() => navigation.navigate("PatientQRCode")}
        />
      </View>
      <View style={{ padding: 20 }}>
        <Button title="Logout" onPress={logout} />
      </View>
    </DrawerContentScrollView>
  );
}
