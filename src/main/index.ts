import { app, BrowserWindow } from 'electron';
import path from 'path';
import { ConfigStore } from './config-store';
import { initDatabase } from './database';
import { registerIpcHandlers } from './ipc-handlers';

let mainWindow: BrowserWindow | null = null;

const isDev = process.env.NODE_ENV === 'development';

async function createWindow() {
  const config = new ConfigStore();

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: 'hiddenInset',
    show: false,
  });

  // Initialize database if configured
  if (config.isConfigured()) {
    try {
      initDatabase(config.getStoragePath());
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }

  // Register IPC handlers
  registerIpcHandlers(mainWindow);

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Load the app
  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Handle app lifecycle
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (_, contents) => {
  contents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });
});
