const test = require("node:test")
const assert = require("node:assert/strict")
const Model = require("../Model.js")
const Tips = require("../Tips.js")

const config = Model.normalizeConfig({
  workMinutes: 25,
  snackSeconds: 120
})

test("idle longer than two minutes pauses the current interval", () => {
  assert.equal(Model.IdlePauseSeconds, 120)
})

test("normalizeConfig clamps to the manifest ranges", () => {
  assert.deepEqual(
    Model.normalizeConfig({ workMinutes: 0, snackSeconds: 9999 }),
    { workMinutes: 1, snackSeconds: 600 }
  )
  assert.deepEqual(
    Model.normalizeConfig({ workMinutes: 200, snackSeconds: 1 }),
    { workMinutes: 120, snackSeconds: 15 }
  )
  assert.deepEqual(Model.normalizeConfig({}), { workMinutes: 45, snackSeconds: 120 })
})

test("a new work interval counts down from the configured duration", () => {
  const state = Model.startWork(config, 1000)
  assert.equal(state.status, Model.StatusRunning)
  assert.equal(state.phase, Model.PhaseWork)
  assert.equal(state.deadlineMs, 1000 + 25 * 60 * 1000)
  assert.equal(Model.remainingSeconds(state, 61 * 1000), 24 * 60)
  assert.equal(Model.formatRemaining(Model.remainingSeconds(state, 61 * 1000)), "24:00")
})

test("pause freezes remaining time and resume continues from there", () => {
  let state = Model.startWork(config, 0)
  state = Model.pause(state, 60 * 1000)
  assert.equal(state.status, Model.StatusPaused)
  assert.equal(state.remainingSec, 24 * 60)
  assert.equal(Model.remainingSeconds(state, 10 * 60 * 1000), 24 * 60)
  state = Model.resume(state, 10 * 60 * 1000)
  assert.equal(state.status, Model.StatusRunning)
  assert.equal(state.deadlineMs, 10 * 60 * 1000 + 24 * 60 * 1000)
})

test("an expired work interval becomes picking", () => {
  const running = Model.startWork(config, 0)
  const recovered = Model.recoverInterrupted(running, config, 25 * 60 * 1000)
  assert.equal(recovered.state.status, Model.StatusPicking)
  assert.equal(recovered.notify, "pick")
  assert.equal(Model.overlayStep(recovered.state.status, recovered.state.phase), "pick")
  assert.equal(Model.overlayOpen(recovered.state.status, recovered.state.phase), true)
  assert.equal(Model.barLabel(recovered.state.status, "00:00"), "SNACK")
  assert.equal(Model.phaseLabel(recovered.state.status, recovered.state.phase), "Snack time")
})

test("starting a snack uses snackSeconds, then expiry becomes logging", () => {
  const snack = Model.startSnack(config, 5000)
  assert.equal(snack.phase, Model.PhaseSnack)
  assert.equal(snack.phaseDurationSec, 120)
  assert.equal(Model.overlayStep(snack.status, snack.phase), "snack")
  const recovered = Model.recoverInterrupted(snack, config, 5000 + 120 * 1000)
  assert.equal(recovered.state.status, Model.StatusLogging)
  assert.equal(recovered.notify, "log")
  assert.equal(Model.overlayStep(recovered.state.status, recovered.state.phase), "log")
  assert.equal(Model.barLabel(recovered.state.status, "00:00"), "LOG")
})

test("a still-running snack survives a restart", () => {
  const snack = Model.startSnack(config, 1000)
  const recovered = Model.recoverInterrupted(snack, config, 31 * 1000)
  assert.equal(recovered.state.status, Model.StatusRunning)
  assert.equal(recovered.state.phase, Model.PhaseSnack)
  assert.equal(Model.remainingSeconds(recovered.state, 31 * 1000), 90)
  assert.equal(recovered.notify, "")
})

test("today rolls over at local midnight and merge adds reps", () => {
  const morning = Date.parse("2026-08-18T09:00:00")
  const nextDay = Date.parse("2026-08-19T09:00:00")
  const started = Model.mergeTotals(null, { "Push-ups": 10 }, morning)
  assert.equal(started.date, Model.dateKey(morning))
  assert.equal(started.totals["Push-ups"], 10)

  const added = Model.mergeTotals(started, { "Push-ups": 5, "Air squats": 20 }, morning)
  assert.equal(added.totals["Push-ups"], 15)
  assert.equal(added.totals["Air squats"], 20)
  assert.equal(Model.formatTodayTotals(added), "Air squats 20 · Push-ups 15")

  const rolled = Model.rollToday(added, nextDay)
  assert.equal(rolled.date, Model.dateKey(nextDay))
  assert.deepEqual(rolled.totals, {})
  assert.equal(Model.formatTodayTotals(rolled), "No snacks logged today")
})

