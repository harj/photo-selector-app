import { ipcMain, dialog, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { IPC_CHANNELS } from '../shared/ipc-channels';
import { ConfigStore } from './config-store';
import { KeychainService } from './keychain';
import { getDatabase, initDatabase } from './database';
import { PhotoManager } from './services/photo-manager';
import { ClaudeVisionService } from './services/claude-vision';
import { SimilarityGroupingService } from './services/similarity-grouping';
import { CostEstimator } from './services/cost-estimator';
import type { Project, Photo, ProjectWithStats, PromptTemplate } from '../shared/types';

// Track if handlers have been registered to prevent duplicates during HMR
let handlersRegistered = false;

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // Prevent duplicate registration during hot reload
  if (handlersRegistered) {
    console.log('IPC handlers already registered, skipping...');
    return;
  }
  handlersRegistered = true;
  const config = new ConfigStore();
  const keychain = new KeychainService();

  // ============================================================
  // SETTINGS & CONFIG
  // ============================================================

  ipcMain.handle(IPC_CHANNELS.SETTINGS_IS_CONFIGURED, async () => {
    return config.isConfigured();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async () => {
    const templates = config.isConfigured()
      ? getDatabase().prepare('SELECT * FROM prompt_templates ORDER BY is_preset DESC, name').all()
      : [];

    return {
      storagePath: config.getStoragePath(),
      hasApiKey: await keychain.hasApiKey(),
      promptTemplates: templates,
    };
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_STORAGE_PATH, async () => {
    console.log('Browse button clicked - showing dialog...');
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory', 'createDirectory'],
        title: 'Select Photo Storage Location',
      });
      console.log('Dialog result:', result);

      if (!result.canceled && result.filePaths[0]) {
        const newPath = result.filePaths[0];
        config.setStoragePath(newPath);

        // Initialize database at new location
        initDatabase(newPath);

        return newPath;
      }
      return null;
    } catch (error) {
      console.error('Dialog error:', error);
      throw error;
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET_API_KEY, async (_, apiKey: string) => {
    try {
      // Validate key first
      const isValid = await ClaudeVisionService.validateApiKey(apiKey);
      if (isValid) {
        await keychain.setApiKey(apiKey);
        return { success: true };
      }
      return { success: false, error: 'Invalid API key. Please check and try again.' };
    } catch (error) {
      return { success: false, error: 'Failed to validate API key. Check your internet connection.' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_VALIDATE_API_KEY, async (_, apiKey: string) => {
    try {
      const isValid = await ClaudeVisionService.validateApiKey(apiKey);
      return { success: isValid, error: isValid ? undefined : 'Invalid API key' };
    } catch (error) {
      return { success: false, error: 'Failed to validate API key' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_COMPLETE_SETUP, async () => {
    // Ensure storage path exists and database is initialized
    const storagePath = config.getStoragePath();
    if (!fs.existsSync(storagePath)) {
      fs.mkdirSync(storagePath, { recursive: true });
    }
    initDatabase(storagePath);
    config.completeSetup();
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_PROMPT_TEMPLATES, async () => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM prompt_templates ORDER BY is_preset DESC, name').all();
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SAVE_PROMPT_TEMPLATE, async (_, template: { id?: number; name: string; prompt: string }) => {
    const db = getDatabase();
    if (template.id) {
      db.prepare('UPDATE prompt_templates SET name = ?, prompt = ? WHERE id = ? AND is_preset = 0')
        .run(template.name, template.prompt, template.id);
    } else {
      const result = db.prepare('INSERT INTO prompt_templates (name, prompt, is_preset) VALUES (?, ?, 0)')
        .run(template.name, template.prompt);
      return { ...template, id: result.lastInsertRowid };
    }
    return template;
  });

  ipcMain.handle(IPC_CHANNELS.SETTINGS_DELETE_PROMPT_TEMPLATE, async (_, id: number) => {
    const db = getDatabase();
    db.prepare('DELETE FROM prompt_templates WHERE id = ? AND is_preset = 0').run(id);
    return true;
  });

  // ============================================================
  // DIALOGS
  // ============================================================

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FILES, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif', 'raw', 'arw', 'cr2', 'nef', 'dng'] },
      ],
      title: 'Select Photos to Upload',
    });

    return result.canceled ? [] : result.filePaths;
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_SELECT_FOLDER, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select Folder',
    });

    return result.canceled ? null : result.filePaths[0];
  });

  // ============================================================
  // PROJECTS
  // ============================================================

  ipcMain.handle(IPC_CHANNELS.PROJECT_LIST, async () => {
    const db = getDatabase();
    const projects = db.prepare(`
      SELECT
        p.*,
        COUNT(ph.id) as photo_count,
        SUM(CASE WHEN ph.selected = 1 THEN 1 ELSE 0 END) as selected_count,
        SUM(CASE WHEN ph.score IS NOT NULL THEN 1 ELSE 0 END) as scored_count
      FROM projects p
      LEFT JOIN photos ph ON ph.project_id = p.id
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `).all() as ProjectWithStats[];

    return projects;
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_GET, async (_, id: number) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_CREATE, async (_, data: { name: string; prompt?: string }) => {
    const db = getDatabase();
    const manager = new PhotoManager(config.getStoragePath());

    const result = db.prepare('INSERT INTO projects (name, prompt) VALUES (?, ?)')
      .run(data.name, data.prompt || null);

    const projectId = result.lastInsertRowid as number;

    // Create directories
    await manager.createDirectories(data.name);

    return db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Project;
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_UPDATE, async (_, data: { id: number; name: string; prompt?: string }) => {
    const db = getDatabase();
    db.prepare('UPDATE projects SET name = ?, prompt = ?, updated_at = datetime('now') WHERE id = ?')
      .run(data.name, data.prompt || null, data.id);

    return db.prepare('SELECT * FROM projects WHERE id = ?').get(data.id) as Project;
  });

  ipcMain.handle(IPC_CHANNELS.PROJECT_DELETE, async (_, id: number) => {
    const db = getDatabase();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Project | undefined;

    if (project) {
      // Delete from database (cascade will delete photos)
      db.prepare('DELETE FROM projects WHERE id = ?').run(id);

      // Optionally delete files from disk
      const manager = new PhotoManager(config.getStoragePath());
      await manager.deleteProjectFiles(project.name);
    }

    return true;
  });

  // ============================================================
  // PHOTOS
  // ============================================================

  ipcMain.handle(IPC_CHANNELS.PHOTOS_LIST, async (_, projectId: number) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM photos WHERE project_id = ? ORDER BY score DESC, created_at DESC')
      .all(projectId) as Photo[];
  });

  ipcMain.handle(IPC_CHANNELS.PHOTO_GET, async (_, id: number) => {
    const db = getDatabase();
    return db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as Photo | undefined;
  });

  ipcMain.handle(IPC_CHANNELS.PHOTOS_UPLOAD, async (_, { projectId, filePaths }: { projectId: number; filePaths: string[] }) => {
    const db = getDatabase();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Project;

    if (!project) {
      throw new Error('Project not found');
    }

    const manager = new PhotoManager(config.getStoragePath());
    const results = { uploaded: 0, duplicates: 0, photos: [] as Photo[] };

    for (let i = 0; i < filePaths.length; i++) {
      const filePath = filePaths[i];
      const result = await manager.processUpload(project, filePath);

      if (result.duplicate) {
        results.duplicates++;
      } else {
        results.uploaded++;
        results.photos.push(result.photo!);
      }

      // Send progress to renderer
      mainWindow.webContents.send(IPC_CHANNELS.UPLOAD_PROGRESS, {
        current: i + 1,
        total: filePaths.length,
        filename: path.basename(filePath),
      });
    }

    return results;
  });

  ipcMain.handle(IPC_CHANNELS.PHOTOS_DELETE, async (_, id: number) => {
    const db = getDatabase();
    const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as Photo | undefined;

    if (photo) {
      // Delete files
      try {
        if (fs.existsSync(photo.original_path)) fs.unlinkSync(photo.original_path);
        if (fs.existsSync(photo.thumbnail_path)) fs.unlinkSync(photo.thumbnail_path);
      } catch (error) {
        console.error('Error deleting photo files:', error);
      }

      // Delete from database
      db.prepare('DELETE FROM photos WHERE id = ?').run(id);
    }

    return true;
  });

  ipcMain.handle(IPC_CHANNELS.PHOTOS_UPDATE_SELECTION, async (_, { photoIds, selected }: { photoIds: number[]; selected: boolean }) => {
    const db = getDatabase();
    const placeholders = photoIds.map(() => '?').join(',');
    db.prepare(`UPDATE photos SET selected = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`)
      .run(selected ? 1 : 0, ...photoIds);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.PHOTOS_EXPORT, async (_, projectId: number) => {
    const db = getDatabase();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Project;

    if (!project) {
      throw new Error('Project not found');
    }

    const manager = new PhotoManager(config.getStoragePath());
    const result = await manager.exportSelected(project);

    return {
      count: result.exported.length,
      skipped: result.skipped,
      exportPath: manager.getExportsPath(project.name),
    };
  });

  ipcMain.handle(IPC_CHANNELS.PHOTO_THUMBNAIL, async (_, id: number) => {
    const db = getDatabase();
    const photo = db.prepare('SELECT thumbnail_path FROM photos WHERE id = ?').get(id) as { thumbnail_path: string } | undefined;

    if (photo && fs.existsSync(photo.thumbnail_path)) {
      const buffer = fs.readFileSync(photo.thumbnail_path);
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    }
    return null;
  });

  ipcMain.handle(IPC_CHANNELS.PHOTO_ORIGINAL, async (_, id: number) => {
    const db = getDatabase();
    const photo = db.prepare('SELECT original_path, original_filename FROM photos WHERE id = ?')
      .get(id) as { original_path: string; original_filename: string } | undefined;

    if (photo && fs.existsSync(photo.original_path)) {
      const ext = path.extname(photo.original_filename).toLowerCase();
      const webFormats = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

      if (webFormats.includes(ext)) {
        const buffer = fs.readFileSync(photo.original_path);
        const mimeType = ext === '.png' ? 'image/png' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
      }
    }
    return null; // Fall back to thumbnail for non-web formats
  });

  ipcMain.handle(IPC_CHANNELS.PHOTO_GROUP, async (_, id: number) => {
    const db = getDatabase();
    const photo = db.prepare('SELECT * FROM photos WHERE id = ?').get(id) as Photo | undefined;

    if (!photo || !photo.similarity_group_id) {
      return [];
    }

    return db.prepare('SELECT * FROM photos WHERE similarity_group_id = ? ORDER BY score DESC, id')
      .all(photo.similarity_group_id) as Photo[];
  });

  // ============================================================
  // AI OPERATIONS
  // ============================================================

  ipcMain.handle(IPC_CHANNELS.ANALYZE_ESTIMATE_COST, async (_, projectId: number) => {
    const db = getDatabase();
    const photos = db.prepare('SELECT * FROM photos WHERE project_id = ? AND score IS NULL')
      .all(projectId) as Photo[];

    const estimator = new CostEstimator();
    return estimator.estimate(photos);
  });

  ipcMain.handle(IPC_CHANNELS.ANALYZE_PHOTOS, async (_, projectId: number) => {
    const apiKey = await keychain.getApiKey();
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    const db = getDatabase();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Project;

    if (!project) {
      throw new Error('Project not found');
    }

    const service = new ClaudeVisionService(apiKey, project);

    return service.analyzePhotos((progress) => {
      mainWindow.webContents.send(IPC_CHANNELS.ANALYZE_PROGRESS, progress);
    });
  });

  ipcMain.handle(IPC_CHANNELS.GROUP_SIMILAR, async (_, projectId: number) => {
    const apiKey = await keychain.getApiKey();
    if (!apiKey) {
      throw new Error('API key not configured');
    }

    const db = getDatabase();
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId) as Project;

    if (!project) {
      throw new Error('Project not found');
    }

    const service = new SimilarityGroupingService(apiKey, project);
    return service.groupPhotos();
  });

  // Clear similarity groups
  ipcMain.handle(IPC_CHANNELS.GROUP_CLEAR, async (_, projectId: number) => {
    const db = getDatabase();
    db.prepare('UPDATE photos SET similarity_group_id = NULL WHERE project_id = ?')
      .run(projectId);
    return true;
  });
}
