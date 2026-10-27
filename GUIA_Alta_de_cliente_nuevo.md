# Guía de alta de un cliente nuevo · DOMino Profesional + Turnos

**Para qué sirve:** montar una copia limpia de DOMino para un cliente (por ejemplo, una veterinaria), con su propia base de datos, su propia agenda de turnos y su rubro. Cada cliente tiene **su propia copia**: un cliente nunca ve datos de otro.

**Tiempo estimado:** 45 a 60 minutos la primera vez; menos después.
**Costo:** cero dentro de las cuotas gratuitas de Firebase, Google y GitHub (ver «Costos y límites» al final).
**Cosas que necesita tener a mano:** una cuenta de Google para el cliente (o la suya de The DOM Studio Web), una cuenta de GitHub, Node.js instalado en su computadora y el código de DOMino Profesional.

> Regla de oro: **nunca** copiar datos, usuarios ni claves de otro cliente, ni las de ejemplo. Y **nunca** pegar claves en chats ni mails.

---

## Paso 0 · Datos del cliente (5 min)
Anotar antes de empezar:
- Nombre del negocio (ej. «Veterinaria Pepe») y rubro (`veterinaria`, `contador` o `general`).
- Correo del dueño (será el usuario **Senior**).
- Teléfono y correo de contacto del negocio.
- **Logo del negocio en PNG** (idealmente con fondo transparente). Se muestra en el Hub y en el portal en lugar del de DOMino. En `alta/cliente.json` se indica en el campo `logo` (ruta al archivo). Sin logo, el Hub muestra la marca DOMino.
- Profesionales (nombre, correo si tienen usuario), servicios con su duración y horarios de atención. Esto se carga en el paso 6.

