/**
 * Checklist &bull; Data Structures & Algorithms (DSA) Engine
 * 
 * 1. MinHeap (Priority Queue) - O(log N) dynamic task scheduling
 * 2. TaskGraph (DAG) - Cycle detection via 3-color DFS & Kahn's Topological Sort
 * 3. PrefixTrie - O(L) prefix autocomplete and fast multi-keyword indexing
 * 4. CommandManager - Command pattern with dual bounded stacks for Undo/Redo (Cmd+Z)
 * 5. TimeboxOptimizer - Greedy & 0/1 Knapsack DP for optimal daily schedule packing
 * 6. MutationOutbox - Event-driven sync queue with idempotency keys & offline buffering
 */

// ============================================================================
// 1. Priority Queue / Binary Min-Heap
// ============================================================================
class TaskMinHeap {
  constructor() {
    this.heap = [];
  }

  // Calculate composite urgency score (lower score = higher priority / more urgent)
  static calculateUrgencyScore(task) {
    const priorityWeights = { high: 10, medium: 20, low: 30 };
    const energyWeights = { quick: 5, steady: 15, deep: 25 };
    
    let base = priorityWeights[task.priority] || 20;
    let energy = energyWeights[task.energy] || 15;

    // Due date factor: tasks due sooner or overdue get lower score (higher urgency)
    let dueFactor = 50;
    if (task.dueDate) {
      const today = new Date().toISOString().split('T')[0];
      const diffDays = Math.ceil((new Date(task.dueDate) - new Date(today)) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        dueFactor = -50; // Overdue: highest possible priority
      } else if (diffDays === 0) {
        dueFactor = 0; // Due today
      } else {
        dueFactor = Math.min(diffDays * 5, 80);
      }
    }

    return base + energy + dueFactor;
  }

  size() {
    return this.heap.length;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  peek() {
    return this.heap.length > 0 ? this.heap[0].task : null;
  }

  insert(task) {
    const score = TaskMinHeap.calculateUrgencyScore(task);
    const node = { task, score };
    this.heap.push(node);
    this._bubbleUp(this.heap.length - 1);
  }

  extractMin() {
    if (this.isEmpty()) return null;
    const min = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this._sinkDown(0);
    }
    return min.task;
  }

  clear() {
    this.heap = [];
  }

  _bubbleUp(index) {
    while (index > 0) {
      const parentIdx = Math.floor((index - 1) / 2);
      if (this.heap[index].score >= this.heap[parentIdx].score) break;
      [this.heap[index], this.heap[parentIdx]] = [this.heap[parentIdx], this.heap[index]];
      index = parentIdx;
    }
  }

  _sinkDown(index) {
    const length = this.heap.length;
    while (true) {
      let smallest = index;
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;

      if (leftChild < length && this.heap[leftChild].score < this.heap[smallest].score) {
        smallest = leftChild;
      }
      if (rightChild < length && this.heap[rightChild].score < this.heap[smallest].score) {
        smallest = rightChild;
      }
      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }

  toArray() {
    return [...this.heap];
  }
}

// ============================================================================
// 2. Directed Acyclic Graph (DAG) & Topological Sort
// ============================================================================
class TaskDAG {
  constructor() {
    // adjList: taskId -> Set of taskIds that DEPEND on this task
    this.adjList = new Map();
    // inDegree: taskId -> count of prerequisites that must be completed first
    this.inDegree = new Map();
    // dependencies: taskId -> Set of prerequisite taskIds this task depends on
    this.dependencies = new Map();
  }

  buildGraph(tasks) {
    this.adjList.clear();
    this.inDegree.clear();
    this.dependencies.clear();

    const taskIds = new Set(tasks.map(t => t.id));

    // Initialize maps
    for (const id of taskIds) {
      this.adjList.set(id, new Set());
      this.inDegree.set(id, 0);
      this.dependencies.set(id, new Set());
    }

    // Populate edges
    for (const task of tasks) {
      if (Array.isArray(task.dependsOn)) {
        for (const depId of task.dependsOn) {
          if (taskIds.has(depId)) {
            this.adjList.get(depId).add(task.id);
            this.inDegree.set(task.id, (this.inDegree.get(task.id) || 0) + 1);
            this.dependencies.get(task.id).add(depId);
          }
        }
      }
    }
  }

