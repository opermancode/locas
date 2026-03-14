function r(n)   { return Number(n || 0).toFixed(2); }
function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }); }

function amountInWords(amount) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const num = Math.floor(amount);
  if (num === 0) return 'Zero';
  const crore = Math.floor(num / 10000000);
  const lakh  = Math.floor((num % 10000000) / 100000);
  const thou  = Math.floor((num % 100000) / 1000);
  const hund  = Math.floor((num % 1000) / 100);
  const rest  = num % 100;
  let words = '';
  const twoDigit = (n) => n >= 20
    ? tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
    : ones[n];
  if (crore) words += twoDigit(crore) + ' Crore ';
  if (lakh)  words += twoDigit(lakh)  + ' Lakh ';
  if (thou)  words += twoDigit(thou)  + ' Thousand ';
  if (hund)  words += ones[hund]      + ' Hundred ';
  if (rest)  words += twoDigit(rest);
  return words.trim() + ' Rupees Only';
}

export default function template6(invoice, profile, accentColor = '#2563EB') {
  const inv     = invoice;
  const prof    = profile || {};
  const isInter = inv.supply_type === 'inter';
  const balance = (inv.total || 0) - (inv.paid || 0);

  const itemRows = (inv.items || []).map((item, i) => `
    <tr>
      <td class="td-num">${i + 1}</td>
      <td class="td-desc">
        <div class="item-name">${item.name}</div>
        ${item.hsn ? `<div class="item-sub">HSN: ${item.hsn}</div>` : ''}
      </td>
      <td class="td-center">${item.qty} ${item.unit}</td>
      <td class="td-right">₹${r(item.rate)}</td>
      <td class="td-right">${item.discount > 0 ? item.discount + '%' : '—'}</td>
      <td class="td-right">₹${r(item.taxable)}</td>
      <td class="td-center">${item.gst_rate}%</td>
      <td class="td-right">${isInter
        ? '₹' + r(item.igst)
        : '₹' + r(item.cgst) + '<br><small>₹' + r(item.sgst) + '</small>'
      }</td>
      <td class="td-right td-amount">₹${r(item.total)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: Arial, sans-serif;
    font-size: 12px;
    color: #1a1a2e;
    background: #fff;
    padding: 0;
  }

  /* ── Decorative top corner ── */
  .corner-deco {
    position: absolute;
    top: 0; right: 0;
    width: 120px; height: 80px;
    overflow: hidden;
  }
  .corner-deco-inner {
    position: absolute;
    top: -20px; right: -20px;
    display: flex; flex-wrap: wrap; gap: 4px;
  }
  .hex {
    width: 22px; height: 22px;
    clip-path: polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%);
    opacity: 0.7;
  }

  .page { padding: 30px 32px; position: relative; }

  /* ── Header ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
    padding-bottom: 16px;
    border-bottom: 1px solid #E5E7EB;
  }
  .biz-name   { font-size: 18px; font-weight: 800; color: #111; margin-bottom: 5px; }
  .biz-detail { font-size: 11px; color: #6B7280; line-height: 1.8; }
  .inv-title  { font-size: 36px; font-weight: 800; color: ${accentColor}; letter-spacing: 2px; }

  /* ── Meta grid ── */
  .meta-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    border: 1px solid #E5E7EB;
    margin-bottom: 16px;
  }
  .meta-row-grid {
    display: contents;
  }
  .meta-label {
    padding: 6px 12px;
    font-size: 11px;
    color: #6B7280;
    border-bottom: 1px solid #E5E7EB;
    background: #FAFAFA;
  }
  .meta-value {
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 700;
    color: #111;
    border-bottom: 1px solid #E5E7EB;
    border-left: 1px solid #E5E7EB;
  }
  .meta-label:nth-last-child(-n+2),
  .meta-value:nth-last-child(-n+2) { border-bottom: none; }

  /* ── Bill / Ship ── */
  .parties {
    display: flex;
    border: 1px solid #E5E7EB;
    margin-bottom: 16px;
  }
  .party-col { flex: 1; padding: 12px 14px; }
  .party-col + .party-col { border-left: 1px solid #E5E7EB; }
  .party-header {
    font-size: 11px; font-weight: 700;
    color: #fff; background: ${accentColor}20;
    margin: -12px -14px 10px;
    padding: 7px 14px;
    border-bottom: 1px solid ${accentColor}30;
    color: ${accentColor};
    font-weight: 800;
    letter-spacing: 0.5px;
  }
  .party-name   { font-size: 14px; font-weight: 800; color: #111; margin-bottom: 4px; }
  .party-detail { font-size: 11px; color: #555; line-height: 1.8; }
  .supply-tag   {
    display: inline-block;
    background: ${accentColor}15; color: ${accentColor};
    font-size: 9px; font-weight: 700;
    padding: 2px 8px; border-radius: 3px;
    margin-top: 6px; border: 1px solid ${accentColor}30;
  }

  /* ── Items table ── */
  .table-wrap { margin-bottom: 0; }
  table { width: 100%; border-collapse: collapse; }
  thead tr { background: ${accentColor}; color: white; }
  th {
    padding: 9px 10px;
    font-size: 11px; font-weight: 700;
    text-align: left; letter-spacing: 0.3px;
  }
  .td-num    { padding: 10px; font-size: 11px; color: #6B7280; border-bottom: 1px solid #F3F4F6; text-align: center; width: 4%; }
  .td-desc   { padding: 10px; font-size: 11px; border-bottom: 1px solid #F3F4F6; width: 26%; }
  .td-center { padding: 10px; font-size: 11px; border-bottom: 1px solid #F3F4F6; text-align: center; }
  .td-right  { padding: 10px; font-size: 11px; border-bottom: 1px solid #F3F4F6; text-align: right; }
  .td-amount { font-weight: 700; color: #111; }
  .item-name { font-weight: 600; color: #111; margin-bottom: 2px; }
  .item-sub  { font-size: 10px; color: #9CA3AF; }

  tr:nth-child(even) td { background: #F9FAFB; }

  /* ── Sub total row ── */
  .subtotal-row td {
    padding: 10px;
    font-weight: 700;
    border-top: 2px solid #E5E7EB;
    border-bottom: 2px solid #E5E7EB;
    background: #F9FAFB !important;
  }

  /* ── Bottom section ── */
  .bottom-area {
    display: flex;
    gap: 0;
    margin-top: 0;
    border: 1px solid #E5E7EB;
    border-top: none;
  }

  .notes-col {
    flex: 1;
    padding: 16px;
    border-right: 1px solid #E5E7EB;
  }
  .notes-thanks {
    font-size: 12px; color: #6B7280;
    margin-bottom: 12px; font-style: italic;
  }
  .notes-tc-title {
    font-size: 12px; font-weight: 800; color: #111; margin-bottom: 5px;
  }
  .notes-tc-body {
    font-size: 11px; color: #6B7280; line-height: 1.7;
  }

  .totals-col { width: 260px; }
  .totals-row {
    display: flex; justify-content: space-between;
    padding: 9px 14px;
    font-size: 12px;
    border-bottom: 1px solid #E5E7EB;
  }
  .totals-label { color: #374151; }
  .totals-value { font-weight: 600; color: #111; }
  .totals-row-highlight {
    display: flex; justify-content: space-between;
    padding: 10px 14px;
    font-size: 12px;
    background: ${accentColor}15;
    border-bottom: 1px solid ${accentColor}20;
  }
  .totals-row-highlight .totals-label { color: ${accentColor}; font-weight: 700; }
  .totals-row-highlight .totals-value { color: ${accentColor}; font-weight: 800; }
  .totals-row-grand {
    display: flex; justify-content: space-between;
    padding: 12px 14px;
    font-size: 14px; font-weight: 800;
    background: ${accentColor};
    color: white;
  }

  .words-box {
    padding: 10px 14px;
    background: #F9FAFB;
    border-top: 1px solid #E5E7EB;
    font-size: 10px;
    color: #6B7280;
  }
  .words-label { font-weight: 700; color: #374151; margin-bottom: 2px; }

  .status-badge { display:inline-block; padding:2px 10px; border-radius:3px; font-size:10px; font-weight:700; }
  .paid    { background:#D1FAE5; color:#065F46; }
  .unpaid  { background:#FEE2E2; color:#991B1B; }
  .partial { background:#FEF3C7; color:#92400E; }

  .bank-row {
    padding: 8px 14px;
    font-size: 10px; color: #555;
    line-height: 1.7;
    border-top: 1px solid #E5E7EB;
    background: #F0F9FF;
  }
  .bank-label { font-weight: 700; color: ${accentColor}; font-size: 10px; margin-bottom: 2px; }

  .footer {
    text-align: center; font-size: 9px; color: #9CA3AF;
    margin-top: 16px; padding-top: 10px;
    border-top: 1px solid #E5E7EB;
  }
</style>
</head>
<body>
<div class="page">

  <!-- Decorative corner -->
  <div class="corner-deco">
    <div class="corner-deco-inner">
      ${['#60A5FA','#93C5FD','#3B82F6','#BFDBFE','#2563EB','#DBEAFE','#1D4ED8','#EFF6FF','#60A5FA'].map(c =>
        `<div class="hex" style="background:${c}"></div>`
      ).join('')}
    </div>
  </div>

  <!-- Header -->
  <div class="header">
    <div>
      <div class="biz-name">${prof.name || 'My Business'}</div>
      <div class="biz-detail">
        ${prof.address ? prof.address.replace(/,/g, '<br>') + '<br>' : ''}
        ${prof.phone   ? prof.phone + '<br>'  : ''}
        ${prof.email   ? prof.email + '<br>'  : ''}
        ${prof.gstin   ? 'GSTIN: <strong>' + prof.gstin + '</strong><br>' : ''}
        ${prof.pan     ? 'PAN: ' + prof.pan   : ''}
      </div>
    </div>
    <div style="text-align:right">
      <div class="inv-title">INVOICE</div>
      <div style="margin-top:8px">
        <span class="status-badge ${inv.status || 'unpaid'}">${(inv.status || 'unpaid').toUpperCase()}</span>
      </div>
    </div>
  </div>

  <!-- Invoice meta -->
  <div class="meta-grid">
    <div class="meta-label">Invoice#</div>
    <div class="meta-value">${inv.invoice_number}</div>
    <div class="meta-label">Invoice Date</div>
    <div class="meta-value">${inv.date}</div>
    ${inv.due_date ? `
    <div class="meta-label">Due Date</div>
    <div class="meta-value">${inv.due_date}</div>` : ''}
    <div class="meta-label">Supply Type</div>
    <div class="meta-value">${isInter ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'}</div>
  </div>

  <!-- Bill To / Ship To -->
  <div class="parties">
    <div class="party-col">
      <div class="party-header">Bill To</div>
      <div class="party-name">${inv.party_name || 'Walk-in Customer'}</div>
      <div class="party-detail">
        ${inv.party_address ? inv.party_address + '<br>' : ''}
        ${inv.party_gstin   ? 'GSTIN: ' + inv.party_gstin + '<br>' : ''}
        ${inv.party_state   ? inv.party_state + ' (' + (inv.party_state_code||'') + ')' : ''}
      </div>
      <div><span class="supply-tag">${isInter ? '🔀 IGST Applied' : '✅ CGST+SGST Applied'}</span></div>
    </div>
    <div class="party-col">
      <div class="party-header">From</div>
      <div class="party-name">${prof.name || 'My Business'}</div>
      <div class="party-detail">
        ${prof.address ? prof.address + '<br>' : ''}
        ${prof.gstin   ? 'GSTIN: ' + prof.gstin + '<br>' : ''}
        ${prof.state   ? prof.state + ' (' + (prof.state_code||'') + ')' : ''}
      </div>
    </div>
  </div>

  <!-- Items Table -->
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th style="width:4%;text-align:center">#</th>
          <th style="width:26%">Item &amp; Description</th>
          <th style="width:9%;text-align:center">Qty</th>
          <th style="width:9%;text-align:right">Rate</th>
          <th style="width:7%;text-align:right">Disc</th>
          <th style="width:11%;text-align:right">Taxable</th>
          <th style="width:7%;text-align:center">GST%</th>
          <th style="width:13%;text-align:right">${isInter ? 'IGST' : 'CGST/SGST'}</th>
          <th style="width:11%;text-align:right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <!-- Sub total row -->
        <tr class="subtotal-row">
          <td colspan="8" style="text-align:right;padding-right:14px;font-size:12px;color:#374151">Sub Total</td>
          <td class="td-right" style="font-size:12px">₹${r(inv.subtotal)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Bottom: Notes + Totals -->
  <div class="bottom-area">

    <!-- Notes / Terms -->
    <div class="notes-col">
      ${inv.notes ? `<p class="notes-thanks">${inv.notes}</p>` : `<p class="notes-thanks">Thanks for doing business with us.</p>`}
      ${inv.terms ? `
      <div class="notes-tc-title">Terms &amp; Conditions</div>
      <div class="notes-tc-body">${inv.terms}</div>` : ''}
    </div>

    <!-- Totals -->
    <div class="totals-col">
      ${inv.discount > 0 ? `
      <div class="totals-row">
        <span class="totals-label">Discount (${inv.discount}%)</span>
        <span class="totals-value">-₹${r((inv.subtotal||0)-(inv.taxable||0))}</span>
      </div>` : ''}
      <div class="totals-row">
        <span class="totals-label">Taxable Amount</span>
        <span class="totals-value">₹${r(inv.taxable)}</span>
      </div>
      ${isInter
        ? `<div class="totals-row">
             <span class="totals-label">IGST</span>
             <span class="totals-value">₹${r(inv.igst)}</span>
           </div>`
        : `<div class="totals-row">
             <span class="totals-label">CGST</span>
             <span class="totals-value">₹${r(inv.cgst)}</span>
           </div>
           <div class="totals-row">
             <span class="totals-label">SGST</span>
             <span class="totals-value">₹${r(inv.sgst)}</span>
           </div>`
      }
      <div class="totals-row-highlight">
        <span class="totals-label">Total</span>
        <span class="totals-value">₹${r(inv.total)}</span>
      </div>
      ${inv.paid > 0 ? `
      <div class="totals-row">
        <span class="totals-label">Paid</span>
        <span class="totals-value">₹${r(inv.paid)}</span>
      </div>` : ''}
      <div class="totals-row-grand">
        <span>Balance Due</span>
        <span>₹${r(balance > 0 ? balance : inv.total)}</span>
      </div>

      <!-- Amount in words -->
      <div class="words-box">
        <div class="words-label">Amount in Words</div>
        ${amountInWords(inv.total)}
      </div>

      <!-- Bank details -->
      ${prof.bank_name || prof.account_no ? `
      <div class="bank-row">
        <div class="bank-label">Bank Details</div>
        ${prof.bank_name  ? prof.bank_name + '<br>'        : ''}
        ${prof.account_no ? 'A/C: ' + prof.account_no + '<br>' : ''}
        ${prof.ifsc       ? 'IFSC: ' + prof.ifsc           : ''}
      </div>` : ''}
    </div>

  </div>

  <div class="footer">This is a computer-generated invoice · Powered by Locas</div>
</div>
</body>
</html>`;
}