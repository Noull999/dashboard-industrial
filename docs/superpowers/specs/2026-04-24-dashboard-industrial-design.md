# Dashboard Industrial Pesquero — Diseño

**Fecha:** 2026-04-24  
**Proyecto:** dashboard-industrial  
**Ciudad:** Puerto Madryn (rubro pesquero)  
**Tipo:** Prototipo con sensores simulados

---

## Resumen

Dashboard web en tiempo real para monitoreo de sensores industriales en plantas pesqueras. Muestra datos de temperatura, humedad, presión, producción y más. Incluye alertas visuales, historial por sensor y seguimiento de producción por línea con tipo de producto.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TypeScript |
| Estilos | CSS puro (dark industrial, negro/rojo/blanco) |
| Gráficos | Recharts |
| Backend | FastAPI (Python) |
| Tiempo real | WebSockets |
| Historial | REST (FastAPI) |
| Base de datos | SQLite vía SQLAlchemy |
| Testing | pytest + httpx |

---

## Estética visual

- Fondo negro `#050505`
- Acento primario rojo `#e63946`
- Texto blanco `#ffffff`
- Estados: verde `#22c55e` (normal), amarillo `#f59e0b` (atención), rojo `#e63946` (alerta)
- Barra de color en la parte superior de cada card indica el estado
- Sidebar izquierdo de íconos, topbar con nombre de planta, badges y reloj

---

## Arquitectura

```
React (Vite)
  ├── WebSocket  →  FastAPI /ws          (lecturas en vivo cada 5s)
  └── REST       →  FastAPI /sensors     (catálogo)
                    FastAPI /sensors/{id}/history  (historial)
                    FastAPI /sensors/{id}/product  (cambio de producto)
                    FastAPI /alerts       (alertas activas)

FastAPI
  ├── SensorSimulator   genera lecturas cada 5s, detecta alertas
  ├── SQLite            persiste lecturas, alertas, cambios de producto
  └── WebSocket broker  transmite a todos los clientes conectados
```

---

## Sensores simulados

| ID | Nombre | Unidad | Mín | Máx |
|---|---|---|---|---|
| SEN-CF-001 | Cámara Frigorífica 1 | °C | −10 | −4 |
| SEN-CF-002 | Cámara Frigorífica 2 | °C | −10 | −4 |
| SEN-HU-001 | Humedad Sala Proceso | % | 40 | 85 |
| SEN-PR-001 | Presión Compresor NH₃ | bar | 1.5 | 4.5 |
| SEN-RP-001 | Banda Transportadora 1 | RPM | 80 | 180 |
| SEN-RP-002 | Banda Transportadora 2 | RPM | 80 | 180 |
| SEN-PZ-001 | Peso Tolva A | t | 0 | 2 |
| SEN-NV-001 | Nivel Tanque Salmuera | % | 20 | 95 |
| SEN-FL-001 | Caudal Agua Proceso | L/h | 200 | 600 |
| SEN-PD-001 | Línea Producción 1 | kg/min | 0 | 50 |
| SEN-PD-002 | Línea Producción 2 | kg/min | 0 | 50 |

**Widget global:** Total producido hoy (suma de líneas, desglose por especie).

---

## Componentes frontend

```
src/
├── components/
│   ├── SensorCard.tsx       card con valor actual, estado, sparkline
│   ├── SensorDrawer.tsx     panel lateral de detalle al hacer click
│   ├── AlertBar.tsx         barra roja de alerta activa en topbar
│   ├── SensorChart.tsx      gráfico histórico con Recharts
│   ├── ProductSelector.tsx  selector de especie por línea de producción
│   └── ProductionTotal.tsx  widget global de producción del día
├── hooks/
│   ├── useWebSocket.ts      conexión con reconexión automática (backoff)
│   └── useSensorHistory.ts  fetch REST del historial por sensor
├── pages/
│   └── Dashboard.tsx        página principal
└── App.tsx
```

---

## Componentes backend

```
backend/
├── main.py            FastAPI app, rutas HTTP y WebSocket
├── simulator.py       genera lecturas simuladas por sensor cada 5s
├── database.py        setup SQLAlchemy + SQLite
├── models.py          tablas: sensors, readings, alerts, product_changes
└── sensor_config.py   definición de sensores, límites y metadatos
```

---

## Modelo de datos (SQLite)

**sensors** — catálogo estático  
`id, name, unit, min_val, max_val, location, sensor_type`

**readings** — historial de lecturas  
`id, sensor_id, value, timestamp`

**alerts** — log de alertas  
`id, sensor_id, value, message, triggered_at, resolved_at`

**product_changes** — cambios de producto por línea  
`id, sensor_id, product_name, changed_at`

---

## Flujo de datos en tiempo real

1. `simulator.py` genera valor aleatorio realista para cada sensor cada 5s
2. Si el valor supera el límite → crea registro en `alerts`
3. FastAPI guarda la lectura en `readings` y emite por WebSocket a todos los clientes
4. React recibe el mensaje, actualiza la card del sensor correspondiente
5. Si hay alerta activa → `AlertBar` aparece con descripción y tiempo

---

## Panel de detalle (Drawer)

Al hacer click en cualquier sensor card se abre un drawer lateral con:
- Valor actual grande + estado (alerta / normal / atención)
- Mínimo / Promedio / Máximo de la última hora
- Gráfico histórico con selector de rango (30m, 1h, 6h, 24h)
- Log de eventos (alertas, normalizaciones, reconexiones)
- Metadata del sensor (tipo, frecuencia, ubicación, uptime)
- **Solo para líneas de producción:** selector de producto activo + acumulado del turno

---

## Producción por línea

- Cada línea (SEN-PD-001, SEN-PD-002) tiene su propio selector de especie
- Especies disponibles: Merluza, Langostino, Calamar, Salmón, Otro (campo libre)
- El cambio de producto queda registrado en `product_changes` con timestamp
- El historial muestra los tramos coloreados por especie
- El drawer muestra `kg/min` (lectura directa) y `t/h` (derivado: `kg/min × 60 / 1000`)
- **Acumulado del turno** = producción total desde las 00:00 del día actual (se resetea a medianoche)
- Widget global suma todas las líneas y muestra desglose: *Merluza 3.2t · Langostino 1.8t*

---

## Manejo de errores

- WebSocket desconectado → React reintenta con backoff exponencial (1s, 2s, 4s…)
- Sensor sin lectura por más de 15s → card muestra estado `OFFLINE` en gris
- Error en fetch de historial → drawer muestra mensaje de error sin romper la UI

---

## Testing

- `pytest` + `httpx` para todos los endpoints REST
- Tests de la lógica de detección de alertas en `simulator.py`
- Tests de los WebSocket con cliente de prueba de FastAPI

---

## Estructura de carpetas final

```
dashboard-industrial/
├── backend/
│   ├── main.py
│   ├── simulator.py
│   ├── database.py
│   ├── models.py
│   ├── sensor_config.py
│   ├── requirements.txt
│   └── tests/
│       └── test_api.py
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── pages/
│   │   └── App.tsx
│   ├── package.json
│   └── vite.config.ts
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-04-24-dashboard-industrial-design.md
```
