# CLAUDE.md

Contexto técnico para trabajar en este repositorio con Claude Code.

## Stack y estructura

- **Backend**: Flask + SQLAlchemy (SQL crudo vía `db.session.execute(text(...))`, sin ORM de objetos) + PyMySQL. Todo en un solo archivo `backend/app.py` (~2900 líneas). Lógica de fixtures/sorteos en `backend/tournament_engine.py`.
- **Frontend**: React 18 + Vite, sin TypeScript. Estilos en un único `frontend/src/styles/index.css` con variables CSS (`--primary`, `--surface`, `--glass`, etc.) y clases utilitarias (`.glass`, `.btn`, `.input`, `.select`, `.form-group`).
- **DB**: MySQL 8.0. **No hay herramienta de migraciones**: el esquema se gestiona con un bloque `CREATE TABLE IF NOT EXISTS` + una lista `upgrades` de `"ALTER TABLE ... ADD COLUMN ..."` (cada uno en try/except/rollback individual) que corre en **cada arranque** del backend (`backend/app.py`, inicio del archivo). Cualquier columna/tabla nueva debe seguir ese mismo patrón.
- **Auth**: sin JWT/sesión. Una sola tabla `users` con columna `role` (`superadmin`, `admin`, `tournament_admin`, `veedor`, `player`). `POST /api/login` devuelve el rol e ids, el frontend los guarda en `localStorage` y un interceptor de axios (`frontend/src/services/api.js`) los reinyecta como headers `X-Team-ID` / `X-Tournament-ID` / `X-User-ID` en cada request. El gating de rutas por rol vive solo en el frontend (`ProtectedRoute allowedRoles={[...]}`).
- **Orquestación**: `docker-compose.yml` (dev: frontend `:3000`, backend `:5001`, MySQL `:3307`) y `docker-compose.prod.yml`.

## Cómo levantar el proyecto

```bash
docker compose up --build -d
```
- Frontend: http://localhost:3000
- Backend: http://localhost:5001/api (`/api/health` para chequeo rápido)
- MySQL: `localhost:3307` (`team_user` / `team_password`, db `football_team`)

El esquema se auto-crea/migra al arrancar el backend — no hace falta correr nada de `db/init.sql` manualmente (ese archivo quedó como semilla legacy, ya no es la fuente de verdad).

---

## Sesión: Perfil de jugador + Tarjeta tipo FIFA + Estadísticas

Plan completo en `~/.claude/plans/cheeky-imagining-corbato.md`. Resumen de lo implementado:

### 1. Perfil de jugador extendido
Nuevas columnas en `players`: `first_name`, `last_name`, `email`, `birth_date`, `tertiary_position_id`, `preferred_foot`, `blood_type`, `nationality`, `photo_url`, `photo_cutout_url`.

- `PUT /api/players/<id>` (`update_player`, `backend/app.py`) extendido para aceptar estos campos y mantener `full_name` sincronizado desde `first_name + last_name` (todo el resto del sistema — matches, standings, panel de veedor — sigue leyendo `full_name` sin cambios).
- **No se tocó** `POST /api/<team_slug>/players` (registro público, `RegisterPlayer.jsx`) — por decisión explícita, el perfil completo solo se edita desde el panel admin.
- Formulario ampliado en `frontend/src/pages/PlayersList.jsx` (modal de edición): nombres/apellidos separados, email, dirección, fecha de nacimiento, nacionalidad, posición terciaria, pie hábil, tipo de sangre.

### 2. Foto con remoción de fondo (local, sin costo)
- Librería `rembg` (+ `Pillow`, `onnxruntime`) agregada a `backend/requirements.txt`. Corre 100% local, sin enviar fotos a terceros (relevante por privacidad, posibles fotos de menores).
- Nuevo endpoint `POST /api/players/<id>/photo`: guarda el original y el recorte (PNG con transparencia) en `uploads/`, actualiza `photo_url`/`photo_cutout_url`.
- El modelo `u2net.onnx` (~176MB) se descarga una sola vez y se persiste en `backend/uploads/.u2net/` vía `U2NET_HOME` (variable en `docker-compose.yml` y `docker-compose.prod.yml`) — no se re-descarga en rebuilds.
- UI en `PlayersList.jsx`: input de foto con preview de original + recorte (fondo tipo checkerboard para ver la transparencia).

### 3. Estadísticas y calificación por partido
- Nueva tabla `player_match_ratings` (`match_id`, `player_id`, `team_id`, `rating`, UNIQUE por match+player para permitir upsert).
- `POST/GET /api/matches/<id>/ratings`: el veedor califica (1-10) a cada jugador que participó, en el paso "Resumen Final" de `VeedorPanel.jsx`, antes de publicar el resultado oficial.
- Los agregados (goles totales, partidos jugados, amarillas, rojas, rating promedio) se calculan on-the-fly con subqueries contra `match_events` / `match_lineups` / `player_match_ratings` dentro de los endpoints de "card-data" (no hay tabla de stats materializada).
- Se exponen como campos "en crudo" para la tarjeta — no se inventó una fórmula de conversión a atributos estilo videojuego (eso queda como posible mejora futura una vez haya datos reales acumulados).

