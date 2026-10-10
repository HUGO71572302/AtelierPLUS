/**
 * Environment detector: identifies if we're running in a restricted iframe
 * where cookies/storage are blocked.
 */

export interface EnvironmentInfo {
  isIframe: boolean;
  cookiesEnabled: boolean;
  localStorageEnabled: boolean;
  sessionStorageEnabled: boolean;
  indexedDBEnabled: boolean;
  isCrossOrigin: boolean;
  isBlockedEnvironment: boolean;
}

function testCookies(): boolean {
  try {
    document.cookie = "__test=1; SameSite=None; Secure";
    const enabled = document.cookie.includes("__test=1");
    document.cookie = "__test=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    return enabled;
  } catch {
    return false;
  }
}

function testLocalStorage(): boolean {
  try {
    const key = "__atelierplus_test__";
    localStorage.setItem(key, "test");
    const value = localStorage.getItem(key);
    localStorage.removeItem(key);
    return value === "test";
  } catch {
    return false;
  }
}

function testSessionStorage(): boolean {
  try {
    const key = "__atelierplus_test__";
    sessionStorage.setItem(key, "test");
    const value = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return value === "test";
  } catch {
    return false;
  }
}

function testIndexedDB(): boolean {
  try {
    const request = indexedDB.open("__atelierplus_test__", 1);
    return request !== null;
  } catch {
    return false;
  }
}

function isIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true; // Cross-origin iframe
  }
}

function isCrossOrigin(): boolean {
  try {
    // Try to access parent - will throw if cross-origin
    void window.top?.location.href;
    return false;
  } catch {
    return true;
  }
}

export function detectEnvironment(): EnvironmentInfo {
  const inIframe = isIframe();
  const cookies = testCookies();
  const localStorage = testLocalStorage();
  const sessionStorage = testSessionStorage();
  const indexedDB = testIndexedDB();
  const crossOrigin = isCrossOrigin();

  // Blocked if we're in an iframe AND most storage mechanisms are disabled
  const blocked = inIframe && (!cookies || !localStorage) && crossOrigin;

  return {
    isIframe: inIframe,
    cookiesEnabled: cookies,
    localStorageEnabled: localStorage,
    sessionStorageEnabled: sessionStorage,
    indexedDBEnabled: indexedDB,
    isCrossOrigin: crossOrigin,
    isBlockedEnvironment: blocked,
  };
}

export function shouldOpenInNewTab(): boolean {
  const env = detectEnvironment();
  return env.isBlockedEnvironment;
}
