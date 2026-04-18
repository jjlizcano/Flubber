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
        playerAnimations = {
            idle: [],
            left: [],
            right: [],
            frameCount: 16,
            frameDurationMs: 1000 / 16
        },
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
        now = 0,
        debugHitboxes = false;

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
        1: { spriteIndex: 0, lifeBonus: 0, shotsBonus: 0, speedBonus: 0.14, pointsBonus: 0 },
        2: { spriteIndex: 1, lifeBonus: 1, shotsBonus: 0, speedBonus: 0.10, pointsBonus: 1 },
        3: { spriteIndex: 2, lifeBonus: 2, shotsBonus: 1, speedBonus: 0.08, pointsBonus: 3 },
        4: { spriteIndex: 3, lifeBonus: 3, shotsBonus: 1, speedBonus: 0.05, pointsBonus: 5 },
        5: { spriteIndex: 4, lifeBonus: 4, shotsBonus: 1, speedBonus: 0.00, pointsBonus: 7 }
    };

    var bossByLevel = {
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
    var pendingRewardRewarded = false;
    var playerShotDamage = 1;
    var playerShotScale = 1;
    var playerScoreMultiplier = 1;
    var playerEffectiveSpeed = playerSpeed;
    var maxPlayerLife = 5;
    var fogueoPulseInterval = 7000;
    var debugRewardsForTest = [];
    var debugStartConfig = {
        enabled: false,
        level: 1,
        phase: 1,
        stageType: 'normal'
    };

    function loop() {
        update();
        draw();
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
        }

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
        resetRunUpgrades();
        refreshPlayerStats();

        showBestScores();

        canvas = document.getElementById('canvas');
        ctx = canvas.getContext("2d");

        buffer = document.createElement('canvas');
        buffer.width = canvas.width;
        buffer.height = canvas.height;
        bufferctx = buffer.getContext('2d');

        loadDebugStartConfigFromUrl();
        applyDebugStartConfig();
        player = new Player(playerLife, 0);
        applyDebugRewardsForTest();
        startCountdown('Nivel ' + currentLevel + ' - Fase ' + currentPhase);

        showLifeAndScore();

        addListener(document, 'keydown', keyDown);
        addListener(document, 'keyup', keyUp);

        function anim () {
            loop();
            requestAnimFrame(anim);
        }
        anim();
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
            currentPhase = 1;
            currentStageType = 'normal';
            debugHitboxes = false;
            return;
        }

        currentLevel = Math.min(totalLevels, Math.max(1, parseInt(debugStartConfig.level, 10) || 1));
        currentPhase = Math.min(phasesPerLevel, Math.max(1, parseInt(debugStartConfig.phase, 10) || 1));
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
        var weights = getRewardWeightsForStage(currentLevel, currentPhase);
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

        drawArcadeText('USA IZQUIERDA / DERECHA Y ESPACIO', centerX, centerY + 88, {
            color: '#ffcf63',
            font: "bold 12px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 120, 0, 0.8)',
            glowBlur: 5,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });
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
           drawArcadeText(reward.name, x + (width / 2), y + 52, {
                color: arcadeTheme.primaryText,
                font: "bold 14px 'Courier New', monospace",
                align: 'center',
                glowColor: arcadeTheme.glow,
                glowBlur: 6,
                outlineColor: arcadeTheme.outline,
                outlineWidth: 2
            });
            drawArcadeText(reward.description, x + (width / 2), y + 80, {
                color: '#fff3a3',
                font: "bold 11px 'Courier New', monospace",
                align: 'center',
                glowColor: 'rgba(255, 120, 0, 0.5)',
                glowBlur: 4,
                outlineColor: arcadeTheme.outline,
                outlineWidth: 1
            });
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
        var baseEnemyLife = 2 + (currentLevel - 1) + Math.floor((currentPhase - 1) / 2);
        var baseEnemyShots = 3 + currentLevel + Math.floor((currentPhase - 1) / 2);
        var baseEnemySpeed = defaultEnemySpeed + ((currentLevel - 1) * 0.22) + ((currentPhase - 1) * 0.05);

        var enemyTypePool = getEnemyTypePool(currentLevel, currentPhase);
        var maxConcurrent = getMaxConcurrentForStage(currentLevel, currentPhase);
        var spawnDelay = getSpawnDelayForLevel(currentLevel);

        return {
            type: currentStageType,
            enemyCount: isBossStage ? 1 : enemyCount,
            enemyLife: baseEnemyLife,
            enemyShots: baseEnemyShots,
            enemySpeed: baseEnemySpeed,
            enemyPoints: 4 + currentLevel + currentPhase + Math.floor((currentPhase - 1) / 2),
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

    function shouldOpenRewardSelector() {
        if (currentStageType === 'boss') {
            return true;
        }
        return currentStageType === 'normal' && currentPhase % 2 === 0;
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
        if (shouldOpenRewardSelector()) {
            openRewardSelector();
            return;
        }

        completeStageClear();
    }

    function completeStageClear() {
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

            if (player.dead)
                return;
            if (keyPressed.left && player.posX > 5)
                player.posX -= player.speed;
            if (keyPressed.right && player.posX < (canvas.width - player.width - 5))
                player.posX += player.speed;
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
        this.animation = 0;
        this.spriteWidth = this.image.width || 40;
        this.spriteHeight = this.image.height || 40;
        this.posX = getRandomNumber(Math.max(1, canvas.width - this.spriteWidth));
        this.posY = -50;
        this.life = life;
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
            this.stopShooting();
            this.dead = true;
            this.image = enemyImages.killed;
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

                if (this.posX <= 0) {
                    this.posX = 0;
                    this.zigzagDirection = 1;
                } else if (this.posX >= (canvas.width - this.spriteWidth)) {
                    this.posX = canvas.width - this.spriteWidth;
                    this.zigzagDirection = -1;
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
                    if (this.posX >= this.maxX) {
                        this.posX = this.maxX;
                        this.direction = 'I';
                    }
                } else {
                    this.posX -= movementSpeed;
                    if (this.posX <= this.minX) {
                        this.posX = this.minX;
                        this.direction = 'D';
                    }
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
            if (enemy.enemyType === 3 || enemy.enemyType === 5) {
                return;
            }
            if (enemy.shots > 0 && !enemy.dead && stageState === 'playing') {
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

    function checkCollisions(shot) {
        for (var i = 0; i < activeEnemies.length; i++) {
            var enemy = activeEnemies[i];
            var shotWidth = Math.max(10, Math.round(10 * (shot.scale || 1)));
            var shotHeight = Math.max(18, Math.round(20 * (shot.scale || 1)));
            var shotLeft = shot.posX - (shotWidth / 2);
            var shotRight = shotLeft + shotWidth;
            var shotTop = shot.posY;
            var shotBottom = shotTop + shotHeight;
            if (!enemy.dead && shotLeft <= (enemy.posX + enemy.image.width) && shotRight >= enemy.posX &&
                shotTop <= (enemy.posY + enemy.image.height) && shotBottom >= enemy.posY) {
                var damage = shot.damage || playerShotDamage || 1;
                enemy.life -= damage;
                if (runUpgrades.slowStacks > 0) {
                    enemy.slowUntil = new Date().getTime() + 2500;
                }
                if (enemy.life <= 0) {
                    enemy.kill();
                    player.score += Math.round(enemy.pointsToKill * playerScoreMultiplier);
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
                confirmSelectedReward();
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
        updateRewardEffects();

        if (stageState === 'reward_pending') {
            drawRewardSelector();
            showLifeAndScore();
            return;
        }

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

        if (player.updateVisualFeedback) {
            player.updateVisualFeedback();
        }
        var playerDrawY = player.posY + (player.recoilOffsetY || 0);
        bufferctx.drawImage(player.getCurrentFrameImage ? player.getCurrentFrameImage() : player, player.posX, playerDrawY);
        drawPlayerShotFeedback(player, playerDrawY);
        for (var e = 0; e < activeEnemies.length; e++) {
            var enemy = activeEnemies[e];
            if (enemy) {
                bufferctx.drawImage(enemy.image, Math.round(enemy.posX), Math.round(enemy.posY));
            }
        }

        updateEnemies();

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

        playerAction();
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
            if (!evilShot.isHittingPlayer()) {
                var vx = typeof evilShot.vx === 'number' ? evilShot.vx : 0;
                var vy = typeof evilShot.vy === 'number' ? evilShot.vy : evilShot.speed;
                if (evilShot.waveMotion) {
                    evilShot.waveBaseX = (typeof evilShot.waveBaseX === 'number' ? evilShot.waveBaseX : evilShot.posX) + vx;
                    evilShot.wavePhase = (evilShot.wavePhase || 0) + (evilShot.waveFrequency || 0.5);
                    evilShot.posX = evilShot.waveBaseX + Math.sin(evilShot.wavePhase) * (evilShot.waveAmplitude || 8);
                } else {
                    evilShot.posX += vx;
                }
                evilShot.posY += vy;
                if (evilShot.posY <= canvas.height && evilShot.posX >= -40 && evilShot.posX <= (canvas.width + 40)) {
                    bufferctx.drawImage(evilShot.image, evilShot.posX, evilShot.posY);
                } else {
                    evilShot.deleteShot(parseInt(evilShot.identifier));
                }
            } else {
                handlePlayerDamage(true);
                evilShot.deleteShot(parseInt(evilShot.identifier));
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

    function steerPlayerShot(playerShot) {
        var target = getNearestEnemyToShot(playerShot);
        if (!target) {
            return;
        }
        var targetCenter = target.posX + (target.image.width / 2);
        var shotCenter = playerShot.posX;
        var steerAmount = 2 + runUpgrades.homingStacks;
        if (targetCenter > shotCenter) {
            playerShot.posX += Math.min(steerAmount, targetCenter - shotCenter);
        } else if (targetCenter < shotCenter) {
            playerShot.posX -= Math.min(steerAmount, shotCenter - targetCenter);
        }
    }

    function getNearestEnemyToShot(playerShot) {
        var nearestEnemy = null;
        var nearestDistance = null;
        for (var i = 0; i < activeEnemies.length; i++) {
            var enemy = activeEnemies[i];
            if (enemy.dead) {
                continue;
            }
            var enemyCenter = enemy.posX + (enemy.image.width / 2);
            var distance = Math.abs(enemyCenter - playerShot.posX) + Math.max(0, playerShot.posY - enemy.posY);
            if (nearestDistance === null || distance < nearestDistance) {
                nearestDistance = distance;
                nearestEnemy = enemy;
            }
        }
        return nearestEnemy;
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
        player.invulnerableUntil = nowTime + 800;
        player.killPlayer();
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
        init: init,
        setDebugStartConfig: setDebugStartConfig,
        clearDebugStartConfig: clearDebugStartConfig,
        setDebugRewardsForTest: setDebugRewardsForTest,
        clearDebugRewardsForTest: clearDebugRewardsForTest
    }
})();