### 4. Editor de tarjeta (drag & drop, plantilla global)
- Nueva tabla `card_templates` (una sola fila = "la plantilla global": `id = MIN(id)`), columna `elements` en JSON (array de `{id, field, type, x, y, width, height, style}`).
- `GET/PUT /api/card-template`.
- Nueva página `frontend/src/pages/CardTemplateEditor.jsx` (ruta `/card-template`, solo `superadmin`): paleta de campos (`frontend/src/utils/cardFields.js` — registro compartido de campos vinculables), canvas con drag (usando `framer-motion`, ya era dependencia del proyecto — no se agregó ninguna librería de drag&drop nueva), resize con handle propio (pointer events, sin librería), panel de propiedades (fuente, color, alineación, radio de borde, z-index), subida de imagen de fondo.
- Vista previa con datos de ejemplo (no requiere un jugador real cargado).

### 5. Renderizado, vista y exportación de tarjetas
- `frontend/src/components/PlayerCard.jsx`: componente puro que renderiza `template + data` → usado sin cambios por el editor, la vista individual, el export por lote y el perfil propio del jugador (para que el diseño y el resultado final sean siempre idénticos).
- `GET /api/players/<id>/card-data` y `GET /api/teams/<id>/players/card-data`: devuelven los datos ya resueltos (nombres de posición, escudo del equipo, stats agregadas) listos para pintar.
- En `PlayersList.jsx`: botón "Ver tarjeta" (modal + descarga PNG con `html-to-image`) y botón "Exportar Tarjetas (ZIP)" a nivel de equipo (loop secuencial off-screen + `jszip`, con indicador de progreso).

### 6. Acceso propio del jugador
- Nuevo rol `player` sobre el mismo mecanismo de auth existente. Columnas nuevas en `users`: `player_id`, `must_change_password`.
- Aprovisionamiento automático e idempotente dentro de `update_player`: la primera vez que un admin edita y guarda un jugador, se crea su usuario (`username` = documento, clave inicial = documento, `must_change_password = 1`). Aislado en su propio try/except para que un choque de `username` (el documento solo es único por equipo, no globalmente) nunca tumbe el guardado del perfil.
- `/api/login` extendido para devolver `player_id`/`must_change_password`. Nuevos `GET /api/me/player` y `PUT /api/me/password`.
- Nueva página `frontend/src/pages/PlayerProfile.jsx` (ruta `/player`): perfil de solo lectura + su propia tarjeta + modal bloqueante de cambio de contraseña obligatorio en el primer login.
- **Nota**: un jugador que solo se auto-registró (nunca editado por un admin) no tiene acceso todavía — limitación aceptada para no tocar el endpoint público de registro.

---

## Bugs preexistentes corregidos de paso

Encontrados porque bloqueaban directamente el código que se estaba tocando:

1. **`update_player` rompía siempre (500)**: llamaba a `sanitize_int()`, que estaba definida como función anidada dentro de `register_player` y no existía en el scope de `update_player`. Se elevó a función de módulo (`backend/app.py`).
2. **Modal de edición de jugador nunca cargaba posiciones/números disponibles**: `PlayersList.jsx` usaba `positionService` y `uniformService` en `handleOpenEdit` sin importarlos. Se agregaron al import.
3. **Build de Docker del frontend fallaba** (`Dynamic require of "workbox-build" is not supported`): incompatibilidad de `vite-plugin-pwa`/`workbox-build` con Node 18. Se subió `frontend/Dockerfile` a `node:20-alpine`.
4. **Timeout de gunicorn (30s por defecto) mataba la subida de foto** mientras se descargaba el modelo de `rembg` (176MB) la primera vez. Se subió a `--timeout 180` en `backend/Dockerfile`.

## Limitaciones conocidas / pendientes

- **No se probó visualmente el drag & drop del editor de tarjetas** — se implementó y se verificó que compila, pero la sesión que lo construyó no tenía acceso a navegador/pantalla (background job). Falta una pasada manual en el navegador.
- No existe fórmula de "skills" estilo FIFA (rating 1-99, atributos ofensivo/defensivo) — solo se exponen las estadísticas crudas (goles, partidos, rating promedio, tarjetas) como campos de tarjeta.
- El acceso de jugador no cubre a quienes solo se auto-registraron sin edición admin posterior (ver nota arriba).
- Persisten scripts de debugging sueltos en la raíz del repo (`fix_users.py`, `restore_dyck.py`, `force_players.py`, `debug_users.py`, `scratch.py`, `tmp_docker_config/`) — no se tocaron, quedan pendientes de limpieza si se decide hacerla.
