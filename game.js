// ==================== VARIABLES GLOBALES ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameMode = 'singleplayer'; // 'singleplayer' o 'multiplayer'
let gameRunning = false;
let gamePaused = false;
let gameSpeed = 1;
let difficulty = 'normal';
let soundEnabled = true;

// Dimensiones del canvas
const GAME_WIDTH = canvas.width;
const GAME_HEIGHT = canvas.height;

// Raqueta
const paddle = {
    width: 15,
    height: 100,
    speed: 6
};

// Pelota
const ball = {
    width: 10,
    height: 10,
    maxSpeed: 7,
    speed: 5
};

// Posiciones de los jugadores
let player1 = {
    x: 20,
    y: GAME_HEIGHT / 2 - paddle.height / 2,
    velY: 0,
    score: 0,
    keys: { up: false, down: false }
};

let player2 = {
    x: GAME_WIDTH - 20 - paddle.width,
    y: GAME_HEIGHT / 2 - paddle.height / 2,
    velY: 0,
    score: 0,
    keys: { up: false, down: false }
};

let ballState = {
    x: GAME_WIDTH / 2,
    y: GAME_HEIGHT / 2,
    velX: (Math.random() > 0.5 ? 1 : -1) * ball.speed,
    velY: (Math.random() - 0.5) * ball.speed
};

// ==================== FUNCIONES DE NAVEGACIÓN ====================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
    });
    document.getElementById(screenId).classList.remove('hidden');
}

function backToMenu() {
    gameRunning = false;
    gamePaused = false;
    showScreen('menu');
}

function startSinglePlayer() {
    gameMode = 'singleplayer';
    resetGame();
    showScreen('gameScreen');
    gameRunning = true;
    gameLoop();
}

function startMultiplayer() {
    gameMode = 'multiplayer';
    resetGame();
    showScreen('gameScreen');
    gameRunning = true;
    gameLoop();
}

function showSettings() {
    showScreen('settingsScreen');
}

function showCredits() {
    showScreen('creditsScreen');
}

function togglePause() {
    if (gameRunning) {
        gamePaused = !gamePaused;
        if (gamePaused) {
            showScreen('pauseScreen');
        } else {
            showScreen('gameScreen');
            gameLoop();
        }
    }
}

function restartGame() {
    resetGame();
    showScreen('gameScreen');
    gameRunning = true;
    gameLoop();
}

// ==================== CONTROLES TÁCTILES ====================
function movePlayer1Up(pressed) {
    player1.keys.up = pressed;
}

function movePlayer1Down(pressed) {
    player1.keys.down = pressed;
}

function movePlayer2Up(pressed) {
    player2.keys.up = pressed;
}

function movePlayer2Down(pressed) {
    player2.keys.down = pressed;
}

// Controles por teclado (para desktop)
document.addEventListener('keydown', (e) => {
    if (e.key === 'w' || e.key === 'W') player1.keys.up = true;
    if (e.key === 's' || e.key === 'S') player1.keys.down = true;
    if (e.key === 'ArrowUp') player2.keys.up = true;
    if (e.key === 'ArrowDown') player2.keys.down = true;
    if (e.key === ' ') {
        e.preventDefault();
        togglePause();
    }
});

document.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'W') player1.keys.up = false;
    if (e.key === 's' || e.key === 'S') player1.keys.down = false;
    if (e.key === 'ArrowUp') player2.keys.up = false;
    if (e.key === 'ArrowDown') player2.keys.down = false;
});

// ==================== CONFIGURACIÓN ====================
function toggleSound() {
    soundEnabled = document.getElementById('soundToggle').checked;
}

function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
}

function setDifficulty(value) {
    difficulty = value;
}

function setGameSpeed(value) {
    gameSpeed = parseFloat(value);
    document.getElementById('speedValue').textContent = gameSpeed.toFixed(1) + 'x';
}

