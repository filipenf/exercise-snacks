import QtQuick
import qs.Commons

Canvas {
  id: root

  property var segments: []
  property var colors: []
  property color trackColor: Color.muted
  property real ringWidth: Math.max(4, Style.spaceReal(14))

  antialiasing: true

  onSegmentsChanged: requestPaint()
  onColorsChanged: requestPaint()
  onTrackColorChanged: requestPaint()
  onRingWidthChanged: requestPaint()
  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()

  onPaint: {
    var ctx = getContext("2d")
    if (typeof ctx.reset === "function") ctx.reset()
    else ctx.clearRect(0, 0, width, height)
    var segs = root.segments || []
    var cx = width / 2
    var cy = height / 2
    var lineWidth = Math.max(1, Number(root.ringWidth))
    var rad = Math.max(0, Math.min(width, height) / 2 - lineWidth / 2)
    if (rad <= 0) return
    var toRad = Math.PI / 180

    if (!segs.length) {
      ctx.lineWidth = lineWidth
      ctx.strokeStyle = root.trackColor
      ctx.beginPath()
      ctx.arc(cx, cy, rad, 0, Math.PI * 2, false)
      ctx.stroke()
      return
    }

    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i]
      ctx.lineWidth = lineWidth
      ctx.strokeStyle = root.colors && root.colors[i] ? root.colors[i] : root.trackColor
      ctx.beginPath()
      ctx.arc(cx, cy, rad, Number(seg.startAngle) * toRad, (Number(seg.startAngle) + Number(seg.sweepAngle)) * toRad, false)
      ctx.stroke()
    }
  }
}
