# Manual para Claudio · DOMino Bienestar

**Qué es:** app para centros de bienestar: gimnasios, clases grupales, yoga y pilates, spa y masajes, peluquería, barbería, uñas, estética y consultorios de nutrición o kinesiología. Es una copia propia de cada centro, con su base de datos y su planilla de turnos; no comparte nada con otros centros. **Siempre se habla de «socios»** (nunca clientes, pacientes ni dueños). Trato: voseo con el equipo de The DOM Studio Web; «usted» con el equipo del centro.

## Primer ingreso (Dirección)
Al entrar por primera vez, la Dirección carga el **nombre del centro, un teléfono, el logo (PNG o SVG, opcional), las actividades y los salones**. El logo se ve en el menú del Hub. Puede cambiarlos después desde los botones «Actividades» y «Salones» del inicio. Si toca «Más tarde», el asistente vuelve a aparecer en el próximo ingreso. Solo la Dirección puede cargar o cambiar esto.

## Roles
Dirección (todo) · Profesor/a o profesional (ve su propia agenda) · Recepción (ve y gestiona todos los turnos).

## Reservas
- **Clases con cupo** (funcional, spinning, zumba, yoga, pilates): cada clase tiene lugares limitados. La página de reserva muestra cuántos lugares quedan. Cuando se llena, ese horario deja de ofrecerse. Si alguien cancela, se libera un lugar.
- **Turnos individuales** (peluquería, barbería, uñas, masajes, estética, consultas): un turno por horario y profesional. La duración depende del servicio.
- Modo «solicitud»: el centro confirma cada pedido. Modo «inmediata»: se confirma sola. Se cambia en la planilla (hoja config).
- El socio puede cancelar con el enlace que recibe, hasta el límite de horas que defina el centro.

## Para The DOM Studio Web: armar la agenda de un centro
1. En la planilla de turnos, hoja `config`: fila `actividades` con los códigos (`gimnasio`, `clases`, `yoga`, `spa`, `peluqueria`, `barberia`, `unas`, `estetica`, `consultorio`) separados por coma.
2. En Apps Script ejecutar `cargarActividades`. Se crean salas, clases con cupo, servicios y horarios típicos. Se puede repetir sin duplicar.
3. Ajustar en la planilla los horarios, cupos, duraciones, nombres y profesionales (hoja `recursos`, columna `usuario_email`). La app todavía no maneja precios.

## Pantalla de inicio (Hub)
- Arriba, cuatro tarjetas: **Cuotas por vencer** (vencidas o que vencen en 7 días), **Aptos médicos por vencer** (vencidos o en 15 días), **Avisos de hoy** (seguimientos vencidos o de hoy) y **Clases que quedan hoy**. Las de cuotas y aptos abren la lista de socios con un botón «Ver ficha».
- **Clases de hoy y los próximos días**: cada clase con su hora, sala y cuántos lugares quedan («8 de 15»). En amarillo si quedan pocos, en rojo si está completa o suspendida. Se necesita la agenda de turnos conectada.
- Debajo, los **Seguimientos** de hoy y los próximos días.
- Los seguimientos van en tres pasos: **Por hacer** (nadie empezó), **En gestión** (alguien ya se ocupa, por ejemplo escribió y espera respuesta) y **Resuelto**. Sirven para avisar cuotas vencidas, pedir aptos médicos o llamar a quien dejó de venir.
- Si el centro suma una actividad nueva desde «Cambiar actividades», The DOM Studio Web la deja lista en la agenda y en la página de reservas.

## Actividades y salones
- Al entrar por primera vez hay dos pestañas: **Actividades** y **Salones**. Después se cambian desde los botones **Actividades** y **Salones** del recuadro del centro, en el inicio.
- En Salones se indica cuántos salones tiene el centro (con − y +) y se escribe el nombre de cada uno: con número (Salón 1), con nombre o con actividad (Musculación, Aeróbica, Baile). No puede haber dos con el mismo nombre.
- Cada salón tiene la casilla **Habilitado**. Si un salón se cierra (por arreglos, por ejemplo), se destilda: deja de ofrecerse al cargar clases y sus clases figuran como «Salón inhabilitado» en el inicio. Esas clases hay que pasarlas a otro salón o quitarlas en Administrar clases; hasta entonces siguen apareciendo en la página de reservas.
- Al agregar o editar una clase, el salón se elige de esa lista y es obligatorio. Dos clases no pueden darse a la vez en el mismo salón.

