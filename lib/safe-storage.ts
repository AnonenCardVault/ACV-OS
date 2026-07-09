type StorageArea = "local" | "session";

function storageFor(area: StorageArea) {
  if (typeof window === "undefined") return null;
  return area === "local" ? window.localStorage : window.sessionStorage;
}

function isQuotaExceededError(error: unknown) {
  return error instanceof DOMException && (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22 || error.code === 1014);
}

function warnStorage(message: string, error?: unknown) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(`[ACV storage] ${message}`, error || "");
  }
}

export function safeGetStorageItem(area: StorageArea, key: string) {
  const storage = storageFor(area);
  if (!storage) return null;

  try {
    return storage.getItem(key);
  } catch (error) {
    warnStorage(`Could not read ${key}.`, error);
    return null;
  }
}

export function safeSetStorageItem(
  area: StorageArea,
  key: string,
  value: string,
  options?: {
    onQuotaExceeded?: () => void;
  }
) {
  const storage = storageFor(area);
  if (!storage) return false;

  try {
    storage.setItem(key, value);
    return true;
  } catch (error) {
    if (isQuotaExceededError(error)) {
      warnStorage(`Quota exceeded while writing ${key}; evicting old image cache and skipping crash.`, error);
      options?.onQuotaExceeded?.();

      try {
        storage.setItem(key, value);
        return true;
      } catch (retryError) {
        warnStorage(`Retry failed while writing ${key}; cache write skipped.`, retryError);
        return false;
      }
    }

    warnStorage(`Could not write ${key}; cache write skipped.`, error);
    return false;
  }
}

export function safeRemoveStorageItem(area: StorageArea, key: string) {
  const storage = storageFor(area);
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch (error) {
    warnStorage(`Could not remove ${key}.`, error);
  }
}

export function cleanupLargeAcvStorageKeys(keepKeys: string[] = []) {
  const keep = new Set(keepKeys);

  (["local", "session"] as const).forEach((area) => {
    const storage = storageFor(area);
    if (!storage) return;

    try {
      const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(Boolean) as string[];
      keys.forEach((key) => {
        if (keep.has(key)) return;
        const normalized = key.toLowerCase();
        const isAcvKey = normalized.startsWith("acv") || normalized.includes("acv-") || normalized.includes("acv.");
        if (!isAcvKey) return;

        const value = storage.getItem(key) || "";
        const imageCacheKey = /(imageids|image-cache|imagecache|image|blob|base64|dataurl|objecturl|preview|temp-intake)/i.test(key);
        const imagePayload = value.startsWith("data:image") || value.includes("\"dataUrl\":\"data:") || value.includes("blob:");
        const oversizedAcvCache = value.length > 500_000;

        if (imageCacheKey || imagePayload || oversizedAcvCache) {
          storage.removeItem(key);
        }
      });
    } catch (error) {
      warnStorage(`Could not cleanup ${area} storage.`, error);
    }
  });
}
