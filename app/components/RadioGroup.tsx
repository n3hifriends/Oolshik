import React, { memo } from "react"
import { View } from "react-native"
import { RadioChip, RadioChipValue } from "./RadioChip"

type Option = { label: string; value: RadioChipValue; disabled?: boolean }

type RadioGroupProps = {
  value: RadioChipValue
  onChange: (value: RadioChipValue) => void
  options: Option[]
  size?: "md" | "lg"
  gap?: number
  wrap?: boolean
}

export const RadioGroup = memo(function RadioGroup({
  value,
  onChange,
  options,
  size = "md",
  gap = 8,
  wrap = false,
}: RadioGroupProps) {
  return (
    <View style={{ flexDirection: "row", flexWrap: wrap ? "wrap" : "nowrap", gap }}>
      {options.map((opt) => (
        <RadioChip
          key={`${opt.value}`}
          label={opt.label}
          value={opt.value}
          selected={value === opt.value}
          onChange={onChange}
          disabled={opt.disabled}
          size={size}
        />
      ))}
    </View>
  )
})
