// ═══════════════════════════════════════════════
// POMINI — App Logic
// ═══════════════════════════════════════════════

// ── Motivational Phrases ──────────────────────
const PHRASES = {
  focus: [
    'Deep breath. Let\'s go.',
    'One pomodoro at a time.',
    'You\'ve got this.',
    'Focus mode: ON.',
    'Make it count.',
    'Stay in the zone.',
    'Your future self is watching.',
    'Small steps, big results.',
    'Lock in.',
    'The work is the reward.',
    'Show up for yourself.',
    'Quiet the noise.',
    'This moment is yours.',
    'Just begin.',
    'Progress, not perfection.',
    'Eyes on the prize.',
    'Let the flow find you.',
    'You are capable of great things.',
    'Silence is productive.',
    'Time to shine.'
  ],
  shortBreak: [
    'Stand up, stretch out.',
    'Breathe. You earned this.',
    'Move your body.',
    'Rest those eyes.',
    'Hydrate!',
    'Look away from the screen.',
    'Roll your shoulders.',
    'Quick walk around.',
    'Close your eyes for a moment.',
    'Deep inhale, slow exhale.',
    'Reset and recharge.',
    'Shake it off.',
    'Posture check!',
    'A sip of water works wonders.',
    'Micro-break magic.'
  ],
  longBreak: [
    'Take a real break. You deserve it.',
    'Step away. Really.',
    'Go for a walk!',
    'Your brain needs this.',
    'Rest is part of the process.',
    'Recharge fully.',
    'Stretch, snack, smile.',
    'Let your mind wander.',
    'Come back stronger.',
    'Disconnect to reconnect.',
    'Celebrate your focus.',
    'You crushed those sessions.',
    'Fresh air time!',
    'Nourish yourself.',
    'Gratitude pause.'
  ]
}

// ── Audio Engine ──────────────────────────────
const AudioContext = window.AudioContext || window.webkitAudioContext
let audioCtx = null

// ── Ambient Sound Presets ─────────────────────
const AMBIENT_PRESETS = {
  rain: (ctx, gainNode) => {
    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 500
    source.connect(filter)
    filter.connect(gainNode)
    source.start()
    return [source, filter]
  },
  whitenoise: (ctx, gainNode) => {
    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    source.connect(gainNode)
    source.start()
    return [source]
  },
  lofi: (ctx, gainNode) => {
    const freqs = [261.63, 329.63, 392.00, 523.25]
    const nodes = []
    freqs.forEach(freq => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      const g = ctx.createGain()
      g.gain.value = 0.15
      osc.connect(g)
      g.connect(gainNode)
      osc.start()
      nodes.push(osc, g)
    })
    return nodes
  },
  cafe: (ctx, gainNode) => {
    const bufferSize = ctx.sampleRate * 2
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    let lastOut = 0
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1
      data[i] = (lastOut + (0.02 * white)) / 1.02
      lastOut = data[i]
      data[i] *= 2.5
    }
    const source = ctx.createBufferSource()
    source.buffer = buffer
    source.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 600
    source.connect(filter)
    filter.connect(gainNode)
    source.start()
    return [source, filter]
  }
}

let ambientNodes = []
let ambientGain = null

function startAmbientSound(preset, volume) {
  if (!audioCtx) audioCtx = new AudioContext()
  stopAmbientSound()
  if (preset === 'none' || !AMBIENT_PRESETS[preset]) return
  ambientGain = audioCtx.createGain()
  ambientGain.gain.value = Math.min(1, Math.max(0, volume))
  ambientGain.connect(audioCtx.destination)
  ambientNodes = AMBIENT_PRESETS[preset](audioCtx, ambientGain)
}

function stopAmbientSound() {
  if (ambientNodes.length > 0) {
    ambientNodes.forEach(node => {
      try { node.stop() } catch (_) { /* already stopped */ }
      try { node.disconnect() } catch (_) {}
    })
    ambientNodes = []
  }
  if (ambientGain) {
    try { ambientGain.disconnect() } catch (_) {}
    ambientGain = null
  }
}

function setAmbientVolume(vol) {
  if (ambientGain) {
    ambientGain.gain.value = Math.min(1, Math.max(0, vol))
  }
}

