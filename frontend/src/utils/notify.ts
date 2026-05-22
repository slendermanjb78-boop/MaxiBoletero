import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { storage } from "@/src/utils/storage";

let configured = false;
const TONE_KEY = "erp_notification_tone_v1";

const readTone = async (): Promise<{ uri: string | null; name: string }> => {
  const raw = await storage.getItem<string>(TONE_KEY, "");
  if (!raw) return { uri: null, name: "Sonido del sistema" };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {}
  return { uri: null, name: "Sonido del sistema" };
};

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

  // Resolve user-selected tone (URI of mp3 stored locally). If unsupported by
  // the platform's notification system, we still schedule with default sound.
  const tone = await readTone();
  // On iOS we can pass a custom sound filename only if it was bundled with the
  // app at build time. With a user-picked file we fallback to default sound to
  // avoid runtime errors. On Android, custom sounds must be set on the channel
  // at creation time; we keep default channel sound here.
  // The picked tone is used reliably as an in-app preview (see settings screen).
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "💰 Aviso de cobro",
      body: `${concept} · $${amount.toLocaleString("es-AR")}`,
      sound: true,
      data: { type: "cobro", concept, amount, dueAtIso, toneUri: tone.uri },
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
