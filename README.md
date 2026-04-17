# Flubber

Juego arcade en JavaScript + Canvas con arquitectura modular sin bundler.

## Ejecutar

1. Abre `Proyecto/naves.html` en el navegador.
2. El juego inicia automáticamente en `game.init()`.

## Controles

- Flecha izquierda: mover a la izquierda
- Flecha derecha: mover a la derecha
- Espacio: disparar

## Arquitectura Actual

La entrada principal sigue siendo `Proyecto/js/videojuego-javascript.js`, pero la lógica crítica está desacoplada en módulos globales `window.*`.

### Módulos

- `Proyecto/js/config.js`: configuración de gameplay, niveles, enemigos, recompensas y teclas.
- `Proyecto/js/collision.js`: utilidades de colisiones (rect/rect, circle/rect, bounds).
- `Proyecto/js/damage-system.js`: daño, invulnerabilidad, respawn y game over.
- `Proyecto/js/shot-entities.js`: fábricas de proyectiles (jugador/enemigo).
- `Proyecto/js/shot-runtime.js`: update/render de proyectiles y colisión proyectil-jugador.
- `Proyecto/js/player-entity.js`: creación y comportamiento del jugador (movimiento/disparo).
- `Proyecto/js/enemy-entity.js`: creación y comportamiento de enemigos y jefe final.
- `Proyecto/js/stage-manager.js`: progresión de etapas, spawns, transiciones y cierre de fase/nivel.
- `Proyecto/js/videojuego-javascript.js`: orquestación del loop, render principal, HUD, rewards y wiring de módulos.

### Orden de Carga de Scripts

En `Proyecto/naves.html` los scripts se cargan en este orden:

1. `config.js`
2. `collision.js`
3. `damage-system.js`
4. `shot-entities.js`
5. `shot-runtime.js`
6. `player-entity.js`
7. `enemy-entity.js`
8. `stage-manager.js`
9. `videojuego-javascript.js`

## Checklist de Regresión Recomendado

- Fase normal completa con transición `summary -> countdown -> playing`.
- Recompensa en fase normal par: seleccionar y continuar sin quedar en menú.
- Jefe intermedio con recompensa y continuidad de progreso.
- Jefe final: victoria total sin selector de recompensa.
- Colisión con 1 vida (proyectil y contacto directo) sin congelamientos.
- Recompensa `+1 vida` y pérdida posterior sin freeze.

## Notas de Mantenimiento

- El proyecto usa JS estilo ES5 e IIFE globales para mantener compatibilidad sin pipeline de build.
- Si se agrega un nuevo módulo, debe insertarse en `Proyecto/naves.html` antes de `videojuego-javascript.js`.