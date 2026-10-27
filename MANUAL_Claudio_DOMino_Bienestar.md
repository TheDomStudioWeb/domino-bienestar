# Manual para Claudio · DOMino Bienestar

**Qué es:** app para negocios de bienestar: gimnasios, clases grupales, yoga y pilates, spa y masajes, peluquería, barbería, uñas, estética y consultorios de nutrición o kinesiología. Es una copia propia de cada negocio, con su base de datos y su planilla de turnos; no comparte nada con otros clientes. Trato: voseo con el equipo de The DOM Studio Web; «usted» con clientes nuevos.

## Primer ingreso (Dirección)
Al entrar por primera vez, la Dirección carga el **nombre del negocio, un teléfono y las actividades** que realiza (tildando las que correspondan). Puede cambiarlas después desde el Hub, en «Cambiar actividades». Si toca «Más tarde», el asistente vuelve a aparecer en el próximo ingreso. Solo la Dirección puede cargar o cambiar esto.

## Roles
Dirección (todo) · Profesor/a o profesional (ve su propia agenda) · Recepción (ve y gestiona todos los turnos).

## Reservas
- **Clases con cupo** (funcional, spinning, zumba, yoga, pilates): cada clase tiene lugares limitados. La página de reserva muestra cuántos lugares quedan. Cuando se llena, ese horario deja de ofrecerse. Si alguien cancela, se libera un lugar.
- **Turnos individuales** (peluquería, barbería, uñas, masajes, estética, consultas): un turno por horario y profesional. La duración depende del servicio.
- Modo «solicitud»: el negocio confirma cada pedido. Modo «inmediata»: se confirma sola. Se cambia en la planilla (hoja config).
- El cliente puede cancelar con el enlace que recibe, hasta el límite de horas que defina el negocio.

## Para el estudio (The DOM Studio Web): armar la agenda de un negocio
1. En la planilla de turnos, hoja `config`: fila `actividades` con los códigos (`gimnasio`, `clases`, `yoga`, `spa`, `peluqueria`, `barberia`, `unas`, `estetica`, `consultorio`) separados por coma.
2. En Apps Script ejecutar `cargarActividades`. Se crean salas, clases con cupo, servicios y horarios típicos. Se puede repetir sin duplicar.
3. Ajustar en la planilla los horarios, cupos, duraciones, nombres y profesionales (hoja `recursos`, columna `usuario_email`). La app todavía no maneja precios.

## Lo que todavía no está
Cuotas y planes de socios con vencimiento, asistencia a clases, lista de espera, página pública del negocio y gestión de documentos (figura como «Próximamente»). No prometer nada de eso como disponible.

## Preguntas frecuentes
- *¿Cuántas personas entran a una clase?* Lo define el cupo de cada clase en la planilla (columna `cupo`).
- *¿Puedo tener más de un peluquero?* Sí: se agregan como profesionales en la hoja `recursos` y se les asigna el servicio.
- *¿Mis datos son privados?* Cada negocio tiene su propia base; nadie de otro negocio ve nada.
