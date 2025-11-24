const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Game state
let gameState = 'start'; // 'start', 'playing', 'gameOver'
let words = [];
let particles = [];
let score = 0;
let lives = 5;
let combo = 0;
let maxCombo = 0;
let gameTime = 0;
let spawnTimer = 0;
let spawnInterval = 2000; // Start slow
let difficultyLevel = 1;
let lastFrameTime = 0;

// Statistics tracking
let stats = {
    totalWords: 0,
    correctWords: 0,
    missedWords: 0,
    easyTyped: 0,
    mediumTyped: 0,
    hardTyped: 0,
    rareTyped: 0,
    totalCharacters: 0,
    powerupsCollected: 0
};

// Powerup system
let hasShield = false;
let shieldElement = null;

// Word lists are now in words.js

// Word tier properties: {points multiplier, rarity weight, color}
const tierProperties = {
    easy: {
        multiplier: 1,
        weight: 50,
        color: '#e0e0e0'
    },
    medium: {
        multiplier: 1.5,
        weight: 30,
        color: '#64b5f6'
    },
    hard: {
        multiplier: 2,
        weight: 15,
        color: '#ffd740'
    },
    rare: {
        multiplier: 3,
        weight: 5,
        color: '#ff5252'
    },
    powerup: {
        multiplier: 5,
        weight: 0, // Powerups spawn separately
        color: '#00ffff'
    }
};

function getRandomWord() {
    // Weighted random selection
    const rand = Math.random() * 100;
    let cumulative = 0;

    for (const [tier, props] of Object.entries(tierProperties)) {
        // Skip powerup tier for random word selection
        if (tier === 'powerup') continue;

        cumulative += props.weight;
        if (rand < cumulative) {
            const tierWords = wordTiers[tier];
            return {
                text: tierWords[Math.floor(Math.random() * tierWords.length)],
                tier: tier
            };
        }
    }

    return {
        text: wordTiers.easy[0],
        tier: 'easy'
    };
}

function calculateWordSpeed(wordLength) {
    // Longer words fall slower
    const baseSpeed = 0.5 + (difficultyLevel * 0.1);
    const lengthFactor = Math.max(0.3, 1 - (wordLength * 0.05));
    return baseSpeed * lengthFactor;
}

function spawnWord() {
    if (gameState !== 'playing') return;

    // 3% chance to spawn a powerup instead of regular word
    const spawnPowerup = Math.random() < 0.03 && difficultyLevel >= 2;

    let wordData, powerupType;

    if (spawnPowerup) {
        // Randomly select powerup type
        const types = Object.keys(powerupWords);
        powerupType = types[Math.floor(Math.random() * types.length)];
        const powerupList = powerupWords[powerupType];
        wordData = {
            text: powerupList[Math.floor(Math.random() * powerupList.length)],
            tier: 'powerup',
            powerupType: powerupType
        };
    } else {
        wordData = getRandomWord();
    }

    const wordLength = wordData.text.length;

    // Measure word width to prevent cutoff
    ctx.font = "bold 36px Arial";
    const textWidth = ctx.measureText(wordData.text).width;
    const margin = 20;
    const maxX = canvas.width - textWidth - margin;
    const minX = margin;

    const word = {
        text: wordData.text,
        tier: wordData.tier,
        powerupType: wordData.powerupType || null,
        x: Math.random() * (maxX - minX) + minX,
        y: -30,
        speed: calculateWordSpeed(wordLength),
        color: tierProperties[wordData.tier].color,
        opacity: 1,
        pulse: 0 // For powerup animation
    };
    words.push(word);
    stats.totalWords++;
}

function createParticles(x, y, color, count = 20) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 1,
            color: color,
            size: Math.random() * 4 + 2
        });
    }
}

function drawFloatingText(text, x, y, color, size = 24) {
    ctx.save();
    ctx.font = `bold ${size}px Arial`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y);
    ctx.restore();
}

