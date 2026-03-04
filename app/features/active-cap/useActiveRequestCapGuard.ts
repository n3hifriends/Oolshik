import { useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  ActiveRequestCapReachedPayload,
  ActiveRequestSummary,
  OolshikApi,
  toActiveRequestCapPayload,
} from "@/api/client"

type NavigationLike = {
  navigate: (screen: string, params?: Record<string, unknown>) => void
}

type ActiveCapContext = {
  payload: ActiveRequestCapReachedPayload
  suggestedStatus: string | null
}

const HANDLED_ERROR_MESSAGE = "ACTIVE_REQUEST_CAP_HANDLED"

export function createActiveCapHandledError() {
  return new Error(HANDLED_ERROR_MESSAGE)
}

export function isActiveCapHandledError(error: unknown) {
  return error instanceof Error && error.message === HANDLED_ERROR_MESSAGE
}

export function useActiveRequestCapGuard(navigation: NavigationLike) {
  const { t } = useTranslation()
  const [context, setContext] = useState<ActiveCapContext | null>(null)

  const dismiss = useCallback(() => {
    setContext(null)
  }, [])

  const showFromPayload = useCallback(
    (payload: ActiveRequestCapReachedPayload, suggestedStatus: string | null = null) => {
      setContext({ payload, suggestedStatus })
    },
    [],
  )

  const showFromSummary = useCallback(
    (summary: ActiveRequestSummary) => {
      const activeRequestIds = summary.activeRequests.map((request) => request.id).slice(0, 10)
      const suggestedRequestId =
        summary.suggestedRequestId ??
        (activeRequestIds.length > 0 ? activeRequestIds[activeRequestIds.length - 1] : null)
      if (!suggestedRequestId || activeRequestIds.length === 0) {
        return false
      }

      const suggestedStatus =
        summary.activeRequests.find((request) => request.id === suggestedRequestId)?.status ?? null

      showFromPayload(
        {
          code: "ACTIVE_REQUEST_CAP_REACHED",
          message: "Active request limit reached.",
          cap: summary.cap,
          activeCount: summary.activeCount,
          activeRequestIds,
          suggestedRequestId,
        },
        suggestedStatus,
      )
      return true
    },
    [showFromPayload],
  )

  const ensureCanCreateRequestOrRedirect = useCallback(async () => {
    const response = await OolshikApi.getActiveSummary()
    if (!response.ok || !response.data) {
      return true
    }
    if (!response.data.blocked) {
      return true
    }
    return !showFromSummary(response.data)
  }, [showFromSummary])

  const handleCreateCapResponse = useCallback(
    (responseLike: unknown) => {
      const payload =
        toActiveRequestCapPayload((responseLike as any)?.activeCap) ||
        toActiveRequestCapPayload((responseLike as any)?.data) ||
        toActiveRequestCapPayload(responseLike)
      if (!payload) return false
      showFromPayload(payload)
      return true
    },
    [showFromPayload],
  )

  const openActiveRequest = useCallback(() => {
    const suggestedRequestId = context?.payload.suggestedRequestId
    dismiss()
    if (suggestedRequestId) {
      navigation.navigate("OolshikDetail", { id: suggestedRequestId })
      return
    }
    navigation.navigate("OolshikMy")
  }, [context?.payload.suggestedRequestId, dismiss, navigation])

  const viewActiveRequests = useCallback(() => {
    dismiss()
    navigation.navigate("OolshikMy")
  }, [dismiss, navigation])

  const bodyText = useMemo(() => {
    if (!context) return ""
    const capLine = t("oolshik:activeCap.capReachedFmt", {
      cap: context.payload.cap,
    })
    const statusLine =
      context.suggestedStatus === "ASSIGNED" || context.suggestedStatus === "PENDING_AUTH"
        ? t("oolshik:activeCap.body_assigned", { cap: context.payload.cap })
        : t("oolshik:activeCap.body_open", { cap: context.payload.cap })
    return `${capLine}\n\n${statusLine}`
  }, [context, t])

  return {
    ensureCanCreateRequestOrRedirect,
    handleCreateCapResponse,
    createHandledError: createActiveCapHandledError,
    dialogProps: {
      visible: !!context,
      title: t("oolshik:activeCap.title"),
      message: bodyText,
      showPrimaryOpen: !!context?.payload.suggestedRequestId,
      primaryOpenLabel: t("oolshik:activeCap.primaryOpen"),
      secondaryViewLabel: t("oolshik:activeCap.secondaryView"),
      closeLabel: t("oolshik:activeCap.close"),
      onOpenActiveRequest: openActiveRequest,
      onViewActiveRequests: viewActiveRequests,
      onDismiss: dismiss,
    },
  }
}
