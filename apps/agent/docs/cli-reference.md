# Sentinel — CLI Reference

## Global Options

```
seltriva-agent [options] <command>

Options:
  --config <path>    Path to configuration file
  --verbose          Enable verbose output
  --json             Output in JSON format (machine-readable)
  --no-color         Disable colored output
  --version          Show version number
  --help             Show help
```

---

## Commands

### `install`

Register this agent with the Seltriva Connect Platform.

```bash
seltriva-agent install [options]
```

| Option                 | Description                                     |
| ---------------------- | ----------------------------------------------- |
| `--platform-url <url>` | Seltriva platform URL                           |
| `--name <name>`        | Agent display name                              |
| `--config <path>`      | Write config to this path                       |
| `--non-interactive`    | Skip interactive prompts (requires all options) |

**What it does:**

1. Creates the data directory
2. Generates a default `agent.yaml` configuration
3. Connects to the platform and registers the agent
4. Stores the assigned `agent_id` and auth token in the credential store
5. Runs pre-flight diagnostic checks

**Example:**

```bash
seltriva-agent install --name "production-erp-01" --platform-url https://connect.seltriva.com
```

---

### `configure`

Interactive configuration wizard. Edit agent settings, add connectors, set credentials.

```bash
seltriva-agent configure [options]
```

| Option              | Description                                 |
| ------------------- | ------------------------------------------- |
| `--connector`       | Configure database connectors only          |
| `--security`        | Configure security settings only            |
| `--sync`            | Configure sync settings only                |
| `--validate`        | Validate current config without changing it |
| `--non-interactive` | Generate default config non-interactively   |

**Example:**

```bash
seltriva-agent configure --connector
```

---

### `start`

Start the agent as a background daemon.

```bash
seltriva-agent start [options]
```

