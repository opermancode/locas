  function r(n){return Number(n||0).toFixed(2);}
  function inr(n){return '₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});}
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

  export default function template3(invoice, profile, accent='#6D28D9', upiBlock='') {
    const inv=invoice, prof=profile||{};
    const isInter=inv.supply_type==='inter';

    // Status color

    const rows=(inv.items||[]).map((item,i)=>`
      <tr class="${i%2===0?'row-alt':''}">
        <td class="tc num">${i+1}</td>
        <td class="tl">
          <span class="iname">${item.name}</span>
          ${item.hsn?`<span class="imeta">HSN: ${item.hsn}</span>`:''}
          ${item.description?`<span class="imeta">${item.description}</span>`:''}
        </td>
        <td class="tc">${item.qty}<br><span class="muted">${item.unit}</span></td>
        <td class="tr">₹${r(item.rate)}</td>
        <td class="tr">${item.discount>0?item.discount+'%':'—'}</td>
        <td class="tr">₹${r(item.taxable)}</td>
        <td class="tc">${item.gst_rate}%</td>
        <td class="tr">
          ${isInter
            ? `₹${r(item.igst)}`
            : `₹${r(item.cgst)}<br><span class="muted">₹${r(item.sgst)}</span>`
          }
        </td>
        <td class="tr amount-col">₹${r(item.total)}</td>
      </tr>`).join('');

    return `<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Tax Invoice — ${inv.invoice_number}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 14mm; }
    @media print {
      html,body { margin:0; padding:0; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .no-print { display:none !important; }
    }
    @media screen {
      body { background:#f0f0f5; min-height:100vh; }
      .page { width:210mm; min-height:277mm; margin:20px auto; box-shadow:0 8px 40px rgba(0,0,0,0.18); }
    }

    *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:'Helvetica Neue',Helvetica,Arial,sans-serif; font-size:9pt; color:#1a1a2e; line-height:1.5; }
    .page { background:#fff; }

    /* ── Top accent bar ── */
    .top-bar { height:5px; background:linear-gradient(90deg, ${accent} 0%, ${accent}99 100%); }

    /* ── Header ── */
    .header { display:flex; justify-content:space-between; align-items:flex-start; padding:18px 20px 14px; border-bottom:1px solid #e8e8f0; }
    .biz-name { font-size:18pt; font-weight:900; color:${accent}; letter-spacing:-0.5px; margin-bottom:3px; }
    .biz-details { font-size:8pt; color:#555; line-height:1.8; }
    .gstin-tag { display:inline-block; margin-top:4px; padding:2px 8px; background:${accent}15; color:${accent}; font-size:7.5pt; font-weight:700; border-radius:3px; border:1px solid ${accent}30; }
    .inv-title { font-size:20pt; font-weight:900; color:#1a1a2e; letter-spacing:3px; text-align:right; }
    .inv-meta { text-align:right; margin-top:6px; }
    .inv-num { font-size:11pt; font-weight:800; color:#1a1a2e; }
    .inv-date { font-size:8.5pt; color:#666; line-height:1.9; }
    .status-pill { display:inline-block; padding:2px 10px; border-radius:12px; font-size:7.5pt; font-weight:800; letter-spacing:0.5px; background:${sc.bg}; color:${sc.txt}; margin-top:3px; }

    /* ── Meta strip ── */
    .meta-strip { display:grid; grid-template-columns:repeat(4,1fr); border:1px solid #e8e8f0; margin:0 20px 12px; border-radius:6px; overflow:hidden; }
    .meta-cell { padding:7px 10px; border-right:1px solid #e8e8f0; }
    .meta-cell:last-child { border-right:none; }
    .meta-cell:nth-child(even) { background:#fafaff; }
    .meta-label { font-size:7pt; font-weight:700; color:${accent}; text-transform:uppercase; letter-spacing:0.6px; margin-bottom:2px; }
    .meta-value { font-size:9pt; font-weight:700; color:#1a1a2e; }

    /* ── Party cards ── */
    .parties { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:0 20px 12px; }
    .party-card { border:1px solid #e8e8f0; border-radius:6px; overflow:hidden; }
    .party-head { padding:6px 12px; background:${accent}; color:#fff; font-size:7.5pt; font-weight:800; text-transform:uppercase; letter-spacing:1px; }
    .party-body { padding:10px 12px; }
    .party-name { font-size:11pt; font-weight:800; color:#1a1a2e; margin-bottom:3px; }
    .party-detail { font-size:8pt; color:#555; line-height:1.8; }
    .supply-tag { display:inline-block; margin-top:4px; padding:2px 8px; border-radius:3px; font-size:7.5pt; font-weight:700; background:${accent}12; color:${accent}; border:1px solid ${accent}25; }

    /* ── Items table ── */
    .table-wrap { margin:0 20px 12px; border:1px solid #e8e8f0; border-radius:6px; overflow:hidden; }
    table { width:100%; border-collapse:collapse; }
    thead tr { background:${accent}; }
    th { padding:7px 6px; font-size:8pt; font-weight:800; color:#fff; text-transform:uppercase; letter-spacing:0.4px; }
    tbody td { padding:7px 6px; font-size:8.5pt; border-bottom:1px solid #f0f0f8; vertical-align:middle; }
    .row-alt td { background:#fafaff; }
    tbody tr:last-child td { border-bottom:none; }
    .tc { text-align:center; }
    .tr { text-align:right; }
    .tl { text-align:left; }
    .num { color:#888; font-size:8pt; }
    .iname { display:block; font-weight:700; color:#1a1a2e; }
    .imeta { display:block; font-size:7.5pt; color:#999; margin-top:1px; }
    .muted { font-size:7.5pt; color:#aaa; }
    .amount-col { font-weight:800; color:${accent}; }

    /* ── Bottom section ── */
    .bottom { display:grid; grid-template-columns:1fr 220px; gap:10px; margin:0 20px 14px; }

    /* Words + notes */
    .words-box { background:${accent}08; border:1px solid ${accent}20; border-radius:5px; padding:8px 10px; margin-bottom:8px; }
    .words-label { font-size:7pt; font-weight:800; color:${accent}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:2px; }
    .words-val { font-style:italic; color:#333; font-size:8.5pt; }
    .notes-box { border-left:3px solid ${accent}; padding:6px 10px; background:#fafaff; font-size:8pt; color:#555; line-height:1.7; border-radius:0 4px 4px 0; margin-bottom:8px; }
    .bank-box { border:1px solid #e8e8f0; border-radius:5px; padding:8px 10px; margin-bottom:8px; }
    .bank-label { font-size:7pt; font-weight:800; color:${accent}; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
    .bank-val { font-size:8.5pt; color:#333; line-height:1.8; }

    /* Totals */
    .totals-wrap { border:1px solid #e8e8f0; border-radius:6px; overflow:hidden; }
    .tot-row { display:flex; justify-content:space-between; padding:5px 10px; font-size:8.5pt; border-bottom:1px solid #f0f0f8; }
    .tot-label { color:#666; }
    .tot-val { font-weight:600; color:#1a1a2e; }
    .tot-muted { color:#999; }
    .grand-row { display:flex; justify-content:space-between; padding:10px 12px; background:${accent}; color:#fff; font-size:12pt; font-weight:900; }

    /* Signature */
    .sign-box { border:1px solid #e8e8f0; border-radius:5px; overflow:hidden; margin-top:8px; }
    .sign-head { padding:5px 10px; background:${accent}10; font-size:7.5pt; font-weight:800; color:${accent}; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid ${accent}18; }
    .sign-body { padding:10px; min-height:55px; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; }
    .sign-seal { width:38px; height:38px; border-radius:50%; border:1.5px dashed ${accent}50; display:flex; align-items:center; justify-content:center; font-size:7px; color:${accent}; text-align:center; font-weight:700; margin-bottom:6px; }
    .sign-line { width:100%; border-top:1px solid #ccc; padding-top:3px; font-size:7.5pt; color:#888; text-align:center; }

    /* Footer */
    .footer { background:${accent}; color:#fff; padding:7px 20px; display:flex; justify-content:space-between; align-items:center; font-size:8pt; font-weight:600; }
    .footer-right { text-align:right; font-size:7.5pt; opacity:0.8; }
  </style>
  </head>
  <body>
  <div class="page">
    <div class="top-bar"></div>

    <!-- Header -->
    <div class="header">
      <div>
        <div class="biz-name">${prof.name||'My Business'}</div>
        <div class="biz-details">
          ${prof.address?prof.address+'<br>':''}
          ${prof.phone?'📞 '+prof.phone+(prof.email?' &nbsp;·&nbsp; ✉ '+prof.email:'')+'<br>':''}
          ${prof.pan?'PAN: '+prof.pan+'<br>':''}
        </div>
        ${prof.gstin?`<span class="gstin-tag">GSTIN: ${prof.gstin}</span>`:''}
      </div>
      <div>
        <div class="inv-title">TAX INVOICE</div>
        <div class="inv-meta">
          <div class="inv-num">${inv.invoice_number}</div>
          <div class="inv-date">
            Date: ${inv.date}<br>
            
          </div>
        </div>
      </div>
    </div>

    <!-- Meta strip -->
    <div class="meta-strip">
      <div class="meta-cell"><div class="meta-label">Invoice No.</div><div class="meta-value">${inv.invoice_number}</div></div>
      <div class="meta-cell"><div class="meta-label">Date</div><div class="meta-value">${inv.date}</div></div>
      <div class="meta-cell"><div class="meta-label">Supply Type</div><div class="meta-value">${isInter?'Inter-state':'Intra-state'}</div></div>
    </div>

    <!-- Parties -->
    <div class="parties">
      <div class="party-card">
        <div class="party-head">Bill To</div>
        <div class="party-body">
          <div class="party-name">${inv.party_name||'Walk-in Customer'}</div>
          <div class="party-detail">
            ${inv.party_address?inv.party_address+'<br>':''}
            ${inv.party_gstin?'GSTIN: '+inv.party_gstin+'<br>':''}
            ${inv.party_state?'State: '+inv.party_state+(inv.party_state_code?' ('+inv.party_state_code+')':''):''}
          </div>
          <span class="supply-tag">${isInter?'🔀 IGST Applicable':'✅ CGST + SGST'}</span>
        </div>
      </div>
      <div class="party-card">
        <div class="party-head">Seller / Supplier</div>
        <div class="party-body">
          <div class="party-name">${prof.name||'My Business'}</div>
          <div class="party-detail">
            ${prof.address?prof.address+'<br>':''}
            ${prof.gstin?'GSTIN: '+prof.gstin+'<br>':''}
            ${prof.state?'State: '+prof.state+(prof.state_code?' ('+prof.state_code+')':''):''}
          </div>
        </div>
      </div>
    </div>

    <!-- Items table -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="tc" style="width:4%">#</th>
            <th class="tl" style="width:26%">Item / Description</th>
            <th class="tc" style="width:8%">Qty</th>
            <th class="tr" style="width:9%">Rate</th>
            <th class="tr" style="width:6%">Disc</th>
            <th class="tr" style="width:10%">Taxable</th>
            <th class="tc" style="width:6%">GST%</th>
            <th class="tr" style="width:13%">${isInter?'IGST':'CGST/SGST'}</th>
            <th class="tr" style="width:10%">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <!-- Bottom: words+notes | totals -->
    <div class="bottom">
      <div>
        <div class="words-box">
          <div class="words-label">Amount in Words</div>
          <div class="words-val">${words(inv.total)}</div>
        </div>
        ${inv.terms||inv.notes?`<div class="notes-box">${[inv.terms,inv.notes].filter(Boolean).join('<br>')}</div>`:''}
        ${upiBlock}
        ${prof.bank_name||prof.account_no?`
        <div class="bank-box">
          <div class="bank-label">Bank Details</div>
          <div class="bank-val">
            ${prof.bank_name?'<strong>'+prof.bank_name+'</strong><br>':''}
            ${prof.account_no?'A/C No: '+prof.account_no+'<br>':''}
            ${prof.ifsc?'IFSC: '+prof.ifsc:''}
          </div>
        </div>`:''}
      </div>

      <div>
        <div class="totals-wrap">
          <div class="tot-row"><span class="tot-label">Subtotal</span><span class="tot-val">${inr(inv.subtotal)}</span></div>
          ${inv.discount>0?`<div class="tot-row"><span class="tot-label tot-muted">Discount</span><span class="tot-val tot-muted">−${inr((inv.subtotal||0)-(inv.taxable||0))}</span></div>`:''}
          <div class="tot-row"><span class="tot-label">Taxable Amount</span><span class="tot-val">${inr(inv.taxable)}</span></div>
          ${isInter
            ? `<div class="tot-row"><span class="tot-label tot-muted">IGST</span><span class="tot-val tot-muted">${inr(inv.igst)}</span></div>`
            : `<div class="tot-row"><span class="tot-label tot-muted">CGST</span><span class="tot-val tot-muted">${inr(inv.cgst)}</span></div>
              <div class="tot-row"><span class="tot-label tot-muted">SGST</span><span class="tot-val tot-muted">${inr(inv.sgst)}</span></div>`
          }
          <div class="grand-row"><span>Grand Total</span><span>${inr(inv.total)}</span></div>
        </div>
        <div class="sign-box">
          <div class="sign-head">For ${prof.name||'My Business'}</div>
          <div class="sign-body">
                      <div class="sign-line">Authorised Signatory</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div>${prof.name||'My Business'}${prof.gstin?' &nbsp;|&nbsp; GSTIN: '+prof.gstin:''}</div>
      <div class="footer-right">Thank you for your business! 🙏</div>
    </div>
  </div>
  </body></html>`;
  }