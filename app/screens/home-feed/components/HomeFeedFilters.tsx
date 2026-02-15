import React from "react"
import { View } from "react-native"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@/components/SectionCard"
import { Text } from "@/components/Text"
import { Pill } from "@/components/Pill"
import { StatusChip } from "@/components/StatusChip"
import { STATUS_ORDER } from "@/screens/home-feed/helpers/homeFeedFormatters"
import type { HomeFeedStatus, Radius } from "@/screens/home-feed/types"

type HomeFeedFiltersProps = {
  radiusMeters: Radius
  onSetRadius: (radius: Radius) => void
  selectedStatuses: Set<HomeFeedStatus>
  onToggleStatus: (status: HomeFeedStatus) => void
}

export function HomeFeedFilters(props: HomeFeedFiltersProps) {
  const { t } = useTranslation()

  return (
    <View style={{ paddingHorizontal: 16, marginBottom: 6 }}>
      <SectionCard>
        <Text tx="oolshik:distanceFilter" style={{ marginBottom: 8, color: "#6B7280" }} />
        <View style={{ flexDirection: "row", gap: 10 }}>
          {[1, 2, 5].map((km) => (
            <Pill
              key={km}
              label={t("oolshik:homeScreen.radiusOption", { km })}
              active={props.radiusMeters === km}
              onPress={() => props.onSetRadius(km as Radius)}
            />
          ))}
        </View>

        <View style={{ height: 12 }} />

        <Text tx="oolshik:statusFilter" style={{ marginBottom: 8, color: "#6B7280" }} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {STATUS_ORDER.map((status) => {
            const active = props.selectedStatuses.has(status)
            return (
              <StatusChip
                key={status}
                s={status}
                active={active}
                onPress={() => props.onToggleStatus(status)}
              />
            )
          })}
        </View>
      </SectionCard>
    </View>
  )
}
