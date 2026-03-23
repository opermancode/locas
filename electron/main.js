const { app, BrowserWindow, shell } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    title: 'Locas — Smart Billing',
    backgroundColor: '#FFF8F4',
    show: false,
  });

  const startUrl = path.join(__dirname, 'dist', 'index.html');
  mainWindow.loadFile(startUrl);

  // Open DevTools to see errors — remove this after debugging
  mainWindow.webContents.openDevTools();

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Log any page crashes
  mainWindow.webContents.on('render-process-gone', (event, details) => {
    console.error('Renderer crashed:', details);
  });

  // Log console messages from the web page
  mainWindow.webContents.on('console-message', (event, level, message) => {
    console.log('PAGE LOG:', message);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});