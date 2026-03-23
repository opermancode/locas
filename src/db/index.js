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
export const peekNextInvoiceNumber = db.peekNextInvoiceNumber;
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