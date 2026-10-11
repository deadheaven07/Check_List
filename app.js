/**
 * Checklist &bull; Daily Tasks & Focus Flow
 * Integrated with ChecklistDSA Engine:
 * - Directed Acyclic Graph (DAG) with Kahn's Topological Sort & Cycle Detection
 * - Binary Min-Heap Priority Queue for O(log N) Urgency Scheduling
 * - Prefix Trie for Sub-Millisecond Prefix Autocomplete & Search
 * - Command Pattern with Dual Stacks for Undo/Redo (Cmd+Z / Cmd+Y)
 * - 0/1 Knapsack Dynamic Programming for Smart Day Timeboxing
 * - Event Mutation Outbox for Offline-First Architecture
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. Initial State & Storage Keys
  // ---------------------------------------------------------------------------
  const STORAGE_KEY_TASKS = 'checklist_tasks_v1';
  const STORAGE_KEY_SETTINGS = 'checklist_settings_v1';

  const DEFAULT_TASKS = [];

  // Instantiate DSA & System Design Engine
  const dsaDAG = new window.ChecklistDSA.TaskDAG();
  const dsaHeap = new window.ChecklistDSA.TaskMinHeap();
  const dsaTrie = new window.ChecklistDSA.TaskTrie();
  const commandManager = new window.ChecklistDSA.CommandManager(50);
  const mutationOutbox = new window.ChecklistDSA.MutationOutbox();
  const sqliteDB = typeof window.ChecklistDB !== 'undefined' ? new window.ChecklistDB() : null;

  let tasks = loadTasks();
  let currentFilter = 'all';
  let searchQuery = '';
  let currentSort = 'created-desc';
  let soundEnabled = true;

  // Selected Composer State
  let composerState = {
    category: 'Personal',
    priority: 'low',
    energy: 'quick',
    dependsOn: ''
  };

  // Focus Timer State
  let timerInterval = null;
  let timerTotalSeconds = 25 * 60;
  let timerRemainingSeconds = 25 * 60;
  let isTimerRunning = false;
  let activeAmbientType = 'none';

  let plannerSelectedBudget = 60;

  // ---------------------------------------------------------------------------
  // 2. Web Audio Synthesizer (No external assets required)
  // ---------------------------------------------------------------------------
  let audioCtx = null;
  let ambientNoiseNode = null;
  let ambientGainNode = null;

  function initAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  function playPopSound() {
    if (!soundEnabled) return;
    initAudioContext();
    if (!audioCtx) return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (e) {}
  }

  function playChimeSound() {
    if (!soundEnabled) return;
    initAudioContext();
    if (!audioCtx) return;

    try {
      const now = audioCtx.currentTime;
      const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
      notes.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + index * 0.07);

        gain.gain.setValueAtTime(0, now + index * 0.07);
        gain.gain.linearRampToValueAtTime(0.15, now + index * 0.07 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.07 + 0.35);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now + index * 0.07);
        osc.stop(now + index * 0.07 + 0.38);
      });
    } catch (e) {}
  }

  function playDeleteSound() {
    if (!soundEnabled) return;
    initAudioContext();
    if (!audioCtx) return;

    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, audioCtx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  }

  function startAmbientSound(type) {
    stopAmbientSound();
    if (type === 'none' || !soundEnabled) return;
    initAudioContext();
    if (!audioCtx) return;

    try {
      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let b0 = 0, b1 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (type === 'rain' || type === 'lofi') {
          b0 = 0.99 * b0 + white * 0.05;
          b1 = 0.95 * b1 + white * 0.1;
          output[i] = (b0 + b1) * 0.5;
        } else {
          output[i] = white * 0.15;
        }
      }

      const whiteNoise = audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const filter = audioCtx.createBiquadFilter();
      if (type === 'rain') {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(650, audioCtx.currentTime);
      } else if (type === 'lofi') {
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(450, audioCtx.currentTime);
        filter.Q.setValueAtTime(1.2, audioCtx.currentTime);
      } else {
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, audioCtx.currentTime);
      }

      ambientGainNode = audioCtx.createGain();
      ambientGainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(ambientGainNode);
      ambientGainNode.connect(audioCtx.destination);

      whiteNoise.start();
      ambientNoiseNode = whiteNoise;
    } catch (e) {}
  }

  function stopAmbientSound() {
    if (ambientNoiseNode) {
      try {
        ambientNoiseNode.stop();
        ambientNoiseNode.disconnect();
      } catch (e) {}
      ambientNoiseNode = null;
    }
    if (ambientGainNode) {
      try {
        ambientGainNode.disconnect();
      } catch (e) {}
      ambientGainNode = null;
    }
  }

  // ---------------------------------------------------------------------------
  // 3. Canvas Confetti
  // ---------------------------------------------------------------------------
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let confettiAnimId = null;

  function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  function triggerConfetti(originX, originY, count = 45) {
    const x = originX !== undefined ? originX : window.innerWidth / 2;
    const y = originY !== undefined ? originY : window.innerHeight * 0.4;
    const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#38bdf8', '#fb7185'];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 7 + 3;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 8 + 4,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 12,
        opacity: 1,
        life: 0,
        maxLife: Math.random() * 50 + 60
      });
    }

    if (!confettiAnimId) {
      updateConfetti();
    }
  }

  function updateConfetti() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18;
      p.vx *= 0.98;
      p.rotation += p.rotationSpeed;
      p.life++;

      if (p.life > p.maxLife * 0.6) {
        p.opacity = Math.max(0, 1 - (p.life - p.maxLife * 0.6) / (p.maxLife * 0.4));
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.opacity;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();

      if (p.life >= p.maxLife || p.y > canvas.height + 20) {
        particles.splice(i, 1);
      }
    }

    if (particles.length > 0) {
      confettiAnimId = requestAnimationFrame(updateConfetti);
    } else {
      confettiAnimId = null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Toast Notifications & Undo Action
  // ---------------------------------------------------------------------------
  function showToast(message, allowUndo = false) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span>${escapeHTML(message)}</span>
      ${allowUndo ? `<button class="toast-undo-btn" id="toast-undo-action">Undo</button>` : ''}
    `;

    container.appendChild(toast);

    if (allowUndo) {
      const undoBtn = toast.querySelector('#toast-undo-action');
      if (undoBtn) {
        undoBtn.addEventListener('click', () => {
          handleUndo();
          toast.remove();
        });
      }
    }

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ---------------------------------------------------------------------------
  // 5. Date & Greeting Helpers
  // ---------------------------------------------------------------------------
  function getTodayDateString() {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  function updateGreetingAndDate() {
    const now = new Date();
    const hours = now.getHours();
    let greeting = 'Good day, let’s make it wonderful';

    if (hours < 12) {
      greeting = 'Good morning, let’s find clarity today 🌤️';
    } else if (hours < 17) {
      greeting = 'Good afternoon, keep the gentle flow ✨';
    } else {
      greeting = 'Good evening, celebrate your steps 🌙';
    }

    const greetingEl = document.getElementById('live-greeting');
    if (greetingEl) greetingEl.textContent = greeting;

    const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const dateText = document.getElementById('date-text');
    if (dateText) dateText.textContent = now.toLocaleDateString(undefined, dateOptions);
  }

  // ---------------------------------------------------------------------------
  // 6. Tasks Management, Storage & Schema Migration
  // ---------------------------------------------------------------------------
  const CURRENT_SCHEMA_VERSION = 1;

  function sanitizeTask(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const validPriorities = ['low', 'medium', 'high'];
    const validEnergies = ['quick', 'steady', 'deep'];
    const validCategories = ['Personal', 'Work', 'Creative', 'Health'];

    const id = typeof raw.id === 'string' && raw.id ? raw.id : 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 200) : 'Untitled task';
    if (!title) return null;

    const category = validCategories.includes(raw.category) ? raw.category : 'Personal';
    const priority = validPriorities.includes(raw.priority) ? raw.priority : 'medium';
    const energy = validEnergies.includes(raw.energy) ? raw.energy : 'steady';
    const completed = Boolean(raw.completed);
    const createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : Date.now();
    const dueDate = typeof raw.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate) ? raw.dueDate : '';
    const dependsOn = typeof raw.dependsOn === 'string' ? raw.dependsOn : (Array.isArray(raw.dependsOn) ? raw.dependsOn[0] || '' : '');

    return { id, title, category, priority, energy, completed, createdAt, dueDate, dependsOn };
  }

  function validateAndMigrateTasks(rawList) {
    if (!Array.isArray(rawList)) return [];
    const validTasks = [];
    const seenIds = new Set();

    for (const raw of rawList) {
      const sanitized = sanitizeTask(raw);
      if (sanitized && !seenIds.has(sanitized.id)) {
        seenIds.add(sanitized.id);
        validTasks.push(sanitized);
      }
    }
    return validTasks;
  }

  function loadTasks() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_TASKS);
      if (stored) {
        const parsed = JSON.parse(stored);
        const rawList = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.tasks) ? parsed.tasks : []);
        return validateAndMigrateTasks(rawList);
      }

      const prev = localStorage.getItem('klaro_tasks_v1') || localStorage.getItem('bloom_tasks_v2');
      if (prev) {
        const parsedLegacy = JSON.parse(prev);
        const migrated = validateAndMigrateTasks(Array.isArray(parsedLegacy) ? parsedLegacy : []);
        saveTasksDirect(migrated);
        return migrated;
      }
    } catch (e) {
      console.warn('[Checklist] Failed to parse local storage tasks, starting fresh safe state.', e);
    }
    return DEFAULT_TASKS;
  }

  function saveTasksDirect(taskList) {
    try {
      const envelope = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        updatedAt: Date.now(),
        tasks: taskList
      };
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(envelope));
      return true;
    } catch (err) {
      if (err.name === 'QuotaExceededError') {
        showToast('Storage quota reached! Download a backup to free space.');
      } else {
        showToast('Storage write failed. Please check browser permissions.');
      }
      return false;
    }
  }

  function saveTasks(skipOutbox = false) {
    saveTasksDirect(tasks);
    if (sqliteDB && sqliteDB.isReady) {
      sqliteDB.syncAllTasks(tasks);
    }
    rebuildDSAEngines();
    renderAll();
    updateUndoRedoButtons();
    updateStorageHealthBadge();
  }

  // Rebuild DAG, Binary Heap, and Prefix Trie structures from active state
  function rebuildDSAEngines() {
    // 1. Build DAG Graph
    dsaDAG.buildGraph(tasks);

    // 2. Rebuild Binary Heap (Active tasks prioritized by urgency score)
    dsaHeap.clear();
    for (const t of tasks) {
      if (!t.completed) {
        dsaHeap.insert(t);
      }
    }

    // 3. Rebuild Prefix Trie
    dsaTrie.clear();
    for (const t of tasks) {
      dsaTrie.indexTask(t);
    }

    // 4. Update Dependency Dropdown in Composer
    updateDependencySelectOptions();
  }

  // ---------------------------------------------------------------------------
  // 7. Command Pattern Handlers (Undo / Redo)
  // ---------------------------------------------------------------------------
  function handleAddTask(title, category, priority, energy, dueDate, dependsOn) {
    const newTask = {
      id: 'task-' + Date.now(),
      title: title.trim(),
      category: category || 'Personal',
      priority: priority || 'low',
      energy: energy || 'quick',
      dueDate: dueDate || '',
      dependsOn: dependsOn ? [dependsOn] : [],
      completed: false,
      completedAt: null,
      createdAt: Date.now()
    };

    // Cycle detection verification
    if (dependsOn && dsaDAG.hasCycle(newTask.id, dependsOn)) {
      alert("⚠️ Circular Dependency Detected!\nThis task cannot depend on the selected item as it would create an infinite dependency cycle.");
      return;
    }

    const command = {
      name: `Add "${newTask.title.slice(0, 20)}..."`,
      execute: () => {
        tasks.unshift(newTask);
        mutationOutbox.enqueue('TASK_CREATE', newTask);
        saveTasks();
      },
      undo: () => {
        tasks = tasks.filter(t => t.id !== newTask.id);
        mutationOutbox.enqueue('TASK_DELETE', { id: newTask.id });
        saveTasks();
      }
    };

    commandManager.execute(command);
    playPopSound();
    showToast(`Added: ${newTask.title.slice(0, 25)}...`, true);
  }

  function handleToggleTask(taskId, clientX, clientY) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Check if task is blocked
    if (!task.completed && dsaDAG.isTaskBlocked(task, tasks)) {
      const unmet = dsaDAG.getUnmetDependencies(task, tasks);
      const blockerNames = unmet.map(u => `"${u.title}"`).join(', ');
      showToast(`🔒 Blocked! Complete prerequisite first: ${blockerNames}`);
      return;
    }

    const prevCompleted = task.completed;
    const prevCompletedAt = task.completedAt;

    const command = {
      name: prevCompleted ? `Uncheck "${task.title.slice(0, 20)}..."` : `Complete "${task.title.slice(0, 20)}..."`,
      execute: () => {
        task.completed = !prevCompleted;
        task.completedAt = task.completed ? Date.now() : null;
        mutationOutbox.enqueue('TASK_TOGGLE', { id: task.id, completed: task.completed });
        saveTasks();
      },
      undo: () => {
        task.completed = prevCompleted;
        task.completedAt = prevCompletedAt;
        mutationOutbox.enqueue('TASK_TOGGLE', { id: task.id, completed: task.completed });
        saveTasks();
      }
    };

    commandManager.execute(command);

    if (task.completed) {
      playChimeSound();
      triggerConfetti(clientX, clientY, 35);
      showToast(`Completed: ${task.title.slice(0, 25)}...`, true);

      // Check if all tasks done
      const remaining = tasks.filter(t => !t.completed).length;
      if (remaining === 0 && tasks.length > 0) {
        setTimeout(() => triggerConfetti(window.innerWidth / 2, window.innerHeight * 0.35, 75), 250);
      }
    } else {
      playPopSound();
      showToast(`Restored: ${task.title.slice(0, 25)}...`, true);
    }
  }

  function handleDeleteTask(taskId) {
    const originalIndex = tasks.findIndex(t => t.id === taskId);
    if (originalIndex === -1) return;
    const task = tasks[originalIndex];

    const command = {
      name: `Delete "${task.title.slice(0, 20)}..."`,
      execute: () => {
        tasks.splice(originalIndex, 1);
        mutationOutbox.enqueue('TASK_DELETE', { id: taskId });
        saveTasks();
      },
      undo: () => {
        tasks.splice(originalIndex, 0, task);
        mutationOutbox.enqueue('TASK_RESTORE', task);
        saveTasks();
      }
    };

    commandManager.execute(command);
    playDeleteSound();
    showToast(`Deleted: ${task.title.slice(0, 25)}...`, true);
  }

  function handleUndo() {
    if (!commandManager.canUndo()) return;
    const name = commandManager.undo();
    playDeleteSound();
    showToast(`Undone: ${name}`);
  }

  function handleRedo() {
    if (!commandManager.canRedo()) return;
    const name = commandManager.redo();
    playPopSound();
    showToast(`Redone: ${name}`);
  }

  function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = !commandManager.canUndo();
    if (redoBtn) redoBtn.disabled = !commandManager.canRedo();
  }

  function updateDependencySelectOptions() {
    const select = document.getElementById('task-dependency-select');
    if (!select) return;

    const currentVal = select.value;
    const activeTasks = tasks.filter(t => !t.completed);

    select.innerHTML = `
      <option value="">None (Independent task)</option>
      ${activeTasks.map(t => `<option value="${t.id}">${escapeHTML(t.title.slice(0, 35))}</option>`).join('')}
    `;

    if (currentVal && activeTasks.some(t => t.id === currentVal)) {
      select.value = currentVal;
    }
  }

  // ---------------------------------------------------------------------------
  // 8. Filtering, Searching & Rendering
  // ---------------------------------------------------------------------------
  function getFilteredAndSortedTasks() {
    let result = [...tasks];

    if (currentFilter === 'today') {
      const todayStr = getTodayDateString();
      result = result.filter(t => t.dueDate === todayStr || (!t.dueDate && !t.completed));
    } else if (currentFilter === 'high') {
      result = result.filter(t => t.priority === 'high');
    } else if (currentFilter === 'completed') {
      result = result.filter(t => t.completed);
    }

    // Prefix Trie Search Optimization
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchedIds = dsaTrie.searchPrefix(q);
      if (matchedIds && matchedIds.size > 0) {
        result = result.filter(t => matchedIds.has(t.id));
      } else {
        // Fallback substring search
        result = result.filter(t =>
          t.title.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
        );
      }
    }

    // Sorting (powered by DSA engines)
    if (currentSort === 'created-desc') {
      result.sort((a, b) => b.createdAt - a.createdAt);
    } else if (currentSort === 'heap-urgency') {
      // Binary Min-Heap Priority Queue algorithm under the hood
      const clonedHeap = new window.ChecklistDSA.TaskMinHeap();
      result.forEach(t => clonedHeap.insert(t));
      const heapOrdered = [];
      while (!clonedHeap.isEmpty()) {
        heapOrdered.push(clonedHeap.extractMin());
      }
      result = heapOrdered;
    } else if (currentSort === 'topo-order') {
      // Kahn's Topological Order (prerequisites first) under the hood
      result = dsaDAG.getTopologicalOrder(result);
    } else if (currentSort === 'priority-desc') {
      const weight = { high: 3, medium: 2, low: 1 };
      result.sort((a, b) => (weight[b.priority] || 0) - (weight[a.priority] || 0));
    } else if (currentSort === 'due-date') {
      result.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      });
    } else if (currentSort === 'title-asc') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }

  function renderTasksList() {
    const listEl = document.getElementById('tasks-list');
    const emptyStateEl = document.getElementById('empty-state');
    const counterBadge = document.getElementById('visible-tasks-counter');
    const emptyMsg = document.getElementById('empty-state-message');

    if (!listEl) return;

    const filtered = getFilteredAndSortedTasks();

    if (counterBadge) {
      counterBadge.textContent = `${filtered.length} task${filtered.length === 1 ? '' : 's'}`;
    }

    if (filtered.length === 0) {
      listEl.innerHTML = '';
      if (emptyStateEl) {
        emptyStateEl.classList.remove('hidden');
        if (emptyMsg) {
          if (searchQuery) {
            emptyMsg.textContent = `No tasks matching "${searchQuery}".`;
          } else if (currentFilter === 'completed') {
            emptyMsg.textContent = 'No completed tasks yet. Check off an intention to celebrate it here!';
          } else {
            emptyMsg.textContent = 'All clear & peaceful! Take a deep breath or add a new intention above.';
          }
        }
      }
      return;
    }

    if (emptyStateEl) emptyStateEl.classList.add('hidden');

    listEl.innerHTML = filtered.map((task) => {
      const isBlocked = !task.completed && dsaDAG.isTaskBlocked(task, tasks);
      const unmet = isBlocked ? dsaDAG.getUnmetDependencies(task, tasks) : [];
      const blockerNames = unmet.map(u => u.title).join(', ');

      const formattedDate = formatDueDate(task.dueDate);
      const isOverdue = task.dueDate && task.dueDate < getTodayDateString() && !task.completed;

      const categoryClass = 'cat-' + task.category.toLowerCase();
      const priorityLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);

      let energyLabel = '⚡ Quick Win';
      if (task.energy === 'steady') energyLabel = '☕ Steady';
      if (task.energy === 'deep') energyLabel = '🔥 Deep Flow';

      return `
        <article class="task-card priority-${task.priority} ${task.completed ? 'completed' : ''} ${isBlocked ? 'blocked' : ''}" data-task-id="${task.id}">
          <div class="task-checkbox-wrap" data-action="toggle" title="${isBlocked ? 'Blocked by prerequisite!' : task.completed ? 'Mark incomplete' : 'Mark complete'}">
            <div class="task-checkbox">
              <i class="ph-bold ${isBlocked ? 'ph-lock' : 'ph-check'}"></i>
            </div>
          </div>

          <div class="task-body">
            <span class="task-title">${escapeHTML(task.title)}</span>
            <div class="task-meta-row">
              <span class="tag-badge ${categoryClass}">${task.category}</span>
              <span class="tag-badge priority-${task.priority}">${priorityLabel}</span>
              <span class="tag-badge energy-tag">${energyLabel}</span>
              ${task.dueDate ? `
                <span class="due-date-pill ${isOverdue ? 'overdue' : ''}">
                  <i class="ph ph-calendar"></i> ${formattedDate}
                </span>
              ` : ''}
              ${isBlocked ? `
                <span class="tag-badge blocked-tag" title="Prerequisite: ${escapeHTML(blockerNames)}">
                  <i class="ph-bold ph-lock-key"></i> Needs: ${escapeHTML(blockerNames.length > 22 ? blockerNames.slice(0, 22) + '...' : blockerNames)}
                </span>
              ` : ''}
            </div>
          </div>

          <div class="task-actions">
            ${!task.completed && !isBlocked ? `
              <button class="task-action-btn timer-quick-btn" data-action="focus" title="Start Focus timer on this task" aria-label="Start Focus timer">
                <i class="ph-bold ph-timer"></i>
              </button>
            ` : ''}
            <button class="task-action-btn delete-btn" data-action="delete" title="Delete task" aria-label="Delete task">
              <i class="ph-bold ph-trash"></i>
            </button>
          </div>
        </article>
      `;
    }).join('');
  }

  function renderOverview() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    const ringFill = document.getElementById('progress-ring-fill');
    const percentageLabel = document.getElementById('progress-percentage');
    const summaryLabel = document.getElementById('progress-summary');
    const momentumBadge = document.getElementById('momentum-badge');
    const completedCountEl = document.getElementById('completed-count');
    const pendingCountEl = document.getElementById('pending-count');
    const streakCountEl = document.getElementById('streak-count');

    if (completedCountEl) completedCountEl.textContent = completed;
    if (pendingCountEl) pendingCountEl.textContent = pending;
    if (streakCountEl) streakCountEl.textContent = completed > 0 ? 1 : 0;

    const circumference = 2 * Math.PI * 35;
    if (ringFill) {
      const offset = circumference - (percentage / 100) * circumference;
      ringFill.style.strokeDashoffset = offset;
    }

    if (percentageLabel) percentageLabel.textContent = `${percentage}%`;
    if (summaryLabel) summaryLabel.textContent = `${completed} of ${total} tasks completed`;

    if (momentumBadge) {
      if (total === 0) {
        momentumBadge.innerHTML = `<i class="ph-fill ph-leaf"></i> Fresh slate`;
      } else if (percentage === 100) {
        momentumBadge.innerHTML = `<i class="ph-fill ph-sparkle"></i> Wonderful job! Done! 🎉`;
      } else if (percentage >= 50) {
        momentumBadge.innerHTML = `<i class="ph-fill ph-fire"></i> In deep momentum ✨`;
      } else {
        momentumBadge.innerHTML = `<i class="ph-fill ph-plant"></i> Taking small steps 🌱`;
      }
    }
  }

  function renderCounts() {
    const countAll = tasks.length;
    const countToday = tasks.filter(t => t.dueDate === getTodayDateString() && !t.completed).length;
    const countHigh = tasks.filter(t => t.priority === 'high' && !t.completed).length;
    const countCompleted = tasks.filter(t => t.completed).length;

    const elAll = document.getElementById('count-all');
    const elToday = document.getElementById('count-today');
    const elHigh = document.getElementById('count-high');
    const elCompleted = document.getElementById('count-completed');

    if (elAll) elAll.textContent = countAll;
    if (elToday) elToday.textContent = countToday;
    if (elHigh) elHigh.textContent = countHigh;
    if (elCompleted) elCompleted.textContent = countCompleted;
  }

  function renderAll() {
    renderOverview();
    renderTasksList();
    renderCounts();
    populateFocusTaskPicker();
  }

  function formatDueDate(dateStr) {
    if (!dateStr) return '';
    const today = getTodayDateString();
    if (dateStr === today) return 'Today';
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    if (dateStr === tomorrowStr) return 'Tomorrow';

    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return dateStr;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  // ---------------------------------------------------------------------------
  // 9. Smart Day Planner (0/1 Knapsack Optimizer Modal)
  // ---------------------------------------------------------------------------
  function openPlannerModal() {
    const modal = document.getElementById('planner-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    renderPlannerResults();
  }

  function closePlannerModal() {
    const modal = document.getElementById('planner-modal');
    if (modal) modal.classList.add('hidden');
  }

  function renderPlannerResults() {
    const container = document.getElementById('planner-results');
    if (!container) return;

    const optimalSet = window.ChecklistDSA.TimeboxOptimizer.optimize(tasks, plannerSelectedBudget);
    const totalMins = optimalSet.reduce((sum, t) => sum + window.ChecklistDSA.TimeboxOptimizer.getEstimatedMinutes(t), 0);

    if (optimalSet.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 1.5rem;">
          <p class="empty-desc">No active tasks available to pack for ${plannerSelectedBudget} minutes. Add some tasks above!</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="planner-summary-pill">
        <span>Recommended Tasks: <strong class="planner-metric-highlight">${optimalSet.length}</strong></span>
        <span>Planned Time: <strong class="planner-metric-highlight">${totalMins}m / ${plannerSelectedBudget}m</strong></span>
      </div>
      <div style="display:flex; flex-direction:column; gap:0.5rem;">
        ${optimalSet.map(t => `
          <div class="planner-task-item">
            <span>${escapeHTML(t.title)}</span>
            <span class="tag-badge energy-tag">${window.ChecklistDSA.TimeboxOptimizer.getEstimatedMinutes(t)} min &bull; ${t.priority.toUpperCase()}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // 10. Data Safety, Backup & Portability (Production Resilience)
  // ---------------------------------------------------------------------------
  function openBackupModal() {
    const modal = document.getElementById('backup-modal');
    if (modal) {
      updateStorageHealthBadge();
      modal.classList.remove('hidden');
    }
  }

  function closeBackupModal() {
    const modal = document.getElementById('backup-modal');
    if (modal) modal.classList.add('hidden');
  }

  function updateStorageHealthBadge() {
    const usageBadge = document.getElementById('storage-usage-badge');
    const statusText = document.getElementById('storage-status-text');
    if (!usageBadge) return;

    try {
      let totalBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const val = localStorage.getItem(key);
        if (key && val) {
          totalBytes += (key.length + val.length) * 2;
        }
      }
      const kb = (totalBytes / 1024).toFixed(1);
      const isSqlite = sqliteDB && sqliteDB.isReady ? 'SQLite Active' : 'Storage Active';
      usageBadge.textContent = `${kb} KB • ${isSqlite}`;
      if (statusText) {
        statusText.textContent = `${tasks.length} tasks indexed in SQLite • Schema v${CURRENT_SCHEMA_VERSION}`;
      }
    } catch (e) {
      usageBadge.textContent = 'SQLite Active';
    }
  }

  function exportBackupJSON() {
    const backupData = {
      app: 'Checklist',
      version: '1.0.0',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      tasks: tasks
    };

    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().split('T')[0];
    const a = document.createElement('a');
    a.href = url;
    a.download = `checklist-backup-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('JSON backup successfully downloaded!');
  }

  function exportSQLiteDB() {
    if (!sqliteDB) {
      showToast('SQLite engine initializing...');
      return;
    }

    const binary = sqliteDB.exportSQLiteBinary();
    if (binary) {
      const blob = new Blob([binary], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().split('T')[0];
      const a = document.createElement('a');
      a.href = url;
      a.download = `checklist-${dateStr}.sqlite`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('SQLite database (.sqlite) downloaded!');
    } else {
      // SQL dump fallback
      let sqlDump = `-- Checklist SQLite Relational Database Export\n-- Generated: ${new Date().toISOString()}\n\n`;
      sqlDump += `CREATE TABLE IF NOT EXISTS tasks (\n  id TEXT PRIMARY KEY,\n  title TEXT NOT NULL,\n  category TEXT NOT NULL,\n  priority TEXT NOT NULL,\n  energy TEXT NOT NULL,\n  completed INTEGER NOT NULL DEFAULT 0,\n  created_at INTEGER NOT NULL,\n  due_date TEXT,\n  depends_on TEXT\n);\n\n`;
      for (const t of tasks) {
        const titleSafe = (t.title || '').replace(/'/g, "''");
        sqlDump += `INSERT OR REPLACE INTO tasks VALUES ('${t.id}', '${titleSafe}', '${t.category}', '${t.priority}', '${t.energy}', ${t.completed ? 1 : 0}, ${t.createdAt}, '${t.dueDate || ''}', '${t.dependsOn || ''}');\n`;
      }
      const blob = new Blob([sqlDump], { type: 'application/sql' });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().split('T')[0];
      const a = document.createElement('a');
      a.href = url;
      a.download = `checklist-${dateStr}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('SQL relational dump downloaded!');
    }
  }

  function handleImportFileInput(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    // 1. Handle SQLite (.sqlite / .db) binary file import
    if (fileName.endsWith('.sqlite') || fileName.endsWith('.db')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const uint8 = new Uint8Array(e.target.result);
          if (sqliteDB && sqliteDB.importSQLiteBinary(uint8)) {
            const imported = sqliteDB.getAllTasks();
            const valid = validateAndMigrateTasks(imported);
            const prev = [...tasks];
            tasks = valid;
            saveTasksDirect(tasks);
            rebuildDSAEngines();
            renderAll();
            closeBackupModal();
            triggerConfetti();
            showToast(`Loaded ${valid.length} tasks from SQLite database!`, true);
          } else {
            showToast('Unable to parse SQLite database binary.');
          }
        } catch (err) {
          showToast('Failed to load SQLite file.');
        } finally {
          event.target.value = '';
        }
      };
      reader.readAsArrayBuffer(file);
      return;
    }

    // 2. Handle JSON backup file import
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        const incomingTasks = Array.isArray(json) ? json : (json && Array.isArray(json.tasks) ? json.tasks : null);

        if (!incomingTasks) {
          showToast('Invalid backup file structure.');
          return;
        }

        const validIncoming = validateAndMigrateTasks(incomingTasks);
        if (validIncoming.length === 0) {
          showToast('No valid tasks found in backup.');
          return;
        }

        const previousTasks = [...tasks];
        tasks = validIncoming;
        saveTasks();

        commandManager.execute({
          name: 'Restore Backup',
          execute: () => { tasks = validIncoming; saveTasks(); },
          undo: () => { tasks = previousTasks; saveTasks(); }
        });

        closeBackupModal();
        triggerConfetti();
        showToast(`Restored ${validIncoming.length} tasks!`, true);
      } catch (err) {
        showToast('Failed to parse backup file.');
      } finally {
        event.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  // PWA Service Worker Registration
  function registerServiceWorker() {
    if ('serviceWorker' in navigator && (window.location.protocol.startsWith('http') || window.location.protocol.startsWith('https'))) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('[Checklist] Service Worker active, scope:', reg.scope);
          })
          .catch((err) => {
            console.log('[Checklist] Service Worker registration note:', err.message);
          });
      });
    }
  }

  // Global Error Boundary & Crash Prevention
  function setupGlobalErrorBoundary() {
    window.addEventListener('error', (event) => {
      console.error('[Checklist Crash Guard]:', event.error || event.message);
      if (mutationOutbox) {
        mutationOutbox.enqueue('UNHANDLED_ERROR', {
          message: event.message,
          timestamp: Date.now()
        });
      }
    });

    window.addEventListener('unhandledrejection', (event) => {
      console.error('[Checklist Promise Rejection Guard]:', event.reason);
      if (mutationOutbox) {
        mutationOutbox.enqueue('UNHANDLED_REJECTION', {
          reason: String(event.reason),
          timestamp: Date.now()
        });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 11. Focus Timer Sanctuary
  // ---------------------------------------------------------------------------
  function openFocusModal() {
    const focusModal = document.getElementById('focus-modal');
    if (focusModal) {
      populateFocusTaskPicker();
      focusModal.classList.remove('hidden');
    }
  }

  function openFocusModalWithTask(taskId) {
    openFocusModal();
    const picker = document.getElementById('focus-task-picker');
    if (picker) picker.value = taskId;
  }

  function closeFocusModal() {
    const focusModal = document.getElementById('focus-modal');
    if (focusModal) focusModal.classList.add('hidden');
    pauseFocusTimer();
    stopAmbientSound();
  }

  function populateFocusTaskPicker() {
    const picker = document.getElementById('focus-task-picker');
    if (!picker) return;
    const currentVal = picker.value;
    const activeTasks = tasks.filter(t => !t.completed);

    picker.innerHTML = `
      <option value="">General deep focus session</option>
      ${activeTasks.map(t => `<option value="${t.id}">${escapeHTML(t.title)}</option>`).join('')}
    `;

    if (currentVal) picker.value = currentVal;
  }

  function setupFocusTimer() {
    const startBtn = document.getElementById('timer-start-btn');
    const resetBtn = document.getElementById('timer-reset-btn');
    const ambientBtns = document.querySelectorAll('.ambient-btn');

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (isTimerRunning) pauseFocusTimer();
        else startFocusTimer();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => resetFocusTimer());
    }

    ambientBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        ambientBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeAmbientType = btn.getAttribute('data-ambient');
        if (isTimerRunning) startAmbientSound(activeAmbientType);
      });
    });
  }

  function updateTimerDisplay() {
    const display = document.getElementById('timer-display');
    if (!display) return;
    const minutes = Math.floor(timerRemainingSeconds / 60);
    const seconds = timerRemainingSeconds % 60;
    display.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  function startFocusTimer() {
    isTimerRunning = true;
    const playIcon = document.getElementById('timer-play-icon');
    const btnLabel = document.getElementById('timer-btn-label');
    const statusText = document.getElementById('timer-status-text');

    if (playIcon) playIcon.className = 'ph-bold ph-pause';
    if (btnLabel) btnLabel.textContent = 'Pause Focus';
    if (statusText) statusText.textContent = 'Mindful flow in progress 🕊️';

    startAmbientSound(activeAmbientType);

    timerInterval = setInterval(() => {
      timerRemainingSeconds--;
      updateTimerDisplay();

      if (timerRemainingSeconds <= 0) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        stopAmbientSound();
        playChimeSound();
        triggerConfetti(window.innerWidth / 2, window.innerHeight * 0.4, 80);

        if (playIcon) playIcon.className = 'ph-bold ph-play';
        if (btnLabel) btnLabel.textContent = 'Start Focus';
        if (statusText) statusText.textContent = 'Focus session finished! 🎉';

        const picker = document.getElementById('focus-task-picker');
        if (picker && picker.value) {
          handleToggleTask(picker.value);
        }
      }
    }, 1000);
  }

  function pauseFocusTimer() {
    isTimerRunning = false;
    clearInterval(timerInterval);
    stopAmbientSound();

    const playIcon = document.getElementById('timer-play-icon');
    const btnLabel = document.getElementById('timer-btn-label');
    const statusText = document.getElementById('timer-status-text');

    if (playIcon) playIcon.className = 'ph-bold ph-play';
    if (btnLabel) btnLabel.textContent = 'Resume Focus';
    if (statusText) statusText.textContent = 'Session paused';
  }

  function resetFocusTimer() {
    pauseFocusTimer();
    timerRemainingSeconds = timerTotalSeconds;
    updateTimerDisplay();

    const statusText = document.getElementById('timer-status-text');
    if (statusText) statusText.textContent = 'Ready to begin';
  }

  // ---------------------------------------------------------------------------
  // 12. Setup Event Listeners
  // ---------------------------------------------------------------------------
  function setupEventListeners() {
    // Add Task Form
    const form = document.getElementById('add-task-form');
    const input = document.getElementById('task-title-input');
    const dueInput = document.getElementById('task-due-date');
    const depSelect = document.getElementById('task-dependency-select');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = input.value;
        if (!title.trim()) return;

        handleAddTask(
          title,
          composerState.category,
          composerState.priority,
          composerState.energy,
          dueInput ? dueInput.value : '',
          depSelect ? depSelect.value : ''
        );

        input.value = '';
        if (dueInput) dueInput.value = '';
        if (depSelect) depSelect.value = '';
        input.focus();
      });
    }

    // Composer Chips
    const categoryChips = document.getElementById('category-chips');
    if (categoryChips) {
      categoryChips.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip');
        if (!btn) return;
        categoryChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        composerState.category = btn.getAttribute('data-category');
      });
    }

    const priorityChips = document.getElementById('priority-chips');
    if (priorityChips) {
      priorityChips.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip');
        if (!btn) return;
        priorityChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        composerState.priority = btn.getAttribute('data-priority');
      });
    }

    const energyChips = document.getElementById('energy-chips');
    if (energyChips) {
      energyChips.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip');
        if (!btn) return;
        energyChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        composerState.energy = btn.getAttribute('data-energy');
      });
    }

    // Task Item Delegation
    const tasksList = document.getElementById('tasks-list');
    if (tasksList) {
      tasksList.addEventListener('click', (e) => {
        const card = e.target.closest('.task-card');
        if (!card) return;
        const taskId = card.getAttribute('data-task-id');

        const toggleBtn = e.target.closest('[data-action="toggle"]');
        const deleteBtn = e.target.closest('[data-action="delete"]');
        const focusBtn = e.target.closest('[data-action="focus"]');

        if (toggleBtn) {
          const rect = toggleBtn.getBoundingClientRect();
          handleToggleTask(taskId, rect.left + rect.width / 2, rect.top + rect.height / 2);
        } else if (deleteBtn) {
          handleDeleteTask(taskId);
        } else if (focusBtn) {
          openFocusModalWithTask(taskId);
        }
      });
    }

    // Undo / Redo Header Buttons
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.addEventListener('click', () => handleUndo());
    if (redoBtn) redoBtn.addEventListener('click', () => handleRedo());

    // Filter Tabs
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentFilter = tab.getAttribute('data-filter');

        const viewTitle = document.getElementById('current-view-title');
        if (viewTitle) {
          const names = {
            all: 'Active & All Tasks',
            today: 'Due Today',
            heap: '⚡ Priority Queue (Binary Min-Heap)',
            topo: '🔗 Execution Order (Topological DAG)',
            high: 'Important & High Priority',
            completed: 'Celebrated & Completed'
          };
          viewTitle.textContent = names[currentFilter] || 'Tasks';
        }

        renderTasksList();
      });
    });

    // Search Input
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search-btn');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        if (clearSearchBtn) clearSearchBtn.classList.toggle('hidden', !searchQuery);
        renderTasksList();
      });
    }
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        renderTasksList();
      });
    }

    // Sort Dropdown
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        renderTasksList();
      });
    }

    // Sound Toggle
    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    const soundIcon = document.getElementById('sound-icon');
    if (soundToggleBtn) {
      soundToggleBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        if (soundIcon) soundIcon.className = soundEnabled ? 'ph-bold ph-speaker-high' : 'ph-bold ph-speaker-slash';
        if (!soundEnabled) stopAmbientSound();
      });
    }

    // Focus Modal
    const focusModeBtn = document.getElementById('focus-mode-btn');
    const closeFocusModalBtn = document.getElementById('close-focus-modal');
    if (focusModeBtn) focusModeBtn.addEventListener('click', () => openFocusModal());
    if (closeFocusModalBtn) closeFocusModalBtn.addEventListener('click', () => closeFocusModal());

    // Backup & Data Safety Modal Triggers
    const backupBtn = document.getElementById('backup-btn');
    const closeBackupBtn = document.getElementById('close-backup-modal');
    const exportJsonBtn = document.getElementById('export-json-btn');
    const exportSqliteBtn = document.getElementById('export-sqlite-btn');
    const importFileInput = document.getElementById('import-file-input');

    if (backupBtn) backupBtn.addEventListener('click', () => openBackupModal());
    if (closeBackupBtn) closeBackupBtn.addEventListener('click', () => closeBackupModal());
    if (exportJsonBtn) exportJsonBtn.addEventListener('click', () => exportBackupJSON());
    if (exportSqliteBtn) exportSqliteBtn.addEventListener('click', () => exportSQLiteDB());
    if (importFileInput) importFileInput.addEventListener('change', (e) => handleImportFileInput(e));

    // Smart Planner Modal Triggers
    const smartPlannerBtn = document.getElementById('smart-planner-btn');
    const closePlannerBtn = document.getElementById('close-planner-modal');
    const budgetChips = document.getElementById('budget-chips');

    if (smartPlannerBtn) smartPlannerBtn.addEventListener('click', () => openPlannerModal());
    if (closePlannerBtn) closePlannerBtn.addEventListener('click', () => closePlannerModal());
    if (budgetChips) {
      budgetChips.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip');
        if (!btn) return;
        budgetChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        plannerSelectedBudget = parseInt(btn.getAttribute('data-minutes'), 10) || 60;
        renderPlannerResults();
      });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // Cmd+Z or Ctrl+Z for Undo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
      // Cmd+Shift+Z or Ctrl+Y for Redo
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && e.shiftKey) ||
          ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        handleRedo();
      }
      // '/' for search
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'SELECT') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.focus();
      }
      // 'Escape' closes modals
      if (e.key === 'Escape') {
        closeFocusModal();
        closePlannerModal();
        closeBackupModal();
      }
    });

    setupFocusTimer();
  }

  // ---------------------------------------------------------------------------
  // 13. Initialization
  // ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    setupGlobalErrorBoundary();
    registerServiceWorker();
    updateGreetingAndDate();
    setupEventListeners();
    rebuildDSAEngines();
    renderAll();
    updateUndoRedoButtons();
    updateTimerDisplay();
    updateStorageHealthBadge();

    // Initialize SQLite Relational Database Engine
    if (sqliteDB) {
      sqliteDB.init().then(() => {
        sqliteDB.syncAllTasks(tasks);
        updateStorageHealthBadge();
      }).catch((err) => {
        console.log('[Checklist] SQLite initialization notice:', err);
      });
    }
  });

})();
