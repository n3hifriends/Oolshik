import type { ReactElement } from "react"
import { FlatList } from "react-native"

import { Text } from "@/components/Text"
import type { HomeFeedTask, HomeFeedViewMode } from "@/screens/home-feed/types"

type HomeFeedListProps = {
  data: HomeFeedTask[]
  loading: boolean
  renderItem: ({ item }: { item: HomeFeedTask }) => ReactElement | null
  onRefresh: () => void
  onScrollOffsetChange?: (offsetY: number) => void
  emptyMineText: string
  emptyForYouText: string
  viewMode: HomeFeedViewMode
  extraData: {
    viewMode: HomeFeedViewMode
    loading: boolean
    titleRefreshCooldowns: Record<string, number>
  }
}

export function HomeFeedList(props: HomeFeedListProps) {
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
      contentContainerStyle={{ paddingBottom: 140 }}
      ListEmptyComponent={
        <Text
          text={props.viewMode === "mine" ? props.emptyMineText : props.emptyForYouText}
          style={{ paddingVertical: 12 }}
        />
      }
      extraData={props.extraData}
    />
  )
}
