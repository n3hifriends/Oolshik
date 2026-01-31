import { useEffect, useMemo, useState } from "react"
import { normalize } from "@/utils/text"
import { getDistanceMeters, distanceLabel } from "@/utils/distance"

export type Status = "OPEN" | "PENDING_AUTH" | "ASSIGNED" | "COMPLETED" | "CANCELLED"
export type ViewMode = "forYou" | "mine"

export function useTaskFiltering(
  tasks: any[],
  options: {
    selectedStatuses: Set<Status>
    viewMode: ViewMode
    myId?: string
    rawQuery: string
  },
) {
  const [query, setQuery] = useState(options.rawQuery)
  useEffect(() => {
    const t = setTimeout(() => setQuery(options.rawQuery), 220)
    return () => clearTimeout(t)
  }, [options.rawQuery])

  const filtered = useMemo(() => {
    const list = Array.isArray(tasks) ? tasks : []
    // de-dupe by id
    const unique = Array.from(new Map(list.map((t: any) => [t.id, t])).values())

    const statusesToUse: Status[] =
      options.selectedStatuses.size === 0
        ? (Array.from(new Set(unique.map((t: any) => t.status))).filter(Boolean) as Status[])
        : (Array.from(options.selectedStatuses) as Status[])

    const mine = (t: any) =>
      options.myId ? String(t?.requesterId) === String(options.myId) : false

    let res = unique.filter((t: any) => statusesToUse.includes(t.status as Status))
    res = res.filter((t: any) => (options.viewMode === "mine" ? mine(t) : !mine(t)))
    res = res.filter((t: any) => {
      if (t?.status !== "PENDING_AUTH") return true
      if (options.viewMode === "mine") return true
      return options.myId ? String(t?.pendingHelperId) === String(options.myId) : false
    })

    const q = normalize(query)
    if (q) {
      res = res.filter((t: any) => {
        const distM = getDistanceMeters(t)
        const hay = normalize(
          [
            t?.title,
            t?.description,
            t?.createdByName ?? t?.requesterName,
            t?.createdByPhoneNumber ?? t?.phoneNumber,
            t?.status,
            distM != null ? distanceLabel(distM) : "",
            distM != null ? Math.round(distM) : "",
            distM != null ? (distM / 1000).toFixed(1) + " km" : "",
          ]
            .filter(Boolean)
            .join(" | "),
        )
        return hay.includes(q)
      })
    }

    return res.sort((a: any, b: any) => {
      const ad = getDistanceMeters(a) ?? Number.POSITIVE_INFINITY
      const bd = getDistanceMeters(b) ?? Number.POSITIVE_INFINITY
      if (ad !== bd) return ad - bd
      const at = new Date(a.createdAt ?? 0).getTime()
      const bt = new Date(b.createdAt ?? 0).getTime()
      return bt - at
    })
  }, [tasks, options.selectedStatuses, options.viewMode, options.myId, query])

  return { filtered, query, setQuery }
}
