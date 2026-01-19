import { useCallback, useEffect } from 'react';
import { IPC_CHANNELS } from '../../shared/ipc-channels';

// Re-export channels for convenience
export { IPC_CHANNELS };

/**
 * Hook for type-safe IPC communication
 */
export function useIpc() {
  const invoke = useCallback(async <T>(channel: string, ...args: unknown[]): Promise<T> => {
    if (!window.electronAPI) {
      throw new Error('Not running in Electron. IPC not available.');
    }
    return window.electronAPI.invoke<T>(channel, ...args);
  }, []);

  const on = useCallback((channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    if (!window.electronAPI) {
      return () => {}; // No-op for browser mode
    }
    return window.electronAPI.on(channel, callback);
  }, []);

  return { invoke, on };
}

/**
 * Hook to listen for IPC events
 */
export function useIpcListener(channel: string, callback: (...args: unknown[]) => void) {
  useEffect(() => {
    const unsubscribe = window.electronAPI.on(channel, callback);
    return unsubscribe;
  }, [channel, callback]);
}
