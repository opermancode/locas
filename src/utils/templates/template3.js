function r(n)   { return Number(n || 0).toFixed(2); }
function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }); }

export default function template3(invoice, profile) {
  const inv     = invoice;
  const prof    = profile || {};
  const isInter = inv.supply_type === 'inter';
  const balance = (inv.total || 0) - (inv.paid || 0);

  const itemRows = (inv.items || []).map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#F9FAFB' : '#FFFFFF'}">
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
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 12px; color: #111827; }

  .header {
    background: #111827; color: white;
    padding: 28px; display: flex;
    justify-content: space-between; align-items: flex-start;
  }
  .brand     { font-size: 26px; font-weight: 800; color: #FFFFFF; letter-spacing: 3px; text-transform: uppercase; }
  .brand-sub { font-size: 11px; color: #9CA3AF; margin-top: 5px; line-height: 1.7; }
  .inv-right { text-align: right; }
  .inv-title { font-size: 11px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 6px; }
  .inv-num   { font-size: 22px; font-weight: 800; color: #FFFFFF; }
  .inv-meta  { font-size: 11px; color: #9CA3AF; margin-top: 4px; line-height: 1.8; }

  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-top: 4px; }
  .paid    { background: #D1FAE5; color: #065F46; }
  .unpaid  { background: #FEE2E2; color: #991B1B; }
  .partial { background: #FEF3C7; color: #92400E; }

  .body { padding: 24px 28px; }

  .parties { display: flex; gap: 20px; margin-bottom: 24px; }
  .party-box { flex: 1; }
  .party-label { font-size: 10px; font-weight: 700; color: #6B7280; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 2px solid #E5E7EB; }
  .party-name  { font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 4px; }
  .party-detail{ font-size: 11px; color: #6B7280; line-height: 1.7; }
  .supply-tag  { display: inline-block; background: #F3F4F6; color: #374151; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-top: 5px; }

  table  { width: 100%; border-collapse: collapse; }
  thead tr { background: #374151; color: white; }
  th     { padding: 10px 8px; text-align: left; font-size: 11px; font-weight: 600; letter-spacing: 0.5px; }
  .td    { padding: 9px 8px; font-size: 11px; border-bottom: 1px solid #F3F4F6; vertical-align: top; }
  .center{ text-align: center; }
  .right { text-align: right; }
  .bold  { font-weight: 700; }
  .small { font-size: 10px; color: #9CA3AF; }

  .totals-wrap { display: flex; justify-content: flex-end; margin-top: 12px; }
  .totals-box  { width: 270px; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden; }
  .t-row  { display: flex; justify-content: space-between; padding: 7px 12px; font-size: 12px; border-bottom: 1px solid #F3F4F6; }
  .t-grand{ background: #111827; color: white; font-size: 14px; font-weight: 800; border: none; padding: 10px 12px; }
  .t-muted{ color: #6B7280; background: #F9FAFB; }
  .t-danger{ color: #DC2626; font-weight: 700; }

  .section-title { font-size: 11px; font-weight: 700; color: #374151; text-transform: uppercase; letter-spacing: 0.8px; margin: 16px 0 6px; }
  .note-box  { background: #F9FAFB; border-left: 3px solid #374151; padding: 9px 12px; font-size: 11px; color: #374151; }
  .bank-box  { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; padding: 10px; font-size: 11px; color: #15803D; margin-bottom: 8px; }

  .footer { text-align: center; font-size: 10px; color: #9CA3AF; margin-top: 24px; padding: 12px 0; background: #F9FAFB; border-top: 1px solid #E5E7EB; }
</style>
</head>
<body>

<!-- Dark Header -->
<div class="header">
  <div>
    <div class="brand">${prof.name || 'My Business'}</div>
    <div class="brand-sub">
      ${prof.address ? prof.address + '<br>' : ''}
      ${prof.phone   ? prof.phone             : ''}
      ${prof.email   ? '  ·  ' + prof.email  : ''}<br>
      ${prof.gstin   ? 'GSTIN: ' + prof.gstin : ''}
    </div>
  </div>
  <div class="inv-right">
    <div class="inv-title">Tax Invoice</div>
    <div class="inv-num">${inv.invoice_number}</div>
    <div class="inv-meta">
      ${inv.date}<br>
      ${inv.due_date ? 'Due: ' + inv.due_date + '<br>' : ''}
      <span class="status-badge ${inv.status || 'unpaid'}">${(inv.status || 'unpaid').toUpperCase()}</span>
    </div>
  </div>
</div>

<div class="body">

<div class="parties">
  <div class="party-box">
    <div class="party-label">Seller</div>
    <div class="party-name">${prof.name || 'My Business'}</div>
    <div class="party-detail">
      ${prof.address ? prof.address + '<br>' : ''}
      ${prof.gstin   ? 'GSTIN: ' + prof.gstin + '<br>' : ''}
      ${prof.state   ? prof.state + ' (' + (prof.state_code || '') + ')' : ''}
    </div>
  </div>
  <div class="party-box">
    <div class="party-label">Buyer</div>
    <div class="party-name">${inv.party_name || 'Walk-in Customer'}</div>
    <div class="party-detail">
      ${inv.party_address ? inv.party_address + '<br>'                                            : ''}
      ${inv.party_gstin   ? 'GSTIN: ' + inv.party_gstin + '<br>'                                  : ''}
      ${inv.party_state   ? inv.party_state + ' (' + (inv.party_state_code || '') + ')' : ''}
    </div>
    <span class="supply-tag">${isInter ? 'IGST — Inter-state' : 'CGST+SGST — Intra-state'}</span>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:28%">Item</th>
      <th class="center" style="width:10%">Qty</th>
      <th class="right"  style="width:9%">Rate</th>
      <th class="right"  style="width:7%">Disc</th>
      <th class="right"  style="width:12%">Taxable</th>
      <th class="center" style="width:8%">GST</th>
      <th class="right"  style="width:13%">${isInter ? 'IGST' : 'CGST/SGST'}</th>
      <th class="right"  style="width:13%">Total</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

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
    ${inv.paid > 0   ? `<div class="t-row t-muted"><span>Paid</span><span>${inr(inv.paid)}</span></div>`        : ''}
    ${balance > 0.01 ? `<div class="t-row t-danger"><span>Balance Due</span><span>${inr(balance)}</span></div>` : ''}
  </div>
</div>

${prof.bank_name || prof.account_no ? `
<div class="section-title">Bank Details</div>
<div class="bank-box">
  ${prof.bank_name  ? '<strong>' + prof.bank_name + '</strong><br>' : ''}
  ${prof.account_no ? 'A/C: ' + prof.account_no + '<br>'           : ''}
  ${prof.ifsc       ? 'IFSC: ' + prof.ifsc                          : ''}
</div>` : ''}

${inv.notes ? `<div class="section-title">Notes</div><div class="note-box">${inv.notes}</div>` : ''}
${inv.terms ? `<div class="section-title">Terms &amp; Conditions</div><div class="note-box" style="margin-top:6px">${inv.terms}</div>` : ''}

</div>

<div class="footer">System-generated invoice · Locas</div>
</body>
</html>`;
}