import { getAccessToken, ensureToken } from './auth.js';

async function driveGet(path) {
  const resp = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    headers: { 'Authorization': `Bearer ${getAccessToken()}` }
  });
  if (!resp.ok) throw new Error(`Drive GET ${resp.status}`);
  return resp.json();
}

async function drivePost(path, metadata, fileContent) {
  if (fileContent === undefined) {
    const resp = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${getAccessToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(metadata)
    });
    if (!resp.ok) throw new Error(`Drive POST ${resp.status}`);
    return resp.json();
  }
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file',     new Blob([fileContent],              { type: 'application/json' }));
  const resp = await fetch(`https://www.googleapis.com/upload/drive/v3/${path}?uploadType=multipart`, {
    method: 'POST', headers: { 'Authorization': `Bearer ${getAccessToken()}` }, body: form
  });
  if (!resp.ok) throw new Error(`Drive upload ${resp.status}`);
  return resp.json();
}

async function drivePatch(fileId, fileContent) {
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({})],  { type: 'application/json' }));
  form.append('file',     new Blob([fileContent],         { type: 'application/json' }));
  const resp = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
    method: 'PATCH', headers: { 'Authorization': `Bearer ${getAccessToken()}` }, body: form
  });
  if (!resp.ok) throw new Error(`Drive PATCH ${resp.status}`);
}

// Resolve a slash-separated folder path, creating folders as needed.
// Returns the Drive folder ID of the deepest folder.
async function resolveFolderPath(folderPath) {
  const parts = folderPath.split('/').filter(Boolean);
  let parentId = null;
  for (const part of parts) {
    const parentClause = parentId ? `'${parentId}' in parents` : `'root' in parents`;
    const q = `name='${part}' and mimeType='application/vnd.google-apps.folder' and ${parentClause} and trashed=false`;
    const res = await driveGet(`files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`);
    if (res.files.length > 0) {
      parentId = res.files[0].id;
    } else {
      const meta = { name: part, mimeType: 'application/vnd.google-apps.folder' };
      if (parentId) meta.parents = [parentId];
      const created = await drivePost('files', meta);
      parentId = created.id;
    }
  }
  return parentId;
}

/**
 * createDriveStore(folderPath, onAuthFailure)
 * folderPath supports nested paths: 'lifeLog' or 'lifeLog/fitness'
 * Returns { readJson, writeJson, clearCache }
 */
export function createDriveStore(folderPath, onAuthFailure) {
  let folderId = null;
  const fileIdCache = {};
  const dataCache   = {};

  async function getOrCreateFolder() {
    if (folderId) return folderId;
    folderId = await resolveFolderPath(folderPath);
    return folderId;
  }

  async function getFileId(filename) {
    if (fileIdCache[filename]) return fileIdCache[filename];
    const folder = await getOrCreateFolder();
    const q      = `name='${filename}' and '${folder}' in parents and trashed=false`;
    const res    = await driveGet(`files?q=${encodeURIComponent(q)}&fields=files(id)&spaces=drive`);
    if (res.files.length > 0) fileIdCache[filename] = res.files[0].id;
    return fileIdCache[filename] || null;
  }

  async function readJson(filename) {
    if (dataCache[filename]) return dataCache[filename];
    if (!await ensureToken(onAuthFailure)) return null;
    try {
      const fileId = await getFileId(filename);
      if (!fileId) return null;
      const resp = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { 'Authorization': `Bearer ${getAccessToken()}` }
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      dataCache[filename] = data;
      return data;
    } catch(e) { return null; }
  }

  async function writeJson(filename, data, onError) {
    if (!await ensureToken(onAuthFailure)) return;
    dataCache[filename] = data;
    try {
      const content = JSON.stringify(data, null, 2);
      const fileId  = await getFileId(filename);
      if (fileId) {
        await drivePatch(fileId, content);
      } else {
        const folder  = await getOrCreateFolder();
        const created = await drivePost('files', { name: filename, parents: [folder] }, content);
        fileIdCache[filename] = created.id;
      }
    } catch(e) {
      if (onError) onError();
    }
  }

  function clearCache() {
    folderId = null;
    Object.keys(fileIdCache).forEach(k => delete fileIdCache[k]);
    Object.keys(dataCache).forEach(k => delete dataCache[k]);
  }

  return { readJson, writeJson, clearCache };
}
