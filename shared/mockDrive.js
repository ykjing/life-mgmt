/**
 * mockDrive.js — HTTP fetch-based mock store for demo mode.
 *
 * Reads static JSON files committed to the repo under /MockDrive/.
 * Writes are held in memory only (lost on refresh) — suitable for demo.
 *
 * Interface mirrors createDriveStore:
 *   store.readJson(filename)
 *   store.writeJson(filename, data)
 *   store.clearCache()
 *
 * Usage:
 *   import { createMockStore } from '../shared/mockDrive.js';
 *   const store = createMockStore('lifeMgmt/fitness');
 *   await store.readJson('plan.json');   // fetches /MockDrive/lifeMgmt/fitness/plan.json
 */

const MOCK_BASE = '/MockDrive/';

export function createMockStore(folderPath) {
  const prefix = MOCK_BASE + folderPath.replace(/\/$/, '') + '/';
  const memCache = {};

  async function readJson(filename) {
    if (filename in memCache) return memCache[filename];
    try {
      const resp = await fetch(prefix + filename);
      if (!resp.ok) return null;
      const data = await resp.json();
      memCache[filename] = data;
      return data;
    } catch { return null; }
  }

  function writeJson(filename, data) {
    memCache[filename] = data;
  }

  function clearCache() {
    Object.keys(memCache).forEach(k => delete memCache[k]);
  }

  return { readJson, writeJson, clearCache };
}
