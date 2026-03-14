function r(n)   { return Number(n || 0).toFixed(2); }
function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }); }

export default function template2(invoice, profile) {
  const inv     = invoice;
  const prof    = profile || {};
  const isInter = inv.supply_type === 'inter';
  const balance = (inv.total || 0) - (inv.paid || 0);

  const itemRows = (inv.items || []).map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#FFF8F4' : '#FFFFFF'}">
      <td class="td">${item.name}${item.hsn ? `<br><span class="small">HSN: ${item.hsn}</span>` : ''}</td>
      <td class="td center">${item.qty} ${item.unit}</td>
      <td class="td right">₹${r(item.rate)}</td>
      <td class="td right">${item.discount > 0 ? item.discount + '%' : '—'}</td>
      <td class="td right">₹${r(item.taxable)}</td>
      <td class="td center">${item.gst_rate}%</td>
      <td class="td right">${isInter
        ? '₹' + r(item.igst)
        : '₹' + r(item.cgst) + '<br>₹' + r(item.sgst)
      }</td>
      <td class="td right bold">₹${r(item.total)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1A1A2E; padding: 0; }

  .top-bar { background: #FF6B00; height: 8px; }

  .header {
    display: flex; justify-content: space-between; align-items: flex-start;
    padding: 24px 28px 20px; border-bottom: 1px solid #FFE0CC;
    background: linear-gradient(135deg, #FFF5EE 0%, #FFFFFF 100%);
  }
  .brand     { font-size: 30px; font-weight: 800; color: #FF6B00; letter-spacing: 2px; }
  .brand-sub { font-size: 11px; color: #6B7280; margin-top: 4px; line-height: 1.7; }
  .inv-title { font-size: 13px; font-weight: 800; color: #FF6B00; text-align: right;
               text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; }
  .inv-num   { font-size: 20px; font-weight: 800; color: #1A1A2E; text-align: right; }
  .inv-meta  { text-align: right; font-size: 11px; color: #6B7280; margin-top: 4px; line-height: 1.8; }

  .status-badge {
    display: inline-block; padding: 3px 12px;
    border-radius: 20px; font-size: 10px; font-weight: 700;
  }
  .paid    { background: #D1FAE5; color: #065F46; }
  .unpaid  { background: #FEE2E2; color: #991B1B; }
  .partial { background: #FEF3C7; color: #92400E; }

  .body { padding: 20px 28px; }

  .parties { display: flex; gap: 20px; margin-bottom: 20px; }
  .party-box { flex: 1; background: #FFF5EE; border-radius: 8px; padding: 14px; border-top: 3px solid #FF6B00; }
  .party-label { font-size: 10px; font-weight: 700; color: #FF6B00; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .party-name  { font-size: 15px; font-weight: 700; color: #1A1A2E; margin-bottom: 4px; }
  .party-detail{ font-size: 11px; color: #4B5563; line-height: 1.7; }
  .supply-tag  { display: inline-block; background: #FF6B0020; color: #FF6B00; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-top: 5px; }

  table  { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  thead tr { background: #FF6B00; color: white; }
  th     { padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 600; }
  .td    { padding: 9px 8px; font-size: 11px; border-bottom: 1px solid #FFE0CC; vertical-align: top; }
  .center{ text-align: center; }
  .right { text-align: right; }
  .bold  { font-weight: 700; }
  .small { font-size: 10px; color: #9CA3AF; }

  .totals-wrap { display: flex; justify-content: flex-end; margin-top: 8px; }
  .totals-box  { width: 270px; background: #FFF5EE; border-radius: 8px; padding: 14px; }
  .t-row  { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; border-bottom: 1px solid #FFE0CC; }
  .t-grand{ font-size: 16px; font-weight: 800; color: #FF6B00; border: none; margin-top: 6px; padding-top: 6px; border-top: 2px solid #FF6B00; }
  .t-muted{ color: #6B7280; }
  .t-danger{ color: #DC2626; font-weight: 700; }

  .section-title { font-size: 11px; font-weight: 700; color: #FF6B00; text-transform: uppercase; letter-spacing: 0.8px; margin: 14px 0 6px; }
  .note-box  { background: #FFF5EE; border-left: 3px solid #FF6B00; padding: 9px 12px; font-size: 11px; color: #374151; border-radius: 0 4px 4px 0; }
  .bank-box  { background: #ECFDF5; border: 1px solid #A7F3D0; border-radius: 6px; padding: 10px; font-size: 11px; color: #065F46; margin-bottom: 8px; }

  .bottom-bar { background: #FF6B00; height: 6px; margin-top: 24px; }
  .footer { text-align: center; font-size: 10px; color: #9CA3AF; padding: 10px 0 16px; }
</style>
</head>
<body>

<div class="top-bar"></div>

<!-- Header -->
<div class="header">
  <div>
    <div class="brand">${prof.name || 'My Business'}</div>
    <div class="brand-sub">
      ${prof.address ? prof.address + '<br>' : ''}
      ${prof.phone   ? '📞 ' + prof.phone   : ''}
      ${prof.email   ? '  ·  ' + prof.email : ''}<br>
      ${prof.gstin   ? 'GSTIN: <strong>' + prof.gstin + '</strong>' : ''}
    </div>
  </div>
  <div>
    <div class="inv-title">Tax Invoice</div>
    <div class="inv-num">${inv.invoice_number}</div>
    <div class="inv-meta">
      Date: ${inv.date}<br>
      ${inv.due_date ? 'Due: ' + inv.due_date + '<br>' : ''}
      <span class="status-badge ${inv.status || 'unpaid'}">${(inv.status || 'unpaid').toUpperCase()}</span>
    </div>
  </div>
</div>

<div class="body">

<!-- Parties -->
<div class="parties">
  <div class="party-box">
    <div class="party-label">From</div>
    <div class="party-name">${prof.name || 'My Business'}</div>
    <div class="party-detail">
      ${prof.address ? prof.address + '<br>' : ''}
      ${prof.gstin   ? 'GSTIN: ' + prof.gstin + '<br>' : ''}
      ${prof.state   ? 'State: ' + prof.state + ' (' + (prof.state_code || '') + ')' : ''}
    </div>
  </div>
  <div class="party-box">
    <div class="party-label">Bill To</div>
    <div class="party-name">${inv.party_name || 'Walk-in Customer'}</div>
    <div class="party-detail">
      ${inv.party_address ? inv.party_address + '<br>' : ''}
      ${inv.party_gstin   ? 'GSTIN: ' + inv.party_gstin + '<br>' : ''}
      ${inv.party_state   ? 'State: ' + inv.party_state + ' (' + (inv.party_state_code || '') + ')' : ''}
    </div>
    <span class="supply-tag">${isInter ? '🔀 IGST' : '✅ CGST+SGST'}</span>
  </div>
</div>

<!-- Items -->
<table>
  <thead>
    <tr>
      <th style="width:28%">Item / HSN</th>
      <th class="center" style="width:10%">Qty</th>
      <th class="right"  style="width:9%">Rate</th>
      <th class="right"  style="width:7%">Disc</th>
      <th class="right"  style="width:12%">Taxable</th>
      <th class="center" style="width:8%">GST%</th>
      <th class="right"  style="width:13%">${isInter ? 'IGST' : 'CGST/SGST'}</th>
      <th class="right"  style="width:13%">Total</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<!-- Totals -->
<div class="totals-wrap">
  <div class="totals-box">
    <div class="t-row"><span>Subtotal</span><span>${inr(inv.subtotal)}</span></div>
    ${inv.discount > 0 ? `<div class="t-row t-muted"><span>Discount (${inv.discount}%)</span><span>-${inr((inv.subtotal||0)-(inv.taxable||0))}</span></div>` : ''}
    <div class="t-row"><span>Taxable</span><span>${inr(inv.taxable)}</span></div>
    ${isInter
      ? `<div class="t-row t-muted"><span>IGST</span><span>${inr(inv.igst)}</span></div>`
      : `<div class="t-row t-muted"><span>CGST</span><span>${inr(inv.cgst)}</span></div>
         <div class="t-row t-muted"><span>SGST</span><span>${inr(inv.sgst)}</span></div>`
    }
    <div class="t-row t-grand"><span>GRAND TOTAL</span><span>${inr(inv.total)}</span></div>
    ${inv.paid > 0   ? `<div class="t-row t-muted"><span>Paid</span><span>${inr(inv.paid)}</span></div>` : ''}
    ${balance > 0.01 ? `<div class="t-row t-danger"><span>Balance Due</span><span>${inr(balance)}</span></div>` : ''}
  </div>
</div>

${prof.bank_name || prof.account_no ? `
<div class="section-title">Bank Details</div>
<div class="bank-box">
  ${prof.bank_name  ? '<strong>' + prof.bank_name + '</strong><br>' : ''}
  ${prof.account_no ? 'A/C: ' + prof.account_no + '<br>'          : ''}
  ${prof.ifsc       ? 'IFSC: ' + prof.ifsc                         : ''}
</div>` : ''}

${inv.notes ? `<div class="section-title">Notes</div><div class="note-box">${inv.notes}</div>` : ''}
${inv.terms ? `<div class="section-title">Terms &amp; Conditions</div><div class="note-box" style="margin-top:6px">${inv.terms}</div>` : ''}

</div>

<div class="bottom-bar"></div>
<div class="footer">This is a system-generated invoice · Powered by Locas</div>
</body>
</html>`;
}