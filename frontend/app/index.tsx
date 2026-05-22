import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Modal,
  Image,
  Alert,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import DraggableFlatList, { ScaleDecorator } from "react-native-draggable-flatlist";

import { useStore, Contact, RepartoDay, Reminder, utils, AppData } from "@/src/store/store";
import { computeBalance, formatCurrency, formatDateDMY, computeWeekly } from "@/src/utils/calc";
import { exportAndShareContact } from "@/src/utils/pdf";
import { exportBackup, pickAndParseBackup } from "@/src/utils/backup";
import { ensureNotificationPermission, scheduleReminder, cancelReminder } from "@/src/utils/notify";
import { useTheme, ThemeColors } from "@/src/theme/theme";
import { GridCellInput, formatThousands, sanitizeDigits } from "@/src/components/GridCellInput";
import { CameraModal } from "@/src/components/CameraModal";
import { DateField } from "@/src/components/DateField";

type Tab = "clientes" | "resumen" | "proveedores" | "reparto" | "cobros" | "ajustes";
type Kind = "clients" | "providers";

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) as string;

const useUI = () => {
  const { colors: C, mode, toggle } = useTheme();
  const s = useMemo(() => makeStyles(C), [C]);
  return { C, s, mode, toggle };
};

// ---------- Bottom Tabs ----------
function BottomTabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const { C, s } = useUI();
  const items: { key: Tab; label: string; icon: any }[] = [
    { key: "clientes", label: "CLIENTES", icon: "account" },
    { key: "resumen", label: "RESUMEN", icon: "chart-bar" },
    { key: "proveedores", label: "PROVEED.", icon: "truck" },
    { key: "reparto", label: "REPARTO", icon: "map-marker-radius" },
    { key: "cobros", label: "COBROS", icon: "bell-ring-outline" },
  ];
  return (
    <View style={s.bottomTabs} testID="bottom-tabs">
      {items.map((it) => {
        const active = tab === it.key;
        return (
          <TouchableOpacity
            key={it.key}
            style={s.tabBtn}
            onPress={() => setTab(it.key)}
            testID={`tab-${it.key}`}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons
              name={it.icon}
              size={22}
              color={active ? C.blue : C.muted}
            />
            <Text style={[s.tabLabel, { color: active ? C.blue : C.muted }]}>
              {it.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------- Contact List ----------
function ContactList({
  kind,
  contacts,
  onSelect,
  onAdd,
  title,
  subtitle,
}: {
  kind: Kind;
  contacts: Contact[];
  onSelect: (c: Contact) => void;
  onAdd: (name: string) => void;
  title: string;
  subtitle: string;
}) {
  const { C, s } = useUI();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const submit = () => {
    if (name.trim()) {
      onAdd(name.trim());
      setName("");
      setAdding(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.screenHeader}>
        <Text style={s.screenTitle}>{title}</Text>
        <Text style={s.screenSubtitle}>{subtitle}</Text>
      </View>

      <FlatList
        data={contacts}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <MaterialCommunityIcons name="folder-open-outline" size={48} color="#cbd5e1" />
            <Text style={s.emptyText}>Aún no hay registros</Text>
            <Text style={s.emptySub}>Toca el botón + para crear el primero</Text>
          </View>
        }
        renderItem={({ item }) => {
          const bal = computeBalance(item.entries);
          const color =
            bal.status === "DEBE" ? C.red : bal.status === "A_FAVOR" ? C.blue : C.green;
          const bg =
            bal.status === "DEBE" ? C.redLight : bal.status === "A_FAVOR" ? C.blueLight : C.greenLight;
          const label =
            bal.status === "DEBE" ? "DEBE" : bal.status === "A_FAVOR" ? "A FAVOR" : "SALDADO";
          return (
            <TouchableOpacity
              style={s.contactCard}
              onPress={() => onSelect(item)}
              testID={`contact-${item.id}`}
              activeOpacity={0.85}
            >
              <View style={s.avatar}>
                <MaterialCommunityIcons
                  name={kind === "clients" ? "account" : "truck"}
                  size={22}
                  color={C.ink}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.contactName}>{item.name}</Text>
                <View style={[s.balPill, { backgroundColor: bg }]}>
                  <Text style={[s.balPillText, { color }]}>{label}</Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[s.contactAmount, { color }]}>{formatCurrency(bal.absolute)}</Text>
                <Text style={s.contactMeta}>{item.entries.length} mov.</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={s.fab} onPress={() => setAdding(true)} testID="fab-add-contact">
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      <Modal visible={adding} transparent animationType="fade" onRequestClose={() => setAdding(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.modalBackdrop}
        >
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>
              Nuevo {kind === "clients" ? "Cliente" : "Proveedor"}
            </Text>
            <TextInput
              style={s.input}
              placeholder="Nombre"
              placeholderTextColor="#94a3b8"
              value={name}
              onChangeText={setName}
              autoFocus
              testID="input-contact-name"
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[s.btnGhost, { flex: 1 }]}
                onPress={() => {
                  setAdding(false);
                  setName("");
                }}
              >
                <Text style={s.btnGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnPrimary, { flex: 1 }]}
                onPress={submit}
                testID="btn-confirm-add-contact"
              >
                <Text style={s.btnPrimaryText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ---------- Ledger Detail (Excel grid) ----------
function LedgerDetail({
  kind,
  contact,
  onBack,
}: {
  kind: Kind;
  contact: Contact;
  onBack: () => void;
}) {
  const { C, s } = useUI();
  const store = useStore();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [cameraForEntry, setCameraForEntry] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);

  // re-fetch updated contact reference from store
  const liveContact =
    store.data[kind].find((c) => c.id === contact.id) || contact;
  const bal = computeBalance(liveContact.entries);

  const statusLabel =
    bal.status === "DEBE" ? "PENDIENTE" : bal.status === "A_FAVOR" ? "A FAVOR" : "SALDADO";
  const statusColor =
    bal.status === "DEBE" ? C.red : bal.status === "A_FAVOR" ? C.blue : C.green;

  // openCamera: opens in-app camera component (no native picker → no app kill)
  const openCamera = (entryId: string) => setCameraForEntry(entryId);
  const handleCapture = (dataUri: string) => {
    if (cameraForEntry) {
      store.updateEntry(kind, liveContact.id, cameraForEntry, { photo: dataUri });
    }
  };
  // pickFromGallery: fallback for web/no-camera devices
  const pickFromGallery = async (entryId: string) => {
    try {
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!lib.granted) {
        Alert.alert("Permiso requerido", "Permite el acceso a la galería para elegir una foto.");
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({
        quality: 1,
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
      });
      if (!r.canceled && r.assets[0]) {
        const out = await ImageManipulator.manipulateAsync(
          r.assets[0].uri,
          [{ resize: { width: 800 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true },
        );
        if (out.base64) {
          store.updateEntry(kind, liveContact.id, entryId, { photo: `data:image/jpeg;base64,${out.base64}` });
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo seleccionar la imagen");
    }
  };

  const confirmDelete = () => {
    Alert.alert(
      "Saldar / Cancelar cuenta",
      `¿Eliminar a "${liveContact.name}" y TODO su historial? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            store.deleteContact(kind, liveContact.id);
            onBack();
          },
        },
      ],
    );
  };

  const handleShare = async () => {
    try {
      setSharing(true);
      await exportAndShareContact(liveContact, kind);
    } catch (e: any) {
      Alert.alert("Error", "No se pudo generar el PDF: " + (e?.message || ""));
    } finally {
      setSharing(false);
    }
  };

  const openDate = (entryId: string, current: string) => {
    // legacy stub kept to avoid breaking older references; not used anymore
    void entryId; void current;
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={s.detailHeader}>
        <TouchableOpacity onPress={onBack} style={s.iconBtnDark} testID="btn-back">
          <Feather name="chevron-left" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={s.detailHeaderTitle} numberOfLines={1}>
            {liveContact.name.toUpperCase()}
          </Text>
          <Text style={[s.detailHeaderSub, { color: statusColor }]}>
            {statusLabel}: {formatCurrency(bal.absolute)}
          </Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={s.iconBtnDark} testID="btn-share-pdf">
          {sharing ? (
            <ActivityIndicator color={C.blue} />
          ) : (
            <Feather name="share-2" size={22} color={C.blue} />
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={confirmDelete} style={s.iconBtnDark} testID="btn-delete-contact">
          <Feather name="trash-2" size={22} color={C.red} />
        </TouchableOpacity>
      </View>

      {/* Grid */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 220 }}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View>
            {/* Head */}
            <View style={[s.gridRow, s.gridHead]}>
              <View style={[s.cellDate, s.headCell]}>
                <Text style={s.headText}>FECHA</Text>
              </View>
              <View style={[s.cellDetail, s.headCell]}>
                <Text style={s.headText}>DETALLE</Text>
              </View>
              <View style={[s.cellNum, s.headCell]}>
                <Text style={s.headText}>DEBE (+)</Text>
              </View>
              <View style={[s.cellNum, s.headCell]}>
                <Text style={s.headText}>HABER (-)</Text>
              </View>
              <View style={[s.cellMethod, s.headCell]}>
                <Text style={s.headText}>MEDIO</Text>
              </View>
              <View style={[s.cellPhoto, s.headCell]}>
                <Text style={s.headText}>FOTO</Text>
              </View>
            </View>

            {/* Rows */}
            {liveContact.entries.map((e) => (
              <View key={e.id} style={s.gridRow}>
                <View style={[s.cellDate, s.bodyCell]}>
                  <DateField
                    value={e.date ? new Date(e.date + "T00:00:00") : new Date()}
                    onChange={(d) => {
                      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                      store.updateEntry(kind, liveContact.id, e.id, { date: iso });
                    }}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                    textStyle={s.cellText}
                    testID={`cell-date-${e.id}`}
                  />
                  <Feather name="calendar" size={13} color={C.muted} />
                </View>

                <View style={[s.cellDetail, s.bodyCell]}>
                  <GridCellInput
                    style={s.cellInput}
                    placeholder="Concepto..."
                    placeholderTextColor={C.muted}
                    initialValue={e.description}
                    onCommit={(t) =>
                      store.updateEntry(kind, liveContact.id, e.id, { description: t })
                    }
                    testID={`input-desc-${e.id}`}
                  />
                </View>

                <View style={[s.cellNum, s.bodyCell]}>
                  <GridCellInput
                    style={s.cellInputNum}
                    placeholder="0"
                    placeholderTextColor={C.muted}
                    keyboardType="numeric"
                    initialValue={e.debe ? String(e.debe) : ""}
                    sanitize={sanitizeDigits}
                    format={formatThousands}
                    onCommit={(t) =>
                      store.updateEntry(kind, liveContact.id, e.id, {
                        debe: Number(t.replace(/[^0-9]/g, "")) || 0,
                      })
                    }
                    testID={`input-debe-${e.id}`}
                  />
                </View>

                <View style={[s.cellNum, s.bodyCell]}>
                  <GridCellInput
                    style={s.cellInputNum}
                    placeholder="0"
                    placeholderTextColor={C.muted}
                    keyboardType="numeric"
                    initialValue={e.haber ? String(e.haber) : ""}
                    sanitize={sanitizeDigits}
                    format={formatThousands}
                    onCommit={(t) =>
                      store.updateEntry(kind, liveContact.id, e.id, {
                        haber: Number(t.replace(/[^0-9]/g, "")) || 0,
                      })
                    }
                    testID={`input-haber-${e.id}`}
                  />
                </View>

                <TouchableOpacity
                  style={[s.cellMethod, s.bodyCell, { alignItems: "center" }]}
                  onPress={() =>
                    store.updateEntry(kind, liveContact.id, e.id, {
                      method: e.method === "EFECTIVO" ? "TRANSFERENCIA" : "EFECTIVO",
                    })
                  }
                  testID={`toggle-method-${e.id}`}
                >
                  <View
                    style={[
                      s.methodPill,
                      {
                        backgroundColor:
                          e.method === "EFECTIVO" ? C.yellow : "#93c5fd",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        s.methodPillText,
                        { color: e.method === "EFECTIVO" ? "#422006" : "#1e3a8a" },
                      ]}
                    >
                      {e.method}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={[s.cellPhoto, s.bodyCell, { flexDirection: "row", justifyContent: "center", gap: 6 }]}>
                  <TouchableOpacity
                    style={s.photoBtn}
                    onPress={() => openCamera(e.id)}
                    onLongPress={() => pickFromGallery(e.id)}
                    testID={`btn-camera-${e.id}`}
                  >
                    <Feather name="camera" size={15} color={C.ink} />
                  </TouchableOpacity>
                  {e.photo ? (
                    <TouchableOpacity
                      style={s.photoBtn}
                      onPress={() => setPhotoUri(e.photo!)}
                      testID={`btn-view-photo-${e.id}`}
                    >
                      <Feather name="eye" size={15} color={C.blue} />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ))}

            {/* Totals row */}
            <View style={[s.gridRow, s.totalsRow]}>
              <View style={[s.cellDate, s.bodyCell]}>
                <Text style={s.totalsLabel}>TOTALES</Text>
              </View>
              <View style={[s.cellDetail, s.bodyCell]} />
              <View style={[s.cellNum, s.bodyCell, { backgroundColor: C.redLight }]}>
                <Text style={[s.totalsNum, { color: C.red }]}>
                  {formatCurrency(bal.debe)}
                </Text>
              </View>
              <View style={[s.cellNum, s.bodyCell, { backgroundColor: C.blueLight }]}>
                <Text style={[s.totalsNum, { color: C.blue }]}>
                  {formatCurrency(bal.haber)}
                </Text>
              </View>
              <View style={[s.cellMethod, s.bodyCell, { alignItems: "center" }]}>
                <View style={[s.balPill, { backgroundColor: statusColor + "22" }]}>
                  <Text style={[s.balPillText, { color: statusColor }]}>
                    {bal.status === "DEBE"
                      ? "DEBE"
                      : bal.status === "A_FAVOR"
                        ? "A FAVOR"
                        : "SALDADO"}
                  </Text>
                </View>
              </View>
              <View style={[s.cellPhoto, s.bodyCell]} />
            </View>
          </View>
        </ScrollView>

        <TouchableOpacity
          style={s.addRowBtn}
          onPress={() => store.addEntry(kind, liveContact.id)}
          testID="btn-add-row"
        >
          <Feather name="plus" size={18} color={C.blue} />
          <Text style={s.addRowText}>NUEVA FILA</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Summary */}
      <View style={s.detailFooter}>
        <View>
          <Text style={s.footerLabel}>RESUMEN NETO DE CUENTA</Text>
          <Text style={[s.footerAmount, { color: statusColor }]}>
            {bal.status === "DEBE"
              ? "DEUDOR: "
              : bal.status === "A_FAVOR"
                ? "A FAVOR: "
                : "SALDADO: "}
            {formatCurrency(bal.absolute)}
          </Text>
        </View>
        <TouchableOpacity style={s.footerBtn} onPress={onBack} testID="btn-listo">
          <Text style={s.footerBtnText}>LISTO</Text>
        </TouchableOpacity>
      </View>

      {/* Photo preview modal */}
      <Modal visible={!!photoUri} transparent animationType="fade" onRequestClose={() => setPhotoUri(null)}>
        <View style={s.photoModal}>
          <TouchableOpacity
            style={s.photoCloseBtn}
            onPress={() => setPhotoUri(null)}
            testID="btn-close-photo"
          >
            <Feather name="x" size={28} color="#fff" />
          </TouchableOpacity>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={s.photoFull} resizeMode="contain" />
          ) : null}
        </View>
      </Modal>

      {/* In-app Camera */}
      <CameraModal
        visible={!!cameraForEntry}
        onClose={() => setCameraForEntry(null)}
        onCapture={handleCapture}
      />
    </View>
  );
}

// ---------- Resumen ----------
function ResumenView({
  data,
}: {
  data: ReturnType<typeof useStore>["data"];
}) {
  const { C, s } = useUI();
  const w = useMemo(() => computeWeekly(data.clients, data.providers), [data]);
  const monday = useMemo(() => {
    const m = new Date();
    const dow = m.getDay();
    const diff = (dow + 6) % 7;
    m.setDate(m.getDate() - diff);
    return m;
  }, []);

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={s.screenHeader}>
        <Text style={s.screenTitle}>Resumen Semanal</Text>
        <Text style={s.screenSubtitle}>
          Desde {monday.toLocaleDateString("es-AR")} hasta hoy
        </Text>
      </View>

      <View style={s.summaryCard} testID="card-net">
        <Text style={s.summaryLabel}>BALANCE NETO</Text>
        <Text style={s.summaryAmount}>
          {w.net >= 0 ? "+" : "−"}
          {formatCurrency(Math.abs(w.net))}
        </Text>
        <View style={s.divider} />
        <View style={s.row}>
          <Text style={s.summaryRowLabel}>Ingresos</Text>
          <Text style={[s.summaryRowVal, { color: "#86efac" }]}>
            +{formatCurrency(w.totalIn)}
          </Text>
        </View>
        <View style={s.row}>
          <Text style={s.summaryRowLabel}>Egresos</Text>
          <Text style={[s.summaryRowVal, { color: "#fca5a5" }]}>
            −{formatCurrency(w.totalOut)}
          </Text>
        </View>
      </View>

      <View style={s.kpiGrid}>
        <KpiCard
          icon="cash"
          tint={C.greenLight}
          color={C.green}
          label="EFECTIVO"
          sub="Ingresos cobrados"
          amount={w.inCash}
          testID="kpi-in-cash"
        />
        <KpiCard
          icon="bank"
          tint={C.blueLight}
          color={C.blue}
          label="TRANSFERENCIA"
          sub="Ingresos al banco"
          amount={w.inBank}
          testID="kpi-in-bank"
        />
        <KpiCard
          icon="cash-remove"
          tint={C.redLight}
          color={C.red}
          label="EFECTIVO"
          sub="Pagos en efectivo"
          amount={w.outCash}
          testID="kpi-out-cash"
        />
        <KpiCard
          icon="bank-transfer-out"
          tint={C.yellowLight}
          color={C.amber}
          label="TRANSFERENCIA"
          sub="Pagos por banco"
          amount={w.outBank}
          testID="kpi-out-bank"
        />
      </View>

      <View style={s.statBlock}>
        <Text style={s.statTitle}>Total Cuentas</Text>
        <View style={s.row}>
          <Text style={s.statRowLabel}>Clientes activos</Text>
          <Text style={s.statRowVal}>{data.clients.length}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.statRowLabel}>Proveedores activos</Text>
          <Text style={s.statRowVal}>{data.providers.length}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.statRowLabel}>Días con reparto</Text>
          <Text style={s.statRowVal}>{data.repartos.length}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

// ---------- Settings ----------
function SettingsView({
  data,
  onRestored,
  onBack,
}: {
  data: AppData;
  onRestored: (next: AppData) => void;
  onBack: () => void;
}) {
  const { C, s, mode, toggle } = useUI();
  const [busy, setBusy] = useState<"export" | "import" | null>(null);

  const confirmAsync = (
    title: string,
    message: string,
    confirmLabel: string,
    destructive = false,
  ): Promise<boolean> =>
    new Promise((resolve) => {
      if (Platform.OS === "web") {
        // eslint-disable-next-line no-alert
        resolve(window.confirm(`${title}\n\n${message}`));
        return;
      }
      Alert.alert(title, message, [
        { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ]);
    });

  const doExport = async (includePhotos: boolean) => {
    const ok = await confirmAsync(
      "Exportar respaldo",
      includePhotos
        ? "Se incluirán las fotos de evidencia (archivo más grande)."
        : "Solo datos contables, sin fotos. Archivo ligero, ideal para compartir.",
      "Exportar",
    );
    if (!ok) return;
    try {
      setBusy("export");
      await exportBackup(data, includePhotos);
    } catch (e: any) {
      const msg = e?.message || "No se pudo exportar";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Error", msg);
    } finally {
      setBusy(null);
    }
  };

  const doImport = async () => {
    try {
      setBusy("import");
      const parsed = await pickAndParseBackup();
      if (!parsed) {
        setBusy(null);
        return;
      }
      const stats = {
        c: parsed.data.clients.length,
        p: parsed.data.providers.length,
        r: parsed.data.repartos.length,
        date: new Date(parsed.exportedAt).toLocaleString("es-AR"),
      };
      const ok = await confirmAsync(
        "Confirmar restauración",
        `Respaldo del ${stats.date}\n\n• ${stats.c} clientes\n• ${stats.p} proveedores\n• ${stats.r} días de reparto\n\nSe REEMPLAZARÁN todos los datos actuales. ¿Continuar?`,
        "Restaurar",
        true,
      );
      if (!ok) {
        setBusy(null);
        return;
      }
      await onRestored(parsed.data);
      setBusy(null);
      if (Platform.OS === "web") window.alert("Datos restaurados correctamente.");
      else Alert.alert("Listo", "Datos restaurados correctamente.");
    } catch (e: any) {
      setBusy(null);
      const msg = e?.message || "No se pudo importar el archivo";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Error", msg);
    }
  };

  const isDark = mode === "dark";

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[s.screenHeader, { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }]}>
        <View>
          <Text style={s.screenTitle}>Ajustes</Text>
          <Text style={s.screenSubtitle}>Preferencias y respaldo de datos</Text>
        </View>
        <TouchableOpacity
          onPress={onBack}
          style={{ padding: 8, marginBottom: 4 }}
          testID="btn-back-settings"
        >
          <Feather name="x" size={26} color={C.ink} />
        </TouchableOpacity>
      </View>

      {/* Theme */}
      <View style={s.statBlock}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <MaterialCommunityIcons
            name={isDark ? "moon-waning-crescent" : "white-balance-sunny"}
            size={18}
            color={C.ink}
          />
          <Text style={s.statTitle}>Apariencia</Text>
        </View>
        <Text style={{ color: C.muted, fontSize: 12, marginBottom: 14 }}>
          Cambia el tema entre claro y oscuro. Tu elección se guarda automáticamente.
        </Text>

        <TouchableOpacity
          style={[s.backupBtn, { marginBottom: 0 }]}
          onPress={toggle}
          testID="btn-toggle-theme"
          activeOpacity={0.85}
        >
          <View style={[s.backupIcon, { backgroundColor: isDark ? "#1e293b" : "#fef3c7" }]}>
            <MaterialCommunityIcons
              name={isDark ? "moon-waning-crescent" : "white-balance-sunny"}
              size={20}
              color={isDark ? C.blue : C.amber}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.backupTitle}>Tema {isDark ? "Oscuro" : "Claro"}</Text>
            <Text style={s.backupSub}>
              Toca para cambiar a tema {isDark ? "claro" : "oscuro"}
            </Text>
          </View>
          <View style={[s.themeToggle, { backgroundColor: isDark ? C.blue : C.border }]}>
            <View
              style={[
                s.themeToggleKnob,
                {
                  backgroundColor: "#fff",
                  transform: [{ translateX: isDark ? 22 : 2 }],
                },
              ]}
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* Backup */}
      <View style={s.statBlock}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <MaterialCommunityIcons name="cloud-download-outline" size={18} color={C.ink} />
          <Text style={s.statTitle}>Respaldo de datos</Text>
        </View>
        <Text style={{ color: C.muted, fontSize: 12, marginBottom: 14 }}>
          Exporta un archivo JSON con toda tu información para guardarlo o
          restaurarlo en otro dispositivo.
        </Text>

        <TouchableOpacity
          style={s.backupBtn}
          onPress={() => doExport(false)}
          disabled={!!busy}
          testID="btn-export-light"
          activeOpacity={0.85}
        >
          <View style={[s.backupIcon, { backgroundColor: C.blueLight }]}>
            <Feather name="download" size={18} color={C.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.backupTitle}>Exportar (Ligero)</Text>
            <Text style={s.backupSub}>Solo datos · sin fotos · fácil de compartir</Text>
          </View>
          {busy === "export" ? <ActivityIndicator color={C.blue} /> : (
            <Feather name="chevron-right" size={18} color={C.muted} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={s.backupBtn}
          onPress={() => doExport(true)}
          disabled={!!busy}
          testID="btn-export-full"
          activeOpacity={0.85}
        >
          <View style={[s.backupIcon, { backgroundColor: C.yellowLight }]}>
            <Feather name="archive" size={18} color={C.amber} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.backupTitle}>Exportar (Completo)</Text>
            <Text style={s.backupSub}>Incluye fotos de evidencia</Text>
          </View>
          <Feather name="chevron-right" size={18} color={C.muted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.backupBtn, { marginBottom: 0 }]}
          onPress={doImport}
          disabled={!!busy}
          testID="btn-import-backup"
          activeOpacity={0.85}
        >
          <View style={[s.backupIcon, { backgroundColor: C.greenLight }]}>
            <Feather name="upload" size={18} color={C.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.backupTitle}>Importar respaldo</Text>
            <Text style={s.backupSub}>Restaura datos desde un archivo .json</Text>
          </View>
          {busy === "import" ? <ActivityIndicator color={C.green} /> : (
            <Feather name="chevron-right" size={18} color={C.muted} />
          )}
        </TouchableOpacity>
      </View>

      <Text style={{ color: C.muted, fontSize: 11, textAlign: "center", marginTop: 12 }}>
        MaxiBoletero · v1.0
      </Text>
    </ScrollView>
  );
}

function KpiCard({
  icon,
  tint,
  color,
  label,
  sub,
  amount,
  testID,
}: {
  icon: any;
  tint: string;
  color: string;
  label: string;
  sub: string;
  amount: number;
  testID?: string;
}) {
  const { s } = useUI();
  return (
    <View style={s.kpiCard} testID={testID}>
      <View style={[s.kpiIcon, { backgroundColor: tint }]}>
        <MaterialCommunityIcons name={icon} size={20} color={color} />
      </View>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiSub}>{sub}</Text>
      <Text style={[s.kpiAmount, { color }]}>{formatCurrency(amount)}</Text>
    </View>
  );
}

// ---------- Reparto ----------
function RepartoList({
  data,
  onSelect,
}: {
  data: ReturnType<typeof useStore>["data"];
  onSelect: (d: RepartoDay) => void;
}) {
  const { C, s } = useUI();
  const store = useStore();
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState<Date>(() => new Date());
  const sorted = [...data.repartos].sort((a, b) => b.date.localeCompare(a.date));

  const handleCreate = async () => {
    const t = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, "0")}-${String(newDate.getDate()).padStart(2, "0")}`;
    const id = await store.addRepartoDay(t, newName);
    setShowForm(false);
    setNewName("");
    setNewDate(new Date());
    const fresh = store.data.repartos.find((r) => r.id === id);
    if (fresh) onSelect(fresh);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.screenHeader}>
        <Text style={s.screenTitle}>Reparto</Text>
        <Text style={s.screenSubtitle}>Planillas de entregas</Text>
      </View>
      <FlatList
        data={sorted}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={s.empty}>
            <MaterialCommunityIcons name="map-marker-radius" size={48} color={C.muted} />
            <Text style={s.emptyText}>Sin repartos cargados</Text>
            <Text style={s.emptySub}>Toca el + para crear el primero</Text>
          </View>
        }
        renderItem={({ item }) => {
          const delivered = item.items.filter((i) => i.delivered).length;
          const total = item.items.length;
          return (
            <TouchableOpacity
              style={s.contactCard}
              onPress={() => onSelect(item)}
              activeOpacity={0.85}
              testID={`reparto-${item.id}`}
            >
              <View style={s.avatar}>
                <MaterialCommunityIcons name="map-marker-radius" size={22} color={C.ink} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.contactName} numberOfLines={1}>
                  {item.name || formatDateDMY(item.date)}
                </Text>
                <Text style={s.contactMeta}>
                  {formatDateDMY(item.date)} · {total} entregas
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <View
                  style={[
                    s.balPill,
                    {
                      backgroundColor:
                        delivered === total && total > 0 ? C.greenLight : C.yellowLight,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.balPillText,
                      {
                        color:
                          delivered === total && total > 0 ? C.green : C.amber,
                      },
                    ]}
                  >
                    {delivered}/{total}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />
      <TouchableOpacity
        style={s.fab}
        onPress={() => {
          setNewName("");
          setNewDate(new Date());
          setShowForm(true);
        }}
        testID="fab-add-reparto"
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showForm} transparent animationType="fade" onRequestClose={() => setShowForm(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.modalBackdrop}
        >
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Nuevo reparto</Text>

            <Text style={[s.statRowLabel, { marginBottom: 6, marginTop: 4 }]}>Nombre / etiqueta</Text>
            <TextInput
              style={s.input}
              placeholder="Ej. Reparto de cerdo"
              placeholderTextColor={C.muted}
              value={newName}
              onChangeText={setNewName}
              autoFocus
              testID="input-reparto-name"
            />

            <Text style={[s.statRowLabel, { marginBottom: 6, marginTop: 12 }]}>Fecha</Text>
            <DateField
              value={newDate}
              mode="date"
              onChange={setNewDate}
              style={[s.input, { paddingVertical: 14, justifyContent: "center" }]}
              textStyle={{ color: C.ink, fontWeight: "700" }}
              testID="input-reparto-date"
            />

            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <TouchableOpacity
                style={[s.btnGhost, { flex: 1 }]}
                onPress={() => setShowForm(false)}
              >
                <Text style={s.btnGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnPrimary, { flex: 1 }]}
                onPress={handleCreate}
                testID="btn-confirm-reparto"
              >
                <Text style={s.btnPrimaryText}>Crear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function RepartoDetail({
  day,
  onBack,
}: {
  day: RepartoDay;
  onBack: () => void;
}) {
  const { C, s } = useUI();
  const store = useStore();
  const live = store.data.repartos.find((d) => d.id === day.id) || day;
  const total = live.items.length;
  const delivered = live.items.filter((i) => i.delivered).length;
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(live.name || "");

  const confirmDelete = () => {
    Alert.alert(
      "Eliminar reparto",
      `¿Eliminar "${live.name || formatDateDMY(live.date)}" completo?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => {
            store.deleteRepartoDay(live.id);
            onBack();
          },
        },
      ],
    );
  };

  const renderItem = ({ item, drag, isActive, getIndex }: any) => {
    const idx = getIndex();
    return (
      <ScaleDecorator>
        <View
          style={[
            s.repartoCard,
            isActive && {
              shadowColor: "#000",
              shadowOpacity: 0.25,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 8 },
              elevation: 12,
              borderColor: C.blue,
            },
          ]}
          testID={`reparto-card-${item.id}`}
        >
          <TouchableOpacity
            onLongPress={drag}
            delayLongPress={300}
            disabled={isActive}
            style={s.dragHandle}
            testID={`reparto-drag-${item.id}`}
            activeOpacity={0.6}
          >
            <Feather name="menu" size={20} color={C.muted} />
            <Text style={s.dragHandleNum}>{(idx ?? 0) + 1}</Text>
          </TouchableOpacity>

          <View style={{ flex: 1, gap: 6 }}>
            <GridCellInput
              style={[s.cellInput, { fontSize: 15, fontWeight: "700", color: C.ink }]}
              placeholder="Nombre del cliente"
              placeholderTextColor={C.muted}
              initialValue={item.clientName}
              onCommit={(t) => store.updateRepartoItem(live.id, item.id, { clientName: t })}
              testID={`reparto-input-name-${item.id}`}
            />
            <GridCellInput
              style={[s.cellInput, { fontSize: 13, color: C.text }]}
              placeholder="Detalle del producto"
              placeholderTextColor={C.muted}
              initialValue={item.productDetail}
              onCommit={(t) => store.updateRepartoItem(live.id, item.id, { productDetail: t })}
            />
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 }}>
              <View style={s.qtyBadge}>
                <Text style={s.qtyBadgeLabel}>CANT.</Text>
                <GridCellInput
                  style={s.qtyBadgeInput}
                  placeholder="0"
                  placeholderTextColor={C.muted}
                  keyboardType="numeric"
                  initialValue={item.quantity}
                  sanitize={sanitizeDigits}
                  onCommit={(t) => store.updateRepartoItem(live.id, item.id, { quantity: t })}
                />
              </View>
              <TouchableOpacity
                onPress={() =>
                  store.updateRepartoItem(live.id, item.id, { delivered: !item.delivered })
                }
                testID={`reparto-toggle-${item.id}`}
                style={[
                  s.statusPill,
                  { backgroundColor: item.delivered ? C.greenLight : C.redLight, paddingVertical: 8 },
                ]}
              >
                <MaterialCommunityIcons
                  name={item.delivered ? "check-circle" : "close-circle"}
                  size={16}
                  color={item.delivered ? C.green : C.red}
                />
                <Text style={[s.statusText, { color: item.delivered ? C.green : C.red }]}>
                  {item.delivered ? "ENTREGADO" : "PENDIENTE"}
                </Text>
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={() => store.deleteRepartoItem(live.id, item.id)}
                style={s.deleteItemBtn}
                testID={`reparto-del-${item.id}`}
              >
                <Feather name="trash-2" size={16} color={C.red} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.detailHeader}>
        <TouchableOpacity onPress={onBack} style={s.iconBtnDark}>
          <Feather name="chevron-left" size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={{ flex: 1, alignItems: "center" }}
          onPress={() => {
            setNameDraft(live.name || "");
            setEditingName(true);
          }}
          testID="btn-edit-reparto-name"
        >
          <Text style={s.detailHeaderTitle} numberOfLines={1}>
            {(live.name || formatDateDMY(live.date)).toUpperCase()}
          </Text>
          <Text style={[s.detailHeaderSub, { color: C.blue }]}>
            {formatDateDMY(live.date)} · {delivered}/{total} ENTREGADOS
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={confirmDelete} style={s.iconBtnDark} testID="btn-delete-reparto">
          <Feather name="trash-2" size={22} color={C.red} />
        </TouchableOpacity>
      </View>

      <View style={{ paddingHorizontal: 12, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <MaterialCommunityIcons name="gesture-tap-hold" size={16} color={C.muted} />
        <Text style={{ color: C.muted, fontSize: 12, flex: 1 }}>
          Mantén presionado el ícono ≡ para reordenar
        </Text>
      </View>

      <DraggableFlatList
        data={live.items}
        keyExtractor={(it) => it.id}
        onDragEnd={({ data: newItems }) => store.reorderRepartoItems(live.id, newItems)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 240 }}
        activationDistance={6}
        ListEmptyComponent={
          <View style={s.empty}>
            <MaterialCommunityIcons name="package-variant" size={48} color={C.muted} />
            <Text style={s.emptyText}>Aún no hay entregas</Text>
            <Text style={s.emptySub}>Toca el + para agregar la primera</Text>
          </View>
        }
        ListFooterComponent={
          <TouchableOpacity
            style={[s.addRowBtn, { borderRadius: 16, borderWidth: 1, borderColor: C.borderLight, marginTop: 12 }]}
            onPress={() => store.addRepartoItem(live.id)}
            testID="btn-add-reparto-item"
          >
            <Feather name="plus" size={18} color={C.blue} />
            <Text style={s.addRowText}>NUEVA ENTREGA</Text>
          </TouchableOpacity>
        }
      />

      <View style={s.detailFooter}>
        <View>
          <Text style={s.footerLabel}>PROGRESO DE REPARTO</Text>
          <Text style={[s.footerAmount, { color: C.blue }]}>
            {delivered} de {total} entregados
          </Text>
        </View>
        <TouchableOpacity style={s.footerBtn} onPress={onBack}>
          <Text style={s.footerBtnText}>LISTO</Text>
        </TouchableOpacity>
      </View>

      {/* Edit name modal */}
      <Modal visible={editingName} transparent animationType="fade" onRequestClose={() => setEditingName(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Nombre del reparto</Text>
            <TextInput
              style={s.input}
              placeholder="Ej. Reparto de cerdo"
              placeholderTextColor={C.muted}
              value={nameDraft}
              onChangeText={setNameDraft}
              autoFocus
              testID="input-edit-reparto-name"
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[s.btnGhost, { flex: 1 }]} onPress={() => setEditingName(false)}>
                <Text style={s.btnGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnPrimary, { flex: 1 }]}
                onPress={() => {
                  store.updateRepartoDay(live.id, { name: nameDraft.trim() || undefined });
                  setEditingName(false);
                }}
                testID="btn-save-reparto-name"
              >
                <Text style={s.btnPrimaryText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ---------- Cobros (Avisos de Cobro) ----------
function CobrosView({
  data,
}: {
  data: ReturnType<typeof useStore>["data"];
}) {
  const { C, s } = useUI();
  const store = useStore();
  const [showForm, setShowForm] = useState(false);
  const [concept, setConcept] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState<Date>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() + 60);
    d.setSeconds(0);
    return d;
  });
  const [saving, setSaving] = useState(false);

  const closeForm = () => {
    setShowForm(false);
    setConcept("");
    setAmount("");
  };

  const submit = async () => {
    const trimmedConcept = concept.trim();
    const amountNum = Number(amount.replace(/[^0-9]/g, "")) || 0;
    if (!trimmedConcept) {
      Alert.alert("Falta el concepto", "Indica a quién o por qué hay que cobrar.");
      return;
    }
    if (dueDate.getTime() < Date.now() + 30 * 1000) {
      Alert.alert("Fecha inválida", "La fecha debe ser al menos 30 segundos en el futuro.");
      return;
    }
    setSaving(true);
    try {
      const granted = await ensureNotificationPermission();
      let notifId: string | null = null;
      if (granted) {
        notifId = await scheduleReminder(trimmedConcept, amountNum, dueDate.toISOString());
      }
      store.addReminder({
        concept: trimmedConcept,
        amount: amountNum,
        dueAt: dueDate.toISOString(),
        notificationId: notifId,
      });
      if (!granted && Platform.OS !== "web") {
        Alert.alert(
          "Aviso guardado",
          "No se pudo activar la notificación porque los permisos están denegados. Habilítalos desde los ajustes del sistema.",
        );
      }
      closeForm();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo crear el aviso");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (r: Reminder) => {
    Alert.alert("Eliminar aviso", `¿Eliminar el aviso "${r.concept}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          await cancelReminder(r.notificationId);
          store.deleteReminder(r.id);
        },
      },
    ]);
  };

  const handleToggleDone = async (r: Reminder) => {
    if (!r.done) {
      await cancelReminder(r.notificationId);
      store.updateReminder(r.id, { done: true, notificationId: null });
    } else {
      store.updateReminder(r.id, { done: false });
    }
  };

  const sorted = [...data.reminders].sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const pending = sorted.filter((r) => !r.done);
  const done = sorted.filter((r) => r.done);

  const formatDue = (iso: string) => {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yy} · ${hh}:${min}`;
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={s.screenHeader}>
        <Text style={s.screenTitle}>Avisos de Cobro</Text>
        <Text style={s.screenSubtitle}>Recordatorios programados</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 160 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {pending.length === 0 && done.length === 0 ? (
          <View style={s.empty}>
            <MaterialCommunityIcons name="bell-ring-outline" size={48} color={C.muted} />
            <Text style={s.emptyText}>Sin avisos cargados</Text>
            <Text style={s.emptySub}>Toca el + para crear el primero</Text>
          </View>
        ) : null}

        {pending.length > 0 && (
          <Text style={[s.statTitle, { marginTop: 4, marginBottom: 8 }]}>
            PENDIENTES ({pending.length})
          </Text>
        )}
        {pending.map((r) => {
          const overdue = new Date(r.dueAt).getTime() < Date.now();
          return (
            <View key={r.id} style={s.contactCard} testID={`reminder-${r.id}`}>
              <View style={[s.avatar, { backgroundColor: overdue ? C.redLight : C.blueLight }]}>
                <MaterialCommunityIcons
                  name={overdue ? "alert" : "bell-ring"}
                  size={22}
                  color={overdue ? C.red : C.blue}
                />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.contactName}>{r.concept}</Text>
                <Text style={s.contactMeta}>
                  {formatDue(r.dueAt)}
                  {overdue ? " · VENCIDO" : ""}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <Text style={[s.contactAmount, { color: C.blue }]}>
                  {formatCurrency(r.amount)}
                </Text>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => handleToggleDone(r)}
                    style={[s.orderBtn, { width: 28, height: 28, backgroundColor: C.greenLight }]}
                    testID={`reminder-done-${r.id}`}
                  >
                    <Feather name="check" size={14} color={C.green} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(r)}
                    style={[s.orderBtn, { width: 28, height: 28, backgroundColor: C.redLight }]}
                    testID={`reminder-delete-${r.id}`}
                  >
                    <Feather name="trash-2" size={14} color={C.red} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}

        {done.length > 0 && (
          <Text style={[s.statTitle, { marginTop: 12, marginBottom: 8 }]}>
            COBRADOS ({done.length})
          </Text>
        )}
        {done.map((r) => (
          <View key={r.id} style={[s.contactCard, { opacity: 0.65 }]} testID={`reminder-${r.id}`}>
            <View style={[s.avatar, { backgroundColor: C.greenLight }]}>
              <MaterialCommunityIcons name="check-circle" size={22} color={C.green} />
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <Text style={[s.contactName, { textDecorationLine: "line-through" }]}>
                {r.concept}
              </Text>
              <Text style={s.contactMeta}>{formatDue(r.dueAt)}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              <Text style={[s.contactAmount, { color: C.green }]}>
                {formatCurrency(r.amount)}
              </Text>
              <View style={{ flexDirection: "row", gap: 6 }}>
                <TouchableOpacity
                  onPress={() => handleToggleDone(r)}
                  style={[s.orderBtn, { width: 28, height: 28, backgroundColor: C.borderLight }]}
                >
                  <Feather name="rotate-ccw" size={14} color={C.ink} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(r)}
                  style={[s.orderBtn, { width: 28, height: 28, backgroundColor: C.redLight }]}
                >
                  <Feather name="trash-2" size={14} color={C.red} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>

      <TouchableOpacity
        style={s.fab}
        onPress={() => setShowForm(true)}
        testID="fab-add-reminder"
      >
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>

      <Modal visible={showForm} transparent animationType="slide" onRequestClose={closeForm}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.modalBackdrop}
        >
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Nuevo aviso de cobro</Text>

            <Text style={[s.statRowLabel, { marginBottom: 6, marginTop: 6 }]}>Concepto / Cliente</Text>
            <TextInput
              style={s.input}
              placeholder="Ej. Juan Pérez · saldo mayorista"
              placeholderTextColor={C.muted}
              value={concept}
              onChangeText={setConcept}
              testID="input-reminder-concept"
            />

            <Text style={[s.statRowLabel, { marginBottom: 6, marginTop: 12 }]}>Monto</Text>
            <TextInput
              style={s.input}
              placeholder="0"
              placeholderTextColor={C.muted}
              keyboardType="numeric"
              value={formatThousands(amount)}
              onChangeText={(t) => setAmount(sanitizeDigits(t))}
              testID="input-reminder-amount"
            />

            <Text style={[s.statRowLabel, { marginBottom: 6, marginTop: 12 }]}>
              Fecha y hora del aviso
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <DateField
                value={dueDate}
                mode="date"
                onChange={(d) => {
                  const nd = new Date(dueDate);
                  nd.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                  setDueDate(nd);
                }}
                minimumDate={new Date()}
                style={[s.input, { flex: 1, paddingVertical: 14, justifyContent: "center" }]}
                textStyle={{ color: C.ink, fontWeight: "700" }}
                testID="input-reminder-date"
              />
              <DateField
                value={dueDate}
                mode="time"
                onChange={(d) => {
                  const nd = new Date(dueDate);
                  nd.setHours(d.getHours(), d.getMinutes(), 0, 0);
                  setDueDate(nd);
                }}
                style={[s.input, { flex: 1, paddingVertical: 14, justifyContent: "center" }]}
                textStyle={{ color: C.ink, fontWeight: "700" }}
                testID="input-reminder-time"
              />
            </View>

            <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
              <TouchableOpacity
                style={[s.btnGhost, { flex: 1 }]}
                onPress={closeForm}
              >
                <Text style={s.btnGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnPrimary, { flex: 1 }]}
                onPress={submit}
                disabled={saving}
                testID="btn-confirm-reminder"
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.btnPrimaryText}>Crear aviso</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}


// ---------- Root ----------
export default function App() {
  const { C, s, mode } = useUI();
  const store = useStore();
  const [tab, setTab] = useState<Tab>("clientes");
  const [selectedClient, setSelectedClient] = useState<Contact | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<Contact | null>(null);
  const [selectedReparto, setSelectedReparto] = useState<RepartoDay | null>(null);
  const insets = useSafeAreaInsets();

  if (!store.loaded) {
    return (
      <SafeAreaView style={[s.root, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={C.blue} />
      </SafeAreaView>
    );
  }

  // detail views
  if (selectedClient) {
    return (
      <SafeAreaView style={s.root} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor={C.ink} />
        <LedgerDetail
          kind="clients"
          contact={selectedClient}
          onBack={() => setSelectedClient(null)}
        />
      </SafeAreaView>
    );
  }
  if (selectedProvider) {
    return (
      <SafeAreaView style={s.root} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor={C.ink} />
        <LedgerDetail
          kind="providers"
          contact={selectedProvider}
          onBack={() => setSelectedProvider(null)}
        />
      </SafeAreaView>
    );
  }
  if (selectedReparto) {
    return (
      <SafeAreaView style={s.root} edges={["top"]}>
        <StatusBar barStyle="light-content" backgroundColor={C.ink} />
        <RepartoDetail
          day={selectedReparto}
          onBack={() => setSelectedReparto(null)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.root} edges={["top"]}>
      <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} backgroundColor={C.bg} />
      <View style={{ flex: 1 }}>
        {tab === "clientes" && (
          <ContactList
            kind="clients"
            contacts={store.data.clients}
            onSelect={setSelectedClient}
            onAdd={(name) => store.addContact("clients", name)}
            title="Clientes"
            subtitle="Quienes me deben"
          />
        )}
        {tab === "resumen" && <ResumenView data={store.data} />}
        {tab === "proveedores" && (
          <ContactList
            kind="providers"
            contacts={store.data.providers}
            onSelect={setSelectedProvider}
            onAdd={(name) => store.addContact("providers", name)}
            title="Proveedores"
            subtitle="A quién le debo"
          />
        )}
        {tab === "reparto" && (
          <RepartoList
            data={store.data}
            onSelect={setSelectedReparto}
          />
        )}
        {tab === "cobros" && <CobrosView data={store.data} />}
        {tab === "ajustes" && (
          <SettingsView
            data={store.data}
            onRestored={(next) => store.replaceAll(next)}
            onBack={() => setTab("clientes")}
          />
        )}

        {/* Floating gear icon (top-right) on list screens only */}
        {tab !== "ajustes" && (
          <TouchableOpacity
            style={s.gearBtn}
            onPress={() => setTab("ajustes")}
            testID="btn-open-settings"
            activeOpacity={0.8}
          >
            <Feather name="settings" size={20} color={C.ink} />
          </TouchableOpacity>
        )}
      </View>
      <View style={{ paddingBottom: insets.bottom, backgroundColor: C.tabBg }}>
        <BottomTabs tab={tab} setTab={setTab} />
      </View>
    </SafeAreaView>
  );
}

// ---------- Styles ----------
const makeStyles = (C: ThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Screen header
  screenHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  screenTitle: { fontSize: 28, fontWeight: "800", color: C.ink, letterSpacing: -0.5 },
  screenSubtitle: { fontSize: 14, color: C.muted, marginTop: 2 },

  // Contact cards
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: C.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  contactName: { fontSize: 17, fontWeight: "700", color: C.ink },
  contactMeta: { fontSize: 11, color: C.muted, marginTop: 2 },
  contactAmount: { fontSize: 18, fontWeight: "800", fontFamily: MONO },
  balPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  balPillText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },

  // Empty
  empty: { alignItems: "center", paddingVertical: 60 },
  emptyText: { color: C.muted, fontWeight: "600", marginTop: 12 },
  emptySub: { color: C.muted, fontSize: 12, marginTop: 4 },

  // FAB
  fab: {
    position: "absolute",
    right: 22,
    bottom: 100,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: C.blue,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.blue,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  gearBtn: {
    position: "absolute",
    top: 20,
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.borderLight,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    zIndex: 10,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.75)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: { backgroundColor: C.card, borderRadius: 24, padding: 22 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: C.ink, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: C.ink,
    backgroundColor: C.card,
  },
  btnPrimary: {
    backgroundColor: C.blue,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "800", letterSpacing: 0.5 },
  btnGhost: {
    backgroundColor: C.borderLight,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnGhostText: { color: C.text, fontWeight: "700" },

  // Bottom tabs
  bottomTabs: {
    flexDirection: "row",
    backgroundColor: C.tabBg,
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    paddingVertical: 8,
  },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 6 },
  tabLabel: { fontSize: 9, fontWeight: "800", marginTop: 4, letterSpacing: 1 },

  // Detail header (always-dark)
  detailHeader: {
    backgroundColor: C.dark,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    gap: 4,
  },
  iconBtnDark: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  detailHeaderTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  detailHeaderSub: { fontSize: 12, fontWeight: "800", marginTop: 2, letterSpacing: 1 },

  // Grid
  gridRow: { flexDirection: "row", backgroundColor: C.card },
  gridHead: { backgroundColor: C.dark },
  headCell: { paddingHorizontal: 10, paddingVertical: 12, justifyContent: "center" },
  headText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  bodyCell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
    justifyContent: "center",
  },
  cellDate: { width: 110, flexDirection: "row", alignItems: "center", gap: 6 },
  cellDetail: { width: 200 },
  cellNum: { width: 110, alignItems: "flex-end" },
  cellMethod: { width: 130, justifyContent: "center" },
  cellPhoto: { width: 110, justifyContent: "center", alignItems: "center" },
  cellText: { color: C.text, fontSize: 13, fontFamily: MONO },
  cellInput: {
    fontSize: 14,
    color: C.ink,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  cellInputNum: {
    fontSize: 14,
    color: C.ink,
    fontFamily: MONO,
    textAlign: "right",
    width: "100%",
  },
  methodPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  methodPillText: { fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  photoBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: C.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  totalsRow: { backgroundColor: C.rowAlt },
  totalsLabel: { fontSize: 11, fontWeight: "800", color: C.muted, letterSpacing: 1.5 },
  totalsNum: { fontFamily: MONO, fontWeight: "800", fontSize: 14 },

  addRowBtn: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    backgroundColor: C.card,
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  addRowText: { color: C.blue, fontWeight: "800", letterSpacing: 1.5 },

  detailFooter: {
    backgroundColor: C.dark,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  footerLabel: { color: C.darkMuted, fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
  footerAmount: { fontFamily: MONO, fontWeight: "800", fontSize: 18, marginTop: 4 },
  footerBtn: {
    backgroundColor: C.blue,
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 16,
  },
  footerBtnText: { color: "#fff", fontWeight: "800", letterSpacing: 2 },

  // Resumen
  summaryCard: {
    backgroundColor: C.dark,
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
  },
  summaryLabel: {
    color: C.darkMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
  },
  summaryAmount: {
    color: "#fff",
    fontSize: 38,
    fontWeight: "800",
    fontFamily: MONO,
    marginTop: 8,
  },
  divider: { height: 1, backgroundColor: C.darkBorder, marginVertical: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  summaryRowLabel: { color: "#cbd5e1", fontSize: 13 },
  summaryRowVal: { fontFamily: MONO, fontWeight: "700", fontSize: 14 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  kpiCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  kpiIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  kpiLabel: { fontSize: 10, fontWeight: "800", color: C.muted, letterSpacing: 1.5 },
  kpiSub: { fontSize: 11, color: C.muted, marginTop: 2 },
  kpiAmount: { fontFamily: MONO, fontSize: 18, fontWeight: "800", marginTop: 8 },

  statBlock: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 18,
    marginTop: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  statTitle: { fontSize: 13, fontWeight: "800", color: C.ink, marginBottom: 8, letterSpacing: 0.5 },
  statRowLabel: { color: C.muted, fontSize: 13 },
  statRowVal: { fontFamily: MONO, fontWeight: "800", color: C.ink, fontSize: 14 },

  backupBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: C.bg,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  backupIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  backupTitle: { fontWeight: "800", color: C.ink, fontSize: 14 },
  backupSub: { color: C.muted, fontSize: 11, marginTop: 2 },

  themeToggle: {
    width: 46,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
  },
  themeToggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    position: "absolute",
  },

  // Reparto grid
  rcellOrder: { width: 56, alignItems: "center" },
  rcellName: { width: 160 },
  rcellProd: { width: 220 },
  rcellQty: { width: 80, alignItems: "flex-end" },
  rcellStatus: { width: 150, justifyContent: "center" },
  orderBtn: {
    width: 22,
    height: 18,
    borderRadius: 6,
    backgroundColor: C.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  orderNum: {
    fontFamily: MONO,
    fontSize: 11,
    fontWeight: "800",
    color: C.muted,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },

  // Reparto card (drag layout)
  repartoCard: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: C.card,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: C.borderLight,
    gap: 12,
  },
  dragHandle: {
    width: 40,
    backgroundColor: C.borderLight,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  dragHandleNum: {
    fontSize: 11,
    fontWeight: "800",
    color: C.muted,
    fontFamily: MONO,
  },
  qtyBadge: {
    backgroundColor: C.borderLight,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 80,
  },
  qtyBadgeLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: C.muted,
    letterSpacing: 1,
  },
  qtyBadgeInput: {
    fontFamily: MONO,
    fontSize: 16,
    fontWeight: "800",
    color: C.ink,
    paddingVertical: 0,
    minWidth: 60,
  },
  deleteItemBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.redLight,
    alignItems: "center",
    justifyContent: "center",
  },

  // Photo modal
  photoModal: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  photoCloseBtn: {
    position: "absolute",
    top: 50,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  photoFull: { width: "100%", height: "85%" },
});
