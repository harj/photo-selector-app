import keytar from 'keytar';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import os from 'os';

const SERVICE_NAME = 'PhotoSelector';
const ACCOUNT_NAME = 'anthropic-api-key';

export class KeychainService {
  private fallbackPath: string;

  constructor() {
    // Use app.getPath in production, fallback for dev
    try {
      this.fallbackPath = path.join(app.getPath('userData'), '.api-key');
    } catch {
      this.fallbackPath = path.join(os.homedir(), '.photoselector', '.api-key');
    }
  }

  async setApiKey(apiKey: string): Promise<void> {
    try {
      // Try OS keychain first
      await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, apiKey);
    } catch (error) {
      // Fall back to encrypted file
      console.warn('Keychain unavailable, using encrypted file fallback');
      await this.setApiKeyFallback(apiKey);
    }
  }

  async getApiKey(): Promise<string | null> {
    try {
      // Try OS keychain first
      const key = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);
      if (key) return key;
    } catch (error) {
      console.warn('Keychain unavailable, trying fallback');
    }

    // Try fallback
    return this.getApiKeyFallback();
  }

  async hasApiKey(): Promise<boolean> {
    const key = await this.getApiKey();
    return key !== null && key.length > 0;
  }

  async deleteApiKey(): Promise<void> {
    try {
      await keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
    } catch {
      // Ignore keychain errors
    }

    try {
      await fs.unlink(this.fallbackPath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  // Fallback: AES-256-GCM encrypted file storage
  private async setApiKeyFallback(apiKey: string): Promise<void> {
    const machineId = this.getMachineId();
    const key = crypto.scryptSync(machineId, 'photo-selector-salt', 32);
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(apiKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    const data = {
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      encrypted,
    };

    // Ensure directory exists
    await fs.mkdir(path.dirname(this.fallbackPath), { recursive: true });

    // Write with restricted permissions (owner read/write only)
    await fs.writeFile(this.fallbackPath, JSON.stringify(data), { mode: 0o600 });
  }

  private async getApiKeyFallback(): Promise<string | null> {
    try {
      const content = await fs.readFile(this.fallbackPath, 'utf8');
      const data = JSON.parse(content);

      const machineId = this.getMachineId();
      const key = crypto.scryptSync(machineId, 'photo-selector-salt', 32);
      const iv = Buffer.from(data.iv, 'hex');
      const authTag = Buffer.from(data.authTag, 'hex');

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(data.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch {
      return null;
    }
  }

  private getMachineId(): string {
    // Use a combination of machine-specific values for key derivation
    return `${os.hostname()}-${os.userInfo().username}-${os.platform()}-${os.arch()}`;
  }
}