// ── Default Settings ──────────────────────────
const DEFAULTS = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  theme: 'mono',
  fontUI: "'General Sans', 'Inter', sans-serif",
  fontMono: "'JetBrains Mono', monospace",
  position: 'top-right',
  autoStartBreaks: true,
  autoStartFocus: false,
  notifications: true,
  sound: true,
  dimOnFocus: true,
  opacityIdle: 1.0,
  opacityFocus: 0.4,
  opacityBreak: 1.0,
  lightMode: false,
  focusLock: false,
  closeToTray: true,
  startup: false,
  ambientSound: 'none',
  ambientVolume: 0.3,
  dailyGoal: 8
}

// ── History ────────────────────────────────────
function loadHistory() {
  try { return JSON.parse(localStorage.getItem('pomini-history')) || [] }
  catch (_) { return [] }
}

function saveHistory(history) {
  localStorage.setItem('pomini-history', JSON.stringify(history))
}

function logSession(type, durationMins) {
  const history = loadHistory()
  history.push({
    type,
    duration: durationMins,
    completedAt: Date.now()
  })
  // Keep last 90 days
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000
  saveHistory(history.filter(h => h.completedAt > cutoff))
  updateStats()
  updateGoalBar()
}

function getStats() {
  const history = loadHistory()
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const weekStart = todayStart - now.getDay() * 24 * 60 * 60 * 1000

  const today = history.filter(h => h.completedAt >= todayStart && h.type === 'focus').length
  const week = history.filter(h => h.completedAt >= weekStart && h.type === 'focus').length
  const total = history.filter(h => h.type === 'focus').length

  // Streak: consecutive days with at least 1 focus session
  let streak = 0
  const daySet = new Set()
  history.filter(h => h.type === 'focus').forEach(h => {
    const d = new Date(h.completedAt)
    daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)
  })

  const days = Array.from(daySet).map(s => {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m, d).getTime()
  }).sort((a, b) => b - a)

  if (days.length > 0) {
    const yesterday = todayStart - 24 * 60 * 60 * 1000
    if (days[0] >= todayStart || days[0] >= yesterday) {
      streak = 1
      for (let i = 1; i < days.length; i++) {
        if (days[i - 1] - days[i] <= 24 * 60 * 60 * 1000 + 1000) streak++
        else break
      }
    }
  }

  return { today, week, total, streak }
}

function updateStats() {
  const stats = getStats()
  const sel = (id) => document.getElementById(id)
  const st = sel('stat-today')
  const sw = sel('stat-week')
  const stt = sel('stat-total')
  const ss = sel('stat-streak')
  if (st) st.textContent = stats.today
  if (sw) sw.textContent = stats.week
  if (stt) stt.textContent = stats.total
  if (ss) ss.textContent = stats.streak
}

// ── Goal Bar ───────────────────────────────────
function updateGoalBar() {
  const stats = getStats()
  const goal = state.settings.dailyGoal || 8
  const pct = Math.min(100, Math.round((stats.today / goal) * 100))
  if (dom.goalBarFill) {
    dom.goalBarFill.style.width = pct + '%'
  }
  if (dom.goalLabel) {
    dom.goalLabel.textContent = stats.today + ' / ' + goal + ' sessions'
  }
}

// ── Focus Lock ─────────────────────────────────
function showLockOverlay() {
  if (dom.lockOverlay) {
    dom.lockOverlay.classList.remove('lock-hidden')
  }
}

function hideLockOverlay() {
  if (dom.lockOverlay) {
    dom.lockOverlay.classList.add('lock-hidden')
  }
}

function updateLockTimer() {
  if (dom.lockTimer) {
    const mins = Math.floor(state.timeLeft / 60)
    const secs = state.timeLeft % 60
    dom.lockTimer.textContent =
      String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0')
  }
}

function updateSkipButtonState() {
  if (dom.btnSkip) {
    dom.btnSkip.disabled = state.settings.focusLock && state.mode === 'focus'
  }
}

// ── Task Input ─────────────────────────────────
function loadTask() {
  try {
    return localStorage.getItem('pomini-task') || ''
  } catch (_) { return '' }
}

function saveTask(text) {
  localStorage.setItem('pomini-task', text)
}

// ── Export ─────────────────────────────────────
function exportHistory(format) {
  const history = loadHistory()
  let data
  if (format === 'csv') {
    const header = 'Type,Duration (min),Completed At'
    const rows = history.map(h => {
      return h.type + ',' + h.duration + ',' + new Date(h.completedAt).toISOString()
    })
    data = header + '\n' + rows.join('\n')
  } else {
    data = JSON.stringify(history, null, 2)
  }
  window.pomini.exportData(format, data)
}

