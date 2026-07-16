import React from "react"
import { View } from "react-native"
import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import { TextField, TextFieldAccessoryProps } from "@/components/TextField"
import { useAppTheme } from "@/theme/context"

type PaymentSectionProps = {
  showHelperScanner: boolean
  paymentsTitle: string
  paymentsHint: string
  amountInrLabel: string
  helperAmountInput: string
  helperAmountError: string | null
  onHelperAmountChange: (value: string) => void
  onOpenScanner: () => void
  paymentButtonLabel: string
  directPaymentLabel: string
  PaymentAmountPrefix: (props: TextFieldAccessoryProps) => React.ReactNode
  showActivePayment: boolean
  paymentUpdateTitle: string
  paymentStatusText: string
  paymentAmountText?: string | null
  paymentExpiryText?: string | null
  paymentLoading: boolean
  refreshingPaymentStatusText: string
  canRequesterPay: boolean
  payWithUpiLabel: string
  refreshLabel: string
  onOpenPaymentFlow: () => void
  onOpenDirectPaymentFlow: () => void
  onRefreshPayment: () => void
  showHelperWaitingText: boolean
  helperWaitingText: string
  spacingXs: number
  spacingSm: number
}

export function PaymentSection(props: PaymentSectionProps) {
  const { theme } = useAppTheme()
  return (
    <>
      {props.showHelperScanner ? (
        <View
          style={{
            marginHorizontal: 16,
            marginVertical: 5,
            gap: props.spacingXs,
            paddingHorizontal: props.spacingSm,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            paddingBottom: 12,
            paddingTop: 12,
          }}
        >
          <Text text={props.paymentsTitle} preset="subheading" />
          <Text text={props.paymentsHint} size="xs" style={{ color: theme.colors.textDim }} />
          <Text text={props.amountInrLabel} size="xs" style={{ color: theme.colors.textDim }} />
          <View style={{ flexDirection: "row", alignItems: "stretch", gap: props.spacingXs }}>
            <View style={{ flex: 1 }}>
              <TextField
                value={props.helperAmountInput}
                onChangeText={props.onHelperAmountChange}
                keyboardType="decimal-pad"
                placeholder="0.00"
                status={props.helperAmountError ? "error" : undefined}
                LeftAccessory={props.PaymentAmountPrefix}
                inputWrapperStyle={{ minHeight: 48, borderRadius: 10 }}
                containerStyle={{ marginBottom: 0 }}
              />
            </View>
            <Button
              text={props.paymentButtonLabel}
              onPress={props.onOpenScanner}
              style={{ minWidth: 120, minHeight: 48, justifyContent: "center" }}
            />
          </View>
          <Button
            text={props.directPaymentLabel}
            onPress={props.onOpenDirectPaymentFlow}
            style={{ minHeight: 46, justifyContent: "center" }}
          />
          {props.helperAmountError ? (
            <Text text={props.helperAmountError} size="xs" style={{ color: theme.colors.error }} />
          ) : null}
        </View>
      ) : null}

      {props.showActivePayment ? (
        <View
          style={{
            gap: props.spacingXs,
            paddingHorizontal: props.spacingSm,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: theme.colors.border,
            backgroundColor: theme.colors.surface,
            marginHorizontal: 16,
            paddingBottom: 14,
            marginVertical: 5,
            paddingTop: 12,
          }}
        >
          <Text text={props.paymentUpdateTitle} preset="subheading" />
          <Text text={props.paymentStatusText} size="xs" style={{ color: theme.colors.textDim }} />
          {props.paymentAmountText ? <Text text={props.paymentAmountText} size="xs" style={{ color: theme.colors.textDim }} /> : null}
          {props.paymentExpiryText ? <Text text={props.paymentExpiryText} size="xs" style={{ color: theme.colors.textDim }} /> : null}
          {props.paymentLoading ? (
            <Text text={props.refreshingPaymentStatusText} size="xs" style={{ color: theme.colors.textDim }} />
          ) : null}

          {props.canRequesterPay ? (
            <View style={{ flexDirection: "row", gap: props.spacingSm }}>
              <Button
                text={props.payWithUpiLabel}
                onPress={props.onOpenPaymentFlow}
                style={{ flex: 1, paddingVertical: props.spacingXs }}
              />
              <Button
                text={props.refreshLabel}
                onPress={props.onRefreshPayment}
                style={{ flex: 1, paddingVertical: props.spacingXs }}
              />
            </View>
          ) : null}

          {props.showHelperWaitingText ? (
            <Text text={props.helperWaitingText} size="xs" style={{ color: theme.colors.textDim }} />
          ) : null}

          {!props.canRequesterPay ? (
            <Button
              text={props.refreshLabel}
              onPress={props.onRefreshPayment}
              style={{ minHeight: 44, justifyContent: "center" }}
            />
          ) : null}
        </View>
      ) : null}
    </>
  )
}
