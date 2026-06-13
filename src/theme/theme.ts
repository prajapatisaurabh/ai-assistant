/**
 * Material Design 3 inspired theme with light & dark schemes.
 * Color roles follow the M3 naming convention.
 */

export interface ColorScheme {
  primary: string;
  onPrimary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  onSecondary: string;
  background: string;
  onBackground: string;
  surface: string;
  surfaceVariant: string;
  onSurface: string;
  onSurfaceVariant: string;
  outline: string;
  error: string;
  onError: string;
  success: string;
}

export interface Theme {
  dark: boolean;
  colors: ColorScheme;
  radius: {sm: number; md: number; lg: number; pill: number};
  spacing: (n: number) => number;
}

const baseSpacing = (n: number) => n * 4;
const radius = {sm: 8, md: 12, lg: 20, pill: 999};

export const lightColors: ColorScheme = {
  primary: '#4F46E5',
  onPrimary: '#FFFFFF',
  primaryContainer: '#E0E0FF',
  onPrimaryContainer: '#1A1A4D',
  secondary: '#06B6D4',
  onSecondary: '#FFFFFF',
  background: '#FBFBFE',
  onBackground: '#1A1B22',
  surface: '#FFFFFF',
  surfaceVariant: '#EEEEF4',
  onSurface: '#1A1B22',
  onSurfaceVariant: '#46474F',
  outline: '#C5C6D0',
  error: '#BA1A1A',
  onError: '#FFFFFF',
  success: '#16A34A',
};

export const darkColors: ColorScheme = {
  primary: '#BBC2FF',
  onPrimary: '#0E1359',
  primaryContainer: '#2C3079',
  onPrimaryContainer: '#E0E0FF',
  secondary: '#4DD0E1',
  onSecondary: '#003640',
  background: '#121318',
  onBackground: '#E3E2E9',
  surface: '#1B1C22',
  surfaceVariant: '#26272F',
  onSurface: '#E3E2E9',
  onSurfaceVariant: '#C5C6D0',
  outline: '#8E8F99',
  error: '#FFB4AB',
  onError: '#690005',
  success: '#4ADE80',
};

export const lightTheme: Theme = {
  dark: false,
  colors: lightColors,
  radius,
  spacing: baseSpacing,
};

export const darkTheme: Theme = {
  dark: true,
  colors: darkColors,
  radius,
  spacing: baseSpacing,
};
