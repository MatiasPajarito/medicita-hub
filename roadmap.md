# Roadmap

- [ ] Limpiar acceso y portada, conservando el logo oficial.
- [ ] Diferenciar ficha de paciente y perfil profesional con permisos reales.
- [ ] Conectar filtros dependientes y reservas a horarios reales.
- [ ] Guardar citas confirmadas sin duplicar horas y mostrarlas en la agenda.
- [ ] Probar validaciones y flujo de reserva autenticado.

- [x] Crear esquema PostgreSQL seguro para `patients`, `doctors` y roles separados.
- [x] Exponer el cliente configurado mediante `@/lib/supabase`.
- [x] Implementar autenticación real y navegación según sesión.
- [x] Implementar `/perfil` con RUT chileno obligatorio, único y validado con Zod.
- [x] Implementar `/medicos` con profesionales activos desde PostgreSQL.
- [x] Implementar `/admin` con alta y activación de profesionales restringida a administradores.
- [x] Verificar compilación, seguridad y recorridos en escritorio/móvil.
