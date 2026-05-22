import { useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";

export type Method = "EFECTIVO" | "TRANSFERENCIA";

export interface LedgerEntry {
  id: string;
  date: string; // ISO YYYY-MM-DD
  description: string;
  debe: number; // amount that increases debt
  haber: number; // amount that decreases debt (payment)
  method: Method;
  photo?: string | null; // local URI or base64
}

export interface Contact {
  id: string;
  name: string;
  entries: LedgerEntry[];
}

export interface RepartoItem {
  id: string;
  clientName: string;
  productDetail: string;
  quantity: string;
  delivered: boolean;
}

export interface RepartoDay {
  id: string;
  date: string; // ISO YYYY-MM-DD
  name?: string; // optional custom label, e.g. "Reparto de cerdo"
  items: RepartoItem[];
}

export interface Reminder {
  id: string;
  concept: string; // cliente/concepto
  amount: number;
  dueAt: string; // ISO datetime
  notificationId?: string | null;
  done: boolean;
  createdAt: string;
}

export interface AppData {
  clients: Contact[];
  providers: Contact[];
  repartos: RepartoDay[];
  reminders: Reminder[];
}

const STORAGE_KEY = "erp_contable_data_v1";

const uid = () =>
  Math.random().toString(36).slice(2) + Date.now().toString(36);

const today = () => new Date().toISOString().slice(0, 10);

const seedData = (): AppData => {
  const t = today();
  const d = new Date();
  d.setDate(d.getDate() - 3);
  const recent = d.toISOString().slice(0, 10);
  return {
    clients: [
      {
        id: uid(),
        name: "Juan Pérez",
        entries: [
          {
            id: uid(),
            date: recent,
            description: "Venta Mayorista",
            debe: 15000,
            haber: 0,
            method: "EFECTIVO",
            photo: null,
          },
          {
            id: uid(),
            date: t,
            description: "Entrega Parcial",
            debe: 0,
            haber: 5000,
            method: "TRANSFERENCIA",
            photo: null,
          },
        ],
      },
      {
        id: uid(),
        name: "María González",
        entries: [
          {
            id: uid(),
            date: recent,
            description: "Pedido Semanal",
            debe: 8000,
            haber: 0,
            method: "EFECTIVO",
          },
          {
            id: uid(),
            date: t,
            description: "Pago Adelantado",
            debe: 0,
            haber: 12000,
            method: "TRANSFERENCIA",
          },
        ],
      },
    ],
    providers: [
      {
        id: uid(),
        name: "Distribuidora Norte",
        entries: [
          {
            id: uid(),
            date: recent,
            description: "Compra Mercadería",
            debe: 20000,
            haber: 0,
            method: "TRANSFERENCIA",
          },
          {
            id: uid(),
            date: t,
            description: "Pago Parcial",
            debe: 0,
            haber: 8000,
            method: "EFECTIVO",
          },
        ],
      },
    ],
    repartos: [
      {
        id: uid(),
        date: t,
        items: [
          {
            id: uid(),
            clientName: "Juan Pérez",
            productDetail: "Cajas de gaseosa 2L x6",
            quantity: "3",
            delivered: true,
          },
          {
            id: uid(),
            clientName: "María González",
            productDetail: "Pack de agua mineral 500ml x12",
            quantity: "5",
            delivered: false,
          },
        ],
      },
    ],
    reminders: [],
  };
};

const empty: AppData = { clients: [], providers: [], repartos: [], reminders: [] };

let inMemory: AppData = empty;
const listeners = new Set<() => void>();
let loaded = false;

const notify = () => listeners.forEach((l) => l());

const persist = async () => {
  await storage.setItem(STORAGE_KEY, JSON.stringify(inMemory));
};

const load = async () => {
  if (loaded) return;
  const raw = await storage.getItem<string>(STORAGE_KEY, "");
  if (raw) {
    try {
      inMemory = JSON.parse(raw);
    } catch {
      inMemory = seedData();
      await persist();
    }
  } else {
    inMemory = seedData();
    await persist();
  }
  loaded = true;
  notify();
};

export const useStore = () => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const cb = () => setTick((t) => t + 1);
    listeners.add(cb);
    if (!loaded) load();
    else cb();
    return () => {
      listeners.delete(cb);
    };
  }, []);

  const update = useCallback(async (mut: (d: AppData) => void) => {
    mut(inMemory);
    await persist();
    notify();
  }, []);

  return {
    data: inMemory,
    loaded,
    replaceAll: (next: AppData) =>
      update((d) => {
        d.clients = next.clients || [];
        d.providers = next.providers || [];
        d.repartos = next.repartos || [];
        d.reminders = next.reminders || [];
      }),
    // reminders
    addReminder: (r: Omit<Reminder, "id" | "createdAt" | "done">) =>
      update((d) => {
        if (!Array.isArray(d.reminders)) d.reminders = [];
        d.reminders.push({
          id: uid(),
          createdAt: new Date().toISOString(),
          done: false,
          ...r,
        });
      }),
    updateReminder: (id: string, patch: Partial<Reminder>) =>
      update((d) => {
        if (!Array.isArray(d.reminders)) d.reminders = [];
        const r = d.reminders.find((x) => x.id === id);
        if (r) Object.assign(r, patch);
      }),
    deleteReminder: (id: string) =>
      update((d) => {
        if (!Array.isArray(d.reminders)) d.reminders = [];
        d.reminders = d.reminders.filter((r) => r.id !== id);
      }),
    // contacts
    addContact: (kind: "clients" | "providers", name: string) =>
      update((d) => {
        d[kind].push({ id: uid(), name, entries: [] });
      }),
    deleteContact: (kind: "clients" | "providers", id: string) =>
      update((d) => {
        d[kind] = d[kind].filter((c) => c.id !== id);
      }),
    addEntry: (kind: "clients" | "providers", contactId: string) =>
      update((d) => {
        const c = d[kind].find((x) => x.id === contactId);
        if (c) {
          c.entries.push({
            id: uid(),
            date: today(),
            description: "",
            debe: 0,
            haber: 0,
            method: "EFECTIVO",
            photo: null,
          });
        }
      }),
    updateEntry: (
      kind: "clients" | "providers",
      contactId: string,
      entryId: string,
      patch: Partial<LedgerEntry>,
    ) =>
      update((d) => {
        const c = d[kind].find((x) => x.id === contactId);
        if (!c) return;
        const e = c.entries.find((x) => x.id === entryId);
        if (e) Object.assign(e, patch);
      }),
    deleteEntry: (
      kind: "clients" | "providers",
      contactId: string,
      entryId: string,
    ) =>
      update((d) => {
        const c = d[kind].find((x) => x.id === contactId);
        if (!c) return;
        c.entries = c.entries.filter((e) => e.id !== entryId);
      }),
    // reparto
    addRepartoDay: async (date: string, name?: string): Promise<string> => {
      const id = uid();
      await update((d) => {
        d.repartos.push({ id, date, name: name?.trim() || undefined, items: [] });
      });
      return id;
    },
    updateRepartoDay: (id: string, patch: Partial<RepartoDay>) =>
      update((d) => {
        const r = d.repartos.find((x) => x.id === id);
        if (r) Object.assign(r, patch);
      }),
    reorderRepartoItems: (dayId: string, newItems: RepartoItem[]) =>
      update((d) => {
        const r = d.repartos.find((x) => x.id === dayId);
        if (r) r.items = newItems;
      }),
    deleteRepartoDay: (id: string) =>
      update((d) => {
        d.repartos = d.repartos.filter((r) => r.id !== id);
      }),
    addRepartoItem: (dayId: string) =>
      update((d) => {
        const r = d.repartos.find((x) => x.id === dayId);
        if (r)
          r.items.push({
            id: uid(),
            clientName: "",
            productDetail: "",
            quantity: "",
            delivered: false,
          });
      }),
    updateRepartoItem: (
      dayId: string,
      itemId: string,
      patch: Partial<RepartoItem>,
    ) =>
      update((d) => {
        const r = d.repartos.find((x) => x.id === dayId);
        if (!r) return;
        const it = r.items.find((x) => x.id === itemId);
        if (it) Object.assign(it, patch);
      }),
    moveRepartoItem: (dayId: string, itemId: string, direction: -1 | 1) =>
      update((d) => {
        const r = d.repartos.find((x) => x.id === dayId);
        if (!r) return;
        const idx = r.items.findIndex((x) => x.id === itemId);
        if (idx < 0) return;
        const newIdx = idx + direction;
        if (newIdx < 0 || newIdx >= r.items.length) return;
        const [moved] = r.items.splice(idx, 1);
        r.items.splice(newIdx, 0, moved);
      }),
    deleteRepartoItem: (dayId: string, itemId: string) =>
      update((d) => {
        const r = d.repartos.find((x) => x.id === dayId);
        if (!r) return;
        r.items = r.items.filter((x) => x.id !== itemId);
      }),
  };
};

export const utils = { uid, today };

