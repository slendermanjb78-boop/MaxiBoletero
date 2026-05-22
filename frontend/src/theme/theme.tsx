import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
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
  // complementary accent (auto-derived from `blue` = accent)
  accentAlt: string;
  accentAltLight: string;
  // contrast color to use ON TOP of accent (blue) — black or white
  onAccent: string;
  // tab bar / header on top of bg
  tabBg: string;
  // dark surfaces always-dark (header detail, footer detail, summary card)
  dark: string;
  darkBorder: string;
  darkMuted: string;
  rowAlt: string;
}

// ---------- Color helpers ----------
export const DEFAULT_ACCENT_LIGHT = "#2563eb"; // blue-600
export const DEFAULT_ACCENT_DARK = "#60a5fa";  // blue-400

const clamp = (n: number, min = 0, max = 255) => Math.max(min, Math.min(max, n));

const normalizeHex = (hex: string): string => {
  if (!hex) return DEFAULT_ACCENT_LIGHT;
  let h = hex.trim().replace("#", "");
  if (h.length === 3) {
    h = h.split("").map((c) => c + c).join("");
  }
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return DEFAULT_ACCENT_LIGHT.replace("#", "");
  return "#" + h.toLowerCase();
};

export const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const h = normalizeHex(hex).replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

export const rgbToHex = (r: number, g: number, b: number): string => {
  const toHex = (n: number) => clamp(Math.round(n)).toString(16).padStart(2, "0");
  return "#" + toHex(r) + toHex(g) + toHex(b);
};

// Relative luminance per WCAG
export const luminance = (hex: string): number => {
  const { r, g, b } = hexToRgb(hex);
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};

export const contrastOn = (hex: string): string =>
  luminance(hex) > 0.55 ? "#0f172a" : "#ffffff";

// rgba string with alpha
export const withAlpha = (hex: string, alpha: number): string => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
};

// Slightly darken / lighten for ink variant
export const darken = (hex: string, amount = 0.35): string => {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amount), g * (1 - amount), b * (1 - amount));
};

// HSL utilities for complement color
const rgbToHsl = (r: number, g: number, b: number) => {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h *= 60;
  }
  return { h, s, l };
};

const hslToRgb = (h: number, s: number, l: number) => {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
};

// Complementary color in HSL space (hue + 180°). If accent is achromatic
// (saturation ~ 0), fall back to a warm orange so the contrast is meaningful.
export const complement = (hex: string): string => {
  const { r, g, b } = hexToRgb(hex);
  const hsl = rgbToHsl(r, g, b);
  if (hsl.s < 0.08) return "#f59e0b"; // neutral accent → friendly orange
  // Boost saturation a tiny bit to keep complement vivid
  const compS = Math.min(1, hsl.s * 1.05);
  const compL = Math.min(0.62, Math.max(0.38, hsl.l));
  const { r: cr, g: cg, b: cb } = hslToRgb(hsl.h + 180, compS, compL);
  return rgbToHex(cr, cg, cb);
};

// ---------- Palettes ----------
const buildLight = (accent: string): ThemeColors => {
  const alt = complement(accent);
  return {
    bg: "#f8fafc",
    card: "#ffffff",
    ink: "#0f172a",
    text: "#334155",
    muted: "#64748b",
    border: "#e2e8f0",
    borderLight: "#f1f5f9",
    blue: accent,
    blueLight: withAlpha(accent, 0.14),
    red: "#dc2626",
    redLight: "#fee2e2",
    green: "#16a34a",
    greenLight: "#dcfce7",
    yellow: "#facc15",
    yellowLight: "#fef9c3",
    amber: "#92400e",
    blueInk: darken(accent, 0.4),
    accentAlt: alt,
    accentAltLight: withAlpha(alt, 0.16),
    onAccent: contrastOn(accent),
    tabBg: "#ffffff",
    dark: "#0f172a",
    darkBorder: "#1e293b",
    darkMuted: "#94a3b8",
    rowAlt: "#f8fafc",
  };
};

