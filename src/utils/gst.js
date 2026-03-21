// Auto-split GST based on supply type
// intra-state → CGST + SGST (half each)
// inter-state → IGST (full)

export function calcGST(taxable, gstRate, supplyType = 'intra') {
  const totalTax = (taxable * gstRate) / 100;
  if (supplyType === 'inter') {
    return { cgst: 0, sgst: 0, igst: totalTax, totalTax };
  }
  const half = totalTax / 2;
  return { cgst: half, sgst: half, igst: 0, totalTax };
}

export function calcLineItem(item, supplyType = 'intra') {
  const qty      = parseFloat(item.qty)  || 0;
  const rate     = parseFloat(item.rate) || 0;
  const discount = parseFloat(item.discount) || 0;
  const gstRate  = parseFloat(item.gst_rate) || 0;

  const gross    = qty * rate;
  const discAmt  = (gross * discount) / 100;
  const taxable  = gross - discAmt;
  const { cgst, sgst, igst, totalTax } = calcGST(taxable, gstRate, supplyType);
  const total    = taxable + totalTax;

  return { ...item, taxable, cgst, sgst, igst, total_tax: totalTax, total };
}

export function calcInvoiceTotals(lineItems, invoiceDiscount = 0, supplyType = 'intra') {
  let subtotal = 0, totalDiscount = 0, taxable = 0;
  let cgst = 0, sgst = 0, igst = 0, totalTax = 0;

  for (const item of lineItems) {
    const c = calcLineItem(item, supplyType);
    subtotal     += c.qty * c.rate;
    totalDiscount+= (c.qty * c.rate * (c.discount||0)) / 100;
    taxable      += c.taxable;
    cgst         += c.cgst;
    sgst         += c.sgst;
    igst         += c.igst;
    totalTax     += c.total_tax;
  }

  const extraDiscount = (taxable * invoiceDiscount) / 100;
  const finalTaxable  = taxable - extraDiscount;
  const { cgst: ec, sgst: es, igst: ei, totalTax: et } = calcGST(finalTaxable, 0, supplyType);
  // recalc tax on final taxable for invoice-level discount
  const finalTax = totalTax - (taxable > 0 ? (extraDiscount / taxable) * totalTax : 0);
  const total = finalTaxable + finalTax;

  return {
    subtotal: round(subtotal),
    discount: round(invoiceDiscount),
    taxable:  round(finalTaxable),
    cgst:     round(cgst - (supplyType === 'inter' ? 0 : (taxable > 0 ? (extraDiscount / taxable) * cgst : 0))),
    sgst:     round(sgst - (supplyType === 'inter' ? 0 : (taxable > 0 ? (extraDiscount / taxable) * sgst : 0))),
    igst:     round(igst - (supplyType === 'inter' ? (taxable > 0 ? (extraDiscount / taxable) * igst : 0) : 0)),
    total_tax:round(finalTax),
    total:    round(total),
  };
}

export function detectSupplyType(businessStateCode, partyStateCode) {
  if (!businessStateCode || !partyStateCode) return 'intra';
  return businessStateCode === partyStateCode ? 'intra' : 'inter';
}

export const GST_RATES = [0, 5, 12, 18, 28];

export const INDIAN_STATES = [
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Arunachal Pradesh', code: '12' },
  { name: 'Assam', code: '18' },
  { name: 'Bihar', code: '10' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Delhi', code: '07' },
  { name: 'Goa', code: '30' },
  { name: 'Gujarat', code: '24' },
  { name: 'Haryana', code: '06' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Karnataka', code: '29' },
  { name: 'Kerala', code: '32' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Manipur', code: '14' },
  { name: 'Meghalaya', code: '17' },
  { name: 'Mizoram', code: '15' },
  { name: 'Nagaland', code: '13' },
  { name: 'Odisha', code: '21' },
  { name: 'Punjab', code: '03' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Sikkim', code: '11' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Telangana', code: '36' },
  { name: 'Tripura', code: '16' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'West Bengal', code: '19' },
];

export function round(n) { return Math.round((n || 0) * 100) / 100; }

export function formatINR(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatINRCompact(n) {
  const num = Number(n || 0);
  if (num >= 1_00_000) return '₹' + (num / 1_00_000).toFixed(1) + 'L';
  if (num >= 1_000)    return '₹' + (num / 1_000).toFixed(1) + 'K';
  return '₹' + num.toFixed(0);
}

export function today() { return new Date().toISOString().split('T')[0]; }

export function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

export const EXPENSE_CATEGORIES = [
  'Purchase', 'Rent', 'Salary', 'Electricity', 'Transport',
  'Office Supplies', 'Maintenance', 'Marketing', 'Insurance',
  'Fuel', 'Food', 'Other',
];

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Credit Card'];
