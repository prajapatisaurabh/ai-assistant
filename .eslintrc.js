module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Catch `{value && <JSX/>}` where value can be "" or 0 — these render a
    // raw falsy value outside <Text> and hard-crash on native. Force ternaries.
    'react/jsx-no-leaked-render': ['error', {validStrategies: ['ternary']}],
    // Allow the `const {[id]: _removed, ...rest} = obj` omit idiom.
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      },
    ],
  },
};
