import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImageManipulator from "expo-image-manipulator";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

interface Props {
  visible: boolean;
  onClose: () => void;
  onCapture: (dataUri: string) => void;
}

export const CameraModal: React.FC<Props> = ({ visible, onClose, onCapture }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<"back" | "front">("back");
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (visible && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission]);

  const handleCapture = async () => {
    if (!cameraRef.current || busy) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (!photo?.uri) throw new Error("No image");
      // Resize to 800px max, JPEG 60% → very small base64 → safe for AsyncStorage
      const result = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 800 } }],
        {
          compress: 0.6,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        },
      );
      if (!result.base64) throw new Error("No base64");
      onCapture(`data:image/jpeg;base64,${result.base64}`);
      onClose();
    } catch (e: any) {
      Alert.alert("Error", "No se pudo capturar la foto: " + (e?.message || ""));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        {!permission ? (
          <View style={styles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : !permission.granted ? (
          <View style={styles.center}>
            <MaterialCommunityIcons name="camera-off" size={64} color="#94a3b8" />
            <Text style={styles.permTitle}>Permiso requerido</Text>
            <Text style={styles.permSub}>
              Activa el acceso a la cámara para poder capturar evidencias.
            </Text>
            <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
              <Text style={styles.permBtnText}>Permitir cámara</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.permBtn, styles.permBtnGhost]} onPress={onClose}>
              <Text style={[styles.permBtnText, { color: "#fff" }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFillObject}
              facing={facing}
            />
            {/* top bar */}
            <View style={styles.topBar}>
              <TouchableOpacity onPress={onClose} style={styles.topBtn} testID="camera-close">
                <Feather name="x" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.topTitle}>EVIDENCIA</Text>
              <TouchableOpacity
                onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}
                style={styles.topBtn}
                testID="camera-flip"
              >
                <MaterialCommunityIcons name="camera-flip" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            {/* bottom shutter */}
            <View style={styles.bottomBar}>
              <View style={{ width: 60 }} />
              <TouchableOpacity
                style={styles.shutterOuter}
                onPress={handleCapture}
                disabled={busy}
                testID="camera-shutter"
              >
                <View style={styles.shutterInner}>
                  {busy ? (
                    <ActivityIndicator color="#0f172a" />
                  ) : null}
                </View>
              </TouchableOpacity>
              <View style={{ width: 60 }} />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  permTitle: { color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 16 },
  permSub: { color: "#cbd5e1", textAlign: "center", marginTop: 8, marginBottom: 24 },
  permBtn: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 10,
    minWidth: 220,
    alignItems: "center",
  },
  permBtnGhost: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#334155" },
  permBtnText: { color: "#fff", fontWeight: "800", letterSpacing: 1 },
  topBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 50 : 30,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  topTitle: {
    color: "#fff",
    fontWeight: "800",
    letterSpacing: 3,
    fontSize: 13,
  },
  bottomBar: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 40,
  },
  shutterOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});
