# Sentinel — Deployment Guide

## System Requirements

| Requirement | Minimum                                                         | Recommended |
| ----------- | --------------------------------------------------------------- | ----------- |
| OS          | Linux (Ubuntu 20.04+, RHEL 8+), Windows Server 2019+, macOS 12+ | Linux       |
| Node.js     | 18.0.0                                                          | 20 LTS      |
| RAM         | 256 MB                                                          | 512 MB      |
| Disk        | 500 MB                                                          | 2 GB        |
| CPU         | 1 core                                                          | 2 cores     |
| Network     | Outbound HTTPS (443)                                            | —           |

The agent requires **outbound-only** network access. No inbound ports are opened.

---

## Installation Methods

### Method 1: NPM Global Install (recommended for development)

```bash
npm install -g @seltriva/agent
seltriva-agent install
```

### Method 2: Standalone Binary

Download the pre-built binary for your platform from the Seltriva release page.

```bash
# Linux/macOS
chmod +x seltriva-agent
./seltriva-agent install

# Windows
seltriva-agent.exe install
```

### Method 3: Docker

```dockerfile
FROM node:20-alpine
RUN npm install -g @seltriva/agent
VOLUME /data
ENV SELTRIVA_AGENT_DATA_DIR=/data
CMD ["seltriva-agent", "start", "--foreground"]
```

```bash
docker run -d \
  --name sentinel \
  -v /etc/seltriva:/etc/seltriva:ro \
  -v /var/lib/seltriva:/data \
  sentinel-agent:latest
```

### Method 4: systemd Service (Linux production)

Create `/etc/systemd/system/seltriva-agent.service`:

```ini
[Unit]
Description=Seltriva Connect Agent (Sentinel)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=seltriva
Group=seltriva
ExecStart=/usr/bin/seltriva-agent start --foreground
ExecStop=/usr/bin/seltriva-agent stop
Restart=on-failure
RestartSec=10
Environment=SELTRIVA_AGENT_DATA_DIR=/var/lib/seltriva
Environment=SELTRIVA_AGENT_CONFIG=/etc/seltriva/agent.yaml

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable seltriva-agent
systemctl start seltriva-agent
```

---

## Database User Setup

The agent uses **read-only** database users. Create a dedicated user for each database connector:

### PostgreSQL

```sql
CREATE ROLE seltriva_agent WITH LOGIN PASSWORD 'use-credential-store';
GRANT CONNECT ON DATABASE your_database TO seltriva_agent;
GRANT USAGE ON SCHEMA public TO seltriva_agent;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO seltriva_agent;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO seltriva_agent;

-- Required for schema discovery
GRANT SELECT ON information_schema.tables TO seltriva_agent;
GRANT SELECT ON information_schema.columns TO seltriva_agent;
GRANT SELECT ON pg_catalog.pg_tables TO seltriva_agent;
```

### MySQL / MariaDB

```sql
CREATE USER 'seltriva_agent'@'localhost' IDENTIFIED BY 'use-credential-store';
GRANT SELECT ON your_database.* TO 'seltriva_agent'@'localhost';
GRANT SELECT ON information_schema.* TO 'seltriva_agent'@'localhost';
FLUSH PRIVILEGES;
```

### SQL Server

```sql
CREATE LOGIN seltriva_agent WITH PASSWORD = 'use-credential-store';
USE your_database;
CREATE USER seltriva_agent FOR LOGIN seltriva_agent;
ALTER ROLE db_datareader ADD MEMBER seltriva_agent;
```

---

## Network Requirements

The agent requires only **outbound** HTTPS access:

| Destination            | Port   | Protocol  | Purpose               |
| ---------------------- | ------ | --------- | --------------------- |
| `connect.seltriva.com` | 443    | HTTPS/WSS | Cloud sync + commands |
| Your database hosts    | varies | TCP       | Schema discovery      |
| `updates.seltriva.com` | 443    | HTTPS     | Update checks         |

No inbound firewall rules are required.

---

## First-Time Setup

```bash
# 1. Install the agent
seltriva-agent install

# 2. Run the configuration wizard
seltriva-agent configure

# 3. Run diagnostic checks
seltriva-agent doctor

# 4. Start the agent
seltriva-agent start

# 5. Verify it's running
seltriva-agent status
```

---

## Environment Variables

| Variable                  | Description                              |
| ------------------------- | ---------------------------------------- |
| `SELTRIVA_AGENT_CONFIG`   | Path to config file                      |
| `SELTRIVA_AGENT_DATA_DIR` | Data directory                           |
| `SELTRIVA_AGENT_ID`       | Agent ID (overrides config)              |
| `SELTRIVA_AGENT_TOKEN`    | Auth token (overrides credential store)  |
| `NODE_ENV`                | `development` / `staging` / `production` |
| `LOG_LEVEL`               | Override log level from config           |

---

## Upgrading

```bash
# Check for updates
seltriva-agent update --check

# Apply latest update
seltriva-agent update

# Roll back to previous version if needed
seltriva-agent update --rollback
```

Updates are signed — the agent verifies the signature before applying.

---

## Uninstalling

```bash
seltriva-agent stop
seltriva-agent uninstall --purge-data
npm uninstall -g @seltriva/agent
```

`--purge-data` also removes the data directory and cached credentials.

---

## Monitoring

The agent exports the following for external monitoring:

- **Log files**: `{data_dir}/logs/` (structured JSON)
- **Health endpoint**: Agent reports to cloud platform — visible in the Seltriva dashboard
- **Metrics**: Optional OTLP/Prometheus exporter via telemetry config
- **Process**: Monitor via systemd `systemctl status seltriva-agent`
