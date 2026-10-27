# DOMino Turnos — backend (versión 0.2, borrador de prueba)

Datos de **ejemplo** (Veterinaria Ejemplo). No es un negocio real.

## Qué hay
- `apps-script/Code.gs` y `appsscript.json`: el servicio (Google Apps Script).
- `Planilla_ejemplo_veterinaria.xlsx`: la planilla con las 8 hojas y datos de ejemplo.
- `test/`: pruebas automáticas en Node (`node test/run.js`), con una simulación de los servicios de Google.

## Puesta en marcha (una vez por negocio, ~10 minutos)
1. Subir la planilla a Google Drive y abrirla como Google Sheets.
2. Extensiones → Apps Script. Pegar `Code.gs` y, en Configuración del proyecto, activar «mostrar appsscript.json» y pegar el de esta carpeta.
3. Ejecutar `protegerClaves` (autoriza los permisos) y después `configurarDisparador` (aviso diario por correo a las 18:00).
4. Implementar → Nueva implementación → Aplicación web. Ejecutar como: **yo**. Acceso: **cualquier persona**. Copiar la dirección `/exec`.
5. Cambiar las claves de ejemplo de la hoja `usuarios` (se protegen solas al primer ingreso).

## Cómo se habla con el servicio
Todo es POST con un texto JSON (`Content-Type: text/plain`, evita el preaviso CORS). Ejemplo:
`{"accion":"horarios_libres","servicio_id":"S1","desde":"2026-10-27","dias":7}`
Acciones públicas: `config_publica`, `horarios_libres`, `reservar`, `ver_turno`, `cancelar_turno`.
Con sesión: `login`, `agenda`, `crear_turno`, `cambiar_estado`, `reprogramar`, `guardar_bloqueo`, `recordatorios_manana`, `marcar_avisado`.

## Qué está probado y qué no
- Probado en simulación (25 pruebas): disponibilidad, doble reserva, solapes de servicios largos, bloqueos, estados, reprogramación, permisos por rol, clave protegida, bloqueo por intentos, sesión vencida, correo único.
- **No probado** en Google real: la concurrencia verdadera del cerrojo (LockService), las cuotas de correo y la velocidad con muchos turnos. Es lo primero que hay que verificar al desplegar.
- Pantallas: `reserva.html` (cliente), `panel.html` (personal: agenda, nuevo turno, avisos de mañana, bloqueos) y `prueba.html` (diagnóstico). Probadas en simulación; falta probarlas con el servicio real desde el celular.
- Para mostrar el grupo «Agenda y turnos» en el Hub: `modulos.js` → `turnos: true`.
- Ficha del cliente: `fichas.js` usa la sesión del Hub (mismo sitio) para buscar, crear y vincular fichas en Firestore; el script suma las acciones `vincular_cliente` e `historial`. Sin sesión del Hub, el panel funciona igual y avisa «Falta ingresar al Hub».
- Manual para Claudio: `MANUAL_Claudio_DOMino_Turnos.md`.

## Widget del teléfono (turnos del día)
1. En Apps Script, pegar el `Code.gs` nuevo y ejecutar una vez **`prepararWidget`**. En el registro de ejecución aparece la **clave del widget** (`LAUNCHER_KEY`, también queda en Propiedades del script). Hacer **Implementar → Administrar implementaciones → Nueva versión**.
2. Lectura de solo lectura: `<URL /exec>?action=widget&key=<clave>`. Sin clave o con clave mala responde `sin_autorizacion`.
3. Respuesta (JSON): `negocio`, `resumen {hoy, por_confirmar, atendidos_hoy}`, `proximo_turno`, `turnos_hoy[]`, `por_confirmar[]` y `novedades[]` (turnos que entraron en las últimas 48 h; cada uno con `id`, para que el launcher avise cuando aparece un id nuevo). Cada turno trae `hora, fecha, nombre, mascota, servicio, profesional, estado, origen`. **No trae teléfonos ni correos.**
4. Sin launcher: abrir `turnos/widget.html` en el teléfono, pegar la clave una vez (queda solo en ese teléfono) y agregarla a la pantalla de inicio. Se actualiza sola cada minuto.
5. Si la clave se filtra: borrar `LAUNCHER_KEY` en Propiedades del script y volver a ejecutar `prepararWidget`.
