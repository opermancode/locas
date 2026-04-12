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
  @page { size: A4 portrait; margin: 10mm 14mm; }
  @media print {
    html, body { margin:0!important; padding:0!important;
      -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
    .no-print { display:none!important; }
    .page { box-shadow:none!important; }
  }
  @media screen {
    body { background:#e8eaf0; min-height:100vh; display:flex; flex-direction:column; align-items:center; padding:20px 0; }
    .page { width:210mm; box-shadow:0 4px 24px rgba(0,0,0,0.13); background:#fff; }
  }
`;

export default function template2(invoice, profile, accent='#1E3A6E', upiBlock='') {
  const inv=invoice, prof=profile||{};
  const isInter=inv.supply_type==='inter';
  const hasBank=!!(prof.bank_name||prof.account_no||prof.ifsc);

  // Items as divs — NOT a table, so no thead auto-repeat on page 2
  const itemRows=(inv.items||[]).map((item,i)=>`
    <div class="item-row" style="background:${i%2===0?'#fafafa':'#fff'}">
      <div class="item-num">${i+1}</div>
      <div class="item-desc">
        <div class="item-name">${item.name}</div>
        ${item.hsn?`<div class="item-hsn">HSN: ${item.hsn}</div>`:''}
      </div>
      <div class="item-qty">${r(item.qty)}</div>
      <div class="item-rate">₹${r(item.rate)}</div>
      <div class="item-amt">₹${r(item.total)}</div>
    </div>`).join('');

  const bankBlock = hasBank ? `
    <div style="margin-top:12px">
      <div style="font-size:9pt;font-weight:700;color:#111;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.5px">Bank Details</div>
      ${prof.bank_name?`<div style="font-size:9pt;color:#555">Bank: <b>${prof.bank_name}</b></div>`:''}
      ${prof.account_no?`<div style="font-size:9pt;color:#555">A/C: <b>${prof.account_no}</b></div>`:''}
      ${prof.ifsc?`<div style="font-size:9pt;color:#555">IFSC: <b>${prof.ifsc}</b></div>`:''}
    </div>` : '';

  const taxType = isInter ? 'IGST' : 'CGST + SGST';
  const taxAmt  = isInter ? inv.igst : ((inv.cgst||0) + (inv.sgst||0));

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  ${A4_PRINT_CSS}
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size:10pt; color:#111; }
  .page { padding:24px; }

  /* ── Header table: biz info left, TAX INVOICE right ── */
  .hdr { width:100%; border-collapse:collapse; margin-bottom:0; border:1.5px solid #ccc; border-bottom:none; }
  .hdr td { padding:20px 20px 16px; vertical-align:top; }
  .hdr td:last-child { text-align:right; border-left:1px solid #ddd; }
  .biz-name { font-size:15pt; font-weight:700; color:#111; margin-bottom:4px; }
  .biz-addr { font-size:8.5pt; color:#666; line-height:1.7; }
  .inv-title { font-size:22pt; font-weight:300; color:${accent}; letter-spacing:2px; text-transform:uppercase; }
  .inv-num   { font-size:11pt; font-weight:800; color:#111; margin-top:6px; }
  .inv-date  { font-size:9pt; color:#666; }

  /* ── Meta row: invoice# date PO etc ── */
  .meta { width:100%; border-collapse:collapse; border:1.5px solid #ccc; border-bottom:none; }
  .meta td { padding:10px 20px; font-size:9pt; border-right:1px solid #ddd; vertical-align:top; }
  .meta td:last-child { border-right:none; }
  .meta-lbl { color:#999; font-size:8pt; text-transform:uppercase; letter-spacing:0.4px; margin-bottom:3px; }
  .meta-val { font-weight:700; color:#111; }

  /* ── Bill To / Ship To ── */
  .addr { width:100%; border-collapse:collapse; border:1.5px solid #ccc; border-bottom:none; }
  .addr td { padding:14px 20px; vertical-align:top; border-right:1px solid #ddd; }
  .addr td:last-child { border-right:none; }
  .addr-head { font-size:8pt; color:${accent}; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:7px; }
  .addr-name { font-size:11pt; font-weight:700; color:#111; margin-bottom:4px; }
  .addr-body { font-size:8.5pt; color:#555; line-height:1.8; }
  .same-tag  { display:inline-block; background:${accent}15; color:${accent}; font-size:8pt; font-weight:700; padding:2px 8px; border-radius:3px; margin-top:4px; border:1px solid ${accent}30; }

  /* ── Items header (div, not thead — never repeats) ── */
  .items-outer { border:1.5px solid #ccc; }
  .item-head { display:flex; background:${accent}; padding:9px 8px; }
  .item-head span { font-size:8.5pt; font-weight:700; color:#fff; }
  .item-row { display:flex; padding:9px 8px; border-bottom:1px solid #eee; page-break-inside:avoid; break-inside:avoid; }
  .item-num  { width:36px; font-size:9pt; color:#888; text-align:center; flex-shrink:0; }
  .item-desc { flex:1; font-size:9pt; }
  .item-name { font-weight:600; color:#111; margin-bottom:2px; }
  .item-hsn  { font-size:7.5pt; color:#aaa; }
  .item-qty  { width:60px; text-align:right; font-size:9pt; color:#444; flex-shrink:0; }
  .item-rate { width:90px; text-align:right; font-size:9pt; color:#444; flex-shrink:0; }
  .item-amt  { width:90px; text-align:right; font-size:9pt; font-weight:700; color:#111; flex-shrink:0; }
  .subtotal-row { display:flex; justify-content:flex-end; padding:9px 8px; border-top:2px solid #ddd; gap:24px; }
  .subtotal-lbl { font-size:9pt; color:#555; }
  .subtotal-val { font-size:9.5pt; font-weight:700; color:#111; width:90px; text-align:right; }

  /* ── Bottom section — always on new page if overflows ── */
  .bot { width:100%; border-collapse:collapse; border:1.5px solid #ccc; border-top:2px solid ${accent}; page-break-before:auto; page-break-inside:avoid; break-inside:avoid; margin-top:0; }
  .bot td { vertical-align:top; padding:0; }
  .bot-left  { padding:18px 20px; border-right:1px solid #ddd; }
  .bot-right { width:240px; }
  .words-txt { font-size:8.5pt; color:#555; font-style:italic; margin-bottom:12px; line-height:1.6; }
  .tot-row   { display:flex; justify-content:space-between; padding:8px 16px; font-size:9pt; border-bottom:1px solid #eee; }
  .tot-lbl   { color:#666; }
  .tot-val   { font-weight:600; color:#111; }
  .grand-row { display:flex; justify-content:space-between; padding:10px 16px; background:${accent}15; }
  .grand-lbl { font-size:10pt; font-weight:700; color:${accent}; }
  .grand-val { font-size:10pt; font-weight:800; color:${accent}; }
  .bal-row   { display:flex; justify-content:space-between; padding:10px 16px; background:${accent}; }
  .bal-lbl   { font-size:10pt; font-weight:700; color:#fff; }
  .bal-val   { font-size:10pt; font-weight:800; color:#fff; }
  .sign-area { text-align:center; padding:18px 16px 10px; border-top:1px solid #eee; }
  .sign-line { border-top:1px solid #ccc; width:140px; margin:0 auto 4px; }
  .sign-lbl  { font-size:8pt; color:#999; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <table class="hdr">
    <tr>
      <td>
        <div class="biz-name">${prof.name||'My Business'}</div>
        <div class="biz-addr">
          ${prof.address||''}${prof.address?'<br>':''}
          ${prof.phone?'Ph: '+prof.phone:''}${prof.phone&&prof.email?' | ':''}${prof.email||''}${(prof.phone||prof.email)?'<br>':''}
          ${prof.gstin?'GSTIN: '+prof.gstin+'<br>':''}
          ${prof.state?prof.state+(prof.state_code?' ('+prof.state_code+')':''):''}
        </div>
      </td>
      <td>
        <div class="inv-title">TAX INVOICE</div>
        <div class="inv-num">${inv.invoice_number||''}</div>
        <div class="inv-date">Date: ${fmtDate(inv.date)}</div>
      </td>
    </tr>
  </table>

  <!-- Meta -->
  <table class="meta">
    <tr>
      <td><div class="meta-lbl">Invoice No.</div><div class="meta-val">${inv.invoice_number||''}</div></td>
      <td><div class="meta-lbl">Date</div><div class="meta-val">${fmtDate(inv.date)}</div></td>
      ${inv.due_date?`<td><div class="meta-lbl">Due Date</div><div class="meta-val">${fmtDate(inv.due_date)}</div></td>`:''}
      ${inv.po_number?`<td><div class="meta-lbl">PO Number</div><div class="meta-val">${inv.po_number}</div></td>`:''}
      ${inv.po_date?`<td><div class="meta-lbl">PO Date</div><div class="meta-val">${fmtDate(inv.po_date)}</div></td>`:''}
    </tr>
  </table>

  <!-- Bill To / Ship To -->
  <table class="addr">
    <tr>
      <td>
        <div class="addr-head">Bill To</div>
        <div class="addr-name">${inv.party_name||'Walk-in Customer'}</div>
        <div class="addr-body">
          ${inv.party_address||''}${inv.party_address?'<br>':''}
          ${inv.party_gstin?'GSTIN: '+inv.party_gstin+'<br>':''}
          ${inv.party_state?inv.party_state+(inv.party_state_code?' ('+inv.party_state_code+')':''):''}
        </div>
        <div style="margin-top:5px"><span style="display:inline-block;background:${accent}15;color:${accent};font-size:8pt;font-weight:700;padding:2px 8px;border-radius:3px;border:1px solid ${accent}30">${isInter?'IGST':'CGST+SGST'}</span></div>
      </td>
      <td>
        <div class="addr-head">Ship To</div>
        ${!inv.ship_to_same && inv.ship_to_name ? `
          <div class="addr-name">${inv.ship_to_name}</div>
          <div class="addr-body">
            ${inv.ship_to_address||''}${inv.ship_to_address?'<br>':''}
            ${inv.ship_to_gstin?'GSTIN: '+inv.ship_to_gstin:''}
          </div>
        ` : `<div class="addr-body" style="color:#aaa;font-style:italic">Same as billing address</div>`}
      </td>
    </tr>
  </table>

  <!-- Items — div rows, NOT a table (no thead repeat on page 2) -->
  <div class="items-outer">
    <div class="item-head">
      <span style="width:36px;text-align:center;flex-shrink:0">#</span>
      <span style="flex:1">Item &amp; Description</span>
      <span style="width:60px;text-align:right;flex-shrink:0">Qty</span>
      <span style="width:90px;text-align:right;flex-shrink:0">Rate</span>
      <span style="width:90px;text-align:right;flex-shrink:0">Amount</span>
    </div>
    ${itemRows}
    <div class="subtotal-row">
      <span class="subtotal-lbl">Sub Total</span>
      <span class="subtotal-val">₹${r(inv.subtotal)}</span>
    </div>
  </div>

  <!-- Bottom section — kept together, never splits -->
  <table class="bot">
    <tr>
      <td class="bot-left">
        <div class="words-txt">${words(inv.total)}</div>
        ${upiBlock?`<div style="margin-bottom:12px">${upiBlock}</div>`:''}
        ${bankBlock}
        ${inv.notes||inv.terms?`
          <div style="margin-top:${hasBank||upiBlock?'12px':'0'}">
            <div style="font-size:8.5pt;font-weight:700;color:#111;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">Terms &amp; Conditions</div>
            <div style="font-size:8.5pt;color:#777;line-height:1.7">${inv.terms||''}${inv.notes?'<br>'+inv.notes:''}</div>
          </div>
        `:''}
      </td>
      <td class="bot-right">
        ${inv.discount>0?`<div class="tot-row"><span class="tot-lbl">Discount</span><span class="tot-val">−₹${r((inv.subtotal||0)-(inv.taxable||0))}</span></div>`:''}
        <div class="tot-row"><span class="tot-lbl">Taxable Amount</span><span class="tot-val">₹${r(inv.taxable)}</span></div>
        <div class="tot-row"><span class="tot-lbl">${taxType}</span><span class="tot-val">₹${r(taxAmt)}</span></div>
        <div class="grand-row"><span class="grand-lbl">Total</span><span class="grand-val">${inr(inv.total)}</span></div>
        <div class="bal-row"><span class="bal-lbl">Balance Due</span><span class="bal-val">${inr((inv.total||0)-(inv.paid||0))}</span></div>
        <div class="sign-area">
          <div class="sign-line"></div>
          <div class="sign-lbl">Authorised Signatory</div>
        </div>
      </td>
    </tr>
  </table>

</div>
</body>
</html>`;
}