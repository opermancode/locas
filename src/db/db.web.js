import localforage from 'localforage';

// FIX: declare both locks at the top so importAllData can reset them without
//      hitting a temporal dead zone (ReferenceError)
let _invoiceNumberLock = Promise.resolve();
let _quoteNumberLock   = Promise.resolve();

const stores = {
  profile: localforage.createInstance({ name: 'locas', storeName: 'business_profile' }),
  parties: localforage.createInstance({ name: 'locas', storeName: 'parties' }),
  items: localforage.createInstance({ name: 'locas', storeName: 'items' }),
  invoices: localforage.createInstance({ name: 'locas', storeName: 'invoices' }),
  invoice_items: localforage.createInstance({ name: 'locas', storeName: 'invoice_items' }),
  payments: localforage.createInstance({ name: 'locas', storeName: 'payments' }),
  expenses: localforage.createInstance({ name: 'locas', storeName: 'expenses' }),
  quotations: localforage.createInstance({ name: 'locas', storeName: 'quotations' }),
  quotation_items: localforage.createInstance({ name: 'locas', storeName: 'quotation_items' }),
  meta: localforage.createInstance({ name: 'locas', storeName: 'meta' }),
};

async function nextId(storeName) {
  const key = `${storeName}_seq`;
  const current = (await stores.meta.getItem(key)) || 0;
  const next = current + 1;
  await stores.meta.setItem(key, next);
  return next;
}

async function getAll(store, filter = null) {
  const results = [];
  await store.iterate((value) => { results.push(value); });
  return filter ? results.filter(filter) : results;
}

export async function getDB() {
  const profile = await stores.profile.getItem('1');
  if (!profile) {
    await stores.profile.setItem('1', {
      id: 1, name: 'My Business', address: '', phone: '', email: '',
      gstin: '', state: '', state_code: '', pan: '', bank_name: '',
      account_no: '', ifsc: '', invoice_prefix: 'INV', invoice_counter: 0,
      quote_prefix: 'QUO', quote_counter: 0,
      signature: '', logo: '', upi_id: '', show_upi_qr: 0,
      owner_email: null, owner_set_at: null,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    });
  }
  return true;
}

export async function getProfile() {
  return await stores.profile.getItem('1');
}

export async function saveProfile(data) {
  const existing = await stores.profile.getItem('1');
  await stores.profile.setItem('1', {
    ...existing, ...data,
    show_upi_qr: data.show_upi_qr ? 1 : 0,
    updated_at: new Date().toISOString(),
  });
}

export async function getDataOwner() {
  const profile = await stores.profile.getItem('1');
  return profile?.owner_email || null;
}

export async function setDataOwner(email) {
  const existing = await stores.profile.getItem('1');
  await stores.profile.setItem('1', {
    ...existing,
    owner_email: email.toLowerCase(),
    owner_set_at: new Date().toISOString(),
  });
}

export async function peekNextInvoiceNumber() {
  const profile = await stores.profile.getItem('1');
  const next   = (profile.invoice_counter  || 0) + 1;
  const prefix = profile.invoice_prefix    || 'INV';
  const digits = profile.invoice_num_digits || 4;
  const sep    = profile.invoice_separator !== undefined ? profile.invoice_separator : '-';
  return `${prefix}${sep}${String(next).padStart(digits, '0')}`;
}

async function consumeNextInvoiceNumber() {
  const result = _invoiceNumberLock.then(async () => {
    const profile = await stores.profile.getItem('1');
    const next   = (profile.invoice_counter  || 0) + 1;
    const prefix = profile.invoice_prefix    || 'INV';
    const digits = profile.invoice_num_digits || 4;
    const sep    = profile.invoice_separator !== undefined ? profile.invoice_separator : '-';
    await stores.profile.setItem('1', { ...profile, invoice_counter: next });
    return `${prefix}${sep}${String(next).padStart(digits, '0')}`;
  });
  _invoiceNumberLock = result.catch(() => {});
  return result;
}

