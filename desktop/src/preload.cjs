const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("clipviet", {
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: value => ipcRenderer.invoke("settings:save", value),
  saveToken: token => ipcRenderer.invoke("token:save", token),
  loadCatalog: () => ipcRenderer.invoke("catalog:load"),
  startDownload: payload => ipcRenderer.invoke("download:start", payload),
  chooseBinary: () => ipcRenderer.invoke("dialog:binary"),
  chooseFolder: () => ipcRenderer.invoke("dialog:folder"),
  onJobsUpdate: callback => ipcRenderer.on("jobs:update", (_event, jobs) => callback(jobs))
});
