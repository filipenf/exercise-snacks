import QtQuick
import Quickshell
import qs.Commons
import qs.Ui
import "Model.js" as Model
import "Tips.js" as Tips

Panel {
  id: root
  moduleName: "filipenf.exercise-snacks"
  manageIpc: false

  property var anchorItem: null
  property var hostWidget: null
  property var timerService: null
  readonly property var barIdentity: hostWidget || root

  readonly property color foreground: Color.popups.text
  readonly property color dim: Qt.darker(foreground, 1.45)
  readonly property color activeColor: Color.accent
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family

  property string currentTab: "timer"
  property string draftName: ""
  property int selectedAction: 0
  property bool cursorActive: true
  property var tip: Tips.tipOfTheDay(Date.now())
  property var learnLinks: Tips.links()

  function open() {
    selectedAction = 0
    cursorActive = true
    draftName = ""
    tip = Tips.tipOfTheDay(Date.now())
    controller.show()
  }

  function close() {
    controller.hide()
  }

  function toggle() {
    if (opened) close()
    else open()
  }

  function switchPanel(direction) {
    if (bar && typeof bar.switchPanelFrom === "function")
      return bar.switchPanelFrom(barIdentity, direction)
    return false
  }

  function selectAction(delta) {
    cursorActive = true
    selectedAction = ((selectedAction + delta) % 2 + 2) % 2
  }

  function activateSelected() {
    if (!timerService || !timerService.initialized) return
    if (selectedAction === 0) timerService.togglePause()
    else timerService.skip()
  }

  function actionHovered(index, hovered) {
    if (!hovered) return
    cursorActive = true
    selectedAction = index
  }

  function addDraftExercise() {
    if (!timerService) return
    timerService.addExercise(draftName)
    draftName = ""
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(360))
    contentHeight: panel.fittedContentHeight(Style.space(470))

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      blocked: addField.activeFocus

      onMoveRequested: function(dx, dy) {
        if (root.currentTab !== "timer") return
        if (dx !== 0) root.selectAction(dx)
        else if (dy !== 0) root.selectAction(dy)
      }
      onActivateRequested: {
        if (root.currentTab === "timer") root.activateSelected()
      }
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onTextKey: function(text) {
        if (text === "t") root.currentTab = "timer"
        else if (text === "n") root.currentTab = "learn"
      }

      Column {
        id: content
        width: parent.width
        spacing: Style.space(12)

        ButtonGroup {
          width: parent.width
          options: [
            { value: "timer", label: "Timer" },
            { value: "learn", label: "Learn" }
          ]
          value: root.currentTab
          foreground: root.foreground
          accent: root.activeColor
          fontFamily: root.fontFamily
          focusable: false
          onChanged: function(next) { root.currentTab = next }
        }

        // ---- Timer tab
        Column {
          width: parent.width
          spacing: Style.space(12)
          visible: root.currentTab === "timer"

          Column {
            width: parent.width
            spacing: Style.space(4)

            Text {
              width: parent.width
              text: root.timerService ? root.timerService.remainingText : "25:00"
              color: root.foreground
              font.family: root.fontFamily
              font.pixelSize: Math.round(Style.font.displayLarge * 1.4)
              font.bold: true
              horizontalAlignment: Text.AlignHCenter
            }

            Text {
              width: parent.width
              text: root.timerService ? root.timerService.phaseLabel : "Work"
              color: root.activeColor
              font.family: root.fontFamily
              font.pixelSize: Style.font.title
              horizontalAlignment: Text.AlignHCenter
            }
          }

          Row {
            id: actions
            anchors.horizontalCenter: parent.horizontalCenter
            spacing: Style.space(10)
            readonly property real buttonSize: Style.space(42)

            Button {
              implicitWidth: actions.buttonSize
              implicitHeight: actions.buttonSize
              width: actions.buttonSize
              height: actions.buttonSize
              iconText: root.timerService && root.timerService.paused ? "" : ""
              tooltipText: root.timerService && root.timerService.paused
                ? "Resume"
                : "Pause"
              foreground: root.foreground
              accent: root.activeColor
              iconSize: Style.font.iconLarge
              horizontalPadding: 0
              verticalPadding: 0
              enabled: !!root.timerService && root.timerService.initialized
              opacity: enabled ? 1 : 0.35
              hasCursor: root.cursorActive && root.currentTab === "timer" && root.selectedAction === 0
              onHovered: function(value) { root.actionHovered(0, value) }
              onClicked: if (root.timerService) root.timerService.togglePause()
            }

            Button {
              implicitWidth: actions.buttonSize
              implicitHeight: actions.buttonSize
              width: actions.buttonSize
              height: actions.buttonSize
              iconText: ""
              tooltipText: "Snack now"
              foreground: root.foreground
              accent: root.activeColor
              iconSize: Style.font.iconLarge
              horizontalPadding: 0
              verticalPadding: 0
              enabled: !!root.timerService && root.timerService.initialized
              opacity: enabled ? 1 : 0.35
              hasCursor: root.cursorActive && root.currentTab === "timer" && root.selectedAction === 1
              onHovered: function(value) { root.actionHovered(1, value) }
              onClicked: if (root.timerService) root.timerService.skip()
            }
          }

          PanelSeparator { foreground: root.foreground }

          PanelSectionHeader {
            text: "Today"
            foreground: root.foreground
            fontFamily: root.fontFamily
          }

          Text {
            width: parent.width
            text: root.timerService ? root.timerService.todaySummary : "No exercise snacks logged today"
            color: root.dim
            font.family: root.fontFamily
            font.pixelSize: Style.font.body
            wrapMode: Text.WordWrap
          }

          PanelSeparator { foreground: root.foreground }

          PanelSectionHeader {
            text: "Snacks"
            foreground: root.foreground
            fontFamily: root.fontFamily
          }

          Flickable {
            width: parent.width
            height: Math.min(snackList.implicitHeight, Style.space(128))
            clip: true
            contentWidth: width
            contentHeight: snackList.implicitHeight
            boundsBehavior: Flickable.StopAtBounds
            flickableDirection: Flickable.VerticalFlick

            Column {
              id: snackList
              width: parent.width
              spacing: Style.space(8)

              Repeater {
                model: root.timerService ? root.timerService.exercises : []

                delegate: Row {
                  width: snackList.width
                  spacing: Style.space(8)

                  required property string modelData

                  Text {
                    width: parent.width - removeButton.width - parent.spacing
                    text: modelData
                    color: root.foreground
                    font.family: root.fontFamily
                    font.pixelSize: Style.font.body
                    elide: Text.ElideRight
                    anchors.verticalCenter: parent.verticalCenter
                  }

                  PanelActionButton {
                    id: removeButton
                    iconText: "󰅖"
                    tooltipText: "Remove " + modelData
                    foreground: root.foreground
                    hoverColor: Color.urgent
                    onClicked: if (root.timerService) root.timerService.removeExercise(modelData)
                  }
                }
              }
            }
          }

          Row {
            width: parent.width
            height: addField.implicitHeight
            spacing: Style.space(8)

            TextField {
              id: addField
              width: parent.width - addButton.width - parent.spacing
              placeholderText: "Add a snack"
              text: root.draftName
              foreground: root.foreground
              accent: root.activeColor
              onTextChanged: root.draftName = text
              onAccepted: root.addDraftExercise()
            }

            Button {
              id: addButton
              text: "Add"
              foreground: root.foreground
              accent: root.activeColor
              enabled: root.draftName.trim().length > 0
              onClicked: root.addDraftExercise()
            }
          }
        }

        // ---- Learn tab
        Column {
          width: parent.width
          spacing: Style.space(12)
          visible: root.currentTab === "learn"

          PanelSectionHeader {
            text: "Tip of the day"
            foreground: root.foreground
            fontFamily: root.fontFamily
          }

          Text {
            width: parent.width
            text: root.tip.title
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.subtitle
            font.bold: true
            wrapMode: Text.WordWrap
          }

          Text {
            width: parent.width
            text: root.tip.body
            color: root.dim
            font.family: root.fontFamily
            font.pixelSize: Style.font.body
            wrapMode: Text.WordWrap
          }

          Text {
            width: parent.width
            text: root.tip.source
            color: root.activeColor
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
          }

          PanelSeparator { foreground: root.foreground }

          PanelSectionHeader {
            text: "From Dr. Rhonda Patrick"
            foreground: root.foreground
            fontFamily: root.fontFamily
          }

          Repeater {
            model: root.learnLinks

            delegate: Button {
              required property var modelData
              width: content.width
              text: modelData.label
              leftAlign: true
              bordered: true
              foreground: root.foreground
              accent: root.activeColor
              fontFamily: root.fontFamily
              onClicked: Quickshell.execDetached(["omarchy-launch-browser", modelData.url])
            }
          }
        }
      }
    }
  }
}
