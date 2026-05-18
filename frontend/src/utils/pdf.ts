import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import type { Contact } from "@/src/store/store";
import { computeBalance, formatCurrency, formatDateDMY } from "./calc";

const statusLabel = (s: string) =>
  s === "DEBE" ? "DEBE" : s === "A_FAVOR" ? "A FAVOR" : "SALDADO";
const statusColor = (s: string) =>
  s === "DEBE" ? "#dc2626" : s === "A_FAVOR" ? "#2563eb" : "#16a34a";

export const buildContactHtml = (
  contact: Contact,
  kind: "clients" | "providers",
) => {
  const bal = computeBalance(contact.entries);
  const rows = contact.entries
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(
      (e) => `
      <tr>
        <td>${formatDateDMY(e.date)}</td>
        <td>${escapeHtml(e.description || "")}</td>
        <td class="num">${e.debe ? formatCurrency(e.debe) : ""}</td>
        <td class="num">${e.haber ? formatCurrency(e.haber) : ""}</td>
        <td>${e.method}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"/>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0f172a; padding: 24px; }
    .header { background: #0f172a; color: white; padding: 20px; border-radius: 14px; margin-bottom: 20px; }
    .header h1 { margin: 0; font-size: 22px; letter-spacing: 1px; }
    .sub { color: #94a3b8; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;}
    table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12px; }
    th { background: #0f172a; color: white; text-align: left; padding: 10px; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
    .num { font-family: 'Menlo','Courier New', monospace; text-align: right; }
    .tot { margin-top: 16px; display: flex; justify-content: space-between; padding: 14px 16px; background: #f8fafc; border-radius: 12px; }
    .tot .label { color: #64748b; text-transform: uppercase; font-size: 11px; letter-spacing: 2px; }
    .tot .val { font-weight: 700; font-family: 'Menlo','Courier New', monospace; }
    .badge { display: inline-block; padding: 6px 12px; border-radius: 999px; color: white; font-weight: 700; font-size: 11px; letter-spacing: 2px; background: ${statusColor(bal.status)}; }
    .meta { color: #64748b; font-size: 11px; margin-top: 4px; }
  </style></head>
  <body>
    <div class="header">
      <div class="sub">${kind === "clients" ? "Cliente" : "Proveedor"} · Cuenta Corriente</div>
      <h1>${escapeHtml(contact.name)}</h1>
      <div class="meta">Reporte generado: ${new Date().toLocaleString("es-AR")}</div>
    </div>
    <table>
      <thead><tr><th>Fecha</th><th>Detalle</th><th>Debe (+)</th><th>Haber (-)</th><th>Medio</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:24px">Sin movimientos</td></tr>`}</tbody>
    </table>
    <div class="tot"><span class="label">Total Debe</span><span class="val" style="color:#dc2626">${formatCurrency(bal.debe)}</span></div>
    <div class="tot"><span class="label">Total Haber</span><span class="val" style="color:#2563eb">${formatCurrency(bal.haber)}</span></div>
    <div class="tot"><span class="label">Saldo</span><span class="badge">${statusLabel(bal.status)} ${formatCurrency(bal.absolute)}</span></div>
  </body></html>`;
};

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    c === "&"
      ? "&amp;"
      : c === "<"
        ? "&lt;"
        : c === ">"
          ? "&gt;"
          : c === '"'
            ? "&quot;"
            : "&#39;",
  );

export const exportAndShareContact = async (
  contact: Contact,
  kind: "clients" | "providers",
) => {
  const html = buildContactHtml(contact, kind);
  const { uri } = await Print.printToFileAsync({ html });
  if (Platform.OS === "web") {
    // open print preview on web
    return;
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle: `Compartir cuenta de ${contact.name}`,
      UTI: "com.adobe.pdf",
    });
  }
};
