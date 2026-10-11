// ==================== VARIABLES GLOBALES ====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let gameMode = 'singleplayer'; // 'singleplayer' o 'multiplayer'
let gameRunning = false;
let gamePaused = false;
let gameSpeed = 1;
let difficulty = 'normal';
let soundEnabled = true;
let socket = null;
let currentUsername = '';
let currentRoomId = null;
let currentRoomName = '';
let myPlayerNumber = 1;

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

// ==================== INICIALIZAR SOCKET.IO ====================
function initializeSocket() {
    if (socket && socket.connected) return;

    const serverUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:3000' 
        : 'https://pong-server-8aus.onrender.com';
    
    socket = io(serverUrl, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5
    });

    socket.on('connect', () => {
        console.log('✅ Conectado al servidor');
        refreshRooms();
    });

    socket.on('disconnect', () => {
        console.log('❌ Desconectado del servidor');
    });

    socket.on('error', (error) => {
        console.error('Error Socket.IO:', error);
        alert(error.message || 'Error de conexión');
    });

    // Lista de salas
    socket.on('rooms_list', (rooms) => {
        renderRoomsList(rooms);
    });

    // Sala creada
    socket.on('room_created', (data) => {
        console.log('Sala creada:', data.roomId, data.roomName);
        currentRoomId = data.roomId;
        currentRoomName = data.roomName;
        myPlayerNumber = data.playerNumber;
        showWaitingRoom(data.roomName, data.roomId);
    });

    // Unido a sala
    socket.on('room_joined', (data) => {
        console.log('Unido a sala:', data.roomId, data.roomName);
        currentRoomId = data.roomId;
        currentRoomName = data.roomName;
        myPlayerNumber = data.playerNumber;
        document.getElementById('gameMode').textContent = data.roomName || 'Multijugador';
    });

    // Otro jugador se unió
    socket.on('player_joined', (data) => {
        console.log('Jugador se unió:', data);
        if (data.canStart) {
            // Ambos listos → iniciar
            startMultiplayerGame();
        }
    });

    socket.on('game_started', (data) => {
        console.log('Juego iniciado');
        gameRunning = true;
        showScreen('gameScreen');
        document.getElementById('gameMode').textContent = currentRoomName || 'Multijugador';
        gameLoop();
    });

    socket.on('game_state_update', (data) => {
        if (data.gameState) {
            ballState = data.gameState.ball;
            // Actualizar la raqueta del oponente
            if (myPlayerNumber === 1) {
                player2.y = data.gameState.player2.y;
                player2.score = data.gameState.player2.score;
                player1.score = data.gameState.player1.score;
            } else {
                player1.y = data.gameState.player1.y;
                player1.score = data.gameState.player1.score;
                player2.score = data.gameState.player2.score;
            }
            document.getElementById('score1').textContent = data.gameState.player1.score;
            document.getElementById('score2').textContent = data.gameState.player2.score;
        }
    });

    socket.on('game_ended', (data) => {
        gameRunning = false;
        document.getElementById('finalScore1').textContent = data.scores.player1;
        document.getElementById('finalScore2').textContent = data.scores.player2;
        document.getElementById('winnerText').textContent = data.winner === 1 ? '🎉 ¡JUGADOR 1 GANA! 🎉' : '🎉 ¡JUGADOR 2 GANA! 🎉';
        showScreen('gameOverScreen');
    });

    socket.on('player_disconnected', (data) => {
        alert('El otro jugador se desconectó');
        backToMenu();
    });
}

// ==================== LOBBY / SALAS ====================
function openMultiplayerLobby() {
    gameMode = 'multiplayer';
    if (!socket) initializeSocket();
    else refreshRooms();

    // Nombre por defecto
    const input = document.getElementById('usernameInput');
    if (!input.value) {
        input.value = 'Jugador' + Math.floor(Math.random() * 900 + 100);
    }
    showScreen('multiplayerLobby');
}

function getUsername() {
    const name = document.getElementById('usernameInput').value.trim();
    currentUsername = name || ('Jugador' + Math.floor(Math.random() * 900 + 100));
    return currentUsername;
}

function createRoom() {
    if (!socket || !socket.connected) {
        alert('No conectado al servidor. Intenta de nuevo.');
        initializeSocket();
        return;
    }
    const username = getUsername();
    const roomName = document.getElementById('roomNameInput').value.trim();
    socket.emit('create_room', { username, roomName });
}

