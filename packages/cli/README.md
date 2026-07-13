# @seltriva/cli

Atlas CLI — developer toolchain for building and publishing Seltriva Connect plugins.

## Installation

```bash
npm install -g @seltriva/cli
```

## Commands

| Command         | Description                             |
| --------------- | --------------------------------------- |
| `atlas login`   | Authenticate with Atlas Cloud           |
| `atlas logout`  | Remove stored credentials               |
| `atlas create`  | Scaffold a new plugin project           |
| `atlas build`   | Compile TypeScript plugin               |
| `atlas test`    | Run plugin tests                        |
| `atlas package` | Create signed .atlasp distributable     |
| `atlas publish` | Publish plugin to marketplace           |
| `atlas doctor`  | Diagnose environment and project issues |

## Quick Start

```bash
atlas login
atlas create my-connector --type connector
cd my-connector
atlas build
atlas test
atlas package --sign
atlas publish --channel stable
```

## Doctor Checks

12 automated checks across environment, auth, project, dependencies, build, and network.
Run `atlas doctor --fix` to auto-fix fixable issues.
