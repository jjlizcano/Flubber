window.FlubberPlayerEntity = (function () {
    function create(options) {
        options = options || {};

        function getNow(optionsRef) {
            if (typeof optionsRef.getNow === 'function') {
                return optionsRef.getNow();
            }
            return new Date().getTime();
        }

        function getPlayerAnimations(optionsRef) {
            if (typeof optionsRef.getPlayerAnimations === 'function') {
                return optionsRef.getPlayerAnimations();
            }
            return null;
        }

        function createPlayer(life, score) {
            var player = options.getPlayerSpriteImage();
            var playerAnimations = getPlayerAnimations(options);
            options.resetPlayerPosition(player);
            player.life = life;
            player.score = score;
            player.dead = false;
            player.speed = options.getPlayerSpeed();
            player.invulnerableUntil = 0;
            player.animationState = 'idle';
            player.animationStartedAt = getNow(options);

            player.updateAnimationState = function (nextState) {
                var normalizedState = nextState === 'left' || nextState === 'right' ? nextState : 'idle';
                if (player.animationState !== normalizedState) {
                    player.animationState = normalizedState;
                    player.animationStartedAt = getNow(options);
                }
            };

            player.getCurrentFrameImage = function () {
                if (player.dead || !playerAnimations) {
                    return player;
                }

                var frameCount = playerAnimations.frameCount || 16;
                var frameDurationMs = playerAnimations.frameDurationMs || (1000 / 16);
                var activeFrames = playerAnimations[player.animationState] || playerAnimations.idle || [];
                var fallbackIdleFrame = playerAnimations.idle && playerAnimations.idle[0];

                if (!activeFrames.length || frameCount < 1) {
                    return player;
                }

                var elapsedMs = getNow(options) - player.animationStartedAt;
                var frameIndex = Math.floor(elapsedMs / frameDurationMs) % frameCount;
                var frameImage = activeFrames[frameIndex] || fallbackIdleFrame || player;

                if (frameImage && frameImage.width) {
                    player.width = frameImage.width;
                    player.height = frameImage.height;
                }

                return frameImage;
            };

            function shoot() {
                var now = options.getNowValue();
                var nextPlayerShot = options.getNextPlayerShot();
                if (nextPlayerShot < now || now === 0) {
                    var shot = options.createPlayerShot(player.posX + (player.width / 2), player.posY);
                    shot.damage = options.getPlayerShotDamage();
                    shot.scale = options.getPlayerShotScale();
                    shot.remainingBounces = options.getRunUpgrades().bounceStacks;
                    shot.isHoming = options.getRunUpgrades().homingStacks > 0;
                    shot.vx = 0;
                    shot.vy = -shot.speed;
                    shot.add();
                    now += options.getPlayerShotDelay();
                    options.setNowValue(now);
                    options.setNextPlayerShot(now + options.getPlayerShotDelay());
                } else {
                    options.setNowValue(options.getNow());
                }
            }

            player.doAnything = function () {
                var initialPosX = player.posX;

                if (player.dead) {
                    return;
                }
                if (options.getKeyPressed().left && player.posX > 5) {
                    player.posX -= player.speed;
                }
                if (options.getKeyPressed().right && player.posX < (options.getCanvasWidth() - player.width - 5)) {
                    player.posX += player.speed;
                }
                if (options.getKeyPressed().fire) {
                    shoot();
                }

                var movedDelta = player.posX - initialPosX;
                if (movedDelta < 0) {
                    player.updateAnimationState('left');
                } else if (movedDelta > 0) {
                    player.updateAnimationState('right');
                } else {
                    player.updateAnimationState('idle');
                }
            };

            player.killPlayer = function () {
                if (typeof options.onKillPlayer === 'function') {
                    options.onKillPlayer();
                }
            };

            return player;
        }

        return {
            createPlayer: createPlayer
        };
    }

    return {
        create: create
    };
})();