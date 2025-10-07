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

## Features

- Classic 10×20 Tetris playfield rendered to a `<canvas>`
- Seven-bag randomizer with hold, next queue, and ghost piece support
- Keyboard controls for rotation, movement, soft drop, hard drop, and
  pause/reset actions
- Score, line, and level tracking with increasing fall speed as you
  progress

Have fun stacking!
