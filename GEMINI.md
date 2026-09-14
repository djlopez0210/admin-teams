# Reglas del Proyecto (GEMINI.md)

## Entorno y Contenedores
- **IMPORTANTE**: **No tenemos Docker, usamos Podman**.
- Para orquestar los servicios usar siempre `podman compose` (o `podman-compose`), nunca comandos de `docker`.
- Ejemplo para levantar el entorno:
  ```bash
  podman compose up --build -d
  ```
- Ejemplo para reconstruir el frontend:
  ```bash
  podman compose up --build -d frontend
  ```

## Estructura y Stack
- **Backend**: Flask + SQLAlchemy (consultas SQL crudas con `text()`) + PyMySQL.
- **Frontend**: React 18 + Vite (estilos con variables CSS en `frontend/src/styles/index.css`).
- **Base de Datos**: MySQL 8.0.

## Convenciones de Tarjetas y Jugadores
- Las posiciones en las tarjetas de jugador se traducen automáticamente a siglas estándar de FIFA / EA Sports FC (`PO`, `DC`, `DI`, `DD`, `DFC`, `LI`, `LD`, `MC`, `MCD`, `MCO`, etc.) mediante `toFifaPosition`.
- En el editor de tarjetas ([CardTemplateEditor.jsx](file:///Users/djlopez/proyectos/recolectar-datos/frontend/src/pages/CardTemplateEditor.jsx)) los campos de posición soportan alternar entre sigla FIFA y nombre completo.
