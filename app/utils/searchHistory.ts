import { storage } from "@/utils/storage"

const KEY = "search.history.v1"
const MAX_ITEMS = 5

export function getSearchHistory(): string[] {
  try {
    const raw = storage.getString(KEY)
    if (!raw) return []
    return JSON.parse(raw) as string[]
  } catch {
    return []
  }
}

export function addToSearchHistory(term: string): void {
  const trimmed = term.trim()
  if (trimmed.length < 2) return
  const history = getSearchHistory().filter((h) => h !== trimmed)
  history.unshift(trimmed)
  storage.set(KEY, JSON.stringify(history.slice(0, MAX_ITEMS)))
}

export function clearSearchHistory(): void {
  storage.delete(KEY)
}
