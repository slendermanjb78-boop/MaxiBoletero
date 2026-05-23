import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import { storage } from "@/src/utils/storage";

let configured = false;
const TONE_KEY = "erp_notification_tone_v1";
const CHANNEL_ID_KEY = "erp_notification_channel_v1";
const DEFAULT_CHANNEL_ID = "cobros";

// ---------- Helpers ----------
const readTone = async (): Promise<{ uri: string | null; name: string }> => {
  const raw = await storage.getItem<string>(TONE_KEY, "");
  if (!raw) return { uri: null, name: "Sonido del sistema" };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") return parsed;
  } catch {}
  return { uri: null, name: "Sonido del sistema" };
};

const getStoredChannelId = async (): Promise<string> => {
  const saved = await storage.getItem<string>(CHANNEL_ID_KEY, "");
  return saved || DEFAULT_CHANNEL_ID;
};

const setStoredChannelId = async (id: string) => {
  await storage.setItem(CHANNEL_ID_KEY, id);
};

const fileExists = async (uri: string | null): Promise<boolean> => {
  if (!uri) return false;
  try {
    const info = await FileSystem.getInfoAsync(uri);
    return !!info.exists;
  } catch {
    return false;
  }
};

const sanitizeId = (s: string) =>
  s.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_]/g, "_").slice(0, 24) || "tono";

const ensureDefaultChannel = async () => {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: "Avisos de Cobro",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#1e5a91",
  });
};

// ---------- Public API ----------

/**
 * Creates a fresh Android notification channel whose default sound is the
 * provided file URI (file://...). Each call uses a UNIQUE id because Android
 * does NOT allow changing the sound of an existing channel.
 *
 * - If `toneUri` is null/missing/inaccessible, the default channel is used.
 * - The previous custom channel (if any) is deleted.
 * - The chosen channel id is persisted so future notifications use it even
 *   after app restart.
 *
 * Safe to call on iOS / web — it returns the default id and no-ops.
 */
export const ensureToneChannel = async (
  toneUri: string | null,
  toneName: string,
): Promise<string> => {
  if (Platform.OS !== "android") {
    await setStoredChannelId(DEFAULT_CHANNEL_ID);
    return DEFAULT_CHANNEL_ID;
  }

  // Always make sure the default channel exists as a fallback
  await ensureDefaultChannel();

  // Delete any previous custom channel
  const prev = await getStoredChannelId();
  if (prev && prev !== DEFAULT_CHANNEL_ID) {
    try {
      await Notifications.deleteNotificationChannelAsync(prev);
    } catch {}
  }

  // No tone selected → fall back to default
  if (!toneUri) {
    await setStoredChannelId(DEFAULT_CHANNEL_ID);
    return DEFAULT_CHANNEL_ID;
  }

  // The file must still be present on disk
  const exists = await fileExists(toneUri);
  if (!exists) {
    await setStoredChannelId(DEFAULT_CHANNEL_ID);
    return DEFAULT_CHANNEL_ID;
  }

  // Build a unique channel id based on file name + timestamp
  const channelId = `cobros_${sanitizeId(toneName || "tono")}_${Date.now()}`;

  try {
    await Notifications.setNotificationChannelAsync(channelId, {
      name: `Avisos de Cobro · ${toneName || "tono"}`.slice(0, 40),
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#1e5a91",
      // Android accepts a file:// URI directly. If the OS cannot read it
      // (e.g. file moved/deleted later) the channel will fall back to its
      // default sound silently — handled by `fileExists` above too.
      sound: toneUri,
    });
    await setStoredChannelId(channelId);
    return channelId;
  } catch {
    // Channel creation failed → fall back to default
    await setStoredChannelId(DEFAULT_CHANNEL_ID);
    return DEFAULT_CHANNEL_ID;
  }
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
    await ensureDefaultChannel();
    // Recreate the saved custom channel after app restart (so the sound URI
    // is registered in the system again — safe even if the file vanished:
    // it will fall back to default).
    const tone = await readTone();
    if (tone.uri) {
      await ensureToneChannel(tone.uri, tone.name);
    }
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
    return null;
  }

  // Resolve user-selected tone — and verify the file still exists.
  // If the file vanished, recreate the channel as default so the notification
  // still fires with the system sound.
  const tone = await readTone();
  let channelId = await getStoredChannelId();
  if (Platform.OS === "android" && tone.uri) {
    const stillThere = await fileExists(tone.uri);
    if (!stillThere) {
      // Self-heal: the user deleted the .mp3 → rebuild as default channel
      channelId = await ensureToneChannel(null, "");
    } else if (channelId === DEFAULT_CHANNEL_ID) {
      // Tone saved but no custom channel? Recreate it.
      channelId = await ensureToneChannel(tone.uri, tone.name);
    }
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "💰 Aviso de cobro",
        body: `${concept} · $${amount.toLocaleString("es-AR")}`,
        sound: true,
        data: {
          type: "cobro",
          concept,
          amount,
          dueAtIso,
          toneUri: tone.uri,
          channelId,
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: dueDate,
        channelId,
      } as any,
    });
    return id;
  } catch {
    // Fallback: if scheduling with the custom channel failed for any reason,
    // try once more with the default channel.
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: "💰 Aviso de cobro",
          body: `${concept} · $${amount.toLocaleString("es-AR")}`,
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: dueDate,
          channelId: DEFAULT_CHANNEL_ID,
        } as any,
      });
      return id;
    } catch {
      return null;
    }
  }
};

export const cancelReminder = async (notificationId?: string | null) => {
  if (!notificationId || Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {}
};
