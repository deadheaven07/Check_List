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

  // Active DSA Inspector Tab
  let activeDsaTab = 'dag';
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
  // 6. Tasks Management & Storage
  // ---------------------------------------------------------------------------
  function loadTasks() {
    try {
      const data = localStorage.getItem(STORAGE_KEY_TASKS);
      if (data) return JSON.parse(data);

      const prevKlaro = localStorage.getItem('klaro_tasks_v1') || localStorage.getItem('bloom_tasks_v2');
      if (prevKlaro) {
        const parsed = JSON.parse(prevKlaro);
        localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(parsed));
        return parsed;
      }
    } catch (e) {}
    return DEFAULT_TASKS;
  }

  function saveTasks(skipOutbox = false) {
    try {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    } catch (e) {}
    rebuildDSAEngines();
    renderAll();
    updateUndoRedoButtons();
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

    // DSA Custom Filters
    if (currentFilter === 'heap') {
      // Order directly by binary min-heap urgency score
      const clonedHeap = new window.ChecklistDSA.TaskMinHeap();
      tasks.filter(t => !t.completed).forEach(t => clonedHeap.insert(t));
      const heapOrdered = [];
      while (!clonedHeap.isEmpty()) {
        heapOrdered.push(clonedHeap.extractMin());
      }
      return heapOrdered;
    }

    if (currentFilter === 'topo') {
      // Order by Kahn's Topological Sort algorithm (prerequisites first)
      const topoList = dsaDAG.getTopologicalOrder(tasks.filter(t => !t.completed));
      return topoList;
    }

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

    // Sorting
    if (currentSort === 'created-desc') {
      result.sort((a, b) => b.createdAt - a.createdAt);
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
          } else if (currentFilter === 'heap') {
            emptyMsg.textContent = 'Min-Heap queue is empty! Add active tasks to schedule them.';
          } else if (currentFilter === 'topo') {
            emptyMsg.textContent = 'No dependency chains active.';
          } else {
            emptyMsg.textContent = 'All clear & peaceful! Take a deep breath or add a new intention above.';
          }
        }
      }
      return;
    }

    if (emptyStateEl) emptyStateEl.classList.add('hidden');

    listEl.innerHTML = filtered.map((task, index) => {
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

      // Urgency Score for Heap Queue view
      const urgencyScore = window.ChecklistDSA.TaskMinHeap.calculateUrgencyScore(task);

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
                  <i class="ph-bold ph-lock-key"></i> Needs: ${escapeHTML(blockerNames.slice(0, 20))}...
                </span>
              ` : ''}
              ${currentFilter === 'heap' ? `
                <span class="tag-badge heap-score-badge">Rank #${index + 1} (Score: ${urgencyScore})</span>
              ` : ''}
              ${currentFilter === 'topo' ? `
                <span class="tag-badge topo-order-badge">Step #${index + 1} in DAG</span>
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
    const totalVal = optimalSet.reduce((sum, t) => sum + window.ChecklistDSA.TimeboxOptimizer.getTaskValue(t), 0);

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
        <span>Optimal Bundle: <strong class="planner-metric-highlight">${optimalSet.length} tasks</strong></span>
        <span>Allocated: <strong class="planner-metric-highlight">${totalMins}m / ${plannerSelectedBudget}m</strong></span>
        <span>Value Score: <strong class="planner-metric-highlight">${totalVal} pts</strong></span>
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
  // 10. DSA & System Design Inspector Modal
  // ---------------------------------------------------------------------------
  function openDSAInspectorModal() {
    const modal = document.getElementById('dsa-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    renderDSAInspectorTab();
  }

  function closeDSAInspectorModal() {
    const modal = document.getElementById('dsa-modal');
    if (modal) modal.classList.add('hidden');
  }

  function renderDSAInspectorTab() {
    const container = document.getElementById('dsa-tab-content');
    if (!container) return;

    if (activeDsaTab === 'dag') {
      const topo = dsaDAG.getTopologicalOrder(tasks);
      container.innerHTML = `
        <div class="dsa-card-block">
          <div class="dsa-card-header">
            <span class="dsa-card-title"><i class="ph ph-git-merge"></i> Dependency Graph (DAG)</span>
            <span class="dsa-badge-complexity">O(V + E) Kahn's Algorithm</span>
          </div>
          <p style="font-size: 0.85rem; color: #64748b;">
            Adjacency list tracking ${dsaDAG.adjList.size} nodes. 3-Color DFS cycle detection prevents circular loops.
          </p>
          <div class="dsa-tree-view">
            <strong>Kahn's Topological Order:</strong>
            ${topo.length > 0 
              ? topo.map((t, idx) => `<div>${idx + 1}. <span class="dsa-node-pill">${escapeHTML(t.title)} (In-Degree: ${dsaDAG.inDegree.get(t.id) || 0})</span></div>`).join('')
              : '<span style="color:#94a3b8;">No tasks in graph yet.</span>'}
          </div>
        </div>
      `;
    } else if (activeDsaTab === 'heap') {
      const heapArray = dsaHeap.toArray();
      const root = dsaHeap.peek();
      container.innerHTML = `
        <div class="dsa-card-block">
          <div class="dsa-card-header">
            <span class="dsa-card-title"><i class="ph ph-trend-down"></i> Binary Min-Heap Priority Queue</span>
            <span class="dsa-badge-complexity">O(log N) Insert & Extract</span>
          </div>
          <p style="font-size: 0.85rem; color: #64748b;">
            Calculates composite urgency score based on Priority, Due Date, and Energy. Smallest score sits at root index [0].
          </p>
          <div style="font-size: 0.88rem; padding: 0.5rem; background: #f8fafc; border-radius: 8px;">
            <strong>Heap Root (Peek - Next Urgent):</strong> 
            ${root ? `<span>${escapeHTML(root.title)} (Score: ${window.ChecklistDSA.TaskMinHeap.calculateUrgencyScore(root)})</span>` : '<span style="color:#94a3b8;">Empty heap</span>'}
          </div>
          <div class="dsa-tree-view">
            <strong>Internal Heap Array Representation:</strong>
            ${heapArray.length > 0 
              ? heapArray.map((node, i) => `<div>[${i}] Score: ${node.score} &bull; ${escapeHTML(node.task.title.slice(0, 30))}...</div>`).join('')
              : '<span style="color:#94a3b8;">Heap currently has 0 active elements.</span>'}
          </div>
        </div>
      `;
    } else if (activeDsaTab === 'trie') {
      container.innerHTML = `
        <div class="dsa-card-block">
          <div class="dsa-card-header">
            <span class="dsa-card-title"><i class="ph ph-magnifying-glass"></i> Prefix Trie Index</span>
            <span class="dsa-badge-complexity">O(L) Sub-millisecond Lookup</span>
          </div>
          <p style="font-size: 0.85rem; color: #64748b;">
            Indexes tokens across all task titles, categories, and tags. Searches match instantaneously regardless of task volume.
          </p>
          <div style="display:flex; flex-direction:column; gap:0.5rem;">
            <label style="font-size:0.8rem; font-weight:700; color:#64748b;">Interactive Trie Prefix Tester:</label>
            <input type="text" id="trie-test-input" placeholder="Type a prefix (e.g., 'pla', 'des', 'wo')..." class="custom-select" style="width:100%;">
            <div id="trie-test-results" style="font-family:monospace; font-size:0.84rem; padding:0.6rem; background:#f8fafc; border-radius:6px; min-height:40px;">
              Enter a prefix to query the Trie node branch.
            </div>
          </div>
        </div>
      `;

      const input = document.getElementById('trie-test-input');
      const results = document.getElementById('trie-test-results');
      if (input && results) {
        input.addEventListener('input', (e) => {
          const val = e.target.value.trim().toLowerCase();
          if (!val) {
            results.textContent = 'Enter a prefix to query the Trie node branch.';
            return;
          }
          const matched = dsaTrie.searchPrefix(val);
          if (!matched || matched.size === 0) {
            results.textContent = `0 tasks match prefix "${val}"`;
          } else {
            const taskList = tasks.filter(t => matched.has(t.id));
            results.innerHTML = `Found ${matched.size} matches: <br>` + taskList.map(t => `&bull; ${escapeHTML(t.title)}`).join('<br>');
          }
        });
      }
    } else if (activeDsaTab === 'outbox') {
      const entries = mutationOutbox.getEntries();
      container.innerHTML = `
        <div class="dsa-card-block">
          <div class="dsa-card-header">
            <span class="dsa-card-title"><i class="ph ph-database"></i> Event-Driven Mutation Outbox & Stacks</span>
            <span class="dsa-badge-complexity">Outbox Pattern & Undo Stacks</span>
          </div>
          <div style="display:flex; gap:1rem; margin-bottom: 0.5rem;">
            <div style="padding:0.5rem 0.8rem; background:#f8fafc; border-radius:8px; font-size:0.82rem;">
              Undo Stack Depth: <strong>${commandManager.undoStack.length} / 50</strong>
            </div>
            <div style="padding:0.5rem 0.8rem; background:#f8fafc; border-radius:8px; font-size:0.82rem;">
              Redo Stack Depth: <strong>${commandManager.redoStack.length}</strong>
            </div>
          </div>
          <table class="dsa-table">
            <thead>
              <tr><th>Mutation ID</th><th>Event Type</th><th>Timestamp</th><th>Status</th></tr>
            </thead>
            <tbody>
              ${entries.slice(-8).reverse().map(e => `
                <tr>
                  <td><code>${e.id}</code></td>
                  <td><strong>${e.type}</strong></td>
                  <td>${new Date(e.timestamp).toLocaleTimeString()}</td>
                  <td><span class="pill-badge" style="background:#ecfdf5; color:#047857; font-size:0.7rem;">Synced</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
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

    // DSA Inspector Modal Triggers
    const dsaInspectorBtn = document.getElementById('dsa-inspector-btn');
    const closeDsaBtn = document.getElementById('close-dsa-modal');
    const dsaTabsNav = document.querySelector('.dsa-tabs-nav');

    if (dsaInspectorBtn) dsaInspectorBtn.addEventListener('click', () => openDSAInspectorModal());
    if (closeDsaBtn) closeDsaBtn.addEventListener('click', () => closeDSAInspectorModal());
    if (dsaTabsNav) {
      dsaTabsNav.addEventListener('click', (e) => {
        const btn = e.target.closest('.dsa-tab-btn');
        if (!btn) return;
        dsaTabsNav.querySelectorAll('.dsa-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeDsaTab = btn.getAttribute('data-dsa-tab');
        renderDSAInspectorTab();
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
        closeDSAInspectorModal();
      }
    });

    setupFocusTimer();
  }

  // ---------------------------------------------------------------------------
  // 13. Initialization
  // ---------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', () => {
    updateGreetingAndDate();
    setupEventListeners();
    rebuildDSAEngines();
    renderAll();
    updateUndoRedoButtons();
    updateTimerDisplay();
  });

})();
