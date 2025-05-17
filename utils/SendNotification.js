import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

// Sends push notification to patient
export async function sendMedicationNotification(patientUID, medName, time) {
  console.log(
    `✅ Sending notification to patient ${patientUID} for medication ${medName} at ${time}`
  );
  try {
    const userRef = doc(db, "users", patientUID);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      console.error("❌ Patient user not found");
      return;
    }

    const token = userSnap.data().expoPushToken;
    if (!token) {
      console.error("❌ Patient does not have a push token");
      return;
    }

    const message = {
      to: token,
      sound: "default",
      title: "Caregiver Alert",
      body: `Please take your medication: ${medName} at ${time}`,
    };

    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const data = await response.json();
    console.log("✅ Notification sent:", data);
  } catch (err) {
    console.error("❌ Failed to send notification:", err);
  }
}
