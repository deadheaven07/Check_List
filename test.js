/**
 * Checklist &bull; Automated Algorithmic & Resiliency Unit Test Suite
 * Zero external dependencies - executable in Node.js via: node test.js
 */

const assert = require('assert');
const {
  TaskMinHeap,
  TaskDAG,
  TaskTrie,
  CommandManager,
  TimeboxOptimizer,
  MutationOutbox
} = require('./dsa.js');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  \x1b[31m✖\x1b[0m ${name}`);
    console.error(`    \x1b[33mError: ${err.message}\x1b[0m`);
    failedTests++;
  }
}

console.log('\n\x1b[1m\x1b[36m=== Checklist Production Test Suite ===\x1b[0m\n');

// ============================================================================
// 1. TaskMinHeap (Priority Queue) Tests
// ============================================================================
console.log('\x1b[1m[1. TaskMinHeap Priority Queue]\x1b[0m');

test('should initialize empty and report correct size', () => {
  const heap = new TaskMinHeap();
  assert.strictEqual(heap.size(), 0);
  assert.strictEqual(heap.isEmpty(), true);
  assert.strictEqual(heap.peek(), null);
  assert.strictEqual(heap.extractMin(), null);
});

test('should compute lower urgency scores for higher priorities', () => {
  const highTask = { id: '1', priority: 'high', energy: 'quick' };
  const lowTask = { id: '2', priority: 'low', energy: 'quick' };
  const highUrgency = TaskMinHeap.calculateUrgencyScore(highTask);
  const lowUrgency = TaskMinHeap.calculateUrgencyScore(lowTask);
  assert.ok(highUrgency < lowUrgency, 'High priority must have lower numerical score than low priority');
});

test('should extract tasks in monotonic ascending urgency order (highest urgency first)', () => {
  const heap = new TaskMinHeap();
  const t1 = { id: 'low', title: 'Low priority', priority: 'low', energy: 'deep' };
  const t2 = { id: 'high', title: 'High priority', priority: 'high', energy: 'quick' };
  const t3 = { id: 'med', title: 'Med priority', priority: 'medium', energy: 'steady' };

  heap.insert(t1);
  heap.insert(t2);
  heap.insert(t3);

  assert.strictEqual(heap.size(), 3);
  assert.strictEqual(heap.peek().id, 'high');

  const first = heap.extractMin();
  const second = heap.extractMin();
  const third = heap.extractMin();

  assert.strictEqual(first.id, 'high');
  assert.strictEqual(second.id, 'med');
  assert.strictEqual(third.id, 'low');
  assert.strictEqual(heap.isEmpty(), true);
});

// ============================================================================
// 2. TaskDAG (Topological Sorting & Cycle Detection) Tests
// ============================================================================
console.log('\n\x1b[1m[2. TaskDAG & Kahn\'s Algorithm]\x1b[0m');

test('should order prerequisite before dependent in topological sort', () => {
  const dag = new TaskDAG();
  const tasks = [
    { id: 't2', title: 'Deploy App', dependsOn: 't1', completed: false },
    { id: 't1', title: 'Build Project', dependsOn: null, completed: false }
  ];

  dag.buildGraph(tasks);
  const topo = dag.getTopologicalOrder(tasks);

  assert.strictEqual(topo.length, 2);
  assert.strictEqual(topo[0].id, 't1', 'Prerequisite t1 must appear before t2');
  assert.strictEqual(topo[1].id, 't2', 'Dependent t2 must appear after t1');
});

test('should detect circular dependency cycles (A -> B -> A)', () => {
  const dag = new TaskDAG();
  const tasks = [
    { id: 'a', title: 'Task A', dependsOn: 'b', completed: false },
    { id: 'b', title: 'Task B', dependsOn: null, completed: false }
  ];

  dag.buildGraph(tasks);
  // Trying to set b.dependsOn = 'a' would create cycle a -> b -> a
  const hasCycle = dag.hasCycle('b', 'a');
  assert.strictEqual(hasCycle, true, 'Circular dependency must be caught');
});

test('should identify blocked status when prerequisite is incomplete', () => {
  const dag = new TaskDAG();
  const taskPrereq = { id: 'p1', title: 'Design system', completed: false };
  const taskDependent = { id: 'd1', title: 'Code CSS', dependsOn: 'p1', completed: false };
  const allTasks = [taskPrereq, taskDependent];

  dag.buildGraph(allTasks);
  assert.strictEqual(dag.isTaskBlocked(taskDependent, allTasks), true);

  // Mark prerequisite completed
  taskPrereq.completed = true;
  dag.buildGraph(allTasks);
  assert.strictEqual(dag.isTaskBlocked(taskDependent, allTasks), false);
});

// ============================================================================
// 3. TaskTrie (Prefix Indexing) Tests
// ============================================================================
console.log('\n\x1b[1m[3. TaskTrie Prefix Indexing]\x1b[0m');

test('should match tasks by title prefix and category prefix', () => {
  const trie = new TaskTrie();
  const taskA = { id: 'ta', title: 'Setup Database Migration', category: 'Work' };
  const taskB = { id: 'tb', title: 'Design Glassmorphism Theme', category: 'Creative' };

  trie.indexTask(taskA);
  trie.indexTask(taskB);

  const setDb = trie.searchPrefix('data');
  assert.ok(setDb.has('ta'));
  assert.strictEqual(setDb.has('tb'), false);

  const setDes = trie.searchPrefix('desi');
  assert.ok(setDes.has('tb'));

  const setWork = trie.searchPrefix('wor');
  assert.ok(setWork.has('ta'));

  const setEmpty = trie.searchPrefix('xyz123');
  assert.strictEqual(setEmpty.size, 0);
});

// ============================================================================
// 4. TimeboxOptimizer (0/1 Knapsack DP) Tests
// ============================================================================
console.log('\n\x1b[1m[4. TimeboxOptimizer 0/1 Knapsack]\x1b[0m');

test('should return empty set when budget is 0 or all tasks completed', () => {
  const tasks = [{ id: '1', title: 'Done task', energy: 'quick', completed: true }];
  const res = TimeboxOptimizer.optimize(tasks, 30);
  assert.strictEqual(res.length, 0);
});

test('should pack tasks within budget constraint without exceeding minutes', () => {
  const tasks = [
    { id: '1', title: 'Quick task', energy: 'quick', priority: 'high', completed: false }, // 5 min
    { id: '2', title: 'Steady task', energy: 'steady', priority: 'medium', completed: false }, // 25 min
    { id: '3', title: 'Deep task', energy: 'deep', priority: 'low', completed: false } // 50 min
  ];

  const budget = 30; // 30 minutes
  const bundle = TimeboxOptimizer.optimize(tasks, budget);
  const totalMins = bundle.reduce((acc, t) => acc + TimeboxOptimizer.getEstimatedMinutes(t), 0);

  assert.ok(totalMins <= budget, `Allocated time (${totalMins}m) must not exceed budget (${budget}m)`);
  assert.strictEqual(bundle.length, 2, 'Should pick quick (5m) and steady (25m) totaling 30m');
});

// ============================================================================
// 5. CommandManager (Dual-Stack Undo / Redo) Tests
// ============================================================================
console.log('\n\x1b[1m[5. CommandManager Undo/Redo Stacks]\x1b[0m');

test('should execute, undo, and redo command state correctly', () => {
  const mgr = new CommandManager(10);
  let counter = 0;

  const cmd = {
    execute: () => { counter += 1; },
    undo: () => { counter -= 1; },
    description: 'Increment'
  };

  mgr.execute(cmd);
  assert.strictEqual(counter, 1);
  assert.strictEqual(mgr.canUndo(), true);
  assert.strictEqual(mgr.canRedo(), false);

  mgr.undo();
  assert.strictEqual(counter, 0);
  assert.strictEqual(mgr.canUndo(), false);
  assert.strictEqual(mgr.canRedo(), true);

  mgr.redo();
  assert.strictEqual(counter, 1);
  assert.strictEqual(mgr.canUndo(), true);
  assert.strictEqual(mgr.canRedo(), false);
});

test('should respect max stack depth limit', () => {
  const mgr = new CommandManager(3);
  for (let i = 0; i < 5; i++) {
    mgr.execute({
      execute: () => {},
      undo: () => {},
      description: `Action ${i}`
    });
  }
  assert.strictEqual(mgr.undoStack.length, 3, 'Undo stack must not exceed maxDepth (3)');
});

// ============================================================================
// 6. MutationOutbox Event Sync Tests
// ============================================================================
console.log('\n\x1b[1m[6. MutationOutbox Offline Event Queue]\x1b[0m');

test('should record mutations and maintain historical buffer', () => {
  const outbox = new MutationOutbox('test_outbox');
  outbox.clear();
  assert.strictEqual(outbox.getEntries().length, 0);

  const entry = outbox.enqueue('TASK_CREATED', { id: 't1', title: 'Test' });
  assert.strictEqual(entry.type, 'TASK_CREATED');
  assert.strictEqual(outbox.getEntries().length, 1);

  outbox.clear();
  assert.strictEqual(outbox.getEntries().length, 0);
});

// ============================================================================
// Test Suite Summary
// ============================================================================
console.log('\n----------------------------------------');
if (failedTests === 0) {
  console.log(`\x1b[32m✔ All ${passedTests} production tests passed successfully!\x1b[0m\n`);
  process.exit(0);
} else {
  console.error(`\x1b[31m✖ ${failedTests} test(s) failed. (${passedTests} passed)\x1b[0m\n`);
  process.exit(1);
}
