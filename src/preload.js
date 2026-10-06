const {contextBridge, ipcRenderer} = require('electron');

contextBridge.exposeInMainWorld('ffu', {
  state: () => ipcRenderer.invoke('state'),
  pickFile: (kind, current) => ipcRenderer.invoke('pick-file', kind, current),
  inspect: (file, sample) => ipcRenderer.invoke('inspect', file, sample),
  generate: data => ipcRenderer.invoke('generate', data),
  cancel: () => ipcRenderer.invoke('cancel'),
  showOutput: file => ipcRenderer.invoke('show-output', file),
  checkUpdates: () => ipcRenderer.invoke('check-update'),
  dismissUpdate: version => ipcRenderer.invoke('dismiss-update', version),
  openUpdate: () => ipcRenderer.invoke('open-update'),
  on: (event, callback) => {
    if (!['run-start','run-output','run-end','update-status'].includes(event)) throw new Error('Unknown event');
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on(event, handler);
    return () => ipcRenderer.removeListener(event, handler);
  }
});
