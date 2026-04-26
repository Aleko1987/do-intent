const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("regionOverlay", {
  complete: (rect) => ipcRenderer.send("region-overlay-complete", rect),
  cancel: () => ipcRenderer.send("region-overlay-cancel"),
});
