import { useRef } from "react"
import { Pressable, TextInput, View } from "react-native"

import { Text } from "@/components/Text"
import { useAppTheme } from "@/theme/context"

interface OtpBoxesProps {
  editable: boolean
  length?: number
  onChange: (value: string) => void
  value: string
}

export function OtpBoxes({ editable, length = 6, onChange, value }: OtpBoxesProps) {
  const inputRef = useRef<TextInput>(null)
  const { theme } = useAppTheme()
  const { spacing, colors } = theme

  const digits = Array.from({ length }).map((_, index) => value[index] ?? "")

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => inputRef.current?.focus()}
      style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.xs }}
    >
      {digits.map((digit, index) => (
        <View
          key={index}
          style={{
            flex: 1,
            maxWidth: 56,
            height: 56,
            borderRadius: 16,
            borderWidth: 1.5,
            borderColor:
              digit || (editable && index === Math.min(value.length, length - 1))
                ? colors.palette.primary500
                : colors.palette.neutral400,
            backgroundColor: editable ? colors.palette.neutral100 : colors.palette.neutral200,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text text={digit} weight="bold" style={{ fontSize: 20 }} />
        </View>
      ))}

      <TextInput
        ref={inputRef}
        editable={editable}
        keyboardAppearance={theme.isDark ? "dark" : "light"}
        keyboardType="number-pad"
        maxLength={length}
        onChangeText={(text) => onChange(text.replace(/\D/g, "").slice(0, length))}
        style={{ position: "absolute", opacity: 0, height: 0, width: 0 }}
        textContentType="oneTimeCode"
        value={value}
      />
    </Pressable>
  )
}
