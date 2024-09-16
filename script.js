const boardSize = 8; // 8x8 grid
let board = [];
let selectedTiles = [];
let score = 0;

// Define tile types (icons or symbols)
const tileTypes = ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼'];

// Select audio elements
const moveSound = document.getElementById('move-sound');
const matchSound = document.getElementById('match-sound');
const failSound = document.getElementById('fail-sound');
const winSound = document.getElementById('win-sound');

// Volume Control Elements
const volumeControl = document.getElementById('volume');
const muteBtn = document.getElementById('mute-btn');
let isMuted = false;

// Select and configure the canvas
const canvas = document.getElementById('connection-canvas');
const ctx = canvas.getContext('2d');

// Set canvas size based on CSS
canvas.width = 675; // 8*80 + 7*5 = 640 + 35 = 675px
canvas.height = 675;

// Define directions for BFS (Up, Down, Left, Right)
const directions = [
  { dr: -1, dc: 0 }, // Up
  { dr: 1, dc: 0 },  // Down
  { dr: 0, dc: -1 }, // Left
  { dr: 0, dc: 1 }   // Right
];

// Initialize Game Board
function initializeBoard() {
  // Create pairs for each tile type
  const totalPairs = (boardSize * boardSize) / 2;
  let tiles = [];

  for (let i = 0; i < totalPairs; i++) {
    const type = tileTypes[i % tileTypes.length];
    tiles.push(type);
    tiles.push(type);
  }

  // Shuffle the tiles
  tiles = shuffleArray(tiles);

  // Assign tiles to the board
  board = [];
  for (let row = 0; row < boardSize; row++) {
    let rowTiles = [];
    for (let col = 0; col < boardSize; col++) {
      rowTiles.push({
        type: tiles[row * boardSize + col],
        matched: false,
      });
    }
    board.push(rowTiles);
  }
}

// Fisher-Yates shuffle algorithm
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Render the game board
function renderBoard() {
  const gameBoard = document.getElementById('game-board');
  gameBoard.innerHTML = ''; // Clear existing tiles

  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      const tile = board[row][col];
      const tileElement = document.createElement('div');
      tileElement.classList.add('tile');
      tileElement.dataset.row = row;
      tileElement.dataset.col = col;
      tileElement.textContent = tile.type;
      
      if (tile.matched) {
        tileElement.classList.add('matched', 'disabled');
      }

      tileElement.addEventListener('click', handleTileClick);
      gameBoard.appendChild(tileElement);
    }
  }

  updateScore();
}

// Get tile position on canvas
function getTilePosition(row, col) {
  const tileSize = 80; // Same as in CSS
  const gap = 5; // Same as in CSS

  const x = col * (tileSize + gap) + tileSize / 2;
  const y = row * (tileSize + gap) + tileSize / 2;

  return { x, y };
}

// Handle tile click events
function handleTileClick(event) {
  const row = parseInt(event.target.dataset.row);
  const col = parseInt(event.target.dataset.col);
  const tile = board[row][col];

  if (tile.matched) return; // Ignore if already matched
  if (selectedTiles.length === 2) return; // Ignore if two tiles already selected

  // Check if the tile is already selected
  if (selectedTiles.some(selected => selected.row === row && selected.col === col)) {
    // Add 'invalid' class for visual feedback
    event.target.classList.add('invalid');
    setTimeout(() => {
      event.target.classList.remove('invalid');
    }, 300);
    return; // Ignore if the same tile is clicked again
  }

  // Play move sound
  moveSound.currentTime = 0; // Reset to start
  moveSound.play();

  // Select the tile
  event.target.classList.add('selected');
  selectedTiles.push({ row, col });

  if (selectedTiles.length === 2) {
    const [first, second] = selectedTiles;
    const firstTile = board[first.row][first.col];
    const secondTile = board[second.row][second.col];

    const path = canConnect(first, second);

    if (firstTile.type === secondTile.type && path) {
      // Match found
      board[first.row][first.col].matched = true;
      board[second.row][second.col].matched = true;
      score += 10;

      // Play match sound
      matchSound.currentTime = 0;
      matchSound.play();

      // Add 'disabled' class to matched tiles
      const firstElement = document.querySelector(`.tile[data-row='${first.row}'][data-col='${first.col}']`);
      const secondElement = document.querySelector(`.tile[data-row='${second.row}'][data-col='${second.col}']`);
      firstElement.classList.add('disabled');
      secondElement.classList.add('disabled');

      // Draw the connection path
      drawConnectionPath(path);

      selectedTiles = [];
      renderBoard();
      checkWinCondition();
      return;
    }

    // If not a match, play fail sound and deselect after a short delay
    failSound.currentTime = 0;
    failSound.play();

    setTimeout(() => {
      deselectTiles();
    }, 500);
  }
}

// Deselect tiles
function deselectTiles() {
  const selectedElements = document.querySelectorAll('.tile.selected');
  selectedElements.forEach(elem => elem.classList.remove('selected'));
  selectedTiles = [];
}

// Update the score display
function updateScore() {
  document.getElementById('score').textContent = `Score: ${score}`;
}

