import React, { useState, useEffect, useMemo } from "react";
import { scheduleMedicationReminder } from "../utils/notifications";
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
import DropDownPicker from "react-native-dropdown-picker";
import { auth, db } from "../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function EditMedication({ navigation, route }) {
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

  const { medId } = route.params;

  const [items, setItems] = useState([
    { label: "1x a day", value: "1x a day" },
    { label: "2x a day", value: "2x a day" },
    { label: "3x a day", value: "3x a day" },
    { label: "4x a day", value: "4x a day" },
  ]);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(frequency);

  useEffect(() => {
    const fetchMedication = async () => {
      const user = auth.currentUser;
      if (!user || !medId) return;
      console.log("Fetching medication with ID:", medId);
      const parseTimeString = (timeStr) => {
        const [hours, minutes] = timeStr.split(":").map(Number);
        const now = new Date();
        now.setHours(hours, minutes, 0, 0);
        return now;
      };

      try {
        const medRef = doc(db, "medications", user.uid, "meds", medId);
        const medSnap = await getDoc(medRef);

        if (medSnap.exists()) {
          const medication = medSnap.data();
          setMedName(medication.name || "");
          setDescription(medication.description || "");
          setStartDate(new Date(medication.startDate));

          // 👇 Fix for time string like "11:05"
          setStartTime(
            medication.time ? parseTimeString(medication.time) : new Date()
          );

          setFrequency(medication.frequency || "1x a day");
          setPrescribedAmt(medication.prescribedAmt || "");
          setTakenDose(medication.takenDose || "");
          setEnableRefill(medication.enableRefill || false);
          setOnHandAmount(medication.onHandAmount || "");
          setRefillThreshold(medication.refillThreshold || "");
          setEnableAlarm(medication.enableAlarm || false);
        } else {
          Alert.alert("Error", "Medication not found.");
          navigation.goBack();
        }
      } catch (error) {
        console.error("Failed to fetch medication:", error);
        Alert.alert("Error", "Failed to fetch medication.");
      }
    };

    fetchMedication();
  }, [medId]);

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
    setShowConfirmModal(true);
  };

  const confirmAndUpdate = async () => {
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
        startTime: startTime.toISOString(),
        frequency,
        intervalHours,
        prescribedAmt,
        onHandAmount: enableRefill ? onHandAmount : null,
        refillThreshold: enableRefill ? refillThreshold : null,
        enableAlarm,
        takenDose,
      };

      const medRef = doc(db, "medications", user.uid, "meds", medId);
      await updateDoc(medRef, baseMedData);

      showToast("Medication updated successfully!");
      navigation.goBack();
    } catch (error) {
      console.error("Error saving medication:", error);
      Alert.alert("Upload failed", error.message || String(error));
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <View style={styles.customHeader}>
        <Text style={styles.customHeaderTitle}>Edit Medication</Text>
      </View>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text>Medicine Name:</Text>
        <TextInput
          style={styles.input}
          value={medName}
          onChangeText={setMedName}
        />

        <Text>Description / Notes:</Text>
        <TextInput
          style={styles.input}
          value={description}
          onChangeText={setDescription}
          placeholder="Optional notes or description"
        />

        <Text>What date did/will you start?</Text>
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

        <Text>What time did/will you start?</Text>
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

        <View style={styles.switchRow}>
          <Text>Enable refill stock reminder?</Text>
          <Switch value={enableRefill} onValueChange={setEnableRefill} />
        </View>
        {enableRefill && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Amount on hand"
              keyboardType="numeric"
              value={onHandAmount}
              onChangeText={setOnHandAmount}
            />
            <TextInput
              style={styles.input}
              placeholder="Remind when amount is below..."
              keyboardType="numeric"
              value={refillThreshold}
              onChangeText={setRefillThreshold}
            />
          </>
        )}

        <View style={styles.switchRow}>
          <Text>Enable alarm reminder?</Text>
          <Switch value={enableAlarm} onValueChange={setEnableAlarm} />
        </View>

        <Text>Dose already taken? (optional)</Text>
        <TextInput
          style={styles.input}
          value={takenDose}
          onChangeText={setTakenDose}
          placeholder="E.g. 2 doses taken already"
        />

        <View style={{ marginTop: 20 }}>
          <Button title="Save Changes" onPress={handleSave} />
        </View>

        <Modal
          visible={showConfirmModal}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={{ fontWeight: "bold" }}>Confirm Dose Times:</Text>
              {calculatedTimes.map((time, index) => (
                <Text key={index}>
                  {time.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              ))}
              <Button title="Confirm and Save" onPress={confirmAndUpdate} />
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
    elevation: 9,
    shadowColor: "#000",
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
    backgroundColor: "white",
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
