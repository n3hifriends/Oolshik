import type { ReactElement } from "react"
import { FlatList, View } from "react-native"

import { Text } from "@/components/Text"
import { EmptyFeedCard } from "@/screens/home-feed/components/EmptyFeedCard"
import type { HomeFeedTask, HomeFeedViewMode } from "@/screens/home-feed/types"

type HomeFeedListProps = {
  data: HomeFeedTask[]
  loading: boolean
  renderItem: ({ item }: { item: HomeFeedTask }) => ReactElement | null
  onRefresh: () => void
  onScrollOffsetChange?: (offsetY: number) => void
  emptyMineText: string
  emptyForYouText: string
  emptySearchText: string
  viewMode: HomeFeedViewMode
  helperUnavailable?: boolean
  rawSearch?: string
  onGetHelp: () => void
  extraData: {
    viewMode: HomeFeedViewMode
    loading: boolean
    titleRefreshCooldowns: Record<string, number>
  }
  listPaddingBottom?: number
}

export function HomeFeedList(props: HomeFeedListProps) {
  const isSearching = props.rawSearch && props.rawSearch.length > 0

  return (
    <FlatList
      style={{ marginBottom: 16 }}
      data={props.data}
      keyExtractor={(item) => String(item.id)}
      renderItem={props.renderItem}
      initialNumToRender={10}
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      refreshing={props.loading}
      onRefresh={props.onRefresh}
      onScroll={
        props.onScrollOffsetChange
          ? (event) => props.onScrollOffsetChange?.(event.nativeEvent.contentOffset.y)
          : undefined
      }
      contentContainerStyle={{ paddingBottom: props.listPaddingBottom ?? 140 }}
      ListEmptyComponent={
        isSearching ? (
          <View style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
            <Text text={props.emptySearchText} />
          </View>
        ) : props.viewMode === "forYou" && props.helperUnavailable ? (
          <View style={{ paddingVertical: 16, paddingHorizontal: 16 }}>
            <Text text={props.emptyForYouText} />
          </View>
        ) : (
          <EmptyFeedCard viewMode={props.viewMode} onGetHelp={props.onGetHelp} />
        )
      }
      extraData={props.extraData}
    />
  )
}
