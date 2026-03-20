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

export default function template1(invoice, profile, accent='#1E40AF', upiBlock='') {
  const inv=invoice, prof=profile||{};
  const isInter=inv.supply_type==='inter';
  const balance=(inv.total||0)-(inv.paid||0);

  const rows=(inv.items||[]).map((item,i)=>`
    <tr style="background:${i%2===0?'#F0F4FF':'#fff'}">
      <td style="text-align:center;padding:7px 6px;font-size:10px;border-bottom:1px solid #F0F0F0">${i+1}</td>
      <td style="padding:7px 6px;font-size:10px;border-bottom:1px solid #F0F0F0"><b>${item.name}</b>${item.hsn?`<br><span style="font-size:9px;color:#999">HSN: ${item.hsn}</span>`:''}</td>
      <td style="text-align:center;padding:7px 6px;font-size:10px;border-bottom:1px solid #F0F0F0">${item.qty} <span style="font-size:9px;color:#999">${item.unit}</span></td>
      <td style="text-align:right;padding:7px 6px;font-size:10px;border-bottom:1px solid #F0F0F0">₹${r(item.rate)}</td>
      <td style="text-align:right;padding:7px 6px;font-size:10px;border-bottom:1px solid #F0F0F0">${item.discount>0?item.discount+'%':'—'}</td>
      <td style="text-align:right;padding:7px 6px;font-size:10px;border-bottom:1px solid #F0F0F0">₹${r(item.taxable)}</td>
      <td style="text-align:center;padding:7px 6px;font-size:10px;border-bottom:1px solid #F0F0F0">${item.gst_rate}%</td>
      <td style="text-align:right;padding:7px 6px;font-size:10px;border-bottom:1px solid #F0F0F0">${isInter?'₹'+r(item.igst):'₹'+r(item.cgst)+'<br><span style="font-size:9px;color:#999">₹'+r(item.sgst)+'</span>'}</td>
      <td style="text-align:right;padding:7px 6px;font-size:10px;border-bottom:1px solid #F0F0F0;font-weight:700">₹${r(item.total)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }

  body {
    font-family: Arial, sans-serif;
    font-size: 11px;
    color: #111;
    background: #fff;
  }

  .page {
    padding: 22px 24px;
    border-left: 8px solid ${accent};
    min-height: 100vh;
  }

  /* ── Top header ── */
  .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 14px;
    padding-bottom: 12px;
    border-bottom: 2px solid ${accent};
  }
  .biz-name   { font-size: 18px; font-weight: 800; color: #111; margin-bottom: 4px; }
  .biz-detail { font-size: 10px; color: #555; line-height: 1.8; }
  .inv-label  { font-size: 26px; font-weight: 900; color: ${accent}; letter-spacing: 3px; text-align: right; }
  .inv-meta   { text-align: right; font-size: 10px; color: #555; line-height: 1.8; margin-top: 4px; }
  .inv-num    { font-size: 13px; font-weight: 800; color: #111; }

  .badge { display:inline-block; padding:2px 10px; border-radius:3px; font-size:9px; font-weight:700; }
  .paid    { background:#D1FAE5; color:#065F46; }
  .unpaid  { background:#FEE2E2; color:#991B1B; }
  .partial { background:#FEF3C7; color:#92400E; }

  /* ── Meta bar ── */
  .mbar {
    display: flex;
    border: 1px solid ${accent}33;
    margin-bottom: 12px;
    border-radius: 3px;
    overflow: hidden;
  }
  .mc {
    flex: 1;
    padding: 6px 10px;
    border-right: 1px solid ${accent}22;
  }
  .mc:last-child { border-right: none; }
  .mc:nth-child(odd) { background: ${accent}08; }
  .ml { font-size: 9px; color: #888; text-transform: uppercase; margin-bottom: 2px; }
  .mv { font-size: 11px; font-weight: 700; color: #111; }

  /* ── Parties ── */
  .parties {
    display: flex;
    border: 1px solid ${accent}33;
    margin-bottom: 12px;
  }
  .pc { flex: 1; padding: 10px 12px; }
  .pc + .pc { border-left: 1px solid ${accent}22; }
  .ph {
    font-size: 9px; font-weight: 800; color: ${accent};
    text-transform: uppercase; letter-spacing: 1px;
    padding-bottom: 4px; margin-bottom: 6px;
    border-bottom: 1px solid ${accent}33;
  }
  .pn { font-size: 13px; font-weight: 800; color: #111; margin-bottom: 2px; }
  .pd { font-size: 10px; color: #555; line-height: 1.7; }
  .stag {
    display: inline-block;
    background: ${accent}15; color: ${accent};
    font-size: 9px; font-weight: 700;
    padding: 2px 8px; border-radius: 3px;
    margin-top: 4px; border: 1px solid ${accent}33;
  }

  /* ── Table ── */
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  thead tr { background: ${accent}; color: #fff; }
  th { padding: 7px 6px; font-size: 10px; font-weight: 700; text-align: left; }

  /* ── Bottom ── */
  .bot { display: flex; gap: 10px; margin-bottom: 10px; }
  .notes { flex: 1; }

  .wbox {
    background: ${accent}08;
    border: 1px solid ${accent}22;
    padding: 7px 10px;
    border-radius: 3px;
    margin-bottom: 6px;
  }
  .wl { font-size: 9px; font-weight: 700; color: ${accent}; text-transform: uppercase; margin-bottom: 2px; }
  .wv { font-style: italic; color: #333; font-size: 10px; line-height: 1.5; }

  .tcbox {
    background: #f9f9f9;
    border-left: 3px solid ${accent};
    padding: 7px 10px;
    margin-bottom: 6px;
    font-size: 10px;
    color: #444;
    line-height: 1.7;
  }

  /* ── Totals ── */
  .tright { width: 236px; flex-shrink: 0; }

  .trow {
    display: flex;
    justify-content: space-between;
    padding: 5px 10px;
    font-size: 11px;
    border-bottom: 1px solid #f5f5f5;
  }
  .tm    { color: #666; }
  .td2   { color: #DC2626; font-weight: 700; }
  .tgrand {
    display: flex;
    justify-content: space-between;
    padding: 9px 10px;
    font-size: 14px;
    font-weight: 900;
    background: ${accent};
    color: #fff;
    margin-top: 2px;
  }

  .bank {
    border: 1px solid ${accent}22;
    padding: 8px 10px;
    margin-top: 6px;
    background: ${accent}06;
    border-radius: 3px;
    font-size: 10px;
    line-height: 1.8;
  }
  .blab { font-size: 9px; font-weight: 700; color: ${accent}; text-transform: uppercase; margin-bottom: 3px; }

  /* ── Signature ── */
  .sign { border: 1px solid ${accent}22; margin-top: 6px; border-radius: 3px; overflow: hidden; }
  .sh {
    background: ${accent}12;
    padding: 5px 10px;
    font-size: 9px; font-weight: 700;
    color: ${accent}; text-transform: uppercase;
    border-bottom: 1px solid ${accent}18;
  }
  .sb {
    padding: 10px;
    min-height: 64px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .seal {
    width: 42px; height: 42px; border-radius: 50%;
    border: 1.5px dashed ${accent}66;
    display: flex; align-items: center; justify-content: center;
    font-size: 8px; color: ${accent}; text-align: center;
    font-weight: 700; margin: 0 auto;
  }
  .sline {
    border-top: 1px solid #ccc;
    padding-top: 3px;
    font-size: 9px; color: #666;
    text-align: center; margin-top: 8px;
  }

  /* ── Footer ── */
  .footer {
    background: ${accent};
    color: #fff;
    padding: 7px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10px;
    font-weight: 600;
    margin-top: 10px;
  }
  .fs { font-size: 9px; opacity: .7; margin-top: 2px; }
</style>
</head>
<body>

<div class="page">

  <!-- Header -->
  <div class="top">
    <div>
      <div class="biz-name">${prof.name||'My Business'}</div>
      <div class="biz-detail">
        ${prof.address?prof.address+'<br>':''}
        ${prof.phone?'📞 '+prof.phone+(prof.email?' &nbsp;|&nbsp; '+prof.email:'')+'<br>':''}
        ${prof.gstin?'GSTIN: <b>'+prof.gstin+'</b>':''}
        ${prof.pan?' &nbsp;|&nbsp; PAN: '+prof.pan:''}
      </div>
    </div>
    <div>
      <div class="inv-label">TAX INVOICE</div>
      <div class="inv-meta">
        <span class="inv-num">${inv.invoice_number}</span><br>
        Date: ${inv.date}
        ${inv.due_date?'<br>Due: '+inv.due_date:''}<br>
        <span class="badge ${inv.status||'unpaid'}">${(inv.status||'UNPAID').toUpperCase()}</span>
      </div>
    </div>
  </div>

  <!-- Meta bar -->
  <div class="mbar">
    <div class="mc"><div class="ml">Invoice No.</div><div class="mv">${inv.invoice_number}</div></div>
    <div class="mc"><div class="ml">Date</div><div class="mv">${inv.date}</div></div>
    ${inv.due_date?`<div class="mc"><div class="ml">Due Date</div><div class="mv">${inv.due_date}</div></div>`:''}
    <div class="mc"><div class="ml">GST Type</div><div class="mv">${isInter?'IGST (Inter)':'CGST+SGST'}</div></div>
  </div>

  <!-- Parties -->
  <div class="parties">
    <div class="pc">
      <div class="ph">Bill To</div>
      <div class="pn">${inv.party_name||'Walk-in Customer'}</div>
      <div class="pd">
        ${inv.party_address?inv.party_address+'<br>':''}
        ${inv.party_gstin?'GSTIN: '+inv.party_gstin+'<br>':''}
        ${inv.party_state?'State: '+inv.party_state+' ('+(inv.party_state_code||'')+')':''}
      </div>
      <span class="stag">${isInter?'🔀 IGST':'✅ CGST+SGST'}</span>
    </div>
    <div class="pc">
      <div class="ph">Seller</div>
      <div class="pn">${prof.name||'My Business'}</div>
      <div class="pd">
        ${prof.address?prof.address+'<br>':''}
        ${prof.gstin?'GSTIN: '+prof.gstin+'<br>':''}
        ${prof.state?'State: '+prof.state+' ('+(prof.state_code||'')+')':''}
      </div>
    </div>
  </div>

  <!-- Items table -->
  <table>
    <thead>
      <tr>
        <th style="width:4%;text-align:center">#</th>
        <th style="width:25%">Item / Description</th>
        <th style="width:9%;text-align:center">Qty</th>
        <th style="width:9%;text-align:right">Rate</th>
        <th style="width:7%;text-align:right">Disc</th>
        <th style="width:11%;text-align:right">Taxable</th>
        <th style="width:7%;text-align:center">GST%</th>
        <th style="width:14%;text-align:right">${isInter?'IGST':'CGST/SGST'}</th>
        <th style="width:11%;text-align:right">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <!-- Bottom: notes + totals -->
  <div class="bot">

    <!-- Left: words + terms + UPI -->
    <div class="notes">
      <div class="wbox">
        <div class="wl">Amount in Words</div>
        <div class="wv">${words(inv.total)}</div>
      </div>
      ${inv.notes||inv.terms?`
      <div class="tcbox">
        ${inv.terms||''}${inv.notes?'<br>'+inv.notes:''}
      </div>`:''}
      ${upiBlock}
    </div>

    <!-- Right: totals + bank + sign -->
    <div class="tright">
      <div class="trow"><span>Subtotal</span><span>${inr(inv.subtotal)}</span></div>
      ${inv.discount>0?`<div class="trow tm"><span>Discount (${inv.discount}%)</span><span>-${inr((inv.subtotal||0)-(inv.taxable||0))}</span></div>`:''}
      <div class="trow"><span>Taxable Amount</span><span>${inr(inv.taxable)}</span></div>
      ${isInter
        ?`<div class="trow tm"><span>IGST</span><span>${inr(inv.igst)}</span></div>`
        :`<div class="trow tm"><span>CGST</span><span>${inr(inv.cgst)}</span></div>
          <div class="trow tm"><span>SGST</span><span>${inr(inv.sgst)}</span></div>`
      }
      ${inv.paid>0?`<div class="trow tm"><span>Paid</span><span>${inr(inv.paid)}</span></div>`:''}
      ${balance>0.01?`<div class="trow td2"><span>Balance Due</span><span>${inr(balance)}</span></div>`:''}
      <div class="tgrand"><span>Grand Total</span><span>${inr(inv.total)}</span></div>

      ${prof.bank_name||prof.account_no?`
      <div class="bank">
        <div class="blab">Bank Details</div>
        ${prof.bank_name?'<b>'+prof.bank_name+'</b><br>':''}
        ${prof.account_no?'A/C: '+prof.account_no+'<br>':''}
        ${prof.ifsc?'IFSC: '+prof.ifsc:''}
      </div>`:''}

      <div class="sign">
        <div class="sh">For ${prof.name||'Business'}</div>
        <div class="sb">
          <div class="seal">SEAL</div>
          <div class="sline">Authorised Signatory</div>
        </div>
      </div>
    </div>

  </div>

</div>

<!-- Footer -->
<div class="footer">
  <div>
    <div>${prof.name||'My Business'}</div>
    <div class="fs">${prof.gstin?'GSTIN: '+prof.gstin:''}</div>
  </div>
  <div style="text-align:right">
    <div>Thank you for your business!</div>
  </div>
</div>

</body>
</html>`;
}
