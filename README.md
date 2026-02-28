# evo-dashboard

Real-time dashboard for the [evo](https://github.com/lifefarmer/evo) multi-agent system. Built with Next.js 16, React 19, Tailwind CSS 4, and Zustand. Connects to `evo-king` (port 3000) via REST and Socket.IO for live updates.

**Version:** 0.2.0

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | **Overview** — king health, online agent count, active pipelines, recent events |
| `/agents/` | **Agents** — card grid of all registered agents with status, capabilities, skills, and per-agent model selection dropdown |
| `/pipeline/` | **Pipeline** — evolution pipeline runs and stage details |
| `/tasks/` | **Tasks** — task list with status filters, detail view, logs, and manual task creation |
| `/gateway/` | **Gateway** — provider cards (with model badges), enable/disable toggle, config history |
| `/memories/` | **Memories** — memory CRUD, search, stats, and tier inspection |
| `/events/` | **Events** — live Socket.IO event stream |
| `/traces/` | **Traces** — distributed trace viewer with span waterfall, span detail panel, and filters (service, status, min duration) |
| `/debug/` | **Debug** — LLM prompt tester (with model selector) and bash PTY runner; streams responses in real-time |
| `/settings/` | **Settings** — cron jobs and config sync |

---

## Getting Started

```bash
# Install dependencies
npm install

# Run the dev server (connects to evo-king at NEXT_PUBLIC_KING_URL)
NEXT_PUBLIC_KING_URL=http://localhost:3000 npm run dev

# Static export (for embedding in evo-king)
npm run build   # outputs to out/
```

The dashboard is configured for static export (`output: "export"` in `next.config.ts`) so it can be served directly by evo-king or any static host.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_KING_URL` | `""` (same origin) | Base URL for evo-king REST + Socket.IO |

---

## Architecture

```
src/
  app/                  # Next.js App Router pages
    layout.tsx          # Root layout with sidebar
    page.tsx            # Overview
    agents/page.tsx     # Agent cards + model selection
    pipeline/page.tsx
    tasks/page.tsx
    gateway/page.tsx    # Provider cards with model badges
    memories/page.tsx
    events/page.tsx
    traces/page.tsx     # Two-panel trace viewer: list + waterfall + span detail
    debug/page.tsx      # LLM prompt + bash PTY with model selector
    settings/page.tsx
  components/
    layout/sidebar.tsx  # Navigation sidebar
    shared/
      status-badge.tsx  # Reusable status indicator
      json-viewer.tsx   # Collapsible JSON display
    traces/
      span-waterfall.tsx  # Span tree with horizontal timing bars, color-coded by service
      span-detail.tsx     # Selected span metadata, attributes, and events
  hooks/
    use-agents.ts       # Agent list with real-time Socket.IO updates
    use-models.ts       # Fetches available models from gateway, groups by provider
    use-pipeline.ts     # Pipeline runs
    use-events.ts       # Live event stream
    use-gateway-config.ts # Gateway config read/write
    use-tasks.ts        # Task list with filters
    use-task-logs.ts    # Task log entries
    use-memories.ts     # Memory CRUD + search
    use-traces.ts       # Trace list (10s poll) + trace detail
  store/
    agent-store.ts      # Zustand store for agents (upsert, heartbeat, effective status)
  lib/
    api.ts              # Typed REST client for all evo-king endpoints
    types.ts            # TypeScript interfaces for all API payloads
    socket.ts           # Singleton Socket.IO client
```

---

## Key Features

### Real-time Agent Monitoring

Agents are tracked via Zustand with optimistic updates. The `useAgents` hook fetches the full list on mount, polls every 30 seconds as a fallback, and receives per-agent `agent:register` and `agent:status` heartbeats over Socket.IO. Agents that miss a heartbeat for 60 seconds are shown as offline.

### Per-Agent Model Selection

Each agent card on the `/agents/` page includes a model dropdown populated dynamically from the gateway. Selecting a model calls `PUT /agents/:id/model` and applies an optimistic update to the Zustand store.

- **Agent type** (`Agent`) includes a `preferred_model` field
- **API function:** `api.setAgentModel(agentId, model)` sends a `PUT` to `/agents/:id/model`
- Models are grouped by provider in `<optgroup>` elements for easier selection

### Dynamic Model Listing from Gateway

Models are fetched from `GET /gateway/models` rather than being hardcoded. The response follows the OpenAI-compatible list format.

- **Type:** `ModelEntry` — `{ id, object, owned_by, provider, provider_type }`
  - `id` uses `provider:model` format (e.g. `openai:gpt-4o`)
  - `provider` and `provider_type` identify the gateway backend
- **API function:** `api.gatewayModels()` returns `{ object, data: ModelEntry[] }`
- **Hook:** `useModels()` — returns `{ models, byProvider, loading, refresh }`
  - `byProvider` groups models into a `Record<string, ModelEntry[]>` keyed by provider name, ready for dropdown optgroups

### Model Selector on Debug Page

The debug page (`/debug/`) provides a combined text input + dropdown for model selection when testing LLM prompts. The dropdown is populated from `useModels()` with provider grouping. Falls back to a hardcoded preset list if the gateway is unreachable.

### Model Badges on Gateway Provider Cards

The gateway page (`/gateway/`) displays model badges on each provider card. The `models` array from `ProviderConfig` is rendered as styled badges showing which models each provider exposes.

### Debug Console

Two modes:
- **LLM** — send prompts to any agent role through the gateway, with agent role and model selectors. Responses stream in real-time via `debug:stream` Socket.IO events. Task evaluations appear as inline badges.
- **Bash PTY** — run shell commands with full terminal output streamed via Socket.IO.

---

## API Client

All evo-king endpoints are wrapped in `src/lib/api.ts` as typed async functions:

| Function | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| `health()` | GET | `/health` | King health check |
| `agents()` | GET | `/agents` | List all agents |
| `setAgentModel(id, model)` | PUT | `/agents/:id/model` | Set an agent's preferred model |
| `pipelineStart(trigger?)` | POST | `/pipeline/start` | Trigger a pipeline run |
| `pipelineRuns()` | GET | `/pipeline/runs` | List pipeline runs |
| `pipelineDetail(runId)` | GET | `/pipeline/runs/:id` | Stage history for a run |
| `tasks(params?)` | GET | `/tasks` | List tasks (filterable) |
| `createTask(body)` | POST | `/tasks` | Create a new task manually |
| `taskCurrent()` | GET | `/task/current` | Get the current active task |
| `taskLogs(taskId, limit?, offset?)` | GET | `/task/:id/logs` | Fetch task logs |
| `gatewayConfig()` | GET | `/gateway/config` | Read gateway config |
| `updateGateway(config)` | PUT | `/gateway/config` | Write gateway config |
| `gatewayModels()` | GET | `/gateway/models` | List all available models from gateway |
| `configHistory()` | GET | `/config-history` | Config change history |
| `crons()` | GET | `/admin/crons` | List cron jobs |
| `runCron(name)` | POST | `/admin/crons/:name/run` | Trigger a cron |
| `configSync()` | POST | `/admin/config-sync` | Force config sync |
| `memories(params?)` | GET | `/memories` | List memories (filterable) |
| `memoryDetail(id)` | GET | `/memories/:id` | Memory detail with tiers |
| `createMemory(body)` | POST | `/memories` | Create a memory |
| `updateMemory(id, body)` | PUT | `/memories/:id` | Update a memory |
| `deleteMemory(id)` | DELETE | `/memories/:id` | Delete a memory |
| `searchMemories(body)` | POST | `/memories/search` | Full-text memory search |
| `memoryStats()` | GET | `/memories/stats` | Memory statistics |
| `memoryTiers(memoryId)` | GET | `/memories/:id/tiers` | Memory tier contents |
| `taskMemories(taskId)` | GET | `/task/:id/memories` | Memories linked to a task |
| `debugPrompt(params)` | POST | `/debug/prompt` | Send an LLM prompt via gateway |
| `debugBash(params)` | POST | `/debug/bash` | Run a bash command via PTY |
| `traces(params?)` | GET | `/traces` | List traces (filterable by service, status, min duration) |
| `traceDetail(traceId)` | GET | `/traces/:id` | Trace metadata + all spans |

---

## Tech Stack

| Dependency | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.1.6 | App Router, static export |
| React | 19.2.3 | UI |
| Tailwind CSS | 4 | Styling |
| Zustand | 5 | Agent state management |
| socket.io-client | 4.8 | Real-time Socket.IO connection to evo-king |

---

## License

MIT
