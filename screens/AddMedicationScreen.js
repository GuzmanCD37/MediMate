//AddMedicationScreen.js
import React, { useState, useMemo, useEffect } from "react";
import Ionicons from "react-native-vector-icons/Ionicons";
import DropDownPicker from "react-native-dropdown-picker";
import {
  View,
  Text,
  TextInput,
  Button,
  ScrollView,
  StyleSheet,
  ToastAndroid,
  Alert,
  Platform,
  Switch,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { auth, db } from "../firebase";
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  arrayUnion,
  collection,
  addDoc,
} from "firebase/firestore";

export default function AddMedication({ navigation }) {
  const [medName, setMedName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [frequency, setFrequency] = useState("1x a day");
  const [prescribedAmt, setPrescribedAmt] = useState("");
  const [enableRefill, setEnableRefill] = useState(false);
  const [onHandAmount, setOnHandAmount] = useState("");
  const [refillThreshold, setRefillThreshold] = useState("");
  const [enableAlarm, setEnableAlarm] = useState(false);
  const [takenDose, setTakenDose] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [calculatedTimes, setCalculatedTimes] = useState([]);

  const [items, setItems] = useState([
    { label: "1x a day", value: "1x a day" },
    { label: "2x a day", value: "2x a day" },
    { label: "3x a day", value: "3x a day" },
    { label: "4x a day", value: "4x a day" },
  ]);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(frequency);

  const getIntervalFromFrequency = (freq) => {
    switch (freq) {
      case "1x a day":
        return 24;
      case "2x a day":
        return 12;
      case "3x a day":
        return 6;
      case "4x a day":
        return 4;
      default:
        return 24;
    }
  };

  const doseTimes = useMemo(() => {
    const interval = getIntervalFromFrequency(frequency);
    const times = [new Date(startTime)];

    for (let i = 1; i < 24 / interval; i++) {
      const nextTime = new Date(startTime);
      nextTime.setHours(startTime.getHours() + interval * i);
      if (nextTime.getDate() === startTime.getDate()) {
        times.push(nextTime);
      }
    }
    return times;
  }, [startTime, frequency]);

  const handleSave = () => {
    const user = auth.currentUser;
    if (!user) {
      console.error("User not authenticated.");
      return;
    }
    setCalculatedTimes(doseTimes);
    setShowConfirmModal(true);
  };

  const confirmAndUpload = async () => {
    try {
      const user = auth.currentUser;
      if (!user) return;

      const showToast = (message) => {
        if (Platform.OS === "android") {
          ToastAndroid.show(message, ToastAndroid.SHORT);
        } else {
          Alert.alert("Success", message);
        }
      };

      const intervalHours = getIntervalFromFrequency(frequency);
      const baseMedData = {
        name: medName,
        description,
        startDate: startDate.toDateString(),
        frequency,
        intervalHours,
        prescribedAmt,
        onHandAmount: enableRefill ? onHandAmount : null,
        refillThreshold: enableRefill ? refillThreshold : null,
        enableAlarm,
        takenDose,
      };

      const medsToAdd = doseTimes.map((time) => ({
        ...baseMedData,
        time: time.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
        isoTime: time.toISOString(),
      }));

      try {
        const userMedsCollection = collection(
          db,
          "medications",
          user.uid,
          "meds"
        );

        for (let med of medsToAdd) {
          if (enableAlarm) {
            const triggerTime = new Date(med.isoTime);
            const hour = triggerTime.getHours();
            const minute = triggerTime.getMinutes();
            //await scheduleMedicationReminder(med.name, hour, minute);
          }
          await addDoc(userMedsCollection, med);
        }
        //
        showToast("Medication doses saved successfully!");
        navigation.goBack();
      } catch (error) {
        console.error("Error saving medication:", error);
        Alert.alert("Upload failed", error.message || String(error));
      }
    } catch (e) {
      console.error("Upload failed:", e);
      Alert.alert("Error", "Something went wrong while saving.");
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <View style={styles.customHeader}>
        <Text style={styles.customHeaderTitle}>Add Medication</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text>Name:</Text>
        <TextInput
          style={styles.input}
          value={medName}
          placeholder="Febuxostat, etc."
          onChangeText={setMedName}
        />
        <Text>Description / Notes:</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="Optional notes or description"
        />
        <Text>Start Date:</Text>
        <Button
          title={startDate.toDateString()}
          onPress={() => setShowDatePicker(true)}
        />
        {showDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display="default"
            onChange={(e, d) => {
              setShowDatePicker(false);
              if (d) setStartDate(d);
            }}
          />
        )}
        <Text>Start time:</Text>
        <Button
          title={startTime.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
          onPress={() => setShowTimePicker(true)}
        />
        {showTimePicker && (
          <DateTimePicker
            value={startTime}
            mode="time"
            display="spinner"
            s
            onChange={(e, t) => {
              setShowTimePicker(false);
              if (t) setStartTime(t);
            }}
          />
        )}

        <Text>Dose Frequency:</Text>
        <DropDownPicker
          open={open}
          value={value}
          items={items}
          setOpen={setOpen}
          setValue={(callback) => {
            const selected = callback(value);
            setValue(selected);
            setFrequency(selected); // Sync immediately
          }}
          setItems={setItems}
          placeholder="Select frequency"
          zIndex={3000}
          zIndexInverse={1000}
        />
        <Text>Interval: Every {getIntervalFromFrequency(frequency)} hours</Text>

        <Text>Prescribed Amount of Drug (optional):</Text>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={prescribedAmt}
          onChangeText={setPrescribedAmt}
        />
        <Text>Dose already taken? (optional)</Text>
        <TextInput
          style={styles.input}
          value={takenDose}
          keyboardType="numeric"
          onChangeText={setTakenDose}
          placeholder="E.g. 2 doses taken already"
        />
        <View style={{ marginTop: 20 }}>
          <Button title="Save Medication" onPress={handleSave} />
        </View>
        <Modal
          visible={showConfirmModal}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={{ fontWeight: "bold", fontSize: 19 }}>
                Confirm Dose Times:
              </Text>

              <View style={{ marginBottom: 20, marginTop: 10 }}>
                {calculatedTimes.map((time, index) => (
                  <Text key={index} style={{ fontSize: 16, marginVertical: 3 }}>
                    <Ionicons name="time-outline" size={24} color="black" />

                    {time.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                ))}
              </View>

              <Button title="Confirm and Save" onPress={confirmAndUpload} />
              <Button
                title="Cancel"
                onPress={() => setShowConfirmModal(false)}
                color="red"
              />
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 80,
    flexGrow: 1,
  },
  customHeader: {
    marginTop: 30,
    paddingTop: 20,
    paddingBottom: 20,
    backgroundColor: "#FE8EDB",
    alignItems: "center",

    paddingVertical: 15,
    paddingHorizontal: 20,
    elevation: 9, // Android shadow
    shadowColor: "#000", // iOS shadow
    shadowOffset: { width: 0, height: 9 },
    shadowOpacity: 2,
    shadowRadius: 7,
    zIndex: 10,
  },
  customHeaderTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "black",
  },

  input: {
    borderWidth: 1,
    padding: 10,
    marginVertical: 10,
    borderRadius: 5,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 20,
  },
  modalContent: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 10,
  },
});
