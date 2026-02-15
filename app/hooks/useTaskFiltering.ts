import { useEffect, useMemo, useState } from "react"

import { getDistanceMeters, distanceLabel } from "@/utils/distance"
import { normalize } from "@/utils/text"

export type Status = "OPEN" | "PENDING_AUTH" | "ASSIGNED" | "COMPLETED" | "CANCELLED"
export type ViewMode = "forYou" | "mine"

type TaskLike = {
  id?: string | number
  status?: string | null
  requesterId?: string | number | null
  pendingHelperId?: string | number | null
  title?: string | null
  description?: string | null
  createdByName?: string | null
  requesterName?: string | null
  createdByPhoneNumber?: string | null
  phoneNumber?: string | null
  createdAt?: string | null
  distanceMtr?: number
  distance_m?: number
  distanceMeters?: number
  distance?: number
  distanceKm?: number
}

type IndexedTask = {
  task: TaskLike
  normalizedStatus: Status | null
  isMine: boolean
  pendingAuthVisibleForForYou: boolean
  searchHaystack: string
  sortDistance: number
  sortCreatedAt: number
}

const normalizeStatus = (status?: string | null): Status | null => {
  const raw = String(status ?? "")
    .trim()
    .toUpperCase()
  if (!raw) return null
  if (raw === "PENDING") return "OPEN"
  if (raw === "CANCELED") return "CANCELLED"
  if (
    raw === "OPEN" ||
    raw === "PENDING_AUTH" ||
    raw === "ASSIGNED" ||
    raw === "COMPLETED" ||
    raw === "CANCELLED"
  ) {
    return raw as Status
  }
  return null
}

export function useTaskFiltering(
  tasks: TaskLike[],
  options: {
    selectedStatuses: Set<Status>
    viewMode: ViewMode
    myId?: string
    rawQuery: string
  },
) {
  const [query, setQuery] = useState(options.rawQuery)
  useEffect(() => {
    if (options.rawQuery === "") {
      setQuery("")
      return
    }
    const t = setTimeout(() => setQuery(options.rawQuery), 220)
    return () => clearTimeout(t)
  }, [options.rawQuery])

  const uniqueTasks = useMemo(() => {
    const list = Array.isArray(tasks) ? tasks : []
    const deduped = new Map<unknown, TaskLike>()
    for (const task of list) {
      deduped.set(task?.id, task)
    }
    return Array.from(deduped.values())
  }, [tasks])

  const indexedTasks = useMemo(() => {
    const indexed: IndexedTask[] = uniqueTasks.map((task) => {
      const normalizedStatus = normalizeStatus(task.status)
      const distanceM = getDistanceMeters(task)

      return {
        task,
        normalizedStatus,
        isMine: options.myId ? String(task.requesterId) === String(options.myId) : false,
        pendingAuthVisibleForForYou:
          task.status !== "PENDING_AUTH" ||
          (options.myId ? String(task.pendingHelperId) === String(options.myId) : false),
        searchHaystack: normalize(
          [
            task.title,
            task.description,
            task.createdByName ?? task.requesterName,
            task.createdByPhoneNumber ?? task.phoneNumber,
            task.status,
            distanceM != null ? distanceLabel(distanceM) : "",
            distanceM != null ? Math.round(distanceM) : "",
            distanceM != null ? `${(distanceM / 1000).toFixed(1)} km` : "",
          ]
            .filter(Boolean)
            .join(" | "),
        ),
        sortDistance: distanceM ?? Number.POSITIVE_INFINITY,
        sortCreatedAt: new Date(task.createdAt ?? 0).getTime(),
      }
    })

    indexed.sort((a, b) => {
      if (a.sortDistance !== b.sortDistance) {
        return a.sortDistance - b.sortDistance
      }
      return b.sortCreatedAt - a.sortCreatedAt
    })

    return indexed
  }, [uniqueTasks, options.myId])

  const statusesToUse = useMemo(() => {
    if (options.selectedStatuses.size > 0) return options.selectedStatuses

    const discovered = new Set<Status>()
    for (const entry of indexedTasks) {
      if (entry.normalizedStatus) discovered.add(entry.normalizedStatus)
    }
    return discovered
  }, [indexedTasks, options.selectedStatuses])

  const normalizedQuery = useMemo(() => normalize(query), [query])

  const filtered = useMemo(() => {
    const showMine = options.viewMode === "mine"
    const results: TaskLike[] = []

    for (const entry of indexedTasks) {
      if (!entry.normalizedStatus || !statusesToUse.has(entry.normalizedStatus)) continue
      if (showMine ? !entry.isMine : entry.isMine) continue
      if (!showMine && !entry.pendingAuthVisibleForForYou) continue
      if (normalizedQuery && !entry.searchHaystack.includes(normalizedQuery)) continue
      results.push(entry.task)
    }

    return results
  }, [indexedTasks, normalizedQuery, options.viewMode, statusesToUse])

  return { filtered }
}
