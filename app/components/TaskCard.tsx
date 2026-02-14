import React from "react"
import { View, Pressable, ActivityIndicator } from "react-native"
import { useTranslation } from "react-i18next"
import { Card } from "@/components/Card"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useAppTheme } from "@/theme/context"
import { RatingBadge } from "./RatingBadge"
import { useAudioPlaybackForUri } from "@/audio/audioPlayback"

type Props = {
  id: string
  title?: string
  distanceMtr?: number
  onAccept?: () => void
  status?: "PENDING" | "PENDING_AUTH" | "ASSIGNED" | "COMPLETED" | "OPEN" | "CANCELLED" | "CANCELED"
  voiceUrl?: string | null
  onPress?: () => void
  createdByName?: string
  createdAt?: string
  avgRating?: number | null
  onTitleRefresh?: () => void
  titleRefreshDisabled?: boolean
}

function getInitials(name?: string) {
  if (!name) return "👤"
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase()
}

function minsAgo(iso: string | undefined, t: (key: string, options?: any) => string) {
  if (!iso) return ""
  const date = new Date(iso)
  const diffMs = Date.now() - date.getTime()
  const mins = Math.max(0, Math.round(diffMs / 60000))

  if (mins < 1) return t("oolshik:relativeTime.justNow")
  if (mins === 1) return t("oolshik:relativeTime.oneMinAgo")
  if (mins < 60) return t("oolshik:relativeTime.minsAgo", { count: mins })
  const hrs = Math.round(mins / 60)
  if (hrs === 1) return t("oolshik:relativeTime.oneHrAgo")
  if (hrs < 24) return t("oolshik:relativeTime.hrsAgo", { count: hrs })

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
  id,
  title,
  distanceMtr,
  onAccept,
  status = "PENDING",
  voiceUrl,
  onPress,
  createdByName,
  createdAt,
  avgRating,
  onTitleRefresh,
  titleRefreshDisabled = false,
}: Props) {
  const { t } = useTranslation()
  const { theme } = useAppTheme()
  const { spacing, colors } = theme

  // Normalize backend statuses to UI statuses
  // Backend may send OPEN; map it to PENDING visually. Handle CANCELLED/CANCELED gracefully.
  const normalizedStatus: "PENDING" | "PENDING_AUTH" | "ASSIGNED" | "COMPLETED" | "CANCELLED" =
    status === "OPEN"
      ? "PENDING"
      : status === "CANCELLED" || status === "CANCELED"
        ? "CANCELLED"
        : (status as any)

  const primary = colors.palette.primary500
  const neutral700 = colors.palette.neutral700

  const statusMap = {
    PENDING: { label: t("oolshik:status.pending"), bg: colors.palette.primary200, fg: neutral700 },
    PENDING_AUTH: { label: t("oolshik:status.pendingAuth"), bg: colors.palette.primary100, fg: neutral700 },
    ASSIGNED: { label: t("oolshik:status.assigned"), bg: colors.palette.warningSoft400, fg: neutral700 },
    COMPLETED: { label: t("oolshik:status.completed"), bg: colors.palette.successSoft400, fg: neutral700 },
    CANCELLED: { label: t("oolshik:status.cancelled"), bg: colors.palette.neutral200, fg: neutral700 },
  } as const
  const S = statusMap[normalizedStatus] ?? statusMap.PENDING

  const canAccept = !!onAccept && (status === "OPEN" || status === "PENDING")

  // Footer: type as ReactElement | undefined to satisfy Card's prop
  const FooterComponent = canAccept ? (
    <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
      <Button
        text={t("oolshik:taskCard.accept")}
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

  const distance =
    (distanceMtr ?? 0) < 1000
      ? `${(distanceMtr ?? 0).toFixed(0)}m`
      : `${((distanceMtr ?? 0) / 1000).toFixed(1)}km`

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
        accessibilityLabel={
          createdByName
            ? t("oolshik:taskCard.avatarA11y", { name: createdByName })
            : t("oolshik:taskCard.userAvatarA11y")
        }
      >
        <Text text={getInitials(createdByName)} size="xs" weight="bold" />
      </View>

      <View style={{ flex: 1 }}>
        {/* Poster name */}
        <Text text={createdByName ?? t("oolshik:taskCard.someoneNearby")} weight="medium" />
        {/* When posted */}
        <Text text={minsAgo(createdAt, t)} size="xs" />
      </View>
      {voiceUrl ? <VoicePlayButton uri={voiceUrl} playKey={id} /> : undefined}
      {canAccept ? (
        <View style={{ flexDirection: "row", justifyContent: "flex-end" }}>
          <Button
            text={t("oolshik:taskCard.accept")}
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}>
        {onTitleRefresh ? (
          <Pressable
            onPress={onTitleRefresh}
            disabled={titleRefreshDisabled}
            accessibilityRole="button"
            accessibilityLabel={t("oolshik:taskCard.refreshTitleA11y")}
            accessibilityState={{ disabled: titleRefreshDisabled }}
          >
            <Text text={t("oolshik:taskCard.refreshTitle")} style={{ color: primary }} />
          </Pressable>
        ) : (
          <Text text={title || t("oolshik:taskCard.voiceTask")} weight="bold" style={{ color: neutral700, flex: 1 }} />
        )}
      </View>

      {/* Distance + Status side-by-side */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.sm,
        }}
      >
        {<Text text={t("oolshik:taskCard.distanceAway", { distance })} size="xs" style={{ color: neutral700 }} />}

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
        <RatingBadge value={avgRating} />
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

const VoicePlayButton = React.memo(function VoicePlayButton({
  uri,
  playKey,
}: {
  uri: string
  playKey: string
}) {
  const { theme } = useAppTheme()
  const { t } = useTranslation()
  const { spacing, colors } = theme
  const primary = colors.palette.primary500
  const { status: playbackStatus, toggle } = useAudioPlaybackForUri(uri, playKey)
  const audioLoading = playbackStatus === "loading"
  const playing = playbackStatus === "playing"

  return (
    <Pressable
      onPress={() => toggle()}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: primary,
        justifyContent: "center",
        alignItems: "center",
        marginRight: spacing.md,
        opacity: audioLoading ? 0.7 : 1,
      }}
      accessibilityRole="button"
      accessibilityLabel={
        audioLoading
          ? t("oolshik:taskCard.loadingVoice")
          : playing
            ? t("oolshik:taskCard.stopVoice")
            : t("oolshik:taskCard.playVoice")
      }
      accessibilityState={{ disabled: audioLoading }}
    >
      {audioLoading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Text text={playing ? "⏸" : "▶︎"} style={{ color: "white", fontWeight: "bold" }} />
      )}
    </Pressable>
  )
})
