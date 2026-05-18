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

import { useStore, Contact, LedgerEntry, Method, RepartoDay, utils } from "@/src/store/store";
import { computeBalance, formatCurrency, formatDateDMY, computeWeekly } from "@/src/utils/calc";
import { exportAndShareContact } from "@/src/utils/pdf";

type Tab = "clientes" | "resumen" | "proveedores" | "reparto";
type Kind = "clients" | "providers";

const C = {
  bg: "#f8fafc",
  card: "#ffffff",
  ink: "#0f172a",
  text: "#334155",
  muted: "#64748b",
  border: "#e2e8f0",
  borderLight: "#f1f5f9",
  blue: "#2563eb",
  blueLight: "#dbeafe",
  red: "#dc2626",
  redLight: "#fee2e2",
  green: "#16a34a",
  greenLight: "#dcfce7",
  yellow: "#facc15",
  yellowLight: "#fef9c3",
  amber: "#92400e",
  blueInk: "#1e3a8a",
};

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) as string;

// ---------- Bottom Tabs ----------
function BottomTabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { key: Tab; label: string; icon: any; lib: "mci" | "feather" }[] = [
    { key: "clientes", label: "CLIENTES", icon: "account", lib: "mci" },
    { key: "resumen", label: "RESUMEN", icon: "chart-bar", lib: "mci" },
    { key: "proveedores", label: "PROVEEDORES", icon: "truck", lib: "mci" },
    { key: "reparto", label: "REPARTO", icon: "map-marker-radius", lib: "mci" },
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
              color={active ? C.blue : "#94a3b8"}
            />
            <Text style={[s.tabLabel, { color: active ? C.blue : "#94a3b8" }]}>
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
  const store = useStore();
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [datePickerFor, setDatePickerFor] = useState<string | null>(null);
  const [tempDate, setTempDate] = useState<string>("");
  const [sharing, setSharing] = useState(false);

  // re-fetch updated contact reference from store
  const liveContact =
    store.data[kind].find((c) => c.id === contact.id) || contact;
  const bal = computeBalance(liveContact.entries);

  const statusLabel =
    bal.status === "DEBE" ? "PENDIENTE" : bal.status === "A_FAVOR" ? "A FAVOR" : "SALDADO";
  const statusColor =
    bal.status === "DEBE" ? C.red : bal.status === "A_FAVOR" ? C.blue : C.green;

  const takePhoto = async (entryId: string) => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!lib.granted) {
          Alert.alert(
            "Permisos requeridos",
            "Habilita el acceso a la cámara o galería desde los ajustes para adjuntar evidencias.",
          );
          return;
        }
        const r = await ImagePicker.launchImageLibraryAsync({
          quality: 0.5,
          base64: true,
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
        });
        if (!r.canceled && r.assets[0]) {
          const uri =
            r.assets[0].base64
              ? `data:image/jpeg;base64,${r.assets[0].base64}`
              : r.assets[0].uri;
          store.updateEntry(kind, liveContact.id, entryId, { photo: uri });
        }
        return;
      }
      const r = await ImagePicker.launchCameraAsync({
        quality: 0.5,
        base64: true,
      });
      if (!r.canceled && r.assets[0]) {
        const uri = r.assets[0].base64
          ? `data:image/jpeg;base64,${r.assets[0].base64}`
          : r.assets[0].uri;
        store.updateEntry(kind, liveContact.id, entryId, { photo: uri });
      }
    } catch (e) {
      Alert.alert("Error", "No se pudo capturar la foto");
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
    setDatePickerFor(entryId);
    setTempDate(current || utils.today());
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
                <TouchableOpacity
                  style={[s.cellDate, s.bodyCell]}
                  onPress={() => openDate(e.id, e.date)}
                  testID={`cell-date-${e.id}`}
                >
                  <Text style={s.cellText}>{formatDateDMY(e.date) || "—"}</Text>
                  <Feather name="calendar" size={13} color={C.muted} />
                </TouchableOpacity>

                <View style={[s.cellDetail, s.bodyCell]}>
                  <TextInput
                    style={s.cellInput}
                    placeholder="Concepto..."
                    placeholderTextColor="#cbd5e1"
                    value={e.description}
                    onChangeText={(t) =>
                      store.updateEntry(kind, liveContact.id, e.id, { description: t })
                    }
                    testID={`input-desc-${e.id}`}
                  />
                </View>

                <View style={[s.cellNum, s.bodyCell]}>
                  <TextInput
                    style={[s.cellInputNum]}
                    placeholder="0"
                    placeholderTextColor="#cbd5e1"
                    keyboardType="numeric"
                    value={e.debe ? String(e.debe) : ""}
                    onChangeText={(t) =>
                      store.updateEntry(kind, liveContact.id, e.id, {
                        debe: Number(t.replace(/[^0-9]/g, "")) || 0,
                      })
                    }
                    testID={`input-debe-${e.id}`}
                  />
                </View>

                <View style={[s.cellNum, s.bodyCell]}>
                  <TextInput
                    style={[s.cellInputNum]}
                    placeholder="0"
                    placeholderTextColor="#cbd5e1"
                    keyboardType="numeric"
                    value={e.haber ? String(e.haber) : ""}
                    onChangeText={(t) =>
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
                        { color: e.method === "EFECTIVO" ? C.amber : C.blueInk },
                      ]}
                    >
                      {e.method}
                    </Text>
                  </View>
                </TouchableOpacity>

                <View style={[s.cellPhoto, s.bodyCell, { flexDirection: "row", justifyContent: "center", gap: 6 }]}>
                  <TouchableOpacity
                    style={s.photoBtn}
                    onPress={() => takePhoto(e.id)}
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

      {/* Simple date picker (text entry YYYY-MM-DD) */}
      <Modal
        visible={!!datePickerFor}
        transparent
        animationType="fade"
        onRequestClose={() => setDatePickerFor(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.modalBackdrop}
        >
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Fecha</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 8 }}>
              Formato AAAA-MM-DD (vacío = hoy)
            </Text>
            <TextInput
              style={s.input}
              value={tempDate}
              onChangeText={setTempDate}
              placeholder="AAAA-MM-DD"
              placeholderTextColor="#94a3b8"
              autoFocus
              testID="input-date"
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
              <TouchableOpacity
                style={[s.btnGhost, { flex: 1 }]}
                onPress={() => setDatePickerFor(null)}
              >
                <Text style={s.btnGhostText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnPrimary, { flex: 1 }]}
                testID="btn-confirm-date"
                onPress={() => {
                  const value =
                    /^\d{4}-\d{2}-\d{2}$/.test(tempDate.trim())
                      ? tempDate.trim()
                      : utils.today();
                  if (datePickerFor) {
                    store.updateEntry(kind, liveContact.id, datePickerFor, {
                      date: value,
                    });
                  }
                  setDatePickerFor(null);
                }}
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

