import {NativeModules, NativeEventEmitter, Platform} from 'react-native';

/**
 * TypeScript bridge to the native Kotlin `OverlayModule`.
 *
 * Native side: android/app/src/main/java/com/aiassistant/overlay/OverlayModule.kt
 *
 * Responsibilities:
 *  - Request / check the SYSTEM_ALERT_WINDOW (draw over other apps) permission.
 *  - Start / stop the foreground overlay service that renders the floating bubble.
 *  - Emit events back to JS (bubble tapped, quick-action chosen, clipboard text).
 */

interface OverlayNativeModule {
  hasOverlayPermission(): Promise<boolean>;
  requestOverlayPermission(): Promise<boolean>;
  startBubble(): Promise<boolean>;
  stopBubble(): Promise<boolean>;
  isBubbleRunning(): Promise<boolean>;
  setClipboardWatch(enabled: boolean): Promise<void>;
}

const LINKING_ERROR =
  `The native module 'OverlayModule' is not linked. ` +
  `Make sure you have rebuilt the Android app after adding the native code ` +
  `(cd android && ./gradlew installDebug) and that you are running on Android.`;

const Native: OverlayNativeModule =
  Platform.OS === 'android'
    ? NativeModules.OverlayModule
    : (new Proxy(
        {},
        {
          get() {
            throw new Error(LINKING_ERROR);
          },
        },
      ) as OverlayNativeModule);

const emitter =
  Platform.OS === 'android' && NativeModules.OverlayModule
    ? new NativeEventEmitter(NativeModules.OverlayModule)
    : null;

export type OverlayEvent =
  | {type: 'bubbleTapped'}
  | {type: 'quickAction'; action: 'improve' | 'summarize' | 'social'; text: string}
  | {type: 'clipboardChanged'; text: string}
  | {type: 'bubbleClosed'};

export const Overlay = {
  hasOverlayPermission: () => Native.hasOverlayPermission(),
  requestOverlayPermission: () => Native.requestOverlayPermission(),
  startBubble: () => Native.startBubble(),
  stopBubble: () => Native.stopBubble(),
  isBubbleRunning: () => Native.isBubbleRunning(),
  setClipboardWatch: (enabled: boolean) => Native.setClipboardWatch(enabled),

  /** Subscribe to native overlay events. Returns an unsubscribe function. */
  addListener(handler: (event: OverlayEvent) => void): () => void {
    if (!emitter) {
      return () => {};
    }
    const sub = emitter.addListener('OverlayEvent', handler);
    return () => sub.remove();
  },
};
