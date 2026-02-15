import React from "react"
import { ActivityIndicator, View } from "react-native"
import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import type { LocationStatus } from "@/screens/home-feed/types"

type HomeFeedLocationStateProps = {
  status: LocationStatus
  errorText: string | null
  gettingLocationText: string
  locationDeniedTitle: string
  locationDeniedBody: string
  openSettingsLabel: string
  locationErrorTitle: string
  retryLabel: string
  fallbackText: string
  onOpenSettings: () => void
  onRetry: () => void
}

export function HomeFeedLocationState(props: HomeFeedLocationStateProps) {
  if (props.status === "loading" || props.status === "idle") {
    return (
      <View style={{ paddingVertical: 24, alignItems: "center", gap: 8 }}>
        <ActivityIndicator />
        <Text text={props.gettingLocationText} />
      </View>
    )
  }

  if (props.status === "denied") {
    return (
      <View style={{ paddingVertical: 24, gap: 12 }}>
        <Text text={props.locationDeniedTitle} preset="heading" />
        <Text text={props.locationDeniedBody} />
        <Button text={props.openSettingsLabel} onPress={props.onOpenSettings} />
      </View>
    )
  }

  if (props.status === "error") {
    return (
      <View style={{ paddingVertical: 24, gap: 12 }}>
        <Text text={props.locationErrorTitle} preset="heading" />
        <Text text={props.errorText ?? props.fallbackText} />
        <Button text={props.retryLabel} onPress={props.onRetry} />
      </View>
    )
  }

  return null
}
