# MediCita — Plataforma de Gestión y Agendamiento Clínico

Sistema web integral para la reserva de horas médicas presenciales y por telemedicina, gestión de disponibilidad profesional y seguimiento de atenciones clínicas.

- **Despliegue en producción:** [https://medicita-hub.pages.dev](https://medicita-hub.pages.dev)
- **Seguimiento del proyecto:** GitHub Projects (Metodología Híbrida: PMI + Scrum / Priorización MoSCoW)
- **Hito actual:** H4 — Demo Sprint 2 (Semanas 5–6)

---

## 👥 Equipo de Desarrollo
- **Alberto Oñate**
- **Cristobal Barahona**
- **Ignacio Serrano**
- **Matías Farías**
- **Matías Pajarito**

---

## 🛠️ Stack Tecnológico
- **Frontend / Framework:** React 18, TanStack Router / TanStack Start, TypeScript
- **Estilos & UI:** Tailwind CSS, Shadcn UI, Lucide Icons
- **Backend & Base de Datos:** Supabase (PostgreSQL, Supabase Auth, Row Level Security)
- **Testing:** Vitest, Testing Library
- **CI/CD & Hosting:** Cloudflare Pages integrado con GitHub Actions

---

## 📊 Matriz Global de Requerimientos (P02 - MediCita)

El proyecto se rige por la pauta oficial de 20 requerimientos priorizados bajo metodología MoSCoW:

| # | Tipo | Requerimiento Oficial | Prioridad | Sprint Estimado | Estado Actual |
| :-: | :--- | :--- | :-: | :-: | :-: |
| **01** | Funcional | Registro y perfil de pacientes con historial médico básico | Must | Sprint 1 | ✅ Completado |
| **02** | Funcional | Alta de profesionales con especialidad, foto y bio | Must | Sprint 1 | ✅ Completado |
| **03** | Funcional | Gestión de disponibilidad por profesional (calendario semanal) | Must | Sprint 1 | ✅ Completado |
| **04** | Funcional | Búsqueda de citas por especialidad, fecha, ciudad y profesional | Must | Sprint 2 | ✅ Completado |
| **05** | Funcional | Reserva de cita en tiempo real con bloqueo optimista de slot | Must | Sprint 2 | ✅ Completado |
| **06** | Funcional | Reagendar y cancelar citas con política de aviso mínimo | Must | Sprint 2 | ✅ Completado |
| **07** | Funcional | Recordatorios automáticos por SMS y email (24 h y 2 h antes) | Must | Sprint 3 | 🔄 En Proceso |
| **08** | Funcional | Ficha de paciente con notas de consulta (accesible solo por profesional) | Must | Sprint 3 | 🔄 En Proceso |
| **09** | Funcional | Videoconsulta integrada (WebRTC o Jitsi/Meet embed) | Must | Sprint 3 | 🔄 En Proceso |
| **10** | Funcional | Panel de administración con reportes de ocupación y no-shows | Must | Sprint 4 | ⏳ Pendiente |
| **11** | No funcional | Cumplimiento normativo local de protección de datos de salud | Must | Sprint 4 | ⏳ Pendiente |
| **12** | No funcional | Disponibilidad $\ge$ 99% durante horario 06:00-22:00 | Must | Sprint 4 | ⏳ Pendiente |
| **13** | No funcional | Backups automáticos diarios con retención 30 días | Should | Sprint 5 | ⏳ Pendiente |
| **14** | Seguridad | Roles diferenciados: paciente, profesional, recepción, admin | Should | Sprint 5 | 🔄 En Proceso |
| **15** | Seguridad | Cifrado de datos clínicos y logs de acceso a fichas | Should | Sprint 5 | ⏳ Pendiente |
| **16** | UX/UI | Flujo de reserva en máximo 3 pasos; accesible AA | Should | Sprint 6 | ⏳ Pendiente |
| **17** | Integración | Integración con Twilio (SMS) y SendGrid (email) | Should | Sprint 6 | ⏳ Pendiente |
| **18** | DevOps | Pipeline CI con tests + análisis estático (SonarQube/Codacy) | Could | Sprint 6 | ⏳ Pendiente |
| **19** | Testing | Tests E2E de flujos críticos (reserva, cancelación, videoconsulta) | Could | Sprint 7 | ⏳ Pendiente |
| **20** | Documentación | Manual de usuario paciente + profesional + admin (PDF/wiki) | Could | Sprint 7 | ⏳ Pendiente |

---

## 🎯 Entregables Completados

### Sprint 1 — Base de Datos, Autenticación y Disponibilidad
- **[MUST-01] Registro y Perfil de Pacientes:** Autenticación de usuarios vía Supabase Auth, persistencia de perfil clínico (RUT, teléfono, antecedentes) y panel personal.
- **[MUST-02] Directorio Clínico Profesional:** Catálogo médico dinámico con especialidad, arancel, registro SIS e identidad visual estandarizada por avatares clínicos.
- **[MUST-03] Disponibilidad Horaria Médica:** Gestor de jornadas y bloques de atención semanal configurable por cada profesional de la salud.

### Sprint 2 — Búsqueda Avanzada, Prevención de Solapamiento y Agenda
- **[MUST-04] Búsqueda y Filtros Clínicos:** Búsqueda reactiva por profesional, selector por especialidades con conteo dinámico de especialistas y filtros por tarifa de consulta.
- **[MUST-05] Reserva Atómica y Anti-Solapamiento:** Consulta en tiempo real de citas ocupadas en Supabase (`appointments`), deshabilitación visual de bloques reservados y validación anti-concurrencia previa a la inserción.
- **[MUST-06] Gestión de Agenda de Paciente:** Visualización diferenciada en `Mi agenda` entre próximas consultas e historial de atenciones, con flujo seguro de cancelación de citas.

---

## 🩺 Backlog de Requerimientos Priorizados (Sprints 3 y 4)

### [MUST-07] Recordatorios automáticos por SMS y correo
- **Descripción:** Notificaciones programadas enviadas al paciente 24 horas y 2 horas antes de la consulta.
- **Criterios de aceptación:**
  1. Integración con servicio transaccional (Resend / SendGrid / Twilio).
  2. Despacho programado basado en la fecha y hora de la cita confirmada.

### [MUST-08] Ficha clínica de paciente y registro de notas médicas
- **Descripción:** Registro confidencial de anamnesis, diagnóstico e indicaciones médicas en la vista del doctor.
- **Criterios de aceptación:**
  1. Tabla `medical_notes` en Supabase asociada a `appointment_id` y `patient_id`.
  2. Acceso restringido exclusivamente al médico tratante mediante políticas RLS.
  3. Historial de notas ordenado cronológicamente por consulta.

### [MUST-09] Módulo de videoconsulta integrado mediante Jitsi Meet
- **Descripción:** Sala virtual de telemedicina incrustada para atenciones remotas.
- **Criterios de aceptación:**
  1. Generación de sala virtual única basada en el UUID de la cita.
  2. Integración de Jitsi Meet con soporte de audio, cámara y chat.
  3. Validación de acceso restringida a médico y paciente participantes.

### [MUST-10] Panel administrativo con métricas de ocupación y no-shows
- **Descripción:** Panel de control con indicadores de gestión clínica y reporte de inasistencias.
- **Criterios de aceptación:**
  1. Cálculo de tasa de ocupación por médico y especialidad.
  2. Métricas de citas atendidas vs. canceladas en el período.

### [MUST-11] Cumplimiento normativo y consentimiento de datos de salud
- **Descripción:** Adecuación legal al tratamiento de datos sensibles (Ley 20.584).
- **Criterios de aceptación:**
  1. Checkbox explícito de consentimiento informado en el registro.
  2. Persistencia de la aceptación con timestamp en el registro del paciente.

### [MUST-12] Monitoreo de disponibilidad continua (SLA $\ge$ 99%)
- **Descripción:** Auditoría externa de disponibilidad del servicio en horario 06:00 a 22:00 hrs.
- **Criterios de aceptación:**
  1. Sonda de chequeo automatizada cada 5 minutos mediante monitor externo.
  2. Registro formal del porcentaje de uptime mensual.

---

## 🚀 Ejecución en Entorno Local

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/MatiasPajarito/medicita-hub
   cd medicita-hub
   ```

2. **Instalar dependencias:**
   ```bash
   npm install
   ```

3. **Configurar variables de entorno:**
   Crear un archivo `.env` en la raíz del proyecto:
   ```env
   VITE_SUPABASE_URL="https://tu-proyecto.supabase.co"
   VITE_SUPABASE_ANON_KEY="tu-anon-key"
   ```

4. **Iniciar en modo desarrollo:**
   ```bash
   npm run dev
   ```

5. **Compilar y validar tipos:**
   ```bash
   npm run build
   ```
