const COLS = 10;
const ROWS = 20;
const PREVIEW_COUNT = 3;
const LINE_CLEAR_DURATION = 420;
const LINE_CLEAR_FLASH_INTERVAL = 90;
const BACKGROUND_CHORDS = [
  [220, 277.18, 329.63],
  [196, 246.94, 311.13],
  [233.08, 293.66, 369.99],
  [174.61, 220, 261.63],
];
const MUSIC_CHORD_DURATION = 4;
const MUSIC_VOLUME = 0.06;

const TETROMINOS = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0],
  ],
  O: [
    [1, 1],
    [1, 1],
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0],
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0],
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0],
  ],
};

const COLORS = {
  I: "#0ea5e9",
  J: "#6366f1",
  L: "#f59e0b",
  O: "#facc15",
  S: "#22c55e",
  T: "#a855f7",
  Z: "#ef4444",
  ghost: "rgba(226, 232, 240, 0.25)",
};

const LINE_SCORES = [0, 100, 300, 500, 800];

const boardCanvas = document.getElementById("board");
const boardCtx = boardCanvas.getContext("2d");
const nextCanvas = document.getElementById("next");
const nextCtx = nextCanvas.getContext("2d");
const holdCanvas = document.getElementById("hold");
const holdCtx = holdCanvas.getContext("2d");
const scoreEl = document.getElementById("score");
const linesEl = document.getElementById("lines");
const levelEl = document.getElementById("level");

scoreEl.addEventListener("animationend", () => {
  scoreEl.classList.remove("pulse");
});

const startBtn = document.getElementById("start");
const pauseBtn = document.getElementById("pause");
const resetBtn = document.getElementById("reset");

const BLOCK_SIZE = boardCanvas.width / COLS;

let board;
let activePiece;
let ghostPiece;
let queue;
let hold;
let holdUsed;
let isRunning = false;
let isPaused = false;
let isGameOver = false;
let dropInterval;
let dropCounter;
let lastTime = 0;
let linesCleared;
let level;
let score;
let animationFrameId;
let isClearing = false;
let clearingRows = [];
let lineClearTimer = 0;
let lineClearFlashTimer = 0;
let lineClearFlashVisible = true;
let previousScore = 0;
let audioCtx;
let musicGain;
let musicIntervalId;
let musicStarted = false;
let chordIndex = 0;

function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

function rotate(matrix, dir = 1) {
  const size = matrix.length;
  const rotated = Array.from({ length: size }, () => Array(size).fill(0));

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (dir === 1) {
        rotated[x][size - 1 - y] = matrix[y][x];
      } else {
        rotated[size - 1 - x][y] = matrix[y][x];
      }
    }
  }
  return rotated;
}

function lightenColor(hex, amount = 0.4) {
  if (typeof hex !== "string" || !hex.startsWith("#")) {
    return hex;
  }
  const value = hex.slice(1);
  if (value.length !== 6) {
    return hex;
  }
  const num = parseInt(value, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  const lift = (channel) => Math.min(255, Math.round(channel + (255 - channel) * amount));
  return `rgb(${lift(r)}, ${lift(g)}, ${lift(b)})`;
}

function randomBag() {
  const types = Object.keys(TETROMINOS);
  for (let i = types.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [types[i], types[j]] = [types[j], types[i]];
  }
  return types;
}

function refillQueue() {
  queue.push(...randomBag());
}

function spawnPiece() {
  if (queue.length < PREVIEW_COUNT + 1) {
    refillQueue();
  }
  const type = queue.shift();
  const piece = {
    matrix: cloneMatrix(TETROMINOS[type]),
    row: 0,
    col: Math.floor((COLS - TETROMINOS[type][0].length) / 2),
    type,
  };

  if (collides(piece, board, 0, 0)) {
    endGame();
    return;
  }

  activePiece = piece;
  holdUsed = false;
  updateGhostPiece();
  updatePreviews();
}

function collides(piece, boardState, deltaRow, deltaCol) {
  const { matrix, row, col } = piece;
  for (let y = 0; y < matrix.length; y++) {
    for (let x = 0; x < matrix[y].length; x++) {
      if (!matrix[y][x]) continue;
      const newY = row + y + deltaRow;
      const newX = col + x + deltaCol;
      if (newY < 0 || newY >= ROWS || newX < 0 || newX >= COLS) {
        return true;
      }
      if (boardState[newY]?.[newX]) {
        return true;
      }
    }
  }
  return false;
}

function mergePiece(piece) {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      const boardY = piece.row + y;
      const boardX = piece.col + x;
      if (boardY >= 0 && boardY < ROWS && boardX >= 0 && boardX < COLS) {
        board[boardY][boardX] = piece.type;
      }
    });
  });
}