// ── Sync to Main ───────────────────────────────
function syncToMain() {
  window.pomini.syncTimerState({
    running: state.running,
    timeLeft: state.timeLeft,
    mode: state.mode
  })
}

// ── Sounds ────────────────────────────────────
function beep(freq, type, duration, vol = 0.08) {
  if (!audioCtx) audioCtx = new AudioContext()
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime)
  gain.gain.setValueAtTime(vol, audioCtx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration)
  osc.connect(gain)
  gain.connect(audioCtx.destination)
  osc.start()
  osc.stop(audioCtx.currentTime + duration)
}

function playTick() { beep(800, 'sine', 0.08, 0.03) }
function playStartChime() {
  beep(660, 'sine', 0.15, 0.05)
  setTimeout(() => beep(880, 'sine', 0.3, 0.05), 100)
}
function playEndChime() {
  beep(880, 'sine', 0.2, 0.05)
  setTimeout(() => beep(1100, 'sine', 0.3, 0.05), 120)
  setTimeout(() => beep(1320, 'sine', 0.4, 0.05), 240)
}

// ── App State ─────────────────────────────────
const state = {
  mode: 'focus',         // 'focus' | 'shortBreak' | 'longBreak'
  running: false,
  paused: false,
  timeLeft: 25 * 60,     // seconds
  totalTime: 25 * 60,
  sessionsCompleted: 0,
  isPinned: false,
  isCompact: false,
  settings: { ...DEFAULTS },
  intervalId: null,
  lastTickSecond: -1
}

// ── DOM Elements ──────────────────────────────
const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => document.querySelectorAll(sel)

const dom = {
  body: $('body'),
  stateDot: $('#state-dot'),
  stateLabel: $('#state-label'),
  timerDisplay: $('#timer-display'),
  timerRing: $('.timer-ring-progress'),
  phraseText: $('#phrase-text'),
  btnStart: $('#btn-start'),
  btnSkip: $('#btn-skip'),
  btnPin: $('#btn-pin'),
  btnCompact: $('#btn-compact'),
  sessionCount: $('#session-count'),
  btnSettings: $('#btn-settings'),
  settingsPanel: $('#settings-panel'),
  btnSettingsClose: $('#btn-settings-close'),

  // Settings inputs
  setFocus: $('#set-focus'),
  setShortBreak: $('#set-short-break'),
  setLongBreak: $('#set-long-break'),
  setSessionsBeforeLong: $('#set-sessions-before-long'),
  setAutoStartBreaks: $('#set-auto-start-breaks'),
  setAutoStartFocus: $('#set-auto-start-focus'),
  setNotifications: $('#set-notifications'),
  setSound: $('#set-sound'),
  setDimOnFocus: $('#set-dim-on-focus'),
  setOpacityIdle: $('#set-opacity-idle'),
  setOpacityFocus: $('#set-opacity-focus'),
  setOpacityBreak: $('#set-opacity-break'),
  btnResetSettings: $('#btn-reset-settings'),
  themeOptions: $('#theme-options'),
  positionOptions: $('#position-options'),
  btnClearHistory: $('#btn-clear-history'),
  setFontUI: $('#set-font-ui'),
  setFontMono: $('#set-font-mono'),
  settingsTabs: $$('.settings-tab'),
  settingsTabPanels: $$('.settings-tab-panel'),

  // New elements
  taskInput: $('#task-input'),
  goalBarFill: $('#goal-bar-fill'),
  goalLabel: $('#goal-label'),
  lockOverlay: $('#focus-lock-overlay'),
  lockTimer: $('#focus-lock-timer'),
  setFocusLock: $('#set-focus-lock'),
  setCloseToTray: $('#set-close-to-tray'),
  setStartup: $('#set-startup'),
  setLightMode: $('#set-light-mode'),
  setAmbientSound: $('#set-ambient-sound'),
  setAmbientVolume: $('#set-ambient-volume'),
  setDailyGoal: $('#set-daily-goal'),
  btnExportCSV: $('#btn-export-csv'),
  btnExportJSON: $('#btn-export-json')
}

const circumference = 2 * Math.PI * 90 // r=90

