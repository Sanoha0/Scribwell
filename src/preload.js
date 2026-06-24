const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('scribewell', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (cfg) => ipcRenderer.invoke('config:set', cfg),
  saveDoc: (payload) => ipcRenderer.invoke('doc:save', payload),
  openDoc: () => ipcRenderer.invoke('doc:open'),
  complete: (payload) => ipcRenderer.invoke('ai:complete', payload)
});
