import React from "react"
import { View } from "react-native"
import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import type { RecoveryAction } from "@/screens/task-detail/types"

type ActionFooterProps = {
  visible: boolean
  recoveryNotice: string | null
  rawStatus?: string
  normalizedStatus: "PENDING" | "PENDING_AUTH" | "ASSIGNED" | "COMPLETED" | "CANCELLED"
  authDecision: "approved" | "rejected" | null
  isRequester: boolean
  isPendingHelper: boolean
  requesterName: string
  requesterFallback: string
  authCountdown: string | null
  authExpired: boolean
  actionLoading: boolean
  canCancel: boolean
  canRelease: boolean
  canReassign: boolean
  reassignCountdown: string | null
  reassignLimitReached: boolean
  onAuthorize: () => void
  onAccept: () => void
  onComplete: () => void
  onOpenReason: (action: RecoveryAction) => void
  onReassign: () => void
  onGoBack: () => void
  helperRequestedAuthorizationText: string
  requesterLabelText: string
  approveWithinText: string
  authorizationExpiredText: string
  waitingRequesterApprovalText: string
  timeLeftText: string
  awaitingRequesterApprovalText: string
  approveLabel: string
  rejectLabel: string
  createdThisRequestText: string
  waitingForHelperToAcceptText: string
  acceptTaskLabel: string
  canMarkCompletedText: string
  completeTaskLabel: string
  waitingRequesterToCompleteText: string
  cancelRequestLabel: string
  giveAwayLabel: string
  reassignAvailableInText: string
  reassignHelperLabel: string
  reassignLimitReachedText: string
  taskCompletedLabel: string
  thanksForHelpingLabel: string
  okLabel: string
  success: string
  successSoft: string
  neutral100: string
  neutral300: string
  spacingXs: number
  spacingSm: number
  spacingMd: number
}

