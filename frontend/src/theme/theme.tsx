import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";

export type ThemeMode = "light" | "dark";

export interface ThemeColors {
  bg: string;
  card: string;
  ink: string;
  text: string;
  muted: string;
  border: string;
  borderLight: string;
  blue: string;
  blueLight: string;
  red: string;
  redLight: string;
  green: string;
  greenLight: string;
  yellow: string;
  yellowLight: string;
  amber: string;
  blueInk: string;
  // tab bar / header on top of bg
  tabBg: string;
  // dark surfaces always-dark (header detail, footer detail, summary card)
  dark: string;
  darkBorder: string;
  darkMuted: string;
  rowAlt: string;
}

export const LIGHT: ThemeColors = {
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
  tabBg: "#ffffff",
  dark: "#0f172a",
  darkBorder: "#1e293b",
  darkMuted: "#94a3b8",
  rowAlt: "#f8fafc",
};

export const DARK: ThemeColors = {
  bg: "#020617",
  card: "#0f172a",
  ink: "#f8fafc",
  text: "#cbd5e1",
  muted: "#94a3b8",
  border: "#1e293b",
  borderLight: "#1e293b",
  blue: "#60a5fa",
  blueLight: "rgba(59,130,246,0.18)",
  red: "#f87171",
  redLight: "rgba(239,68,68,0.18)",
  green: "#4ade80",
  greenLight: "rgba(34,197,94,0.18)",
  yellow: "#facc15",
  yellowLight: "rgba(250,204,21,0.18)",
  amber: "#fbbf24",
  blueInk: "#1e3a8a",
  tabBg: "#0f172a",
  dark: "#020617",
  darkBorder: "#1e293b",
  darkMuted: "#94a3b8",
  rowAlt: "#0b1220",
};

const STORAGE_KEY = "erp_theme_mode_v1";

interface Ctx {
  mode: ThemeMode;
  colors: ThemeColors;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<Ctx>({
  mode: "light",
  colors: LIGHT,
  toggle: () => {},
  setMode: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>("light");

  useEffect(() => {
    (async () => {
      const saved = await storage.getItem<string>(STORAGE_KEY, "");
      if (saved === "dark" || saved === "light") setModeState(saved);
    })();
  }, []);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    storage.setItem(STORAGE_KEY, m);
  }, []);

  const toggle = useCallback(() => {
    setModeState((prev) => {
      const next: ThemeMode = prev === "light" ? "dark" : "light";
      storage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const colors = mode === "dark" ? DARK : LIGHT;

  return (
    <ThemeContext.Provider value={{ mode, colors, toggle, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
