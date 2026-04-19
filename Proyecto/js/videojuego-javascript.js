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
    if (!array || !array.length) {
        return 0;
    }

    var index = parseInt(from, 10);
    if (isNaN(index)) {
        return array.length;
    }

    if (index < 0) {
        index = array.length + index;
    }

    if (index < 0 || index >= array.length) {
        return array.length;
    }

    var rest = array.slice(index + 1);
    array.length = index;
    return array.push.apply(array, rest);
};

var game = (function () {
    var gameConfig = window.FlubberGameConfig || {};
    var progressionConfig = gameConfig.progression || {};

    // Variables globales a la aplicacion
    var canvas,
        ctx,
        buffer,
        bufferctx,
        player,
        playerShot,
        bgMain,
        bgBoss,
        defaultEnemySpeed = gameConfig.defaultEnemySpeed || 1,
        totalLevels = progressionConfig.normalLevelsBeforeBoss || gameConfig.totalLevels || 10,
        playerLife = gameConfig.playerLife || 3,
        shotSpeed = gameConfig.shotSpeed || 5,
        playerSpeed = gameConfig.playerSpeed || 5,
        currentLevel = 1,
        currentProgressLevel = 1,
        currentStageType = 'normal',
        stageState = 'countdown',
        stageMessage = '',
        stageTransitionUntil = 0,
        stageSummaryDuration = gameConfig.stageSummaryDuration || 2000,
        stageCountdownDuration = gameConfig.stageCountdownDuration || 3000,
        activeStageConfig,
        pendingStageSpawns = 0,
        spawnedStageEnemies = 0,
        stageSpawnTimeout = null,
        enemyEntityRuntime = null,
        youLoose = false,
        congratulations = false,
        minHorizontalOffset = gameConfig.minHorizontalOffset || 100,
        maxHorizontalOffset = gameConfig.maxHorizontalOffset || 400,
        activeEnemies = [],
        bossBombs = [],
        totalBestScoresToShow = gameConfig.totalBestScoresToShow || 10, // las mejores puntuaciones que se mostraran
        playerShotsBuffer = [],
        evilShotsBuffer = [],
        evilShotImage,
        playerShotImage,
        playerKilledImage,
        playerAnimations = {
            idle: [],
            left: [],
            right: [],
            frameCount: 16,
            frameDurationMs: 1000 / 16
        },
        evilImages = {
            animation : [],
            type1Idle: [],
            type1Death: [],
            type2Idle: [],
            type2Death: [],
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
        now = 0,
        debugHitboxes = false;

    var bossWeaponUnlockNoticeUntil = 0;
    var bossWeaponUnlockNoticeDuration = gameConfig.bossWeaponUnlockNoticeDurationMs || 1400;

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

    var enemyTypeConfigs = gameConfig.enemyTypeConfigs || {
        1: { spriteIndex: 0, lifeBonus: 0, shotsBonus: 0, speedBonus: 0.14, pointsBonus: 0 },
        2: { spriteIndex: 1, lifeBonus: 1, shotsBonus: 0, speedBonus: 0.10, pointsBonus: 1 },
        3: { spriteIndex: 2, lifeBonus: 2, shotsBonus: 1, speedBonus: 0.08, pointsBonus: 3 },
        4: { spriteIndex: 3, lifeBonus: 3, shotsBonus: 1, speedBonus: 0.05, pointsBonus: 5 },
        5: { spriteIndex: 4, lifeBonus: 4, shotsBonus: 1, speedBonus: 0.00, pointsBonus: 7 }
    };

    var bossByLevel = gameConfig.bossByLevel || {
        1: { spriteIndex: 0, lifeBonus: 0, shotsBonus: 0, speedBonus: 0.00, pointsBonus: 0 },
        2: { spriteIndex: 4, lifeBonus: 4, shotsBonus: 4, speedBonus: 0.10, pointsBonus: 15 }
    };

    var rewardCatalog = {
        cadence: { id: 'cadence', name: 'Mas cadencia', description: 'Disparas mas rapido', maxStacks: 3, oneTime: false, rarity: 'common' },
        shield: { id: 'shield', name: 'Escudo', description: 'Absorbe un golpe', maxStacks: 3, oneTime: false, rarity: 'common' },
        bigBullets: { id: 'bigBullets', name: 'Balas grandes', description: 'Aumenta tamano y alcance', maxStacks: 2, oneTime: false, rarity: 'uncommon' },
        homing: { id: 'homing', name: 'Balas teledirigidas', description: 'Buscan enemigos cercanos', maxStacks: 1, oneTime: true, rarity: 'rare' },
        life: { id: 'life', name: '+1 vida', description: 'Ganas una vida extra', maxStacks: 1, oneTime: true, rarity: 'rare' },
        fogueo: { id: 'fogueo', name: 'Fogueo', description: 'Limpia balas enemigas periodicamente', maxStacks: 1, oneTime: true, rarity: 'rare' },
        bounce: { id: 'bounce', name: 'Balas con rebote', description: 'Rebota una vez entre objetivos', maxStacks: 1, oneTime: true, rarity: 'uncommon' },
        slow: { id: 'slow', name: 'Balas ralentizantes', description: 'Enemigos ralentizados al impactar', maxStacks: 2, oneTime: false, rarity: 'uncommon' },
        speed: { id: 'speed', name: 'Mas velocidad', description: 'Mueve mas rapido la nave', maxStacks: 2, oneTime: false, rarity: 'common' },
        points: { id: 'points', name: 'Multiplicador puntos', description: 'Mas puntos por enemigo', maxStacks: 2, oneTime: false, rarity: 'common' },
        dodge: { id: 'dodge', name: 'Esquivo', description: 'Evita 1 disparo enemigo', maxStacks: 1, oneTime: true, rarity: 'rare' },
        damage: { id: 'damage', name: 'Mas daño', description: 'Tus balas quitan mas vida', maxStacks: 2, oneTime: false, rarity: 'uncommon' }
    };

    var runUpgrades = {
        cadenceStacks: 0,
        shieldStacks: 0,
        bigBulletStacks: 0,
        homingStacks: 0,
        lifeTaken: false,
        fogueoTaken: false,
        fogueoNextPulseAt: 0,
        bounceStacks: 0,
        slowStacks: 0,
        speedStacks: 0,
        pointsStacks: 0,
        dodgeTaken: false,
        damageStacks: 0
    };

    var rewardChoices = [];
    var rewardSelectedIndex = 0;
    var rewardSelectionUnlockAt = 0;
    var rewardSelectionCooldownMs = gameConfig.rewardSelectionCooldownMs || 1800;
    var rewardIconImages = {};
    var rewardIconById = {
        cadence: 'cadencia.png',
        shield: 'escudo.png',
        bigBullets: 'balas_grandes.png',
        homing: 'balas_teledirigidas.png',
        life: 'life.png',
        fogueo: 'fogueo.png',
        bounce: 'balas_con_rebote.png',
        slow: 'balas_ralentizantes.png',
        speed: 'velocidad.png',
        points: 'multiplicador.png',
        dodge: 'esquivo.png',
        damage: 'da\u00f1o.png'
    };
    var pendingRewardRewarded = false;
    var playerShotDamage = 1;
    var playerShotScale = 1;
    var playerScoreMultiplier = 1;
    var playerEffectiveSpeed = playerSpeed;
    var maxPlayerLife = 5;
    var fogueoPulseInterval = 7000;
    var scoreHistoryStorageKey = 'flubber_score_history_v2';
    var scoreHistoryStorageLimit = 200;
    var playerNameInputBuffer = '';
    var playerNameInputCursorBlink = 0;
    var playerNameInputConfirmed = false;
    var playerNamePendingSave = false;
    var playerNameStorageKey = 'flubber_player_name';
    var comboStreak = 0;
    var comboKillProgress = 0;
    var comboMaxMultiplier = 5;
    var comboKillsPerStep = gameConfig.comboKillsPerStep || [2, 2, 3, 3];
    var comboMaxFlashUntil = 0;
    var comboMaxFlashDuration = gameConfig.comboMaxFlashDurationMs || 850;
    var legacyScoreDatePattern = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/;
    var debugRewardsForTest = [];
    var debugStartConfig = {
        enabled: false,
        level: 1,
        phase: 1,
        stageType: 'normal'
    };
    var mainMenuVolume = 70;
    var isPaused = false;
    var pausedStageState = '';
    var pauseStartedAt = 0;
    var gameMusic = null;
    var gameMusicBaseVolume = 0.55;
    var gameMusicTransitionVolume = 0.32;
    var gameMusicDuckForTransition = false;

    function loop() {
        update();
        draw();
    }

    function getGameMusicVolume() {
        return Math.max(0, Math.min(100, mainMenuVolume)) / 100;
    }

    function updateGameMusicVolume() {
        if (!gameMusic) {
            return;
        }

        var baseVolume = gameMusicDuckForTransition ? gameMusicTransitionVolume : gameMusicBaseVolume;
        gameMusic.volume = baseVolume * getGameMusicVolume();
    }

    function ensureGameMusic() {
        if (!gameMusic) {
            gameMusic = new Audio('music/Starthropod.mp3');
            gameMusic.loop = true;
            gameMusic.preload = 'auto';
        }

        updateGameMusicVolume();
        return gameMusic;
    }

    function setGameMusicDuckForTransition(shouldDuck) {
        gameMusicDuckForTransition = !!shouldDuck;
        updateGameMusicVolume();
    }

    function playGameMusic() {
        var music = ensureGameMusic();
        updateGameMusicVolume();

        var playPromise = music.play();
        if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(function () {});
        }
    }

    function pauseGameMusic() {
        if (gameMusic && !gameMusic.paused) {
            gameMusic.pause();
        }
    }

    function padFrameNumber(number) {
        if (number < 10) {
            return '00' + number;
        }
        return '0' + number;
    }

    function preloadImages () {
        for (var frameIndex = 0; frameIndex < playerAnimations.frameCount; frameIndex++) {
            var frameName = 'frame_' + padFrameNumber(frameIndex) + '.png';

            var idleFrame = new Image();
            idleFrame.src = 'images/buenoidle/' + frameName;
            playerAnimations.idle[frameIndex] = idleFrame;

            var leftFrame = new Image();
            leftFrame.src = 'images/buenoleft/' + frameName;
            playerAnimations.left[frameIndex] = leftFrame;

            var rightFrame = new Image();
            rightFrame.src = 'images/buenoright/' + frameName;
            playerAnimations.right[frameIndex] = rightFrame;

            var maloIdleFrame = new Image();
            maloIdleFrame.src = 'images/maloidle/' + frameName;
            evilImages.type1Idle[frameIndex] = maloIdleFrame;
        }

        for (var deathFrameIndex = 0; deathFrameIndex < 15; deathFrameIndex++) {
            var deathFrameName = 'frame_' + padFrameNumber(deathFrameIndex) + '.png';
            var maloDeathFrame = new Image();
            maloDeathFrame.src = 'images/malodeath/' + deathFrameName;
            evilImages.type1Death[deathFrameIndex] = maloDeathFrame;

            var malo2DeathFrame = new Image();
            malo2DeathFrame.src = 'images/malo2death/' + deathFrameName;
            evilImages.type2Death[deathFrameIndex] = malo2DeathFrame;
        }

        for (var type2FrameIndex = 0; type2FrameIndex < playerAnimations.frameCount; type2FrameIndex++) {
            var type2FrameName = 'frame_' + padFrameNumber(type2FrameIndex) + '.png';
            var malo2IdleFrame = new Image();
            malo2IdleFrame.src = 'images/malo2idle/' + type2FrameName;
            evilImages.type2Idle[type2FrameIndex] = malo2IdleFrame;
        }

        for (var i = 1; i <= 8; i++) {
            var evilImage = new Image();
            evilImage.src = 'images/malo' + i + '.png';
            evilImages.animation[i-1] = evilImage;
            var bossImage = new Image();
            bossImage.src = 'images/jefe' + i + '.png';
            bossImages.animation[i-1] = bossImage;
        }
        if (evilImages.type1Idle.length) {
            evilImages.animation[0] = evilImages.type1Idle[0];
        }
        if (evilImages.type2Idle.length) {
            evilImages.animation[1] = evilImages.type2Idle[0];
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
    function resetGameState() {
        // Reset level and game progress
        currentLevel = 1;
        currentProgressLevel = 1;
        currentStageType = 'normal';
        stageState = 'countdown';
        stageMessage = '';
        stageTransitionUntil = 0;
        activeStageConfig = null;
        pendingStageSpawns = 0;
        spawnedStageEnemies = 0;
        
        // Reset game status
        youLoose = false;
        congratulations = false;
        
        // Reset pause state
        isPaused = false;
        pausedStageState = '';
        pauseStartedAt = 0;
        
        // Clear active entities
        activeEnemies = [];
        bossBombs = [];
        playerShotsBuffer = [];
        evilShotsBuffer = [];
        nextPlayerShot = 0;
        now = 0;
        playerNamePendingSave = false;
        playerNameInputConfirmed = false;
        playerNameInputBuffer = '';
        playerNameInputCursorBlink = 0;
        comboStreak = 0;
        comboKillProgress = 0;
        comboMaxFlashUntil = 0;
        bossWeaponUnlockNoticeUntil = 0;
        
        // Reset upgrades
        resetRunUpgrades();
        refreshPlayerStats();

        // Player se crea fuera de esta funcion cuando el canvas ya esta listo.
        playerShot = null;

    }

    function restartGame() {
        resetGameState();
        loadDebugStartConfigFromUrl();
        applyDebugStartConfig();
        startMainMenu();
    }

    function startMainMenu() {
        stageState = 'menu';
        stageMessage = '';
        stageTransitionUntil = 0;
        clearStageEntities();
        clearKeyPressedState();
        setGameMusicDuckForTransition(false);
        playGameMusic();
    }

    function startGameFromMainMenu() {
        resetGameState();
        loadDebugStartConfigFromUrl();
        applyDebugStartConfig();
        player = new Player(playerLife, 0);
        applyDebugRewardsForTest();
        startCountdown('Nivel ' + currentLevel);
        showLifeAndScore();
    }

    function init() {

        preloadImages();
        resetGameState();

        migrateLegacyScoresIfNeeded();
        showBestScores();

        canvas = document.getElementById('canvas');
        ctx = canvas.getContext("2d");

        buffer = document.createElement('canvas');
        buffer.width = canvas.width;
        buffer.height = canvas.height;
        bufferctx = buffer.getContext('2d');

        ensureEnemyEntityRuntime();

        loadDebugStartConfigFromUrl();
        applyDebugStartConfig();
        startMainMenu();

        addListener(document, 'keydown', keyDown);
        addListener(document, 'keyup', keyUp);

        function anim () {
            loop();
            requestAnimFrame(anim);
        }
        anim();
    }

    function getBossLevelOneConfig() {
        var configRoot = window.FlubberGameConfig || {};
        return configRoot.bossLevelOne || {};
    }

    function ensureEnemyEntityRuntime() {
        if (enemyEntityRuntime) {
            return enemyEntityRuntime;
        }

        if (!window.FlubberEnemyEntity || typeof window.FlubberEnemyEntity.create !== 'function') {
            return null;
        }

        enemyEntityRuntime = window.FlubberEnemyEntity.create({
            getBossLevelOneConfig: getBossLevelOneConfig,
            getRandomNumber: getRandomNumber,
            getCanvasWidth: function() {
                return canvas ? canvas.width : 600;
            },
            getCanvasHeight: function() {
                return canvas ? canvas.height : 700;
            },
            getImageDimension: function(image, fallback) {
                return (image && image.width) || fallback;
            },
            getMinHorizontalOffset: function() {
                return minHorizontalOffset;
            },
            getMaxHorizontalOffset: function() {
                return maxHorizontalOffset;
            },
            getDefaultEnemySpeed: function() {
                return defaultEnemySpeed;
            },
            getStageState: function() {
                return stageState;
            },
            getPlayer: function() {
                return player;
            },
            createEvilShot: function(x, y) {
                return new EvilShot(x, y);
            }
        });

        return enemyEntityRuntime;
    }

    function applyDebugRewardsForTest() {
        if (!debugRewardsForTest || !debugRewardsForTest.length) {
            return;
        }
        for (var i = 0; i < debugRewardsForTest.length; i++) {
            var rewardId = debugRewardsForTest[i];
            if (rewardCatalog[rewardId]) {
                applyReward(rewardCatalog[rewardId]);
            }
        }
    }

    function parseDebugRewardList(rawValue) {
        if (!rawValue) {
            return [];
        }

        var values = rawValue.split(',');
        var parsed = [];
        var seen = {};

        for (var i = 0; i < values.length; i++) {
            var rewardId = (values[i] || '').replace(/\s+/g, '').toLowerCase();
            if (!rewardId || seen[rewardId] || !rewardCatalog[rewardId]) {
                continue;
            }
            seen[rewardId] = true;
            parsed.push(rewardId);
        }

        return parsed;
    }

    function loadDebugStartConfigFromUrl() {
        if (!window.location || !window.location.search) {
            return;
        }

        var params = window.location.search.replace(/^\?/, '').split('&');
        var values = {};

        for (var i = 0; i < params.length; i++) {
            if (!params[i]) {
                continue;
            }
            var pair = params[i].split('=');
            var key = decodeURIComponent(pair[0] || '').toLowerCase();
            var value = decodeURIComponent(pair[1] || '');
            values[key] = value;
        }

        if (values.debug === '1' || values.debug === 'true' || values.debug === 'yes') {
            debugStartConfig.enabled = true;
        }

        if (values.level) {
            debugStartConfig.level = parseInt(values.level, 10) || 1;
            debugStartConfig.enabled = true;
        }

        if (values.phase) {
            debugStartConfig.phase = parseInt(values.phase, 10) || 1;
            if (!values.level) {
                debugStartConfig.level = debugStartConfig.phase;
            }
            debugStartConfig.enabled = true;
        }

        if (values.stage) {
            debugStartConfig.stageType = values.stage.toLowerCase() === 'boss' ? 'boss' : 'normal';
            debugStartConfig.enabled = true;
        }

        if (values.hitboxes || values.debughitboxes) {
            debugStartConfig.hitboxes = values.hitboxes === '1' || values.hitboxes === 'true' || values.hitboxes === 'yes' ||
                values.debughitboxes === '1' || values.debughitboxes === 'true' || values.debughitboxes === 'yes';
            debugStartConfig.enabled = true;
        }

        var rewardsFromUrl = values.rewards || values.reward || '';
        if (rewardsFromUrl) {
            debugRewardsForTest = parseDebugRewardList(rewardsFromUrl);
        }
    }

    function applyDebugStartConfig() {
        if (!debugStartConfig || !debugStartConfig.enabled) {
            currentLevel = 1;
            currentProgressLevel = 1;
            currentStageType = 'normal';
            debugHitboxes = false;
            return;
        }

        currentLevel = Math.min(totalLevels, Math.max(1, parseInt(debugStartConfig.level, 10) || 1));
        currentProgressLevel = currentLevel;
        currentStageType = debugStartConfig.stageType === 'boss' ? 'boss' : 'normal';
        debugHitboxes = !!debugStartConfig.hitboxes;
    }

    function setDebugStartConfig(config) {
        debugStartConfig.enabled = !!(config && config.enabled);
        debugStartConfig.level = config && config.level !== undefined ? config.level : 1;
        debugStartConfig.phase = config && config.phase !== undefined ? config.phase : 1;
        debugStartConfig.stageType = config && config.stageType === 'boss' ? 'boss' : 'normal';
        debugStartConfig.hitboxes = !!(config && config.hitboxes);
    }

    function clearDebugStartConfig() {
        debugStartConfig.enabled = false;
        debugStartConfig.level = 1;
        debugStartConfig.phase = 1;
        debugStartConfig.stageType = 'normal';
        debugStartConfig.hitboxes = false;
        debugHitboxes = false;
    }

    function drawDebugHitboxes() {
        var i;
        var collisionSystem = window.FlubberCollisionSystem || null;

        if (player && !player.dead) {
            var playerCircle;
            if (collisionSystem && typeof collisionSystem.getPlayerHitCircle === 'function') {
                playerCircle = collisionSystem.getPlayerHitCircle(player, player);
            } else {
                var width = player.width || 52;
                var height = player.height || 66;
                playerCircle = {
                    x: player.posX + (width / 2),
                    y: player.posY + Math.round(height * 0.44),
                    radius: Math.max(12, Math.round(Math.min(width, height) * 0.28))
                };
            }

            bufferctx.save();
            bufferctx.strokeStyle = 'rgba(80, 255, 160, 0.9)';
            bufferctx.lineWidth = 2;
            bufferctx.beginPath();
            bufferctx.arc(playerCircle.x, playerCircle.y, playerCircle.radius, 0, Math.PI * 2, false);
            bufferctx.stroke();
            bufferctx.restore();
        }

        for (i = 0; i < activeEnemies.length; i++) {
            if (activeEnemies[i] && !activeEnemies[i].dead) {
                if (activeEnemies[i].isBossLevelOne && activeEnemies[i].bossCombat) {
                    var weaponBoxes = getBossWeaponHitboxes(activeEnemies[i]);
                    for (var w = 0; w < weaponBoxes.length; w++) {
                        var weaponBounds = weaponBoxes[w];
                        bufferctx.save();
                        bufferctx.strokeStyle = 'rgba(255, 70, 200, 0.95)';
                        bufferctx.lineWidth = 2;
                        bufferctx.strokeRect(
                            weaponBounds.left,
                            weaponBounds.top,
                            weaponBounds.width,
                            weaponBounds.height
                        );
                        bufferctx.restore();
                    }
                    continue;
                }

                var enemyBounds;
                if (collisionSystem && typeof collisionSystem.getEnemyBounds === 'function') {
                    enemyBounds = collisionSystem.getEnemyBounds(activeEnemies[i]);
                } else {
                    var enemyWidth = (activeEnemies[i].image && activeEnemies[i].image.width) || activeEnemies[i].spriteWidth || 40;
                    var enemyHeight = (activeEnemies[i].image && activeEnemies[i].image.height) || activeEnemies[i].spriteHeight || 40;
                    enemyBounds = {
                        left: activeEnemies[i].posX,
                        top: activeEnemies[i].posY,
                        width: enemyWidth,
                        height: enemyHeight
                    };
                }
                bufferctx.save();
                bufferctx.strokeStyle = 'rgba(255, 80, 120, 0.9)';
                bufferctx.lineWidth = 2;
                bufferctx.strokeRect(enemyBounds.left, enemyBounds.top, enemyBounds.width, enemyBounds.height);
                bufferctx.restore();
            }
        }

        for (i = 0; i < playerShotsBuffer.length; i++) {
            var playerShot = playerShotsBuffer[i];
            var playerShotBounds;
            if (collisionSystem && typeof collisionSystem.getPlayerShotBounds === 'function') {
                playerShotBounds = collisionSystem.getPlayerShotBounds(playerShot);
            } else {
                var playerShotWidth = Math.max(10, Math.round(10 * ((playerShot && playerShot.scale) || 1)));
                var playerShotHeight = Math.max(18, Math.round(20 * ((playerShot && playerShot.scale) || 1)));
                playerShotBounds = {
                    left: playerShot.posX - (playerShotWidth / 2),
                    top: playerShot.posY,
                    width: playerShotWidth,
                    height: playerShotHeight
                };
            }
            bufferctx.save();
            bufferctx.strokeStyle = 'rgba(80, 180, 255, 0.9)';
            bufferctx.lineWidth = 1;
            bufferctx.strokeRect(playerShotBounds.left, playerShotBounds.top, playerShotBounds.width, playerShotBounds.height);
            bufferctx.restore();
        }

        for (i = 0; i < evilShotsBuffer.length; i++) {
            var evilShot = evilShotsBuffer[i];
            var evilShotBounds;
            if (collisionSystem && typeof collisionSystem.getEnemyShotBounds === 'function') {
                evilShotBounds = collisionSystem.getEnemyShotBounds(evilShot);
            } else {
                evilShotBounds = {
                    left: evilShot.posX,
                    top: evilShot.posY,
                    width: 10,
                    height: 20
                };
            }
            bufferctx.save();
            bufferctx.strokeStyle = 'rgba(255, 200, 80, 0.9)';
            bufferctx.lineWidth = 1;
            bufferctx.strokeRect(evilShotBounds.left, evilShotBounds.top, evilShotBounds.width, evilShotBounds.height);
            bufferctx.restore();
        }
    }

    function setDebugRewardsForTest(rewardIds) {
        if (typeof rewardIds === 'string') {
            debugRewardsForTest = parseDebugRewardList(rewardIds);
            return;
        }

        if (!rewardIds || !rewardIds.length) {
            debugRewardsForTest = [];
            return;
        }

        debugRewardsForTest = parseDebugRewardList(rewardIds.join(','));
    }

    function clearDebugRewardsForTest() {
        debugRewardsForTest = [];
    }

    function showLifeAndScore () {
        var hudHeight = 56;
        drawArcadePanel(8, 8, canvas.width - 16, hudHeight, 0.65, 'rgba(255, 175, 0, 0.7)');

        drawArcadeText('NIVEL ' + currentLevel, 18, 30, {
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

        var comboMultiplier = getComboMultiplier();
        var nowTime = new Date().getTime();
        var maxComboFlashActive = nowTime < comboMaxFlashUntil;
        var comboPulse = maxComboFlashActive ? ((Math.sin(nowTime / 65) + 1) / 2) : 0;
        var comboText = 'COMBO x' + comboMultiplier;
        if (comboMultiplier < comboMaxMultiplier) {
            comboText += ' ' + comboKillProgress + '/' + getKillsNeededForNextCombo();
        }

        drawArcadeText(comboText, canvas.width / 2, 49, {
            color: maxComboFlashActive ? '#fff6b0' : '#ffe680',
            font: maxComboFlashActive ? "bold 15px 'Courier New', monospace" : "bold 13px 'Courier New', monospace",
            align: 'center',
            glowColor: maxComboFlashActive
                ? 'rgba(255, 180, 70, ' + (0.55 + (comboPulse * 0.4)) + ')'
                : 'rgba(255, 130, 45, 0.8)',
            glowBlur: maxComboFlashActive ? (8 + Math.round(comboPulse * 3)) : 5,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });

        if (maxComboFlashActive) {
            drawArcadeText('MAX!', (canvas.width / 2) + 62, 49, {
                color: '#ffd447',
                font: "bold 12px 'Courier New', monospace",
                align: 'left',
                glowColor: 'rgba(255, 120, 20, ' + (0.5 + (comboPulse * 0.4)) + ')',
                glowBlur: 6,
                outlineColor: arcadeTheme.outline,
                outlineWidth: 2
            });
        }

        drawActiveRewardsHud();

        if (currentStageType === 'boss') {
            drawBossOverallHealthBar();
            drawBossWeaponUnlockNotice();
        }
    }

    function getActiveRewardHudItems() {
        var entries = [
            { id: 'cadence', label: 'CAD', value: runUpgrades.cadenceStacks },
            { id: 'shield', label: 'SHD', value: runUpgrades.shieldStacks },
            { id: 'bigBullets', label: 'BIG', value: runUpgrades.bigBulletStacks },
            { id: 'homing', label: 'HOM', value: runUpgrades.homingStacks },
            { id: 'fogueo', label: 'FOG', value: runUpgrades.fogueoTaken ? 1 : 0 },
            { id: 'bounce', label: 'BNC', value: runUpgrades.bounceStacks },
            { id: 'slow', label: 'SLW', value: runUpgrades.slowStacks },
            { id: 'speed', label: 'SPD', value: runUpgrades.speedStacks },
            { id: 'points', label: 'PTS', value: runUpgrades.pointsStacks },
            { id: 'dodge', label: 'DOD', value: runUpgrades.dodgeTaken ? 1 : 0 },
            { id: 'damage', label: 'DMG', value: runUpgrades.damageStacks }
        ];
        var active = [];
        for (var i = 0; i < entries.length; i++) {
            if (entries[i].value > 0) {
                active.push(entries[i]);
            }
        }
        return active;
    }

    function drawActiveRewardsHud() {
        var items = getActiveRewardHudItems();
        if (!items.length) {
            return;
        }

        var iconSize = 32;
        var gap = 8;
        var chipWidth = 34;
        var chipHeight = 28;
        var startX = 14;
        var startY = currentStageType === 'boss' ? 96 : 70;
        var maxVerticalSpace = Math.max(1, canvas.height - startY - 16);
        var rowsPerColumn = Math.max(1, Math.floor(maxVerticalSpace / (chipHeight + gap)));

        drawArcadeText('PERKS', startX, startY - 8, {
            color: '#ffdf8e',
            font: "bold 9px 'Courier New', monospace",
            align: 'left',
            glowColor: 'rgba(255, 140, 25, 0.65)',
            glowBlur: 4,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });

        for (var i = 0; i < items.length; i++) {
            var column = Math.floor(i / rowsPerColumn);
            var row = i % rowsPerColumn;
            var x = startX + (column * (chipWidth + gap + 4));
            var y = startY + (row * (chipHeight + gap));
            var icon = getRewardIconImage(items[i].id);
            var hasIcon = icon && icon.complete && icon.naturalWidth > 0;

            if (hasIcon) {
                var scale = Math.min(iconSize / icon.naturalWidth, iconSize / icon.naturalHeight);
                var drawWidth = Math.max(10, Math.round(icon.naturalWidth * scale));
                var drawHeight = Math.max(10, Math.round(icon.naturalHeight * scale));
                var drawX = Math.round(x + ((chipWidth - drawWidth) / 2));
                var drawY = Math.round(y + ((chipHeight - drawHeight) / 2));

                bufferctx.save();
                bufferctx.imageSmoothingEnabled = false;
                bufferctx.drawImage(icon, drawX, drawY, drawWidth, drawHeight);
                bufferctx.restore();
            } else {
                drawArcadeText(items[i].label, x + (chipWidth / 2), y + 13, {
                    color: '#fff3b3',
                    font: "bold 10px 'Courier New', monospace",
                    align: 'center',
                    glowColor: 'rgba(255, 150, 30, 0.6)',
                    glowBlur: 3,
                    outlineColor: arcadeTheme.outline,
                    outlineWidth: 1
                });
            }

            if (items[i].value > 1) {
                drawArcadeText('x' + items[i].value, x + chipWidth - 2, y + chipHeight - 3, {
                    color: '#7dffb4',
                    font: "bold 9px 'Courier New', monospace",
                    align: 'right',
                    glowColor: 'rgba(0, 255, 140, 0.8)',
                    glowBlur: 4,
                    outlineColor: arcadeTheme.outline,
                    outlineWidth: 1
                });
            }
        }
    }

    function drawBossWeaponUnlockNotice() {
        var nowTime = new Date().getTime();
        if (nowTime >= bossWeaponUnlockNoticeUntil) {
            return;
        }

        var lifeLeftRatio = Math.max(0, Math.min(1, (bossWeaponUnlockNoticeUntil - nowTime) / Math.max(1, bossWeaponUnlockNoticeDuration)));
        var pulse = (Math.sin(nowTime / 90) + 1) / 2;
        var alpha = 0.45 + (lifeLeftRatio * 0.45);

        drawArcadeText('NUEVAS HITBOXES ACTIVAS', canvas.width / 2, 97, {
            color: 'rgba(255, 235, 132, ' + alpha + ')',
            font: "bold 13px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 100, 70, ' + (0.45 + (pulse * 0.4)) + ')',
            glowBlur: 7,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });
    }

    function getActiveBossEnemy() {
        for (var i = 0; i < activeEnemies.length; i++) {
            var enemy = activeEnemies[i];
            if (enemy && !enemy.dead && enemy.isBossLevelOne && enemy.bossCombat) {
                return enemy;
            }
        }
        return null;
    }

    function getBossOverallLifeSnapshot() {
        var boss = getActiveBossEnemy();
        if (!boss || !boss.bossCombat || !boss.bossCombat.weapons || !boss.bossCombat.weapons.length) {
            return null;
        }

        var totalLife = 0;
        var totalMaxLife = 0;
        for (var i = 0; i < boss.bossCombat.weapons.length; i++) {
            var weapon = boss.bossCombat.weapons[i];
            if (!weapon) {
                continue;
            }
            var maxLife = Math.max(1, weapon.maxLife || weapon.life || 1);
            var life = Math.max(0, weapon.life || 0);
            totalLife += life;
            totalMaxLife += maxLife;
        }

        if (totalMaxLife <= 0) {
            return null;
        }

        return {
            life: totalLife,
            maxLife: totalMaxLife,
            ratio: Math.max(0, Math.min(1, totalLife / totalMaxLife))
        };
    }

    function drawBossOverallHealthBar() {
        var snapshot = getBossOverallLifeSnapshot();
        if (!snapshot) {
            return;
        }

        var barWidth = Math.max(220, Math.round(canvas.width * 0.52));
        var barHeight = 10;
        var barX = Math.round((canvas.width - barWidth) / 2);
        var barY = 68;
        var fillWidth = Math.round(barWidth * snapshot.ratio);
        var isCritical = snapshot.ratio > 0 && snapshot.ratio <= 0.3;
        var pulse = isCritical ? ((Math.sin(new Date().getTime() / 130) + 1) / 2) : 0;
        var fillColor = snapshot.ratio > 0.6 ? '#59ff8b' : (snapshot.ratio > 0.3 ? '#ffd447' : '#ff4d5a');

        drawArcadeText('BOSS', barX - 10, barY + 9, {
            color: '#ffe680',
            font: "bold 12px 'Courier New', monospace",
            align: 'right',
            glowColor: 'rgba(255, 120, 80, 0.85)',
            glowBlur: 5,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });

        bufferctx.save();
        if (isCritical) {
            bufferctx.shadowBlur = 9 + Math.round(pulse * 6);
            bufferctx.shadowColor = 'rgba(255, 80, 95, ' + (0.35 + (pulse * 0.5)) + ')';
        }
        bufferctx.fillStyle = 'rgba(16, 9, 22, 0.93)';
        bufferctx.fillRect(barX, barY, barWidth, barHeight);
        if (fillWidth > 0) {
            bufferctx.fillStyle = fillColor;
            bufferctx.fillRect(barX, barY, fillWidth, barHeight);
        }
        bufferctx.strokeStyle = 'rgba(255, 235, 180, 0.94)';
        bufferctx.lineWidth = 1.5;
        bufferctx.strokeRect(barX + 0.5, barY + 0.5, barWidth - 1, barHeight - 1);
        bufferctx.restore();
    }

    function getRandomNumber(range) {
        return Math.floor(Math.random() * range);
    }

    function getComboMultiplier() {
        return Math.max(1, Math.min(comboMaxMultiplier, comboStreak));
    }

    function getKillsNeededForNextCombo() {
        var currentMultiplier = getComboMultiplier();
        if (currentMultiplier >= comboMaxMultiplier) {
            return 0;
        }
        var stepIndex = Math.max(0, Math.min(comboKillsPerStep.length - 1, currentMultiplier - 1));
        return Math.max(1, comboKillsPerStep[stepIndex] || 1);
    }

    function registerEnemyKillCombo() {
        var currentMultiplier = getComboMultiplier();
        if (currentMultiplier >= comboMaxMultiplier) {
            return;
        }

        comboKillProgress++;
        var killsNeeded = getKillsNeededForNextCombo();
        if (comboKillProgress < killsNeeded) {
            return;
        }

        var previousMultiplier = currentMultiplier;
        comboKillProgress = 0;
        comboStreak = Math.min(comboMaxMultiplier, comboStreak + 1);
        currentMultiplier = getComboMultiplier();
        if (previousMultiplier < comboMaxMultiplier && currentMultiplier === comboMaxMultiplier) {
            comboMaxFlashUntil = new Date().getTime() + comboMaxFlashDuration;
        }
    }

    function resetCombo() {
        comboStreak = 0;
        comboKillProgress = 0;
        comboMaxFlashUntil = 0;
    }

    function addScoreForEnemyKill(enemy) {
        if (!enemy) {
            return;
        }
        registerEnemyKillCombo();
        var comboMultiplier = getComboMultiplier();
        player.score += Math.round(enemy.pointsToKill * playerScoreMultiplier * comboMultiplier);
    }

    function getRandomInRange(min, max) {
        return min + getRandomNumber((max - min) + 1);
    }

    function pickRandomFrom(array) {
        return array[getRandomNumber(array.length)];
    }

    function resetRunUpgrades() {
        runUpgrades.cadenceStacks = 0;
        runUpgrades.shieldStacks = 0;
        runUpgrades.bigBulletStacks = 0;
        runUpgrades.homingStacks = 0;
        runUpgrades.lifeTaken = false;
        runUpgrades.fogueoTaken = false;
        runUpgrades.fogueoNextPulseAt = 0;
        runUpgrades.bounceStacks = 0;
        runUpgrades.slowStacks = 0;
        runUpgrades.speedStacks = 0;
        runUpgrades.pointsStacks = 0;
        runUpgrades.dodgeTaken = false;
        runUpgrades.damageStacks = 0;
        rewardChoices = [];
        rewardSelectedIndex = 0;
        rewardSelectionUnlockAt = 0;
        playerSpeed = 5;
        playerShotDelay = 250;
        playerShotDamage = 1;
        playerShotScale = 1;
        playerScoreMultiplier = 1;
        playerEffectiveSpeed = playerSpeed;
    }

    function refreshPlayerStats() {
        var cadenceMultiplier = 1 + (runUpgrades.cadenceStacks * 0.12);
        playerShotDelay = Math.max(90, Math.round(250 / cadenceMultiplier));
        playerShotScale = 1 + (runUpgrades.bigBulletStacks * 0.18);
        playerShotDamage = 1 + runUpgrades.damageStacks;
        playerScoreMultiplier = 1 + (runUpgrades.pointsStacks * 0.25);
        playerEffectiveSpeed = 5 + (runUpgrades.speedStacks * 0.75);
        playerSpeed = playerEffectiveSpeed;
        if (player) {
            player.speed = playerEffectiveSpeed;
        }
    }

    function getRewardWeightsForStage(level, phase) {
        if (level === 1) {
            if (phase <= 2) {
                return { cadence: 14, shield: 16, bigBullets: 12, slow: 12, fogueo: 8, bounce: 6, homing: 4, life: 2, speed: 12, points: 8, dodge: 2, damage: 4 };
            }
            if (phase <= 4) {
                return { cadence: 13, shield: 14, bigBullets: 12, slow: 12, fogueo: 8, bounce: 8, homing: 6, life: 4, speed: 12, points: 8, dodge: 2, damage: 3 };
            }
            if (phase <= 6) {
                return { cadence: 12, shield: 12, bigBullets: 10, slow: 12, fogueo: 8, bounce: 9, homing: 8, life: 6, speed: 11, points: 8, dodge: 2, damage: 4 };
            }
            if (phase <= 8) {
                return { cadence: 11, shield: 10, bigBullets: 9, slow: 11, fogueo: 9, bounce: 10, homing: 10, life: 8, speed: 10, points: 8, dodge: 2, damage: 5 };
            }
            return { cadence: 10, shield: 9, bigBullets: 8, slow: 10, fogueo: 10, bounce: 10, homing: 12, life: 10, speed: 9, points: 8, dodge: 2, damage: 6 };
        }

        if (phase <= 2) {
            return { cadence: 10, shield: 16, bigBullets: 10, slow: 12, fogueo: 10, bounce: 8, homing: 6, life: 4, speed: 10, points: 8, dodge: 2, damage: 5 };
        }
        if (phase <= 4) {
            return { cadence: 9, shield: 14, bigBullets: 10, slow: 12, fogueo: 10, bounce: 10, homing: 8, life: 4, speed: 10, points: 8, dodge: 2, damage: 5 };
        }
        if (phase <= 6) {
            return { cadence: 8, shield: 13, bigBullets: 9, slow: 12, fogueo: 10, bounce: 10, homing: 10, life: 6, speed: 10, points: 8, dodge: 2, damage: 6 };
        }
        if (phase <= 8) {
            return { cadence: 7, shield: 12, bigBullets: 8, slow: 11, fogueo: 12, bounce: 12, homing: 12, life: 8, speed: 8, points: 6, dodge: 2, damage: 7 };
        }
        return { cadence: 6, shield: 11, bigBullets: 7, slow: 10, fogueo: 12, bounce: 11, homing: 11, life: 9, speed: 8, points: 5, dodge: 2, damage: 8 };
    }

    function isRewardAvailable(rewardId) {
        switch (rewardId) {
            case 'cadence': return runUpgrades.cadenceStacks < 3;
            case 'shield': return runUpgrades.shieldStacks < 3;
            case 'bigBullets': return runUpgrades.bigBulletStacks < 2;
            case 'homing': return runUpgrades.homingStacks < 1;
            case 'life': return !runUpgrades.lifeTaken && player.life < maxPlayerLife;
            case 'fogueo': return !runUpgrades.fogueoTaken;
            case 'bounce': return runUpgrades.bounceStacks < 1;
            case 'slow': return runUpgrades.slowStacks < 2;
            case 'speed': return runUpgrades.speedStacks < 2;
            case 'points': return runUpgrades.pointsStacks < 2;
            case 'dodge': return !runUpgrades.dodgeTaken;
            case 'damage': return runUpgrades.damageStacks < 2;
            default: return false;
        }
    }

    function getAvailableRewardIds() {
        var ids = [];
        for (var key in rewardCatalog) {
            if (rewardCatalog.hasOwnProperty(key) && isRewardAvailable(key)) {
                ids.push(key);
            }
        }
        return ids;
    }

    function pickWeightedReward(weights, excludedIds) {
        excludedIds = excludedIds || [];
        var pool = [];
        var totalWeight = 0;
        for (var id in rewardCatalog) {
            if (rewardCatalog.hasOwnProperty(id) && isRewardAvailable(id) && excludedIds.indexOf(id) === -1) {
                var weight = weights[id] || 0;
                if (weight > 0) {
                    totalWeight += weight;
                    pool.push({ id: id, weight: weight, cumulative: totalWeight });
                }
            }
        }
        if (!pool.length) {
            return null;
        }
        var roll = getRandomNumber(totalWeight) + 1;
        for (var i = 0; i < pool.length; i++) {
            if (roll <= pool[i].cumulative) {
                return rewardCatalog[pool[i].id];
            }
        }
        return rewardCatalog[pool[pool.length - 1].id];
    }

    function generateRewardChoices() {
        var weights = getRewardWeightsForStage(currentLevel, currentLevel);
        var first = pickWeightedReward(weights, []);
        var excluded = first ? [first.id] : [];
        var second = pickWeightedReward(weights, excluded);
        var available = getAvailableRewardIds();

        if (!first && available.length > 0) {
            first = rewardCatalog[available[0]];
        }
        if (!second && available.length > 1) {
            second = rewardCatalog[available[1]];
        }
        if (!second && first) {
            second = first;
        }

        return [first, second];
    }

    function openRewardSelector() {
        rewardChoices = generateRewardChoices();
        rewardSelectedIndex = 0;
        rewardSelectionUnlockAt = new Date().getTime() + rewardSelectionCooldownMs;
        stageState = 'reward_pending';
        stageMessage = 'Elige una recompensa';
        stageTransitionUntil = 0;
    }

    function applyReward(reward) {
        if (!reward) {
            return;
        }

        switch (reward.id) {
            case 'cadence':
                runUpgrades.cadenceStacks = Math.min(3, runUpgrades.cadenceStacks + 1);
                break;
            case 'shield':
                runUpgrades.shieldStacks = Math.min(3, runUpgrades.shieldStacks + 1);
                break;
            case 'bigBullets':
                runUpgrades.bigBulletStacks = Math.min(2, runUpgrades.bigBulletStacks + 1);
                break;
            case 'homing':
                runUpgrades.homingStacks = 1;
                break;
            case 'life':
                runUpgrades.lifeTaken = true;
                if (player.life < maxPlayerLife) {
                    player.life = Math.min(maxPlayerLife, player.life + 1);
                }
                break;
            case 'fogueo':
                runUpgrades.fogueoTaken = true;
                triggerFogueoPulse();
                break;
            case 'bounce':
                runUpgrades.bounceStacks = 1;
                break;
            case 'slow':
                runUpgrades.slowStacks = Math.min(2, runUpgrades.slowStacks + 1);
                break;
            case 'speed':
                runUpgrades.speedStacks = Math.min(2, runUpgrades.speedStacks + 1);
                break;
            case 'points':
                runUpgrades.pointsStacks = Math.min(2, runUpgrades.pointsStacks + 1);
                break;
            case 'dodge':
                runUpgrades.dodgeTaken = true;
                break;
            case 'damage':
                runUpgrades.damageStacks = Math.min(2, runUpgrades.damageStacks + 1);
                break;
        }

        refreshPlayerStats();
    }

    function confirmSelectedReward() {
        var selectedReward = rewardChoices[rewardSelectedIndex] || rewardChoices[0];
        applyReward(selectedReward);
        rewardChoices = [];
        rewardSelectedIndex = 0;
        rewardSelectionUnlockAt = 0;
        completeStageClear();
    }

    function drawRewardSelector() {
        var centerX = canvas.width / 2;
        var centerY = canvas.height / 2;
        var cardWidth = 220;
        var cardHeight = 120;
        var gap = 28;
        var leftCardX = centerX - cardWidth - (gap / 2);
        var rightCardX = centerX + (gap / 2);
        var cardY = centerY - 58;

        drawArcadePanel(40, centerY - 145, canvas.width - 80, 280, 0.9, 'rgba(180, 100, 255, 0.9)');
        drawArcadeText('ELIGE TU RECOMPENSA', centerX, centerY - 118, {
            color: '#fff3a3',
            font: "bold 18px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 170, 0, 0.95)',
            glowBlur: 10,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 3
        });

        drawRewardCard(leftCardX, cardY, cardWidth, cardHeight, rewardChoices[0], rewardSelectedIndex === 0, 'IZQUIERDA');
        drawRewardCard(rightCardX, cardY, cardWidth, cardHeight, rewardChoices[1], rewardSelectedIndex === 1, 'DERECHA');

        drawArcadeText('USA IZQUIERDA / DERECHA Y ESPACIO', centerX, centerY - 92, {
            color: '#ffcf63',
            font: "bold 12px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 120, 0, 0.8)',
            glowBlur: 5,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });

        drawRewardSelectionCooldownBar(centerX - 160, centerY + 106, 320, 8);
    }

    function canConfirmRewardSelection() {
        return new Date().getTime() >= rewardSelectionUnlockAt;
    }

    function drawRewardSelectionCooldownBar(x, y, width, height) {
        var nowTime = new Date().getTime();
        var totalMs = Math.max(1, rewardSelectionCooldownMs);
        var remainingMs = Math.max(0, rewardSelectionUnlockAt - nowTime);
        var ratio = Math.max(0, Math.min(1, (totalMs - remainingMs) / totalMs));
        var fillWidth = Math.round(width * ratio);

        bufferctx.save();
        bufferctx.fillStyle = 'rgba(20, 12, 28, 0.8)';
        bufferctx.fillRect(x, y, width, height);
        bufferctx.fillStyle = 'rgba(0, 255, 140, 0.85)';
        if (fillWidth > 0) {
            bufferctx.fillRect(x, y, fillWidth, height);
        }
        bufferctx.strokeStyle = 'rgba(255, 210, 120, 0.8)';
        bufferctx.lineWidth = 1;
        bufferctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
        bufferctx.restore();

    }

    function getWrappedTextLines(text, maxWidth, font, maxLines) {
        var content = (text || '').toString();
        var words = content.split(/\s+/);
        var lines = [];
        var currentLine = '';

        bufferctx.save();
        bufferctx.font = font;

        for (var i = 0; i < words.length; i++) {
            var word = words[i];
            if (!word) {
                continue;
            }

            var testLine = currentLine ? (currentLine + ' ' + word) : word;
            if (bufferctx.measureText(testLine).width <= maxWidth) {
                currentLine = testLine;
                continue;
            }

            if (currentLine) {
                lines.push(currentLine);
                if (lines.length >= maxLines) {
                    break;
                }
            }
            currentLine = word;
        }

        if (currentLine && lines.length < maxLines) {
            lines.push(currentLine);
        }

        bufferctx.restore();

        if (lines.length === maxLines && words.length > 0) {
            var reconstructed = lines.join(' ');
            if (reconstructed.length < content.length) {
                lines[maxLines - 1] = lines[maxLines - 1].replace(/[\s\.]*$/, '') + '...';
            }
        }

        return lines;
    }

    function getRewardIconImage(rewardId) {
        if (!rewardId || !rewardIconById[rewardId]) {
            return null;
        }

        if (!rewardIconImages[rewardId]) {
            var icon = new Image();
            icon.src = 'images/power_ups/' + rewardIconById[rewardId];
            rewardIconImages[rewardId] = icon;
        }

        return rewardIconImages[rewardId];
    }

    function drawRewardCard(x, y, width, height, reward, selected, sideLabel) {
        var borderColor = selected ? 'rgba(0, 255, 140, 0.95)' : 'rgba(255, 175, 0, 0.7)';
        drawArcadePanel(x, y, width, height, 0.8, borderColor);
        drawArcadeText(sideLabel, x + (width / 2), y + 20, {
            color: selected ? '#7dffb4' : '#ffe680',
            font: "bold 12px 'Courier New', monospace",
            align: 'center',
            glowColor: selected ? 'rgba(0, 255, 140, 0.9)' : 'rgba(255, 170, 0, 0.8)',
            glowBlur: 6,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });

        if (reward) {
            var icon = getRewardIconImage(reward.id);
            var hasIcon = icon && icon.complete && icon.naturalWidth > 0;
            if (hasIcon) {
                var iconMaxSize = 34;
                var iconScale = Math.min(iconMaxSize / icon.naturalWidth, iconMaxSize / icon.naturalHeight);
                var iconWidth = Math.max(16, Math.round(icon.naturalWidth * iconScale));
                var iconHeight = Math.max(16, Math.round(icon.naturalHeight * iconScale));
                var iconX = Math.round(x + (width / 2) - (iconWidth / 2));
                var iconY = y + 28;

                bufferctx.save();
                bufferctx.imageSmoothingEnabled = false;
                bufferctx.drawImage(icon, iconX, iconY, iconWidth, iconHeight);
                bufferctx.restore();
            }

            drawArcadeText(reward.name, x + (width / 2), y + (hasIcon ? 70 : 52), {
                color: arcadeTheme.primaryText,
                font: "bold 14px 'Courier New', monospace",
                align: 'center',
                glowColor: arcadeTheme.glow,
                glowBlur: 6,
                outlineColor: arcadeTheme.outline,
                outlineWidth: 2
            });
            var descriptionFont = "bold 11px 'Courier New', monospace";
            var descriptionLines = getWrappedTextLines(reward.description, width - 18, descriptionFont, 2);
            for (var lineIndex = 0; lineIndex < descriptionLines.length; lineIndex++) {
                drawArcadeText(descriptionLines[lineIndex], x + (width / 2), y + (hasIcon ? 92 : 78) + (lineIndex * 14), {
                    color: '#fff3a3',
                    font: descriptionFont,
                    align: 'center',
                    glowColor: 'rgba(255, 120, 0, 0.5)',
                    glowBlur: 4,
                    outlineColor: arcadeTheme.outline,
                    outlineWidth: 1
                });
            }
        }
    }

    function clearEnemyProjectiles() {
        if (evilShotsBuffer.length > 0) {
            evilShotsBuffer.splice(0, evilShotsBuffer.length);
        }
    }

    function updateRewardEffects() {
        if (runUpgrades.fogueoTaken && runUpgrades.fogueoNextPulseAt && new Date().getTime() >= runUpgrades.fogueoNextPulseAt) {
            triggerFogueoPulse();
        }
    }

    function triggerFogueoPulse() {
        clearEnemyProjectiles();
        runUpgrades.fogueoNextPulseAt = new Date().getTime() + fogueoPulseInterval;
    }

    function clearKeyPressedState() {
        for (var key in keyPressed) {
            if (keyPressed.hasOwnProperty(key)) {
                keyPressed[key] = false;
            }
        }
    }

    function shiftAbsoluteTimer(value, deltaMs) {
        if (typeof value !== 'number' || value <= 0) {
            return value;
        }
        return value + deltaMs;
    }

    function shiftPauseSensitiveTimers(deltaMs) {
        if (!deltaMs) {
            return;
        }

        stageTransitionUntil = shiftAbsoluteTimer(stageTransitionUntil, deltaMs);
        runUpgrades.fogueoNextPulseAt = shiftAbsoluteTimer(runUpgrades.fogueoNextPulseAt, deltaMs);

        if (player) {
            player.invulnerableUntil = shiftAbsoluteTimer(player.invulnerableUntil, deltaMs);
            player.recoilUntil = shiftAbsoluteTimer(player.recoilUntil, deltaMs);
            player.shootFxUntil = shiftAbsoluteTimer(player.shootFxUntil, deltaMs);
            player.animationStartedAt = shiftAbsoluteTimer(player.animationStartedAt, deltaMs);
        }

        for (var i = 0; i < activeEnemies.length; i++) {
            var enemy = activeEnemies[i];
            if (!enemy) {
                continue;
            }

            enemy.slowUntil = shiftAbsoluteTimer(enemy.slowUntil, deltaMs);
            enemy.hunterChargeUntil = shiftAbsoluteTimer(enemy.hunterChargeUntil, deltaMs);
            enemy.hunterZigzagUntil = shiftAbsoluteTimer(enemy.hunterZigzagUntil, deltaMs);
            enemy.strikePhaseUntil = shiftAbsoluteTimer(enemy.strikePhaseUntil, deltaMs);
            enemy.sentinelHoldUntil = shiftAbsoluteTimer(enemy.sentinelHoldUntil, deltaMs);
            enemy.sentinelDiagonalUntil = shiftAbsoluteTimer(enemy.sentinelDiagonalUntil, deltaMs);

            if (enemy.bossCombat) {
                enemy.bossCombat.nextBombSpawnAt = shiftAbsoluteTimer(enemy.bossCombat.nextBombSpawnAt, deltaMs);
                enemy.bossCombat.nextReinforcementAt = shiftAbsoluteTimer(enemy.bossCombat.nextReinforcementAt, deltaMs);
            }
        }
    }

    function stopActiveEnemyShooting() {
        for (var i = 0; i < activeEnemies.length; i++) {
            if (activeEnemies[i] && activeEnemies[i].stopShooting) {
                activeEnemies[i].stopShooting();
            }
        }
        clearStageSpawnScheduler();
    }

    function restartActiveEnemyShooting() {
        for (var i = 0; i < activeEnemies.length; i++) {
            if (activeEnemies[i] && activeEnemies[i].startShooting) {
                activeEnemies[i].startShooting();
            }
        }

        if (stageState === 'playing' && pendingStageSpawns > 0 && activeStageConfig) {
            spawnNextEnemyWave(activeStageConfig);
        }
    }

    function canPauseGame() {
        return !isPaused && (stageState === 'playing' || stageState === 'countdown' || stageState === 'summary');
    }

    function pauseGame() {
        if (!canPauseGame()) {
            return;
        }

        pausedStageState = stageState;
        pauseStartedAt = new Date().getTime();
        isPaused = true;
        stageState = 'paused';
        clearKeyPressedState();
        stopActiveEnemyShooting();
        pauseGameMusic();
    }

    function resumeGame() {
        if (!isPaused) {
            return;
        }

        var nowTime = new Date().getTime();
        shiftPauseSensitiveTimers(nowTime - pauseStartedAt);
        isPaused = false;
        stageState = pausedStageState || 'playing';
        pausedStageState = '';
        pauseStartedAt = 0;
        clearKeyPressedState();

        if (stageState === 'playing') {
            restartActiveEnemyShooting();
        }

        playGameMusic();
    }

    function restartGameFromPause() {
        if (!isPaused) {
            return;
        }

        isPaused = false;
        pausedStageState = '';
        pauseStartedAt = 0;
        clearKeyPressedState();

        clearStageEntities();
        clearEnemyProjectiles();
        resetRunUpgrades();
        refreshPlayerStats();

        currentLevel = 1;
        currentProgressLevel = 1;
        currentStageType = 'normal';
        stageMessage = '';
        stageTransitionUntil = 0;
        activeStageConfig = null;
        youLoose = false;
        congratulations = false;
        playerNamePendingSave = false;
        playerNameInputConfirmed = false;
        playerNameInputBuffer = '';
        playerNameInputCursorBlink = 0;
        now = 0;
        nextPlayerShot = 0;

        applyDebugStartConfig();
        player = new Player(playerLife, 0);
        setGameMusicDuckForTransition(false);
        playGameMusic();
        startCountdown('Nivel ' + currentLevel);
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
        var enemyCount = getEnemyCountForLevel(currentLevel);
        var baseEnemyLife = 2 + Math.floor((currentLevel - 1) / 2);
        var baseEnemyShots = 4 + Math.floor((currentLevel - 1) / 2);
        var baseEnemySpeed = defaultEnemySpeed + ((currentLevel - 1) * 0.08);

        var enemyTypePool = getEnemyTypePoolForLevel(currentLevel);
        var maxConcurrent = getMaxConcurrentForLevel(currentLevel);
        var spawnDelay = getSpawnDelayForLevel(currentLevel);

        return {
            type: currentStageType,
            enemyCount: isBossStage ? 1 : enemyCount,
            enemyLife: baseEnemyLife,
            enemyShots: baseEnemyShots,
            enemySpeed: baseEnemySpeed,
            enemyPoints: 5 + currentLevel + Math.floor((currentLevel - 1) / 2),
            enemyTypePool: enemyTypePool,
            maxConcurrent: isBossStage ? 1 : maxConcurrent,
            spawnDelayMin: isBossStage ? 0 : spawnDelay.min,
            spawnDelayMax: isBossStage ? 0 : spawnDelay.max,
            bossLife: 14 + (totalLevels * 3),
            bossShots: 26 + (totalLevels * 6),
            bossSpeed: 1.0,
            bossPoints: 65 + (totalLevels * 6)
        };
    }

    function getEnemyCountForLevel(level) {
        var enemyCountByLevel = progressionConfig.enemyCountByLevel || {
            1: 6,
            2: 8,
            3: 9,
            4: 10,
            5: 11,
            6: 12,
            7: 13,
            8: 14,
            9: 15,
            10: 16
        };
        if (enemyCountByLevel[level]) {
            return enemyCountByLevel[level];
        }
        return enemyCountByLevel[totalLevels] || 10;
    }

    function getEnemyTypePoolForLevel(level) {
        var configuredPool = progressionConfig.enemyTypePoolByLevel || {
            1: [1],
            2: [1, 2],
            3: [1, 2],
            4: [1, 2, 3],
            5: [1, 2, 3],
            6: [1, 2, 3, 4],
            7: [1, 2, 3, 4],
            8: [2, 3, 4, 5],
            9: [2, 3, 4, 5],
            10: [1, 2, 3, 4, 5]
        };
        var pool = configuredPool[level] || configuredPool[totalLevels] || [1];
        if (!pool.length) {
            return [1];
        }
        return pool;
    }

    function getMaxConcurrentForLevel(level) {
        var maxConcurrentByLevel = progressionConfig.maxConcurrentByLevel || {
            1: 3,
            2: 4,
            3: 4,
            4: 5,
            5: 5,
            6: 6,
            7: 6,
            8: 7,
            9: 7,
            10: 8
        };
        if (maxConcurrentByLevel[level]) {
            return maxConcurrentByLevel[level];
        }
        return maxConcurrentByLevel[totalLevels] || 5;
    }

    function getSpawnDelayForLevel(level) {
        if (level <= 3) {
            return { min: 1200, max: 1700 };
        }
        if (level <= 6) {
            return { min: 1050, max: 1550 };
        }
        return { min: 900, max: 1350 };
    }

    function shouldOpenRewardSelector() {
        return currentStageType === 'normal';
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
        bossBombs.splice(0, bossBombs.length);
        evilShotsBuffer.splice(0, evilShotsBuffer.length);
        playerShotsBuffer.splice(0, playerShotsBuffer.length);
        pendingStageSpawns = 0;
        spawnedStageEnemies = 0;
        bossWeaponUnlockNoticeUntil = 0;
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
        setGameMusicDuckForTransition(gameMusicDuckForTransition);
        playGameMusic();
        clearStageEntities();
    }

    function startCountdown(message) {
        stageState = 'countdown';
        stageMessage = message;
        stageTransitionUntil = new Date().getTime() + stageCountdownDuration;
        setGameMusicDuckForTransition(gameMusicDuckForTransition);
        playGameMusic();
        clearStageEntities();
    }

    function startCurrentStage() {
        activeStageConfig = getCurrentStageConfig();
        stageState = 'playing';
        stageMessage = '';
        setGameMusicDuckForTransition(false);
        playGameMusic();
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
        var runtime = ensureEnemyEntityRuntime();
        var enemy = runtime && typeof runtime.createEvil === 'function'
            ? runtime.createEvil(life, shots, speed, enemyType.spriteIndex, selectedType, evilImages)
            : new Evil(life, shots, speed, enemyType.spriteIndex, selectedType);
        enemy.maxLife = life;
        enemy.pointsToKill = stageConfig.enemyPoints + enemyType.pointsBonus;
        return enemy;
    }

    function createBossByLevel(stageConfig) {
        var bossConfig = bossByLevel.final || { spriteIndex: 0, lifeBonus: 0, shotsBonus: 0, speedBonus: 0, pointsBonus: 0 };
        var runtime = ensureEnemyEntityRuntime();
        var boss = runtime && typeof runtime.createFinalBoss === 'function'
            ? runtime.createFinalBoss(
                stageConfig.bossLife + bossConfig.lifeBonus,
                stageConfig.bossShots + bossConfig.shotsBonus,
                stageConfig.bossSpeed + bossConfig.speedBonus,
                bossConfig.spriteIndex,
                1,
                bossImages
            )
            : new FinalBoss(
                stageConfig.bossLife + bossConfig.lifeBonus,
                stageConfig.bossShots + bossConfig.shotsBonus,
                stageConfig.bossSpeed + bossConfig.speedBonus,
                bossConfig.spriteIndex,
                1
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
        if (shouldOpenRewardSelector()) {
            openRewardSelector();
            return;
        }

        completeStageClear();
    }

    function completeStageClear() {
        if (currentStageType === 'boss') {
            playerNameInputBuffer = getStoredPlayerName();
            playerNameInputConfirmed = false;
            playerNamePendingSave = true;
            stageState = 'name_input_pending';
            clearStageEntities();
            return;
        }

        if (currentLevel === totalLevels) {
            currentStageType = 'boss';
            setGameMusicDuckForTransition(false);
            startSummary('Nivel ' + totalLevels + ' completado. Se acerca el jefe final');
            return;
        }

        currentLevel++;
        currentProgressLevel = currentLevel;
        setGameMusicDuckForTransition(true);
        startSummary('Nivel completado. Preparando Nivel ' + currentLevel);
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

    function drawPauseOverlay() {
        var centerX = canvas.width / 2;
        var centerY = canvas.height / 2;
        var panelWidth = canvas.width - 100;
        var panelHeight = 220;

        drawArcadePanel(50, centerY - 120, panelWidth, panelHeight, 0.94, 'rgba(255, 180, 0, 0.95)');
        drawArcadeText('PAUSA', centerX, centerY - 70, {
            color: '#fff3a3',
            font: arcadeTheme.titleFont,
            align: 'center',
            glowColor: 'rgba(255, 180, 0, 0.95)',
            glowBlur: 10,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 4
        });

        drawArcadeText('P = Reanudar', centerX, centerY - 15, {
            color: arcadeTheme.primaryText,
            font: "bold 16px 'Courier New', monospace",
            align: 'center',
            glowColor: arcadeTheme.glow,
            glowBlur: 6,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });

        drawArcadeText('R = Reiniciar partida', centerX, centerY + 20, {
            color: '#ffcf63',
            font: "bold 16px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 120, 0, 0.85)',
            glowBlur: 6,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });

        drawArcadeText('VOLUMEN ' + mainMenuVolume + '%', centerX, centerY + 48, {
            color: '#ffe38a',
            font: "bold 11px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 170, 0, 0.45)',
            glowBlur: 3,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 1
        });

        drawMainMenuVolumeBar(centerX - 122, centerY + 58, 244, 8);

        drawArcadeText('NIVEL ' + currentLevel + '  |  PUNTOS ' + player.score, centerX, centerY + 83, {
            color: '#ffe680',
            font: "bold 13px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 120, 0, 0.75)',
            glowBlur: 5,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });
    }

    function drawMainMenu() {
        var centerX = canvas.width / 2;
        var centerY = canvas.height / 2;
        var panelWidth = canvas.width - 84;
        var panelHeight = 330;
        var panelX = 42;
        var panelY = centerY - 178;

        bufferctx.save();
        bufferctx.fillStyle = 'rgba(255, 170, 0, 0.07)';
        bufferctx.beginPath();
        bufferctx.arc(centerX - 185, centerY - 115, 110, 0, Math.PI * 2, false);
        bufferctx.fill();
        bufferctx.fillStyle = 'rgba(0, 255, 140, 0.06)';
        bufferctx.beginPath();
        bufferctx.arc(centerX + 170, centerY + 110, 125, 0, Math.PI * 2, false);
        bufferctx.fill();
        bufferctx.restore();

        drawArcadePanel(panelX, panelY, panelWidth, panelHeight, 0.95, 'rgba(180, 100, 255, 0.95)');

        drawArcadeText('FLUBBER', centerX, panelY + 42, {
            color: '#fff3a3',
            font: "bold 38px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 170, 0, 0.98)',
            glowBlur: 14,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 4
        });

        drawArcadePanel(centerX - 182, panelY + 108, 364, 66, 0.88, 'rgba(0, 255, 140, 0.78)');
        drawArcadeText('INICIAR JUEGO', centerX, panelY + 136, {
            color: '#7dffb4',
            font: "bold 22px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(0, 255, 140, 0.9)',
            glowBlur: 8,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 3
        });
        drawArcadeText('ESPACIO / ENTER', centerX, panelY + 162, {
            color: '#fff3a3',
            font: "bold 11px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 170, 0, 0.75)',
            glowBlur: 4,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });

        drawArcadePanel(centerX - 182, panelY + 196, 364, 72, 0.72, 'rgba(255, 175, 0, 0.55)');
        drawArcadeText('VOLUMEN', centerX, panelY + 211, {
            color: '#ffe38a',
            font: "bold 13px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 170, 0, 0.45)',
            glowBlur: 3,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 1
        });

        drawMainMenuVolumeBar(centerX - 122, panelY + 229, 244, 8);

        drawArcadeText('← →', centerX, panelY + 251, {
            color: '#fff1b8',
            font: "bold 10px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 170, 0, 0.35)',
            glowBlur: 2,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 1
        });

    }

    function drawMainMenuVolumeBar(x, y, width, height) {
        var fillWidth = Math.round(width * (Math.max(0, Math.min(100, mainMenuVolume)) / 100));
        var knobX = x + fillWidth;

        bufferctx.save();
        bufferctx.fillStyle = 'rgba(18, 10, 28, 0.88)';
        bufferctx.fillRect(x, y, width, height);
        bufferctx.fillStyle = 'rgba(0, 255, 140, 0.88)';
        if (fillWidth > 0) {
            bufferctx.fillRect(x, y, fillWidth, height);
        }
        bufferctx.fillStyle = 'rgba(255, 245, 170, 0.95)';
        bufferctx.beginPath();
        bufferctx.arc(knobX, y + (height / 2), Math.max(5, Math.round(height * 0.95)), 0, Math.PI * 2, false);
        bufferctx.fill();
        bufferctx.strokeStyle = 'rgba(255, 210, 120, 0.95)';
        bufferctx.lineWidth = 1;
        bufferctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
        bufferctx.restore();
    }

    function adjustMainMenuVolume(delta) {
        mainMenuVolume = Math.max(0, Math.min(100, mainMenuVolume + delta));
        updateGameMusicVolume();
    }

    function Player(life, score) {
        var settings = {
            marginBottom : 40,
            defaultWidth : 52,
            defaultHeight : 66,
            recoilDurationMs: 90,
            recoilPixels: 4,
            shootFxDurationMs: 95
        };
        player = new Image();
        player.src = 'images/bueno.png';
        player.posX = (canvas.width / 2) - (settings.defaultWidth / 2);
        player.posY = canvas.height - (player.height == 0 ? settings.defaultHeight : player.height) - settings.marginBottom;
        player.width = player.width || settings.defaultWidth;
        player.height = player.height || settings.defaultHeight;
        player.life = life;
        player.score = score;
        player.dead = false;
        player.speed = playerSpeed;
        player.invulnerableUntil = 0;
        player.animationState = 'idle';
        player.animationStartedAt = new Date().getTime();
        player.recoilOffsetY = 0;
        player.recoilUntil = 0;
        player.shootFxUntil = 0;
        player.centerOnFirstFrame = true;

        player.triggerShotFeedback = function() {
            var currentTime = new Date().getTime();
            player.recoilUntil = currentTime + settings.recoilDurationMs;
            player.shootFxUntil = currentTime + settings.shootFxDurationMs;
        };

        player.updateVisualFeedback = function() {
            var currentTime = new Date().getTime();
            if (currentTime < player.recoilUntil) {
                var recoilRemainingRatio = (player.recoilUntil - currentTime) / settings.recoilDurationMs;
                player.recoilOffsetY = Math.round(settings.recoilPixels * recoilRemainingRatio);
            } else {
                player.recoilOffsetY = 0;
            }
        };

        player.getShotFxRatio = function() {
            var currentTime = new Date().getTime();
            if (currentTime >= player.shootFxUntil) {
                return 0;
            }
            return (player.shootFxUntil - currentTime) / settings.shootFxDurationMs;
        };

        player.updateAnimationState = function(nextState) {
            var normalizedState = nextState === 'left' || nextState === 'right' ? nextState : 'idle';
            if (player.animationState !== normalizedState) {
                player.animationState = normalizedState;
                player.animationStartedAt = new Date().getTime();
            }
        };

        player.getCurrentFrameImage = function() {
            if (player.dead) {
                return playerKilledImage;
            }

            var frames = playerAnimations[player.animationState] || playerAnimations.idle;
            var elapsedMs = new Date().getTime() - player.animationStartedAt;
            var frameIndex = Math.floor(elapsedMs / playerAnimations.frameDurationMs) % playerAnimations.frameCount;
            var frameImage = frames[frameIndex] || playerAnimations.idle[0] || player;

            if (frameImage && frameImage.width) {
                player.width = frameImage.width;
                player.height = frameImage.height;
                if (player.centerOnFirstFrame) {
                    player.posX = Math.round((canvas.width - player.width) / 2);
                    player.centerOnFirstFrame = false;
                }
            }

            return frameImage;
        };

        var shoot = function () {
            if (nextPlayerShot < now || now == 0) {
                playerShot = new PlayerShot(player.posX + (player.width / 2), player.posY);
                playerShot.damage = playerShotDamage;
                playerShot.scale = playerShotScale;
                playerShot.remainingBounces = runUpgrades.bounceStacks;
                playerShot.isHoming = runUpgrades.homingStacks > 0;
                playerShot.vx = 0;
                playerShot.vy = -playerShot.speed;
                playerShot.add();
                player.triggerShotFeedback();
                now += playerShotDelay;
                nextPlayerShot = now + playerShotDelay;
            } else {
                now = new Date().getTime();
            }
        };

        player.doAnything = function() {
            var initialPosX = player.posX;
            var moveDirection = 0;

            if (player.dead)
                return;
            if (keyPressed.left && !keyPressed.right) {
                moveDirection = -1;
            } else if (keyPressed.right && !keyPressed.left) {
                moveDirection = 1;
            }

            if (moveDirection !== 0) {
                player.posX += moveDirection * player.speed;
            }

            if (player.posX < 5) {
                player.posX = 5;
            } else if (player.posX > (canvas.width - player.width - 5)) {
                player.posX = canvas.width - player.width - 5;
            }

            if (keyPressed.fire)
                shoot();

            var movedDelta = player.posX - initialPosX;
            if (movedDelta < 0) {
                player.updateAnimationState('left');
            } else if (movedDelta > 0) {
                player.updateAnimationState('right');
            } else {
                player.updateAnimationState('idle');
            }
        };

        player.killPlayer = function(damageTimestamp) {
            pauseGameMusic();
            if (this.life > 1) {
                var hitTime = typeof damageTimestamp === 'number' ? damageTimestamp : new Date().getTime();
                var hitPosX = this.posX;
                var hitPosY = this.posY;
                var remainingLife = this.life - 1;
                var currentScore = this.score;
                this.dead = true;
                evilShotsBuffer.splice(0, evilShotsBuffer.length);
                playerShotsBuffer.splice(0, playerShotsBuffer.length);
                this.src = playerKilledImage.src;
                setTimeout(function () {
                    player = new Player(remainingLife, currentScore);
                    player.posX = Math.max(5, Math.min(hitPosX, canvas.width - player.width - 5));
                    player.posY = Math.max(0, Math.min(hitPosY, canvas.height - player.height));
                    player.centerOnFirstFrame = false;
                    player.invulnerableUntil = hitTime + 2000;
                    playGameMusic();
                }, 500);

            } else {
                // Solicitar nombre antes de guardar
                playerNameInputBuffer = getStoredPlayerName();
                playerNameInputConfirmed = false;
                playerNamePendingSave = true;
                stageState = 'name_input_pending';
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
            if (!player || player.dead) {
                return false;
            }

            var collisionSystem = window.FlubberCollisionSystem || null;
            if (collisionSystem &&
                typeof collisionSystem.getPlayerHitCircle === 'function' &&
                typeof collisionSystem.getEnemyShotBounds === 'function' &&
                typeof collisionSystem.circleRectOverlap === 'function') {
                return collisionSystem.circleRectOverlap(
                    collisionSystem.getPlayerHitCircle(player, player),
                    collisionSystem.getEnemyShotBounds(this)
                );
            }

            var width = player.width || 52;
            var height = player.height || 66;
            var circle = {
                x: player.posX + (width / 2),
                y: player.posY + Math.round(height * 0.44),
                radius: Math.max(12, Math.round(Math.min(width, height) * 0.28))
            };
            var shotRect = {
                left: this.posX,
                top: this.posY,
                right: this.posX + 10,
                bottom: this.posY + 20
            };
            var closestX = Math.max(shotRect.left, Math.min(circle.x, shotRect.right));
            var closestY = Math.max(shotRect.top, Math.min(circle.y, shotRect.bottom));
            var deltaX = circle.x - closestX;
            var deltaY = circle.y - closestY;
            return (deltaX * deltaX) + (deltaY * deltaY) <= (circle.radius * circle.radius);
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
        this.customAnimationFrames = null;
        this.customAnimationFrameIndex = 0;
        this.deathAnimationFrames = null;
        this.deathAnimationFrameIndex = 0;
        this.deathAnimationCompleted = false;
        this.deathFadeAlpha = 1;
        this.deathFadeStep = 0.06;
        this.deathFadeDelayCounter = 8;
        this.shouldDisappear = false;
        this.renderAngle = 0;
        this.deathRenderAngle = 0;
        if (this.fixedSpriteIndex === 0 && enemyImages.type1Idle && enemyImages.type1Idle.length) {
            this.customAnimationFrames = enemyImages.type1Idle;
            this.image = this.customAnimationFrames[0];
        } else if (this.fixedSpriteIndex === 1 && enemyImages.type2Idle && enemyImages.type2Idle.length) {
            this.customAnimationFrames = enemyImages.type2Idle;
            this.image = this.customAnimationFrames[0];
        }
        this.animation = 0;
        this.spriteWidth = this.image.width || 40;
        this.spriteHeight = this.image.height || 40;
        this.posX = getRandomNumber(Math.max(1, canvas.width - this.spriteWidth));
        this.posY = -50;
        this.life = life;
        this.maxLife = life;
        this.speed = defaultEnemySpeed;
        this.shots = shots;
        this.dead = false;
        this.shotTimeoutId = null;
        this.slowUntil = 0;
        this.zigzagMotion = false;
        this.zigzagDirection = 1;
        this.zigzagHorizontalSpeed = 0;
        this.zigzagVerticalSpeed = 0;
        this.circularMotion = false;
        this.circularAngle = 0;
        this.circularRadiusX = 0;
        this.circularRadiusY = 0;
        this.circularCenterX = 0;
        this.circularCenterY = 0;
        this.circularOrbitSpeed = 0;
        this.circularVerticalDrift = 0;
        this.hunterMotion = false;
        this.hunterState = 'enter';
        this.hunterEntryTargetY = 80;
        this.hunterChargeUntil = 0;
        this.hunterChargeCenterX = 0;
        this.hunterChargePhase = 0;
        this.hunterChargeAmplitude = 26;
        this.hunterDashStartX = 0;
        this.hunterDashStartY = 0;
        this.hunterDashTargetX = 0;
        this.hunterDashTargetY = 0;
        this.hunterDashSpeed = 5;
        this.hunterReturnSpeed = 3.2;
        this.hunterZigzagUntil = 0;
        this.hunterBurstShotsRemaining = 0;
        this.hunterNextBurstAt = 0;
        this.strikeMotion = false;
        this.strikePhase = 0;
        this.strikeDirection = 1;
        this.strikePhaseUntil = 0;
        this.strikeHorizontalSpeed = 0;
        this.strikeVerticalSpeed = 0;
        this.strikeHorizontalDuration = 0;
        this.strikeVerticalDuration = 0;
        this.strikeForceVerticalNearPlayer = false;
        this.sentinelMotion = false;
        this.sentinelState = 'enter';
        this.sentinelEnterTargetY = 90;
        this.sentinelHoldUntil = 0;
        this.sentinelDiagonalUntil = 0;
        this.sentinelDiagDirX = 1;
        this.sentinelHorizontalSpeed = 0;
        this.sentinelVerticalSpeed = 0;
        this.sentinelStaticDuration = 850;
        this.sentinelDiagonalDuration = 1400;
        this.sentinelFanShots = 5;
        this.sentinelFanSpread = 1.7;

        var desplazamientoHorizontal = minHorizontalOffset +
            getRandomNumber(maxHorizontalOffset - minHorizontalOffset);
        var maxTravel = Math.max(minHorizontalOffset, Math.min(desplazamientoHorizontal, canvas.width - this.spriteWidth));
        var maxStartX = Math.max(1, canvas.width - this.spriteWidth - maxTravel);
        this.minX = getRandomNumber(maxStartX);
        this.maxX = this.minX + maxTravel;
        this.direction = 'D';


        this.kill = function() {
            if (this.dead) {
                return;
            }
            this.stopShooting();
            if (this.enemyType === 1) {
                if (this.zigzagMotion && typeof this.zigzagDirection === 'number') {
                    this.deathRenderAngle = this.zigzagDirection > 0 ? -15 : 15;
                } else if (this.direction === 'D') {
                    this.deathRenderAngle = -15;
                } else if (this.direction === 'I') {
                    this.deathRenderAngle = 15;
                } else {
                    this.deathRenderAngle = typeof this.renderAngle === 'number' ? this.renderAngle : 0;
                }
            }
            this.dead = true;
            if (this.fixedSpriteIndex === 0 && enemyImages.type1Death && enemyImages.type1Death.length) {
                this.customAnimationFrames = null;
                this.deathAnimationFrames = enemyImages.type1Death;
                this.deathAnimationFrameIndex = 0;
                this.deathAnimationCompleted = false;
                this.deathFadeAlpha = 1;
                this.deathFadeDelayCounter = 8;
                this.shouldDisappear = false;
                this.image = this.deathAnimationFrames[0];
                return;
            }
            if (this.fixedSpriteIndex === 1 && enemyImages.type2Death && enemyImages.type2Death.length) {
                this.customAnimationFrames = null;
                this.deathAnimationFrames = enemyImages.type2Death;
                this.deathAnimationFrameIndex = 0;
                this.deathAnimationCompleted = false;
                this.deathFadeAlpha = 1;
                this.deathFadeDelayCounter = 8;
                this.shouldDisappear = false;
                this.image = this.deathAnimationFrames[0];
                return;
            }
            this.image = enemyImages.killed;
        };

        this.updateDeathEffect = function() {
            if (!this.dead || this.shouldDisappear) {
                return;
            }

            if (this.deathAnimationFrames && this.deathAnimationFrames.length && !this.deathAnimationCompleted) {
                this.animation++;
                if (this.animation > 4) {
                    this.animation = 0;
                    if (this.deathAnimationFrameIndex < (this.deathAnimationFrames.length - 1)) {
                        this.deathAnimationFrameIndex++;
                        this.image = this.deathAnimationFrames[this.deathAnimationFrameIndex];
                    } else {
                        this.deathAnimationCompleted = true;
                        this.image = this.deathAnimationFrames[this.deathAnimationFrames.length - 1];
                    }
                }
                return;
            }

            if (this.deathAnimationCompleted) {
                if (this.deathFadeDelayCounter > 0) {
                    this.deathFadeDelayCounter--;
                    return;
                }

                this.deathFadeAlpha = Math.max(0, this.deathFadeAlpha - this.deathFadeStep);
                if (this.deathFadeAlpha === 0) {
                    this.shouldDisappear = true;
                }
            }
        };

        function moveTowards(enemy, targetX, targetY, speed) {
            var deltaX = targetX - enemy.posX;
            var deltaY = targetY - enemy.posY;
            var distance = Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));
            if (distance <= speed || distance === 0) {
                enemy.posX = targetX;
                enemy.posY = targetY;
                return true;
            }
            enemy.posX += (deltaX / distance) * speed;
            enemy.posY += (deltaY / distance) * speed;
            return false;
        }

        function fireVerticalShot(enemy) {
            if (enemy.dead || stageState !== 'playing') {
                return;
            }
            if (enemy.enemyType !== 3 && enemy.shots <= 0) {
                return;
            }
            var centerX = enemy.posX + (enemy.image.width / 2) - 5;
            var baseY = enemy.posY + enemy.image.height;
            var shot = new EvilShot(centerX, baseY);
            shot.vx = 0;
            shot.add();
            if (enemy.enemyType !== 3) {
                enemy.shots--;
            }
        }

        function updateHunterMovement(enemy, movementSpeed) {
            var nowTime = new Date().getTime();
            if (enemy.hunterState === 'enter') {
                enemy.posY += Math.max(0.9, movementSpeed);
                if (enemy.posY >= enemy.hunterEntryTargetY) {
                    enemy.posY = enemy.hunterEntryTargetY;
                    enemy.hunterState = 'charge';
                    enemy.hunterChargeCenterX = enemy.posX;
                    enemy.hunterChargePhase = 0;
                    enemy.hunterChargeUntil = nowTime + 700;
                }
                return;
            }

            if (enemy.hunterState === 'charge') {
                enemy.hunterChargePhase += 0.35;
                enemy.posY += Math.max(0.12, movementSpeed * 0.12);
                enemy.posX = enemy.hunterChargeCenterX + Math.sin(enemy.hunterChargePhase) * enemy.hunterChargeAmplitude;
                if (enemy.posX < 0) {
                    enemy.posX = 0;
                } else if (enemy.posX > (canvas.width - enemy.spriteWidth)) {
                    enemy.posX = canvas.width - enemy.spriteWidth;
                }
                if (nowTime >= enemy.hunterChargeUntil) {
                    enemy.hunterDashStartX = enemy.posX;
                    enemy.hunterDashStartY = enemy.posY;
                    enemy.hunterDashTargetX = player ? player.posX + (player.width / 2) - (enemy.spriteWidth / 2) : enemy.posX;
                    enemy.hunterDashTargetY = player ? player.posY + (player.height / 2) - (enemy.spriteHeight / 2) : (enemy.posY + 120);
                    if (enemy.hunterDashTargetX < 0) {
                        enemy.hunterDashTargetX = 0;
                    } else if (enemy.hunterDashTargetX > (canvas.width - enemy.spriteWidth)) {
                        enemy.hunterDashTargetX = canvas.width - enemy.spriteWidth;
                    }
                    if (enemy.hunterDashTargetY < -enemy.spriteHeight) {
                        enemy.hunterDashTargetY = -enemy.spriteHeight;
                    }
                    enemy.hunterState = 'dash';
                }
                return;
            }

            if (enemy.hunterState === 'dash') {
                var reachedTarget = moveTowards(enemy, enemy.hunterDashTargetX, enemy.hunterDashTargetY,
                    Math.max(4.2, enemy.hunterDashSpeed));
                if (reachedTarget) {
                    enemy.hunterState = 'return';
                }
                return;
            }

            if (enemy.hunterState === 'return') {
                var returnedToOrigin = moveTowards(enemy, enemy.hunterDashStartX, enemy.hunterDashStartY,
                    Math.max(2.6, enemy.hunterReturnSpeed));
                if (returnedToOrigin) {
                    enemy.hunterState = 'zigzag';
                    enemy.hunterZigzagUntil = nowTime + 1400;
                    enemy.hunterBurstShotsRemaining = 2;
                    enemy.hunterNextBurstAt = nowTime + 120;
                    enemy.zigzagDirection = getRandomNumber(2) === 0 ? -1 : 1;
                }
                return;
            }

            if (enemy.hunterState === 'zigzag') {
                var horizontalSpeed = enemy.zigzagHorizontalSpeed || Math.max(1.4, movementSpeed * 1.15);
                var verticalSpeed = enemy.zigzagVerticalSpeed || Math.max(0.55, movementSpeed * 0.7);
                enemy.posY += verticalSpeed;
                enemy.posX += (horizontalSpeed * enemy.zigzagDirection);

                if (enemy.posX <= 0) {
                    enemy.posX = 0;
                    enemy.zigzagDirection = 1;
                } else if (enemy.posX >= (canvas.width - enemy.spriteWidth)) {
                    enemy.posX = canvas.width - enemy.spriteWidth;
                    enemy.zigzagDirection = -1;
                }

                if (enemy.hunterBurstShotsRemaining > 0 && nowTime >= enemy.hunterNextBurstAt) {
                    fireVerticalShot(enemy);
                    enemy.hunterBurstShotsRemaining--;
                    enemy.hunterNextBurstAt = nowTime + 170;
                }

                if (nowTime >= enemy.hunterZigzagUntil) {
                    enemy.hunterState = 'charge';
                    enemy.hunterChargeCenterX = enemy.posX;
                    enemy.hunterChargePhase = 0;
                    enemy.hunterChargeUntil = nowTime + 700;
                }
            }
        }

        function updateStrikeMovement(enemy, movementSpeed) {
            var nowTime = new Date().getTime();
            var horizontalSpeed = enemy.strikeHorizontalSpeed || Math.max(1.4, movementSpeed * 1.35);
            var verticalSpeed = enemy.strikeVerticalSpeed || Math.max(0.7, movementSpeed * 0.95);

            var triggerY = player ? (player.posY - enemy.spriteHeight - 20) : canvas.height;
            if (!enemy.strikeForceVerticalNearPlayer && enemy.posY >= triggerY) {
                enemy.strikeForceVerticalNearPlayer = true;
            }

            if (enemy.strikeForceVerticalNearPlayer) {
                enemy.posY += Math.max(verticalSpeed, movementSpeed);
                return;
            }

            if (!enemy.strikePhaseUntil) {
                enemy.strikePhaseUntil = nowTime + (enemy.strikePhase === 1 ? enemy.strikeVerticalDuration : enemy.strikeHorizontalDuration);
            }

            if (enemy.strikePhase === 1) {
                enemy.posY += verticalSpeed;
            } else {
                var direction = enemy.strikePhase === 0 ? enemy.strikeDirection : -enemy.strikeDirection;
                enemy.posX += (horizontalSpeed * direction);
                if (enemy.posX <= 0) {
                    enemy.posX = 0;
                    enemy.strikePhaseUntil = nowTime;
                } else if (enemy.posX >= (canvas.width - enemy.spriteWidth)) {
                    enemy.posX = canvas.width - enemy.spriteWidth;
                    enemy.strikePhaseUntil = nowTime;
                }
            }

            if (nowTime >= enemy.strikePhaseUntil) {
                if (enemy.strikePhase === 0) {
                    enemy.strikePhase = 1;
                } else if (enemy.strikePhase === 1) {
                    enemy.strikePhase = 2;
                } else {
                    enemy.strikePhase = 0;
                }
                enemy.strikePhaseUntil = nowTime + (enemy.strikePhase === 1 ? enemy.strikeVerticalDuration : enemy.strikeHorizontalDuration);
            }
        }

        function fireFanBurst(enemy) {
            if (enemy.dead || stageState !== 'playing' || enemy.shots <= 0) {
                return;
            }

            var totalShots = Math.max(3, enemy.sentinelFanShots || 5);
            var spread = enemy.sentinelFanSpread || 1.7;
            var step = totalShots > 1 ? (spread / (totalShots - 1)) : 0;
            var startAngle = -(spread / 2);
            var centerX = enemy.posX + (enemy.image.width / 2) - 5;
            var baseY = enemy.posY + enemy.image.height;

            for (var shotIndex = 0; shotIndex < totalShots; shotIndex++) {
                var angle = startAngle + (step * shotIndex);
                var fanShot = new EvilShot(centerX, baseY);
                fanShot.vx = Math.sin(angle) * fanShot.speed * 0.45;
                fanShot.vy = Math.max(1.8, Math.cos(angle) * fanShot.speed * 0.75);
                fanShot.add();
            }

            enemy.shots--;
        }

        function updateSentinelMovement(enemy, movementSpeed) {
            var nowTime = new Date().getTime();
            var horizontalSpeed = enemy.sentinelHorizontalSpeed || Math.max(1.7, movementSpeed * 1.45);
            var verticalSpeed = enemy.sentinelVerticalSpeed || Math.max(0.75, movementSpeed * 0.95);
            
            var triggerY = player ? (player.posY - enemy.spriteHeight - 20) : canvas.height;
            if (!enemy.sentinelForceVerticalNearPlayer && enemy.posY >= triggerY) {
                enemy.sentinelForceVerticalNearPlayer = true;
            }
            if (enemy.sentinelForceVerticalNearPlayer) {
                enemy.posY += Math.max(verticalSpeed, movementSpeed);
                return;
            }

            if (enemy.sentinelState === 'enter') {
                enemy.posY += Math.max(0.9, movementSpeed);
                if (enemy.posY >= enemy.sentinelEnterTargetY) {
                    enemy.posY = enemy.sentinelEnterTargetY;
                    enemy.sentinelState = 'static';
                    enemy.sentinelHoldUntil = nowTime + enemy.sentinelStaticDuration;
                }
                return;
            }

            if (enemy.sentinelState === 'static') {
                if (nowTime >= enemy.sentinelHoldUntil) {
                    enemy.sentinelState = 'fan';
                }
                return;
            }

            if (enemy.sentinelState === 'fan') {
                fireFanBurst(enemy);
                enemy.sentinelState = 'diagonal';
                enemy.sentinelDiagonalUntil = nowTime + enemy.sentinelDiagonalDuration;
                enemy.sentinelDiagDirX = getRandomNumber(2) === 0 ? -1 : 1;
                return;
            }

            if (enemy.sentinelState === 'diagonal') {
                enemy.posX += horizontalSpeed * enemy.sentinelDiagDirX;
                enemy.posY += verticalSpeed;

                if (enemy.posX <= 0) {
                    enemy.posX = 0;
                    enemy.sentinelDiagDirX = 1;
                } else if (enemy.posX >= (canvas.width - enemy.spriteWidth)) {
                    enemy.posX = canvas.width - enemy.spriteWidth;
                    enemy.sentinelDiagDirX = -1;
                }

                if (nowTime >= enemy.sentinelDiagonalUntil) {
                    enemy.sentinelState = 'static';
                    enemy.sentinelHoldUntil = nowTime + enemy.sentinelStaticDuration;
                }
            }
        }

        this.update = function () {
            var movementSpeed = this.goDownSpeed;
            if (this.slowUntil && new Date().getTime() < this.slowUntil) {
                movementSpeed = movementSpeed * 0.6;
            }
            if (this.hunterMotion) {
                updateHunterMovement(this, movementSpeed);
            } else if (this.strikeMotion) {
                updateStrikeMovement(this, movementSpeed);
            } else if (this.sentinelMotion) {
                updateSentinelMovement(this, movementSpeed);
            } else if (this.zigzagMotion) {
                var horizontalSpeed = this.zigzagHorizontalSpeed || Math.max(1.6, movementSpeed * 1.35);
                var verticalSpeed = this.zigzagVerticalSpeed || Math.max(0.75, movementSpeed * 0.9);
                this.posY += verticalSpeed;
                this.posX += (horizontalSpeed * this.zigzagDirection);
                this.renderAngle = this.zigzagDirection > 0 ? 45 : -45;

                if (this.posX <= 0) {
                    this.posX = 0;
                    this.zigzagDirection = 1;
                    this.renderAngle = 45;
                } else if (this.posX >= (canvas.width - this.spriteWidth)) {
                    this.posX = canvas.width - this.spriteWidth;
                    this.zigzagDirection = -1;
                    this.renderAngle = -45;
                }
            } else if (this.circularMotion) {
                var orbitSpeed = this.circularOrbitSpeed || Math.max(0.03, movementSpeed * 0.04);
                this.circularAngle += orbitSpeed;
                this.circularCenterY += this.circularVerticalDrift || Math.max(0.25, movementSpeed * 0.35);

                this.posX = this.circularCenterX + Math.cos(this.circularAngle) * this.circularRadiusX - (this.spriteWidth / 2);
                this.posY = this.circularCenterY + Math.sin(this.circularAngle) * this.circularRadiusY - (this.spriteHeight / 2);

                if (this.posX < 0) {
                    this.posX = 0;
                } else if (this.posX > (canvas.width - this.spriteWidth)) {
                    this.posX = canvas.width - this.spriteWidth;
                }
            } else {
                this.posY += movementSpeed;
                if (this.direction === 'D') {
                    this.posX += movementSpeed;
                        if (this.enemyType === 1) {
                            this.renderAngle = 45;
                        }
                    if (this.posX >= this.maxX) {
                        this.posX = this.maxX;
                        this.direction = 'I';
                    }
                } else {
                    this.posX -= movementSpeed;
                        if (this.enemyType === 1) {
                            this.renderAngle = -45;
                        }
                    if (this.posX <= this.minX) {
                        this.posX = this.minX;
                        this.direction = 'D';
                    }
                }
            }
            this.animation++;
            if (this.animation > 5) {
                this.animation = 0;
                if (this.customAnimationFrames && this.customAnimationFrames.length) {
                    this.customAnimationFrameIndex = (this.customAnimationFrameIndex + 1) % this.customAnimationFrames.length;
                    this.image = this.customAnimationFrames[this.customAnimationFrameIndex];
                } else if (this.fixedSpriteIndex === null) {
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

        function scheduleNextShot(enemy, delay) {
            if (enemy.dead || stageState !== 'playing') {
                return;
            }

            enemy.shotTimeoutId = setTimeout(function() {
                shoot(enemy);
            }, delay);
        }

        function shoot(enemy) {
            if (enemy.enemyType === 3 || enemy.enemyType === 5) {
                return;
            }
            if (!enemy.dead && stageState === 'playing') {
                var centerX = enemy.posX + (enemy.image.width / 2) - 5;
                var baseY = enemy.posY + enemy.image.height;
                if (enemy.enemyType === 2) {
                    var leftShot = new EvilShot(centerX - 8, baseY);
                    leftShot.vx = -2.2;
                    leftShot.add();

                    var rightShot = new EvilShot(centerX + 8, baseY);
                    rightShot.vx = 2.2;
                    rightShot.add();
                } else if (enemy.enemyType === 4) {
                    var zigzagShot = new EvilShot(centerX, baseY);
                    zigzagShot.vx = 0;
                    zigzagShot.waveMotion = true;
                    zigzagShot.waveBaseX = centerX;
                    zigzagShot.wavePhase = 0;
                    zigzagShot.waveAmplitude = 9;
                    zigzagShot.waveFrequency = 0.55;
                    zigzagShot.add();
                } else {
                    var disparo = new EvilShot(centerX, baseY);
                    disparo.add();
                }
                scheduleNextShot(enemy, getRandomNumber(3000));
            }
        }

        this.startShooting = function() {
            self.stopShooting();
            scheduleNextShot(self, 1000 + getRandomNumber(2500));
        };

        this.stopShooting = function() {
            if (self.shotTimeoutId) {
                clearTimeout(self.shotTimeoutId);
                self.shotTimeoutId = null;
            }
        };

        self.startShooting();

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
        if (this.enemyType === 1) {
            this.zigzagMotion = true;
            this.zigzagDirection = getRandomNumber(2) === 0 ? -1 : 1;
            this.zigzagHorizontalSpeed = Math.max(1.7, this.goDownSpeed * 1.4);
            this.zigzagVerticalSpeed = Math.max(0.8, this.goDownSpeed * 0.95);
            this.minX = 0;
            this.maxX = canvas.width - this.spriteWidth;
            this.direction = this.zigzagDirection > 0 ? 'D' : 'I';
        } else if (this.enemyType === 2) {
            this.circularMotion = true;
            this.circularAngle = getRandomNumber(360) * (Math.PI / 180);
            this.circularRadiusX = 55 + getRandomNumber(40);
            this.circularRadiusY = 35 + getRandomNumber(25);
            this.circularOrbitSpeed = 0.03 + (this.goDownSpeed * 0.025);
            this.circularVerticalDrift = Math.max(0.25, this.goDownSpeed * 0.35);
            this.circularCenterX = this.spriteWidth + this.circularRadiusX +
                getRandomNumber(Math.max(1, canvas.width - (this.circularRadiusX * 2) - (this.spriteWidth * 2)));
            this.posY = -this.spriteHeight - getRandomNumber(60);
            this.circularCenterY = this.posY + (this.spriteHeight / 2) - (Math.sin(this.circularAngle) * this.circularRadiusY);
            this.posX = this.circularCenterX + Math.cos(this.circularAngle) * this.circularRadiusX - (this.spriteWidth / 2);
        } else if (this.enemyType === 3) {
            this.stopShooting();
            this.hunterMotion = true;
            this.hunterState = 'enter';
            this.hunterEntryTargetY = 70 + getRandomNumber(110);
            this.hunterChargeAmplitude = 20 + getRandomNumber(18);
            this.hunterDashSpeed = Math.max(4.2, this.goDownSpeed * 3.8);
            this.hunterReturnSpeed = Math.max(2.6, this.goDownSpeed * 2.4);
            this.zigzagHorizontalSpeed = Math.max(1.5, this.goDownSpeed * 1.2);
            this.zigzagVerticalSpeed = Math.max(0.6, this.goDownSpeed * 0.75);
            this.posX = getRandomNumber(Math.max(1, canvas.width - this.spriteWidth));
            this.posY = -this.spriteHeight - getRandomNumber(80);
        } else if (this.enemyType === 4) {
            this.strikeMotion = true;
            this.strikePhase = 0;
            this.strikeDirection = getRandomNumber(2) === 0 ? -1 : 1;
            this.strikeHorizontalSpeed = Math.max(1.6, this.goDownSpeed * 1.4);
            this.strikeVerticalSpeed = Math.max(0.75, this.goDownSpeed);
            this.strikeHorizontalDuration = 1150 + getRandomNumber(420);
            this.strikeVerticalDuration = 420 + getRandomNumber(180);
            this.strikePhaseUntil = 0;
            this.strikeForceVerticalNearPlayer = false;
            this.posX = getRandomNumber(Math.max(1, canvas.width - this.spriteWidth));
            this.posY = -this.spriteHeight - getRandomNumber(70);
        } else if (this.enemyType === 5) {
            this.stopShooting();
            this.sentinelMotion = true;
            this.sentinelState = 'enter';
            this.sentinelEnterTargetY = 75 + getRandomNumber(95);
            this.sentinelStaticDuration = 850 + getRandomNumber(250);
            this.sentinelDiagonalDuration = 1300 + getRandomNumber(400);
            this.sentinelHorizontalSpeed = Math.max(1.8, this.goDownSpeed * 1.55);
            this.sentinelVerticalSpeed = Math.max(0.75, this.goDownSpeed);
            this.sentinelFanShots = 5;
            this.sentinelFanSpread = 1.7;
            this.sentinelDiagDirX = getRandomNumber(2) === 0 ? -1 : 1;
            this.sentinelForceVerticalNearPlayer = false;
            this.posX = getRandomNumber(Math.max(1, canvas.width - this.spriteWidth));
            this.posY = -this.spriteHeight - getRandomNumber(90);
        }
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
        if (!enemy || enemy.dead || !player || player.dead) {
            return false;
        }

        var collisionSystem = window.FlubberCollisionSystem || null;
        if (collisionSystem &&
            typeof collisionSystem.getPlayerHitCircle === 'function' &&
            typeof collisionSystem.getEnemyBounds === 'function' &&
            typeof collisionSystem.circleRectOverlap === 'function') {
            return collisionSystem.circleRectOverlap(
                collisionSystem.getPlayerHitCircle(player, player),
                collisionSystem.getEnemyBounds(enemy)
            );
        }

        var enemyWidth = (enemy.image && enemy.image.width) || enemy.spriteWidth || 40;
        var enemyHeight = (enemy.image && enemy.image.height) || enemy.spriteHeight || 40;
        var width = player.width || 52;
        var height = player.height || 66;
        var circle = {
            x: player.posX + (width / 2),
            y: player.posY + Math.round(height * 0.5),
            radius: Math.max(12, Math.round(Math.min(width, height) * 0.2))
        };
        var rect = {
            left: enemy.posX,
            top: enemy.posY,
            right: enemy.posX + enemyWidth,
            bottom: enemy.posY + enemyHeight
        };
        var closestX = Math.max(rect.left, Math.min(circle.x, rect.right));
        var closestY = Math.max(rect.top, Math.min(circle.y, rect.bottom));
        var deltaX = circle.x - closestX;
        var deltaY = circle.y - closestY;
        return (deltaX * deltaX) + (deltaY * deltaY) <= (circle.radius * circle.radius);
    }

    function isAnyEnemyHittingPlayer() {
        for (var i = 0; i < activeEnemies.length; i++) {
            if (!activeEnemies[i].dead && isEnemyHittingPlayer(activeEnemies[i])) {
                return true;
            }
        }
        return false;
    }

    function rectsOverlap(rectA, rectB) {
        return rectA.left < rectB.right &&
            rectA.right > rectB.left &&
            rectA.top < rectB.bottom &&
            rectA.bottom > rectB.top;
    }

    function getBossWeaponHitboxes(enemy) {
        var collisionSystem = window.FlubberCollisionSystem || null;
        if (collisionSystem && typeof collisionSystem.getBossWeaponBounds === 'function') {
            return collisionSystem.getBossWeaponBounds(enemy);
        }

        if (!enemy || !enemy.bossCombat || !enemy.bossCombat.weapons) {
            return [];
        }

        var bounds = [];
        for (var i = 0; i < enemy.bossCombat.weapons.length; i++) {
            var weapon = enemy.bossCombat.weapons[i];
            if (!weapon || weapon.destroyed) {
                continue;
            }
            bounds.push({
                id: weapon.id || ('weapon-' + i),
                index: i,
                left: enemy.posX + weapon.offsetX,
                top: enemy.posY + weapon.offsetY,
                right: enemy.posX + weapon.offsetX + weapon.width,
                bottom: enemy.posY + weapon.offsetY + weapon.height,
                width: weapon.width,
                height: weapon.height
            });
        }
        return bounds;
    }

    function getBossBattleConfig() {
        var cfgRoot = window.FlubberGameConfig || {};
        return cfgRoot.bossLevelOne || {};
    }

    function isBossWeaponVulnerable(enemy, weaponIndex) {
        if (!enemy || !enemy.bossCombat || !enemy.bossCombat.weapons) {
            return false;
        }
        var weapon = enemy.bossCombat.weapons[weaponIndex];
        if (!weapon || weapon.destroyed) {
            return false;
        }
        return !!weapon.unlocked;
    }

    function getVulnerableBossWeaponHitboxes(enemy) {
        var allHitboxes = getBossWeaponHitboxes(enemy);
        var vulnerableHitboxes = [];
        for (var i = 0; i < allHitboxes.length; i++) {
            if (isBossWeaponVulnerable(enemy, allHitboxes[i].index)) {
                vulnerableHitboxes.push(allHitboxes[i]);
            }
        }
        return vulnerableHitboxes;
    }

    function unlockRemainingBossWeapons(enemy) {
        if (!enemy || !enemy.bossCombat || !enemy.bossCombat.weapons) {
            return;
        }

        var combat = enemy.bossCombat;
        if (combat.secondaryWaveUnlocked) {
            return;
        }

        for (var i = 0; i < combat.weapons.length; i++) {
            var weapon = combat.weapons[i];
            if (weapon && !weapon.destroyed) {
                weapon.unlocked = true;
            }
        }

        combat.secondaryWaveUnlocked = true;
        bossWeaponUnlockNoticeUntil = new Date().getTime() + bossWeaponUnlockNoticeDuration;
    }

    function countActiveBossBombs() {
        var alive = 0;
        for (var i = 0; i < bossBombs.length; i++) {
            if (!bossBombs[i].dead) {
                alive++;
            }
        }
        return alive;
    }

    function spawnBossBomb(enemy) {
        if (!enemy || enemy.dead) {
            return;
        }

        var bossConfig = getBossBattleConfig();
        var maxBombs = Math.max(1, bossConfig.bombMaxActive || 4);
        if (countActiveBossBombs() >= maxBombs) {
            return;
        }

        var minY = Math.max(24, bossConfig.bombMinY || 36);
        var maxY = Math.max(minY + 10, Math.floor(canvas.height / 2) - 40);
        var bomb = {
            posX: 30 + getRandomNumber(Math.max(1, canvas.width - 60)),
            posY: minY + getRandomNumber(Math.max(1, maxY - minY)),
            radius: 16,
            dead: false
        };

        bossBombs.push(bomb);
    }

    function spawnBossBombFanTowardsPlayer(bomb, ownerEnemy) {
        if (!bomb || bomb.dead) {
            return;
        }

        var bossConfig = getBossBattleConfig();
        var spread = bossConfig.bombFanSpreadRadians || 0.64;
        var totalShots = Math.max(3, bossConfig.bombBurstShotCount || 3);
        var step = totalShots > 1 ? (spread / (totalShots - 1)) : 0;
        var start = -(spread / 2);
        var centerX = bomb.posX - 5;
        var centerY = bomb.posY + bomb.radius;
        var targetX = player ? (player.posX + (player.width / 2)) : bomb.posX;
        var targetY = player ? (player.posY + (player.height / 2)) : (bomb.posY + 120);
        var baseAngle = Math.atan2(targetY - bomb.posY, targetX - bomb.posX);
        var speed = Math.max(2.2, bossConfig.bombProjectileSpeed || 3.4);

        for (var i = 0; i < totalShots; i++) {
            var offset = start + (step * i);
            var shotAngle = baseAngle + offset;
            var evilShot = new EvilShot(centerX, centerY);
            evilShot.vx = Math.cos(shotAngle) * speed;
            evilShot.vy = Math.max(1.4, Math.sin(shotAngle) * speed);
            evilShot.add();
        }

        bomb.dead = true;

        if (ownerEnemy && ownerEnemy.bossCombat && ownerEnemy.bossCombat.firstWeaponDestroyedTriggered) {
            var bonusScore = Math.max(1, bossConfig.bombScoreBase || 9);
            player.score += Math.round(bonusScore * playerScoreMultiplier);
        }
    }

    function countAliveBossReinforcements(ownerEnemy) {
        var alive = 0;
        for (var i = 0; i < activeEnemies.length; i++) {
            var enemy = activeEnemies[i];
            if (!enemy || enemy.dead || enemy === ownerEnemy) {
                continue;
            }
            if (enemy.spawnedByBossOne) {
                alive++;
            }
        }
        return alive;
    }

    function spawnBossReinforcementEnemyTypeOne(ownerEnemy) {
        if (!ownerEnemy || ownerEnemy.dead) {
            return;
        }

        var bossConfig = getBossBattleConfig();
        var maxAlive = Math.max(1, bossConfig.reinforcementMaxActive || 3);
        if (countAliveBossReinforcements(ownerEnemy) >= maxAlive) {
            return;
        }

        var typeConfig = enemyTypeConfigs[1] || { spriteIndex: 0, lifeBonus: 0, shotsBonus: 0, speedBonus: 0.14, pointsBonus: 0 };
        var stageConfig = activeStageConfig || getCurrentStageConfig();
        var life = stageConfig.enemyLife + typeConfig.lifeBonus + (bossConfig.reinforcementLifeBonus || 0);
        var shots = stageConfig.enemyShots + typeConfig.shotsBonus + (bossConfig.reinforcementShotsBonus || 0);
        var speed = stageConfig.enemySpeed + typeConfig.speedBonus + (bossConfig.reinforcementSpeedBonus || 0.1);

        var runtime = ensureEnemyEntityRuntime();
        var reinforcement = runtime && typeof runtime.createEvil === 'function'
            ? runtime.createEvil(life, shots, speed, typeConfig.spriteIndex, 1, evilImages)
            : new Evil(life, shots, speed, typeConfig.spriteIndex, 1);

        reinforcement.maxLife = life;
        reinforcement.pointsToKill = stageConfig.enemyPoints + (typeConfig.pointsBonus || 0);
        reinforcement.spawnedByBossOne = true;
        activeEnemies.push(reinforcement);
    }

    function updateBossSpecialEvents(enemy) {
        if (!enemy || enemy.dead || !enemy.isBossLevelOne || !enemy.bossCombat) {
            return;
        }

        var combat = enemy.bossCombat;
        var nowTime = new Date().getTime();
        var bossConfig = getBossBattleConfig();

        if (combat.firstWeaponDestroyedTriggered) {
            if (!combat.nextBombSpawnAt) {
                combat.nextBombSpawnAt = nowTime + Math.max(900, bossConfig.bombSpawnIntervalMs || 2200);
            }
            if (nowTime >= combat.nextBombSpawnAt) {
                spawnBossBomb(enemy);
                combat.nextBombSpawnAt = nowTime + Math.max(900, bossConfig.bombSpawnIntervalMs || 2200);
            }
        }

        if (combat.secondWeaponDestroyedTriggered) {
            if (!combat.nextReinforcementAt) {
                combat.nextReinforcementAt = nowTime + Math.max(1200, bossConfig.reinforcementIntervalMs || 3200);
            }
            if (nowTime >= combat.nextReinforcementAt) {
                spawnBossReinforcementEnemyTypeOne(enemy);
                combat.nextReinforcementAt = nowTime + Math.max(1200, bossConfig.reinforcementIntervalMs || 3200);
            }
        }
    }

    function removeDeadBossBombs() {
        for (var i = bossBombs.length - 1; i >= 0; i--) {
            if (bossBombs[i].dead) {
                arrayRemove(bossBombs, i);
            }
        }
    }

    function drawBossBombs() {
        for (var i = 0; i < bossBombs.length; i++) {
            var bomb = bossBombs[i];
            if (!bomb || bomb.dead) {
                continue;
            }

            bufferctx.save();
            bufferctx.fillStyle = 'rgba(255, 105, 40, 0.9)';
            bufferctx.strokeStyle = 'rgba(255, 230, 120, 0.95)';
            bufferctx.lineWidth = 2;
            bufferctx.beginPath();
            bufferctx.arc(Math.round(bomb.posX), Math.round(bomb.posY), bomb.radius, 0, Math.PI * 2, false);
            bufferctx.fill();
            bufferctx.stroke();
            bufferctx.restore();
        }
    }

    function tryHitBossBomb(shotRect) {
        for (var i = 0; i < bossBombs.length; i++) {
            var bomb = bossBombs[i];
            if (!bomb || bomb.dead) {
                continue;
            }

            var bombRect = {
                left: bomb.posX - bomb.radius,
                top: bomb.posY - bomb.radius,
                right: bomb.posX + bomb.radius,
                bottom: bomb.posY + bomb.radius
            };

            if (rectsOverlap(shotRect, bombRect)) {
                var ownerBoss = null;
                for (var e = 0; e < activeEnemies.length; e++) {
                    var enemy = activeEnemies[e];
                    if (enemy && !enemy.dead && enemy.isBossLevelOne && enemy.bossCombat) {
                        ownerBoss = enemy;
                        break;
                    }
                }
                spawnBossBombFanTowardsPlayer(bomb, ownerBoss);
                return true;
            }
        }

        return false;
    }

    function countDestroyedBossWeapons(enemy) {
        if (!enemy || !enemy.bossCombat || !enemy.bossCombat.weapons) {
            return 0;
        }

        var destroyed = 0;
        for (var i = 0; i < enemy.bossCombat.weapons.length; i++) {
            if (enemy.bossCombat.weapons[i] && enemy.bossCombat.weapons[i].destroyed) {
                destroyed++;
            }
        }
        return destroyed;
    }

    function applyBossWeaponDamage(enemy, weaponIndex, damage) {
        if (!enemy || !enemy.bossCombat || !enemy.bossCombat.weapons) {
            return false;
        }

        var weapon = enemy.bossCombat.weapons[weaponIndex];
        if (!weapon || weapon.destroyed || !weapon.unlocked) {
            return false;
        }

        weapon.life -= damage;
        if (weapon.life > 0) {
            return false;
        }

        weapon.life = 0;
        weapon.destroyed = true;

        var combat = enemy.bossCombat;
        var destroyedCount = countDestroyedBossWeapons(enemy);
        if (destroyedCount >= 1 && !combat.firstWeaponDestroyedTriggered) {
            combat.firstWeaponDestroyedTriggered = true;
            unlockRemainingBossWeapons(enemy);
            combat.nextBombSpawnAt = new Date().getTime() + Math.max(900, getBossBattleConfig().bombSpawnIntervalMs || 2200);
        }
        if (destroyedCount >= 2 && !combat.secondWeaponDestroyedTriggered) {
            combat.secondWeaponDestroyedTriggered = true;
            combat.nextReinforcementAt = new Date().getTime() + Math.max(1200, getBossBattleConfig().reinforcementIntervalMs || 3200);
        }

        if (destroyedCount >= combat.weapons.length) {
            enemy.life = 0;
            enemy.kill();
            for (var i = 0; i < bossBombs.length; i++) {
                if (bossBombs[i]) {
                    bossBombs[i].dead = true;
                }
            }
            addScoreForEnemyKill(enemy);
            return true;
        }

        return true;
    }

    function checkCollisions(shot) {
        var shotWidth = Math.max(10, Math.round(10 * (shot.scale || 1)));
        var shotHeight = Math.max(18, Math.round(20 * (shot.scale || 1)));
        var shotRect = {
            left: shot.posX - (shotWidth / 2),
            top: shot.posY,
            right: shot.posX - (shotWidth / 2) + shotWidth,
            bottom: shot.posY + shotHeight
        };

        if (tryHitBossBomb(shotRect)) {
            shot.deleteShot(parseInt(shot.identifier, 10));
            return false;
        }

        for (var i = 0; i < activeEnemies.length; i++) {
            var enemy = activeEnemies[i];
            if (!enemy || enemy.dead) {
                continue;
            }

            if (enemy.isBossLevelOne && enemy.bossCombat) {
                var weaponHitboxes = getVulnerableBossWeaponHitboxes(enemy);
                for (var w = 0; w < weaponHitboxes.length; w++) {
                    var weaponBox = weaponHitboxes[w];
                    if (!rectsOverlap(shotRect, weaponBox)) {
                        continue;
                    }

                    var weaponDamage = shot.damage || playerShotDamage || 1;
                    applyBossWeaponDamage(enemy, weaponBox.index, weaponDamage);

                    if ((shot.remainingBounces || 0) > 0) {
                        shot.remainingBounces = 0;
                        shot.isHoming = false;
                        shot.vy = -Math.max(2, shot.speed * 0.75);
                        shot.vx = getBounceHorizontalSpeed(shot, enemy);
                        shot.posX = weaponBox.left + (weaponBox.width / 2);
                        shot.posY = weaponBox.top - shotHeight - 2;
                        return 'keep';
                    }

                    shot.deleteShot(parseInt(shot.identifier, 10));
                    return false;
                }

                // Las hitboxes bloqueadas no absorben daño ni consumen el disparo: la bala atraviesa.
                continue;
            }

            if (shotRect.left <= (enemy.posX + enemy.image.width) && shotRect.right >= enemy.posX &&
                shotRect.top <= (enemy.posY + enemy.image.height) && shotRect.bottom >= enemy.posY) {
                var damage = shot.damage || playerShotDamage || 1;
                enemy.life -= damage;
                if (runUpgrades.slowStacks > 0) {
                    enemy.slowUntil = new Date().getTime() + 2500;
                }
                if (enemy.life <= 0) {
                    enemy.kill();
                    addScoreForEnemyKill(enemy);
                }

                if ((shot.remainingBounces || 0) > 0) {
                    shot.remainingBounces = 0;
                    shot.isHoming = false;
                    shot.vy = -Math.max(2, shot.speed * 0.75);
                    shot.vx = getBounceHorizontalSpeed(shot, enemy);
                    shot.posX = enemy.posX + (enemy.image.width / 2);
                    shot.posY = enemy.posY - shotHeight - 2;
                    return 'keep';
                }

                shot.deleteShot(parseInt(shot.identifier, 10));
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

        if (stageState === 'menu') {
            if (key === 37) {
                adjustMainMenuVolume(-5);
                e.preventDefault();
                return;
            }
            if (key === 39) {
                adjustMainMenuVolume(5);
                e.preventDefault();
                return;
            }
            if (key === 13 || key === 32) {
                startGameFromMainMenu();
                e.preventDefault();
                return;
            }
            if (key === 82) {
                restartGame();
                e.preventDefault();
                return;
            }
            e.preventDefault();
            return;
        }

        if (key === 82) { // R - Reiniciar siempre
            restartGame();
            e.preventDefault();
            return;
        }

        if (key === 80) { // P
            if (isPaused) {
                resumeGame();
            } else {
                pauseGame();
            }
            e.preventDefault();
            return;
        }

        if (isPaused) {
            if (key === 37) {
                adjustMainMenuVolume(-5);
                e.preventDefault();
                return;
            }
            if (key === 39) {
                adjustMainMenuVolume(5);
                e.preventDefault();
                return;
            }
            e.preventDefault();
            return;
        }

        if (stageState === 'name_input_pending') {
            if (key === 13) { // ENTER
                playerNameInputConfirmed = true;
                e.preventDefault();
                return;
            }
            if (key === 27) { // ESC - cancelar
                playerNameInputConfirmed = true;
                playerNameInputBuffer = getStoredPlayerName();
                e.preventDefault();
                return;
            }
            if (key === 8) { // Backspace
                if (playerNameInputBuffer.length > 0) {
                    playerNameInputBuffer = playerNameInputBuffer.substring(0, playerNameInputBuffer.length - 1);
                }
                e.preventDefault();
                return;
            }
            // Caracteres alfanuméricos y espacio (32 es espacio)
            var char = String.fromCharCode(key).toUpperCase();
            if ((key >= 48 && key <= 57) || (key >= 65 && key <= 90) || key === 32) {
                if (playerNameInputBuffer.length < 12) {
                    playerNameInputBuffer += char;
                }
                e.preventDefault();
                return;
            }
            e.preventDefault();
            return;
        }

        if (stageState === 'reward_pending') {
            if (key === keyMap.left) {
                rewardSelectedIndex = 0;
                e.preventDefault();
                return;
            }
            if (key === keyMap.right) {
                rewardSelectedIndex = 1;
                e.preventDefault();
                return;
            }
            if (key === keyMap.fire) {
                if (canConfirmRewardSelection()) {
                    confirmSelectedReward();
                }
                e.preventDefault();
                return;
            }
        }

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

    function drawNameInput() {
        var centerX = canvas.width / 2;
        var centerY = canvas.height / 2;
        var panelHeight = 200;
        
        drawArcadePanel(60, centerY - 100, canvas.width - 120, panelHeight, 0.92, 'rgba(100, 150, 255, 0.9)');
        
        drawArcadeText('INGRESA TU NOMBRE', centerX, centerY - 60, {
            color: '#fff3a3',
            font: "bold 20px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(150, 200, 255, 0.95)',
            glowBlur: 10,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 3
        });
        
        // Cursor parpadeante
        playerNameInputCursorBlink = (playerNameInputCursorBlink + 1) % 60;
        var showCursor = playerNameInputCursorBlink < 30;
        
        var displayText = playerNameInputBuffer;
        if (showCursor) {
            displayText += '_';
        } else if (playerNameInputBuffer.length < 12) {
            displayText += ' ';
        }
        
        drawArcadeText(displayText, centerX, centerY - 5, {
            color: '#ffff00',
            font: "bold 18px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 255, 100, 0.8)',
            glowBlur: 8,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });
        
        drawArcadeText('MAX 12 CARACTERES', centerX, centerY + 40, {
            color: '#ffcf63',
            font: "bold 11px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 180, 0, 0.7)',
            glowBlur: 5,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });
        
        drawArcadeText('ENTER = Confirmar  |  ESC = Cancelar', centerX, centerY + 70, {
            color: '#ffcf63',
            font: "bold 11px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 180, 0, 0.7)',
            glowBlur: 5,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });
        
        // Procesar si está confirmado
        if (playerNameInputConfirmed) {
            playerNameInputConfirmed = false;
            var normalized = normalizePlayerName(playerNameInputBuffer);
            if (isStorageAvailable()) {
                localStorage.setItem(playerNameStorageKey, normalized);
            }
            if (playerNamePendingSave) {
                playerNamePendingSave = false;
                saveFinalScore();
                if (youLoose) {
                    // Derrota: cambiar estado para que se muestre GAME OVER
                    stageState = 'game_over_display';
                } else {
                    // Victoria: mostrar pantalla de congratulaciones
                    congratulations = true;
                    stageState = 'finished';
                }
            }
        }
    }

    function showGameOver() {
        var centerX = canvas.width / 2;
        var centerY = canvas.height / 2;
        var finalScore = getFinalScore();
        var panelWidth = canvas.width - 60;
        var panelHeight = 300;
        var panelX = (canvas.width - panelWidth) / 2;
        var panelY = centerY - (panelHeight / 2);

        drawArcadePanel(panelX, panelY, panelWidth, panelHeight, 0.95, 'rgba(255, 70, 80, 0.95)');
        drawPanelShimmer(panelX, panelY, panelWidth, panelHeight, 'rgba(255, 120, 130, 0.34)', 0.85);
        drawArcadeText('GAME OVER', centerX, panelY + 80, {
            color: arcadeTheme.dangerText,
            font: "bold 52px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 40, 70, 0.95)',
            glowBlur: 16,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 6
        });
        drawArcadeText('PUNTUACION FINAL', centerX, panelY + 138, {
            color: '#ffd9a0',
            font: "bold 16px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 120, 0, 0.78)',
            glowBlur: 7,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 3
        });
        drawArcadeText(finalScore.toString(), centerX, panelY + 182, {
            color: '#fff3a3',
            font: "bold 38px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 170, 45, 0.95)',
            glowBlur: 12,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 5
        });
        drawArcadeText('PULSA R PARA REINTENTAR', centerX, panelY + 242, {
            color: '#ffd9a0',
            font: "bold 16px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 90, 0, 0.85)',
            glowBlur: 7,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 3
        });
    }

    function showCongratulations () {
        var centerX = canvas.width / 2;
        var centerY = canvas.height / 2;
        var baseScore = player.score;
        var lifeBonus = player.life * 10;
        var totalScore = getTotalScore();
        var panelWidth = canvas.width - 50;
        var panelHeight = 330;
        var panelX = (canvas.width - panelWidth) / 2;
        var panelY = centerY - (panelHeight / 2);
        
        drawArcadePanel(panelX, panelY, panelWidth, panelHeight, 0.95, 'rgba(255, 208, 77, 0.95)');
        drawPanelShimmer(panelX, panelY, panelWidth, panelHeight, 'rgba(255, 245, 175, 0.32)', 0.95);
        drawArcadeText('VICTORY', centerX, panelY + 64, {
            color: arcadeTheme.successText,
            font: "bold 46px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 185, 40, 0.9)',
            glowBlur: 16,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 6
        });
        drawArcadeText('PUNTOS ' + baseScore, centerX, panelY + 134, {
            color: '#ffe680',
            font: "bold 20px 'Courier New', monospace",
            align: 'center',
            glowColor: arcadeTheme.glow,
            glowBlur: 9,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 4
        });
        drawArcadeText('BONO VIDAS ' + player.life + ' x 10 = ' + lifeBonus, centerX, panelY + 178, {
            color: '#ffcf63',
            font: "bold 20px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 120, 0, 0.8)',
            glowBlur: 9,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 4
        });
        drawArcadeText('TOTAL ' + totalScore, centerX, panelY + 248, {
            color: '#fff3a3',
            font: "bold 34px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 165, 0, 0.95)',
            glowBlur: 14,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 5
        });
    }

    function drawPanelShimmer(x, y, width, height, tintColor, speedFactor) {
        var nowTime = new Date().getTime();
        var pulse = (Math.sin(nowTime / (90 * (speedFactor || 1))) + 1) / 2;
        var sweep = ((nowTime / (4.5 * (speedFactor || 1))) % (width + 120)) - 120;

        bufferctx.save();
        bufferctx.beginPath();
        bufferctx.rect(x, y, width, height);
        bufferctx.clip();

        bufferctx.fillStyle = tintColor;
        bufferctx.globalAlpha = 0.28 + (pulse * 0.26);
        bufferctx.fillRect(x, y, width, height);

        var shineGradient = bufferctx.createLinearGradient(x + sweep, y, x + sweep + 90, y + height);
        shineGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        shineGradient.addColorStop(0.5, 'rgba(255, 255, 230, 0.42)');
        shineGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

        bufferctx.globalCompositeOperation = 'lighter';
        bufferctx.globalAlpha = 0.42 + (pulse * 0.22);
        bufferctx.fillStyle = shineGradient;
        bufferctx.fillRect(x + sweep, y, 90, height);
        bufferctx.restore();
    }

    function getTotalScore() {
        return player.score + player.life * 10;
    }

    function getFinalScore() {
        if (youLoose) {
            return player.score;
        }
        return getTotalScore();
    }

    function update() {

        drawBackground();

        if (stageState === 'menu') {
            drawMainMenu();
            return;
        }

        if (isPaused) {
            drawPauseOverlay();
            showLifeAndScore();
            return;
        }

        updateRewardEffects();

        if (stageState === 'name_input_pending') {
            drawNameInput();
            return;
        }

        if (stageState === 'reward_pending') {
            drawRewardSelector();
            showLifeAndScore();
            return;
        }

        if (congratulations) {
            showCongratulations();
            return;
        }

        if (stageState === 'game_over_display') {
            showGameOver();
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

        playerAction();

        if (player.updateVisualFeedback) {
            player.updateVisualFeedback();
        }
        var playerDrawY = player.posY + (player.recoilOffsetY || 0);
        bufferctx.drawImage(player.getCurrentFrameImage ? player.getCurrentFrameImage() : player, player.posX, playerDrawY);
        drawPlayerImmunityEffect(player, playerDrawY);
        drawPlayerShotFeedback(player, playerDrawY);
        for (var e = 0; e < activeEnemies.length; e++) {
            var enemy = activeEnemies[e];
            if (enemy && !enemy.shouldDisappear) {
                var enemyAlpha = typeof enemy.deathFadeAlpha === 'number' ? enemy.deathFadeAlpha : 1;
                var enemyAngle = 0;
                if (enemy.enemyType === 1) {
                    if (enemy.dead) {
                        if (typeof enemy.deathRenderAngle === 'number') {
                            enemyAngle = enemy.deathRenderAngle;
                        } else if (typeof enemy.renderAngle === 'number') {
                            enemyAngle = enemy.renderAngle;
                        }
                    } else {
                        if (enemy.zigzagMotion && typeof enemy.zigzagDirection === 'number') {
                            enemyAngle = enemy.zigzagDirection > 0 ? -15 : 15;
                        } else if (enemy.direction === 'D') {
                            enemyAngle = -15;
                        } else if (enemy.direction === 'I') {
                            enemyAngle = 15;
                        } else if (typeof enemy.renderAngle === 'number') {
                            enemyAngle = enemy.renderAngle;
                        }
                    }
                }
                if (enemyAlpha < 1 || enemyAngle !== 0) {
                    bufferctx.save();
                    if (enemyAlpha < 1) {
                        bufferctx.globalAlpha = enemyAlpha;
                    }
                }
                if (enemyAngle !== 0) {
                    var enemyWidth = enemy.image && enemy.image.width ? enemy.image.width : (enemy.spriteWidth || 40);
                    var enemyHeight = enemy.image && enemy.image.height ? enemy.image.height : (enemy.spriteHeight || 40);
                    var enemyCenterX = Math.round(enemy.posX) + (enemyWidth / 2);
                    var enemyCenterY = Math.round(enemy.posY) + (enemyHeight / 2);
                    bufferctx.translate(enemyCenterX, enemyCenterY);
                    bufferctx.rotate(enemyAngle * Math.PI / 180);
                    bufferctx.drawImage(enemy.image, -(enemyWidth / 2), -(enemyHeight / 2));
                } else {
                    bufferctx.drawImage(enemy.image, Math.round(enemy.posX), Math.round(enemy.posY));
                }
                if (enemyAlpha < 1 || enemyAngle !== 0) {
                    bufferctx.restore();
                }
                if (!enemy.dead) {
                    drawEnemyHealthBar(enemy);
                    drawBossWeaponHealthBars(enemy);
                }
            }
        }

        drawBossBombs();

        updateEnemies();
        removeDeadBossBombs();

        for (var j = 0; j < playerShotsBuffer.length; j++) {
            var disparoBueno = playerShotsBuffer[j];
            updatePlayerShot(disparoBueno, j);
        }

        if (!player.dead && isAnyEnemyHittingPlayer()) {
            handlePlayerDamage(false);
        } else {
            for (var i = 0; i < evilShotsBuffer.length; i++) {
                var evilShot = evilShotsBuffer[i];
                updateEvilShot(evilShot, i);
            }
        }

        if (debugHitboxes) {
            drawDebugHitboxes();
        }

        if (isStageCleared()) {
            handleStageCleared();
            return;
        }

        showLifeAndScore();
    }

    function updatePlayerShot(playerShot, id) {
        if (playerShot) {
            playerShot.identifier = id;
            if (playerShot.isHoming && !(playerShot.vx || 0)) {
                steerPlayerShot(playerShot);
            }
            var collisionResult = checkCollisions(playerShot);
            if (collisionResult === true || collisionResult === 'keep') {
                if (isPlayerShotInBounds(playerShot)) {
                    movePlayerShot(playerShot);
                    drawPlayerShot(playerShot);
                } else {
                    playerShot.deleteShot(parseInt(playerShot.identifier));
                }
            }
        }
    }

    function movePlayerShot(playerShot) {
        var vx = typeof playerShot.vx === 'number' ? playerShot.vx : 0;
        var vy = typeof playerShot.vy === 'number' ? playerShot.vy : -playerShot.speed;
        playerShot.posX += vx;
        playerShot.posY += vy;
    }

    function isPlayerShotInBounds(playerShot) {
        var width = Math.max(10, Math.round(10 * (playerShot.scale || 1)));
        var height = Math.max(18, Math.round(20 * (playerShot.scale || 1)));
        return playerShot.posY > -height &&
            playerShot.posX > -width &&
            playerShot.posX < (canvas.width + width);
    }

    function updateEvilShot(evilShot, id) {
        if (evilShot) {
            evilShot.identifier = id;
            if (player.dead) {
                return;
            }
            if (!evilShot.isHittingPlayer() || (player.invulnerableUntil && new Date().getTime() < player.invulnerableUntil)) {
                var vx = typeof evilShot.vx === 'number' ? evilShot.vx : 0;
                var vy = typeof evilShot.vy === 'number' ? evilShot.vy : evilShot.speed;
                if (evilShot.isBossDiagonalShot) {
                    var projectedX = evilShot.posX + vx;
                    var minX = 0;
                    var maxX = canvas.width - 10;
                    var hitWall = projectedX <= minX || projectedX >= maxX;
                    if (hitWall) {
                        var canBounce = (evilShot.bounceCount || 0) < (evilShot.maxBounces || 0);
                        if (canBounce) {
                            evilShot.bounceCount = (evilShot.bounceCount || 0) + 1;
                            var accel = evilShot.bounceAcceleration || 1.12;
                            var maxSpeed = Math.max(4.5, evilShot.maxSpeed || 7.5);
                            var nextVx = Math.abs(vx) * accel;
                            var nextVy = Math.abs(vy) * accel;
                            evilShot.vx = (projectedX <= minX ? 1 : -1) * Math.min(maxSpeed, nextVx);
                            evilShot.vy = Math.min(maxSpeed, Math.max(1.5, nextVy));
                            vx = evilShot.vx;
                            vy = evilShot.vy;
                            evilShot.posX = projectedX <= minX ? minX + 1 : maxX - 1;
                        } else {
                            evilShot.vx = projectedX <= minX ? Math.abs(vx) : -Math.abs(vx);
                            vx = evilShot.vx;
                            evilShot.posX = projectedX <= minX ? minX + 1 : maxX - 1;
                        }
                    }
                }
                if (evilShot.waveMotion) {
                    evilShot.waveBaseX = (typeof evilShot.waveBaseX === 'number' ? evilShot.waveBaseX : evilShot.posX) + vx;
                    evilShot.wavePhase = (evilShot.wavePhase || 0) + (evilShot.waveFrequency || 0.5);
                    evilShot.posX = evilShot.waveBaseX + Math.sin(evilShot.wavePhase) * (evilShot.waveAmplitude || 8);
                } else {
                    evilShot.posX += vx;
                }
                evilShot.posY += vy;

                // Si la bala toca al jugador y no hay inmunidad, se consume.
                if (evilShot.isHittingPlayer() && !(player.invulnerableUntil && new Date().getTime() < player.invulnerableUntil)) {
                    evilShot.deleteShot(parseInt(evilShot.identifier, 10));
                    handlePlayerDamage(true);
                    return;
                }

                if (evilShot.posY <= canvas.height && evilShot.posX >= -40 && evilShot.posX <= (canvas.width + 40)) {
                    bufferctx.drawImage(evilShot.image, evilShot.posX, evilShot.posY);
                } else {
                    evilShot.deleteShot(parseInt(evilShot.identifier));
                }
            } else {
                // El disparo se elimina antes de aplicar daño porque el daño puede limpiar buffers.
                evilShot.deleteShot(parseInt(evilShot.identifier, 10));
                handlePlayerDamage(true);
            }
        }
    }

    function drawBackground() {
        var background = stageState === 'menu' ? bgMain : (currentStageType === 'boss' ? bgBoss : bgMain);
        bufferctx.drawImage(background, 0, 0);
    }

    function updateEnemies() {
        for (var i = 0; i < activeEnemies.length; i++) {
            var enemy = activeEnemies[i];
            if (!enemy) {
                continue;
            }

            if (enemy.shouldDisappear) {
                activeEnemies.splice(i, 1);
                i--;
                continue;
            }

            if (!enemy.dead) {
                enemy.update();
                updateBossSpecialEvents(enemy);
                if (enemy.isOutOfScreen()) {
                    resetCombo();
                    enemy.kill();
                }
            } else if (enemy.updateDeathEffect) {
                enemy.updateDeathEffect();
            }
        }
    }

    function steerPlayerShot(playerShot) {
        var target = getNearestTargetForShot(playerShot);
        if (!target) {
            return;
        }
        var targetCenter = target.targetX;
        var shotCenter = playerShot.posX;
        var steerAmount = 2 + runUpgrades.homingStacks;
        if (targetCenter > shotCenter) {
            playerShot.posX += Math.min(steerAmount, targetCenter - shotCenter);
        } else if (targetCenter < shotCenter) {
            playerShot.posX -= Math.min(steerAmount, shotCenter - targetCenter);
        }
    }

    function getNearestTargetForShot(playerShot) {
        var nearestTarget = null;
        var nearestDistance = null;
        for (var i = 0; i < activeEnemies.length; i++) {
            var enemy = activeEnemies[i];
            if (enemy.dead) {
                continue;
            }

            if (enemy.isBossLevelOne && enemy.bossCombat) {
                var weaponHitboxes = getVulnerableBossWeaponHitboxes(enemy);
                for (var w = 0; w < weaponHitboxes.length; w++) {
                    var weaponBox = weaponHitboxes[w];
                    var weaponCenterX = weaponBox.left + (weaponBox.width / 2);
                    var weaponCenterY = weaponBox.top + (weaponBox.height / 2);
                    var weaponDistance = Math.abs(weaponCenterX - playerShot.posX) + Math.max(0, playerShot.posY - weaponCenterY);
                    if (nearestDistance === null || weaponDistance < nearestDistance) {
                        nearestDistance = weaponDistance;
                        nearestTarget = {
                            enemy: enemy,
                            targetX: weaponCenterX,
                            targetY: weaponCenterY
                        };
                    }
                }
                continue;
            }

            var enemyCenterX = enemy.posX + (enemy.image.width / 2);
            var enemyCenterY = enemy.posY + (enemy.image.height / 2);
            var enemyDistance = Math.abs(enemyCenterX - playerShot.posX) + Math.max(0, playerShot.posY - enemyCenterY);
            if (nearestDistance === null || enemyDistance < nearestDistance) {
                nearestDistance = enemyDistance;
                nearestTarget = {
                    enemy: enemy,
                    targetX: enemyCenterX,
                    targetY: enemyCenterY
                };
            }
        }
        return nearestTarget;
    }

    function getBounceHorizontalSpeed(playerShot, impactedEnemy) {
        var nearestEnemy = null;
        var nearestDistance = null;
        for (var i = 0; i < activeEnemies.length; i++) {
            var enemy = activeEnemies[i];
            if (enemy.dead || enemy === impactedEnemy) {
                continue;
            }
            var enemyCenter = enemy.posX + (enemy.image.width / 2);
            var distance = Math.abs(enemyCenter - playerShot.posX);
            if (nearestDistance === null || distance < nearestDistance) {
                nearestDistance = distance;
                nearestEnemy = enemy;
            }
        }

        var horizontalSpeed = Math.max(1.5, playerShot.speed * 0.65);
        if (nearestEnemy) {
            return (nearestEnemy.posX + (nearestEnemy.image.width / 2)) >= playerShot.posX ? horizontalSpeed : -horizontalSpeed;
        }
        return getRandomNumber(2) === 0 ? -horizontalSpeed : horizontalSpeed;
    }

    function drawPlayerShot(playerShot) {
        var width = Math.max(10, Math.round(10 * (playerShot.scale || 1)));
        var height = Math.max(18, Math.round(20 * (playerShot.scale || 1)));
        bufferctx.drawImage(playerShot.image, playerShot.posX - (width / 2), playerShot.posY, width, height);
    }

    function drawPlayerShotFeedback(playerEntity, drawPosY) {
        if (!playerEntity || playerEntity.dead || !playerEntity.getShotFxRatio) {
            return;
        }

        var ratio = playerEntity.getShotFxRatio();
        if (ratio <= 0) {
            return;
        }

        var muzzleX = playerEntity.posX + (playerEntity.width / 2);
        var muzzleY = drawPosY + Math.max(4, Math.round(playerEntity.height * 0.07));
        var glowRadius = Math.max(6, Math.round(16 * ratio));
        var coreRadius = Math.max(2, Math.round(5 * ratio));
        var flashGradient = bufferctx.createRadialGradient(muzzleX, muzzleY, 1, muzzleX, muzzleY, glowRadius);
        flashGradient.addColorStop(0, 'rgba(255, 250, 175, 0.95)');
        flashGradient.addColorStop(0.45, 'rgba(255, 175, 45, 0.75)');
        flashGradient.addColorStop(1, 'rgba(255, 95, 0, 0)');

        bufferctx.save();
        bufferctx.globalCompositeOperation = 'lighter';
        bufferctx.fillStyle = flashGradient;
        bufferctx.beginPath();
        bufferctx.arc(muzzleX, muzzleY, glowRadius, 0, Math.PI * 2, false);
        bufferctx.fill();

        bufferctx.fillStyle = 'rgba(255, 250, 210, 0.95)';
        bufferctx.beginPath();
        bufferctx.arc(muzzleX, muzzleY, coreRadius, 0, Math.PI * 2, false);
        bufferctx.fill();
        bufferctx.restore();
    }

    function drawEnemyHealthBar(enemy) {
        if (!enemy || enemy.dead || enemy.isBossLevelOne) {
            return;
        }

        var maxLife = Math.max(1, enemy.maxLife || enemy.life || 1);
        var lifeRatio = Math.max(0, Math.min(1, enemy.life / maxLife));
        var spriteWidth = (enemy.image && enemy.image.width) || enemy.spriteWidth || 40;
        var barWidth = Math.max(18, Math.round(spriteWidth * 0.7));
        var barHeight = 4;
        var barX = Math.round(enemy.posX + ((spriteWidth - barWidth) / 2));
        var barY = Math.round(enemy.posY - 7);
        var fillWidth = Math.round(barWidth * lifeRatio);
        var fillColor = lifeRatio > 0.6 ? '#59ff8b' : (lifeRatio > 0.3 ? '#ffd447' : '#ff4d5a');

        bufferctx.save();
        bufferctx.fillStyle = 'rgba(18, 10, 22, 0.82)';
        bufferctx.fillRect(barX, barY, barWidth, barHeight);
        if (fillWidth > 0) {
            bufferctx.fillStyle = fillColor;
            bufferctx.fillRect(barX, barY, fillWidth, barHeight);
        }
        bufferctx.strokeStyle = 'rgba(255, 230, 170, 0.75)';
        bufferctx.lineWidth = 1;
        bufferctx.strokeRect(barX + 0.5, barY + 0.5, barWidth - 1, barHeight - 1);
        bufferctx.restore();
    }

    function drawBossWeaponHealthBars(enemy) {
        if (!enemy || enemy.dead || !enemy.isBossLevelOne || !enemy.bossCombat || !enemy.bossCombat.weapons) {
            return;
        }

        var nowTime = new Date().getTime();
        var weaponHitboxes = getBossWeaponHitboxes(enemy);
        for (var i = 0; i < weaponHitboxes.length; i++) {
            var weaponHitbox = weaponHitboxes[i];
            var weapon = enemy.bossCombat.weapons[weaponHitbox.index];
            if (!weapon) {
                continue;
            }
            var isLocked = !weapon.unlocked;

            var maxLife = Math.max(1, weapon.maxLife || weapon.life || 1);
            var lifeRatio = Math.max(0, Math.min(1, weapon.life / maxLife));
            var barWidth = Math.max(20, Math.round(weaponHitbox.width + 4));
            var barHeight = 6;
            var barX = Math.round(weaponHitbox.left);
            var barY = Math.round(weaponHitbox.top - 10);
            var fillWidth = Math.round(barWidth * lifeRatio);
            var fillColor = isLocked ? 'rgba(130, 130, 145, 0.7)' : (lifeRatio > 0.6 ? '#59ff8b' : (lifeRatio > 0.3 ? '#ffd447' : '#ff4d5a'));
            var isCritical = !isLocked && lifeRatio > 0 && lifeRatio <= 0.3;
            var pulse = isCritical ? ((Math.sin(nowTime / 110) + 1) / 2) : 0;
            var criticalGlowAlpha = 0.3 + (pulse * 0.55);

            bufferctx.save();
            if (isCritical) {
                bufferctx.shadowBlur = 8 + Math.round(pulse * 6);
                bufferctx.shadowColor = 'rgba(255, 70, 90, ' + criticalGlowAlpha + ')';
            }
            bufferctx.fillStyle = 'rgba(12, 7, 16, 0.9)';
            bufferctx.fillRect(barX, barY, barWidth, barHeight);
            if (fillWidth > 0) {
                bufferctx.fillStyle = fillColor;
                bufferctx.fillRect(barX, barY, fillWidth, barHeight);
            }
            bufferctx.strokeStyle = isLocked ? 'rgba(185, 185, 205, 0.92)' : 'rgba(255, 238, 186, 0.95)';
            bufferctx.lineWidth = 1.5;
            bufferctx.strokeRect(barX + 0.5, barY + 0.5, barWidth - 1, barHeight - 1);
            if (isLocked) {
                bufferctx.strokeStyle = 'rgba(220, 220, 240, 0.75)';
                bufferctx.lineWidth = 1;
                bufferctx.beginPath();
                bufferctx.moveTo(barX + 2, barY + 2);
                bufferctx.lineTo(barX + barWidth - 2, barY + barHeight - 2);
                bufferctx.moveTo(barX + barWidth - 2, barY + 2);
                bufferctx.lineTo(barX + 2, barY + barHeight - 2);
                bufferctx.stroke();
            }
            bufferctx.restore();
        }
    }

    function drawPlayerImmunityEffect(playerEntity, drawPosY) {
        if (!playerEntity || playerEntity.dead) {
            return;
        }

        var nowTime = new Date().getTime();
        if (!playerEntity.invulnerableUntil || nowTime >= playerEntity.invulnerableUntil) {
            return;
        }

        var centerX = playerEntity.posX + (playerEntity.width / 2);
        var centerY = drawPosY + Math.round(playerEntity.height * 0.5);
        var pulse = (Math.sin(nowTime / 85) + 1) / 2;
        var baseRadius = Math.max(12, Math.round(Math.max(playerEntity.width, playerEntity.height) * 0.38));
        var radius = baseRadius + Math.round(pulse * 1);

        bufferctx.save();
        bufferctx.globalCompositeOperation = 'lighter';
        bufferctx.strokeStyle = 'rgba(140, 235, 255, ' + (0.55 + (pulse * 0.35)) + ')';
        bufferctx.lineWidth = 2;
        bufferctx.beginPath();
        bufferctx.arc(centerX, centerY, radius, 0, Math.PI * 2, false);
        bufferctx.stroke();
        bufferctx.restore();
    }

    function handlePlayerDamage(fromProjectile) {
        var nowTime = new Date().getTime();
        if (player.invulnerableUntil && nowTime < player.invulnerableUntil) {
            return;
        }
        if (fromProjectile && runUpgrades.dodgeTaken) {
            runUpgrades.dodgeTaken = false;
            player.invulnerableUntil = nowTime + 800;
            return;
        }
        if (runUpgrades.shieldStacks > 0) {
            runUpgrades.shieldStacks--;
            player.invulnerableUntil = nowTime + 800;
            return;
        }
        player.invulnerableUntil = nowTime + 2000;
        player.killPlayer(nowTime);
    }

    /******************************* MEJORES PUNTUACIONES (LOCALSTORAGE) *******************************/
    function saveFinalScore() {
        var history = loadScoreHistory();
        history.push(buildCurrentScoreRecord());
        saveScoreHistory(history);
        showBestScores();
    }

    function fillZero(number) {
        if (number < 10) {
            return '0' + number;
        }
        return number;
    }

    function isStorageAvailable() {
        try {
            var testKey = '__flubber_storage_test__';
            localStorage.setItem(testKey, '1');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            return false;
        }
    }

    function normalizeNumber(value, fallbackValue) {
        var parsed = parseInt(value, 10);
        if (isNaN(parsed)) {
            return fallbackValue;
        }
        return parsed;
    }

    function normalizePlayerName(name) {
        var normalized = (name || '').toString().replace(/\s+/g, ' ').replace(/[<>]/g, '').trim();
        if (!normalized) {
            normalized = 'Anonimo';
        }
        return normalized.substring(0, 24);
    }

    function normalizeRecord(record) {
        if (!record || typeof record !== 'object') {
            return null;
        }

        var id = record.id;

        if (!id) {
            id = new Date().getTime() + '_' + Math.floor(Math.random() * 1000000);
        }

        return {
            id: id,
            playerName: normalizePlayerName(record.playerName),
            score: Math.max(0, normalizeNumber(record.score, 0))
        };
    }

    function sortScoreRecordsDescending(records) {
        records.sort(function (first, second) {
            if (second.score !== first.score) {
                return second.score - first.score;
            }

            if (first.id < second.id) {
                return 1;
            }
            if (first.id > second.id) {
                return -1;
            }
            return 0;
        });

        return records;
    }

    function normalizeScoreHistory(history) {
        if (!history || !history.length) {
            return [];
        }

        var normalized = [];
        for (var i = 0; i < history.length; i++) {
            var normalizedRecord = normalizeRecord(history[i]);
            if (normalizedRecord) {
                normalized.push(normalizedRecord);
            }
        }

        return sortScoreRecordsDescending(normalized);
    }

    function loadScoreHistory() {
        if (!isStorageAvailable()) {
            return [];
        }

        var stored = localStorage.getItem(scoreHistoryStorageKey);
        if (!stored) {
            return [];
        }

        try {
            var parsed = JSON.parse(stored);
            if (!Array.isArray(parsed)) {
                return [];
            }
            return normalizeScoreHistory(parsed);
        } catch (error) {
            return [];
        }
    }

    function saveScoreHistory(history) {
        if (!isStorageAvailable()) {
            return;
        }

        var normalized = normalizeScoreHistory(history);
        if (normalized.length > scoreHistoryStorageLimit) {
            normalized = normalized.slice(0, scoreHistoryStorageLimit);
        }

        try {
            localStorage.setItem(scoreHistoryStorageKey, JSON.stringify(normalized));
        } catch (error) {
            // Si no hay espacio en Local Storage no se interrumpe el juego.
        }
    }

    function isLegacyScoreEntry(key, value) {
        if (!legacyScoreDatePattern.test(key || '')) {
            return false;
        }

        var scoreValue = parseInt(value, 10);
        return !isNaN(scoreValue);
    }

    function migrateLegacyScoresIfNeeded() {
        if (!isStorageAvailable()) {
            return;
        }

        var existingHistory = loadScoreHistory();
        var migratedRecords = [];
        var keysToRemove = [];

        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (!key || key === scoreHistoryStorageKey || key === playerNameStorageKey) {
                continue;
            }

            var value = localStorage.getItem(key);
            if (!isLegacyScoreEntry(key, value)) {
                continue;
            }

            migratedRecords.push({
                id: 'legacy_' + i + '_' + key,
                playerName: 'Anonimo',
                score: normalizeNumber(value, 0)
            });
            keysToRemove.push(key);
        }

        if (!migratedRecords.length) {
            return;
        }

        saveScoreHistory(existingHistory.concat(migratedRecords));

        for (var j = 0; j < keysToRemove.length; j++) {
            localStorage.removeItem(keysToRemove[j]);
        }
    }

    function getStoredPlayerName() {
        if (!isStorageAvailable()) {
            return 'Anonimo';
        }
        return normalizePlayerName(localStorage.getItem(playerNameStorageKey));
    }

    function getPlayerNameForRecord() {
        var normalized = normalizePlayerName(playerNameInputBuffer);
        return normalized;
    }

    function buildCurrentScoreRecord() {
        return {
            id: new Date().getTime() + '_' + Math.floor(Math.random() * 1000000),
            playerName: getPlayerNameForRecord(),
            score: Math.max(0, normalizeNumber(getFinalScore(), 0))
        };
    }

    function getBestScoreRecords() {
        var history = loadScoreHistory();
        return history.slice(0, totalBestScoresToShow);
    }

    function showBestScores() {
        var bestScores = getBestScoreRecords();
        var bestScoresList = document.getElementById('puntuaciones');
        if (bestScoresList) {
            clearList(bestScoresList);
            for (var i=0; i < bestScores.length; i++) {
                var rowClassName = i === 0 ? 'negrita' : null;
                addListElement(bestScoresList, bestScores[i].playerName, rowClassName);
                addListElement(bestScoresList, bestScores[i].score, rowClassName);
            }

            if (!bestScores.length) {
                addListElement(bestScoresList, 'Sin datos');
                addListElement(bestScoresList, '-');
            }
        }
    }

    function clearList(list) {
        list.innerHTML = '';
        addListElement(list, "Jugador");
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
    /******************************* FIN MEJORES PUNTUACIONES *******************************/

    return {
        init: init,
        setDebugStartConfig: setDebugStartConfig,
        clearDebugStartConfig: clearDebugStartConfig,
        setDebugRewardsForTest: setDebugRewardsForTest,
        clearDebugRewardsForTest: clearDebugRewardsForTest,
        pauseGame: pauseGame,
        resumeGame: resumeGame,
        restartGameFromPause: restartGameFromPause
    }
})();