export function ActionFooter(props: ActionFooterProps) {
  if (!props.visible) return null

  return (
    <>
      {props.recoveryNotice ? (
        <View
          style={{
            paddingVertical: props.spacingXs,
            paddingHorizontal: props.spacingSm,
            marginHorizontal: 16,
            marginBottom: props.spacingXs,
            borderRadius: 8,
            backgroundColor: props.successSoft,
            borderWidth: 1,
            borderColor: props.success,
          }}
        >
          <Text text={props.recoveryNotice} weight="medium" style={{ color: props.success }} />
        </View>
      ) : null}

      {props.rawStatus === "PENDING_AUTH" && !props.authDecision ? (
        <View style={{ marginHorizontal: 16, gap: props.spacingSm }}>
          {props.isRequester ? (
            <View
              style={{
                gap: props.spacingXs,
                paddingVertical: props.spacingXs,
                paddingHorizontal: props.spacingSm,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: props.neutral300,
                backgroundColor: props.neutral100,
              }}
            >
              <Text text={props.helperRequestedAuthorizationText} weight="medium" />
              <Text text={props.requesterLabelText} size="xs" />
              {props.authCountdown && !props.authExpired ? (
                <Text text={props.approveWithinText} size="xs" />
              ) : null}
              {props.authExpired ? <Text text={props.authorizationExpiredText} size="xs" /> : null}
              <View style={{ flexDirection: "row", gap: props.spacingSm }}>
                <Button
                  text={props.actionLoading ? "..." : props.approveLabel}
                  onPress={props.onAuthorize}
                  disabled={props.authExpired || props.actionLoading}
                  style={{ flex: 1, paddingVertical: props.spacingXs }}
                />
                <Button
                  text={props.rejectLabel}
                  onPress={() => props.onOpenReason("reject")}
                  disabled={props.authExpired || props.actionLoading}
                  style={{ flex: 1, paddingVertical: props.spacingXs }}
                />
              </View>
            </View>
          ) : props.isPendingHelper ? (
            <View
              style={{
                gap: props.spacingXs,
                paddingVertical: props.spacingXs,
                paddingHorizontal: props.spacingSm,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: props.neutral300,
                backgroundColor: props.neutral100,
              }}
            >
              <Text text={props.waitingRequesterApprovalText} weight="medium" />
              <Text text={props.requesterLabelText} size="xs" />
              {props.authCountdown && !props.authExpired ? <Text text={props.timeLeftText} size="xs" /> : null}
              {props.authExpired ? <Text text={props.authorizationExpiredText} size="xs" /> : null}
            </View>
          ) : (
            <View
              style={{
                gap: props.spacingXs,
                paddingVertical: props.spacingXs,
                paddingHorizontal: props.spacingSm,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: props.neutral300,
                backgroundColor: props.neutral100,
              }}
            >
              <Text text={props.awaitingRequesterApprovalText} weight="medium" />
            </View>
          )}
        </View>
      ) : props.normalizedStatus === "PENDING" || props.normalizedStatus === "ASSIGNED" ? (
        <View
          style={{
            flexDirection: "row",
            marginHorizontal: 16,
            gap: props.spacingSm,
          }}
        >
          {props.normalizedStatus === "PENDING" ? (
            props.isRequester ? (
              <View
                style={{
                  flex: 1,
                  paddingVertical: props.spacingXs,
                  paddingHorizontal: props.spacingSm,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: props.neutral300,
                  backgroundColor: props.neutral100,
                }}
              >
                <Text text={props.createdThisRequestText} weight="medium" />
                <Text text={props.waitingForHelperToAcceptText} size="xs" />
              </View>
            ) : (
              <Button
                text={props.acceptTaskLabel}
                onPress={props.onAccept}
                style={{ flex: 2, paddingVertical: props.spacingXs }}
              />
            )
          ) : (
            <View
              style={{
                gap: props.spacingSm,
                paddingHorizontal: props.spacingSm,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: props.neutral300,
                backgroundColor: props.neutral100,
                flex: 1,
                paddingVertical: props.spacingSm,
              }}
            >
              {props.isRequester ? (
                <>
                  <Text text={props.canMarkCompletedText} weight="medium" />
                  <Button
                    text={props.completeTaskLabel}
                    onPress={props.onComplete}
                    style={{ flex: 2, paddingVertical: props.spacingXs }}
                  />
                </>
              ) : (
                <Text text={props.waitingRequesterToCompleteText} weight="medium" />
              )}
            </View>
          )}
        </View>
      ) : null}

      {(props.canCancel || props.canRelease || props.rawStatus === "ASSIGNED") ? (
        <View style={{ marginTop: props.spacingMd, marginHorizontal: 16, gap: props.spacingXs }}>
          {props.canCancel ? (
            <Button
              text={props.actionLoading ? "..." : props.cancelRequestLabel}
              onPress={() => props.onOpenReason("cancel")}
              style={{ paddingVertical: props.spacingXs }}
            />
          ) : null}

          {props.canRelease ? (
            <Button
              text={props.actionLoading ? "..." : props.giveAwayLabel}
              onPress={() => props.onOpenReason("release")}
              style={{ paddingVertical: props.spacingXs }}
            />
          ) : null}

          {props.isRequester && props.rawStatus === "ASSIGNED" && !props.canReassign && props.reassignCountdown ? (
            <Text text={props.reassignAvailableInText} size="xs" />
          ) : null}

          {props.canReassign ? (
            <Button
              text={props.actionLoading ? "..." : props.reassignHelperLabel}
              onPress={props.onReassign}
              style={{ paddingVertical: props.spacingXs }}
            />
          ) : null}

          {props.isRequester && props.rawStatus === "ASSIGNED" && props.reassignLimitReached ? (
            <Text text={props.reassignLimitReachedText} size="xs" />
          ) : null}
        </View>
      ) : null}

      {props.normalizedStatus === "COMPLETED" ? (
        <View
          style={{
            paddingVertical: props.spacingXs,
            paddingHorizontal: props.spacingSm,
            marginVertical: props.spacingSm,
            marginHorizontal: 16,
            borderRadius: 8,
            backgroundColor: props.successSoft,
            borderWidth: 1,
            borderColor: props.success,
          }}
        >
          <Text text={props.taskCompletedLabel} weight="bold" style={{ color: props.success }} />
          <Text style={{ marginBottom: 5 }} text={props.thanksForHelpingLabel} size="xs" />
          <Button
            text={props.okLabel}
            onPress={props.onGoBack}
            style={{ flex: 2, paddingVertical: props.spacingXs }}
          />
        </View>
      ) : null}
    </>
  )
}
