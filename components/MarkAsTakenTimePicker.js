// components/MarkAsTakenTimePicker.js
import React, { useState } from "react";
import {
  Platform,
  View,
  Button,
  StyleSheet,
  Modal,
  Text,
  TouchableOpacity,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

export default function MarkAsTakenTimePicker({
  initialTime,
  onConfirm,
  onCancel,
}) {
  const [date, setDate] = useState(initialTime || new Date());
  const [mode, setMode] = useState("selection"); // 'selection' or 'picker'
  const [showDateTimePicker, setShowDateTimePicker] = useState(true); // Controls DateTimePicker visibility for Android

  const handleTakenNow = () => {
    onConfirm(new Date()); // Pass current time immediately
  };

  const handlePickTime = () => {
    setMode("picker"); // Switch to the time picker view
  };

  const onChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;

    if (Platform.OS === "android") {
      setShowDateTimePicker(false); // Hide the native Android picker immediately
      if (event.type === "set") {
        // 'set' means user confirmed selection
        onConfirm(currentDate);
      } else {
        // 'dismissed' means user cancelled native dialog
        onCancel();
      }
    } else {
      // iOS: update date, picker stays open until explicit confirm/cancel
      setDate(currentDate);
    }
  };

  const handleConfirmPicker = () => {
    onConfirm(date); // Confirm the chosen date from the picker
  };

  const handleCancelPicker = () => {
    // If canceling from the picker itself (iOS), go back to selection or just cancel entirely
    setMode("selection"); // Go back to the initial selection screen
    if (Platform.OS === "android") {
      // On Android, if cancel on initial choice, cancel
      onCancel();
    }
  };

  // Render content based on `mode`
  const renderContent = () => {
    if (mode === "selection") {
      return (
        <View style={styles.selectionContainer}>
          <Text style={styles.title}>When did you take the medication?</Text>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleTakenNow}
          >
            <Text style={styles.actionButtonText}>Now</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handlePickTime}
          >
            <Text style={styles.actionButtonText}>Pick Time</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelAction]}
            onPress={onCancel}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (mode === "picker") {
      return (
        <View style={styles.pickerContainer}>
          <Text style={styles.title}>Select Taken Time</Text>
          {showDateTimePicker && ( // For Android, render only when needed
            <DateTimePicker
              testID="dateTimePicker"
              value={date}
              mode="time"
              is24Hour={false}
              display={Platform.OS === "ios" ? "spinner" : "default"}
              onChange={onChange}
            />
          )}

          {Platform.OS === "ios" && (
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                onPress={handleCancelPicker}
                style={[styles.button, styles.cancelButton]}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleConfirmPicker}
                style={[styles.button, styles.confirmButton]}
              >
                <Text style={styles.buttonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          )}
          {Platform.OS === "android" &&
            !showDateTimePicker && ( // Show close button after Android picker closes
              <TouchableOpacity
                onPress={handleCancelPicker}
                style={[styles.button, styles.cancelButton]}
              >
                <Text style={styles.buttonText}>Close</Text>
              </TouchableOpacity>
            )}
        </View>
      );
    }
  };

  return (
    <Modal
      transparent={true}
      animationType="fade"
      visible={true} // This modal is always visible once MarkAsTakenTimePicker mounts
      onRequestClose={onCancel} // Android back button still calls onCancel
    >
      <View style={styles.overlay}>
        <View style={styles.container}>{renderContent()}</View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  container: {
    backgroundColor: "white",
    borderRadius: 10,
    padding: 20,
    alignItems: "center",
    width: "80%",
    maxWidth: 400,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
  },
  // Styles for the initial selection buttons
  selectionContainer: {
    width: "100%",
    alignItems: "center",
  },
  actionButton: {
    backgroundColor: "#007bff",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    width: "80%",
    marginVertical: 8,
    alignItems: "center",
  },
  actionButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  cancelAction: {
    backgroundColor: "#ccc",
    marginTop: 20,
  },
  cancelButtonText: {
    color: "black",
    fontSize: 16,
    fontWeight: "bold",
  },
  // Styles for the time picker view
  pickerContainer: {
    width: "100%",
    alignItems: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    marginTop: 20,
    justifyContent: "space-around",
    width: "100%",
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    minWidth: 100,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#ccc",
  },
  confirmButton: {
    backgroundColor: "#007bff",
  },
  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
});
