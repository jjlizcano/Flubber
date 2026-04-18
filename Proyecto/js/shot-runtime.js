window.FlubberShotRuntime = (function () {
    function create(options) {
        options = options || {};

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
                playerShot.posX < (options.getCanvasWidth() + width);
        }

        function drawPlayerShot(playerShot) {
            var width = Math.max(10, Math.round(10 * (playerShot.scale || 1)));
            var height = Math.max(18, Math.round(20 * (playerShot.scale || 1)));
            options.getBufferContext().drawImage(playerShot.image, playerShot.posX - (width / 2), playerShot.posY, width, height);
        }

        function updatePlayerShot(playerShot, id) {
            if (!playerShot) {
                return;
            }

            playerShot.identifier = id;
            if (playerShot.isHoming && !(playerShot.vx || 0)) {
                options.steerPlayerShot(playerShot);
            }

            var collisionResult = options.checkCollisions(playerShot);
            if (collisionResult === true || collisionResult === 'keep') {
                if (isPlayerShotInBounds(playerShot)) {
                    movePlayerShot(playerShot);
                    drawPlayerShot(playerShot);
                } else {
                    playerShot.deleteShot(parseInt(playerShot.identifier, 10));
                }
            }
        }

        function updateEnemyShot(evilShot, id) {
            if (!evilShot) {
                return;
            }

            evilShot.identifier = id;

            var player = options.getPlayer();
            var isHittingPlayer = false;
            if (player && !player.dead) {
                if (typeof evilShot.isHittingPlayer === 'function') {
                    isHittingPlayer = evilShot.isHittingPlayer();
                } else {
                    isHittingPlayer = options.circleRectOverlap(options.getPlayerHitCircle(), options.getEnemyShotBounds(evilShot));
                }
            }
            if (isHittingPlayer) {
                evilShot.deleteShot(parseInt(evilShot.identifier, 10));
                options.handlePlayerDamage('projectile');
                return;
            }

            var vx = typeof evilShot.vx === 'number' ? evilShot.vx : 0;
            var vy = typeof evilShot.vy === 'number' ? evilShot.vy : evilShot.speed;
            if (evilShot.isBossDiagonalShot) {
                var projectedX = evilShot.posX + vx;
                var minX = 0;
                var maxX = options.getCanvasWidth() - 10;
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
            if (evilShot.posY <= options.getCanvasHeight() && evilShot.posX >= -40 && evilShot.posX <= (options.getCanvasWidth() + 40)) {
                options.getBufferContext().drawImage(evilShot.image, evilShot.posX, evilShot.posY);
            } else {
                evilShot.deleteShot(parseInt(evilShot.identifier, 10));
            }
        }

        function updatePlayerShots() {
            var playerShotsBuffer = options.getPlayerShotsBuffer();
            for (var i = playerShotsBuffer.length - 1; i >= 0; i--) {
                updatePlayerShot(playerShotsBuffer[i], i);
            }
        }

        function updateEnemyShots() {
            var evilShotsBuffer = options.getEvilShotsBuffer();
            for (var i = evilShotsBuffer.length - 1; i >= 0; i--) {
                updateEnemyShot(evilShotsBuffer[i], i);
            }
        }

        return {
            updatePlayerShots: updatePlayerShots,
            updateEnemyShots: updateEnemyShots
        };
    }

    return {
        create: create
    };
})();
