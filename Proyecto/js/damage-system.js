window.FlubberDamageSystem = (function () {
    function create(options) {
        options = options || {};

        var player = null;
        var respawnAt = 0;
        var gameOver = false;

        function getNow() {
            if (typeof options.getNow === 'function') {
                return options.getNow();
            }
            return new Date().getTime();
        }

        function getRunUpgrades() {
            return typeof options.getRunUpgrades === 'function' ? options.getRunUpgrades() : null;
        }

        function clearActiveShots() {
            if (typeof options.clearActiveShots === 'function') {
                options.clearActiveShots();
            }
        }

        function resetShotTimers() {
            if (typeof options.resetShotTimers === 'function') {
                options.resetShotTimers();
            }
        }

        function bindPlayer(nextPlayer) {
            player = nextPlayer;
        }

        function reset() {
            respawnAt = 0;
            gameOver = false;
        }

        function revivePlayer() {
            if (!player || gameOver) {
                return;
            }
            if (typeof options.resetPlayerPosition === 'function') {
                options.resetPlayerPosition(player);
            }
            player.dead = false;
            player.speed = typeof options.getPlayerSpeed === 'function' ? options.getPlayerSpeed() : player.speed;
            player.invulnerableUntil = getNow() + 350;
            resetShotTimers();
            respawnAt = 0;
        }

        function killPlayer() {
            if (!player || gameOver) {
                return;
            }

            if (player.life > 1) {
                player.dead = true;
                player.life -= 1;
                respawnAt = getNow() + 500;
                return;
            }

            player.dead = true;
            respawnAt = 0;
            resetShotTimers();

            if (typeof options.onGameOver === 'function') {
                options.onGameOver();
            }

            if (typeof options.clearStageEntities === 'function') {
                options.clearStageEntities();
            }

            gameOver = true;
        }

        function handleDamage(source) {
            if (!player || gameOver) {
                return;
            }

            var now = getNow();
            var damageSource = source === true ? 'projectile' : (source === false ? 'contact' : source);

            if (player.invulnerableUntil && now < player.invulnerableUntil) {
                return;
            }

            var runUpgrades = getRunUpgrades();
            if (damageSource === 'projectile' && runUpgrades && runUpgrades.dodgeTaken) {
                runUpgrades.dodgeTaken = false;
                player.invulnerableUntil = now + 800;
                return;
            }

            if (runUpgrades && runUpgrades.shieldStacks > 0) {
                runUpgrades.shieldStacks--;
                player.invulnerableUntil = now + 800;
                return;
            }

            player.invulnerableUntil = now + 800;
            killPlayer();
        }

        function update(currentTime) {
            if (!gameOver && player && player.dead && respawnAt && currentTime >= respawnAt) {
                revivePlayer();
            }
        }

        function isGameOver() {
            return gameOver;
        }

        return {
            bindPlayer: bindPlayer,
            reset: reset,
            update: update,
            handleDamage: handleDamage,
            killPlayer: killPlayer,
            isGameOver: isGameOver
        };
    }

    return {
        create: create
    };
})();