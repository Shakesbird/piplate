const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Some Windows systems (and remote/VM sessions) cannot initialize Chromium's
// GPU subprocess. Falling back to software rendering keeps the app launchable.
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu');
// Keep the renderer sandbox intact; only the failing Windows GPU subprocess
// needs its sandbox disabled on affected systems.
app.commandLine.appendSwitch('disable-gpu-sandbox');

// Keep development cache/session files beside the project. This avoids stale
// or permission-restricted Electron profiles under AppData while developing.
if (!app.isPackaged) {
  const developmentDataPath = path.join(__dirname, '.piplate-dev-data');
  app.setPath('userData', developmentDataPath);
  app.setPath('sessionData', path.join(developmentDataPath, 'Session'));
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 600,
    minWidth: 800,
    minHeight: 480,
    frame: false,
    autoHideMenuBar: true,
    fullscreen: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
    },
    backgroundColor: '#F7F3EB',
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));
  }

  ipcMain.handle('window:minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.handle('window:toggle-maximize', () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
      return false;
    }

    mainWindow.maximize();
    return true;
  });

  ipcMain.handle('window:is-maximized', () => mainWindow.isMaximized());

  ipcMain.handle('window:close', () => {
    mainWindow.close();
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