test("parseReps drops zeros and non-numbers", () => {
  assert.deepEqual(Model.parseReps({ "Push-ups": 12, "Air squats": 0, junk: "nope" }), {
    "Push-ups": 12
  })
})

test("the catalog ignores blanks and duplicates, and never empties", () => {
  assert.deepEqual(
    Model.normalizeExercises([" Push-ups ", "push-ups", "", "Air squats"]),
    ["Push-ups", "Air squats"]
  )
  assert.deepEqual(Model.addExercise(["Push-ups"], "  Pull-ups "), ["Push-ups", "Pull-ups"])
  assert.deepEqual(Model.addExercise(["Push-ups"], "push-ups"), ["Push-ups"])
  assert.deepEqual(Model.addExercise(["Push-ups"], "   "), ["Push-ups"])
  assert.deepEqual(Model.removeExercise(["Push-ups", "Air squats"], "Push-ups"), ["Air squats"])
  assert.deepEqual(Model.removeExercise(["Push-ups"], "Push-ups"), Model.DefaultExercises)
})

test("selection is a toggle against the catalog", () => {
  const exercises = ["Push-ups", "Pull-ups", "Air squats"]
  let selected = Model.toggleSelected([], exercises, "Air squats")
  selected = Model.toggleSelected(selected, exercises, "Push-ups")
  assert.deepEqual(selected, ["Air squats", "Push-ups"])
  assert.equal(Model.isSelected(selected, "push-ups"), true)
  selected = Model.toggleSelected(selected, exercises, "Air squats")
  assert.deepEqual(selected, ["Push-ups"])
  assert.deepEqual(Model.normalizeSelected(["Lunges", "Push-ups"], exercises), ["Push-ups"])
})

test("parseDocument restores timer, catalog, and today's log", () => {
  const now = Date.parse("2026-08-18T12:00:00")
  const parsed = Model.parseDocument({
    version: 1,
    exercises: ["Push-ups", "Lunges"],
    selected: ["Lunges"],
    today: { date: Model.dateKey(now), totals: { "Push-ups": 8 } },
    timer: Model.startWork(config, now - 60 * 1000)
  }, config, now)

  assert.deepEqual(parsed.exercises, ["Push-ups", "Lunges"])
  assert.deepEqual(parsed.selected, ["Lunges"])
  assert.equal(parsed.today.totals["Push-ups"], 8)
  assert.equal(parsed.days[Model.dateKey(now)]["Push-ups"], 8)
  assert.equal(parsed.timer.status, Model.StatusRunning)
  assert.equal(parsed.notify, "")
  assert.equal(Model.serializeDocument(parsed, now).version, 1)
})

test("history keeps yesterday when today rolls over", () => {
  const morning = Date.parse("2026-08-18T09:00:00")
  const nextDay = Date.parse("2026-08-19T09:00:00")
  const logged = Model.mergeHistory({}, null, { "Push-ups": 10, "Air squats": 20 }, morning)
  assert.equal(logged.today.totals["Push-ups"], 10)
  assert.equal(logged.days[Model.dateKey(morning)]["Air squats"], 20)

  const rolled = Model.syncHistory(logged.days, logged.today, nextDay)
  assert.equal(rolled.today.date, Model.dateKey(nextDay))
  assert.deepEqual(rolled.today.totals, {})
  assert.equal(rolled.days[Model.dateKey(morning)]["Push-ups"], 10)
  assert.equal(rolled.days[Model.dateKey(nextDay)], undefined)

  const later = Model.mergeHistory(rolled.days, rolled.today, { "Pull-ups": 5 }, nextDay)
  assert.equal(later.today.totals["Pull-ups"], 5)
  assert.equal(later.days[Model.dateKey(morning)]["Push-ups"], 10)
})

test("old state without days migrates today's log into history", () => {
  const now = Date.parse("2026-08-19T12:00:00")
  const parsed = Model.parseDocument({
    today: { date: Model.dateKey(now), totals: { "Air squats": 40 } }
  }, config, now)
  assert.equal(parsed.days[Model.dateKey(now)]["Air squats"], 40)
})

