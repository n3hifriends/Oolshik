import React from "react"
import { ActivityIndicator, Pressable, View } from "react-native"
import { Button } from "@/components/Button"
import { Text } from "@/components/Text"

type TaskDetailHeaderProps = {
  title: string
  refreshLabel: string
  reportLabel: string
  refreshA11yLabel: string
  refreshing: boolean
  onRefresh: () => void
  onReport: () => void
  primaryColor: string
  neutral100: string
  neutral300: string
  textDimColor: string
  spacingXs: number
  spacingSm: number
  spacingXxxs: number
}

export function TaskDetailHeader(props: TaskDetailHeaderProps) {
  return (
    <View style={{ padding: 16, flexDirection: "row", alignItems: "center" }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text preset="heading" text={props.title} numberOfLines={1} />
      </View>
      <View
        style={{
          marginLeft: props.spacingXs,
          flexShrink: 0,
          flexDirection: "row",
          alignItems: "center",
          gap: props.spacingXs,
        }}
      >
        <Pressable
          onPress={props.onRefresh}
          disabled={props.refreshing}
          accessibilityRole="button"
          accessibilityLabel={props.refreshA11yLabel}
          style={({ pressed }) => ({
            width: 32,
            height: 32,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: props.neutral300,
            backgroundColor: props.neutral100,
            opacity: props.refreshing ? 0.6 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          {props.refreshing ? (
            <ActivityIndicator size="small" color={props.primaryColor} />
          ) : (
            <Text text="↻" size="sm" weight="medium" style={{ color: props.textDimColor }} />
          )}
        </Pressable>
        <Button
          text="🚩"
          onPress={props.onReport}
          accessibilityLabel={props.reportLabel}
          style={{
            width: 32,
            height: 32,
            minHeight: 32,
            paddingHorizontal: 0,
            paddingVertical: 0,
            borderRadius: 16,
          }}
          textStyle={{ fontSize: 14, lineHeight: 18 }}
        />
      </View>
    </View>
  )
}