function joinRoom(roomId) {
    if (!socket || !socket.connected) {
        alert('No conectado al servidor.');
        return;
    }
    const username = getUsername();
    socket.emit('join_room', { roomId, username });
    showScreen('gameScreen');
    document.getElementById('gameMode').textContent = 'Conectando...';
}

function joinRoomByCode() {
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (!code || code.length < 4) {
        alert('Ingresa un código válido');
        return;
    }
    joinRoom(code);
}

function refreshRooms() {
    if (socket && socket.connected) {
        socket.emit('get_rooms');
    } else {
        document.getElementById('roomsList').innerHTML = '<p class="no-rooms">Conectando al servidor...</p>';
    }
}

function renderRoomsList(rooms) {
    const container = document.getElementById('roomsList');
    if (!rooms || rooms.length === 0) {
        container.innerHTML = '<p class="no-rooms">No hay salas disponibles.<br>¡Crea una!</p>';
        return;
    }

    container.innerHTML = rooms.map(room => `
        <div class="room-item" onclick="joinRoom('${room.roomId}')">
            <div class="room-info">
                <div class="room-name">${escapeHtml(room.roomName)}</div>
                <div class="room-meta">Host: ${escapeHtml(room.hostName)} · Código: ${room.roomId}</div>
            </div>
            <div class="room-players">${room.players}/${room.maxPlayers}</div>
        </div>
    `).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

function showWaitingRoom(roomName, roomId) {
    document.getElementById('waitingRoomTitle').textContent = roomName || 'Sala';
    document.getElementById('waitingRoomCode').textContent = roomId;
    document.getElementById('waitingStatus').textContent = 'Esperando a otro jugador...';
    showScreen('waitingRoom');
}

function leaveWaitingRoom() {
    if (socket) socket.disconnect();
    socket = null;
    currentRoomId = null;
    backToMenu();
}

function startMultiplayerGame() {
    resetGame();
    if (socket) socket.emit('start_game');
    showScreen('gameScreen');
    document.getElementById('gameMode').textContent = currentRoomName || 'Multijugador';
}

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
    currentRoomId = null;
    currentRoomName = '';
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    showScreen('menu');
}

function startSinglePlayer() {
    gameMode = 'singleplayer';
    resetGame();
    showScreen('gameScreen');
    document.getElementById('gameMode').textContent = 'Un Jugador';
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
    if (gameMode === 'multiplayer') {
        // En multi no tiene sentido reiniciar localmente
        backToMenu();
        return;
    }
    resetGame();
    showScreen('gameScreen');
    gameRunning = true;
    gameLoop();
}

// ==================== CONTROLES TÁCTILES ====================
function movePlayer1Up(pressed) {
    player1.keys.up = pressed;
    if (socket && gameMode === 'multiplayer') {
        socket.emit('player_input', { direction: 'up', pressed });
    }
}

function movePlayer1Down(pressed) {
    player1.keys.down = pressed;
    if (socket && gameMode === 'multiplayer') {
        socket.emit('player_input', { direction: 'down', pressed });
    }
}

function movePlayer2Up(pressed) {
    player2.keys.up = pressed;
    if (socket && gameMode === 'multiplayer' && myPlayerNumber === 2) {
        socket.emit('player_input', { direction: 'up', pressed });
    }
}

function movePlayer2Down(pressed) {
    player2.keys.down = pressed;
    if (socket && gameMode === 'multiplayer' && myPlayerNumber === 2) {
        socket.emit('player_input', { direction: 'down', pressed });
    }
}

// Controles por teclado (para desktop)
document.addEventListener('keydown', (e) => {
    if (gameMode === 'multiplayer') {
        // En multi, solo controlas tu raqueta
        if (myPlayerNumber === 1) {
            if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') movePlayer1Up(true);
            if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') movePlayer1Down(true);
        } else {
            if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') movePlayer2Up(true);
            if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') movePlayer2Down(true);
        }
    } else {
        if (e.key === 'w' || e.key === 'W') movePlayer1Up(true);
        if (e.key === 's' || e.key === 'S') movePlayer1Down(true);
        if (e.key === 'ArrowUp') movePlayer2Up(true);
        if (e.key === 'ArrowDown') movePlayer2Down(true);
    }
    if (e.key === ' ') {
        e.preventDefault();
        togglePause();
    }
});

