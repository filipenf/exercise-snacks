import QtQuick
import Quickshell
import qs.Commons
import qs.Ui

BarWidget {
  id: root
  moduleName: "filipenf.exercise-snacks"

  readonly property var timerService: bar && bar.shell
    ? bar.shell.serviceFor(moduleName)
    : null

  readonly property bool opened: panelLoader.item
    ? panelLoader.item.opened === true
    : false
  readonly property bool popoutSwitchClosing: panelLoader.item
    ? panelLoader.item.popoutSwitchClosing === true
    : false
  readonly property real openPanelIndicatorWidth: Style.bar.iconCanvas
  readonly property real openPanelIndicatorHeight: Style.bar.iconCanvas

  function syncService() {
    if (typeof injectPanel !== "function") return
    if (timerService && typeof timerService.configure === "function")
      timerService.configure(settings)
    injectPanel()
  }

  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
    if ("timerService" in target) target.timerService = root.timerService
  }

  function open() {
    if (panelLoader.item) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item) panelLoader.item.close()
  }

  function toggle() {
    if (panelLoader.item) panelLoader.item.toggle()
  }

  function closeForPopoutSwitch() {
    if (panelLoader.item) panelLoader.item.closeForPopoutSwitch()
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: Qt.callLater(function() { if (typeof root.syncService === "function") root.syncService() })
  onSettingsChanged: Qt.callLater(function() { if (typeof root.syncService === "function") root.syncService() })
  onTimerServiceChanged: Qt.callLater(function() { if (typeof root.syncService === "function") root.syncService() })
  Component.onCompleted: Qt.callLater(function() { if (typeof root.syncService === "function") root.syncService() })

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      if (typeof root.injectPanel !== "function") return
      root.injectPanel()
      Qt.callLater(function() {
        if (typeof root.syncService === "function") root.syncService()
      })
    }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    // nf-md-arm-flex — same nerd-font set as the other bar icons
    text: "󰿗"
    tooltipText: root.timerService
      ? root.timerService.phaseLabel + " · " + root.timerService.remainingText
      : "Exercise snacks"
    active: !!(root.timerService && (root.timerService.overlayOpen || root.timerService.paused))
    onPressed: function(buttonCode) {
      if (buttonCode === Qt.LeftButton) root.toggle()
    }
  }
}
