import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let configured = false;

const configure = async () => {
  if (configured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("cobros", {
      name: "Avisos de Cobro",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1e5a91",
    });
  }
  configured = true;
};

export const ensureNotificationPermission = async (): Promise<boolean> => {
  await configure();
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  if (!settings.canAskAgain) return false;
  const ask = await Notifications.requestPermissionsAsync();
  return !!ask.granted;
};

export const scheduleReminder = async (
  concept: string,
  amount: number,
  dueAtIso: string,
): Promise<string | null> => {
  if (Platform.OS === "web") return null;
  await configure();
  const dueDate = new Date(dueAtIso);
  if (isNaN(dueDate.getTime()) || dueDate.getTime() < Date.now() + 1000) {
    return null; // can't schedule in the past
  }
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "💰 Aviso de cobro",
      body: `${concept} · $${amount.toLocaleString("es-AR")}`,
      sound: true,
      data: { type: "cobro", concept, amount, dueAtIso },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: dueDate,
      channelId: "cobros",
    } as any,
  });
  return id;
};

export const cancelReminder = async (notificationId?: string | null) => {
  if (!notificationId || Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {}
};
