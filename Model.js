// Pure timer, catalog, and log helpers shared by QML and the Node tests.

var StateVersion = 1
var StatusStopped = "stopped"
var StatusRunning = "running"
var StatusPaused = "paused"
var StatusPicking = "picking"
var StatusLogging = "logging"
var PhaseWork = "work"
var PhaseSnack = "snack"
var DefaultExercises = ["Push-ups", "Pull-ups", "Air squats"]
var IdleResetSeconds = 120

function finiteNumber(value, fallback) {
  var parsed = Number(value)
  return isFinite(parsed) ? parsed : fallback
}

function boundedInteger(value, fallback, minimum, maximum) {
  var parsed = Math.round(finiteNumber(value, fallback))
  return Math.max(minimum, Math.min(maximum, parsed))
}

function cloneObject(value) {
  var copy = {}
  if (!value) return copy
  for (var key in value) copy[key] = value[key]
  return copy
}

function cloneArray(value) {
  var copy = []
  if (!value || !value.length) return copy
  for (var i = 0; i < value.length; i++) copy.push(value[i])
  return copy
}

function normalizeConfig(settings) {
  var values = settings || {}
  return {
    workMinutes: boundedInteger(values.workMinutes, 25, 1, 120),
    snackSeconds: boundedInteger(values.snackSeconds, 120, 15, 600)
  }
}

function isStatus(value) {
  return value === StatusStopped || value === StatusRunning || value === StatusPaused
    || value === StatusPicking || value === StatusLogging
}

function isPhase(value) {
  return value === PhaseWork || value === PhaseSnack
}

function durationSeconds(phase, config) {
  var values = normalizeConfig(config)
  if (phase === PhaseSnack) return values.snackSeconds
  return values.workMinutes * 60
}

function phaseLabel(status, phase) {
  if (status === StatusPicking) return "Snack time"
  if (status === StatusLogging) return "Log reps"
  if (phase === PhaseSnack) return "Snack"
  return "Work"
}

function barLabel(status, remainingText) {
  if (status === StatusPicking) return "SNACK"
  if (status === StatusLogging) return "LOG"
  return remainingText
}

function stoppedState(config, nowMs) {
  var duration = durationSeconds(PhaseWork, config)
  return {
    version: StateVersion,
    status: StatusStopped,
    phase: PhaseWork,
    phaseDurationSec: duration,
    remainingSec: duration,
    startedAtMs: 0,
    deadlineMs: 0,
    updatedAtMs: finiteNumber(nowMs, 0)
  }
}

function runningPhase(phase, durationSec, nowMs) {
  var now = finiteNumber(nowMs, 0)
  var duration = Math.max(1, finiteNumber(durationSec, 1))
  return {
    version: StateVersion,
    status: StatusRunning,
    phase: isPhase(phase) ? phase : PhaseWork,
    phaseDurationSec: duration,
    remainingSec: duration,
    startedAtMs: now,
    deadlineMs: now + duration * 1000,
    updatedAtMs: now
  }
}

function pickingState(nowMs) {
  var now = finiteNumber(nowMs, 0)
  return {
    version: StateVersion,
    status: StatusPicking,
    phase: PhaseSnack,
    phaseDurationSec: 0,
    remainingSec: 0,
    startedAtMs: now,
    deadlineMs: 0,
    updatedAtMs: now
  }
}

function loggingState(nowMs) {
  var now = finiteNumber(nowMs, 0)
  return {
    version: StateVersion,
    status: StatusLogging,
    phase: PhaseSnack,
    phaseDurationSec: 0,
    remainingSec: 0,
    startedAtMs: now,
    deadlineMs: 0,
    updatedAtMs: now
  }
}

function startWork(config, nowMs) {
  return runningPhase(PhaseWork, durationSeconds(PhaseWork, config), nowMs)
}

function startSnack(config, nowMs) {
  return runningPhase(PhaseSnack, durationSeconds(PhaseSnack, config), nowMs)
}

