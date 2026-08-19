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
  property string selectedDayKey: ""
  property int selectedAction: 0
  property bool cursorActive: true
  property var tip: Tips.tipOfTheDay(Date.now())
  property var learnLinks: Tips.links()
  readonly property string todayKey: timerService && timerService.today ? String(timerService.today.date || "") : ""
  readonly property string activeDayKey: selectedDayKey || todayKey
  readonly property var activeTotals: timerService
    ? Model.totalsForDay(timerService.days, timerService.today, root.activeDayKey)
    : ({})
  readonly property var groupedSlices: Model.groupedExercises(
    Model.exerciseSlices(root.activeTotals),
    Model.DonutMaxSlices,
    Model.DonutMinPct
  )
  readonly property var donutSegments: Model.arcSegments(root.groupedSlices)
  readonly property var weekTrend: timerService ? timerService.weekTrend : []
  readonly property var weekSeries: timerService
    ? Model.weekSeries(timerService.days, timerService.today, root.todayKey)
    : []
  readonly property string accentHex: {
    var c = root.activeColor
    function ch(v) {
      var t = Math.max(0, Math.min(255, Math.round(v * 255)))
      return (t < 16 ? "0" : "") + t.toString(16)
    }
    return "#" + ch(c.r) + ch(c.g) + ch(c.b)
  }
  readonly property var seriesColors: Model.sliceColors(Math.max(root.weekSeries.length, 1), root.accentHex)
  readonly property var donutColors: {
    var out = []
    var segs = root.groupedSlices || []
    for (var i = 0; i < segs.length; i++) out.push(root.hexForExercise(segs[i].name))
    return out
  }
  readonly property int weekMax: {
    var max = 0
    var list = root.weekTrend || []
    for (var i = 0; i < list.length; i++) max = Math.max(max, Number(list[i].count) || 0)
    return max
  }
  readonly property int dayTotal: Model.totalsSum(root.activeTotals)
  readonly property real ringSize: Style.space(116)
  readonly property real legendMaxHeight: Style.space(140)
  readonly property real weekBarHeight: Style.space(52)

  function seriesIndex(name) {
    var list = root.weekSeries || []
    var key = String(name || "")
    for (var i = 0; i < list.length; i++) {
      if (String(list[i].name || "") === key) return i
    }
    return -1
  }

  function hexForExercise(name) {
    var idx = root.seriesIndex(name)
    if (idx < 0) return ""
    return String(root.seriesColors[idx] || "")
  }

  function sliceColor(index, alpha) {
    var hex = String(root.seriesColors[index] || "").replace(/[#\s]/g, "")
    if (hex.length >= 6) {
      var r = parseInt(hex.substr(0, 2), 16) / 255
      var g = parseInt(hex.substr(2, 2), 16) / 255
      var b = parseInt(hex.substr(4, 2), 16) / 255
      return Qt.rgba(r, g, b, alpha)
    }
    return Qt.rgba(root.activeColor.r, root.activeColor.g, root.activeColor.b, alpha)
  }

  function colorForExercise(name, alpha) {
    var idx = root.seriesIndex(name)
    if (idx < 0)
      return Qt.rgba(root.foreground.r, root.foreground.g, root.foreground.b, alpha * 0.35)
    return root.sliceColor(idx, alpha)
  }

  function selectDay(key) {
    if (!key) return
    if (key === root.todayKey || root.selectedDayKey === key) root.selectedDayKey = ""
    else root.selectedDayKey = key
  }

  function open() {
    currentTab = "timer"
    selectedAction = 0
    cursorActive = true
    draftName = ""
    selectedDayKey = ""
    tip = Tips.tipOfTheDay(Date.now())
    controller.show()
  }

  function close() {
    selectedDayKey = ""
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
    contentHeight: panel.fittedContentHeight(Style.space(500))

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
        else if (text === "s") root.currentTab = "stats"
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
            { value: "stats", label: "Stats" },
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
            spacing: Style.space(8)

            Item {
              width: parent.width
              height: Style.space(14)

              Rectangle {
                id: remainingTrack
                anchors.fill: parent
                radius: height / 2
                color: Qt.rgba(root.foreground.r, root.foreground.g, root.foreground.b, 0.12)
              }

              Rectangle {
                anchors.left: remainingTrack.left
                anchors.verticalCenter: remainingTrack.verticalCenter
                height: remainingTrack.height
                radius: remainingTrack.radius
                color: root.activeColor
                width: remainingTrack.width * (
                  root.timerService
                    ? Math.max(0, Math.min(1, 1 - Number(root.timerService.progress || 0)))
                    : 1
                )
              }
            }

            Text {
              width: parent.width
              text: (root.timerService ? root.timerService.remainingText : "45:00")
                + "  "
                + (root.timerService ? root.timerService.phaseLabel : "Work")
              color: root.dim
              font.family: root.fontFamily
              font.pixelSize: Style.font.body
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
              placeholderText: "Add exercise"
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

        // ---- Stats tab
        Column {
          width: parent.width
          spacing: Style.space(12)
          visible: root.currentTab === "stats"

          Item {
            width: parent.width
            implicitHeight: Math.max(root.ringSize, legendScroll.height)

            Item {
              id: donutItem
              width: root.ringSize
              height: root.ringSize
              anchors.left: parent.left
              anchors.verticalCenter: parent.verticalCenter

              DonutRing {
                anchors.fill: parent
                segments: root.donutSegments
                colors: root.donutColors
                trackColor: Qt.rgba(root.foreground.r, root.foreground.g, root.foreground.b, 0.1)
                ringWidth: Style.space(14)
              }

              Column {
                anchors.centerIn: parent
                width: parent.width * 0.62
                spacing: Style.space(1)

                Text {
                  width: parent.width
                  text: Model.dayLabel(root.activeDayKey, root.todayKey)
                  color: root.foreground
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.bodySmall
                  font.bold: true
                  elide: Text.ElideRight
                  horizontalAlignment: Text.AlignHCenter
                }

                Text {
                  width: parent.width
                  text: Model.formatReps(root.dayTotal)
                  color: root.dim
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.caption
                  font.bold: true
                  elide: Text.ElideRight
                  horizontalAlignment: Text.AlignHCenter
                }
              }
            }

            Flickable {
              id: legendScroll
              anchors.left: donutItem.right
              anchors.leftMargin: Style.space(16)
              anchors.right: parent.right
              anchors.verticalCenter: parent.verticalCenter
              clip: true
              contentWidth: width
              contentHeight: legendList.implicitHeight
              height: Math.min(legendList.implicitHeight, root.legendMaxHeight)
              interactive: contentHeight > height
              flickableDirection: Flickable.VerticalFlick
              boundsBehavior: Flickable.StopAtBounds

              Column {
                id: legendList
                width: parent.width - Style.space(8)
                spacing: Style.space(5)

                Text {
                  visible: root.groupedSlices.length === 0
                  width: parent.width
                  text: "No snacks logged"
                  color: root.foreground
                  opacity: 0.4
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.bodySmall
                }

                Repeater {
                  model: root.groupedSlices

                  Item {
                    required property var modelData
                    required property int index
                    width: legendList.width
                    implicitHeight: Math.max(swatch.height, Math.max(sliceName.implicitHeight, sliceCount.implicitHeight))

                    Rectangle {
                      id: swatch
                      width: Style.space(7)
                      height: width
                      radius: width / 2
                      color: root.colorForExercise(modelData.name, 1.0)
                      anchors.left: parent.left
                      anchors.verticalCenter: parent.verticalCenter
                    }

                    Text {
                      id: sliceName
                      text: String(modelData.name || "")
                      color: root.foreground
                      opacity: 0.7
                      font.family: root.fontFamily
                      font.pixelSize: Style.font.bodySmall
                      elide: Text.ElideRight
                      width: parent.width - sliceCount.implicitWidth - Style.space(16)
                      anchors.left: swatch.right
                      anchors.leftMargin: Style.space(6)
                      anchors.verticalCenter: parent.verticalCenter
                    }

                    Text {
                      id: sliceCount
                      text: String(modelData.count || 0)
                      color: root.foreground
                      font.family: root.fontFamily
                      font.pixelSize: Style.font.bodySmall
                      anchors.right: parent.right
                      anchors.verticalCenter: parent.verticalCenter
                    }
                  }
                }
              }
            }
          }

          PanelSeparator { foreground: root.foreground }

          PanelSectionHeader {
            text: "Past 7 days"
            foreground: root.foreground
            fontFamily: root.fontFamily
          }

          Row {
            width: parent.width
            spacing: Style.space(6)

            Repeater {
              model: root.weekTrend

              Column {
                required property var modelData
                readonly property bool isActive: modelData.key === root.activeDayKey
                readonly property var visualStacks: {
                  var src = modelData.stacks || []
                  var out = []
                  for (var i = src.length - 1; i >= 0; i--) out.push(src[i])
                  return out
                }
                width: (parent.width - parent.spacing * 6) / 7
                spacing: Style.space(2)

                Text {
                  text: modelData.count > 0 ? String(modelData.count) : " "
                  color: root.foreground
                  opacity: modelData.count > 0 ? (isActive ? 1.0 : 0.7) : 0
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.caption
                  font.bold: isActive
                  width: parent.width
                  horizontalAlignment: Text.AlignHCenter
                }

                Item {
                  id: trendSlot
                  width: parent.width
                  height: root.weekBarHeight

                  MouseArea {
                    id: trendSlotMouse
                    anchors.fill: parent
                    hoverEnabled: true
                    cursorShape: Qt.PointingHandCursor
                    onClicked: root.selectDay(modelData.key)
                  }

                  Rectangle {
                    visible: !modelData.stacks || modelData.stacks.length === 0
                    width: parent.width * 0.42
                    height: 3
                    radius: Style.space(2)
                    color: Qt.rgba(root.foreground.r, root.foreground.g, root.foreground.b, 0.12)
                    anchors.horizontalCenter: parent.horizontalCenter
                    anchors.bottom: parent.bottom
                  }

                  Column {
                    visible: modelData.stacks && modelData.stacks.length > 0
                    anchors.bottom: parent.bottom
                    anchors.horizontalCenter: parent.horizontalCenter
                    width: parent.width * 0.42
                    spacing: 0
                    property real slotHeight: parent.height
                    property real fillAlpha: isActive ? 1.0 : 0.72
                    property bool dimHover: trendSlotMouse.containsMouse && !isActive

                    Repeater {
                      model: visualStacks

                      Rectangle {
                        required property var modelData
                        width: parent.width
                        height: root.weekMax > 0
                          ? Math.max(1, parent.slotHeight * Number(modelData.count) / root.weekMax)
                          : 1
                        color: root.colorForExercise(modelData.name, parent.fillAlpha)
                        opacity: parent.dimHover ? 0.85 : 1.0
                      }
                    }
                  }

                  PanelToolTip {
                    visible: trendSlotMouse.containsMouse
                    delay: 150
                    text: Model.formatStacksTooltip(modelData.stacks)
                    fontFamily: root.fontFamily
                  }
                }

                Text {
                  text: modelData.label
                  color: root.foreground
                  opacity: isActive ? 1.0 : 0.5
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.caption
                  font.bold: isActive
                  width: parent.width
                  horizontalAlignment: Text.AlignHCenter
                }

                Rectangle {
                  width: Style.space(3)
                  height: width
                  radius: width / 2
                  color: root.sliceColor(0, 1.0)
                  visible: isActive
                  anchors.horizontalCenter: parent.horizontalCenter
                }
              }
            }
          }

          Text {
            width: parent.width
            visible: root.weekMax <= 0
            text: "Hover a bar for the per-exercise counts. Click a day to see its split."
            color: root.dim
            font.family: root.fontFamily
            font.pixelSize: Style.font.caption
            wrapMode: Text.WordWrap
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