const buildDark = (accent: string): ThemeColors => {
  const alt = complement(accent);
  return {
    bg: "#020617",
    card: "#0f172a",
    ink: "#f8fafc",
    text: "#cbd5e1",
    muted: "#94a3b8",
    border: "#1e293b",
    borderLight: "#1e293b",
    blue: accent,
    blueLight: withAlpha(accent, 0.18),
    red: "#f87171",
    redLight: "rgba(239,68,68,0.18)",
    green: "#4ade80",
    greenLight: "rgba(34,197,94,0.18)",
    yellow: "#facc15",
    yellowLight: "rgba(250,204,21,0.18)",
    amber: "#fbbf24",
    blueInk: darken(accent, 0.45),
    accentAlt: alt,
    accentAltLight: withAlpha(alt, 0.22),
    onAccent: contrastOn(accent),
    tabBg: "#0f172a",
    dark: "#020617",
    darkBorder: "#1e293b",
    darkMuted: "#94a3b8",
    rowAlt: "#0b1220",
  };
};

export const LIGHT: ThemeColors = buildLight(DEFAULT_ACCENT_LIGHT);
export const DARK: ThemeColors = buildDark(DEFAULT_ACCENT_DARK);

const STORAGE_KEY = "erp_theme_mode_v1";
const ACCENT_KEY = "erp_accent_color_v1";
const TONE_KEY = "erp_notification_tone_v1";

export interface NotificationTone {
  uri: string | null; // null = default system sound
  name: string;       // display name
}

const DEFAULT_TONE: NotificationTone = { uri: null, name: "Sonido del sistema" };

interface Ctx {
  mode: ThemeMode;
  colors: ThemeColors;
  toggle: () => void;
  setMode: (m: ThemeMode) => void;
  accent: string;
  setAccent: (hex: string) => void;
  resetAccent: () => void;
  tone: NotificationTone;
  setTone: (t: NotificationTone) => void;
}

const ThemeContext = createContext<Ctx>({
  mode: "light",
  colors: LIGHT,
  toggle: () => {},
  setMode: () => {},
  accent: DEFAULT_ACCENT_LIGHT,
  setAccent: () => {},
  resetAccent: () => {},
  tone: DEFAULT_TONE,
  setTone: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>("light");
  const [accent, setAccentState] = useState<string>(DEFAULT_ACCENT_LIGHT);
  const [tone, setToneState] = useState<NotificationTone>(DEFAULT_TONE);

  useEffect(() => {
    (async () => {
      const savedMode = await storage.getItem<string>(STORAGE_KEY, "");
      if (savedMode === "dark" || savedMode === "light") setModeState(savedMode);
      const savedAccent = await storage.getItem<string>(ACCENT_KEY, "");
      if (savedAccent && /^#[0-9a-fA-F]{6}$/.test(savedAccent)) {
        setAccentState(savedAccent);
      } else {
        setAccentState(savedMode === "dark" ? DEFAULT_ACCENT_DARK : DEFAULT_ACCENT_LIGHT);
      }
      const savedTone = await storage.getItem<string>(TONE_KEY, "");
      if (savedTone) {
        try {
          const parsed = JSON.parse(savedTone) as NotificationTone;
          if (parsed && typeof parsed === "object") setToneState(parsed);
        } catch {}
      }
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

  const setAccent = useCallback((hex: string) => {
    const norm = normalizeHex(hex);
    setAccentState(norm);
    storage.setItem(ACCENT_KEY, norm);
  }, []);

  const resetAccent = useCallback(() => {
    const def = mode === "dark" ? DEFAULT_ACCENT_DARK : DEFAULT_ACCENT_LIGHT;
    setAccentState(def);
    storage.setItem(ACCENT_KEY, def);
  }, [mode]);

  const setTone = useCallback((t: NotificationTone) => {
    setToneState(t);
    storage.setItem(TONE_KEY, JSON.stringify(t));
  }, []);

  const colors = useMemo(
    () => (mode === "dark" ? buildDark(accent) : buildLight(accent)),
    [mode, accent],
  );

  return (
    <ThemeContext.Provider value={{ mode, colors, toggle, setMode, accent, setAccent, resetAccent, tone, setTone }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
