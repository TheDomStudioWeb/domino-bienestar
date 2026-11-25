# Conectar el Drive del consultorio (radiografías y estudios)

Se hace **una sola vez por consultorio**, con la cuenta de Google **del consultorio** (no la de The DOM): así los archivos de los pacientes quedan en el Drive de ellos.

1. Entrar a https://script.google.com con la cuenta del consultorio → **Nuevo proyecto**. Nombre: `DOMino Odontología`.
2. Borrar lo que trae y pegar el contenido de `odontologia/apps-script/Consultorio.gs`. Guardar.
3. **Configuración del proyecto** (ícono de engranaje) → **Propiedades del script** → agregar:
   - `CENTRO` = el identificador del consultorio en DOMino Bienestar (el mismo de la pantalla Centros).
   - `PROYECTO` = `domino-bienestar`
4. Volver al editor, elegir la función **probar** y tocar **▶ Ejecutar**. Aceptar los permisos (Avanzado → Ir a… → Permitir). En el registro tiene que decir «Carpeta lista».
5. **Implementar → Nueva implementación** → tipo **Aplicación web**:
   - Ejecutar como: **Yo** (la cuenta del consultorio)
   - Quién tiene acceso: **Cualquier usuario**
   - Implementar y copiar la dirección que termina en `/exec`.
6. En DOMino Bienestar, con el usuario de **Dirección**: Pacientes → un paciente → **Historia clínica** → pestaña **Imágenes** → pegar la dirección → **Conectar**.

**Seguridad:** aunque la dirección sea pública, el script solo atiende a quien puede ver la historia clínica de ese paciente (lo consulta a Firestore con la sesión de la persona). Solo acepta imágenes y PDF de hasta 25 MB. Los archivos quedan en la carpeta «DOMino Odontología · Archivos de pacientes», separados por paciente.

**Si se cambia el script:** Implementar → Administrar implementaciones → lápiz → Versión: **Nueva versión** (no crear una implementación nueva, porque cambia la dirección).

Este mismo script va a guardar más adelante la clave de Mercado Pago del consultorio (etapa 2b).
