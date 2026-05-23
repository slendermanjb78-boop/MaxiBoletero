import React from "react";
import { View, Text, ScrollView, StyleSheet, Platform } from "react-native";

interface State {
  error: Error | null;
}

/**
 * Root-level safety net. If anything in the React tree throws while
 * rendering, this component catches it and shows a friendly fallback
 * screen instead of letting the Android process crash.
 *
 * Critical for production APK builds where a single render error in
 * any deep child would otherwise kill the app at launch.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: any) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const err = this.state.error;
    if (!err) return this.props.children;
    return (
      <View style={styles.bg}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>La aplicación se recuperó de un error</Text>
          <Text style={styles.body}>
            MaxiBoletero detectó un problema al cargar una sección. Tus datos están
            a salvo en el almacenamiento local.
          </Text>
          <View style={styles.errBox}>
            <Text style={styles.errLabel}>Detalle técnico</Text>
            <Text style={styles.errText}>
              {err.name}: {err.message}
            </Text>
          </View>
          <Text style={styles.hint}>
            Cerrá la app desde la lista de tareas recientes y volvé a abrirla. Si el
            problema persiste, eliminá los datos de la app desde Ajustes del sistema
            y restaurá un respaldo JSON.
          </Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  content: {
    padding: 24,
    paddingTop: Platform.OS === "ios" ? 80 : 60,
  },
  title: { fontSize: 22, fontWeight: "800", color: "#f8fafc", marginBottom: 12 },
  body: { fontSize: 14, color: "#cbd5e1", lineHeight: 20, marginBottom: 24 },
  errBox: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    marginBottom: 24,
  },
  errLabel: {
    fontSize: 11,
    color: "#fca5a5",
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
  },
  errText: { color: "#fecaca", fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace", fontSize: 12, lineHeight: 18 },
  hint: { fontSize: 13, color: "#94a3b8", lineHeight: 19 },
});
