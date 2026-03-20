function r(n){return Number(n||0).toFixed(2);}
function inr(n){return '₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2});}

export default function template5(invoice, profile, accent, upiBlock='') {
  const inv=invoice, prof=profile||{};
  const isInter=inv.supply_type==='inter';
  const balance=(inv.total||0)-(inv.paid||0);
  const rows=(inv.items||[]).map(item=>`
    <div class="iname">${item.name}</div>
    <div class="irow"><span>${item.qty} ${item.unit} × ₹${r(item.rate)}</span><span>₹${r(item.total)}</span></div>
    ${item.discount>0?`<div class="isub">Disc: ${item.discount}%</div>`:''}
    <div class="isub">GST ${item.gst_rate}%: ${isInter?'IGST ₹'+r(item.igst):'CGST ₹'+r(item.cgst)+' | SGST ₹'+r(item.sgst)}</div>
    <div class="ddot"></div>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Courier New',Courier,monospace;font-size:12px;color:#000;background:#fff;max-width:320px;margin:0 auto;padding:14px 10px}
.c{text-align:center}.r{text-align:right}
.d{border-top:1px dashed #000;margin:7px 0}.ds{border-top:2px solid #000;margin:7px 0}.ddot{border-top:1px dotted #999;margin:5px 0}
.brand{font-size:17px;font-weight:700;text-align:center;letter-spacing:3px;margin-bottom:2px}
.bsub{font-size:10px;text-align:center;color:#333;line-height:1.6}
.title{font-size:11px;text-align:center;font-weight:700;letter-spacing:2px;margin:7px 0 2px}
.inum{font-size:14px;text-align:center;font-weight:700;margin-bottom:2px}
.imeta{font-size:10px;text-align:center;color:#333;line-height:1.7;margin-bottom:5px}
.badge{display:inline-block;border:1px solid #000;padding:1px 8px;font-size:10px;font-weight:700}
.plab{font-size:10px;font-weight:700;text-transform:uppercase;margin-bottom:2px}
.pname{font-size:13px;font-weight:700}
.pdet{font-size:10px;color:#333;line-height:1.6}
.iname{font-size:12px;font-weight:700;margin-top:4px}
.irow{display:flex;justify-content:space-between;font-size:12px}
.isub{font-size:10px;color:#555}
.trow{display:flex;justify-content:space-between;font-size:12px;padding:2px 0}
.tgrand{display:flex;justify-content:space-between;font-size:15px;font-weight:700;padding:4px 0}
.tmuted{color:#555}.tdanger{font-weight:700}
.footer{text-align:center;font-size:10px;color:#555;margin-top:8px}
.ty{text-align:center;font-size:13px;font-weight:700;letter-spacing:1px;margin:8px 0 3px}
</style></head><body>
<div class="brand">${(prof.name||'MY BUSINESS').toUpperCase()}</div>
<div class="bsub">${prof.address?prof.address+'<br>':''}${prof.phone?prof.phone:''}${prof.email?' | '+prof.email:''}<br>${prof.gstin?'GST: '+prof.gstin:''}</div>
<div class="ds"></div>
<div class="title">*** TAX INVOICE ***</div>
<div class="inum">${inv.invoice_number}</div>
<div class="imeta">Date: ${inv.date}${inv.due_date?'<br>Due: '+inv.due_date:''}<br><span class="badge">${(inv.status||'UNPAID').toUpperCase()}</span></div>
<div class="d"></div>
<div class="plab">Bill To:</div>
<div class="pname">${inv.party_name||'Walk-in Customer'}</div>
<div class="pdet">${inv.party_address?inv.party_address+'<br>':''}${inv.party_gstin?'GST: '+inv.party_gstin+'<br>':''}${inv.party_state?inv.party_state:''}</div>
<div style="font-size:10px;margin-top:3px">Supply: ${isInter?'Inter-state (IGST)':'Intra-state (CGST+SGST)'}</div>
<div class="d"></div>
<div style="font-size:10px;font-weight:700;display:flex;justify-content:space-between"><span>ITEM</span><span>AMOUNT</span></div>
<div class="ddot"></div>
${rows}
<div class="ds"></div>
<div class="trow"><span>Subtotal</span><span>${inr(inv.subtotal)}</span></div>
${inv.discount>0?`<div class="trow tmuted"><span>Discount (${inv.discount}%)</span><span>-${inr((inv.subtotal||0)-(inv.taxable||0))}</span></div>`:''}
<div class="trow"><span>Taxable</span><span>${inr(inv.taxable)}</span></div>
${isInter?`<div class="trow tmuted"><span>IGST</span><span>${inr(inv.igst)}</span></div>`:`<div class="trow tmuted"><span>CGST</span><span>${inr(inv.cgst)}</span></div><div class="trow tmuted"><span>SGST</span><span>${inr(inv.sgst)}</span></div>`}
<div class="ds"></div>
<div class="tgrand"><span>TOTAL</span><span>${inr(inv.total)}</span></div>
${inv.paid>0?`<div class="trow tmuted"><span>Paid</span><span>${inr(inv.paid)}</span></div>`:''}
${balance>0.01?`<div class="tgrand tdanger"><span>BALANCE</span><span>${inr(balance)}</span></div>`:''}
${prof.bank_name||prof.account_no?`<div class="d"></div><div class="plab">Payment:</div><div style="font-size:10px;line-height:1.7">${prof.bank_name?prof.bank_name+'<br>':''}${prof.account_no?'A/C: '+prof.account_no+'<br>':''}${prof.ifsc?'IFSC: '+prof.ifsc:''}</div>`:''}
${upiBlock}
${inv.notes?`<div class="d"></div><div class="plab">Note:</div><div style="font-size:10px;color:#333;line-height:1.6">${inv.notes}</div>`:''}
<div class="d"></div>
<div class="ty">** THANK YOU **</div>
<div class="footer">${inv.terms?inv.terms+'<br>':''}</div>
</body></html>`;
}
