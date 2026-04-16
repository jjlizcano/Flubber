// nos marca los pulsos del juego
window.requestAnimFrame = (function () {
    return  window.requestAnimationFrame        ||
        window.webkitRequestAnimationFrame  ||
        window.mozRequestAnimationFrame     ||
        window.oRequestAnimationFrame       ||
        window.msRequestAnimationFrame      ||
        function ( /* function */ callback, /* DOMElement */ element) {
            window.setTimeout(callback, 1000 / 60);
        };
})();
arrayRemove = function (array, from) {
    var rest = array.slice((from) + 1 || array.length);
    array.length = from < 0 ? array.length + from : from;
    return array.push.apply(array, rest);
};

var game = (function () {

    // Variables globales a la aplicacion
    var canvas,
        ctx,
        buffer,
        bufferctx,
        player,
        playerShot,
        bgMain,
        bgBoss,
        defaultEnemySpeed = 1,
        totalLevels = 2,
        phasesPerLevel = 10,
        playerLife = 3,
        shotSpeed = 5,
        playerSpeed = 5,
        currentLevel = 1,
        currentPhase = 1,
        currentStageType = 'normal',
        stageState = 'countdown',
        stageMessage = '',
        stageTransitionUntil = 0,
        stageSummaryDuration = 2000,
        stageCountdownDuration = 3000,
        activeStageConfig,
        pendingStageSpawns = 0,
        spawnedStageEnemies = 0,
        stageSpawnTimeout = null,
        youLoose = false,
        congratulations = false,
        minHorizontalOffset = 100,
        maxHorizontalOffset = 400,
        activeEnemies = [],
        totalBestScoresToShow = 5, // las mejores puntuaciones que se mostraran
        playerShotsBuffer = [],
        evilShotsBuffer = [],
        evilShotImage,
        playerShotImage,
        playerKilledImage,
        evilImages = {
            animation : [],
            killed : new Image()
        },
        bossImages = {
            animation : [],
            killed : new Image()
        },
        keyPressed = {},
        keyMap = {
            left: 37,
            right: 39,
            fire: 32     // tecla espacio
        },
        nextPlayerShot = 0,
        playerShotDelay = 250,
        now = 0;

    var arcadeTheme = {
        panelBg: 'rgba(25, 8, 32, 0.7)',
        panelStroke: 'rgba(255, 180, 0, 0.75)',
        primaryText: '#ffd447',
        secondaryText: '#ff9f1a',
        dangerText: '#ff4d5a',
        successText: '#ffe880',
        accentBoss: '#ff5470',
        glow: 'rgba(255, 140, 0, 0.85)',
        outline: '#2b122f',
        hudFont: "bold 14px 'Courier New', monospace",
        titleFont: "bold 28px 'Courier New', monospace",
        countdownFont: "bold 58px 'Courier New', monospace"
    };

    var enemyTypeConfigs = {
        1: { spriteIndex: 0, lifeBonus: 0, shotsBonus: 0, speedBonus: 0.00, pointsBonus: 0 },
        2: { spriteIndex: 1, lifeBonus: 1, shotsBonus: 0, speedBonus: 0.05, pointsBonus: 1 },
        3: { spriteIndex: 2, lifeBonus: 0, shotsBonus: 1, speedBonus: 0.08, pointsBonus: 2 },
        4: { spriteIndex: 3, lifeBonus: 1, shotsBonus: 1, speedBonus: 0.10, pointsBonus: 3 },
        5: { spriteIndex: 4, lifeBonus: 2, shotsBonus: 1, speedBonus: 0.14, pointsBonus: 4 }
    };

    var bossByLevel = {
        1: { spriteIndex: 0, lifeBonus: 0, shotsBonus: 0, speedBonus: 0.00, pointsBonus: 0 },
        2: { spriteIndex: 4, lifeBonus: 4, shotsBonus: 4, speedBonus: 0.10, pointsBonus: 15 }
    };

    function loop() {
        update();
        draw();
    }

    function preloadImages () {
        for (var i = 1; i <= 8; i++) {
            var evilImage = new Image();
            evilImage.src = 'images/malo' + i + '.png';
            evilImages.animation[i-1] = evilImage;
            var bossImage = new Image();
            bossImage.src = 'images/jefe' + i + '.png';
            bossImages.animation[i-1] = bossImage;
        }
        evilImages.killed.src = 'images/malo_muerto.png';
        bossImages.killed.src = 'images/jefe_muerto.png';
        bgMain = new Image();
        bgMain.src = 'images/fondovertical.png';
        bgBoss = new Image();
        bgBoss.src = 'images/fondovertical_jefe.png';
        playerShotImage = new Image();
        playerShotImage.src = 'images/disparo_bueno.png';
        evilShotImage = new Image();
        evilShotImage.src = 'images/disparo_malo.png';
        playerKilledImage = new Image();
        playerKilledImage.src = 'images/bueno_muerto.png';

    }

    function init() {

        preloadImages();

        showBestScores();

        canvas = document.getElementById('canvas');
        ctx = canvas.getContext("2d");

        buffer = document.createElement('canvas');
        buffer.width = canvas.width;
        buffer.height = canvas.height;
        bufferctx = buffer.getContext('2d');

        player = new Player(playerLife, 0);
        startCountdown('Nivel 1 - Fase 1');

        showLifeAndScore();

        addListener(document, 'keydown', keyDown);
        addListener(document, 'keyup', keyUp);

        function anim () {
            loop();
            requestAnimFrame(anim);
        }
        anim();
    }

    function showLifeAndScore () {
        var hudHeight = 56;
        drawArcadePanel(8, 8, canvas.width - 16, hudHeight, 0.65, 'rgba(255, 175, 0, 0.7)');

        drawArcadeText('NIVEL ' + currentLevel + '  FASE ' + currentPhase, 18, 30, {
            color: arcadeTheme.primaryText,
            font: arcadeTheme.hudFont,
            align: 'left',
            glowColor: arcadeTheme.glow,
            glowBlur: 5,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 3
        });

        drawArcadeText('ETAPA ' + (currentStageType === 'boss' ? 'JEFE' : 'NORMAL'), 18, 49, {
            color: arcadeTheme.secondaryText,
            font: "bold 13px 'Courier New', monospace",
            align: 'left',
            glowColor: 'rgba(255, 80, 0, 0.75)',
            glowBlur: 4,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });

        drawArcadeText('PUNTOS ' + player.score, canvas.width - 18, 30, {
            color: '#fff3a3',
            font: arcadeTheme.hudFont,
            align: 'right',
            glowColor: arcadeTheme.glow,
            glowBlur: 4,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 3
        });

        drawArcadeText('VIDAS ' + player.life, canvas.width - 18, 49, {
            color: '#ffd447',
            font: "bold 13px 'Courier New', monospace",
            align: 'right',
            glowColor: 'rgba(255, 115, 0, 0.8)',
            glowBlur: 4,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });
    }

    function getRandomNumber(range) {
        return Math.floor(Math.random() * range);
    }

    function getRandomInRange(min, max) {
        return min + getRandomNumber((max - min) + 1);
    }

    function pickRandomFrom(array) {
        return array[getRandomNumber(array.length)];
    }

    function drawArcadePanel(x, y, width, height, alpha, borderColor) {
        bufferctx.save();
        bufferctx.fillStyle = arcadeTheme.panelBg;
        bufferctx.globalAlpha = alpha || 1;
        bufferctx.fillRect(x, y, width, height);
        bufferctx.globalAlpha = 1;
        bufferctx.strokeStyle = borderColor || arcadeTheme.panelStroke;
        bufferctx.lineWidth = 2;
        bufferctx.strokeRect(x + 1, y + 1, width - 2, height - 2);
        bufferctx.restore();
    }

    function drawArcadeText(text, x, y, options) {
        var style = options || {};
        bufferctx.save();
        bufferctx.font = style.font || arcadeTheme.hudFont;
        bufferctx.textAlign = style.align || 'left';
        bufferctx.textBaseline = style.baseline || 'middle';
        bufferctx.lineJoin = 'round';
        bufferctx.strokeStyle = style.outlineColor || arcadeTheme.outline;
        bufferctx.lineWidth = style.outlineWidth || 3;
        bufferctx.strokeText(text, x, y);
        bufferctx.shadowColor = style.glowColor || arcadeTheme.glow;
        bufferctx.shadowBlur = style.glowBlur || 6;
        bufferctx.fillStyle = style.color || arcadeTheme.primaryText;
        bufferctx.fillText(text, x, y);
        bufferctx.restore();
    }

    function getCurrentStageConfig() {
        var isBossStage = currentStageType === 'boss';
        var enemyCount = getEnemyCountForPhase(currentLevel, currentPhase);
        var baseEnemyLife = 2 + (currentLevel - 1) + Math.floor((currentPhase - 1) / 3);
        var baseEnemyShots = 3 + currentLevel + Math.floor((currentPhase - 1) / 2);
        var baseEnemySpeed = defaultEnemySpeed + ((currentLevel - 1) * 0.25) + ((currentPhase - 1) * 0.03);

        var enemyTypePool = getEnemyTypePool(currentLevel, currentPhase);
        var maxConcurrent = getMaxConcurrentForStage(currentLevel, currentPhase);
        var spawnDelay = getSpawnDelayForLevel(currentLevel);

        return {
            type: currentStageType,
            enemyCount: isBossStage ? 1 : enemyCount,
            enemyLife: baseEnemyLife,
            enemyShots: baseEnemyShots,
            enemySpeed: baseEnemySpeed,
            enemyPoints: 4 + currentLevel + currentPhase,
            enemyTypePool: enemyTypePool,
            maxConcurrent: isBossStage ? 1 : maxConcurrent,
            spawnDelayMin: isBossStage ? 0 : spawnDelay.min,
            spawnDelayMax: isBossStage ? 0 : spawnDelay.max,
            bossLife: 10 + (currentLevel * 4),
            bossShots: 20 + (currentLevel * 8),
            bossSpeed: 0.8 + (currentLevel * 0.1),
            bossPoints: 40 + (currentLevel * 10)
        };
    }

    function getEnemyCountForPhase(level, phase) {
        if (level === 1) {
            return phase + 1;
        }
        if (level === 2) {
            return phase + 11;
        }
        return phase + 11;
    }

    function getEnemyTypePool(level, phase) {
        if (level === 1) {
            if (phase <= 3) {
                return [1];
            }
            if (phase <= 7) {
                return [1, 2];
            }
            return [1, 2, 3];
        }

        if (phase <= 2) {
            return [2, 3];
        }
        if (phase <= 4) {
            return [2, 3, 4];
        }
        if (phase <= 7) {
            return [2, 3, 4, 5];
        }
        return [1, 2, 3, 4, 5];
    }

    function getMaxConcurrentForStage(level, phase) {
        if (level === 1) {
            if (phase <= 3) {
                return 3;
            }
            if (phase <= 7) {
                return 4;
            }
            return 5;
        }

        if (phase <= 3) {
            return 5;
        }
        if (phase <= 7) {
            return 6;
        }
        return 7;
    }

    function getSpawnDelayForLevel(level) {
        if (level === 1) {
            return { min: 1200, max: 1800 };
        }
        return { min: 900, max: 1400 };
    }

    function getAliveEnemiesCount() {
        var aliveEnemies = 0;
        for (var i = 0; i < activeEnemies.length; i++) {
            if (!activeEnemies[i].dead) {
                aliveEnemies++;
            }
        }
        return aliveEnemies;
    }

    function clearStageEntities() {
        clearStageSpawnScheduler();
        for (var i = 0; i < activeEnemies.length; i++) {
            if (activeEnemies[i] && activeEnemies[i].stopShooting) {
                activeEnemies[i].stopShooting();
            }
        }
        activeEnemies.splice(0, activeEnemies.length);
        evilShotsBuffer.splice(0, evilShotsBuffer.length);
        playerShotsBuffer.splice(0, playerShotsBuffer.length);
        pendingStageSpawns = 0;
        spawnedStageEnemies = 0;
    }

    function clearStageSpawnScheduler() {
        if (stageSpawnTimeout) {
            clearTimeout(stageSpawnTimeout);
            stageSpawnTimeout = null;
        }
    }

    function startSummary(message) {
        stageState = 'summary';
        stageMessage = message;
        stageTransitionUntil = new Date().getTime() + stageSummaryDuration;
        clearStageEntities();
    }

    function startCountdown(message) {
        stageState = 'countdown';
        stageMessage = message;
        stageTransitionUntil = new Date().getTime() + stageCountdownDuration;
        clearStageEntities();
    }

    function startCurrentStage() {
        activeStageConfig = getCurrentStageConfig();
        stageState = 'playing';
        stageMessage = '';
        spawnStageEnemies(activeStageConfig);
    }

    function spawnStageEnemies(stageConfig) {
        clearStageSpawnScheduler();
        pendingStageSpawns = stageConfig.enemyCount;
        spawnedStageEnemies = 0;

        if (stageConfig.type === 'boss') {
            var bossEnemy = createBossByLevel(stageConfig);
            activeEnemies.push(bossEnemy);
            pendingStageSpawns = 0;
            spawnedStageEnemies = 1;
            return;
        }

        spawnNextEnemyWave(stageConfig);
    }

    function spawnNextEnemyWave(stageConfig) {
        if (stageState !== 'playing' || pendingStageSpawns <= 0) {
            clearStageSpawnScheduler();
            return;
        }

        if (getAliveEnemiesCount() >= stageConfig.maxConcurrent) {
            scheduleNextEnemyWave(stageConfig, 250);
            return;
        }

        var enemy = createEnemyByType(stageConfig);
        activeEnemies.push(enemy);
        pendingStageSpawns--;
        spawnedStageEnemies++;

        if (pendingStageSpawns > 0) {
            scheduleNextEnemyWave(stageConfig);
        } else {
            clearStageSpawnScheduler();
        }
    }

    function scheduleNextEnemyWave(stageConfig, forceDelay) {
        clearStageSpawnScheduler();
        var delay = typeof forceDelay === 'number' ? forceDelay :
            getRandomInRange(stageConfig.spawnDelayMin, stageConfig.spawnDelayMax);
        stageSpawnTimeout = setTimeout(function() {
            stageSpawnTimeout = null;
            spawnNextEnemyWave(stageConfig);
        }, delay);
    }

    function createEnemyByType(stageConfig) {
        var selectedType = pickRandomFrom(stageConfig.enemyTypePool);
        var enemyType = enemyTypeConfigs[selectedType] || enemyTypeConfigs[1];
        var life = stageConfig.enemyLife + enemyType.lifeBonus;
        var shots = stageConfig.enemyShots + enemyType.shotsBonus;
        var speed = stageConfig.enemySpeed + enemyType.speedBonus;
        var enemy = new Evil(life, shots, speed, enemyType.spriteIndex, selectedType);
        enemy.pointsToKill = stageConfig.enemyPoints + enemyType.pointsBonus;
        return enemy;
    }

    function createBossByLevel(stageConfig) {
        var bossConfig = bossByLevel[currentLevel] || bossByLevel[1];
        var boss = new FinalBoss(
            stageConfig.bossLife + bossConfig.lifeBonus,
            stageConfig.bossShots + bossConfig.shotsBonus,
            stageConfig.bossSpeed + bossConfig.speedBonus,
            bossConfig.spriteIndex,
            currentLevel
        );
        boss.pointsToKill = stageConfig.bossPoints + bossConfig.pointsBonus;
        return boss;
    }

    function isStageCleared() {
        if (pendingStageSpawns > 0 || stageSpawnTimeout) {
            return false;
        }
        for (var i = 0; i < activeEnemies.length; i++) {
            if (!activeEnemies[i].dead) {
                return false;
            }
        }
        return spawnedStageEnemies > 0;
    }

    function handleStageCleared() {
        if (currentStageType === 'boss') {
            if (currentLevel === totalLevels) {
                saveFinalScore();
                congratulations = true;
                clearStageEntities();
                return;
            }
            currentLevel++;
            currentPhase = 1;
            currentStageType = 'normal';
            startSummary('Nivel completado. Preparando Nivel ' + currentLevel);
            return;
        }

        if (currentPhase === phasesPerLevel) {
            currentStageType = 'boss';
            startSummary('Fase ' + phasesPerLevel + ' completada. Se acerca el jefe');
            return;
        }

        currentPhase++;
        startSummary('Fase completada. Preparando Fase ' + currentPhase);
    }

    function drawTransitionOverlay() {
        var centerX = canvas.width / 2;
        var centerY = canvas.height / 2;
        var overlayWidth = canvas.width - 120;
        var overlayHeight = 190;
        var overlayX = (canvas.width - overlayWidth) / 2;
        var overlayY = centerY - (overlayHeight / 2);
        var accentColor = currentStageType === 'boss' ? arcadeTheme.accentBoss : 'rgba(255, 170, 0, 0.9)';

        drawArcadePanel(overlayX, overlayY, overlayWidth, overlayHeight, 0.9, accentColor);

        drawArcadeText('CAMBIO DE ETAPA', centerX, overlayY + 42, {
            color: '#ffe680',
            font: "bold 18px 'Courier New', monospace",
            align: 'center',
            glowColor: accentColor,
            glowBlur: 9,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 3
        });

        drawArcadeText(stageMessage.toUpperCase(), centerX, overlayY + 86, {
            color: arcadeTheme.primaryText,
            font: "bold 20px 'Courier New', monospace",
            align: 'center',
            glowColor: accentColor,
            glowBlur: 8,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 3
        });

        if (stageState === 'countdown') {
            var millisLeft = stageTransitionUntil - new Date().getTime();
            var secondsLeft = Math.max(1, Math.ceil(millisLeft / 1000));
            drawArcadeText('INICIO EN', centerX, overlayY + 124, {
                color: '#ffcf63',
                font: "bold 14px 'Courier New', monospace",
                align: 'center',
                glowColor: accentColor,
                glowBlur: 6,
                outlineColor: arcadeTheme.outline,
                outlineWidth: 2
            });
            drawArcadeText(secondsLeft.toString(), centerX, overlayY + 160, {
                color: '#fff3a3',
                font: arcadeTheme.countdownFont,
                align: 'center',
                glowColor: accentColor,
                glowBlur: 11,
                outlineColor: arcadeTheme.outline,
                outlineWidth: 4
            });
        }
    }

    function Player(life, score) {
        var settings = {
            marginBottom : 10,
            defaultHeight : 66
        };
        player = new Image();
        player.src = 'images/bueno.png';
        player.posX = (canvas.width / 2) - (player.width / 2);
        player.posY = canvas.height - (player.height == 0 ? settings.defaultHeight : player.height) - settings.marginBottom;
        player.life = life;
        player.score = score;
        player.dead = false;
        player.speed = playerSpeed;

        var shoot = function () {
            if (nextPlayerShot < now || now == 0) {
                playerShot = new PlayerShot(player.posX + (player.width / 2) - 5 , player.posY);
                playerShot.add();
                now += playerShotDelay;
                nextPlayerShot = now + playerShotDelay;
            } else {
                now = new Date().getTime();
            }
        };

        player.doAnything = function() {
            if (player.dead)
                return;
            if (keyPressed.left && player.posX > 5)
                player.posX -= player.speed;
            if (keyPressed.right && player.posX < (canvas.width - player.width - 5))
                player.posX += player.speed;
            if (keyPressed.fire)
                shoot();
        };

        player.killPlayer = function() {
            if (this.life > 1) {
                this.dead = true;
                evilShotsBuffer.splice(0, evilShotsBuffer.length);
                playerShotsBuffer.splice(0, playerShotsBuffer.length);
                this.src = playerKilledImage.src;
                setTimeout(function () {
                    player = new Player(player.life - 1, player.score);
                }, 500);

            } else {
                saveFinalScore();
                clearStageEntities();
                youLoose = true;
            }
        };

        return player;
    }

    /******************************* DISPAROS *******************************/
    function Shot( x, y, array, img) {
        this.posX = x;
        this.posY = y;
        this.image = img;
        this.speed = shotSpeed;
        this.identifier = 0;
        this.add = function () {
            array.push(this);
        };
        this.deleteShot = function (idendificador) {
            arrayRemove(array, idendificador);
        };
    }

    function PlayerShot (x, y) {
        Object.getPrototypeOf(PlayerShot.prototype).constructor.call(this, x, y, playerShotsBuffer, playerShotImage);
    }

    PlayerShot.prototype = Object.create(Shot.prototype);
    PlayerShot.prototype.constructor = PlayerShot;

    function EvilShot (x, y) {
        Object.getPrototypeOf(EvilShot.prototype).constructor.call(this, x, y, evilShotsBuffer, evilShotImage);
        this.isHittingPlayer = function() {
            return (this.posX >= player.posX && this.posX <= (player.posX + player.width)
                && this.posY >= player.posY && this.posY <= (player.posY + player.height));
        };
    }

    EvilShot.prototype = Object.create(Shot.prototype);
    EvilShot.prototype.constructor = EvilShot;
    /******************************* FIN DISPAROS ********************************/


    /******************************* ENEMIGOS *******************************/
    function Enemy(life, shots, enemyImages, spriteIndex) {
        this.fixedSpriteIndex = typeof spriteIndex === 'number' ? spriteIndex : null;
        this.image = enemyImages.animation[this.fixedSpriteIndex !== null ? this.fixedSpriteIndex : 0];
        this.imageNumber = 1;
        this.animation = 0;
        this.posX = getRandomNumber(canvas.width - this.image.width);
        this.posY = -50;
        this.life = life;
        this.speed = defaultEnemySpeed;
        this.shots = shots;
        this.dead = false;
        this.shotTimeoutId = null;

        var desplazamientoHorizontal = minHorizontalOffset +
            getRandomNumber(maxHorizontalOffset - minHorizontalOffset);
        this.minX = getRandomNumber(canvas.width - desplazamientoHorizontal);
        this.maxX = this.minX + desplazamientoHorizontal - 40;
        this.direction = 'D';


        this.kill = function() {
            this.stopShooting();
            this.dead = true;
            this.image = enemyImages.killed;
        };

        this.update = function () {
            this.posY += this.goDownSpeed;
            if (this.direction === 'D') {
                if (this.posX <= this.maxX) {
                    this.posX += this.speed;
                } else {
                    this.direction = 'I';
                    this.posX -= this.speed;
                }
            } else {
                if (this.posX >= this.minX) {
                    this.posX -= this.speed;
                } else {
                    this.direction = 'D';
                    this.posX += this.speed;
                }
            }
            this.animation++;
            if (this.animation > 5) {
                this.animation = 0;
                if (this.fixedSpriteIndex === null) {
                    this.imageNumber ++;
                    if (this.imageNumber > 8) {
                        this.imageNumber = 1;
                    }
                    this.image = enemyImages.animation[this.imageNumber - 1];
                } else {
                    this.image = enemyImages.animation[this.fixedSpriteIndex];
                }
            }
        };

        this.isOutOfScreen = function() {
            return this.posY > (canvas.height + 15);
        };

        var self = this;

        function shoot(enemy) {
            if (enemy.shots > 0 && !enemy.dead && stageState === 'playing') {
                var disparo = new EvilShot(enemy.posX + (enemy.image.width / 2) - 5 , enemy.posY + enemy.image.height);
                disparo.add();
                enemy.shots --;
                enemy.shotTimeoutId = setTimeout(function() {
                    shoot(enemy);
                }, getRandomNumber(3000));
            }
        }

        this.stopShooting = function() {
            if (self.shotTimeoutId) {
                clearTimeout(self.shotTimeoutId);
                self.shotTimeoutId = null;
            }
        };

        self.shotTimeoutId = setTimeout(function() {
            shoot(self);
        }, 1000 + getRandomNumber(2500));

        this.toString = function () {
            return 'Enemigo con vidas:' + this.life + 'shotss: ' + this.shots + ' puntos por matar: ' + this.pointsToKill;
        }

    }

    function Evil (vidas, disparos, velocidad, spriteIndex, enemyType) {
        Object.getPrototypeOf(Evil.prototype).constructor.call(this, vidas, disparos, evilImages, spriteIndex);
        this.speed = velocidad;
        this.goDownSpeed = velocidad;
        this.enemyType = enemyType || 1;
        this.pointsToKill = 5;
    }

    Evil.prototype = Object.create(Enemy.prototype);
    Evil.prototype.constructor = Evil;

    function FinalBoss (vidas, disparos, velocidad, spriteIndex, bossLevel) {
        Object.getPrototypeOf(FinalBoss.prototype).constructor.call(this, vidas, disparos, bossImages, spriteIndex);
        this.speed = velocidad;
        this.goDownSpeed = velocidad / 2;
        this.bossLevel = bossLevel || 1;
        this.pointsToKill = 20;
    }

    FinalBoss.prototype = Object.create(Enemy.prototype);
    FinalBoss.prototype.constructor = FinalBoss;
    /******************************* FIN ENEMIGOS *******************************/

    function isEnemyHittingPlayer(enemy) {
        return (((enemy.posY + enemy.image.height) > player.posY && (player.posY + player.height) >= enemy.posY) &&
            ((player.posX >= enemy.posX && player.posX <= (enemy.posX + enemy.image.width)) ||
                (player.posX + player.width >= enemy.posX && (player.posX + player.width) <= (enemy.posX + enemy.image.width))));
    }

    function isAnyEnemyHittingPlayer() {
        for (var i = 0; i < activeEnemies.length; i++) {
            if (!activeEnemies[i].dead && isEnemyHittingPlayer(activeEnemies[i])) {
                return true;
            }
        }
        return false;
    }

    function checkCollisions(shot) {
        for (var i = 0; i < activeEnemies.length; i++) {
            var enemy = activeEnemies[i];
            if (!enemy.dead && shot.posX >= enemy.posX && shot.posX <= (enemy.posX + enemy.image.width) &&
                shot.posY >= enemy.posY && shot.posY <= (enemy.posY + enemy.image.height)) {
                if (enemy.life > 1) {
                    enemy.life--;
                } else {
                    enemy.kill();
                    player.score += enemy.pointsToKill;
                }
                shot.deleteShot(parseInt(shot.identifier));
                return false;
            }
        }
        return true;
    }

    function playerAction() {
        player.doAnything();
    }

    function addListener(element, type, expression, bubbling) {
        bubbling = bubbling || false;

        if (window.addEventListener) { // Standard
            element.addEventListener(type, expression, bubbling);
        } else if (window.attachEvent) { // IE
            element.attachEvent('on' + type, expression);
        }
    }

    function keyDown(e) {
        var key = (window.event ? e.keyCode : e.which);
        for (var inkey in keyMap) {
            if (key === keyMap[inkey]) {
                e.preventDefault();
                keyPressed[inkey] = true;
            }
        }
    }

    function keyUp(e) {
        var key = (window.event ? e.keyCode : e.which);
        for (var inkey in keyMap) {
            if (key === keyMap[inkey]) {
                e.preventDefault();
                keyPressed[inkey] = false;
            }
        }
    }

    function draw() {
        ctx.drawImage(buffer, 0, 0);
    }

    function showGameOver() {
        var centerX = canvas.width / 2;
        var centerY = canvas.height / 2;
        drawArcadePanel(100, centerY - 90, canvas.width - 200, 180, 0.9, 'rgba(255, 70, 80, 0.85)');
        drawArcadeText('GAME OVER', centerX, centerY - 12, {
            color: arcadeTheme.dangerText,
            font: arcadeTheme.titleFont,
            align: 'center',
            glowColor: 'rgba(255, 40, 70, 0.95)',
            glowBlur: 12,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 4
        });
        drawArcadeText('PULSA F5 PARA REINTENTAR', centerX, centerY + 34, {
            color: '#ffd9a0',
            font: "bold 13px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 90, 0, 0.75)',
            glowBlur: 5,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });
    }

    function showCongratulations () {
        var centerX = canvas.width / 2;
        var centerY = canvas.height / 2;
        drawArcadePanel(70, centerY - 120, canvas.width - 140, 240, 0.92, 'rgba(255, 208, 77, 0.9)');
        drawArcadeText('VICTORIA TOTAL', centerX, centerY - 70, {
            color: arcadeTheme.successText,
            font: arcadeTheme.titleFont,
            align: 'center',
            glowColor: 'rgba(255, 185, 40, 0.9)',
            glowBlur: 10,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 4
        });
        drawArcadeText('PUNTOS ' + player.score, centerX, centerY - 20, {
            color: '#ffe680',
            font: "bold 18px 'Courier New', monospace",
            align: 'center',
            glowColor: arcadeTheme.glow,
            glowBlur: 7,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 3
        });
        drawArcadeText('VIDAS ' + player.life + ' x 5', centerX, centerY + 20, {
            color: '#ffcf63',
            font: "bold 18px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 120, 0, 0.8)',
            glowBlur: 6,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 3
        });
        drawArcadeText('TOTAL ' + getTotalScore(), centerX, centerY + 62, {
            color: '#fff3a3',
            font: "bold 21px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 165, 0, 0.95)',
            glowBlur: 11,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 4
        });
    }

    function getTotalScore() {
        return player.score + player.life * 5;
    }

    function update() {

        drawBackground();

        if (congratulations) {
            showCongratulations();
            return;
        }

        if (youLoose) {
            showGameOver();
            return;
        }

        if (stageState !== 'playing') {
            drawTransitionOverlay();
            showLifeAndScore();
            if (new Date().getTime() >= stageTransitionUntil) {
                if (stageState === 'summary') {
                    startCountdown('Preparate para la siguiente etapa');
                } else if (stageState === 'countdown') {
                    startCurrentStage();
                }
            }
            return;
        }

        bufferctx.drawImage(player, player.posX, player.posY);
        for (var e = 0; e < activeEnemies.length; e++) {
            var enemy = activeEnemies[e];
            if (enemy) {
                bufferctx.drawImage(enemy.image, enemy.posX, enemy.posY);
            }
        }

        updateEnemies();

        for (var j = 0; j < playerShotsBuffer.length; j++) {
            var disparoBueno = playerShotsBuffer[j];
            updatePlayerShot(disparoBueno, j);
        }

        if (!player.dead && isAnyEnemyHittingPlayer()) {
            player.killPlayer();
        } else {
            for (var i = 0; i < evilShotsBuffer.length; i++) {
                var evilShot = evilShotsBuffer[i];
                updateEvilShot(evilShot, i);
            }
        }

        if (isStageCleared()) {
            handleStageCleared();
            return;
        }

        showLifeAndScore();

        playerAction();
    }

    function updatePlayerShot(playerShot, id) {
        if (playerShot) {
            playerShot.identifier = id;
            if (checkCollisions(playerShot)) {
                if (playerShot.posY > 0) {
                    playerShot.posY -= playerShot.speed;
                    bufferctx.drawImage(playerShot.image, playerShot.posX, playerShot.posY);
                } else {
                    playerShot.deleteShot(parseInt(playerShot.identifier));
                }
            }
        }
    }

    function updateEvilShot(evilShot, id) {
        if (evilShot) {
            evilShot.identifier = id;
            if (player.dead) {
                return;
            }
            if (!evilShot.isHittingPlayer()) {
                if (evilShot.posY <= canvas.height) {
                    evilShot.posY += evilShot.speed;
                    bufferctx.drawImage(evilShot.image, evilShot.posX, evilShot.posY);
                } else {
                    evilShot.deleteShot(parseInt(evilShot.identifier));
                }
            } else {
                player.killPlayer();
            }
        }
    }

    function drawBackground() {
        var background = currentStageType === 'boss' ? bgBoss : bgMain;
        bufferctx.drawImage(background, 0, 0);
    }

    function updateEnemies() {
        for (var i = 0; i < activeEnemies.length; i++) {
            var enemy = activeEnemies[i];
            if (!enemy.dead) {
                enemy.update();
                if (enemy.isOutOfScreen()) {
                    enemy.kill();
                }
            }
        }
    }

    /******************************* MEJORES PUNTUACIONES (LOCALSTORAGE) *******************************/
    function saveFinalScore() {
        localStorage.setItem(getFinalScoreDate(), getTotalScore());
        showBestScores();
        removeNoBestScores();
    }

    function getFinalScoreDate() {
        var date = new Date();
        return fillZero(date.getDay()+1)+'/'+
            fillZero(date.getMonth()+1)+'/'+
            date.getFullYear()+' '+
            fillZero(date.getHours())+':'+
            fillZero(date.getMinutes())+':'+
            fillZero(date.getSeconds());
    }

    function fillZero(number) {
        if (number < 10) {
            return '0' + number;
        }
        return number;
    }

    function getBestScoreKeys() {
        var bestScores = getAllScores();
        bestScores.sort(function (a, b) {return b - a;});
        bestScores = bestScores.slice(0, totalBestScoresToShow);
        var bestScoreKeys = [];
        for (var j = 0; j < bestScores.length; j++) {
            var score = bestScores[j];
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (parseInt(localStorage.getItem(key)) == score) {
                    bestScoreKeys.push(key);
                }
            }
        }
        return bestScoreKeys.slice(0, totalBestScoresToShow);
    }

    function getAllScores() {
        var all = [];
        for (var i=0; i < localStorage.length; i++) {
            all[i] = (localStorage.getItem(localStorage.key(i)));
        }
        return all;
    }

    function showBestScores() {
        var bestScores = getBestScoreKeys();
        var bestScoresList = document.getElementById('puntuaciones');
        if (bestScoresList) {
            clearList(bestScoresList);
            for (var i=0; i < bestScores.length; i++) {
                addListElement(bestScoresList, bestScores[i], i==0?'negrita':null);
                addListElement(bestScoresList, localStorage.getItem(bestScores[i]), i==0?'negrita':null);
            }
        }
    }

    function clearList(list) {
        list.innerHTML = '';
        addListElement(list, "Fecha");
        addListElement(list, "Puntos");
    }

    function addListElement(list, content, className) {
        var element = document.createElement('li');
        if (className) {
            element.setAttribute("class", className);
        }
        element.innerHTML = content;
        list.appendChild(element);
    }

    // extendemos el objeto array con un metodo "containsElement"
    Array.prototype.containsElement = function(element) {
        for (var i = 0; i < this.length; i++) {
            if (this[i] == element) {
                return true;
            }
        }
        return false;
    };

    function removeNoBestScores() {
        var scoresToRemove = [];
        var bestScoreKeys = getBestScoreKeys();
        for (var i=0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (!bestScoreKeys.containsElement(key)) {
                scoresToRemove.push(key);
            }
        }
        for (var j = 0; j < scoresToRemove.length; j++) {
            var scoreToRemoveKey = scoresToRemove[j];
            localStorage.removeItem(scoreToRemoveKey);
        }
    }
    /******************************* FIN MEJORES PUNTUACIONES *******************************/

    return {
        init: init
    }
})();