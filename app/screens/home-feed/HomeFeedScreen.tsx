import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from "react-native"
import { useTranslation } from "react-i18next"
import { useRemoteConfig } from "@/services/remoteConfig"
import { loadString, saveString } from "@/utils/storage"
import { HomeBanner } from "@/screens/home-feed/components/HomeBanner"
import { useFocusEffect } from "@react-navigation/native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Screen } from "@/components/Screen"
import { SpotlightComposer, type SpotlightComposerHandle } from "@/components/SpotlightComposer"
import type { OolshikStackScreenProps } from "@/navigators/OolshikNavigator"
import { useHomeFeedController } from "@/screens/home-feed/hooks/useHomeFeedController"
import { HomeFeedHeader } from "@/screens/home-feed/components/HomeFeedHeader"
import { HomeFeedFilters } from "@/screens/home-feed/components/HomeFeedFilters"
import { HomeFeedLocationState } from "@/screens/home-feed/components/HomeFeedLocationState"
import { HomeFeedList } from "@/screens/home-feed/components/HomeFeedList"
import {
  HomeFeedBottomBar,
  BAR_HEIGHT,
  BAR_BOTTOM_OFFSET,
  BAR_LIST_BOTTOM_EXTRA,
  BAR_MIC_CENTER_X,
  BAR_PEN_CENTER_X,
} from "@/screens/home-feed/components/HomeFeedBottomBar"
import { HomeFeedServiceState } from "@/screens/home-feed/components/HomeFeedServiceState"
import { HomeFeedWelcomeCard } from "@/screens/home-feed/components/HomeFeedWelcomeCard"
import { ActiveRequestCapDialog } from "@/components/ActiveRequestCapDialog"
import { OolshikApi } from "@/api/client"

type Props = OolshikStackScreenProps<"OolshikHome">