  // Detect cycle using 3-color DFS (WHITE=0, GRAY=1, BLACK=2)
  hasCycle(candidateTaskId, prerequisiteId) {
    // Tentatively check if adding edge: prerequisiteId -> candidateTaskId creates a cycle
    const visited = new Map(); // 0 = unvisited, 1 = visiting (in recursion stack), 2 = visited

    for (const id of this.adjList.keys()) {
      visited.set(id, 0);
    }
    visited.set(candidateTaskId, 0);
    visited.set(prerequisiteId, 0);

    const hasCycleDFS = (u) => {
      visited.set(u, 1);
      const neighbors = new Set(this.adjList.get(u) || []);
      if (u === prerequisiteId) {
        neighbors.add(candidateTaskId);
      }

      for (const v of neighbors) {
        const state = visited.get(v) || 0;
        if (state === 1) return true; // Back-edge detected -> Cycle!
        if (state === 0 && hasCycleDFS(v)) return true;
      }
      visited.set(u, 2);
      return false;
    };

    return hasCycleDFS(candidateTaskId);
  }

  // Kahn's Algorithm for Topological Sort
  getTopologicalOrder(tasks) {
    this.buildGraph(tasks);
    const inDegrees = new Map(this.inDegree);
    const queue = [];
    const ordered = [];

    // Find all nodes with 0 prerequisites
    for (const [id, deg] of inDegrees.entries()) {
      if (deg === 0) queue.push(id);
    }

    while (queue.length > 0) {
      const u = queue.shift();
      ordered.push(u);

      for (const v of (this.adjList.get(u) || [])) {
        inDegrees.set(v, inDegrees.get(v) - 1);
        if (inDegrees.get(v) === 0) {
          queue.push(v);
        }
      }
    }

    const taskMap = new Map(tasks.map(t => [t.id, t]));
    return ordered.map(id => taskMap.get(id)).filter(Boolean);
  }

  // Check if a task is currently blocked by incomplete prerequisites
  isTaskBlocked(task, allTasks) {
    if (!task.dependsOn || task.dependsOn.length === 0) return false;
    const taskMap = new Map(allTasks.map(t => [t.id, t]));

    for (const depId of task.dependsOn) {
      const dep = taskMap.get(depId);
      if (dep && !dep.completed) {
        return true; // Blocked by incomplete prerequisite
      }
    }
    return false;
  }

  getUnmetDependencies(task, allTasks) {
    if (!task.dependsOn || task.dependsOn.length === 0) return [];
    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    return task.dependsOn
      .map(id => taskMap.get(id))
      .filter(t => t && !t.completed);
  }
}

// ============================================================================
// 3. Prefix Trie for Sub-Millisecond Search
// ============================================================================
class TrieNode {
  constructor() {
    this.children = new Map();
    this.taskIds = new Set();
  }
}

class TaskTrie {
  constructor() {
    this.root = new TrieNode();
  }

  clear() {
    this.root = new TrieNode();
  }

  insert(word, taskId) {
    const cleanWord = word.toLowerCase().trim();
    if (!cleanWord) return;

    let current = this.root;
    current.taskIds.add(taskId);

    for (const char of cleanWord) {
      if (!current.children.has(char)) {
        current.children.set(char, new TrieNode());
      }
      current = current.children.get(char);
      current.taskIds.add(taskId);
    }
  }

