function r(n)   { return Number(n || 0).toFixed(2); }
function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }); }

export default function template4(invoice, profile) {
  const inv     = invoice;
  const prof    = profile || {};
  const isInter = inv.supply_type === 'inter';
  const balance = (inv.total || 0) - (inv.paid || 0);

  const itemRows = (inv.items || []).map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#F0FDF4' : '#FFFFFF'}">
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
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111827; display: flex; min-height: 100vh; }

  .sidebar {
    width: 200px; min-height: 100vh;
    background: #059669; color: white;
    padding: 28px 18px; flex-shrink: 0;
  }
  .brand     { font-size: 20px; font-weight: 800; color: white; margin-bottom: 4px; line-height: 1.2; }
  .brand-sub { font-size: 10px; color: #A7F3D0; margin-top: 6px; line-height: 1.7; }

  .side-section { margin-top: 24px; }
  .side-label   { font-size: 9px; font-weight: 700; color: #A7F3D0; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .side-value   { font-size: 11px; color: white; line-height: 1.7; }

  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 4px; font-size: 10px; font-weight: 700; margin-top: 8px; }
  .paid    { background: #D1FAE5; color: #065F46; }
  .unpaid  { background: #FEE2E2; color: #991B1B; }
  .partial { background: #FEF3C7; color: #92400E; }

  .main  { flex: 1; padding: 28px; }

  .main-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid #D1FAE5; }
  .inv-title   { font-size: 22px; font-weight: 800; color: #059669; }
  .inv-num     { font-size: 14px; font-weight: 700; color: #374151; margin-top: 4px; }
  .inv-meta    { text-align: right; font-size: 11px; color: #6B7280; line-height: 1.8; }

  .bill-to       { margin-bottom: 20px; }
  .bill-label    { font-size: 10px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .bill-name     { font-size: 15px; font-weight: 700; color: #111827; margin-bottom: 3px; }
  .bill-detail   { font-size: 11px; color: #6B7280; line-height: 1.7; }
  .supply-tag    { display: inline-block; background: #ECFDF5; color: #059669; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-top: 4px; }

  table  { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  thead tr { background: #059669; color: white; }
  th     { padding: 9px 8px; text-align: left; font-size: 11px; font-weight: 600; }
  .td    { padding: 8px; font-size: 11px; border-bottom: 1px solid #D1FAE5; vertical-align: top; }
  .center{ text-align: center; }
  .right { text-align: right; }
  .bold  { font-weight: 700; }
  .small { font-size: 10px; color: #9CA3AF; }

  .totals-wrap { display: flex; justify-content: flex-end; margin-top: 8px; }
  .totals-box  { width: 260px; }
  .t-row  { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; border-bottom: 1px solid #D1FAE5; }
  .t-grand{ font-size: 16px; font-weight: 800; color: #059669; border: none; border-top: 2px solid #059669; margin-top: 4px; padding-top: 7px; }
  .t-muted{ color: #6B7280; }
  .t-danger{ color: #DC2626; font-weight: 700; }

  .section-title { font-size: 11px; font-weight: 700; color: #059669; text-transform: uppercase; letter-spacing: 0.8px; margin: 14px 0 6px; }
  .note-box { background: #F0FDF4; border-left: 3px solid #059669; padding: 9px 12px; font-size: 11px; color: #374151; }
  .bank-box { background: #F0FDF4; border: 1px solid #A7F3D0; border-radius: 6px; padding: 10px; font-size: 11px; color: #065F46; margin-bottom: 8px; }
  .footer   { text-align: center; font-size: 10px; color: #9CA3AF; margin-top: 20px; padding-top: 10px; border-top: 1px solid #E5E7EB; }
</style>
</head>
<body>

<!-- Sidebar -->
<div class="sidebar">
  <div class="brand">${prof.name || 'My Business'}</div>
  <div class="brand-sub">
    ${prof.address ? prof.address + '<br>' : ''}
    ${prof.phone   ? prof.phone + '<br>'  : ''}
    ${prof.email   ? prof.email + '<br>'  : ''}
    ${prof.gstin   ? 'GST: ' + prof.gstin : ''}
  </div>

  <div class="side-section">
    <div class="side-label">Invoice No</div>
    <div class="side-value">${inv.invoice_number}</div>
  </div>

  <div class="side-section">
    <div class="side-label">Date</div>
    <div class="side-value">${inv.date}</div>
  </div>

  ${inv.due_date ? `
  <div class="side-section">
    <div class="side-label">Due Date</div>
    <div class="side-value">${inv.due_date}</div>
  </div>` : ''}

  <div class="side-section">
    <div class="side-label">Status</div>
    <span class="status-badge ${inv.status || 'unpaid'}">${(inv.status || 'unpaid').toUpperCase()}</span>
  </div>

  ${prof.bank_name || prof.account_no ? `
  <div class="side-section">
    <div class="side-label">Bank</div>
    <div class="side-value">
      ${prof.bank_name  ? prof.bank_name + '<br>'  : ''}
      ${prof.account_no ? prof.account_no + '<br>' : ''}
      ${prof.ifsc       ? prof.ifsc                : ''}
    </div>
  </div>` : ''}

  ${isInter
    ? `<div class="side-section"><div class="side-label">GST Type</div><div class="side-value">IGST<br>(Inter-state)</div></div>`
    : `<div class="side-section"><div class="side-label">GST Type</div><div class="side-value">CGST+SGST<br>(Intra-state)</div></div>`
  }
</div>

<!-- Main content -->
<div class="main">
  <div class="main-header">
    <div>
      <div class="inv-title">TAX INVOICE</div>
      <div class="inv-num">${inv.invoice_number}</div>
    </div>
    <div class="inv-meta">
      ${inv.date}<br>
      ${inv.due_date ? 'Due: ' + inv.due_date : ''}
    </div>
  </div>

  <div class="bill-to">
    <div class="bill-label">Bill To</div>
    <div class="bill-name">${inv.party_name || 'Walk-in Customer'}</div>
    <div class="bill-detail">
      ${inv.party_address ? inv.party_address + '<br>'                                            : ''}
      ${inv.party_gstin   ? 'GSTIN: ' + inv.party_gstin + '<br>'                                  : ''}
      ${inv.party_state   ? inv.party_state + ' (' + (inv.party_state_code || '') + ')' : ''}
    </div>
    <span class="supply-tag">${isInter ? '🔀 IGST' : '✅ CGST+SGST'}</span>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:28%">Item</th>
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

  ${inv.notes ? `<div class="section-title">Notes</div><div class="note-box">${inv.notes}</div>` : ''}
  ${inv.terms ? `<div class="section-title">Terms &amp; Conditions</div><div class="note-box" style="margin-top:6px">${inv.terms}</div>` : ''}

  <div class="footer">System-generated invoice · Locas</div>
</div>

</body>
</html>`;
}