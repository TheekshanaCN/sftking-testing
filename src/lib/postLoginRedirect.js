const STORAGE_KEY = 'sft_post_login_redirect';

const isHttpLike = (value) => /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value);

const normalizePath = (value) => {
  if (!value) return null;
  let raw = String(value).trim();
  if (!raw) return null;

  try {
    raw = decodeURIComponent(raw);
  } catch {
    // Keep original if it's not valid encoded text.
  }

  if (isHttpLike(raw)) {
    if (typeof window === 'undefined') return null;
    try {
      const url = new URL(raw);
      if (url.origin !== window.location.origin) return null;
      raw = `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }

  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//')) return null;
  if (raw.startsWith('/auth')) return null;

  return raw;
};

const isAllowedForRole = (path, role) => {
  if (!path) return false;
  if (role === 'student' && path.startsWith('/admin')) return false;
  if (role === 'admin' && path.startsWith('/student')) return false;
  return true;
};

export const getDefaultRouteForRole = (role) => (
  role === 'admin' ? '/admin/dashboard' : '/student/dashboard'
);

export const rememberPostLoginRedirect = (path) => {
  if (typeof window === 'undefined') return;
  const safe = normalizePath(path);
  if (!safe) return;
  sessionStorage.setItem(STORAGE_KEY, safe);
};

const readRedirectFromQuery = () => {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search || '');
  return params.get('redirect') || params.get('next') || params.get('returnTo');
};

const safeSessionStorageGet = (key) => {
  try {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem(key);
    }
  } catch (e) {}
  return null;
};

const safeSessionStorageRemove = (key) => {
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(key);
    }
  } catch (e) {}
};

export const consumePostLoginRedirect = (role) => {
  const fallback = getDefaultRouteForRole(role);
  if (typeof window === 'undefined') return fallback;

  const fromQuery = normalizePath(readRedirectFromQuery());
  const fromStorage = normalizePath(safeSessionStorageGet(STORAGE_KEY));

  safeSessionStorageRemove(STORAGE_KEY);

  let candidate = fromQuery || fromStorage;
  if (!candidate) return fallback;
  if (!isAllowedForRole(candidate, role)) return fallback;

  // Prevent routing back to a non-existent login route or admin loop
  if (candidate.startsWith('/admin/login') || candidate === '/admin' || candidate === '/admin/') {
    return '/admin/dashboard';
  }

  return candidate;
};
