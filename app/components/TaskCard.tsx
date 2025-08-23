import React from "react"
import { View, Pressable } from "react-native"
import { Card } from "@/components/Card"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useAppTheme } from "@/theme/context"
import { Audio } from "expo-av"

type Props = {
  id: string
  title?: string
  kmAway?: number
  onAccept?: () => void
  status?: "PENDING" | "ASSIGNED" | "COMPLETED" | "OPEN" | "CANCELLED" | "CANCELED"
  voiceUrl?: string | null
  onPress?: () => void
  createdByName?: string
  createdAt?: string
}

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

export function TaskCard({
  title = "Voice task",
  kmAway,
  onAccept,
  status = "PENDING",
  voiceUrl,
  onPress,
  createdByName,
  createdAt,
}: Props) {
  const { theme } = useAppTheme()
  const { spacing, colors } = theme

  // Normalize backend statuses to UI statuses
  // Backend may send OPEN; map it to PENDING visually. Handle CANCELLED/CANCELED gracefully.
  const normalizedStatus: "PENDING" | "ASSIGNED" | "COMPLETED" =
    status === "OPEN"
      ? "PENDING"
      : status === "CANCELLED" || status === "CANCELED"
        ? "COMPLETED" // or choose a different bucket if you have a Cancelled style
        : (status as any)

  const primary = colors.palette.primary500
  const neutral700 = colors.palette.neutral700

  const statusMap = {
    PENDING: { label: "Pending", bg: colors.palette.primary200, fg: neutral700 },
    ASSIGNED: { label: "Assigned", bg: colors.palette.warningSoft400, fg: neutral700 },
    COMPLETED: { label: "Completed", bg: colors.palette.successSoft400, fg: neutral700 },
  } as const
  const S = statusMap[normalizedStatus] ?? statusMap.PENDING

  const [sound, setSound] = React.useState<Audio.Sound | null>(null)
  const [playing, setPlaying] = React.useState(false)

  const play = async () => {
    if (!voiceUrl) return
    const { sound } = await Audio.Sound.createAsync({ uri: voiceUrl })
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

  // Footer: type as ReactElement | undefined to satisfy Card’s prop
  const FooterComponent =
    status === "PENDING" && onAccept ? (
      <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
        <Button
          text="Accept"
          onPress={onAccept}
          style={{
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.xs,
            borderRadius: spacing.sm,
            minWidth: 100,
          }}
        />
      </View>
    ) : undefined // <-- important

  const HeaderRow = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {/* Avatar with initials */}
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: "#E5E7EB",
          alignItems: "center",
          justifyContent: "center",
        }}
        accessibilityLabel={createdByName ? `${createdByName} avatar` : "User avatar"}
      >
        <Text text={getInitials(createdByName)} size="xs" weight="bold" />
      </View>

      <View style={{ flex: 1 }}>
        {/* Poster name */}
        <Text text={createdByName ?? "Someone nearby"} weight="medium" />
        {/* When posted */}
        <Text text={minsAgo(createdAt)} size="xs" />
      </View>
      {voiceUrl ? (
        <Pressable
          onPress={play}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: primary,
            justifyContent: "center",
            alignItems: "center",
            marginRight: spacing.md,
          }}
          accessibilityRole="button"
          accessibilityLabel={playing ? "Playing" : "Play voice"}
        >
          <Text text={playing ? "…" : "▶︎"} style={{ color: "white", fontWeight: "bold" }} />
        </Pressable>
      ) : undefined}
      {status === "PENDING" && onAccept ? (
        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
          <Button
            text="Accept"
            onPress={onAccept}
            style={{
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.xs,
              borderRadius: spacing.sm,
              minWidth: 100,
            }}
          />
        </View>
      ) : undefined}
    </View>
  )
  // Left component: small, pressable play control
  // const LeftComponent = voiceUrl ? (
  //   <Pressable
  //     onPress={play}
  //     style={{
  //       width: 30,
  //       height: 30,
  //       borderRadius: 20,
  //       backgroundColor: primary,
  //       justifyContent: "center",
  //       alignItems: "center",
  //       marginRight: spacing.md,
  //     }}
  //     accessibilityRole="button"
  //     accessibilityLabel={playing ? "Playing" : "Play voice"}
  //   >
  //     <Text text={playing ? "…" : "▶︎"} style={{ color: "white", fontWeight: "bold" }} />
  //   </Pressable>
  // ) : undefined // <-- undefined, not null

  const ContentComponent = (
    <View style={{ gap: spacing.xs }}>
      {HeaderRow}

      {/* Title */}
      <Text text={title} weight="bold" style={{ color: neutral700 }} />

      {/* Distance + Status side-by-side */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.sm,
        }}
      >
        {!!kmAway && (
          <Text text={`${kmAway.toFixed(1)} km away`} size="xs" style={{ color: neutral700 }} />
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
  )

  return (
    <Card
      style={{ marginVertical: spacing.xs, elevation: 2 }}
      verticalAlignment="force-footer-bottom"
      // LeftComponent={LeftComponent}
      ContentComponent={ContentComponent}
      onPress={onPress}
      activeOpacity={onPress ? 0.85 : undefined}
    />
  )
}
