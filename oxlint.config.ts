import { defineConfig } from "oxlint"

export default defineConfig({
  plugins: ["oxc", "typescript", "unicorn"],
  // https://oxc.rs/docs/guide/usage/linter/config.html#enable-groups-of-rules-with-categories
  categories: {
    correctness: "error",
    suspicious: "warn",
    pedantic: "off",
    perf: "warn",
    style: "off",
    restriction: "off",
    nursery: "off"
  },
  rules: {},
  env: {
    builtin: true
  }
})
