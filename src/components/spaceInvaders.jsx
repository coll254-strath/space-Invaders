// src/SpaceInvadersGame.jsx
import React, { useRef, useEffect, useState } from 'react';

// --- Game Configuration ---
const config = {
    playerWidth: 40,
    playerHeight: 20,
    playerSpeed: 7,
    playerEmoji: '🛸',
    bulletSpeed: 10,
    bulletWidth: 5,
    bulletHeight: 15,
    // --- Invader Config (3x density) ---
    invaderRows: 10,  // Increased from 5
    invaderCols: 25,  // Increased from 10
    invaderWidth: 20, // Smaller to fit
    invaderHeight: 15, // Smaller to fit
    invaderPadding: 10,
    invaderSpeed: 0.9, // Start a bit slower
    invaderEmoji: '👾',
    invaderBulletSpeed: 5,
    invaderShootChance: 0.052, // Chance per frame
    // --- Barricade Config ---
    barricadeBlockSize: 8,
    barricadeBlocksWide: 7,
    barricadeBlocksHigh: 4,
    barricadeCount: 4,
};

// --- Helper: Create Barricades ---
function createBarricades(width, height) {
    const barricades = [];
    const barricadeWidth = config.barricadeBlockSize * config.barricadeBlocksWide;
    const spacing = (width - (config.barricadeCount * barricadeWidth)) / (config.barricadeCount + 1);
    const startY = height - 120;

    for (let i = 0; i < config.barricadeCount; i++) {
        const startX = spacing * (i + 1) + barricadeWidth * i;
        for (let r = 0; r < config.barricadeBlocksHigh; r++) {
            for (let c = 0; c < config.barricadeBlocksWide; c++) {
                // Carve out an arch in the middle
                if (r > 1 && c > 1 && c < 5) {
                    continue;
                }
                barricades.push({
                    x: startX + c * config.barricadeBlockSize,
                    y: startY + r * config.barricadeBlockSize,
                    width: config.barricadeBlockSize,
                    height: config.barricadeBlockSize,
                    health: 3, // Each block has 3 HP
                });
            }
        }
    }
    return barricades;
}

// --- Helper: Create Initial State ---
function createInitialState(width, height) {
    const invaders = [];
    for (let r = 0; r < config.invaderRows; r++) {
        for (let c = 0; c < config.invaderCols; c++) {
            invaders.push({
                x: c * (config.invaderWidth + config.invaderPadding) + 30,
                y: r * (config.invaderHeight + config.invaderPadding) + 30,
                width: config.invaderWidth,
                height: config.invaderHeight,
            });
        }
    }
    return {
        playerX: (width - config.playerWidth) / 2,
        playerY: height - config.playerHeight - 20,
        bullets: [],
        invaders: invaders,
        invaderBullets: [],
        barricades: createBarricades(width, height),
        invaderDirection: 1,
        invaderSpeed: config.invaderSpeed,
        speedIncreased: false, // Flag for speed boost
        isGameOver: false,
        message: '',
    };
}