test("pruneDays drops history older than the keep window", () => {
  const today = "2026-08-19"
  const days = {
    "2026-07-01": { "Push-ups": 9 },
    "2026-08-18": { "Push-ups": 4 },
    "2026-08-19": { "Air squats": 40 }
  }
  const pruned = Model.pruneDays(days, today, 7)
  assert.equal(pruned["2026-07-01"], undefined)
  assert.equal(pruned["2026-08-18"]["Push-ups"], 4)
  assert.equal(pruned["2026-08-19"]["Air squats"], 40)
})

test("weekTrend is seven days ending today, oldest first", () => {
  const now = Date.parse("2026-08-19T12:00:00")
  const todayKey = Model.dateKey(now)
  const yesterday = Model.prevDateKey(todayKey)
  const days = {
    [yesterday]: { "Push-ups": 12, "Air squats": 8 },
    [todayKey]: { "Air squats": 40 }
  }
  const today = { date: todayKey, totals: { "Air squats": 40 } }
  const trend = Model.weekTrend(days, today, todayKey)
  const series = Model.weekSeries(days, today, todayKey)

  assert.equal(trend.length, 7)
  assert.equal(trend[6].key, todayKey)
  assert.equal(trend[6].count, 40)
  assert.equal(trend[6].isToday, true)
  assert.deepEqual(trend[6].stacks, [{ name: "Air squats", count: 40 }])
  assert.equal(trend[5].key, yesterday)
  assert.equal(trend[5].count, 20)
  assert.deepEqual(trend[5].stacks, [
    { name: "Air squats", count: 8 },
    { name: "Push-ups", count: 12 }
  ])
  assert.equal(trend[0].count, 0)
  assert.deepEqual(trend[0].stacks, [])
  assert.deepEqual(series.map((row) => row.name), ["Air squats", "Push-ups"])
  assert.equal(series[0].count, 48)
  assert.equal(Model.weekdayLabel(todayKey).length, 3)
  assert.equal(
    Model.formatStacksTooltip(trend[5].stacks),
    "Air squats 8\nPush-ups 12"
  )
  assert.equal(Model.formatStacksTooltip([]), "No snacks logged")
})

test("donut slices sort by count and fold the tail into Other", () => {
  const slices = Model.exerciseSlices({
    "Air squats": 40,
    "Push-ups": 31,
    "Neck stretch": 1
  })
  assert.equal(slices[0].name, "Air squats")
  assert.equal(slices[0].count, 40)
  assert.ok(slices[0].pct > slices[2].pct)

  const grouped = Model.groupedExercises([
    { name: "A", count: 100, pct: 70 },
    { name: "B", count: 30, pct: 21 },
    { name: "C", count: 8, pct: 6 },
    { name: "D", count: 4, pct: 3 },
    { name: "E", count: 1, pct: 1 }
  ], 3, 5)
  assert.equal(grouped.length, 3)
  assert.equal(grouped[0].name, "A")
  assert.equal(grouped[2].name, "Other")
  assert.equal(grouped[2].count, 13)

  const segs = Model.arcSegments(grouped)
  assert.equal(segs.length, 3)
  assert.ok(segs[0].sweepAngle > segs[2].sweepAngle)
  assert.equal(Model.sliceColors(3, "#6ee7b7").length, 3)
  assert.equal(Model.formatReps(1), "1 rep")
  assert.equal(Model.formatReps(40), "40 reps")
  assert.equal(Model.dayLabel("2026-08-19", "2026-08-19"), "Today")
  assert.equal(Model.dayLabel("2026-08-18", "2026-08-19"), "Aug 18")
})

test("tip of the day is stable for a local date and walks the list", () => {
  const dayA = Date.parse("2026-08-18T08:00:00")
  const laterSameDay = Date.parse("2026-08-18T23:00:00")
  const dayB = Date.parse("2026-08-19T08:00:00")
  const tipA = Tips.tipOfTheDay(dayA)
  const tipLater = Tips.tipOfTheDay(laterSameDay)
  const tipB = Tips.tipOfTheDay(dayB)
  assert.equal(tipA.title, tipLater.title)
  assert.equal(tipA.body, tipLater.body)
  assert.ok(tipA.title.length > 0)
  assert.ok(tipA.body.length > 0)
  assert.equal(Tips.links().length, 4)
  assert.ok(Tips.TIPS.length > 1)
  const titles = new Set(Tips.TIPS.map((tip) => tip.title))
  assert.ok(titles.has(tipB.title))
})
