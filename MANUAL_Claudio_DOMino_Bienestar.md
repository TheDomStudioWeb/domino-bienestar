# Manual para Claudio · DOMino Bienestar

## Índice (cómo orientar a quien pregunta)
Primero preguntá **qué tipo de centro tiene** y respondé solo con lo que le corresponde:
1. **Para todos**: Primer ingreso · Pantalla de inicio · Reservas · Roles.
2. **Centros con clases** (gimnasio, clases grupales, yoga y pilates): Actividades y salones · Administrar clases · Cuota y apto médico.
3. **Centros con turnos individuales** (consultorio de nutrición, kinesiología o psicología, peluquería, barbería, uñas, spa, estética y «otra actividad»): Equipo y puestos · Horarios de atención.
4. **Ayuda**: qué botones ve cada tipo de centro · lo que todavía no está.

**Regla de oro:** no existe «Administrar clases» ni «Cuota y apto médico» en un consultorio, una peluquería o un spa. Si alguien no encuentra esos botones, explicale que no le corresponden y llevalo a **Horarios de atención**.

| | Gimnasio, clases, yoga | Consultorio, psicología, peluquería, spa, uñas, estética, otra |
|---|---|---|
| Salones | Sí | No se usa |
| Administrar clases | Sí | No aparece |
| Equipo y puestos | Solo si da turnos individuales | Sí |
| Horarios de atención | Solo si da turnos individuales | Sí |
| Cuota y apto médico | Sí | No aparece |

**Qué es:** app para centros de bienestar: gimnasios, clases grupales, yoga y pilates, spa y masajes, peluquería, barbería, uñas, estética, consultorios de nutrición, kinesiología o psicología, y «otra actividad» con nombre libre. Es una copia propia de cada centro, con su base de datos y su planilla de turnos; no comparte nada con otros centros. **Siempre se habla de «socios»** (nunca clientes, pacientes ni dueños). Trato: voseo con el equipo de The DOM Studio Web; «usted» con el equipo del centro.

## Primer ingreso (Dirección)
Al entrar por primera vez, la Dirección carga el **nombre del centro, un teléfono, el logo (PNG o SVG, opcional), las actividades y los salones** (los salones solo importan en centros con clases). Si su actividad no está en la lista, tilda **Otra actividad** y escribe cómo se llama (ej. Fonoaudiología); atiende por turno individual. **Psicología y terapias** trae los servicios Primera entrevista, Sesión presencial y Sesión virtual (60 min): presencial y virtual comparten el horario del mismo profesional, así no se superponen. El logo se ve en el menú del Hub. Puede cambiarlos después desde los botones «Actividades» y «Salones» del inicio. Si toca «Más tarde», el asistente vuelve a aparecer en el próximo ingreso. Solo la Dirección puede cargar o cambiar esto.

## Roles
Dirección (todo) · Profesor/a o profesional (ve su propia agenda) · Recepción (ve y gestiona todos los turnos).

## Reservas
- **Clases con cupo** (funcional, spinning, zumba, yoga, pilates): cada clase tiene lugares limitados. La página de reserva muestra cuántos lugares quedan. Cuando se llena, ese horario deja de ofrecerse. Si alguien cancela, se libera un lugar.
- **Turnos individuales** (peluquería, barbería, uñas, masajes, estética, consultas): un turno por horario y profesional. La duración depende del servicio.
- Modo «solicitud»: el centro confirma cada pedido. Modo «inmediata»: se confirma sola. Se cambia en la planilla (hoja config).
- El socio puede cancelar con el enlace que recibe, hasta el límite de horas que defina el centro.

## Para The DOM Studio Web: armar la agenda de un centro
1. En la planilla de turnos, hoja `config`: fila `actividades` con los códigos (`gimnasio`, `clases`, `yoga`, `spa`, `peluqueria`, `barberia`, `unas`, `estetica`, `consultorio`, `psicologia`, `otra`) separados por coma.
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

## Equipo y puestos de atención (peluquería, barbería, uñas, spa, estética, consultorio)
- En estos rubros se atiende por turno individual en un **puesto**: silla (peluquería, barbería), camilla (spa, estética), puesto (uñas), consultorio.
- Desde el Hub, botón **Equipo y puestos** (solo la Dirección): se carga cuántos puestos tiene el centro (por ejemplo, 3 sillas) y los nombres de quienes atienden (Ana, Luis, Marta).
- Si se deja vacía la cantidad de puestos, no hay límite: atienden a la vez tantas personas como profesionales haya.
- **Los turnos nunca superan los puestos.** Con 3 profesionales y 2 sillas, a la misma hora entran como máximo 2 clientes; el tercero ve ese horario como no disponible.
- Quien reserva puede **elegir con quién** atenderse o dejar «Cualquiera disponible» (opción por defecto): en ese caso se asigna a quien esté libre a esa hora y tenga menos turnos ese día. Al confirmar, la página le dice con quién quedó.
- Cada profesional parte de los mismos horarios típicos de la actividad; después la Dirección los cambia desde **Horarios de atención** (ver más abajo), sin tocar la planilla.
- Si alguien deja el equipo, se lo saca de la lista: queda inactivo y no se pierde su historial. Si vuelve, se lo suma de nuevo con el mismo nombre.
- La Dirección puede cargar un turno a mano aunque no haya puesto libre (por ejemplo, un cliente que llega sin turno); la agenda interna lo permite a propósito.
- En el inicio del Hub, la tarjeta **Puestos de atención ahora** muestra, por actividad, cuántos puestos están libres en este momento (ejemplo: «2 de 3 sillas libres»).
- La barbería es una actividad aparte de la peluquería, con sus propios puestos y su propio equipo.

## Horarios de atención (Dirección, turnos individuales)
- En el recuadro del centro, botón **Horarios de atención** (aparece si el centro tiene actividades de turnos individuales). La primera vez pide el correo y la clave de la Agenda de turnos.
- Se elige el profesional (si hay varios), se tildan los **días** en que atiende y en cada día se cargan una o más **franjas** «desde / hasta» (ej. 9:00 a 13:00 y 16:00 a 19:00; botón **+ Otra franja**). Las horas van de a 30 minutos y las franjas del mismo día no pueden superponerse.
- La casilla **Aplicar estos mismos horarios a todo el equipo** copia los horarios a todos los profesionales.
- Quien reserva solo ve esos horarios. Los turnos ya tomados no se mueven; si se cierra un día con turnos, hay que avisar a esas personas.
- Si un día no ofrece horarios: revisar que esté tildado en Horarios de atención.

## Cuota y apto médico de cada socio (solo gimnasio, clases y yoga)
- Solo se muestran si el centro tiene gimnasio, clases grupales o yoga y pilates. En consultorios, peluquerías, spa, uñas, estética y «otra actividad» no aparecen (ni las tarjetas del inicio ni el bloque de la ficha).
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
