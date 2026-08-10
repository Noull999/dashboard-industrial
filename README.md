# 🏭 Dashboard Industrial

**Monitoreo en tiempo real de sensores industriales para plantas pesqueras**

Dashboard web con datos en vivo de sensores IoT — temperatura, humedad, presión y otras variables críticas. Visualización con gráficos interactivos, alertas automáticas y simulación de sensores para desarrollo.

---

## ✨ Funcionalidades

- **Tiempo real** — Datos de sensores vía WebSocket
- **Gráficos interactivos** — Visualización con Recharts
- **Alertas** — Notificaciones cuando variables salen de rango
- **Simulador** — Generación de datos sintéticos para pruebas
- **Historial** — Consulta de datos históricos con SQLAlchemy

---

## 🛠 Stack

| Capa | Tecnología |
|------|-----------|
| Backend | FastAPI + SQLAlchemy + WebSockets |
| Frontend | React 19 + Vite + TypeScript |
| Charts | Recharts |
| DB | SQLite |
| Tests | Pytest |

---

## 🚀 Inicio rápido

```bash
git clone https://github.com/Noull999/dashboard-industrial.git
cd dashboard-industrial

# Backend
cd backend
pip install -r requirements.txt
python main.py

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

Abre http://localhost:5173 para ver el dashboard.

---

## 📁 Estructura

```
dashboard-industrial/
├── backend/
│   ├── main.py           # API FastAPI + WebSockets
│   ├── database.py       # Modelos SQLAlchemy
│   ├── models.py         # Definiciones de datos
│   ├── simulator.py      # Generador de datos sintéticos
│   ├── sensor_config.py  # Configuración de sensores
│   └── tests/            # Tests Pytest
├── frontend/
│   └── src/              # App React + Vite
└── docs/                 # Documentación
```
