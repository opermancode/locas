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
  const twoDigit = (n) => n >= 20 ? tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '') : ones[n];
  if (crore) words += twoDigit(crore) + ' Crore ';
  if (lakh)  words += twoDigit(lakh)  + ' Lakh ';
  if (thou)  words += twoDigit(thou)  + ' Thousand ';
  if (hund)  words += ones[hund]      + ' Hundred ';
  if (rest)  words += twoDigit(rest);
  return words.trim() + ' Rupees Only';
}

export default function template1(invoice, profile, accentColor = '#1E3A5F') {
  const inv     = invoice;
  const prof    = profile || {};
  const isInter = inv.supply_type === 'inter';
  const balance = (inv.total || 0) - (inv.paid || 0);

  const itemRows = (inv.items || []).map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#F0F4F8' : '#FFFFFF'}">
      <td class="td" style="text-align:center">${i + 1}</td>
      <td class="td">${item.name}</td>
      <td class="td" style="text-align:center">${item.hsn || '—'}</td>
      <td class="td" style="text-align:center">${item.qty} ${item.unit}</td>
      <td class="td" style="text-align:right">₹${r(item.rate)}</td>
      <td class="td" style="text-align:right">₹${r(item.taxable)}</td>
      <td class="td" style="text-align:center">${item.gst_rate}%</td>
      <td class="td" style="text-align:right">${isInter
        ? '₹' + r(item.igst)
        : '₹' + r(item.cgst) + '<br>₹' + r(item.sgst)
      }</td>
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

  .top-header {
    background: ${accentColor};
    color: white;
    text-align: center;
    padding: 10px;
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 3px;
    margin-bottom: 0;
  }
  .sub-header {
    background: ${accentColor}22;
    border: 1px solid ${accentColor};
    border-top: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    margin-bottom: 12px;
  }
  .business-name { font-size: 15px; font-weight: 800; color: ${accentColor}; }
  .business-detail { font-size: 10px; color: #444; margin-top: 2px; line-height: 1.6; }
  .inv-info { text-align: right; font-size: 10px; color: #444; line-height: 1.8; }
  .inv-info strong { color: ${accentColor}; font-size: 12px; }

  .bill-section {
    border: 1px solid ${accentColor};
    margin-bottom: 12px;
  }
  .bill-header {
    background: ${accentColor};
    color: white;
    font-size: 10px;
    font-weight: 700;
    padding: 5px 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .bill-body { padding: 10px; }
  .bill-row  { display: flex; gap: 20px; }
  .bill-col  { flex: 1; }
  .bill-label{ font-size: 9px; font-weight: 700; color: #666; text-transform: uppercase; margin-bottom: 2px; }
  .bill-value{ font-size: 12px; font-weight: 700; color: #111; }
  .bill-sub  { font-size: 10px; color: #555; line-height: 1.6; margin-top: 2px; }
  .supply-tag{ display:inline-block; background:${accentColor}22; color:${accentColor}; font-size:9px; font-weight:700; padding:2px 8px; border-radius:3px; margin-top:4px; border:1px solid ${accentColor}44; }

  table { width:100%; border-collapse:collapse; margin-bottom:0; }
  .table-wrap { border: 1px solid ${accentColor}; margin-bottom: 12px; }
  thead tr { background: ${accentColor}; color: white; }
  th  { padding: 7px 6px; text-align: center; font-size: 10px; font-weight: 600; border-right: 1px solid ${accentColor}88; }
  th:last-child { border-right: none; }
  .td { padding: 7px 6px; font-size: 10px; border-bottom: 1px solid #E5E7EB; border-right: 1px solid #E5E7EB; vertical-align: middle; }
  .td:last-child { border-right: none; }

  .bottom-section { display: flex; gap: 12px; margin-bottom: 12px; }
  .terms-box {
    flex: 1; border: 1px solid ${accentColor};
  }
  .terms-header { background: ${accentColor}; color: white; font-size: 10px; font-weight: 700; padding: 5px 10px; }
  .terms-body   { padding: 8px 10px; font-size: 10px; color: #444; line-height: 1.8; }
  .terms-row    { display: flex; justify-content: space-between; padding: 2px 0; border-bottom: 1px dotted #ddd; }
  .terms-grand  { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13px; font-weight: 800; color: ${accentColor}; margin-top: 4px; }
  .terms-danger { display: flex; justify-content: space-between; padding: 2px 0; font-weight: 700; color: #DC2626; }

  .sign-box {
    width: 200px; border: 1px solid ${accentColor};
    display: flex; flex-direction: column;
  }
  .sign-header { background: ${accentColor}; color: white; font-size: 10px; font-weight: 700; padding: 5px 10px; }
  .sign-body   { flex: 1; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; min-height: 100px; }
  .sign-name   { font-size: 11px; font-weight: 700; color: #111; }
  .sign-line   { border-top: 1px solid #999; margin-top: 40px; padding-top: 4px; font-size: 9px; color: #666; text-align: center; }

  .words-box {
    border: 1px solid ${accentColor};
    padding: 7px 10px;
    margin-bottom: 12px;
    display: flex;
    gap: 8px;
    align-items: flex-start;
  }
  .words-label { font-size: 9px; font-weight: 700; color: ${accentColor}; text-transform: uppercase; white-space: nowrap; margin-top: 1px; }
  .words-value { font-size: 10px; color: #111; font-style: italic; }

  .status-badge { display:inline-block; padding:2px 10px; border-radius:3px; font-size:9px; font-weight:700; }
  .paid    { background:#D1FAE5; color:#065F46; }
  .unpaid  { background:#FEE2E2; color:#991B1B; }
  .partial { background:#FEF3C7; color:#92400E; }

  .footer { text-align:center; font-size:9px; color:#999; margin-top:8px; border-top:1px solid #eee; padding-top:6px; }
</style>
</head>
<body>

<!-- Top header bar -->
<div class="top-header">TAX INVOICE</div>

<!-- Sub header: business + invoice info -->
<div class="sub-header">
  <div>
    <div class="business-name">${prof.name || 'My Business'}</div>
    <div class="business-detail">
      ${prof.address ? prof.address + '<br>' : ''}
      ${prof.phone   ? 'Ph: ' + prof.phone  : ''}
      ${prof.email   ? '  |  Email: ' + prof.email : ''}<br>
      ${prof.gstin   ? 'GSTIN: <strong>' + prof.gstin + '</strong>' : ''}
      ${prof.pan     ? '  |  PAN: ' + prof.pan : ''}
    </div>
  </div>
  <div class="inv-info">
    <strong>${inv.invoice_number}</strong><br>
    Date: ${inv.date}<br>
    ${inv.due_date ? 'Due: ' + inv.due_date + '<br>' : ''}
    <span class="status-badge ${inv.status || 'unpaid'}">${(inv.status || 'unpaid').toUpperCase()}</span>
  </div>
</div>

<!-- Bill To / From -->
<div class="bill-section">
  <div class="bill-header">Party Details</div>
  <div class="bill-body">
    <div class="bill-row">
      <div class="bill-col">
        <div class="bill-label">From (Seller)</div>
        <div class="bill-value">${prof.name || 'My Business'}</div>
        <div class="bill-sub">
          ${prof.address    ? prof.address + '<br>'                                      : ''}
          ${prof.gstin      ? 'GSTIN: ' + prof.gstin + '<br>'                            : ''}
          ${prof.state      ? 'State: ' + prof.state + ' (' + (prof.state_code||'') + ')': ''}
        </div>
      </div>
      <div style="width:1px;background:${accentColor}33;margin:0 10px"></div>
      <div class="bill-col">
        <div class="bill-label">Bill To (Buyer)</div>
        <div class="bill-value">${inv.party_name || 'Walk-in Customer'}</div>
        <div class="bill-sub">
          ${inv.party_address ? inv.party_address + '<br>'                                            : ''}
          ${inv.party_gstin   ? 'GSTIN: ' + inv.party_gstin + '<br>'                                  : ''}
          ${inv.party_state   ? 'State: ' + inv.party_state + ' (' + (inv.party_state_code||'') + ')' : ''}
        </div>
        <span class="supply-tag">${isInter ? '🔀 IGST — Inter-state' : '✅ CGST+SGST — Intra-state'}</span>
      </div>
    </div>
  </div>
</div>

<!-- Items Table -->
<div class="table-wrap">
  <table>
    <thead>
      <tr>
        <th style="width:4%">#</th>
        <th style="width:24%;text-align:left">Description</th>
        <th style="width:8%">HSN</th>
        <th style="width:9%">Qty</th>
        <th style="width:10%">Rate</th>
        <th style="width:11%">Taxable</th>
        <th style="width:7%">GST%</th>
        <th style="width:14%">${isInter ? 'IGST' : 'CGST/SGST'}</th>
        <th style="width:13%">Amount</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>
</div>

<!-- Amount in words -->
<div class="words-box">
  <span class="words-label">Amount in Words:</span>
  <span class="words-value">${amountInWords(inv.total)}</span>
</div>

<!-- Bottom: Terms + Totals + Signature -->
<div class="bottom-section">

  <!-- Terms & Totals -->
  <div class="terms-box">
    <div class="terms-header">Summary</div>
    <div class="terms-body">
      <div class="terms-row"><span>Subtotal</span><span>${inr(inv.subtotal)}</span></div>
      ${inv.discount > 0 ? `<div class="terms-row"><span>Discount (${inv.discount}%)</span><span>-${inr((inv.subtotal||0)-(inv.taxable||0))}</span></div>` : ''}
      <div class="terms-row"><span>Taxable Amount</span><span>${inr(inv.taxable)}</span></div>
      ${isInter
        ? `<div class="terms-row"><span>IGST</span><span>${inr(inv.igst)}</span></div>`
        : `<div class="terms-row"><span>Add: CGST</span><span>${inr(inv.cgst)}</span></div>
           <div class="terms-row"><span>Add: SGST</span><span>${inr(inv.sgst)}</span></div>`
      }
      ${inv.paid > 0    ? `<div class="terms-row"><span>Balance Received</span><span>${inr(inv.paid)}</span></div>` : ''}
      ${balance > 0.01  ? `<div class="terms-danger"><span>Balance Due</span><span>${inr(balance)}</span></div>`   : ''}
      <div class="terms-grand"><span>Grand Total</span><span>${inr(inv.total)}</span></div>

      ${prof.bank_name || prof.account_no ? `
        <div style="margin-top:10px;padding-top:6px;border-top:1px solid #eee;font-size:10px;color:#444;line-height:1.8">
          <strong style="color:${accentColor}">Bank Details</strong><br>
          ${prof.bank_name  ? prof.bank_name + '<br>'  : ''}
          ${prof.account_no ? 'A/C: ' + prof.account_no + '<br>' : ''}
          ${prof.ifsc       ? 'IFSC: ' + prof.ifsc     : ''}
        </div>` : ''}

      ${inv.notes ? `
        <div style="margin-top:8px;padding-top:6px;border-top:1px solid #eee;font-size:10px;color:#444">
          <strong style="color:${accentColor}">Terms &amp; Conditions</strong><br>
          ${inv.notes}
        </div>` : ''}
    </div>
  </div>

  <!-- Authorised Signatory -->
  <div class="sign-box">
    <div class="sign-header">For ${prof.name || 'Business'}</div>
    <div class="sign-body">
      <div class="sign-name">${prof.name || ''}</div>
      <div class="sign-line">Authorised Signatory</div>
    </div>
  </div>

</div>

<div class="footer">This is a computer-generated invoice · Powered by Locas</div>
</body>
</html>`;
}