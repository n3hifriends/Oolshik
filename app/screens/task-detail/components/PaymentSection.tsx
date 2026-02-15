import React from "react"
import { View } from "react-native"
import { Button } from "@/components/Button"
import { Text } from "@/components/Text"
import { TextField, TextFieldAccessoryProps } from "@/components/TextField"

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
  onRefreshPayment: () => void
  showHelperWaitingText: boolean
  helperWaitingText: string
  neutral600: string
  neutral700: string
  primary100: string
  primary200: string
  spacingXs: number
  spacingSm: number
}

export function PaymentSection(props: PaymentSectionProps) {
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
            borderColor: props.primary200,
            backgroundColor: props.primary100,
            paddingBottom: 12,
            paddingTop: 12,
          }}
        >
          <Text text={props.paymentsTitle} preset="subheading" />
          <Text text={props.paymentsHint} size="xs" style={{ color: props.neutral700 }} />
          <Text text={props.amountInrLabel} size="xs" style={{ color: props.neutral600 }} />
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
          {props.helperAmountError ? (
            <Text text={props.helperAmountError} size="xs" style={{ color: "#b91c1c" }} />
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
            borderColor: props.primary200,
            backgroundColor: props.primary100,
            marginHorizontal: 16,
            paddingBottom: 14,
            marginVertical: 5,
            paddingTop: 12,
          }}
        >
          <Text text={props.paymentUpdateTitle} preset="subheading" />
          <Text text={props.paymentStatusText} size="xs" style={{ color: props.neutral700 }} />
          {props.paymentAmountText ? <Text text={props.paymentAmountText} size="xs" style={{ color: props.neutral700 }} /> : null}
          {props.paymentExpiryText ? <Text text={props.paymentExpiryText} size="xs" style={{ color: props.neutral600 }} /> : null}
          {props.paymentLoading ? (
            <Text text={props.refreshingPaymentStatusText} size="xs" style={{ color: props.neutral600 }} />
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
            <Text text={props.helperWaitingText} size="xs" style={{ color: props.neutral600 }} />
          ) : null}
        </View>
      ) : null}
    </>
  )
}
