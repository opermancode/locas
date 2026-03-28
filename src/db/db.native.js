import * as SQLite from 'expo-sqlite';

let _db = null;

export async function getDB() {
  if (_db) return _db;
  _db = await SQLite.openDatabaseAsync('locas.db');
  await _db.execAsync('PRAGMA journal_mode = WAL;');
  await _db.execAsync('PRAGMA foreign_keys = ON;');
  await createTables(_db);
  await runMigrations(_db);
  return _db;
}

async function createTables(db) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS business_profile (
      id INTEGER PRIMARY KEY,
      name TEXT DEFAULT '',
      address TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      gstin TEXT DEFAULT '',
      state TEXT DEFAULT '',
      state_code TEXT DEFAULT '',
      pan TEXT DEFAULT '',
      bank_name TEXT DEFAULT '',
      account_no TEXT DEFAULT '',
      ifsc TEXT DEFAULT '',
      invoice_prefix TEXT DEFAULT 'INV',
      invoice_counter INTEGER DEFAULT 0,
      signature TEXT DEFAULT '',
      logo TEXT DEFAULT '',
      upi_id TEXT DEFAULT '',
      show_upi_qr INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS parties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      gstin TEXT DEFAULT '',
      state TEXT DEFAULT '',
      state_code TEXT DEFAULT '',
      pan TEXT DEFAULT '',
      type TEXT DEFAULT 'customer',
      balance REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT DEFAULT '',
      unit TEXT DEFAULT 'pcs',
      hsn TEXT DEFAULT '',
      sale_price REAL DEFAULT 0,
      purchase_price REAL DEFAULT 0,
      gst_rate REAL DEFAULT 18,
      stock REAL DEFAULT 0,
      min_stock REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      type TEXT DEFAULT 'sale',
      party_id INTEGER,
      party_name TEXT DEFAULT '',
      party_gstin TEXT DEFAULT '',
      party_state TEXT DEFAULT '',
      party_state_code TEXT DEFAULT '',
      party_address TEXT DEFAULT '',
      date TEXT NOT NULL,
      due_date TEXT DEFAULT '',
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      taxable REAL DEFAULT 0,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      igst REAL DEFAULT 0,
      total_tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      paid REAL DEFAULT 0,
      status TEXT DEFAULT 'unpaid',
      supply_type TEXT DEFAULT 'intra',
      notes TEXT DEFAULT '',
      terms TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      FOREIGN KEY (party_id) REFERENCES parties(id)
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      item_id INTEGER,
      name TEXT NOT NULL,
      hsn TEXT DEFAULT '',
      unit TEXT DEFAULT 'pcs',
      qty REAL DEFAULT 1,
      rate REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      taxable REAL DEFAULT 0,
      gst_rate REAL DEFAULT 18,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      igst REAL DEFAULT 0,
      total REAL DEFAULT 0,
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      method TEXT DEFAULT 'cash',
      reference TEXT DEFAULT '',
      date TEXT NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (invoice_id) REFERENCES invoices(id)
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT DEFAULT 'Other',
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      party_id INTEGER,
      party_name TEXT DEFAULT '',
      bill_no TEXT DEFAULT '',
      method TEXT DEFAULT 'cash',
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS quotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_number TEXT UNIQUE NOT NULL,
      party_id INTEGER,
      party_name TEXT DEFAULT '',
      party_gstin TEXT DEFAULT '',
      party_state TEXT DEFAULT '',
      party_state_code TEXT DEFAULT '',
      party_address TEXT DEFAULT '',
      date TEXT NOT NULL,
      valid_until TEXT DEFAULT '',
      subtotal REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      taxable REAL DEFAULT 0,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      igst REAL DEFAULT 0,
      total_tax REAL DEFAULT 0,
      total REAL DEFAULT 0,
      status TEXT DEFAULT 'draft',
      supply_type TEXT DEFAULT 'intra',
      converted_invoice_id INTEGER,
      notes TEXT DEFAULT '',
      terms TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      FOREIGN KEY (party_id) REFERENCES parties(id),
      FOREIGN KEY (converted_invoice_id) REFERENCES invoices(id)
    );

    CREATE TABLE IF NOT EXISTS quotation_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quotation_id INTEGER NOT NULL,
      item_id INTEGER,
      name TEXT NOT NULL,
      hsn TEXT DEFAULT '',
      unit TEXT DEFAULT 'pcs',
      qty REAL DEFAULT 1,
      rate REAL DEFAULT 0,
      discount REAL DEFAULT 0,
      taxable REAL DEFAULT 0,
      gst_rate REAL DEFAULT 18,
      cgst REAL DEFAULT 0,
      sgst REAL DEFAULT 0,
      igst REAL DEFAULT 0,
      total REAL DEFAULT 0,
      FOREIGN KEY (quotation_id) REFERENCES quotations(id)
    );

    INSERT OR IGNORE INTO business_profile (id, name) VALUES (1, 'My Business');

    CREATE INDEX IF NOT EXISTS idx_invoices_deleted_date
      ON invoices(deleted_at, date);
    CREATE INDEX IF NOT EXISTS idx_invoices_party
      ON invoices(party_id);
    CREATE INDEX IF NOT EXISTS idx_invoices_type_status
      ON invoices(type, status);
    CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice
      ON invoice_items(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_payments_invoice
      ON payments(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_deleted_date
      ON expenses(deleted_at, date);
    CREATE INDEX IF NOT EXISTS idx_parties_deleted
      ON parties(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_items_deleted
      ON items(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_quotations_deleted_date
      ON quotations(deleted_at, date);
    CREATE INDEX IF NOT EXISTS idx_quotations_status
      ON quotations(status);
    CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation
      ON quotation_items(quotation_id);
  `);
}

// ─── Migrations ───────────────────────────────────────────────────
// Runs every startup — ALTER TABLE is ignored if column already exists
async function runMigrations(db) {
  try {
    await db.execAsync(`ALTER TABLE business_profile ADD COLUMN upi_id TEXT DEFAULT ''`);
  } catch (e) { /* already exists */ }

  try {
    await db.execAsync(`ALTER TABLE business_profile ADD COLUMN show_upi_qr INTEGER DEFAULT 0`);
  } catch (e) { /* already exists */ }

  try {
    await db.execAsync(`ALTER TABLE business_profile ADD COLUMN quote_prefix TEXT DEFAULT 'QUO'`);
  } catch (e) { /* already exists */ }

  try {
    await db.execAsync(`ALTER TABLE business_profile ADD COLUMN quote_counter INTEGER DEFAULT 0`);
  } catch (e) { /* already exists */ }

  // License/ownership fields
  try {
    await db.execAsync(`ALTER TABLE business_profile ADD COLUMN owner_email TEXT DEFAULT NULL`);
  } catch (e) { /* already exists */ }

  try {
    await db.execAsync(`ALTER TABLE business_profile ADD COLUMN owner_set_at TEXT DEFAULT NULL`);
  } catch (e) { /* already exists */ }
}

// ─── Data Ownership (License Lock) ────────────────────────────────
export async function getDataOwner() {
  const db = await getDB();
  const row = await db.getFirstAsync('SELECT owner_email FROM business_profile WHERE id = 1');
  return row?.owner_email || null;
}

export async function setDataOwner(email) {
  const db = await getDB();
  await db.runAsync(
    `UPDATE business_profile SET owner_email=?, owner_set_at=datetime('now') WHERE id=1`,
    [email.toLowerCase()]
  );
}

// ─── Business Profile ───────────────────────────────────────────
export async function getProfile() {
  const db = await getDB();
  return await db.getFirstAsync('SELECT * FROM business_profile WHERE id = 1');
}

export async function saveProfile(data) {
  const db = await getDB();
  await db.runAsync(
    `UPDATE business_profile SET
      name=?, address=?, phone=?, email=?, gstin=?, state=?,
      state_code=?, pan=?, bank_name=?, account_no=?, ifsc=?,
      invoice_prefix=?, upi_id=?, show_upi_qr=?,
      updated_at=datetime('now')
     WHERE id=1`,
    [
      data.name||'', data.address||'', data.phone||'', data.email||'',
      data.gstin||'', data.state||'', data.state_code||'', data.pan||'',
      data.bank_name||'', data.account_no||'', data.ifsc||'',
      data.invoice_prefix||'INV',
      data.upi_id||'',
      data.show_upi_qr ? 1 : 0,
    ]
  );
}

// ─── Invoice Number ──────────────────────────────────────────────

// Read-only preview — safe to call on screen mount without side effects.
// Use this to display the upcoming invoice number to the user.
export async function peekNextInvoiceNumber() {
  const db = await getDB();
  const profile = await db.getFirstAsync('SELECT invoice_prefix, invoice_counter FROM business_profile WHERE id=1');
  const next = (profile.invoice_counter || 0) + 1;
  return `${profile.invoice_prefix || 'INV'}-${String(next).padStart(4, '0')}`;
}

// Increments the counter and returns the number. Called only from saveInvoice
// so the counter only advances when an invoice is actually committed.
async function consumeNextInvoiceNumber(db) {
  const profile = await db.getFirstAsync('SELECT invoice_prefix, invoice_counter FROM business_profile WHERE id=1');
  const next = (profile.invoice_counter || 0) + 1;
  await db.runAsync('UPDATE business_profile SET invoice_counter=? WHERE id=1', [next]);
  return `${profile.invoice_prefix || 'INV'}-${String(next).padStart(4, '0')}`;
}

// ─── Parties ─────────────────────────────────────────────────────
export async function getParties(type = null) {
  const db = await getDB();
  if (type) return await db.getAllAsync('SELECT * FROM parties WHERE deleted_at IS NULL AND type=? ORDER BY name', [type]);
  return await db.getAllAsync('SELECT * FROM parties WHERE deleted_at IS NULL ORDER BY name');
}

export async function saveParty(data) {
  const db = await getDB();
  if (data.id) {
    await db.runAsync(
      `UPDATE parties SET name=?,phone=?,email=?,address=?,gstin=?,state=?,state_code=?,pan=?,type=?,updated_at=datetime('now') WHERE id=?`,
      [data.name,data.phone||'',data.email||'',data.address||'',data.gstin||'',
       data.state||'',data.state_code||'',data.pan||'',data.type||'customer',data.id]
    );
    return data.id;
  } else {
    const r = await db.runAsync(
      `INSERT INTO parties (name,phone,email,address,gstin,state,state_code,pan,type) VALUES (?,?,?,?,?,?,?,?,?)`,
      [data.name,data.phone||'',data.email||'',data.address||'',data.gstin||'',
       data.state||'',data.state_code||'',data.pan||'',data.type||'customer']
    );
    return r.lastInsertRowId;
  }
}

export async function deleteParty(id) {
  const db = await getDB();
  await db.runAsync(`UPDATE parties SET deleted_at=datetime('now') WHERE id=?`, [id]);
}

// ─── Items ───────────────────────────────────────────────────────
export async function getItems() {
  const db = await getDB();
  return await db.getAllAsync('SELECT * FROM items WHERE deleted_at IS NULL ORDER BY name');
}

export async function saveItem(data) {
  const db = await getDB();
  if (data.id) {
    await db.runAsync(
      `UPDATE items SET name=?,code=?,unit=?,hsn=?,sale_price=?,purchase_price=?,gst_rate=?,stock=?,min_stock=?,updated_at=datetime('now') WHERE id=?`,
      [data.name,data.code||'',data.unit||'pcs',data.hsn||'',
       data.sale_price||0,data.purchase_price||0,data.gst_rate||18,
       data.stock||0,data.min_stock||0,data.id]
    );
  } else {
    const r = await db.runAsync(
      `INSERT INTO items (name,code,unit,hsn,sale_price,purchase_price,gst_rate,stock,min_stock) VALUES (?,?,?,?,?,?,?,?,?)`,
      [data.name,data.code||'',data.unit||'pcs',data.hsn||'',
       data.sale_price||0,data.purchase_price||0,data.gst_rate||18,
       data.stock||0,data.min_stock||0]
    );
    return r.lastInsertRowId;
  }
}

export async function deleteItem(id) {
  const db = await getDB();
  await db.runAsync(`UPDATE items SET deleted_at=datetime('now') WHERE id=?`, [id]);
}

// ─── Invoices ────────────────────────────────────────────────────
export async function saveInvoice(invoice, lineItems) {
  const db = await getDB();
  let invoiceId;
  await db.withTransactionAsync(async () => {
    if (invoice.id) {
      // Fetch old total before updating so we can adjust the party balance by the delta.
      const oldInvoice = await db.getFirstAsync(
        'SELECT total, party_id, type FROM invoices WHERE id=?', [invoice.id]
      );
      await db.runAsync(
        `UPDATE invoices SET party_id=?,party_name=?,party_gstin=?,party_state=?,party_state_code=?,party_address=?,
         date=?,due_date=?,subtotal=?,discount=?,taxable=?,cgst=?,sgst=?,igst=?,total_tax=?,total=?,
         supply_type=?,notes=?,terms=?,updated_at=datetime('now') WHERE id=?`,
        [invoice.party_id||null,invoice.party_name||'',invoice.party_gstin||'',
         invoice.party_state||'',invoice.party_state_code||'',invoice.party_address||'',
         invoice.date,invoice.due_date||'',invoice.subtotal||0,invoice.discount||0,
         invoice.taxable||0,invoice.cgst||0,invoice.sgst||0,invoice.igst||0,
         invoice.total_tax||0,invoice.total||0,invoice.supply_type||'intra',
         invoice.notes||'',invoice.terms||'',invoice.id]
      );
      invoiceId = invoice.id;

      // Restore stock for the old line items before wiping them.
      // This reverses the deduction that happened when the invoice was originally saved,
      // so the subsequent insert can deduct the correct new quantities cleanly.
      const oldItems = await db.getAllAsync(
        'SELECT item_id, qty FROM invoice_items WHERE invoice_id=?',
        [invoiceId]
      );
      for (const old of oldItems) {
        if (old.item_id && invoice.type === 'sale') {
          await db.runAsync('UPDATE items SET stock=stock+? WHERE id=?', [old.qty, old.item_id]);
        }
      }

      await db.runAsync('DELETE FROM invoice_items WHERE invoice_id=?', [invoiceId]);

      // Adjust party balance — handle party change correctly.
      if (oldInvoice?.type === 'sale') {
        const oldPartyId = oldInvoice.party_id;
        const newPartyId = invoice.party_id;
        if (oldPartyId && oldPartyId !== newPartyId) {
          // Party changed: reverse old party's outstanding balance entirely
          const outstanding = (oldInvoice.total || 0) - (oldInvoice.paid || 0);
          if (outstanding !== 0)
            await db.runAsync('UPDATE parties SET balance=balance-? WHERE id=?', [outstanding, oldPartyId]);
          // Add full new total to the new party
          if (newPartyId)
            await db.runAsync('UPDATE parties SET balance=balance+? WHERE id=?', [invoice.total || 0, newPartyId]);
        } else if (newPartyId) {
          // Same party: apply only the delta
          const delta = (invoice.total || 0) - (oldInvoice.total || 0);
          if (delta !== 0)
            await db.runAsync('UPDATE parties SET balance=balance+? WHERE id=?', [delta, newPartyId]);
        }
      }
    } else {
      const invoiceNumber = await consumeNextInvoiceNumber(db);
      const r = await db.runAsync(
        `INSERT INTO invoices (invoice_number,type,party_id,party_name,party_gstin,party_state,party_state_code,
         party_address,date,due_date,subtotal,discount,taxable,cgst,sgst,igst,total_tax,total,supply_type,notes,terms)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [invoiceNumber,invoice.type||'sale',invoice.party_id||null,
         invoice.party_name||'',invoice.party_gstin||'',invoice.party_state||'',
         invoice.party_state_code||'',invoice.party_address||'',invoice.date,
         invoice.due_date||'',invoice.subtotal||0,invoice.discount||0,invoice.taxable||0,
         invoice.cgst||0,invoice.sgst||0,invoice.igst||0,invoice.total_tax||0,
         invoice.total||0,invoice.supply_type||'intra',invoice.notes||'',invoice.terms||'']
      );
      invoiceId = r.lastInsertRowId;

      // Increment party balance to reflect the new receivable.
      if (invoice.party_id && (invoice.type || 'sale') === 'sale') {
        await db.runAsync('UPDATE parties SET balance=balance+? WHERE id=?',
          [invoice.total || 0, invoice.party_id]);
      }
    }
    for (const item of lineItems) {
      await db.runAsync(
        `INSERT INTO invoice_items (invoice_id,item_id,name,hsn,unit,qty,rate,discount,taxable,gst_rate,cgst,sgst,igst,total)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [invoiceId,item.item_id||null,item.name,item.hsn||'',item.unit||'pcs',
         item.qty,item.rate,item.discount||0,item.taxable,item.gst_rate||18,
         item.cgst||0,item.sgst||0,item.igst||0,item.total]
      );
      if (item.item_id && invoice.type === 'sale') {
        await db.runAsync('UPDATE items SET stock=stock-? WHERE id=?', [item.qty, item.item_id]);
      }
    }
  });
  return invoiceId;
}

export async function getInvoices(filters = {}) {
  const db = await getDB();
  let where = "WHERE i.deleted_at IS NULL";
  const params = [];
  if (filters.status) { where += ' AND i.status=?'; params.push(filters.status); }
  if (filters.type)   { where += ' AND i.type=?';   params.push(filters.type); }
  if (filters.from)   { where += ' AND i.date>=?';  params.push(filters.from); }
  if (filters.to)     { where += ' AND i.date<=?';  params.push(filters.to); }
  return await db.getAllAsync(
    `SELECT i.*, p.phone as party_phone FROM invoices i LEFT JOIN parties p ON i.party_id=p.id ${where} ORDER BY i.date DESC, i.id DESC`,
    params
  );
}

export async function getInvoiceDetail(id) {
  const db = await getDB();
  const invoice = await db.getFirstAsync('SELECT * FROM invoices WHERE id=?', [id]);
  if (!invoice) return null;
  invoice.items    = await db.getAllAsync('SELECT * FROM invoice_items WHERE invoice_id=?', [id]);
  invoice.payments = await db.getAllAsync('SELECT * FROM payments WHERE invoice_id=? ORDER BY date DESC', [id]);
  return invoice;
}

export async function recordPayment(invoiceId, amount, method, reference, date, note) {
  const db = await getDB();

  // Fetch first so we can validate before writing anything.
  const inv = await db.getFirstAsync('SELECT total, paid, party_id FROM invoices WHERE id=?', [invoiceId]);
  const outstanding = (inv.total || 0) - (inv.paid || 0);
  if (amount > outstanding + 0.001) {
    // Allow a tiny floating-point tolerance; reject anything meaningfully over.
    throw new Error(`Payment of ${amount} exceeds outstanding balance of ${outstanding.toFixed(2)}`);
  }

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO payments (invoice_id,amount,method,reference,date,note) VALUES (?,?,?,?,?,?)`,
      [invoiceId, amount, method||'cash', reference||'', date, note||'']
    );
    const newPaid = (inv.paid || 0) + amount;
    const status  = newPaid >= inv.total ? 'paid' : 'partial';
    await db.runAsync(
      `UPDATE invoices SET paid=?, status=?, updated_at=datetime('now') WHERE id=?`,
      [newPaid, status, invoiceId]
    );
    if (inv.party_id) {
      await db.runAsync('UPDATE parties SET balance=balance-? WHERE id=?', [amount, inv.party_id]);
    }
  });
}

