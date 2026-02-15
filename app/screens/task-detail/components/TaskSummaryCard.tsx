import React from "react"
import { Pressable, View } from "react-native"
import { Text } from "@/components/Text"
import { RatingBadge } from "@/components/RatingBadge"

type TaskSummaryCardProps = {
  initials: string
  createdByName: string
  createdAtLabel: string
  voiceAvailable: boolean
  audioLoading: boolean
  playing: boolean
  onTogglePlay: () => void
  loadingVoiceLabel: string
  stopVoiceLabel: string
  playVoiceLabel: string
  description: string
  distanceLabel: string | null
  distanceAwayText: string
  onOpenMap: () => void
  mapLabel: string
  openMapA11y: string
  statusLabel: string
  statusBg: string
  statusFg: string
  showRatingBadge: boolean
  ratingBadgeValue?: number | null
  neutral200: string
  neutral600: string
  neutral700: string
  primary: string
  primary100: string
  primary200: string
  spacingXxs: number
  spacingXs: number
  spacingSm: number
  spacingMd: number
}

export function TaskSummaryCard(props: TaskSummaryCardProps) {
  return (
    <View style={{ gap: props.spacingMd }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: props.spacingSm }}>
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
          <Text text={props.initials} weight="bold" />
        </View>
        <View style={{ flex: 1 }}>
          <Text text={props.createdByName} weight="medium" />
          <Text text={props.createdAtLabel} size="xs" style={{ color: props.neutral600 }} />
        </View>

        {props.voiceAvailable ? (
          <Pressable
            onPress={props.onTogglePlay}
            accessibilityRole="button"
            accessibilityLabel={
              props.audioLoading
                ? props.loadingVoiceLabel
                : props.playing
                  ? props.stopVoiceLabel
                  : props.playVoiceLabel
            }
            accessibilityState={{ disabled: props.audioLoading }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: props.primary,
              alignItems: "center",
              justifyContent: "center",
              opacity: props.audioLoading ? 0.7 : 1,
            }}
          >
            <Text
              text={props.audioLoading ? "..." : props.playing ? "⏸" : "▶︎"}
              style={{ color: "white", fontWeight: "bold" }}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: props.spacingXs }}>
        <Text text={props.description} weight="bold" style={{ color: props.neutral700 }} />
      </View>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: props.spacingXxs,
          justifyContent: "space-between",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: props.spacingXxs,
            flexShrink: 1,
            minWidth: 0,
          }}
        >
          {props.distanceLabel ? (
            <View
              style={{
                paddingHorizontal: props.spacingXs,
                paddingVertical: 2,
                borderRadius: 999,
                backgroundColor: props.neutral200,
                flexShrink: 1,
                minWidth: 0,
              }}
            >
              <Text
                text={props.distanceAwayText}
                size="xs"
                numberOfLines={1}
                style={{ color: props.neutral700 }}
              />
            </View>
          ) : (
            <View />
          )}

          <Pressable
            onPress={props.onOpenMap}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: props.spacingXxs,
              paddingHorizontal: props.spacingXs,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: props.primary100,
              borderWidth: 1,
              borderColor: props.primary200,
              maxWidth: 96,
              flexShrink: 1,
            }}
            accessibilityRole="button"
            accessibilityLabel={props.openMapA11y}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <View
              style={{
                width: 16,
                height: 16,
                borderRadius: 8,
                backgroundColor: props.primary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text text="↗" size="xxs" weight="bold" style={{ color: "white" }} />
            </View>
            <Text
              text={props.mapLabel}
              size="xs"
              weight="medium"
              numberOfLines={1}
              style={{ color: props.primary, flexShrink: 1 }}
            />
          </Pressable>
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: props.spacingXxs,
            flexShrink: 0,
          }}
        >
          <View
            style={{
              paddingHorizontal: props.spacingXs,
              paddingVertical: 2,
              borderRadius: 999,
              backgroundColor: props.statusBg,
            }}
          >
            <Text text={props.statusLabel} size="xs" weight="medium" style={{ color: props.statusFg }} />
          </View>
          {props.showRatingBadge && props.ratingBadgeValue != null ? <RatingBadge value={props.ratingBadgeValue} /> : null}
        </View>
      </View>
    </View>
  )
}
