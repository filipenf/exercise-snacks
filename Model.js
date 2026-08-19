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
var HistoryKeepDays = 30
var DonutMaxSlices = 6
var DonutMinPct = 3
var ArcGapDeg = 1.5
var WeekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
var MonthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

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

function formatReps(count) {
  var n = Math.max(0, Math.round(finiteNumber(count, 0)))
  return n === 1 ? "1 rep" : (n + " reps")
}

function hasTotals(totals) {
  if (!totals) return false
  for (var name in totals) {
    if (Math.round(finiteNumber(totals[name], 0)) > 0) return true
  }
  return false
}

function parseDateKey(key) {
  var parts = String(key || "").split("-")
  if (parts.length !== 3) return null
  var year = Number(parts[0])
  var month = Number(parts[1])
  var day = Number(parts[2])
  if (!isFinite(year) || !isFinite(month) || !isFinite(day)) return null
  var date = new Date(year, month - 1, day)
  if (isNaN(date.getTime())) return null
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day)
    return null
  return date
}

function prevDateKey(key) {
  var date = parseDateKey(key)
  if (!date) return ""
  date.setDate(date.getDate() - 1)
  return dateKey(date.getTime())
}

function weekKeys(todayKey) {
  if (!todayKey) return []
  var keys = []
  var key = todayKey
  for (var i = 0; i < 7; i++) {
    keys.unshift(key)
    key = prevDateKey(key)
    if (!key) break
  }
  return keys
}

function weekdayLabel(key) {
  var date = parseDateKey(key)
  return date ? WeekdayNames[date.getDay()] : ""
}

function formatDateLabel(key) {
  var date = parseDateKey(key)
  if (!date) return ""
  return MonthNames[date.getMonth()] + " " + date.getDate()
}

function dayLabel(key, todayKey) {
  if (!key) return ""
  if (key === todayKey) return "Today"
  return formatDateLabel(key)
}

function totalsSum(totals) {
  var sum = 0
  var source = totals || {}
  for (var name in source) sum += Math.max(0, Math.round(finiteNumber(source[name], 0)) || 0)
  return sum
}

function normalizeDayTotals(raw) {
  if (!raw) return {}
  if (raw.totals) return parseReps(raw.totals)
  return parseReps(raw)
}

function normalizeDays(raw) {
  var out = {}
  if (!raw) return out
  for (var key in raw) {
    if (!parseDateKey(key)) continue
    var totals = normalizeDayTotals(raw[key])
    if (hasTotals(totals)) out[key] = totals
  }
  return out
}

function pruneDays(days, todayKey, keepDays) {
  var source = normalizeDays(days)
  var keep = Math.max(1, Math.round(finiteNumber(keepDays, HistoryKeepDays)))
  if (!todayKey) return source
  var cutoff = todayKey
  for (var i = 1; i < keep; i++) {
    var previous = prevDateKey(cutoff)
    if (!previous) break
    cutoff = previous
  }
  var out = {}
  for (var key in source) {
    if (key >= cutoff) out[key] = source[key]
  }
  return out
}

function syncHistory(days, today, nowMs) {
  var nowKey = dateKey(nowMs)
  var history = normalizeDays(days)
  var current = today && today.date
    ? { date: String(today.date), totals: parseReps(today.totals) }
    : emptyToday(nowMs)
  if (current.date && current.date !== nowKey) {
    if (hasTotals(current.totals)) history[current.date] = current.totals
    current = emptyToday(nowMs)
  }
  if (hasTotals(current.totals)) history[nowKey] = cloneObject(current.totals)
  history = pruneDays(history, nowKey, HistoryKeepDays)
  return {
    days: history,
    today: {
      date: nowKey,
      totals: history[nowKey] ? cloneObject(history[nowKey]) : {}
    }
  }
}

function mergeHistory(days, today, reps, nowMs) {
  return syncHistory(days, mergeTotals(today, reps, nowMs), nowMs)
}

function totalsForDay(days, today, key) {
  var todayKey = today && today.date ? String(today.date) : ""
  if (!key || key === todayKey) return parseReps(today && today.totals)
  var history = normalizeDays(days)
  return history[key] ? cloneObject(history[key]) : {}
}

function weekTrend(days, today, todayKey) {
  var key = todayKey || (today && today.date) || ""
  var history = normalizeDays(days)
  if (today && today.date && hasTotals(today.totals))
    history[today.date] = parseReps(today.totals)
  var keys = weekKeys(key)
  var out = []
  for (var i = 0; i < keys.length; i++) {
    var day = keys[i]
    out.push({
      key: day,
      count: totalsSum(history[day]),
      label: weekdayLabel(day),
      isToday: day === key
    })
  }
  return out
}

function exerciseSlices(totals) {
  var rows = todayTotalsList({ totals: totals })
  rows.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count
    if (a.name < b.name) return -1
    if (a.name > b.name) return 1
    return 0
  })
  var total = 0
  for (var i = 0; i < rows.length; i++) total += rows[i].count
  for (var j = 0; j < rows.length; j++)
    rows[j].pct = total > 0 ? Math.round(100 * rows[j].count / total) : 0
  return rows
}

