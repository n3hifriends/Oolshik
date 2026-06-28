import { NativeModules, Platform } from "react-native"

type NativeUpiLauncherModule = {
  isInstalled(packageName: string): Promise<boolean>
  openApp(packageName: string): Promise<boolean>
}

const NativeUpiLauncher = NativeModules.OolshikUpiLauncher as NativeUpiLauncherModule | undefined

export type UpiApp = {
  name: string
  packageName: string
}

export const KNOWN_UPI_APPS: UpiApp[] = [
  { name: "PhonePe", packageName: "com.phonepe.app" },
  { name: "Google Pay", packageName: "com.google.android.apps.nbu.paisa.user" },
  { name: "Paytm", packageName: "net.one97.paytm" },
  { name: "BHIM", packageName: "in.org.npci.upiapp" },
  { name: "Amazon Pay", packageName: "in.amazon.mShop.android.shopping" },
]

export async function getInstalledUpiApps(): Promise<UpiApp[]> {
  if (Platform.OS !== "android" || !NativeUpiLauncher) return []
  const results = await Promise.all(
    KNOWN_UPI_APPS.map(async (app) => {
      const installed = await NativeUpiLauncher.isInstalled(app.packageName)
      return installed ? app : null
    }),
  )
  return results.filter((app): app is UpiApp => app !== null)
}

export async function openUpiApp(packageName: string): Promise<boolean> {
  if (Platform.OS !== "android" || !NativeUpiLauncher) return false
  return NativeUpiLauncher.openApp(packageName)
}