## Administrar clases (Dirección)
- En el inicio, en el recuadro del centro, botón **Administrar clases**. Pide una sola vez el correo y la clave de la Agenda de turnos.
- Muestra las clases agrupadas por actividad (Clases grupales, Yoga y pilates, Otras clases) con profesor, cupo, duración y horarios.
- **+ Agregar clase**: nombre (Salsa, Spinning…), profesor/a, cupo, duración, sala (opcional), días y hora de inicio (se pueden sumar varios horarios) y si se muestra en la página de reservas.
- **Editar**: cambia profesor, cupo, duración u horarios, también de las clases que venían cargadas. **Quitar**: la clase deja de aparecer; los turnos ya tomados no se borran.
- Dos clases no pueden darse a la vez en la misma sala. Si una clase nueva coincide en día y horario con otra, la app pide indicar la sala; si es la misma sala, no deja guardar (por ejemplo, un gimnasio con un solo salón).
- Los cambios se ven enseguida en la agenda, en la página de reservas y en «Clases de hoy».

## Cuota y apto médico de cada socio
- Se cargan al registrar al socio (opcional) o en su ficha, en el bloque **Cuota y apto médico**: fecha de vencimiento de la cuota y del apto. La ficha muestra si está al día, por vencer o vencido.
- Todavía no hay planes ni cobros: solo la fecha de vencimiento, para avisar a tiempo.

## Lo que todavía no está
Planes y cobro de cuotas (por ahora solo se carga la fecha de vencimiento), asistencia a clases, lista de espera, página pública del centro y gestión de documentos (figura como «Próximamente»). No prometer nada de eso como disponible.

## Preguntas frecuentes
- *¿Cuántas personas entran a una clase?* Lo define el cupo de cada clase en la planilla (columna `cupo`).
- *¿Puedo tener más de un peluquero?* Sí: se agregan como profesionales en la hoja `recursos` y se les asigna el servicio.
- *¿Mis datos son privados?* Cada centro tiene su propia base; nadie de otro centro ve nada.

## Varios centros en una sola app (multi-centro)

Una sola copia de DOMino Bienestar (domino-bienestar.web.app) atiende a muchos gimnasios, estudios y spas. Cada centro tiene sus datos separados y solo su personal los ve.

**Cómo se organiza**
- Cada centro es un documento `negocios/{id}` (nombre, estado `prueba` | `activo` | `suspendido`, `vence`, `dias_prueba`). Todo lo suyo (socios, tareas, documentos, mensajes, configuración) vive debajo: `negocios/{id}/…`.
- Cada persona del personal tiene `users/{correo}` con `negocio_id` y `rol_jerarquia` (`senior`, `midsenior`, `asistente`). Las reglas de Firestore solo dejan ver el centro propio.
- Cada centro tiene su propia planilla de turnos (Google Sheets) creada por el script; el directorio vive en la hoja `negocios` de la planilla del script.
- `superadmins/{correo}`: cuentas de The DOM que pueden dar de alta centros (se cargan a mano en la consola de Firestore).

**Alta de un centro nuevo (Daniel)**
1. Entrar a `domino-bienestar.web.app/centros/` con la cuenta superadmin.
2. Completar nombre del centro, nombre, apellido y correo del propietario, clave temporal y días de prueba. «Crear centro y usuario» arma la planilla de turnos, el centro, la cuenta y el permiso de Dirección (se puede repetir sin duplicar).
3. Pasarle al propietario la dirección, el correo y la clave temporal.

**Prueba de una semana**: el vencimiento se fija solo en el primer ingreso de la Dirección (hasta 7 días). Vencida la prueba, nadie del centro entra hasta que se lo pase a «activo» desde la misma pantalla (o «Dar 7 días más»). Un aviso en el Hub muestra cuánto falta.

**Enlaces por centro**: la reserva pública y el portal del socio llevan `?n=id-del-centro` (el Hub los copia ya armados).

**Turnos**: el personal entra a la agenda con la misma cuenta del Hub (sesión de 12 h que se renueva sola). Al guardar las actividades del centro, la planilla recibe los servicios y horarios típicos. Los recordatorios por correo recorren todos los centros.

**Si algo no entra**: «sin centro» = a `users/{correo}` le falta `negocio_id`; «prueba terminada» = estado o `vence` del centro.
