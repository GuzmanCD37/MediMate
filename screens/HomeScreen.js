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
} from "react-native";
import * as Notifications from "expo-notifications";

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
  const [meds, setMeds] = useState([]);
  const [patientId, setPatientId] = useState("");
  const [selectedMed, setSelectedMed] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);

  const user = auth.currentUser;
  const navigation = useNavigation();
  const route = useRoute();

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
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) setRole(docSnap.data().role);
    };

    if (user) {
      fetchRole();
    }
  }, [user]);

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

          try {
            await scheduleMedicationReminder(med.name, hour, minute);
            console.log(
              `xxxxScheduled notification for ${med.name} {hour: ${hour}, minute: ${minute}}`
            );
            console.log(reminderTime.setHours(reminderTime.setSeconds(0)));
            scheduledMedIds.add(med.id);
          } catch (err) {
            console.error("Failed to schedule notification:", err);
          }
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

  useFocusEffect(
    React.useCallback(() => {
      if (route.params?.scannedUID) {
        setPatientId(route.params?.scannedUID);
      }
    }, [route.params?.scannedUID])
  );

  const markAsTaken = async (medId) => {
    const targetUID = role === "caregiver" ? patientId : user.uid;
    const medRef = doc(db, "medications", targetUID, "meds", medId);

    try {
      const medSnap = await getDoc(medRef);

      if (medSnap.exists()) {
        const data = medSnap.data();
        const currentAmount = data.onHandAmount || 0;
        const isTaken = data.taken === true;

        const updatedAmount = isTaken
          ? currentAmount + 1 // revert: add back
          : Math.max(currentAmount - 1, 0); // take: subtract 1 but not below 0

        await updateDoc(medRef, {
          taken: !isTaken,
          onHandAmount: updatedAmount,
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
          Stock: {item.onHandAmount || "N/A"}
        </Text>
      </View>
      <View style={styles.actions}>
        {role === "patient" && (
          <>
            <TouchableOpacity onPress={() => markAsTaken(item.id)}>
              <Ionicons
                name="checkmark-circle"
                size={24}
                color={item.taken ? "green" : "gray"}
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
      <Text style={styles.title}>Welcome {role}</Text>

      {role === "patient" && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => {
            navigation.navigate("AddMedication");
          }}
        >
          <Ionicons name="add" size={30} color="#fff" />
        </TouchableOpacity>
      )}

      {role === "caregiver" && (
        <>
          <TouchableOpacity
            style={styles.button}
            onPress={() => navigation.navigate("QrScanner")}
          >
            <Text style={styles.buttonText}>Scan Patient QR Code</Text>
          </TouchableOpacity>
          {patientId ? <Text>Tracking Patient: {patientId}</Text> : null}
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
      />

      <Modal visible={modalVisible} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {selectedMed && (
              <>
                <Text style={styles.modalTitle}>{selectedMed.name}</Text>
                <Text>Start Date: {selectedMed.startDate}</Text>
                <Text>Time: {formatTo12Hour(selectedMed.time)}</Text>
                <Text>Frequency: {selectedMed.frequency}</Text>
                {selectedMed.interval && (
                  <Text>Interval: {selectedMed.interval}</Text>
                )}
                <Text>Total Amount: {selectedMed.totalAmount}</Text>
                <Button title="Close" onPress={() => setModalVisible(false)} />
                <Button
                  title="Delete"
                  color="red"
                  onPress={() => confirmDelete(selectedMed.name)}
                />

                <Button
                  title="Clear All Notifications"
                  color="red"
                  onPress={async () => {
                    try {
                      await Notifications.cancelAllScheduledNotificationsAsync();
                      console.log("✅ All notifications cleared.");
                      alert("All scheduled notifications have been cleared.");
                    } catch (error) {
                      console.error("❌ Failed to clear notifications:", error);
                    }
                  }}
                />
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
    borderRadius: 5,
    marginBottom: 10,
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
    padding: 20,
    borderRadius: 10,
    width: "80%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
  },
});