export async function deleteInvoice(id) {
  const db = await getDB();
  await db.withTransactionAsync(async () => {
    const inv = await db.getFirstAsync('SELECT * FROM invoices WHERE id=?', [id]);
    if (!inv || inv.deleted_at) return; // already deleted

    // Soft-delete the invoice
    await db.runAsync(`UPDATE invoices SET deleted_at=datetime('now') WHERE id=?`, [id]);

    // Reverse party balance: subtract only the outstanding (unpaid) amount
    if (inv.party_id && inv.type === 'sale') {
      const outstanding = (inv.total || 0) - (inv.paid || 0);
      if (outstanding !== 0)
        await db.runAsync('UPDATE parties SET balance=balance-? WHERE id=?', [outstanding, inv.party_id]);
    }

    // Restore stock for each linked inventory item
    if (inv.type === 'sale') {
      const items = await db.getAllAsync(
        'SELECT item_id, qty FROM invoice_items WHERE invoice_id=?', [id]
      );
      for (const it of items) {
        if (it.item_id)
          await db.runAsync('UPDATE items SET stock=stock+? WHERE id=?', [it.qty, it.item_id]);
      }
    }
  });
}

// ─── Expenses ────────────────────────────────────────────────────
export async function getExpenses(filters = {}) {
  const db = await getDB();
  let where = 'WHERE deleted_at IS NULL';
  const params = [];
  if (filters.from) { where += ' AND date>=?'; params.push(filters.from); }
  if (filters.to)   { where += ' AND date<=?'; params.push(filters.to); }
  return await db.getAllAsync(
    `SELECT * FROM expenses ${where} ORDER BY date DESC, id DESC`,
    params
  );
}

