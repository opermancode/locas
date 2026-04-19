function inr(n){ return '\u20B9'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2}); }
function fmtDate(d){
  if(!d) return '';
  const p=d.split('-');
  if(p.length===3&&p[0].length===4){
    const mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return parseInt(p[2])+' '+mo[parseInt(p[1])-1]+', '+p[0];
  }
  return d;
}
function words(n){
  const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const v=Math.floor(n); if(v===0)return'Zero';
  const two=(x)=>x>=20?tens[Math.floor(x/10)]+(x%10?' '+ones[x%10]:''):ones[x];
  let w='';
  const cr=Math.floor(v/10000000),lk=Math.floor((v%10000000)/100000),th=Math.floor((v%100000)/1000),hu=Math.floor((v%1000)/100),re=v%100;
  if(cr)w+=two(cr)+' Crore ';if(lk)w+=two(lk)+' Lakh ';if(th)w+=two(th)+' Thousand ';if(hu)w+=ones[hu]+' Hundred ';if(re)w+=two(re);
  return w.trim()+' Rupees Only';
}

export default function template6(invoice, profile, accent, upiBlock) {
  accent = accent || '#E85D04';
  upiBlock = upiBlock || '';
  const inv = invoice, prof = profile || {};
  const isInter = inv.supply_type === 'inter';
  const ac = accent;

  const itemRows = (inv.items || []).map(item => `
    <tr class="item-row">
      <td class="col-item">
        <div class="item-name">${item.name}</div>
        ${item.hsn ? `<div class="item-sub">HSN: ${item.hsn}</div>` : ''}
      </td>
      <td class="col-num">${Number(item.qty||0)}</td>
      <td class="col-num">${inr(item.rate)}</td>
      <td class="col-num">${inr(item.total)}</td>
    </tr>
    <tr class="tax-row">
      <td colspan="3" class="tax-detail">
        ${isInter
          ? `IGST @ ${item.gst_rate}%: ${inr(item.igst)}`
          : `CGST @ ${item.gst_rate/2}%: ${inr(item.cgst)} &nbsp;|&nbsp; SGST @ ${item.gst_rate/2}%: ${inr(item.sgst)}`
        }${item.discount>0?` &nbsp;|&nbsp; Discount: ${item.discount}%`:''}
      </td>
      <td></td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  /* ── Page setup: A4 with margins ── */
  @page {
    size: 210mm 297mm;
    margin: 18mm 16mm 18mm 16mm;
  }

  /* ── Print overrides ── */
  @media print {
    html, body {
      width: 210mm;
      height: 297mm;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      background: #fff !important;
    }
    .page {
      box-shadow: none !important;
      padding: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
    }
    /* Prevent orphan rows — keep item + its tax line together */
    .item-row, .tax-row { page-break-inside: avoid; }
    /* Keep totals block together on same page */
    .totals-section { page-break-inside: avoid; }
    /* Footer stays together */
    .footer { page-break-inside: avoid; }
    /* Repeat table headers on every page */
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
  }

  /* ── Reset ── */
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  /* ── Screen: centered preview ── */
  html { background: #e8e8e8; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 11.5px;
    color: #1a1a1a;
    line-height: 1.5;
    /* Screen only — centres the white page card */
    padding: 32px 16px;
  }

  .page {
    background: #fff;
    /* Match A4 content width at 96dpi after 16mm margins each side */
    width: 178mm;
    max-width: 680px;
    margin: 0 auto;
    padding: 14mm 0;          /* top/bottom breathing room on screen */
    box-shadow: 0 4px 40px rgba(0,0,0,0.13);
  }

  /* ── FROM: Business header ── */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 28px;
    padding-bottom: 20px;
    border-bottom: 1px solid #ebebeb;
  }

  .biz-name {
    font-size: 18px;
    font-weight: 700;
    color: #111;
    letter-spacing: -0.2px;
    margin-bottom: 7px;
  }

  .biz-contact {
    font-size: 10.5px;
    color: #666;
    line-height: 1.9;
  }

  .header-right {
    text-align: right;
    font-size: 10.5px;
    color: #666;
    line-height: 1.9;
    max-width: 230px;
  }

  .tax-id { color: #444; font-weight: 600; }

  /* ── Info box ── */
  .info-box {
    border: 1px solid #e0e0e0;
    border-radius: 5px 5px 0 0;
    padding: 18px 22px;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    /* Don't break across pages */
    page-break-inside: avoid;
  }

  .billed-to { flex: 1.4; }
  .bt-label  { font-size: 10px; color: #999; margin-bottom: 5px; }
  .bt-name   { font-size: 13.5px; font-weight: 700; color: #111; margin-bottom: 3px; }
  .bt-addr   { font-size: 10.5px; color: #666; line-height: 1.7; }

  .gstin-badge {
    display: inline-block; margin-top: 5px;
    font-size: 9.5px; color: #777;
    background: #f4f4f4; border-radius: 3px;
    padding: 2px 6px; font-weight: 500;
  }

  .supply-badge {
    display: inline-block; margin-top: 5px;
    font-size: 8.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.4px;
    color: ${ac};
    border: 1px solid ${ac}55;
    border-radius: 3px; padding: 1.5px 5px;
  }

  .inv-meta {
    flex: 1; text-align: center;
    border-left: 1px solid #eaeaea;
    border-right: 1px solid #eaeaea;
    padding: 0 18px;
  }

  .meta-label {
    font-size: 9.5px; color: #aaa;
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-bottom: 4px;
  }

  .inv-number { font-size: 14px; font-weight: 700; color: #111; margin-bottom: 12px; }
  .inv-ref    { font-size: 12px; font-weight: 600; color: #333; }

  .inv-total { flex: 1; text-align: right; }

  .inv-total-amount {
    font-size: 24px; font-weight: 700;
    color: ${ac}; letter-spacing: -0.5px; line-height: 1.1;
  }

  /* ── Date row — welded to bottom of info-box ── */
  .date-row {
    display: flex;
    border: 1px solid #e0e0e0;
    border-top: none;
    border-radius: 0 0 5px 5px;
    margin-bottom: 22px;
    overflow: hidden;
    page-break-inside: avoid;
  }

  .date-cell {
    flex: 1; padding: 10px 22px;
    border-right: 1px solid #eaeaea;
  }
  .date-cell:last-child { border-right: none; }

  .date-label {
    font-size: 9.5px; color: #aaa;
    text-transform: uppercase; letter-spacing: 0.5px;
    margin-bottom: 3px;
  }
  .date-value { font-size: 12.5px; font-weight: 600; color: #111; }

  /* ── Items table ── */
  table {
    width: 100%;
    border-collapse: collapse;
    /* Allow table to break across pages naturally */
    page-break-inside: auto;
  }

  /* Repeat column headers on every printed page */
  thead {
    display: table-header-group;
  }

  thead tr {
    border-bottom: 1.5px solid #e0e0e0;
  }

  th {
    font-size: 9.5px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.6px;
    color: #aaa; padding: 9px 0; text-align: left;
  }

  th.num-head { text-align: right; }

  .col-item { width: 48%; }
  .col-num  { text-align: right; font-size: 12px; color: #111; }

  /* Keep each item + its tax line on the same page */
  .item-row {
    page-break-inside: avoid;
  }
  .item-row td { padding: 14px 0 3px; vertical-align: top; }

  .tax-row {
    page-break-inside: avoid;
  }
  .tax-row td { padding: 2px 0 14px; border-bottom: 1px solid #f0f0f0; }

  .item-name { font-size: 12.5px; font-weight: 700; color: #111; margin-bottom: 2px; }
  .item-sub  { font-size: 10px; color: #aaa; margin-top: 1px; }
  .tax-detail{ font-size: 9.5px; color: #bbb; }

  /* ── Totals section — keep together ── */
  .totals-section {
    page-break-inside: avoid;
    margin-top: 6px;
  }

  .totals-wrap { display: flex; justify-content: flex-end; }
  .totals-inner { width: 280px; }

  .total-row {
    display: flex; justify-content: space-between;
    padding: 5px 0; font-size: 11.5px; color: #555;
    border-bottom: 1px solid #f2f2f2;
  }
  .total-row:last-child { border-bottom: none; }
  .total-row.grand {
    border-top: 1.5px solid #222; border-bottom: none;
    padding: 9px 0 3px; margin-top: 3px;
    font-size: 13.5px; font-weight: 700; color: #111;
  }

  .words-line {
    font-size: 9.5px; color: #bbb; font-style: italic;
    text-align: right; margin-top: 7px; margin-bottom: 0;
  }

  /* ── Footer ── */
  .footer {
    border-top: 1px solid #e8e8e8;
    padding-top: 20px;
    margin-top: 28px;
    page-break-inside: avoid;
  }

  .thanks { font-size: 12.5px; font-weight: 700; color: #111; margin-bottom: 18px; }

  .bank-label {
    font-size: 9.5px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.5px; color: #aaa; margin-bottom: 4px;
  }
  .bank-detail { font-size: 10.5px; color: #555; line-height: 1.8; margin-bottom: 14px; }
  .terms-label { font-size: 10.5px; color: #999; margin-bottom: 3px; }
  .terms-text  { font-size: 10.5px; color: #666; line-height: 1.75; }

  .powered {
    text-align: center; font-size: 8.5px; color: #ddd;
    margin-top: 28px; letter-spacing: 0.8px;
  }
</style>
</head>
<body>
<div class="page">

  <!-- FROM: Business Header -->
  <div class="header">
    <div>
      <div class="biz-name">${prof.name || 'Your Business'}</div>
      <div class="biz-contact">
        ${prof.website ? prof.website + '<br>' : ''}
        ${prof.email   ? prof.email   + '<br>' : ''}
        ${prof.phone   ? prof.phone            : ''}
      </div>
    </div>
    <div class="header-right">
      ${prof.address ? prof.address + '<br>' : ''}
      ${[prof.city, prof.state].filter(Boolean).join(', ')}${prof.pincode ? ' - ' + prof.pincode : ''}<br>
      ${prof.gstin ? `<span class="tax-id">TAX ID ${prof.gstin}</span>` : ''}
      ${prof.pan    ? `<br>PAN: ${prof.pan}` : ''}
    </div>
  </div>

  <!-- Info Box -->
  <div class="info-box">
    <div class="billed-to">
      <div class="bt-label">Billed to,</div>
      <div class="bt-name">${inv.party_name || 'Client Name'}</div>
      <div class="bt-addr">
        ${inv.party_address ? inv.party_address + '<br>' : ''}
        ${inv.party_state ? inv.party_state : ''}
        ${inv.party_phone ? '<br>' + inv.party_phone : ''}
      </div>
      ${inv.party_gstin ? `<div class="gstin-badge">GSTIN: ${inv.party_gstin}</div>` : ''}
      <div class="supply-badge">${isInter ? 'Inter-state \u00b7 IGST' : 'Intra-state \u00b7 CGST+SGST'}</div>
    </div>

    <div class="inv-meta">
      <div class="meta-label">Invoice number</div>
      <div class="inv-number">#${inv.invoice_number}</div>
      ${inv.po_number ? `<div class="meta-label" style="margin-top:2px">Reference</div><div class="inv-ref">${inv.po_number}</div>` : ''}
    </div>

    <div class="inv-total">
      <div class="meta-label">Invoice of (INR)</div>
      <div class="inv-total-amount">${inr(inv.total)}</div>
    </div>
  </div>

  <!-- Date + Subject row -->
  <div class="date-row">
    ${inv.notes ? `<div class="date-cell"><div class="date-label">Subject</div><div class="date-value">${inv.notes}</div></div>` : ''}
    <div class="date-cell">
      <div class="date-label">Invoice date</div>
      <div class="date-value">${fmtDate(inv.date)}</div>
    </div>
    ${inv.due_date ? `<div class="date-cell" style="text-align:right"><div class="date-label">Due date</div><div class="date-value">${fmtDate(inv.due_date)}</div></div>` : ''}
  </div>

  <!-- Items Table -->
  <table>
    <thead>
      <tr>
        <th class="col-item">Item Detail</th>
        <th class="num-head">Qty</th>
        <th class="num-head">Rate</th>
        <th class="num-head">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Totals + words — kept together on same page -->
  <div class="totals-section">
    <div class="totals-wrap">
      <div class="totals-inner">
        <div class="total-row"><span>Subtotal</span><span>${inr(inv.subtotal || inv.taxable)}</span></div>
        ${inv.discount > 0 ? `<div class="total-row"><span>Discount</span><span>-${inr((inv.subtotal||0)-(inv.taxable||0))}</span></div>` : ''}
        <div class="total-row"><span>Taxable amount</span><span>${inr(inv.taxable)}</span></div>
        ${isInter
          ? `<div class="total-row"><span>IGST</span><span>${inr(inv.igst)}</span></div>`
          : `<div class="total-row"><span>CGST</span><span>${inr(inv.cgst)}</span></div>
             <div class="total-row"><span>SGST</span><span>${inr(inv.sgst)}</span></div>`
        }
        <div class="total-row grand"><span>Total</span><span>${inr(inv.total)}</span></div>
      </div>
    </div>
    <div class="words-line">${words(inv.total)}</div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="thanks">Thanks for the business.</div>

    ${prof.bank_name || prof.account_no || prof.upi_id ? `
    <div class="bank-label">Payment Details</div>
    <div class="bank-detail">
      ${prof.bank_name  ? '<strong>' + prof.bank_name + '</strong><br>' : ''}
      ${prof.account_no ? 'A/C: '   + prof.account_no + '<br>'         : ''}
      ${prof.ifsc       ? 'IFSC: '  + prof.ifsc        + '<br>'         : ''}
      ${prof.upi_id     ? 'UPI: '   + prof.upi_id                       : ''}
    </div>` : ''}

    ${upiBlock ? `<div style="margin-top:10px">${upiBlock}</div>` : ''}

    ${inv.terms ? `
    <div class="terms-label">Terms &amp; Conditions</div>
    <div class="terms-text">${inv.terms}</div>` : ''}
  </div>

  <div class="powered">-- Generated by Locas --</div>

</div>
</body>
</html>`;
}
