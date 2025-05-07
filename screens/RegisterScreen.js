import React, { useState } from "react";
import { View, TextInput, Button, Text, StyleSheet } from "react-native";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("patient"); // default role

  const handleRegister = async () => {
    try {
      const userCred = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      await setDoc(doc(db, "users", userCred.user.uid), {
        email: email,
        role: role,
      });
      alert("Registered successfully!");
      navigation.navigate("Login");
    } catch (error) {
      alert(error.message);
      console.log(error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ alignItems: "center", marginBottom: 20 }}>
        <Text style={{ fontSize: 27, fontWeight: "bold" }}>
          Register to MediMate
        </Text>
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
      <Text>Role:</Text>
      <View style={styles.roleRow}>
        <Button
          title="Patient"
          onPress={() => setRole("patient")}
          color={role === "patient" ? "green" : "gray"}
        />
        <Button
          title="Caregiver"
          onPress={() => setRole("caregiver")}
          color={role === "caregiver" ? "green" : "gray"}
        />
      </View>
      <Button title="Register" onPress={handleRegister} />
      <Text onPress={() => navigation.navigate("Login")} style={styles.link}>
        Already have an account? Login
      </Text>
    </SafeAreaView>
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
  roleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  link: {
    color: "blue",
    marginTop: 10,
  },
});
