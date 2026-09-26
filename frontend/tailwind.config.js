/** @type {import('tailwindcss').Config} */

// Paleta de TechStore: brand (azul índigo, principal) + accent (ámbar, CTAs).
// Neutros de ayuda: escala "ink" para fondos oscuros y texto sobre brand.
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#dce7ff',
          200: '#b9d0ff',
          300: '#8fb2ff',
          400: '#5e8cff',
          500: '#3564fb',
          600: '#1f43f0',
          700: '#1a33d5',
          800: '#1c2cab',
          900: '#1d2c87',
          950: '#141e5c',
        },
        accent: {
          50: '#fff9eb',
          100: '#feeec7',
          200: '#fddb8a',
          300: '#fcc24d',
          400: '#fbab24',
          500: '#f58a0b',
          600: '#d96806',
          700: '#b44909',
          800: '#92390e',
          900: '#78300f',
        },
        ink: {
          50: '#f6f7fa',
          100: '#eceef4',
          200: '#d5dae7',
          300: '#b1bad1',
          400: '#8895b6',
          500: '#6876a0',
          600: '#525f87',
          700: '#434d6d',
          800: '#3a425c',
          900: '#33394d',
          950: '#1c2030',
        },
      },
    },
  },
  plugins: [],
};
