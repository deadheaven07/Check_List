<div align="center">
  <img src="logo.svg" width="96" height="96" alt="Checklist Logo" />
  <h1>Checklist</h1>
  <p><em>An elegant, easy-to-use to-do list & mindful productivity sanctuary powered by Data Structures & Algorithms under the hood and production-hardened local-first architecture.</em></p>

  <p>
    <img src="https://img.shields.io/badge/PWA-Ready-6366f1?style=flat-square" alt="PWA Ready" />
    <img src="https://img.shields.io/badge/Offline-First-10b981?style=flat-square" alt="Offline First" />
    <img src="https://img.shields.io/badge/Tests-12%20Passing-success?style=flat-square" alt="Tests 12 Passing" />
    <img src="https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-blue?style=flat-square" alt="GitHub Actions CI/CD" />
  </p>
</div>

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
2. **Data Resilience & Zero Data Loss**:
   - **Schema Versioning & Migrations (`schemaVersion: 1`)**: Safely parses and normalizes user task objects without wiping data across updates.
   - **Quota & Corruption Protection**: Wraps writes with atomic try/catch blocks protecting against `QuotaExceededError` and sandbox restrictions.
   - **Data Portability**: Integrated Export & Restore allowing one-click download and restore of encrypted local JSON backups.
3. **Error Boundaries & Self-Healing Telemetry**:
   - Global `window.onerror` and `unhandledrejection` crash guards.
   - Transactional Mutation Outbox keeping an append-only event log.
4. **Synthesized Web Audio**:
   - Pop, chime, and delete sound effects synthesized natively via the Web Audio API with zero external audio assets.
   - Ambient soundscapes (*Soft Rain, Gentle Stream, White Hum*) for deep focus sessions.

---

## 🧪 Automated Test Suite

Checklist comes with a zero-dependency algorithmic test runner verifying all core data structures, cycle detection, topological order, and knapsack packing:

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
