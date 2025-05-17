//HomeScreen.js
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
import { registerForPushNotifications } from "../utils/RegisterPushToken"; // Adjust the import path as necessary
import { scheduleMedicationReminder } from "../utils/notifications"; // Adjust the import path as necessary
import { sendMedicationNotification } from "../utils/SendNotification"; // Adjust the import path as necessary
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
  const [fullname, setFullname] = useState("");
  const [trackedPatientFullname, setTrackedPatientFullname] = useState("");
  const [meds, setMeds] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [selectedMed, setSelectedMed] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const user = auth.currentUser;
  const navigation = useNavigation();
  const route = useRoute();

  const onRefresh = async () => {
    try {
      setRefreshing(true);
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log("✅ Cleared all scheduled notifications.");
      // Re-trigger the data listener by manually calling the snapshot subscription logic if needed.
      // Or simply rely on the listener in useEffect to repopulate notifications next cycle.
    } catch (err) {
      console.error("❌ Failed to clear notifications:", err);
    } finally {
      setRefreshing(false);
    }
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <Ionicons
          name="menu"
          size={24}
          style={{ marginLeft: 15 }}
          onPress={() => navigation.openDrawer()}
        />
      ),
      title: "  MediMate",
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

          console.log("User full name fetcheddddd:", fullname);

          // 👇 Set patientId if user is a caregiver
          if (data.role === "caregiver" && data.trackedPatientId) {
            setPatientId(data.trackedPatientId);
            setTrackedPatientFullname(data.trackedPatientFullName); // Assuming you have this field in Firestore
            console.log(
              "Tracked patient ID set from Firestore:",
              data.trackedPatientId,
              data.trackedPatientFullname
            );
          }

          // 👇 Set patientId if user is a patient
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
    // Assuming `patientId` is the ID of the logged-in patient
    if (role === "patient" && patientId) {
      registerForPushNotifications(patientId);
      console.log("Push notifications registered for patient:", patientId);
    }
  }, [role, patientId]);

  const formatTo12Hour = (time24) => {
    const [hour, minute] = time24.split(":");
    const h = parseInt(hour);
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
      orderBy("time") // sort by ISO time
    );

    const unsubscribe = onSnapshot(q, async (querySnapshot) => {
      const grouped = {};
      const scheduledMedIds = new Set(); // To prevent duplicate scheduling

      for (const doc of querySnapshot.docs) {
        const med = { id: doc.id, ...doc.data() };
        // Ensure med.time exists
        if (!med.time) {
          console.warn(
            `Skipping medication with ID ${med.id} as it doesn't have a time.`
          );
          continue; // Skip this iteration if time is missing
        }

        // Format time into readable format
        const timeLabel =
          med.time ||
          new Date(med.isoTime).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

        if (!grouped[timeLabel]) grouped[timeLabel] = [];
        grouped[timeLabel].push(med);

        // ✅ Schedule recurring alarm if enabled
        if (med.enableAlarm && !scheduledMedIds.has(med.id)) {
          const [hour, minute] = med.time.split(":").map(Number);
          const reminderTime = new Date();
          reminderTime.setHours(hour);
          reminderTime.setMinutes(minute);
          reminderTime.setSeconds(0);
          reminderTime.setMilliseconds(0);

          /* schedule after render
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
          const d1 = new Date(`1970-01-01T${grouped[a][0].time}`);
          const d2 = new Date(`1970-01-01T${grouped[b][0].time}`);
          return d1 - d2;
        })
        .map((time) => ({
          title: time,
          data: grouped[time],
        }));

      setMeds(sections);
    });

    return unsubscribe;
  }, [role, patientId]);

  const markAsTaken = async (medId) => {
    const targetUID = role === "caregiver" ? patientId : user.uid;
    const medRef = doc(db, "medications", targetUID, "meds", medId);

    try {
      const medSnap = await getDoc(medRef);

      if (medSnap.exists()) {
        const data = medSnap.data();
        const isTaken = data.taken === true;

        await updateDoc(medRef, {
          taken: !isTaken,
        });

        showToast(
          !isTaken
            ? "Medication marked as taken!"
            : "Medication reverted to untaken."
        );
      }
    } catch (error) {
      console.error("Error toggling medication:", error);
      showToast("Failed to update medication.");
    }
  };

  const showToast = (message) => {
    if (Platform.OS === "android") {
      ToastAndroid.show(message, ToastAndroid.SHORT);
    } else {
      Alert.alert("Success", message);
    }
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
          {item.taken ? "Taken" : item.skipped ? "Skipped/Missed" : "Not Taken"}
        </Text>
      </View>
      <View style={styles.actions}>
        {role === "patient" && (
          <>
            <TouchableOpacity onPress={() => markAsTaken(item.id)}>
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
                          markAsTaken(selectedMed.id);
                        }}
                      >
                        <Ionicons name="checkmark" size={24} color="white" />
                      </TouchableOpacity>
                      <Text style={styles.circleLabel}>Taken</Text>
                    </View>

                    <View style={styles.circleButtonContainer}>
                      <TouchableOpacity
                        style={styles.circleButton}
                        onPress={async () => {
                          try {
                            const medRef = doc(
                              db,
                              "medications",
                              auth.currentUser.uid,
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
                                taken: false, // optional: keep as false when skipping
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
    backgroundColor: "#007bff", // Already here
    borderRadius: 30,
    padding: 15,
    zIndex: 10, // Ensure it's on top
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
