function r(n){return Number(n||0).toFixed(2);}
function inr(n){return '₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});}
function words(amount){
  const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const n=Math.floor(amount); if(n===0)return'Zero';
  const two=(x)=>x>=20?tens[Math.floor(x/10)]+(x%10?' '+ones[x%10]:''):ones[x];
  let w='';
  const cr=Math.floor(n/10000000),lk=Math.floor((n%10000000)/100000),th=Math.floor((n%100000)/1000),hu=Math.floor((n%1000)/100),re=n%100;
  if(cr)w+=two(cr)+' Crore ';if(lk)w+=two(lk)+' Lakh ';if(th)w+=two(th)+' Thousand ';if(hu)w+=ones[hu]+' Hundred ';if(re)w+=two(re);
  return w.trim()+' Rupees Only';
}

/**
 * Thermal receipt template
 *
 * Print settings:
 *   • Paper size: 80mm wide (or 58mm — set @page width accordingly)
 *   • Margins: None / Minimum
 *   • Scale: 100% (do NOT use "Fit to page")
 *   • Headers/footers: OFF
 *
 * The receipt is continuous-length (no fixed height) — thermal printers
 * cut at the end of content, not at a fixed page boundary.
 *
 * Two sizes supported via URL param ?size=58 or ?size=80 (default 80mm).
 * The buildHTML caller can pass a size option; for now we default to 80mm.
 */
export default function template5(invoice, profile, accent='#111111', upiBlock='') {
  const inv=invoice, prof=profile||{};
  const isInter=inv.supply_type==='inter';
  const balance=(inv.total||0)-(inv.paid||0);

  // Default thermal width. 80mm is the most common POS printer.
  // printable area ≈ 72mm (80mm roll - 4mm each side margin at printer)
  // 58mm roll → printable ≈ 50mm
  const W = '72mm';

  const rows=(inv.items||[]).map(item=>`
    <div class="iname">${item.name}</div>
    <div class="irow">
      <span>${item.qty} ${item.unit} × ₹${r(item.rate)}</span>
      <span>₹${r(item.total)}</span>
    </div>
    ${item.discount>0?`<div class="isub">Discount: ${item.discount}%  −₹${r((item.rate*item.qty)-(item.taxable||item.total))}</div>`:''}
    <div class="isub">${isInter?'IGST '+item.gst_rate+'%: ₹'+r(item.igst):'CGST '+item.gst_rate/2+'%: ₹'+r(item.cgst)+' | SGST '+item.gst_rate/2+'%: ₹'+r(item.sgst)}</div>
    <div class="dot"></div>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  /*
   * THERMAL RECEIPT — 80mm roll (72mm printable)
   * Print: Paper = 80mm, Scale = 100%, Margins = None, Headers/Footers = OFF
   * For 58mm: change @page size to 58mm and width to 48mm
   */
  @page {
    size: 80mm auto;   /* width fixed, height auto-grows with content */
    margin: 0;
  }
  @media print {
    html, body {
      width: 80mm;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
  @media screen {
    body { background: #ccc; padding: 16px 0; display: flex; justify-content: center; }
  }

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11pt;
    color: #000;
    background: #fff;
    width: 80mm;
  }

  .receipt {
    width: ${W};
    margin: 0 auto;
    padding: 8px 0 12px;
  }

  /* Text helpers */
  .c  { text-align: center; }
  .r  { text-align: right;  }
  .b  { font-weight: 700;   }

  /* Dividers */
  .d  { border-top: 1px dashed #000; margin: 6px 0; }
  .ds { border-top: 2px solid  #000; margin: 6px 0; }
  .dot{ border-top: 1px dotted #555; margin: 4px 0; }

  /* Business header */
  .brand    { font-size: 15pt; font-weight: 700; text-align: center; letter-spacing: 2px; margin-bottom: 3px; }
  .bsub     { font-size: 8.5pt; text-align: center; color: #222; line-height: 1.7; margin-bottom: 4px; }
  .gstin    { font-size: 8pt;   text-align: center; color: #444; margin-bottom: 2px; }

  /* Invoice title */
  .title    { font-size: 10pt;  text-align: center; font-weight: 700; letter-spacing: 3px; margin: 6px 0 2px; }
  .inum     { font-size: 13pt;  text-align: center; font-weight: 700; margin-bottom: 2px; }
  .imeta    { font-size: 8.5pt; text-align: center; color: #333; line-height: 1.7; }
  .badge    { display: inline-block; border: 1.5px solid #000; padding: 1px 7px; font-size: 8.5pt; font-weight: 700; letter-spacing: 1px; }

  /* Party */
  .plab     { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
  .pname    { font-size: 12pt;  font-weight: 700; }
  .pdet     { font-size: 8.5pt; color: #333; line-height: 1.65; }

  /* Items */
  .iheader  { display: flex; justify-content: space-between; font-size: 8.5pt; font-weight: 700; text-transform: uppercase; margin-bottom: 3px; }
  .iname    { font-size: 10.5pt; font-weight: 700; margin-top: 5px; }
  .irow     { display: flex; justify-content: space-between; font-size: 10.5pt; margin: 2px 0; }
  .isub     { font-size: 8pt; color: #555; margin-top: 1px; }

  /* Totals */
  .trow     { display: flex; justify-content: space-between; font-size: 10.5pt; padding: 2px 0; }
  .tmuted   { color: #555; }
  .tbold    { font-weight: 700; }
  .tgrand   { display: flex; justify-content: space-between; font-size: 14pt; font-weight: 700; padding: 4px 0; border-top: 2px solid #000; margin-top: 3px; }
  .tbal     { display: flex; justify-content: space-between; font-size: 12pt; font-weight: 700; padding: 3px 0; }

  /* Amount in words */
  .words    { font-size: 8pt; font-style: italic; color: #333; line-height: 1.6; margin: 4px 0; }

  /* Bank / payment */
  .pay-head { font-size: 8.5pt; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
  .pay-det  { font-size: 8.5pt; color: #333; line-height: 1.7; }

  /* Footer */
  .ty       { text-align: center; font-size: 12pt; font-weight: 700; letter-spacing: 2px; margin: 8px 0 3px; }
  .footer   { text-align: center; font-size: 8pt; color: #555; line-height: 1.7; }

  /* Powered by */
  .powered  { text-align: center; font-size: 7.5pt; color: #aaa; margin-top: 8px; letter-spacing: 1px; }
</style>
</head>
<body>
<div class="receipt">

  <!-- Business header -->
  <div class="brand">${(prof.name||'MY BUSINESS').toUpperCase()}</div>
  <div class="bsub">
    ${prof.address?prof.address+'<br>':''}
    ${prof.phone?'Tel: '+prof.phone:''}${prof.email?'<br>'+prof.email:''}
  </div>
  ${prof.gstin?`<div class="gstin">GSTIN: ${prof.gstin}</div>`:''}
  ${prof.pan?`<div class="gstin">PAN: ${prof.pan}</div>`:''}

  <div class="ds"></div>

  <!-- Invoice header -->
  <div class="title">*** TAX INVOICE ***</div>
  <div class="inum">${inv.invoice_number}</div>
  <div class="imeta">
    Date: ${inv.date}${inv.due_date?'  |  Due: '+inv.due_date:''}<br>
    <span class="badge">${(inv.status||'UNPAID').toUpperCase()}</span>
  </div>

  <div class="d"></div>

  <!-- Party -->
  <div class="plab">Bill To:</div>
  <div class="pname">${inv.party_name||'Walk-in Customer'}</div>
  <div class="pdet">
    ${inv.party_address?inv.party_address+'<br>':''}
    ${inv.party_gstin?'GSTIN: '+inv.party_gstin+'<br>':''}
    ${inv.party_state?'State: '+inv.party_state:''}
  </div>
  <div style="font-size:8pt;margin-top:3px">Supply: ${isInter?'Inter-state (IGST)':'Intra-state (CGST+SGST)'}</div>

  <div class="d"></div>

  <!-- Items -->
  <div class="iheader"><span>Item</span><span>Amount</span></div>
  <div class="dot"></div>
  ${rows}

  <div class="ds"></div>

  <!-- Totals -->
  <div class="trow"><span>Subtotal</span><span>${inr(inv.subtotal)}</span></div>
  ${inv.discount>0?`<div class="trow tmuted"><span>Discount</span><span>−${inr((inv.subtotal||0)-(inv.taxable||0))}</span></div>`:''}
  <div class="trow"><span>Taxable Amount</span><span>${inr(inv.taxable)}</span></div>
  ${isInter
    ?`<div class="trow tmuted"><span>IGST</span><span>${inr(inv.igst)}</span></div>`
    :`<div class="trow tmuted"><span>CGST</span><span>${inr(inv.cgst)}</span></div>
      <div class="trow tmuted"><span>SGST</span><span>${inr(inv.sgst)}</span></div>`
  }

  <div class="tgrand"><span>TOTAL</span><span>${inr(inv.total)}</span></div>

  ${inv.paid>0?`<div class="trow tmuted"><span>Amount Paid</span><span>${inr(inv.paid)}</span></div>`:''}
  ${balance>0.01?`<div class="tbal"><span>BALANCE DUE</span><span>${inr(balance)}</span></div>`:''}

  <!-- Amount in words -->
  <div class="d"></div>
  <div class="words">In words: ${words(inv.total)}</div>

  <!-- Bank / Payment -->
  ${prof.bank_name||prof.account_no||prof.upi_id?`
  <div class="d"></div>
  <div class="pay-head">Payment Details</div>
  <div class="pay-det">
    ${prof.bank_name?'<b>'+prof.bank_name+'</b><br>':''}
    ${prof.account_no?'A/C: '+prof.account_no+'<br>':''}
    ${prof.ifsc?'IFSC: '+prof.ifsc+'<br>':''}
    ${prof.upi_id?'UPI: '+prof.upi_id:''}
  </div>`:''}

  ${upiBlock}

  <!-- Notes / Terms -->
  ${inv.notes?`<div class="d"></div><div class="plab">Note:</div><div class="pay-det">${inv.notes}</div>`:''}
  ${inv.terms?`<div class="d"></div><div class="pay-det">${inv.terms}</div>`:''}

  <div class="d"></div>

  <!-- Footer -->
  <div class="ty">** THANK YOU **</div>
  <div class="footer">
    Visit us again!<br>
    ${prof.name?prof.name:''}
  </div>

  <div class="powered">— Powered by Locas —</div>

</div>
</body>
</html>`;
}