function update(currentTime) {
    if (gameState !== 'playing') {
        requestAnimationFrame(update);
        return;
    }

    // Initialize lastFrameTime on first frame
    if (lastFrameTime === 0) {
        lastFrameTime = currentTime;
        requestAnimationFrame(update);
        return;
    }

    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    gameTime += deltaTime;

    // Update difficulty
    const newLevel = Math.floor(gameTime / 30000) + 1; // Level up every 30 seconds
    if (newLevel > difficultyLevel) {
        difficultyLevel = newLevel;
        document.getElementById('level').textContent = difficultyLevel;
        spawnInterval = Math.max(800, 2000 - (difficultyLevel * 200)); // Spawn faster
    }

    // Spawn words
    spawnTimer += deltaTime;
    if (spawnTimer >= spawnInterval) {
        spawnWord();
        spawnTimer = 0;
    }

    // Update time display
    document.getElementById('timeDisplay').textContent = Math.floor(gameTime / 1000) + 's';

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update and draw words
    for (let i = words.length - 1; i >= 0; i--) {
        const w = words[i];
        w.y += w.speed;

        // Powerup pulse animation
        if (w.tier === 'powerup') {
            w.pulse = (w.pulse || 0) + 0.1;
        }

        ctx.save();
        ctx.globalAlpha = w.opacity;

        // Rainbow effect for powerups
        if (w.tier === 'powerup') {
            const hue = (Date.now() / 10) % 360;
            ctx.fillStyle = `hsl(${hue}, 100%, 60%)`;
            ctx.shadowColor = `hsl(${hue}, 100%, 60%)`;
            ctx.shadowBlur = 30 + Math.sin(w.pulse) * 10;
        } else {
            ctx.fillStyle = w.color;
            ctx.shadowColor = w.color;
            ctx.shadowBlur = 20;
        }

        ctx.font = "bold 36px Arial";
        ctx.fillText(w.text, w.x, w.y);

        // Draw powerup icon
        if (w.tier === 'powerup') {
            const icon = w.powerupType === 'clear' ? '💥' :
                w.powerupType === 'heal' ? '❤️' : '🛡️';
            ctx.font = "32px Arial";
            ctx.fillText(icon, w.x - 40, w.y);
        }

        ctx.restore();

        // Check if word reached bottom
        if (w.y > canvas.height + 20) {
            words.splice(i, 1);
            loseLife();
        }
    }

    // Update and draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2; // gravity
        p.life -= 0.02;

        if (p.life <= 0) {
            particles.splice(i, 1);
            continue;
        }

        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    requestAnimationFrame(update);
}

function loseLife() {
    // Shield protects from losing a life
    if (hasShield) {
        hasShield = false;
        if (shieldElement) {
            shieldElement.remove();
            shieldElement = null;
        }
        showPowerupNotification('Shield Broken! 🛡️');
        return;
    }

    lives--;
    combo = 0;
    stats.missedWords++;
    updateLivesDisplay();
    updateComboDisplay();

    if (lives <= 0) {
        endGame();
    }
}

function endGame() {
    gameState = 'gameOver';
    displayStats();
    document.getElementById('gameOver').classList.remove('hidden');
    document.getElementById('inputField').style.display = 'none';
}

