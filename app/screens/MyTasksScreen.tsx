import React, { useCallback, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import { useOnForeground } from "@/hooks/useOnForeground"
import type { OolshikStackScreenProps } from "@/navigators/OolshikNavigator"
import { useTranslation } from "react-i18next"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import { Button } from "@/components/Button"
import { SectionCard } from "@/components/SectionCard"
import type { ActiveRequestSummaryItem } from "@/api/client"
import { useTaskStore } from "@/store/taskStore"
import { useAppTheme } from "@/theme/context"
import type { Theme } from "@/theme/types"
import { minsAgo } from "@/screens/task-detail/helpers/taskDetailFormatters"
import { getStatusColors } from "@/theme/statusColors"
import { useResponsiveLayout } from "@/utils/useResponsiveLayout"

type Props = OolshikStackScreenProps<"OolshikMy">
type LoadOptions = { refreshing?: boolean; liveRef?: { current: boolean } }

function normalizeStatus(status: string | null | undefined) {
  const value = (status || "PENDING").toUpperCase()
  if (value === "OPEN") return "PENDING"
  if (value === "CANCELED") return "CANCELLED"
  return value
}

function getReference(id: string) {
  const compact = id.replace(/-/g, "").slice(-6).toUpperCase()
  return compact ? `#${compact}` : id
}

function getStatusMeta(theme: Theme, t: (key: string) => string, rawStatus: string) {
  const status = normalizeStatus(rawStatus)
  const neutral700 = theme.colors.palette.neutral700

  switch (status) {
    case "PENDING_AUTH":
      return {
        label: t("oolshik:status.pendingAuth"),
        backgroundColor: theme.colors.palette.primary100,
        textColor: neutral700,
      }
    case "ASSIGNED":
      return {
        label: t("oolshik:status.assigned"),
        backgroundColor: theme.colors.palette.warningSoft400,
        textColor: neutral700,
      }
    case "WORK_DONE_PENDING_CONFIRMATION": {
      const sc = getStatusColors("WORK_DONE_PENDING_CONFIRMATION", theme.isDark)
      return { label: t("oolshik:status.waitingConfirmation"), backgroundColor: sc.bg, textColor: sc.fg }
    }
    case "REVIEW_REQUIRED": {
      const sc = getStatusColors("REVIEW_REQUIRED", theme.isDark)
      return { label: t("oolshik:status.reviewRequired"), backgroundColor: sc.bg, textColor: sc.fg }
    }
    case "COMPLETED":
      return {
        label: t("oolshik:status.completed"),
        backgroundColor: theme.colors.palette.successSoft400,
        textColor: neutral700,
      }
    case "CANCELLED":
      return {
        label: t("oolshik:status.cancelled"),
        backgroundColor: theme.colors.palette.neutral200,
        textColor: neutral700,
      }
    default:
      return {
        label: t("oolshik:status.pending"),
        backgroundColor: theme.colors.palette.primary200,
        textColor: neutral700,
      }
  }
}

export default function MyTasksScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const { theme } = useAppTheme()
  const { scaleDisplayText } = useResponsiveLayout()
  const styles = useMemo(() => createStyles(theme, scaleDisplayText), [theme, scaleDisplayText])

  const activeSummary = useTaskStore((s) => s.activeSummary)
  const fetchActiveSummary = useTaskStore((s) => s.fetchActiveSummary)
  // Read at effect time without re-triggering the focus effect when data arrives
  const activeSummaryRef = useRef(activeSummary)
  activeSummaryRef.current = activeSummary

  const [loading, setLoading] = useState(activeSummary === null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requests: ActiveRequestSummaryItem[] = activeSummary?.activeRequests ?? []
  const activeCount = activeSummary?.activeCount ?? 0
  const cap = activeSummary?.cap ?? null
  const blocked = activeSummary?.blocked ?? false

  const loadRequests = useCallback(
    async ({ refreshing = false, liveRef }: LoadOptions = {}) => {
      const isLive = () => liveRef?.current ?? true

      if (refreshing) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(null)

      try {
        await fetchActiveSummary()
        if (!isLive()) return
      } catch (err) {
        if (!isLive()) return
        setError(err instanceof Error ? err.message : t("errors:fallback"))
      } finally {
        if (!isLive()) return
        if (refreshing) {
          setRefreshing(false)
        } else {
          setLoading(false)
        }
      }
    },
    [t, fetchActiveSummary],
  )

  useFocusEffect(
    useCallback(() => {
      const liveRef = { current: true }
      // Keep the existing list visible while refreshing if we already have data
      const hasData = activeSummaryRef.current !== null
      void loadRequests({ liveRef, refreshing: hasData })
      return () => {
        liveRef.current = false
      }
    }, [loadRequests]),
  )

  useOnForeground(() => {
    void loadRequests({ refreshing: activeSummaryRef.current !== null })
  })

  const handleRefresh = useCallback(() => {
    void loadRequests({ refreshing: true })
  }, [loadRequests])

  const summaryText = useMemo(() => {
    if (cap && cap > 0) {
      return t("oolshik:myTasksScreen.capSummary", { count: activeCount, cap })
    }
    return t("oolshik:myTasksScreen.subtitle")
  }, [activeCount, cap, t])

  return (
    <Screen
      preset="scroll"
      safeAreaEdges={["top", "bottom"]}
      contentContainerStyle={styles.content}
      ScrollViewProps={{
        refreshControl: (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.palette.primary500}
          />
        ),
      }}
    >
      <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={styles.backLink}>
        <Text text={`← ${t("common:back")}`} />
      </Pressable>

      <View style={styles.header}>
        <Text preset="heading" text={t("oolshik:myTasksScreen.heading")} />
        <Text style={styles.headerBody} text={summaryText} />
        {blocked ? <Text style={styles.blockedNote} text={t("oolshik:myTasksScreen.blockedSummary")} /> : null}
      </View>

      {loading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={theme.colors.palette.primary500} />
          <Text text={t("oolshik:myTasksScreen.loading")} />
        </View>
      ) : null}

      {!loading && error ? (
        <SectionCard style={styles.stateCard}>
          <Text preset="subheading" text={t("oolshik:myTasksScreen.errorTitle")} />
          <View style={styles.stateGap} />
          <Text style={styles.stateBody} text={t("oolshik:myTasksScreen.errorBody")} />
          <View style={styles.stateButtonGap} />
          <Button text={t("common:retry")} onPress={() => void loadRequests()} />
        </SectionCard>
      ) : null}

      {!loading && !error && requests.length === 0 ? (
        <SectionCard style={styles.stateCard}>
          <Text preset="subheading" text={t("oolshik:myTasksScreen.emptyTitle")} />
          <View style={styles.stateGap} />
          <Text style={styles.stateBody} text={t("oolshik:myTasksScreen.emptyBody")} />
        </SectionCard>
      ) : null}

      {!loading && !error
        ? requests.map((request) => {
            const status = getStatusMeta(theme, t, request.status)
            return (
              <Pressable
                key={request.id}
                accessibilityRole="button"
                onPress={() => navigation.navigate("OolshikDetail", { id: request.id })}
                style={({ pressed }) => [
                  styles.cardPressable,
                  pressed ? styles.cardPressablePressed : null,
                ]}
              >
                <SectionCard style={styles.requestCard}>
                  <View style={styles.cardTopRow}>
                    <View style={[styles.statusChip, { backgroundColor: status.backgroundColor }]}>
                      <Text style={[styles.statusChipText, { color: status.textColor }]} text={status.label} />
                    </View>
                    <Text
                      size="xs"
                      style={styles.createdAt}
                      text={t("oolshik:myTasksScreen.createdLabel", {
                        time: minsAgo(request.createdAt, t),
                      })}
                    />
                  </View>

                  <View style={styles.cardBody}>
                    <Text
                      preset="subheading"
                      style={styles.requestTitle}
                      text={t("oolshik:myTasksScreen.requestLabel", {
                        reference: getReference(request.id),
                      })}
                    />
                    <Text style={styles.requestHint} text={t("oolshik:myTasksScreen.requestHint")} />
                  </View>

                  <View style={styles.cardFooter}>
                    <View>
                      <Text size="xxs" style={styles.metaLabel} text={t("oolshik:myTasksScreen.statusLabel")} />
                      <Text weight="medium" text={status.label} />
                    </View>
                    <Button
                      tx="oolshik:myTasksScreen.openRequest"
                      onPress={() => navigation.navigate("OolshikDetail", { id: request.id })}
                      style={styles.openButton}
                    />
                  </View>
                </SectionCard>
              </Pressable>
            )
          })
        : null}
    </Screen>
  )
}