// ── Init ──────────────────────────────────────
function init() {
  loadSettings()
  applySettings()
  updateTimerDisplay()
  updateRing(1)
  setRandomPhrase()
  bindEvents()
  updatePinButton()
  updateStats()
  updateGoalBar()
  setBodyOpacity(state.settings.opacityIdle)
  updateSkipButtonState()

  // Load saved task
  const savedTask = loadTask()
  if (dom.taskInput) {
    dom.taskInput.value = savedTask
  }

  // Auto-position window on startup
  if (state.settings.position) {
    window.pomini.setPosition(state.settings.position)
  }

  syncToMain()
}

function loadSettings() {
  try {
    const saved = localStorage.getItem('pomini-settings')
    if (saved) {
      state.settings = { ...DEFAULTS, ...JSON.parse(saved) }
    }
  } catch (_) { /* use defaults */ }
}

function saveSettings() {
  localStorage.setItem('pomini-settings', JSON.stringify(state.settings))
}

function applySettings() {
  const s = state.settings

  // Durations
  switch (state.mode) {
    case 'focus':
      state.timeLeft = s.focusDuration * 60
      state.totalTime = s.focusDuration * 60
      break
    case 'shortBreak':
      state.timeLeft = s.shortBreakDuration * 60
      state.totalTime = s.shortBreakDuration * 60
      break
    case 'longBreak':
      state.timeLeft = s.longBreakDuration * 60
      state.totalTime = s.longBreakDuration * 60
      break
  }

  // Theme
  dom.body.setAttribute('data-theme', s.theme)
  document.querySelectorAll('.theme-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.theme === s.theme)
  })

  // Light mode
  if (s.lightMode) {
    dom.body.setAttribute('data-light', 'true')
  } else {
    dom.body.removeAttribute('data-light')
  }

  // Update settings form
  dom.setFocus.value = s.focusDuration
  dom.setShortBreak.value = s.shortBreakDuration
  dom.setLongBreak.value = s.longBreakDuration
  dom.setSessionsBeforeLong.value = s.sessionsBeforeLongBreak
  dom.setAutoStartBreaks.checked = s.autoStartBreaks
  dom.setAutoStartFocus.checked = s.autoStartFocus
  dom.setNotifications.checked = s.notifications
  dom.setSound.checked = s.sound
  dom.setDimOnFocus.checked = s.dimOnFocus
  dom.setOpacityIdle.value = s.opacityIdle
  dom.setOpacityFocus.value = s.opacityFocus
  dom.setOpacityBreak.value = s.opacityBreak

  // New settings form fields
  if (dom.setFocusLock) dom.setFocusLock.checked = s.focusLock
  if (dom.setCloseToTray) dom.setCloseToTray.checked = s.closeToTray
  if (dom.setStartup) dom.setStartup.checked = s.startup
  if (dom.setLightMode) dom.setLightMode.checked = s.lightMode
  if (dom.setAmbientSound) dom.setAmbientSound.value = s.ambientSound
  if (dom.setAmbientVolume) dom.setAmbientVolume.value = s.ambientVolume
  if (dom.setDailyGoal) dom.setDailyGoal.value = s.dailyGoal

  // Position chips
  document.querySelectorAll('.pos-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.pos === s.position)
  })

  // Fonts
  document.documentElement.style.setProperty('--font-ui', s.fontUI)
  document.documentElement.style.setProperty('--font-mono', s.fontMono)
  if (dom.setFontUI && dom.setFontUI.length) {
    dom.setFontUI[0].value = s.fontUI
  }
  if (dom.setFontMono && dom.setFontMono.length) {
    dom.setFontMono[0].value = s.fontMono
  }

  updateTimerDisplay()
  updateRing(1)
  updateStateUI()
  updatePinButton()
  updateSkipButtonState()
}

