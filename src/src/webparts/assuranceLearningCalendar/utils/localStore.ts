/**
 * Small JSON store in the browser's localStorage, used by the local test services so the sample data
 * survives page reloads and is shared by every tab. Does nothing when storage is unavailable
 * (private window, blocked site data) or when no key is given.
 */
export function readStored<T>(key: string | undefined): T | undefined {
  if (!key) {
    return undefined;
  }
  try {
    const raw: string | null = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

export function writeStored(key: string | undefined, value: unknown): void {
  if (!key) {
    return;
  }
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the change stays in memory only.
  }
}

export function clearStored(keys: string[]): void {
  keys.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  });
}

/** Id that stays unique across tabs, e.g. "local-lx2k9a-3". */
let counter: number = 0;
export function newLocalId(): string {
  counter++;
  return `local-${Date.now().toString(36)}-${counter}`;
}
