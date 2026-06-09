const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('pomini', {
  minimize: () => ipcRenderer.invoke('window:minimize'),
  close: () => ipcRenderer.invoke('window:close'),
  togglePin: (pin) => ipcRenderer.invoke('window:toggle-pin', pin),
  setCompact: (compact) => ipcRenderer.invoke('window:set-compact', compact),
  isPinned: () => ipcRenderer.invoke('window:is-pinned'),
  setOpacity: (opacity) => ipcRenderer.invoke('window:set-opacity', opacity),
  setPosition: (preset) => ipcRenderer.invoke('window:set-position', preset),
  getOpacity: () => ipcRenderer.invoke('window:get-opacity'),
  notify: (title, body) =>
    ipcRenderer.invoke('notify:send', { title, body }),
  getSettings: () => ipcRenderer.invoke('settings:get'),

  // Window drag — calls main process
  onDragStart: () => ipcRenderer.send('window:start-drag')
})
