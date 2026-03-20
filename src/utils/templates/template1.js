function r(n) { return Number(n || 0).toFixed(2); }
function inr(n) { return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 }); }
function amountInWords(amount) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const num = Math.floor(amount);
  if (num === 0) return 'Zero';
  const crore = Math.floor(num / 10000000);
  const lakh  = Math.floor((num % 10000000) / 100000);
  const thou  = Math.floor((num % 100000) / 1000);
  const hund  = Math.floor((num % 1000) / 100);
  const rest  = num % 100;
  let words = '';
  const two = (n) => n >= 20 ? tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '') : ones[n];
  if (crore) words += two(crore) + ' Crore ';
  if (lakh)  words += two(lakh)  + ' Lakh ';
  if (thou)  words += two(thou)  + ' Thousand ';
  if (hund)  words += ones[hund] + ' Hundred ';
  if (rest)  words += two(rest);
  return words.trim() + ' Rupees Only';
}

export default function template1(invoice, profile, accentColor = '#1E40AF') {
  const inv = invoice; const prof = profile || {};
  const isInter = inv.supply_type === 'inter';
  const balance = (inv.total || 0) - (inv.paid || 0);

  const rows = (inv.items || []).map((item, i) => `
    <tr style="background:${i%2===0?'#F8FAFF':'#fff'}">
      <td class="tc">${i+1}</td>
      <td class="tl"><strong>${item.name}</strong>${item.hsn?`<br><span class="sm">HSN: ${item.hsn}</span>`:''}</td>
      <td class="tc">${item.qty} <span class="sm">${item.unit}</span></td>
      <td class="tr">₹${r(item.rate)}</td>
      <td class="tr">${item.discount>0?item.discount+'%':'—'}</td>
      <td class="tr">₹${r(item.taxable)}</td>
      <td class="tc">${item.gst_rate}%</td>
      <td class="tr">${isInter?'₹'+r(item.igst):'₹'+r(item.cgst)+'<br><span class="sm">₹'+r(item.sgst)+'</span>'}</td>
      <td class="tr bold">₹${r(item.total)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:11px;color:#1a1a1a;display:flex;min-height:100vh}
.sidebar{width:10px;background:${accentColor};flex-shrink:0}
.page{flex:1;padding:24px 28px}
.top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;padding-bottom:14px;border-bottom:2px solid ${accentColor}}
.biz-name{font-size:20px;font-weight:800;color:#111;margin-bottom:4px}
.biz-detail{font-size:10px;color:#555;line-height:1.8}
.inv-label{font-size:30px;font-weight:900;color:${accentColor};letter-spacing:3px;text-align:right}
.inv-meta{text-align:right;font-size:10px;color:#555;line-height:1.8;margin-top:4px}
.inv-num{font-size:13px;font-weight:800;color:#111}
.badge{display:inline-block;padding:2px 10px;border-radius:3px;font-size:9px;font-weight:700}
.paid{background:#D1FAE5;color:#065F46}.unpaid{background:#FEE2E2;color:#991B1B}.partial{background:#FEF3C7;color:#92400E}
.meta-bar{display:flex;border:1px solid #E5E7EB;margin-bottom:14px}
.meta-cell{flex:1;padding:6px 10px;border-right:1px solid #E5E7EB}
.meta-cell:last-child{border-right:none}
.ml{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
.mv{font-size:11px;font-weight:700;color:#111}
.parties{display:flex;border:1px solid #E5E7EB;margin-bottom:14px}
.pcol{flex:1;padding:10px 12px}
.pcol+.pcol{border-left:1px solid #E5E7EB}
.ph{font-size:9px;font-weight:800;color:${accentColor};text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;margin-bottom:6px;border-bottom:1px solid ${accentColor}33}
.pname{font-size:13px;font-weight:800;color:#111;margin-bottom:3px}
.pdet{font-size:10px;color:#555;line-height:1.7}
.stag{display:inline-block;background:${accentColor}15;color:${accentColor};font-size:9px;font-weight:700;padding:2px 8px;border-radius:3px;margin-top:5px;border:1px solid ${accentColor}33}
table{width:100%;border-collapse:collapse;margin-bottom:12px}
thead tr{background:${accentColor};color:#fff}
th{padding:8px 7px;font-size:10px;font-weight:700;text-align:left}
.tc{text-align:center}.tr{text-align:right}.tl{text-align:left}
td{padding:8px 7px;font-size:10px;border-bottom:1px solid #F0F0F0;vertical-align:middle}
.sm{font-size:9px;color:#999}.bold{font-weight:700}
.bottom{display:flex;gap:12px;margin-bottom:14px}
.notes{flex:1}
.nt{font-size:10px;font-weight:700;color:${accentColor};text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}
.nb{font-size:10px;color:#444;line-height:1.7;background:#F8FAFF;border-left:3px solid ${accentColor};padding:8px 10px}
.words{margin-top:8px;background:#F8FAFF;border:1px solid ${accentColor}22;padding:7px 10px;font-size:10px}
.wl{font-size:9px;font-weight:700;color:${accentColor};text-transform:uppercase;margin-bottom:2px}
.wv{font-style:italic;color:#333}
.upi{margin-top:8px;border:1px solid #E5E7EB;padding:8px;text-align:center;background:#fff}
.upi-label{font-size:9px;font-weight:700;color:${accentColor};margin-bottom:4px}
.upi-box{width:52px;height:52px;border:1.5px dashed ${accentColor}44;background:#f9f9f9;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:8px;color:#999;text-align:center;line-height:1.3}
.upi-id{font-size:9px;color:#555;margin-top:4px}
.totals-right{width:240px}
.trow{display:flex;justify-content:space-between;padding:5px 10px;font-size:11px;border-bottom:1px solid #F3F4F6}
.trow-muted{color:#666}
.trow-danger{color:#DC2626;font-weight:700}
.trow-grand{display:flex;justify-content:space-between;padding:9px 10px;font-size:14px;font-weight:900;background:${accentColor};color:#fff;margin-top:2px}
.sign-box{border:1px solid #E5E7EB;margin-top:8px}
.sh{background:${accentColor}15;padding:5px 10px;font-size:9px;font-weight:700;color:${accentColor};text-transform:uppercase;border-bottom:1px solid ${accentColor}22}
.sb{padding:10px;min-height:64px;display:flex;flex-direction:column;justify-content:space-between}
.seal{width:44px;height:44px;border-radius:50%;border:1.5px dashed ${accentColor}66;display:flex;align-items:center;justify-content:center;font-size:8px;color:${accentColor};text-align:center;font-weight:700;margin:0 auto}
.sline{border-top:1px solid #ccc;padding-top:3px;font-size:9px;color:#666;text-align:center;margin-top:8px}
.footer{background:${accentColor};color:#fff;padding:8px 14px;display:flex;justify-content:space-between;align-items:center;font-size:10px;font-weight:600;margin-top:4px}
.footer-sub{font-size:9px;opacity:.75}
</style></head><body>
<div class="sidebar"></div>
<div class="page">

<div class="top">
  <div>
    <div class="biz-name">${prof.name||'My Business'}</div>
    <div class="biz-detail">
      ${prof.address?prof.address+'<br>':''}
      ${prof.phone?'📞 '+prof.phone+(prof.email?' &nbsp;|&nbsp; '+prof.email:'')+'<br>':''}
      ${prof.gstin?'GSTIN: <strong>'+prof.gstin+'</strong>':''}
      ${prof.pan?' &nbsp;|&nbsp; PAN: '+prof.pan:''}
    </div>
  </div>
  <div>
    <div class="inv-label">TAX INVOICE</div>
    <div class="inv-meta">
      <span class="inv-num">${inv.invoice_number}</span><br>
      Date: ${inv.date}${inv.due_date?'<br>Due: '+inv.due_date:''}<br>
      <span class="badge ${inv.status||'unpaid'}">${(inv.status||'UNPAID').toUpperCase()}</span>
    </div>
  </div>
</div>

<div class="meta-bar">
  <div class="meta-cell"><div class="ml">Invoice No.</div><div class="mv">${inv.invoice_number}</div></div>
  <div class="meta-cell"><div class="ml">Invoice Date</div><div class="mv">${inv.date}</div></div>
  ${inv.due_date?`<div class="meta-cell"><div class="ml">Due Date</div><div class="mv">${inv.due_date}</div></div>`:''}
  <div class="meta-cell"><div class="ml">GST Type</div><div class="mv">${isInter?'IGST (Inter)':'CGST+SGST'}</div></div>
</div>

<div class="parties">
  <div class="pcol">
    <div class="ph">Bill To</div>
    <div class="pname">${inv.party_name||'Walk-in Customer'}</div>
    <div class="pdet">
      ${inv.party_address?inv.party_address+'<br>':''}
      ${inv.party_gstin?'GSTIN: '+inv.party_gstin+'<br>':''}
      ${inv.party_state?'State: '+inv.party_state+' ('+( inv.party_state_code||'')+')':''}
    </div>
    <span class="stag">${isInter?'🔀 IGST Applied':'✅ CGST+SGST Applied'}</span>
  </div>
  <div class="pcol">
    <div class="ph">From</div>
    <div class="pname">${prof.name||'My Business'}</div>
    <div class="pdet">
      ${prof.address?prof.address+'<br>':''}
      ${prof.gstin?'GSTIN: '+prof.gstin+'<br>':''}
      ${prof.state?'State: '+prof.state+' ('+(prof.state_code||'')+')':''}
    </div>
  </div>
</div>

<table>
  <thead><tr>
    <th class="tc" style="width:4%">#</th>
    <th style="width:25%">Item / Description</th>
    <th class="tc" style="width:9%">Qty</th>
    <th class="tr" style="width:9%">Rate</th>
    <th class="tr" style="width:7%">Disc</th>
    <th class="tr" style="width:11%">Taxable</th>
    <th class="tc" style="width:7%">GST%</th>
    <th class="tr" style="width:14%">${isInter?'IGST':'CGST/SGST'}</th>
    <th class="tr" style="width:11%">Amount</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="bottom">
  <div class="notes">
    ${inv.notes||inv.terms?`
    <div class="nt">Terms &amp; Conditions</div>
    <div class="nb">${inv.terms||''}${inv.notes?'<br>'+inv.notes:''}</div>`:''}

    <div class="words" style="margin-top:${inv.notes||inv.terms?'8px':'0'}">
      <div class="wl">Amount in Words</div>
      <div class="wv">${amountInWords(inv.total)}</div>
    </div>

    <div class="upi">
      <div class="upi-label">Scan &amp; Pay (UPI)</div>
      <div class="upi-box">QR<br>Code</div>
      ${prof.phone?`<div class="upi-id">UPI: ${prof.phone}@upi</div>`:''}
    </div>
  </div>

  <div class="totals-right">
    <div class="trow"><span>Subtotal</span><span>${inr(inv.subtotal)}</span></div>
    ${inv.discount>0?`<div class="trow trow-muted"><span>Discount (${inv.discount}%)</span><span>-${inr((inv.subtotal||0)-(inv.taxable||0))}</span></div>`:''}
    <div class="trow"><span>Taxable Amount</span><span>${inr(inv.taxable)}</span></div>
    ${isInter
      ?`<div class="trow trow-muted"><span>IGST</span><span>${inr(inv.igst)}</span></div>`
      :`<div class="trow trow-muted"><span>CGST</span><span>${inr(inv.cgst)}</span></div>
        <div class="trow trow-muted"><span>SGST</span><span>${inr(inv.sgst)}</span></div>`
    }
    ${inv.paid>0?`<div class="trow trow-muted"><span>Paid</span><span>${inr(inv.paid)}</span></div>`:''}
    ${balance>0.01?`<div class="trow trow-danger"><span>Balance Due</span><span>${inr(balance)}</span></div>`:''}
    <div class="trow-grand"><span>Grand Total</span><span>${inr(inv.total)}</span></div>

    ${prof.bank_name||prof.account_no?`
    <div style="border:1px solid #E5E7EB;margin-top:8px;padding:8px 10px;background:#F0F9FF;font-size:10px">
      <div style="font-size:9px;font-weight:700;color:${accentColor};margin-bottom:3px;text-transform:uppercase">Bank Details</div>
      ${prof.bank_name?'<strong>'+prof.bank_name+'</strong><br>':''}
      ${prof.account_no?'A/C: '+prof.account_no+'<br>':''}
      ${prof.ifsc?'IFSC: '+prof.ifsc:''}
    </div>`:''}

    <div class="sign-box">
      <div class="sh">For ${prof.name||'Business'}</div>
      <div class="sb">
        <div class="seal">SEAL</div>
        <div class="sline">Authorised Signatory</div>
      </div>
    </div>
  </div>
</div>

<div class="footer">
  <div>
    <div>${prof.name||'My Business'}</div>
    <div class="footer-sub">${prof.address||''}</div>
  </div>
  <div style="text-align:right">
    <div>Thank you for your business!</div>
    <div class="footer-sub">Powered by Locas</div>
  </div>
</div>

</div></body></html>`;
}
