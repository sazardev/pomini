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

// ── Default Settings ──────────────────────────
const DEFAULTS = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  theme: 'mono',
  position: 'top-right',
  autoStartBreaks: true,
  autoStartFocus: false,
  notifications: true,
  sound: true,
  dimOnFocus: true,
  opacityIdle: 1.0,
  opacityFocus: 0.4,
  opacityBreak: 1.0
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

// ── Sounds ────────────────────────────────────
const AudioContext = window.AudioContext || window.webkitAudioContext
let audioCtx = null

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
  btnClearHistory: $('#btn-clear-history')
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
  setBodyOpacity(state.settings.opacityIdle)

  // Auto-position window on startup
  if (state.settings.position) {
    window.pomini.setPosition(state.settings.position)
  }
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

  // Position chips
  document.querySelectorAll('.pos-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.pos === s.position)
  })

  updateTimerDisplay()
  updateRing(1)
  updateStateUI()
  updatePinButton()
}

// ── Events ────────────────────────────────────
function bindEvents() {
  // Window controls
  $('#btn-minimize').addEventListener('click', () => window.pomini.minimize())
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

  // Theme chips
  dom.themeOptions.addEventListener('click', (e) => {
    const chip = e.target.closest('.theme-chip')
    if (!chip) return
    updateSetting('theme', chip.dataset.theme)
    dom.body.setAttribute('data-theme', chip.dataset.theme)
    document.querySelectorAll('.theme-chip').forEach(c => c.classList.remove('active'))
    chip.classList.add('active')
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
  })

  // Keyboard shortcut: Space to toggle
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && e.target === document.body) {
      e.preventDefault()
      toggleTimer()
    }
  })
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

  if (state.settings.sound) playStartChime()

  state.intervalId = setInterval(tick, 1000)
  tick() // immediate first tick
}

function pauseTimer() {
  state.running = false
  state.paused = true
  clearInterval(state.intervalId)
  state.intervalId = null
  dom.btnStart.textContent = 'Resume'
  setBodyOpacity(state.settings.opacityIdle)
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

  // Tick sound on last 3 seconds
  if (state.timeLeft <= 3 && state.timeLeft > 0 && state.settings.sound) {
    playTick()
  }
}

function completeSession() {
  clearInterval(state.intervalId)
  state.intervalId = null
  state.running = false
  dom.btnStart.textContent = 'Start'

  updateTimerDisplay()
  updateRing(0)
  setBodyOpacity(1.0)

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

  // Auto-start
  const shouldAutoStart =
    (previousMode === 'focus' && state.settings.autoStartBreaks) ||
    (previousMode !== 'focus' && state.settings.autoStartFocus)

  if (shouldAutoStart) {
    setTimeout(() => startTimer(), 600)
  }
}

function skipSession() {
  const wasFocus = state.mode === 'focus'

  if (state.running) {
    clearInterval(state.intervalId)
    state.intervalId = null
  }
  state.running = false
  dom.btnStart.textContent = 'Start'
  setBodyOpacity(1.0)

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

  // Auto-start next session after skip
  const shouldAutoStart =
    (wasFocus && state.settings.autoStartBreaks) ||
    (!wasFocus && state.settings.autoStartFocus)

  if (shouldAutoStart) {
    setTimeout(() => startTimer(), 500)
  }
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
}

function setMode(mode) {
  state.mode = mode
  resetCurrentModeTime()
  dom.body.setAttribute('data-state', mode)
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
}

function closeSettings() {
  dom.settingsPanel.classList.add('panel-hidden')
  applySettings()
}

function resetSettings() {
  state.settings = { ...DEFAULTS }
  saveSettings()
  applySettings()
  setBodyOpacity(state.settings.opacityIdle)
  updateTimerDisplay()
  updateRing(1)
  setRandomPhrase()
  closeSettings()
}

// ── Start ─────────────────────────────────────
init()
