import { storage } from "@/utils/storage"

// app/auth/tokens.ts
const K = {
  access: "auth.accessToken",
  refresh: "auth.refreshToken",
} as const

export const tokens = {
  get access() {
    return storage.getString(K.access) ?? null
  },
  get refresh() {
    return storage.getString(K.refresh) ?? null
  },
  setBoth(access?: string | null, refresh?: string | null) {
    if (access) {
      storage.set(K.access, access)
    } else {
      storage.delete(K.access)
    }
    if (refresh) {
      storage.set(K.refresh, refresh)
    } else {
      storage.delete(K.refresh)
    }
  },
  clear() {
    storage.delete(K.access)
    storage.delete(K.refresh)
  },
}
