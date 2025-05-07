import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// Schedule medication reminder

export async function scheduleMedicationReminder(medName, hour, minute) {
  try {
    console.log(
      `✅ notifJs Daily notification scheduled for ${medName} ${hour}:${minute}}`
    );

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Take your medication: ${medName}`,
        body: `It's time to take ${medName}`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      },
      trigger: {
        type: "daily", // ✅ This is crucial
        hour: hour,
        minute: minute,
        // channelId is optional, only if you’ve created a custom channel
      },
    });

    console.log(
      `✅ notifJs Daily notification scheduled for ${hour}:${minute} - ID: ${notificationId}`
    );
  } catch (error) {
    console.error(
      "❌ Failed to schedule daily notification:",
      error,
      medName,
      hour,
      minute
    );
  }
}
