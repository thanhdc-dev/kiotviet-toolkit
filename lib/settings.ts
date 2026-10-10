import { browser } from 'wxt/browser';
import type { Separator } from './formatPhone';

export interface Settings {
  /** Định dạng số điện thoại có phân cách. */
  enabled: boolean;
  separator: Separator;
  /** Hiện mọi số của khách (số chính + số phụ), mỗi số một dòng. */
  showAllNumbers: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  separator: 'space',
  showAllNumbers: true,
};

const KEY = 'settings';

function isSeparator(v: unknown): v is Separator {
  return v === 'space' || v === 'dot' || v === 'dash';
}

export function normalizeSettings(value: unknown): Settings {
  const v = (value ?? {}) as Partial<Settings>;
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : DEFAULT_SETTINGS.enabled,
    separator: isSeparator(v.separator) ? v.separator : DEFAULT_SETTINGS.separator,
    showAllNumbers:
      typeof v.showAllNumbers === 'boolean' ? v.showAllNumbers : DEFAULT_SETTINGS.showAllNumbers,
  };
}

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.sync.get(KEY);
  return normalizeSettings(stored[KEY]);
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const current = await loadSettings();
  await browser.storage.sync.set({ [KEY]: { ...current, ...patch } });
}

/** Lắng nghe thay đổi cấu hình (từ popup). Trả về hàm hủy đăng ký. */
export function watchSettings(callback: (settings: Settings) => void): () => void {
  const listener = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area === 'sync' && changes[KEY]) callback(normalizeSettings(changes[KEY].newValue));
  };
  browser.storage.onChanged.addListener(listener);
  return () => browser.storage.onChanged.removeListener(listener);
}
