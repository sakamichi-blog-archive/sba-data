import { defineConfig } from "oxfmt"

export default defineConfig({
  arrowParens: "avoid",
  ignorePatterns: ["data"],
  semi: false,
  sortImports: true,
  trailingComma: "none"
})
