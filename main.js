const {
  app, BrowserWindow, ipcMain, Notification, screen,
  Menu, Tray, nativeImage, globalShortcut
} = require('electron')
const path = require('path')
const { autoUpdater } = require('electron-updater')
const fs = require('fs')

app.setAppUserModelId('pomini')

let mainWindow = null
let tray = null
let isPinned = false
let currentOpacity = 1.0
let updateDownloaded = false
let updateVersion = null
let timerState = { running: false, timeLeft: 0, mode: 'focus' }
let closeToTray = true

const isDev = !app.isPackaged

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.png')
  const trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  tray = new Tray(trayIcon)
  tray.setToolTip('Pomini')

  const updateTrayMenu = () => {
    const ctxMenu = Menu.buildFromTemplate([
      { label: `${timerState.mode === 'focus' ? 'Focus' : 'Break'} — ${formatTrayTime(timerState.timeLeft)}`, enabled: false },
      { type: 'separator' },
      { label: timerState.running ? 'Pause' : 'Start', click: () => sendToRenderer('shortcut:toggle') },
      { label: 'Skip', click: () => sendToRenderer('shortcut:skip') },
      { type: 'separator' },
      { label: 'Show', click: () => { if (mainWindow) { mainWindow.show(); mainWindow.focus() } } },
      { type: 'separator' },
      { label: 'Quit', click: () => { closeToTray = false; app.quit() } }
    ])
    tray.setContextMenu(ctxMenu)
  }

  updateTrayMenu()
  tray.on('click', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.isVisible() ? mainWindow.hide() : (mainWindow.show(), mainWindow.focus())
    }
  })

  // Update tray tooltip + menu every second while timer runs
  setInterval(() => {
    if (timerState.running && timerState.timeLeft > 0) {
      tray.setToolTip(`Pomini — ${formatTrayTime(timerState.timeLeft)}`)
      updateTrayMenu()
    }
  }, 1000)
}

function formatTrayTime(secs) {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

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

function saveWindowBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  try {
    const bounds = mainWindow.getBounds()
    const data = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'bounds.json'), 'utf8').catch(() => '{}'))
    data.x = bounds.x; data.y = bounds.y; data.width = bounds.width; data.height = bounds.height
    fs.writeFileSync(path.join(app.getPath('userData'), 'bounds.json'), JSON.stringify(data))
  } catch (_) {}
}

function restoreWindowBounds() {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'bounds.json'), 'utf8'))
    if (data && data.width && data.height) {
      mainWindow.setBounds({ x: data.x, y: data.y, width: data.width, height: data.height })
    }
  } catch (_) {}
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 380, height: 520,
    minWidth: 320, minHeight: 440,
    frame: false, transparent: false,
    backgroundColor: '#0a0a0a',
    alwaysOnTop: false, resizable: true,
    skipTaskbar: false,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  })

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'))

  mainWindow.on('close', (e) => {
    if (closeToTray && !isDev) {
      e.preventDefault()
      mainWindow.hide()
    } else {
      saveWindowBounds()
    }
  })

  mainWindow.on('closed', () => { mainWindow = null })
}

function registerShortcuts() {
  globalShortcut.register('Control+Shift+P', () => {
    sendToRenderer('shortcut:toggle')
  })
  globalShortcut.register('Control+Shift+S', () => {
    sendToRenderer('shortcut:skip')
  })
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('checking-for-update', () => sendToRenderer('update:checking'))
  autoUpdater.on('update-available', (info) => {
    updateVersion = info.version
    sendToRenderer('update:available', { version: info.version })
  })
  autoUpdater.on('update-not-available', () => sendToRenderer('update:not-available'))
  autoUpdater.on('download-progress', (progress) => {
    sendToRenderer('update:progress', { percent: Math.round(progress.percent) })
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

app.whenReady().then(() => {
  createWindow()
  restoreWindowBounds()
  Menu.setApplicationMenu(null)

  createTray()
  registerShortcuts()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  if (!isDev) {
    setupAutoUpdater()
    autoUpdater.checkForUpdatesAndNotify().catch(() => {})
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// ── Timer State IPC ─────────────────────────────────────────
ipcMain.handle('timer:state-update', (_e, state) => {
  timerState = state
})

// ── Startup IPC ─────────────────────────────────────────────
ipcMain.handle('app:set-startup', (_e, enable) => {
  app.setLoginItemSettings({ openAtLogin: enable, path: process.execPath })
})

ipcMain.handle('app:get-startup', () => {
  return app.getLoginItemSettings().openAtLogin
})

// ── Export IPC ──────────────────────────────────────────────
ipcMain.handle('app:export', async (_e, { format, data }) => {
  if (!mainWindow) return false
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `pomini-history.${format}`,
    filters: [{ name: format.toUpperCase(), extensions: [format] }]
  })
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, data, 'utf8')
    return true
  }
  return false
})

// ── Update IPC ──────────────────────────────────────────────
ipcMain.handle('update:check', async () => {
  if (isDev) return { dev: true }
  try {
    const result = await autoUpdater.checkForUpdates()
    return { available: result && result.updateInfo.version !== app.getVersion() }
  } catch { return { error: 'check-failed' } }
})
ipcMain.handle('update:install', () => {
  if (updateDownloaded) autoUpdater.quitAndInstall(false, true)
})
ipcMain.handle('update:get-status', () => {
  return { downloaded: updateDownloaded, version: updateVersion, current: app.getVersion() }
})

// ── Window IPC ──────────────────────────────────────────────
ipcMain.handle('window:minimize', () => { if (mainWindow) mainWindow.minimize() })
ipcMain.handle('window:close', () => {
  if (mainWindow) { closeToTray = false; app.quit() }
})
ipcMain.handle('window:hide-to-tray', () => {
  if (mainWindow) { mainWindow.hide() }
})
ipcMain.handle('window:toggle-pin', (_event, pin) => {
  isPinned = pin
  if (mainWindow) {
    mainWindow.setAlwaysOnTop(pin)
    if (process.platform === 'darwin') mainWindow.setVisibleOnAllWorkspaces(pin, { visibleOnFullScreen: pin })
  }
  return isPinned
})
ipcMain.handle('window:is-pinned', () => isPinned)
ipcMain.handle('window:set-opacity', (_event, opacity) => {
  currentOpacity = opacity
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.setOpacity(opacity)
})
ipcMain.handle('window:set-compact', (_event, compact) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (compact) { mainWindow.setMinimumSize(200, 160); mainWindow.setSize(240, 200, true) }
    else { mainWindow.setMinimumSize(320, 440); mainWindow.setSize(380, 520, true) }
  }
})
ipcMain.handle('window:get-opacity', () => currentOpacity)
ipcMain.handle('window:set-position', (_event, preset) => { positionWindow(preset); return true })
ipcMain.handle('window:save-bounds', () => { saveWindowBounds() })

// ── Notifications ───────────────────────────────────────────
ipcMain.handle('notify:send', (_event, { title, body }) => {
  if (!Notification.isSupported()) return false
  const opts = { title, body, silent: false }
  const iconPath = path.join(__dirname, 'assets', 'icon.png')
  try {
    const notif = new Notification(Object.assign(opts, { icon: fs.existsSync(iconPath) ? iconPath : undefined }))
    notif.show()
    notif.on('click', () => { if (mainWindow && !mainWindow.isDestroyed()) { mainWindow.show(); mainWindow.focus() } })
    return true
  } catch (e) {
    try { const notif = new Notification(opts); notif.show(); return true }
    catch (_) { return false }
  }
})

// ── Drag ────────────────────────────────────────────────────
ipcMain.on('window:start-drag', () => {})
