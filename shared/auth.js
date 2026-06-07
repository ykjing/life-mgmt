const GOOGLE_CLIENT_ID = '754111633048-mu1nmss3re7vr4mkrjimltkinotb4ai6.apps.googleusercontent.com';
export const SCOPES = 'https://www.googleapis.com/auth/drive.file profile';

let tokenClient = null;
let accessToken = null;
let tokenExpiry = 0;

export function getAccessToken() { return accessToken; }
export function isTokenValid() { return Date.now() < tokenExpiry && !!accessToken; }

export async function waitForGIS() {
  while (!window.google?.accounts?.oauth2) {
    await new Promise(r => setTimeout(r, 50));
  }
}

export function setToken(resp) {
  accessToken = resp.access_token;
  tokenExpiry = Date.now() + (resp.expires_in - 60) * 1000;
  try {
    localStorage.setItem('ll_token', accessToken);
    localStorage.setItem('ll_expiry', tokenExpiry.toString());
  } catch(e) {}
}

export function loadStoredToken() {
  try {
    const token  = localStorage.getItem('ll_token');
    const expiry = parseInt(localStorage.getItem('ll_expiry') || '0');
    if (token && Date.now() < expiry) return { token, expiry };
  } catch(e) {}
  return null;
}

export function clearStoredToken() {
  try {
    localStorage.removeItem('ll_token');
    localStorage.removeItem('ll_expiry');
  } catch(e) {}
}

export async function getTokenClient() {
  await waitForGIS();
  if (!tokenClient) {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: SCOPES,
      callback: ''
    });
  }
  return tokenClient;
}

export async function ensureToken(onFailure) {
  if (isTokenValid()) return true;
  const client = await getTokenClient();
  try {
    await new Promise((resolve, reject) => {
      client.callback = resp => resp.error ? reject(new Error(resp.error)) : (setToken(resp), resolve());
      client.requestAccessToken({ prompt: '' });
    });
    return true;
  } catch(e) {
    clearStoredToken();
    if (onFailure) onFailure();
    return false;
  }
}

export async function signIn(onSuccess, onFailure) {
  const client = await getTokenClient();
  try {
    await new Promise((resolve, reject) => {
      client.callback = resp => resp.error ? reject(new Error(resp.error)) : (setToken(resp), resolve());
      client.requestAccessToken({ prompt: 'select_account' });
    });
    if (onSuccess) await onSuccess();
  } catch(e) {
    if (e.message !== 'access_denied' && onFailure) onFailure();
  }
}

export function signOut(onComplete) {
  if (accessToken) google.accounts.oauth2.revoke(accessToken);
  accessToken = null;
  tokenExpiry = 0;
  clearStoredToken();
  if (onComplete) onComplete();
}

export async function initAuth({ onSignedIn, onSignOut }) {
  const stored = loadStoredToken();
  if (stored) {
    accessToken = stored.token;
    tokenExpiry = stored.expiry;
    if (onSignedIn) await onSignedIn();
    return;
  }

  await waitForGIS();
  const client = await getTokenClient();
  try {
    await Promise.race([
      new Promise((resolve, reject) => {
        client.callback = resp => resp.error ? reject(new Error(resp.error)) : (setToken(resp), resolve());
        client.requestAccessToken({ prompt: '' });
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);
    if (onSignedIn) await onSignedIn();
  } catch(e) {
    if (onSignOut) onSignOut();
  }
}
