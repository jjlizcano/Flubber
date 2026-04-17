window.FlubberStageManager = (function () {
    function create(options) {
        options = options || {};

        var initialState = options.initialState || {};

        var state = {
            currentLevel: initialState.currentLevel || 1,
            currentPhase: initialState.currentPhase || 1,
            currentStageType: initialState.currentStageType || 'normal',
            stageState: initialState.stageState || 'countdown',
            stageMessage: initialState.stageMessage || '',
            stageTransitionUntil: initialState.stageTransitionUntil || 0,
            activeStageConfig: null,
            pendingStageSpawns: 0,
            spawnedStageEnemies: 0,
            stageSpawnTimeout: null
        };

        var totalLevels = options.totalLevels || 2;
        var phasesPerLevel = options.phasesPerLevel || 10;
        var defaultEnemySpeed = options.defaultEnemySpeed || 1;
        var stageSummaryDuration = options.stageSummaryDuration || 2000;
        var stageCountdownDuration = options.stageCountdownDuration || 3000;

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

        function getCurrentStageConfig() {
            var isBossStage = state.currentStageType === 'boss';
            var enemyCount = getEnemyCountForPhase(state.currentLevel, state.currentPhase);
            var baseEnemyLife = 2 + (state.currentLevel - 1) + Math.floor((state.currentPhase - 1) / 2);
            var baseEnemyShots = 3 + state.currentLevel + Math.floor((state.currentPhase - 1) / 2);
            var baseEnemySpeed = defaultEnemySpeed + ((state.currentLevel - 1) * 0.22) + ((state.currentPhase - 1) * 0.05);

            var enemyTypePool = getEnemyTypePool(state.currentLevel, state.currentPhase);
            var maxConcurrent = getMaxConcurrentForStage(state.currentLevel, state.currentPhase);
            var spawnDelay = getSpawnDelayForLevel(state.currentLevel);

            return {
                type: state.currentStageType,
                enemyCount: isBossStage ? 1 : enemyCount,
                enemyLife: baseEnemyLife,
                enemyShots: baseEnemyShots,
                enemySpeed: baseEnemySpeed,
                enemyPoints: 4 + state.currentLevel + state.currentPhase + Math.floor((state.currentPhase - 1) / 2),
                enemyTypePool: enemyTypePool,
                maxConcurrent: isBossStage ? 1 : maxConcurrent,
                spawnDelayMin: isBossStage ? 0 : spawnDelay.min,
                spawnDelayMax: isBossStage ? 0 : spawnDelay.max,
                bossLife: 10 + (state.currentLevel * 4),
                bossShots: 20 + (state.currentLevel * 8),
                bossSpeed: 0.8 + (state.currentLevel * 0.1),
                bossPoints: 40 + (state.currentLevel * 10)
            };
        }

        function clearStageSpawnScheduler() {
            if (state.stageSpawnTimeout) {
                clearTimeout(state.stageSpawnTimeout);
                state.stageSpawnTimeout = null;
            }
        }

        function clearStageEntities() {
            clearStageSpawnScheduler();
            if (typeof options.clearStageEntitiesContent === 'function') {
                options.clearStageEntitiesContent();
            }
            state.pendingStageSpawns = 0;
            state.spawnedStageEnemies = 0;
        }

        function startSummary(message) {
            state.stageState = 'summary';
            state.stageMessage = message;
            state.stageTransitionUntil = options.getNow() + stageSummaryDuration;
            clearStageEntities();
        }

        function startCountdown(message) {
            state.stageState = 'countdown';
            state.stageMessage = message;
            state.stageTransitionUntil = options.getNow() + stageCountdownDuration;
            clearStageEntities();
        }

        function scheduleNextEnemyWave(stageConfig, forceDelay) {
            clearStageSpawnScheduler();
            var delay = typeof forceDelay === 'number' ? forceDelay :
                options.getRandomInRange(stageConfig.spawnDelayMin, stageConfig.spawnDelayMax);
            state.stageSpawnTimeout = setTimeout(function () {
                state.stageSpawnTimeout = null;
                spawnNextEnemyWave(stageConfig);
            }, delay);
        }

        function spawnNextEnemyWave(stageConfig) {
            if (state.stageState !== 'playing' || state.pendingStageSpawns <= 0) {
                clearStageSpawnScheduler();
                return;
            }

            if (options.getAliveEnemiesCount() >= stageConfig.maxConcurrent) {
                scheduleNextEnemyWave(stageConfig, 250);
                return;
            }

            var enemy = options.createEnemyByType(stageConfig);
            options.addActiveEnemy(enemy);
            state.pendingStageSpawns--;
            state.spawnedStageEnemies++;

            if (state.pendingStageSpawns > 0) {
                scheduleNextEnemyWave(stageConfig);
            } else {
                clearStageSpawnScheduler();
            }
        }

        function spawnStageEnemies(stageConfig) {
            clearStageSpawnScheduler();
            state.pendingStageSpawns = stageConfig.enemyCount;
            state.spawnedStageEnemies = 0;

            if (stageConfig.type === 'boss') {
                var bossEnemy = options.createBossByLevel(stageConfig, state.currentLevel);
                options.addActiveEnemy(bossEnemy);
                state.pendingStageSpawns = 0;
                state.spawnedStageEnemies = 1;
                return;
            }

            spawnNextEnemyWave(stageConfig);
        }

        function startCurrentStage() {
            state.activeStageConfig = getCurrentStageConfig();
            state.stageState = 'playing';
            state.stageMessage = '';
            spawnStageEnemies(state.activeStageConfig);
        }

        function isStageCleared() {
            if (state.pendingStageSpawns > 0 || state.stageSpawnTimeout) {
                return false;
            }
            return !options.hasAliveEnemies() && state.spawnedStageEnemies > 0;
        }

        function shouldOpenRewardSelector() {
            if (state.currentStageType === 'boss') {
                if (state.currentLevel === totalLevels) {
                    return false;
                }
                return true;
            }
            return state.currentStageType === 'normal' && state.currentPhase % 2 === 0;
        }

        function completeStageClear() {
            if (state.currentStageType === 'boss') {
                if (state.currentLevel === totalLevels) {
                    if (typeof options.onFinalVictory === 'function') {
                        options.onFinalVictory();
                    }
                    clearStageEntities();
                    return;
                }
                state.currentLevel++;
                state.currentPhase = 1;
                state.currentStageType = 'normal';
                startSummary('Nivel completado. Preparando Nivel ' + state.currentLevel);
                return;
            }

            if (state.currentPhase === phasesPerLevel) {
                state.currentStageType = 'boss';
                startSummary('Fase ' + phasesPerLevel + ' completada. Se acerca el jefe');
                return;
            }

            state.currentPhase++;
            startSummary('Fase completada. Preparando Fase ' + state.currentPhase);
        }

        function setRewardPending(message) {
            state.stageState = 'reward_pending';
            state.stageMessage = message || 'Elige una recompensa';
            state.stageTransitionUntil = 0;
        }

        function applyDebugStartConfig(config) {
            if (!config || !config.enabled) {
                state.currentLevel = 1;
                state.currentPhase = 1;
                state.currentStageType = 'normal';
                return;
            }

            state.currentLevel = Math.min(totalLevels, Math.max(1, parseInt(config.level, 10) || 1));
            state.currentPhase = Math.min(phasesPerLevel, Math.max(1, parseInt(config.phase, 10) || 1));
            state.currentStageType = config.stageType === 'boss' ? 'boss' : 'normal';
        }

        function processTransitionTick(now) {
            if (state.stageState === 'summary' && now >= state.stageTransitionUntil) {
                startCountdown('Preparate para la siguiente etapa');
                return true;
            }

            if (state.stageState === 'countdown' && now >= state.stageTransitionUntil) {
                startCurrentStage();
                return true;
            }

            return false;
        }

        function getState() {
            return {
                currentLevel: state.currentLevel,
                currentPhase: state.currentPhase,
                currentStageType: state.currentStageType,
                stageState: state.stageState,
                stageMessage: state.stageMessage,
                stageTransitionUntil: state.stageTransitionUntil,
                activeStageConfig: state.activeStageConfig,
                pendingStageSpawns: state.pendingStageSpawns,
                spawnedStageEnemies: state.spawnedStageEnemies,
                stageSpawnTimeout: state.stageSpawnTimeout
            };
        }

        return {
            getState: getState,
            getCurrentStageConfig: getCurrentStageConfig,
            clearStageSpawnScheduler: clearStageSpawnScheduler,
            clearStageEntities: clearStageEntities,
            startSummary: startSummary,
            startCountdown: startCountdown,
            startCurrentStage: startCurrentStage,
            spawnStageEnemies: spawnStageEnemies,
            spawnNextEnemyWave: spawnNextEnemyWave,
            scheduleNextEnemyWave: scheduleNextEnemyWave,
            isStageCleared: isStageCleared,
            shouldOpenRewardSelector: shouldOpenRewardSelector,
            completeStageClear: completeStageClear,
            setRewardPending: setRewardPending,
            applyDebugStartConfig: applyDebugStartConfig,
            processTransitionTick: processTransitionTick
        };
    }

    return {
        create: create
    };
})();
