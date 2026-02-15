import React from "react"
import { ActivityIndicator, View } from "react-native"
import { useTranslation } from "react-i18next"
import { Screen } from "@/components/Screen"
import { SpotlightComposer } from "@/components/SpotlightComposer"
import { colors } from "@/theme/colors"
import type { OolshikStackScreenProps } from "@/navigators/OolshikNavigator"
import { useHomeFeedController } from "@/screens/home-feed/hooks/useHomeFeedController"
import { LogoutButton } from "@/screens/home-feed/components/LogoutButton"
import { HomeFeedHeader } from "@/screens/home-feed/components/HomeFeedHeader"
import { HomeFeedFilters } from "@/screens/home-feed/components/HomeFeedFilters"
import { HomeFeedLocationState } from "@/screens/home-feed/components/HomeFeedLocationState"
import { HomeFeedList } from "@/screens/home-feed/components/HomeFeedList"
import { HomeFeedCreateBar } from "@/screens/home-feed/components/HomeFeedCreateBar"

type Props = OolshikStackScreenProps<"OolshikHome">

export default function HomeFeedScreen({ navigation }: Props) {
  const { t } = useTranslation()

  const controller = useHomeFeedController({
    navigation,
    t: t as (key: string, options?: Record<string, unknown>) => string,
  })

  const { theme, location, feed, user, refs, state, handlers } = controller

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]} contentContainerStyle={{ flex: 1 }}>
      <SpotlightComposer onSubmitTask={handlers.onSubmitTask} />

      <LogoutButton
        onPress={handlers.onLogoutPress}
        accessibilityLabel={t("oolshik:homeScreen.logoutA11y")}
        backgroundColor={colors.palette.primary500}
      />

      <HomeFeedHeader
        searchOpen={state.searchOpen}
        setSearchOpen={handlers.setSearchOpen}
        rawSearch={state.rawSearch}
        onSearchChange={handlers.onSearchChange}
        onClearSearch={handlers.onSearchClear}
        inputRef={refs.searchInputRef}
        onOpenProfile={handlers.openProfile}
        profileInitials={user.profileInitials}
        profileTextColor={theme.profileTextColor}
        viewMode={feed.viewMode}
        onChangeViewMode={handlers.setViewMode}
        spacingXxxs={theme.spacing.xxxs}
        isDark={theme.isDark}
        neutral100={theme.themeColors.palette.neutral100}
        primary200={theme.themeColors.palette.primary200}
        primary500={theme.themeColors.palette.primary500}
      />

      <HomeFeedFilters
        radiusMeters={feed.radiusMeters}
        onSetRadius={handlers.setRadius}
        selectedStatuses={feed.selectedStatuses}
        onToggleStatus={handlers.toggleStatus}
      />

      <View style={{ flex: 1, paddingHorizontal: 16, backgroundColor: colors.background }}>
        {location.status !== "ready" ? (
          <HomeFeedLocationState
            status={location.status}
            errorText={location.locationError}
            gettingLocationText={t("oolshik:homeScreen.gettingLocation")}
            locationDeniedTitle={t("oolshik:homeScreen.locationDeniedTitle")}
            locationDeniedBody={t("oolshik:homeScreen.locationDeniedBody")}
            openSettingsLabel={t("task:create.openSettings")}
            locationErrorTitle={t("oolshik:homeScreen.locationErrorTitle")}
            retryLabel={t("task:create.retry")}
            fallbackText={t("oolshik:homeScreen.tryAgain")}
            onOpenSettings={handlers.onOpenSettings}
            onRetry={handlers.onRefresh}
          />
        ) : feed.loading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator />
          </View>
        ) : (
          <HomeFeedList
            data={feed.filtered}
            loading={feed.loading}
            renderItem={handlers.renderItem}
            onRefresh={handlers.onRefresh}
            emptyMineText={t("oolshik:emptyMine")}
            emptyForYouText={t("oolshik:emptyForYou")}
            viewMode={feed.viewMode}
            extraData={feed.extraData}
          />
        )}
      </View>

      <HomeFeedCreateBar
        createLabel={t("oolshik:create")}
        onPressCreate={handlers.openCreate}
      />
    </Screen>
  )
}
