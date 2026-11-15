# Neon Breach: Fracture Ops — plan Android-first

## Alcance confirmado

La primera entrega se enfoca exclusivamente en Android en orientación horizontal (landscape). Será un vertical slice jugable de un battle royale original, no un producto AAA final: debe permitir entrar al campo, moverse, apuntar, disparar, cambiar armas, recoger loot, abrir cofres, construir, sobrevivir a una zona segura y luchar contra bots. PC, PlayStation y Xbox quedan fuera de esta versión; la arquitectura podrá retomarlos después si el APK resulta sólido.

Las funciones de cuenta Google/Facebook, multiplayer competitivo, leaderboard, pagos, anti-cheat productivo y recompensas sincronizadas se conservan como UI y arquitectura preparada hasta contar con backend verificado. El cliente no inspecciona procesos privados, no promete detección perfecta y no simula OAuth real.

## Dirección de producto

- Nombre: **NEON BREACH: FRACTURE OPS**.
- Fantasía: shooter sci-fi competitivo con lectura clara, movimiento ágil y decisiones de posicionamiento.
- Cámara: tercera persona por defecto; primera persona opcional desde un botón táctil.
- Plataforma inmediata: Android landscape, con touch multitáctil y soporte de APK debug para pruebas.
- Entrega prioritaria: gameplay real antes que paneles decorativos.

## Mecánicas prioritarias

1. **Movimiento móvil:** joystick izquierdo con radio y zona muerta configurables; joystick derecho de cámara independiente; sprint, salto, agacharse y deslizarse; aceleración y frenado suaves; protección contra diagonales demasiado rápidas y pérdida de input al cambiar de dedo.
2. **Loadout de cuatro espacios:** Arma 1, Arma 2, Pistola y Puño. El slot activo se ve en HUD, el cambio es instantáneo pero con microanimación, y cada arma tiene peso: Puño es el más rápido, pistola ligera, subfusil/rifle medio, escopeta/pesada más lenta. El servidor deberá validar el estado en producción.
3. **Combate:** apuntar, disparar, recargar, recoil, hitscan/proyectiles, daño, escudo, derribo/eliminación, indicador de impacto y feedback visual/audio.
4. **Loot:** objetos en suelo y cofres. Rarezas Común, Poco común, Rara, Legendaria, Mística y Especial. Los pesos 70/40/30/10/5/1 se normalizan a 44.87%, 25.64%, 19.23%, 6.41%, 3.21% y 0.64%.
5. **Construcción:** en la primera entrega, pared, piso y rampa; previsualización válida en verde y no válida en rojo; coste de metal, polímero y cristal; límites de distancia/altura y colisión segura.
6. **Supervivencia:** mapa Fracture Island estilizado, bots básicos, tormenta/zona segura, cofres, materiales, auto-pickup configurable y reinicio de partida.
7. **Habilidades:** Nyx Vale con Corte de Fase y Prisma de Rastreo; cooldown visible, bloqueo contra atravesar paredes y VFX legible.
8. **Narrativa:** NPCs invulnerables Aster Quill, Mako Ren y referencias a Orin Vale; diálogos únicos y conexiones familiares/amigos.

## Controles y UX táctil

- El `viewport` y el contenedor nativo deben bloquear portrait y solicitar landscape.
- Ningún control debe colocarse sobre la retícula o el área de loot central.
- Joystick izquierdo: movimiento; joystick derecho: cámara; arrastre de cámara no dispara accidentalmente.
- Acciones separadas: fuego, apuntar, salto, agacharse/deslizarse, recarga, interactuar, habilidad, construir, cambio de cámara y slots.
- Los botones respetan safe areas, tienen mínimo táctil amplio, feedback de presión y no usan `click` como único evento.
- El usuario puede elegir cuatro HUDs guardables:
  - **Clásico:** controles simétricos y mínimos.
  - **Competitivo:** fuego/apuntar grandes, slots cerca del pulgar derecho.
  - **Zurdo:** fuego y acciones principales invertidos.
  - **Personalizado:** posiciones, tamaño, escala, opacidad y visibilidad editables.
