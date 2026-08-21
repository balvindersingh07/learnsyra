import { userStorageKey } from './supabase'

function readJson<T>(baseKey: string, fallback: T): T {
  const key = userStorageKey(baseKey)
  if (!key) return fallback
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function writeJson(baseKey: string, value: unknown) {
  const key = userStorageKey(baseKey)
  if (!key) return
  localStorage.setItem(key, JSON.stringify(value))
}

export function loadAdminStringMap(baseKey: string): Record<string, string> {
  const parsed = readJson<Record<string, string>>(baseKey, {})
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
}

export function saveAdminStringMap(baseKey: string, map: Record<string, string>) {
  writeJson(baseKey, map)
}

export function loadAdminStringList(baseKey: string): string[] {
  const parsed = readJson<string[]>(baseKey, [])
  return Array.isArray(parsed) ? parsed.filter(id => typeof id === 'string') : []
}

export function saveAdminStringList(baseKey: string, ids: string[]) {
  writeJson(baseKey, ids)
}
