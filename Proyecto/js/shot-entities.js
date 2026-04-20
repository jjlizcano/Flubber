window.FlubberShotEntities = (function () {
    function create(options) {
        options = options || {};

        function getArrayRemove() {
            return options.arrayRemove || function () {};
        }

        function createBaseShot(x, y, getBuffer, getImage, getSpeed) {
            return {
                posX: x,
                posY: y,
                image: getImage(),
                speed: getSpeed(),
                identifier: 0,
                add: function () {
                    getBuffer().push(this);
                },
                deleteShot: function (identifier) {
                    getArrayRemove()(getBuffer(), identifier);
                }
            };
        }

        function createPlayerShot(x, y) {
            return createBaseShot(
                x,
                y,
                options.getPlayerShotsBuffer,
                options.getPlayerShotImage,
                options.getShotSpeed
            );
        }

        function createEvilShot(x, y) {
            var shot = createBaseShot(
                x,
                y,
                options.getEvilShotsBuffer,
                options.getEvilShotImage,
                options.getShotSpeed
            );

            shot.isHittingPlayer = function () {
                return options.circleRectOverlap(options.getPlayerHitCircle(), options.getEnemyShotBounds(shot));
            };

            return shot;
        }

        return {
            createPlayerShot: createPlayerShot,
            createEvilShot: createEvilShot
        };
    }

    return {
        create: create
    };
})();