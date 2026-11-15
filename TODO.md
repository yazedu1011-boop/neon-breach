# TODO — Neon Breach: Fracture Ops

## Slice jugable FPS/TPS y arena
- [ ] La arena sci-fi debe abrir desde el lobby y permitir movimiento WASD/touch/gamepad, sprint, apuntado, disparo, recarga, dash, interacción y pausa.
- [ ] La cámara debe iniciar en primera persona y cambiar a tercera persona al pulsar V o el control equivalente.
- [ ] El HUD debe mostrar retícula, vida, escudo, munición, enfriamientos, objetivo y estado de integridad sin tapar el combate.
- [ ] La arena debe tener coberturas, plataformas, luces, estructuras, objetivos de Aim y al menos un cofre/pickup.

## Héroes, NPCs e historia
- [ ] Debe existir un elenco visible con nombres, habilidades, enfriamientos e historias conectadas, incluyendo parientes/amigos.
- [ ] Los NPCs interactuables deben ser invulnerables, tener textos únicos y no formar parte de la lógica de daño.
- [ ] Nyx Vale debe ser el personaje seleccionado del slice y sus habilidades deben producir feedback visual y de cooldown.

## Progresión, loot y modos
- [ ] El inventario, la tienda, recompensas, pase gratuito y pase premium deben aparecer en el lobby; el pase premium debe indicar «Próximamente».
- [ ] Las rarezas deben mostrar Común, Poco común, Rara, Legendaria, Mística y Especial.
- [ ] Los pesos visibles deben normalizar los valores originales 70/40/30/10/5/1 a un total de 100%, sin presentar probabilidades inválidas.
- [ ] Las tarjetas de 1v1, 2v2, 3v3, 4v4, 5v5, Battle Royale clasificatorio y Entrenamiento/Aim deben ser seleccionables o mostrar su estado de preparación.

## Perfil, login y plataforma
- [ ] El jugador debe recibir un nombre aleatorio recomendado, poder editarlo y recibir error si el nombre ya existe localmente.
- [ ] Google, Facebook y Usuario deben estar visibles como acceso preparado, sin simular un OAuth real ni permitir suplantación.
- [ ] La interfaz debe mostrar presets Android, PC y Joystick, además de configuraciones manuales y automáticas.
- [ ] El primer arranque debe usar gráficos bajos, 30 FPS máximos y optimización activa; los ajustes manuales deben ofrecer niveles de gráficos y FPS.
- [ ] Debe declararse compatibilidad objetivo con Android, PC, PlayStation y Xbox, indicando que el soporte nativo de consolas no está incluido en el prototipo web.

## Juego limpio y políticas
- [ ] Deben existir vistas de Política de usuario, Privacidad, Juego limpio, seguridad, integridad de archivos y apelaciones.
- [ ] La UX debe distinguir señales Legit, Bypass y Blatant como niveles conceptuales, expulsar anomalías de la partida en el slice y explicar que la decisión productiva requiere servidor autoritativo.
- [ ] Debe existir un flujo conceptual de advertencia en lobby y baneo escalonado de 1–7 días, sin fingir que una IP local está baneada.
- [ ] El diseño debe explicar que inventario, drops, recompensas, ranking y pagos necesitan validación server-authoritative en producción.

## Entrega y calidad
- [ ] `pnpm build`, pruebas existentes y smoke del starter deben ejecutarse; cualquier cobertura del starter que ya no aplique debe quedar sustituida por checks del slice.
- [ ] El proyecto debe tener rutas de juego declaradas en `public/manus-routes.json` y una identidad de marca/fav icon válida.
- [ ] Debe guardarse un checkpoint con la fuente y assets registrados; la publicación multiplayer queda pendiente de seleccionar equipo cloud y validar WSS público.
