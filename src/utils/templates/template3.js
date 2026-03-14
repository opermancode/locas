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

export default function template3(invoice, profile, accentColor = '#1B6B3A') {
  const inv     = invoice;
  const prof    = profile || {};
  const isInter = inv.supply_type === 'inter';
  const balance = (inv.total || 0) - (inv.paid || 0);

  const itemRows = (inv.items || []).map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#F0FFF4' : '#FFFFFF'}">
      <td class="td" style="text-align:center">${i + 1}</td>
      <td class="td">${item.name}</td>
      <td class="td" style="text-align:center">${item.hsn || '—'}</td>
      <td class="td" style="text-align:center">${item.qty}</td>
      <td class="td" style="text-align:right">₹${r(item.rate)}</td>
      <td class="td" style="text-align:center">${item.gst_rate}%</td>
      <td class="td" style="text-align:right">
        ${isInter ? '₹' + r(item.igst) : '₹' + r(item.cgst) + ' / ₹' + r(item.sgst)}
      </td>
      <td class="td" style="text-align:right;font-weight:700">₹${r(item.total)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #111; padding: 20px; }

  .header-top {
    display: flex; justify-content: space-between; align-items: flex-start;
    margin-bottom: 10px;
  }
  .biz-block  { flex: 1; }
  .biz-name   { font-size: 16px; font-weight: 800; color: #111; }
  .biz-detail { font-size: 10px; color: #555; margin-top: 3px; line-height: 1.7; }

  .inv-title-block { text-align: right; }
  .inv-title  { font-size: 24px; font-weight: 800; color: ${accentColor}; letter-spacing: 1px; }
  .inv-meta   { font-size: 10px; color: #555; margin-top: 4px; line-height: 1.8; text-align: right; }

  .divider-accent { height: 3px; background: ${accentColor}; margin: 10px 0; }

  .status-badge { display:inline-block; padding:2px 10px; border-radius:3px; font-size:9px; font-weight:700; }
  .paid    { background:#D1FAE5; color:#065F46; }
  .unpaid  { background:#FEE2E2; color:#991B1B; }
  .partial { background:#FEF3C7; color:#92400E; }

  .bill-section { display:flex; border:1px solid ${accentColor}55; margin-bottom:12px; }
  .bill-col     { flex:1; padding:10px 12px; }
  .bill-col + .bill-col { border-left:1px solid ${accentColor}33; }
  .bill-label   { font-size:9px; font-weight:700; color:${accentColor}; text-transform:uppercase; letter-spacing:1px; margin-bottom:5px; }
  .bill-name    { font-size:13px; font-weight:700; }
  .bill-detail  { font-size:10px; color:#555; line-height:1.7; margin-top:2px; }
  .supply-tag   { display:inline-block; background:${accentColor}15; color:${accentColor}; font-size:9px; font-weight:700; padding:2px 8px; border-radius:3px; margin-top:4px; }

  .table-outer { border:1px solid ${accentColor}44; margin-bottom:12px; }
  table        { width:100%; border-collapse:collapse; }
  thead tr     { background:${accentColor}; color:white; }
  th  { padding:8px 7px; font-size:10px; font-weight:600; text-align:center; border-right:1px solid ${accentColor}88; }
  th:last-child { border-right:none; }
  .td { padding:7px; font-size:10px; border-bottom:1px solid ${accentColor}22; border-right:1px solid ${accentColor}11; vertical-align:middle; }
  .td:last-child { border-right:none; }

  .bottom-area { display:flex; gap:12px; }

  .left-bottom { flex:1; }

  .words-row {
    border:1px solid ${accentColor}44; padding:8px 10px; margin-bottom:8px;
    display:flex; gap:8px; align-items:flex-start;
  }
  .words-label { font-size:9px; font-weight:700; color:${accentColor}; text-transform:uppercase; white-space:nowrap; }
  .words-value { font-size:10px; color:#333; font-style:italic; line-height:1.5; }

  .terms-cond   { border:1px solid ${accentColor}44; margin-bottom:8px; }
  .terms-header { background:${accentColor}15; padding:5px 10px; font-size:10px; font-weight:700; color:${accentColor}; border-bottom:1px solid ${accentColor}33; }
  .terms-body   { padding:8px 10px; font-size:10px; color:#444; line-height:1.7; }

  .bank-box    { border:1px solid ${accentColor}44; }
  .bank-header { background:${accentColor}15; padding:5px 10px; font-size:10px; font-weight:700; color:${accentColor}; border-bottom:1px solid ${accentColor}33; }
  .bank-body   { padding:8px 10px; font-size:10px; color:#333; line-height:1.8; }

  .right-bottom { width:220px; }

  .totals-box { border:1px solid ${accentColor}44; margin-bottom:8px; }
  .totals-hdr { background:${accentColor}; color:white; padding:6px 10px; font-size:10px; font-weight:700; }
  .totals-body{ padding:8px 10px; }
  .t-row      { display:flex; justify-content:space-between; padding:3px 0; font-size:10px; border-bottom:1px dotted ${accentColor}22; }
  .t-muted    { color:#666; }
  .t-danger   { color:#DC2626; font-weight:700; }

  .grand-total-box {
    background:${accentColor}; color:white;
    padding:10px; text-align:center;
    font-size:15px; font-weight:800; letter-spacing:1px;
    margin-bottom:8px;
  }
  .grand-label { font-size:9px; letter-spacing:2px; margin-bottom:3px; opacity:0.85; }

  .sign-box    { border:1px solid ${accentColor}44; }
  .sign-header { background:${accentColor}15; padding:5px 10px; font-size:10px; font-weight:700; color:${accentColor}; border-bottom:1px solid ${accentColor}33; }
  .sign-body   { padding:10px; min-height:90px; display:flex; flex-direction:column; justify-content:space-between; }
  .seal-circle { width:54px; height:54px; border-radius:50%; border:2px dashed ${accentColor}; display:flex; align-items:center; justify-content:center; font-size:8px; color:${accentColor}; text-align:center; font-weight:700; margin:0 auto 8px; }
  .sign-line   { border-top:1px solid #999; padding-top:4px; font-size:9px; color:#666; text-align:center; }

  .footer { text-align:center; font-size:9px; color:#aaa; margin-top:10px; border-top:1px solid #eee; padding-top:6px; }
</style>
</head>
<body>

<!-- Header -->
<div class="header-top">
  <div class="biz-block">
    <div class="biz-name">${prof.name || 'My Business'}</div>
    <div class="biz-detail">
      ${prof.address ? prof.address + '<br>' : ''}
      ${prof.phone   ? 'Contact: ' + prof.phone : ''}
      ${prof.email   ? '  |  ' + prof.email : ''}<br>
      ${prof.gstin   ? 'GSTIN: <strong>' + prof.gstin + '</strong>' : ''}
      ${prof.pan     ? '  |  PAN: ' + prof.pan : ''}
    </div>
  </div>
  <div class="inv-title-block">
    <div class="inv-title">Invoice</div>
    <div class="inv-meta">
      INVOICE NO.: <strong>${inv.invoice_number}</strong><br>
      DATE: ${inv.date}<br>
      ${inv.due_date ? 'DUE DATE: ' + inv.due_date + '<br>' : ''}
      <span class="status-badge ${inv.status || 'unpaid'}">${(inv.status || 'unpaid').toUpperCase()}</span>
    </div>
  </div>
</div>

<div class="divider-accent"></div>

<!-- Bill To -->
<div class="bill-section">
  <div class="bill-col">
    <div class="bill-label">Bill To</div>
    <div class="bill-name">${inv.party_name || 'Walk-in Customer'}</div>
    <div class="bill-detail">
      ${inv.party_address ? inv.party_address + '<br>'                                              : ''}
      ${inv.party_gstin   ? 'GSTIN: ' + inv.party_gstin + '<br>'                                    : ''}
      ${inv.party_state   ? 'State: ' + inv.party_state + ' (' + (inv.party_state_code||'') + ')' : ''}
    </div>
    <span class="supply-tag">${isInter ? '🔀 IGST' : '✅ CGST+SGST'}</span>
  </div>
  <div class="bill-col">
    <div class="bill-label">Seller</div>
    <div class="bill-name">${prof.name || 'My Business'}</div>
    <div class="bill-detail">
      ${prof.address ? prof.address + '<br>'                                       : ''}
      ${prof.gstin   ? 'GSTIN: ' + prof.gstin + '<br>'                             : ''}
      ${prof.state   ? 'State: ' + prof.state + ' (' + (prof.state_code||'') + ')' : ''}
    </div>
  </div>
</div>

<!-- Items Table -->
<div class="table-outer">
  <table>
    <thead>
      <tr>
        <th style="width:4%">#</th>
        <th style="width:26%;text-align:left">Description</th>
        <th style="width:9%">HSN</th>
        <th style="width:8%">Qty</th>
        <th style="width:10%">Price</th>
        <th style="width:7%">Tax%</th>
        <th style="width:16%">${isInter ? 'IGST' : 'CGST / SGST'}</th>
        <th style="width:12%">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
</div>

<!-- Bottom area -->
<div class="bottom-area">

  <!-- Left -->
  <div class="left-bottom">
    <div class="words-row">
      <span class="words-label">Amount in Words:</span>
      <span class="words-value">${amountInWords(inv.total)}</span>
    </div>

    ${inv.terms || inv.notes ? `
    <div class="terms-cond">
      <div class="terms-header">Terms &amp; Conditions</div>
      <div class="terms-body">
        ${inv.terms || ''}${inv.notes ? '<br>' + inv.notes : ''}
      </div>
    </div>` : ''}

    ${prof.bank_name || prof.account_no ? `
    <div class="bank-box">
      <div class="bank-header">Payment Mode</div>
      <div class="bank-body">
        ${prof.bank_name  ? '<strong>' + prof.bank_name + '</strong><br>' : ''}
        ${prof.account_no ? 'A/C: ' + prof.account_no + '<br>'           : ''}
        ${prof.ifsc       ? 'IFSC: ' + prof.ifsc                          : ''}
      </div>
    </div>` : ''}
  </div>

  <!-- Right -->
  <div class="right-bottom">
    <div class="totals-box">
      <div class="totals-hdr">Tax Summary</div>
      <div class="totals-body">
        <div class="t-row"><span>Subtotal</span><span>${inr(inv.subtotal)}</span></div>
        ${inv.discount > 0
          ? `<div class="t-row t-muted"><span>Discount (${inv.discount}%)</span><span>-${inr((inv.subtotal||0)-(inv.taxable||0))}</span></div>`
          : ''}
        <div class="t-row"><span>Taxable</span><span>${inr(inv.taxable)}</span></div>
        ${isInter
          ? `<div class="t-row t-muted"><span>Add: IGST</span><span>${inr(inv.igst)}</span></div>`
          : `<div class="t-row t-muted"><span>Add: CGST</span><span>${inr(inv.cgst)}</span></div>
             <div class="t-row t-muted"><span>Add: SGST</span><span>${inr(inv.sgst)}</span></div>`
        }
        ${inv.paid > 0
          ? `<div class="t-row"><span>Balance Received</span><span>${inr(inv.paid)}</span></div>`
          : ''}
        ${balance > 0.01
          ? `<div class="t-row t-danger"><span>Balance Due</span><span>${inr(balance)}</span></div>`
          : ''}
      </div>
    </div>

    <div class="grand-total-box">
      <div class="grand-label">GRAND TOTAL</div>
      ${inr(inv.total)}
    </div>

    <div class="sign-box">
      <div class="sign-header">Seal &amp; Signature</div>
      <div class="sign-body">
        <div class="seal-circle">SEAL</div>
        <div class="sign-line">Authorised Signatory</div>
      </div>
    </div>
  </div>

</div>

<div class="footer">This is a computer-generated invoice · Powered by Locas</div>
</body>
</html>`;
}