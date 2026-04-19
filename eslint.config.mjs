import nextPlugin from "eslint-config-next";

const config = [
  ...nextPlugin,
  {
    ignores: [
      ".next/**",
      "coverage/**",
      "node_modules/**",
      "prisma/generated/**",
      "playwright-report/**",
      "test-results/**",
      "shaked-finance-os/**",
    ],
  },
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
      "react-hooks/incompatible-library": "off",
    },
  },
];

export default config;