function remainingMilliseconds(state, nowMs) {
  if (!state) return 0
  if (state.status === StatusRunning)
    return Math.max(0, finiteNumber(state.deadlineMs, 0) - finiteNumber(nowMs, 0))
  if (state.status === StatusPaused)
    return Math.max(0, finiteNumber(state.remainingSec, 0) * 1000)
  return 0
}

function remainingSeconds(state, nowMs) {
  return Math.ceil(remainingMilliseconds(state, nowMs) / 1000)
}

function elapsedProgress(state, nowMs) {
  if (!state) return 0
  if (state.status === StatusPicking || state.status === StatusLogging) return 1
  var totalMs = Math.max(1000, finiteNumber(state.phaseDurationSec, 1) * 1000)
  var elapsed = totalMs - remainingMilliseconds(state, nowMs)
  return Math.max(0, Math.min(1, elapsed / totalMs))
}

function pause(state, nowMs) {
  if (!state || state.status !== StatusRunning) return state
  var now = finiteNumber(nowMs, 0)
  var remaining = remainingMilliseconds(state, now) / 1000
  var next = cloneObject(state)
  next.status = StatusPaused
  next.remainingSec = Math.max(0, remaining)
  next.deadlineMs = 0
  next.updatedAtMs = now
  return next
}

function resume(state, nowMs) {
  if (!state || state.status !== StatusPaused) return state
  var now = finiteNumber(nowMs, 0)
  var remaining = Math.max(1, finiteNumber(state.remainingSec, 1))
  var total = Math.max(remaining, finiteNumber(state.phaseDurationSec, remaining))
  var next = cloneObject(state)
  next.status = StatusRunning
  next.phaseDurationSec = total
  next.remainingSec = remaining
  next.startedAtMs = now - (total - remaining) * 1000
  next.deadlineMs = now + remaining * 1000
  next.updatedAtMs = now
  return next
}

function formatRemaining(seconds) {
  var value = Math.max(0, Math.ceil(finiteNumber(seconds, 0)))
  var minutes = Math.floor(value / 60)
  var remainder = value % 60
  return String(minutes).padStart(2, "0") + ":" + String(remainder).padStart(2, "0")
}

function dateKey(nowMs) {
  var date = new Date(finiteNumber(nowMs, Date.now()))
  var year = date.getFullYear()
  var month = String(date.getMonth() + 1).padStart(2, "0")
  var day = String(date.getDate()).padStart(2, "0")
  return year + "-" + month + "-" + day
}

function emptyToday(nowMs) {
  return { date: dateKey(nowMs), totals: {} }
}

function rollToday(today, nowMs) {
  var key = dateKey(nowMs)
  if (!today || today.date !== key) return emptyToday(nowMs)
  return { date: today.date, totals: cloneObject(today.totals) }
}

function normalizeName(name) {
  return String(name || "").replace(/\s+/g, " ").trim()
}

function defaultExercises() {
  return cloneArray(DefaultExercises)
}

function normalizeExercises(list) {
  var result = []
  var seen = {}
  var source = list && list.length ? list : DefaultExercises
  for (var i = 0; i < source.length; i++) {
    var name = normalizeName(source[i])
    if (!name) continue
    var key = name.toLowerCase()
    if (seen[key]) continue
    seen[key] = true
    result.push(name)
  }
  return result.length ? result : defaultExercises()
}

function addExercise(exercises, name) {
  var nextName = normalizeName(name)
  if (!nextName) return normalizeExercises(exercises)
  var next = normalizeExercises(exercises)
  var key = nextName.toLowerCase()
  for (var i = 0; i < next.length; i++) {
    if (next[i].toLowerCase() === key) return next
  }
  next.push(nextName)
  return next
}

function removeExercise(exercises, name) {
  var key = normalizeName(name).toLowerCase()
  var next = []
  var source = normalizeExercises(exercises)
  for (var i = 0; i < source.length; i++) {
    if (source[i].toLowerCase() !== key) next.push(source[i])
  }
  return next.length ? next : defaultExercises()
}

