window.FlubberCollisionSystem = (function () {
    var gameConfig = window.FlubberGameConfig || {};

    var defaultEnemyHitboxProfiles = {
        conservative: {
            1: { left: 0.19, top: 0.16, right: 0.19, bottom: 0.18 },
            2: { left: 0.17, top: 0.17, right: 0.17, bottom: 0.17 },
            3: { left: 0.24, top: 0.17, right: 0.24, bottom: 0.19 },
            4: { left: 0.24, top: 0.17, right: 0.24, bottom: 0.19 },
            5: { left: 0.15, top: 0.19, right: 0.15, bottom: 0.21 },
            boss: { left: 0.13, top: 0.15, right: 0.13, bottom: 0.17 }
        },
        balanced: {
            1: { left: 0.16, top: 0.12, right: 0.16, bottom: 0.14 },
            2: { left: 0.14, top: 0.14, right: 0.14, bottom: 0.14 },
            3: { left: 0.2, top: 0.14, right: 0.2, bottom: 0.16 },
            4: { left: 0.2, top: 0.14, right: 0.2, bottom: 0.16 },
            5: { left: 0.12, top: 0.16, right: 0.12, bottom: 0.18 },
            boss: { left: 0.1, top: 0.12, right: 0.1, bottom: 0.14 }
        },
        aggressive: {
            1: { left: 0.12, top: 0.09, right: 0.12, bottom: 0.11 },
            2: { left: 0.1, top: 0.1, right: 0.1, bottom: 0.1 },
            3: { left: 0.16, top: 0.11, right: 0.16, bottom: 0.13 },
            4: { left: 0.16, top: 0.11, right: 0.16, bottom: 0.13 },
            5: { left: 0.09, top: 0.12, right: 0.09, bottom: 0.14 },
            boss: { left: 0.07, top: 0.09, right: 0.07, bottom: 0.11 }
        }
    };

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
        var radius = Math.max(10, Math.round(Math.min(width, height) * 0.16));

        return {
            x: (player ? player.posX : 0) + (width / 2),
            y: (player ? player.posY : 0) + Math.round(height * 0.4),
            radius: radius
        };
    }

    function getPlayerBounds(player, playerSpriteImage) {
        var circle = getPlayerHitCircle(player, playerSpriteImage);
        return getRectBounds(circle.x - circle.radius, circle.y - circle.radius, circle.radius * 2, circle.radius * 2);
    }

    function normalizeHitboxProfileName(profileName) {
        var normalized = (profileName || '').toString().toLowerCase();
        if (!defaultEnemyHitboxProfiles[normalized]) {
            return 'balanced';
        }
        return normalized;
    }

    function getEnemyHitboxProfileName(enemy) {
        if (enemy && enemy.hitboxProfile) {
            return normalizeHitboxProfileName(enemy.hitboxProfile);
        }
        return normalizeHitboxProfileName(gameConfig.enemyHitboxProfile || 'balanced');
    }

    function buildInsetsRatios(baseInsets, overrideInsets) {
        return {
            left: typeof (overrideInsets && overrideInsets.left) === 'number' ? overrideInsets.left : baseInsets.left,
            top: typeof (overrideInsets && overrideInsets.top) === 'number' ? overrideInsets.top : baseInsets.top,
            right: typeof (overrideInsets && overrideInsets.right) === 'number' ? overrideInsets.right : baseInsets.right,
            bottom: typeof (overrideInsets && overrideInsets.bottom) === 'number' ? overrideInsets.bottom : baseInsets.bottom
        };
    }

    function getEnemyHitboxRatios(enemy) {
        var profileName = getEnemyHitboxProfileName(enemy);
        var defaultProfile = defaultEnemyHitboxProfiles[profileName] || defaultEnemyHitboxProfiles.balanced;
        var customProfiles = gameConfig.enemyHitboxProfiles || {};
        var customProfile = customProfiles[profileName] || {};
        var isBoss = enemy && typeof enemy.bossLevel === 'number';

        if (isBoss) {
            return buildInsetsRatios(defaultProfile.boss, customProfile.boss || null);
        }

        var enemyType = enemy && typeof enemy.enemyType === 'number' ? enemy.enemyType : 1;
        var typeKey = enemyType.toString();
        var baseInsets = defaultProfile[typeKey] || defaultProfile[1];
        var customInsets = customProfile[typeKey] || null;
        return buildInsetsRatios(baseInsets, customInsets);
    }

    function getEnemyHitboxInsets(enemy, width, height) {
        var ratios = getEnemyHitboxRatios(enemy);
        return {
            left: Math.round(width * ratios.left),
            top: Math.round(height * ratios.top),
            right: Math.round(width * ratios.right),
            bottom: Math.round(height * ratios.bottom)
        };
    }

    function getEnemyBounds(enemy) {
        var width = (enemy.image && enemy.image.width) || enemy.spriteWidth || 40;
        var height = (enemy.image && enemy.image.height) || enemy.spriteHeight || 40;
        var insets = getEnemyHitboxInsets(enemy, width, height);
        var hitboxWidth = Math.max(8, width - insets.left - insets.right);
        var hitboxHeight = Math.max(8, height - insets.top - insets.bottom);
        return getRectBounds(
            enemy.posX + insets.left,
            enemy.posY + insets.top,
            hitboxWidth,
            hitboxHeight
        );
    }

    function getBossWeaponBounds(enemy) {
        if (!enemy || !enemy.bossCombat || !enemy.bossCombat.weapons || !enemy.bossCombat.weapons.length) {
            return [];
        }

        var bossCfg = gameConfig.bossLevelOne || {};
        var defaultScale = typeof bossCfg.weaponHitboxScale === 'number' ? bossCfg.weaponHitboxScale : 1;
        var scaleX = typeof bossCfg.weaponHitboxScaleX === 'number' ? bossCfg.weaponHitboxScaleX : defaultScale;
        var scaleY = typeof bossCfg.weaponHitboxScaleY === 'number' ? bossCfg.weaponHitboxScaleY : defaultScale;
        var spriteWidth = (enemy.image && enemy.image.width) || enemy.spriteWidth || 40;
        var spriteHeight = (enemy.image && enemy.image.height) || enemy.spriteHeight || 40;

        var bounds = [];
        for (var i = 0; i < enemy.bossCombat.weapons.length; i++) {
            var weapon = enemy.bossCombat.weapons[i];
            if (!weapon || weapon.destroyed) {
                continue;
            }

            var offsetX = typeof weapon.offsetX === 'number' ? weapon.offsetX : 0;
            var offsetY = typeof weapon.offsetY === 'number' ? weapon.offsetY : 0;
            var width = typeof weapon.width === 'number' ? weapon.width : 10;
            var height = typeof weapon.height === 'number' ? weapon.height : 10;

            if (typeof weapon.xRatio === 'number') {
                offsetX = Math.round(spriteWidth * weapon.xRatio);
            }
            if (typeof weapon.yRatio === 'number') {
                offsetY = Math.round(spriteHeight * weapon.yRatio);
            }
            if (typeof weapon.widthRatio === 'number') {
                width = Math.max(10, Math.round(spriteWidth * weapon.widthRatio));
            }
            if (typeof weapon.heightRatio === 'number') {
                height = Math.max(10, Math.round(spriteHeight * weapon.heightRatio));
            }

            if (scaleX !== 1 || scaleY !== 1) {
                var centerX = offsetX + (width / 2);
                var centerY = offsetY + (height / 2);
                width = Math.max(6, Math.round(width * scaleX));
                height = Math.max(6, Math.round(height * scaleY));
                offsetX = Math.round(centerX - (width / 2));
                offsetY = Math.round(centerY - (height / 2));
            }

            bounds.push({
                id: weapon.id || ('weapon-' + i),
                index: i,
                left: enemy.posX + offsetX,
                top: enemy.posY + offsetY,
                right: enemy.posX + offsetX + width,
                bottom: enemy.posY + offsetY + height,
                width: width,
                height: height
            });
        }

        return bounds;
    }

    function getPlayerShotBounds(shot) {
        var width = Math.max(10, Math.round(10 * (shot.scale || 1)));
        var height = Math.max(18, Math.round(20 * (shot.scale || 1)));
        return getRectBounds(shot.posX - (width / 2), shot.posY, width, height);
    }

    function getEnemyShotBounds(shot) {
        var width = (shot && shot.image && shot.image.width) ? shot.image.width : 10;
        var height = (shot && shot.image && shot.image.height) ? shot.image.height : 10;
        var insetX = Math.max(1, Math.round(width * 0.1));
        var insetY = Math.max(1, Math.round(height * 0.1));
        var hitboxWidth = Math.max(4, width - (insetX * 2));
        var hitboxHeight = Math.max(8, height - (insetY * 2));
        return getRectBounds(
            shot.posX + insetX,
            shot.posY + insetY,
            hitboxWidth,
            hitboxHeight
        );
    }

    return {
        getRectBounds: getRectBounds,
        rectsOverlap: rectsOverlap,
        circleRectOverlap: circleRectOverlap,
        getPlayerHitCircle: getPlayerHitCircle,
        getPlayerBounds: getPlayerBounds,
        getEnemyBounds: getEnemyBounds,
        getBossWeaponBounds: getBossWeaponBounds,
        getPlayerShotBounds: getPlayerShotBounds,
        getEnemyShotBounds: getEnemyShotBounds
    };
})();