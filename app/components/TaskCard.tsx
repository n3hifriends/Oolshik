import React from "react"
import { View, Pressable, ActivityIndicator } from "react-native"
import { useTranslation } from "react-i18next"
import { Card } from "@/components/Card"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { useAppTheme } from "@/theme/context"
import { RatingBadge } from "./RatingBadge"
import { useAudioPlaybackForUri } from "@/audio/audioPlayback"
import { formatDistanceLabel } from "@/utils/distance"
import { getStatusColors } from "@/theme/statusColors"
import { useResponsiveLayout } from "@/utils/useResponsiveLayout"

type Props = {
  id: string
  title?: string
  distanceMtr?: number
  onAccept?: () => void
  status?:
    | "PENDING"
    | "PENDING_AUTH"
    | "ASSIGNED"
    | "WORK_DONE_PENDING_CONFIRMATION"
    | "REVIEW_REQUIRED"
    | "COMPLETED"
    | "OPEN"
    | "CANCELLED"
    | "CANCELED"
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
  const { scaleIcon } = useResponsiveLayout()
  const avatarSize = scaleIcon(28)

  // Normalize backend statuses to UI statuses
  // Backend may send OPEN; map it to PENDING visually. Handle CANCELLED/CANCELED gracefully.
  const normalizedStatus:
    | "PENDING"
    | "PENDING_AUTH"
    | "ASSIGNED"
    | "WORK_DONE_PENDING_CONFIRMATION"
    | "REVIEW_REQUIRED"
    | "COMPLETED"
    | "CANCELLED" =
    status === "OPEN"
      ? "PENDING"
      : status === "CANCELLED" || status === "CANCELED"
        ? "CANCELLED"
        : (status as any)

  const primary = colors.palette.primary500

  const statusLabels: Record<string, string> = {
    PENDING: t("oolshik:status.pending"),
    PENDING_AUTH: t("oolshik:status.pendingAuth"),
    ASSIGNED: t("oolshik:status.assigned"),
    WORK_DONE_PENDING_CONFIRMATION: t("oolshik:status.waitingConfirmation"),
    REVIEW_REQUIRED: t("oolshik:status.reviewRequired"),
    COMPLETED: t("oolshik:status.completed"),
    CANCELLED: t("oolshik:status.cancelled"),
  }
  const { bg: statusBg, fg: statusFg } = getStatusColors(normalizedStatus, theme.isDark)
  const statusLabel = statusLabels[normalizedStatus] ?? normalizedStatus

  const canAccept = !!onAccept && (status === "OPEN" || status === "PENDING")
  const normalizedVoiceUrl = typeof voiceUrl === "string" ? voiceUrl.trim() : ""

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

  const distance = formatDistanceLabel(distanceMtr ?? 0, t) ?? `0${t("oolshik:units.mShort")}`

  const HeaderRow = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {/* Avatar with initials */}
      <View
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: avatarSize / 2,
          backgroundColor: colors.separator,
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

      <View style={{ flex: 1, minWidth: 0 }}>
        {/* Poster name */}
        <Text text={createdByName ?? t("oolshik:taskCard.someoneNearby")} weight="medium" numberOfLines={2} />
        {/* When posted */}
        <Text text={minsAgo(createdAt, t)} size="xs" numberOfLines={1} />
      </View>
      {normalizedVoiceUrl ? <VoicePlayButton uri={normalizedVoiceUrl} playKey={id} /> : undefined}
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs, minWidth: 0 }}>
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
          <Text
            text={title || t("oolshik:taskCard.voiceTask")}
            weight="bold"
            numberOfLines={2}
            style={{ color: colors.text, flex: 1, minWidth: 0 }}
          />
        )}
      </View>

      {/* Distance + Status side-by-side */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: spacing.sm,
          minWidth: 0,
        }}
      >
        <Text
          text={t("oolshik:taskCard.distanceAway", { distance })}
          size="xs"
          numberOfLines={1}
          style={{ color: colors.textDim, flex: 1, minWidth: 0 }}
        />

        <View
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xxs,
            borderRadius: 999,
            backgroundColor: statusBg,
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          <Text text={statusLabel} size="xs" weight="medium" numberOfLines={1} style={{ color: statusFg }} />
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
