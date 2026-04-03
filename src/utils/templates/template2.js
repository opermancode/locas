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

export default function template2(invoice, profile, accent='#0F766E', upiBlock='') {
  const inv=invoice, prof=profile||{};
  const isInter=inv.supply_type==='inter';
  const balance=(inv.total||0)-(inv.paid||0);

  const rows=(inv.items||[]).map((item,i)=>`
    <tr style="background:${i%2===0?'#f9fafb':'#fff'}">
      <td style="text-align:center;padding:6px 5px;font-size:9.5pt;border-bottom:1px solid #eee">${i+1}</td>
      <td style="padding:6px 5px;font-size:9.5pt;border-bottom:1px solid #eee"><b>${item.name}</b>${item.hsn?`<br><span style="font-size:8pt;color:#aaa">HSN: ${item.hsn}</span>`:''}</td>
      <td style="text-align:center;padding:6px 5px;font-size:9.5pt;border-bottom:1px solid #eee">${item.qty} ${item.unit}</td>
      <td style="text-align:right;padding:6px 5px;font-size:9.5pt;border-bottom:1px solid #eee">₹${r(item.rate)}</td>
      <td style="text-align:right;padding:6px 5px;font-size:9.5pt;border-bottom:1px solid #eee">${item.discount>0?item.discount+'%':'—'}</td>
      <td style="text-align:right;padding:6px 5px;font-size:9.5pt;border-bottom:1px solid #eee">₹${r(item.taxable)}</td>
      <td style="text-align:center;padding:6px 5px;font-size:9.5pt;border-bottom:1px solid #eee">${item.gst_rate}%</td>
      <td style="text-align:right;padding:6px 5px;font-size:9.5pt;border-bottom:1px solid #eee">${isInter?'₹'+r(item.igst):'₹'+r(item.cgst)+'/'+'₹'+r(item.sgst)}</td>
      <td style="text-align:right;padding:6px 5px;font-size:9.5pt;border-bottom:1px solid #eee;font-weight:700">₹${r(item.total)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  @page{size:A4 portrait;margin:0}
  @media print{
    html,body{width:210mm;height:297mm;margin:0!important;padding:0!important;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
    .no-print{display:none!important}
  }
  @media screen{
    body{background:#e8eaf0;padding:20px 0;display:flex;flex-direction:column;align-items:center}
    .page{width:210mm;min-height:297mm;box-shadow:0 4px 24px rgba(0,0,0,0.13)}
  }
  body{font-family:Arial,sans-serif;font-size:10pt;color:#111}
  .page{background:#fff}
  .header{background:${accent};color:#fff;padding:16px 14mm 14px}
  .hrow{display:flex;justify-content:space-between;align-items:flex-start}
  .bname{font-size:18pt;font-weight:900;letter-spacing:1px}
  .bdet{font-size:9pt;opacity:.85;line-height:1.8;margin-top:3px}
  .inv-right{text-align:right}
  .inv-label{font-size:20pt;font-weight:900;letter-spacing:4px;opacity:.95}
  .inv-num{font-size:13pt;font-weight:800;margin-top:4px}
  .inv-date{font-size:9pt;opacity:.8;margin-top:2px}
  .badge{display:inline-block;padding:2px 8px;border-radius:3px;font-size:8pt;font-weight:700;border:1.5px solid rgba(255,255,255,0.6);color:#fff}
  .body{padding:10px 14mm 0}
  .mbar{display:flex;background:#f8fafb;border:1px solid #e5e7eb;border-radius:4px;overflow:hidden;margin-bottom:10px}
  .mc{flex:1;padding:5px 8px;border-right:1px solid #e5e7eb}
  .mc:last-child{border-right:none}
  .ml{font-size:8pt;color:#888;text-transform:uppercase;margin-bottom:1px}
  .mv{font-size:9.5pt;font-weight:700;color:#111}
  .parties{display:flex;gap:10px;margin-bottom:10px}
  .pc{flex:1;border:1px solid ${accent}30;border-radius:4px;padding:8px 10px;border-top:3px solid ${accent}}
  .ph{font-size:8pt;font-weight:800;color:${accent};text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
  .pn{font-size:11pt;font-weight:800;color:#111;margin-bottom:2px}
  .pd{font-size:9pt;color:#555;line-height:1.7}
  table{width:100%;border-collapse:collapse;margin-bottom:8px}
  thead tr{background:${accent};color:#fff}
  th{padding:6px 5px;font-size:9pt;font-weight:700;text-align:left}
  .bot{display:flex;gap:10px;padding:0 14mm 10px}
  .notes{flex:1;min-width:0}
  .wbox{background:${accent}08;border:1px solid ${accent}22;padding:6px 9px;border-radius:3px;margin-bottom:5px}
  .wl{font-size:8pt;font-weight:700;color:${accent};text-transform:uppercase;margin-bottom:1px}
  .wv{font-style:italic;color:#333;font-size:9pt;line-height:1.5}
  .tcbox{background:#f9f9f9;border-left:3px solid ${accent};padding:6px 9px;margin-bottom:5px;font-size:9pt;color:#444;line-height:1.7}
  .tright{width:210px;flex-shrink:0}
  .trow{display:flex;justify-content:space-between;padding:4px 9px;font-size:9.5pt;border-bottom:1px solid #f5f5f5}
  .tm{color:#666}.td2{color:#DC2626;font-weight:700}
  .tgrand{display:flex;justify-content:space-between;padding:8px 9px;font-size:13pt;font-weight:900;background:${accent};color:#fff;margin-top:2px}
  .bank{border:1px solid ${accent}22;padding:7px 9px;margin-top:5px;background:${accent}06;border-radius:3px;font-size:9pt;line-height:1.8}
  .blab{font-size:8pt;font-weight:700;color:${accent};text-transform:uppercase;margin-bottom:2px}
  .sign{border:1px solid ${accent}22;margin-top:5px;border-radius:3px;overflow:hidden}
  .sh{background:${accent}12;padding:4px 9px;font-size:8pt;font-weight:700;color:${accent};text-transform:uppercase}
  .sb{padding:9px;min-height:56px;display:flex;flex-direction:column;justify-content:space-between}
  .seal{width:38px;height:38px;border-radius:50%;border:1.5px dashed ${accent}66;display:flex;align-items:center;justify-content:center;font-size:7pt;color:${accent};text-align:center;font-weight:700;margin:0 auto}
  .sline{border-top:1px solid #ccc;padding-top:3px;font-size:8pt;color:#666;text-align:center;margin-top:6px}
  .footer{background:#1f2937;color:#fff;padding:6px 14mm;display:flex;justify-content:space-between;font-size:9pt;font-weight:600;margin-top:auto}
  .fs{font-size:8pt;opacity:.6;margin-top:1px}
</style></head><body>
<div class="page">
  <div class="header">
    <div class="hrow">
      <div>
        <div class="bname">${prof.name||'My Business'}</div>
        <div class="bdet">${prof.address?prof.address+'<br>':''}${prof.phone?'Ph: '+prof.phone+(prof.email?' | '+prof.email:'')+'<br>':''}${prof.gstin?'GSTIN: '+prof.gstin:''}</div>
      </div>
      <div class="inv-right">
        <div class="inv-label">TAX INVOICE</div>
        <div class="inv-num">${inv.invoice_number}</div>
        <div class="inv-date">Date: ${inv.date}${inv.due_date?'  |  Due: '+inv.due_date:''}</div>
        <span class="badge">${(inv.status||'UNPAID').toUpperCase()}</span>
      </div>
    </div>
  </div>

  <div class="body">
    <div class="mbar" style="margin-top:10px">
      <div class="mc"><div class="ml">Invoice No.</div><div class="mv">${inv.invoice_number}</div></div>
      <div class="mc"><div class="ml">Date</div><div class="mv">${inv.date}</div></div>
      ${inv.due_date?`<div class="mc"><div class="ml">Due Date</div><div class="mv">${inv.due_date}</div></div>`:''}
      <div class="mc"><div class="ml">Supply</div><div class="mv">${isInter?'Inter-state':'Intra-state'}</div></div>
    </div>

    <div class="parties">
      <div class="pc">
        <div class="ph">Bill To</div>
        <div class="pn">${inv.party_name||'Walk-in Customer'}</div>
        <div class="pd">${inv.party_address?inv.party_address+'<br>':''}${inv.party_gstin?'GSTIN: '+inv.party_gstin+'<br>':''}${inv.party_state?inv.party_state:''}</div>
      </div>
      <div class="pc">
        <div class="ph">Seller</div>
        <div class="pn">${prof.name||'My Business'}</div>
        <div class="pd">${prof.address?prof.address+'<br>':''}${prof.gstin?'GSTIN: '+prof.gstin+'<br>':''}${prof.state?prof.state:''}</div>
      </div>
    </div>

    <table>
      <thead><tr>
        <th style="width:4%;text-align:center">#</th>
        <th style="width:28%">Item / Description</th>
        <th style="width:8%;text-align:center">Qty</th>
        <th style="width:9%;text-align:right">Rate</th>
        <th style="width:6%;text-align:right">Disc</th>
        <th style="width:11%;text-align:right">Taxable</th>
        <th style="width:6%;text-align:center">GST%</th>
        <th style="width:14%;text-align:right">${isInter?'IGST':'CGST/SGST'}</th>
        <th style="width:10%;text-align:right">Amount</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="bot">
    <div class="notes">
      <div class="wbox"><div class="wl">Amount in Words</div><div class="wv">${words(inv.total)}</div></div>
      ${inv.notes||inv.terms?`<div class="tcbox">${inv.terms||''}${inv.notes?'<br>'+inv.notes:''}</div>`:''}
      ${upiBlock}
    </div>
    <div class="tright">
      <div class="trow"><span>Subtotal</span><span>${inr(inv.subtotal)}</span></div>
      ${inv.discount>0?`<div class="trow tm"><span>Discount</span><span>−${inr((inv.subtotal||0)-(inv.taxable||0))}</span></div>`:''}
      <div class="trow"><span>Taxable Amount</span><span>${inr(inv.taxable)}</span></div>
      ${isInter?`<div class="trow tm"><span>IGST</span><span>${inr(inv.igst)}</span></div>`:`<div class="trow tm"><span>CGST</span><span>${inr(inv.cgst)}</span></div><div class="trow tm"><span>SGST</span><span>${inr(inv.sgst)}</span></div>`}
      ${inv.paid>0?`<div class="trow tm"><span>Paid</span><span>${inr(inv.paid)}</span></div>`:''}
      ${balance>0.01?`<div class="trow td2"><span>Balance Due</span><span>${inr(balance)}</span></div>`:''}
      <div class="tgrand"><span>Grand Total</span><span>${inr(inv.total)}</span></div>
      ${prof.bank_name||prof.account_no?`<div class="bank"><div class="blab">Bank Details</div>${prof.bank_name?'<b>'+prof.bank_name+'</b><br>':''}${prof.account_no?'A/C: '+prof.account_no+'<br>':''}${prof.ifsc?'IFSC: '+prof.ifsc:''}</div>`:''}
      <div class="sign">
        <div class="sh">For ${prof.name||'Business'}</div>
        <div class="sb"><div class="seal">SEAL</div><div class="sline">Authorised Signatory</div></div>
      </div>
    </div>
  </div>
</div>
<div class="footer">
  <div><div>${prof.name||'My Business'}</div><div class="fs">${prof.gstin?'GSTIN: '+prof.gstin:''}</div></div>
  <div style="text-align:right">Thank you for your business!</div>
</div>
</body></html>`;
}
