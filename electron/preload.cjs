const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('toDesktop', {
  saveText: (filename, text) => ipcRenderer.invoke('file:save', filename, text),
  openText: () => ipcRenderer.invoke('file:open'),
});