// Check if two tiles can be connected and return the path
function canConnect(tile1, tile2) {
  if (tile1.row === tile2.row && tile1.col === tile2.col) {
    return null; // Same tile selected
  }

  if (tile1.type !== tile2.type) {
    return null; // Different types, cannot match
  }

  // Temporarily mark both tiles as matched to allow path through them
  board[tile1.row][tile1.col].matched = true;
  board[tile2.row][tile2.col].matched = true;

  const path = findPathBFS(tile1, tile2);

  // Restore the matched status
  board[tile1.row][tile1.col].matched = false;
  board[tile2.row][tile2.col].matched = false;

  return path;
}

// BFS-Based Pathfinding with Turn Counting
function findPathBFS(tile1, tile2) {
  const queue = [];
  const visited = Array.from({ length: boardSize }, () => Array(boardSize).fill(null));

  // Initialize the queue with all possible directions from tile1
  directions.forEach((dir, index) => {
    const newRow = tile1.row + dir.dr;
    const newCol = tile1.col + dir.dc;

    if (isWithinBounds(newRow, newCol) && isCellClear(newRow, newCol)) {
      queue.push({
        row: newRow,
        col: newCol,
        direction: index,
        turns: 0,
        path: [{ row: tile1.row, col: tile1.col }, { row: newRow, col: newCol }]
      });
      visited[newRow][newCol] = { direction: index, turns: 0 };
    }
  });

  while (queue.length > 0) {
    const current = queue.shift();

    // Check if we've reached tile2
    if (current.row === tile2.row && current.col === tile2.col) {
      return current.path;
    }

    // Explore all possible directions
    directions.forEach((dir, index) => {
      const newRow = current.row + dir.dr;
      const newCol = current.col + dir.dc;

      if (isWithinBounds(newRow, newCol) && isCellClear(newRow, newCol)) {
        let newTurns = current.turns;

        // Check if direction has changed
        if (index !== current.direction) {
          newTurns += 1;
        }

        if (newTurns > 2) return; // Exceeds maximum allowed turns

        // Check if this cell has been visited with fewer or equal turns
        if (visited[newRow][newCol] === null || visited[newRow][newCol].turns > newTurns) {
          visited[newRow][newCol] = { direction: index, turns: newTurns };
          queue.push({
            row: newRow,
            col: newCol,
            direction: index,
            turns: newTurns,
            path: [...current.path, { row: newRow, col: newCol }]
          });
        }
      }
    });
  }

  return null; // No valid path found
}

// Check within grid boundaries
function isWithinBounds(row, col) {
  return row >= 0 && row < boardSize && col >= 0 && col < boardSize;
}

// Check if a cell is clear (matched or empty)
function isCellClear(row, col) {
  // Check if the cell is within the board boundaries
  if (row < 0 || row >= boardSize || col < 0 || col >= boardSize) return false;
  
  const cell = board[row][col];
  
  // A cell is clear if it's already matched or marked as 'EMPTY'
  return cell.matched || cell.type === 'EMPTY';
}

// Draw the connection path on the canvas
function drawConnectionPath(path) {
  if (!path || path.length === 0) return;

  // Clear previous drawings
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Set line style
  ctx.strokeStyle = '#FF0000'; // Red color
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Begin path
  ctx.beginPath();
  const startPos = getTilePosition(path[0].row, path[0].col);
  ctx.moveTo(startPos.x, startPos.y);

  // Iterate through the path and draw lines
  for (let i = 1; i < path.length; i++) {
    const pos = getTilePosition(path[i].row, path[i].col);
    ctx.lineTo(pos.x, pos.y);
  }

  // Draw the path
  ctx.stroke();

  // Optional: Animate the path (commented out for now)
  // animateConnectionPath(path);

  // Clear the path after a short delay
  setTimeout(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, 1000); // Display the path for 1 second
}

// Check if the player has won
function checkWinCondition() {
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      if (!board[row][col].matched) return;
    }
  }
  winSound.currentTime = 0;
  winSound.play();
  alert(`Congratulations! You won with a score of ${score}!`);
}

// Shuffle button event listener
document.getElementById('shuffle-btn').addEventListener('click', () => {
  initializeBoard();
  score = 0;
  selectedTiles = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear any existing paths
  renderBoard();
});

// Reset button event listener
document.getElementById('reset-btn').addEventListener('click', () => {
  initializeBoard();
  score = 0;
  selectedTiles = [];
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear any existing paths
  renderBoard();
});

// Volume Control Event Listeners
volumeControl.addEventListener('input', (e) => {
  const volume = e.target.value;
  moveSound.volume = volume;
  matchSound.volume = volume;
  failSound.volume = volume;
  winSound.volume = volume;
});

muteBtn.addEventListener('click', () => {
  isMuted = !isMuted;
  moveSound.muted = isMuted;
  matchSound.muted = isMuted;
  failSound.muted = isMuted;
  winSound.muted = isMuted;
  muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
});

// Initialize the game on page load
window.onload = () => {
  initializeBoard();
  renderBoard();
};
