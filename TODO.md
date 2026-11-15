# TODO — Neon Breach: Fracture Ops (Android landscape)

## Partida battle royale jugable
- [ ] Desde el lobby se debe entrar a una partida real, no a una pantalla decorativa.
- [ ] La partida debe iniciar en orientación horizontal y usar un personaje 3D controlable en tercera persona, con botón para cambiar a primera persona.
- [ ] El mapa debe incluir módulos reconocibles de Ciudad Vertical, Puerto Industrial, Bosque de Cristal, Complejo Orbital, Cañón Fracturado y Zona Central, con coberturas, alturas, rutas y loot.
- [ ] Deben existir tormenta/zona segura, bots, daño, escudo, eliminación y reinicio de partida.

## Movimiento y cámara táctil
- [ ] El joystick izquierdo debe mover con aceleración/frenado suaves, zona muerta configurable y diagonales normalizadas.
- [ ] El joystick derecho debe controlar la cámara sin robar el dedo del movimiento ni disparar accidentalmente.
- [ ] Deben funcionar sprint, salto, agacharse, deslizamiento, apuntado, disparo, recarga, interacción, habilidad, construcción y cambio de cámara.
- [ ] La cámara debe suavizarse, respetar límites verticales, evitar atravesar paredes y mantener el centro de combate libre.

## Cuatro espacios de armas y peso
- [ ] El HUD y el inventario deben mostrar exactamente cuatro espacios: `Arma 1`, `Arma 2`, `Pistola` y `Puño`.
- [ ] El usuario debe poder cambiar de slot tocando el espacio correspondiente y ver claramente el slot activo.
- [ ] La velocidad debe depender del arma en mano: Puño más rápido, Pistola ligera, armas primarias intermedias y armas pesadas más lentas.
- [ ] Cada arma debe tener munición, recarga, cadencia, recoil, daño, indicador de impacto y feedback visual/audio; no debe existir pay-to-win.

## HUD móvil configurable
- [ ] Deben existir cuatro HUD guardables: `Clásico`, `Competitivo`, `Zurdo` y `Personalizado`.
- [ ] El editor debe permitir arrastrar cada botón, modificar tamaño, escala, opacidad y visibilidad, restaurar el diseño y guardar la selección local.
- [ ] Los controles deben respetar safe areas, tamaño táctil cómodo, feedback de presión y evitar toques accidentales.
- [ ] El HUD debe mostrar vida, escudo, retícula, munición, slot activo, cuatro slots, cooldowns, minimapa/objetivo y estado de partida sin tapar el combate.

## Loot, cofres y construcción
- [ ] Debe existir loot en suelo y cofres con interacción y animación.
- [ ] Las rarezas visibles deben ser Común, Poco común, Rara, Legendaria, Mística y Especial.
- [ ] Los pesos 70/40/30/10/5/1 deben mostrarse normalizados a 44.87%, 25.64%, 19.23%, 6.41%, 3.21% y 0.64%.
- [ ] Debe existir construcción funcional de pared, piso y rampa con previsualización verde/roja, costes, colisión y límites.

## Personajes, habilidades y NPCs
- [ ] Nyx Vale debe tener Corte de Fase y Prisma de Rastreo con cooldown visible, VFX legible y bloqueo contra atravesar paredes.
- [ ] Aster Quill, Mako Ren y las referencias a Orin Vale deben conservar relaciones de hermana, amigo y hermano desaparecido.
- [ ] Los NPCs deben tener diálogos únicos, ser invulnerables, no bloquear soft-locks y reaparecer tras reiniciar.

## Ideas móviles adicionales
- [ ] Auto-pickup configurable para munición, curación y loot.
- [ ] Rueda rápida de curación y consumibles.
- [ ] Ping contextual para marcar enemigo, loot y ubicación.
- [ ] Vibración opcional, giroscopio opcional y modo ahorro térmico.
- [ ] Recomendación automática de calidad basada en FPS/frame time, sin modificar archivos del dispositivo.

## Lobby, progresión y políticas
- [ ] El lobby debe mostrar jugar, modos, héroe, inventario, tienda, recompensas, perfil, ajustes, seguridad y políticas.
- [ ] El pase gratuito debe ser visible; el pase premium debe indicar `Próximamente`.
- [ ] Google, Facebook y Usuario deben aparecer como accesos preparados, sin simular OAuth real.
- [ ] Deben existir textos de usuario, privacidad, juego limpio, seguridad, integridad, compras, reembolsos y apelaciones como borradores pendientes de revisión legal.
- [ ] Las tarjetas de 1v1, 2v2, 3v3, 4v4, 5v5, Battle Royale clasificatorio y Entrenamiento/Aim deben mostrar estado jugable o `En desarrollo` con honestidad.

## Rendimiento y APK Android
- [ ] Primer inicio: Android landscape, gráficos bajos, máximo 30 FPS y optimización activa.
- [ ] Deben existir presets Android Bajo, Android Medio y modo ahorro térmico.
- [ ] Deben existir resolución dinámica, culling/LOD/instancing y texturas comprimidas donde proceda.
- [ ] El wrapper Capacitor debe solicitar orientación landscape y generar APK debug desde `dist/`.
- [ ] La build debe ejecutarse con typecheck, pruebas, build fuente y smoke checks; no se promete cero bugs.

## Multiplayer y seguridad preparada
- [ ] Daño, movimiento, loot, inventario, construcciones, ranking, pagos y recompensas deben estar marcados como server-authoritative para producción.
- [ ] Las señales Legit/Suspicious/Bypass/Blatant deben evitar falsos positivos, registrar evidencia y no banear solo por IP o una única señal.
- [ ] Si el backend no está desplegado, la interfaz debe decir `Preparado` o `Próximamente` y no fingir online competitivo.

## Entrega
- [x] Existe scaffold Tauri/Capacitor y workflow de builds nativas en GitHub.
- [x] El repositorio remoto es `yazedu1011-boop/neon-breach`.
- [ ] Reemplazar el actual slice de campo de tiro por la primera partida Android battle royale jugable.
- [ ] Guardar checkpoint del proyecto después de validar el nuevo vertical slice.

## Battle royale móvil (iteración actual)
- [x] Mapa Fracture Island con seis zonas, edificios, cofres y colisiones.
- [x] Personaje 3D animado (GLB) con respaldo humanoide articulado.
- [x] Cámara TPS/FPS sin joystick de cámara: arrastre libre del canvas.
- [x] Cuadrícula de botones redondos separados, cuatro slots de arma.
- [x] Velocidad reducida al apuntar (28%) y al disparar sin mira (50%).
- [x] Bots, tormenta, daño/escudo, victoria/derrota y reinicio.
- [ ] Cofres con animación de apertura completa y loot visual.
- [ ] IA de bots con patrulla, cobertura y uso de habilidades.
- [ ] Multijugador online autoritativo para battle royale.