function findFullRows() {
  const fullRows = [];
  for (let y = 0; y < ROWS; y++) {
    if (board[y].every((cell) => cell)) {
      fullRows.push(y);
    }
  }
  return fullRows;
}

function startLineClear(rows) {
  if (!rows.length) return;
  isClearing = true;
  clearingRows = [...rows];
  lineClearTimer = LINE_CLEAR_DURATION;
  lineClearFlashTimer = LINE_CLEAR_FLASH_INTERVAL;
  lineClearFlashVisible = true;
  const cleared = rows.length;
  linesCleared += cleared;
  const scoreIndex = Math.min(cleared, LINE_SCORES.length - 1);
  const gained = LINE_SCORES[scoreIndex] * Math.max(1, level + 1);
  score += gained;
  updateLevel();
  updateScoreboard();
  updateButtons();
}

function finishLineClear() {
  const rows = [...clearingRows].sort((a, b) => b - a);
  rows.forEach((row) => {
    board.splice(row, 1);
  });
  for (let i = 0; i < rows.length; i++) {
    board.unshift(Array(COLS).fill(null));
  }
  isClearing = false;
  clearingRows = [];
  lineClearTimer = 0;
  lineClearFlashTimer = 0;
  lineClearFlashVisible = true;
  dropCounter = 0;
  spawnPiece();
  updateButtons();
}

function updateLevel() {
  const newLevel = Math.floor(linesCleared / 10);
  if (newLevel !== level) {
    level = newLevel;
    dropInterval = Math.max(100, 1000 - level * 70);
  }
}

function updateGhostPiece() {
  if (!activePiece) return;
  ghostPiece = {
    matrix: cloneMatrix(activePiece.matrix),
    type: "ghost",
    row: activePiece.row,
    col: activePiece.col,
  };
  while (!collides(ghostPiece, board, 1, 0)) {
    ghostPiece.row++;
  }
}

function drawBoard() {
  boardCtx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
  boardCtx.fillStyle = "rgba(15, 23, 42, 0.85)";
  boardCtx.fillRect(0, 0, boardCanvas.width, boardCanvas.height);

  drawGrid();

  board.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) return;
      const highlight = isClearing && clearingRows.includes(y);
      drawCell(boardCtx, x, y, COLORS[cell], {
        highlight,
        flash: highlight && lineClearFlashVisible,
      });
    });
  });

  if (ghostPiece) {
    ghostPiece.matrix.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell && ghostPiece.row + y >= 0) {
          drawCell(boardCtx, ghostPiece.col + x, ghostPiece.row + y, COLORS.ghost, {
            ghost: true,
          });
        }
      });
    });
  }

  if (activePiece) {
    activePiece.matrix.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell) {
          drawCell(boardCtx, activePiece.col + x, activePiece.row + y, COLORS[activePiece.type]);
        }
      });
    });
  }
}

