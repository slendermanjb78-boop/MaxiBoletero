import React, { useState } from "react";
import { Platform, TouchableOpacity, Text, View, Modal } from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

interface Props {
  value: Date;
  onChange: (d: Date) => void;
  mode?: "date" | "time" | "datetime";
  label?: string;
  style?: any;
  textStyle?: any;
  testID?: string;
  minimumDate?: Date;
  formatLabel?: (d: Date) => string;
}

const defaultFormat = (d: Date, mode: "date" | "time" | "datetime") => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  if (mode === "time") return `${hh}:${min}`;
  if (mode === "datetime") return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
  return `${dd}/${mm}/${yyyy}`;
};

export const DateField: React.FC<Props> = ({
  value,
  onChange,
  mode = "date",
  style,
  textStyle,
  testID,
  minimumDate,
  formatLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value);
  const label = (formatLabel ? formatLabel(value) : defaultFormat(value, mode));

  // On Android we use the imperative behavior (modal that closes after pick)
  // On iOS we use a custom modal with inline spinner.
  // On web we render a native HTML input via DateTimePicker fallback.

  const open_picker = () => {
    setTempDate(value);
    setOpen(true);
  };

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === "android") {
      setOpen(false);
      if (event.type === "set" && selected) onChange(selected);
    } else if (selected) {
      setTempDate(selected);
    }
  };

  return (
    <>
      <TouchableOpacity onPress={open_picker} style={style} testID={testID} activeOpacity={0.7}>
        <Text style={textStyle}>{label}</Text>
      </TouchableOpacity>
      {open && Platform.OS === "android" && (
        <DateTimePicker
          value={tempDate}
          mode={mode === "datetime" ? "date" : mode}
          onChange={handleChange}
          minimumDate={minimumDate}
        />
      )}
      {open && Platform.OS === "ios" && (
        <Modal transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.6)", justifyContent: "flex-end" }}>
            <View style={{ backgroundColor: "#fff", padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
              <DateTimePicker
                value={tempDate}
                mode={mode === "datetime" ? "datetime" : mode}
                display="spinner"
                onChange={handleChange}
                minimumDate={minimumDate}
              />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  onPress={() => setOpen(false)}
                  style={{ flex: 1, backgroundColor: "#f1f5f9", padding: 14, borderRadius: 14, alignItems: "center" }}
                >
                  <Text style={{ fontWeight: "700" }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { onChange(tempDate); setOpen(false); }}
                  style={{ flex: 1, backgroundColor: "#2563eb", padding: 14, borderRadius: 14, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800" }}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
      {open && Platform.OS === "web" && (
        <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,0.6)", justifyContent: "center", padding: 24 }}>
            <View style={{ backgroundColor: "#fff", borderRadius: 24, padding: 20 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", marginBottom: 12 }}>Selecciona fecha</Text>
              {/* @ts-ignore web native input */}
              <input
                type={mode === "time" ? "time" : mode === "datetime" ? "datetime-local" : "date"}
                value={mode === "time"
                  ? `${String(tempDate.getHours()).padStart(2,"0")}:${String(tempDate.getMinutes()).padStart(2,"0")}`
                  : mode === "datetime"
                    ? `${tempDate.getFullYear()}-${String(tempDate.getMonth()+1).padStart(2,"0")}-${String(tempDate.getDate()).padStart(2,"0")}T${String(tempDate.getHours()).padStart(2,"0")}:${String(tempDate.getMinutes()).padStart(2,"0")}`
                    : `${tempDate.getFullYear()}-${String(tempDate.getMonth()+1).padStart(2,"0")}-${String(tempDate.getDate()).padStart(2,"0")}`
                }
                onChange={(e: any) => {
                  const v = e.target.value;
                  if (!v) return;
                  let d: Date;
                  if (mode === "time") {
                    const [h, m] = v.split(":").map((n: string) => parseInt(n, 10));
                    d = new Date(tempDate);
                    d.setHours(h);
                    d.setMinutes(m);
                  } else {
                    d = new Date(v);
                  }
                  setTempDate(d);
                }}
                style={{ width: "100%", padding: 12, fontSize: 16, borderRadius: 10, border: "1px solid #e2e8f0" }}
              />
              <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
                <TouchableOpacity
                  onPress={() => setOpen(false)}
                  style={{ flex: 1, backgroundColor: "#f1f5f9", padding: 14, borderRadius: 14, alignItems: "center" }}
                >
                  <Text style={{ fontWeight: "700" }}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => { onChange(tempDate); setOpen(false); }}
                  style={{ flex: 1, backgroundColor: "#2563eb", padding: 14, borderRadius: 14, alignItems: "center" }}
                >
                  <Text style={{ color: "#fff", fontWeight: "800" }}>Confirmar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );
};
