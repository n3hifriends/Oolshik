import React from "react"
import { View, ActivityIndicator, Pressable } from "react-native"
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

type RouteParams = { id: string }

function getInitials(name?: string) {
  if (!name) return "?"
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

function minsAgo(iso?: string) {
  if (!iso) return ""
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.max(0, Math.round(diffMs / 60000))
  if (mins < 1) return "just now"
  if (mins === 1) return "1 min ago"
  if (mins < 60) return `${mins} mins ago`
  const hrs = Math.round(mins / 60)
  return hrs === 1 ? "1 hr ago" : `${hrs} hrs ago`
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
  const { radiusKm } = useTaskStore()

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

  // ensure we have the task (e.g., deep link / app resume)
  React.useEffect(() => {
    let cancelled = false
    const load = async () => {
      if (taskFromStore) return
      setLoading(true)
      try {
        // mock mode: nearbyTasks() returns in-memory dummyTasks (no args needed)
        // real mode: pass actual coords/radius
        const res = FLAGS.USE_MOCK_NEARBY
          ? await OolshikApi.nearbyTasks(23, 322, 32)
          : await OolshikApi.nearbyTasks(
              coords?.latitude ?? 0,
              coords?.longitude ?? 0,
              radiusKm ?? 3,
            )

        const list = res?.ok ? (res.data ?? []) : []
        const found = list.find?.((t: any) => String(t.id) === String(taskId)) ?? null

        if (!cancelled) setTask(found)
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

  const current = task || taskFromStore || null
  const S = current ? statusMap[current.status as keyof typeof statusMap] : statusMap.PENDING

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
    if (!current) return
    const result = await accept(current.id)
    if (result === "ALREADY") alert("Already assigned")
    // reflect status locally
    setTask((t: any) => (t ? { ...t, status: "ASSIGNED" } : t))
  }

  const onComplete = async () => {
    if (!current) return
    const res = await OolshikApi.completeTask(current.id as any)
    if (res?.ok) setTask((t: any) => (t ? { ...t, status: "COMPLETED" } : t))
  }

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]} contentContainerStyle={{ flex: 1 }}>
      {/* Header (fixed) */}
      <View style={{ padding: 16, flexDirection: "row", alignItems: "center" }}>
        <Text preset="heading" text="Task Detail" />
        {/* REPORT *** lightweight header action */}
        <View style={{ marginLeft: "auto" }}>
          <Button
            text="Report"
            onPress={() => navigation.navigate("OolshikReport", { taskId: current?.id })}
          />
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1, paddingHorizontal: 16 }}>
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

            {/* Distance + Status pill in one row */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              {typeof current.distanceKm === "number" ? (
                <Text
                  text={`${current.distanceKm.toFixed(1)} km away`}
                  size="xs"
                  style={{ color: neutral700 }}
                />
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
            </View>
          </View>
        )}
      </View>

      {/* Bottom actions */}
      {current && (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 16,
            flexDirection: "row",
            gap: spacing.sm,
          }}
        >
          <Button
            text="Report"
            onPress={() => navigation.navigate("OolshikReport", { taskId: current.id })}
            style={{ flex: 1, paddingVertical: spacing.xs }}
          />
          {current.status === "PENDING" ? (
            <Button
              text="Accept"
              onPress={onAccept}
              style={{ flex: 2, paddingVertical: spacing.xs }}
            />
          ) : current.status === "ASSIGNED" ? (
            <Button
              text="Mark as Complete"
              onPress={onComplete}
              style={{ flex: 2, paddingVertical: spacing.xs }}
            />
          ) : (
            <Button text="Completed" disabled style={{ flex: 2, paddingVertical: spacing.xs }} />
          )}
        </View>
      )}
    </Screen>
  )
}
