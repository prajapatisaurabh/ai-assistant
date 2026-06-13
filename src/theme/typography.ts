import React from 'react';
import {StyleSheet, Text, TextInput} from 'react-native';

/**
 * App typography — JetBrains Mono, a clean developer/coding font, bundled in
 * android/app/src/main/assets/fonts. On Android, fontFamily resolves to the
 * asset file's base name.
 */
export const fonts = {
  regular: 'JetBrainsMono-Regular',
  medium: 'JetBrainsMono-Medium',
  bold: 'JetBrainsMono-Bold',
};

/** Pick the matching face for a numeric/string fontWeight. */
export function fontForWeight(weight?: string | number): string {
  const w = typeof weight === 'string' ? parseInt(weight, 10) : weight ?? 400;
  if (Number.isNaN(w)) {
    // non-numeric like 'bold'
    return String(weight) === 'bold' ? fonts.bold : fonts.regular;
  }
  if (w >= 700) {
    return fonts.bold;
  }
  if (w >= 500) {
    return fonts.medium;
  }
  return fonts.regular;
}

/**
 * Applies JetBrains Mono to every <Text>/<TextInput> in the app with ONE patch.
 *
 * We override the component's render to read each element's fontWeight and swap
 * in the matching font FILE (regular/medium/bold) — because a single-weight
 * custom font won't synthesize bold from `fontWeight` alone on Android. We then
 * clear fontWeight so the chosen face is used as-is.
 */
let patched = false;
export function applyGlobalFont(): void {
  if (patched) {
    return;
  }
  patched = true;
  patchRender(Text as unknown as RenderHost);
  patchRender(TextInput as unknown as RenderHost);
}

type RenderHost = {render?: (...args: unknown[]) => React.ReactElement};

function patchRender(Component: RenderHost) {
  const original = Component.render;
  if (typeof original !== 'function') {
    return;
  }
  Component.render = function patched(this: unknown, ...args: unknown[]) {
    const element = original.apply(this, args);
    const flat =
      (StyleSheet.flatten(element.props?.style) as {
        fontWeight?: string | number;
      }) ?? {};
    const family = fontForWeight(flat.fontWeight);
    return React.cloneElement(element, {
      style: [{fontFamily: family}, element.props?.style],
    });
  };
}