// ── Events ────────────────────────────────────
function bindEvents() {
  // Window controls
  $('#btn-minimize').addEventListener('click', () => {
    if (state.settings.closeToTray) {
      window.pomini.hideToTray()
    } else {
      window.pomini.minimize()
    }
  })
  $('#btn-close').addEventListener('click', () => window.pomini.close())
  dom.btnPin.addEventListener('click', togglePin)
  dom.btnCompact.addEventListener('click', toggleCompact)

  // Timer controls
  dom.btnStart.addEventListener('click', toggleTimer)
  dom.btnSkip.addEventListener('click', skipSession)

  // Settings
  dom.btnSettings.addEventListener('click', openSettings)
  dom.btnSettingsClose.addEventListener('click', closeSettings)
  dom.btnResetSettings.addEventListener('click', resetSettings)

  // Settings inputs
  dom.setFocus.addEventListener('change', () => updateSetting('focusDuration', parseInt(dom.setFocus.value)))
  dom.setShortBreak.addEventListener('change', () => updateSetting('shortBreakDuration', parseInt(dom.setShortBreak.value)))
  dom.setLongBreak.addEventListener('change', () => updateSetting('longBreakDuration', parseInt(dom.setLongBreak.value)))
  dom.setSessionsBeforeLong.addEventListener('change', () => updateSetting('sessionsBeforeLongBreak', parseInt(dom.setSessionsBeforeLong.value)))
  dom.setAutoStartBreaks.addEventListener('change', () => updateSetting('autoStartBreaks', dom.setAutoStartBreaks.checked))
  dom.setAutoStartFocus.addEventListener('change', () => updateSetting('autoStartFocus', dom.setAutoStartFocus.checked))
  dom.setNotifications.addEventListener('change', () => updateSetting('notifications', dom.setNotifications.checked))
  dom.setSound.addEventListener('change', () => updateSetting('sound', dom.setSound.checked))
  dom.setDimOnFocus.addEventListener('change', () => updateSetting('dimOnFocus', dom.setDimOnFocus.checked))
  dom.setOpacityIdle.addEventListener('input', () => {
    updateSetting('opacityIdle', parseFloat(dom.setOpacityIdle.value))
    if (!state.running) setBodyOpacity(state.settings.opacityIdle)
  })
  dom.setOpacityFocus.addEventListener('input', () => {
    updateSetting('opacityFocus', parseFloat(dom.setOpacityFocus.value))
    if (state.running && state.mode === 'focus') setBodyOpacity(state.settings.opacityFocus)
  })
  dom.setOpacityBreak.addEventListener('input', () => {
    updateSetting('opacityBreak', parseFloat(dom.setOpacityBreak.value))
    if (state.running && (state.mode === 'shortBreak' || state.mode === 'longBreak')) {
      setBodyOpacity(state.settings.opacityBreak)
    }
  })

  // New settings inputs
  if (dom.setFocusLock) dom.setFocusLock.addEventListener('change', () => {
    updateSetting('focusLock', dom.setFocusLock.checked)
    updateSkipButtonState()
    if (!dom.setFocusLock.checked) hideLockOverlay()
    if (dom.setFocusLock.checked && state.running && state.mode === 'focus') showLockOverlay()
  })
  if (dom.setCloseToTray) dom.setCloseToTray.addEventListener('change', () => updateSetting('closeToTray', dom.setCloseToTray.checked))
  if (dom.setStartup) dom.setStartup.addEventListener('change', () => updateSetting('startup', dom.setStartup.checked))
  if (dom.setLightMode) dom.setLightMode.addEventListener('change', () => {
    updateSetting('lightMode', dom.setLightMode.checked)
    if (dom.setLightMode.checked) {
      dom.body.setAttribute('data-light', 'true')
    } else {
      dom.body.removeAttribute('data-light')
    }
  })
  if (dom.setAmbientSound) dom.setAmbientSound.addEventListener('change', () => {
    updateSetting('ambientSound', dom.setAmbientSound.value)
    if (state.running && state.mode === 'focus') {
      if (dom.setAmbientSound.value === 'none') {
        stopAmbientSound()
      } else {
        startAmbientSound(dom.setAmbientSound.value, state.settings.ambientVolume)
      }
    }
  })
  if (dom.setAmbientVolume) dom.setAmbientVolume.addEventListener('input', () => {
    updateSetting('ambientVolume', parseFloat(dom.setAmbientVolume.value))
    setAmbientVolume(parseFloat(dom.setAmbientVolume.value))
  })
  if (dom.setDailyGoal) dom.setDailyGoal.addEventListener('change', () => {
    updateSetting('dailyGoal', parseInt(dom.setDailyGoal.value))
    updateGoalBar()
  })

  // Export buttons
  if (dom.btnExportCSV) dom.btnExportCSV.addEventListener('click', () => exportHistory('csv'))
  if (dom.btnExportJSON) dom.btnExportJSON.addEventListener('click', () => exportHistory('json'))

  // Task input
  if (dom.taskInput) dom.taskInput.addEventListener('input', () => saveTask(dom.taskInput.value))

  // Theme chips
  dom.themeOptions.addEventListener('click', (e) => {
    const chip = e.target.closest('.theme-chip')
    if (!chip) return
    updateSetting('theme', chip.dataset.theme)
    dom.body.setAttribute('data-theme', chip.dataset.theme)
    document.querySelectorAll('.theme-chip').forEach(c => c.classList.remove('active'))
    chip.classList.add('active')
  })

  // Font selects
  if (dom.setFontUI && dom.setFontUI.addEventListener) {
    dom.setFontUI.addEventListener('change', () => updateSetting('fontUI', dom.setFontUI.value))
  }
  if (dom.setFontMono && dom.setFontMono.addEventListener) {
    dom.setFontMono.addEventListener('change', () => updateSetting('fontMono', dom.setFontMono.value))
  }

  // Settings tabs
  dom.settingsTabs.forEach(tab => {
    tab.addEventListener('click', () => switchSettingsTab(tab.dataset.tab))
  })

  // Position chips
  dom.positionOptions.addEventListener('click', (e) => {
    const chip = e.target.closest('.pos-chip')
    if (!chip) return
    const pos = chip.dataset.pos
    updateSetting('position', pos)
    window.pomini.setPosition(pos)
    document.querySelectorAll('.pos-chip').forEach(c => c.classList.remove('active'))
    chip.classList.add('active')
  })

  // Clear history
  dom.btnClearHistory.addEventListener('click', () => {
    saveHistory([])
    updateStats()
    updateGoalBar()
  })

  // Keyboard shortcut: Space to toggle
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault()
      toggleTimer()
    }
  })

  // Global shortcut listeners from main process
  if (window.pomini.onShortcut && window.pomini.onShortcut.toggle) {
    window.pomini.onShortcut.toggle(() => toggleTimer())
  }
  if (window.pomini.onShortcut && window.pomini.onShortcut.skip) {
    window.pomini.onShortcut.skip(() => skipSession())
  }
}

