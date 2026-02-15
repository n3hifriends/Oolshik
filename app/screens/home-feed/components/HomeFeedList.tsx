import type { ReactElement } from "react"
import { FlatList } from "react-native"

import { Text } from "@/components/Text"
import type { HomeFeedTask, HomeFeedViewMode } from "@/screens/home-feed/types"

type HomeFeedListProps = {
  data: HomeFeedTask[]
  loading: boolean
  renderItem: ({ item }: { item: HomeFeedTask }) => ReactElement | null
  onRefresh: () => void
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
      refreshing={props.loading}
      onRefresh={props.onRefresh}
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
