# Welcome to your new ignited app!

> The latest and greatest boilerplate for Infinite Red opinions

This is the boilerplate that [Infinite Red](https://infinite.red) uses as a way to test bleeding-edge changes to our React Native stack.

- [Quick start documentation](https://github.com/infinitered/ignite/blob/master/docs/boilerplate/Boilerplate.md)
- [Full documentation](https://github.com/infinitered/ignite/blob/master/docs/README.md)

---

## Environments

`EXPO_PUBLIC_API_URL` controls which backend the app talks to. `app/config/config.dev.ts` reads it at Metro startup; when it is empty the `devHost` fallback kicks in (`localhost:8080` on iOS sim / `10.0.2.2:8080` on Android emulator).

### Local dev (Expo Go / dev client)

```bash
# API URL intentionally empty → uses devHost Platform.select fallback
npm run start:local          # same as expo start --dev-client

# Point to cloud-dev backend instead
npm run start:cloud-dev      # EXPO_PUBLIC_API_URL=https://api-dev.oolshik.in
```

### EAS build profiles

| EAS profile          | `EXPO_PUBLIC_API_URL`        | Intended target       |
| -------------------- | ---------------------------- | --------------------- |
| `development`        | `` (empty → devHost)         | Local Expo dev client |
| `development:device` | inherits `development`       | Device via tunnel     |
| `preview`            | `https://api-dev.oolshik.in` | Cloud-dev staging     |
| `production`         | `https://www.oolshik.in`     | Production            |

Build commands (local EAS):

```bash
npm run build:ios:sim        # development → simulator
npm run build:ios:dev        # development:device → physical iOS
npm run build:ios:preview    # preview → cloud-dev staging
npm run build:ios:prod       # production

npm run build:android:sim
npm run build:android:dev
npm run build:android:preview
npm run build:android:prod
```

### Override at runtime (no rebuild)

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.100:8080 npx expo start --lan --clear
```

---

## Getting Started

```bash
open \"Android Studio from node directory i.e. cd to "which node" dir, and open studio\"
e.g. cd /Users/nitinkalokhe/.nvm/versions/node/v22.18.0/bin/node and hit /Applications/Android\ Studio app/Contents/MacOS/studio
yarn install
yarn start
Or
EXPO_PUBLIC_API_URL=http://192.168.29.209:8080 npx expo start --lan --clear
```

To make things work on your local simulator, or on your phone, you need first to [run `eas build`](https://github.com/infinitered/ignite/blob/master/docs/expo/EAS.md). We have many shortcuts on `package.json` to make it easier:

```bash
yarn build:ios:sim # build for ios simulator
yarn build:ios:dev # build for ios device
yarn build:ios:prod # build for ios device

for Firebase Auth testing use 999999999999999
```

### `./assets` directory

This directory is designed to organize and store various assets, making it easy for you to manage and use them in your application. The assets are further categorized into subdirectories, including `icons` and `images`:

```tree
assets
├── icons
└── images
```

**icons**
This is where your icon assets will live. These icons can be used for buttons, navigation elements, or any other UI components. The recommended format for icons is PNG, but other formats can be used as well.

Ignite comes with a built-in `Icon` component. You can find detailed usage instructions in the [docs](https://github.com/infinitered/ignite/blob/master/docs/boilerplate/app/components/Icon.md).

**images**
This is where your images will live, such as background images, logos, or any other graphics. You can use various formats such as PNG, JPEG, or GIF for your images.

Another valuable built-in component within Ignite is the `AutoImage` component. You can find detailed usage instructions in the [docs](https://github.com/infinitered/ignite/blob/master/docs/Components-AutoImage.md).

How to use your `icon` or `image` assets:

```typescript
import { Image } from 'react-native';

const MyComponent = () => {
  return (
    <Image source={require('assets/images/my_image.png')} />
  );
};
```

## Running Maestro end-to-end tests

Follow our [Maestro Setup](https://ignitecookbook.com/docs/recipes/MaestroSetup) recipe.

## Next Steps

### Ignite Cookbook

[Ignite Cookbook](https://ignitecookbook.com/) is an easy way for developers to browse and share code snippets (or “recipes”) that actually work.

### Upgrade Ignite boilerplate

Read our [Upgrade Guide](https://ignitecookbook.com/docs/recipes/UpdatingIgnite) to learn how to upgrade your Ignite project.

## Community

⭐️ Help us out by [starring on GitHub](https://github.com/infinitered/ignite), filing bug reports in [issues](https://github.com/infinitered/ignite/issues) or [ask questions](https://github.com/infinitered/ignite/discussions).

💬 Join us on [Slack](https://join.slack.com/t/infiniteredcommunity/shared_invite/zt-1f137np4h-zPTq_CbaRFUOR_glUFs2UA) to discuss.

📰 Make our Editor-in-chief happy by [reading the React Native Newsletter](https://reactnativenewsletter.com/).

# set longitude, latitude on emulator

adb emu geo fix 85.753324 20.263878
