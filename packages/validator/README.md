# @seltriva/validator

Atlas Plugin Validator — validate plugins across 6 dimensions before publishing.

## Installation

```bash
npm install @seltriva/validator
```

## Validation Categories

| Category        | Weight | What It Checks                                    |
|-----------------|--------|---------------------------------------------------|
| `manifest`      | 30%    | ID format, version, SPDX license, required fields |
| `interfaces`    | 25%    | Exports match declared plugin type                |
| `compatibility` | 15%    | Platform/SDK semver ranges satisfiable            |
| `dependencies`  | 10%    | No forbidden modules, peer deps satisfied         |
| `security`      | 15%    | Permissions ≤ capabilities, no over-privilege     |
| `performance`   | 5%     | Bundle ≤5MB, init time ≤5s, memory ≤256MB        |

## Usage

```typescript
import type { IPluginValidator, ValidationTarget } from '@seltriva/validator';

const report = await validator.validate(target);
console.log(`Score: ${report.score}/100`);
console.log(`Valid: ${report.valid}`);
report.categories.forEach(cat => {
  console.log(`  ${cat.category}: ${cat.passed ? 'PASS' : 'FAIL'}`);
  cat.issues.forEach(i => console.log(`    [${i.severity}] ${i.message}`));
});
```

## CLI Integration

The validator runs automatically during `atlas doctor` and before `atlas publish`.