// ── Update Setting ───────────────────────────
function updateSetting(key, value) {
  state.settings[key] = value
  saveSettings()

  // If changing focus duration while not running, reset time
  if (!state.running && (key === 'focusDuration' || key === 'shortBreakDuration' || key === 'longBreakDuration')) {
    applySettings()
  }

  // Opacity
  if (!state.running && key === 'opacityIdle') {
    setBodyOpacity(value)
  }

  // Dim on focus toggle while running
  if (key === 'dimOnFocus' && state.running && state.mode === 'focus') {
    if (value) {
      if (state.isPinned) setBodyOpacity(state.settings.opacityFocus)
    } else {
      setBodyOpacity(state.settings.opacityIdle)
    }
  }
}

// ── Pin Toggle ────────────────────────────────
async function togglePin() {
  state.isPinned = !state.isPinned
  await window.pomini.togglePin(state.isPinned)
  updatePinButton()

  // Adjust opacity when pin state changes
  if (state.isPinned) {
    if (state.running && state.mode === 'focus' && state.settings.dimOnFocus) {
      setBodyOpacity(state.settings.opacityFocus)
    }
  } else {
    setBodyOpacity(state.settings.opacityIdle)
  }
}

function updatePinButton() {
  if (state.isPinned) {
    dom.btnPin.classList.add('active')
  } else {
    dom.btnPin.classList.remove('active')
  }
}

async function toggleCompact() {
  state.isCompact = !state.isCompact
  if (state.isCompact) {
    dom.body.classList.add('compact')
    dom.btnCompact.classList.add('active')
    dom.btnCompact.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>'
    await window.pomini.setCompact(true)
  } else {
    dom.body.classList.remove('compact')
    dom.btnCompact.classList.remove('active')
    dom.btnCompact.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>'
    await window.pomini.setCompact(false)
  }
}

// ── Opacity ───────────────────────────────────
function setBodyOpacity(value) {
  window.pomini.setOpacity(value)
}

// ── Timer Logic ───────────────────────────────
function toggleTimer() {
  if (state.running) {
    pauseTimer()
  } else {
    startTimer()
  }
}

