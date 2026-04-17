window.FlubberPlayerEntity = (function () {
    function create(options) {
        options = options || {};

        function createPlayer(life, score) {
            var player = options.getPlayerSpriteImage();
            options.resetPlayerPosition(player);
            player.life = life;
            player.score = score;
            player.dead = false;
            player.speed = options.getPlayerSpeed();
            player.invulnerableUntil = 0;

            function shoot() {
                var now = options.getNowValue();
                var nextPlayerShot = options.getNextPlayerShot();
                if (nextPlayerShot < now || now === 0) {
                    var shot = options.createPlayerShot(player.posX + (player.width / 2) - 5, player.posY);
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