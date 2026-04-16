# Football Team Registration System

Sistema completo de registro para equipos de fútbol con validación de documentos (regla de 15 días) y gestión dinámica de uniformes.

## Tecnologías
- **Frontend**: React 18 + Vite + CSS Vanilla (Premium Design)
- **Backend**: Flask (Python) + SQLAlchemy
- **Database**: MySQL 8.0
- **Orquestación**: Docker Compose

## Estructura del Proyecto
- `/backend`: API Flask con toda la lógica de negocio.
- `/frontend`: Aplicación React con interfaz moderna y responsiva.
- `/db`: Script de inicialización de la base de datos.
- `docker-compose.yml`: Orquestador de servicios.

## Instrucciones de Instalación

1. Asegúrate de tener **Docker** y **Docker Compose** instalados.
2. Clona o descarga este repositorio.
3. Desde la raíz del proyecto, ejecuta:
   ```bash
   docker-compose up --build -d
   ```
4. Espera a que los contenedores estén listos.
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:5000](http://localhost:5000)
   - MySQL (Host): localhost:3307

## Características Implementadas
- **Registro Inteligente**: Validación en tiempo real del documento. Bloqueo de re-registro por 15 días.
- **Gestión de Uniformes**: Los números ocupados se ocultan automáticamente del formulario.
- **Historial de Jugadores**: Se mantiene un registro de cada vez que un jugador actualiza sus datos (después de los 15 días).
- **Panel Admin**: Control de posiciones, visualización de estadísticas y logs de auditoría.
- **Diseño Premium**: Interfaz moderna con estética Glassmorphism y animaciones suaves.

## Auditoría
Todas las acciones críticas (creación, edición, eliminación) se guardan en la tabla `activity_logs` visible desde el panel de administración.
# admin-teams
# admin-teams
