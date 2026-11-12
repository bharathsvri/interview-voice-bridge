import { contextBridge, ipcRenderer } from 'electron';

export interface IElectronAPI {
  getSystemInfo: () => Promise<{ platform: string; arch: string; version: string }>;
  requestMicPermission: () => Promise<boolean>;
  minimizeWindow: () => void;
  maximizeWindow: () => void;
  closeWindow: () => void;
}

const api: IElectronAPI = {
  getSystemInfo: () => ipcRenderer.invoke('system:info'),
  requestMicPermission: () => ipcRenderer.invoke('media:request-permission'),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
};

contextBridge.exposeInMainWorld('electronAPI', api);