function normalizeSelected(selected, exercises) {
  var catalog = normalizeExercises(exercises)
  var allowed = {}
  for (var i = 0; i < catalog.length; i++) allowed[catalog[i].toLowerCase()] = catalog[i]
  var result = []
  var seen = {}
  var source = selected || []
  for (var j = 0; j < source.length; j++) {
    var name = normalizeName(source[j])
    var key = name.toLowerCase()
    if (!allowed[key] || seen[key]) continue
    seen[key] = true
    result.push(allowed[key])
  }
  return result
}

function toggleSelected(selected, exercises, name) {
  var catalogName = normalizeName(name)
  var current = normalizeSelected(selected, exercises)
  var key = catalogName.toLowerCase()
  var next = []
  var found = false
  for (var i = 0; i < current.length; i++) {
    if (current[i].toLowerCase() === key) {
      found = true
      continue
    }
    next.push(current[i])
  }
  if (!found) {
    var allowed = normalizeSelected([catalogName], exercises)
    if (allowed.length) next.push(allowed[0])
  }
  return next
}

function isSelected(selected, name) {
  var key = normalizeName(name).toLowerCase()
  var source = selected || []
  for (var i = 0; i < source.length; i++) {
    if (normalizeName(source[i]).toLowerCase() === key) return true
  }
  return false
}

function parseReps(raw) {
  var reps = {}
  if (!raw) return reps
  for (var name in raw) {
    var count = Math.max(0, Math.round(finiteNumber(raw[name], 0)))
    if (count > 0) reps[normalizeName(name) || name] = count
  }
  return reps
}

function mergeTotals(today, reps, nowMs) {
  var next = rollToday(today, nowMs)
  var totals = cloneObject(next.totals)
  var parsed = parseReps(reps)
  for (var name in parsed) {
    totals[name] = (finiteNumber(totals[name], 0) || 0) + parsed[name]
  }
  next.totals = totals
  return next
}

function todayTotalsList(today) {
  var totals = today && today.totals ? today.totals : {}
  var rows = []
  for (var name in totals) {
    var count = Math.round(finiteNumber(totals[name], 0))
    if (count > 0) rows.push({ name: name, count: count })
  }
  rows.sort(function (a, b) {
    if (a.name < b.name) return -1
    if (a.name > b.name) return 1
    return 0
  })
  return rows
}

function formatTodayTotals(today) {
  var rows = todayTotalsList(today)
  if (!rows.length) return "No snacks logged today"
  var parts = []
  for (var i = 0; i < rows.length; i++) parts.push(rows[i].name + " " + rows[i].count)
  return parts.join(" · ")
}

function overlayStep(status, phase) {
  if (status === StatusPicking) return "pick"
  if (status === StatusLogging) return "log"
  if (phase === PhaseSnack && (status === StatusRunning || status === StatusPaused)) return "snack"
  return ""
}

function overlayOpen(status, phase) {
  return overlayStep(status, phase) !== ""
}

function sanitizeTimer(raw, config, nowMs) {
  var now = finiteNumber(nowMs, 0)
  if (!raw || Number(raw.version) !== StateVersion || !isStatus(raw.status) || !isPhase(raw.phase))
    return stoppedState(config, now)

  var status = raw.status
  var phase = raw.phase
  if (status === StatusPicking) return pickingState(now)
  if (status === StatusLogging) return loggingState(now)

  var fallbackDuration = durationSeconds(phase, config)
  var duration = Math.max(1, finiteNumber(raw.phaseDurationSec, fallbackDuration))
  var remaining = Math.max(0, Math.min(duration, finiteNumber(raw.remainingSec, duration)))
  if (status === StatusPaused && remaining <= 0) remaining = 1

  return {
    version: StateVersion,
    status: status,
    phase: phase,
    phaseDurationSec: duration,
    remainingSec: status === StatusRunning
      ? Math.max(0, finiteNumber(raw.remainingSec, duration))
      : remaining,
    startedAtMs: Math.max(0, finiteNumber(raw.startedAtMs, 0)),
    deadlineMs: status === StatusRunning ? Math.max(0, finiteNumber(raw.deadlineMs, 0)) : 0,
    updatedAtMs: Math.max(0, finiteNumber(raw.updatedAtMs, now))
  }
}