document.addEventListener('keyup', (e) => {
    if (gameMode === 'multiplayer') {
        if (myPlayerNumber === 1) {
            if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') movePlayer1Up(false);
            if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') movePlayer1Down(false);
        } else {
            if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') movePlayer2Up(false);
            if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') movePlayer2Down(false);
        }
    } else {
        if (e.key === 'w' || e.key === 'W') movePlayer1Up(false);
        if (e.key === 's' || e.key === 'S') movePlayer1Down(false);
        if (e.key === 'ArrowUp') movePlayer2Up(false);
        if (e.key === 'ArrowDown') movePlayer2Down(false);
    }
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
    if (player.keys.up && player.y > 0) {
        player.y -= paddle.speed * gameSpeed;
    }
    if (player.keys.down && player.y + paddle.height < GAME_HEIGHT) {
        player.y += paddle.speed * gameSpeed;
    }
    player.y = Math.max(0, Math.min(player.y, GAME_HEIGHT - paddle.height));
}

function updateAI() {
    const paddle2Center = player2.y + paddle.height / 2;
    const ballCenter = ballState.y;
    const targetSpeed = (() => {
        switch (difficulty) {
            case 'easy': return 3;
            case 'hard': return 8;
            case 'normal':
            default: return 5;
        }
    })();

    const errorMargin = difficulty === 'hard' ? 0 : difficulty === 'easy' ? 30 : 15;
    
    if (ballCenter < paddle2Center - errorMargin) {
        player2.y -= targetSpeed * gameSpeed;
    } else if (ballCenter > paddle2Center + errorMargin) {
        player2.y += targetSpeed * gameSpeed;
    }
    player2.y = Math.max(0, Math.min(player2.y, GAME_HEIGHT - paddle.height));
}

function updateBall() {
    // En multiplayer el servidor controla la pelota
    if (gameMode === 'multiplayer') return;

    ballState.x += ballState.velX * gameSpeed;
    ballState.y += ballState.velY * gameSpeed;

    if (ballState.y <= 0 || ballState.y + ball.height >= GAME_HEIGHT) {
        ballState.velY = -ballState.velY;
        ballState.y = Math.max(0, Math.min(ballState.y, GAME_HEIGHT - ball.height));
        playSound('bounce');
    }

    if (
        ballState.x <= player1.x + paddle.width &&
        ballState.y + ball.height >= player1.y &&
        ballState.y <= player1.y + paddle.height &&
        ballState.velX < 0
    ) {
        ballState.velX = -ballState.velX;
        ballState.x = player1.x + paddle.width;
        let collidePoint = ballState.y - (player1.y + paddle.height / 2);
        collidePoint = collidePoint / (paddle.height / 2);
        ballState.velY = collidePoint * ball.maxSpeed;
        ballState.velX = Math.abs(ballState.velX);
        playSound('paddle');
    }

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
    ctx.fillStyle = 'rgba(10, 14, 39, 0.1)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.strokeStyle = 'rgba(0, 255, 136, 0.3)';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(GAME_WIDTH / 2, 0);
    ctx.lineTo(GAME_WIDTH / 2, GAME_HEIGHT);
    ctx.stroke();
    ctx.setLineDash([]);

    drawRectWithGlow(player1.x, player1.y, paddle.width, paddle.height, 'rgba(0, 255, 136, 1)', 15);
    drawRectWithGlow(player2.x, player2.y, paddle.width, paddle.height, 'rgba(0, 255, 136, 1)', 15);
    drawCircleWithGlow(ballState.x + ball.width / 2, ballState.y + ball.height / 2, ball.width / 2, 'rgba(255, 0, 136, 1)', 20);
}

function drawRectWithGlow(x, y, w, h, color, glowSize) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glowSize;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
    ctx.shadowBlur = 0;
}

function drawCircleWithGlow(x, y, r, color, glowSize) {
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

    // Solo actualiza la raqueta local en multi
    if (gameMode === 'singleplayer') {
        updatePlayer(player1);
        updateAI();
        updateBall();
    } else if (gameMode === 'multiplayer') {
        // Enviar inputs y dejar que el servidor mueva todo
        if (myPlayerNumber === 1) {
            updatePlayer(player1);
        } else {
            updatePlayer(player2);
        }
    }
    
    draw();
    requestAnimationFrame(gameLoop);
}

// ==================== INICIALIZACIÓN ====================
showScreen('menu');