function startTimer() {
  state.running = true
  state.paused = false
  dom.btnStart.textContent = 'Pause'

  // If timer was at 0, reset it
  if (state.timeLeft <= 0) {
    resetCurrentModeTime()
  }

  updateStateUI()

  // Opacity
  if (state.mode === 'focus' && state.settings.dimOnFocus && state.isPinned) {
    setBodyOpacity(state.settings.opacityFocus)
  } else if (state.mode === 'shortBreak' || state.mode === 'longBreak') {
    setBodyOpacity(state.settings.opacityBreak)
  }

  // Ambient sound
  if (state.mode === 'focus' && state.settings.ambientSound !== 'none') {
    startAmbientSound(state.settings.ambientSound, state.settings.ambientVolume)
  }

  // Focus lock overlay
  if (state.mode === 'focus' && state.settings.focusLock) {
    showLockOverlay()
  }
  updateSkipButtonState()

  if (state.settings.sound) playStartChime()

  state.intervalId = setInterval(tick, 1000)
  tick() // immediate first tick
  syncToMain()
}

function pauseTimer() {
  state.running = false
  state.paused = true
  clearInterval(state.intervalId)
  state.intervalId = null
  dom.btnStart.textContent = 'Resume'
  setBodyOpacity(state.settings.opacityIdle)
  stopAmbientSound()
  syncToMain()
}

function tick() {
  if (state.timeLeft <= 0) {
    completeSession()
    return
  }

  const prevSecond = state.timeLeft
  state.timeLeft--

  updateTimerDisplay()
  updateRing(state.timeLeft / state.totalTime)
  updateLockTimer()

  // Tick sound on last 3 seconds
  if (state.timeLeft <= 3 && state.timeLeft > 0 && state.settings.sound) {
    playTick()
  }

  syncToMain()
}

function completeSession() {
  clearInterval(state.intervalId)
  state.intervalId = null
  state.running = false
  dom.btnStart.textContent = 'Start'

  updateTimerDisplay()
  updateRing(0)
  setBodyOpacity(1.0)

  stopAmbientSound()
  hideLockOverlay()

  if (state.settings.sound) playEndChime()

  const previousMode = state.mode

  if (state.mode === 'focus') {
    state.sessionsCompleted++
    dom.sessionCount.textContent = state.sessionsCompleted

    logSession('focus', state.settings.focusDuration)

    if (state.settings.notifications) {
      window.pomini.notify(
        'Focus session complete!',
        `You completed ${state.sessionsCompleted} session${state.sessionsCompleted > 1 ? 's' : ''} today. Time for a break.`
      )
    }

    // Determine next break type
    if (state.sessionsCompleted % state.settings.sessionsBeforeLongBreak === 0) {
      setMode('longBreak')
    } else {
      setMode('shortBreak')
    }
  } else {
    // Break finished
    if (state.settings.notifications) {
      window.pomini.notify(
        'Break is over!',
        'Ready to focus again? Let\'s go.'
      )
    }
    setMode('focus')
    setBodyOpacity(1.0)
  }

  updateStateUI()
  setRandomPhrase()
  updateSkipButtonState()

  // Auto-start
  const shouldAutoStart =
    (previousMode === 'focus' && state.settings.autoStartBreaks) ||
    (previousMode !== 'focus' && state.settings.autoStartFocus)

  if (shouldAutoStart) {
    setTimeout(() => startTimer(), 600)
  }

  syncToMain()
}

function skipSession() {
  if (state.settings.focusLock && state.mode === 'focus') {
    showLockOverlay()
    return
  }

  const wasFocus = state.mode === 'focus'

  if (state.running) {
    clearInterval(state.intervalId)
    state.intervalId = null
  }
  state.running = false
  dom.btnStart.textContent = 'Start'
  setBodyOpacity(1.0)
  stopAmbientSound()
  hideLockOverlay()

  if (state.mode === 'focus') {
    if (state.sessionsCompleted % state.settings.sessionsBeforeLongBreak === 0 && state.sessionsCompleted > 0) {
      setMode('longBreak')
    } else {
      setMode('shortBreak')
    }
  } else {
    setMode('focus')
    setBodyOpacity(1.0)
  }

  updateStateUI()
  updateTimerDisplay()
  updateRing(1)
  setRandomPhrase()
  updateSkipButtonState()

  // Auto-start next session after skip
  const shouldAutoStart =
    (wasFocus && state.settings.autoStartBreaks) ||
    (!wasFocus && state.settings.autoStartFocus)

  if (shouldAutoStart) {
    setTimeout(() => startTimer(), 500)
  }

  syncToMain()
}