export async function getParties(type = null) {
  const all = await getAll(stores.parties, p => !p.deleted_at);
  const filtered = type ? all.filter(p => p.type === type) : all;
  return filtered.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getParty(id) {
  try {
    return await stores.parties.getItem(String(id));
  } catch (e) {
    return null;
  }
}

export async function saveParty(data) {
  if (data.id) {
    const existing = await stores.parties.getItem(String(data.id));
    await stores.parties.setItem(String(data.id), {
      ...existing, ...data, updated_at: new Date().toISOString(),
    });
    return data.id;
  } else {
    const id = await nextId('parties');
    await stores.parties.setItem(String(id), {
      id, name: data.name, phone: data.phone || '', email: data.email || '',
      address: data.address || '', gstin: data.gstin || '', state: data.state || '',
      state_code: data.state_code || '', pan: data.pan || '',
      type: data.type || 'customer', balance: 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      deleted_at: null,
    });
    return id;
  }
}

export async function deleteParty(id) {
  const existing = await stores.parties.getItem(String(id));
  await stores.parties.setItem(String(id), { ...existing, deleted_at: new Date().toISOString() });
}

export async function getItems() {
  const all = await getAll(stores.items, i => !i.deleted_at);
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function saveItem(data) {
  if (data.id) {
    const existing = await stores.items.getItem(String(data.id));
    await stores.items.setItem(String(data.id), {
      ...existing, ...data, updated_at: new Date().toISOString(),
    });
    return data.id;
  } else {
    const id = await nextId('items');
    await stores.items.setItem(String(id), {
      id, name: data.name, code: data.code || '', unit: data.unit || 'pcs',
      hsn: data.hsn || '', sale_price: data.sale_price || 0,
      purchase_price: data.purchase_price || 0, gst_rate: data.gst_rate || 18,
      stock: data.stock || 0, min_stock: data.min_stock || 0,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      deleted_at: null,
    });
    return id;
  }
}

export async function deleteItem(id) {
  const existing = await stores.items.getItem(String(id));
  await stores.items.setItem(String(id), { ...existing, deleted_at: new Date().toISOString() });
}

export async function saveInvoice(invoice, lineItems) {
  let invoiceId;

  if (invoice.id) {
    const oldInvoice = await stores.invoices.getItem(String(invoice.id));

    const oldItemsList = await getAll(stores.invoice_items, i => i.invoice_id === Number(invoice.id));
    for (const old of oldItemsList) {
      if (old.item_id && invoice.type === 'sale') {
        const item = await stores.items.getItem(String(old.item_id));
        if (item) await stores.items.setItem(String(old.item_id), { ...item, stock: (item.stock || 0) + old.qty });
      }
    }

    if (oldInvoice?.type === 'sale') {
      const oldPartyId = oldInvoice.party_id;
      const newPartyId = invoice.party_id;
      if (oldPartyId && String(oldPartyId) !== String(newPartyId)) {
        const oldParty = await stores.parties.getItem(String(oldPartyId));
        if (oldParty) await stores.parties.setItem(String(oldPartyId), { ...oldParty, balance: (oldParty.balance || 0) - ((oldInvoice.total || 0) - (oldInvoice.paid || 0)) });
        if (newPartyId) {
          const newParty = await stores.parties.getItem(String(newPartyId));
          if (newParty) await stores.parties.setItem(String(newPartyId), { ...newParty, balance: (newParty.balance || 0) + (invoice.total || 0) });
        }
      } else if (newPartyId) {
        const delta = (invoice.total || 0) - (oldInvoice.total || 0);
        if (delta !== 0) {
          const party = await stores.parties.getItem(String(newPartyId));
          if (party) await stores.parties.setItem(String(newPartyId), { ...party, balance: (party.balance || 0) + delta });
        }
      }
    }

    const keysToDelete = [];
    await stores.invoice_items.iterate((val, key) => {
      if (val.invoice_id === Number(invoice.id)) keysToDelete.push(key);
    });
    for (const key of keysToDelete) {
      await stores.invoice_items.removeItem(key);
    }

    await stores.invoices.setItem(String(invoice.id), {
      ...oldInvoice, ...invoice, updated_at: new Date().toISOString(),
    });
    invoiceId = invoice.id;
  } else {
    invoiceId = await nextId('invoices');
    const invoiceNumber = await consumeNextInvoiceNumber();
    await stores.invoices.setItem(String(invoiceId), {
      id: invoiceId, invoice_number: invoiceNumber,
      type: invoice.type || 'sale',
      party_id: invoice.party_id || null,
      party_name: invoice.party_name || '',
      party_gstin: invoice.party_gstin || '',
      party_state: invoice.party_state || '',
      party_state_code: invoice.party_state_code || '',
      party_address: invoice.party_address || '',
      ship_to_same:    invoice.ship_to_same !== false, // default true
      ship_to_name:    invoice.ship_to_name || '',
      ship_to_address: invoice.ship_to_address || '',
      ship_to_gstin:   invoice.ship_to_gstin || '',
      date: invoice.date, due_date: invoice.due_date || '',
      subtotal: invoice.subtotal || 0, discount: invoice.discount || 0,
      taxable: invoice.taxable || 0, cgst: invoice.cgst || 0,
      sgst: invoice.sgst || 0, igst: invoice.igst || 0,
      total_tax: invoice.total_tax || 0, total: invoice.total || 0,
      paid: 0, status: 'unpaid',
      supply_type: invoice.supply_type || 'intra',
      notes: invoice.notes || '', terms: invoice.terms || '',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      deleted_at: null,
    });

    if (invoice.party_id && (invoice.type || 'sale') === 'sale') {
      const party = await stores.parties.getItem(String(invoice.party_id));
      if (party) await stores.parties.setItem(String(invoice.party_id), { ...party, balance: (party.balance || 0) + (invoice.total || 0) });
    }
  }

  for (const item of lineItems) {
    const itemId = await nextId('invoice_items');
    await stores.invoice_items.setItem(String(itemId), {
      id: itemId, invoice_id: invoiceId,
      item_id: item.item_id || null,
      name: item.name, hsn: item.hsn || '', unit: item.unit || 'pcs',
      qty: item.qty, rate: item.rate, discount: item.discount || 0,
      taxable: item.taxable, gst_rate: item.gst_rate || 18,
      cgst: item.cgst || 0, sgst: item.sgst || 0,
      igst: item.igst || 0, total: item.total,
    });
    if (item.item_id && (invoice.type || 'sale') === 'sale') {
      const stockItem = await stores.items.getItem(String(item.item_id));
      if (stockItem) await stores.items.setItem(String(item.item_id), { ...stockItem, stock: (stockItem.stock || 0) - item.qty });
    }
  }

  invalidateDashboardCache();
  return invoiceId;
}

export async function getInvoices(filters = {}) {
  // Pre-filter at iteration level when possible to avoid loading everything
  const typeFilter = filters.type;
  let all = await getAll(stores.invoices, i => !i.deleted_at && (!typeFilter || i.type === typeFilter));
  if (filters.status) all = all.filter(i => i.status === filters.status);
  // type pre-filtered in getAll for performance
  if (filters.from) all = all.filter(i => i.date >= filters.from);
  if (filters.to) all = all.filter(i => i.date <= filters.to);
  return all.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

export async function getInvoiceDetail(id) {
  const numId = Number(id);
  const invoice = await stores.invoices.getItem(String(numId));
  if (!invoice) return null;
  invoice.items = await getAll(stores.invoice_items, i => i.invoice_id === numId);
  invoice.payments = (await getAll(stores.payments, p => p.invoice_id === numId)).sort((a, b) => b.date.localeCompare(a.date));
  return invoice;
}

export async function recordPayment(invoiceId, amount, method, reference, date, note) {
  invalidateDashboardCache();
  const inv = await stores.invoices.getItem(String(invoiceId));
  const outstanding = (inv.total || 0) - (inv.paid || 0);
  if (amount > outstanding + 0.001) {
    throw new Error(`Payment of ${amount} exceeds outstanding balance of ${outstanding.toFixed(2)}`);
  }

  const payId = await nextId('payments');
  await stores.payments.setItem(String(payId), {
    id: payId, invoice_id: invoiceId, amount,
    method: method || 'cash', reference: reference || '',
    date, note: note || '', created_at: new Date().toISOString(),
  });

  const newPaid = (inv.paid || 0) + amount;
  const status = newPaid >= inv.total ? 'paid' : 'partial';
  await stores.invoices.setItem(String(invoiceId), {
    ...inv, paid: newPaid, status, updated_at: new Date().toISOString(),
  });

  if (inv.party_id) {
    const party = await stores.parties.getItem(String(inv.party_id));
    if (party) await stores.parties.setItem(String(inv.party_id), { ...party, balance: (party.balance || 0) - amount });
  }
}

export async function deleteInvoice(id) {
  invalidateDashboardCache();
  const inv = await stores.invoices.getItem(String(id));
  if (!inv || inv.deleted_at) return;

  await stores.invoices.setItem(String(id), { ...inv, deleted_at: new Date().toISOString() });

  if (inv.party_id && inv.type === 'sale') {
    const outstanding = (inv.total || 0) - (inv.paid || 0);
    if (outstanding !== 0) {
      const party = await stores.parties.getItem(String(inv.party_id));
      if (party) await stores.parties.setItem(String(inv.party_id), { ...party, balance: (party.balance || 0) - outstanding });
    }
  }

  if (inv.type === 'sale') {
    const lineItems = await getAll(stores.invoice_items, i => i.invoice_id === Number(id));
    for (const it of lineItems) {
      if (it.item_id) {
        const item = await stores.items.getItem(String(it.item_id));
        if (item) await stores.items.setItem(String(it.item_id), { ...item, stock: (item.stock || 0) + it.qty });
      }
    }
  }
}

export async function getExpenses(filters = {}) {
  let all = await getAll(stores.expenses, e => !e.deleted_at);
  if (filters.from) all = all.filter(e => e.date >= filters.from);
  if (filters.to) all = all.filter(e => e.date <= filters.to);
  return all.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

export async function saveExpense(data) {
  if (data.id) {
    const existing = await stores.expenses.getItem(String(data.id));
    await stores.expenses.setItem(String(data.id), {
      ...existing, ...data, updated_at: new Date().toISOString(),
    });
  } else {
    const id = await nextId('expenses');
    await stores.expenses.setItem(String(id), {
      id, category: data.category || 'Other', amount: data.amount,
      date: data.date, party_name: data.party_name || '',
      bill_no: data.bill_no || '', method: data.method || 'cash',
      note: data.note || '',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      deleted_at: null,
    });
  }
}

export async function deleteExpense(id) {
  const existing = await stores.expenses.getItem(String(id));
  await stores.expenses.setItem(String(id), { ...existing, deleted_at: new Date().toISOString() });
}

// Simple TTL cache for dashboard stats — avoids full table scan on every screen focus
let _dashCache = null;
let _dashCacheTime = 0;
const DASH_CACHE_TTL = 8000; // 8 seconds

export function invalidateDashboardCache() {
  _dashCache = null;
  _dashCacheTime = 0;
}

export async function getDashboardStats() {
  const now = Date.now();
  if (_dashCache && (now - _dashCacheTime) < DASH_CACHE_TTL) {
    return _dashCache;
  }
  const currentDate = new Date();
  const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
  const yyyy = String(currentDate.getFullYear());
  const monthStart = `${yyyy}-${mm}-01`;
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

  const allInvoices = await getAll(stores.invoices, i => !i.deleted_at);
  const allExpenses = await getAll(stores.expenses, e => !e.deleted_at);

  const monthSales    = allInvoices.filter(i => i.type === 'sale' && i.date >= monthStart && i.date <= monthEnd);
  const monthExpenses = allExpenses.filter(e => e.date >= monthStart && e.date <= monthEnd);

  const sales = {
    total: monthSales.reduce((s, i) => s + (i.total || 0), 0),
    count: monthSales.length,
  };
  const expenses = {
    total: monthExpenses.reduce((s, e) => s + (e.amount || 0), 0),
  };
  const collected = {
    total: monthSales.reduce((s, i) => s + (i.paid || 0), 0),
  };
  const receivables = {
    total: allInvoices.filter(i => i.type === 'sale' && i.status !== 'paid').reduce((s, i) => s + ((i.total || 0) - (i.paid || 0)), 0),
  };
  const payables = {
    total: allInvoices.filter(i => i.type === 'purchase' && i.status !== 'paid').reduce((s, i) => s + ((i.total || 0) - (i.paid || 0)), 0),
  };

  const byParty = {};
  monthSales.forEach(i => {
    byParty[i.party_name] = (byParty[i.party_name] || 0) + (i.total || 0);
  });
  const topCustomers = Object.entries(byParty)
    .map(([party_name, total]) => ({ party_name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const result = { sales, expenses, receivables, payables, topCustomers, collected };
  _dashCache = result;
  _dashCacheTime = Date.now();
  return result;
}

export async function getReportData(from, to) {
  const allInvoices = await getAll(stores.invoices, i => !i.deleted_at);
  const allExpenses = await getAll(stores.expenses, e => !e.deleted_at);
  const allLineItems = await getAll(stores.invoice_items);

  const sales     = allInvoices.filter(i => i.type === 'sale'     && i.date >= from && i.date <= to);
  const purchases = allInvoices.filter(i => i.type === 'purchase' && i.date >= from && i.date <= to);
  const expenses  = allExpenses.filter(e => e.date >= from && e.date <= to);

  // Get invoice_ids in range for line item lookup
  const saleIds = new Set(sales.map(i => String(i.id)));
  const saleLineItems = allLineItems.filter(li => saleIds.has(String(li.invoice_id)));

  const gst = {
    cgst:  sales.reduce((s, i) => s + (i.cgst      || 0), 0),
    sgst:  sales.reduce((s, i) => s + (i.sgst      || 0), 0),
    igst:  sales.reduce((s, i) => s + (i.igst      || 0), 0),
    total: sales.reduce((s, i) => s + (i.total_tax || 0), 0),
  };
  return { sales, purchases, expenses, gst, saleLineItems };
}

export async function exportAllData() {
  const profile = await getAll(stores.profile);
  const parties = await getAll(stores.parties);
  const items = await getAll(stores.items);
  const invoices = await getAll(stores.invoices);
  const invoiceItems = await getAll(stores.invoice_items);
  const payments = await getAll(stores.payments);
  const expenses = await getAll(stores.expenses);
  const quotations = await getAll(stores.quotations);
  const quotationItems = await getAll(stores.quotation_items);
  const purchaseOrders = await getAll(stores_po.purchase_orders);
  const poItems        = await getAll(stores_po.po_items);

  return JSON.stringify({
    version: 1,
    exported_at: new Date().toISOString(),
    profile, parties, items, invoices,
    invoice_items: invoiceItems, payments, expenses,
    quotations, quotation_items: quotationItems,
    purchase_orders: purchaseOrders,
    po_items: poItems,
  }, null, 2);
}

export async function importAllData(jsonString) {
  const data = JSON.parse(jsonString);
  if (data.version !== 1) throw new Error('Unsupported backup version');

  await stores.parties.clear();
  await stores.items.clear();
  await stores.invoices.clear();
  await stores.invoice_items.clear();
  await stores.payments.clear();
  await stores.expenses.clear();
  await stores.quotations.clear();
  await stores.quotation_items.clear();
  await stores_po.purchase_orders.clear();
  await stores_po.po_items.clear();

  if (data.profile?.[0]) {
    await stores.profile.setItem('1', data.profile[0]);
  }
  for (const row of data.parties || []) await stores.parties.setItem(String(row.id), row);
  for (const row of data.items || []) await stores.items.setItem(String(row.id), row);
  for (const row of data.invoices || []) await stores.invoices.setItem(String(row.id), row);
  for (const row of data.invoice_items || []) await stores.invoice_items.setItem(String(row.id), row);
  for (const row of data.payments || []) await stores.payments.setItem(String(row.id), row);
  for (const row of data.expenses || []) await stores.expenses.setItem(String(row.id), row);
  for (const row of data.quotations || []) await stores.quotations.setItem(String(row.id), row);
  for (const row of data.quotation_items || []) await stores.quotation_items.setItem(String(row.id), row);
  for (const row of data.purchase_orders || []) await stores_po.purchase_orders.setItem(String(row.id), row);
  for (const row of data.po_items || []) await stores_po.po_items.setItem(String(row.id), row);

  const maxId = (rows) => rows.reduce((m, r) => Math.max(m, r.id || 0), 0);
  await stores.meta.setItem('parties_seq', maxId(data.parties || []));
  await stores.meta.setItem('items_seq', maxId(data.items || []));
  await stores.meta.setItem('invoices_seq', maxId(data.invoices || []));
  await stores.meta.setItem('invoice_items_seq', maxId(data.invoice_items || []));
  await stores.meta.setItem('payments_seq', maxId(data.payments || []));
  await stores.meta.setItem('expenses_seq', maxId(data.expenses || []));
  await stores.meta.setItem('quotations_seq', maxId(data.quotations || []));
  await stores.meta.setItem('quotation_items_seq', maxId(data.quotation_items || []));
  await stores.meta.setItem('po_id_seq',       maxId(data.purchase_orders || []));
  await stores.meta.setItem('po_items_seq',    maxId(data.po_items || []));
  await stores.meta.setItem('po_items_id_seq', maxId(data.purchase_orders || []));

  _invoiceNumberLock = Promise.resolve();
  _quoteNumberLock = Promise.resolve();
}

export async function peekNextQuoteNumber() {
  const profile = await stores.profile.getItem('1');
  const next   = (profile.quote_counter || 0) + 1;
  const prefix = profile.quote_prefix    || 'QUO';
  const digits = profile.invoice_num_digits || 4;
  const sep    = profile.invoice_separator !== undefined ? profile.invoice_separator : '-';
  return `${prefix}${sep}${String(next).padStart(digits, '0')}`;
}

async function consumeNextQuoteNumber() {
  const result = _quoteNumberLock.then(async () => {
    const profile = await stores.profile.getItem('1');
    const next   = (profile.quote_counter || 0) + 1;
    const prefix = profile.quote_prefix    || 'QUO';
    const digits = profile.invoice_num_digits || 4;
    const sep    = profile.invoice_separator !== undefined ? profile.invoice_separator : '-';
    await stores.profile.setItem('1', { ...profile, quote_counter: next });
    return `${prefix}${sep}${String(next).padStart(digits, '0')}`;
  });
  _quoteNumberLock = result.catch(() => {});
  return result;
}

export async function saveQuotation(quotation, lineItems) {
  let quotationId;

  if (quotation.id) {
    const existing = await stores.quotations.getItem(String(quotation.id));
    await stores.quotations.setItem(String(quotation.id), {
      ...existing,
      party_id: quotation.party_id || null,
      party_name: quotation.party_name || '',
      party_gstin: quotation.party_gstin || '',
      party_state: quotation.party_state || '',
      party_state_code: quotation.party_state_code || '',
      party_address: quotation.party_address || '',
      date: quotation.date,
      valid_until: quotation.valid_until || '',
      subtotal: quotation.subtotal || 0,
      discount: quotation.discount || 0,
      taxable: quotation.taxable || 0,
      cgst: quotation.cgst || 0,
      sgst: quotation.sgst || 0,
      igst: quotation.igst || 0,
      total_tax: quotation.total_tax || 0,
      total: quotation.total || 0,
      supply_type: quotation.supply_type || 'intra',
      notes: quotation.notes || '',
      terms: quotation.terms || '',
      updated_at: new Date().toISOString(),
    });
    quotationId = quotation.id;

    const oldItems = await getAll(stores.quotation_items, i => i.quotation_id === Number(quotation.id));
    for (const item of oldItems) {
      await stores.quotation_items.removeItem(String(item.id));
    }
  } else {
    const quoteNumber = await consumeNextQuoteNumber();
    quotationId = await nextId('quotations');

    await stores.quotations.setItem(String(quotationId), {
      id: quotationId,
      quote_number: quoteNumber,
      party_id: quotation.party_id || null,
      party_name: quotation.party_name || '',
      party_gstin: quotation.party_gstin || '',
      party_state: quotation.party_state || '',
      party_state_code: quotation.party_state_code || '',
      party_address: quotation.party_address || '',
      date: quotation.date,
      valid_until: quotation.valid_until || '',
      subtotal: quotation.subtotal || 0,
      discount: quotation.discount || 0,
      taxable: quotation.taxable || 0,
      cgst: quotation.cgst || 0,
      sgst: quotation.sgst || 0,
      igst: quotation.igst || 0,
      total_tax: quotation.total_tax || 0,
      total: quotation.total || 0,
      status: quotation.status || 'draft',
      supply_type: quotation.supply_type || 'intra',
      converted_invoice_id: null,
      notes: quotation.notes || '',
      terms: quotation.terms || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    });
  }

  for (const item of lineItems) {
    const itemId = await nextId('quotation_items');
    await stores.quotation_items.setItem(String(itemId), {
      id: itemId,
      quotation_id: quotationId,
      item_id: item.item_id || null,
      name: item.name,
      hsn: item.hsn || '',
      unit: item.unit || 'pcs',
      qty: item.qty,
      rate: item.rate,
      discount: item.discount || 0,
      taxable: item.taxable || 0,
      gst_rate: item.gst_rate || 18,
      cgst: item.cgst || 0,
      sgst: item.sgst || 0,
      igst: item.igst || 0,
      total: item.total || 0,
    });
  }

  return quotationId;
}

export async function getQuotations(filters = {}) {
  let all = await getAll(stores.quotations, q => !q.deleted_at);

  if (filters.party_id) all = all.filter(q => q.party_id === filters.party_id);
  if (filters.status) all = all.filter(q => q.status === filters.status);
  if (filters.from) all = all.filter(q => q.date >= filters.from);
  if (filters.to) all = all.filter(q => q.date <= filters.to);
  if (filters.search) {
    const search = filters.search.toLowerCase();
    all = all.filter(q =>
      q.quote_number.toLowerCase().includes(search) ||
      (q.party_name && q.party_name.toLowerCase().includes(search))
    );
  }

  return all.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

export async function getQuotationDetail(id) {
  const quotation = await stores.quotations.getItem(String(id));
  if (!quotation) return null;
  const items = await getAll(stores.quotation_items, i => i.quotation_id === Number(id));
  return { ...quotation, items };
}

export async function updateQuotationStatus(id, status) {
  const existing = await stores.quotations.getItem(String(id));
  if (existing) {
    await stores.quotations.setItem(String(id), {
      ...existing,
      status,
      updated_at: new Date().toISOString(),
    });
  }
}

export async function deleteQuotation(id) {
  const existing = await stores.quotations.getItem(String(id));
  if (existing) {
    await stores.quotations.setItem(String(id), {
      ...existing,
      deleted_at: new Date().toISOString(),
    });
  }
}

export async function convertQuotationToInvoice(quotationId) {
  const quotation = await getQuotationDetail(quotationId);
  if (!quotation) throw new Error('Quotation not found');
  if (quotation.status === 'converted') throw new Error('Quotation already converted');

  const invoiceData = {
    type: 'sale',
    party_id: quotation.party_id,
    party_name: quotation.party_name,
    party_gstin: quotation.party_gstin,
    party_state: quotation.party_state,
    party_state_code: quotation.party_state_code,
    party_address: quotation.party_address,
    date: new Date().toISOString().split('T')[0],
    due_date: '',
    subtotal: quotation.subtotal,
    discount: quotation.discount,
    taxable: quotation.taxable,
    cgst: quotation.cgst,
    sgst: quotation.sgst,
    igst: quotation.igst,
    total_tax: quotation.total_tax,
    total: quotation.total,
    supply_type: quotation.supply_type,
    notes: quotation.notes,
    terms: quotation.terms,
  };

  const lineItems = quotation.items.map(item => ({
    item_id: item.item_id, name: item.name, hsn: item.hsn, unit: item.unit,
    qty: item.qty, rate: item.rate, discount: item.discount, taxable: item.taxable,
    gst_rate: item.gst_rate, cgst: item.cgst, sgst: item.sgst, igst: item.igst, total: item.total,
  }));

  const invoiceId = await saveInvoice(invoiceData, lineItems);

  const existing = await stores.quotations.getItem(String(quotationId));
  await stores.quotations.setItem(String(quotationId), {
    ...existing,
    status: 'converted',
    converted_invoice_id: invoiceId,
    updated_at: new Date().toISOString(),
  });

  return invoiceId;
}

export async function globalSearch(query, limit = 10) {
  if (!query || query.trim().length < 2) {
    return { invoices: [], quotations: [], parties: [], products: [] };
  }

  const searchTerm = query.trim().toLowerCase();

  try {
    // Run all 4 store reads in parallel for faster search
    const [allInvoices, allQuotations, allParties, allItems] = await Promise.all([
      getAll(stores.invoices, i => !i.deleted_at),
      getAll(stores.quotations, q => !q.deleted_at),
      getAll(stores.parties, p => !p.deleted_at),
      getAll(stores.items, i => !i.deleted_at),
    ]);

    const invoices = allInvoices
      .filter(i =>
        i.invoice_number?.toLowerCase().includes(searchTerm) ||
        i.party_name?.toLowerCase().includes(searchTerm)
      )
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(i => ({
        id: i.id,
        invoice_number: i.invoice_number,
        date: i.date,
        total: i.total,
        status: i.status,
        created_at: i.created_at,
        party_name: i.party_name,
      }));

    const quotations = allQuotations
      .filter(q =>
        q.quote_number?.toLowerCase().includes(searchTerm) ||
        q.party_name?.toLowerCase().includes(searchTerm)
      )
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(q => ({
        id: q.id,
        quote_number: q.quote_number,
        date: q.date,
        total: q.total,
        status: q.status,
        created_at: q.created_at,
        party_name: q.party_name,
      }));

    const parties = allParties
      .filter(p =>
        p.name?.toLowerCase().includes(searchTerm) ||
        p.phone?.toLowerCase().includes(searchTerm) ||
        p.email?.toLowerCase().includes(searchTerm) ||
        p.gstin?.toLowerCase().includes(searchTerm)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit)
      .map(p => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        email: p.email,
        gstin: p.gstin,
        balance: p.balance,
        type: p.type,
      }));

    const products = allItems
      .filter(i =>
        i.name?.toLowerCase().includes(searchTerm) ||
        i.code?.toLowerCase().includes(searchTerm) ||
        i.hsn?.toLowerCase().includes(searchTerm)
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit)
      .map(i => ({
        id: i.id,
        name: i.name,
        sku: i.code,
        hsn_code: i.hsn,
        price: i.sale_price,
        stock: i.stock,
        unit: i.unit,
      }));

    return { invoices, quotations, parties, products };
  } catch (error) {
    console.error('Global search error:', error);
    return { invoices: [], quotations: [], parties: [], products: [] };
  }
}

export async function getRecentInvoices(limit = 5) {
  try {
    const allInvoices = await getAll(stores.invoices, i => !i.deleted_at);
    return allInvoices
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(i => ({
        id: i.id,
        invoice_number: i.invoice_number,
        date: i.date,
        total: i.total,
        status: i.status,
        party_name: i.party_name,
      }));
  } catch (e) {
    console.error('getRecentInvoices error:', e);
    return [];
  }
}

export async function getTopParties(limit = 5) {
  try {
    const allParties = await getAll(stores.parties, p => !p.deleted_at && p.balance !== 0);
    return allParties
      .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
      .slice(0, limit)
      .map(p => ({
        id: p.id,
        name: p.name,
        phone: p.phone,
        balance: p.balance,
      }));
  } catch (e) {
    console.error('getTopParties error:', e);
    return [];
  }
}

export async function getLowStockProducts(limit = 5) {
  try {
    const allItems = await getAll(stores.items, i => !i.deleted_at && i.min_stock > 0 && i.stock <= i.min_stock);
    return allItems
      .sort((a, b) => a.stock - b.stock)
      .slice(0, limit)
      .map(i => ({
        id: i.id,
        name: i.name,
        stock: i.stock,
        min_stock: i.min_stock,
        unit: i.unit,
      }));
  } catch (e) {
    console.error('getLowStockProducts error:', e);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PURCHASE ORDERS
// ═══════════════════════════════════════════════════════════════════════════

const stores_po = {
  purchase_orders: localforage.createInstance({ name: 'locas', storeName: 'purchase_orders' }),
  po_items:        localforage.createInstance({ name: 'locas', storeName: 'po_items' }),
};

let _poNumberLock = Promise.resolve();

async function nextPoNumber() {
  const result = _poNumberLock.then(async () => {
    const key = 'po_seq';
    const current = (await stores.meta.getItem(key)) || 0;
    const next = current + 1;
    await stores.meta.setItem(key, next);
    return `PO-${String(next).padStart(4, '0')}`;
  });
  _poNumberLock = result.catch(() => {});
  return result;
}

export async function savePurchaseOrder(po, lineItems) {
  let poId;

  if (po.id) {
    // Update existing
    const existing = await stores_po.purchase_orders.getItem(String(po.id));
    // Recalculate po_number: client-provided takes priority; if cleared, fall back to auto number
    const updatedPoNumber = (po.client_po_number && po.client_po_number.trim())
      ? po.client_po_number.trim()
      : (existing.auto_po_number || existing.po_number);
    await stores_po.purchase_orders.setItem(String(po.id), {
      ...existing,
      po_number:        updatedPoNumber,
      client_po_number: po.client_po_number ? po.client_po_number.trim() : '',
      party_id:      po.party_id || null,
      party_name:    po.party_name || '',
      party_gstin:   po.party_gstin || '',
      party_address: po.party_address || '',
      date:          po.date,
      valid_until:   po.valid_until || '',
      notes:         po.notes || '',
      terms:         po.terms || '',
      updated_at:    new Date().toISOString(),
    });
    poId = po.id;

    // Delete old line items, re-insert
    const oldKeys = [];
    await stores_po.po_items.iterate((val, key) => {
      if (val.po_id === Number(po.id)) oldKeys.push(key);
    });
    for (const k of oldKeys) await stores_po.po_items.removeItem(k);

  } else {
    poId = (await (async () => {
      const key = 'po_items_id_seq';
      const cur = (await stores.meta.getItem('po_id_seq')) || 0;
      const next = cur + 1;
      await stores.meta.setItem('po_id_seq', next);
      return next;
    })());
    const autoPoNumber = await nextPoNumber();
    // Use the client-provided PO number if given, otherwise use the auto-generated one
    const poNumber = (po.client_po_number && po.client_po_number.trim())
      ? po.client_po_number.trim()
      : autoPoNumber;
    await stores_po.purchase_orders.setItem(String(poId), {
      id: poId,
      po_number:        poNumber,
      auto_po_number:   autoPoNumber,  // keep auto number for internal reference
      client_po_number: po.client_po_number ? po.client_po_number.trim() : '',
      party_id:      po.party_id || null,
      party_name:    po.party_name || '',
      party_gstin:   po.party_gstin || '',
      party_address: po.party_address || '',
      date:          po.date,
      valid_until:   po.valid_until || '',
      status:        'active',  // active | partial | completed | cancelled
      notes:         po.notes || '',
      terms:         po.terms || '',
      created_at:    new Date().toISOString(),
      updated_at:    new Date().toISOString(),
      deleted_at:    null,
    });
  }

  // Insert line items
  for (const item of lineItems) {
    const itemKey = 'po_items_seq';
    const cur = (await stores.meta.getItem(itemKey)) || 0;
    const next = cur + 1;
    await stores.meta.setItem(itemKey, next);
    await stores_po.po_items.setItem(String(next), {
      id:           next,
      po_id:        poId,
      item_id:      item.item_id || null,
      name:         item.name,
      hsn:          item.hsn || '',
      unit:         item.unit || 'pcs',
      qty_ordered:  item.qty_ordered,
      qty_delivered: 0,
      rate:         item.rate || 0,
      notes:        item.notes || '',
    });
  }

  return poId;
}

export async function getPurchaseOrders(filters = {}) {
  const all = [];
  await stores_po.purchase_orders.iterate((val) => { if (!val.deleted_at) all.push(val); });
  let result = all;
  if (filters.party_id) result = result.filter(p => Number(p.party_id) === Number(filters.party_id));
  if (filters.status)   result = result.filter(p => p.status === filters.status);
  return result.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
}

export async function getPurchaseOrderDetail(id) {
  const po = await stores_po.purchase_orders.getItem(String(id));
  if (!po) return null;
  const items = [];
  await stores_po.po_items.iterate((val) => {
    if (val.po_id === Number(id)) items.push(val);
  });
  return { ...po, items: items.sort((a, b) => a.id - b.id) };
}

export async function getOpenPOsForParty(partyId) {
  // Returns POs for this party that still have undelivered items
  const all = await getPurchaseOrders({ party_id: partyId });
  return all.filter(po => po.status === 'active' || po.status === 'partial');
}

/**
 * Record delivery against a PO when an invoice is created.
 * deliveries = [{ po_item_id, qty_delivered }]
 * Automatically updates PO status (partial / completed).
 */
export async function recordPODelivery(poId, deliveries) {
  for (const d of deliveries) {
    const item = await stores_po.po_items.getItem(String(d.po_item_id));
    if (!item) continue;
    const newDelivered = Math.min(
      item.qty_ordered,
      (item.qty_delivered || 0) + d.qty_delivered
    );
    await stores_po.po_items.setItem(String(d.po_item_id), {
      ...item,
      qty_delivered: newDelivered,
    });
  }

  // Recompute PO status
  const items = [];
  await stores_po.po_items.iterate((val) => {
    if (val.po_id === Number(poId)) items.push(val);
  });

  const allDone = items.every(i => i.qty_delivered >= i.qty_ordered);
  const anyDone = items.some(i => i.qty_delivered > 0);
  const newStatus = allDone ? 'completed' : anyDone ? 'partial' : 'active';

  const po = await stores_po.purchase_orders.getItem(String(poId));
  if (po) {
    await stores_po.purchase_orders.setItem(String(poId), {
      ...po, status: newStatus, updated_at: new Date().toISOString(),
    });
  }
}

export async function updatePOStatus(poId, status) {
  const po = await stores_po.purchase_orders.getItem(String(poId));
  if (po) {
    await stores_po.purchase_orders.setItem(String(poId), {
      ...po, status, updated_at: new Date().toISOString(),
    });
  }
}

export async function deletePurchaseOrder(id) {
  const po = await stores_po.purchase_orders.getItem(String(id));
  if (po) {
    await stores_po.purchase_orders.setItem(String(id), {
      ...po, deleted_at: new Date().toISOString(),
    });
  }
}