export async function saveExpense(data) {
  const db = await getDB();
  if (data.id) {
    await db.runAsync(
      `UPDATE expenses SET category=?,amount=?,date=?,party_name=?,bill_no=?,method=?,note=?,updated_at=datetime('now') WHERE id=?`,
      [data.category||'Other',data.amount,data.date,data.party_name||'',data.bill_no||'',data.method||'cash',data.note||'',data.id]
    );
  } else {
    await db.runAsync(
      `INSERT INTO expenses (category,amount,date,party_name,bill_no,method,note) VALUES (?,?,?,?,?,?,?)`,
      [data.category||'Other',data.amount,data.date,data.party_name||'',data.bill_no||'',data.method||'cash',data.note||'']
    );
  }
}

export async function deleteExpense(id) {
  const db = await getDB();
  await db.runAsync(`UPDATE expenses SET deleted_at=datetime('now') WHERE id=?`, [id]);
}

// ─── Dashboard Stats ─────────────────────────────────────────────
export async function getDashboardStats() {
  const db = await getDB();
  const now  = new Date();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  const monthStart = `${yyyy}-${mm}-01`;
  // Day 0 of next month = last day of current month, works correctly for all months.
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString().split('T')[0];

  const [sales, expenses, receivables, payables, topCustomers, collected] = await Promise.all([
    db.getFirstAsync(
      `SELECT COALESCE(SUM(total),0) as total, COUNT(*) as count
       FROM invoices WHERE deleted_at IS NULL AND type='sale' AND date>=? AND date<=?`,
      [monthStart, monthEnd]
    ),
    db.getFirstAsync(
      `SELECT COALESCE(SUM(amount),0) as total
       FROM expenses WHERE deleted_at IS NULL AND date>=? AND date<=?`,
      [monthStart, monthEnd]
    ),
    db.getFirstAsync(
      `SELECT COALESCE(SUM(total-paid),0) as total
       FROM invoices WHERE deleted_at IS NULL AND type='sale' AND status != 'paid'`
    ),
    db.getFirstAsync(
      `SELECT COALESCE(SUM(total-paid),0) as total
       FROM invoices WHERE deleted_at IS NULL AND type='purchase' AND status != 'paid'`
    ),
    db.getAllAsync(
      `SELECT party_name, COALESCE(SUM(total),0) as total
       FROM invoices WHERE deleted_at IS NULL AND type='sale' AND date>=? AND date<=?
       GROUP BY party_name ORDER BY total DESC LIMIT 5`,
      [monthStart, monthEnd]
    ),
    db.getFirstAsync(
      `SELECT COALESCE(SUM(paid),0) as total
       FROM invoices WHERE deleted_at IS NULL AND type='sale' AND date>=? AND date<=?`,
      [monthStart, monthEnd]
    ),
  ]);

  return { sales, expenses, receivables, payables, topCustomers, collected };
}

