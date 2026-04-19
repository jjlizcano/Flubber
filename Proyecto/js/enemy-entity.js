window.FlubberEnemyEntity = (function () {
    function create(options) {
        options = options || {};

        function getBossLevelOneConfig() {
            return options.getBossLevelOneConfig ? options.getBossLevelOneConfig() : {};
        }

        function getRandomInRange(min, max) {
            if (typeof min !== 'number' || typeof max !== 'number') {
                return 1000;
            }
            if (max <= min) {
                return min;
            }
            return min + options.getRandomNumber((max - min) + 1);
        }

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

        function createEnemy(life, shots, enemyImages, spriteIndex) {
            var canvasWidth = options.getCanvasWidth();
            var canvasHeight = options.getCanvasHeight();
            var getRandomNumber = options.getRandomNumber;
            var getImageDimension = options.getImageDimension;
            var minHorizontalOffset = options.getMinHorizontalOffset();
            var maxHorizontalOffset = options.getMaxHorizontalOffset();

            var enemy = {
                fixedSpriteIndex: typeof spriteIndex === 'number' ? spriteIndex : null,
                imageNumber: 1,
                animation: 0,
                customAnimationFrames: null,
                customAnimationFrameIndex: 0,
                deathAnimationFrames: null,
                deathAnimationFrameIndex: 0,
                deathAnimationCompleted: false,
                deathFadeAlpha: 1,
                deathFadeStep: 0.06,
                deathFadeDelayCounter: 8,
                shouldDisappear: false,
                renderAngle: 0,
                deathRenderAngle: 0,
                posY: -50,
                life: life,
                speed: options.getDefaultEnemySpeed(),
                shots: shots,
                dead: false,
                shotTimeoutId: null,
                slowUntil: 0,
                zigzagMotion: false,
                zigzagDirection: 1,
                zigzagHorizontalSpeed: 0,
                zigzagVerticalSpeed: 0,
                circularMotion: false,
                circularAngle: 0,
                circularRadiusX: 0,
                circularRadiusY: 0,
                circularCenterX: 0,
                circularCenterY: 0,
                circularOrbitSpeed: 0,
                circularVerticalDrift: 0,
                hunterMotion: false,
                hunterState: 'enter',
                hunterEntryTargetY: 80,
                hunterChargeUntil: 0,
                hunterChargeCenterX: 0,
                hunterChargePhase: 0,
                hunterChargeAmplitude: 26,
                hunterDashStartX: 0,
                hunterDashStartY: 0,
                hunterDashTargetX: 0,
                hunterDashTargetY: 0,
                hunterDashSpeed: 5,
                hunterReturnSpeed: 3.2,
                hunterZigzagUntil: 0,
                hunterBurstShotsRemaining: 0,
                hunterNextBurstAt: 0,
                hunterDashesCompleted: 0,
                hunterMinDashesBeforeDescent: 4,
                hunterForcedDescent: false,
                hunterNextVolleyAt: 0,
                hunterVolleyDelay: 280,
                strikeMotion: false,
                strikePhase: 0,
                strikeDirection: 1,
                strikePhaseUntil: 0,
                strikeHorizontalSpeed: 0,
                strikeVerticalSpeed: 0,
                strikeHorizontalDuration: 0,
                strikeVerticalDuration: 0,
                strikeForceVerticalNearPlayer: false,
                sentinelMotion: false,
                sentinelState: 'enter',
                sentinelEnterTargetY: 90,
                sentinelHoldUntil: 0,
                sentinelDiagonalUntil: 0,
                sentinelDiagDirX: 1,
                sentinelHorizontalSpeed: 0,
                sentinelVerticalSpeed: 0,
                sentinelStaticDuration: 850,
                sentinelDiagonalDuration: 1400,
                sentinelFanShots: 5,
                sentinelFanSpread: 1.7,
                enemyType: 1,
                pointsToKill: 5,
                isBossLevelOne: false,
                bossCombat: null
            };

            enemy.image = enemyImages.animation[enemy.fixedSpriteIndex !== null ? enemy.fixedSpriteIndex : 0];
            if (enemy.fixedSpriteIndex === 0 && enemyImages.type1Idle && enemyImages.type1Idle.length) {
                enemy.customAnimationFrames = enemyImages.type1Idle;
                enemy.customAnimationFrameIndex = 0;
                enemy.image = enemy.customAnimationFrames[0];
            }
            enemy.spriteWidth = getImageDimension(enemy.image, 40);
            enemy.spriteHeight = getImageDimension(enemy.image, 40);
            enemy.posX = getRandomNumber(Math.max(1, canvasWidth - enemy.spriteWidth));

            var displacement = minHorizontalOffset + getRandomNumber(maxHorizontalOffset - minHorizontalOffset);
            var maxTravel = Math.max(minHorizontalOffset, Math.min(displacement, canvasWidth - enemy.spriteWidth));
            var maxStartX = Math.max(1, canvasWidth - enemy.spriteWidth - maxTravel);
            enemy.minX = getRandomNumber(maxStartX);
            enemy.maxX = enemy.minX + maxTravel;
            enemy.direction = 'D';

            function fireVerticalShot() {
                if (enemy.dead || options.getStageState() !== 'playing') {
                    return;
                }

                var centerX = enemy.posX + (enemy.spriteWidth / 2) - 5;
                var baseY = enemy.posY + enemy.spriteHeight;
                var shot = options.createEvilShot(centerX, baseY);
                shot.vx = 0;
                shot.add();
            }

            function fireDoubleVerticalShot() {
                if (enemy.dead || options.getStageState() !== 'playing') {
                    return;
                }

                var centerX = enemy.posX + (enemy.spriteWidth / 2) - 5;
                var baseY = enemy.posY + enemy.spriteHeight;

                var leftShot = options.createEvilShot(centerX - 8, baseY);
                leftShot.vx = 0;
                leftShot.vy = leftShot.speed;
                leftShot.add();

                var rightShot = options.createEvilShot(centerX + 8, baseY);
                rightShot.vx = 0;
                rightShot.vy = rightShot.speed;
                rightShot.add();
            }

            function updateHunterMovement(movementSpeed, speedMultiplier) {
                var nowTime = new Date().getTime();
                var appliedMultiplier = typeof speedMultiplier === 'number' ? speedMultiplier : 1;

                var lowerThirdStartY = canvasHeight * (2 / 3);
                var canForceDescent = enemy.hunterDashesCompleted >= (enemy.hunterMinDashesBeforeDescent || 0);
                if (!enemy.hunterForcedDescent && enemy.posY >= lowerThirdStartY && canForceDescent) {
                    enemy.hunterForcedDescent = true;
                    enemy.hunterState = 'descent';
                    enemy.hunterNextVolleyAt = nowTime;
                }

                if (enemy.hunterForcedDescent) {
                    enemy.posY += Math.max(0.9, movementSpeed);
                    if (nowTime >= enemy.hunterNextVolleyAt) {
                        fireDoubleVerticalShot();
                        enemy.hunterNextVolleyAt = nowTime + (enemy.hunterVolleyDelay || 280);
                    }
                    return;
                }

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
                    } else if (enemy.posX > (canvasWidth - enemy.spriteWidth)) {
                        enemy.posX = canvasWidth - enemy.spriteWidth;
                    }
                    if (nowTime >= enemy.hunterChargeUntil) {
                        var player = options.getPlayer();
                        enemy.hunterDashStartX = enemy.posX;
                        enemy.hunterDashStartY = enemy.posY;
                        enemy.hunterDashTargetX = player ? player.posX + (player.width / 2) - (enemy.spriteWidth / 2) : enemy.posX;
                        enemy.hunterDashTargetY = player ? player.posY + (player.height / 2) - (enemy.spriteHeight / 2) : (enemy.posY + 120);
                        if (enemy.hunterDashTargetX < 0) {
                            enemy.hunterDashTargetX = 0;
                        } else if (enemy.hunterDashTargetX > (canvasWidth - enemy.spriteWidth)) {
                            enemy.hunterDashTargetX = canvasWidth - enemy.spriteWidth;
                        }
                        if (enemy.hunterDashTargetY < -enemy.spriteHeight) {
                            enemy.hunterDashTargetY = -enemy.spriteHeight;
                        }
                        enemy.hunterState = 'dash';
                    }
                    return;
                }

                if (enemy.hunterState === 'dash') {
                    var reachedTarget = moveTowards(
                        enemy,
                        enemy.hunterDashTargetX,
                        enemy.hunterDashTargetY,
                        Math.max(4.2 * appliedMultiplier, enemy.hunterDashSpeed * appliedMultiplier)
                    );
                    if (reachedTarget) {
                        enemy.hunterDashesCompleted = (enemy.hunterDashesCompleted || 0) + 1;
                        enemy.hunterState = 'return';
                    }
                    return;
                }

                if (enemy.hunterState === 'return') {
                    var returnedToOrigin = moveTowards(
                        enemy,
                        enemy.hunterDashStartX,
                        enemy.hunterDashStartY,
                        Math.max(2.6 * appliedMultiplier, enemy.hunterReturnSpeed * appliedMultiplier)
                    );
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
                    var horizontalSpeed = (enemy.zigzagHorizontalSpeed || Math.max(1.4, movementSpeed * 1.15)) * appliedMultiplier;
                    var verticalSpeed = (enemy.zigzagVerticalSpeed || Math.max(0.55, movementSpeed * 0.7)) * appliedMultiplier;
                    enemy.posY += verticalSpeed;
                    enemy.posX += (horizontalSpeed * enemy.zigzagDirection);
                    enemy.renderAngle = enemy.zigzagDirection > 0 ? -15 : 15;

                    if (enemy.posX <= 0) {
                        enemy.posX = 0;
                        enemy.zigzagDirection = 1;
                        enemy.renderAngle = -15;
                    } else if (enemy.posX >= (canvasWidth - enemy.spriteWidth)) {
                        enemy.posX = canvasWidth - enemy.spriteWidth;
                        enemy.zigzagDirection = -1;
                        enemy.renderAngle = 15;
                    }

                    if (enemy.hunterBurstShotsRemaining > 0 && nowTime >= enemy.hunterNextBurstAt) {
                        fireVerticalShot();
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

            function updateStrikeMovement(movementSpeed, speedMultiplier) {
                var nowTime = new Date().getTime();
                var appliedMultiplier = typeof speedMultiplier === 'number' ? speedMultiplier : 1;
                var horizontalSpeed = (enemy.strikeHorizontalSpeed || Math.max(1.4, movementSpeed * 1.35)) * appliedMultiplier;
                var verticalSpeed = (enemy.strikeVerticalSpeed || Math.max(0.7, movementSpeed * 0.95)) * appliedMultiplier;

                var player = options.getPlayer();
                var triggerY = player ? (player.posY - enemy.spriteHeight - 20) : canvasHeight;
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
                    } else if (enemy.posX >= (canvasWidth - enemy.spriteWidth)) {
                        enemy.posX = canvasWidth - enemy.spriteWidth;
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

            function fireFanBurst() {
                if (enemy.dead || options.getStageState() !== 'playing' || enemy.shots <= 0) {
                    return;
                }

                var totalShots = Math.max(3, enemy.sentinelFanShots || 5);
                var spread = enemy.sentinelFanSpread || 1.7;
                var step = totalShots > 1 ? (spread / (totalShots - 1)) : 0;
                var startAngle = -(spread / 2);
                var centerX = enemy.posX + (enemy.spriteWidth / 2) - 5;
                var baseY = enemy.posY + enemy.spriteHeight;

                for (var shotIndex = 0; shotIndex < totalShots; shotIndex++) {
                    var angle = startAngle + (step * shotIndex);
                    var fanShot = options.createEvilShot(centerX, baseY);
                    fanShot.vx = Math.sin(angle) * fanShot.speed * 0.45;
                    fanShot.vy = Math.max(1.8, Math.cos(angle) * fanShot.speed * 0.75);
                    fanShot.add();
                }

                enemy.shots--;
            }

            function updateSentinelMovement(movementSpeed, speedMultiplier) {
                var nowTime = new Date().getTime();
                var appliedMultiplier = typeof speedMultiplier === 'number' ? speedMultiplier : 1;
                var horizontalSpeed = (enemy.sentinelHorizontalSpeed || Math.max(1.7, movementSpeed * 1.45)) * appliedMultiplier;
                var verticalSpeed = (enemy.sentinelVerticalSpeed || Math.max(0.75, movementSpeed * 0.95)) * appliedMultiplier;

                var player = options.getPlayer();
                var triggerY = player ? (player.posY - enemy.spriteHeight - 20) : canvasHeight;
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
                    fireFanBurst();
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
                    } else if (enemy.posX >= (canvasWidth - enemy.spriteWidth)) {
                        enemy.posX = canvasWidth - enemy.spriteWidth;
                        enemy.sentinelDiagDirX = -1;
                    }

                    if (nowTime >= enemy.sentinelDiagonalUntil) {
                        enemy.sentinelState = 'static';
                        enemy.sentinelHoldUntil = nowTime + enemy.sentinelStaticDuration;
                    }
                }
            }

            function scheduleShoot() {
                enemy.shotTimeoutId = setTimeout(function () {
                    shoot();
                }, options.getRandomNumber(3000));
            }

            function getWeaponBounds(weapon) {
                return {
                    left: enemy.posX + weapon.offsetX,
                    top: enemy.posY + weapon.offsetY,
                    right: enemy.posX + weapon.offsetX + weapon.width,
                    bottom: enemy.posY + weapon.offsetY + weapon.height
                };
            }

            function createBossWeaponShot(originX, originY, vx, vy, diagonal) {
                var bossConfig = getBossLevelOneConfig();
                var shot = options.createEvilShot(originX, originY);
                shot.vx = vx;
                shot.vy = vy;
                if (diagonal) {
                    shot.isBossDiagonalShot = true;
                    shot.bounceCount = 0;
                    shot.maxBounces = Math.max(1, bossConfig.diagonalMaxBounces || 2);
                    shot.bounceAcceleration = bossConfig.diagonalBounceAcceleration || 1.15;
                    shot.maxSpeed = Math.max(4.5, bossConfig.diagonalMaxSpeed || 7.5);
                }
                shot.add();
            }

            function scheduleShoot(delay) {
                enemy.shotTimeoutId = setTimeout(function () {
                    shoot();
                }, delay);
            }

            function shootBossLevelOnePattern() {
                if (!enemy.isBossLevelOne || !enemy.bossCombat) {
                    return;
                }
                if (enemy.dead || options.getStageState() !== 'playing') {
                    return;
                }

                var bossConfig = getBossLevelOneConfig();
                var combat = enemy.bossCombat;
                var weapons = combat.weapons || [];
                if (!weapons.length) {
                    return;
                }

                var selectedWeaponIndex = -1;
                var sequenceStartIndex = combat.activeWeaponIndex % weapons.length;
                for (var weaponTry = 0; weaponTry < weapons.length; weaponTry++) {
                    var candidateWeaponIndex = (sequenceStartIndex + weaponTry) % weapons.length;
                    var candidateWeapon = weapons[candidateWeaponIndex];
                    if (candidateWeapon && !candidateWeapon.destroyed) {
                        selectedWeaponIndex = candidateWeaponIndex;
                        break;
                    }
                }

                if (selectedWeaponIndex === -1) {
                    return;
                }

                var baseSpeed = Math.max(2.2, bossConfig.projectileSpeed || 3.8);
                var spread = bossConfig.fanSpreadRadians || 0.52;
                var diagonalSpeed = baseSpeed * (bossConfig.diagonalSpeedFactor || 0.95);
                var selectedWeapon = weapons[selectedWeaponIndex];
                if (!selectedWeapon || selectedWeapon.destroyed) {
                    return;
                }

                var bounds = getWeaponBounds(selectedWeapon);
                var centerX = Math.round(bounds.left + ((bounds.right - bounds.left) / 2) - 5);
                var baseY = Math.round(bounds.bottom);

                createBossWeaponShot(centerX, baseY, 0, baseSpeed, false);
                createBossWeaponShot(centerX, baseY, -Math.sin(spread) * diagonalSpeed, Math.cos(spread) * diagonalSpeed, true);
                createBossWeaponShot(centerX, baseY, Math.sin(spread) * diagonalSpeed, Math.cos(spread) * diagonalSpeed, true);

                combat.activeWeaponIndex = (selectedWeaponIndex + 1) % weapons.length;

                if (!enemy.dead && options.getStageState() === 'playing') {
                    scheduleShoot(getRandomInRange(bossConfig.shootDelayMin || 800, bossConfig.shootDelayMax || 1300));
                }
            }

            function shoot() {
                if (enemy.isBossLevelOne) {
                    shootBossLevelOnePattern();
                    return;
                }
                if (enemy.enemyType === 3 || enemy.enemyType === 5) {
                    return;
                }
                if (!enemy.dead && options.getStageState() === 'playing') {
                    var centerX = enemy.posX + (enemy.spriteWidth / 2) - 5;
                    var baseY = enemy.posY + enemy.spriteHeight;
                    if (enemy.enemyType === 2) {
                        var leftShot = options.createEvilShot(centerX - 8, baseY);
                        leftShot.vx = -2.2;
                        leftShot.add();

                        var rightShot = options.createEvilShot(centerX + 8, baseY);
                        rightShot.vx = 2.2;
                        rightShot.add();
                    } else if (enemy.enemyType === 4) {
                        var zigzagShot = options.createEvilShot(centerX, baseY);
                        zigzagShot.vx = 0;
                        zigzagShot.waveMotion = true;
                        zigzagShot.waveBaseX = centerX;
                        zigzagShot.wavePhase = 0;
                        zigzagShot.waveAmplitude = 9;
                        zigzagShot.waveFrequency = 0.55;
                        zigzagShot.add();
                    } else {
                        var shot = options.createEvilShot(centerX, baseY);
                        shot.add();
                    }
                    scheduleShoot(options.getRandomNumber(3000));
                }
            }

            enemy.kill = function () {
                if (enemy.dead) {
                    return;
                }
                enemy.stopShooting();
                if (enemy.enemyType === 1) {
                    if (enemy.zigzagMotion && typeof enemy.zigzagDirection === 'number') {
                        enemy.deathRenderAngle = enemy.zigzagDirection > 0 ? -15 : 15;
                    } else if (enemy.direction === 'D') {
                        enemy.deathRenderAngle = -15;
                    } else if (enemy.direction === 'I') {
                        enemy.deathRenderAngle = 15;
                    } else {
                        enemy.deathRenderAngle = typeof enemy.renderAngle === 'number' ? enemy.renderAngle : 0;
                    }
                }
                enemy.dead = true;
                if (enemy.fixedSpriteIndex === 0 && enemyImages.type1Death && enemyImages.type1Death.length) {
                    enemy.customAnimationFrames = null;
                    enemy.deathAnimationFrames = enemyImages.type1Death;
                    enemy.deathAnimationFrameIndex = 0;
                    enemy.deathAnimationCompleted = false;
                    enemy.deathFadeAlpha = 1;
                    enemy.deathFadeDelayCounter = 8;
                    enemy.shouldDisappear = false;
                    enemy.image = enemy.deathAnimationFrames[0];
                    return;
                }
                enemy.image = enemyImages.killed;
            };

            enemy.updateDeathEffect = function () {
                if (!enemy.dead || enemy.shouldDisappear) {
                    return;
                }

                if (enemy.deathAnimationFrames && enemy.deathAnimationFrames.length && !enemy.deathAnimationCompleted) {
                    enemy.animation++;
                    if (enemy.animation > 4) {
                        enemy.animation = 0;
                        if (enemy.deathAnimationFrameIndex < (enemy.deathAnimationFrames.length - 1)) {
                            enemy.deathAnimationFrameIndex++;
                            enemy.image = enemy.deathAnimationFrames[enemy.deathAnimationFrameIndex];
                        } else {
                            enemy.deathAnimationCompleted = true;
                            enemy.image = enemy.deathAnimationFrames[enemy.deathAnimationFrames.length - 1];
                        }
                    }
                    return;
                }

                if (enemy.deathAnimationCompleted) {
                    if (enemy.deathFadeDelayCounter > 0) {
                        enemy.deathFadeDelayCounter--;
                        return;
                    }

                    enemy.deathFadeAlpha = Math.max(0, enemy.deathFadeAlpha - enemy.deathFadeStep);
                    if (enemy.deathFadeAlpha === 0) {
                        enemy.shouldDisappear = true;
                    }
                }
            };

            function updateEnemyFrame() {
                var animationLength = enemyImages.animation && enemyImages.animation.length ? enemyImages.animation.length : 8;

                if (enemy.customAnimationFrames && enemy.customAnimationFrames.length) {
                    enemy.customAnimationFrameIndex = (enemy.customAnimationFrameIndex + 1) % enemy.customAnimationFrames.length;
                    enemy.image = enemy.customAnimationFrames[enemy.customAnimationFrameIndex];
                    return;
                }

                if (enemy.fixedSpriteIndex === null) {
                    enemy.imageNumber++;
                    if (enemy.imageNumber > animationLength) {
                        enemy.imageNumber = 1;
                    }
                    enemy.image = enemyImages.animation[enemy.imageNumber - 1];
                } else {
                    enemy.image = enemyImages.animation[enemy.fixedSpriteIndex];
                }
            }

            enemy.update = function () {
                var movementSpeed = enemy.goDownSpeed;
                var speedMultiplier = 1;
                if (enemy.slowUntil && new Date().getTime() < enemy.slowUntil) {
                    speedMultiplier = 0.6;
                    movementSpeed = movementSpeed * speedMultiplier;
                }
                if (enemy.isBossLevelOne && enemy.bossCombat) {
                    var bossConfig = getBossLevelOneConfig();
                    if (enemy.posY < enemy.bossCombat.entryY) {
                        enemy.posY += Math.max(0.8, movementSpeed);
                        if (enemy.posY > enemy.bossCombat.entryY) {
                            enemy.posY = enemy.bossCombat.entryY;
                        }
                    } else {
                        var horizontalSpeed = Math.max(1.1, movementSpeed * (bossConfig.horizontalSpeedMultiplier || 1.15));
                        if (enemy.direction === 'D') {
                            enemy.posX += horizontalSpeed;
                            if (enemy.posX >= enemy.maxX) {
                                enemy.posX = enemy.maxX;
                                enemy.direction = 'I';
                            }
                        } else {
                            enemy.posX -= horizontalSpeed;
                            if (enemy.posX <= enemy.minX) {
                                enemy.posX = enemy.minX;
                                enemy.direction = 'D';
                            }
                        }
                    }
                    enemy.animation++;
                    if (enemy.animation > 5) {
                        enemy.animation = 0;
                        updateEnemyFrame();
                    }
                    return;
                }
                if (enemy.hunterMotion) {
                    updateHunterMovement(movementSpeed, speedMultiplier);
                } else if (enemy.strikeMotion) {
                    updateStrikeMovement(movementSpeed, speedMultiplier);
                } else if (enemy.sentinelMotion) {
                    updateSentinelMovement(movementSpeed, speedMultiplier);
                } else if (enemy.zigzagMotion) {
                    var horizontalSpeed = (enemy.zigzagHorizontalSpeed || Math.max(1.6, movementSpeed * 1.35)) * speedMultiplier;
                    var verticalSpeed = (enemy.zigzagVerticalSpeed || Math.max(0.75, movementSpeed * 0.9)) * speedMultiplier;
                    enemy.posY += verticalSpeed;
                    enemy.posX += (horizontalSpeed * enemy.zigzagDirection);

                    if (enemy.posX <= 0) {
                        enemy.posX = 0;
                        enemy.zigzagDirection = 1;
                    } else if (enemy.posX >= (canvasWidth - enemy.spriteWidth)) {
                        enemy.posX = canvasWidth - enemy.spriteWidth;
                        enemy.zigzagDirection = -1;
                    }
                } else if (enemy.circularMotion) {
                    var orbitSpeed = (enemy.circularOrbitSpeed || Math.max(0.03, movementSpeed * 0.04)) * speedMultiplier;
                    enemy.circularAngle += orbitSpeed;
                    enemy.circularCenterY += (enemy.circularVerticalDrift || Math.max(0.25, movementSpeed * 0.35)) * speedMultiplier;

                    enemy.posX = enemy.circularCenterX + Math.cos(enemy.circularAngle) * enemy.circularRadiusX - (enemy.spriteWidth / 2);
                    enemy.posY = enemy.circularCenterY + Math.sin(enemy.circularAngle) * enemy.circularRadiusY - (enemy.spriteHeight / 2);

                    if (enemy.posX < 0) {
                        enemy.posX = 0;
                    } else if (enemy.posX > (canvasWidth - enemy.spriteWidth)) {
                        enemy.posX = canvasWidth - enemy.spriteWidth;
                    }
                } else {
                    enemy.posY += movementSpeed;
                    if (enemy.direction === 'D') {
                        enemy.posX += movementSpeed;
                        if (enemy.enemyType === 1) {
                            enemy.renderAngle = -15;
                        }
                        if (enemy.posX >= enemy.maxX) {
                            enemy.posX = enemy.maxX;
                            enemy.direction = 'I';
                        }
                    } else {
                        enemy.posX -= movementSpeed;
                        if (enemy.enemyType === 1) {
                            enemy.renderAngle = 15;
                        }
                        if (enemy.posX <= enemy.minX) {
                            enemy.posX = enemy.minX;
                            enemy.direction = 'D';
                        }
                    }
                }
                enemy.animation++;
                if (enemy.animation > 5) {
                    enemy.animation = 0;
                    updateEnemyFrame();
                }
            };

            enemy.isOutOfScreen = function () {
                return enemy.posY > (canvasHeight + 15);
            };

            enemy.stopShooting = function () {
                if (enemy.shotTimeoutId) {
                    clearTimeout(enemy.shotTimeoutId);
                    enemy.shotTimeoutId = null;
                }
            };

            enemy.startShooting = function () {
                enemy.stopShooting();
                scheduleShoot(1000 + options.getRandomNumber(2500));
            };

            enemy.triggerShoot = function () {
                shoot();
            };

            enemy.toString = function () {
                return 'Enemy life:' + enemy.life + ' shots:' + enemy.shots + ' points:' + enemy.pointsToKill;
            };

            enemy.startShooting();

            return enemy;
        }

        function createEvil(life, shots, speed, spriteIndex, enemyType, evilImages) {
            var enemy = createEnemy(life, shots, evilImages, spriteIndex);
            var canvasWidth = options.getCanvasWidth();
            var getRandomNumber = options.getRandomNumber;

            enemy.speed = speed;
            enemy.goDownSpeed = speed;
            enemy.enemyType = enemyType || 1;
            enemy.pointsToKill = 5;

            if (enemy.enemyType === 1) {
                enemy.zigzagMotion = true;
                enemy.zigzagDirection = getRandomNumber(2) === 0 ? -1 : 1;
                enemy.zigzagHorizontalSpeed = Math.max(1.7, enemy.goDownSpeed * 1.4);
                enemy.zigzagVerticalSpeed = Math.max(0.8, enemy.goDownSpeed * 0.95);
                enemy.minX = 0;
                enemy.maxX = canvasWidth - enemy.spriteWidth;
                enemy.direction = enemy.zigzagDirection > 0 ? 'D' : 'I';
            } else if (enemy.enemyType === 2) {
                enemy.circularMotion = true;
                enemy.circularAngle = getRandomNumber(360) * (Math.PI / 180);
                enemy.circularRadiusX = 55 + getRandomNumber(40);
                enemy.circularRadiusY = 35 + getRandomNumber(25);
                enemy.circularOrbitSpeed = 0.03 + (enemy.goDownSpeed * 0.025);
                enemy.circularVerticalDrift = Math.max(0.25, enemy.goDownSpeed * 0.35);
                enemy.circularCenterX = enemy.spriteWidth + enemy.circularRadiusX +
                    getRandomNumber(Math.max(1, canvasWidth - (enemy.circularRadiusX * 2) - (enemy.spriteWidth * 2)));
                enemy.posY = -enemy.spriteHeight - getRandomNumber(60);
                enemy.circularCenterY = enemy.posY + (enemy.spriteHeight / 2) - (Math.sin(enemy.circularAngle) * enemy.circularRadiusY);
                enemy.posX = enemy.circularCenterX + Math.cos(enemy.circularAngle) * enemy.circularRadiusX - (enemy.spriteWidth / 2);
            } else if (enemy.enemyType === 3) {
                enemy.stopShooting();
                enemy.hunterMotion = true;
                enemy.hunterState = 'enter';
                enemy.hunterEntryTargetY = 70 + getRandomNumber(110);
                enemy.hunterChargeAmplitude = 20 + getRandomNumber(18);
                enemy.hunterDashSpeed = Math.max(4.2, enemy.goDownSpeed * 3.8);
                enemy.hunterReturnSpeed = Math.max(2.6, enemy.goDownSpeed * 2.4);
                enemy.zigzagHorizontalSpeed = Math.max(1.5, enemy.goDownSpeed * 1.2);
                enemy.zigzagVerticalSpeed = Math.max(0.6, enemy.goDownSpeed * 0.75);
                enemy.hunterDashesCompleted = 0;
                enemy.hunterMinDashesBeforeDescent = 4;
                enemy.hunterForcedDescent = false;
                enemy.hunterNextVolleyAt = 0;
                enemy.hunterVolleyDelay = 280;
                enemy.posX = getRandomNumber(Math.max(1, canvasWidth - enemy.spriteWidth));
                enemy.posY = -enemy.spriteHeight - getRandomNumber(80);
            } else if (enemy.enemyType === 4) {
                enemy.strikeMotion = true;
                enemy.strikePhase = 0;
                enemy.strikeDirection = getRandomNumber(2) === 0 ? -1 : 1;
                enemy.strikeHorizontalSpeed = Math.max(1.6, enemy.goDownSpeed * 1.4);
                enemy.strikeVerticalSpeed = Math.max(0.75, enemy.goDownSpeed);
                enemy.strikeHorizontalDuration = 1150 + getRandomNumber(420);
                enemy.strikeVerticalDuration = 420 + getRandomNumber(180);
                enemy.strikePhaseUntil = 0;
                enemy.strikeForceVerticalNearPlayer = false;
                enemy.posX = getRandomNumber(Math.max(1, canvasWidth - enemy.spriteWidth));
                enemy.posY = -enemy.spriteHeight - getRandomNumber(70);
            } else if (enemy.enemyType === 5) {
                enemy.stopShooting();
                enemy.sentinelMotion = true;
                enemy.sentinelState = 'enter';
                enemy.sentinelEnterTargetY = 75 + getRandomNumber(95);
                enemy.sentinelStaticDuration = 850 + getRandomNumber(250);
                enemy.sentinelDiagonalDuration = 1300 + getRandomNumber(400);
                enemy.sentinelHorizontalSpeed = Math.max(1.8, enemy.goDownSpeed * 1.55);
                enemy.sentinelVerticalSpeed = Math.max(0.75, enemy.goDownSpeed);
                enemy.sentinelFanShots = 5;
                enemy.sentinelFanSpread = 1.7;
                enemy.sentinelDiagDirX = getRandomNumber(2) === 0 ? -1 : 1;
                enemy.sentinelForceVerticalNearPlayer = false;
                enemy.posX = getRandomNumber(Math.max(1, canvasWidth - enemy.spriteWidth));
                enemy.posY = -enemy.spriteHeight - getRandomNumber(90);
            }

            return enemy;
        }

        function createFinalBoss(life, shots, speed, spriteIndex, bossLevel, bossImages) {
            var boss = createEnemy(life, shots, bossImages, spriteIndex);
            var bossLevelOneConfig = getBossLevelOneConfig();
            var canvasWidth = options.getCanvasWidth();
            boss.speed = speed;
            boss.goDownSpeed = speed / 2;
            boss.bossLevel = bossLevel || 1;
            boss.pointsToKill = 20;

            if (boss.bossLevel === 1) {
                var spriteWidth = boss.spriteWidth || 40;
                var spriteHeight = boss.spriteHeight || 40;
                var layout = bossLevelOneConfig.weaponLayout || [];
                var fallbackLayout = [
                    { id: 'weapon-1', xRatio: 0.12, yRatio: 0.2, widthRatio: 0.22, heightRatio: 0.23 },
                    { id: 'weapon-2', xRatio: 0.66, yRatio: 0.2, widthRatio: 0.22, heightRatio: 0.23 },
                    { id: 'weapon-3', xRatio: 0.18, yRatio: 0.55, widthRatio: 0.2, heightRatio: 0.24 },
                    { id: 'weapon-4', xRatio: 0.62, yRatio: 0.55, widthRatio: 0.2, heightRatio: 0.24 }
                ];
                var weaponLayout = layout.length ? layout : fallbackLayout;
                var weaponLife = Math.max(1, life / weaponLayout.length);
                var weapons = [];
                for (var i = 0; i < weaponLayout.length; i++) {
                    var weaponDef = weaponLayout[i];
                    weapons.push({
                        id: weaponDef.id || ('weapon-' + (i + 1)),
                        life: weaponLife,
                        maxLife: weaponLife,
                        unlocked: i < 2,
                        destroyed: false,
                        offsetX: Math.round(spriteWidth * weaponDef.xRatio),
                        offsetY: Math.round(spriteHeight * weaponDef.yRatio),
                        width: Math.max(10, Math.round(spriteWidth * weaponDef.widthRatio)),
                        height: Math.max(10, Math.round(spriteHeight * weaponDef.heightRatio))
                    });
                }

                var horizontalPadding = Math.max(6, bossLevelOneConfig.horizontalPadding || 18);
                var initialX = Math.max(horizontalPadding, (canvasWidth / 2) - (spriteWidth / 2));
                boss.minX = horizontalPadding;
                boss.maxX = Math.max(boss.minX + 20, canvasWidth - spriteWidth - horizontalPadding);
                boss.posX = Math.min(boss.maxX, initialX);
                boss.posY = -spriteHeight - 16;
                boss.direction = options.getRandomNumber(2) === 0 ? 'D' : 'I';
                boss.isBossLevelOne = true;
                boss.bossCombat = {
                    weapons: weapons,
                    activeWeaponIndex: 0,
                    entryY: Math.max(30, bossLevelOneConfig.entryY || 82),
                    secondaryWaveUnlocked: false,
                    firstWeaponDestroyedTriggered: false,
                    secondWeaponDestroyedTriggered: false
                };

                boss.stopShooting();
                boss.startShooting = function () {
                    boss.stopShooting();
                    var initialShootDelay = Math.max(250, bossLevelOneConfig.initialShootDelay || 1100);
                    boss.shotTimeoutId = setTimeout(function () {
                        boss.shotTimeoutId = null;
                        if (!boss.dead && options.getStageState() === 'playing' && typeof boss.triggerShoot === 'function') {
                            boss.triggerShoot();
                        }
                    }, initialShootDelay);
                };
                boss.startShooting();
            }

            return boss;
        }

        return {
            createEnemy: createEnemy,
            createEvil: createEvil,
            createFinalBoss: createFinalBoss
        };
    }

    return {
        create: create
    };
})();
