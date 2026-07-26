import { ConfigPlugin, withDangerousMod, withMainApplication } from "expo/config-plugins"

const fs = require("fs").promises
const path = require("path")

const PACKAGE_REGISTRATION = "              add(UpiLauncherPackage())"

async function ensureAndroidSourceFiles(projectRoot: string, packageName: string) {
  const packageDirectory = path.join(
    projectRoot,
    "android",
    "app",
    "src",
    "main",
    "java",
    ...packageName.split("."),
    "upilauncher",
  )

  await fs.mkdir(packageDirectory, { recursive: true })

  const templateDirectory = path.join(projectRoot, "plugins", "android-upi-launcher")
  const templates = ["UpiLauncherModule.kt.template", "UpiLauncherPackage.kt.template"] as const

  await Promise.all(
    templates.map(async (templateName) => {
      const source = path.join(templateDirectory, templateName)
      const target = path.join(packageDirectory, templateName.replace(".template", ""))
      const contents = await fs.readFile(source, "utf8")
      await fs.writeFile(target, contents.replace(/__PACKAGE_NAME__/g, packageName), "utf8")
    }),
  )
}

export const withUpiLauncher: ConfigPlugin = (config) => {
  config = withMainApplication(config, (modConfig) => {
    const packageName = modConfig.android?.package
    if (!packageName) {
      throw new Error("withUpiLauncher requires android.package in app config.")
    }

    const packageImport = `import ${packageName}.upilauncher.UpiLauncherPackage`
    let contents = modConfig.modResults.contents

    if (!contents.includes(packageImport)) {
      contents = contents.replace(
        "import com.facebook.react.ReactPackage\n",
        `import com.facebook.react.ReactPackage\n${packageImport}\n`,
      )
    }

    if (!contents.includes(PACKAGE_REGISTRATION)) {
      contents = contents.replace(
        "              // add(MyReactNativePackage())\n",
        `              // add(MyReactNativePackage())\n${PACKAGE_REGISTRATION}\n`,
      )
    }

    if (!contents.includes(PACKAGE_REGISTRATION)) {
      throw new Error(
        "withUpiLauncher: expected `// add(MyReactNativePackage())` marker not found in MainApplication.kt — Expo's template may have changed, update this plugin's anchors.",
      )
    }

    modConfig.modResults.contents = contents
    return modConfig
  })

  config = withDangerousMod(config, [
    "android",
    async (modConfig) => {
      const packageName = modConfig.android?.package
      if (!packageName) {
        throw new Error("withUpiLauncher requires android.package in app config.")
      }

      await ensureAndroidSourceFiles(modConfig.modRequest.projectRoot, packageName)
      return modConfig
    },
  ])

  return config
}
