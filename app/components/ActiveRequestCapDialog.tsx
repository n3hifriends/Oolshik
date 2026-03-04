import { AlertDialog } from "@/components/AlertDialog/AlertDialog"

type ActiveRequestCapDialogProps = {
  visible: boolean
  title: string
  message: string
  showPrimaryOpen: boolean
  primaryOpenLabel: string
  secondaryViewLabel: string
  closeLabel: string
  onOpenActiveRequest: () => void
  onViewActiveRequests: () => void
  onDismiss: () => void
}

export function ActiveRequestCapDialog(props: ActiveRequestCapDialogProps) {
  const actions = []
  if (props.showPrimaryOpen) {
    actions.push({
      text: props.primaryOpenLabel,
      tone: "primary" as const,
      onPress: props.onOpenActiveRequest,
    })
  }
  actions.push({
    text: props.secondaryViewLabel,
    onPress: props.onViewActiveRequests,
  })
  actions.push({
    text: props.closeLabel,
    onPress: props.onDismiss,
  })

  return (
    <AlertDialog
      visible={props.visible}
      title={props.title}
      message={props.message}
      actions={actions}
      onDismiss={props.onDismiss}
      dismissOnBackdropPress
    />
  )
}
