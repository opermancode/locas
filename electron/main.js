// @ts-nocheck
/* eslint-disable */
'use strict';

const { app, BrowserWindow, shell, ipcMain, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    title: 'Locas — Smart Billing',
    backgroundColor: '#FFF8F4',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  mainWindow.once('ready-to-show', function() {
    mainWindow.show();
  });

  // Allow external URLs (like support page) to open in browser
  mainWindow.webContents.setWindowOpenHandler(function(details) {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', function() {
    mainWindow = null;
  });
}

// ── IPC: Save PDF ──────────────────────────────────────────────────
ipcMain.handle('save-pdf', async (event, { html, filename }) => {
  try {
    // 1. Show save dialog so user picks where to save
    const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Invoice as PDF',
      defaultPath: filename || 'Invoice.pdf',
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });

    if (canceled || !filePath) return { success: false, reason: 'canceled' };

    // 2. Create a hidden BrowserWindow to render the HTML
    const pdfWin = new BrowserWindow({
      width: 900, height: 1200,
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    // Load the HTML content
    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    // Wait for fonts/images to render
    await new Promise(r => setTimeout(r, 600));

    // 3. Print to PDF
    const pdfBuffer = await pdfWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    });

    pdfWin.close();

    // 4. Write to disk
    fs.writeFileSync(filePath, pdfBuffer);

    // 5. Open the saved PDF in default viewer
    shell.openPath(filePath);

    return { success: true, filePath };
  } catch (e) {
    console.error('PDF save error:', e);
    return { success: false, reason: e.message };
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', function() {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});