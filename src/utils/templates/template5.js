function inr(n){ return '\u20B9'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2}); }
function r(n){ return Number(n||0).toFixed(2); }
function fmtDate(d){
  if(!d) return '';
  const p=d.split('-');
  if(p.length===3&&p[0].length===4) return p[2]+'-'+p[1]+'-'+p[0];
  return d;
}
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

export default function template5(invoice, profile, accent, upiBlock) {
  upiBlock = upiBlock || '';
  const inv = invoice, prof = profile || {};
  const isInter = inv.supply_type === 'inter';

  const line = '--------------------------------';

  const itemRows = (inv.items || []).map(item => {
    const taxLine = isInter
      ? `IGST@${item.gst_rate}%: ${r(item.igst)}`
      : `CGST@${item.gst_rate/2}%:${r(item.cgst)} SGST@${item.gst_rate/2}%:${r(item.sgst)}`;
    return `
      <tr class="item-row">
        <td class="item-name-cell">
          <div class="item-name">${item.name}</div>
          ${item.hsn?`<div class="item-small">HSN:${item.hsn}</div>`:''}
          <div class="item-small">${item.qty} ${item.unit||'pcs'} x ${inr(item.rate)}</div>
          <div class="item-small tax-line">${taxLine}${item.discount>0?' Disc:'+item.discount+'%':''}</div>
        </td>
        <td class="item-amt">${inr(item.total)}</td>
      </tr>
      <tr><td colspan="2"><div class="item-sep"></div></td></tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  /* Thermal: continuous roll — NO fixed page height, NO A4 */
  @page {
    size: 80mm auto;
    margin: 4mm 4mm;
  }
  @media print {
    html, body {
      width: 80mm;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .no-print { display: none; }
  }

  *, *::before, *::after { margin:0; padding:0; box-sizing:border-box; }

  html, body {
    background: #fff;
    width: 80mm;
  }

  body {
    font-family: 'Courier New', Courier, monospace;
    font-size: 11px;
    color: #000;
    line-height: 1.5;
    /* Screen preview: centre the receipt */
    display: flex;
    justify-content: center;
    padding: 16px;
    background: #e8e8e8;
  }

  .receipt {
    width: 72mm;
    background: #fff;
    padding: 8px 6px 12px;
    box-shadow: 0 2px 12px rgba(0,0,0,0.15);
  }

  /* ── Header ── */
  .biz-name {
    font-size: 15px;
    font-weight: bold;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 2px;
  }
  .biz-sub {
    font-size: 10px;
    text-align: center;
    color: #333;
    line-height: 1.6;
    margin-bottom: 4px;
  }
  .gstin {
    font-size: 10px;
    text-align: center;
    font-weight: bold;
    margin-bottom: 2px;
  }

  .dashed { border-top: 1px dashed #000; margin: 5px 0; }
  .solid  { border-top: 1px solid #000;  margin: 5px 0; }
  .double { border-top: 3px double #000; margin: 5px 0; }

  /* ── Invoice header ── */
  .inv-title {
    font-size: 12px;
    font-weight: bold;
    text-align: center;
    letter-spacing: 1px;
    margin: 3px 0;
  }
  .inv-num {
    font-size: 13px;
    font-weight: bold;
    text-align: center;
    margin-bottom: 2px;
  }
  .inv-meta {
    font-size: 10px;
    text-align: center;
    color: #333;
  }

  /* ── Status badge ── */
  .status-badge {
    display: inline-block;
    border: 1px solid #000;
    padding: 1px 6px;
    font-size: 9px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  .status-wrap { text-align: center; margin: 3px 0; }

  /* ── Bill To ── */
  .section-label {
    font-size: 9px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #555;
    margin-bottom: 1px;
  }
  .party-name { font-size: 12px; font-weight: bold; }
  .party-sub  { font-size: 10px; color: #333; }

  /* ── Items table ── */
  table { width: 100%; border-collapse: collapse; }

  .col-header {
    font-size: 9px;
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    padding: 2px 0;
  }
  .col-header-amt { text-align: right; }

  .item-name-cell { width: 75%; padding: 2px 0; vertical-align: top; }
  .item-amt       { width: 25%; text-align: right; vertical-align: top; padding: 2px 0; font-weight: bold; font-size: 11px; }
  .item-name  { font-size: 11px; font-weight: bold; }
  .item-small { font-size: 9px; color: #444; }
  .tax-line   { color: #666; }
  .item-sep   { border-top: 1px dotted #ccc; margin: 2px 0; }

  /* ── Totals ── */
  .total-row {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    padding: 1px 0;
  }
  .total-row.grand {
    font-size: 14px;
    font-weight: bold;
    padding: 3px 0;
  }
  .total-row.muted { color: #555; font-size: 10px; }

  /* ── Words ── */
  .words {
    font-size: 9px;
    font-style: italic;
    color: #555;
    text-align: center;
    margin: 3px 0;
    line-height: 1.4;
  }

  /* ── Footer ── */
  .bank-label { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.4px; color: #555; }
  .bank-det   { font-size: 10px; line-height: 1.7; }
  .terms-txt  { font-size: 9px; color: #555; line-height: 1.5; }
  .thank-you  { font-size: 12px; font-weight: bold; text-align: center; letter-spacing: 1px; margin: 4px 0 2px; }
  .visit-again{ font-size: 10px; text-align: center; color: #444; }
  .powered    { font-size: 9px; text-align: center; color: #aaa; margin-top: 6px; letter-spacing: 0.5px; }
</style>
</head>
<body>
<div class="receipt">

  <!-- Business Name -->
  <div class="biz-name">${prof.name || 'YOUR BUSINESS'}</div>
  <div class="biz-sub">
    ${prof.address ? prof.address + '<br>' : ''}
    ${[prof.city, prof.state].filter(Boolean).join(', ')}${prof.pincode ? ' - ' + prof.pincode : ''}
    ${prof.phone ? '<br>' + prof.phone : ''}
    ${prof.email ? '<br>' + prof.email : ''}
  </div>
  ${prof.gstin ? `<div class="gstin">GSTIN: ${prof.gstin}</div>` : ''}

  <div class="dashed"></div>

  <!-- Invoice Title + Number -->
  <div class="inv-title">*** TAX INVOICE ***</div>
  <div class="inv-num">${inv.invoice_number}</div>
  <div class="inv-meta">Date: ${fmtDate(inv.date)}${inv.due_date ? ' | Due: '+fmtDate(inv.due_date) : ''}</div>
  ${inv.po_number ? `<div class="inv-meta">PO: ${inv.po_number}</div>` : ''}

  <div class="status-wrap">
    <span class="status-badge">${(inv.status||'unpaid').toUpperCase()}</span>
  </div>

  <div class="dashed"></div>

  <!-- Bill To -->
  <div class="section-label">BILL TO:</div>
  <div class="party-name">${inv.party_name || 'Walk-in Customer'}</div>
  ${inv.party_address ? `<div class="party-sub">${inv.party_address}</div>` : ''}
  ${inv.party_state ? `<div class="party-sub">State: ${inv.party_state}</div>` : ''}
  ${inv.party_gstin ? `<div class="party-sub">GSTIN: ${inv.party_gstin}</div>` : ''}
  <div class="party-sub">Supply: ${isInter ? 'Inter-state (IGST)' : 'Intra-state (CGST+SGST)'}</div>

  ${!inv.ship_to_same && inv.ship_to_name ? `
  <div class="dashed"></div>
  <div class="section-label">SHIP TO:</div>
  <div class="party-name">${inv.ship_to_name}</div>
  ${inv.ship_to_address ? `<div class="party-sub">${inv.ship_to_address}</div>` : ''}
  ` : `
  <div class="dashed"></div>
  <div class="section-label">SHIP TO:</div>
  <div class="party-name">${inv.party_name || 'Walk-in Customer'}</div>
  <div class="party-sub">Same as billing address</div>
  `}

  <div class="dashed"></div>

  <!-- Items -->
  <table>
    <thead>
      <tr>
        <th class="col-header" style="text-align:left">ITEM</th>
        <th class="col-header col-header-amt">AMOUNT</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <div class="solid"></div>

  <!-- Totals -->
  <div class="total-row muted"><span>Subtotal</span><span>${inr(inv.subtotal || inv.taxable)}</span></div>
  ${inv.discount > 0 ? `<div class="total-row muted"><span>Discount</span><span>-${inr((inv.subtotal||0)-(inv.taxable||0))}</span></div>` : ''}
  <div class="total-row muted"><span>Taxable Amount</span><span>${inr(inv.taxable)}</span></div>
  ${isInter
    ? `<div class="total-row muted"><span>IGST</span><span>${inr(inv.igst)}</span></div>`
    : `<div class="total-row muted"><span>CGST</span><span>${inr(inv.cgst)}</span></div>
       <div class="total-row muted"><span>SGST</span><span>${inr(inv.sgst)}</span></div>`
  }

  <div class="double"></div>
  <div class="total-row grand"><span>TOTAL</span><span>${inr(inv.total)}</span></div>
  <div class="double"></div>

  <div class="words">In words: ${words(inv.total)}</div>

  <div class="dashed"></div>

  <!-- Payment Details -->
  ${prof.bank_name || prof.account_no || prof.upi_id ? `
  <div class="bank-label">PAYMENT DETAILS</div>
  <div class="bank-det">
    ${prof.bank_name  ? prof.bank_name + '<br>' : ''}
    ${prof.account_no ? 'A/C: ' + prof.account_no + '<br>' : ''}
    ${prof.ifsc       ? 'IFSC: ' + prof.ifsc + '<br>' : ''}
    ${prof.upi_id     ? 'UPI: ' + prof.upi_id : ''}
  </div>
  <div class="dashed"></div>
  ` : ''}

  ${upiBlock ? `<div style="text-align:center;margin:4px 0">${upiBlock}</div><div class="dashed"></div>` : ''}

  <!-- Terms -->
  ${inv.terms ? `<div class="terms-txt">${inv.terms}</div><div class="dashed"></div>` : ''}

  <!-- Thank You -->
  <div class="thank-you">** THANK YOU **</div>
  <div class="visit-again">Visit us again!</div>
  <div class="visit-again">${prof.name || ''}</div>

  <div class="powered">- Powered by Locas -</div>

</div>
</body>
</html>`;
}