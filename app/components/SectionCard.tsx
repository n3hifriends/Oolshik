import React from "react"
import { View } from "react-native"

export const SectionCard: React.FC<{ style?: any; children: React.ReactNode }> = ({
  style,
  children,
}) => (
  <View
    style={[
      {
        backgroundColor: "#fff",
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#ECECEC",
        padding: 12,
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      },
      style,
    ]}
  >
    {children}
  </View>
)
