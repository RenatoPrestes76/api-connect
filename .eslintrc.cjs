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
    "turbo/no-undeclared-env-vars": "warn",
    "prettier/prettier": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_"
      }
    ],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/explicit-function-return-types": [
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
    "*.config.js"
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
        "@typescript-eslint/explicit-function-return-types": "off"
      }
    }
  ]
}