// ---------- Resumen ----------
function ResumenView({ data }: { data: ReturnType<typeof useStore>["data"] }) {
  const w = useMemo(() => computeWeekly(data.clients, data.providers), [data]);
  const monday = useMemo(() => {
    const m = new Date();
    const dow = m.getDay();
    const diff = (dow + 6) % 7;
    m.setDate(m.getDate() - diff);
    return m;
  }, []);

  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}>
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
          tint="#fef3c7"
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
  onAdd,
}: {
  data: ReturnType<typeof useStore>["data"];
  onSelect: (d: RepartoDay) => void;
  onAdd: () => void;
}) {
  const sorted = [...data.repartos].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <View style={{ flex: 1 }}>
      <View style={s.screenHeader}>
        <Text style={s.screenTitle}>Reparto</Text>
        <Text style={s.screenSubtitle}>Planilla diaria de entregas</Text>
      </View>
      <FlatList
        data={sorted}
        keyExtractor={(d) => d.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 140 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <MaterialCommunityIcons name="map-marker-radius" size={48} color="#cbd5e1" />
            <Text style={s.emptyText}>Sin repartos cargados</Text>
            <Text style={s.emptySub}>Toca el + para crear el día de hoy</Text>
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
                <MaterialCommunityIcons name="calendar" size={22} color={C.ink} />
              </View>
              <View style={{ flex: 1, marginLeft: 14 }}>
                <Text style={s.contactName}>{formatDateDMY(item.date)}</Text>
                <Text style={s.contactMeta}>{total} entregas planificadas</Text>
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
      <TouchableOpacity style={s.fab} onPress={onAdd} testID="fab-add-reparto">
        <Feather name="plus" size={26} color="#fff" />
      </TouchableOpacity>
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
  const store = useStore();
  const live = store.data.repartos.find((d) => d.id === day.id) || day;
  const total = live.items.length;
  const delivered = live.items.filter((i) => i.delivered).length;

  const confirmDelete = () => {
    Alert.alert(
      "Eliminar reparto",
      `¿Eliminar todo el reparto del ${formatDateDMY(live.date)}?`,
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

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.detailHeader}>
        <TouchableOpacity onPress={onBack} style={s.iconBtnDark}>
          <Feather name="chevron-left" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={s.detailHeaderTitle}>REPARTO {formatDateDMY(live.date)}</Text>
          <Text style={[s.detailHeaderSub, { color: C.blue }]}>
            {delivered}/{total} ENTREGADOS
          </Text>
        </View>
        <TouchableOpacity onPress={confirmDelete} style={s.iconBtnDark} testID="btn-delete-reparto">
          <Feather name="trash-2" size={22} color={C.red} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 220 }}>
        <ScrollView horizontal>
          <View>
            <View style={[s.gridRow, s.gridHead]}>
              <View style={[s.rcellName, s.headCell]}>
                <Text style={s.headText}>CLIENTE</Text>
              </View>
              <View style={[s.rcellProd, s.headCell]}>
                <Text style={s.headText}>PRODUCTO</Text>
              </View>
              <View style={[s.rcellQty, s.headCell]}>
                <Text style={s.headText}>CANT.</Text>
              </View>
              <View style={[s.rcellStatus, s.headCell]}>
                <Text style={s.headText}>ESTADO</Text>
              </View>
            </View>
            {live.items.map((it) => (
              <View key={it.id} style={s.gridRow}>
                <View style={[s.rcellName, s.bodyCell]}>
                  <TextInput
                    style={s.cellInput}
                    placeholder="Nombre"
                    placeholderTextColor="#cbd5e1"
                    value={it.clientName}
                    onChangeText={(t) =>
                      store.updateRepartoItem(live.id, it.id, { clientName: t })
                    }
                    testID={`reparto-input-name-${it.id}`}
                  />
                </View>
                <View style={[s.rcellProd, s.bodyCell]}>
                  <TextInput
                    style={s.cellInput}
                    placeholder="Detalle producto"
                    placeholderTextColor="#cbd5e1"
                    value={it.productDetail}
                    onChangeText={(t) =>
                      store.updateRepartoItem(live.id, it.id, { productDetail: t })
                    }
                  />
                </View>
                <View style={[s.rcellQty, s.bodyCell]}>
                  <TextInput
                    style={s.cellInputNum}
                    placeholder="0"
                    placeholderTextColor="#cbd5e1"
                    keyboardType="numeric"
                    value={it.quantity}
                    onChangeText={(t) =>
                      store.updateRepartoItem(live.id, it.id, { quantity: t.replace(/[^0-9]/g, "") })
                    }
                  />
                </View>
                <TouchableOpacity
                  style={[s.rcellStatus, s.bodyCell, { alignItems: "center" }]}
                  onPress={() =>
                    store.updateRepartoItem(live.id, it.id, { delivered: !it.delivered })
                  }
                  testID={`reparto-toggle-${it.id}`}
                >
                  <View
                    style={[
                      s.statusPill,
                      {
                        backgroundColor: it.delivered ? C.greenLight : C.redLight,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={it.delivered ? "check-circle" : "close-circle"}
                      size={14}
                      color={it.delivered ? C.green : C.red}
                    />
                    <Text
                      style={[
                        s.statusText,
                        { color: it.delivered ? C.green : C.red },
                      ]}
                    >
                      {it.delivered ? "ENTREGADO" : "NO ENTREG."}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={s.addRowBtn}
          onPress={() => store.addRepartoItem(live.id)}
          testID="btn-add-reparto-item"
        >
          <Feather name="plus" size={18} color={C.blue} />
          <Text style={s.addRowText}>NUEVA ENTREGA</Text>
        </TouchableOpacity>
      </ScrollView>

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
    </View>
  );
}

// ---------- Root ----------
export default function App() {
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
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />
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
            onAdd={async () => {
              const t = utils.today();
              const id = await store.addRepartoDay(t);
              const fresh = store.data.repartos.find((r) => r.id === id);
              if (fresh) setSelectedReparto(fresh);
            }}
          />
        )}
      </View>
      <View style={{ paddingBottom: insets.bottom, backgroundColor: "#fff" }}>
        <BottomTabs tab={tab} setTab={setTab} />
      </View>
    </SafeAreaView>
  );
}

// ---------- Styles ----------
const s = StyleSheet.create({
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
  emptySub: { color: "#94a3b8", fontSize: 12, marginTop: 4 },

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

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.65)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: { backgroundColor: "#fff", borderRadius: 24, padding: 22 },
  modalTitle: { fontSize: 20, fontWeight: "800", color: C.ink, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: C.ink,
  },
  btnPrimary: {
    backgroundColor: C.blue,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "800", letterSpacing: 0.5 },
  btnGhost: {
    backgroundColor: "#f1f5f9",
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: "center",
  },
  btnGhostText: { color: C.text, fontWeight: "700" },

  // Bottom tabs
  bottomTabs: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: C.borderLight,
    paddingVertical: 8,
  },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 6 },
  tabLabel: { fontSize: 9, fontWeight: "800", marginTop: 4, letterSpacing: 1 },

  // Detail header
  detailHeader: {
    backgroundColor: C.ink,
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
  gridRow: { flexDirection: "row", backgroundColor: "#fff" },
  gridHead: { backgroundColor: C.ink },
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
  methodPillText: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  photoBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: C.borderLight,
    alignItems: "center",
    justifyContent: "center",
  },
  totalsRow: { backgroundColor: "#f8fafc" },
  totalsLabel: { fontSize: 11, fontWeight: "800", color: C.muted, letterSpacing: 1.5 },
  totalsNum: { fontFamily: MONO, fontWeight: "800", fontSize: 14 },

  addRowBtn: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: C.borderLight,
  },
  addRowText: { color: C.blue, fontWeight: "800", letterSpacing: 1.5 },

  detailFooter: {
    backgroundColor: C.ink,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  footerLabel: { color: "#94a3b8", fontSize: 10, fontWeight: "700", letterSpacing: 1.5 },
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
    backgroundColor: C.ink,
    borderRadius: 28,
    padding: 22,
    marginBottom: 16,
  },
  summaryLabel: {
    color: "#94a3b8",
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
  divider: { height: 1, backgroundColor: "#1e293b", marginVertical: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  summaryRowLabel: { color: "#cbd5e1", fontSize: 13 },
  summaryRowVal: { fontFamily: MONO, fontWeight: "700", fontSize: 14 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  kpiCard: {
    width: "47%",
    flexGrow: 1,
    backgroundColor: "#fff",
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
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 18,
    marginTop: 14,
    borderWidth: 1,
    borderColor: C.borderLight,
  },
  statTitle: { fontSize: 13, fontWeight: "800", color: C.ink, marginBottom: 8, letterSpacing: 0.5 },
  statRowLabel: { color: C.muted, fontSize: 13 },
  statRowVal: { fontFamily: MONO, fontWeight: "800", color: C.ink, fontSize: 14 },

  // Reparto grid
  rcellName: { width: 160 },
  rcellProd: { width: 220 },
  rcellQty: { width: 80, alignItems: "flex-end" },
  rcellStatus: { width: 150, justifyContent: "center" },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusText: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },

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