function displayStats() {
    const timeInSeconds = Math.floor(gameTime / 1000);
    const timeInMinutes = timeInSeconds / 60;
    const wpm = timeInMinutes > 0 ? Math.round(stats.totalCharacters / 5 / timeInMinutes) : 0;
    const accuracy = stats.totalWords > 0 ? Math.round((stats.correctWords / stats.totalWords) * 100) : 0;

    document.getElementById('finalScore').textContent = score.toLocaleString();
    document.getElementById('highestCombo').textContent = maxCombo + 'x';

    // Build fancy stats display
    const gameOverDiv = document.getElementById('gameOver');

    // Remove old stats if they exist
    const oldStats = gameOverDiv.querySelector('.stats-container');
    if (oldStats) oldStats.remove();
    const oldBreakdown = gameOverDiv.querySelector('.tier-breakdown');
    if (oldBreakdown) oldBreakdown.remove();

    // Create stats container
    const statsContainer = document.createElement('div');
    statsContainer.className = 'stats-container';
    statsContainer.innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Words Per Minute</div>
      <div class="stat-value">${wpm}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Accuracy</div>
      <div class="stat-value">${accuracy}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Words Typed</div>
      <div class="stat-value">${stats.correctWords}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total Characters</div>
      <div class="stat-value">${stats.totalCharacters}</div>
    </div>
  `;

    // Calculate max value for graph scaling
    const maxValue = Math.max(stats.easyTyped, stats.mediumTyped, stats.hardTyped, stats.rareTyped, 1);

    // Create tier breakdown with graph
    const tierBreakdown = document.createElement('div');
    tierBreakdown.className = 'tier-breakdown';
    tierBreakdown.innerHTML = `
    <h3>📊 Word Tier Breakdown</h3>
    <div class="tier-graph">
      <div class="tier-bar-container">
        <div class="tier-bar-label">
          <span class="tier-bar-name">⚪ Easy Words</span>
          <span class="tier-bar-value">${stats.easyTyped}</span>
        </div>
        <div class="tier-bar-wrapper">
          <div class="tier-bar-fill easy" style="width: ${(stats.easyTyped / maxValue) * 100}%"></div>
        </div>
      </div>
      <div class="tier-bar-container">
        <div class="tier-bar-label">
          <span class="tier-bar-name">🔵 Medium Words</span>
          <span class="tier-bar-value">${stats.mediumTyped}</span>
        </div>
        <div class="tier-bar-wrapper">
          <div class="tier-bar-fill medium" style="width: ${(stats.mediumTyped / maxValue) * 100}%"></div>
        </div>
      </div>
      <div class="tier-bar-container">
        <div class="tier-bar-label">
          <span class="tier-bar-name">🟡 Hard Words</span>
          <span class="tier-bar-value">${stats.hardTyped}</span>
        </div>
        <div class="tier-bar-wrapper">
          <div class="tier-bar-fill hard" style="width: ${(stats.hardTyped / maxValue) * 100}%"></div>
        </div>
      </div>
      <div class="tier-bar-container">
        <div class="tier-bar-label">
          <span class="tier-bar-name">🔴 Rare Words</span>
          <span class="tier-bar-value">${stats.rareTyped}</span>
        </div>
        <div class="tier-bar-wrapper">
          <div class="tier-bar-fill rare" style="width: ${(stats.rareTyped / maxValue) * 100}%"></div>
        </div>
      </div>
    </div>
  `;

    // Insert stats before the restart button
    const restartButton = gameOverDiv.querySelector('.screen-button');
    gameOverDiv.insertBefore(tierBreakdown, restartButton.nextSibling);
    gameOverDiv.insertBefore(statsContainer, tierBreakdown);
}

function activatePowerup(type) {
    stats.powerupsCollected++;

    switch (type) {
        case 'clear':
            // Remove all words from screen
            const clearedCount = words.length;
            words = [];
            showPowerupNotification('💥 ALL WORDS CLEARED! 💥');
            score += clearedCount * 50; // Bonus points
            document.getElementById('score').textContent = score;
            break;

        case 'heal':
            // Add one life (max 5)
            if (lives < 5) {
                lives++;
                updateLivesDisplay();
                showPowerupNotification('❤️ +1 LIFE! ❤️');
            } else {
                showPowerupNotification('❤️ LIFE AT MAX! ❤️');
            }
            break;

        case 'shield':
            // Activate shield
            hasShield = true;
            showPowerupNotification('🛡️ SHIELD ACTIVE! 🛡️');

            // Create shield visual indicator
            shieldElement = document.createElement('div');
            shieldElement.className = 'shield-indicator';
            shieldElement.textContent = '🛡️';
            document.body.appendChild(shieldElement);
            break;
    }
}

function showPowerupNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'powerup-notification';
    notification.textContent = message;
    document.body.appendChild(notification);

    // Remove after animation
    setTimeout(() => {
        notification.remove();
    }, 800);
}

function updateLivesDisplay() {
    const livesContainer = document.getElementById('lives');
    livesContainer.innerHTML = '';
    for (let i = 0; i < lives; i++) {
        const heart = document.createElement('span');
        heart.className = 'heart';
        heart.textContent = '❤️';
        livesContainer.appendChild(heart);
    }
}

function updateComboDisplay() {
    const comboElement = document.getElementById('combo');
    comboElement.textContent = combo + 'x';

    const comboDisplay = document.getElementById('comboDisplay');
    if (combo > 1) {
        comboDisplay.style.background = 'rgba(255, 107, 107, 0.8)';
        comboDisplay.style.transform = 'scale(1.1)';
    } else {
        comboDisplay.style.background = 'rgba(0, 0, 0, 0.4)';
        comboDisplay.style.transform = 'scale(1)';
    }
}

document.getElementById('inputField').addEventListener('input', (e) => {
    if (gameState !== 'playing') return;

    const input = e.target.value.trim();

    for (let i = 0; i < words.length; i++) {
        if (words[i].text === input) {
            const word = words[i];

            // Check if it's a powerup
            if (word.tier === 'powerup') {
                activatePowerup(word.powerupType);
                createParticles(word.x, word.y, '#00ffff', 50);
                words.splice(i, 1);
                e.target.value = "";
                break;
            }

            // Update stats
            stats.correctWords++;
            stats.totalCharacters += word.text.length;
            if (word.tier === 'easy') stats.easyTyped++;
            else if (word.tier === 'medium') stats.mediumTyped++;
            else if (word.tier === 'hard') stats.hardTyped++;
            else if (word.tier === 'rare') stats.rareTyped++;

            // Calculate score
            const basePoints = word.text.length * 10;
            const tierMultiplier = tierProperties[word.tier].multiplier;
            const comboMultiplier = 1 + (combo * 0.2);
            const points = Math.floor(basePoints * tierMultiplier * comboMultiplier);

            score += points;
            combo++;
            maxCombo = Math.max(maxCombo, combo);

            // Create visual effects
            createParticles(word.x, word.y, word.color, 30);

            // Update displays
            document.getElementById('score').textContent = score;
            updateComboDisplay();

            // Remove word
            words.splice(i, 1);
            e.target.value = "";

            break;
        }
    }
});

function startGame() {
    gameState = 'playing';
    score = 0;
    lives = 5;
    combo = 0;
    maxCombo = 0;
    gameTime = 0;
    spawnTimer = 0;
    difficultyLevel = 1;
    spawnInterval = 2000;
    words = [];
    particles = [];
    lastFrameTime = 0;

    // Reset stats
    stats = {
        totalWords: 0,
        correctWords: 0,
        missedWords: 0,
        easyTyped: 0,
        mediumTyped: 0,
        hardTyped: 0,
        rareTyped: 0,
        totalCharacters: 0
    };

    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('inputField').style.display = 'block';
    document.getElementById('inputField').focus();
    document.getElementById('score').textContent = '0';
    document.getElementById('combo').textContent = '0x';
    document.getElementById('level').textContent = '1';
    document.getElementById('timeDisplay').textContent = '0s';

    updateLivesDisplay();
    updateComboDisplay();

    requestAnimationFrame(update);
}

function restartGame() {
    document.getElementById('gameOver').classList.add('hidden');
    startGame();
}

// Handle window resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// Initial animation loop (for particles on menu screens)
requestAnimationFrame(update);