function drawCell(ctx, x, y, color, options = {}) {
  const { ghost = false, highlight = false, flash = false } = options;
  const px = x * BLOCK_SIZE;
  const py = y * BLOCK_SIZE;
  let fill = color;
  if (highlight) {
    fill = lightenColor(color, flash ? 0.85 : 0.45);
  }
  ctx.save();
  ctx.globalAlpha = ghost ? 0.5 : 1;
  ctx.fillStyle = fill;
  ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
  if (highlight && flash) {
    const gradient = ctx.createLinearGradient(px, py, px + BLOCK_SIZE, py + BLOCK_SIZE);
    gradient.addColorStop(0, "rgba(56, 189, 248, 0.85)");
    gradient.addColorStop(1, "rgba(14, 165, 233, 0.4)");
    ctx.globalAlpha = ghost ? 0.4 : 0.9;
    ctx.fillStyle = gradient;
    ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(15, 23, 42, 0.65)";
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
}

function drawGrid() {
  boardCtx.strokeStyle = "rgba(148, 163, 184, 0.12)";
  boardCtx.lineWidth = 1;
  for (let x = 1; x < COLS; x++) {
    boardCtx.beginPath();
    boardCtx.moveTo(x * BLOCK_SIZE, 0);
    boardCtx.lineTo(x * BLOCK_SIZE, boardCanvas.height);
    boardCtx.stroke();
  }
  for (let y = 1; y < ROWS; y++) {
    boardCtx.beginPath();
    boardCtx.moveTo(0, y * BLOCK_SIZE);
    boardCtx.lineTo(boardCanvas.width, y * BLOCK_SIZE);
    boardCtx.stroke();
  }
}

function updatePreviews() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height);

  queue.slice(0, PREVIEW_COUNT).forEach((type, index) => {
    const matrix = TETROMINOS[type];
    drawPreview(nextCtx, matrix, index, COLORS[type], PREVIEW_COUNT);
  });

  if (hold) {
    const matrix = TETROMINOS[hold];
    drawPreview(holdCtx, matrix, 0, COLORS[hold], 1);
  }
}

function drawPreview(ctx, matrix, index, color, slots) {
  const { width, height } = ctx.canvas;
  const slotHeight = height / slots;
  const bounds = getBounds(matrix);
  const pieceWidth = bounds.width;
  const pieceHeight = bounds.height;
  const cellSize = Math.min((width - 20) / pieceWidth, (slotHeight - 20) / pieceHeight);
  const offsetX = (width - cellSize * pieceWidth) / 2;
  const offsetY = index * slotHeight + (slotHeight - cellSize * pieceHeight) / 2;

  ctx.save();
  ctx.translate(offsetX, offsetY);

  matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) return;
      ctx.fillStyle = color;
      ctx.strokeStyle = "rgba(15, 23, 42, 0.7)";
      ctx.lineWidth = 2;
      const drawX = (x - bounds.minX) * cellSize;
      const drawY = (y - bounds.minY) * cellSize;
      ctx.fillRect(drawX, drawY, cellSize, cellSize);
      ctx.strokeRect(drawX + 1, drawY + 1, cellSize - 2, cellSize - 2);
    });
  });

  ctx.restore();
}

