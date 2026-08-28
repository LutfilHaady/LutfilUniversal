import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          green: '#4C6A4F',
          olive: '#6F8F72',
        },
        cream: {
          white: '#F7F4EF',
          beige: '#E8E3D9',
          grey: '#C3C0B8',
        },
        text: {
          dark: '#2A2A2A',
        },
        status: {
          success: '#3C7F58',
          warning: '#C69F33',
          error: '#B44A4A',
        },
      },
      borderRadius: {
        'card': '12px',
        'button': '10px',
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'card': '0 4px 12px rgba(0, 0, 0, 0.06)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config

