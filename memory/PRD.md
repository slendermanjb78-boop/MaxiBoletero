# Gestión Contable Pro — PRD

## Overview
ERP móvil (Expo React Native) para gestión de cuentas corrientes de clientes y proveedores, con estética de grilla Excel, evidencia fotográfica, reportes financieros y planilla de reparto diario. Persistencia 100% local en el dispositivo (AsyncStorage).

## Tabs (Bottom Navigation)
1. **Clientes** — "Quienes me deben". Lista de tarjetas redondeadas con avatar, nombre, etiqueta DEBE/A FAVOR/SALDADO y monto absoluto.
2. **Resumen** — Dashboard semanal (lunes → hoy). Card Balance Neto + 4 KPIs (Efectivo Cobrado, Banco Cobrado, Efectivo Pagado, Banco Pagado) + estadísticas globales.
3. **Proveedores** — "A quién le debo". Misma UI que Clientes.
4. **Reparto** — Planilla diaria por fecha con 4 campos: Cliente, Detalle producto, Cantidad, Estado (ENTREGADO/NO ENTREG. toggle booleano).

## Vista detalle (Maestro-Detalle)
- Header oscuro slate-900 con nombre + estado (PENDIENTE/A FAVOR/SALDADO) y monto.
- Grilla Excel con scroll horizontal: FECHA / DETALLE / DEBE (+) / HABER (-) / MEDIO / FOTO.
- Toggle de método EFECTIVO (amarillo) ↔ TRANSFERENCIA (azul).
- Cámara real (expo-image-picker) con fallback a galería; vista previa pantalla completa.
- Fila TOTALES con sumatorias y badge de saldo.
- Botón **NUEVA FILA** (azul).
- Footer oscuro con resumen neto + botón **LISTO**.
- Botón compartir PDF (expo-print + expo-sharing → menú nativo).
- Botón eliminar contacto con confirmación destructiva.

## Reglas de saldo (CRÍTICO)
- Net > 0 → **DEBE** (rojo)
- Net < 0 → **A FAVOR** (azul) — valor absoluto, sin signo menos
- Net = 0 → **SALDADO** (verde)

## Resumen semanal
- Período: lunes de la semana actual → hoy (inclusive).
- Ingresos = `haber` en cuentas de clientes (cobranzas reales).
- Egresos = `haber` en cuentas de proveedores (pagos reales).
- Desglose Efectivo vs Transferencia.

## Stack
- Expo SDK 54 + expo-router (single screen, state-driven navigation)
- expo-image-picker (cámara + galería)
- expo-print + expo-sharing (PDF + share nativo)
- `@/src/utils/storage` (AsyncStorage helper)
- `@expo/vector-icons` (MaterialCommunityIcons, Feather)
- Mono numbers: Menlo/monospace; system sans serif para texto

## Persistencia
Clave única `erp_contable_data_v1` en AsyncStorage. Seed automática la primera vez (2 clientes, 1 proveedor, 1 día de reparto) con historial demostrativo del cambio de etiqueta a "A FAVOR".

## Business enhancement
El PDF generado se comparte vía menú nativo de iOS/Android (WhatsApp, Email, Drive, etc.) — convirtiendo el reporte de cuenta corriente en un mensaje listo para enviar al cliente/proveedor en un solo tap, acelerando cobranzas y reduciendo morosidad.
