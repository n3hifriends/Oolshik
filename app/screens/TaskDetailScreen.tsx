import React, { useState, useCallback } from "react"
import { View, ActivityIndicator, Pressable, Linking, Alert } from "react-native"
import { useRoute } from "@react-navigation/native"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useAppTheme } from "@/theme/context"
import { useTaskStore } from "@/store/taskStore"
import { OolshikApi } from "@/api"
import { Audio } from "expo-av"
import { FLAGS } from "@/config/flags"
import { useForegroundLocation } from "@/hooks/useForegroundLocation"
import { SmileySlider } from "@/components/SmileySlider"
import { RatingBadge } from "@/components/RatingBadge"
import { Task } from "@/api/client"

type RouteParams = { id: string }

function getInitials(name?: string) {
  if (!name) return "👤"
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

function minsAgo(iso?: string) {
  if (!iso) return ""
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const mins = Math.max(0, Math.round(diffMs / 60000))

  if (mins < 1) return "just now"
  if (mins === 1) return "1 min ago"
  if (mins < 60) return `${mins} mins ago`
  const hrs = Math.round(mins / 60)
  if (hrs === 1) return "1 hr ago"
  if (hrs < 24) return `${hrs} hrs ago`

  // For older than a day, show readable date
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function maskPhoneNumber(input?: string) {
  if (!input) return ""
  // keep non-digits as-is, mask all digits except the last 4
  const digits = input.replace(/\D/g, "")
  if (digits.length <= 4) return input
  const last4 = digits.slice(-4)
  let maskedDigitsIdx = 0
  const numDigitsToMask = Math.max(0, digits.length - 4)
  return input
    .split("")
    .map((ch) => {
      if (/\d/.test(ch)) {
        if (maskedDigitsIdx < numDigitsToMask) {
          maskedDigitsIdx += 1
          return "•"
        }
        // past masked portion -> reveal last 4
        return last4[maskedDigitsIdx++ - numDigitsToMask] || ch
      }
      return ch
    })
    .join("")
}

export default function TaskDetailScreen({ navigation }: any) {
  const { params } = useRoute<any>() as { params: RouteParams }
  const taskId = params?.id

  const { theme } = useAppTheme()
  const { spacing, colors } = theme

  const { tasks, accept } = useTaskStore()
  const taskFromStore = tasks.find((t) => String(t.id) === String(taskId))

  const [loading, setLoading] = React.useState(!taskFromStore)
  const [task, setTask] = React.useState(taskFromStore || null)

  const [sound, setSound] = React.useState<Audio.Sound | null>(null)
  const [playing, setPlaying] = React.useState(false)
  const { coords } = useForegroundLocation()
  const { radiusMeters } = useTaskStore()
  const [justCompleted, setJustCompleted] = React.useState(false)

  const [fullPhone, setFullPhone] = React.useState<string | null>(null)
  const [isRevealed, setIsRevealed] = React.useState(false)
  const [revealLoading, setRevealLoading] = React.useState(false)

  const primary = colors.palette.primary500
  const primarySoft = colors.palette.primary200
  const success = "#16A34A"
  const successSoft = "#BBF7D0"
  const warning = "#D97706"
  const warningSoft = "#FDE68A"
  const neutral600 = colors.palette.neutral600
  const neutral700 = colors.palette.neutral700

  const statusMap = {
    PENDING: { label: "Pending", bg: primarySoft, fg: primary },
    ASSIGNED: { label: "Assigned", bg: warningSoft, fg: warning },
    COMPLETED: { label: "Completed", bg: successSoft, fg: success },
  } as const

  const current = task || taskFromStore || null

  const [rating, setRating] = useState<number>(2.5) // center default (neutral)
  const [submitting, setSubmitting] = useState(false)

  React.useEffect(() => {
    if (current?.createdByPhoneNumber) {
      setFullPhone(String(current.createdByPhoneNumber))
      setIsRevealed(false) // always start masked on open
    }
  }, [current?.createdByPhoneNumber])

  // Normalize backend statuses (e.g., OPEN/CANCELLED) to UI statuses used in statusMap
  let normalizedStatus: "PENDING" | "ASSIGNED" | "COMPLETED" = "PENDING"
  const rawStatus = (current?.status as string | undefined) || undefined
  switch (rawStatus) {
    case "OPEN":
      normalizedStatus = "PENDING"
      break
    case "CANCELLED":
    case "CANCELED":
      normalizedStatus = "COMPLETED"
      break
    case "PENDING":
    case "ASSIGNED":
    case "COMPLETED":
      normalizedStatus = rawStatus as any
      break
    default:
      normalizedStatus = "PENDING"
  }

  // ensure we have the task (e.g., deep link / app resume)
  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (taskFromStore) return
      setLoading(true)
      try {
        const res = await OolshikApi.findTaskByTaskId(taskId)
        const fetchedTask = res?.ok ? (res.data as Task | null) : null
        if (!cancelled) setTask(fetchedTask)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId])

  const S = statusMap[normalizedStatus] ?? statusMap.PENDING

  const onRevealPhone = async () => {
    if (!current) return
    try {
      setRevealLoading(true)
      setIsRevealed(true)

      // Calls backend to log & return full number
      const res = await OolshikApi.revealPhone(current.id as any)
      if (res?.ok) {
        const num = res.data?.phoneNumber ?? fullPhone
        // const num = (res.data as { phoneNumber?: string })?.phoneNumber ?? fullPhone
        if (num) setFullPhone(String(num))
        setIsRevealed(true)
      } else {
        const msg = res?.data?.message || "Unable to show number"
        alert(msg)
      }
    } finally {
      setRevealLoading(false)
    }
  }

  const onCall = () => {
    const num = (fullPhone || "").replace(/[^+\d]/g, "")
    if (num) Linking.openURL(`tel:${num}`)
  }

  const play = async () => {
    if (!current?.voiceUrl) return
    const { sound } = await Audio.Sound.createAsync({ uri: String(current.voiceUrl) })
    setSound(sound)
    setPlaying(true)
    await sound.playAsync()
    sound.setOnPlaybackStatusUpdate((st: any) => {
      if (!st.isPlaying) {
        setPlaying(false)
        sound.unloadAsync()
        setSound(null)
      }
    })
  }

  const onAccept = async () => {
    if (!coords) {
      alert("Location not available")
      return
    }
    if (!current) return
    const result = await accept(current.id, coords.latitude, coords.longitude)
    if (result === "ALREADY") {
      alert("Already assigned")
    } else if (result === "OK") {
      alert("Task accepted")
      setTask((t: any) => (t ? { ...t, status: "ASSIGNED" } : t))
    } else {
      alert("Error accepting task / Requester can't accept this task")
    }
    // reflect status locally
  }

  const onComplete = async () => {
    if (!current) return
    const res = await OolshikApi.completeTask(current.id as any)
    if (res?.ok) {
      setTask((t: any) => (t ? { ...t, status: "COMPLETED" } : t))
      setJustCompleted(true)
      // Briefly show a success banner, then return to previous screen
      setTimeout(() => {
        try {
          navigation.goBack()
        } catch {
          // ignore
        }
      }, 1200)
    } else if (
      res?.status === 403 ||
      res?.status === 409 ||
      String(res?.data || "").includes("Only requester can complete")
    ) {
      alert("Only the requester can complete this task")
    } else {
      alert("Error completing task")
    }
  }

  const showRatings = normalizedStatus === "COMPLETED" ? true : false
  const distance =
    (current?.distanceMtr ?? 0) < 1000
      ? `${(current?.distanceMtr ?? 0).toFixed(0)}m`
      : `${((current?.distanceMtr ?? 0) / 1000).toFixed(1)}km`
  return (
    <Screen preset="scroll" safeAreaEdges={["top", "bottom"]}>
      {/* Header (fixed) */}
      <View style={{ padding: 16, flexDirection: "row", alignItems: "center" }}>
        <Text preset="heading" text="Task Detail" />
        {/* REPORT *** lightweight header action */}
        <View style={{ marginLeft: "auto" }}>
          <Button
            text="Report"
            onPress={() => {
              navigation.navigate("OolshikReport", { taskId: current?.id })
            }}
          />
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 32 }}>
        {loading || !current ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            {loading ? <ActivityIndicator /> : <Text text="Task not found" />}
          </View>
        ) : (
          <View style={{ gap: spacing.md }}>
            {/* Poster row */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: "#E5E7EB",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text text={getInitials(current.createdByName)} weight="bold" />
              </View>
              <View style={{ flex: 1 }}>
                <Text text={current.createdByName || "Someone nearby"} weight="medium" />
                <Text text={minsAgo(current.createdAt)} size="xs" style={{ color: neutral600 }} />
              </View>

              {/* Small play control on the right */}
              {!!current.voiceUrl && (
                <Pressable
                  onPress={play}
                  accessibilityRole="button"
                  accessibilityLabel={playing ? "Playing" : "Play voice"}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: primary,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    text={playing ? "…" : "▶︎"}
                    style={{ color: "white", fontWeight: "bold" }}
                  />
                </Pressable>
              )}
            </View>

            {/* Title / description */}
            <View style={{ gap: spacing.xs }}>
              <Text
                text={current.description || "Voice task"}
                weight="bold"
                style={{ color: neutral700 }}
              />
            </View>

            {/* Contact (masked -> reveal) */}
            {!!fullPhone && (
              <View
                style={{
                  gap: spacing.xs,
                  padding: spacing.sm,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.palette.neutral300,
                  backgroundColor: colors.palette.neutral100,
                }}
              >
                <Text text="Contact" weight="medium" style={{ color: neutral700 }} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                  <Text
                    text={isRevealed ? String(fullPhone) : maskPhoneNumber(fullPhone || "")}
                    weight="bold"
                    style={{ flex: 1, color: neutral700 }}
                  />
                  {isRevealed ? (
                    <Button text="Call" onPress={onCall} style={{ paddingVertical: spacing.xs }} />
                  ) : (
                    <Button
                      text={revealLoading ? "…" : "Show"}
                      onPress={onRevealPhone}
                      style={{ paddingVertical: spacing.xs }}
                    />
                  )}
                </View>
              </View>
            )}

            {/* Distance + Status pill in one row */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
              }}
            >
              {typeof current.distanceMtr === "number" ? (
                <Text text={`${distance} away`} size="xs" style={{ color: neutral700 }} />
              ) : (
                <View />
              )}

              <View
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: spacing.xxs,
                  borderRadius: 999,
                  backgroundColor: S.bg,
                }}
              >
                <Text text={S.label} size="xs" weight="medium" style={{ color: S.fg }} />
              </View>
              {showRatings && <RatingBadge value={current.ratingValue} />}
            </View>
          </View>
        )}
      </View>
      <View style={{ height: 12 }} />

      {/* Bottom actions / success banner */}
      {current && (
        <>
          {normalizedStatus === "PENDING" || normalizedStatus === "ASSIGNED" ? (
            <View
              style={{
                flexDirection: "row",
                marginHorizontal: 16,
                gap: spacing.sm,
              }}
            >
              {normalizedStatus === "PENDING" ? (
                <Button
                  text="Accept"
                  onPress={onAccept}
                  style={{ flex: 2, paddingVertical: spacing.xs }}
                />
              ) : (
                <View
                  style={{
                    gap: spacing.md,
                    paddingHorizontal: spacing.sm,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: colors.palette.neutral300,
                    backgroundColor: colors.palette.neutral100,
                    flex: 1,
                    paddingBottom: 32,
                  }}
                >
                  <Text tx="oolshik:yourExperience" preset="subheading" />
                  <SmileySlider disabled={false} value={rating} onChange={setRating} />
                  <Text style={{ textAlign: "center", marginTop: 6, opacity: 0.6 }}>
                    {rating.toFixed(1)} / 5.0
                  </Text>

                  <Button
                    text="Mark as Complete"
                    onPress={onComplete}
                    style={{ flex: 2, paddingVertical: spacing.xs }}
                  />
                </View>
              )}
            </View>
          ) : null}
          {normalizedStatus === "COMPLETED" && (
            <View
              style={{
                paddingVertical: spacing.xs,
                paddingHorizontal: spacing.sm,
                marginHorizontal: 16,
                borderRadius: 8,
                backgroundColor: successSoft,
                borderWidth: 1,
                borderColor: success,
              }}
            >
              <Text text="Task completed ✓" weight="bold" style={{ color: success }} />
              <Text style={{ marginBottom: 5 }} text="Thanks for helping!" size="xs" />
              <Button
                text="Ok"
                onPress={() => navigation.goBack()}
                style={{ flex: 2, paddingVertical: spacing.xs }}
              />
            </View>
          )}
        </>
      )}
    </Screen>
  )
}
