/**
 * Checklist &bull; Daily Tasks & Focus Flow
 * Interactive Logic, Web Audio Soundscapes, Confetti Particle System & Local Storage
 */

(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // 1. Initial State & Storage Keys
  // ---------------------------------------------------------------------------
  const STORAGE_KEY_TASKS = 'checklist_tasks_v1';
  const STORAGE_KEY_SETTINGS = 'checklist_settings_v1';

  // Empty initial list - no dummy tasks
  const DEFAULT_TASKS = [];

  let tasks = loadTasks();
  let currentFilter = 'all';
  let searchQuery = '';
  let currentSort = 'created-desc';
  let soundEnabled = true;

  // Composer Selected State
  let composerState = {
    category: 'Personal',
    priority: 'low',
    energy: 'quick'
  };

  // Focus Timer State
  let timerInterval = null;
  let timerTotalSeconds = 25 * 60;
  let timerRemainingSeconds = 25 * 60;
  let isTimerRunning = false;
  let activeAmbientType = 'none';

  // ---------------------------------------------------------------------------
  // 2. Web Audio Synthesizer (Zero External Audio Files Required)
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

  // Pleasant Wooden Pop / Water Droplet sound on Task Add
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
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Harmonic Marimba Chime on Task Complete
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
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Soft Sweep on Delete
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
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }

  // Synthesized Ambient Sound Generator for Focus Mode
  function startAmbientSound(type) {
    stopAmbientSound();
    if (type === 'none' || !soundEnabled) return;
    initAudioContext();
    if (!audioCtx) return;

    try {
      const bufferSize = audioCtx.sampleRate * 2;
      const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      // Generate White or Pinkish noise
      let b0 = 0, b1 = 0, b2 = 0;
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

      // Filter to simulate soft raindrops or steady gentle stream
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
    } catch (e) {
      console.warn('Ambient noise error:', e);
    }
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
  // 3. Canvas Confetti Particle System
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
        x: x,
        y: y,
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
      p.vy += 0.18; // gravity
      p.vx *= 0.98; // air resistance
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
  // 4. Date & Greeting Helpers
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
  // 5. Tasks Management & Storage
  // ---------------------------------------------------------------------------
  function loadTasks() {
    try {
      // Check Checklist storage
      const data = localStorage.getItem(STORAGE_KEY_TASKS);
      if (data) {
        return JSON.parse(data);
      }

      // Check for any tasks added in previous session
      const prevKlaro = localStorage.getItem('klaro_tasks_v1') || localStorage.getItem('bloom_tasks_v2');
      if (prevKlaro) {
        const parsed = JSON.parse(prevKlaro);
        localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(parsed));
        return parsed;
      }

      // Check legacy v1 and purge dummy tasks
      const oldData = localStorage.getItem('bloom_tasks_v1');
      if (oldData) {
        const parsed = JSON.parse(oldData);
        const dummyIds = ['task-1', 'task-2', 'task-3', 'task-4'];
        const userOnly = parsed.filter(t => !dummyIds.includes(t.id));
        localStorage.removeItem('bloom_tasks_v1');
        localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(userOnly));
        return userOnly;
      }
    } catch (e) {
      console.warn('Error reading from localStorage', e);
    }
    return DEFAULT_TASKS;
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(tasks));
    } catch (e) {
      console.warn('Error writing to localStorage', e);
    }
    renderAll();
  }

  function addTask(title, category, priority, energy, dueDate) {
    const newTask = {
      id: 'task-' + Date.now(),
      title: title.trim(),
      category: category || 'Personal',
      priority: priority || 'low',
      energy: energy || 'quick',
      dueDate: dueDate || '',
      completed: false,
      completedAt: null,
      createdAt: Date.now()
    };

    tasks.unshift(newTask);
    saveTasks();
    playPopSound();
  }

  function toggleTaskCompletion(taskId, clientX, clientY) {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    task.completed = !task.completed;
    task.completedAt = task.completed ? Date.now() : null;

    if (task.completed) {
      playChimeSound();
      triggerConfetti(clientX, clientY, 35);

      // Check if all tasks in list are completed
      const remaining = tasks.filter(t => !t.completed).length;
      if (remaining === 0 && tasks.length > 0) {
        setTimeout(() => {
          triggerConfetti(window.innerWidth / 2, window.innerHeight * 0.35, 70);
        }, 300);
      }
    } else {
      playPopSound();
    }

    saveTasks();
  }

  function deleteTask(taskId) {
    playDeleteSound();
    tasks = tasks.filter(t => t.id !== taskId);
    saveTasks();
  }

  function clearCompleted() {
    const count = tasks.filter(t => t.completed).length;
    if (count === 0) return;
    playDeleteSound();
    tasks = tasks.filter(t => !t.completed);
    saveTasks();
  }

  // ---------------------------------------------------------------------------
  // 6. Rendering Logic
  // ---------------------------------------------------------------------------
  function renderAll() {
    renderOverview();
    renderTasksList();
    renderCounts();
    populateFocusTaskPicker();
  }

  function renderOverview() {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Elements
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

    // Circular progress ring: perimeter = 2 * PI * 35 ≈ 219.91
    const circumference = 2 * Math.PI * 35;
    if (ringFill) {
      const offset = circumference - (percentage / 100) * circumference;
      ringFill.style.strokeDashoffset = offset;
    }

    if (percentageLabel) {
      percentageLabel.textContent = `${percentage}%`;
    }

    if (summaryLabel) {
      summaryLabel.textContent = `${completed} of ${total} tasks completed`;
    }

    // Dynamic momentum badge message
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

  function getFilteredAndSortedTasks() {
    let result = [...tasks];

    // Filter
    if (currentFilter === 'today') {
      const todayStr = getTodayDateString();
      result = result.filter(t => t.dueDate === todayStr || (!t.dueDate && !t.completed));
    } else if (currentFilter === 'high') {
      result = result.filter(t => t.priority === 'high');
    } else if (currentFilter === 'completed') {
      result = result.filter(t => t.completed);
    }

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(t => 
        t.title.toLowerCase().includes(q) || 
        t.category.toLowerCase().includes(q) ||
        t.priority.toLowerCase().includes(q)
      );
    }

    // Sort
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
            emptyMsg.textContent = 'No completed tasks yet. Finish a task to see it celebrated here!';
          } else {
            emptyMsg.textContent = 'Take a deep breath or add a new intention above.';
          }
        }
      }
      return;
    }

    if (emptyStateEl) {
      emptyStateEl.classList.add('hidden');
    }

    // Render cards
    listEl.innerHTML = filtered.map(task => {
      const isOverdue = task.dueDate && task.dueDate < getTodayDateString() && !task.completed;
      const formattedDate = formatDueDate(task.dueDate);

      const categoryClass = 'cat-' + task.category.toLowerCase();
      const priorityLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);
      
      let energyLabel = '⚡ Quick Win';
      if (task.energy === 'steady') energyLabel = '☕ Steady';
      if (task.energy === 'deep') energyLabel = '🔥 Deep Flow';

      return `
        <article class="task-card priority-${task.priority} ${task.completed ? 'completed' : ''}" data-task-id="${task.id}" id="task-card-${task.id}">
          <div class="task-checkbox-wrap" data-action="toggle" title="${task.completed ? 'Mark incomplete' : 'Mark complete'}">
            <div class="task-checkbox">
              <i class="ph-bold ph-check"></i>
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
            </div>
          </div>

          <div class="task-actions">
            ${!task.completed ? `
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

  function formatDueDate(dateStr) {
    if (!dateStr) return '';
    const today = getTodayDateString();
    if (dateStr === today) return 'Today';
    
    // Check tomorrow
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
  // 7. Event Listeners & Interactive Handlers
  // ---------------------------------------------------------------------------
  function setupEventListeners() {
    // Add Task Form Submit
    const form = document.getElementById('add-task-form');
    const input = document.getElementById('task-title-input');
    const dueInput = document.getElementById('task-due-date');

    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = input.value;
        if (!title.trim()) return;

        addTask(
          title,
          composerState.category,
          composerState.priority,
          composerState.energy,
          dueInput ? dueInput.value : ''
        );

        input.value = '';
        if (dueInput) dueInput.value = '';
        input.focus();
      });
    }

    // Category Chips
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

    // Priority Chips
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

    // Energy Chips
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

    // Task Item Actions (Delegation)
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
          toggleTaskCompletion(taskId, rect.left + rect.width / 2, rect.top + rect.height / 2);
        } else if (deleteBtn) {
          deleteTask(taskId);
        } else if (focusBtn) {
          openFocusModalWithTask(taskId);
        }
      });
    }

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
        if (clearSearchBtn) {
          clearSearchBtn.classList.toggle('hidden', !searchQuery);
        }
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

    // Clear Completed Button
    const clearCompletedBtn = document.getElementById('clear-completed-btn');
    if (clearCompletedBtn) {
      clearCompletedBtn.addEventListener('click', () => {
        clearCompleted();
      });
    }

    // Sound Toggle Button
    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    const soundIcon = document.getElementById('sound-icon');
    if (soundToggleBtn) {
      soundToggleBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        if (soundIcon) {
          soundIcon.className = soundEnabled ? 'ph-bold ph-speaker-high' : 'ph-bold ph-speaker-slash';
        }
        if (!soundEnabled) {
          stopAmbientSound();
        }
      });
    }

    // Focus Mode Modal Triggers
    const focusModeBtn = document.getElementById('focus-mode-btn');
    const focusModal = document.getElementById('focus-modal');
    const closeFocusModalBtn = document.getElementById('close-focus-modal');

    if (focusModeBtn && focusModal) {
      focusModeBtn.addEventListener('click', () => {
        openFocusModal();
      });
    }
    if (closeFocusModalBtn && focusModal) {
      closeFocusModalBtn.addEventListener('click', () => {
        closeFocusModal();
      });
    }
    if (focusModal) {
      focusModal.addEventListener('click', (e) => {
        if (e.target === focusModal) closeFocusModal();
      });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      // '/' to focus search bar
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.focus();
      }
      // 'Escape' closes modal
      if (e.key === 'Escape') {
        closeFocusModal();
      }
    });

    // Setup Focus Timer Controls
    setupFocusTimer();
  }

  // ---------------------------------------------------------------------------
  // 8. Focus Sanctuary & Ambient Soundscape
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
    if (picker) {
      picker.value = taskId;
    }
  }

  function closeFocusModal() {
    const focusModal = document.getElementById('focus-modal');
    if (focusModal) {
      focusModal.classList.add('hidden');
    }
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

    if (currentVal) {
      picker.value = currentVal;
    }
  }

  function setupFocusTimer() {
    const startBtn = document.getElementById('timer-start-btn');
    const resetBtn = document.getElementById('timer-reset-btn');
    const playIcon = document.getElementById('timer-play-icon');
    const btnLabel = document.getElementById('timer-btn-label');
    const ambientBtns = document.querySelectorAll('.ambient-btn');

    if (startBtn) {
      startBtn.addEventListener('click', () => {
        if (isTimerRunning) {
          pauseFocusTimer();
        } else {
          startFocusTimer();
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        resetFocusTimer();
      });
    }

    ambientBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        ambientBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeAmbientType = btn.getAttribute('data-ambient');
        if (isTimerRunning) {
          startAmbientSound(activeAmbientType);
        }
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

        // Check if a task was assigned to this session and prompt completion
        const picker = document.getElementById('focus-task-picker');
        if (picker && picker.value) {
          const task = tasks.find(t => t.id === picker.value);
          if (task && !task.completed) {
            task.completed = true;
            task.completedAt = Date.now();
            saveTasks();
          }
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
  // 9. Startup & Initial Quotes
  // ---------------------------------------------------------------------------
  const QUOTES = [
    '"Small steps each day lead to breathtaking journeys."',
    '"Focus on the step in front of you, not the entire mountain."',
    '"Simplicity is the soul of mindfulness."',
    '"Peace of mind is doing one thing with your whole heart."',
    '"Action creates clarity. Start gently."',
    '"Energy flows where mindful intention goes."'
  ];

  function setRandomQuote() {
    const quoteEl = document.getElementById('daily-quote');
    if (quoteEl) {
      quoteEl.textContent = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    }
  }

  // Initialize App on DOM Ready
  document.addEventListener('DOMContentLoaded', () => {
    updateGreetingAndDate();
    setRandomQuote();
    setupEventListeners();
    renderAll();
    updateTimerDisplay();
  });

})();
