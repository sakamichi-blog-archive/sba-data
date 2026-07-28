import { defineConfig } from "oxfmt"

export default defineConfig({
  arrowParens: "avoid",
  ignorePatterns: [
    ".sba-contributions",
    "hinata-blogs",
    "keyaki-blogs",
    "nogi-blogs",
    "sakura-blogs"
  ],
  semi: false,
  sortImports: true,
  trailingComma: "none"
})
