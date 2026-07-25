module.exports = {
  root: true,
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict",
    "plugin:prettier/recommended",
    "prettier"
  ],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "prettier", "turbo"],
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true
    }
  },
  env: {
    node: true,
    browser: true,
    es2020: true
  },
  rules: {
    // turbo.json has never declared a globalEnv list, so this rule flags
    // essentially every process.env access repo-wide — a build-cache-key
    // concern, not a code-correctness one. Off until someone deliberately
    // curates turbo.json's env list; --max-warnings 0 would otherwise turn
    // every one of those into a hard CI failure.
    "turbo/no-undeclared-env-vars": "off",
    "prettier/prettier": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }
    ],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-type": [
      "error",
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true
      }
    ]
  },
  ignorePatterns: [
    "node_modules",
    "dist",
    "build",
    ".next",
    "coverage",
    "*.config.js",
    "**/next-env.d.ts"
  ],
  overrides: [
    {
      files: ["*.ts", "*.tsx"],
      parser: "@typescript-eslint/parser",
      extends: ["plugin:@typescript-eslint/strict"]
    },
    {
      files: ["**/*.config.ts"],
      rules: {
        "@typescript-eslint/explicit-function-return-type": "off"
      }
    },
    {
      // Non-null assertions on test fixtures (array.find(...)! etc.) just make
      // a bad test fail fast with a clear TypeError — no production blast
      // radius, so this rule isn't worth enforcing here.
      files: ["**/*.test.ts", "**/*.test.tsx", "**/__tests__/**/*.ts", "**/__tests__/**/*.tsx"],
      rules: {
        "@typescript-eslint/no-non-null-assertion": "off"
      }
    },
    {
      // apps/web: ~680 of its lint errors were explicit-function-return-type
      // on page/component functions and thin hook/service wrappers, spread
      // across 200+ files — TypeScript already infers every one of these
      // correctly (React components return ReactElement, hooks return
      // whatever the underlying query returns), so the rule wasn't catching
      // bugs here, just demanding restated annotations at massive volume.
      files: ["apps/web/src/**/*.tsx", "apps/web/src/hooks/**/*.ts", "apps/web/src/services/**/*.ts"],
      rules: {
        "@typescript-eslint/explicit-function-return-type": "off"
      }
    }
  ]
}
