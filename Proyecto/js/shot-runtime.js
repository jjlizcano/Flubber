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
            var isHittingPlayer = !player.dead && options.circleRectOverlap(options.getPlayerHitCircle(), options.getEnemyShotBounds(evilShot));
            if (isHittingPlayer) {
                evilShot.deleteShot(parseInt(evilShot.identifier, 10));
                options.handlePlayerDamage('projectile');
                return;
            }

            if (player.dead || !options.circleRectOverlap(options.getPlayerHitCircle(), options.getEnemyShotBounds(evilShot))) {
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
                if (evilShot.posY <= options.getCanvasHeight() && evilShot.posX >= -40 && evilShot.posX <= (options.getCanvasWidth() + 40)) {
                    options.getBufferContext().drawImage(evilShot.image, evilShot.posX, evilShot.posY);
                } else {
                    evilShot.deleteShot(parseInt(evilShot.identifier, 10));
                }
            }
        }

        function updatePlayerShots() {
            var playerShotsBuffer = options.getPlayerShotsBuffer();
            for (var i = 0; i < playerShotsBuffer.length; i++) {
                updatePlayerShot(playerShotsBuffer[i], i);
            }
        }

        function updateEnemyShots() {
            var evilShotsBuffer = options.getEvilShotsBuffer();
            for (var i = 0; i < evilShotsBuffer.length; i++) {
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
