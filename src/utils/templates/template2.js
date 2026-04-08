  /* ─ helpers ─────────────────────────────────────────────────── */
  function r(n){return Number(n||0).toFixed(2);}
  function inr(n){return '₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});}
  function fmtDate(d){if(!d)return '';const parts=d.split('-');if(parts.length===3&&parts[0].length===4){return`${parts[2]}-${parts[1]}-${parts[0]}`;}return d;}
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

  export default function template2(invoice, profile, accent='#1E40AF', upiBlock='') {
    const inv=invoice, prof=profile||{};
    const isInter=inv.supply_type==='inter';

    // Determine ship-to info
    const shipName    = (!inv.ship_to_same && inv.ship_to_name) ? inv.ship_to_name : (inv.party_name||'');
    const shipAddress = (!inv.ship_to_same && inv.ship_to_address) ? inv.ship_to_address : (inv.party_address||'');
    const shipGstin   = (!inv.ship_to_same && inv.ship_to_gstin) ? inv.ship_to_gstin : (inv.party_gstin||'');
    const shipSame    = inv.ship_to_same !== false;

    const rows=(inv.items||[]).map((item,i)=>`
      <tr>
        <td style="text-align:center;padding:5px 6px;font-size:9pt;border:1px solid #d0d0d0">${i+1}</td>
        <td style="padding:5px 6px;font-size:9pt;border:1px solid #d0d0d0">
          <b>${item.name}</b>${item.hsn?`<br><span style="font-size:8pt;color:#888">HSN/SAC: ${item.hsn}</span>`:''}
        </td>
        <td style="text-align:center;padding:5px 6px;font-size:9pt;border:1px solid #d0d0d0">${item.qty}</td>
        <td style="text-align:center;padding:5px 6px;font-size:9pt;border:1px solid #d0d0d0">${item.unit||'N.A.'}</td>
        <td style="text-align:right;padding:5px 6px;font-size:9pt;border:1px solid #d0d0d0">${r(item.rate)}</td>
        <td style="text-align:center;padding:5px 6px;font-size:9pt;border:1px solid #d0d0d0">${item.discount>0?item.discount+'%':'—'}</td>
        <td style="text-align:center;padding:5px 6px;font-size:9pt;border:1px solid #d0d0d0">${item.gst_rate}%</td>
        <td style="text-align:right;padding:5px 6px;font-size:9pt;border:1px solid #d0d0d0;font-weight:700">${r(item.total)}</td>
      </tr>`).join('');

    return `<!DOCTYPE html>
  <html>
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width">
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    @page { size:A4 portrait; margin:0; }
    @media print {
      html,body { width:210mm; height:297mm; margin:0!important; padding:0!important;
        -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
      .no-print { display:none!important; }
      .page { box-shadow:none!important; }
    }
    @media screen {
      body { background:#e8eaf0; min-height:100vh; display:flex; flex-direction:column; align-items:center; padding:20px 0; }
      .page { width:210mm; min-height:297mm; box-shadow:0 4px 24px rgba(0,0,0,0.13); }
    }
    body { font-family: Arial, Helvetica, sans-serif; font-size:10pt; color:#111; }
    .page {
      background:#fff;
      display:flex;
      flex-direction:column;
      min-height:297mm;
    }

    /* ── Top bar (page info) ── */
    .topbar {
      display:flex; justify-content:space-between; align-items:center;
      padding:5px 14mm;
      border-bottom:1px solid #ccc;
      font-size:8.5pt; color:#444;
    }

    /* ── Business header ── */
    .bizhead {
      padding:10px 14mm 8px;
      display:flex; align-items:flex-start; gap:14px;
      border-bottom:2px solid #111;
    }
    .logo-box {
      width:60px; height:60px; border:1px solid #ccc;
      display:flex; align-items:center; justify-content:center;
      font-size:8pt; color:#999; text-align:center; flex-shrink:0;
      background:#f5f5f5;
    }
    .biz-center { flex:1; text-align:center; }
    .biz-name   { font-size:15pt; font-weight:900; color:#111; margin-bottom:3px; }
    .biz-addr   { font-size:9pt; color:#333; line-height:1.7; }
    .biz-tax    { font-size:9pt; color:#333; margin-top:2px; }

    /* ── Invoice type label ── */
    .inv-type-row {
      text-align:center; font-size:13pt; font-weight:900;
      letter-spacing:2px; padding:6px 14mm;
      border-bottom:1px solid #ccc;
      text-transform:uppercase;
    }

    /* ── Two-column parties+meta ── */
    .meta-parties {
      display:flex; border-bottom:1px solid #ccc;
    }
    .billing-col {
      flex:1; padding:8px 14mm;
      border-right:1px solid #ccc;
    }
    .meta-col {
      width:200px; flex-shrink:0; padding:0;
    }
    .sec-label {
      font-size:8.5pt; font-weight:800; color:#111;
      text-transform:uppercase; letter-spacing:0.5px;
      margin-bottom:4px;
    }
    .party-name { font-size:11pt; font-weight:800; color:#111; margin-bottom:2px; }
    .party-det  { font-size:9pt; color:#444; line-height:1.7; }

    /* meta table inside meta-col */
    .meta-table { width:100%; border-collapse:collapse; height:100%; }
    .meta-table td {
      padding:5px 8px; font-size:9pt; vertical-align:top;
      border-bottom:1px solid #ccc; border-left:1px solid #ccc;
    }
    .meta-table tr:last-child td { border-bottom:none; }
    .meta-lbl { font-weight:800; color:#111; white-space:nowrap; width:1%; }
    .meta-val { color:#333; }

    /* ── Ship To row ── */
    .ship-row {
      padding:6px 14mm;
      border-bottom:1px solid #ccc;
      font-size:9pt; color:#333;
    }
    .ship-inner { display:flex; gap:6px; align-items:flex-start; }
    .ship-label { font-size:8.5pt; font-weight:800; color:#111; text-transform:uppercase; margin-bottom:3px; }

    /* ── Items table ── */
    .items-wrap { padding:0 14mm; flex:1; }
    .items-table { width:100%; border-collapse:collapse; margin-top:8px; border:1px solid #d0d0d0; }
    .items-table thead tr { background:#f0f0f0; }
    .items-table th {
      padding:6px 6px; font-size:9pt; font-weight:800;
      border:1px solid #d0d0d0; text-align:center;
    }
    .items-table th:nth-child(2) { text-align:left; }
    .items-table tbody tr:nth-child(even) { background:#fafafa; }

    /* ── Totals row ── */
    .totals-wrap {
      display:flex; padding:0 14mm 6px; gap:0;
      border-top:1px solid #d0d0d0; margin-top:4px;
    }
    .totals-left { flex:1; padding-top:6px; }
    .words-box { border:1px solid #d0d0d0; padding:5px 8px; margin-bottom:5px; background:#fafafa; }
    .words-lbl { font-size:8pt; font-weight:800; text-transform:uppercase; color:#555; margin-bottom:2px; }
    .words-val { font-size:9pt; font-style:italic; color:#111; line-height:1.5; }
    .settled-box { font-size:9pt; color:#333; padding:4px 0; }
    .totals-right { width:210px; flex-shrink:0; padding-top:6px; }
    .trow { display:flex; justify-content:space-between; padding:3px 8px; font-size:9.5pt; border-bottom:1px solid #f0f0f0; }
    .tm { color:#666; }
    .tgrand { display:flex; justify-content:space-between; padding:7px 8px; font-size:12pt; font-weight:900; background:#111; color:#fff; margin-top:3px; }

    /* ── Bottom section (T&C + Bank + Sign) ── */
    .bottom-section {
      display:flex; border-top:1px solid #ccc; margin-top:4px;
    }
    .tc-col {
      flex:1; padding:8px 14mm;
      border-right:1px solid #ccc; font-size:8.5pt; color:#333; line-height:1.8;
    }
    .tc-title { font-size:9pt; font-weight:800; color:#111; margin-bottom:4px; }
    .bank-sign-col { width:260px; flex-shrink:0; }
    .bank-block {
      padding:8px 10px; border-bottom:1px solid #ccc;
      font-size:9pt; color:#333; line-height:1.9;
    }
    .bank-title { font-size:8.5pt; font-weight:800; color:#111; text-transform:uppercase; margin-bottom:3px; }
    .sign-block {
      padding:8px 10px; display:flex; flex-direction:column;
      align-items:flex-end; min-height:80px; justify-content:space-between;
    }
    .sign-biz { font-size:9pt; font-weight:800; color:#111; }
    .sign-line { font-size:8pt; color:#666; border-top:1px solid #aaa; padding-top:3px; width:100%; text-align:center; margin-top:10px; }

    /* ── Footer ── */
    .footer-bar {
      text-align:center; font-size:8pt; color:#888;
      padding:5px 14mm; border-top:1px solid #eee;
      margin-top:auto;
    }
  </style>
  </head>
  <body>
  <div class="page">

    <!-- Top bar -->
    <div class="topbar">
      <span>Page No. 1 of 1</span>
      <span style="font-weight:800;font-size:9.5pt">${inv.invoice_type==='bill_of_supply'?'BILL OF SUPPLY':'TAX INVOICE'}</span>
      <span>Original Copy</span>
    </div>

    <!-- Business header -->
    <div class="bizhead">
      <div class="logo-box">${prof.logo_url?`<img src="${prof.logo_url}" style="width:56px;height:56px;object-fit:contain">`:'Add<br>Logo'}</div>
      <div class="biz-center">
        <div class="biz-name">${prof.name||'My Business'}</div>
        <div class="biz-addr">${prof.address||'Add Address'}</div>
        <div class="biz-addr">
          ${prof.phone?'Mobile: +91 '+prof.phone:''}
          ${prof.phone&&prof.email?' | ':''}
          ${prof.email?'Email: '+prof.email:''}
        </div>
        <div class="biz-tax">
          ${prof.gstin?'GSTIN - '+prof.gstin:''}
          ${prof.gstin&&prof.pan?' | ':''}
          ${prof.pan?'PAN - '+prof.pan:''}
        </div>
      </div>
    </div>

    <!-- Invoice type label -->
    <div class="inv-type-row">
      ${inv.invoice_type==='bill_of_supply'?'Bill of Supply':'Tax Invoice'}
    </div>

    <!-- Billing + Invoice Meta -->
    <div class="meta-parties">
      <div class="billing-col">
        <div class="sec-label">Billing Details</div>
        <div class="party-name">${inv.party_name||'Walk-in Customer'}</div>
        <div class="party-det">
          ${inv.party_gstin?'GSTIN: '+inv.party_gstin+'<br>':''}
          ${inv.party_address?inv.party_address+'<br>':''}
          ${inv.party_state?'State: '+inv.party_state:''}
        </div>
      </div>
      <div class="meta-col">
        <table class="meta-table">
          <tr><td class="meta-lbl">Invoice Number</td><td class="meta-val">${inv.invoice_number||''}</td></tr>
          <tr><td class="meta-lbl">Invoice Date</td><td class="meta-val">${fmtDate(inv.date)}</td></tr>
          ${inv.due_date?`<tr><td class="meta-lbl">Due Date</td><td class="meta-val">${fmtDate(inv.due_date)}</td></tr>`:''}
          ${inv.po_number?`<tr><td class="meta-lbl">PO Number</td><td class="meta-val">${inv.po_number}</td></tr>`:''}
          <tr><td class="meta-lbl">GST Type</td><td class="meta-val">${isInter?'IGST (Inter)':'CGST+SGST'}</td></tr>
        </table>
      </div>
    </div>

    <!-- Ship To -->
    <div class="ship-row">
      <div class="ship-label">Ship To</div>
      <div class="ship-inner">
        <span style="font-weight:700">${shipName}</span>
        ${shipAddress?'<span style="color:#666;margin-left:8px">'+shipAddress+'</span>':''}
        ${shipGstin?'<span style="color:#666;margin-left:8px">GSTIN: '+shipGstin+'</span>':''}
        ${shipSame?'<span style="font-size:8pt;color:#888;margin-left:8px;font-style:italic">(Same as billing)</span>':''}
      </div>
    </div>

    <!-- Items table -->
    <div class="items-wrap">
      <table class="items-table">
        <thead>
          <tr>
            <th style="width:4%">Sr.</th>
            <th style="width:30%;text-align:left">Item Description</th>
            <th style="width:6%">Qty</th>
            <th style="width:6%">Unit</th>
            <th style="width:10%;text-align:right">List Price</th>
            <th style="width:6%">Disc.</th>
            <th style="width:6%">Tax %</th>
            <th style="width:10%;text-align:right">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <!-- Totals -->
    <div class="totals-wrap">
      <div class="totals-left">
        <div class="words-box">
          <div class="words-lbl">Amount in Words</div>
          <div class="words-val">${words(inv.total)}</div>
        </div>
        ${inv.paid>0?`<div class="settled-box"><b>Settled by - Bank: ${r(inv.paid)} &nbsp;|&nbsp; Invoice Balance: ${r((inv.total||0)-(inv.paid||0))}</b></div>`:''}
        ${upiBlock}
      </div>
      <div class="totals-right">
        <div class="trow"><span>Subtotal</span><span>${inr(inv.subtotal)}</span></div>
        ${inv.discount>0?`<div class="trow tm"><span>Discount</span><span>− ${inr((inv.subtotal||0)-(inv.taxable||0))}</span></div>`:''}
        <div class="trow"><span>Taxable Amount</span><span>${inr(inv.taxable)}</span></div>
        ${isInter
          ?`<div class="trow tm"><span>IGST</span><span>${inr(inv.igst)}</span></div>`
          :`<div class="trow tm"><span>CGST</span><span>${inr(inv.cgst)}</span></div>
            <div class="trow tm"><span>SGST</span><span>${inr(inv.sgst)}</span></div>`
        }
        <div class="tgrand"><span>Total</span><span>${inr(inv.total)}</span></div>
      </div>
    </div>

    <!-- Bottom: T&C + Bank + Signature -->
    <div class="bottom-section">
      <div class="tc-col">
        <div class="tc-title">Terms and Conditions</div>
        ${inv.terms||'E &amp; O.E'}
        ${inv.notes?'<br>'+inv.notes:''}
        ${!inv.terms&&!inv.notes?`
          <br>1. Goods once sold will not be taken back.
          <br>2. Interest @ 18% p.a. will be charged if payment is not made within the stipulated time.
          <br>3. Subject to local jurisdiction only.
        `:''}
      </div>
      <div class="bank-sign-col">
        ${prof.bank_name||prof.account_no?`
        <div class="bank-block">
          <div class="bank-title">Bank Details</div>
          ${prof.account_no?'<b>Account Number:</b> '+prof.account_no+'<br>':''}
          ${prof.bank_name?'<b>Bank:</b> '+prof.bank_name+'<br>':''}
          ${prof.ifsc?'<b>IFSC:</b> '+prof.ifsc+'<br>':''}
          ${prof.branch?'<b>Branch:</b> '+prof.branch+'<br>':''}
          ${prof.account_name||prof.name?'<b>Name:</b> '+(prof.account_name||prof.name):''}
        </div>
        `:''}
        <div class="sign-block">
          <div class="sign-biz">For ${prof.name||'My Business'}</div>
          <div class="sign-line">Signature</div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer-bar">
      Invoice Created by <b>${prof.name||'Locas'}</b>
    </div>

  </div>
  </body>
  </html>`;
  }
