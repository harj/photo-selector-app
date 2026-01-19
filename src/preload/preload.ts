import { contextBridge, ipcRenderer } from 'electron';

// Inline IPC channels (can't import from shared module in sandboxed preload)
const IPC_CHANNELS = {
  // Projects
  PROJECT_LIST: 'project:list',
  PROJECT_GET: 'project:get',
  PROJECT_CREATE: 'project:create',
  PROJECT_UPDATE: 'project:update',
  PROJECT_DELETE: 'project:delete',

  // Photos
  PHOTOS_LIST: 'photos:list',
  PHOTOS_UPLOAD: 'photos:upload',
  PHOTOS_DELETE: 'photos:delete',
  PHOTOS_UPDATE_SELECTION: 'photos:updateSelection',
  PHOTOS_EXPORT: 'photos:export',
  PHOTO_GET: 'photo:get',
  PHOTO_THUMBNAIL: 'photo:thumbnail',
  PHOTO_ORIGINAL: 'photo:original',
  PHOTO_GROUP: 'photo:group',

  // Progress events (main -> renderer)
  UPLOAD_PROGRESS: 'upload:progress',
  ANALYZE_PROGRESS: 'analyze:progress',

  // AI Operations
  ANALYZE_ESTIMATE_COST: 'analyze:estimateCost',
  ANALYZE_PHOTOS: 'analyze:photos',
  GROUP_SIMILAR: 'group:similar',
  GROUP_CLEAR: 'group:clear',

  // Settings & Config
  SETTINGS_GET: 'settings:get',
  SETTINGS_IS_CONFIGURED: 'settings:isConfigured',
  SETTINGS_SET_STORAGE_PATH: 'settings:setStoragePath',
  SETTINGS_SET_API_KEY: 'settings:setApiKey',
  SETTINGS_VALIDATE_API_KEY: 'settings:validateApiKey',
  SETTINGS_COMPLETE_SETUP: 'settings:completeSetup',
  SETTINGS_GET_PROMPT_TEMPLATES: 'settings:getPromptTemplates',
  SETTINGS_SAVE_PROMPT_TEMPLATE: 'settings:savePromptTemplate',
  SETTINGS_DELETE_PROMPT_TEMPLATE: 'settings:deletePromptTemplate',

  // Dialogs
  DIALOG_SELECT_FILES: 'dialog:selectFiles',
  DIALOG_SELECT_FOLDER: 'dialog:selectFolder',
} as const;

// Get all valid channel values for whitelisting
const validInvokeChannels = Object.values(IPC_CHANNELS);

// Channels that can be listened to (main -> renderer)
const validOnChannels = [
  IPC_CHANNELS.UPLOAD_PROGRESS,
  IPC_CHANNELS.ANALYZE_PROGRESS,
];

// Expose a safe API to the renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // Invoke (renderer -> main -> renderer)
  invoke: <T>(channel: string, ...args: unknown[]): Promise<T> => {
    if (validInvokeChannels.includes(channel as any)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Invalid IPC channel: ${channel}`));
  },

  // Listen to events (main -> renderer)
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    if (validOnChannels.includes(channel as any)) {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => {
        callback(...args);
      };
      ipcRenderer.on(channel, subscription);
      // Return unsubscribe function
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
    console.warn(`Invalid IPC channel for listener: ${channel}`);
    return () => {};
  },

  // One-time listener
  once: (channel: string, callback: (...args: unknown[]) => void): void => {
    if (validOnChannels.includes(channel as any)) {
      ipcRenderer.once(channel, (_event, ...args) => {
        callback(...args);
      });
    } else {
      console.warn(`Invalid IPC channel for once listener: ${channel}`);
    }
  },
});

// Type definitions for the exposed API
declare global {
  interface Window {
    electronAPI: {
      invoke: <T>(channel: string, ...args: unknown[]) => Promise<T>;
      on: (channel: string, callback: (...args: unknown[]) => void) => () => void;
      once: (channel: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}
