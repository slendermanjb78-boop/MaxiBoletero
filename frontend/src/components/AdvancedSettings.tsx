import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  Alert,
  ScrollView,
} from "react-native";
import Slider from "@react-native-community/slider";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";

import {
  useTheme,
  ThemeColors,
  hexToRgb,
  rgbToHex,
  contrastOn,
  NotificationTone,
} from "@/src/theme/theme";

// Lazy native modules — required ONLY when the user opens the tone picker,
// never at app startup. Keeps the cold start safe even if a native module
// fails to load (the rest of the app still runs).
const lazyDocPicker = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-document-picker");
  } catch {
    return null;
  }
};
const lazyFS = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-file-system/legacy");
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require("expo-file-system");
    } catch {
      return null;
    }
  }
};
const lazyAudio = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("expo-audio");
  } catch {
    return null;
  }
};
const lazyNotify = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("@/src/utils/notify");
  } catch {
    return null;
  }
};

const documentDirectory = (): string => {
  try {
    return lazyFS()?.documentDirectory || "";
  } catch {
    return "";
  }
};

// Local copy of picked audio (we keep it in app's documentDirectory so the
// URI stays valid across launches). Computed lazily.
const audioDir = () => documentDirectory() + "tones/";

const ensureDir = async () => {
  try {
    const fs = lazyFS();
    if (!fs?.getInfoAsync) return;
    const dir = audioDir();
    const info = await fs.getInfoAsync(dir);
    if (!info.exists) {
      await fs.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch {}
};

const sanitizeName = (name: string) =>
  name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60) || "tono.mp3";

// ---------- RGB Color Picker ----------
function ColorPicker({
  C,
  value,
  onChange,
  onReset,
}: {
  C: ThemeColors;
  value: string;
  onChange: (hex: string) => void;
  onReset: () => void;
}) {
  const { r, g, b } = hexToRgb(value);
  const ink = contrastOn(value);

  const setChannel = (which: "r" | "g" | "b", v: number) => {
    const next = { r, g, b, [which]: Math.round(v) } as any;
    onChange(rgbToHex(next.r, next.g, next.b));
  };

  const channel = (label: string, color: string, val: number, which: "r" | "g" | "b") => (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 2 }}>
        <Text style={[styles.chLabel, { color }]}>{label}</Text>
        <Text style={[styles.chValue, { color: C.muted }]}>{val}</Text>
      </View>
      <Slider
        style={{ width: "100%", height: 32 }}
        minimumValue={0}
        maximumValue={255}
        step={1}
        value={val}
        onValueChange={(v) => setChannel(which, v)}
        minimumTrackTintColor={color}
        maximumTrackTintColor={C.border}
        thumbTintColor={color}
      />
    </View>
  );

  return (
    <View>
      {/* Preview */}
      <View
        style={[
          styles.preview,
          { backgroundColor: value, borderColor: C.border },
        ]}
      >
        <View>
          <Text style={[styles.previewTitle, { color: ink }]}>Vista previa</Text>
          <Text style={[styles.previewHex, { color: ink, opacity: 0.85 }]}>{value.toUpperCase()}</Text>
        </View>
        <View style={[styles.previewChip, { backgroundColor: ink + "22", borderColor: ink + "55" }]}>
          <MaterialCommunityIcons name="palette" size={16} color={ink} />
          <Text style={{ color: ink, fontWeight: "700", marginLeft: 6 }}>Acento</Text>
        </View>
      </View>

      <View style={{ height: 14 }} />

      {channel("Rojo (R)", "#ef4444", r, "r")}
      {channel("Verde (G)", "#22c55e", g, "g")}
      {channel("Azul (B)", "#3b82f6", b, "b")}

      <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
        <TouchableOpacity
          onPress={onReset}
          style={[styles.smallBtn, { backgroundColor: C.borderLight, borderColor: C.border }]}
          activeOpacity={0.8}
          testID="btn-reset-accent"
        >
          <Feather name="rotate-ccw" size={14} color={C.text} />
          <Text style={[styles.smallBtnText, { color: C.text }]}>Restablecer</Text>
        </TouchableOpacity>
      </View>

      {/* Quick palette */}
      <Text style={[styles.subLabel, { color: C.muted, marginTop: 14 }]}>Paleta rápida</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
        {[
          "#2563eb", "#0ea5e9", "#10b981", "#22c55e",
          "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6",
          "#14b8a6", "#0f172a",
        ].map((c) => {
          const selected = c.toLowerCase() === value.toLowerCase();
          return (
            <TouchableOpacity
              key={c}
              onPress={() => onChange(c)}
              style={[
                styles.swatch,
                {
                  backgroundColor: c,
                  borderColor: selected ? C.ink : "transparent",
                  borderWidth: selected ? 3 : 2,
                },
              ]}
              testID={`swatch-${c}`}
            />
          );
        })}
      </View>
    </View>
  );
}

