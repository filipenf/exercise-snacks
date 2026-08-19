import Quickshell
import Quickshell.Wayland
import QtQuick
import qs.Commons
import qs.Ui
import "Model.js" as Model

Item {
  id: root

  property string omarchyPath: Quickshell.env("OMARCHY_PATH")
  property var shell: null
  property var manifest: null
  property var service: null

  property bool opened: false
  property var logCounts: ({})

  readonly property string step: service ? service.overlayStep : ""
  readonly property var exercises: service ? service.exercises : []
  readonly property var selected: service ? service.selected : []
  readonly property color background: Color.menu.background
  readonly property color foreground: Color.menu.text
  readonly property color border: Color.menu.border
  readonly property color accent: Color.accent
  readonly property color dim: Qt.darker(foreground, 1.45)
  readonly property var borderSpec: Border.surfaceSpec("menu", "border", border, Math.max(1, Style.space(2)))
  readonly property color scrim: Color.menu.scrim
  readonly property int cornerRadius: Style.cornerRadius
  readonly property int contentMargin: Style.spacing.panelPadding
  readonly property string fontFamily: Style.font.menuFamily
  readonly property int cardWidth: Math.min(Style.space(380), panel.width - Style.gapsOut * 2)

  function open(payloadJson) {
    root.opened = true
    if (root.step === "log") root.ensureLogCounts()
    Qt.callLater(function() { keyCatcher.forceActiveFocus() })
  }

  function close() {
    root.opened = false
  }

  function toggle() {
    if (root.opened) root.close()
    else root.open("{}")
  }

  function ensureLogCounts() {
    var next = {}
    var names = root.selected || []
    for (var i = 0; i < names.length; i++) {
      var name = names[i]
      next[name] = Number(root.logCounts[name] || 0)
    }
    root.logCounts = next
  }

  function setCount(name, value) {
    var next = {}
    for (var key in root.logCounts) next[key] = root.logCounts[key]
    next[name] = value
    root.logCounts = next
  }

  function spinCount(spin) {
    if (!spin) return 0
    var typed = spin.contentItem ? String(spin.contentItem.text || "") : ""
    if (typed.trim() !== "") {
      var parsed = typeof spin.valueFromText === "function"
        ? Number(spin.valueFromText(typed, spin.locale))
        : Number(typed)
      if (isFinite(parsed)) return Math.max(0, Math.round(parsed))
    }
    return Math.max(0, Math.round(Number(spin.value) || 0))
  }

  function collectLogCounts() {
    var next = {}
    var names = root.selected || []
    for (var i = 0; i < names.length; i++) {
      var name = names[i]
      var item = logFields.itemAt(i)
      next[name] = item ? root.spinCount(item.field) : Number(root.logCounts[name] || 0)
    }
    root.logCounts = next
    return next
  }

  function handleEscape() {
    if (!root.service) {
      root.close()
      return
    }
    if (root.step === "snack") root.service.finishSnack()
    else if (root.step === "log") root.service.skipLog()
    else root.service.skipPick()
  }

  function handleScrim() {
    if (root.step === "snack") return
    root.handleEscape()
  }

  function handlePrimary() {
    if (!root.service) return
    if (root.step === "pick") root.service.beginSnack()
    else if (root.step === "snack") root.service.finishSnack()
    else root.service.saveLog(root.collectLogCounts())
  }

  onStepChanged: {
    if (root.step === "log") root.ensureLogCounts()
    if (root.step !== "" && !root.opened) root.open("{}")
  }

  PanelWindow {
    id: panel
    visible: root.opened && root.step !== ""
    anchors { top: true; bottom: true; left: true; right: true }
    color: "transparent"
    WlrLayershell.namespace: "omarchy-exercise-snacks"
    WlrLayershell.layer: WlrLayer.Overlay
    WlrLayershell.keyboardFocus: WlrKeyboardFocus.Exclusive
    exclusionMode: ExclusionMode.Ignore

    Rectangle {
      anchors.fill: parent
      color: root.scrim
    }

    MouseArea {
      anchors.fill: parent
      onClicked: root.handleScrim()
    }

    BorderSurface {
      id: card
      width: root.cardWidth
      implicitHeight: Math.min(body.implicitHeight + root.contentMargin * 2, panel.height - Style.gapsOut * 2)
      height: implicitHeight
      radius: root.cornerRadius
      anchors.centerIn: parent
      color: root.background
      borderSpec: root.borderSpec
      padding: root.contentMargin

      MouseArea { anchors.fill: parent; onClicked: {} }

      Item {
        id: keyCatcher
        anchors.fill: parent
        focus: true

        Keys.priority: Keys.BeforeItem
        Keys.onPressed: function(event) {
          if (event.key === Qt.Key_Escape) {
            root.handleEscape()
            event.accepted = true
          } else if (event.key === Qt.Key_Return || event.key === Qt.Key_Enter) {
            if (root.step !== "log") {
              root.handlePrimary()
              event.accepted = true
            }
          }
        }
      }

      Column {
        id: body
        anchors.left: parent.left
        anchors.right: parent.right
        anchors.top: parent.top
        anchors.leftMargin: card.contentLeftInset
        anchors.rightMargin: card.contentRightInset
        anchors.topMargin: card.contentTopInset
        spacing: Style.space(12)

        Text {
          width: parent.width
          text: root.step === "pick" ? "Snack time"
            : (root.step === "snack" ? "Go" : "How many did you do?")
          color: root.foreground
          font.family: root.fontFamily
          font.pixelSize: Style.font.heading
          font.bold: true
          wrapMode: Text.WordWrap
        }

        Text {
          width: parent.width
          visible: root.step === "pick"
          text: "Pick one or more snacks, then start the two-minute timer."
          color: root.dim
          font.family: root.fontFamily
          font.pixelSize: Style.font.body
          wrapMode: Text.WordWrap
        }

        Flickable {
          width: parent.width
          height: Math.min(pickList.implicitHeight, Style.space(240))
          clip: true
          visible: root.step === "pick"
          contentWidth: width
          contentHeight: pickList.implicitHeight
          boundsBehavior: Flickable.StopAtBounds
          flickableDirection: Flickable.VerticalFlick

          Column {
            id: pickList
            width: parent.width
            spacing: Style.space(6)

            Repeater {
              model: root.exercises

              delegate: Toggle {
                required property string modelData
                width: pickList.width
                label: modelData
                checked: root.service ? Model.isSelected(root.service.selected, modelData) : false
                foreground: root.foreground
                accent: root.accent
                fontFamily: root.fontFamily
                onClicked: if (root.service) root.service.toggleSnack(modelData)
              }
            }
          }
        }

        Item {
          width: parent.width
          height: Style.space(160)
          visible: root.step === "snack"

          CircularProgress {
            anchors.centerIn: parent
            width: Math.min(parent.width, parent.height)
            height: width
            progress: root.service ? root.service.progress : 0
            trackColor: Color.muted
            fillColor: root.accent
            strokeWidth: Math.max(5, Style.spaceReal(6))
          }

          Column {
            anchors.centerIn: parent
            spacing: Style.space(4)

            Text {
              anchors.horizontalCenter: parent.horizontalCenter
              text: root.service ? root.service.remainingText : "02:00"
              color: root.foreground
              font.family: root.fontFamily
              font.pixelSize: Math.round(Style.font.displayLarge * 1.5)
              font.bold: true
            }

            Text {
              anchors.horizontalCenter: parent.horizontalCenter
              text: "Snack"
              color: root.accent
              font.family: root.fontFamily
              font.pixelSize: Style.font.title
            }
          }
        }

        Column {
          width: parent.width
          spacing: Style.space(6)
          visible: root.step === "snack" || root.step === "log"

          Repeater {
            model: root.selected

            delegate: Text {
              required property string modelData
              width: body.width
              visible: root.step === "snack"
              text: modelData
              color: root.dim
              font.family: root.fontFamily
              font.pixelSize: Style.font.body
              horizontalAlignment: Text.AlignHCenter
            }
          }
        }

        Column {
          width: parent.width
          spacing: Style.space(8)
          visible: root.step === "log"

          Repeater {
            id: logFields
            model: root.selected

            delegate: NumberField {
              required property string modelData
              width: body.width
              label: modelData
              value: Number(root.logCounts[modelData] || 0)
              from: 0
              to: 999
              foreground: root.foreground
              accent: root.accent
              fontFamily: root.fontFamily
              onModified: function(next) { root.setCount(modelData, next) }
            }
          }
        }

        Row {
          spacing: Style.space(8)
          anchors.horizontalCenter: parent.horizontalCenter

          Button {
            text: root.step === "pick" ? "Skip"
              : (root.step === "snack" ? "Done" : "Skip")
            bordered: true
            foreground: root.foreground
            accent: root.accent
            onClicked: root.handleEscape()
          }

          Button {
            visible: root.step !== "snack"
            text: root.step === "log" ? "Save" : "Start snack"
            enabled: root.step === "log" || (root.service && root.selected.length > 0)
            opacity: enabled ? 1 : 0.4
            foreground: root.foreground
            accent: root.accent
            onClicked: root.handlePrimary()
          }
        }
      }
    }
  }
}
