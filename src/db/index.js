  // Platform-aware database entry point
  // Automatically uses SQLite on mobile, localforage on web/desktop
  import { Platform } from 'react-native';

  let db;

  if (Platform.OS === 'web') {
    db = require('./db.web');
  } else {
    db = require('./db.native');
  }

  export const getDB                = db.getDB;
  export const getProfile           = db.getProfile;
  export const saveProfile          = db.saveProfile;
  export const getDataOwner         = db.getDataOwner;
  export const setDataOwner         = db.setDataOwner;
  export const peekNextInvoiceNumber = db.peekNextInvoiceNumber;
  export const getParty             = db.getParty;
  export const getParties           = db.getParties;
  export const saveParty            = db.saveParty;
  export const deleteParty          = db.deleteParty;
  export const getItems             = db.getItems;
  export const saveItem             = db.saveItem;
  export const deleteItem           = db.deleteItem;
  export const saveInvoice          = db.saveInvoice;
  export const getInvoices          = db.getInvoices;
  export const getInvoiceDetail     = db.getInvoiceDetail;
  export const recordPayment        = db.recordPayment;
  export const deleteInvoice        = db.deleteInvoice;
  export const getExpenses          = db.getExpenses;
  export const saveExpense          = db.saveExpense;
  export const deleteExpense        = db.deleteExpense;
  export const getDashboardStats    = db.getDashboardStats;
  export const getReportData        = db.getReportData;
  export const exportAllData        = db.exportAllData;
  export const importAllData        = db.importAllData;
  export const migrateFromIndexedDBIfNeeded = db.migrateFromIndexedDBIfNeeded;

  // Quotations
  export const peekNextQuoteNumber       = db.peekNextQuoteNumber;
  export const saveQuotation             = db.saveQuotation;
  export const getQuotations             = db.getQuotations;
  export const getQuotationDetail        = db.getQuotationDetail;
  export const updateQuotationStatus     = db.updateQuotationStatus;
  export const deleteQuotation           = db.deleteQuotation;
  export const convertQuotationToInvoice = db.convertQuotationToInvoice;

  // Dashboard & Search (NEW)
  export const globalSearch         = db.globalSearch;
  export const getRecentInvoices    = db.getRecentInvoices;
  export const getTopParties        = db.getTopParties;
  export const getLowStockProducts  = db.getLowStockProducts;
  // Purchase Orders
  export const savePurchaseOrder     = db.savePurchaseOrder;
  export const getPurchaseOrders     = db.getPurchaseOrders;
  export const getPurchaseOrderDetail = db.getPurchaseOrderDetail;
  export const getOpenPOsForParty    = db.getOpenPOsForParty;
  export const recordPODelivery      = db.recordPODelivery;
  export const updatePOStatus        = db.updatePOStatus;
  export const deletePurchaseOrder   = db.deletePurchaseOrder;