- El editor permite arrastrar controles, ajustar tamaño en pasos, restaurar HUD y guardar por perfil local.
- Añadir auto-pickup configurable, rueda rápida de curación, ping contextual, vibración opcional, giroscopio opcional y modo ahorro térmico.

## Mapa Android: Fracture Island

La arena debe verse grande aunque el primer slice use streaming y módulos optimizados. Sus zonas son Ciudad Vertical, Puerto Industrial, Bosque de Cristal, Complejo Orbital, Cañón Fracturado y Zona Central. Cada POI debe tener silueta, nombre, coberturas, rutas de rotación, alturas y loot reconocibles. Usar LOD, instancing, culling, texturas comprimidas y luces limitadas para gama baja.

## Rendimiento Android

Primer arranque seguro: gráficos bajos, 30 FPS, optimización activa, sombras bajas, VFX bajo, resolución dinámica y texturas comprimidas. Incluir perfiles Android Bajo, Android Medio y modo ahorro térmico. Medir FPS y frame time; bajar VFX/distancia antes de degradar controles. No afirmar que todos los teléfonos soportan la experiencia: documentar el rango de prueba.

## Arquitectura del proyecto

- `src/main.ts`: arranque, orientación, loop, límite FPS, input y conexión entre UI y gameplay.
- `src/game/game.ts`: simulación local del jugador, cámara, loadout, peso de armas, disparo, loot, bots, tormenta, construcción, habilidades y NPCs.
- `src/game/arena.ts`: módulos del mapa, coberturas, POIs, cofres y pickups.
- `src/game/camera.ts`: TPS/FPS, suavizado, recoil y protección contra obstáculos.
- `src/game/fx.ts`: impactos, muzzle flash, dash, rarezas y feedback de interacción.
- `src/engine/input.ts`: teclado legado, gamepad y touch multitáctil con pointer capture.
- `src/ui/touch.ts`: dos joysticks, botones, seguimiento de dedos y gestos de cámara.
- `src/ui/ui.ts`: lobby, HUD, editor de HUD, loadout, inventario, modos, políticas y ajustes.
- `src/engine/save.ts`: perfil, HUD activo, layouts, auto-pickup, giroscopio, vibración, calidad y progreso local.
- `src/styles/main.css`: landscape, HUD táctil, editor, safe areas y responsive.
- `capacitor.config.ts`, `android/`: wrapper Android y orientación landscape.
- `server/`: referencia autoritativa; no se reclama que el battle royale esté provisionado hasta validar un servidor público.

## Diseño visual elegido

Se mantiene **brutalismo neón táctico**: placas oscuras, geometría modular, cyan eléctrico para estados propios, magenta para peligro y ámbar para loot. El centro queda libre para combate; los controles se anclan a esquinas y zonas de pulgar. La tipografía usa ManusCC0 y su fallback existente. La marca debe sentirse precisa, tensa y legible, no una copia de Fortnite.

## Progresión y seguridad

Lobby, selección de héroe, inventario, tienda cosmética, pase gratuito y pase premium «Próximamente» deben ser visibles. El login se muestra como preparado. En producción, daño, movimiento, loot, inventario, construcción, ranking, pagos y recompensas serán server-authoritative. Las señales Legit/Suspicious/Bypass/Blatant se registran de forma defensiva; no se banea únicamente por IP ni por una sola señal.

## Límites honestos

El APK inicial será un build de prueba. No se prometerá “cero bugs”, anti-cheat perfecto, multiplayer global o compatibilidad universal. Cada función no implementada se marcará “En desarrollo” o “Próximamente”. La calidad se medirá por una partida jugable, controles táctiles cómodos y estabilidad en Android antes de ampliar el alcance.
