# Browser Tetris

This repository contains a self-contained browser-based Tetris clone
implemented with vanilla HTML, CSS, and JavaScript. The main entry point
is `index.html`, which loads the styling from `styles.css` and the game
logic from `tetris.js`.

## Getting Started

You can launch the game by serving the root directory with any static
file server. For example, using Python:

```bash
python -m http.server 8000
```

Then open <http://localhost:8000> in your browser to start playing.

## Testing

Before merging any changes, smoke test the game in a desktop browser:

1. Start the local development server as described above.
2. Press **Start** and confirm the active piece begins falling.
3. Verify keyboard input (left/right, rotate, soft drop, hard drop, hold)
   behaves as expected.
4. Clear at least one line to ensure scoring, line, and level counters
   update.
5. Pause and resume the game, then trigger a game over to confirm the
   reset flow works.

If any of these actions fail, fix the issue before merging.

## Features

- Classic 10×20 Tetris playfield rendered to a `<canvas>`
- Seven-bag randomizer with hold, next queue, and ghost piece support
- Keyboard controls for rotation, movement, soft drop, hard drop, and
  pause/reset actions
- Score, line, and level tracking with level-based line-clear bonuses as
  you progress
- Ambient background soundtrack, responsive layout scaling, and flashing
  line-clear celebrations when you score

Have fun stacking!