function recoverInterrupted(state, config, nowMs) {
  var now = finiteNumber(nowMs, 0)
  var clean = sanitizeTimer(state, config, now)
  if (clean.status === StatusStopped)
    return { state: stoppedState(config, now), notify: "" }
  if (clean.status === StatusPaused || clean.status === StatusPicking || clean.status === StatusLogging)
    return { state: clean, notify: "" }

  if (finiteNumber(clean.deadlineMs, 0) > now) {
    clean.remainingSec = remainingMilliseconds(clean, now) / 1000
    clean.updatedAtMs = now
    return { state: clean, notify: "" }
  }

  if (clean.phase === PhaseSnack)
    return { state: loggingState(now), notify: "log" }
  return { state: pickingState(now), notify: "pick" }
}

function serializableTimer(state, nowMs) {
  var next = cloneObject(state)
  var now = finiteNumber(nowMs, 0)
  if (next.status === StatusRunning)
    next.remainingSec = remainingMilliseconds(next, now) / 1000
  next.updatedAtMs = now
  return next
}

function emptyDocument(nowMs) {
  return {
    version: StateVersion,
    exercises: defaultExercises(),
    today: emptyToday(nowMs),
    timer: stoppedState({}, nowMs),
    selected: []
  }
}

function parseDocument(raw, config, nowMs) {
  var now = finiteNumber(nowMs, Date.now())
  var source = raw || {}
  var exercises = normalizeExercises(source.exercises)
  var selected = normalizeSelected(source.selected, exercises)
  var today = rollToday(source.today, now)
  var recovered = recoverInterrupted(source.timer, config, now)
  return {
    version: StateVersion,
    exercises: exercises,
    today: today,
    timer: recovered.state,
    selected: selected,
    notify: recovered.notify
  }
}

function serializeDocument(doc, nowMs) {
  var now = finiteNumber(nowMs, Date.now())
  return {
    version: StateVersion,
    exercises: normalizeExercises(doc && doc.exercises),
    today: rollToday(doc && doc.today, now),
    timer: serializableTimer((doc && doc.timer) || stoppedState({}, now), now),
    selected: normalizeSelected(doc && doc.selected, doc && doc.exercises)
  }
}

if (typeof module !== "undefined") {
  module.exports = {
    StateVersion: StateVersion,
    StatusStopped: StatusStopped,
    StatusRunning: StatusRunning,
    StatusPaused: StatusPaused,
    StatusPicking: StatusPicking,
    StatusLogging: StatusLogging,
    PhaseWork: PhaseWork,
    PhaseSnack: PhaseSnack,
    DefaultExercises: DefaultExercises,
    IdleResetSeconds: IdleResetSeconds,
    normalizeConfig: normalizeConfig,
    durationSeconds: durationSeconds,
    phaseLabel: phaseLabel,
    barLabel: barLabel,
    stoppedState: stoppedState,
    startWork: startWork,
    startSnack: startSnack,
    pickingState: pickingState,
    loggingState: loggingState,
    remainingSeconds: remainingSeconds,
    elapsedProgress: elapsedProgress,
    pause: pause,
    resume: resume,
    formatRemaining: formatRemaining,
    dateKey: dateKey,
    rollToday: rollToday,
    normalizeExercises: normalizeExercises,
    addExercise: addExercise,
    removeExercise: removeExercise,
    normalizeSelected: normalizeSelected,
    toggleSelected: toggleSelected,
    isSelected: isSelected,
    parseReps: parseReps,
    mergeTotals: mergeTotals,
    todayTotalsList: todayTotalsList,
    formatTodayTotals: formatTodayTotals,
    overlayStep: overlayStep,
    overlayOpen: overlayOpen,
    recoverInterrupted: recoverInterrupted,
    emptyDocument: emptyDocument,
    parseDocument: parseDocument,
    serializeDocument: serializeDocument
  }
}
