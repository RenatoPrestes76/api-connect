# Atlas Cloud — Sequence Diagrams

## 1. User Authentication (Supabase Auth)

```
Browser          Next.js          Supabase Auth     Database
   │                │                  │                │
   │ POST /auth/sign-in                │                │
   │──────────────►│                  │                │
   │               │ signInWithPassword│                │
   │               │─────────────────►│                │
   │               │                  │ validate        │
   │               │                  │◄───────────────►│
   │               │   access_token + refresh_token     │
   │               │◄─────────────────│                │
   │               │ upsertFromAuth()  │                │
   │               │──────────────────────────────────►│
   │               │   User record (upserted)           │
   │               │◄──────────────────────────────────│
   │   Set cookies (HttpOnly, Secure)  │                │
   │◄──────────────│                  │                │
```

## 2. API Request Authorization

```
Client           Middleware       AuthService       RateLimiter      Handler
  │                  │                │                  │               │
  │ Request + Bearer │                │                  │               │
  │─────────────────►│                │                  │               │
  │                  │ verifyJWT()    │                  │               │
  │                  │───────────────►│                  │               │
  │                  │  AuthContext   │                  │               │
  │                  │◄───────────────│                  │               │
  │                  │                    checkLimit()   │               │
  │                  │────────────────────────────────►  │               │
  │                  │                    allowed/denied │               │
  │                  │◄───────────────────────────────── │               │
  │                  │ attach context                    │               │
  │                  │───────────────────────────────────────────────►  │
  │                  │                                   │  process req  │
  │  response        │                                   │◄──────────────│
  │◄─────────────────│                                                   │
```

## 3. Agent Registration

```
Agent            API             AgentService       DB        EventBus
  │               │                   │              │            │
  │ POST /api/agents/register         │              │            │
  │──────────────►│                   │              │            │
  │               │ register(input)   │              │            │
  │               │──────────────────►│              │            │
  │               │                   │ create agent │            │
  │               │                   │─────────────►│            │
  │               │                   │    agent     │            │
  │               │                   │◄─────────────│            │
  │               │                   │ publish event│            │
  │               │                   │─────────────────────────►│
  │               │                   │              │  AgentRegistered
  │               │  AgentRegistrationResult         │            │
  │               │◄──────────────────│              │            │
  │  cloudEndpoint + heartbeatInterval│              │            │
  │◄──────────────│                   │              │            │
```

## 4. Agent Heartbeat + Alert

```
Agent    API          AgentService   MetricsService  MonitoringService  NotifyService
  │       │                │               │                │                 │
  │ POST /api/agents/:id/heartbeat         │                │                 │
  │──────►│                │               │                │                 │
  │       │ processHeartbeat               │                │                 │
  │       │───────────────►│               │                │                 │
  │       │                │ record metrics│                │                 │
  │       │                │──────────────►│                │                 │
  │       │                │ evaluate status               │                 │
  │       │                │──────────────────────────────►│                 │
  │       │                │               │  if degraded: createAlert()      │
  │       │                │               │               │────────────────►│
  │       │                │               │               │   send notifications
  │ 204   │                │               │               │                 │
  │◄──────│                │               │               │                 │
```

## 5. License Activation

```
Admin          API          LicenseService   LicenseValidator   EventBus
  │             │                │                  │               │
  │ POST /api/licenses/activate  │                  │               │
  │────────────►│                │                  │               │
  │             │ activate()     │                  │               │
  │             │───────────────►│                  │               │
  │             │                │ validateKey()    │               │
  │             │                │────────────────►│               │
  │             │                │   valid/invalid  │               │
  │             │                │◄─────────────────│               │
  │             │                │ save license      │               │
  │             │                │ update org tier   │               │
  │             │                │ publish event     │               │
  │             │                │──────────────────────────────────►│
  │             │                │                  │  LicenseActivated
  │   License record + features  │                  │               │
  │◄────────────│                │                  │               │
```

## 6. Job Execution

```
Trigger       Scheduler     JobEngine     JobHandler    DB       EventBus
   │               │              │             │         │          │
   │ cron fires    │              │             │         │          │
   │──────────────►│              │             │         │          │
   │               │ enqueue()    │             │         │          │
   │               │─────────────►│             │         │          │
   │               │              │ dequeue     │         │          │
   │               │              │────────────►│         │          │
   │               │              │             │ execute  │          │
   │               │              │             │─────────►│          │
   │               │              │             │  result  │          │
   │               │              │             │◄─────────│          │
   │               │              │ mark COMPLETED        │          │
   │               │              │────────────────────────►         │
   │               │              │ publish job.completed             │
   │               │              │─────────────────────────────────►│
```
