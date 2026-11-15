# Neon Breach: Fracture Ops — plan de implementación

## Alcance confirmado

Se entregará un vertical slice 3D jugable en navegador, no un producto AAA terminado. El núcleo será un campo de entrenamiento/arena sci-fi con movimiento FPS, cambio a tercera persona, disparo, recarga, dash y una habilidad táctica. El lobby presentará selección de modo, héroe, inventario, tienda, recompensas, pase gratuito y pase premium como «Próximamente». Los modos solicitados quedarán representados como tarjetas preparadas; solo el campo de entrenamiento será jugable en esta iteración.

La autenticación Google/Facebook/usuario, la sincronización cross-device, el matchmaking, el leaderboard verificado, pagos Stripe, soporte nativo de PlayStation/Xbox y el anti-cheat productivo se muestran como arquitectura/UI preparada o pendientes de backend. El cliente no inspecciona procesos privados ni promete detección perfecta.

## Arquitectura

- `src/main.ts`: arranque, loop, pantalla activa, ajustes locales y entrada al slice.
- `src/game/game.ts`: simulación local de jugador, armas, objetivos, NPCs, habilidades y cámara.
- `src/game/arena.ts`: mapa procedural con plataformas, coberturas, luces, señalética y pickups.
- `src/game/camera.ts`: cámara FPS/TPS, suavizado, recoil y seguimiento.
- `src/game/fx.ts`: impactos, muzzle flash, trazadoras, dash y VFX de habilidad.
- `src/ui/ui.ts`: lobby, HUD, paneles de modos, héroes, tienda, inventario, seguridad, privacidad y ajustes.
- `src/engine/input.ts`: WASD/ratón, gamepad y touch; acciones con edge-trigger.
- `src/engine/save.ts`: preset seguro inicial (gráficos bajos y 30 FPS), perfil, ajustes y progreso local.
- `src/styles/main.css`: sistema visual y layouts responsive.
- `assets/models/`: personaje 3D generado autorizado por el Blueprint; el arma permanece como mesh separado.
- `assets/audio/`: disparo, dash, UI, recompensa y música original generados para el slice.
- `server/`: se conserva el servidor autoritativo de referencia, sin reclamar que el shooter ranked esté validado por él.

## Diseño visual elegido

Tres estilos muestreados:

- **Brutalismo neón táctico** — 0.06: placas oscuras, geometría modular y acentos cyan/magenta.
- **Militar holográfico** — 0.03: interfaces transparentes, ámbar de alerta y señalética técnica.
- **Óxido orbital** — 0.08: metal desgastado, luces de emergencia y arena industrial.

Se elige **Brutalismo neón táctico**.

- **Movimiento de diseño:** una mezcla de HUD de shooters competitivos, brutalismo digital y señalética de instalaciones orbitales.
- **Principios:** contraste alto, lectura instantánea de amenazas, profundidad mediante capas y feedback contundente sin saturar la pantalla.
- **Filosofía de color:** carbón y grafito para estructura; cyan para estados seguros/propios; magenta para peligro/enemigo; ámbar para recompensa y decisiones.
- **Paradigma de layout:** paneles asimétricos anclados a esquinas y bordes, con el centro reservado para el combate y una columna lateral de misión/estado.
- **Elementos firma:** retícula partida con anillo de carga, líneas diagonales de «fractura» y tarjetas con notch angular.
- **Interacción:** cada acción importante responde con cambio de color, microanimación y sonido; las funciones bloqueadas explican el motivo y no simulan disponibilidad.
- **Animación:** entradas en slide corto, pulso de cooldown, recoil leve y VFX que dibujan dirección/alcance antes de resolver.
- **Tipografía:** ManusCC0 para titulares compactos y ManusCC0 Sans CJK SC como fallback; labels en mayúsculas pequeñas y números tabulares.
- **Esencia:** «un campo de pruebas sci-fi donde cada decisión se lee en milisegundos»; preciso, tenso, transparente.
- **Voz:** directa, técnica y motivadora. Ejemplos: «ENTRA. LEE. ROMPE EL ÁNGULO.» y «La integridad protege la partida; la habilidad decide el duelo.»
- **Wordmark:** “NEON / BREACH” con una barra diagonal que corta el segundo término y actúa como retícula.
- **Color propio:** cyan eléctrico `#65F6FF`, reservado para estados propios y foco.

## Mecánicas del slice

- Movimiento en plano con WASD, sprint y dash; ratón para mirar, click para disparar y R para recargar.
- Cambio FPS/TPS con V; interacción con E; habilidad de Nyx con Q; pausa con Esc.
- Rifle de pulso con cargador, reserva, dispersión ligera, recoil y objetivos de tiro.
- Habilidad «Corte de Fase»: dash hacia delante, enfriamiento y VFX.
- Habilidad «Eco Prisma»: pulso que marca objetivos y genera feedback visual.
- NPCs invulnerables: Aster Quill, hermana de Nyx; Orin Vale, hermano desaparecido mencionado en diálogos; Mako, técnico amigo de Aster.
- Cofres y pickups con rarezas/pesos normalizados desde los pesos originales 70/40/30/10/5/1.
- Panel de selección de modos con 1v1, 2v2, 3v3, 4v4, 5v5, Battle Royale clasificatorio y Entrenamiento/Aim.
- Menú de perfil con nombre recomendado editable y regla de nombre único local; login UI preparada sin OAuth simulado.
- Panel de seguridad con monitor de integridad conceptual, niveles Legit/Bypass/Blatant como etiquetas de riesgo, expulsión de partida para anomalías y baneo temporal escalonado como diseño de servidor pendiente.

## Empaquetado nativo

La build web de `dist/` se reutiliza en dos contenedores nativos. Tauri 2 usa `src-tauri/tauri.conf.json` y Cargo para generar instaladores Windows NSIS `.exe` y `.msi`; Capacitor usa `capacitor.config.ts` con `webDir: dist` para generar el proyecto Android y sus APK/AAB. `scripts/setup-native-packaging.mjs` escribe ambos scaffolds de forma idempotente, puede instalar dependencias con `--install`, inicializar Android con `--android` y diagnosticar Rust/Java/ADB. Los artefactos requieren firma real antes de distribución. XAPK queda explícitamente fuera del pipeline estándar porque no es un artefacto Gradle nativo.

## Límites honestos

El cliente local sirve para demostrar UX y combate, pero no es una frontera de seguridad. Para producción se debe mover la autoridad de movimiento, impactos, inventario, drops y recompensas a un servidor de partidas con validación, replay/telemetría, firma de builds, integridad de archivos y revisión humana. Los baneos por IP no deben ser la única señal y requieren políticas de privacidad, retención y apelación.
