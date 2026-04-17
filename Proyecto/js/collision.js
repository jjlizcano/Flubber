window.FlubberCollisionSystem = (function () {
    function getRectBounds(x, y, width, height) {
        return {
            left: x,
            top: y,
            right: x + width,
            bottom: y + height,
            width: width,
            height: height
        };
    }

    function rectsOverlap(firstRect, secondRect) {
        return firstRect.left < secondRect.right &&
            firstRect.right > secondRect.left &&
            firstRect.top < secondRect.bottom &&
            firstRect.bottom > secondRect.top;
    }

    function circleRectOverlap(circle, rect) {
        var closestX = Math.max(rect.left, Math.min(circle.x, rect.right));
        var closestY = Math.max(rect.top, Math.min(circle.y, rect.bottom));
        var deltaX = circle.x - closestX;
        var deltaY = circle.y - closestY;
        return (deltaX * deltaX) + (deltaY * deltaY) <= (circle.radius * circle.radius);
    }

    function getPlayerHitCircle(player, playerSpriteImage) {
        var width = player && player.width ? player.width : ((playerSpriteImage && playerSpriteImage.width) || 52);
        var height = player && player.height ? player.height : 66;
        var radius = Math.max(12, Math.round(Math.min(width, height) * 0.28));

        return {
            x: (player ? player.posX : 0) + (width / 2),
            y: (player ? player.posY : 0) + Math.round(height * 0.44),
            radius: radius
        };
    }

    function getPlayerBounds(player, playerSpriteImage) {
        var circle = getPlayerHitCircle(player, playerSpriteImage);
        return getRectBounds(circle.x - circle.radius, circle.y - circle.radius, circle.radius * 2, circle.radius * 2);
    }

    function getEnemyBounds(enemy) {
        return getRectBounds(
            enemy.posX,
            enemy.posY,
            enemy.spriteWidth || ((enemy.image && enemy.image.width) || 40),
            enemy.spriteHeight || ((enemy.image && enemy.image.height) || 40)
        );
    }

    function getPlayerShotBounds(shot) {
        var width = Math.max(10, Math.round(10 * (shot.scale || 1)));
        var height = Math.max(18, Math.round(20 * (shot.scale || 1)));
        return getRectBounds(shot.posX - (width / 2), shot.posY, width, height);
    }

    function getEnemyShotBounds(shot) {
        return getRectBounds(shot.posX, shot.posY, 10, 20);
    }

    return {
        getRectBounds: getRectBounds,
        rectsOverlap: rectsOverlap,
        circleRectOverlap: circleRectOverlap,
        getPlayerHitCircle: getPlayerHitCircle,
        getPlayerBounds: getPlayerBounds,
        getEnemyBounds: getEnemyBounds,
        getPlayerShotBounds: getPlayerShotBounds,
        getEnemyShotBounds: getEnemyShotBounds
    };
})();