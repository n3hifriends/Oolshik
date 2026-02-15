import React from "react"
import { ActivityIndicator, View } from "react-native"
import { useRoute } from "@react-navigation/native"
import { useTranslation } from "react-i18next"
import { Screen } from "@/components/Screen"
import { Text } from "@/components/Text"
import type { OolshikStackScreenProps } from "@/navigators/OolshikNavigator"
import { useTaskDetailController } from "@/screens/task-detail/hooks/useTaskDetailController"
import { TaskDetailHeader } from "@/screens/task-detail/components/TaskDetailHeader"
import { TaskSummaryCard } from "@/screens/task-detail/components/TaskSummaryCard"
import { OfferSection } from "@/screens/task-detail/components/OfferSection"
import { ContactSection } from "@/screens/task-detail/components/ContactSection"
import { PaymentSection } from "@/screens/task-detail/components/PaymentSection"
import { RatingSection } from "@/screens/task-detail/components/RatingSection"
import { CsatSection } from "@/screens/task-detail/components/CsatSection"
import { ReasonModalSection } from "@/screens/task-detail/components/ReasonModal"
import { ActionFooter } from "@/screens/task-detail/components/ActionFooter"

type RouteParams = { id: string }
type Props = OolshikStackScreenProps<"OolshikDetail">

