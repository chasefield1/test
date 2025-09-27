const difficulties = {
  beginner: { rows: 9, cols: 9, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
};

const boardElement = document.getElementById('board');
const difficultySelect = document.getElementById('difficulty');
const restartButton = document.getElementById('restart');
const flagToggleButton = document.getElementById('flag-toggle');
const timerElement = document.getElementById('timer');
const flagsRemainingElement = document.getElementById('flags-remaining');
const revealedElement = document.getElementById('revealed');
const statusMessageElement = document.getElementById('status-message');

const state = {
  difficultyKey: 'beginner',
  rows: difficulties.beginner.rows,
  cols: difficulties.beginner.cols,
  mines: difficulties.beginner.mines,
  board: [],
  firstMove: true,
  status: 'ready',
  flagsPlaced: 0,
  revealedSafeCells: 0,
  flagMode: false,
  timerId: null,
  startTime: null,
  elapsedSeconds: 0,
};

function createEmptyBoard(rows, cols) {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({
      hasMine: false,
      adjacentMines: 0,
      revealed: false,
      flagged: false,
      exploded: false,
      misflagged: false,
    })),
  );
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function isInBounds(row, col) {
  return row >= 0 && row < state.rows && col >= 0 && col < state.cols;
}

function forEachNeighbor(row, col, callback) {
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = row + dr;
      const nc = col + dc;
      if (isInBounds(nr, nc)) {
        callback(nr, nc);
      }
    }
  }
}

function placeMinesAvoiding(board, safeRow, safeCol) {
  const candidates = [];
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const isSafeZone = Math.abs(row - safeRow) <= 1 && Math.abs(col - safeCol) <= 1;
      if (!isSafeZone) {
        candidates.push([row, col]);
      }
    }
  }

  shuffle(candidates);

  for (let i = 0; i < state.mines && i < candidates.length; i += 1) {
    const [row, col] = candidates[i];
    board[row][col].hasMine = true;
  }
}

function calculateAdjacentCounts(board) {
  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const cell = board[row][col];
      if (cell.hasMine) {
        cell.adjacentMines = -1;
        continue;
      }
      let count = 0;
      forEachNeighbor(row, col, (nr, nc) => {
        if (board[nr][nc].hasMine) count += 1;
      });
      cell.adjacentMines = count;
    }
  }
}

function ensureMinesPlaced(row, col) {
  if (!state.firstMove) return;
  placeMinesAvoiding(state.board, row, col);
  calculateAdjacentCounts(state.board);
  state.firstMove = false;
  startTimer();
  state.status = 'in-progress';
  updateStatusMessage('지뢰를 조심하세요!');
}

function revealCell(row, col) {
  const cell = state.board[row][col];
  if (cell.revealed || cell.flagged || state.status === 'lost' || state.status === 'won') {
    return;
  }

  ensureMinesPlaced(row, col);

  if (cell.hasMine) {
    cell.revealed = true;
    cell.exploded = true;
    endGame(false);
    return;
  }

  floodReveal(row, col);
  checkForWin();
}

function floodReveal(row, col) {
  const queue = [[row, col]];

  while (queue.length > 0) {
    const [currentRow, currentCol] = queue.shift();
    const cell = state.board[currentRow][currentCol];
    if (cell.revealed || cell.flagged) continue;

    cell.revealed = true;
    state.revealedSafeCells += 1;

    if (cell.adjacentMines === 0) {
      forEachNeighbor(currentRow, currentCol, (nr, nc) => {
        const neighbor = state.board[nr][nc];
        if (!neighbor.revealed && !neighbor.hasMine) {
          queue.push([nr, nc]);
        }
      });
    }
  }
}

function toggleFlag(row, col) {
  const cell = state.board[row][col];
  if (cell.revealed || state.status === 'lost' || state.status === 'won') return;

  if (cell.flagged) {
    cell.flagged = false;
    state.flagsPlaced -= 1;
  } else {
    cell.flagged = true;
    state.flagsPlaced += 1;
  }

  updateStats();
  renderBoard();
}

function chordReveal(row, col) {
  const cell = state.board[row][col];
  if (!cell.revealed || cell.adjacentMines <= 0) return;

  let flaggedNeighbors = 0;
  forEachNeighbor(row, col, (nr, nc) => {
    if (state.board[nr][nc].flagged) flaggedNeighbors += 1;
  });

  if (flaggedNeighbors === cell.adjacentMines) {
    forEachNeighbor(row, col, (nr, nc) => {
      const neighbor = state.board[nr][nc];
      if (!neighbor.flagged && !neighbor.revealed) {
        revealCell(nr, nc);
      }
    });
  }
}

