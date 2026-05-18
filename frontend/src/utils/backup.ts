import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import { Platform } from "react-native";
import type { AppData } from "@/src/store/store";

const BACKUP_VERSION = 1;
const APP_ID = "gestion-contable-pro";

export interface BackupFile {
  app: string;
  version: number;
  exportedAt: string;
  data: AppData;
}

const stripPhotos = (data: AppData): AppData => ({
  clients: data.clients.map((c) => ({
    ...c,
    entries: c.entries.map((e) => ({ ...e, photo: null })),
  })),
  providers: data.providers.map((p) => ({
    ...p,
    entries: p.entries.map((e) => ({ ...e, photo: null })),
  })),
  repartos: data.repartos.map((r) => ({ ...r })),
});

export const exportBackup = async (
  data: AppData,
  includePhotos: boolean,
): Promise<void> => {
  const payload: BackupFile = {
    app: APP_ID,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    data: includePhotos ? data : stripPhotos(data),
  };
  const json = JSON.stringify(payload);
  const ts = new Date().toISOString().slice(0, 10);
  const filename = `gestion-contable-${ts}.json`;

  if (Platform.OS === "web") {
    // browser download
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, json, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/json",
      dialogTitle: "Compartir respaldo",
      UTI: "public.json",
    });
  }
};

export const pickAndParseBackup = async (): Promise<BackupFile | null> => {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "text/plain", "*/*"],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];

  let text: string;
  if (Platform.OS === "web") {
    if (!asset.file) throw new Error("Archivo inválido");
    text = await asset.file.text();
  } else {
    text = await FileSystem.readAsStringAsync(asset.uri, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  const parsed = JSON.parse(text) as BackupFile;
  if (!parsed || parsed.app !== APP_ID || !parsed.data) {
    throw new Error("El archivo no es un respaldo válido de Gestión Contable Pro");
  }
  if (
    !Array.isArray(parsed.data.clients) ||
    !Array.isArray(parsed.data.providers) ||
    !Array.isArray(parsed.data.repartos)
  ) {
    throw new Error("Estructura del respaldo inválida");
  }
  return parsed;
};
