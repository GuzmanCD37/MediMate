import * as Notifications from "expo-notifications";
import React, { useEffect, useState } from "react";
import { LogBox, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function AlarmClock() {
  const [alarmTime, setAlarmTime] = useState(null);
  const [alarmTitle, setAlarmTitle] = useState(null);
  const notificationListener = useRef();
  const [notification, setNotification] = useState(false);
  const [hourr, setHour] = useState("");
  const [minutes, setMinute] = useState("");
  const [ampm, setAmPm] = useState("");
  const [notificationId, setNotificationId] = useState(none);

  useEffect(() => {
    getData();
    notificationListener.current =
      Notifications.addNotificationReceivedListener((notification) => {
        setNotification(notification);
      });
    return () => {
      Notifications.removeNotificationSubscription(
        notificationListener.current
      );
    };

    const setupNotifications = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== "granted") {
        alert("Permission for notifications not granted.");
      }

      if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("medications", {
          name: "Medication Reminders",
          importance: Notifications.AndroidImportance.HIGH,
          sound: "default",
        });
      }
    };

    setupNotifications();
  }, []);

  let date = new Date();
  date.setSeconds(date.getSeconds() + 5);

  async function scheduleNotificationsHandler() {
    console.log(notificationId);
    if (notificationId === none) {
      var newHourr = parseInt(hourr);
      if (ampm === "pm") {
        newHourr = newHourr + 12;
      }
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: "Medication Reminder",
          body: `Time to take ${alarmTitle}`,
          sound: "default",
        },
        trigger: {
          hour: newHourr,
          minute: parseInt(minutes),
          repeats: true,
        },
      });
      setAmPm("");
      setHour("");
      setMinute("");
      console.log(date);
      console.log(identifier);
      setNotificationId(identifier);
      storeData(identifier);
    } else {
      console.log("Alarm already set");
      setAmPm("");
      setHour("");
      setMinute("");
      console.log(notificationId);
      console.log("Not working");
    }
  }

  return null;
}
