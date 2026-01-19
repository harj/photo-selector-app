import Store from 'electron-store';
import path from 'path';
import os from 'os';

interface ConfigSchema {
  storagePath: string;
  setupComplete: boolean;
  windowBounds?: {
    width: number;
    height: number;
    x?: number;
    y?: number;
  };
}

export class ConfigStore {
  private store: Store<ConfigSchema>;

  constructor() {
    this.store = new Store<ConfigSchema>({
      name: 'config',
      defaults: {
        storagePath: path.join(os.homedir(), 'PhotoSelector'),
        setupComplete: false,
      },
    });
  }

  isConfigured(): boolean {
    return this.store.get('setupComplete', false);
  }

  completeSetup(): void {
    this.store.set('setupComplete', true);
  }

  getStoragePath(): string {
    return this.store.get('storagePath');
  }

  setStoragePath(newPath: string): void {
    this.store.set('storagePath', newPath);
  }

  getWindowBounds(): ConfigSchema['windowBounds'] {
    return this.store.get('windowBounds');
  }

  setWindowBounds(bounds: ConfigSchema['windowBounds']): void {
    this.store.set('windowBounds', bounds);
  }

  // Reset config (useful for testing)
  reset(): void {
    this.store.clear();
  }
}