function getBounds(matrix) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  matrix.forEach((row, y) => {
    row.forEach((cell, x) => {
      if (!cell) return;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
  });

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

function hardDrop() {
  if (isClearing) return;
  while (!collides(activePiece, board, 1, 0)) {
    activePiece.row++;
  }
  lockPiece();
}

function softDrop() {
  if (isClearing) return;
  if (!collides(activePiece, board, 1, 0)) {
    activePiece.row++;
    score += level + 1;
    updateScoreboard();
  } else {
    lockPiece();
  }
}

function move(offset) {
  if (isClearing) return;
  if (!collides(activePiece, board, 0, offset)) {
    activePiece.col += offset;
    updateGhostPiece();
  }
}

function rotateActive(dir) {
  if (isClearing) return;
  const rotated = rotate(activePiece.matrix, dir);
  const kickOffsets = [0, -1, 1, -2, 2];
  for (const offset of kickOffsets) {
    if (!collides({ ...activePiece, matrix: rotated }, board, 0, offset)) {
      activePiece.matrix = rotated;
      activePiece.col += offset;
      updateGhostPiece();
      return;
    }
  }
}

function holdPiece() {
  if (isClearing) return;
  if (holdUsed) return;
  const currentType = activePiece.type;
  if (!hold) {
    hold = currentType;
    spawnPiece();
  } else {
    const temp = hold;
    hold = currentType;
    activePiece = {
      matrix: cloneMatrix(TETROMINOS[temp]),
      row: 0,
      col: Math.floor((COLS - TETROMINOS[temp][0].length) / 2),
      type: temp,
    };
    if (collides(activePiece, board, 0, 0)) {
      endGame();
      return;
    }
    updateGhostPiece();
  }
  holdUsed = true;
  updatePreviews();
}

function lockPiece() {
  mergePiece(activePiece);
  const rows = findFullRows();
  activePiece = null;
  ghostPiece = null;
  dropCounter = 0;
  if (rows.length) {
    startLineClear(rows);
  } else {
    spawnPiece();
    updateScoreboard();
  }
}

function updateScoreboard() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = linesCleared;
  levelEl.textContent = level + 1;
  if (score > previousScore) {
    scoreEl.classList.remove("pulse");
    // Force reflow to restart the animation
    void scoreEl.offsetWidth;
    scoreEl.classList.add("pulse");
  }
  previousScore = score;
}

function ensureBackgroundMusic() {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  if (!audioCtx) {
    audioCtx = new Context();
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  adjustMusicVolume(MUSIC_VOLUME);
  if (!musicStarted) {
    musicStarted = true;
    scheduleChord();
    musicIntervalId = setInterval(scheduleChord, MUSIC_CHORD_DURATION * 1000);
  } else if (!musicIntervalId) {
    musicIntervalId = setInterval(scheduleChord, MUSIC_CHORD_DURATION * 1000);
  }
}

function scheduleChord() {
  if (!audioCtx || !musicGain) return;
  if (audioCtx.state === "closed") return;
  const chord = BACKGROUND_CHORDS[chordIndex % BACKGROUND_CHORDS.length];
  chordIndex++;
  const now = audioCtx.currentTime;
  chord.forEach((frequency, index) => {
    const oscillator = audioCtx.createOscillator();
    oscillator.type = index === 0 ? "sine" : index === 1 ? "triangle" : "sawtooth";
    oscillator.frequency.setValueAtTime(frequency, now);
    const gainNode = audioCtx.createGain();
    const attack = 0.18;
    const release = MUSIC_CHORD_DURATION - 0.4;
    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.linearRampToValueAtTime(MUSIC_VOLUME / (index + 1.2), now + attack);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + release);
    oscillator.connect(gainNode);
    gainNode.connect(musicGain);
    oscillator.start(now);
    oscillator.stop(now + MUSIC_CHORD_DURATION);
  });
}

function adjustMusicVolume(target) {
  if (!musicGain || !audioCtx) return;
  const now = audioCtx.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setTargetAtTime(Math.max(0, target), now, 0.4);
}

function update(time = 0) {
  if (!isRunning || isPaused) return;
  const delta = time - lastTime;
  lastTime = time;
  if (isClearing) {
    lineClearTimer -= delta;
    lineClearFlashTimer -= delta;
    if (lineClearFlashTimer <= 0) {
      lineClearFlashVisible = !lineClearFlashVisible;
      lineClearFlashTimer = LINE_CLEAR_FLASH_INTERVAL;
    }
    if (lineClearTimer <= 0) {
      finishLineClear();
    }
  } else {
    dropCounter += delta;
    if (dropCounter > dropInterval) {
      if (!collides(activePiece, board, 1, 0)) {
        activePiece.row++;
      } else {
        lockPiece();
      }
      dropCounter = 0;
    }
  }

  drawBoard();
  animationFrameId = requestAnimationFrame(update);
}

function startGame() {
  board = createBoard();
  queue = [];
  refillQueue();
  hold = null;
  holdUsed = false;
  linesCleared = 0;
  level = 0;
  score = 0;
  previousScore = 0;
  dropInterval = 1000;
  dropCounter = 0;
  lastTime = 0;
  isGameOver = false;
  isRunning = true;
  isPaused = false;
  isClearing = false;
  clearingRows = [];
  lineClearTimer = 0;
  lineClearFlashTimer = 0;
  lineClearFlashVisible = true;
  updateButtons();
  ensureBackgroundMusic();
  spawnPiece();
  updateScoreboard();
  cancelAnimationFrame(animationFrameId);
  animationFrameId = requestAnimationFrame(update);
}

function togglePause() {
  if (!isRunning || isGameOver || isClearing) return;
  isPaused = !isPaused;
  if (!isPaused) {
    lastTime = performance.now();
    dropCounter = 0;
    animationFrameId = requestAnimationFrame(update);
    adjustMusicVolume(MUSIC_VOLUME);
  } else {
    cancelAnimationFrame(animationFrameId);
    adjustMusicVolume(MUSIC_VOLUME / 2);
  }
  updateButtons();
}

function endGame() {
  isGameOver = true;
  isRunning = false;
  updateButtons();
  cancelAnimationFrame(animationFrameId);
  adjustMusicVolume(MUSIC_VOLUME / 2);
  drawBoard();
  boardCtx.fillStyle = "rgba(2, 6, 23, 0.85)";
  boardCtx.fillRect(30, boardCanvas.height / 2 - 60, boardCanvas.width - 60, 120);
  boardCtx.fillStyle = "#f1f5f9";
  boardCtx.font = "28px 'Segoe UI', sans-serif";
  boardCtx.textAlign = "center";
  boardCtx.fillText("Game Over", boardCanvas.width / 2, boardCanvas.height / 2 - 10);
  boardCtx.font = "18px 'Segoe UI', sans-serif";
  boardCtx.fillText("Press Reset to play again", boardCanvas.width / 2, boardCanvas.height / 2 + 30);
}

function resetGame() {
  cancelAnimationFrame(animationFrameId);
  isRunning = false;
  isPaused = false;
  isGameOver = false;
  board = createBoard();
  queue = [];
  hold = null;
  holdUsed = false;
  activePiece = null;
  ghostPiece = null;
  score = 0;
  linesCleared = 0;
  level = 0;
  previousScore = 0;
  dropInterval = 1000;
  dropCounter = 0;
  isClearing = false;
  clearingRows = [];
  lineClearTimer = 0;
  lineClearFlashTimer = 0;
  lineClearFlashVisible = true;
  drawBoard();
  updateScoreboard();
  updatePreviews();
  updateButtons();
  adjustMusicVolume(MUSIC_VOLUME / 2);
}

function updateButtons() {
  startBtn.disabled = isRunning && !isGameOver;
  pauseBtn.disabled = !isRunning || isGameOver || isClearing;
  pauseBtn.textContent = isPaused ? "Resume" : "Pause";
  resetBtn.disabled = !isRunning && !isGameOver && score === 0;
}

function handleKeyDown(event) {
  if (!isRunning || isPaused || isGameOver || isClearing) {
    if (event.key.toLowerCase() === "p" && isRunning && !isGameOver) {
      togglePause();
    }
    return;
  }

  switch (event.key) {
    case "ArrowLeft":
      move(-1);
      break;
    case "ArrowRight":
      move(1);
      break;
    case "ArrowDown":
      softDrop();
      break;
    case "ArrowUp":
    case "x":
    case "X":
      rotateActive(1);
      break;
    case "z":
    case "Z":
      rotateActive(-1);
      break;
    case " ":
      event.preventDefault();
      hardDrop();
      break;
    case "Shift":
    case "c":
    case "C":
      holdPiece();
      break;
    default:
      break;
  }
}

function handleKeyUp(event) {
  if (event.key.toLowerCase() === "p") {
    togglePause();
  }
}

document.addEventListener("keydown", handleKeyDown);
document.addEventListener("keyup", handleKeyUp);

startBtn.addEventListener("click", () => {
  if (!isRunning) {
    startGame();
  }
});

pauseBtn.addEventListener("click", () => {
  togglePause();
});

resetBtn.addEventListener("click", () => {
  resetGame();
});

resetGame();
