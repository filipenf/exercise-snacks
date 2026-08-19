// Curated FoundMyFitness copy. No network. Tip of the day is a date hash.

var TIPS = [
  {
    title: "One to two minutes is enough",
    body: "Exercise snacks are brief, vigorous bouts — often 20 seconds to a few minutes — spread through the day. The effort should raise your heart rate and breathing quickly.",
    source: "FoundMyFitness"
  },
  {
    title: "Break up sitting",
    body: "Sitting for hours is an independent risk. A short snack after a work block gets you off the chair, generates lactate, and brings glucose transporters to the muscle.",
    source: "FoundMyFitness"
  },
  {
    title: "Time them around meals",
    body: "Snacks 30–60 minutes before or after eating improve post-meal glucose. Ten air squats every 45 minutes have beaten a 30-minute walk for glucose control in some work.",
    source: "FoundMyFitness"
  },
  {
    title: "Three snacks a day",
    body: "People who do about three 1–2 minute vigorous bursts a day show large drops in cardiovascular, cancer, and all-cause mortality in UK Biobank VILPA data.",
    source: "FoundMyFitness"
  },
  {
    title: "A complement, not a replacement",
    body: "Snacks lower the time and gym barrier, but they do not replace aerobic volume, progressive strength work, or recovery. Use them to start, or to fill the gaps.",
    source: "FoundMyFitness"
  },
  {
    title: "Make it vigorous on purpose",
    body: "A snack is planned and hard: stairs taken fast, air squats, push-ups, a bike sprint. Easy strolling is useful, but the signal here is intensity in a short window.",
    source: "FoundMyFitness"
  }
]

var LINKS = [
  {
    label: "More on exercise snacks",
    url: "https://www.foundmyfitness.com/topics/exercise-snacks"
  },
  {
    label: "2-minute snack for glucose and longevity",
    url: "https://www.foundmyfitness.com/episodes/2-minute-snack-longevity"
  },
  {
    label: "Snacks, glucose, and VILPA",
    url: "https://www.foundmyfitness.com/episodes/exercise-snacks-longevity-glucose"
  },
  {
    label: "Dr. Rhonda Patrick on X",
    url: "https://x.com/foundmyfitness"
  }
]

function dayOrdinal(nowMs) {
  var date = new Date(Number(nowMs) || Date.now())
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000)
}

function tipOfTheDay(nowMs) {
  if (!TIPS.length) return { title: "", body: "", source: "" }
  var index = Math.abs(dayOrdinal(nowMs)) % TIPS.length
  var tip = TIPS[index]
  return { title: tip.title, body: tip.body, source: tip.source }
}

function links() {
  var copy = []
  for (var i = 0; i < LINKS.length; i++) {
    copy.push({ label: LINKS[i].label, url: LINKS[i].url })
  }
  return copy
}

if (typeof module !== "undefined") {
  module.exports = {
    TIPS: TIPS,
    LINKS: LINKS,
    tipOfTheDay: tipOfTheDay,
    links: links
  }
}
