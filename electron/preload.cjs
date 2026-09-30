const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('toDesktop', {
  // files
  saveText: (filename, text) => ipcRenderer.invoke('file:save', filename, text),
  savePdf: (filename, html) => ipcRenderer.invoke('file:save-pdf', filename, html),
  printHtml: (html) => ipcRenderer.invoke('file:print', html),
  openText: () => ipcRenderer.invoke('file:open'),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  // display mode (second window)
  openDisplay: (fullscreen) => ipcRenderer.invoke('window:open-display', !!fullscreen),
  // LAN sync host (local network only)
  lanStart: () => ipcRenderer.invoke('lan:start'),
  lanStop: () => ipcRenderer.invoke('lan:stop'),
  lanStatus: () => ipcRenderer.invoke('lan:status'),
  lanPublish: (payload) => ipcRenderer.invoke('lan:publish', payload),
  lanInbox: () => ipcRenderer.invoke('lan:inbox'),
});