| Option            | Description                                              |
| ----------------- | -------------------------------------------------------- |
| `--foreground`    | Run in foreground (don't daemonize) — for Docker/systemd |
| `--config <path>` | Use this config file                                     |

**Example:**

```bash
# Production: managed by systemd (uses --foreground)
seltriva-agent start --foreground

# Development: background daemon
seltriva-agent start
```

---

### `stop`

Gracefully stop the running daemon.

```bash
seltriva-agent stop
```

The agent drains active sync jobs before stopping (up to 30 seconds).

---

### `restart`

Stop and restart the daemon.

```bash
seltriva-agent restart
```

---

### `status`

Show current agent status.

```bash
seltriva-agent status [--json]
```

**Output example:**

```
Seltriva Connect Agent (Sentinel) v0.1.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Status:       ● running (PID 12345)
Environment:  production
Uptime:       3 days, 4 hours
Last sync:    2 minutes ago (incremental)
Health:       healthy

Connectors:
  ● main-erp    postgres  connected  latency 12ms
  ● warehouse   mysql     connected  latency 8ms

Cloud:        connected  latency 45ms
Queue:        0 pending
```

---

### `doctor`

Run diagnostic checks and display a health report.

```bash
seltriva-agent doctor [options]
```

| Option             | Description                         |
| ------------------ | ----------------------------------- |
| `--category <cat>` | Run only checks in this category    |
| `--verbose`        | Show detailed output for each check |
| `--json`           | Output as JSON                      |

Categories: `configuration`, `connectivity`, `security`, `filesystem`, `runtime`, `connector`, `cloud`, `sync`, `performance`

**Output example:**

```
Seltriva Agent Doctor
━━━━━━━━━━━━━━━━━━━━

Configuration
  ✓ Config file found (/etc/seltriva/agent.yaml)
  ✓ Config schema valid
  ✓ Data directory writable

Security
  ✓ Encryption key readable
  ✓ TLS certificates valid (expires in 284 days)
  ✓ Cloud certificate valid

Connectivity
  ✓ main-erp database reachable (12ms)
  ✓ main-erp user is read-only
  ✓ Seltriva cloud reachable (45ms)
  ✓ Agent registered and authenticated

Sync
  ✓ Offline queue healthy (0 pending)
  ✓ Last sync completed successfully

Summary: 12 passed, 0 warnings, 0 failures
```

---

### `logs`

View and follow agent logs.

```bash
seltriva-agent logs [options]
```

| Option             | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `-f, --follow`     | Follow log output in real time                           |
| `-n, --lines <n>`  | Number of lines to show (default: 50)                    |
| `--level <level>`  | Filter by minimum level (error/warn/info/debug)          |
| `--since <time>`   | Show logs since time (e.g., "1h", "2026-01-15T10:00:00") |
| `--connector <id>` | Filter by connector ID                                   |
| `--json`           | Output as JSON (one record per line)                     |

**Examples:**

```bash
# Follow all logs
seltriva-agent logs --follow

# Show last 100 error logs
seltriva-agent logs --level error --lines 100

# Follow logs for a specific connector
seltriva-agent logs --follow --connector main-erp

# Machine-readable output
seltriva-agent logs --json --since 1h
```

---

### `update`

Check and apply agent updates.

```bash
seltriva-agent update [options]
```

| Option             | Description                                  |
| ------------------ | -------------------------------------------- |
| `--check`          | Check for updates without downloading        |
| `--channel <chan>` | Update channel: stable (default), beta, edge |
| `--force`          | Apply even if already on latest              |
| `--version <ver>`  | Install a specific version                   |
| `--rollback`       | Roll back to the previous version            |

**Examples:**

```bash
# Check for available updates
seltriva-agent update --check

# Apply latest stable update
seltriva-agent update

# Roll back if something went wrong
seltriva-agent update --rollback
```

---

### `sync`

Manually trigger a sync operation.

```bash
seltriva-agent sync [options]
```

| Option             | Description                          |
| ------------------ | ------------------------------------ |
| `--connector <id>` | Sync only this connector             |
| `--full`           | Force full sync (ignores checkpoint) |
| `--schema <name>`  | Sync only this schema                |
| `--dry-run`        | Discover and diff but don't transmit |

**Examples:**

```bash
# Trigger incremental sync for all connectors
seltriva-agent sync

# Full sync for a specific connector
seltriva-agent sync --connector main-erp --full

# Preview what would be synced
seltriva-agent sync --dry-run
```

---

### `connector`

Manage database connectors.

```bash
seltriva-agent connector <subcommand> [options]
```

| Subcommand         | Description                       |
| ------------------ | --------------------------------- |
| `list`             | List all configured connectors    |
| `add`              | Add a new connector interactively |
| `remove --id <id>` | Remove a connector                |
| `test --id <id>`   | Test connectivity                 |
| `show --id <id>`   | Show connector details            |

**Examples:**

```bash
# List connectors
seltriva-agent connector list

# Test a connector
seltriva-agent connector test --id main-erp

# Add new connector interactively
seltriva-agent connector add
```

---

### `credential`

Manage encrypted credentials.

```bash
seltriva-agent credential <subcommand>
```

| Subcommand         | Description                                      |
| ------------------ | ------------------------------------------------ |
| `set --id <id>`    | Store or update a credential (prompts for value) |
| `delete --id <id>` | Delete a credential                              |
| `list`             | List credential IDs (never shows values)         |
| `rotate-key`       | Rotate the AES-256 encryption key                |

---

### `plugin`

Manage plugins.

```bash
seltriva-agent plugin <subcommand>
```

| Subcommand           | Description                  |
| -------------------- | ---------------------------- |
| `list`               | List loaded plugins          |
| `load --path <path>` | Load a plugin from directory |
| `unload --id <id>`   | Unload a plugin              |
| `reload --id <id>`   | Hot-reload a plugin          |
| `info --id <id>`     | Show plugin details          |

---

## Exit Codes

| Code | Meaning                                 |
| ---- | --------------------------------------- |
| `0`  | Success                                 |
| `1`  | General error                           |
| `2`  | Configuration error                     |
| `3`  | Authentication error                    |
| `4`  | Connector unreachable                   |
| `5`  | Cloud unreachable                       |
| `10` | Agent not running (for daemon commands) |
| `11` | Agent already running                   |
