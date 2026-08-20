import QtQuick
import Quickshell
import Quickshell.Io
import Quickshell.Wayland
import "Model.js" as Model

Item {
  id: root

  property var shell: null
  property var manifest: null
  property string omarchyPath: Quickshell.env("OMARCHY_PATH") || ""

  readonly property string pluginId: (manifest && manifest.id) ? String(manifest.id) : "filipenf.exercise-snacks"
  readonly property string stateHome: Quickshell.env("XDG_STATE_HOME")
    || ((Quickshell.env("HOME") || "") + "/.local/state")
  readonly property string stateDir: stateHome + "/omarchy"
  readonly property string statePath: stateDir + "/exercise-snacks.json"
  readonly property string notificationExecutable: omarchyPath !== ""
    ? omarchyPath + "/bin/omarchy-notification-send"
    : "omarchy-notification-send"

  property var config: Model.normalizeConfig({})
  property var exercises: Model.normalizeExercises(null)
  property var selected: []
  property var today: Model.emptyDocument(Date.now()).today
  property var days: ({})
  property var timerState: Model.stoppedState(config, Date.now())
  property double nowMs: Date.now()
  property double lastTickMs: 0
  property bool configReady: false
  property bool stateFileLoaded: false
  property bool initialized: false
  property bool stateDirReady: false
  property bool savePending: false
  property bool pausedForIdle: false
  property string loadedStateText: ""

  readonly property string status: timerState.status || Model.StatusStopped
  readonly property string phase: timerState.phase || Model.PhaseWork
  readonly property string phaseLabel: Model.phaseLabel(status, phase)
  readonly property int remainingSeconds: Model.remainingSeconds(timerState, nowMs)
  readonly property string remainingText: Model.formatRemaining(remainingSeconds)
  readonly property string labelText: Model.barLabel(status, remainingText)
  readonly property real progress: Model.elapsedProgress(timerState, nowMs)
  readonly property bool stopped: status === Model.StatusStopped
  readonly property bool running: status === Model.StatusRunning
  readonly property bool paused: status === Model.StatusPaused
  readonly property bool picking: status === Model.StatusPicking
  readonly property bool logging: status === Model.StatusLogging
  readonly property bool overlayOpen: Model.overlayOpen(status, phase)
  readonly property string overlayStep: Model.overlayStep(status, phase)
  readonly property var todayRows: Model.todayTotalsList(today)
  readonly property string todaySummary: Model.formatTodayTotals(today)
  readonly property var weekTrend: Model.weekTrend(days, today, today && today.date ? today.date : "")

  function configure(settings) {
    var next = Model.normalizeConfig(settings || {})
    if (JSON.stringify(next) !== JSON.stringify(config)) {
      config = next
      if (initialized && stopped)
        setTimer(Model.startWork(config, Date.now()), true)
    }
    configReady = true
    initializeIfReady()
  }

  function initializeIfReady() {
    if (initialized || !configReady || !stateFileLoaded) return

    var raw = null
    if (String(loadedStateText || "").trim() !== "") {
      try {
        raw = JSON.parse(loadedStateText)
      } catch (error) {
        console.warn("Exercise snacks: ignoring invalid state file:", error)
      }
    }

    var parsed = Model.parseDocument(raw, config, Date.now())
    initialized = true
    lastTickMs = Date.now()
    exercises = parsed.exercises
    selected = parsed.selected
    today = parsed.today
    days = parsed.days
    if (parsed.timer && parsed.timer.phase === Model.PhaseWork
        && Math.round(Number(parsed.timer.phaseDurationSec || 0)) !== config.workMinutes * 60)
      setTimer(Model.startWork(config, Date.now()), true)
    else if (parsed.timer && parsed.timer.status === Model.StatusStopped)
      setTimer(Model.startWork(config, Date.now()), true)
    else
      setTimer(parsed.timer, true)
    if (parsed.notify === "pick") notifySnackTime()
    else if (parsed.notify === "log") notifyLogTime()
    syncOverlay()
    Qt.callLater(function() {
      if (idleMonitor.isIdle) root.holdForIdle()
    })
  }

  function setTimer(next, persist) {
    timerState = next
    nowMs = Date.now()
    if (persist) scheduleSave()
  }

  function persistDocument() {
    if (!initialized) return
    savePending = true
    saveTimer.restart()
  }

  function scheduleSave() {
    persistDocument()
  }

  function flushState() {
    if (!savePending || !stateDirReady) return
    savePending = false
    var snapshot = Model.serializeDocument({
      exercises: exercises,
      today: today,
      days: days,
      timer: timerState,
      selected: selected
    }, Date.now())
    stateFile.setText(JSON.stringify(snapshot, null, 2) + "\n")
  }

  function togglePause() {
    if (!initialized || pausedForIdle || picking || logging) return
    var now = Date.now()
    if (stopped) {
      setTimer(Model.startWork(config, now), true)
      lastTickMs = now
      return
    }
    if (running) setTimer(Model.pause(timerState, now), true)
    else setTimer(Model.resume(timerState, now), true)
    lastTickMs = now
  }

  function skip() {
    if (!initialized || pausedForIdle) return
    if (picking) skipPick()
    else if (logging) skipLog()
    else if (phase === Model.PhaseSnack) finishSnack()
    else beginPick()
  }

  function beginPick() {
    selected = []
    setTimer(Model.pickingState(Date.now()), true)
    notifySnackTime()
    syncOverlay()
  }

  function skipPick() {
    selected = []
    setTimer(Model.startWork(config, Date.now()), true)
    lastTickMs = Date.now()
    syncOverlay()
  }

  function toggleSnack(name) {
    if (!picking) return
    selected = Model.toggleSelected(selected, exercises, name)
    persistDocument()
  }

  function beginSnack() {
    if (!initialized || !picking) return
    var chosen = Model.normalizeSelected(selected, exercises)
    if (!chosen.length) return
    selected = chosen
    setTimer(Model.startSnack(config, Date.now()), true)
    lastTickMs = Date.now()
    persistDocument()
    syncOverlay()
  }

  function finishSnack() {
    if (!initialized) return
    setTimer(Model.loggingState(Date.now()), true)
    notifyLogTime()
    syncOverlay()
  }

  function applyHistory(synced) {
    days = synced.days
    today = synced.today
  }

  function saveLog(reps) {
    if (!initialized) return
    var payload = {}
    var names = selected || []
    for (var i = 0; i < names.length; i++) {
      var name = names[i]
      payload[name] = reps ? Number(reps[name] || 0) : 0
    }
    applyHistory(Model.mergeHistory(days, today, payload, Date.now()))
    selected = []
    setTimer(Model.startWork(config, Date.now()), true)
    lastTickMs = Date.now()
    persistDocument()
    syncOverlay()
  }

  function skipLog() {
    selected = []
    setTimer(Model.startWork(config, Date.now()), true)
    lastTickMs = Date.now()
    persistDocument()
    syncOverlay()
  }

  function dismissOverlay() {
    if (picking) skipPick()
    else if (logging) skipLog()
  }

  function holdForIdle() {
    if (!initialized) return
    if (running) {
      setTimer(Model.pause(timerState, Date.now()), true)
      lastTickMs = Date.now()
      pausedForIdle = true
    }
  }

  function resumeAfterIdle() {
    if (!pausedForIdle) return
    pausedForIdle = false
    if (!paused) return
    setTimer(Model.resume(timerState, Date.now()), true)
    lastTickMs = Date.now()
  }

  function addExercise(name) {
    exercises = Model.addExercise(exercises, name)
    persistDocument()
  }

  function removeExercise(name) {
    exercises = Model.removeExercise(exercises, name)
    selected = Model.normalizeSelected(selected, exercises)
    persistDocument()
  }

  function tick() {
    if (!initialized || pausedForIdle) return
    var now = Date.now()
    nowMs = now
    if (!today || today.date !== Model.dateKey(now)) {
      applyHistory(Model.syncHistory(days, today, now))
      persistDocument()
    }

    if (!running) {
      lastTickMs = now
      return
    }

    if (lastTickMs > 0 && now - lastTickMs > 5000) {
      var recovered = Model.recoverInterrupted(timerState, config, now)
      applyRecovery(recovered)
      lastTickMs = now
      return
    }

    if (now >= Number(timerState.deadlineMs || 0)) {
      if (phase === Model.PhaseSnack) finishSnack()
      else beginPick()
    }
    lastTickMs = now
  }

  function applyRecovery(recovered) {
    setTimer(recovered.state, true)
    if (recovered.notify === "pick") {
      selected = []
      notifySnackTime()
    } else if (recovered.notify === "log") {
      notifyLogTime()
    }
    syncOverlay()
  }

  function syncOverlay() {
    if (!root.shell || typeof root.shell.summon !== "function") return
    if (overlayOpen) root.shell.summon(pluginId, "{}")
    else if (typeof root.shell.hide === "function") root.shell.hide(pluginId)
  }

  function notifySnackTime() {
    Quickshell.execDetached([
      notificationExecutable,
      "--app-name", "exercise-snacks",
      "-g", "󰯉",
      "-u", "normal",
      "Snack time",
      "Pick a snack and go for two minutes."
    ])
  }

  function notifyLogTime() {
    Quickshell.execDetached([
      notificationExecutable,
      "--app-name", "exercise-snacks",
      "-g", "󰯉",
      "-u", "normal",
      "Snack done",
      "How many did you do?"
    ])
  }

  Component.onCompleted: stateDirProcess.running = true

  IdleMonitor {
    timeout: Model.IdlePauseSeconds
    enabled: root.initialized
    respectInhibitors: true
    onIsIdleChanged: {
      if (isIdle) root.holdForIdle()
      else root.resumeAfterIdle()
    }
  }

  Timer {
    interval: 250
    repeat: true
    running: root.initialized
    onTriggered: root.tick()
  }

  Timer {
    id: saveTimer
    interval: 100
    repeat: false
    onTriggered: root.flushState()
  }

  Process {
    id: stateDirProcess
    command: ["mkdir", "-p", root.stateDir]
    onExited: function(exitCode) {
      root.stateDirReady = exitCode === 0
      if (!root.stateDirReady) {
        console.warn("Exercise snacks: could not create the state directory")
        return
      }
      root.flushState()
    }
  }

  FileView {
    id: stateFile
    path: root.statePath
    watchChanges: false
    atomicWrites: true
    printErrors: false
    onLoaded: {
      root.loadedStateText = text()
      root.stateFileLoaded = true
      root.initializeIfReady()
    }
    onLoadFailed: {
      root.loadedStateText = ""
      root.stateFileLoaded = true
      root.initializeIfReady()
    }
  }
}