function endGame(won) {
  state.status = won ? 'won' : 'lost';
  stopTimer();

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const cell = state.board[row][col];
      if (cell.hasMine) {
        cell.revealed = true;
      }
      if (!won && cell.flagged && !cell.hasMine) {
        cell.misflagged = true;
        state.flagsPlaced = Math.max(0, state.flagsPlaced - 1);
        cell.flagged = false;
        cell.revealed = true;
      }
    }
  }

  renderBoard();
  updateStats();

  if (won) {
    updateStatusMessage('축하합니다! 모든 지뢰를 찾았어요.');
  } else {
    updateStatusMessage('지뢰를 밟았어요! 새 게임을 눌러 다시 도전해보세요.');
  }
}

function checkForWin() {
  const safeCells = state.rows * state.cols - state.mines;
  if (state.revealedSafeCells >= safeCells) {
    endGame(true);
  } else {
    renderBoard();
    updateStats();
  }
}

function updateTimer() {
  if (state.startTime) {
    const now = Date.now();
    state.elapsedSeconds = Math.floor((now - state.startTime) / 1000);
  }
  timerElement.textContent = state.elapsedSeconds;
}

function startTimer() {
  if (state.timerId) return;
  state.startTime = Date.now();
  state.timerId = setInterval(updateTimer, 1000);
  updateTimer();
}

function stopTimer() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  if (state.startTime) {
    updateTimer();
    state.startTime = null;
  }
}

function updateStats() {
  flagsRemainingElement.textContent = Math.max(state.mines - state.flagsPlaced, 0);
  revealedElement.textContent = state.revealedSafeCells;
  updateTimer();
}

function updateStatusMessage(message) {
  statusMessageElement.textContent = message || '';
}

function renderBoard() {
  boardElement.innerHTML = '';
  boardElement.style.setProperty('--cols', state.cols);

  const fragment = document.createDocumentFragment();

  for (let row = 0; row < state.rows; row += 1) {
    for (let col = 0; col < state.cols; col += 1) {
      const cell = state.board[row][col];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'cell';
      button.dataset.row = row;
      button.dataset.col = col;
      button.setAttribute('role', 'gridcell');

      if (cell.revealed) {
        button.classList.add('revealed');
        button.classList.add('disabled');
        button.disabled = true;

        if (cell.hasMine) {
          button.classList.add('mine');
          if (cell.exploded) button.classList.add('exploded');
          button.textContent = '💣';
        } else if (cell.adjacentMines > 0) {
          button.classList.add(`n${cell.adjacentMines}`);
          button.textContent = cell.adjacentMines;
        } else {
          button.textContent = '';
        }
      } else {
        if (cell.flagged) {
          button.classList.add('flagged');
          button.textContent = '🚩';
        } else {
          button.textContent = '';
        }
      }

      if (cell.misflagged) {
        button.textContent = '✖';
        button.classList.add('mine');
      }

      fragment.appendChild(button);
    }
  }

  boardElement.appendChild(fragment);
}

function resetState(difficultyKey) {
  const difficulty = difficulties[difficultyKey];
  state.difficultyKey = difficultyKey;
  state.rows = difficulty.rows;
  state.cols = difficulty.cols;
  state.mines = difficulty.mines;
  state.board = createEmptyBoard(state.rows, state.cols);
  state.firstMove = true;
  state.status = 'ready';
  state.flagsPlaced = 0;
  state.revealedSafeCells = 0;
  state.flagMode = false;
  state.elapsedSeconds = 0;
  stopTimer();
  state.timerId = null;
  state.startTime = null;
  difficultySelect.value = difficultyKey;
  updateStatusMessage('첫 칸을 열면 안전한 지점에서 시작합니다.');
  flagToggleButton.textContent = '깃발 모드 꺼짐';
  flagToggleButton.setAttribute('aria-pressed', 'false');
  renderBoard();
  updateStats();
}

boardElement.addEventListener('click', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains('cell')) return;

  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);

  if (Number.isNaN(row) || Number.isNaN(col)) return;

  if (state.flagMode || event.shiftKey) {
    toggleFlag(row, col);
  } else {
    revealCell(row, col);
  }
});

boardElement.addEventListener('contextmenu', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains('cell')) return;

  event.preventDefault();
  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  if (Number.isNaN(row) || Number.isNaN(col)) return;
  toggleFlag(row, col);
});

boardElement.addEventListener('dblclick', (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (!target.classList.contains('cell')) return;

  const row = Number(target.dataset.row);
  const col = Number(target.dataset.col);
  if (Number.isNaN(row) || Number.isNaN(col)) return;
  chordReveal(row, col);
});

difficultySelect.addEventListener('change', (event) => {
  const newDifficulty = event.target.value;
  resetState(newDifficulty);
});

restartButton.addEventListener('click', () => {
  resetState(state.difficultyKey);
});

flagToggleButton.addEventListener('click', () => {
  state.flagMode = !state.flagMode;
  flagToggleButton.textContent = state.flagMode ? '깃발 모드 켜짐' : '깃발 모드 꺼짐';
  flagToggleButton.setAttribute('aria-pressed', state.flagMode ? 'true' : 'false');
});

resetState(state.difficultyKey);
