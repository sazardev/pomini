const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pomini', {
  // Window
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  hideToTray: () => ipcRenderer.invoke('window:hide-to-tray'),
  togglePin: (pin) => ipcRenderer.invoke('window:toggle-pin', pin),
  setCompact: (compact) => ipcRenderer.invoke('window:set-compact', compact),
  isPinned: () => ipcRenderer.invoke('window:is-pinned'),
  setOpacity: (opacity) => ipcRenderer.invoke('window:set-opacity', opacity),
  setPosition: (preset) => ipcRenderer.invoke('window:set-position', preset),
  getOpacity: () => ipcRenderer.invoke('window:get-opacity'),
  saveBounds: () => ipcRenderer.invoke('window:save-bounds'),

  // Timer state sync (for tray)
  syncTimerState: (state) => ipcRenderer.invoke('timer:state-update', state),

  // Startup
  setStartup: (enable) => ipcRenderer.invoke('app:set-startup', enable),
  getStartup: () => ipcRenderer.invoke('app:get-startup'),

  // Export
  exportData: (format, data) => ipcRenderer.invoke('app:export', { format, data }),

  // Notifications
  notify: (title, body) =>
    ipcRenderer.invoke('notify:send', { title, body }),

  // Global shortcuts (from main → renderer)
  onShortcut: {
    toggle: (cb) => ipcRenderer.on('shortcut:toggle', () => cb()),
    skip: (cb) => ipcRenderer.on('shortcut:skip', () => cb())
  },

  // Updates
  update: {
    check: () => ipcRenderer.invoke('update:check'),
    install: () => ipcRenderer.invoke('update:install'),
    getStatus: () => ipcRenderer.invoke('update:get-status'),
    onChecking: (cb) => ipcRenderer.on('update:checking', () => cb()),
    onAvailable: (cb) => ipcRenderer.on('update:available', (_e, info) => cb(info)),
    onNotAvailable: (cb) => ipcRenderer.on('update:not-available', () => cb()),
    onProgress: (cb) => ipcRenderer.on('update:progress', (_e, p) => cb(p)),
    onDownloaded: (cb) => ipcRenderer.on('update:downloaded', (_e, info) => cb(info)),
    onError: (cb) => ipcRenderer.on('update:error', (_e, err) => cb(err)),
    removeAllListeners: () => {
      ipcRenderer.removeAllListeners('update:checking')
      ipcRenderer.removeAllListeners('update:available')
      ipcRenderer.removeAllListeners('update:not-available')
      ipcRenderer.removeAllListeners('update:progress')
      ipcRenderer.removeAllListeners('update:downloaded')
      ipcRenderer.removeAllListeners('update:error')
    }
  },

  // Misc
  getSettings: () => ipcRenderer.invoke('settings:get'),
  onDragStart: () => ipcRenderer.send('window:start-drag')
})
