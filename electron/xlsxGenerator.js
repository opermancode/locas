// ─────────────────────────────────────────────────────────────────────────────
// Locas XLSX Generator — Pure Node.js, zero dependencies
// Uses JSZip-style manual ZIP construction with built-in zlib
// ─────────────────────────────────────────────────────────────────────────────
'use strict';
const zlib = require('zlib');

// ── CRC32 table ──────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ── ZIP builder ───────────────────────────────────────────────────────────────
function buildZip(files) {
  // files: [{name, data (Buffer)}]
  const parts = [];
  const directory = [];
  let offset = 0;

  for (const { name, data } of files) {
    const nameBytes = Buffer.from(name, 'utf8');
    const compressed = zlib.deflateRawSync(data, { level: 6 });
    const crc = crc32(data);
    const now = new Date();
    const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);

    // Local file header
    const local = Buffer.alloc(30 + nameBytes.length);
    local.writeUInt32LE(0x04034b50, 0);   // signature
    local.writeUInt16LE(20, 4);            // version needed
    local.writeUInt16LE(0, 6);             // flags
    local.writeUInt16LE(8, 8);             // compression: deflate
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    nameBytes.copy(local, 30);

    parts.push(local, compressed);

    // Central directory entry
    const cd = Buffer.alloc(46 + nameBytes.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(8, 10);
    cd.writeUInt16LE(dosTime, 12);
    cd.writeUInt16LE(dosDate, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(compressed.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBytes.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    nameBytes.copy(cd, 46);
    directory.push(cd);

    offset += local.length + compressed.length;
  }

  const cdBuf = Buffer.concat(directory);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(directory.length, 8);
  eocd.writeUInt16LE(directory.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...parts, cdBuf, eocd]);
}

// ── Colour / style constants ──────────────────────────────────────────────────
const BRAND   = 'FFFF6B00';
const DARK    = 'FF0F1825';
const NAVY    = 'FF1E3A5F';
const NAVY2   = 'FF1E40AF';
const GREEN   = 'FF14532D';
const PURPLE  = 'FF4C1D95';
const TEAL    = 'FF065F46';
const AMBER   = 'FF92400E';
const DGRAY   = 'FF6B21A8';
const ALT1    = 'FFF8FAFC';
const ALT2    = 'FFF0FDF4';
const WHITE   = 'FFFFFFFF';
const SUMMARY = 'FFF5F3FF';
const SUMMTOT = 'FFEDE9FE';
const GSTBG   = 'FFFEF3C7';

// Shared style indices — built once, referenced by index
// styleId => index in styleSheet
const STYLES = {
  // Headers
  H_BRAND:0, H_META:1,
  H_NAVY:2, H_GREEN:3, H_PURPLE:4, H_TEAL:5, H_AMBER:6, H_DGRAY:7,
  // Section titles
  T_NAVY2:8, T_GREEN:9, T_PURPLE2:10, T_TEAL2:11, T_AMBER2:12, T_DGRAY2:13,
  // Data
  D_NORMAL:14, D_ALT:15, D_ALT2:16, D_ALT3:17,
  D_GREEN_BLD:18, D_RED_BLD:19, D_AMBER_BLD:20, D_BLUE_BLD:21, D_GRAY:22,
  // Numbers with INR format
  N_NORMAL:23, N_ALT:24, N_ALT2:25,
  N_HDR:26,
  N_SUMMARY:27, N_SUMMTOT:28,
  N_GREEN:29, N_RED:30, N_AMBER:31, N_BLUE:32,
  N_GSTBG:33, N_GSTBG_BLD:34,
  // PCT
  P_NORMAL:35, P_GREEN:36, P_AMBER:37,
  // Summary labels
  S_LABEL:38, S_LABEL_BLD:39, S_TOTAL_LABEL:40,
  // Count (right-align text)
  C_HDR:41,
};

function esc(v) {
  if (v == null) return '';
  const s = String(v);
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function inrFmt(v) {
  const n = Number(v || 0);
  return n.toLocaleString('en-IN', { minimumFractionDigits:2, maximumFractionDigits:2 });
}

// ── XML builders ──────────────────────────────────────────────────────────────
function makeSharedStrings(strings) {
  const items = strings.map(s => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${strings.length}" uniqueCount="${strings.length}">${items}</sst>`;
}

function makeStyles() {
  // Single comprehensive stylesheet
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="3">
    <numFmt numFmtId="164" formatCode="&quot;&#8377;&quot;#,##0.00"/>
    <numFmt numFmtId="165" formatCode="0%"/>
    <numFmt numFmtId="166" formatCode="#,##0.00"/>
  </numFmts>
  <fonts count="18">
    <font><sz val="11"/><name val="Calibri"/><color rgb="FF0F172A"/></font>
    <font><b/><sz val="16"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>
    <font><sz val="9"/><i/><name val="Calibri"/><color rgb="FF94A3B8"/></font>
    <font><b/><sz val="9"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>
    <font><sz val="9"/><name val="Calibri"/><color rgb="FF0F172A"/></font>
    <font><b/><sz val="9"/><name val="Calibri"/><color rgb="FF16A34A"/></font>
    <font><b/><sz val="9"/><name val="Calibri"/><color rgb="FFDC2626"/></font>
    <font><b/><sz val="9"/><name val="Calibri"/><color rgb="FFD97706"/></font>
    <font><b/><sz val="9"/><name val="Calibri"/><color rgb="FF2563EB"/></font>
    <font><sz val="9"/><name val="Calibri"/><color rgb="FF94A3B8"/></font>
    <font><sz val="10"/><name val="Calibri"/><color rgb="FF0F172A"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/><color rgb="FF0F172A"/></font>
    <font><b/><sz val="10"/><name val="Calibri"/><color rgb="FFFF6B00"/></font>
    <font><sz val="10"/><name val="Calibri"/><color rgb="FF16A34A"/></font>
    <font><sz val="10"/><name val="Calibri"/><color rgb="FFDC2626"/></font>
    <font><sz val="10"/><name val="Calibri"/><color rgb="FFD97706"/></font>
    <font><sz val="10"/><name val="Calibri"/><color rgb="FF2563EB"/></font>
  </fonts>
  <fills count="26">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${BRAND}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${DARK}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${NAVY}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${NAVY2}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${GREEN}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${PURPLE}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${TEAL}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${AMBER}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${DGRAY}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${WHITE}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${ALT1}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${ALT2}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${SUMMARY}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${SUMMTOT}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="${GSTBG}"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1E3A5F"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF14532D"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF4C1D95"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF065F46"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF6B21A8"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1D4ED8"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF0F9FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFAF5FF"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF0FDF4"/></patternFill></fill>
  </fills>
  <borders count="2">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border>
      <left style="thin"><color rgb="FFD1D5DB"/></left>
      <right style="thin"><color rgb="FFD1D5DB"/></right>
      <top style="thin"><color rgb="FFD1D5DB"/></top>
      <bottom style="thin"><color rgb="FFD1D5DB"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="42">
    <xf numFmtId="0"   fontId="1"  fillId="2"  borderId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="2"  fillId="3"  borderId="0" applyFont="1" applyFill="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="3"  fillId="4"  borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="0"/></xf>
    <xf numFmtId="0"   fontId="3"  fillId="6"  borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="3"  fillId="7"  borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="3"  fillId="8"  borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="3"  fillId="9"  borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="3"  fillId="10" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="4"  fillId="5"  borderId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="4"  fillId="6"  borderId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="4"  fillId="7"  borderId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="4"  fillId="8"  borderId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="4"  fillId="9"  borderId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="4"  fillId="10" borderId="0" applyFont="1" applyFill="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="5"  fillId="11" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="5"  fillId="12" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="5"  fillId="13" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="5"  fillId="25" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="6"  fillId="11" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="7"  fillId="11" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="8"  fillId="11" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="9"  fillId="11" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="10" fillId="11" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="164" fontId="5"  fillId="11" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="5"  fillId="12" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="5"  fillId="13" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="3"  fillId="4"  borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="11" fillId="14" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="13" fillId="15" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="14" fillId="11" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="15" fillId="11" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="16" fillId="11" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="17" fillId="11" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="11" fillId="16" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="164" fontId="12" fillId="16" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="165" fontId="5"  fillId="11" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="165" fontId="6"  fillId="11" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="165" fontId="8"  fillId="11" borderId="1" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="11" fillId="14" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="12" fillId="14" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="13" fillId="15" borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf>
    <xf numFmtId="0"   fontId="3"  fillId="4"  borderId="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
  </cellXfs>
</styleSheet>`;
}

// ── Sheet cell builder ────────────────────────────────────────────────────────
class Sheet {
  constructor() {
    this.rows = [];      // [{r, cells:[{c, type, value, style}]}]
    this.merges = [];    // ["A1:N1"]
    this.heights = {};   // {rowNum: height}
    this.strings = [];   // shared string table
    this.strMap = {};
    this.freezeRow = 3;
    this.colWidths = {}; // {colIndex: width}
  }

  str(s) {
    const key = String(s == null ? '' : s);
    if (this.strMap[key] == null) {
      this.strMap[key] = this.strings.length;
      this.strings.push(key);
    }
    return this.strMap[key];
  }

  addRow(rowNum, cells, height) {
    this.rows.push({ r: rowNum, cells });
    if (height) this.heights[rowNum] = height;
  }

  merge(ref) { this.merges.push(ref); }

  colLetter(n) {
    let s = '';
    while (n > 0) { s = String.fromCharCode(65 + (n-1) % 26) + s; n = Math.floor((n-1) / 26); }
    return s;
  }

  cell(r, c, value, style) {
    // style = index into cellXfs
    const col = this.colLetter(c);
    const ref = `${col}${r}`;
    if (value == null || value === '') {
      return { ref, t: 's', v: this.str(''), s: style };
    }
    if (typeof value === 'number') {
      return { ref, t: 'n', v: value, s: style };
    }
    return { ref, t: 's', v: this.str(String(value)), s: style };
  }

  toXml() {
    const rowsXml = this.rows.map(({ r, cells }) => {
      const h = this.heights[r] ? ` ht="${this.heights[r]}" customHeight="1"` : '';
      const cellsXml = cells.filter(c=>c).map(c => {
        const tAttr = c.t === 'n' ? '' : ` t="s"`;
        const vTag  = c.t === 'n' ? `<v>${c.v}</v>` : `<v>${c.v}</v>`;
        return `<c r="${c.ref}"${tAttr} s="${c.s}">${vTag}</c>`;
      }).join('');
      return `<row r="${r}"${h}>${cellsXml}</row>`;
    }).join('');

    const mergesXml = this.merges.length
      ? `<mergeCells count="${this.merges.length}">${this.merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells>`
      : '';

    const colsXml = Object.keys(this.colWidths).length
      ? `<cols>${Object.entries(this.colWidths).map(([c,w])=>`<col min="${c}" max="${c}" width="${w}" customWidth="1"/>`).join('')}</cols>`
      : '';

    const freezeXml = `<sheetView workbookViewId="0"><pane ySplit="${this.freezeRow}" topLeftCell="A${this.freezeRow+1}" activePane="bottomLeft" state="frozen"/></sheetView>`;

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>${freezeXml}</sheetViews>
  ${colsXml}
  <sheetData>${rowsXml}</sheetData>
  ${mergesXml}
</worksheet>`;
  }
}

// ── INCOME SHEET ─────────────────────────────────────────────────────────────
function buildIncomeSheet(data) {
  const { sales = [], pos = [], from = '', to = '' } = data;
  const sh = new Sheet();
  const C = STYLES;

  // Column widths
  const ws = [3,20,11,30,22,9,15,13,13,13,14,16,13,15,11];
  ws.forEach((w,i) => sh.colWidths[i+1] = w);

  let r = 1;

  // Title
  sh.merge(`A1:O1`);
  sh.addRow(r, [sh.cell(r,1,`INCOME REPORT  ·  ${from}  to  ${to}`, C.H_BRAND)], 36);
  r++;
  sh.merge(`A2:O2`);
  sh.addRow(r, [sh.cell(r,1,`Generated ${new Date().toLocaleDateString('en-IN')}  |  Locas Billing`, C.H_META)], 18);
  r++;

  // ── Section A: Sales ─────────────────────────────────────────────
  r++;
  sh.merge(`A${r}:O${r}`);
  sh.addRow(r, [sh.cell(r,1,'▌  A — SALES INVOICES', C.T_NAVY2)], 22); r++;

  const invHdrs = ['#','Invoice No','Date','Party','GSTIN','Supply','Taxable (₹)',
                   'CGST (₹)','SGST (₹)','IGST (₹)','Tax (₹)','Total (₹)','Paid (₹)','Bal. (₹)','Status'];
  sh.addRow(r, invHdrs.map((h,i) => sh.cell(r,i+1,h,C.H_NAVY)), 18); r++;
  const invStart = r;

  for (let i = 0; i < sales.length; i++) {
    const inv = sales[i];
    const alt  = i % 2 === 1;
    const nst  = alt ? C.N_ALT : C.N_NORMAL;
    const dst  = alt ? C.D_ALT : C.D_NORMAL;
    const bal  = (inv.total||0) - (inv.paid||0);
    const st   = (inv.status||'unpaid').toLowerCase();
    const stSt = st==='paid' ? C.D_GREEN_BLD : st==='partial' ? C.D_AMBER_BLD : C.D_RED_BLD;

    sh.addRow(r, [
      sh.cell(r,1,i+1,dst),
      sh.cell(r,2,inv.invoice_number||'',dst),
      sh.cell(r,3,inv.date||'',dst),
      sh.cell(r,4,inv.party_name||'',dst),
      sh.cell(r,5,inv.party_gstin||'—',dst),
      sh.cell(r,6,inv.supply_type==='inter'?'Inter':'Intra',dst),
      sh.cell(r,7,inv.taxable||0,nst),
      sh.cell(r,8,inv.cgst||0,nst),
      sh.cell(r,9,inv.sgst||0,nst),
      sh.cell(r,10,inv.igst||0,nst),
      sh.cell(r,11,inv.total_tax||0,nst),
      sh.cell(r,12,inv.total||0,nst),
      sh.cell(r,13,inv.paid||0,nst),
      sh.cell(r,14,bal,nst),
      sh.cell(r,15,(inv.status||'unpaid').charAt(0).toUpperCase()+(inv.status||'unpaid').slice(1),stSt),
    ], 16); r++;
  }

  // Totals row
  const S = (col) => `=SUM(${col}${invStart}:${col}${r-1})`;
  sh.addRow(r, [
    sh.cell(r,1,'',C.H_NAVY), sh.cell(r,2,'TOTALS',C.H_NAVY),
    sh.cell(r,3,`${sales.length} invoices`,C.H_NAVY),
    sh.cell(r,4,'',C.H_NAVY), sh.cell(r,5,'',C.H_NAVY), sh.cell(r,6,'',C.H_NAVY),
    sh.cell(r,7,sales.reduce((s,i)=>s+(i.taxable||0),0),C.N_HDR),
    sh.cell(r,8,sales.reduce((s,i)=>s+(i.cgst||0),0),C.N_HDR),
    sh.cell(r,9,sales.reduce((s,i)=>s+(i.sgst||0),0),C.N_HDR),
    sh.cell(r,10,sales.reduce((s,i)=>s+(i.igst||0),0),C.N_HDR),
    sh.cell(r,11,sales.reduce((s,i)=>s+(i.total_tax||0),0),C.N_HDR),
    sh.cell(r,12,sales.reduce((s,i)=>s+(i.total||0),0),C.N_HDR),
    sh.cell(r,13,sales.reduce((s,i)=>s+(i.paid||0),0),C.N_HDR),
    sh.cell(r,14,sales.reduce((s,i)=>s+((i.total||0)-(i.paid||0)),0),C.N_HDR),
    sh.cell(r,15,'',C.H_NAVY),
  ], 18); r += 2;

  // ── Section B: POs ────────────────────────────────────────────────
  sh.merge(`A${r}:O${r}`);
  sh.addRow(r, [sh.cell(r,1,'▌  B — PURCHASE ORDERS (Net, No GST)', C.T_GREEN)], 22); r++;

  const poHdrs = ['#','PO Number','Date','Party','GSTIN','Status','Value (₹)','Delivered (₹)','Remaining (₹)','%'];
  sh.addRow(r, poHdrs.map((h,i) => sh.cell(r,i+1,h,C.H_GREEN)), 18); r++;
  const poStart = r;

  for (let i = 0; i < pos.length; i++) {
    const po   = pos[i];
    const alt  = i % 2 === 1;
    const nst  = alt ? C.N_ALT2 : C.N_NORMAL;
    const dst  = alt ? C.D_ALT2 : C.D_NORMAL;
    const tv   = po.total || po.taxable || 0;
    const dv   = po.delivered || 0;
    const pct  = tv > 0 ? dv/tv : 0;
    const st   = (po.status||'').toLowerCase();
    const stSt = st==='completed' ? C.D_GREEN_BLD : st==='partial' ? C.D_AMBER_BLD : C.D_BLUE_BLD;
    const pSt  = pct >= 1 ? C.P_GREEN : pct > 0 ? C.P_AMBER : C.P_NORMAL;

    sh.addRow(r, [
      sh.cell(r,1,i+1,dst), sh.cell(r,2,po.po_number||'',dst),
      sh.cell(r,3,po.date||'',dst), sh.cell(r,4,po.party_name||'',dst),
      sh.cell(r,5,po.party_gstin||'—',dst),
      sh.cell(r,6,(po.status||'').charAt(0).toUpperCase()+(po.status||'').slice(1),stSt),
      sh.cell(r,7,tv,nst), sh.cell(r,8,dv,nst), sh.cell(r,9,tv-dv,nst),
      sh.cell(r,10,pct,pSt),
    ], 16); r++;
  }

  sh.addRow(r, [
    sh.cell(r,1,'',C.H_GREEN), sh.cell(r,2,'TOTALS',C.H_GREEN),
    sh.cell(r,3,`${pos.length} POs`,C.H_GREEN),
    sh.cell(r,4,'',C.H_GREEN), sh.cell(r,5,'',C.H_GREEN), sh.cell(r,6,'',C.H_GREEN),
    sh.cell(r,7,pos.reduce((s,p)=>s+(p.total||p.taxable||0),0),C.N_HDR),
    sh.cell(r,8,pos.reduce((s,p)=>s+(p.delivered||0),0),C.N_HDR),
    sh.cell(r,9,pos.reduce((s,p)=>s+((p.total||p.taxable||0)-(p.delivered||0)),0),C.N_HDR),
    sh.cell(r,10,'',C.H_GREEN),
  ], 18); r += 2;

  // ── Section C: Summary ────────────────────────────────────────────
  sh.merge(`A${r}:O${r}`);
  sh.addRow(r, [sh.cell(r,1,'▌  C — INCOME SUMMARY', C.T_DGRAY)], 22); r++;

  const tt = sales.reduce((s,i)=>s+(i.taxable||0),0);
  const tg = sales.reduce((s,i)=>s+(i.total_tax||0),0);
  const ti = sales.reduce((s,i)=>s+(i.total||0),0);
  const tp = sales.reduce((s,i)=>s+(i.paid||0),0);
  const pv = pos.reduce((s,p)=>s+(p.total||p.taxable||0),0);

  const rows = [
    ['Sales — Taxable (Ex-GST)',    tt,    C.S_LABEL,     C.N_GREEN,   false],
    ['Sales — GST Collected',       tg,    C.S_LABEL,     C.N_RED,     false],
    ['Sales — Total (Incl. GST)',   ti,    C.S_LABEL,     C.N_BLUE,    false],
    ['Sales — Collected',           tp,    C.S_LABEL,     C.N_GREEN,   false],
    ['Sales — Outstanding',         ti-tp, C.S_LABEL,     C.N_RED,     false],
    null,
    ['PO Orders — Net Value',       pv,    C.S_LABEL,     C.N_GREEN,   false],
    null,
    ['TOTAL NET INCOME (Ex-GST)',   tt+pv, C.S_TOTAL_LABEL, C.N_SUMMTOT, true],
    ['TOTAL INCOME (Incl. GST)',    ti+pv, C.S_TOTAL_LABEL, C.N_SUMMTOT, true],
  ];

  for (const row of rows) {
    if (!row) { sh.heights[r] = 6; sh.addRow(r, []); r++; continue; }
    const [label, val, lst, nst] = row;
    sh.addRow(r, [sh.cell(r,1,label,lst), sh.cell(r,2,val,nst)], 18); r++;
  }

  return sh;
}

// ── GSTR-1 SHEET ─────────────────────────────────────────────────────────────
function buildGSTR1Sheet(data) {
  const { sales = [], saleLineItems = [], from = '', to = '' } = data;
  const sh = new Sheet();
  const C = STYLES;
  const ws2 = [13,22,11,30,22,18,16,14,14,14,16,16];
  ws2.forEach((w,i) => sh.colWidths[i+1] = w);

  let r = 1;

  sh.merge(`A1:L1`);
  sh.addRow(r, [sh.cell(r,1,`GSTR-1  ·  ${from}  to  ${to}`, 22)], 36);
  r++;
  sh.merge(`A2:L2`);
  sh.addRow(r, [sh.cell(r,1,`Generated ${new Date().toLocaleDateString('en-IN')}  |  For GST Filing Reference — Verify with CA before filing`, 1)], 18);
  r++;

  const b2b = sales.filter(i => i.party_gstin);
  const b2c = sales.filter(i => !i.party_gstin);

  // ── TABLE 4A: B2B ─────────────────────────────────────────────────
  r++;
  sh.merge(`A${r}:L${r}`);
  sh.addRow(r,[sh.cell(r,1,'TABLE 4A — B2B Invoices (Registered Recipients with GSTIN)',C.T_NAVY2)],22); r++;
  const b2bHdrs=['#','Invoice No','Date','Party Name','GSTIN','Place of Supply',
                  'Taxable (₹)','IGST (₹)','CGST (₹)','SGST (₹)','Tax (₹)','Total (₹)'];
  sh.addRow(r,b2bHdrs.map((h,i)=>sh.cell(r,i+1,h,C.H_NAVY)),18); r++;
  const b2bS=r;
  for(let i=0;i<b2b.length;i++){
    const inv=b2b[i]; const alt=i%2===1;
    const nst=alt?C.N_ALT:C.N_NORMAL; const dst=alt?C.D_ALT:C.D_NORMAL;
    sh.addRow(r,[sh.cell(r,1,i+1,dst),sh.cell(r,2,inv.invoice_number||'',dst),
      sh.cell(r,3,inv.date||'',dst),sh.cell(r,4,inv.party_name||'',dst),
      sh.cell(r,5,inv.party_gstin||'',dst),sh.cell(r,6,inv.party_state||'—',dst),
      sh.cell(r,7,inv.taxable||0,nst),sh.cell(r,8,inv.igst||0,nst),
      sh.cell(r,9,inv.cgst||0,nst),sh.cell(r,10,inv.sgst||0,nst),
      sh.cell(r,11,inv.total_tax||0,nst),sh.cell(r,12,inv.total||0,nst)],16); r++;
  }
  sh.addRow(r,[sh.cell(r,1,'',C.H_NAVY),sh.cell(r,2,`B2B TOTAL — ${b2b.length} invoices`,C.H_NAVY),
    sh.cell(r,3,'',C.H_NAVY),sh.cell(r,4,'',C.H_NAVY),sh.cell(r,5,'',C.H_NAVY),sh.cell(r,6,'',C.H_NAVY),
    sh.cell(r,7,b2b.reduce((s,i)=>s+(i.taxable||0),0),C.N_HDR),
    sh.cell(r,8,b2b.reduce((s,i)=>s+(i.igst||0),0),C.N_HDR),
    sh.cell(r,9,b2b.reduce((s,i)=>s+(i.cgst||0),0),C.N_HDR),
    sh.cell(r,10,b2b.reduce((s,i)=>s+(i.sgst||0),0),C.N_HDR),
    sh.cell(r,11,b2b.reduce((s,i)=>s+(i.total_tax||0),0),C.N_HDR),
    sh.cell(r,12,b2b.reduce((s,i)=>s+(i.total||0),0),C.N_HDR)],18); r+=2;

  // ── TABLE 7: B2C ──────────────────────────────────────────────────
  sh.merge(`A${r}:L${r}`);
  sh.addRow(r,[sh.cell(r,1,'TABLE 7 — B2C / Walk-in (No GSTIN)',C.T_PURPLE2)],22); r++;
  const b2cHdrs=['#','Invoice No','Date','Party Name','Taxable (₹)','IGST (₹)',
                  'CGST (₹)','SGST (₹)','Tax (₹)','Total (₹)'];
  sh.addRow(r,b2cHdrs.map((h,i)=>sh.cell(r,i+1,h,C.H_PURPLE)),18); r++;
  const b2cS=r;
  for(let i=0;i<b2c.length;i++){
    const inv=b2c[i]; const alt=i%2===1;
    const nst=alt?C.N_ALT:C.N_NORMAL; const dst=alt?C.D_ALT:C.D_NORMAL;
    sh.addRow(r,[sh.cell(r,1,i+1,dst),sh.cell(r,2,inv.invoice_number||'',dst),
      sh.cell(r,3,inv.date||'',dst),sh.cell(r,4,inv.party_name||'Walk-in',dst),
      sh.cell(r,5,inv.taxable||0,nst),sh.cell(r,6,inv.igst||0,nst),
      sh.cell(r,7,inv.cgst||0,nst),sh.cell(r,8,inv.sgst||0,nst),
      sh.cell(r,9,inv.total_tax||0,nst),sh.cell(r,10,inv.total||0,nst)],16); r++;
  }
  sh.addRow(r,[sh.cell(r,1,'',C.H_PURPLE),sh.cell(r,2,`B2C TOTAL — ${b2c.length} invoices`,C.H_PURPLE),
    sh.cell(r,3,'',C.H_PURPLE),sh.cell(r,4,'',C.H_PURPLE),
    sh.cell(r,5,b2c.reduce((s,i)=>s+(i.taxable||0),0),C.N_HDR),
    sh.cell(r,6,b2c.reduce((s,i)=>s+(i.igst||0),0),C.N_HDR),
    sh.cell(r,7,b2c.reduce((s,i)=>s+(i.cgst||0),0),C.N_HDR),
    sh.cell(r,8,b2c.reduce((s,i)=>s+(i.sgst||0),0),C.N_HDR),
    sh.cell(r,9,b2c.reduce((s,i)=>s+(i.total_tax||0),0),C.N_HDR),
    sh.cell(r,10,b2c.reduce((s,i)=>s+(i.total||0),0),C.N_HDR)],18); r+=2;

  // ── TABLE 12: HSN ─────────────────────────────────────────────────
  sh.merge(`A${r}:L${r}`);
  sh.addRow(r,[sh.cell(r,1,'TABLE 12 — HSN/SAC Wise Summary',C.T_TEAL2)],22); r++;
  const hsnHdrs=['HSN/SAC','Description','UOM','Qty','Taxable (₹)','IGST (₹)','CGST (₹)','SGST (₹)','Tax (₹)'];
  sh.addRow(r,hsnHdrs.map((h,i)=>sh.cell(r,i+1,h,C.H_TEAL)),18); r++;
  const hsnMap={};
  (saleLineItems||[]).forEach(li=>{
    const hsn=li.hsn||'NO HSN';
    if(!hsnMap[hsn]) hsnMap[hsn]={desc:li.name||'',unit:li.unit||'PCS',qty:0,taxable:0,igst:0,cgst:0,sgst:0,tax:0};
    const e=hsnMap[hsn];
    e.qty+=(li.qty||0); e.taxable+=(li.taxable||0); e.igst+=(li.igst||0);
    e.cgst+=(li.cgst||0); e.sgst+=(li.sgst||0);
    e.tax+=(li.total_tax||0)||(li.igst||0)+(li.cgst||0)+(li.sgst||0);
  });
  const hsnS=r;
  Object.entries(hsnMap).sort().forEach(([hsn,e],i)=>{
    const alt=i%2===1; const nst=alt?C.N_ALT:C.N_NORMAL; const dst=alt?C.D_ALT:C.D_NORMAL;
    sh.addRow(r,[sh.cell(r,1,hsn,dst),sh.cell(r,2,e.desc,dst),sh.cell(r,3,e.unit,dst),
      sh.cell(r,4,Math.round(e.qty*100)/100,dst),
      sh.cell(r,5,e.taxable,nst),sh.cell(r,6,e.igst,nst),
      sh.cell(r,7,e.cgst,nst),sh.cell(r,8,e.sgst,nst),sh.cell(r,9,e.tax,nst)],16); r++;
  });
  sh.addRow(r,[sh.cell(r,1,'TOTAL',C.H_TEAL),sh.cell(r,2,'',C.H_TEAL),sh.cell(r,3,'',C.H_TEAL),
    sh.cell(r,4,'',C.H_TEAL),
    sh.cell(r,5,Object.values(hsnMap).reduce((s,e)=>s+e.taxable,0),C.N_HDR),
    sh.cell(r,6,Object.values(hsnMap).reduce((s,e)=>s+e.igst,0),C.N_HDR),
    sh.cell(r,7,Object.values(hsnMap).reduce((s,e)=>s+e.cgst,0),C.N_HDR),
    sh.cell(r,8,Object.values(hsnMap).reduce((s,e)=>s+e.sgst,0),C.N_HDR),
    sh.cell(r,9,Object.values(hsnMap).reduce((s,e)=>s+e.tax,0),C.N_HDR)],18); r+=2;

  // ── GST SUMMARY ──────────────────────────────────────────────────
  sh.merge(`A${r}:L${r}`);
  sh.addRow(r,[sh.cell(r,1,'GST SUMMARY — For Filing Reference',C.T_AMBER2)],22); r++;
  const gstRows=[
    ['Total Invoices',       sales.length, false],
    ['B2B (with GSTIN)',     b2b.length,   false],
    ['B2C (no GSTIN)',       b2c.length,   false],
    ['Total Taxable Value',  sales.reduce((s,i)=>s+(i.taxable||0),0), true],
    ['CGST Collected',       sales.reduce((s,i)=>s+(i.cgst||0),0),    true],
    ['SGST Collected',       sales.reduce((s,i)=>s+(i.sgst||0),0),    true],
    ['IGST Collected',       sales.reduce((s,i)=>s+(i.igst||0),0),    true],
    ['Total Tax Liability',  sales.reduce((s,i)=>s+(i.total_tax||0),0),true],
    ['Total Invoice Value',  sales.reduce((s,i)=>s+(i.total||0),0),   true],
  ];
  for(const [label,val,isNum] of gstRows){
    sh.addRow(r,[sh.cell(r,1,label,C.S_LABEL),
      sh.cell(r,2,val,isNum?C.N_GSTBG:C.S_LABEL)],18); r++;
  }

  return sh;
}

// ── Main export function ──────────────────────────────────────────────────────
function generateReport(data) {
  const incSh  = buildIncomeSheet(data);
  const gstrSh = buildGSTR1Sheet(data);

  // Combine string tables
  const allStrings = [...new Set([...incSh.strings, ...gstrSh.strings])];
  const strIndex   = {};
  allStrings.forEach((s,i) => strIndex[s] = i);

  // Remap string indices in sheets
  function remapSheet(sh) {
    for(const row of sh.rows) {
      for(const c of row.cells) {
        if(c && c.t === 's') c.v = strIndex[sh.strings[c.v]] ?? 0;
      }
    }
    sh.strings = allStrings;
    sh.strMap  = strIndex;
  }
  remapSheet(incSh);
  remapSheet(gstrSh);

  const sharedStrXml = makeSharedStrings(allStrings);
  const stylesXml    = makeStyles();
  const incXml       = incSh.toXml();
  const gstrXml      = gstrSh.toXml();

  const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

  const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;

  const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Income Report" sheetId="1" r:id="rId1"/>
    <sheet name="GSTR-1 Report" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`;

  const WB_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
  <Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const files = [
    { name: '[Content_Types].xml',         data: Buffer.from(CONTENT_TYPES, 'utf8') },
    { name: '_rels/.rels',                 data: Buffer.from(RELS, 'utf8') },
    { name: 'xl/workbook.xml',             data: Buffer.from(WORKBOOK, 'utf8') },
    { name: 'xl/_rels/workbook.xml.rels',  data: Buffer.from(WB_RELS, 'utf8') },
    { name: 'xl/styles.xml',               data: Buffer.from(stylesXml, 'utf8') },
    { name: 'xl/sharedStrings.xml',        data: Buffer.from(sharedStrXml, 'utf8') },
    { name: 'xl/worksheets/sheet1.xml',    data: Buffer.from(incXml, 'utf8') },
    { name: 'xl/worksheets/sheet2.xml',    data: Buffer.from(gstrXml, 'utf8') },
  ];

  return buildZip(files);
}

module.exports = { generateReport };
