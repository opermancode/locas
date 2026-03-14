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

export default function template2(invoice, profile, accentColor = '#B8860B') {
  const inv     = invoice;
  const prof    = profile || {};
  const isInter = inv.supply_type === 'inter';
  const balance = (inv.total || 0) - (inv.paid || 0);

  const itemRows = (inv.items || []).map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#FAFAF5' : '#FFFFFF'}">
      <td class="td">
        ${item.name}
        ${item.hsn ? `<br><span style="font-size:9px;color:#888">HSN: ${item.hsn}</span>` : ''}
      </td>
      <td class="td" style="text-align:center">
        ${item.qty}<br><span style="font-size:9px;color:#888">${item.unit}</span>
      </td>
      <td class="td" style="text-align:right">₹${r(item.rate)}</td>
      <td class="td" style="text-align:right">₹${r(item.taxable)}</td>
      <td class="td" style="text-align:center">${item.gst_rate}%</td>
      <td class="td" style="text-align:right">
        ${isInter
          ? '₹' + r(item.igst)
          : 'C:₹' + r(item.cgst) + '<br>S:₹' + r(item.sgst)
        }
      </td>
      <td class="td" style="text-align:right;font-weight:700;color:${accentColor}">₹${r(item.total)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Georgia, serif; font-size: 11px; color: #1a1a1a; padding: 24px; background: #FEFEFE; }

  .outer-border { border: 2px solid ${accentColor}; padding: 16px; }

  .header {
    text-align: center; margin-bottom: 16px;
    padding-bottom: 12px; border-bottom: 2px solid ${accentColor};
  }
  .inv-label      { font-size: 24px; font-weight: 800; color: ${accentColor}; letter-spacing: 2px; }
  .business-name  { font-size: 17px; font-weight: 700; color: #1a1a1a; margin-top: 4px; }
  .business-detail{ font-size: 10px; color: #555; margin-top: 4px; line-height: 1.7; font-family: Arial, sans-serif; }

  .meta-row  { display: flex; border: 1px solid ${accentColor}55; margin-bottom: 12px; }
  .meta-cell { flex: 1; padding: 7px 10px; border-right: 1px solid ${accentColor}55; font-size: 10px; font-family: Arial, sans-serif; }
  .meta-cell:last-child { border-right: none; }
  .meta-label{ font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .meta-value{ font-weight: 700; color: #111; }

  .parties-row      { display: flex; border: 1px solid ${accentColor}55; margin-bottom: 12px; }
  .party-col        { flex: 1; padding: 10px; border-right: 1px solid ${accentColor}55; font-family: Arial, sans-serif; }
  .party-col:last-child { border-right: none; }
  .party-label      { font-size: 9px; font-weight: 700; color: ${accentColor}; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; border-bottom: 1px solid ${accentColor}44; padding-bottom: 3px; }
  .party-name       { font-size: 13px; font-weight: 700; color: #111; margin-bottom: 3px; }
  .party-detail     { font-size: 10px; color: #555; line-height: 1.7; }
  .supply-tag       { display:inline-block; background:${accentColor}15; color:${accentColor}; font-size:9px; font-weight:700; padding:2px 8px; border-radius:3px; margin-top:4px; border:1px solid ${accentColor}33; }

  .status-badge { display:inline-block; padding:2px 10px; border-radius:3px; font-size:9px; font-weight:700; }
  .paid    { background:#D1FAE5; color:#065F46; }
  .unpaid  { background:#FEE2E2; color:#991B1B; }
  .partial { background:#FEF3C7; color:#92400E; }

  table     { width:100%; border-collapse:collapse; margin-bottom:12px; font-family:Arial,sans-serif; }
  thead tr  { background: ${accentColor}; color: white; }
  th        { padding: 8px 7px; text-align: center; font-size: 10px; font-weight: 600; }
  .td       { padding: 8px 7px; font-size: 10px; border-bottom: 1px solid ${accentColor}22; vertical-align: middle; }

  .bottom-grid { display: flex; gap: 12px; margin-bottom: 12px; font-family: Arial, sans-serif; }

  .totals-section { flex: 1; }
  .totals-inner   { border: 1px solid ${accentColor}55; }
  .totals-header  { background: ${accentColor}; color: white; padding: 6px 10px; font-size: 10px; font-weight: 700; }
  .totals-body    { padding: 8px 10px; }
  .t-row    { display:flex; justify-content:space-between; padding:4px 0; font-size:11px; border-bottom:1px dotted ${accentColor}33; }
  .t-muted  { color: #666; }
  .t-danger { color: #DC2626; font-weight: 700; }
  .t-grand  { display:flex; justify-content:space-between; padding:8px 10px; font-size:15px; font-weight:800; color:white; background:${accentColor}; margin-top:6px; }

  .words-box   { border:1px solid ${accentColor}55; padding:8px 10px; margin-top:8px; font-family:Arial,sans-serif; }
  .words-label { font-size:9px; font-weight:700; color:${accentColor}; text-transform:uppercase; margin-bottom:3px; }
  .words-value { font-size:10px; font-style:italic; color:#333; line-height:1.5; }

  .notes-box   { border:1px solid ${accentColor}55; padding:8px 10px; margin-top:8px; font-family:Arial,sans-serif; }
  .notes-label { font-size:9px; font-weight:700; color:${accentColor}; text-transform:uppercase; margin-bottom:3px; }

  .right-col    { width: 200px; display:flex; flex-direction:column; gap:8px; }
  .payment-box  { border:1px solid ${accentColor}55; padding:8px 10px; font-family:Arial,sans-serif; }
  .payment-label{ font-size:9px; font-weight:700; color:${accentColor}; text-transform:uppercase; margin-bottom:4px; }

  .sign-section { border:1px solid ${accentColor}55; flex:1; }
  .sign-header  { background:${accentColor}15; padding:6px 10px; font-size:10px; font-weight:700; color:${accentColor}; border-bottom:1px solid ${accentColor}33; font-family:Arial,sans-serif; }
  .sign-body    { padding:10px; min-height:90px; display:flex; flex-direction:column; justify-content:space-between; }
  .seal-circle  { width:54px; height:54px; border-radius:50%; border:2px dashed ${accentColor}; display:flex; align-items:center; justify-content:center; font-size:8px; color:${accentColor}; text-align:center; font-weight:700; margin:8px auto; font-family:Arial,sans-serif; }
  .sign-line    { border-top:1px solid #999; padding-top:4px; font-size:9px; color:#666; text-align:center; font-family:Arial,sans-serif; }

  .footer { text-align:center; font-size:9px; color:#aaa; margin-top:10px; padding-top:8px; border-top:1px solid ${accentColor}33; font-family:Arial,sans-serif; }
</style>
</head>
<body>
<div class="outer-border">

<!-- Header -->
<div class="header">
  <div class="inv-label">Invoice</div>
  <div class="business-name">${prof.name || 'My Business'}</div>
  <div class="business-detail">
    ${prof.address ? prof.address : ''}
    ${prof.phone   ? '  |  ' + prof.phone : ''}
    ${prof.email   ? '  |  ' + prof.email : ''}<br>
    ${prof.gstin   ? 'GSTIN: <strong>' + prof.gstin + '</strong>' : ''}
    ${prof.pan     ? '  |  PAN: ' + prof.pan : ''}
  </div>
</div>

<!-- Invoice meta -->
<div class="meta-row">
  <div class="meta-cell">
    <div class="meta-label">Invoice No.</div>
    <div class="meta-value">${inv.invoice_number}</div>
  </div>
  <div class="meta-cell">
    <div class="meta-label">Invoice Date</div>
    <div class="meta-value">${inv.date}</div>
  </div>
  ${inv.due_date ? `
  <div class="meta-cell">
    <div class="meta-label">Due Date</div>
    <div class="meta-value">${inv.due_date}</div>
  </div>` : ''}
  <div class="meta-cell">
    <div class="meta-label">Status</div>
    <div class="meta-value">
      <span class="status-badge ${inv.status || 'unpaid'}">${(inv.status || 'unpaid').toUpperCase()}</span>
    </div>
  </div>
  <div class="meta-cell">
    <div class="meta-label">Supply Type</div>
    <div class="meta-value">${isInter ? 'Inter-state' : 'Intra-state'}</div>
  </div>
</div>

<!-- Bill To / Seller -->
<div class="parties-row">
  <div class="party-col">
    <div class="party-label">Bill To</div>
    <div class="party-name">${inv.party_name || 'Walk-in Customer'}</div>
    <div class="party-detail">
      ${inv.party_address ? inv.party_address + '<br>'                                              : ''}
      ${inv.party_gstin   ? 'GSTIN NO.: ' + inv.party_gstin + '<br>'                                : ''}
      ${inv.party_state   ? 'State: ' + inv.party_state + ' (' + (inv.party_state_code||'') + ')' : ''}
    </div>
    <span class="supply-tag">${isInter ? 'IGST Applied' : 'CGST+SGST Applied'}</span>
  </div>
  <div class="party-col">
    <div class="party-label">From (Seller)</div>
    <div class="party-name">${prof.name || 'My Business'}</div>
    <div class="party-detail">
      ${prof.address ? prof.address + '<br>'                                       : ''}
      ${prof.gstin   ? 'GSTIN NO.: ' + prof.gstin + '<br>'                         : ''}
      ${prof.state   ? 'State: ' + prof.state + ' (' + (prof.state_code||'') + ')' : ''}
    </div>
  </div>
</div>

<!-- Items -->
<table>
  <thead>
    <tr>
      <th style="text-align:left;width:28%">Description</th>
      <th style="width:10%">Qty</th>
      <th style="width:10%">Unit Price</th>
      <th style="width:11%">Taxable</th>
      <th style="width:8%">GST%</th>
      <th style="width:14%">${isInter ? 'IGST' : 'CGST/SGST'}</th>
      <th style="width:12%">Total</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<!-- Bottom grid -->
<div class="bottom-grid">

  <!-- Left: Totals + words + notes -->
  <div class="totals-section">
    <div class="totals-inner">
      <div class="totals-header">Summary</div>
      <div class="totals-body">
        <div class="t-row"><span>Subtotal</span><span>${inr(inv.subtotal)}</span></div>
        ${inv.discount > 0
          ? `<div class="t-row t-muted"><span>Discount (${inv.discount}%)</span><span>-${inr((inv.subtotal||0)-(inv.taxable||0))}</span></div>`
          : ''}
        <div class="t-row"><span>Taxable Amount</span><span>${inr(inv.taxable)}</span></div>
        ${isInter
          ? `<div class="t-row t-muted"><span>IGST</span><span>${inr(inv.igst)}</span></div>`
          : `<div class="t-row t-muted"><span>CGST</span><span>${inr(inv.cgst)}</span></div>
             <div class="t-row t-muted"><span>SGST</span><span>${inr(inv.sgst)}</span></div>`
        }
        ${inv.paid > 0
          ? `<div class="t-row"><span>Received Balance</span><span>${inr(inv.paid)}</span></div>`
          : ''}
        ${balance > 0.01
          ? `<div class="t-row t-danger"><span>Balance Due</span><span>${inr(balance)}</span></div>`
          : ''}
      </div>
      <div class="t-grand"><span>Grand Total</span><span>${inr(inv.total)}</span></div>
    </div>

    <div class="words-box">
      <div class="words-label">Amount in Words</div>
      <div class="words-value">${amountInWords(inv.total)}</div>
    </div>

    ${inv.notes || inv.terms ? `
    <div class="notes-box">
      <div class="notes-label">Terms &amp; Instructions</div>
      <div style="font-size:10px;color:#444;line-height:1.7;margin-top:3px">
        ${inv.terms || ''}${inv.notes ? '<br>' + inv.notes : ''}
      </div>
    </div>` : ''}
  </div>

  <!-- Right: Payment + Seal -->
  <div class="right-col">
    ${prof.bank_name || prof.account_no ? `
    <div class="payment-box">
      <div class="payment-label">Payment Mode</div>
      <div style="font-size:10px;color:#333;line-height:1.8;margin-top:3px">
        ${prof.bank_name  ? '<strong>' + prof.bank_name + '</strong><br>' : ''}
        ${prof.account_no ? 'A/C: ' + prof.account_no + '<br>'           : ''}
        ${prof.ifsc       ? 'IFSC: ' + prof.ifsc                          : ''}
      </div>
    </div>` : ''}

    <div class="sign-section">
      <div class="sign-header">Seal &amp; Signature</div>
      <div class="sign-body">
        <div class="seal-circle">SEAL</div>
        <div class="sign-line">Authorised Signatory</div>
      </div>
    </div>
  </div>

</div>

<div class="footer">This is a computer-generated invoice · Powered by Locas</div>
</div>
</body>
</html>`;
}