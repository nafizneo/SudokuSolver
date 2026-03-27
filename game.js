/**
 * SUDOKU ENGINE - CORE LOGIC
 * Uses Bitmasking and MRV Heuristic for O(1) constraints and efficient pruning.
 */
class SudokuEngine {
    constructor() {
        this.resetStats();
    }

    resetStats() {
        this.nodesExplored = 0;
        this.startTime = 0;
    }

    // Convert 2D coord to Box index
    getBox(r, c) { return Math.floor(r / 3) * 3 + Math.floor(c / 3); }

    /**
     * Solving Algorithm (Backtracking + MRV)
     * @param {number[]} board 81-length array
     * @param {boolean} countSolutions If true, finds all solutions up to 2
     */
    solve(board, countSolutions = false) {
        let solutions = 0;
        const resultBoard = [...board];
        
        // Bitmasks: rowMask[9], colMask[9], boxMask[9]
        // A '1' at bit 'n' means number 'n' is available
        const rows = new Array(9).fill(0x1FF);
        const cols = new Array(9).fill(0x1FF);
        const boxes = new Array(9).fill(0x1FF);
        const emptyCells = [];

        // Initialize Masks
        for (let i = 0; i < 81; i++) {
            const r = Math.floor(i / 81 * 9), c = i % 9, b = this.getBox(r, c);
            const val = board[i];
            if (val > 0) {
                const mask = ~(1 << (val - 1));
                rows[r] &= mask; cols[c] &= mask; boxes[b] &= mask;
            } else {
                emptyCells.push(i);
            }
        }

        const backtrack = () => {
            this.nodesExplored++;
            
            if (emptyCells.length === 0) {
                solutions++;
                return true;
            }

            // MRV Heuristic: Find cell with fewest possibilities
            let bestIdx = 0;
            let minChoices = 10;
            let bestPossibilities = 0;

            for (let i = 0; i < emptyCells.length; i++) {
                const idx = emptyCells[i];
                const r = Math.floor(idx / 9), c = idx % 9, b = this.getBox(r, c);
                const possibilities = rows[r] & cols[c] & boxes[b];
                const count = this.countSetBits(possibilities);
                
                if (count < minChoices) {
                    minChoices = count;
                    bestIdx = i;
                    bestPossibilities = possibilities;
                }
                if (count === 0) return false; // Dead end
                if (count === 1) break; // Efficiency shortcut
            }

            const cellIdx = emptyCells.splice(bestIdx, 1)[0];
            const r = Math.floor(cellIdx / 9), c = cellIdx % 9, b = this.getBox(r, c);

            for (let num = 1; num <= 9; num++) {
                if (bestPossibilities & (1 << (num - 1))) {
                    // Apply choice
                    resultBoard[cellIdx] = num;
                    const bit = 1 << (num - 1);
                    rows[r] ^= bit; cols[c] ^= bit; boxes[b] ^= bit;

                    if (backtrack()) {
                        if (!countSolutions) return true;
                        if (solutions > 1) return true; 
                    }

                    // Undo choice
                    rows[r] |= bit; cols[c] |= bit; boxes[b] |= bit;
                }
            }

            emptyCells.splice(bestIdx, 0, cellIdx);
            resultBoard[cellIdx] = 0;
            return false;
        };

        this.startTime = performance.now();
        const success = backtrack();
        const time = performance.now() - this.startTime;

        return { success, board: resultBoard, solutions, time, nodes: this.nodesExplored };
    }

    countSetBits(n) {
        let count = 0;
        while (n > 0) { n &= (n - 1); count++; }
        return count;
    }

    /**
     * GENERATOR
     * Creates a unique solution puzzle by removing clues from a full board
     */
    generate(difficulty) {
        // 1. Generate full valid board
        let board = new Array(81).fill(0);
        this.fillRandomly(board);
        board = this.solve(board).board;

        // 2. Remove clues based on difficulty
        const attempts = { 'easy': 30, 'medium': 45, 'hard': 55 };
        const target = attempts[difficulty];
        const indices = Array.from({length: 81}, (_, i) => i).sort(() => Math.random() - 0.5);

        let removed = 0;
        for (let i of indices) {
            if (removed >= target) break;
            const temp = board[i];
            board[i] = 0;
            
            // Check for unique solution
            const check = this.solve(board, true);
            if (check.solutions !== 1) {
                board[i] = temp;
            } else {
                removed++;
            }
        }
        return board;
    }

    fillRandomly(board) {
        // Fill diagonals first (independent boxes) to speed up full board gen
        for (let i = 0; i < 9; i += 3) {
            this.fillBox(board, i, i);
        }
    }

