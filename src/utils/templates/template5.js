function r(n)   { return Number(n || 0).toFixed(2); }
function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }); }

export default function template5(invoice, profile) {
  const inv     = invoice;
  const prof    = profile || {};
  const isInter = inv.supply_type === 'inter';
  const balance = (inv.total || 0) - (inv.paid || 0);

  const itemRows = (inv.items || []).map(item => `
    <div class="item-name">${item.name}</div>
    <div class="item-row">
      <span>${item.qty} ${item.unit} × ₹${r(item.rate)}</span>
      <span>₹${r(item.total)}</span>
    </div>
    ${item.discount > 0 ? `<div class="item-sub">Disc: ${item.discount}%</div>` : ''}
    <div class="item-sub">
      GST ${item.gst_rate}%:
      ${isInter ? 'IGST ₹' + r(item.igst) : 'CGST ₹' + r(item.cgst) + ' | SGST ₹' + r(item.sgst)}
    </div>
    <div class="divider-dot"></div>
  `).join('');

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #000; background: #fff; max-width: 320px; margin: 0 auto; padding: 16px 12px; }
  .center { text-align: center; }
  .divider { border-top: 1px dashed #000; margin: 8px 0; }
  .divider-solid { border-top: 2px solid #000; margin: 8px 0; }
  .divider-dot   { border-top: 1px dotted #999; margin: 6px 0; }
  .brand     { font-size: 18px; font-weight: 700; text-align: center; letter-spacing: 3px; margin-bottom: 2px; }
  .brand-sub { font-size: 10px; text-align: center; color: #333; line-height: 1.6; }
  .inv-title { font-size: 11px; text-align: center; font-weight: 700; letter-spacing: 2px; margin: 8px 0 2px; }
  .inv-num   { font-size: 14px; text-align: center; font-weight: 700; margin-bottom: 2px; }
  .inv-meta  { font-size: 10px; text-align: center; color: #333; line-height: 1.7; margin-bottom: 6px; }
  .status-badge { display: inline-block; border: 1px solid #000; padding: 1px 8px; font-size: 10px; font-weight: 700; }
  .party-label { font-size: 10px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
  .party-name  { font-size: 13px; font-weight: 700; }
  .party-detail{ font-size: 10px; color: #333; line-height: 1.6; }
  .item-name  { font-size: 12px; font-weight: 700; margin-top: 4px; }
  .item-row   { display: flex; justify-content: space-between; font-size: 12px; }
  .item-sub   { font-size: 10px; color: #555; }
  .total-row  { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; }
  .total-grand{ display: flex; justify-content: space-between; font-size: 15px; font-weight: 700; padding: 4px 0; }
  .total-muted{ color: #555; }
  .total-danger{ font-weight: 700; }
  .bank-section { font-size: 10px; line-height: 1.7; }
  .note-section { font-size: 10px; color: #333; line-height: 1.6; }
  .upi-box { text-align: center; margin: 8px 0; }
  .upi-label { font-size: 10px; font-weight: 700; margin-bottom: 4px; }
  .upi-qr { width: 60px; height: 60px; border: 1.5px dashed #000; margin: 0 auto; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #666; }
  .upi-id { font-size: 9px; margin-top: 3px; }
  .footer { text-align: center; font-size: 10px; color: #555; margin-top: 10px; }
  .thankyou { text-align: center; font-size: 13px; font-weight: 700; letter-spacing: 1px; margin: 10px 0 4px; }
</style></head><body>

<div class="brand">${(prof.name || 'MY BUSINESS').toUpperCase()}</div>
<div class="brand-sub">
  ${prof.address ? prof.address + '<br>' : ''}
  ${prof.phone   ? prof.phone : ''}${prof.email ? ' | ' + prof.email : ''}<br>
  ${prof.gstin   ? 'GST: ' + prof.gstin : ''}
</div>

<div class="divider-solid"></div>
<div class="inv-title">*** TAX INVOICE ***</div>
<div class="inv-num">${inv.invoice_number}</div>
<div class="inv-meta">
  Date: ${inv.date}${inv.due_date ? '<br>Due: ' + inv.due_date : ''}<br>
  <span class="status-badge">${(inv.status || 'UNPAID').toUpperCase()}</span>
</div>

<div class="divider"></div>
<div class="party-label">Bill To:</div>
<div class="party-name">${inv.party_name || 'Walk-in Customer'}</div>
<div class="party-detail">
  ${inv.party_address ? inv.party_address + '<br>' : ''}
  ${inv.party_gstin   ? 'GST: ' + inv.party_gstin  + '<br>' : ''}
  ${inv.party_state   ? inv.party_state : ''}
</div>
<div style="font-size:10px;margin-top:3px">Supply: ${isInter ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'}</div>

<div class="divider"></div>
<div style="font-size:10px;font-weight:700;display:flex;justify-content:space-between">
  <span>ITEM</span><span>AMOUNT</span>
</div>
<div class="divider-dot"></div>
${itemRows}

<div class="divider-solid"></div>
<div class="total-row"><span>Subtotal</span><span>${inr(inv.subtotal)}</span></div>
${inv.discount > 0 ? `<div class="total-row total-muted"><span>Discount (${inv.discount}%)</span><span>-${inr((inv.subtotal||0)-(inv.taxable||0))}</span></div>` : ''}
<div class="total-row"><span>Taxable</span><span>${inr(inv.taxable)}</span></div>
${isInter
  ? `<div class="total-row total-muted"><span>IGST</span><span>${inr(inv.igst)}</span></div>`
  : `<div class="total-row total-muted"><span>CGST</span><span>${inr(inv.cgst)}</span></div>
     <div class="total-row total-muted"><span>SGST</span><span>${inr(inv.sgst)}</span></div>`
}
<div class="divider-solid"></div>
<div class="total-grand"><span>TOTAL</span><span>${inr(inv.total)}</span></div>
${inv.paid > 0   ? `<div class="total-row total-muted"><span>Paid</span><span>${inr(inv.paid)}</span></div>` : ''}
${balance > 0.01 ? `<div class="total-grand total-danger"><span>BALANCE</span><span>${inr(balance)}</span></div>` : ''}

${prof.bank_name || prof.account_no ? `
<div class="divider"></div>
<div class="party-label">Payment Details:</div>
<div class="bank-section">
  ${prof.bank_name  ? prof.bank_name + '<br>' : ''}
  ${prof.account_no ? 'A/C: ' + prof.account_no + '<br>' : ''}
  ${prof.ifsc       ? 'IFSC: ' + prof.ifsc : ''}
</div>` : ''}

<div class="upi-box">
  <div class="upi-label">Scan &amp; Pay</div>
  <div class="upi-qr">QR</div>
  ${prof.phone ? `<div class="upi-id">UPI: ${prof.phone}@upi</div>` : ''}
</div>

${inv.notes ? `<div class="divider"></div><div class="party-label">Note:</div><div class="note-section">${inv.notes}</div>` : ''}

<div class="divider"></div>
<div class="thankyou">** THANK YOU **</div>
<div class="footer">
  ${inv.terms ? inv.terms + '<br>' : ''}
  ${prof.name || 'My Business'} · Powered by Locas
</div>
</body></html>`;
}
