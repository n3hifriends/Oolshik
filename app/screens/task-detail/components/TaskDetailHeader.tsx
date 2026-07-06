import React from "react"
import { ActivityIndicator, Pressable, View } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
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
  reportBgColor: string
  reportBorderColor: string
  reportIconColor: string
  spacingXs: number
  spacingSm: number
  spacingXxxs: number
}

export function TaskDetailHeader(props: TaskDetailHeaderProps) {
  return (
    <View style={{ padding: 16, flexDirection: "row", alignItems: "center" }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text preset="heading" text={props.title} numberOfLines={2} />
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
          hitSlop={6}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: props.neutral300,
            backgroundColor: props.neutral100,
            opacity: props.refreshing ? 0.6 : 1,
            transform: [{ scale: pressed ? 0.96 : 1 }],
            alignItems: "center",
            justifyContent: "center",
          })}
        >
          {props.refreshing ? (
            <ActivityIndicator size="small" color={props.primaryColor} />
          ) : (
            <MaterialCommunityIcons name="refresh" size={20} color={props.textDimColor} />
          )}
        </Pressable>
        <Pressable
          onPress={props.onReport}
          accessibilityRole="button"
          accessibilityLabel={props.reportLabel}
          hitSlop={6}
          style={({ pressed }) => ({
            width: 40,
            height: 40,
            borderRadius: 20,
            borderWidth: 1,
            borderColor: props.reportBorderColor,
            backgroundColor: props.reportBgColor,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ scale: pressed ? 0.96 : 1 }],
          })}
        >
          <MaterialCommunityIcons name="flag-outline" size={20} color={props.reportIconColor} />
        </Pressable>
      </View>
    </View>
  )
}
