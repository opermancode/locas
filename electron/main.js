const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    title: 'Locas — Smart Billing',
    backgroundColor: '#0F0F0F',
    show: false,
  });

  // Load the Expo web build
  const startUrl = app.isPackaged
  ? path.join(process.resourcesPath, 'app.asar', 'web-build', 'index.html')
  : path.join(__dirname, '../web-build/index.html');

mainWindow.loadFile(startUrl);

  // Show window when ready to avoid white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});