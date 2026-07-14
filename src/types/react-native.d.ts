import 'react-native';

/**
 * React Native 0.75 implements `submitBehavior` on TextInput (it supersedes
 * `blurOnSubmit`) but ships a .d.ts that still only declares `blurOnSubmit`.
 * See node_modules/react-native/Libraries/Components/TextInput/TextInput.js —
 * the prop is read there and mapped to the native submit behavior.
 *
 * We need it because on a multiline input the typed API can only express
 * "Enter inserts a newline" or "Enter submits AND blurs" — and a chat box
 * wants "Enter submits, keyboard stays up", which is `submitBehavior="submit"`.
 *
 * Delete this once RN's own types catch up.
 */
declare module 'react-native' {
  interface TextInputProps {
    submitBehavior?: 'submit' | 'blurAndSubmit' | 'newline';
  }
}
