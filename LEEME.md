# DOMino Bienestar

App de gestión y turnos para gimnasios, clases grupales, yoga y pilates, spa y masajes, peluquería, barbería, uñas, estética y consultorios de nutrición o kinesiología. **Un solo código para todas las actividades**: el dueño elige las suyas la primera vez que entra.

Es una copia **separada** de DOMino Profesional y de DOMino Veterinaria: tiene su propio repositorio, su propio proyecto de Firebase y su propia planilla de turnos. No comparte base de datos ni usuarios con ninguna otra copia.

## Cómo funciona
1. La Dirección entra por primera vez → el asistente pide **nombre del negocio, teléfono y actividades**. Se guarda en Firestore (`config/negocio`).
2. Las actividades salen del **catálogo**: `turnos/catalogo-actividades.json` (única fuente).
3. Para armar la agenda: en la planilla de turnos, hoja `config`, fila `actividades = gimnasio,clases,spa` y ejecutar `cargarActividades` en Apps Script. Crea salas, clases con cupo, servicios y horarios típicos (no pisa lo existente).
4. **Clases con cupo**: un servicio con columna `cupo` mayor a 1 es una clase; cada fila de `horarios` de su sala es una clase que empieza en `desde`. Se reserva hasta llenar el cupo y se muestran los lugares libres.
5. **Turnos individuales** (peluquería, masajes, etc.): servicio sin cupo, un turno por horario y profesional.

## Sumar una actividad nueva
Editar `turnos/catalogo-actividades.json` y correr `node alta/sincronizar-catalogo.js`. Nada más (el Hub, el asistente y Apps Script leen el mismo catálogo). Las duraciones van en múltiplos de 30 min.

## Alta de un cliente
Ver `GUIA_Alta_de_cliente_nuevo.md` (rubro `bienestar`). `node alta/preparar-cliente.js alta/cliente.json` configura Firebase, nombre, logo y turnos, y termina con un control que avisa si quedó algún dato de otro proyecto.

## Pruebas
`cd turnos/test && node run.js && node run_clases.js` (motor de turnos, clases con cupo y carga de actividades). `node alta/sincronizar-catalogo.js --verificar` comprueba que el catálogo está sincronizado.

## Pendiente (próxima etapa)
- Cuotas y planes de socios con vencimiento; asistencia a clases; lista de espera.
- Página pública del negocio (FrontEnd) y widget con los turnos del día.
- Manual PDF y manual MD para Claudio.
