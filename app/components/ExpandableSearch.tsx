import React from "react"
import { Pressable, TextInput, View } from "react-native"
import { Text } from "@/components/Text"
import { SectionCard } from "@/components/SectionCard"
import { typography } from "@/theme/typography"

type Props = {
  open: boolean
  setOpen: (v: boolean) => void
  value: string
  onChangeText: (t: string) => void
  onClear: () => void
  inputRef: React.RefObject<TextInput>
}

export const ExpandableSearch: React.FC<Props> = ({
  open,
  setOpen,
  value,
  onChangeText,
  onClear,
  inputRef,
}) => {
  return (
    <>
      {!open && (
        <Pressable
          onPress={() => {
            setOpen(true)
            setTimeout(() => inputRef.current?.focus(), 50)
          }}
          accessibilityRole="button"
          accessibilityLabel="Open search"
          style={{
            width: 30,
            height: 30,
            borderRadius: 22,
            backgroundColor: "#111827",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text text="🔍" style={{ color: "#fff", fontSize: 15, lineHeight: 18 }} />
        </Pressable>
      )}

      {open && (
        <SectionCard style={{ marginTop: 8, width: "80%", paddingVertical: 6 }}>
          <View
            style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 8 }}
          >
            <Text text="🔍" style={{ fontSize: 16, lineHeight: 16 }} />
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              placeholder="Search title, description, name, phone, distance…"
              placeholderTextColor="#9CA3AF"
              returnKeyType="search"
              style={{
                flex: 1,
                paddingVertical: 10,
                fontSize: 16,
                fontFamily: typography.primary.normal,
              }}
            />
            {value?.length ? (
              <Pressable onPress={onClear} accessibilityRole="button" accessibilityLabel="Clear">
                <Text text="✕" style={{ fontSize: 16, color: "#6B7280" }} />
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => {
                onClear()
                setOpen(false)
              }}
              accessibilityRole="button"
              accessibilityLabel="Close search"
              style={{
                marginLeft: 2,
                paddingHorizontal: 8,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: "#F3F4F6",
              }}
            >
              <Text text="Cancel" style={{ color: "#111827", fontWeight: "600" }} />
            </Pressable>
          </View>
        </SectionCard>
      )}
    </>
  )
}
