<div align="center">
  <img src="logo.svg" width="96" height="96" alt="Checklist Logo" />
  <h1>Checklist</h1>
  <p><em>An elegant, easy-to-use to-do list & mindful productivity engine powered by Data Structures & Algorithms (DSA) and Local-First System Design.</em></p>
</div>

---

## 🧠 Data Structures & Algorithms (DSA) Engine

Checklist is designed not just as a basic to-do list, but as a showcase of algorithmic task scheduling:

| Component | Data Structure / Algorithm | Time Complexity | Purpose |
| :--- | :--- | :--- | :--- |
| **Dependency Engine** | Directed Acyclic Graph (DAG) + 3-Color DFS | $O(V + E)$ | Detects cycles and tracks prerequisite blockers. |
| **Execution Order** | Kahn's Algorithm (Topological Sort) | $O(V + E)$ | Derives the exact prerequisite execution chain. |
| **Urgency Scheduler** | Binary Min-Heap (Priority Queue) | $O(\log N)$ Insert/Extract | Instant $O(1)$ peek at the next most urgent task. |
| **Instant Search** | Prefix Trie (Prefix Tree) | $O(L)$ Lookup | Sub-millisecond token lookup across titles & tags. |
| **History Engine** | Command Pattern + Dual Bounded Stacks | $O(1)$ Undo/Redo | Full granular `Cmd+Z` and `Cmd+Y` state restoration. |
| **Smart Day Planner** | 0/1 Knapsack (Dynamic Programming) | $O(N \cdot W)$ | Mathematically packs the optimal task bundle for a focus block. |

---

## 🏗️ System Design & Architecture

- **Event Mutation Outbox Pattern**: Every action produces an event mutation record with idempotency keys and timestamps for resilient event-driven syncing.
- **Local-First & Offline Resilience**: Instant optimistic UI updates with zero loading lag, backed by browser persistence.
- **Synthesized Web Audio**: Audio effects generated entirely mathematically using the Web Audio API without network roundtrips.
- **Live DSA Inspector**: An in-app visualizer allowing you to inspect live graph nodes, binary heap arrays, Trie branches, and outbox logs in real time.

---

## ✨ UI & Aesthetics
- **Radiant Light Palette**: Soft warm cream canvas with ambient radial pastel blurs (*lavender, soft rose, mint*).
- **Luminous Frosted Cards**: Glassmorphism with tactile hover motion.
- **Mindful Focus Sanctuary**: Built-in 25-minute Pomodoro timer with soothing synthesized ambient soundscapes (*Rain, Gentle Stream, White Hum*).

---

## 🚀 Quick Start
Simply open `index.html` in any web browser, or run:
```bash
open index.html
```
