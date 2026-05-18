import type { Contact, LedgerEntry } from "@/src/store/store";

export type BalanceStatus = "DEBE" | "A_FAVOR" | "SALDADO";

export interface Balance {
  debe: number;
  haber: number;
  net: number; // debe - haber
  absolute: number;
  status: BalanceStatus;
}

export const computeBalance = (entries: LedgerEntry[]): Balance => {
  const debe = entries.reduce((s, e) => s + (Number(e.debe) || 0), 0);
  const haber = entries.reduce((s, e) => s + (Number(e.haber) || 0), 0);
  const net = debe - haber;
  let status: BalanceStatus = "SALDADO";
  if (net > 0) status = "DEBE";
  else if (net < 0) status = "A_FAVOR";
  return { debe, haber, net, absolute: Math.abs(net), status };
};

export const formatCurrency = (n: number): string => {
  const abs = Math.abs(Math.round(n));
  const parts = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$${parts}`;
};

export const formatDateDMY = (iso: string): string => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
};

// Monday of current week (inclusive), local time
export const mondayThisWeek = (): Date => {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun..6=Sat
  const diff = (dow + 6) % 7; // days since Monday
  const m = new Date(now);
  m.setDate(now.getDate() - diff);
  m.setHours(0, 0, 0, 0);
  return m;
};

export interface WeeklySummary {
  inCash: number; // cliente pagó efectivo
  inBank: number; // cliente pagó transferencia
  outCash: number; // pago a proveedor efectivo
  outBank: number; // pago a proveedor transferencia
  totalIn: number;
  totalOut: number;
  net: number;
}

export const computeWeekly = (
  clients: Contact[],
  providers: Contact[],
): WeeklySummary => {
  const monday = mondayThisWeek();
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const isThisWeek = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    return d >= monday && d <= todayEnd;
  };

  let inCash = 0,
    inBank = 0,
    outCash = 0,
    outBank = 0;

  clients.forEach((c) => {
    c.entries.forEach((e) => {
      if (!isThisWeek(e.date)) return;
      // haber from a client = real money received
      const v = Number(e.haber) || 0;
      if (e.method === "EFECTIVO") inCash += v;
      else inBank += v;
    });
  });

  providers.forEach((p) => {
    p.entries.forEach((e) => {
      if (!isThisWeek(e.date)) return;
      // haber to a provider = real money paid out
      const v = Number(e.haber) || 0;
      if (e.method === "EFECTIVO") outCash += v;
      else outBank += v;
    });
  });

  const totalIn = inCash + inBank;
  const totalOut = outCash + outBank;
  return {
    inCash,
    inBank,
    outCash,
    outBank,
    totalIn,
    totalOut,
    net: totalIn - totalOut,
  };
};
