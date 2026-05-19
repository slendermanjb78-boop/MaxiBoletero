# Gestión Contable Pro — PRD

## Overview
ERP móvil (Expo React Native) para gestión de cuentas corrientes de clientes y proveedores, con estética de grilla Excel, evidencia fotográfica, reportes financieros, planilla de reparto diario, respaldos JSON y tema claro/oscuro. Persistencia 100% local en el dispositivo (AsyncStorage).

## Tabs (Bottom Navigation - 5 pestañas)
1. **Clientes** — "Quienes me deben". Tarjetas redondeadas con avatar, nombre, etiqueta DEBE/A FAVOR/SALDADO y monto absoluto.
2. **Resumen** — Dashboard semanal (lunes → hoy). Card Balance Neto + 4 KPIs.
3. **Proveedores** — "A quién le debo".
4. **Reparto** — Planilla diaria por fecha con campos Cliente, Producto, Cantidad, Estado, y **reordenamiento ↑↓ tipo playlist**.
5. **Ajustes** — Tema claro/oscuro + respaldo de datos (export/import JSON).

## Vista detalle (Maestro-Detalle)
- Header oscuro slate-900 con nombre + estado y monto.
- Grilla Excel con scroll horizontal: FECHA / DETALLE / DEBE / HABER / MEDIO / FOTO.
- Toggle método EFECTIVO (amarillo) ↔ TRANSFERENCIA (azul).
- Cámara real + galería + preview pantalla completa.
- Fila TOTALES + badge de saldo + botón NUEVA FILA + LISTO.
- Compartir PDF y eliminar contacto con confirmación.

## Reglas de saldo (CRÍTICO)
- Net > 0 → **DEBE** rojo
- Net < 0 → **A FAVOR** azul (valor absoluto)
- Net = 0 → **SALDADO** verde

## Reparto con reordenamiento
- Columna # con botones ↑ y ↓ por fila (deshabilitados en extremos).
- `store.moveRepartoItem(dayId, itemId, direction)` mueve items.
- Ideal para ordenar la ruta de entrega del día.

## Ajustes
- **Tema claro/oscuro** con toggle animado, persiste en `erp_theme_mode_v1`.
- **Exportar (Ligero)** → JSON sin fotos (rápido de compartir por WhatsApp).
- **Exportar (Completo)** → JSON con fotos base64 incluidas.
- **Importar respaldo** → selector de archivo del sistema; valida `app === "gestion-contable-pro"` antes de restaurar; confirma reemplazo destructivo.
- En web: descarga directa Blob. En móvil: menú nativo de compartir (expo-sharing).

## Stack
- Expo SDK 54 + expo-router (single screen, state-driven nav)
- expo-image-picker (cámara + galería)
- expo-print + expo-sharing (PDF + share nativo)
- expo-document-picker + expo-file-system (importar respaldo)
- ThemeContext con paletas LIGHT/DARK
- `@/src/utils/storage` (AsyncStorage)
- `@expo/vector-icons` (MaterialCommunityIcons, Feather)

## Persistencia
- `erp_contable_data_v1`: datos contables (clientes, proveedores, repartos)
- `erp_theme_mode_v1`: preferencia de tema

## Business enhancement
Compartir PDF y respaldos vía menú nativo iOS/Android en un solo tap, más portabilidad entre dispositivos vía JSON ligero → reduce morosidad y permite trabajar desde múltiples equipos sin perder data.
