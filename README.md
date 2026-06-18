# Lightbulb

Lightbulb is a focused mobile app for people who have a lot of ideas and do not want them to disappear into random notes, half-finished chats, or scattered documents.

The point of the app is simple: capture an idea while it is fresh, shape it with a bit more structure, and then move it into a real project when it feels worth building. Instead of forcing everything into a rigid system too early, Lightbulb gives ideas room to grow first.

Inside the app, you can create ideas, write brainstorm notes, attach components, and organize segments with descriptions, links, and references. When an idea starts becoming real, you can drag it into a project on the dashboard, move things around freely, archive what you are not using, and keep building without clutter.

Nothing extra is included beyond that scope.

## Stack

- React + TypeScript
- Capacitor Android shell
- Local device storage for persistence

## Run locally

### Web preview

```bash
npm install
npm run dev
```

### Sync the Android project

```bash
npm install
npm run cap:sync
```

### Open in Android Studio

```bash
npm run android:open
```

## APK

Releases on GitHub include the installable APK for the current app version.

To install it:

1. Open the repo's **Releases** page on GitHub.
2. Download the APK attached to the latest release.
3. Install it on your Android device.

## Notes

- The current release workflow produces a debug APK.
- App data is stored locally on the device.