function resetCurrentModeTime() {
  switch (state.mode) {
    case 'focus':
      state.timeLeft = state.settings.focusDuration * 60
      state.totalTime = state.settings.focusDuration * 60
      break
    case 'shortBreak':
      state.timeLeft = state.settings.shortBreakDuration * 60
      state.totalTime = state.settings.shortBreakDuration * 60
      break
    case 'longBreak':
      state.timeLeft = state.settings.longBreakDuration * 60
      state.totalTime = state.settings.longBreakDuration * 60
      break
  }
  updateTimerDisplay()
  updateRing(1)
  updateLockTimer()
}

function setMode(mode) {
  state.mode = mode
  resetCurrentModeTime()
  dom.body.setAttribute('data-state', mode)
  updateSkipButtonState()
}

// ── UI Updates ────────────────────────────────
function updateTimerDisplay() {
  const mins = Math.floor(state.timeLeft / 60)
  const secs = state.timeLeft % 60
  dom.timerDisplay.textContent =
    String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0')
}

function updateRing(fraction) {
  const offset = circumference * (1 - fraction)
  dom.timerRing.style.strokeDashoffset = offset
}

function updateStateUI() {
  dom.body.setAttribute('data-state', state.mode)

  switch (state.mode) {
    case 'focus':
      dom.stateLabel.textContent = 'Focus'
      break
    case 'shortBreak':
      dom.stateLabel.textContent = 'Short Break'
      break
    case 'longBreak':
      dom.stateLabel.textContent = 'Long Break'
      break
  }
}

function setRandomPhrase() {
  const phrases = PHRASES[state.mode]
  if (!phrases) return
  const idx = Math.floor(Math.random() * phrases.length)
  dom.phraseText.textContent = phrases[idx]
  dom.phraseText.classList.remove('phrase-enter')
  void dom.phraseText.offsetWidth
  dom.phraseText.classList.add('phrase-enter')
}

// ── Settings Panel ────────────────────────────
function openSettings() {
  dom.settingsPanel.classList.remove('panel-hidden')
  updateStats()
}

function closeSettings() {
  dom.settingsPanel.classList.add('panel-hidden')
  applySettings()
}

function switchSettingsTab(tabName) {
  dom.settingsTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName))
  dom.settingsTabPanels.forEach(p => p.classList.toggle('active', p.id === `tab-${tabName}`))
}

function resetSettings() {
  state.settings = { ...DEFAULTS }
  saveSettings()
  applySettings()
  setBodyOpacity(state.settings.opacityIdle)
  updateTimerDisplay()
  updateRing(1)
  setRandomPhrase()
  updateGoalBar()

  if (state.settings.focusLock && state.running && state.mode === 'focus') {
    showLockOverlay()
  } else {
    hideLockOverlay()
  }
  closeSettings()
}

// ── Auto Updates ───────────────────────────────
function setupAutoUpdates() {
  const toast = document.getElementById('update-toast')
  const msg = document.getElementById('update-message')
  const action = document.getElementById('update-action')
  const dismiss = document.getElementById('update-dismiss')

  if (!toast || !msg || !action || !dismiss) return

  let isVisible = false

  function show(text, btnLabel, btnAction) {
    msg.textContent = text
    action.textContent = btnLabel
    action.style.display = btnAction ? '' : 'none'
    action.onclick = btnAction || null
    dismiss.style.display = btnAction ? '' : 'none'
    toast.classList.remove('toast-hidden')
    isVisible = true
  }

  function hide() {
    toast.classList.add('toast-hidden')
    isVisible = false
  }

  dismiss.addEventListener('click', hide)

  window.pomini.update.onChecking(() => {
    show('Checking for updates...', '', null)
  })

  window.pomini.update.onAvailable((info) => {
    show(`v${info.version} available — downloading...`, '', null)
  })

  window.pomini.update.onNotAvailable(() => {
    show('You are up to date', '', null)
    setTimeout(hide, 2500)
  })

  window.pomini.update.onProgress((p) => {
    if (isVisible) {
      msg.textContent = `Downloading... ${p.percent}%`
    }
  })

  window.pomini.update.onDownloaded((info) => {
    show(`v${info.version} ready! Restart to update.`, 'Install & Restart', () => {
      window.pomini.update.install()
    })
  })

  window.pomini.update.onError((err) => {
    show(`Update error: ${err.message || 'check failed'}`, 'Retry', () => {
      window.pomini.update.check()
    })
  })
}

// ── Start ─────────────────────────────────────
init()
setupAutoUpdates()
