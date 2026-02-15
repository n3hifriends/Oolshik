import React from "react"
import { View } from "react-native"
import { Button } from "@/components/Button"

type HomeFeedCreateBarProps = {
  onPressCreate: () => void
  createLabel: string
}

export function HomeFeedCreateBar(props: HomeFeedCreateBarProps) {
  return (
    <View style={{ position: "absolute", left: 16, right: 16, bottom: 0 }}>
      <View style={{ flex: 1, flexDirection: "row", justifyContent: "center" }}>
        <View style={{ flex: 0.5, flexDirection: "row", justifyContent: "center" }} />
        <View style={{ flex: 0.5, flexDirection: "row", justifyContent: "center" }}>
          <Button
            text={props.createLabel}
            onPress={props.onPressCreate}
            style={{ width: "100%", marginBottom: 0 }}
          />
        </View>
      </View>
    </View>
  )
}
