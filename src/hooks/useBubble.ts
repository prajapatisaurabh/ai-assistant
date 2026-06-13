import {useCallback, useEffect, useState} from 'react';
import {Alert} from 'react-native';
import {Overlay} from '@/native/OverlayModule';
import {useSettingsStore} from '@/store/settingsStore';

/**
 * Manages the floating overlay bubble lifecycle: permission, start/stop, and
 * keeping the persisted `bubbleEnabled` setting in sync with the running
 * foreground service.
 */
export function useBubble() {
  const bubbleEnabled = useSettingsStore(s => s.bubbleEnabled);
  const setBubbleEnabled = useSettingsStore(s => s.setBubbleEnabled);
  const clipboardEnabled = useSettingsStore(s => s.clipboardDetectionEnabled);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    Overlay.isBubbleRunning().then(setRunning).catch(() => {});

    // If the user closes the bubble from its own "Close" button, keep the
    // Settings toggle and persisted flag in sync.
    const unsub = Overlay.addListener(event => {
      if (event.type === 'bubbleClosed') {
        setRunning(false);
        setBubbleEnabled(false);
      }
    });
    return unsub;
  }, [setBubbleEnabled]);

  const enable = useCallback(async () => {
    let granted = await Overlay.hasOverlayPermission();
    if (!granted) {
      granted = await Overlay.requestOverlayPermission();
    }
    if (!granted) {
      Alert.alert(
        'Permission needed',
        'To float over other apps, enable "Display over other apps" for AI Assistant.',
      );
      return;
    }
    await Overlay.startBubble();
    await Overlay.setClipboardWatch(clipboardEnabled);
    setRunning(true);
    setBubbleEnabled(true);
  }, [clipboardEnabled, setBubbleEnabled]);

  const disable = useCallback(async () => {
    await Overlay.stopBubble();
    setRunning(false);
    setBubbleEnabled(false);
  }, [setBubbleEnabled]);

  const toggle = useCallback(
    (next: boolean) => (next ? enable() : disable()),
    [enable, disable],
  );

  return {running, bubbleEnabled, toggle};
}
