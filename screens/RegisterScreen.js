import React, { useState } from "react";
import {
  View,
  TextInput,
  Button,
  Text,
  StyleSheet,
  Switch,
  Alert,
  TouchableOpacity,
} from "react-native";
import Ionicons from "react-native-vector-icons/Ionicons";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";
import { SafeAreaView } from "react-native-safe-area-context";

export default function RegisterScreen({ navigation }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("patient"); // default role
  const [isCaregiver, setIsCaregiver] = useState(false); // for toggle
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const handleRegister = async () => {
    const selectedRole = isCaregiver ? "caregiver" : "patient";
    try {
      const userCred = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      await setDoc(doc(db, "users", userCred.user.uid), {
        email,
        firstName,
        lastName,
        role: selectedRole,
      });
      Alert.alert("Success", "Registered successfully!");
      navigation.navigate("Login");
    } catch (error) {
      Alert.alert("Registration Failed", error.message);
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

      <View style={{ flexDirection: "row", spaceBetween: 10 }}>
        <View style={{ flex: 1, marginRight: 5 }}>
          <Text>First Name:</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text>Last Name:</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
          />
        </View>
      </View>

      <Text>Email:</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />
      <Text>Password:</Text>
      <TextInput
        style={styles.input}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <View style={styles.toggleRow}>
        <Text>Are you a caregiver?</Text>
        <TouchableOpacity
          onPress={() =>
            Alert.alert(
              "Caregiver Info",
              "Caregivers can monitor the medication schedule of patients. Select this if you're managing someone else's medication."
            )
          }
          style={{ flex: 1, left: 10 }}
        >
          <Ionicons
            name="information-circle-outline"
            size={20}
            color="#1e90ff"
          />
        </TouchableOpacity>
        <Switch
          value={isCaregiver}
          onValueChange={(value) => {
            setIsCaregiver(value);
            setRole(value ? "caregiver" : "patient");
          }}
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
    borderRadius: 5,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  link: {
    color: "blue",
    marginTop: 10,
    textAlign: "center",
  },
});