// --- React Component ---
const SpaceInvadersGame = () => {
    const canvasRef = useRef(null);
    const keysRef = useRef({});
    const animationFrameIdRef = useRef(null);
    
    const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
    const gameStateRef = useRef(createInitialState(dimensions.width, dimensions.height));

    const [score, setScore] = useState(0);
    const [gameOver, setGameOver] = useState(false);
    const [message, setMessage] = useState('');

    // --- Collision Detection Helper ---
    const checkCollision = (a, b) => {
        return a.x < b.x + b.width &&
               a.x + a.width > b.x &&
               a.y < b.y + b.height &&
               a.y + a.height > b.y;
    };

    // --- Handle Keyboard Input ---
    useEffect(() => {
        const handleKeyDown = (e) => { keysRef.current[e.code] = true; };
        const handleKeyUp = (e) => { keysRef.current[e.code] = false; };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, []);

    // --- Handle Window Resizing ---
    useEffect(() => {
        const handleResize = () => {
            setDimensions({ width: window.innerWidth, height: window.innerHeight });
            gameStateRef.current = createInitialState(window.innerWidth, window.innerHeight);
            setScore(0);
            setGameOver(false);
            setMessage('');
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // --- Main Game Loop ---
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = dimensions.width;
        canvas.height = dimensions.height;

        const loop = () => {
            const state = gameStateRef.current;
            if (state.isGameOver) {
                cancelAnimationFrame(animationFrameIdRef.current);
                return;
            }

            // --- 1. Update Game Logic ---
            let lowestInvaderY = 0;

            // Update Player
            if (keysRef.current['ArrowLeft'] && state.playerX > 0) {
                state.playerX -= config.playerSpeed;
            }
            if (keysRef.current['ArrowRight'] && state.playerX < dimensions.width - config.playerWidth) {
                state.playerX += config.playerSpeed;
            }

            // Update Player Bullets & Handle Shooting
            if (keysRef.current['Space'] && state.bullets.length < 5) {
                state.bullets.push({
                    x: state.playerX + config.playerWidth / 2 - config.bulletWidth / 2,
                    y: state.playerY - config.bulletHeight,
                    width: config.bulletWidth,
                    height: config.bulletHeight,
                });
                keysRef.current['Space'] = false; // Single shot
            }
            state.bullets = state.bullets.map(b => ({ ...b, y: b.y - config.bulletSpeed })).filter(b => b.y > 0);

            // Update Invaders
            let edgeReached = false;
            for (const invader of state.invaders) {
                invader.x += state.invaderSpeed * state.invaderDirection;
                if (invader.x <= 0 || invader.x >= dimensions.width - invader.width) {
                    edgeReached = true;
                }
                if (invader.y + invader.height >= state.playerY) {
                    state.isGameOver = true;
                    state.message = "GAME OVER";
                }
                lowestInvaderY = Math.max(lowestInvaderY, invader.y);
            }
            if (edgeReached) {
                state.invaderDirection *= -1;
                state.invaders.forEach(inv => inv.y += 20); // Descend one level
            }

            // --- NEW: Increase pace at a certain height ---
            if (!state.speedIncreased && lowestInvaderY > dimensions.height * 0.4) {
                state.invaderSpeed *= 1.5;
                state.speedIncreased = true;
            }

            // --- NEW: Invader Shooting ---
            if (Math.random() < config.invaderShootChance && state.invaders.length > 0) {
                const shootingInvader = state.invaders[Math.floor(Math.random() * state.invaders.length)];
                state.invaderBullets.push({
                    x: shootingInvader.x + shootingInvader.width / 2 - 2,
                    y: shootingInvader.y + shootingInvader.height,
                    width: 4,
                    height: 10,
                });
            }
            // Update invader bullets
            state.invaderBullets = state.invaderBullets
                .map(b => ({ ...b, y: b.y + config.invaderBulletSpeed }))
                .filter(b => b.y < dimensions.height);

            // --- NEW: Collision Detection ---
            let newScore = score;
            
            // Player bullets vs. Invaders & Barricades
            for (let i = state.bullets.length - 1; i >= 0; i--) {
                const b = state.bullets[i];
                let bulletRemoved = false;
                
                // Check barricades
                for (let j = state.barricades.length - 1; j >= 0; j--) {
                    const bar = state.barricades[j];
                    if (b && checkCollision(b, bar)) {
                        bar.health--;
                        state.bullets.splice(i, 1);
                        bulletRemoved = true;
                        break;
                    }
                }
                if (bulletRemoved) continue;

                // Check invaders
                for (let j = state.invaders.length - 1; j >= 0; j--) {
                    const inv = state.invaders[j];
                    if (b && checkCollision(b, inv)) {
                        state.bullets.splice(i, 1);
                        state.invaders.splice(j, 1);
                        newScore += 10;
                        state.invaderSpeed += 0.001; // Get slightly faster
                        break;
                    }
                }
            }
            
            // Invader bullets vs. Player & Barricades
            for (let i = state.invaderBullets.length - 1; i >= 0; i--) {
                const b = state.invaderBullets[i];
                let bulletRemoved = false;

                // Check barricades
                for (let j = state.barricades.length - 1; j >= 0; j--) {
                    const bar = state.barricades[j];
                    if (b && checkCollision(b, bar)) {
                        bar.health--;
                        state.invaderBullets.splice(i, 1);
                        bulletRemoved = true;
                        break;
                    }
                }
                if (bulletRemoved) continue;

                // Check player
                if (b && checkCollision(b, { ...state, x: state.playerX, y: state.playerY, width: config.playerWidth, height: config.playerHeight })) {
                    state.isGameOver = true;
                    state.message = "GAME OVER";
                }
            }

            // Invaders vs. Barricades
            for (const inv of state.invaders) {
                for (let j = state.barricades.length - 1; j >= 0; j--) {
                    if (checkCollision(inv, state.barricades[j])) {
                        state.barricades.splice(j, 1); // Invaders destroy blocks instantly
                    }
                }
            }

            // Clean up dead barricade blocks
            state.barricades = state.barricades.filter(b => b.health > 0);

            if (newScore !== score) setScore(newScore); // Update React state

            // Check Win Condition
            if (state.invaders.length === 0) {
                state.isGameOver = true;
                state.message = "YOU WIN!";
            }
            
            // --- 2. Draw Everything ---
            ctx.clearRect(0, 0, dimensions.width, dimensions.height);
            
            // Draw Player
            ctx.font = `${config.playerWidth * 0.8}px sans-serif`;
            ctx.fillText(config.playerEmoji, state.playerX, state.playerY + config.playerHeight);
            
            // Draw Player Bullets
            ctx.fillStyle = '#0f0'; // Green player bullets
            state.bullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));

            // Draw Invader Bullets
            ctx.fillStyle = '#f00'; // Red invader bullets
            state.invaderBullets.forEach(b => ctx.fillRect(b.x, b.y, b.width, b.height));

            // Draw Invaders
            ctx.font = '20px sans-serif';
            state.invaders.forEach(inv => ctx.fillText(config.invaderEmoji, inv.x, inv.y + inv.height));
            
            // --- NEW: Draw Barricades ---
            state.barricades.forEach(b => {
                ctx.fillStyle = b.health === 3 ? '#3c9' : b.health === 2 ? '#f90' : '#f00'; // Green -> Orange -> Red
                ctx.fillRect(b.x, b.y, b.width, b.height);
            });

            // Draw Score
            ctx.fillStyle = '#fff';
            ctx.font = '20px "Montserrat"'; // <-- NEW FONT
            ctx.textAlign = 'left';
            ctx.fillText(`Score: ${newScore}`, 10, 30);
            
            // Check for game over
            if (state.isGameOver) {
                setGameOver(true);
                setMessage(state.message);
            } else {
                animationFrameIdRef.current = requestAnimationFrame(loop);
            }
        };

        // Start the loop
        animationFrameIdRef.current = requestAnimationFrame(loop);

        // Cleanup function to stop the loop
        return () => {
            if (animationFrameIdRef.current) {
                cancelAnimationFrame(animationFrameIdRef.current);
            }
        };
    }, [dimensions, score]); // Re-run effect if dimensions change

    // --- Restart Game Function ---
    const restartGame = () => {
        gameStateRef.current = createInitialState(dimensions.width, dimensions.height);
        setScore(0);
        setGameOver(false);
        setMessage('');
    };

    return (
        <div style={{ position: 'relative', background: '#000' }}>
            <canvas ref={canvasRef} />
            {gameOver && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    color: '#4caf50',
                    fontFamily: "'Montserrat', sans-serif", // <-- NEW FONT
                }}>
                    <h1 style={{ fontSize: '50px', margin: 0 }}>{message}</h1>
                    <button onClick={restartGame} style={{
                        backgroundColor: '#4caf50',
                        color: '#000',
                        border: 'none',
                        padding: '10px 20px',
                        fontFamily: "'Montserrat', sans-serif", // <-- NEW FONT
                        fontSize: '16px',
                        cursor: 'pointer',
                        marginTop: '20px',
                    }}>
                        Play Again
                    </button>
                </div>
            )}
        </div>
    );
};

export default SpaceInvadersGame;