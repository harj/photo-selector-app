export const IPC_CHANNELS = {
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

export type IpcChannel = typeof IPC_CHANNELS[keyof typeof IPC_CHANNELS];
