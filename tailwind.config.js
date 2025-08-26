/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        light: {
          primary: "#3b82f6",
          secondary: "#6b7280",
          accent: "#63b3ed",
          neutral: "#1f2937",
          "base-100": "#ffffff",
          "base-200": "#f8f9fa",
          "base-300": "#f1f3f4",
          info: "#3abff8",
          success: "#10b981",
          warning: "#f59e0b",
          error: "#ef4444",
        },
        dark: {
          primary: "#63b3ed",
          secondary: "#e2e8f0",
          accent: "#4299e1",
          neutral: "#f7fafc",
          "base-100": "#2d3748",
          "base-200": "#1a202c",
          "base-300": "#4a5568",
          info: "#3abff8",
          success: "#48bb78",
          warning: "#ed8936",
          error: "#f56565",
        },
      },
    ],
  },
};
