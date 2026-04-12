/* ─ helpers ─────────────────────────────────────────────────── */
function r(n){return Number(n||0).toFixed(2);}
function inr(n){return '₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});}
function fmtDate(d){if(!d)return '';const parts=d.split('-');if(parts.length===3&&parts[0].length===4){return`${parts[2]}-${parts[1]}-${parts[0]}`;}return d;}
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

const A4_PRINT_CSS = `
  @page { size: A4 portrait; margin: 0; }
  @media print {
    html, body { width:210mm; height:297mm; margin:0!important; padding:0!important;
      -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
    .no-print { display:none!important; }
    .page { box-shadow:none!important; }
  }
  @media screen {
    body { background:#e8eaf0; min-height:100vh; display:flex; flex-direction:column; align-items:center; padding:20px 0; }
    .page { width:210mm; min-height:297mm; box-shadow:0 4px 24px rgba(0,0,0,0.13); background:#fff; }
  }
`;

export default function template2(invoice, profile, accent='#1E3A6E', upiBlock='') {
  const inv=invoice, prof=profile||{};
  const isInter=inv.supply_type==='inter';
  const hasBank=!!(prof.bank_name||prof.account_no||prof.ifsc);

  const rows=(inv.items||[]).map((item,i)=>`
    <tr>
      <td style="text-align:center;padding:10px 8px;font-size:9.5pt;border-bottom:1px solid #e8e8e8;color:#555">${i+1}</td>
      <td style="padding:10px 8px;font-size:9.5pt;border-bottom:1px solid #e8e8e8">
        <div style="font-weight:600;color:#111;margin-bottom:3px">${item.name}</div>
        ${item.hsn?`<div style="font-size:8pt;color:#999">HSN: ${item.hsn}</div>`:''}
      </td>
      <td style="text-align:right;padding:10px 8px;font-size:9.5pt;border-bottom:1px solid #e8e8e8;color:#444">${r(item.qty)}</td>
      <td style="text-align:right;padding:10px 8px;font-size:9.5pt;border-bottom:1px solid #e8e8e8;color:#444">₹${r(item.rate)}</td>
      <td style="text-align:right;padding:10px 8px;font-size:9.5pt;border-bottom:1px solid #e8e8e8;font-weight:600;color:#111">₹${r(item.total)}</td>
    </tr>`).join('');

  const bankBlock = hasBank ? `
    <div style="margin-top:14px">
      <div style="font-size:9pt;font-weight:700;color:#111;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Bank Details</div>
      ${prof.bank_name?`<div style="font-size:9pt;color:#555">Bank: <b>${prof.bank_name}</b></div>`:''}
      ${prof.account_no?`<div style="font-size:9pt;color:#555">A/C: <b>${prof.account_no}</b></div>`:''}
      ${prof.ifsc?`<div style="font-size:9pt;color:#555">IFSC: <b>${prof.ifsc}</b></div>`:''}
    </div>` : '';

  const taxType = isInter ? 'IGST' : 'CGST + SGST';
  const taxAmt  = isInter ? inv.igst : (inv.cgst + inv.sgst);

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  ${A4_PRINT_CSS}
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size:10pt; color:#111; }
  .page {
    padding: 28px;
    position: relative;
  }
  /* Outer border box around the whole invoice */
  .invoice-box {
    border: 1.5px solid #ccc;
    border-radius: 4px;
    overflow: hidden;
  }
  /* Top section: business info left, INVOICE right */
  .top-section {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 24px 24px 20px;
    border-bottom: 1px solid #ddd;
  }
  .biz-name { font-size: 16pt; font-weight: 700; color: #111; margin-bottom: 6px; }
  .biz-addr { font-size: 9pt; color: #666; line-height: 1.7; }
  .invoice-title { font-size: 26pt; font-weight: 300; color: ${accent}; letter-spacing: 2px; text-transform: uppercase; text-align:right; }
  /* Meta grid: Invoice#, Date, Terms, Due Date */
  .meta-section {
    display: flex;
    border-bottom: 1px solid #ddd;
  }
  .meta-left { flex: 1; padding: 16px 24px; border-right: 1px solid #ddd; }
  .meta-right { flex: 1; padding: 16px 24px; }
  .meta-row { display: flex; margin-bottom: 7px; font-size: 9.5pt; }
  .meta-label { color: #888; width: 110px; flex-shrink: 0; }
  .meta-value { font-weight: 700; color: #111; }
  /* Bill To / Ship To */
  .addr-section {
    display: flex;
    border-bottom: 1px solid #ddd;
  }
  .addr-col { flex: 1; padding: 16px 24px; }
  .addr-col:first-child { border-right: 1px solid #ddd; }
  .addr-head { font-size: 9pt; color: #888; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
  .addr-name { font-size: 11pt; font-weight: 700; color: #111; margin-bottom: 5px; }
  .addr-body { font-size: 9pt; color: #555; line-height: 1.8; }
  /* Items table */
  .items-section { flex: 1; }
  table { width: 100%; border-collapse: collapse; }
  tbody tr { page-break-inside: avoid; break-inside: avoid; }
  .thead-row th {
    background: ${accent};
    color: #fff;
    font-size: 9pt;
    font-weight: 600;
    padding: 10px 8px;
    text-align: right;
    letter-spacing: 0.3px;
  }
  .thead-row th:first-child { text-align: center; width: 36px; }
  .thead-row th:nth-child(2) { text-align: left; }
  /* Bottom section */
  .bottom-section {
    display: flex;
    border-top: 1px solid #ddd;
    margin-top: 8px;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .bottom-left { flex: 1; padding: 18px 24px; border-right: 1px solid #ddd; }
  .bottom-right { width: 240px; padding: 0; }
  .total-row { display: flex; justify-content: space-between; padding: 9px 18px; font-size: 9.5pt; border-bottom: 1px solid #eee; }
  .total-label { color: #555; }
  .total-value { font-weight: 600; color: #111; }
  .grand-row { display: flex; justify-content: space-between; padding: 10px 18px; background: ${accent}18; }
  .grand-label { font-size: 10pt; font-weight: 700; color: ${accent}; }
  .grand-value { font-size: 11pt; font-weight: 800; color: ${accent}; }
  .balance-row { display: flex; justify-content: space-between; padding: 10px 18px; background: ${accent}; }
  .balance-label { font-size: 10pt; font-weight: 700; color: #fff; }
  .balance-value { font-size: 11pt; font-weight: 800; color: #fff; }
  .words-box { font-size: 8.5pt; color: #666; margin-bottom: 12px; font-style: italic; }
  .notes-head { font-size: 9pt; font-weight: 700; color: #111; margin-bottom: 5px; text-transform: uppercase; letter-spacing: 0.4px; }
  .notes-body { font-size: 8.5pt; color: #777; line-height: 1.7; }
  .sign-area { margin-top: 24px; text-align: right; padding-right: 24px; padding-bottom: 18px; }
  .sign-line { border-top: 1px solid #ccc; width: 160px; margin-left: auto; margin-bottom: 5px; }
  .sign-label { font-size: 8.5pt; color: #888; text-align: center; }
</style>
</head>
<body>
<div class="page">
<div class="invoice-box">

  <!-- Top: Business info + INVOICE title -->
  <div class="top-section">
    <div>
      <div class="biz-name">${prof.name||'My Business'}</div>
      <div class="biz-addr">
        ${prof.address||''}${prof.address?'<br>':''}
        ${prof.phone?'Ph: '+prof.phone:''}${prof.phone&&prof.email?' | ':''}${prof.email||''}${(prof.phone||prof.email)?'<br>':''}
        ${prof.gstin?'GSTIN: '+prof.gstin+'<br>':''}
        ${prof.state?prof.state+(prof.state_code?' ('+prof.state_code+')':''):''}
      </div>
    </div>
    <div>
      <div class="invoice-title">TAX INVOICE</div>
    </div>
  </div>

  <!-- Meta: Invoice#, Date, Terms, Due Date -->
  <div class="meta-section">
    <div class="meta-left">
      <div class="meta-row"><span class="meta-label">Invoice#</span><span class="meta-value">${inv.invoice_number||''}</span></div>
      <div class="meta-row"><span class="meta-label">Invoice Date</span><span class="meta-value">${fmtDate(inv.date)}</span></div>
      ${inv.terms?`<div class="meta-row"><span class="meta-label">Terms</span><span class="meta-value">${inv.terms}</span></div>`:''}
      ${inv.due_date?`<div class="meta-row"><span class="meta-label">Due Date</span><span class="meta-value">${fmtDate(inv.due_date)}</span></div>`:''}
    </div>
    <div class="meta-right">
      ${inv.po_number?`<div class="meta-row"><span class="meta-label">PO Number</span><span class="meta-value">${inv.po_number}</span></div>`:''}
      ${inv.po_date?`<div class="meta-row"><span class="meta-label">PO Date</span><span class="meta-value">${fmtDate(inv.po_date)}</span></div>`:''}
    </div>
  </div>

  <!-- Bill To / Ship To -->
  <div class="addr-section">
    <div class="addr-col">
      <div class="addr-head">Bill To</div>
      <div class="addr-name">${inv.party_name||'Walk-in Customer'}</div>
      <div class="addr-body">
        ${inv.party_address||''}${inv.party_address?'<br>':''}
        ${inv.party_gstin?'GSTIN: '+inv.party_gstin+'<br>':''}
        ${inv.party_state?inv.party_state+(inv.party_state_code?' ('+inv.party_state_code+')':''):''}
      </div>
    </div>
    <div class="addr-col">
      <div class="addr-head">Ship To</div>
      ${!inv.ship_to_same && inv.ship_to_name ? `
        <div class="addr-name">${inv.ship_to_name}</div>
        <div class="addr-body">
          ${inv.ship_to_address||''}${inv.ship_to_address?'<br>':''}
          ${inv.ship_to_gstin?'GSTIN: '+inv.ship_to_gstin:''}
        </div>
      ` : `
        <div class="addr-body" style="color:#aaa;font-style:italic">Same as billing address</div>
      `}
    </div>
  </div>

  <!-- Items table -->
  <div class="items-section">
    <table>
      <thead>
        <tr class="thead-row">
          <th>#</th>
          <th>Item &amp; Description</th>
          <th style="text-align:right;width:60px">Qty</th>
          <th style="text-align:right;width:90px">Rate</th>
          <th style="text-align:right;width:90px">Amount</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <!-- Subtotal row -->
    <div style="display:flex;justify-content:flex-end;padding:10px 8px;border-top:1px solid #ddd;border-bottom:1px solid #ddd;margin-top:0">
      <span style="font-size:9pt;color:#555;margin-right:24px">Sub Total</span>
      <span style="font-size:9.5pt;font-weight:700;color:#111;width:90px;text-align:right">₹${r(inv.subtotal)}</span>
    </div>
  </div>

  <!-- Bottom: Notes left, Totals right -->
  <div class="bottom-section">
    <div class="bottom-left">
      <div class="words-box">${words(inv.total)}</div>
      ${upiBlock ? `<div style="margin-bottom:14px">${upiBlock}</div>` : ''}
      ${bankBlock}
      ${inv.notes||inv.terms?`
        <div style="margin-top:${hasBank||upiBlock?'14px':'0'}">
          <div class="notes-head">Terms &amp; Conditions</div>
          <div class="notes-body">${inv.terms||''}${inv.notes?'<br>'+inv.notes:''}</div>
        </div>
      `:''}
    </div>
    <div class="bottom-right">
      ${inv.discount>0?`<div class="total-row"><span class="total-label">Discount</span><span class="total-value">−₹${r((inv.subtotal||0)-(inv.taxable||0))}</span></div>`:''}
      <div class="total-row"><span class="total-label">Taxable Amount</span><span class="total-value">₹${r(inv.taxable)}</span></div>
      <div class="total-row"><span class="total-label">${taxType}</span><span class="total-value">₹${r(taxAmt)}</span></div>
      <div class="grand-row"><span class="grand-label">Total</span><span class="grand-value">${inr(inv.total)}</span></div>
      <div class="balance-row"><span class="balance-label">Balance Due</span><span class="balance-value">${inr((inv.total||0)-(inv.paid||0))}</span></div>
    </div>
  </div>

  <!-- Signature -->
  <div class="sign-area">
    <div class="sign-line"></div>
    <div class="sign-label">Authorised Signatory</div>
  </div>

</div>
</div>
</body>
</html>`;
}