export default function TaskDetailScreen({ navigation }: Props) {
  const { t } = useTranslation()
  const { params } = useRoute() as { params: RouteParams }
  const taskId = String(params?.id ?? "")

  const controller = useTaskDetailController({
    taskId,
    navigation,
    t: t as (key: string, options?: Record<string, unknown>) => string,
  })

  const { spacing, colors, primary, success, successSoft, neutral600, neutral700 } = controller.theme
  const { current, state, handlers, role, statusInfo, offer, contact, payment, rating, derived } = controller

  return (
    <Screen preset="scroll" safeAreaEdges={["top", "bottom"]}>
      <TaskDetailHeader
        title={t("oolshik:taskDetail")}
        refreshLabel={t("oolshik:taskDetailScreen.refresh")}
        reportLabel={t("oolshik:taskDetailScreen.report")}
        refreshA11yLabel={t("oolshik:taskDetailScreen.refreshTaskDetailsA11y")}
        refreshing={state.refreshing}
        onRefresh={handlers.refreshTask}
        onReport={handlers.openReport}
        primaryColor={primary}
        neutral100={colors.palette.neutral100}
        neutral300={colors.palette.neutral300}
        textDimColor={colors.textDim}
        spacingXs={spacing.xs}
        spacingSm={spacing.sm}
        spacingXxxs={spacing.xxxs}
      />

      <View style={{ flex: 1, paddingHorizontal: 16, paddingBottom: 32 }}>
        {state.loading || !current ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            {state.loading ? <ActivityIndicator /> : <Text text={t("oolshik:taskDetailScreen.taskNotFound")} />}
          </View>
        ) : state.status !== "ready" ? (
          handlers.renderLocationState()
        ) : (
          <View style={{ gap: spacing.md }}>
            <TaskSummaryCard
              initials={derived.initials}
              createdByName={current.createdByName || t("oolshik:taskCard.someoneNearby")}
              createdAtLabel={derived.createdAtLabel}
              voiceAvailable={!!current.voiceUrl}
              audioLoading={controller.playback.audioLoading}
              playing={controller.playback.playing}
              onTogglePlay={handlers.togglePlay}
              loadingVoiceLabel={t("oolshik:taskDetailScreen.loadingVoice")}
              stopVoiceLabel={t("oolshik:taskDetailScreen.stopVoice")}
              playVoiceLabel={t("oolshik:taskDetailScreen.playVoice")}
              description={derived.description}
              distanceLabel={derived.distanceLabel}
              distanceAwayText={derived.distanceAwayText}
              onOpenMap={handlers.openMap}
              mapLabel={t("oolshik:taskDetailScreen.map")}
              openMapA11y={t("oolshik:taskDetailScreen.openMapA11y")}
              statusLabel={statusInfo.statusChip.label}
              statusBg={statusInfo.statusChip.bg}
              statusFg={statusInfo.statusChip.fg}
              showRatingBadge={rating.showRatingBadge}
              ratingBadgeValue={rating.ratingBadgeValue}
              neutral200={colors.palette.neutral200}
              neutral600={neutral600}
              neutral700={neutral700}
              primary={primary}
              primary100={colors.palette.primary100}
              primary200={colors.palette.primary200}
              spacingXxs={spacing.xxs}
              spacingXs={spacing.xs}
              spacingSm={spacing.sm}
              spacingMd={spacing.md}
            />

            <OfferSection
              title={t("oolshik:taskDetailScreen.offer")}
              currentOfferText={offer.currentOfferText}
              canEditOffer={offer.canEditOffer}
              offerInput={state.offerInput}
              onOfferInputChange={handlers.setOfferInput}
              onSaveOffer={handlers.onSaveOffer}
              offerSaving={state.offerSaving}
              saveLabel={t("oolshik:taskDetailScreen.save")}
              savingLabel={t("oolshik:taskDetailScreen.saving")}
              setOfferAmountPlaceholder={t("oolshik:taskDetailScreen.setOfferAmount")}
              offerNotice={state.offerNotice}
              neutral100={colors.palette.neutral100}
              neutral300={colors.palette.neutral300}
              neutral600={neutral600}
              neutral700={neutral700}
              spacingXs={spacing.xs}
              spacingSm={spacing.sm}
            />

            <ContactSection
              visible={contact.canViewContact}
              title={contact.contactLabel}
              displayPhone={contact.displayPhone}
              isRevealed={state.isRevealed}
              revealLoading={state.revealLoading}
              canCall={contact.canCall}
              onReveal={handlers.onRevealPhone}
              onCall={handlers.onCall}
              callLabel={t("oolshik:taskDetailScreen.call")}
              showLabel={t("oolshik:taskDetailScreen.show")}
              neutral100={colors.palette.neutral100}
              neutral300={colors.palette.neutral300}
              neutral700={neutral700}
              spacingXs={spacing.xs}
              spacingSm={spacing.sm}
            />
          </View>
        )}
      </View>

      <View style={{ height: 12 }} />

      <ActionFooter
        visible={!!current}
        recoveryNotice={state.recoveryNotice}
        rawStatus={statusInfo.rawStatus}
        normalizedStatus={statusInfo.normalizedStatus}
        authDecision={state.authDecision}
        isRequester={role.isRequester}
        isPendingHelper={role.isPendingHelper}
        requesterName={derived.requesterName}
        requesterFallback={t("oolshik:taskDetailScreen.requesterFallback")}
        authCountdown={statusInfo.authCountdown}
        authExpired={statusInfo.authExpired}
        actionLoading={state.actionLoading}
        canCancel={statusInfo.canCancel}
        canRelease={statusInfo.canRelease}
        canReassign={statusInfo.canReassign}
        reassignCountdown={statusInfo.reassignCountdown}
        reassignLimitReached={derived.reassignLimitReached}
        onAuthorize={handlers.onAuthorize}
        onAccept={handlers.onAccept}
        onComplete={handlers.onComplete}
        onOpenReason={handlers.openReasonSheet}
        onReassign={handlers.onReassign}
        onGoBack={handlers.goBack}
        helperRequestedAuthorizationText={t("oolshik:taskDetailScreen.helperRequestedAuthorization")}
        requesterLabelText={t("oolshik:taskDetailScreen.requesterLabel", {
          name: derived.requesterName,
        })}
        approveWithinText={t("oolshik:taskDetailScreen.approveWithin", {
          time: statusInfo.authCountdown ?? "",
        })}
        authorizationExpiredText={t("oolshik:taskDetailScreen.authorizationExpired")}
        waitingRequesterApprovalText={t("oolshik:taskDetailScreen.waitingRequesterApproval")}
        timeLeftText={t("oolshik:taskDetailScreen.timeLeft", {
          time: statusInfo.authCountdown ?? "",
        })}
        awaitingRequesterApprovalText={t("oolshik:taskDetailScreen.awaitingRequesterApproval")}
        approveLabel={t("oolshik:taskDetailScreen.approve")}
        rejectLabel={t("oolshik:taskDetailScreen.reject")}
        createdThisRequestText={t("oolshik:taskDetailScreen.createdThisRequest")}
        waitingForHelperToAcceptText={t("oolshik:taskDetailScreen.waitingForHelperToAccept")}
        acceptTaskLabel={t("oolshik:acceptTask")}
        canMarkCompletedText={t("oolshik:taskDetailScreen.canMarkCompleted")}
        completeTaskLabel={t("oolshik:completeTask")}
        waitingRequesterToCompleteText={t("oolshik:taskDetailScreen.waitingForRequesterToComplete")}
        cancelRequestLabel={t("oolshik:taskDetailScreen.cancelRequest")}
        giveAwayLabel={t("oolshik:taskDetailScreen.giveAway")}
        reassignAvailableInText={t("oolshik:taskDetailScreen.reassignAvailableIn", {
          time: statusInfo.reassignCountdown ?? "",
        })}
        reassignHelperLabel={t("oolshik:taskDetailScreen.reassignHelper")}
        reassignLimitReachedText={t("oolshik:taskDetailScreen.reassignLimitReached")}
        taskCompletedLabel={t("oolshik:taskDetailScreen.taskCompleted")}
        thanksForHelpingLabel={t("oolshik:taskDetailScreen.thanksForHelping")}
        okLabel={t("oolshik:taskDetailScreen.ok")}
        success={success}
        successSoft={successSoft}
        neutral100={colors.palette.neutral100}
        neutral300={colors.palette.neutral300}
        spacingXs={spacing.xs}
        spacingSm={spacing.sm}
        spacingMd={spacing.md}
      />

      <PaymentSection
        showHelperScanner={payment.canOpenPaymentsScanner}
        paymentsTitle={t("oolshik:taskDetailScreen.payments")}
        paymentsHint={t("oolshik:taskDetailScreen.paymentsHint")}
        amountInrLabel={t("oolshik:taskDetailScreen.amountInr")}
        helperAmountInput={state.helperPaymentAmountInput}
        helperAmountError={state.helperPaymentAmountError}
        onHelperAmountChange={handlers.onHelperPaymentAmountChange}
        onOpenScanner={handlers.openPaymentsScanner}
        paymentButtonLabel={t("oolshik:taskDetailScreen.payments")}
        PaymentAmountPrefix={payment.PaymentAmountPrefix}
        showActivePayment={(role.isRequester || role.isHelper) && !!state.activePayment}
        paymentUpdateTitle={t("oolshik:taskDetailScreen.paymentUpdate")}
        paymentStatusText={payment.paymentStatusText}
        paymentAmountText={payment.paymentAmountText}
        paymentExpiryText={payment.paymentExpiresText}
        paymentLoading={state.paymentLoading}
        refreshingPaymentStatusText={t("oolshik:taskDetailScreen.refreshingPaymentStatus")}
        canRequesterPay={role.isRequester && payment.paymentCanAct}
        payWithUpiLabel={t("oolshik:taskDetailScreen.payWithUpi")}
        refreshLabel={t("oolshik:taskDetailScreen.refresh")}
        onOpenPaymentFlow={handlers.openPaymentFlow}
        onRefreshPayment={handlers.loadActivePayment}
        showHelperWaitingText={derived.paymentRequesterNotified}
        helperWaitingText={t("oolshik:taskDetailScreen.requesterNotifiedForPayment")}
        neutral600={neutral600}
        neutral700={neutral700}
        primary100={colors.palette.primary100}
        primary200={colors.palette.primary200}
        spacingXs={spacing.xs}
        spacingSm={spacing.sm}
      />

      <RatingSection
        visible={rating.canRate}
        myRating={rating.myRating}
        otherPartyRating={rating.otherPartyRating}
        isRequester={role.isRequester}
        rating={rating.rating}
        setRating={rating.setRating}
        onSubmitRating={handlers.onSubmitRating}
        ratingSubmitting={state.ratingSubmitting}
        titleRateHelper={t("oolshik:taskDetailScreen.rateYourHelper")}
        titleRateRequester={t("oolshik:taskDetailScreen.rateRequester")}
        submitLabel={t("oolshik:taskDetailScreen.submitRating")}
        submittingLabel="..."
        youRatedText={derived.ratingTexts.youRated}
        helperRatedYouText={derived.ratingTexts.helperRatedYou}
        requesterRatedYouText={derived.ratingTexts.requesterRatedYou}
        neutral100={colors.palette.neutral100}
        neutral300={colors.palette.neutral300}
        spacingMd={spacing.md}
        spacingSm={spacing.sm}
        spacingXs={spacing.xs}
      />

      <CsatSection
        visible={statusInfo.normalizedStatus === "COMPLETED" && !!current?.id}
        csatSubmitted={state.csatSubmitted}
        submittedCsat={state.submittedCsat}
        csatRating={state.csatRating}
        csatTag={state.csatTag}
        csatSubmitting={state.csatSubmitting}
        tags={derived.tagStrings}
        onSelectRating={handlers.setCsatRating}
        onToggleTag={handlers.toggleCsatTag}
        onSubmitCsat={handlers.onSubmitCsat}
        title={t("oolshik:taskDetailScreen.overallExperience")}
        alreadySubmittedThanks={t("oolshik:taskDetailScreen.alreadySubmittedThanks")}
        ratingSubmittedValueText={derived.ratingTexts.ratingSubmittedValue}
        tagSubmittedText={derived.ratingTexts.tagSubmitted}
        commentSubmittedText={derived.ratingTexts.commentSubmitted}
        quickTagOptional={t("oolshik:taskDetailScreen.quickTagOptional")}
        sendFeedbackLabel={t("oolshik:taskDetailScreen.sendFeedback")}
        submittingLabel="..."
        rateNumberA11y={(value) => t("oolshik:taskDetailScreen.rateNumberA11y", { value })}
        tagA11y={(tag) => t("oolshik:taskDetailScreen.tagA11y", { tag })}
        primary={primary}
        primary100={colors.palette.primary100}
        neutral100={colors.palette.neutral100}
        neutral300={colors.palette.neutral300}
        neutral600={neutral600}
        neutral700={neutral700}
        spacingXxs={spacing.xxs}
        spacingXs={spacing.xs}
        spacingSm={spacing.sm}
      />

      <ReasonModalSection
        reasonModal={state.reasonModal}
        title={
          state.reasonModal.action === "release"
            ? t("oolshik:taskDetailScreen.reasonForGivingAway")
            : state.reasonModal.action === "reject"
              ? t("oolshik:taskDetailScreen.reasonForReject")
              : t("oolshik:taskDetailScreen.reasonForCancel")
        }
        reasons={controller.reasons.currentReasons}
        addShortNotePlaceholder={t("oolshik:taskDetailScreen.addShortNote")}
        goBackLabel={t("oolshik:taskDetailScreen.goBack")}
        confirmLabel={t("oolshik:taskDetailScreen.confirm")}
        actionLoading={state.actionLoading}
        primary={primary}
        background={colors.background}
        neutral100={colors.palette.neutral100}
        neutral300={colors.palette.neutral300}
        primary100={colors.palette.primary100}
        spacingSm={spacing.sm}
        onClose={handlers.closeReasonSheet}
        onConfirm={handlers.onConfirmReason}
        onSelectReason={handlers.setReasonCode}
        onChangeReasonText={handlers.setReasonText}
      />
    </Screen>
  )
}
