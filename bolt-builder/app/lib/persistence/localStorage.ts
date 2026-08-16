// Client-side storage utilities
const isClient = typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export function getLocalStorage(key: string): any | null {
  if (!isClient) {
    return null;
  }

  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error(`Error reading from localStorage key "${key}":`, error);
    return null;
  }
}

export function setLocalStorage(key: string, value: any): void {
  if (!isClient) {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing to localStorage key "${key}":`, error);
  }
}

/**
 * Reset all browser-local ZYRAXON Builder state.
 *
 * Builder conversations are stored in IndexedDB (`boltHistory`), while
 * authentication, profile, provider settings and other client state can live
 * in localStorage/sessionStorage/cookies. This intentionally clears all of
 * those browser-local stores so the next load behaves like a fresh session.
 */
export async function resetLocalBuilderData(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.clear();
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
  }

  try {
    window.sessionStorage.clear();
  } catch (error) {
    console.error('Failed to clear sessionStorage:', error);
  }

  try {
    const cookieNames = document.cookie
      .split(';')
      .map((cookie) => cookie.split('=')[0]?.trim())
      .filter(Boolean);

    for (const name of cookieNames) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      document.cookie = `${name}=; Max-Age=0; path=/`;
    }
  } catch (error) {
    console.error('Failed to clear browser cookies:', error);
  }

  try {
    if (typeof indexedDB !== 'undefined') {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('boltHistory', 2);

        request.onerror = () => reject(request.error || new Error('Unable to open Builder history database'));

        request.onsuccess = () => {
          const database = request.result;
          const storeNames = Array.from(database.objectStoreNames);

          if (storeNames.length === 0) {
            database.close();
            resolve();
            return;
          }

          const transaction = database.transaction(storeNames, 'readwrite');

          transaction.oncomplete = () => {
            database.close();
            resolve();
          };

          transaction.onerror = () => {
            database.close();
            reject(transaction.error || new Error('Unable to clear Builder history database'));
          };

          for (const storeName of storeNames) {
            transaction.objectStore(storeName).clear();
          }
        };
      });
    }
  } catch (error) {
    console.error('Failed to clear Builder IndexedDB state:', error);
  }

  try {
    if ('caches' in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
    }
  } catch (error) {
    console.error('Failed to clear browser caches:', error);
  }
}