  indexTask(task) {
    // Index individual words in task title
    const tokens = task.title.toLowerCase().split(/[\s,._\-#]+/);
    for (const token of tokens) {
      if (token.length > 0) {
        this.insert(token, task.id);
      }
    }
    // Also index category and priority
    if (task.category) this.insert(task.category.toLowerCase(), task.id);
    if (task.priority) this.insert(task.priority.toLowerCase(), task.id);
  }

  searchPrefix(prefix) {
    const cleanPrefix = prefix.toLowerCase().trim();
    if (!cleanPrefix) return null;

    let current = this.root;
    for (const char of cleanPrefix) {
      if (!current.children.has(char)) {
        return new Set(); // No matches
      }
      current = current.children.get(char);
    }
    return current.taskIds;
  }
}

// ============================================================================
// 4. Command Pattern for Undo / Redo Stacks (Cmd+Z / Cmd+Y)
// ============================================================================
class CommandManager {
  constructor(maxHistory = 50) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = maxHistory;
  }

  execute(command) {
    command.execute();
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift(); // Evict oldest
    }
    this.redoStack = []; // Clear redo branch on new action
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    if (!this.canUndo()) return null;
    const command = this.undoStack.pop();
    command.undo();
    this.redoStack.push(command);
    return command.name;
  }

  redo() {
    if (!this.canRedo()) return null;
    const command = this.redoStack.pop();
    command.execute();
    this.undoStack.push(command);
    return command.name;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

// ============================================================================
// 5. Timebox Optimizer (0/1 Knapsack & Greedy Interval Allocation)
// ============================================================================
class TimeboxOptimizer {
  static getEstimatedMinutes(task) {
    const estimateMap = { quick: 15, steady: 30, deep: 60 };
    return estimateMap[task.energy] || 30;
  }

  static getTaskValue(task) {
    const priorityValue = { high: 100, medium: 50, low: 20 };
    let val = priorityValue[task.priority] || 20;
    if (task.dueDate) {
      const today = new Date().toISOString().split('T')[0];
      if (task.dueDate <= today) val += 80;
    }
    return val;
  }

  /**
   * 0/1 Knapsack Dynamic Programming
   * Select subset of actionable tasks to maximize value within availableMinutes.
   */
  static optimize(tasks, availableMinutes) {
    const actionable = tasks.filter(t => !t.completed);
    if (actionable.length === 0 || availableMinutes <= 0) return [];

    const n = actionable.length;
    const weights = actionable.map(t => this.getEstimatedMinutes(t));
    const values = actionable.map(t => this.getTaskValue(t));

    // DP table: (n + 1) x (availableMinutes + 1)
    const dp = Array.from({ length: n + 1 }, () => new Int32Array(availableMinutes + 1));

    for (let i = 1; i <= n; i++) {
      const w = weights[i - 1];
      const v = values[i - 1];
      for (let j = 0; j <= availableMinutes; j++) {
        if (w <= j) {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i - 1][j - w] + v);
        } else {
          dp[i][j] = dp[i - 1][j];
        }
      }
    }

    // Backtrack to find chosen tasks
    let res = [];
    let w = availableMinutes;
    for (let i = n; i > 0 && w > 0; i--) {
      if (dp[i][w] !== dp[i - 1][w]) {
        res.push(actionable[i - 1]);
        w -= weights[i - 1];
      }
    }

    return res.reverse();
  }
}

// ============================================================================
// 6. Mutation Outbox (Event-Driven Offline Architecture)
// ============================================================================
class MutationOutbox {
  constructor(storageKey = 'checklist_outbox_v1') {
    this.storageKey = storageKey;
    this.queue = this.loadQueue();
    this.listeners = [];
  }

  loadQueue() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  saveQueue() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch (e) {}
    this.notify();
  }

  subscribe(callback) {
    this.listeners.push(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      cb(this.queue);
    }
  }

  enqueue(actionType, payload) {
    const mutation = {
      id: 'mut_' + Math.random().toString(36).substr(2, 9),
      type: actionType,
      payload,
      timestamp: Date.now(),
      status: 'synced_local'
    };
    this.queue.push(mutation);
    // Keep max 100 historical event records
    if (this.queue.length > 100) this.queue.shift();
    this.saveQueue();
    return mutation;
  }

  getEntries() {
    return [...this.queue];
  }

  clear() {
    this.queue = [];
    this.saveQueue();
  }
}

// Export as globally accessible engine for browser execution
window.ChecklistDSA = {
  TaskMinHeap,
  TaskDAG,
  TaskTrie,
  CommandManager,
  TimeboxOptimizer,
  MutationOutbox
};
