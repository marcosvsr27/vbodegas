/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
      extend: {
        colors: {
          brand: {
            green: "#16a34a",
            dark: "#0b2b1b"
          }
        }
      }
    },
    plugins: []
  }