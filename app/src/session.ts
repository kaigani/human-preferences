import { api } from './api';

// One session per app load, reused for every judgment. Cached so concurrent
// callers share a single create request.
let sessionPromise: Promise<string> | null = null;

export function getSessionId(): Promise<string> {
  if (!sessionPromise) {
    const stored = sessionStorage.getItem('hp_session');
    if (stored) {
      sessionPromise = Promise.resolve(stored);
    } else {
      sessionPromise = api.createSession().then((s) => {
        sessionStorage.setItem('hp_session', s.id);
        return s.id;
      });
    }
  }
  return sessionPromise;
}
