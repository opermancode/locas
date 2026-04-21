# Locas · Smart Billing for India 🇮🇳

> GST-compliant offline billing software for Indian small businesses — invoices, purchase orders, quotations, parties, inventory, expenses, and detailed reports. Built with React Native for Web + Electron.

[![License](https://img.shields.io/badge/license-PolyForm%20Shield-orange)](./LICENSE.txt)
[![Version](https://img.shields.io/badge/version-1.12.16-blue)](./electron/package.json)
[![Platform](https://img.shields.io/badge/platform-Windows-lightgrey)](https://locasdot.vercel.app)

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Key Modules](#key-modules)
- [GST & Calculation Logic](#gst--calculation-logic)
- [Data Storage](#data-storage)
- [Reports & Exports](#reports--exports)
- [License](#license)

---

## Overview

Locas is a fully offline Windows desktop billing application designed specifically for Indian GST-registered businesses. All data is stored locally — no internet required for day-to-day use. The app handles the full billing workflow from quotation → invoice → payment → reporting.

**Live site:** [locasdot.vercel.app](https://locasdot.vercel.app)

---

## Features

### 🧾 Invoicing
- GST-compliant sales invoices with automatic CGST/SGST/IGST split
- Intra-state (CGST + SGST) and inter-state (IGST) supply type detection
- Invoice-level and line-item discounts with proportional GST reduction
- Multiple professional print templates (A4, thermal 80mm, classic, modern)
- Payment recording with partial payment and overpayment protection
- Invoice number conflict detection and custom numbering

### 📋 Quotations
- Create and manage quotations with full line-item detail
- Convert quotations directly to invoices
- Status tracking: Pending → Accepted → Converted / Expired

### 📦 Purchase Orders
- Create POs with item-wise delivery tracking
- PO Alerts — overdue and near-due POs (configurable: 3/7/14/30 days)
- PO Backlog — Jira-style board showing fulfillment progress per item
- Dashboard PO widget with month selector and unfulfilled value

### 👥 Parties
- Customer and supplier management
- Automatic balance tracking — updates on invoice create/edit/delete/payment
- Outstanding balance view per party

### 📦 Inventory
- Product and service item management
- Stock tracking with auto-deduction on sale and restore on delete/edit
- Low stock alerts with configurable minimum per item
- Service items bypass stock checks entirely

### 💳 Expenses
- Expense logging by category (Rent, Salary, Transport, Marketing, etc.)
- Payment method tracking (Cash, UPI, Bank Transfer, Cheque)

### 📊 Reports

| Tab | Description |
|-----|-------------|
| **Overview** | P&L hero, KPI tiles, top customers, GST quick view |
| **Income** | Net income with Ex-GST / Incl-GST toggle + per-section date filters |
| **Sales** | Full invoice table with paid, balance, status |
| **Purchases** | Purchase invoice table |
| **Expenses** | Category breakdown and all entries |
| **GST / GSTR** | GSTR-1 ready — B2B (Table 4A), B2C (Table 7), HSN summary (Table 12) |
| **P & L** | Profit & Loss — Sales − Purchases − Expenses |

8 date presets: Today, This Week, This Month, Last Month, This Quarter, This FY, Last FY, Custom range.

### 📤 Exports
- **Styled XLSX** — Income Report + GSTR-1 with coloured section headers, alternating rows, ₹ number formatting, SUM formulas. Generated in pure Node.js — **no Python, no pip, no external tools**
- **CSV fallback** — for all report types when running outside Electron

### 🖥️ Desktop UI
- Dark collapsible sidebar with inline dropdowns for Reports (7 tabs) and PO Orders
- No-scroll dashboard: hero + revenue chart, quick actions, KPI tiles, alert chips (overdue invoices + low stock), donut breakdown, PO widget, recent quotations
- Global search across invoices, quotations, parties, products
- Auto-update with download progress banner and one-click install

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React Native for Web |
| Desktop | Electron 28 |
| Navigation | React Navigation (Stack + Bottom Tabs) |
| Storage | LocalForage (IndexedDB) |
| PDF / Print | Expo Print + custom HTML templates |
| XLSX Export | Pure Node.js — built-in `zlib` only |
| Build | Electron Builder |

---

## Project Structure

```
locas/
├── electron/
│   ├── main.js              # Electron main process, IPC handlers, auto-updater
│   ├── preload.js           # Context bridge — exposes electronAPI to renderer
│   └── xlsxGenerator.js    # Zero-dependency XLSX generator (Node.js built-ins only)
│
├── src/
│   ├── db/
│   │   ├── db.web.js        # All DB operations — invoices, parties, POs, etc.
│   │   └── index.js         # Export barrel
│   │
│   ├── navigation/
│   │   └── AppNavigator.js  # Sidebar with inline dropdowns + mobile tab bar
│   │
│   ├── screens/
│   │   ├── Auth/            # Login
│   │   ├── Dashboard/       # Main dashboard
│   │   ├── Invoice/         # Create / list / detail / preview
│   │   ├── Quotation/       # Create / list / detail
│   │   ├── PurchaseOrder/   # Create / list / detail / alerts / backlog
│   │   ├── Parties/         # Party list and detail
│   │   ├── Inventory/       # Item management
│   │   ├── Expenses/        # Expense entries
│   │   ├── Reports/         # 7-tab reports screen
│   │   ├── Settings/        # Profile, backup, preferences
│   │   └── Support/         # Help & support
│   │
│   ├── utils/
│   │   ├── gst.js           # All GST/tax calculations + INR formatters
│   │   ├── templates/       # Invoice HTML print templates (template1–6)
│   │   ├── licenseSystem.js # License validation
│   │   └── Icon.js          # Icon component wrapper
│   │
│   └── theme.js             # COLORS, FONTS, RADIUS, SHADOW tokens
│
└── App.js                   # Root component
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- Windows (for Electron packaging)

### Development

```bash
# Install root dependencies
npm install

# Install Electron dependencies
cd electron && npm install && cd ..

# Start the React Native web dev server
npm start

# In a separate terminal — launch Electron pointing at the dev server
cd electron && npm run dev
```

### Production Build

```bash
# 1. Build the React web bundle
npm run build:web

# 2. Package with Electron Builder (outputs to electron/dist/)
cd electron && npm run build
```

---

## Key Modules

### `src/utils/gst.js` — Calculation Engine

```js
// Line item: qty × rate → discount → GST split
calcLineItem(item, supplyType)
// → { taxable, cgst, sgst, igst, total_tax, total }

// Invoice totals with optional invoice-level discount
calcInvoiceTotals(lineItems, invoiceDiscount, supplyType)
// → { subtotal, discount, taxable, cgst, sgst, igst, total_tax, total }

// Rounding to 2 decimal places
round(n) // Math.round(n * 100) / 100

// Formatters
formatINR(n)        // "₹1,34,504.66"
formatINRCompact(n) // "₹1.3L" | "₹52.0K" | "-₹5K"
```

### `electron/xlsxGenerator.js` — XLSX Export

Builds a valid `.xlsx` file (Office Open XML in a ZIP) using only Node.js built-in `zlib`. No npm packages, no Python. Ships inside the Electron bundle.

```js
const { generateReport } = require('./xlsxGenerator');
const buffer = generateReport({ from, to, sales, pos, saleLineItems });
fs.writeFileSync(outputPath, buffer);
// Opens two-sheet workbook: "Income Report" + "GSTR-1 Report"
```

---

## GST & Calculation Logic

### Tax Split by Supply Type

| Supply Type | CGST | SGST | IGST |
|------------|------|------|------|
| Intra-state (same state) | `rate ÷ 2` | `rate ÷ 2` | `0` |
| Inter-state (different state) | `0` | `0` | `rate` |

Supply type is auto-detected by comparing business state code vs. party state code.

### Invoice-Level Discount

Applied after line-item discounts. GST is proportionally reduced rather than recalculated per item — mathematically equivalent and correct:

```
extraDiscount = taxable × invoiceDiscountRate
reduction     = extraDiscount / taxable          // proportion factor
finalCGST     = cgst − (reduction × cgst)
finalSGST     = sgst − (reduction × sgst)
finalIGST     = igst − (reduction × igst)
```

### Party Balance Rules

| Event | Balance Change |
|-------|---------------|
| New invoice | `+= invoice.total` |
| Record payment | `-= payment.amount` |
| Delete invoice | `-= (total − paid)` — outstanding only |
| Edit invoice, same party | `+= (newTotal − oldTotal)` |
| Edit invoice, party changed | old: `-= outstanding` / new: `+= newTotal` |

### Floating Point Tolerance
Payment overpayment check uses `outstanding + 0.001` tolerance to handle floating point precision.

---

## Data Storage

All data is stored locally in **LocalForage** (IndexedDB in Electron). There is no cloud sync and no external server.

### Stores

| Store | Contents |
|-------|----------|
| `profile` | Business name, address, GSTIN, state code |
| `parties` | Customers / suppliers with running balance |
| `items` | Products and services with stock levels |
| `invoices` | Sale and purchase invoice headers |
| `invoice_items` | Line items per invoice |
| `payments` | Payment records per invoice |
| `expenses` | Expense entries by category |
| `quotations` | Quotation headers |
| `quotation_items` | Line items per quotation |
| `purchase_orders` | PO headers with status |
| `po_items` | Item lines per PO with `qty_ordered` and `qty_delivered` |

### Backup & Restore
Full data export and import via AES-256 encrypted JSON. Available in **Settings → Backup**. Stores all tables including POs, quotations, and payments.

---

## Reports & Exports

### XLSX Export Flow

```
User clicks "Export XLSX"
  → ReportsScreen calls window.electronAPI.generateReport(data, type)
  → main.js receives IPC, calls xlsxGenerator.generateReport(data)
  → Pure Node.js builds ZIP-based XLSX in memory (~1ms)
  → Shows native Save dialog
  → Writes file to chosen path
  → Opens automatically in Excel / LibreOffice
```

### GSTR-1 Sheet Structure

```
GSTR-1 Report (Sheet 2)
├── TABLE 4A  — B2B Invoices (registered, with GSTIN)
│               Columns: Invoice No, Date, Party, GSTIN, Place of Supply,
│                        Taxable, IGST, CGST, SGST, Total Tax, Invoice Value
├── TABLE 7   — B2C / Walk-in (unregistered, no GSTIN)
│               Columns: Invoice No, Date, Party, Taxable, IGST, CGST, SGST, Tax, Total
├── TABLE 12  — HSN/SAC Wise Summary
│               Columns: HSN, Description, UOM, Qty, Taxable, IGST, CGST, SGST, Tax
└── GST Summary
    Total invoices, B2B count, B2C count, taxable value, CGST, SGST, IGST,
    total tax liability, total invoice value
```

> ⚠️ The GSTR-1 export is for reference. Always verify with your CA before filing on the GST portal.

---

## License

**PolyForm Shield License 1.0.0**

Copyright [locastitch](http://locasdot.vercel.app)

Source-available but **not open source**. You may use and modify this software for personal or internal business purposes. You may **not** use it to build a competing billing product or service.

See [LICENSE.txt](./LICENSE.txt) for complete terms.