import React from "react"
import { View } from "react-native"
import { useAppTheme } from "@/theme/context"

export const SectionCard: React.FC<{ style?: any; children: React.ReactNode }> = ({
  style,
  children,
}) => {
  const { theme } = useAppTheme()
  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.surface,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: theme.colors.border,
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
}