// ---------- Tone Picker ----------
function TonePicker({
  C,
  tone,
  onChange,
}: {
  C: ThemeColors;
  tone: NotificationTone;
  onChange: (t: NotificationTone) => void;
}) {
  const [picking, setPicking] = useState(false);
  // Imperative audio player — created/destroyed ONLY when the user taps play.
  // We deliberately avoid `useAudioPlayer(null)` because some Android builds
  // can crash at mount when the source is null/undefined.
  const activePlayerRef = useRef<any>(null);

  // Make sure we stop & free any leftover player on unmount.
  useEffect(() => {
    return () => {
      try {
        activePlayerRef.current?.pause?.();
        activePlayerRef.current?.remove?.();
      } catch {}
      activePlayerRef.current = null;
    };
  }, []);

  const playPreview = useCallback(async () => {
    if (!tone.uri) {
      Alert.alert(
        "Sonido del sistema",
        "Cuando llegue el aviso de cobro sonará el tono por defecto del dispositivo.",
      );
      return;
    }
    // Tear down any previous player first
    try {
      activePlayerRef.current?.pause?.();
      activePlayerRef.current?.remove?.();
    } catch {}
    activePlayerRef.current = null;

    try {
      const Audio = lazyAudio();
      if (!Audio?.createAudioPlayer) {
        Alert.alert(
          "Audio no disponible",
          "El módulo de audio no se pudo cargar en este dispositivo.",
        );
        return;
      }
      const p = Audio.createAudioPlayer({ uri: tone.uri });
      activePlayerRef.current = p;
      try { p.seekTo(0); } catch {}
      try { p.play(); } catch {}
      setTimeout(() => {
        try { p.pause(); p.remove?.(); } catch {}
        if (activePlayerRef.current === p) activePlayerRef.current = null;
      }, 2200);
    } catch (e: any) {
      Alert.alert("No se pudo reproducir", e?.message || "Error desconocido");
    }
  }, [tone.uri]);

  const pickFile = async () => {
    try {
      setPicking(true);
      const DocumentPicker = lazyDocPicker();
      if (!DocumentPicker?.getDocumentAsync) {
        setPicking(false);
        Alert.alert("No disponible", "El selector de archivos no se pudo cargar.");
        return;
      }
      const res = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (res.canceled || !res.assets || res.assets.length === 0) {
        setPicking(false);
        return;
      }
      const asset = res.assets[0];
      const srcUri = asset.uri;
      const name = sanitizeName(asset.name || "tono.mp3");

      // Persist a copy inside app's documents to keep URI valid
      let finalUri = srcUri;
      try {
        const fs = lazyFS();
        if (fs?.copyAsync) {
          await ensureDir();
          const dest = audioDir() + Date.now() + "_" + name;
          await fs.copyAsync({ from: srcUri, to: dest });
          finalUri = dest;
        }
      } catch {
        // fallback to original URI if copy fails (still usable while session lasts)
      }
      onChange({ uri: finalUri, name: asset.name || name });
      // Recreate Android notification channel pointing to the new sound URI
      // so the system plays it when an aviso fires (even in background).
      try {
        const notify = lazyNotify();
        if (notify?.ensureToneChannel) {
          await notify.ensureToneChannel(finalUri, asset.name || name);
        }
      } catch {}
      setPicking(false);
    } catch (e: any) {
      setPicking(false);
      Alert.alert("Error", e?.message || "No se pudo cargar el archivo.");
    }
  };

  const clearTone = async () => {
    onChange({ uri: null, name: "Sonido del sistema" });
    try {
      const notify = lazyNotify();
      if (notify?.ensureToneChannel) {
        await notify.ensureToneChannel(null, "");
      }
    } catch {}
  };

  return (
    <View>
      {/* Current selection */}
      <View style={[styles.toneRow, { borderColor: C.border, backgroundColor: C.bg }]}>
        <View
          style={[
            styles.toneIcon,
            { backgroundColor: tone.uri ? C.blueLight : C.borderLight },
          ]}
        >
          <MaterialCommunityIcons
            name={tone.uri ? "music-circle" : "bell-ring-outline"}
            size={22}
            color={tone.uri ? C.blue : C.muted}
          />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={[styles.toneTitle, { color: C.ink }]} numberOfLines={1}>
            {tone.name}
          </Text>
          <Text style={[styles.toneSub, { color: C.muted }]} numberOfLines={1}>
            {tone.uri ? "Tono personalizado" : "Tono por defecto del dispositivo"}
          </Text>
        </View>
        <TouchableOpacity
          onPress={playPreview}
          style={[styles.playBtn, { backgroundColor: C.blue }]}
          activeOpacity={0.85}
          testID="btn-preview-tone"
        >
          <MaterialCommunityIcons name="play" size={18} color={C.onAccent} />
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <TouchableOpacity
          onPress={pickFile}
          disabled={picking}
          style={[styles.actionBtn, { backgroundColor: C.blue, opacity: picking ? 0.7 : 1 }]}
          activeOpacity={0.85}
          testID="btn-pick-tone"
        >
          <Feather name="upload" size={16} color={C.onAccent} />
          <Text style={[styles.actionBtnText, { color: C.onAccent }]}>
            {picking ? "Cargando…" : "Elegir archivo (.mp3)"}
          </Text>
        </TouchableOpacity>
        {tone.uri && (
          <TouchableOpacity
            onPress={clearTone}
            style={[styles.actionBtn, { backgroundColor: C.borderLight, borderColor: C.border, borderWidth: 1 }]}
            activeOpacity={0.85}
            testID="btn-clear-tone"
          >
            <Feather name="x" size={16} color={C.text} />
            <Text style={[styles.actionBtnText, { color: C.text }]}>Quitar</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={[styles.hint, { color: C.muted }]}>
        Selecciona un archivo .mp3 desde tu dispositivo. La muestra dura ~2 s.
      </Text>
    </View>
  );
}

// ---------- Main exported section ----------
export function AdvancedSettings() {
  const { colors: C, accent, setAccent, resetAccent, tone, setTone } = useTheme();
  const [openColor, setOpenColor] = useState(false);
  const [openTone, setOpenTone] = useState(false);
  const [draftColor, setDraftColor] = useState(accent);

  // Sync draft when modal opens
  useEffect(() => {
    if (openColor) setDraftColor(accent);
  }, [openColor, accent]);

  const applyColor = () => {
    setAccent(draftColor);
    setOpenColor(false);
  };

  const ink = contrastOn(accent);

  return (
    <View style={[blockStyles.block, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <MaterialCommunityIcons name="tune-vertical" size={18} color={C.ink} />
        <Text style={[blockStyles.title, { color: C.ink }]}>Personalización avanzada</Text>
      </View>
      <Text style={[blockStyles.desc, { color: C.muted }]}>
        Ajusta el color de acento de la app y elige un tono para los avisos de cobro.
      </Text>

      {/* Color row */}
      <TouchableOpacity
        style={[blockStyles.row, { borderColor: C.border }]}
        onPress={() => setOpenColor(true)}
        activeOpacity={0.85}
        testID="row-color-picker"
      >
        <View style={[blockStyles.rowIcon, { backgroundColor: accent }]}>
          <MaterialCommunityIcons name="palette" size={20} color={ink} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[blockStyles.rowTitle, { color: C.ink }]}>Color de la interfaz</Text>
          <Text style={[blockStyles.rowSub, { color: C.muted }]}>
            {accent.toUpperCase()} · contraste automático
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={C.muted} />
      </TouchableOpacity>

      {/* Tone row */}
      <TouchableOpacity
        style={[blockStyles.row, { borderColor: C.border, marginBottom: 0 }]}
        onPress={() => setOpenTone(true)}
        activeOpacity={0.85}
        testID="row-tone-picker"
      >
        <View style={[blockStyles.rowIcon, { backgroundColor: C.blueLight }]}>
          <MaterialCommunityIcons name="bell-ring" size={20} color={C.blue} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[blockStyles.rowTitle, { color: C.ink }]}>Tono de notificación</Text>
          <Text style={[blockStyles.rowSub, { color: C.muted }]} numberOfLines={1}>
            {tone.name}
          </Text>
        </View>
        <Feather name="chevron-right" size={18} color={C.muted} />
      </TouchableOpacity>

      {/* Color picker modal */}
      <Modal
        visible={openColor}
        transparent
        animationType="slide"
        onRequestClose={() => setOpenColor(false)}
      >
        <View style={blockStyles.backdrop}>
          <View style={[blockStyles.modal, { backgroundColor: C.card }]}>
            <View style={blockStyles.modalHeader}>
              <Text style={[blockStyles.modalTitle, { color: C.ink }]}>Color de interfaz</Text>
              <TouchableOpacity onPress={() => setOpenColor(false)} testID="btn-close-color">
                <Feather name="x" size={22} color={C.ink} />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={{ maxHeight: 520 }}
              contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 12 }}
              keyboardShouldPersistTaps="handled"
            >
              <ColorPicker
                C={C}
                value={draftColor}
                onChange={setDraftColor}
                onReset={() => {
                  resetAccent();
                  setOpenColor(false);
                }}
              />
            </ScrollView>
            <View style={blockStyles.modalFooter}>
              <TouchableOpacity
                onPress={() => setOpenColor(false)}
                style={[blockStyles.footerBtn, { backgroundColor: C.borderLight }]}
                activeOpacity={0.85}
              >
                <Text style={{ color: C.text, fontWeight: "700" }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={applyColor}
                style={[blockStyles.footerBtn, { backgroundColor: draftColor }]}
                activeOpacity={0.85}
                testID="btn-apply-color"
              >
                <Text style={{ color: contrastOn(draftColor), fontWeight: "800" }}>Aplicar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Tone picker modal */}
      <Modal
        visible={openTone}
        transparent
        animationType="slide"
        onRequestClose={() => setOpenTone(false)}
      >
        <View style={blockStyles.backdrop}>
          <View style={[blockStyles.modal, { backgroundColor: C.card }]}>
            <View style={blockStyles.modalHeader}>
              <Text style={[blockStyles.modalTitle, { color: C.ink }]}>Tono de notificación</Text>
              <TouchableOpacity onPress={() => setOpenTone(false)} testID="btn-close-tone">
                <Feather name="x" size={22} color={C.ink} />
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 18, paddingBottom: 10 }}>
              <TonePicker C={C} tone={tone} onChange={setTone} />
            </View>
            <View style={blockStyles.modalFooter}>
              <TouchableOpacity
                onPress={() => setOpenTone(false)}
                style={[blockStyles.footerBtn, { backgroundColor: C.blue, flex: 1 }]}
                activeOpacity={0.85}
              >
                <Text style={{ color: C.onAccent, fontWeight: "800" }}>Listo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  chLabel: { fontSize: 12, fontWeight: "700" },
  chValue: { fontSize: 12, fontWeight: "700" },
  preview: {
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewTitle: { fontSize: 16, fontWeight: "800" },
  previewHex: { fontSize: 12, marginTop: 2, fontWeight: "600" },
  previewChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  smallBtnText: { fontSize: 12, fontWeight: "700" },
  subLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  toneRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  toneIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  toneTitle: { fontSize: 14, fontWeight: "700" },
  toneSub: { fontSize: 12, marginTop: 2 },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
    flex: 1,
    justifyContent: "center",
  },
  actionBtnText: { fontSize: 13, fontWeight: "700" },
  hint: { fontSize: 11, marginTop: 8, lineHeight: 16 },
});

const blockStyles = StyleSheet.create({
  block: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginTop: 16,
  },
  title: { fontSize: 16, fontWeight: "800" },
  desc: { fontSize: 12, marginBottom: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rowTitle: { fontSize: 14, fontWeight: "700" },
  rowSub: { fontSize: 12, marginTop: 2 },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: Platform.OS === "ios" ? 28 : 18,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 10,
  },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
