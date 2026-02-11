import { load, save } from "@/utils/storage"
import type { ProfileExtras } from "../types"

export const PROFILE_EXTRAS_KEY = "profile.extras.v1"

export async function getProfileExtras(): Promise<ProfileExtras> {
  return load<ProfileExtras>(PROFILE_EXTRAS_KEY) ?? {}
}

export async function updateProfileExtras(patch: Partial<ProfileExtras>): Promise<ProfileExtras> {
  const current = (await getProfileExtras()) ?? {}
  const next = { ...current, ...patch }
  save(PROFILE_EXTRAS_KEY, next)
  return next
}
