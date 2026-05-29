/** @type {import('tailwindcss').Config} */
export default {
  // Memberi tahu Tailwind untuk memindai semua file HTML, JS, dan JSX di dalam folder src
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};