const createStyles = (theme: Theme, scaleDisplayText: (size: number) => number) =>
  StyleSheet.create({
    backLink: {
      alignSelf: "flex-start",
      marginBottom: theme.spacing.md,
    },
    blockedNote: {
      color: theme.colors.palette.warning500,
      marginTop: theme.spacing.xs,
    },
    cardBody: {
      gap: theme.spacing.xs,
    },
    cardFooter: {
      alignItems: "center",
      flexDirection: "row",
      gap: theme.spacing.md,
      justifyContent: "space-between",
      marginTop: theme.spacing.md,
    },
    cardPressable: {
      borderRadius: 16,
    },
    cardPressablePressed: {
      opacity: 0.92,
    },
    cardTopRow: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: theme.spacing.md,
    },
    content: {
      flexGrow: 1,
      padding: theme.spacing.lg,
    },
    createdAt: {
      color: theme.colors.textDim,
      flexShrink: 1,
      marginLeft: theme.spacing.sm,
      textAlign: "right",
    },
    header: {
      marginBottom: theme.spacing.lg,
    },
    headerBody: {
      color: theme.colors.textDim,
      marginTop: theme.spacing.xs,
    },
    loadingState: {
      alignItems: "center",
      justifyContent: "center",
      minHeight: 280,
      paddingVertical: theme.spacing.xl,
      rowGap: theme.spacing.md,
    },
    metaLabel: {
      color: theme.colors.textDim,
      letterSpacing: 0.4,
      marginBottom: 2,
      textTransform: "uppercase",
    },
    openButton: {
      minWidth: 132,
    },
    requestCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.separator,
      marginBottom: theme.spacing.md,
      padding: theme.spacing.md,
    } as ViewStyle,
    requestHint: {
      color: theme.colors.textDim,
    },
    requestTitle: {
      fontSize: scaleDisplayText(22),
      lineHeight: scaleDisplayText(30),
    },
    stateBody: {
      color: theme.colors.textDim,
    },
    stateButtonGap: {
      height: theme.spacing.md,
    },
    stateCard: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.separator,
      marginTop: theme.spacing.xs,
      padding: theme.spacing.lg,
    } as ViewStyle,
    stateGap: {
      height: theme.spacing.xs,
    },
    statusChip: {
      alignSelf: "flex-start",
      borderRadius: 999,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 6,
    },
    statusChipText: {
      fontSize: 12,
      fontWeight: "700",
      letterSpacing: 0.2,
      textTransform: "uppercase",
    },
  })
