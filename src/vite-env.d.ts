/// <reference types="vite/client" />

interface ChromeTab {
  id?: number;
  url?: string;
}

interface ChromeRuntime {
  openOptionsPage(callback?: () => void): void;
  sendMessage(message: unknown, callback?: (response: unknown) => void): void;
  onMessage: {
    addListener(
      callback: (message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => boolean | void
    ): void;
  };
}

interface ChromeStorageArea {
  get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  remove(keys: string | string[]): Promise<void>;
}

interface ChromeApi {
  runtime: ChromeRuntime;
  tabs: {
    query(queryInfo: Record<string, unknown>): Promise<ChromeTab[]>;
    sendMessage(tabId: number, message: unknown): Promise<unknown>;
  };
  storage: {
    local: ChromeStorageArea;
  };
}

declare const chrome: ChromeApi;
