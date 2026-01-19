import sharp from 'sharp';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { getDatabase } from '../database';
import type { Project, Photo } from '../../shared/types';

const THUMBNAIL_SIZE = 400;

// File extensions that need special handling (RAW + HEIC)
const SPECIAL_EXTENSIONS = [
  // RAW formats
  '.cr2', '.cr3', '.nef', '.arw', '.orf', '.rw2', '.dng', '.raf', '.raw', '.srw', '.pef',
  // HEIC/HEIF (requires special decoder)
  '.heic', '.heif'
];

interface UploadResult {
  duplicate: boolean;
  photo?: Photo;
  existingPhoto?: Photo;
}

export class PhotoManager {
  private storagePath: string;

  constructor(storagePath: string) {
    this.storagePath = storagePath;
  }

  async createDirectories(projectName: string): Promise<void> {
    const projectPath = this.getProjectPath(projectName);
    await fs.mkdir(path.join(projectPath, 'originals'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'thumbnails'), { recursive: true });
    await fs.mkdir(path.join(projectPath, 'exports'), { recursive: true });
  }

  async processUpload(project: Project, filePath: string): Promise<UploadResult> {
    const db = getDatabase();

    // Read file and compute hash
    const fileBuffer = await fs.readFile(filePath);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    // Check for duplicate
    const existing = db.prepare(
      'SELECT * FROM photos WHERE project_id = ? AND file_hash = ?'
    ).get(project.id, fileHash) as Photo | undefined;

    if (existing) {
      return { duplicate: true, existingPhoto: existing };
    }

    const filename = path.basename(filePath);
    const projectPath = this.getProjectPath(project.name);

    // Ensure directories exist
    await this.createDirectories(project.name);

    // Generate unique filename if collision
    let originalFilename = filename;
    let originalPath = path.join(projectPath, 'originals', filename);
    let counter = 1;

    while (fsSync.existsSync(originalPath)) {
      const ext = path.extname(filename);
      const base = path.basename(filename, ext);
      originalFilename = `${base}_${counter}${ext}`;
      originalPath = path.join(projectPath, 'originals', originalFilename);
      counter++;
    }

    // Copy original
    await fs.copyFile(filePath, originalPath);

    // Generate thumbnail
    const thumbnailFilename = `${path.parse(originalFilename).name}_thumb.jpg`;
    const thumbnailPath = path.join(projectPath, 'thumbnails', thumbnailFilename);
    const ext = path.extname(filename).toLowerCase();
    const isRawFile = SPECIAL_EXTENSIONS.includes(ext);

    let thumbnailGenerated = false;

    try {
      await sharp(filePath)
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 85 })
        .toFile(thumbnailPath);
      thumbnailGenerated = true;
    } catch (error) {
      console.error('Error generating thumbnail:', error);

      // Create a placeholder thumbnail for any file that fails
      console.log(`Creating placeholder thumbnail for: ${filename}`);
      try {
        // Create a gray placeholder
        const placeholder = await sharp({
          create: {
            width: THUMBNAIL_SIZE,
            height: THUMBNAIL_SIZE,
            channels: 3,
            background: { r: 180, g: 180, b: 180 }
          }
        })
        .jpeg({ quality: 85 })
        .toBuffer();

        await fs.writeFile(thumbnailPath, placeholder);
        thumbnailGenerated = true;
      } catch (placeholderError) {
        console.error('Error creating placeholder:', placeholderError);
      }
    }

    // If no thumbnail was generated, use original path as fallback (won't display well but won't crash)
    const finalThumbnailPath = thumbnailGenerated ? thumbnailPath : originalPath;

    // Insert into database
    const result = db.prepare(`
      INSERT INTO photos (project_id, original_filename, original_path, thumbnail_path, file_hash, file_size)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(project.id, originalFilename, originalPath, finalThumbnailPath, fileHash, fileBuffer.length);

    const photo = db.prepare('SELECT * FROM photos WHERE id = ?')
      .get(result.lastInsertRowid) as Photo;

    return { duplicate: false, photo };
  }

  async exportSelected(project: Project): Promise<{ exported: string[]; skipped: number }> {
    const db = getDatabase();
    const photos = db.prepare(
      'SELECT * FROM photos WHERE project_id = ? AND selected = 1 ORDER BY score DESC, id'
    ).all(project.id) as Photo[];

    const exportsPath = this.getExportsPath(project.name);

    // Ensure exports directory exists
    await fs.mkdir(exportsPath, { recursive: true });

    // Clear existing exports
    const existingFiles = await fs.readdir(exportsPath);
    for (const file of existingFiles) {
      if (file.endsWith('.jpg')) {
        await fs.unlink(path.join(exportsPath, file));
      }
    }

    const exportedFiles: string[] = [];
    const sanitizedName = this.sanitizeName(project.name);
    let skipped = 0;
    let exportIndex = 1;

    for (const photo of photos) {
      const ext = path.extname(photo.original_filename).toLowerCase();

      // Skip formats that sharp can't convert
      if (SPECIAL_EXTENSIONS.includes(ext)) {
        console.log(`Skipping ${photo.original_filename} - RAW/HEIC format cannot be exported as JPEG`);
        skipped++;
        continue;
      }

      const exportFilename = `${sanitizedName}_${String(exportIndex).padStart(2, '0')}.jpg`;
      const exportPath = path.join(exportsPath, exportFilename);

      try {
        await sharp(photo.original_path)
          .jpeg({ quality: 90 })
          .toFile(exportPath);

        exportedFiles.push(exportPath);
        exportIndex++;
      } catch (error) {
        console.error(`Error exporting ${photo.original_filename}:`, error);
        skipped++;
      }
    }

    return { exported: exportedFiles, skipped };
  }

  async deleteProjectFiles(projectName: string): Promise<void> {
    const projectPath = this.getProjectPath(projectName);

    try {
      if (fsSync.existsSync(projectPath)) {
        await fs.rm(projectPath, { recursive: true });
      }
    } catch (error) {
      console.error('Error deleting project files:', error);
    }
  }

  getProjectPath(projectName: string): string {
    return path.join(this.storagePath, this.sanitizeName(projectName));
  }

  getExportsPath(projectName: string): string {
    return path.join(this.getProjectPath(projectName), 'exports');
  }

  private sanitizeName(name: string): string {
    return name.replace(/[^0-9A-Za-z.\-\s]/g, '_').trim();
  }
}
