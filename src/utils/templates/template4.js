function r(n){return Number(n||0).toFixed(2);}
function inr(n){return '₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});}
function words(amount){const ones=['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'],tens=['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];const n=Math.floor(amount);if(n===0)return'Zero';const two=(x)=>x>=20?tens[Math.floor(x/10)]+(x%10?' '+ones[x%10]:''):ones[x];let w='';const cr=Math.floor(n/10000000),lk=Math.floor((n%10000000)/100000),th=Math.floor((n%100000)/1000),hu=Math.floor((n%1000)/100),re=n%100;if(cr)w+=two(cr)+' Crore ';if(lk)w+=two(lk)+' Lakh ';if(th)w+=two(th)+' Thousand ';if(hu)w+=ones[hu]+' Hundred ';if(re)w+=two(re);return w.trim()+' Rupees Only';}

export default function template4(invoice, profile, accent='#C2410C', upiBlock='') {
  const inv=invoice, prof=profile||{};
  const isInter=inv.supply_type==='inter';
  const balance=(inv.total||0)-(inv.paid||0);
  const rows=(inv.items||[]).map((item,i)=>`
    <tr style="background:${i%2===0?'#FFF8F5':'#fff'}">
      <td class="tc">${i+1}</td>
      <td class="tl"><b>${item.name}</b>${item.hsn?`<br><span class="xs">HSN: ${item.hsn}</span>`:''}</td>
      <td class="tc">${item.qty} <span class="xs">${item.unit}</span></td>
      <td class="tr">₹${r(item.rate)}</td>
      <td class="tr">${item.discount>0?item.discount+'%':'—'}</td>
      <td class="tr">₹${r(item.taxable)}</td>
      <td class="tc">${item.gst_rate}%</td>
      <td class="tr">${isInter?'₹'+r(item.igst):'₹'+r(item.cgst)+'<br><span class="xs">₹'+r(item.sgst)+'</span>'}</td>
      <td class="tr b">₹${r(item.total)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:11px;color:#111}
.header{background:#1F2937;padding:20px 26px;display:flex;justify-content:space-between;align-items:flex-start}
.bn{font-size:19px;font-weight:900;color:#fff;margin-bottom:3px}
.bd{font-size:10px;color:rgba(255,255,255,.7);line-height:1.8}
.il{font-size:28px;font-weight:900;color:${accent};letter-spacing:3px;text-align:right}
.im{text-align:right;font-size:10px;color:rgba(255,255,255,.7);margin-top:5px;line-height:1.8}
.in{font-size:13px;font-weight:800;color:#fff}
.abar{height:5px;background:${accent}}
.badge{display:inline-block;padding:2px 10px;border-radius:3px;font-size:9px;font-weight:700}
.paid{background:#D1FAE5;color:#065F46}.unpaid{background:#FEE2E2;color:#991B1B}.partial{background:#FEF3C7;color:#92400E}
.page{padding:14px 26px}
.mbar{display:flex;background:#F9FAFB;border:1px solid #E5E7EB;margin-bottom:12px}
.mc{flex:1;padding:6px 12px;border-right:1px solid #E5E7EB}.mc:last-child{border-right:none}
.ml{font-size:9px;color:#6B7280;text-transform:uppercase;margin-bottom:2px}.mv{font-size:11px;font-weight:700;color:#111}
.parties{display:flex;gap:10px;margin-bottom:12px}
.pc{flex:1;border:1px solid #E5E7EB;border-top:3px solid ${accent};border-radius:0 0 4px 4px}
.ph{font-size:9px;font-weight:800;color:${accent};text-transform:uppercase;letter-spacing:1px;padding:7px 10px;border-bottom:1px solid #F3F4F6}
.pb{padding:10px}.pn{font-size:13px;font-weight:800;color:#111;margin-bottom:2px}.pd{font-size:10px;color:#555;line-height:1.7}
.stag{display:inline-block;background:${accent}15;color:${accent};font-size:9px;font-weight:700;padding:2px 8px;border-radius:3px;margin-top:4px;border:1px solid ${accent}33}
table{width:100%;border-collapse:collapse;margin-bottom:10px}
thead tr{background:#1F2937;color:#fff}
th{padding:7px 6px;font-size:10px;font-weight:700;text-align:left}
td{padding:7px 6px;font-size:10px;border-bottom:1px solid #F3F4F6;vertical-align:middle}
.tc{text-align:center}.tr{text-align:right}.tl{text-align:left}.b{font-weight:700}.xs{font-size:9px;color:#9CA3AF}
.bot{display:flex;gap:10px;margin-bottom:10px}
.notes{flex:1}
.wbox{background:#F9FAFB;border:1px solid #E5E7EB;padding:7px 10px;margin-bottom:6px}
.wl{font-size:9px;font-weight:700;color:${accent};text-transform:uppercase;margin-bottom:2px}.wv{font-style:italic;color:#333;font-size:10px}
.tcbox{background:#F9FAFB;border:1px solid #E5E7EB;padding:7px 10px;margin-bottom:6px;font-size:10px;color:#6B7280;line-height:1.7}
.tright{width:238px}
.twrap{border:1px solid #E5E7EB;overflow:hidden;margin-bottom:6px}
.trow{display:flex;justify-content:space-between;padding:5px 10px;font-size:11px;border-bottom:1px solid #F9FAFB}
.tm{color:#6B7280}.td2{color:#DC2626;font-weight:700}
.tgrand{display:flex;justify-content:space-between;padding:9px 10px;font-size:14px;font-weight:900;background:${accent};color:#fff}
.bank{border:1px solid #E5E7EB;padding:8px 10px;margin-bottom:6px;font-size:10px;background:#F0F9FF}
.blab{font-size:9px;font-weight:700;color:${accent};text-transform:uppercase;margin-bottom:3px}
.sign{border:1px solid #E5E7EB;overflow:hidden}
.sh{background:#F9FAFB;padding:5px 10px;font-size:9px;font-weight:700;color:${accent};text-transform:uppercase;border-bottom:1px solid #E5E7EB}
.sb{padding:10px;min-height:62px;display:flex;flex-direction:column;justify-content:space-between}
.seal{width:42px;height:42px;border-radius:50%;border:1.5px dashed ${accent}55;display:flex;align-items:center;justify-content:center;font-size:8px;color:${accent};text-align:center;font-weight:700;margin:0 auto}
.sline{border-top:1px solid #E5E7EB;padding-top:3px;font-size:9px;color:#6B7280;text-align:center;margin-top:8px}
.footer{background:#1F2937;color:#fff;padding:7px 26px;display:flex;justify-content:space-between;align-items:center;font-size:10px;font-weight:600}
.fa{color:${accent};font-weight:700}.fs{font-size:9px;opacity:.65}
</style></head><body>
<div class="header">
  <div><div class="bn">${prof.name||'My Business'}</div><div class="bd">${prof.address?prof.address+'<br>':''}${prof.phone?'📞 '+prof.phone+(prof.email?' | '+prof.email:'')+'<br>':''}${prof.gstin?'GSTIN: '+prof.gstin:''}${prof.pan?' | PAN: '+prof.pan:''}</div></div>
  <div><div class="il">TAX INVOICE</div><div class="im"><span class="in">${inv.invoice_number}</span><br>${inv.date}${inv.due_date?' | Due: '+inv.due_date:''}<br><span class="badge ${inv.status||'unpaid'}">${(inv.status||'UNPAID').toUpperCase()}</span></div></div>
</div>
<div class="abar"></div>
<div class="page">
<div class="mbar">
  <div class="mc"><div class="ml">Invoice No.</div><div class="mv">${inv.invoice_number}</div></div>
  <div class="mc"><div class="ml">Date</div><div class="mv">${inv.date}</div></div>
  ${inv.due_date?`<div class="mc"><div class="ml">Due Date</div><div class="mv">${inv.due_date}</div></div>`:''}
  <div class="mc"><div class="ml">GST Type</div><div class="mv">${isInter?'IGST (Inter)':'CGST+SGST'}</div></div>
</div>
<div class="parties">
  <div class="pc"><div class="ph">Bill To</div><div class="pb"><div class="pn">${inv.party_name||'Walk-in Customer'}</div><div class="pd">${inv.party_address?inv.party_address+'<br>':''}${inv.party_gstin?'GSTIN: '+inv.party_gstin+'<br>':''}${inv.party_state?'State: '+inv.party_state+' ('+(inv.party_state_code||'')+')':''}</div><span class="stag">${isInter?'🔀 IGST':'✅ CGST+SGST'}</span></div></div>
  <div class="pc"><div class="ph">Seller</div><div class="pb"><div class="pn">${prof.name||'My Business'}</div><div class="pd">${prof.address?prof.address+'<br>':''}${prof.gstin?'GSTIN: '+prof.gstin+'<br>':''}${prof.state?'State: '+prof.state+' ('+(prof.state_code||'')+')':''}</div></div></div>
</div>
<table>
  <thead><tr><th class="tc" style="width:4%">#</th><th style="width:24%">Item</th><th class="tc" style="width:9%">Qty</th><th class="tr" style="width:9%">Rate</th><th class="tr" style="width:7%">Disc</th><th class="tr" style="width:11%">Taxable</th><th class="tc" style="width:7%">GST%</th><th class="tr" style="width:14%">${isInter?'IGST':'CGST/SGST'}</th><th class="tr" style="width:11%">Amount</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="bot">
  <div class="notes">
    <div class="wbox"><div class="wl">Amount in Words</div><div class="wv">${words(inv.total)}</div></div>
    ${inv.notes||inv.terms?`<div class="tcbox">${inv.terms||''}${inv.notes?'<br>'+inv.notes:''}</div>`:''}
    ${upiBlock}
  </div>
  <div class="tright">
    <div class="twrap">
      <div class="trow"><span>Subtotal</span><span>${inr(inv.subtotal)}</span></div>
      ${inv.discount>0?`<div class="trow tm"><span>Discount (${inv.discount}%)</span><span>-${inr((inv.subtotal||0)-(inv.taxable||0))}</span></div>`:''}
      <div class="trow"><span>Taxable</span><span>${inr(inv.taxable)}</span></div>
      ${isInter?`<div class="trow tm"><span>IGST</span><span>${inr(inv.igst)}</span></div>`:`<div class="trow tm"><span>CGST</span><span>${inr(inv.cgst)}</span></div><div class="trow tm"><span>SGST</span><span>${inr(inv.sgst)}</span></div>`}
      ${inv.paid>0?`<div class="trow tm"><span>Paid</span><span>${inr(inv.paid)}</span></div>`:''}
      ${balance>0.01?`<div class="trow td2"><span>Balance Due</span><span>${inr(balance)}</span></div>`:''}
      <div class="tgrand"><span>Grand Total</span><span>${inr(inv.total)}</span></div>
    </div>
    ${prof.bank_name||prof.account_no?`<div class="bank"><div class="blab">Bank Details</div>${prof.bank_name?'<b>'+prof.bank_name+'</b><br>':''}${prof.account_no?'A/C: '+prof.account_no+'<br>':''}${prof.ifsc?'IFSC: '+prof.ifsc:''}</div>`:''}
    <div class="sign"><div class="sh">For ${prof.name||'Business'}</div><div class="sb"><div class="seal">SEAL</div><div class="sline">Authorised Signatory</div></div></div>
  </div>
</div>
</div>
<div class="footer"><div><span class="fa">${prof.name||'My Business'}</span><br><div class="fs">${prof.gstin?'GSTIN: '+prof.gstin:''}</div></div><div style="text-align:right"><div>Thank you for your business!</div></div></div>
</body></html>`;
}
