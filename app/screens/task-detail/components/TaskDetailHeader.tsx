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
      <Text preset="heading" text={props.title} />
      <View
        style={{
          marginLeft: "auto",
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
            minHeight: 32,
            paddingHorizontal: props.spacingSm,
            paddingVertical: props.spacingXxxs,
            borderRadius: 999,
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
            <Text text={props.refreshLabel} size="xs" weight="medium" style={{ color: props.textDimColor }} />
          )}
        </Pressable>
        <Button
          text={props.reportLabel}
          onPress={props.onReport}
          style={{
            minHeight: 32,
            paddingHorizontal: props.spacingSm,
            paddingVertical: props.spacingXxxs,
            borderRadius: 999,
          }}
          textStyle={{ fontSize: 12, lineHeight: 16 }}
        />
      </View>
    </View>
  )
}
