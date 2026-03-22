import React from "react"
import { View } from "react-native"
import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import type { RecoveryAction } from "@/screens/task-detail/types"

type ActionFooterProps = {
  visible: boolean
  recoveryNotice: string | null
  rawStatus?: string
  normalizedStatus:
    | "PENDING"
    | "PENDING_AUTH"
    | "ASSIGNED"
    | "WORK_DONE_PENDING_CONFIRMATION"
    | "REVIEW_REQUIRED"
    | "COMPLETED"
    | "CANCELLED"
    | "UNKNOWN"
  authDecision: "approved" | "rejected" | null
  isRequester: boolean
  isPendingHelper: boolean
  requesterName: string
  requesterFallback: string
  authCountdown: string | null
  completionConfirmationCountdown: string | null
  completionMode?: string | null
  authExpired: boolean
  actionLoading: boolean
  canCancel: boolean
  canRelease: boolean
  canReassign: boolean
  canMarkDone: boolean
  canConfirmCompletion: boolean
  canReportIssue: boolean
  reassignCountdown: string | null
  reassignLimitReached: boolean
  onAuthorize: () => void
  onAccept: () => void
  onMarkDone: () => void
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
  autoCompletedText: string
  helperCanMarkDoneText: string
  waitingForHelperToMarkDoneText: string
  waitingForConfirmationText: string
  helperMarkedDoneText: string
  completionTimerText: string
  markDoneLabel: string
  confirmCompletionLabel: string
  reportIssueLabel: string
  reviewRequiredText: string
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

function InfoCard(props: {
  children: React.ReactNode
  neutral100: string
  neutral300: string
  spacingXs: number
  spacingSm: number
}) {
  return (
    <View
      style={{
        gap: props.spacingXs,
        paddingVertical: props.spacingXs,
        paddingHorizontal: props.spacingSm,
        borderRadius: 12,
        borderWidth: 1,
        flex: 1,
        borderColor: props.neutral300,
        backgroundColor: props.neutral100,
      }}
    >
      {props.children}
    </View>
  )
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
            <InfoCard
              neutral100={props.neutral100}
              neutral300={props.neutral300}
              spacingXs={props.spacingXs}
              spacingSm={props.spacingSm}
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
            </InfoCard>
          ) : props.isPendingHelper ? (
            <InfoCard
              neutral100={props.neutral100}
              neutral300={props.neutral300}
              spacingXs={props.spacingXs}
              spacingSm={props.spacingSm}
            >
              <Text text={props.waitingRequesterApprovalText} weight="medium" />
              <Text text={props.requesterLabelText} size="xs" />
              {props.authCountdown && !props.authExpired ? (
                <Text text={props.timeLeftText} size="xs" />
              ) : null}
              {props.authExpired ? <Text text={props.authorizationExpiredText} size="xs" /> : null}
            </InfoCard>
          ) : (
            <InfoCard
              neutral100={props.neutral100}
              neutral300={props.neutral300}
              spacingXs={props.spacingXs}
              spacingSm={props.spacingSm}
            >
              <Text text={props.awaitingRequesterApprovalText} weight="medium" />
            </InfoCard>
          )}
        </View>
      ) : props.normalizedStatus === "PENDING" ? (
        <View style={{ flexDirection: "row", marginHorizontal: 16, gap: props.spacingSm }}>
          {props.isRequester ? (
            <InfoCard
              neutral100={props.neutral100}
              neutral300={props.neutral300}
              spacingXs={props.spacingXs}
              spacingSm={props.spacingSm}
            >
              <Text text={props.createdThisRequestText} weight="medium" />
              <Text text={props.waitingForHelperToAcceptText} size="xs" />
            </InfoCard>
          ) : (
            <Button
              text={props.acceptTaskLabel}
              onPress={props.onAccept}
              style={{ flex: 1, paddingVertical: props.spacingXs }}
            />
          )}
        </View>
      ) : props.normalizedStatus === "ASSIGNED" ? (
        <View style={{ flexDirection: "row", marginHorizontal: 16, gap: props.spacingSm }}>
          <InfoCard
            neutral100={props.neutral100}
            neutral300={props.neutral300}
            spacingXs={props.spacingXs}
            spacingSm={props.spacingSm}
          >
            {props.canMarkDone ? (
              <>
                <Text text={props.helperCanMarkDoneText} weight="medium" />
                <Button
                  text={props.markDoneLabel}
                  onPress={props.onMarkDone}
                  disabled={props.actionLoading}
                  style={{ paddingVertical: props.spacingXs }}
                />
              </>
            ) : (
              <Text
                text={
                  props.isRequester
                    ? props.waitingForHelperToMarkDoneText
                    : props.waitingRequesterToCompleteText
                }
                weight="medium"
              />
            )}
          </InfoCard>
        </View>
      ) : props.normalizedStatus === "WORK_DONE_PENDING_CONFIRMATION" ? (
        <View style={{ marginHorizontal: 16, gap: props.spacingSm }}>
          <InfoCard
            neutral100={props.neutral100}
            neutral300={props.neutral300}
            spacingXs={props.spacingXs}
            spacingSm={props.spacingSm}
          >
            <Text
              text={
                props.isRequester ? props.helperMarkedDoneText : props.waitingForConfirmationText
              }
              weight="medium"
            />
            {props.completionConfirmationCountdown ? (
              <Text text={props.completionTimerText} size="xs" />
            ) : null}
            {props.canConfirmCompletion || props.canReportIssue ? (
              <View style={{ flexDirection: "row", gap: props.spacingSm }}>
                {props.canConfirmCompletion ? (
                  <Button
                    text={props.confirmCompletionLabel}
                    onPress={props.onComplete}
                    disabled={props.actionLoading}
                    style={{ flex: 1, paddingVertical: props.spacingXs }}
                  />
                ) : null}
                {props.canReportIssue ? (
                  <Button
                    text={props.reportIssueLabel}
                    onPress={() => props.onOpenReason("issue")}
                    disabled={props.actionLoading}
                    style={{ flex: 1, paddingVertical: props.spacingXs }}
                  />
                ) : null}
              </View>
            ) : null}
          </InfoCard>
        </View>
      ) : props.normalizedStatus === "REVIEW_REQUIRED" ? (
        <View style={{ marginHorizontal: 16 }}>
          <InfoCard
            neutral100={props.neutral100}
            neutral300={props.neutral300}
            spacingXs={props.spacingXs}
            spacingSm={props.spacingSm}
          >
            <Text text={props.reviewRequiredText} weight="medium" />
          </InfoCard>
        </View>
      ) : null}

      {props.canCancel || props.canRelease || props.rawStatus === "ASSIGNED" ? (
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

          {props.isRequester &&
          props.rawStatus === "ASSIGNED" &&
          !props.canReassign &&
          props.reassignCountdown ? (
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
          <Text
            style={{ marginBottom: 5 }}
            text={
              props.completionMode === "AUTO_TIMEOUT"
                ? props.autoCompletedText
                : props.thanksForHelpingLabel
            }
            size="xs"
          />
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
