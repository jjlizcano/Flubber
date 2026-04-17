window.FlubberGameConfig = {
    defaultEnemySpeed: 1,
    totalLevels: 2,
    phasesPerLevel: 10,
    playerLife: 3,
    shotSpeed: 5,
    playerSpeed: 5,
    stageSummaryDuration: 2000,
    stageCountdownDuration: 3000,
    minHorizontalOffset: 100,
    maxHorizontalOffset: 400,
    totalBestScoresToShow: 5,
    enemyHitboxProfile: 'balanced',
    scoreSystem: {
        enemyTypeBase: {
            1: 6,
            2: 8,
            3: 10,
            4: 12,
            5: 14
        },
        bossBase: 24,
        phaseMultiplierByGlobalPhase: [
            1.00, 1.00, 1.10, 1.10, 1.20,
            1.20, 1.30, 1.30, 1.40, 1.40,
            1.55, 1.55, 1.70, 1.70, 1.85,
            1.85, 2.00, 2.00, 2.20, 2.20
        ]
    },
    arcadeTheme: {
        panelBg: 'rgba(25, 8, 32, 0.7)',
        panelStroke: 'rgba(255, 180, 0, 0.75)',
        primaryText: '#ffd447',
        secondaryText: '#ff9f1a',
        dangerText: '#ff4d5a',
        successText: '#ffe880',
        accentBoss: '#ff5470',
        glow: 'rgba(255, 140, 0, 0.85)',
        outline: '#2b122f',
        hudFont: "bold 14px 'Courier New', monospace",
        titleFont: "bold 28px 'Courier New', monospace",
        countdownFont: "bold 58px 'Courier New', monospace"
    },
    keyMap: {
        left: 37,
        right: 39,
        fire: 32
    },
    enemyTypeConfigs: {
        1: { spriteIndex: 0, lifeBonus: 0, shotsBonus: 0, speedBonus: 0.14, pointsBonus: 0 },
        2: { spriteIndex: 1, lifeBonus: 1, shotsBonus: 0, speedBonus: 0.10, pointsBonus: 1 },
        3: { spriteIndex: 2, lifeBonus: 2, shotsBonus: 1, speedBonus: 0.08, pointsBonus: 3 },
        4: { spriteIndex: 3, lifeBonus: 3, shotsBonus: 1, speedBonus: 0.05, pointsBonus: 5 },
        5: { spriteIndex: 4, lifeBonus: 4, shotsBonus: 1, speedBonus: 0.00, pointsBonus: 7 }
    },
    bossByLevel: {
        1: { spriteIndex: 0, lifeBonus: 0, shotsBonus: 0, speedBonus: 0.00, pointsBonus: 0 },
        2: { spriteIndex: 4, lifeBonus: 4, shotsBonus: 4, speedBonus: 0.10, pointsBonus: 15 }
    },
    rewardCatalog: {
        cadence: { id: 'cadence', name: 'Mas cadencia', description: 'Disparas mas rapido', maxStacks: 3, oneTime: false, rarity: 'common' },
        shield: { id: 'shield', name: 'Escudo', description: 'Absorbe un golpe', maxStacks: 3, oneTime: false, rarity: 'common' },
        bigBullets: { id: 'bigBullets', name: 'Balas grandes', description: 'Aumenta tamano y alcance', maxStacks: 2, oneTime: false, rarity: 'uncommon' },
        homing: { id: 'homing', name: 'Balas teledirigidas', description: 'Buscan enemigos cercanos', maxStacks: 1, oneTime: true, rarity: 'rare' },
        life: { id: 'life', name: '+1 vida', description: 'Ganas una vida extra', maxStacks: 1, oneTime: true, rarity: 'rare' },
        fogueo: { id: 'fogueo', name: 'Fogueo', description: 'Limpia balas enemigas periodicamente', maxStacks: 1, oneTime: true, rarity: 'rare' },
        bounce: { id: 'bounce', name: 'Balas con rebote', description: 'Rebota una vez entre objetivos', maxStacks: 1, oneTime: true, rarity: 'uncommon' },
        slow: { id: 'slow', name: 'Balas ralentizantes', description: 'Enemigos ralentizados al impactar', maxStacks: 2, oneTime: false, rarity: 'uncommon' },
        speed: { id: 'speed', name: 'Mas velocidad', description: 'Mueve mas rapido la nave', maxStacks: 2, oneTime: false, rarity: 'common' },
        points: { id: 'points', name: 'Multiplicador puntos', description: 'Mas puntos por enemigo', maxStacks: 2, oneTime: false, rarity: 'common' },
        dodge: { id: 'dodge', name: 'Esquivo', description: 'Evita 1 disparo enemigo', maxStacks: 1, oneTime: true, rarity: 'rare' },
        damage: { id: 'damage', name: 'Mas daño', description: 'Tus balas quitan mas vida', maxStacks: 2, oneTime: false, rarity: 'uncommon' }
    }
};