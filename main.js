const {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  screen,
  Menu,
  dialog
} = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')

app.setAppUserModelId('pomini')

let mainWindow = null
let isPinned = false
let currentOpacity = 1.0
let updateDownloaded = false
let updateVersion = null

const isDev = !app.isPackaged

function positionWindow(preset) {
  if (!mainWindow || mainWindow.isDestroyed()) return

  const display = screen.getPrimaryDisplay()
  const { width: sw, height: sh } = display.workAreaSize
  const [ww, wh] = mainWindow.getSize()
  const gap = 16

  const positions = {
    'top-right':     [sw - ww - gap, gap],
    'top-left':      [gap, gap],
    'bottom-right':  [sw - ww - gap, sh - wh - gap],
    'bottom-left':   [gap, sh - wh - gap],
    'center':        [Math.round((sw - ww) / 2), Math.round((sh - wh) / 2)],
    'top-center':    [Math.round((sw - ww) / 2), gap],
    'bottom-center': [Math.round((sw - ww) / 2), sh - wh - gap]
  }

  const [x, y] = positions[preset] || positions['top-right']
  mainWindow.setPosition(x, y)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 520,
    minWidth: 320,
    minHeight: 440,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0a',
    alwaysOnTop: false,
    resizable: true,
    skipTaskbar: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))
}

app.whenReady().then(() => {
  createWindow()

  Menu.setApplicationMenu(null)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  // Auto-updater
  if (!isDev) {
    setupAutoUpdater()
    autoUpdater.checkForUpdatesAndNotify().catch(() => {
      // Silent fail — no internet or GitHub unreachable
    })
  }
})

function setupAutoUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    sendToRenderer('update:checking')
  })

  autoUpdater.on('update-available', (info) => {
    updateVersion = info.version
    sendToRenderer('update:available', { version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    sendToRenderer('update:not-available')
  })

  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update:progress', {
      percent: Math.round(progress.percent),
      transferred: progress.transferred,
      total: progress.total
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    updateDownloaded = true
    updateVersion = info.version
    sendToRenderer('update:downloaded', { version: info.version })
  })

  autoUpdater.on('error', (err) => {
    sendToRenderer('update:error', { message: err ? err.message : 'Unknown error' })
  })
}

function sendToRenderer(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload)
  }
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  // Allow auto-updater to install before quitting
})

// ── Update IPC ────────────────────────────────────────────────

ipcMain.handle('update:check', async () => {
  if (isDev) return { dev: true }
  try {
    const result = await autoUpdater.checkForUpdates()
    return { available: result && result.updateInfo.version !== app.getVersion() }
  } catch {
    return { error: 'check-failed' }
  }
})

ipcMain.handle('update:install', () => {
  if (updateDownloaded) {
    autoUpdater.quitAndInstall(false, true)
  }
})

ipcMain.handle('update:get-status', () => {
  return {
    downloaded: updateDownloaded,
    version: updateVersion,
    current: app.getVersion()
  }
})

// ── IPC Handlers ──────────────────────────────────────────────

ipcMain.handle('window:minimize', () => {
  if (mainWindow) mainWindow.minimize()
})

ipcMain.handle('window:close', () => {
  if (mainWindow) {
    mainWindow.hide()
    app.quit()
  }
})

ipcMain.handle('window:toggle-pin', (_event, pin) => {
  isPinned = pin
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(pin)
    if (process.platform === 'darwin') {
      mainWindow.setVisibleOnAllWorkspaces(pin, { visibleOnFullScreen: pin })
    }
  }
  return isPinned
})

ipcMain.handle('window:is-pinned', () => isPinned)

ipcMain.handle('window:set-opacity', (_event, opacity) => {
  currentOpacity = opacity
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setOpacity(opacity)
  }
})

ipcMain.handle('window:set-compact', (_event, compact) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (compact) {
      mainWindow.setMinimumSize(200, 160)
      mainWindow.setSize(240, 200, true)
    } else {
      mainWindow.setMinimumSize(320, 440)
      mainWindow.setSize(380, 520, true)
    }
  }
})

ipcMain.handle('window:get-opacity', () => currentOpacity)

ipcMain.handle('window:set-position', (_event, preset) => {
  positionWindow(preset)
  return true
})

ipcMain.handle('notify:send', (_event, { title, body }) => {
  if (!Notification.isSupported()) return false

  const opts = { title, body, silent: false }
  const iconPath = path.join(__dirname, 'assets', 'icon.png')

  try {
    const notif = new Notification(Object.assign(opts, {
      icon: require('fs').existsSync(iconPath) ? iconPath : undefined
    }))
    notif.show()

    notif.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show()
        mainWindow.focus()
      }
    })
    return true
  } catch (e) {
    // Fallback: try without icon
    try {
      const notif = new Notification(opts)
      notif.show()
      return true
    } catch (_) {
      return false
    }
  }
})

ipcMain.handle('settings:get', () => {
  // stored in renderer localStorage; main process can't easily access
  return {}
})

// Allow dragging the frameless window
ipcMain.on('window:start-drag', (event) => {
  if (mainWindow) {
    // The renderer sends this; we start the drag from main
  }
})
