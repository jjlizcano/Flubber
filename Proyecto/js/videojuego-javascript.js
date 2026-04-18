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

    array.splice(index, 1);
    return array.length;
};

var game = (function () {

    var gameConfig = window.FlubberGameConfig || {};
    var collisionSystem = window.FlubberCollisionSystem || null;
    var damageSystem = null;
    var shotEntities = null;
    var shotRuntime = null;
    var playerEntityFactory = null;
    var enemyEntityFactory = null;
    var stageManager = null;

    // Variables globales a la aplicacion
    var canvas,
        ctx,
        buffer,
        bufferctx,
        player,
        playerShot,
        playerSpriteImage,
        bgMain,
        bgBoss,
        defaultEnemySpeed = gameConfig.defaultEnemySpeed || 1,
        totalLevels = gameConfig.totalLevels || 2,
        phasesPerLevel = gameConfig.phasesPerLevel || 10,
        playerLife = gameConfig.playerLife || 3,
        shotSpeed = gameConfig.shotSpeed || 5,
        playerSpeed = gameConfig.playerSpeed || 5,
        currentLevel = 1,
        currentPhase = 1,
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
        youLoose = false,
        congratulations = false,
        minHorizontalOffset = gameConfig.minHorizontalOffset || 100,
        maxHorizontalOffset = gameConfig.maxHorizontalOffset || 400,
        activeEnemies = [],
        totalBestScoresToShow = gameConfig.totalBestScoresToShow || 5, // las mejores puntuaciones que se mostraran
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
        keyMap = gameConfig.keyMap || {
            left: 37,
            right: 39,
            fire: 32
        },
        nextPlayerShot = 0,
        playerShotDelay = 250,
        now = 0,
        assetsReady = false,
        assetsLoaded = 0,
        assetsTotal = 0,
        debugHitboxes = false,
        playerDamageAppliedThisFrame = false;

    var arcadeTheme = gameConfig.arcadeTheme || {
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

    var enemyTypeConfigs = gameConfig.enemyTypeConfigs || {};

    var scoreSystem = gameConfig.scoreSystem || {};
    var scoreStoragePrefix = 'flubber_v2_score::';
    var scoreSchemaStorageKey = 'flubber_score_schema';

    var bossByLevel = gameConfig.bossByLevel || {};
    var bossLevelOneConfig = gameConfig.bossLevelOne || {};

    var rewardCatalog = gameConfig.rewardCatalog || {};

    var bossMechanicState = {
        nextBombSpawnAt: 0,
        nextReinforcementSpawnAt: 0
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
        stageType: 'normal',
        hitboxes: false
    };

    function loop() {
        update();
        draw();
    }

    function getImageDimension(image, fallbackDimension) {
        if (image && image.width) {
            return image.width;
        }
        return fallbackDimension;
    }

    function getRectBounds(x, y, width, height) {
        return collisionSystem ? collisionSystem.getRectBounds(x, y, width, height) : {
            left: x,
            top: y,
            right: x + width,
            bottom: y + height,
            width: width,
            height: height
        };
    }

    function rectsOverlap(firstRect, secondRect) {
        return collisionSystem ? collisionSystem.rectsOverlap(firstRect, secondRect) : (
            firstRect.left < secondRect.right &&
            firstRect.right > secondRect.left &&
            firstRect.top < secondRect.bottom &&
            firstRect.bottom > secondRect.top
        );
    }

    function circleRectOverlap(circle, rect) {
        return collisionSystem ? collisionSystem.circleRectOverlap(circle, rect) : (function () {
            var closestX = Math.max(rect.left, Math.min(circle.x, rect.right));
            var closestY = Math.max(rect.top, Math.min(circle.y, rect.bottom));
            var deltaX = circle.x - closestX;
            var deltaY = circle.y - closestY;
            return (deltaX * deltaX) + (deltaY * deltaY) <= (circle.radius * circle.radius);
        })();
    }

    function getPlayerHitCircle() {
        return collisionSystem ? collisionSystem.getPlayerHitCircle(player, playerSpriteImage) : (function () {
            var width = player && player.width ? player.width : getImageDimension(playerSpriteImage, 52);
            var height = player && player.height ? player.height : 66;
            var radius = Math.max(12, Math.round(Math.min(width, height) * 0.28));

            return {
                x: (player ? player.posX : 0) + (width / 2),
                y: (player ? player.posY : 0) + Math.round(height * 0.44),
                radius: radius
            };
        })();
    }

    function getPlayerBounds() {
        return collisionSystem ? collisionSystem.getPlayerBounds(player, playerSpriteImage) : (function () {
            var circle = getPlayerHitCircle();
            return getRectBounds(circle.x - circle.radius, circle.y - circle.radius, circle.radius * 2, circle.radius * 2);
        })();
    }

    function getEnemyBounds(enemy) {
        return collisionSystem ? collisionSystem.getEnemyBounds(enemy) : getRectBounds(
            enemy.posX,
            enemy.posY,
            enemy.spriteWidth || getImageDimension(enemy.image, 40),
            enemy.spriteHeight || 40
        );
    }

    function isLevelOneBossEnemy(enemy) {
        return !!(enemy && enemy.bossLevel === 1 && enemy.isBossLevelOne && enemy.bossCombat && enemy.bossCombat.weapons);
    }

    function getBossWeaponBounds(enemy) {
        if (!isLevelOneBossEnemy(enemy)) {
            return [];
        }

        if (collisionSystem && typeof collisionSystem.getBossWeaponBounds === 'function') {
            return collisionSystem.getBossWeaponBounds(enemy);
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

    function getAliveBossWeaponsCount(enemy) {
        var weaponBounds = getBossWeaponBounds(enemy);
        return weaponBounds.length;
    }

    function getBossWeaponHit(enemy, shotBounds) {
        var weaponBounds = getBossWeaponBounds(enemy);
        for (var i = 0; i < weaponBounds.length; i++) {
            if (rectsOverlap(shotBounds, weaponBounds[i])) {
                return weaponBounds[i];
            }
        }
        return null;
    }

    function getPlayerShotBounds(shot) {
        return collisionSystem ? collisionSystem.getPlayerShotBounds(shot) : (function () {
            var width = Math.max(10, Math.round(10 * (shot.scale || 1)));
            var height = Math.max(18, Math.round(20 * (shot.scale || 1)));
            return getRectBounds(shot.posX - (width / 2), shot.posY, width, height);
        })();
    }

    function resetPlayerPosition(targetPlayer) {
        if (!targetPlayer) {
            return;
        }
        targetPlayer.width = targetPlayer.width || getImageDimension(playerSpriteImage, 52);
        targetPlayer.height = targetPlayer.height || 66;
        targetPlayer.posX = (canvas.width / 2) - (targetPlayer.width / 2);
        targetPlayer.posY = canvas.height - targetPlayer.height - 10;
    }

    function getEnemyShotBounds(shot) {
        return collisionSystem ? collisionSystem.getEnemyShotBounds(shot) : getRectBounds(shot.posX, shot.posY, 10, 20);
    }

    function markAssetLoaded(onComplete) {
        assetsLoaded++;
        if (assetsLoaded >= assetsTotal && typeof onComplete === 'function') {
            onComplete();
        }
    }

    function syncStageStateFromManager() {
        if (!stageManager) {
            return;
        }

        var stageSnapshot = stageManager.getState();
        currentLevel = stageSnapshot.currentLevel;
        currentPhase = stageSnapshot.currentPhase;
        currentStageType = stageSnapshot.currentStageType;
        stageState = stageSnapshot.stageState;
        stageMessage = stageSnapshot.stageMessage;
        stageTransitionUntil = stageSnapshot.stageTransitionUntil;
        activeStageConfig = stageSnapshot.activeStageConfig;
        pendingStageSpawns = stageSnapshot.pendingStageSpawns;
        spawnedStageEnemies = stageSnapshot.spawnedStageEnemies;
        stageSpawnTimeout = stageSnapshot.stageSpawnTimeout;
    }

    function drawLoadingScreen() {
        var centerX = canvas.width / 2;
        var centerY = canvas.height / 2;
        bufferctx.clearRect(0, 0, canvas.width, canvas.height);
        bufferctx.fillStyle = '#140814';
        bufferctx.fillRect(0, 0, canvas.width, canvas.height);
        drawArcadePanel(70, centerY - 90, canvas.width - 140, 180, 0.94, arcadeTheme.panelStroke);
        drawArcadeText('CARGANDO SPRITES', centerX, centerY - 26, {
            color: arcadeTheme.primaryText,
            font: arcadeTheme.titleFont,
            align: 'center',
            glowColor: arcadeTheme.glow,
            glowBlur: 10,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 4
        });
        drawArcadeText('(' + assetsLoaded + ' / ' + assetsTotal + ')', centerX, centerY + 18, {
            color: '#fff3a3',
            font: "bold 16px 'Courier New', monospace",
            align: 'center',
            glowColor: 'rgba(255, 120, 0, 0.8)',
            glowBlur: 6,
            outlineColor: arcadeTheme.outline,
            outlineWidth: 2
        });
    }

    function drawDebugHitboxes() {
        var i;

        if (player && !player.dead) {
            var playerHitCircle = getPlayerHitCircle();
            bufferctx.save();
            bufferctx.strokeStyle = 'rgba(80, 255, 160, 0.9)';
            bufferctx.lineWidth = 2;
            bufferctx.beginPath();
            bufferctx.arc(playerHitCircle.x, playerHitCircle.y, playerHitCircle.radius, 0, Math.PI * 2, false);
            bufferctx.stroke();
            bufferctx.restore();
        }

        for (i = 0; i < activeEnemies.length; i++) {
            if (activeEnemies[i] && !activeEnemies[i].dead) {
                if (isLevelOneBossEnemy(activeEnemies[i])) {
                    var weaponBounds = getBossWeaponBounds(activeEnemies[i]);
                    for (var w = 0; w < weaponBounds.length; w++) {
                        bufferctx.save();
                        bufferctx.strokeStyle = 'rgba(255, 80, 120, 0.9)';
                        bufferctx.lineWidth = 2;
                        bufferctx.strokeRect(weaponBounds[w].left, weaponBounds[w].top, weaponBounds[w].width, weaponBounds[w].height);
                        bufferctx.restore();
                    }
                } else {
                    var enemyBounds = getEnemyBounds(activeEnemies[i]);
                    bufferctx.save();
                    bufferctx.strokeStyle = 'rgba(255, 80, 120, 0.9)';
                    bufferctx.lineWidth = 2;
                    bufferctx.strokeRect(enemyBounds.left, enemyBounds.top, enemyBounds.width, enemyBounds.height);
                    bufferctx.restore();
                }
            }
        }

        for (i = 0; i < playerShotsBuffer.length; i++) {
            var playerShotBounds = getPlayerShotBounds(playerShotsBuffer[i]);
            bufferctx.save();
            bufferctx.strokeStyle = 'rgba(80, 180, 255, 0.9)';
            bufferctx.lineWidth = 1;
            bufferctx.strokeRect(playerShotBounds.left, playerShotBounds.top, playerShotBounds.width, playerShotBounds.height);
            bufferctx.restore();
        }

        for (i = 0; i < evilShotsBuffer.length; i++) {
            var evilShotBounds = getEnemyShotBounds(evilShotsBuffer[i]);
            bufferctx.save();
            bufferctx.strokeStyle = 'rgba(255, 200, 80, 0.9)';
            bufferctx.lineWidth = 1;
            bufferctx.strokeRect(evilShotBounds.left, evilShotBounds.top, evilShotBounds.width, evilShotBounds.height);
            bufferctx.restore();
        }
    }

    function preloadImages (onComplete) {
        assetsLoaded = 0;
        assetsReady = false;
        assetsTotal = 24;

        playerSpriteImage = new Image();
        playerSpriteImage.onload = function () {
            markAssetLoaded(onComplete);
        };
        playerSpriteImage.onerror = function () {
            markAssetLoaded(onComplete);
        };
        playerSpriteImage.src = 'images/bueno.png';

        for (var i = 1; i <= 8; i++) {
            var evilImage = new Image();
            evilImage.onload = function () {
                markAssetLoaded(onComplete);
            };
            evilImage.onerror = function () {
                markAssetLoaded(onComplete);
            };
            evilImage.src = 'images/malo' + i + '.png';
            evilImages.animation[i-1] = evilImage;
            var bossImage = new Image();
            bossImage.onload = function () {
                markAssetLoaded(onComplete);
            };
            bossImage.onerror = function () {
                markAssetLoaded(onComplete);
            };
            bossImage.src = 'images/jefe' + i + '.png';
            bossImages.animation[i-1] = bossImage;
        }
        evilImages.killed.onload = function () {
            markAssetLoaded(onComplete);
        };
        evilImages.killed.onerror = function () {
            markAssetLoaded(onComplete);
        };
        evilImages.killed.src = 'images/malo_muerto.png';
        bossImages.killed.onload = function () {
            markAssetLoaded(onComplete);
        };
        bossImages.killed.onerror = function () {
            markAssetLoaded(onComplete);
        };
        bossImages.killed.src = 'images/jefe_muerto.png';
        bgMain = new Image();
        bgMain.onload = function () {
            markAssetLoaded(onComplete);
        };
        bgMain.onerror = function () {
            markAssetLoaded(onComplete);
        };
        bgMain.src = 'images/fondovertical.png';
        bgBoss = new Image();
        bgBoss.onload = function () {
            markAssetLoaded(onComplete);
        };
        bgBoss.onerror = function () {
            markAssetLoaded(onComplete);
        };
        bgBoss.src = 'images/fondovertical_jefe.png';
        playerShotImage = new Image();
        playerShotImage.onload = function () {
            markAssetLoaded(onComplete);
        };
        playerShotImage.onerror = function () {
            markAssetLoaded(onComplete);
        };
        playerShotImage.src = 'images/disparo_bueno.png';
        evilShotImage = new Image();
        evilShotImage.onload = function () {
            markAssetLoaded(onComplete);
        };
        evilShotImage.onerror = function () {
            markAssetLoaded(onComplete);
        };
        evilShotImage.src = 'images/disparo_malo.png';
        playerKilledImage = new Image();
        playerKilledImage.onload = function () {
            markAssetLoaded(onComplete);
        };
        playerKilledImage.onerror = function () {
            markAssetLoaded(onComplete);
        };
        playerKilledImage.src = 'images/bueno_muerto.png';

    }

    function init() {
        migrateScoreRankingIfNeeded();
        showBestScores();

        canvas = document.getElementById('canvas');
        ctx = canvas.getContext("2d");

        buffer = document.createElement('canvas');
        buffer.width = canvas.width;
        buffer.height = canvas.height;
        bufferctx = buffer.getContext('2d');

        loadDebugStartConfigFromUrl();
        applyDebugStartConfig();
        debugHitboxes = !!debugStartConfig.hitboxes;

        shotEntities = window.FlubberShotEntities ? window.FlubberShotEntities.create({
            arrayRemove: arrayRemove,
            getPlayerShotsBuffer: function () {
                return playerShotsBuffer;
            },
            getEvilShotsBuffer: function () {
                return evilShotsBuffer;
            },
            getPlayerShotImage: function () {
                return playerShotImage;
            },
            getEvilShotImage: function () {
                return evilShotImage;
            },
            getShotSpeed: function () {
                return shotSpeed;
            },
            circleRectOverlap: circleRectOverlap,
            getPlayerHitCircle: getPlayerHitCircle,
            getEnemyShotBounds: getEnemyShotBounds
        }) : null;

        shotRuntime = window.FlubberShotRuntime ? window.FlubberShotRuntime.create({
            getPlayerShotsBuffer: function () {
                return playerShotsBuffer;
            },
            getEvilShotsBuffer: function () {
                return evilShotsBuffer;
            },
            getPlayer: function () {
                return player;
            },
            getCanvasWidth: function () {
                return canvas.width;
            },
            getCanvasHeight: function () {
                return canvas.height;
            },
            getBufferContext: function () {
                return bufferctx;
            },
            steerPlayerShot: steerPlayerShot,
            checkCollisions: checkCollisions,
            circleRectOverlap: circleRectOverlap,
            getPlayerHitCircle: getPlayerHitCircle,
            getEnemyShotBounds: getEnemyShotBounds,
            handlePlayerDamage: handlePlayerDamageOncePerFrame
        }) : null;

        if (!shotRuntime) {
            throw new Error('FlubberShotRuntime module is required to update shots');
        }

        playerEntityFactory = window.FlubberPlayerEntity ? window.FlubberPlayerEntity.create({
            getPlayerSpriteImage: function () {
                return playerSpriteImage;
            },
            resetPlayerPosition: resetPlayerPosition,
            getPlayerSpeed: function () {
                return playerSpeed;
            },
            createPlayerShot: function (x, y) {
                return shotEntities ? shotEntities.createPlayerShot(x, y) : new PlayerShot(x, y);
            },
            getPlayerShotDamage: function () {
                return playerShotDamage;
            },
            getPlayerShotScale: function () {
                return playerShotScale;
            },
            getRunUpgrades: function () {
                return runUpgrades;
            },
            getPlayerShotDelay: function () {
                return playerShotDelay;
            },
            getNow: function () {
                return new Date().getTime();
            },
            getNowValue: function () {
                return now;
            },
            setNowValue: function (value) {
                now = value;
            },
            getNextPlayerShot: function () {
                return nextPlayerShot;
            },
            setNextPlayerShot: function (value) {
                nextPlayerShot = value;
            },
            getKeyPressed: function () {
                return keyPressed;
            },
            getCanvasWidth: function () {
                return canvas.width;
            },
            onKillPlayer: function () {
                if (damageSystem) {
                    damageSystem.killPlayer();
                }
            }
        }) : null;

        if (!playerEntityFactory) {
            throw new Error('FlubberPlayerEntity module is required to create player');
        }

        enemyEntityFactory = window.FlubberEnemyEntity ? window.FlubberEnemyEntity.create({
            getCanvasWidth: function () {
                return canvas.width;
            },
            getCanvasHeight: function () {
                return canvas.height;
            },
            getRandomNumber: getRandomNumber,
            getImageDimension: getImageDimension,
            getMinHorizontalOffset: function () {
                return minHorizontalOffset;
            },
            getMaxHorizontalOffset: function () {
                return maxHorizontalOffset;
            },
            getDefaultEnemySpeed: function () {
                return defaultEnemySpeed;
            },
            getBossLevelOneConfig: function () {
                return bossLevelOneConfig;
            },
            getStageState: function () {
                return stageState;
            },
            getPlayer: function () {
                return player;
            },
            createEvilShot: function (x, y) {
                return shotEntities ? shotEntities.createEvilShot(x, y) : new EvilShot(x, y);
            }
        }) : null;

        if (!enemyEntityFactory) {
            throw new Error('FlubberEnemyEntity module is required to create enemies');
        }

        stageManager = window.FlubberStageManager ? window.FlubberStageManager.create({
            totalLevels: totalLevels,
            phasesPerLevel: phasesPerLevel,
            defaultEnemySpeed: defaultEnemySpeed,
            stageSummaryDuration: stageSummaryDuration,
            stageCountdownDuration: stageCountdownDuration,
            getNow: function () {
                return new Date().getTime();
            },
            getRandomInRange: getRandomInRange,
            getAliveEnemiesCount: getAliveEnemiesCount,
            hasAliveEnemies: function () {
                return getAliveEnemiesCount() > 0;
            },
            clearStageEntitiesContent: function () {
                for (var i = 0; i < activeEnemies.length; i++) {
                    if (activeEnemies[i] && activeEnemies[i].stopShooting) {
                        activeEnemies[i].stopShooting();
                    }
                }
                activeEnemies.splice(0, activeEnemies.length);
                evilShotsBuffer.splice(0, evilShotsBuffer.length);
                playerShotsBuffer.splice(0, playerShotsBuffer.length);
                resetBossMechanicState();
            },
            createEnemyByType: createEnemyByType,
            createBossByLevel: createBossByLevel,
            addActiveEnemy: function (enemy) {
                activeEnemies.push(enemy);
            },
            onFinalVictory: function () {
                saveFinalScore();
                congratulations = true;
            },
            initialState: {
                currentLevel: currentLevel,
                currentPhase: currentPhase,
                currentStageType: currentStageType,
                stageState: stageState,
                stageMessage: stageMessage,
                stageTransitionUntil: stageTransitionUntil
            }
        }) : null;

        if (!stageManager) {
            throw new Error('FlubberStageManager module is required to manage stages');
        }

        syncStageStateFromManager();

        damageSystem = window.FlubberDamageSystem ? window.FlubberDamageSystem.create({
            getNow: function () {
                return new Date().getTime();
            },
            getRunUpgrades: function () {
                return runUpgrades;
            },
            clearActiveShots: function () {
                evilShotsBuffer.splice(0, evilShotsBuffer.length);
                playerShotsBuffer.splice(0, playerShotsBuffer.length);
            },
            resetPlayerPosition: resetPlayerPosition,
            getPlayerSpeed: function () {
                return playerSpeed;
            },
            resetShotTimers: function () {
                nextPlayerShot = 0;
                now = 0;
            },
            clearStageEntities: clearStageEntities,
            onGameOver: function () {
                saveFinalScore();
                youLoose = true;
            }
        }) : null;

        addListener(document, 'keydown', keyDown);
        addListener(document, 'keyup', keyUp);

        function anim () {
            loop();
            requestAnimFrame(anim);
        }
        anim();

        preloadImages(function () {
            resetRunUpgrades();
            refreshPlayerStats();
            player = new Player(playerLife, 0);
            if (damageSystem) {
                damageSystem.bindPlayer(player);
                damageSystem.reset();
            }
            applyDebugRewardsForTest();
            assetsReady = true;
            stageManager.startCountdown('Nivel ' + currentLevel + ' - Fase ' + currentPhase);
            syncStageStateFromManager();
            showLifeAndScore();
        });
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
        if (!stageManager) {
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
            return;
        }

        stageManager.applyDebugStartConfig(debugStartConfig);
        syncStageStateFromManager();
        if (!debugStartConfig || !debugStartConfig.enabled) {
            debugHitboxes = false;
            return;
        }
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
        stageManager.setRewardPending('Elige una recompensa');
        syncStageStateFromManager();
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
        stageManager.completeStageClear();
        syncStageStateFromManager();
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

    function shouldOpenRewardSelector() {
        return stageManager.shouldOpenRewardSelector();
    }

    function getGlobalPhaseIndex(level, phase) {
        var safeLevel = Math.max(1, parseInt(level, 10) || 1);
        var safePhase = Math.max(1, parseInt(phase, 10) || 1);
        return ((safeLevel - 1) * phasesPerLevel) + safePhase;
    }

    function getEnemyTypeBaseScore(enemyType) {
        var enemyTypeBase = scoreSystem.enemyTypeBase || {};
        if (typeof enemyTypeBase[enemyType] === 'number') {
            return enemyTypeBase[enemyType];
        }
        if (typeof enemyTypeBase[enemyType + ''] === 'number') {
            return enemyTypeBase[enemyType + ''];
        }
        var fallbackByType = {
            1: 6,
            2: 8,
            3: 10,
            4: 12,
            5: 14
        };
        return fallbackByType[enemyType] || fallbackByType[1];
    }

    function getBossBaseScore() {
        if (typeof scoreSystem.bossBase === 'number') {
            return scoreSystem.bossBase;
        }
        return 24;
    }

    function getPhaseScoreMultiplier(globalPhaseIndex) {
        var multipliers = scoreSystem.phaseMultiplierByGlobalPhase || [];
        if (!multipliers.length) {
            return 1;
        }
        var safeIndex = Math.max(1, parseInt(globalPhaseIndex, 10) || 1);
        var listIndex = Math.min(multipliers.length, safeIndex) - 1;
        var multiplier = multipliers[listIndex];
        return typeof multiplier === 'number' ? multiplier : 1;
    }

    function getScoreToAward(enemy) {
        if (!enemy) {
            return 0;
        }
        var baseScore = typeof enemy.scoreBase === 'number' ? enemy.scoreBase : (enemy.pointsToKill || 0);
        var phaseIndex = typeof enemy.scorePhaseIndex === 'number' ? enemy.scorePhaseIndex : getGlobalPhaseIndex(currentLevel, currentPhase);
        var phaseMultiplier = getPhaseScoreMultiplier(phaseIndex);
        var upgradeMultiplier = playerScoreMultiplier || 1;
        return Math.max(1, Math.round(baseScore * phaseMultiplier * upgradeMultiplier));
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
        stageManager.clearStageEntities();
        syncStageStateFromManager();
    }

    function resetBossMechanicState() {
        bossMechanicState.nextBombSpawnAt = 0;
        bossMechanicState.nextReinforcementSpawnAt = 0;
    }

    function getActiveLevelOneBoss() {
        for (var i = 0; i < activeEnemies.length; i++) {
            var enemy = activeEnemies[i];
            if (!enemy || enemy.dead) {
                continue;
            }
            if (isLevelOneBossEnemy(enemy)) {
                return enemy;
            }
        }
        return null;
    }

    function countAliveBossBombs() {
        var bombs = 0;
        for (var i = 0; i < activeEnemies.length; i++) {
            if (activeEnemies[i] && !activeEnemies[i].dead && activeEnemies[i].isBossBomb) {
                bombs++;
            }
        }
        return bombs;
    }

    function countAliveBossReinforcements() {
        var reinforcements = 0;
        for (var i = 0; i < activeEnemies.length; i++) {
            if (activeEnemies[i] && !activeEnemies[i].dead && activeEnemies[i].isBossReinforcement) {
                reinforcements++;
            }
        }
        return reinforcements;
    }

    function spawnBombBurstTowardsPlayer(sourceEnemy) {
        if (!sourceEnemy || sourceEnemy.dead || !player || player.dead) {
            return;
        }

        var shotCount = Math.max(3, bossLevelOneConfig.bombBurstShotCount || 3);
        var spread = bossLevelOneConfig.bombFanSpreadRadians || 0.64;
        var centerX = sourceEnemy.posX + (sourceEnemy.spriteWidth / 2) - 5;
        var centerY = sourceEnemy.posY + sourceEnemy.spriteHeight;
        var targetX = player.posX + (player.width / 2);
        var targetY = player.posY + (player.height / 2);
        var angleToPlayer = Math.atan2(targetY - centerY, targetX - centerX);
        var speed = Math.max(2.4, bossLevelOneConfig.bombProjectileSpeed || 3.4);
        var step = shotCount > 1 ? spread / (shotCount - 1) : 0;
        var start = angleToPlayer - (spread / 2);

        for (var i = 0; i < shotCount; i++) {
            var angle = start + (step * i);
            var shot = shotEntities ? shotEntities.createEvilShot(centerX, centerY) : new EvilShot(centerX, centerY);
            shot.vx = Math.cos(angle) * speed;
            shot.vy = Math.max(1.2, Math.sin(angle) * speed);
            shot.add();
        }
    }

    function createBossBomb() {
        var bombImage = evilImages.animation[6] || evilImages.animation[0];
        var spriteWidth = getImageDimension(bombImage, 40);
        var spriteHeight = getImageDimension(bombImage, 40);
        var maxY = Math.max(36, Math.floor(canvas.height / 2) - spriteHeight);
        var minY = Math.max(12, bossLevelOneConfig.bombMinY || 36);
        var maxX = Math.max(1, canvas.width - spriteWidth);

        var bomb = {
            isBossBomb: true,
            enemyType: 4,
            bossLevel: 0,
            image: bombImage,
            spriteWidth: spriteWidth,
            spriteHeight: spriteHeight,
            posX: getRandomNumber(maxX),
            posY: getRandomInRange(minY, Math.max(minY, maxY)),
            life: Math.max(1, bossLevelOneConfig.bombLife || 2),
            dead: false,
            pointsToKill: Math.max(1, bossLevelOneConfig.bombScoreBase || 9),
            scoreBase: Math.max(1, bossLevelOneConfig.bombScoreBase || 9),
            scorePhaseIndex: getGlobalPhaseIndex(currentLevel, currentPhase),
            update: function () {},
            isOutOfScreen: function () {
                return false;
            },
            stopShooting: function () {},
            kill: function () {
                if (bomb.dead) {
                    return;
                }
                spawnBombBurstTowardsPlayer(bomb);
                bomb.dead = true;
            }
        };

        return bomb;
    }

    function spawnBossReinforcementTypeOne() {
        var enemyType = enemyTypeConfigs[1] || { spriteIndex: 0, lifeBonus: 0, shotsBonus: 0, speedBonus: 0 };
        var baseLife = activeStageConfig ? activeStageConfig.enemyLife : 2;
        var baseShots = activeStageConfig ? activeStageConfig.enemyShots : 2;
        var baseSpeed = activeStageConfig ? activeStageConfig.enemySpeed : 1.1;

        var reinforcement = enemyEntityFactory.createEvil(
            baseLife + (enemyType.lifeBonus || 0) + (bossLevelOneConfig.reinforcementLifeBonus || 0),
            baseShots + (enemyType.shotsBonus || 0) + (bossLevelOneConfig.reinforcementShotsBonus || 0),
            baseSpeed + (enemyType.speedBonus || 0) + (bossLevelOneConfig.reinforcementSpeedBonus || 0),
            enemyType.spriteIndex || 0,
            1,
            evilImages
        );
        reinforcement.isBossReinforcement = true;
        reinforcement.scoreBase = getEnemyTypeBaseScore(1);
        reinforcement.scorePhaseIndex = getGlobalPhaseIndex(currentLevel, currentPhase);
        reinforcement.pointsToKill = reinforcement.scoreBase;
        activeEnemies.push(reinforcement);
    }

    function updateBossMechanics() {
        var boss = getActiveLevelOneBoss();
        if (!boss || !boss.bossCombat || stageState !== 'playing') {
            return;
        }

        var nowTime = new Date().getTime();

        if (boss.bossCombat.firstWeaponDestroyedTriggered && nowTime >= bossMechanicState.nextBombSpawnAt) {
            if (countAliveBossBombs() < Math.max(1, bossLevelOneConfig.bombMaxActive || 3)) {
                activeEnemies.push(createBossBomb());
            }
            bossMechanicState.nextBombSpawnAt = nowTime + Math.max(600, bossLevelOneConfig.bombSpawnIntervalMs || 2200);
        }

        if (boss.bossCombat.secondWeaponDestroyedTriggered && nowTime >= bossMechanicState.nextReinforcementSpawnAt) {
            if (countAliveBossReinforcements() < Math.max(1, bossLevelOneConfig.reinforcementMaxAlive || 3)) {
                spawnBossReinforcementTypeOne();
            }
            bossMechanicState.nextReinforcementSpawnAt = nowTime + Math.max(900, bossLevelOneConfig.reinforcementIntervalMs || 3200);
        }
    }

    function onBossWeaponDestroyed(boss) {
        if (!boss || !boss.bossCombat) {
            return;
        }

        var aliveCount = getAliveBossWeaponsCount(boss);
        if (!boss.bossCombat.firstWeaponDestroyedTriggered && aliveCount <= 3) {
            boss.bossCombat.firstWeaponDestroyedTriggered = true;
            bossMechanicState.nextBombSpawnAt = new Date().getTime() + Math.max(350, Math.floor((bossLevelOneConfig.bombSpawnIntervalMs || 2200) * 0.5));
        }

        if (!boss.bossCombat.secondWeaponDestroyedTriggered && aliveCount <= 2) {
            boss.bossCombat.secondWeaponDestroyedTriggered = true;
            bossMechanicState.nextReinforcementSpawnAt = new Date().getTime() + Math.max(500, Math.floor((bossLevelOneConfig.reinforcementIntervalMs || 3200) * 0.55));
        }
    }

    function clearThreatsAfterBossDefeat() {
        for (var i = 0; i < activeEnemies.length; i++) {
            if (activeEnemies[i] && activeEnemies[i].stopShooting) {
                activeEnemies[i].stopShooting();
            }
            if (activeEnemies[i]) {
                activeEnemies[i].dead = true;
            }
        }
        activeEnemies.splice(0, activeEnemies.length);
        evilShotsBuffer.splice(0, evilShotsBuffer.length);
        resetBossMechanicState();
    }

    function createEnemyByType(stageConfig) {
        var selectedType = pickRandomFrom(stageConfig.enemyTypePool);
        var enemyType = enemyTypeConfigs[selectedType] || enemyTypeConfigs[1];
        var life = stageConfig.enemyLife + enemyType.lifeBonus;
        var shots = stageConfig.enemyShots + enemyType.shotsBonus;
        var speed = stageConfig.enemySpeed + enemyType.speedBonus;
        var enemy = enemyEntityFactory.createEvil(life, shots, speed, enemyType.spriteIndex, selectedType, evilImages);
        enemy.scoreBase = getEnemyTypeBaseScore(selectedType);
        enemy.scorePhaseIndex = getGlobalPhaseIndex(currentLevel, currentPhase);
        enemy.pointsToKill = enemy.scoreBase;
        return enemy;
    }

    function createBossByLevel(stageConfig, levelOverride) {
        var bossLevel = typeof levelOverride === 'number' ? levelOverride : currentLevel;
        var bossConfig = bossByLevel[bossLevel] || bossByLevel[1];
        if (bossLevel === 1) {
            resetBossMechanicState();
        }
        var boss = enemyEntityFactory.createFinalBoss(
            stageConfig.bossLife + bossConfig.lifeBonus,
            stageConfig.bossShots + bossConfig.shotsBonus,
            stageConfig.bossSpeed + bossConfig.speedBonus,
            bossConfig.spriteIndex,
            bossLevel,
            bossImages
        );
        boss.scoreBase = getBossBaseScore();
        boss.scorePhaseIndex = getGlobalPhaseIndex(currentLevel, currentPhase);
        boss.pointsToKill = boss.scoreBase;
        return boss;
    }

    function handleStageCleared() {
        if (shouldOpenRewardSelector()) {
            openRewardSelector();
            return;
        }
        stageManager.completeStageClear();
        syncStageStateFromManager();
    }

    function isBossWarningMessage() {
        if (currentStageType !== 'boss' || !stageMessage) {
            return false;
        }
        return stageMessage.toLowerCase().indexOf('ahi viene el jefe') !== -1;
    }

    function getBossWarningZoomScale() {
        var pulse = Math.sin(new Date().getTime() / 180);
        return 1 + (pulse * 0.12);
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

        var messageY = overlayY + 86;
        if (isBossWarningMessage()) {
            var zoomScale = getBossWarningZoomScale();
            bufferctx.save();
            bufferctx.translate(centerX, messageY);
            bufferctx.scale(zoomScale, zoomScale);
            drawArcadeText(stageMessage.toUpperCase(), 0, 0, {
                color: '#fff3a3',
                font: "bold 22px 'Courier New', monospace",
                align: 'center',
                glowColor: arcadeTheme.accentBoss,
                glowBlur: 11,
                outlineColor: arcadeTheme.outline,
                outlineWidth: 3
            });
            bufferctx.restore();
        } else {
            drawArcadeText(stageMessage.toUpperCase(), centerX, messageY, {
                color: arcadeTheme.primaryText,
                font: "bold 20px 'Courier New', monospace",
                align: 'center',
                glowColor: accentColor,
                glowBlur: 8,
                outlineColor: arcadeTheme.outline,
                outlineWidth: 3
            });
        }

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
        return playerEntityFactory.createPlayer(life, score);
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
            return circleRectOverlap(getPlayerHitCircle(), getEnemyShotBounds(this));
        };
    }

    EvilShot.prototype = Object.create(Shot.prototype);
    EvilShot.prototype.constructor = EvilShot;
    /******************************* FIN DISPAROS ********************************/


    /******************************* ENEMIGOS *******************************/
    // Enemy, Evil and FinalBoss now live in js/enemy-entity.js.
    /******************************* FIN ENEMIGOS *******************************/

    function isEnemyHittingPlayer(enemy) {
        if (isLevelOneBossEnemy(enemy)) {
            var weaponBounds = getBossWeaponBounds(enemy);
            var playerHitCircle = getPlayerHitCircle();
            for (var i = 0; i < weaponBounds.length; i++) {
                if (circleRectOverlap(playerHitCircle, weaponBounds[i])) {
                    return true;
                }
            }
            return false;
        }
        return circleRectOverlap(getPlayerHitCircle(), getEnemyBounds(enemy));
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
        var shotBounds = getPlayerShotBounds(shot);
        for (var i = 0; i < activeEnemies.length; i++) {
            var enemy = activeEnemies[i];
            if (enemy.dead) {
                continue;
            }

            var bossWeaponHit = null;
            if (isLevelOneBossEnemy(enemy)) {
                bossWeaponHit = getBossWeaponHit(enemy, shotBounds);
                if (!bossWeaponHit) {
                    continue;
                }
            } else if (!rectsOverlap(shotBounds, getEnemyBounds(enemy))) {
                continue;
            }

            if (!enemy.dead) {
                var damage = shot.damage || playerShotDamage || 1;
                if (bossWeaponHit) {
                    var weapon = enemy.bossCombat.weapons[bossWeaponHit.index];
                    if (weapon && !weapon.destroyed) {
                        weapon.life -= damage;
                        if (weapon.life <= 0) {
                            weapon.destroyed = true;
                            player.score += Math.max(1, bossLevelOneConfig.weaponBonusScore || 8);
                            onBossWeaponDestroyed(enemy);
                        }
                    }
                    enemy.life = getAliveBossWeaponsCount(enemy);
                } else {
                    enemy.life -= damage;
                }

                if (runUpgrades.slowStacks > 0) {
                    enemy.slowUntil = new Date().getTime() + 2500;
                }

                if (enemy.life <= 0) {
                    enemy.kill();
                    player.score += getScoreToAward(enemy);
                    if (isLevelOneBossEnemy(enemy)) {
                        clearThreatsAfterBossDefeat();
                    }
                }

                if ((shot.remainingBounces || 0) > 0) {
                    shot.remainingBounces = 0;
                    shot.isHoming = false;
                    shot.vy = -Math.max(2, shot.speed * 0.75);
                    shot.vx = getBounceHorizontalSpeed(shot, enemy);
                    shot.posX = enemy.posX + (enemy.spriteWidth / 2);
                    shot.posY = enemy.posY - shotBounds.height - 2;
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

        playerDamageAppliedThisFrame = false;

        syncStageStateFromManager();

        if (damageSystem) {
            damageSystem.update(new Date().getTime());
        }

        if (!assetsReady) {
            drawLoadingScreen();
            return;
        }

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
            stageManager.processTransitionTick(new Date().getTime());
            syncStageStateFromManager();
            return;
        }

        bufferctx.drawImage(player.dead ? playerKilledImage : player, player.posX, player.posY);
        for (var e = 0; e < activeEnemies.length; e++) {
            var enemy = activeEnemies[e];
            if (enemy && !enemy.dead) {
                bufferctx.drawImage(enemy.image, Math.round(enemy.posX), Math.round(enemy.posY));
            }
        }

        updateEnemies();

        updateBossMechanics();

        shotRuntime.updatePlayerShots();

        if (!player.dead && isAnyEnemyHittingPlayer()) {
            handlePlayerDamageOncePerFrame('contact');
        }

        shotRuntime.updateEnemyShots();

        if (debugHitboxes) {
            drawDebugHitboxes();
        }

        if (stageManager.isStageCleared()) {
            handleStageCleared();
            return;
        }

        showLifeAndScore();

        playerAction();
    }

    function drawBackground() {
        var background = currentStageType === 'boss' ? bgBoss : bgMain;
        bufferctx.drawImage(background, 0, 0);
    }

    function updateEnemies() {
        for (var i = activeEnemies.length - 1; i >= 0; i--) {
            var enemy = activeEnemies[i];
            if (!enemy || enemy.dead) {
                arrayRemove(activeEnemies, i);
                continue;
            }

            enemy.update();
            if (enemy.isOutOfScreen()) {
                enemy.kill();
                arrayRemove(activeEnemies, i);
            }
        }
    }

    function steerPlayerShot(playerShot) {
        var target = getNearestEnemyToShot(playerShot);
        if (!target) {
            return;
        }
        var targetCenter = typeof target.targetX === 'number' ? target.targetX : (target.posX + (target.spriteWidth / 2));
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

            var enemyCenter = enemy.posX + (enemy.spriteWidth / 2);
            var enemyTop = enemy.posY;
            if (isLevelOneBossEnemy(enemy)) {
                var weaponBounds = getBossWeaponBounds(enemy);
                if (!weaponBounds.length) {
                    continue;
                }

                for (var w = 0; w < weaponBounds.length; w++) {
                    var weaponCenterX = weaponBounds[w].left + (weaponBounds[w].width / 2);
                    var weaponTop = weaponBounds[w].top;
                    var weaponDistance = Math.abs(weaponCenterX - playerShot.posX) + Math.max(0, playerShot.posY - weaponTop);
                    if (nearestDistance === null || weaponDistance < nearestDistance) {
                        nearestDistance = weaponDistance;
                        nearestEnemy = {
                            enemy: enemy,
                            targetX: weaponCenterX,
                            targetY: weaponTop
                        };
                    }
                }
                continue;
            }

            var distance = Math.abs(enemyCenter - playerShot.posX) + Math.max(0, playerShot.posY - enemyTop);
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
            var enemyCenter = enemy.posX + (enemy.spriteWidth / 2);
            var distance = Math.abs(enemyCenter - playerShot.posX);
            if (nearestDistance === null || distance < nearestDistance) {
                nearestDistance = distance;
                nearestEnemy = enemy;
            }
        }

        var horizontalSpeed = Math.max(1.5, playerShot.speed * 0.65);
        if (nearestEnemy) {
            return (nearestEnemy.posX + (nearestEnemy.spriteWidth / 2)) >= playerShot.posX ? horizontalSpeed : -horizontalSpeed;
        }
        return getRandomNumber(2) === 0 ? -horizontalSpeed : horizontalSpeed;
    }

    function handlePlayerDamage(source) {
        if (damageSystem) {
            damageSystem.handleDamage(source);
        }
    }

    function handlePlayerDamageOncePerFrame(source) {
        if (playerDamageAppliedThisFrame) {
            return false;
        }
        playerDamageAppliedThisFrame = true;
        handlePlayerDamage(source);
        return true;
    }

    /******************************* MEJORES PUNTUACIONES (LOCALSTORAGE) *******************************/
    function saveFinalScore() {
        localStorage.setItem(scoreStoragePrefix + getFinalScoreDate(), getTotalScore());
        showBestScores();
        removeNoBestScores();
    }

    function isLegacyScoreKey(key) {
        return /^\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}:\d{2}$/.test(key || '');
    }

    function isV2ScoreKey(key) {
        return typeof key === 'string' && key.indexOf(scoreStoragePrefix) === 0;
    }

    function getScoreLabelFromKey(key) {
        if (isV2ScoreKey(key)) {
            return key.substring(scoreStoragePrefix.length);
        }
        return key;
    }

    function migrateScoreRankingIfNeeded() {
        if (!window.localStorage) {
            return;
        }

        if (localStorage.getItem(scoreSchemaStorageKey) === 'v2') {
            return;
        }

        var keysToRemove = [];
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (isLegacyScoreKey(key) || isV2ScoreKey(key)) {
                keysToRemove.push(key);
            }
        }

        for (var j = 0; j < keysToRemove.length; j++) {
            localStorage.removeItem(keysToRemove[j]);
        }

        localStorage.setItem(scoreSchemaStorageKey, 'v2');
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
        var allScoreEntries = getAllScoreEntries();
        allScoreEntries.sort(function (a, b) { return b.score - a.score; });
        allScoreEntries = allScoreEntries.slice(0, totalBestScoresToShow);
        var bestScoreKeys = [];
        for (var j = 0; j < allScoreEntries.length; j++) {
            bestScoreKeys.push(allScoreEntries[j].key);
        }
        return bestScoreKeys.slice(0, totalBestScoresToShow);
    }

    function getAllScoreEntries() {
        var allEntries = [];
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (!isV2ScoreKey(key)) {
                continue;
            }
            var scoreValue = parseInt(localStorage.getItem(key), 10);
            if (!isNaN(scoreValue)) {
                allEntries.push({
                    key: key,
                    score: scoreValue
                });
            }
        }
        return allEntries;
    }

    function getAllScores() {
        var all = [];
        var entries = getAllScoreEntries();
        for (var i = 0; i < entries.length; i++) {
            all.push(entries[i].score);
        }
        return all;
    }

    function showBestScores() {
        var bestScores = getBestScoreKeys();
        var bestScoresList = document.getElementById('puntuaciones');
        if (bestScoresList) {
            clearList(bestScoresList);
            for (var i=0; i < bestScores.length; i++) {
                addListElement(bestScoresList, getScoreLabelFromKey(bestScores[i]), i==0?'negrita':null);
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
            if (isV2ScoreKey(key) && !bestScoreKeys.containsElement(key)) {
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