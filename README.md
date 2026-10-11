<div align="center">
  <img src="logo.svg" width="96" height="96" alt="Checklist Logo" />
  <h1>Checklist</h1>
  <p><em>An elegant, easy-to-use to-do list & mindful productivity sanctuary powered by Data Structures & Algorithms, SQLite relational storage, and production-hardened local-first architecture.</em></p>

  <p>
    <img src="https://img.shields.io/badge/SQLite-Integrated-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite Integrated" />
    <img src="https://img.shields.io/badge/PWA-Ready-6366f1?style=flat-square" alt="PWA Ready" />
    <img src="https://img.shields.io/badge/Offline-First-10b981?style=flat-square" alt="Offline First" />
    <img src="https://img.shields.io/badge/Tests-15%20Passing-success?style=flat-square" alt="Tests 15 Passing" />
    <img src="https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue?style=flat-square" alt="GitHub Actions CI/CD" />
  </p>
</div>

---

## 🗄️ SQLite Relational Database Engine

Checklist features a dual-environment SQLite relational storage engine ([db.js](db.js)):

* **Client-Side WebAssembly SQLite (`sql.js`)**: Executes genuine SQL queries directly in the browser with parameter binding.
* **Persistent SQLite Binary Storage**: Serializes the database binary state to local storage and allows exporting a raw `.sqlite` / `.db` file that can be inspected in DB Browser for SQLite, TablePlus, or the `sqlite3` CLI.
* **Built-in Node.js Engine (`node:sqlite`)**: Uses Node.js's native `DatabaseSync` for automated unit testing in CI.
* **Relational Schema & B-Tree Indexes**:
  ```sql
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL,
    energy TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    due_date TEXT,
    depends_on TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);
  CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
  CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
  CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
  ```

---

## 🧠 Under-the-Hood Algorithmic Engine

Checklist keeps all Data Structures & Algorithms running silently in the background to provide seamless, instantaneous task prioritization without cluttering the interface:

| Component | Data Structure / Algorithm | Time Complexity | Purpose |
| :--- | :--- | :--- | :--- |
| **Dependency Engine** | Directed Acyclic Graph (DAG) + Reachability DFS | $O(V + E)$ | Prevents circular dependencies and manages task locks (`🔒 Needs: [Task]`). |
| **Prerequisites First** | Kahn's Algorithm (Topological Sort) | $O(V + E)$ | Automatically sorts foundational prerequisite tasks ahead of their dependents. |
| **Urgency Scheduler** | Binary Min-Heap (Priority Queue) | $O(\log N)$ Insert/Extract | Computes composite urgency scores (priority, energy, due date) for instant $O(1)$ peek. |
| **Instant Search** | Prefix Trie (Prefix Tree) | $O(L)$ Lookup | Sub-millisecond token lookup across titles, categories, and tags. |
| **History Engine** | Command Pattern + Dual Bounded Stacks | $O(1)$ Undo/Redo | Full granular `Cmd+Z` and `Cmd+Y` state restoration up to 50 actions deep. |
| **Smart Day Planner** | 0/1 Knapsack (Dynamic Programming) | $O(N \cdot W)$ | Mathematically packs the optimal subset of tasks into 30m, 60m, 120m, or 240m focus blocks. |

---

## 🛡️ Production-Hardened Architecture

1. **Progressive Web App (PWA) & Service Worker**:
   - Installable on macOS, Windows, iOS, and Android.
   - `sw.js` implements a Stale-While-Revalidate caching strategy so Checklist loads instantly even with zero network connectivity.
2. **Data Resilience & Portability**:
   - **Download `.sqlite` Database**: Export an actual relational SQLite binary database file with a single click.
   - **Download JSON Backup**: Export human-readable JSON backup snapshots.
   - **Multi-Format Import**: Restore tasks seamlessly from either `.json`, `.sqlite`, or `.db` files.
   - **Quota & Corruption Protection**: Wraps writes with atomic try/catch blocks protecting against `QuotaExceededError`.
3. **Error Boundaries & Self-Healing Telemetry**:
   - Global `window.onerror` and `unhandledrejection` crash guards.
   - Transactional Mutation Outbox keeping an append-only event log.
4. **Synthesized Web Audio**:
   - Pop, chime, and delete sound effects synthesized natively via the Web Audio API with zero external audio assets.
   - Ambient soundscapes (*Soft Rain, Gentle Stream, White Hum*) for deep focus sessions.

---

## 🧪 Automated Test Suite

Checklist comes with a zero-dependency algorithmic & database test runner verifying all core data structures, cycle detection, topological order, knapsack packing, and SQLite queries:

```bash
# Run unit tests in terminal
node test.js
```

---

## 🚀 Quick Start & Deployment

Open `index.html` in any modern web browser:
```bash
open index.html
```

The repository includes a GitHub Actions CI/CD workflow (`.github/workflows/ci.yml`) that validates syntax, runs the test suite, and automatically publishes to GitHub Pages on every push to `main`.
