import React, { useState, useEffect, useLayoutEffect } from "react";
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  ToastAndroid,
  Alert,
  Platform,
  Modal,
  Button,
  RefreshControl,
} from "react-native";
import * as Notifications from "expo-notifications";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { registerForPushNotifications } from "../utils/RegisterPushToken";
import { scheduleMedicationReminder } from "../utils/notifications";
import { sendMedicationNotification } from "../utils/SendNotification";
import MarkAsTakenTimePicker from "../components/MarkAsTakenTimePicker"; // Corrected import path

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import { auth, db } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  collection,
  orderBy,
  getDocs,
  deleteDoc,
} from "firebase/firestore";

export default function HomeScreen() {
  const [role, setRole] = useState(null);
  const [username, setUsername] = useState("");
  const [fullname, setFullname] = useState(""); // This state still seems unused
  const [trackedPatientFullname, setTrackedPatientFullname] = useState("");
  const [meds, setMeds] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [selectedMed, setSelectedMed] = useState(null);
  const [isPickerVisible, setIsPickerVisible] = useState(false); // Controls visibility of the NEW MarkAsTakenTimePicker modal
  const [modalVisible, setModalVisible] = useState(false); // Controls visibility of the main medication details modal
  const [refreshing, setRefreshing] = useState(false);

  const user = auth.currentUser;
  const navigation = useNavigation();
  const route = useRoute();

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log("✅ Cleared all scheduled notifications.");
    } catch (err) {
      console.error("❌ Failed to clear notifications:", err);
    } finally {
      setRefreshing(false);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity
          onPress={() => navigation.toggleDrawer()}
          style={{ marginLeft: 2 }}
        >
          <Ionicons
            name="menu"
            size={24}
            style={{ marginLeft: 15, color: "white" }}
          />
        </TouchableOpacity>
      ),
      title: "   MediMate",
    });
  }, [navigation]);

  useEffect(() => {
    const fetchRole = async () => {
      const userRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(userRef);
      try {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setRole(data.role);
          setUsername(data.firstName);

          // Set patientId if user is a caregiver
          if (data.role === "caregiver" && data.trackedPatientId) {
            setPatientId(data.trackedPatientId);
            setTrackedPatientFullname(data.trackedPatientFullName);
            console.log(
              "Tracked patient ID set from Firestore:",
              data.trackedPatientId,
              data.trackedPatientFullname
            );
          }

          // Set patientId if user is a patient
          if (data.role === "patient") {
            setPatientId(user.uid);
          }
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
      }
    };
    fetchRole();
  }, [role, user.uid]);

  useEffect(() => {
    if (role === "patient" && patientId) {
      registerForPushNotifications(patientId);
      console.log("Push notifications registered for patient:", patientId);
    }
  }, [role, patientId]);

  // Helper to format 24-hour time string or Date object to 12-hour
  const formatTo12Hour = (timeInput) => {
    if (!timeInput) return "";

    let dateObj;
    if (
      typeof timeInput === "string" &&
      timeInput.includes(":") &&
      timeInput.length <= 5
    ) {
      // It's a "HH:MM" string
      const [hour, minute] = timeInput.split(":");
      dateObj = new Date(); // Use current date for simplicity, time will be set
      dateObj.setHours(parseInt(hour));
      dateObj.setMinutes(parseInt(minute));
      dateObj.setSeconds(0);
      dateObj.setMilliseconds(0);
    } else {
      // Assume it's an ISO string or Date object
      dateObj = new Date(timeInput);
    }

    if (isNaN(dateObj.getTime())) {
      // Check for invalid date
      console.warn("Invalid date/time input to formatTo12Hour:", timeInput);
      return timeInput; // Return original if invalid
    }

    const h = dateObj.getHours();
    const minute = dateObj.getMinutes().toString().padStart(2, "0");
    const suffix = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${minute} ${suffix}`;
  };

  useEffect(() => {
    if (!role) return;
    const targetUID = role === "caregiver" ? patientId : user.uid;
    if (!targetUID) return;

    const q = query(
      collection(db, "medications", targetUID, "meds"),
      orderBy("time")
    );

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const grouped = {};
      const scheduledMedIds = new Set(); // To prevent duplicate scheduling

      for (const doc of querySnapshot.docs) {
        const med = { id: doc.id, ...doc.data() };
        if (!med.time) {
          console.warn(
            `Skipping medication with ID ${med.id} as it doesn't have a time.`
          );
          continue;
        }

        const timeLabel = med.time; // Group by the scheduled time
        if (!grouped[timeLabel]) grouped[timeLabel] = [];
        grouped[timeLabel].push(med);

        // ✅ Schedule recurring alarm if enabled and not already scheduled for this session
        // (You might want to refine this to only schedule if not already taken/skipped,
        // and if it's due in the future, and add proper notification cancellation/rescheduling logic)
        if (med.enableAlarm && !scheduledMedIds.has(med.id)) {
          const [hour, minute] = med.time.split(":").map(Number);
          // Example: schedule after render
          /*
          try {
            await scheduleMedicationReminder(med.name, hour, minute);
            scheduledMedIds.add(med.id);
          } catch (err) {
            console.error("Failed to schedule notification:", err);
          }
          */
        }
      }

      const sections = Object.keys(grouped)
        .sort((a, b) => {
          // Sort by the actual time string (HH:MM)
          const d1 = new Date(`1970-01-01T${a}`);
          const d2 = new Date(`1970-01-01T${b}`);
          return d1 - d2;
        })
        .map((time) => ({
          title: time, // The 24-hour time string
          data: grouped[time],
        }));

      setMeds(sections);
    });

    return unsubscribe;
  }, [role, patientId]);

  const showToast = (message) => {
    if (Platform.OS === "android") {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert("Success", message);
    }
  };

  // NEW: Function to handle confirming the taken time from the picker
  const handleConfirmTakenTime = async (time) => {
    setIsPickerVisible(false); // Hide the picker modal
    //setModalVisible(true); // Re-open the main medication details modal

    if (!selectedMed) return;

    const targetUID = role === "caregiver" ? patientId : user.uid;
    const medRef = doc(db, "medications", targetUID, "meds", selectedMed.id);

    try {
      const medSnap = await getDoc(medRef);
      if (medSnap.exists()) {
        const data = medSnap.data();
        const isCurrentlyTaken = data.taken || false;

        let updateData = {};

        // If 'time' is explicitly null, it means we are untaking the medication
        if (time === null) {
          updateData = {
            taken: false,
            takenAt: null, // Clear takenAt timestamp
            skipped: false, // Ensure not skipped if untaking
          };
          showToast("Medication reverted to untaken.");
        } else if (isCurrentlyTaken) {
          // If already taken, and a time is provided, treat it as an update to the taken time
          // This path is less likely with the new "Now/Pick Time" choice,
          // but good to keep for robustness if we were to allow editing the takenAt directly.
          // For now, if "Taken" is pressed on an already taken med, it untakes.
          // The `time` here would come from `MarkAsTakenTimePicker` if it was used for editing.
          // If the user *mistakenly* pressed "Taken", they'd usually just press it again to untake.
          // We'll primarily use the `time === null` path for untaking.
          updateData = {
            taken: true,
            takenAt: time.toISOString(), // Store as ISO string
            skipped: false,
          };
          showToast("Medication taken time updated!");
        } else {
          // If not taken, mark as taken with the specified time
          updateData = {
            taken: true,
            takenAt: time.toISOString(), // Store as ISO string
            skipped: false, // Cannot be skipped if taken
          };
          showToast("Medication marked as taken!");
        }
        await updateDoc(medRef, updateData);
      } else {
        console.warn("Medication not found for update:", selectedMed.id);
        showToast("Failed to update medication: Not found.");
      }
    } catch (error) {
      console.error("Error updating medication taken status:", error);
      showToast("Failed to update medication.");
    }
  };

  // Function to open the time picker modal
  const openTakenTimePicker = (med) => {
    setSelectedMed(med); // Set the medication to be acted upon
    setIsPickerVisible(true); // Show the time picker modal
    setModalVisible(false); // Hide the main modal when picker opens
  };

  const handleDeleteMedication = async (medName) => {
    const targetUID = role === "caregiver" ? patientId : user.uid;

    try {
      const medsRef = collection(db, "medications", targetUID, "meds");
      const querySnapshot = await getDocs(medsRef);

      const matchingDocs = querySnapshot.docs.filter(
        (doc) => doc.data().name === medName
      );

      if (matchingDocs.length === 0) {
        showToast("No medications found with this name.");
        return;
      }

      for (const docSnap of matchingDocs) {
        await deleteDoc(docSnap.ref);
      }

      showToast(`Deleted all entries for "${medName}"`);
      setModalVisible(false); // Close modal
    } catch (error) {
      console.error("Error deleting medication:", error);
      showToast("Failed to delete medication.");
    }
  };

  const confirmDelete = (name) => {
    Alert.alert(
      "Delete Medication",
      `Are you sure you want to delete all entries for "${name}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => handleDeleteMedication(name),
        },
      ]
    );
  };

  const renderMedItem = ({ item, index }) => (
    <TouchableOpacity
      style={styles.medItemRow}
      onPress={() => {
        setSelectedMed(item);
        setModalVisible(true);
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.medItemText}>{item.name}</Text>
        <Text style={styles.stockText}>
          Status:{" "}
          {item.taken
            ? `Taken at ${formatTo12Hour(item.takenAt || item.time)}` // Display takenAt or original time
            : item.skipped
              ? "Skipped/Missed"
              : "Not Taken"}
        </Text>
      </View>
      <View style={styles.actions}>
        {role === "patient" && (
          <>
            {/* This button toggles the "Taken" status directly from the list view */}
            <TouchableOpacity
              onPress={() => {
                if (item.taken) {
                  // If already taken, allow untaking directly from list view
                  // We pass null to handleConfirmTakenTime to signal untake
                  setSelectedMed(item); // Ensure selectedMed is set for the handler
                  handleConfirmTakenTime(null);
                } else {
                  // If not taken, open the "Now/Pick Time" picker
                  openTakenTimePicker(item);
                }
              }}
            >
              <Ionicons
                name={item.skipped ? "close-circle" : "checkmark-circle"}
                size={30}
                color={
                  item.skipped ? "orange" : item.taken ? "#60CD01" : "grey"
                }
              />
            </TouchableOpacity>
          </>
        )}

        {role === "caregiver" && patientId && (
          <TouchableOpacity
            onPress={() => {
              console.log(
                "Sending notification...",
                patientId,
                item.name,
                formatTo12Hour(item.time)
              );
              sendMedicationNotification(
                patientId,
                item.name,
                formatTo12Hour(item.time)
              );
            }}
          >
            <Ionicons name="notifications" size={24} color="purple" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Welcome {username}</Text>

      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          navigation.navigate("AddMedication");
        }}
      >
        <Ionicons name="add" size={30} color="#fff" />
      </TouchableOpacity>

      {role === "caregiver" && (
        <>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate("QrScanner")}
          >
            <Text style={styles.buttonText}>Scan Patient QR Code</Text>
          </TouchableOpacity>
          {patientId ? (
            <Text>Tracking Patient: {trackedPatientFullname}</Text>
          ) : null}
        </>
      )}

      <Text style={styles.subtitle}>Medications:</Text>
      <SectionList
        sections={meds}
        keyExtractor={(item) => item.id}
        renderItem={renderMedItem}
        renderSectionHeader={({ section: { title } }) => (
          <Text style={styles.sectionHeader}>{formatTo12Hour(title)}</Text>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />

      {/* Main Medication Details Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Top Buttons */}
            <View style={styles.modalTopButtons}>
              {/* Edit button (top-left) */}
              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  navigation.navigate("EditMedication", {
                    medId: selectedMed.id,
                  });
                }}
                style={{ position: "absolute", top: 10, left: 10 }}
              >
                <Ionicons name="create-outline" size={26} color="#007bff" />
              </TouchableOpacity>

              {/* Delete button (top-right, before close) */}
              <TouchableOpacity
                onPress={() => confirmDelete(selectedMed.name)}
                style={{ position: "absolute", top: 10, left: 45 }}
              >
                <Ionicons name="trash-outline" size={23} color="red" />
              </TouchableOpacity>

              {/* Close button (top-right) */}
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={{ position: "absolute", top: 10, right: 10 }}
              >
                <Ionicons name="close" size={28} color="black" />
              </TouchableOpacity>
            </View>

            {/* Medication Info */}
            {selectedMed && (
              <>
                <Text style={styles.modalTitle}>{selectedMed.name}</Text>
                {selectedMed.description && (
                  <Text>Description/Notes: {selectedMed.description}</Text>
                )}
                <Text>Start Date: {selectedMed.startDate}</Text>
                <Text>Time: {formatTo12Hour(selectedMed.time)}</Text>
                <Text>Frequency: {selectedMed.frequency}</Text>
                {selectedMed.interval && (
                  <Text>Interval: {selectedMed.interval}</Text>
                )}
                {selectedMed.prescribedAmt && (
                  <Text>Prescribed Amount: {selectedMed.prescribedAmt}</Text>
                )}
                {selectedMed.taken && selectedMed.takenAt && (
                  <Text
                    style={{
                      marginTop: 10,
                      fontWeight: "bold",
                      color: "#60CD01",
                    }}
                  >
                    Taken At: {formatTo12Hour(selectedMed.takenAt)}
                  </Text>
                )}

                {/* Bottom Action Buttons */}
                {role === "patient" && (
                  <View style={[styles.modalActions]}>
                    <View style={styles.circleButtonContainer}>
                      <TouchableOpacity
                        style={[
                          styles.circleButton,
                          selectedMed.taken && { backgroundColor: "#60CD01" },
                        ]}
                        onPress={() => {
                          if (selectedMed.taken) {
                            // If already taken, allow untaking directly from modal
                            Alert.alert(
                              "Revert Medication",
                              "Are you sure you want to mark this medication as untaken?",
                              [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Untake",
                                  style: "destructive",
                                  onPress: () => handleConfirmTakenTime(null), // Pass null to signal untake
                                },
                              ]
                            );
                          } else {
                            // If not taken, open time picker
                            openTakenTimePicker(selectedMed);
                          }
                        }}
                      >
                        <Ionicons name="checkmark" size={24} color="white" />
                      </TouchableOpacity>
                      <Text style={styles.circleLabel}>Taken</Text>
                    </View>

                    <View style={styles.circleButtonContainer}>
                      <TouchableOpacity
                        style={[
                          styles.circleButton,
                          selectedMed.skipped && { backgroundColor: "orange" },
                        ]}
                        onPress={async () => {
                          try {
                            const target =
                              role === "caregiver"
                                ? patientId
                                : auth.currentUser.uid;
                            const medRef = doc(
                              db,
                              "medications",
                              target,
                              "meds",
                              selectedMed.id
                            );

                            const medSnap = await getDoc(medRef);
                            if (medSnap.exists()) {
                              const currentSkipped =
                                medSnap.data().skipped || false;
                              const newSkipped = !currentSkipped;

                              await updateDoc(medRef, {
                                skipped: newSkipped,
                                taken: false, // Ensure not taken if skipping
                                takenAt: null, // Clear takenAt if skipping
                              });

                              showToast(
                                `Medication marked as ${newSkipped ? "skipped" : "not skipped"}.`
                              );
                              setModalVisible(false);
                            } else {
                              console.error("Medication not found");
                            }
                          } catch (error) {
                            console.error(
                              "Error toggling skipped value:",
                              error
                            );
                          }
                        }}
                      >
                        <Ionicons name="close" size={24} color="white" />
                      </TouchableOpacity>

                      <Text style={styles.circleLabel}>
                        {selectedMed.skipped ? "Skipped" : "Skip"}
                      </Text>
                    </View>

                    {selectedMed.refillReminder && (
                      <View style={styles.circleButtonContainer}>
                        <TouchableOpacity
                          style={styles.circleButton}
                          onPress={() => {
                            showToast("Refill button clicked");
                            setModalVisible(false);
                          }}
                        >
                          <Ionicons name="repeat" size={24} color="white" />
                        </TouchableOpacity>
                        <Text style={styles.circleLabel}>Refill</Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MarkAsTakenTimePicker Modal - only visible when triggered */}
      {isPickerVisible && selectedMed && (
        <MarkAsTakenTimePicker
          initialTime={
            selectedMed.takenAt ? new Date(selectedMed.takenAt) : new Date()
          }
          onConfirm={handleConfirmTakenTime}
          onCancel={() => {
            setIsPickerVisible(false);
            setModalVisible(true); // Re-open the main modal if the picker is cancelled
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 15,
    backgroundColor: "#f0f0f0",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  fab: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#007bff",
    borderRadius: 30,
    padding: 15,
    zIndex: 10,
  },
  button: {
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 5,
    marginVertical: 10,
  },
  buttonText: {
    color: "#fff",
    fontSize: 18,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginVertical: 10,
  },
  medItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    padding: 10,
    height: 70,
    borderRadius: 5,
    marginBottom: 20,
  },
  medItemText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  stockText: {
    fontSize: 14,
    color: "#888",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
  },
  sectionHeader: {
    backgroundColor: "#f8f8f8",
    padding: 10,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContainer: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 10,
    width: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
  modalTopButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 40,
    padding: 5,
    marginTop: -10,
    marginLeft: -10,
    marginRight: -10,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
  },
  circleButtonContainer: {
    alignItems: "center",
  },
  circleButton: {
    backgroundColor: "#007bff",
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  circleLabel: {
    marginTop: 5,
    fontSize: 17,
  },
});
