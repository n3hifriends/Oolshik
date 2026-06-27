import { TextStyle, ViewStyle } from "react-native"

import type { ThemedStyle } from "@/theme/types"

export const $container: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  padding: spacing.md,
  paddingBottom: spacing.xl,
})

export const $heroCard: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  backgroundColor: isDark ? colors.palette.primary100 : colors.palette.primary100,
  borderColor: isDark ? colors.palette.primary200 : colors.palette.primary200,
  borderWidth: 1,
  borderRadius: 28,
  padding: spacing.lg,
  marginBottom: spacing.md,
})

export const $heroRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: spacing.sm,
})

export const $title: ThemedStyle<TextStyle> = ({ spacing }) => ({
  marginBottom: spacing.md,
})

export const $heroCopy: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

export const $heroHighlights: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  flexWrap: "wrap",
  gap: spacing.xs,
  marginTop: spacing.md,
})

export const $heroPill: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  borderRadius: 999,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xs,
  backgroundColor: isDark ? colors.palette.neutral300 : colors.palette.neutral100,
})

export const $surfaceCard: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  backgroundColor: isDark ? colors.palette.neutral200 : colors.palette.neutral100,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
  borderRadius: 24,
  padding: spacing.lg,
  marginBottom: spacing.md,
})

export const $surfaceHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: spacing.sm,
})

export const $stepCard: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  backgroundColor: isDark ? colors.palette.neutral200 : colors.palette.neutral100,
  borderColor: colors.palette.neutral300,
  borderWidth: 1,
  borderRadius: 24,
  padding: spacing.md,
  marginBottom: spacing.md,
})

export const $stepCardActive: ThemedStyle<ViewStyle> = ({ colors, isDark }) => ({
  borderColor: colors.palette.primary500,
  shadowColor: isDark ? colors.palette.neutral900 : colors.palette.overlay50,
  shadowOpacity: isDark ? 0.16 : 0.08,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: 8 },
  elevation: 2,
})

export const $cardHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "flex-start",
  gap: spacing.sm,
  marginBottom: spacing.md,
})

export const $stepBadge: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: colors.palette.primary500,
  alignItems: "center",
  justifyContent: "center",
})

export const $supportingText: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
})

export const $ccBadge: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  paddingHorizontal: spacing.sm,
  height: 50,
  borderRadius: spacing.sm,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.palette.neutral100,
})

export const $inputWrapperDense: ThemedStyle<ViewStyle> = () => ({
  height: 50,
  minHeight: 50,
  alignItems: "center",
  paddingVertical: 0,
})

export const $phoneHintBlock: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.xs,
  marginTop: spacing.md,
  marginBottom: spacing.sm,
  alignItems: "flex-start",
})

export const $phoneHintChip: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  alignSelf: "flex-start",
  minHeight: 44,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: isDark ? colors.palette.primary300 : colors.palette.primary200,
  backgroundColor: isDark ? colors.palette.neutral200 : colors.palette.primary100,
  paddingHorizontal: spacing.md,
  paddingVertical: spacing.sm,
  width: "100%",
})

export const $phoneHintChipPressed: ThemedStyle<ViewStyle> = ({ colors, isDark }) => ({
  opacity: 0.92,
  backgroundColor: isDark ? colors.palette.neutral300 : colors.palette.primary200,
})

export const $phoneHintChipDisabled: ThemedStyle<ViewStyle> = ({ colors }) => ({
  opacity: 0.62,
  borderColor: colors.palette.neutral300,
})

export const $phoneHintChipRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
})

export const $phoneHintIconBadge: ThemedStyle<ViewStyle> = ({ colors, isDark }) => ({
  width: 28,
  height: 28,
  borderRadius: 14,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: isDark ? colors.palette.primary100 : colors.palette.neutral100,
})

export const $phoneHintChipLabel: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.text,
})

export const $phoneHintSubcopy: ThemedStyle<TextStyle> = ({ colors, spacing }) => ({
  color: colors.textDim,
  marginLeft: spacing.xs,
  maxWidth: 280,
})

export const $validationMessageSlot: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  minHeight: spacing.lg,
  justifyContent: "center",
  marginTop: spacing.xs,
})

export const $progressHeader: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
})

export const $progressEyebrow: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.palette.primary500,
  marginBottom: 4,
})

export const $progressPill: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  minWidth: 46,
  borderRadius: 999,
  paddingHorizontal: spacing.sm,
  paddingVertical: spacing.xxs,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: colors.palette.primary500,
})

export const $progressTrack: ThemedStyle<ViewStyle> = ({ colors, spacing }) => ({
  height: 8,
  borderRadius: 999,
  overflow: "hidden",
  backgroundColor: colors.palette.neutral300,
  marginTop: spacing.md,
  marginBottom: spacing.sm,
})

export const $progressFill: ThemedStyle<ViewStyle> = ({ colors }) => ({
  height: "100%",
  borderRadius: 999,
  backgroundColor: colors.palette.primary500,
})

export const $authModeRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  gap: spacing.sm,
  marginBottom: spacing.md,
})

export const $authModeButton: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  flex: 1,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
  borderRadius: 18,
  backgroundColor: isDark ? colors.palette.neutral200 : colors.palette.neutral100,
  paddingVertical: spacing.sm,
  paddingHorizontal: spacing.md,
  alignItems: "center",
  justifyContent: "center",
})

export const $authModeButtonActive: ThemedStyle<ViewStyle> = ({ colors }) => ({
  backgroundColor: colors.palette.primary500,
  borderColor: colors.palette.primary500,
})

export const $benefitsList: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  gap: spacing.sm,
  marginTop: spacing.md,
})

export const $benefitRow: ThemedStyle<ViewStyle> = ({ spacing }) => ({
  flexDirection: "row",
  alignItems: "center",
  gap: spacing.sm,
})

export const $benefitDot: ThemedStyle<ViewStyle> = ({ colors }) => ({
  width: 8,
  height: 8,
  borderRadius: 4,
  backgroundColor: colors.palette.primary500,
})

export const $disclosure: ThemedStyle<TextStyle> = ({ colors }) => ({
  color: colors.textDim,
  fontSize: 20,
  lineHeight: 24,
  fontWeight: "700",
})

export const $footerCard: ThemedStyle<ViewStyle> = ({ colors, spacing, isDark }) => ({
  backgroundColor: isDark ? colors.palette.neutral200 : colors.palette.neutral100,
  borderWidth: 1,
  borderColor: colors.palette.neutral300,
  borderRadius: 24,
  padding: spacing.md,
  marginBottom: spacing.md,
})