export default function HomeFeedScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const [unreadCount, setUnreadCount] = useState(0)
  const composerRef = useRef<SpotlightComposerHandle>(null)
  const { height: screenHeight } = useWindowDimensions()
  const insets = useSafeAreaInsets()

  const barCenterY = screenHeight - insets.bottom - BAR_BOTTOM_OFFSET - BAR_HEIGHT / 2
  const micOrigin = useMemo(() => ({ x: BAR_MIC_CENTER_X, y: barCenterY }), [barCenterY])
  const penOrigin = useMemo(() => ({ x: BAR_PEN_CENTER_X, y: barCenterY }), [barCenterY])
  const listPaddingBottom = BAR_HEIGHT + insets.bottom + BAR_LIST_BOTTOM_EXTRA

  const controller = useHomeFeedController({
    navigation,
    t: t as (key: string, options?: Record<string, unknown>) => string,
  })

  const { theme, location, feed, user, refs, state, handlers } = controller

  const {
    home_banner_enabled,
    home_banner_type,
    home_banner_id,
    home_banner_title,
    home_banner_message,
    home_banner_auto_dismiss_seconds,
  } = useRemoteConfig()

  const [bannerDismissed, setBannerDismissed] = useState(false)

  useEffect(() => {
    if (!home_banner_id) {
      setBannerDismissed(false)
      return
    }
    setBannerDismissed(loadString("home.banner.dismissed.id") === home_banner_id)
  }, [home_banner_id])

  const handleBannerDismiss = useCallback(() => {
    if (home_banner_id) saveString("home.banner.dismissed.id", home_banner_id)
    setBannerDismissed(true)
  }, [home_banner_id])

  const showBanner =
    home_banner_enabled && !bannerDismissed && (!!home_banner_title || !!home_banner_message)

  useFocusEffect(
    useCallback(() => {
      OolshikApi.getUnreadCount()
        .then((res) => {
          if (res.ok && res.data) setUnreadCount(res.data.count)
        })
        .catch(() => {})
    }, []),
  )

  const openInbox = useCallback(() => {
    navigation.navigate("NotificationInbox")
    setUnreadCount(0)
  }, [navigation])

  return (
    <Screen preset="fixed" safeAreaEdges={["top", "bottom"]} contentContainerStyle={{ flex: 1 }}>
      <SpotlightComposer
        ref={composerRef}
        onSubmitTask={handlers.onSubmitTask}
        onBeforeOpen={handlers.onBeforeComposerOpen}
        showIdleFabs={false}
        micOrigin={micOrigin}
        penOrigin={penOrigin}
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
        condensed={feed.controlsCondensed}
        onOpenInbox={openInbox}
        unreadCount={unreadCount}
      />

      {showBanner ? (
        <HomeBanner
          title={home_banner_title}
          message={home_banner_message}
          type={home_banner_type}
          autoDismissSeconds={home_banner_auto_dismiss_seconds}
          onDismiss={handleBannerDismiss}
        />
      ) : null}

      {user.isFirstRun && !state.searchOpen ? (
        <View style={{ paddingHorizontal: 16 }}>
          <HomeFeedWelcomeCard
            userName={user.userName}
            onIntentSelected={handlers.onIntentSelected}
            onOpenComposer={() => composerRef.current?.open("type")}
          />
        </View>
      ) : (
        <HomeFeedFilters
          viewMode={feed.viewMode}
          radiusMeters={feed.radiusMeters}
          onSetRadius={handlers.setRadius}
          selectedStatuses={feed.selectedStatuses}
          availableStatuses={feed.availableStatuses}
          onToggleStatus={handlers.toggleStatus}
          onSelectAllStatuses={handlers.selectAllStatuses}
          sort={feed.sort}
          onToggleSort={handlers.toggleSort}
          expanded={feed.filtersExpanded}
          onToggleExpanded={handlers.toggleFiltersExpanded}
          condensed={feed.controlsCondensed}
          resultCount={feed.filtered.length}
          isSearchActive={state.searchOpen}
        />
      )}

      {state.searchOpen && state.rawSearch.length === 0 && (
        <Pressable
          onPress={() => {
            handlers.onSearchClear()
            handlers.setSearchOpen(false)
          }}
          style={StyleSheet.flatten([
            StyleSheet.absoluteFillObject,
            { backgroundColor: "rgba(0,0,0,0.22)", zIndex: 50 },
          ])}
          accessibilityRole="button"
          accessibilityLabel={t("oolshik:search.close")}
        />
      )}

      <View
        style={{
          flex: 1,
          paddingHorizontal: 16,
          paddingTop: state.searchOpen ? 8 : 0,
          backgroundColor: theme.themeColors.background,
        }}
      >
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
        ) : feed.showInitialLoader ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator />
          </View>
        ) : (
          <>
            {feed.serviceState?.variant === "full" ? (
              <HomeFeedServiceState
                title={feed.serviceState.title}
                body={feed.serviceState.body}
                retryLabel={t("common:retry")}
                onRetry={handlers.onRefresh}
                supportText={feed.serviceState.supportText}
                staleLabel={feed.serviceState.staleLabel}
                variant="full"
              />
            ) : null}

            {feed.serviceState?.variant === "inline" ? (
              <HomeFeedServiceState
                title={feed.serviceState.title}
                body={feed.serviceState.body}
                retryLabel={t("common:retry")}
                onRetry={handlers.onRefresh}
                supportText={feed.serviceState.supportText}
                staleLabel={feed.serviceState.staleLabel}
                variant="inline"
              />
            ) : null}

            {feed.serviceState?.variant !== "full" ? (
              <HomeFeedList
                data={feed.filtered}
                loading={feed.loading}
                renderItem={handlers.renderItem}
                onRefresh={handlers.onRefresh}
                onScrollOffsetChange={handlers.onListScrollOffsetChange}
                emptyMineText={t("oolshik:emptyMine")}
                emptyForYouText={
                  feed.helperAvailable
                    ? t("oolshik:emptyForYou")
                    : t("oolshik:helperUnavailableEmpty")
                }
                emptySearchText={t("oolshik:emptySearch")}
                viewMode={feed.viewMode}
                helperUnavailable={!feed.helperAvailable}
                rawSearch={state.rawSearch}
                onGetHelp={() => composerRef.current?.open(feed.viewMode === "mine" ? "voice" : "type")}
                extraData={feed.extraData}
                listPaddingBottom={listPaddingBottom}
              />
            ) : null}
          </>
        )}
      </View>

      <HomeFeedBottomBar
        onVoiceCapture={() => composerRef.current?.open("voice")}
        onTypeCapture={() => composerRef.current?.open("type")}
        onCreate={handlers.openCreate}
        visible={!state.searchOpen}
        condensed={feed.controlsCondensed}
      />

      <ActiveRequestCapDialog {...state.activeCapDialog} />
    </Screen>
  )
}