## Paso 1 · Crear el proyecto de Firebase (10 min)
1. Entrar a https://console.firebase.google.com con la cuenta de Google del cliente o del estudio.
2. **Agregar proyecto** → nombre tipo `domino-vet-pepe` → desactivar Google Analytics (no hace falta).
3. **Authentication** → *Comenzar* → pestaña *Sign-in method* → activar **Correo electrónico/contraseña**.
4. **Firestore Database** → *Crear base de datos* → ubicación `southamerica-east1` (São Paulo) → **modo producción**.
5. **Storage** → *Comenzar* → misma ubicación. (Atención: Firebase puede pedir pasar al plan **Blaze** para activar Storage. Es plan de pago por uso con la cuota gratuita incluida; si lo pide, avisar al cliente antes de continuar. Verificarlo en el momento: las condiciones de Firebase cambian.)
6. **Configuración del proyecto** (rueda dentada) → *Tus apps* → agregar app **Web** (`</>`) → nombre `DOMino` → **no** marcar Hosting → copiar los seis valores de `firebaseConfig` (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`). Se usan en el paso 3.

## Paso 2 · Reglas de seguridad y primer usuario (10 min)
1. **Firestore → Reglas:** borrar todo y pegar el contenido de `firestore.rules` del repositorio → *Publicar*.
2. **Storage → Reglas:** copiar las reglas de Storage del proyecto de referencia (*Storage → Reglas*) y publicarlas. Como mínimo, solo deben permitir leer y escribir a usuarios con sesión iniciada; nunca dejar `allow read, write: if true`.
3. **Authentication → Users → Agregar usuario:** correo del dueño y una clave temporal larga. (Después el dueño la cambia con «Olvidé mi clave».)
4. **Firestore → Iniciar colección** `users` → **ID del documento = el correo del dueño en minúsculas** → campos:
   - `email` (string): el mismo correo, en minúsculas
   - `nombre_display` (string): su nombre
   - `rol_jerarquia` (string): `senior`
   - `activo` (boolean): `true`
5. Este es el único usuario que se crea a mano. Los demás (recepción, asistentes, profesionales) los da de alta el dueño desde el Hub, en **Equipo**.

## Paso 3 · Preparar la copia del código (10 min)
1. En GitHub crear un repositorio **nuevo y privado o público** para el cliente (ej. `domino-vet-pepe`) y copiar dentro el código de DOMino Profesional. **No** usar *fork* del repositorio de referencia.
2. En la carpeta del repositorio, copiar `alta/cliente.ejemplo.json` como `alta/cliente.json` y completarlo:
   - `nombre`, `rubro`
   - los seis valores de `firebase` copiados en el paso 1
   - `turnos_url`: dejar vacío por ahora (se completa en el paso 6)
   - `documentos`: dejar en `false`. Mientras esté en `false`, el Hub muestra **«Próximamente»** en todo lo que guarda o envía archivos y no deja cargar nada (así nadie cree que un documento quedó guardado). Pasarlo a `true` **solo** cuando Storage esté activo, con sus reglas publicadas y probado subiendo y bajando un archivo
3. Ejecutar: `node alta/preparar-cliente.js alta/cliente.json`
   - Cambia Firebase en las cinco pantallas, el rubro, el nombre de la aplicación instalable y la dirección de turnos.
   - Termina con un **control final**: si dice «no quedan datos del proyecto de referencia», está bien. Si avisa «ATENCIÓN», no publicar hasta resolverlo.
4. **Borrar** `alta/cliente.json` antes de subir (contiene datos del cliente) y subir el repositorio.

## Paso 4 · Publicar el sitio (5 min)
1. En el repositorio: *Settings → Pages* → rama `main`, carpeta `/ (root)` → guardar. La dirección queda `https://<usuario>.github.io/<repositorio>/`.
2. En Firebase: **Authentication → Settings → Authorized domains** → agregar `<usuario>.github.io`. **Sin esto el ingreso no funciona.**
3. Abrir la dirección, ingresar con el correo y la clave del dueño. Tiene que entrar al Hub. Si dice «Usuario sin perfil asignado», revisar el paso 2.4.

## Paso 5 · Datos del estudio (5 min)
Con el dueño dentro del Hub:
- **Equipo:** dar de alta a recepción y asistentes. Cada uno recibe un correo para elegir su clave.
- **Clientes / Dueños y mascotas:** empezar **vacío**. No importar datos de ejemplo.

## Paso 6 · Turnos (veterinaria y otros rubros con agenda) (15 min)
1. Subir `turnos/Planilla_ejemplo_veterinaria.xlsx` a Google Drive del cliente → abrir como **Google Sheets** → renombrar `Turnos · <negocio>`.
2. **Dejarla limpia.** Reemplazar los datos de ejemplo:
   - `config`: `nombre`, `rubro`, `telefono` del negocio. Revisar `modo_reserva` (`solicitud` = el negocio confirma cada pedido; `inmediata` = se confirma sola), `paso_min`, `anticipacion_min_horas`, `cancelacion_limite_horas` y `ventana_dias`.
   - `recursos`: los profesionales o servicios reales (columna `usuario_email` = el correo con el que cada profesional ingresa).
   - `servicios`: los reales, con su duración y qué recursos los atienden.
   - `horarios`: la atención semanal de cada recurso (`dia_semana`: 0 = domingo, 1 = lunes … 6 = sábado).
   - `usuarios`: **borrar todas las filas de ejemplo** y cargar las personas reales con una clave nueva larga. Las claves se protegen solas al primer ingreso.
   - `turnos`, `slots` y `bloqueos`: dejar solo la fila de encabezado.
3. **Extensiones → Apps Script.** Borrar lo que haya y pegar `turnos/apps-script/Code.gs` completo. En *Configuración del proyecto* activar «Mostrar el archivo appsscript.json» y pegar el de `turnos/apps-script/appsscript.json`.
4. Ejecutar `protegerClaves` (autoriza permisos; es normal que Google muestre «aplicación no verificada»: *Avanzado → Ir a…*). Luego ejecutar `configurarDisparador` (aviso diario a las 18:00) y, si se usa widget, `prepararWidget`.
5. **Implementar → Nueva implementación → Aplicación web.** Ejecutar como: **yo**. Quién tiene acceso: **cualquier persona**. Copiar la dirección que termina en `/exec`.
6. Volver a la copia del código: completar `turnos_url` en `alta/cliente.json` y repetir `node alta/preparar-cliente.js alta/cliente.json` (es seguro repetirlo). Subir los cambios y borrar `alta/cliente.json`.
7. Abrir `turnos/prueba.html` en la dirección del cliente: debe mostrar «Servicio responde: sí» y «DOBLE RESERVA BLOQUEADA».
8. Cada vez que se cambie `Code.gs`: **Implementar → Administrar implementaciones → Nueva versión**. Sin ese paso, el cambio no se aplica.

## Paso 7 · Control final (antes de entregar)
Marcar uno por uno:
- [ ] El dueño ingresa al Hub con su correo y su clave propia.
- [ ] El Hub muestra el rubro correcto (nombres, grupos y accesos).
- [ ] No hay clientes, usuarios ni turnos de ejemplo en ninguna parte.
- [ ] Se creó un dueño de prueba, se cargó una mascota y su libreta sanitaria, y se borraron después.
- [ ] La página de reserva (`turnos/reserva.html`) se ve bien en el celular y toma un turno de prueba.
- [ ] Ese turno aparece en el panel de turnos, se confirma, se vincula a una ficha y se cancela.
- [ ] Llegó el correo de aviso (o se verificó la cuota de correo de la cuenta).
- [ ] Las claves de la hoja `usuarios` están protegidas (no se leen en texto) y las de ejemplo no existen.
- [ ] El repositorio no contiene `alta/cliente.json` ni datos del cliente.
- [ ] Se le entregó al dueño: la dirección del Hub, la del panel de turnos, el enlace de reserva para compartir y el manual.

## Paso 8 · Entrega al cliente
- Mostrarle cómo instalar el Hub y el panel en el teléfono (*Agregar a la pantalla de inicio*).
- Entregarle el enlace de reserva para WhatsApp e Instagram (y un código QR si lo quiere).
- Cargar los manuales `MANUAL_Claudio_DOMino_Profesional.md` y `MANUAL_Claudio_DOMino_Turnos.md` en Claudio.
- Acordar quién cambia las claves cuando alguien se va del negocio.

---

## Costos y límites (verificar al momento de instalar)
- **Firebase (Spark):** Auth, Firestore y hosting de uso chico entran en la cuota gratuita. Storage puede requerir plan Blaze (ver paso 1.5).
- **Google Apps Script:** gratis, con cuotas diarias de correo y de ejecución. Un negocio chico no las alcanza.
- **GitHub Pages:** gratis.
- Cada cliente tiene su propio proyecto, así que los límites **no se suman entre clientes**.

## Mantenimiento y actualizaciones
- Cuando se mejora DOMino, el cambio se lleva **a mano** a la copia de cada cliente (se reemplazan los archivos de código, **sin** tocar `modulos.js`, `manifest.json`, `turnos/config.js` ni la configuración de Firebase). Después se repite `node alta/preparar-cliente.js` para garantizar que todo apunte a su proyecto.
- Si cambia `turnos/apps-script/Code.gs`: pegarlo en el Apps Script del cliente y hacer «Nueva versión».
- Antes de actualizar, hacer copia de la planilla de turnos (*Archivo → Hacer una copia*).

## Si algo no anda
| Síntoma | Causa probable |
|---|---|
| «Usuario sin perfil asignado» | Falta el documento en `users` o el ID no es el correo en minúsculas |
| El ingreso falla en la dirección publicada | Falta agregar `<usuario>.github.io` en *Authorized domains* |
| El Hub no muestra «Agenda y turnos» | `RUBRO` no es `veterinaria` o `turnos` no está activo en el perfil |
| El panel de turnos dice «Falta ingresar al Hub» | No se ingresó antes al Hub con el usuario del estudio |
| La reserva dice que el servicio no responde | `turnos_url` vacía, mal copiada, o falta «Nueva versión» en Apps Script |
| Los cambios del código no se ven | La aplicación instalada guarda caché: Ctrl+F5, o cerrar y volver a abrir |
| «Permission denied» al guardar fichas | Las reglas de Firestore no se publicaron o el usuario no está activo |

*Desarrollado por The DOM Studio Web · WhatsApp 261-3431216 · thedomstudioweb@gmail.com*