// ==================== LÓGICA DEL JUEGO ====================
function resetGame() {
    player1.y = GAME_HEIGHT / 2 - paddle.height / 2;
    player1.velY = 0;
    player1.score = 0;
    player2.y = GAME_HEIGHT / 2 - paddle.height / 2;
    player2.velY = 0;
    player2.score = 0;
    
    ballState.x = GAME_WIDTH / 2;
    ballState.y = GAME_HEIGHT / 2;
    ballState.velX = (Math.random() > 0.5 ? 1 : -1) * ball.speed;
    ballState.velY = (Math.random() - 0.5) * ball.speed;
    
    updateScoreDisplay();
}

function updateScoreDisplay() {
    document.getElementById('score1').textContent = player1.score;
    document.getElementById('score2').textContent = player2.score;
}

function updatePlayer(player) {
    // Movimiento del jugador
    if (player.keys.up && player.y > 0) {
        player.y -= paddle.speed * gameSpeed;
    }
    if (player.keys.down && player.y + paddle.height < GAME_HEIGHT) {
        player.y += paddle.speed * gameSpeed;
    }

    // Limitar posición
    player.y = Math.max(0, Math.min(player.y, GAME_HEIGHT - paddle.height));
}

function updateAI() {
    const paddle2Center = player2.y + paddle.height / 2;
    const ballCenter = ballState.y;
    const targetSpeed = (() => {
        switch (difficulty) {
            case 'easy':
                return 3;
            case 'hard':
                return 8;
            case 'normal':
            default:
                return 5;
        }
    })();

    // IA intenta seguir la pelota con algo de margen de error
    const errorMargin = difficulty === 'hard' ? 0 : difficulty === 'easy' ? 30 : 15;
    
    if (ballCenter < paddle2Center - errorMargin) {
        player2.y -= targetSpeed * gameSpeed;
    } else if (ballCenter > paddle2Center + errorMargin) {
        player2.y += targetSpeed * gameSpeed;
    }

    player2.y = Math.max(0, Math.min(player2.y, GAME_HEIGHT - paddle.height));
}

function updateBall() {
    ballState.x += ballState.velX * gameSpeed;
    ballState.y += ballState.velY * gameSpeed;

    // Colisión con bordes superior e inferior
    if (ballState.y <= 0 || ballState.y + ball.height >= GAME_HEIGHT) {
        ballState.velY = -ballState.velY;
        ballState.y = Math.max(0, Math.min(ballState.y, GAME_HEIGHT - ball.height));
        playSound('bounce');
    }

    // Colisión con raqueta 1
    if (
        ballState.x <= player1.x + paddle.width &&
        ballState.y + ball.height >= player1.y &&
        ballState.y <= player1.y + paddle.height &&
        ballState.velX < 0
    ) {
        ballState.velX = -ballState.velX;
        ballState.x = player1.x + paddle.width;
        
        // Cambiar ángulo según dónde golpee la pelota
        let collidePoint = ballState.y - (player1.y + paddle.height / 2);
        collidePoint = collidePoint / (paddle.height / 2);
        ballState.velY = collidePoint * ball.maxSpeed;
        ballState.velX = Math.abs(ballState.velX);
        
        playSound('paddle');
    }

    // Colisión con raqueta 2
    if (
        ballState.x + ball.width >= player2.x &&
        ballState.y + ball.height >= player2.y &&
        ballState.y <= player2.y + paddle.height &&
        ballState.velX > 0
    ) {
        ballState.velX = -ballState.velX;
        ballState.x = player2.x - ball.width;
        
        let collidePoint = ballState.y - (player2.y + paddle.height / 2);
        collidePoint = collidePoint / (paddle.height / 2);
        ballState.velY = collidePoint * ball.maxSpeed;
        ballState.velX = -Math.abs(ballState.velX);
        
        playSound('paddle');
    }

    // Gol - Jugador 1 anota
    if (ballState.x > GAME_WIDTH) {
        player1.score++;
        playSound('score');
        updateScoreDisplay();
        
        if (player1.score >= 11) {
            endGame(1);
        } else {
            resetBall();
        }
    }

    // Gol - Jugador 2 anota
    if (ballState.x < 0) {
        player2.score++;
        playSound('score');
        updateScoreDisplay();
        
        if (player2.score >= 11) {
            endGame(2);
        } else {
            resetBall();
        }
    }
}