    fillBox(board, row, col) {
        let nums = [1,2,3,4,5,6,7,8,9].sort(() => Math.random() - 0.5);
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                board[(row + i) * 9 + (col + j)] = nums.pop();
            }
        }
    }
}

/**
 * UI CONTROLLER
 */
class SudokuUI {
    constructor() {
        this.engine = new SudokuEngine();
        this.board = new Array(81).fill(0);
        this.initialBoard = new Array(81).fill(0); // Tracks clues
        this.selectedIndex = null;
        this.init();
    }

    init() {
        const grid = document.getElementById('grid');
        grid.innerHTML = '';
        for (let i = 0; i < 81; i++) {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.id = `cell-${i}`;
            cell.onclick = () => this.selectCell(i);
            grid.appendChild(cell);
        }
        window.addEventListener('keydown', (e) => this.handleKey(e));
        this.generate('easy');
    }

    selectCell(i) {
        if (this.selectedIndex !== null) {
            document.getElementById(`cell-${this.selectedIndex}`).classList.remove('selected');
        }
        this.selectedIndex = i;
        document.getElementById(`cell-${i}`).classList.add('selected');
    }

    handleKey(e) {
        if (this.selectedIndex === null) return;
        if (e.key >= '0' && e.key <= '9') this.inputNum(parseInt(e.key));
        if (e.key === 'Backspace') this.inputNum(0);
    }

    inputNum(n) {
        if (this.selectedIndex === null || this.initialBoard[this.selectedIndex] !== 0) return;
        this.board[this.selectedIndex] = n;
        this.render();
    }

    generate(diff) {
        this.setStatus("Generating unique puzzle...");
        setTimeout(() => {
            const newBoard = this.engine.generate(diff);
            this.board = [...newBoard];
            this.initialBoard = [...newBoard];
            this.render();
            this.setStatus(`Ready (${diff})`);
        }, 50);
    }

    solveInstant() {
        this.engine.resetStats();
        const result = this.engine.solve(this.board);
        if (result.success) {
            this.board = result.board;
            this.render(true);
            this.updateStats(result);
            this.setStatus("Solved!");
        } else {
            this.setStatus("No solution found", true);
        }
    }

    async visualizeSolve() {
        // Slow solver to visualize the MRV process
        this.setStatus("Visualizing recursion...");
        const board = [...this.board];
        
        const delay = (ms) => new Promise(res => setTimeout(res, ms));
        
        const solveStep = async () => {
            let bestIdx = -1;
            let minChoices = 10;
            
            for(let i=0; i<81; i++) {
                if (this.board[i] !== 0) continue;
                let choices = this.getPossible(i);
                if (choices.length < minChoices) {
                    minChoices = choices.length;
                    bestIdx = i;
                }
            }

            if (bestIdx === -1) return true;
            let possible = this.getPossible(bestIdx);
            
            for (let num of possible) {
                this.board[bestIdx] = num;
                this.render();
                await delay(20);
                if (await solveStep()) return true;
                this.board[bestIdx] = 0;
                this.render();
            }
            return false;
        };

        await solveStep();
        this.setStatus("Visualization Complete");
    }

    getPossible(idx) {
        const r = Math.floor(idx/9), c = idx%9, b = this.engine.getBox(r,c);
        let possible = [];
        for(let n=1; n<=9; n++) {
            let valid = true;
            for(let i=0; i<9; i++) {
                if (this.board[r*9+i] === n || this.board[i*9+c] === n) valid = false;
            }
            // (Simple check for viz purposes)
            if (valid) possible.push(n);
        }
        return possible;
    }

    clear() {
        this.board.fill(0);
        this.initialBoard.fill(0);
        this.render();
        this.setStatus("Board Cleared");
    }

    render(isSolved = false) {
        for (let i = 0; i < 81; i++) {
            const el = document.getElementById(`cell-${i}`);
            const val = this.board[i];
            el.textContent = val === 0 ? '' : val;
            
            el.classList.remove('clue', 'solved-anim');
            if (this.initialBoard[i] !== 0) el.classList.add('clue');
            else if (isSolved) el.classList.add('solved-anim');
        }
    }

    updateStats(res) {
        document.getElementById('nodes').textContent = res.nodes.toLocaleString();
        document.getElementById('time').textContent = res.time.toFixed(2) + 'ms';
    }

    setStatus(msg, isError = false) {
        const el = document.getElementById('status');
        el.textContent = msg;
        el.style.color = isError ? 'var(--error)' : 'var(--primary)';
    }
}

const game = new SudokuUI();