// ─── Reports ─────────────────────────────────────────────────────
export async function getReportData(from, to) {
  const db = await getDB();
  const [sales, purchases, expenses, gst] = await Promise.all([
    db.getAllAsync(
      `SELECT * FROM invoices WHERE deleted_at IS NULL AND type='sale' AND date>=? AND date<=? ORDER BY date`,
      [from, to]
    ),
    db.getAllAsync(
      `SELECT * FROM invoices WHERE deleted_at IS NULL AND type='purchase' AND date>=? AND date<=? ORDER BY date`,
      [from, to]
    ),
    db.getAllAsync(
      `SELECT * FROM expenses WHERE deleted_at IS NULL AND date>=? AND date<=? ORDER BY date`,
      [from, to]
    ),
    db.getFirstAsync(
      `SELECT COALESCE(SUM(cgst),0) as cgst, COALESCE(SUM(sgst),0) as sgst,
              COALESCE(SUM(igst),0) as igst, COALESCE(SUM(total_tax),0) as total
       FROM invoices WHERE deleted_at IS NULL AND type='sale' AND date>=? AND date<=?`,
      [from, to]
    ),
  ]);
  return { sales, purchases, expenses, gst };
}

// ─── Backup / Restore ────────────────────────────────────────────
export async function exportAllData() {
  const db = await getDB();
  const [profile, parties, items, invoices, invoiceItems, payments, expenses] = await Promise.all([
    db.getAllAsync('SELECT * FROM business_profile'),
    db.getAllAsync('SELECT * FROM parties'),
    db.getAllAsync('SELECT * FROM items'),
    db.getAllAsync('SELECT * FROM invoices'),
    db.getAllAsync('SELECT * FROM invoice_items'),
    db.getAllAsync('SELECT * FROM payments'),
    db.getAllAsync('SELECT * FROM expenses'),
  ]);
  return JSON.stringify({
    version: 1,
    exported_at: new Date().toISOString(),
    profile,
    parties,
    items,
    invoices,
    invoice_items: invoiceItems,
    payments,
    expenses,
  }, null, 2);
}

