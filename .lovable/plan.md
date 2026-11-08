# Gestión de pacientes y profesionales en MediCita

## Objetivo
Conectar la experiencia clínica a Lovable Cloud, con datos protegidos para pacientes, un directorio público de profesionales activos y un alta profesional exclusiva para administradores.

## Cambios a implementar

### Datos y seguridad
- Crear `patients` con datos personales, contacto, antecedentes, alergias y condiciones crónicas; cada paciente solo podrá ver y editar su propia ficha.
- Crear `doctors` con nombre, especialidad, biografía, fotografía, tarifa y estado activo; el directorio público mostrará únicamente profesionales activos.
- Crear roles separados para distinguir administradores, profesionales y pacientes, sin guardar privilegios en perfiles.
- Validar formatos y límites tanto en los formularios como en las acciones del servidor.
- Añadir fechas de creación/actualización e índices para consultas habituales.

### Acceso
- Convertir la pantalla existente en acceso real con correo/contraseña y Google.
- Proteger `/perfil` para usuarios con sesión y `/admin` para administradores, comprobando los permisos también en el servidor.
- Actualizar la navegación para reflejar si la persona inició sesión y ofrecer perfil/cierre de sesión.

### Perfil de paciente
- Crear `/perfil` con edición de datos personales, contacto de emergencia y antecedentes básicos.
- Mostrar estados claros de carga, guardado, validación y error.
- Crear la ficha automáticamente al guardar por primera vez y actualizarla en usos posteriores.

### Directorio profesional
- Crear `/medicos` con tarjetas de profesionales activos, foto o iniciales, especialidad, biografía, tarifa y botón `Agendar cita`.
- Conectar el botón con el flujo de búsqueda de citas existente.
- Incluir estados vacío y de error.

### Administración
- Crear `/admin` con listado de profesionales y formulario modal de alta.
- Usar `react-hook-form` y `zod` para campos obligatorios, URL de foto, tarifa y límites de texto.
- Permitir al administrador activar o desactivar profesionales y registrar perfiles sin cuenta vinculada inicialmente.

### Integración visual y verificación
- Mantener el AppShell, la paleta clínica, el modo oscuro y los componentes actuales.
- Añadir accesos a Profesionales y Perfil/Admin sin saturar la navegación móvil.
- Verificar permisos, compilación y recorridos principales en escritorio y móvil.

## Detalles técnicos
- TanStack Start server functions para lecturas/escrituras privadas y validación Zod compartida.
- Políticas por fila para datos de pacientes; lectura pública limitada a doctores activos; escrituras de doctores solo para administradores.
- El primer administrador deberá asignarse a una cuenta existente desde la gestión de datos de Lovable Cloud.