function resetBall() {
    ballState.x = GAME_WIDTH / 2;
    ballState.y = GAME_HEIGHT / 2;
    ballState.velX = (Math.random() > 0.5 ? 1 : -1) * ball.speed;
    ballState.velY = (Math.random() - 0.5) * ball.speed;
}

function endGame(winner) {
    gameRunning = false;
    document.getElementById('finalScore1').textContent = player1.score;
    document.getElementById('finalScore2').textContent = player2.score;
    
    let winnerText = winner === 1 ? '🎉 ¡JUGADOR 1 GANA! 🎉' : '🎉 ¡JUGADOR 2 GANA! 🎉';
    if (gameMode === 'singleplayer' && winner === 1) {
        winnerText = '🎉 ¡GANASTE! 🎉';
    } else if (gameMode === 'singleplayer' && winner === 2) {
        winnerText = '😢 ¡PERDISTE! 😢';
    }
    
    document.getElementById('winnerText').textContent = winnerText;
    showScreen('gameOverScreen');
    playSound('gameOver');
}

// ==================== DIBUJO ====================
function draw() {
    // Fondo
    ctx.fillStyle = 'rgba(10, 14, 39, 0.1)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Línea central punteada
    ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(GAME_WIDTH / 2, 0);
    ctx.lineTo(GAME_WIDTH / 2, GAME_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    // Raqueta 1
    drawRectWithGlow(player1.x, player1.y, paddle.width, paddle.height, 'rgba(0, 255, 136, 1)', 15);

    // Raqueta 2
    drawRectWithGlow(player2.x, player2.y, paddle.width, paddle.height, 'rgba(0, 255, 136, 1)', 15);

    // Pelota
    drawCircleWithGlow(ballState.x + ball.width / 2, ballState.y + ball.height / 2, ball.width / 2, 'rgba(255, 0, 136, 1)', 20);
}

function drawRectWithGlow(x, y, w, h, color, glowSize) {
    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = glowSize;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
}

function drawCircleWithGlow(x, y, r, color, glowSize) {
    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = glowSize;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

// ==================== SONIDOS ====================
function playSound(type) {
    if (!soundEnabled) return;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    switch (type) {
        case 'bounce':
            playTone(audioContext, 400, 0.1, 'sine');
            break;
        case 'paddle':
            playTone(audioContext, 600, 0.15, 'square');
            break;
        case 'score':
            playTone(audioContext, 800, 0.2, 'sine');
            setTimeout(() => playTone(audioContext, 1000, 0.2, 'sine'), 100);
            break;
        case 'gameOver':
            playTone(audioContext, 300, 0.3, 'sine');
            setTimeout(() => playTone(audioContext, 200, 0.3, 'sine'), 200);
            break;
    }
}

function playTone(audioContext, freq, duration, type = 'sine') {
    try {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.type = type;
        osc.frequency.value = freq;
        
        gain.gain.setValueAtTime(0.3, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
        
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime + duration);
    } catch (e) {
        console.log('Audio context error:', e);
    }
}

// ==================== GAME LOOP ====================
function gameLoop() {
    if (!gameRunning) return;
    if (gamePaused) {
        requestAnimationFrame(gameLoop);
        return;
    }

    // Actualizar
    updatePlayer(player1);
    
    if (gameMode === 'singleplayer') {
        updateAI();
    } else {
        updatePlayer(player2);
    }
    
    updateBall();

    // Dibujar
    draw();

    // Siguiente frame
    requestAnimationFrame(gameLoop);
}

// ==================== INICIALIZACIÓN ====================
showScreen('menu');
