function r(n){return Number(n||0).toFixed(2);}
function inr(n){return '₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});}
function fmtDate(d){
  if(!d)return'';
  const p=d.split('-');
  if(p.length===3&&p[0].length===4){
    const m=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return p[2]+' '+m[parseInt(p[1])-1]+', '+p[0];
  }
  return d;
}
function words(amount){
  const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const n=Math.floor(amount);if(n===0)return'Zero';
  const two=(x)=>x>=20?tens[Math.floor(x/10)]+(x%10?' '+ones[x%10]:''):ones[x];
  let w='';
  const cr=Math.floor(n/10000000),lk=Math.floor((n%10000000)/100000),th=Math.floor((n%100000)/1000),hu=Math.floor((n%1000)/100),re=n%100;
  if(cr)w+=two(cr)+' Crore ';if(lk)w+=two(lk)+' Lakh ';if(th)w+=two(th)+' Thousand ';if(hu)w+=ones[hu]+' Hundred ';if(re)w+=two(re);
  return w.trim()+' Rupees Only';
}

export default function template3(invoice, profile, accent, upiBlock) {
  accent = accent || '#4A5568';
  upiBlock = upiBlock || '';
  const inv = invoice, prof = profile || {};
  const isInter = inv.supply_type === 'inter';

  // Empty rows to pad table to minimum 8 rows
  const itemCount = (inv.items || []).length;
  const minRows   = Math.max(8, itemCount);
  const emptyRows = Math.max(0, minRows - itemCount);

  const itemRows = (inv.items || []).map((item, i) => `
    <tr>
      <td class="td-desc">
        <div class="item-name">${item.name}</div>
        ${item.hsn ? `<div class="item-meta">HSN: ${item.hsn}</div>` : ''}
        <div class="item-meta tax-line">${
          isInter
            ? `IGST @ ${item.gst_rate}%: ${inr(item.igst)}`
            : `CGST @ ${item.gst_rate/2}%: ${inr(item.cgst)} &nbsp;|&nbsp; SGST @ ${item.gst_rate/2}%: ${inr(item.sgst)}`
        }${item.discount > 0 ? ` &nbsp;|&nbsp; Disc: ${item.discount}%` : ''}</div>
      </td>
      <td class="td-qty">${item.qty} ${item.unit || 'pcs'}</td>
      <td class="td-num">${inr(item.rate)}</td>
      <td class="td-num total-cell">${inr(item.total)}</td>
    </tr>
  `).join('');

  const emptyRowsHtml = Array(emptyRows).fill(`
    <tr class="empty-row">
      <td class="td-desc">&nbsp;</td>
      <td class="td-qty"></td>
      <td class="td-num"></td>
      <td class="td-num"></td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  @page {
    size: 210mm 297mm;
    margin: 18mm 16mm;
  }
  @media print {
    html, body { width: 210mm; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .page { box-shadow: none !important; }
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  html { background: #1a1a1a; }
  body {
    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
    font-size: 12px;
    color: #222;
    background: #1a1a1a;
    padding: 24px;
    line-height: 1.4;
  }

  .page {
    background: #fff;
    width: 100%;
    max-width: 750px;
    margin: 0 auto;
    padding: 40px 44px 48px;
    box-shadow: 0 4px 32px rgba(0,0,0,0.4);
    min-height: 900px;
  }

  /* ── Top: Invoice title ── */
  .top-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;
  }
  .meta-block { font-size: 12px; color: #222; line-height: 1.9; }
  .meta-label { font-weight: 700; }
  .invoice-title {
    font-size: 36px;
    font-weight: 300;
    color: #2d3748;
    letter-spacing: 1px;
    text-align: right;
  }

  /* ── From / Bill To ── */
  .parties-row {
    display: flex;
    justify-content: space-between;
    margin-bottom: 28px;
    gap: 20px;
  }
  .from-block, .bill-block { flex: 1; font-size: 12px; line-height: 1.8; color: #333; }
  .party-label { font-weight: 700; font-size: 12px; color: #222; margin-bottom: 2px; }
  .party-name  { font-weight: 700; font-size: 13px; color: #111; }
  .party-sub   { color: #555; font-size: 11.5px; }
  .gstin-txt   { font-size: 11px; color: #666; }

  /* ── Items table ── */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0;
  }
  thead tr {
    background: ${accent};
    color: #fff;
  }
  thead th {
    padding: 9px 10px;
    font-size: 11.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .th-desc { text-align: left; }
  .th-num  { text-align: right; }
  .th-qty  { text-align: center; }

  tbody tr {
    border-bottom: 1px solid #e8e8e8;
  }
  tbody tr:last-child { border-bottom: 2px solid #ccc; }

  .td-desc {
    padding: 9px 10px;
    text-align: left;
    vertical-align: top;
    min-width: 220px;
  }
  .td-qty  { padding: 9px 10px; text-align: center; vertical-align: top; color: #333; }
  .td-num  { padding: 9px 10px; text-align: right;  vertical-align: top; color: #333; }
  .total-cell { font-weight: 600; color: #111; }

  .item-name { font-weight: 600; color: #111; font-size: 12px; }
  .item-meta { font-size: 10.5px; color: #888; margin-top: 1px; }
  .tax-line  { color: #999; }

  .empty-row td { height: 30px; }

  /* ── Totals + Payment footer ── */
  .footer-row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-top: 0;
  }
  .payment-terms {
    font-size: 12px;
    color: #333;
    padding-top: 10px;
    flex: 1;
  }
  .payment-terms-label { font-weight: 700; }

  .totals-block { min-width: 260px; }
  .totals-table { width: 100%; border-collapse: collapse; }
  .totals-table td { padding: 5px 10px; font-size: 12px; color: #333; }
  .totals-table .lbl { text-align: left; }
  .totals-table .amt { text-align: right; }
  .totals-table .total-row td {
    background: ${accent};
    color: #fff;
    font-weight: 700;
    font-size: 13px;
    padding: 8px 10px;
  }
  .totals-table .sub-row td { border-top: 1px solid #e8e8e8; }

  /* ── Bank / Notes ── */
  .bank-section {
    margin-top: 24px;
    padding-top: 16px;
    border-top: 1px solid #e0e0e0;
    display: flex;
    gap: 32px;
    font-size: 11.5px;
    color: #444;
  }
  .bank-col { flex: 1; }
  .bank-label { font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px; color: #888; margin-bottom: 6px; }
  .bank-det   { line-height: 1.8; }
  .words-txt  { font-size: 11px; color: #666; font-style: italic; margin-top: 6px; }
  .powered    { margin-top: 20px; font-size: 10px; color: #bbb; text-align: center; }
</style>
</head>
<body>
<div class="page">

  <!-- Top: meta + title -->
  <div class="top-row">
    <div class="meta-block">
      <div><span class="meta-label">Date:</span> ${fmtDate(inv.date)}</div>
      <div><span class="meta-label">Invoice #:</span> ${inv.invoice_number}</div>
      ${inv.due_date ? `<div><span class="meta-label">Due Date:</span> ${fmtDate(inv.due_date)}</div>` : ''}
      ${inv.po_number ? `<div><span class="meta-label">PO Ref:</span> ${inv.po_number}</div>` : ''}
      <div><span class="meta-label">Status:</span> ${(inv.status || 'Unpaid').toUpperCase()}</div>
    </div>
    <div class="invoice-title">Invoice</div>
  </div>

  <!-- From / Bill To -->
  <div class="parties-row">
    <div class="from-block">
      <div class="party-label">Your Company Name</div>
      <div class="party-name">${prof.name || ''}</div>
      ${prof.address ? `<div class="party-sub">${prof.address}</div>` : ''}
      ${[prof.city, prof.state].filter(Boolean).length ? `<div class="party-sub">${[prof.city, prof.state, prof.pincode].filter(Boolean).join(', ')}</div>` : ''}
      ${prof.phone ? `<div class="party-sub">${prof.phone}</div>` : ''}
      ${prof.email ? `<div class="party-sub">${prof.email}</div>` : ''}
      ${prof.gstin ? `<div class="gstin-txt">GSTIN: ${prof.gstin}</div>` : ''}
    </div>
    <div class="bill-block">
      <div class="party-label">Bill To:</div>
      <div class="party-name">${inv.party_name || 'Walk-in Customer'}</div>
      ${inv.party_address ? `<div class="party-sub">${inv.party_address}</div>` : ''}
      ${inv.party_state   ? `<div class="party-sub">${inv.party_state}</div>` : ''}
      ${inv.party_gstin   ? `<div class="gstin-txt">GSTIN: ${inv.party_gstin}</div>` : ''}
      <div class="gstin-txt">${isInter ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'}</div>
    </div>
  </div>

  <!-- Items Table -->
  <table>
    <thead>
      <tr>
        <th class="th-desc">Description</th>
        <th class="th-qty">Quantity</th>
        <th class="th-num">Unit Price</th>
        <th class="th-num">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      ${emptyRowsHtml}
    </tbody>
  </table>

  <!-- Footer: payment terms + totals -->
  <div class="footer-row">
    <div class="payment-terms">
      <div class="payment-terms-label">Payment Terms:</div>
      <div>${inv.terms || 'Net 30'}</div>
      ${inv.notes ? `<div style="margin-top:8px;color:#555">${inv.notes}</div>` : ''}
    </div>
    <div class="totals-block">
      <table class="totals-table">
        <tr class="sub-row"><td class="lbl">Subtotal</td><td class="amt">${inr(inv.subtotal || inv.taxable)}</td></tr>
        ${inv.discount > 0 ? `<tr class="sub-row"><td class="lbl">Discount</td><td class="amt">−${inr((inv.subtotal||0)-(inv.taxable||0))}</td></tr>` : ''}
        <tr class="sub-row"><td class="lbl">Taxable Amount</td><td class="amt">${inr(inv.taxable)}</td></tr>
        ${isInter
          ? `<tr class="sub-row"><td class="lbl">IGST</td><td class="amt">${inr(inv.igst)}</td></tr>`
          : `<tr class="sub-row"><td class="lbl">CGST</td><td class="amt">${inr(inv.cgst)}</td></tr>
             <tr class="sub-row"><td class="lbl">SGST</td><td class="amt">${inr(inv.sgst)}</td></tr>`
        }
        <tr class="total-row"><td class="lbl">Total Amount Due:</td><td class="amt">${inr(inv.total)}</td></tr>
      </table>
    </div>
  </div>

  <!-- Bank / Notes -->
  ${prof.bank_name || prof.account_no || prof.upi_id || upiBlock ? `
  <div class="bank-section">
    ${prof.bank_name || prof.account_no ? `
    <div class="bank-col">
      <div class="bank-label">Payment Details</div>
      <div class="bank-det">
        ${prof.bank_name  ? `<div>${prof.bank_name}</div>` : ''}
        ${prof.account_no ? `<div>A/C: ${prof.account_no}</div>` : ''}
        ${prof.ifsc       ? `<div>IFSC: ${prof.ifsc}</div>` : ''}
        ${prof.upi_id     ? `<div>UPI: ${prof.upi_id}</div>` : ''}
      </div>
    </div>` : ''}
    ${upiBlock ? `<div class="bank-col">${upiBlock}</div>` : ''}
  </div>
  ` : ''}

  <div class="words-txt">Amount in words: ${words(inv.total)}</div>
  <div class="powered">— Generated by Locas —</div>

</div>
</body>
</html>`;
}