function groupedExercises(rows, maxSlices, minPct) {
  var list = rows || []
  var max = typeof maxSlices === "number" ? maxSlices : DonutMaxSlices
  var floor = typeof minPct === "number" ? minPct : DonutMinPct
  var total = 0
  for (var j = 0; j < list.length; j++) total += Number(list[j].count) || 0
  var head = []
  var tailCount = 0
  for (var i = 0; i < list.length; i++) {
    var pct = total > 0 ? (Number(list[i].count) || 0) / total * 100 : 0
    if (head.length < max - 1 && pct >= floor) head.push(list[i])
    else tailCount += Number(list[i].count) || 0
  }
  if (tailCount > 0) {
    head.push({
      name: "Other",
      count: tailCount,
      pct: total > 0 ? Math.round(100 * tailCount / total) : 0
    })
  }
  return head
}

function hexToHsl(hex) {
  var raw = String(hex || "").replace(/^\s+|\s+$/g, "")
  var m6 = /^#?([0-9a-fA-F]{6})$/.exec(raw)
  var m8 = /^#?([0-9a-fA-F]{8})$/.exec(raw)
  var digits = m6 ? m6[1] : (m8 ? m8[1].slice(2) : "")
  if (!digits) return { h: 0, s: 0, l: 60 }
  var n = parseInt(digits, 16)
  var r = ((n >> 16) & 255) / 255
  var g = ((n >> 8) & 255) / 255
  var b = (n & 255) / 255
  var max = Math.max(r, g, b)
  var min = Math.min(r, g, b)
  var h = 0
  var s = 0
  var l = (max + min) / 2
  if (max !== min) {
    var d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h: h, s: s * 100, l: l * 100 }
}

function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360
  s /= 100
  l /= 100
  var c = (1 - Math.abs(2 * l - 1)) * s
  var x = c * (1 - Math.abs((h / 60) % 2 - 1))
  var m = l - c / 2
  var r = 0
  var g = 0
  var b = 0
  if (h < 60) { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) { g = c; b = x }
  else if (h < 240) { g = x; b = c }
  else if (h < 300) { r = x; b = c }
  else { r = c; b = x }
  function ch(v) {
    var t = Math.max(0, Math.min(255, Math.round((v + m) * 255)))
    return (t < 16 ? "0" : "") + t.toString(16)
  }
  return "#" + ch(r) + ch(g) + ch(b)
}

function sliceColors(count, accentHex) {
  var base = hexToHsl(accentHex)
  var grayRamp = [50, 70, 32, 82, 40, 62]
  var out = []
  for (var i = 0; i < count; i++) {
    var h = base.h + i * 38
    var l = base.l
    if (base.s < 12) l = grayRamp[i % grayRamp.length]
    else if (i % 2 === 1) l = Math.max(32, Math.min(80, base.l - 14))
    out.push(hslToHex(h, base.s, l))
  }
  return out
}

function arcSegments(items) {
  var list = items || []
  var total = 0
  for (var i = 0; i < list.length; i++) total += Math.max(0, Number(list[i].count) || 0)
  var gap = list.length > 1 ? ArcGapDeg : 0
  var angle = -90
  var out = []
  for (var j = 0; j < list.length; j++) {
    var frac = total > 0 ? (Number(list[j].count) || 0) / total : 0
    var sweep = j < list.length - 1 ? Math.max(0, frac * 360 - gap) : frac * 360
    out.push({
      name: list[j].name,
      count: list[j].count,
      pct: list[j].pct,
      startAngle: angle,
      sweepAngle: sweep
    })
    angle += frac * 360
  }
  return out
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
    days: {},
    timer: stoppedState({}, nowMs),
    selected: []
  }
}

function parseDocument(raw, config, nowMs) {
  var now = finiteNumber(nowMs, Date.now())
  var source = raw || {}
  var exercises = normalizeExercises(source.exercises)
  var selected = normalizeSelected(source.selected, exercises)
  var synced = syncHistory(source.days, source.today, now)
  var recovered = recoverInterrupted(source.timer, config, now)
  return {
    version: StateVersion,
    exercises: exercises,
    today: synced.today,
    days: synced.days,
    timer: recovered.state,
    selected: selected,
    notify: recovered.notify
  }
}

function serializeDocument(doc, nowMs) {
  var now = finiteNumber(nowMs, Date.now())
  var synced = syncHistory(doc && doc.days, doc && doc.today, now)
  return {
    version: StateVersion,
    exercises: normalizeExercises(doc && doc.exercises),
    today: synced.today,
    days: synced.days,
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
    HistoryKeepDays: HistoryKeepDays,
    DonutMaxSlices: DonutMaxSlices,
    DonutMinPct: DonutMinPct,
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
    formatReps: formatReps,
    prevDateKey: prevDateKey,
    weekKeys: weekKeys,
    weekdayLabel: weekdayLabel,
    formatDateLabel: formatDateLabel,
    dayLabel: dayLabel,
    totalsSum: totalsSum,
    normalizeDays: normalizeDays,
    pruneDays: pruneDays,
    syncHistory: syncHistory,
    mergeHistory: mergeHistory,
    totalsForDay: totalsForDay,
    weekTrend: weekTrend,
    exerciseSlices: exerciseSlices,
    groupedExercises: groupedExercises,
    sliceColors: sliceColors,
    arcSegments: arcSegments,
    overlayStep: overlayStep,
    overlayOpen: overlayOpen,
    recoverInterrupted: recoverInterrupted,
    emptyDocument: emptyDocument,
    parseDocument: parseDocument,
    serializeDocument: serializeDocument
  }
}
