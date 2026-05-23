import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

let configured = false;
const CHANNEL_ID = "cobros";

const configure = async () => {
  if (configured) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  } catch {}

  if (Platform.OS === "android") {
    try {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Avisos de Cobro",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#1e5a91",
        // Use the default system notification sound for maximum
        // compatibility. Dynamic per-file channels were causing Gradle
        // and runtime URI permission issues; we keep the in-app preview
        // (expo-av) so the user can still hear the chosen tone in Ajustes.
      });
    } catch {}
  }
  configured = true;
};

/**
 * Kept exported for backwards compatibility with the Ajustes screen.
 * In this simplified setup, no per-tone channel is created at runtime —
 * the notification always uses the system default sound (`sound: true`).
 * The user's chosen .mp3 still plays inside the app via the preview button.
 */
export const ensureToneChannel = async (
  _toneUri: string | null,
  _toneName: string,
): Promise<string> => {
  await configure();
  return CHANNEL_ID;
};

export const ensureNotificationPermission = async (): Promise<boolean> => {
  await configure();
  try {
    const settings = await Notifications.getPermissionsAsync();
    if (settings.granted) return true;
    if (!settings.canAskAgain) return false;
    const ask = await Notifications.requestPermissionsAsync();
    return !!ask.granted;
  } catch {
    return false;
  }
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
    return null;
  }
  try {
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
        channelId: CHANNEL_ID,
      } as any,
    });
    return id;
  } catch {
    return null;
  }
};

export const cancelReminder = async (notificationId?: string | null) => {
  if (!notificationId || Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {}
};
