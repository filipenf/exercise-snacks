# Exercise Snacks

A work timer for the [Omarchy](https://omarchy.org/) bar. When the interval
ends, a popup asks you to pick a snack — push-ups, pull-ups, air squats —
then runs a two-minute timer and lets you log how many you did.

Today's totals stay on the Timer tab. The Stats tab has a donut of today's
exercises and a seven-day history. The Learn tab has a tip of the day and
links to Dr. Rhonda Patrick's FoundMyFitness posts on exercise snacks.

## Install

From a published git repo:

```bash
omarchy plugin add https://github.com/filipenf/exercise-snacks.git --enable
```

From this folder, during development:

```bash
PLUGIN_ID="filipenf.exercise-snacks"
PLUGIN_DIR="$HOME/.config/omarchy/plugins/$PLUGIN_ID"
mkdir -p "$PLUGIN_DIR"
rsync -a --delete --exclude '.git' ./ "$PLUGIN_DIR/"
omarchy plugin validate "$PLUGIN_DIR"
omarchy-shell shell rescanPlugins
omarchy plugin enable "$PLUGIN_ID" --section right
```

## Use

The bar shows a flat flex icon in the same style as the other bar glyphs.
Hover it for the remaining time; click it to open the panel. The work
interval starts on its own — it is a break reminder, not a timer you have
to start.

If the computer is idle for more than two minutes, the work interval starts
over when you come back. You already left the desk, so the snack can wait.

| Control | Action |
| --- | --- |
| Pause | Pause or resume the current interval |
| Skip | Snack now (or skip the current overlay step) |

When work ends, an overlay opens:

1. Pick one or more snacks from your list
2. Start the two-minute snack
3. Enter how many reps you did, then Save

Skip on the overlay starts the next work interval without logging. Escape
does the same on pick and log; during the snack it jumps to logging so you
can record an early finish.

The Learn tab (`n` with the panel open; `t` returns to Timer, `s` opens
Stats) has a rotating tip and links to FoundMyFitness. Those links open in
the browser. The plugin does not fetch X.com.

Stats shows today's logged snacks as a donut (click a day in the week strip
to inspect it) and total reps for the past seven days. Days before this
update have no history.

## Keyboard

With the panel open:

- `h` / `l` or arrows select Pause or Skip
- Enter or Space activates the selected control
- Escape closes the panel
- Tab / Shift+Tab moves between bar panels

## Configure

```bash
omarchy bar plugin set filipenf.exercise-snacks workMinutes 25 --json
omarchy bar plugin set filipenf.exercise-snacks snackSeconds 120 --json
```

New values apply to the next interval. Add or remove snacks on the Timer tab.
The catalog, today's totals, and up to 30 days of history live in
`~/.local/state/omarchy/exercise-snacks.json`. Today's log still resets at
local midnight; previous days stay in `days`.

## Update

```bash
omarchy plugin update filipenf.exercise-snacks
```

## Tests

```bash
node --test tests/model.test.js
omarchy plugin validate .
qmllint -I "$OMARCHY_PATH/shell" BarWidget.qml Panel.qml Overlay.qml Service.qml CircularProgress.qml DonutRing.qml
```

## License

MIT.