export async function importAllData(jsonString) {
  const data = JSON.parse(jsonString);
  if (data.version !== 1) throw new Error('Unsupported backup version');
  const db = await getDB();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM payments');
    await db.runAsync('DELETE FROM invoice_items');
    await db.runAsync('DELETE FROM invoices');
    await db.runAsync('DELETE FROM expenses');
    await db.runAsync('DELETE FROM items');
    await db.runAsync('DELETE FROM parties');

    if (data.profile?.[0]) {
      const p = data.profile[0];
      await db.runAsync(
        `UPDATE business_profile SET
          name=?,address=?,phone=?,email=?,gstin=?,state=?,state_code=?,pan=?,
          bank_name=?,account_no=?,ifsc=?,invoice_prefix=?,invoice_counter=?,
          upi_id=?,show_upi_qr=?,updated_at=datetime('now')
         WHERE id=1`,
        [p.name||'',p.address||'',p.phone||'',p.email||'',p.gstin||'',
         p.state||'',p.state_code||'',p.pan||'',p.bank_name||'',p.account_no||'',
         p.ifsc||'',p.invoice_prefix||'INV',p.invoice_counter||0,
         p.upi_id||'',p.show_upi_qr||0]
      );
    }
    for (const row of data.parties||[]) {
      await db.runAsync(
        `INSERT INTO parties (id,name,phone,email,address,gstin,state,state_code,pan,type,balance,created_at,updated_at,deleted_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [row.id,row.name,row.phone||'',row.email||'',row.address||'',row.gstin||'',
         row.state||'',row.state_code||'',row.pan||'',row.type||'customer',
         row.balance||0,row.created_at,row.updated_at,row.deleted_at||null]
      );
    }
    for (const row of data.items||[]) {
      await db.runAsync(
        `INSERT INTO items (id,name,code,unit,hsn,sale_price,purchase_price,gst_rate,stock,min_stock,created_at,updated_at,deleted_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [row.id,row.name,row.code||'',row.unit||'pcs',row.hsn||'',
         row.sale_price||0,row.purchase_price||0,row.gst_rate||18,
         row.stock||0,row.min_stock||0,row.created_at,row.updated_at,row.deleted_at||null]
      );
    }
    for (const row of data.invoices||[]) {
      await db.runAsync(
        `INSERT INTO invoices (id,invoice_number,type,party_id,party_name,party_gstin,party_state,
         party_state_code,party_address,date,due_date,subtotal,discount,taxable,cgst,sgst,igst,
         total_tax,total,paid,status,supply_type,notes,terms,created_at,updated_at,deleted_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [row.id,row.invoice_number,row.type||'sale',row.party_id||null,
         row.party_name||'',row.party_gstin||'',row.party_state||'',row.party_state_code||'',
         row.party_address||'',row.date,row.due_date||'',row.subtotal||0,row.discount||0,
         row.taxable||0,row.cgst||0,row.sgst||0,row.igst||0,row.total_tax||0,row.total||0,
         row.paid||0,row.status||'unpaid',row.supply_type||'intra',
         row.notes||'',row.terms||'',row.created_at,row.updated_at,row.deleted_at||null]
      );
    }
    for (const row of data.invoice_items||[]) {
      await db.runAsync(
        `INSERT INTO invoice_items (id,invoice_id,item_id,name,hsn,unit,qty,rate,discount,taxable,gst_rate,cgst,sgst,igst,total)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [row.id,row.invoice_id,row.item_id||null,row.name,row.hsn||'',row.unit||'pcs',
         row.qty,row.rate,row.discount||0,row.taxable,row.gst_rate||18,
         row.cgst||0,row.sgst||0,row.igst||0,row.total]
      );
    }
    for (const row of data.payments||[]) {
      await db.runAsync(
        `INSERT INTO payments (id,invoice_id,amount,method,reference,date,note,created_at)
         VALUES (?,?,?,?,?,?,?,?)`,
        [row.id,row.invoice_id,row.amount,row.method||'cash',
         row.reference||'',row.date,row.note||'',row.created_at]
      );
    }
    for (const row of data.expenses||[]) {
      await db.runAsync(
        `INSERT INTO expenses (id,category,amount,date,party_name,bill_no,method,note,created_at,updated_at,deleted_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [row.id,row.category||'Other',row.amount,row.date,
         row.party_name||'',row.bill_no||'',row.method||'cash',
         row.note||'',row.created_at,row.updated_at,row.deleted_at||null]
      );
    }
    for (const row of data.quotations||[]) {
      await db.runAsync(
        `INSERT INTO quotations (id,quote_number,party_id,party_name,party_gstin,party_state,party_state_code,
         party_address,date,valid_until,subtotal,discount,taxable,cgst,sgst,igst,total_tax,total,status,
         supply_type,converted_invoice_id,notes,terms,created_at,updated_at,deleted_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [row.id,row.quote_number,row.party_id,row.party_name||'',row.party_gstin||'',
         row.party_state||'',row.party_state_code||'',row.party_address||'',row.date,
         row.valid_until||'',row.subtotal||0,row.discount||0,row.taxable||0,row.cgst||0,
         row.sgst||0,row.igst||0,row.total_tax||0,row.total||0,row.status||'draft',
         row.supply_type||'intra',row.converted_invoice_id||null,row.notes||'',row.terms||'',
         row.created_at,row.updated_at,row.deleted_at||null]
      );
    }
    for (const row of data.quotation_items||[]) {
      await db.runAsync(
        `INSERT INTO quotation_items (id,quotation_id,item_id,name,hsn,unit,qty,rate,discount,taxable,gst_rate,cgst,sgst,igst,total)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [row.id,row.quotation_id,row.item_id||null,row.name,row.hsn||'',row.unit||'pcs',
         row.qty,row.rate,row.discount||0,row.taxable||0,row.gst_rate||18,
         row.cgst||0,row.sgst||0,row.igst||0,row.total||0]
      );
    }
  });
}

// ─── Quotation Number ─────────────────────────────────────────────────────

export async function peekNextQuoteNumber() {
  const db = await getDB();
  const profile = await db.getFirstAsync('SELECT quote_prefix, quote_counter FROM business_profile WHERE id=1');
  const next = (profile.quote_counter || 0) + 1;
  return `${profile.quote_prefix || 'QUO'}-${String(next).padStart(4, '0')}`;
}

async function consumeNextQuoteNumber(db) {
  const profile = await db.getFirstAsync('SELECT quote_prefix, quote_counter FROM business_profile WHERE id=1');
  const next = (profile.quote_counter || 0) + 1;
  await db.runAsync('UPDATE business_profile SET quote_counter=? WHERE id=1', [next]);
  return `${profile.quote_prefix || 'QUO'}-${String(next).padStart(4, '0')}`;
}

// ─── Quotations CRUD ──────────────────────────────────────────────────────

export async function saveQuotation(quotation, lineItems) {
  const db = await getDB();
  let quotationId;
  
  await db.withTransactionAsync(async () => {
    if (quotation.id) {
      // Update existing quotation
      await db.runAsync(
        `UPDATE quotations SET party_id=?,party_name=?,party_gstin=?,party_state=?,party_state_code=?,party_address=?,
         date=?,valid_until=?,subtotal=?,discount=?,taxable=?,cgst=?,sgst=?,igst=?,total_tax=?,total=?,
         supply_type=?,notes=?,terms=?,updated_at=datetime('now') WHERE id=?`,
        [quotation.party_id||null,quotation.party_name||'',quotation.party_gstin||'',
         quotation.party_state||'',quotation.party_state_code||'',quotation.party_address||'',
         quotation.date,quotation.valid_until||'',quotation.subtotal||0,quotation.discount||0,
         quotation.taxable||0,quotation.cgst||0,quotation.sgst||0,quotation.igst||0,
         quotation.total_tax||0,quotation.total||0,quotation.supply_type||'intra',
         quotation.notes||'',quotation.terms||'',quotation.id]
      );
      quotationId = quotation.id;
      
      // Delete old line items
      await db.runAsync('DELETE FROM quotation_items WHERE quotation_id=?', [quotationId]);
    } else {
      // Create new quotation
      const quoteNumber = await consumeNextQuoteNumber(db);
      const r = await db.runAsync(
        `INSERT INTO quotations (quote_number,party_id,party_name,party_gstin,party_state,party_state_code,
         party_address,date,valid_until,subtotal,discount,taxable,cgst,sgst,igst,total_tax,total,supply_type,notes,terms)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [quoteNumber,quotation.party_id||null,
         quotation.party_name||'',quotation.party_gstin||'',quotation.party_state||'',
         quotation.party_state_code||'',quotation.party_address||'',quotation.date,
         quotation.valid_until||'',quotation.subtotal||0,quotation.discount||0,quotation.taxable||0,
         quotation.cgst||0,quotation.sgst||0,quotation.igst||0,quotation.total_tax||0,
         quotation.total||0,quotation.supply_type||'intra',quotation.notes||'',quotation.terms||'']
      );
      quotationId = r.lastInsertRowId;
    }
    
    // Insert line items
    for (const item of lineItems) {
      await db.runAsync(
        `INSERT INTO quotation_items (quotation_id,item_id,name,hsn,unit,qty,rate,discount,taxable,gst_rate,cgst,sgst,igst,total)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [quotationId,item.item_id||null,item.name,item.hsn||'',item.unit||'pcs',
         item.qty,item.rate,item.discount||0,item.taxable||0,item.gst_rate||18,
         item.cgst||0,item.sgst||0,item.igst||0,item.total||0]
      );
    }
  });
  
  return quotationId;
}

export async function getQuotations(filters = {}) {
  const db = await getDB();
  let where = 'WHERE deleted_at IS NULL';
  const params = [];
  
  if (filters.status) {
    where += ' AND status = ?';
    params.push(filters.status);
  }
  if (filters.from) {
    where += ' AND date >= ?';
    params.push(filters.from);
  }
  if (filters.to) {
    where += ' AND date <= ?';
    params.push(filters.to);
  }
  if (filters.search) {
    where += ' AND (quote_number LIKE ? OR party_name LIKE ?)';
    params.push(`%${filters.search}%`, `%${filters.search}%`);
  }
  
  return await db.getAllAsync(
    `SELECT * FROM quotations ${where} ORDER BY date DESC, id DESC`,
    params
  );
}

export async function getQuotationDetail(id) {
  const db = await getDB();
  const quotation = await db.getFirstAsync('SELECT * FROM quotations WHERE id=?', [id]);
  if (!quotation) return null;
  
  const items = await db.getAllAsync('SELECT * FROM quotation_items WHERE quotation_id=?', [id]);
  return { ...quotation, items };
}

export async function updateQuotationStatus(id, status) {
  const db = await getDB();
  await db.runAsync(
    'UPDATE quotations SET status=?, updated_at=datetime(\'now\') WHERE id=?',
    [status, id]
  );
}

export async function deleteQuotation(id) {
  const db = await getDB();
  await db.runAsync(
    'UPDATE quotations SET deleted_at=datetime(\'now\') WHERE id=?',
    [id]
  );
}

// ─── Convert Quotation to Invoice ─────────────────────────────────────────

export async function convertQuotationToInvoice(quotationId) {
  const db = await getDB();
  
  // Get quotation details
  const quotation = await getQuotationDetail(quotationId);
  if (!quotation) throw new Error('Quotation not found');
  if (quotation.status === 'converted') throw new Error('Quotation already converted');
  
  // Prepare invoice data
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
  
  // Prepare line items
  const lineItems = quotation.items.map(item => ({
    item_id: item.item_id,
    name: item.name,
    hsn: item.hsn,
    unit: item.unit,
    qty: item.qty,
    rate: item.rate,
    discount: item.discount,
    taxable: item.taxable,
    gst_rate: item.gst_rate,
    cgst: item.cgst,
    sgst: item.sgst,
    igst: item.igst,
    total: item.total,
  }));
  
  // Save invoice
  const invoiceId = await saveInvoice(invoiceData, lineItems);
  
  // Update quotation status
  await db.runAsync(
    'UPDATE quotations SET status=?, converted_invoice_id=?, updated_at=datetime(\'now\') WHERE id=?',
    ['converted', invoiceId, quotationId]
  );
  
  return invoiceId;
}