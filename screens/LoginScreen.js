import React, { useState } from "react";
import { View, TextInput, Button, Text, StyleSheet } from "react-native";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";

// Import the register function from the utils file
import { registerForPushNotifications } from "../utils/RegisterPushToken";

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState("guzmancarlo.123@gmail.com");
  const [password, setPassword] = useState("3789legends");

  const handleLogin = async () => {
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      await registerForPushNotifications(userCredential.user.uid); // Register for push notifications
      console.log("User logged in:", userCredential.user.uid);
      



      alert("Login successful!");
      navigation.navigate("Drawer"); // Navigate to the drawer after login
      // You can redirect to a different screen based on role here
    } catch (error) {
      console.log(error.message);
    }
  };

  return (
    <View style={styles.container}>
      <View style={{ alignItems: "center", marginBottom: 20 }}>
        <Text style={{ fontSize: 37, fontWeight: "bold" }}>Login</Text>
      </View>

      <Text>Email:</Text>
      <TextInput style={styles.input} value={email} onChangeText={setEmail} />
      <Text>Password:</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Button title="Login" onPress={handleLogin} />
      <Text onPress={() => navigation.navigate("Register")} style={styles.link}>
        Don't have an account? Register
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    flex: 1,
    justifyContent: "center",
  },
  input: {
    borderWidth: 1,
    marginBottom: 10,
    padding: 8,
  },
  link: {
    color: "blue",
    marginTop: 10,
  },
});
