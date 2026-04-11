import {
  ConfigPlugin,
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} from "expo/config-plugins"

const fs = require("fs").promises
const path = require("path")

const PLAY_SERVICES_AUTH_DEPENDENCY =
  '    implementation("com.google.android.gms:play-services-auth:21.4.0")'
const PACKAGE_REGISTRATION = "            packages.add(PhoneNumberHintPackage())"

async function ensureAndroidSourceFiles(projectRoot: string, packageName: string) {
  const packageDirectory = path.join(
    projectRoot,
    "android",
    "app",
    "src",
    "main",
    "java",
    ...packageName.split("."),
    "phonenumberhint",
  )

  await fs.mkdir(packageDirectory, { recursive: true })

  const templateDirectory = path.join(projectRoot, "plugins", "android-phone-number-hint")
  const templates = [
    "PhoneNumberHintModule.kt.template",
    "PhoneNumberHintPackage.kt.template",
  ] as const

  await Promise.all(
    templates.map(async (templateName) => {
      const source = path.join(templateDirectory, templateName)
      const target = path.join(packageDirectory, templateName.replace(".template", ""))
      const contents = await fs.readFile(source, "utf8")
      await fs.writeFile(target, contents.replace(/__PACKAGE_NAME__/g, packageName), "utf8")
    }),
  )
}

export const withAndroidPhoneNumberHint: ConfigPlugin = (config) => {
  config = withAppBuildGradle(config, (modConfig) => {
    if (modConfig.modResults.language !== "groovy") {
      throw new Error("withAndroidPhoneNumberHint expects a Groovy android/app/build.gradle file.")
    }

    if (!modConfig.modResults.contents.includes("com.google.android.gms:play-services-auth")) {
      modConfig.modResults.contents = modConfig.modResults.contents.replace(
        /dependencies\s*\{/,
        (match) => `${match}\n${PLAY_SERVICES_AUTH_DEPENDENCY}`,
      )
    }

    return modConfig
  })

  config = withMainApplication(config, (modConfig) => {
    const packageName = modConfig.android?.package
    if (!packageName) {
      throw new Error("withAndroidPhoneNumberHint requires android.package in app config.")
    }

    const packageImport = `import ${packageName}.phonenumberhint.PhoneNumberHintPackage`
    let contents = modConfig.modResults.contents

    if (!contents.includes(packageImport)) {
      contents = contents.replace(
        "import com.facebook.react.ReactPackage\n",
        `import com.facebook.react.ReactPackage\n${packageImport}\n`,
      )
    }

    if (!contents.includes(PACKAGE_REGISTRATION)) {
      contents = contents.replace(
        "            // packages.add(MyReactNativePackage())\n",
        `            // packages.add(MyReactNativePackage())\n${PACKAGE_REGISTRATION}\n`,
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
        throw new Error("withAndroidPhoneNumberHint requires android.package in app config.")
      }

      await ensureAndroidSourceFiles(modConfig.modRequest.projectRoot, packageName)
      return modConfig
    },
  ])

  return config
}
