# Arquitectura — mapa del proyecto

Este documento es el mapa: que hay, donde esta y por que. Para instalar y
desplegar, ver el [README](../README.md). Para entender de donde viene el
sistema, ver [MIGRACION-GAVAC.md](MIGRACION-GAVAC.md).

---

## 1. La idea en una pantalla

Biologik cuenta garrapatas en ganado a partir de fotos. Alguien saca fotos de
las zonas del cuerpo de un animal, la IA cuenta las garrapatas de cada foto, la
persona revisa y corrige el numero, y queda registrado.

Todo cuelga de una jerarquia de cuatro niveles:

```
empresas                     ← el limite de aislamiento
  ├── usuarios               super_admin / admin / usuario
  └── fincas                 los establecimientos
        └── animales         identificados por numero de caravana
              └── conteos    una foto + el total de garrapatas de una zona
```

**La empresa es la frontera.** Un usuario nunca ve datos de otra empresa, y eso
no depende del frontend: lo corta Postgres con Row Level Security. El unico que
atraviesa empresas es el `super_admin`, que las administra desde `/admindrpcs`
y no tiene empresa propia.

---

## 2. Las tres capas

```
┌─ Navegador ─────────────────────────────────────────────┐
│  React SPA (Vite)                                        │
│  · lee y escribe DIRECTO contra Postgres (PostgREST)     │
│    con la clave publica → protegido por RLS              │
│  · sube y baja fotos de Storage → protegido por RLS      │
└──────────┬────────────────────────────┬──────────────────┘
           │                            │
           │ operaciones normales       │ /api/* (solo lo que
           │ (la mayoria)               │ NO puede hacer el cliente)
           ▼                            ▼
┌─ Supabase ─────────────┐   ┌─ Vercel Functions ─────────┐
│  Postgres + RLS        │   │  api/contar.ts             │
│  Auth                  │◄──┤  api/admin/usuarios.ts     │
│  Storage (bucket priv.)│   │  api/cuenta/password.ts    │
└────────────────────────┘   │  usan la service_role key  │
                             │  + hablan con OpenAI       │
                             └────────────────────────────┘
```

**Por que hay funciones serverless si el cliente ya habla con la base.**
Solo por tres cosas que el navegador no puede hacer sin exponer un secreto:

| Funcion | Por que no puede vivir en el cliente |
| --- | --- |
| `api/contar.ts` | Tiene la `OPENAI_API_KEY`. Si estuviera en el bundle, cualquiera podria gastar tu cuota. Ademas aplica los limites de consumo, que no servirian de nada si los controlara el propio cliente. |
| `api/admin/usuarios.ts` | Crear/borrar cuentas de Auth y cambiar contrasenas de otros necesita la `service_role` key, que pasa por encima de toda la RLS. |
| `api/cuenta/password.ts` | Igual, pero para la contrasena propia. El id sale del token, nunca del body. |

Todo lo demas —listar fincas, crear animales, guardar conteos, activar o
desactivar usuarios— va directo del navegador a PostgREST. **No hay una capa
de API que reimplemente los permisos**: los permisos viven en la base.

---

## 3. Seguridad: como se sostiene el aislamiento

Está en [`supabase/migrations/002_rls.sql`](../supabase/migrations/002_rls.sql)
y se apoya en dos funciones `security definer`:

```sql
mi_empresa_id()    -- la empresa del usuario logueado, o null
es_super_admin()   -- true solo si su rol es super_admin
```

Son `security definer` porque necesitan leer `usuarios` **salteando la RLS**: si
una politica sobre `usuarios` consultara `usuarios` con RLS activa, Postgres
tira `infinite recursion detected in policy`.

Ambas miran tambien los flags `activo`: un usuario desactivado, o uno cuya
empresa fue desactivada, deja de ver todo **en la base**, no solo en pantalla.
Una sesion todavia valida no le sirve de nada.

Con eso, la politica de `fincas`, `animales` y `conteos` es siempre la misma
linea:

```sql
using       (es_super_admin() or empresa_id = mi_empresa_id())
with check  (es_super_admin() or empresa_id = mi_empresa_id())
```

Por eso `animales` y `conteos` llevan `empresa_id` **denormalizado** aunque se
podria deducir subiendo por `finca_id`: mantiene la politica en una sola
comparacion, sin joins.

### La regla que evita que alguien se quede con el sistema

Sobre `usuarios`, escribir es **solo** del `super_admin`. Nadie puede editar su
propia fila — si pudiera, se pondria `rol = 'super_admin'` y listo. El `select`
sí tiene una excepcion para la fila propia, para que la app pueda explicar por
que te esta bloqueando cuando tu empresa quedo inactiva.

Esto se verifico contra la API directa: un `admin` que intenta promoverse
no modifica ninguna fila, y crear empresas o escribir fincas de otra empresa
devuelve `403`.

### Storage

Bucket `fotos`, **privado**. La ruta de cada archivo es:

```
{empresa_id}/{animal_id}/{timestamp}-{aleatorio}.jpg
```

El primer segmento es lo que compara la politica, asi que el bucket queda
particionado por empresa igual que las tablas. Las fotos se muestran con
**URLs firmadas** de una hora, pedidas en el momento
([`src/lib/storage.ts`](../src/lib/storage.ts)).

El limite de 15 MB y los tipos permitidos se aplican **en el bucket**, no solo
en el navegador: con su sesion legitima, cualquiera podria subir lo que quiera
a su carpeta usando el cliente de Supabase desde la consola.

---

## 4. Autenticacion y roles

| Rol | Alcance |
| --- | --- |
| `super_admin` | Todas las empresas. Las crea, activa y desactiva, da de alta usuarios y configura la IA. **No tiene empresa propia**, asi que no ve fincas ni conteos. |
| `admin` | Su empresa. Opera normalmente y ademas da de alta usuarios comunes de su empresa. |
| `usuario` | Su empresa. Carga fincas, animales y conteos; no ve la gestion de usuarios. |

`usuarios` cuelga de `auth.users` compartiendo el `id`. El `super_admin` es el
unico con `empresa_id` nulo, y un `check` lo obliga: cualquier otro rol necesita
empresa.

**No hay auto-registro.** Las cuentas las crea el super_admin (o un admin,
dentro de su empresa) desde la app.

### `useAuth` — el estado de sesion

[`src/hooks/useAuth.tsx`](../src/hooks/useAuth.tsx) expone sesion, `perfil`
(la fila de `usuarios`), `empresa`, y un `problemaPerfil` que distingue tres
formas de "estas logueado pero no podes entrar": `sin-perfil`, `inactivo`,
`empresa-inactiva`. Sin eso la pantalla quedaria en blanco sin explicacion.

Dos detalles que parecen de mas y no lo son:

- **Reacciona al cambio de usuario, no al nombre del evento.** `supabase-js`
  revalida la sesion cada vez que la pestana recupera el foco, y segun la
  version eso dispara `SIGNED_IN` aunque sea el mismo usuario. Si a eso se le
  hiciera `setLoading(true)`, el layout desmontaria el contenido y se perderia
  cualquier formulario a medio llenar.

- **`cargarPerfil` devuelve si su carga fue la vigente.** Al abrir la app se
  disparan dos cargas casi a la vez (el `INITIAL_SESSION` del listener y el
  `getSession` inicial). La que pierde se descarta a si misma por un token…
  pero antes igual apagaba el `loading`, dejando `loading=false` con el perfil
  todavia en `null`. En esa ventana los layouts leian `esSuperAdmin=false` y
  rebotaban a `/`: entrar directo a `/admindrpcs` fallaba **siempre**. Por eso
  quien llama mira el valor de retorno antes de apagar el loading.

### Guardas de ruta

- `AppLayout` manda a `/login` si no hay sesion, y muestra el cartel de cuenta
  bloqueada si hay `problemaPerfil`.
- `RequiereEmpresa` saca al `super_admin` de las rutas de empresa: no tiene
  `empresa_id`, y como `es_super_admin()` pasa por encima del filtro, veria las
  fincas de **todas** las empresas mezcladas sin distinguir cual es cual.
- `SuperAdminLayout` deja entrar solo al `super_admin`.

---

## 5. El conteo por IA

El corazon del sistema. Vive en
[`api/contar.ts`](../api/contar.ts), que tiene el historial completo de los
intentos comentado arriba de todo.

### El recorrido de una foto

```
CapturaFoto / drag&drop
   └─► prepararParaConteo()          src/lib/archivos.ts
         reduce a 2048 px, reencoda JPEG 0.9, devuelve base64
   └─► POST /api/contar              (con el JWT del usuario)
         ├─ valida el animal contra la BASE, no contra lo que mando el cliente
         ├─ chequea limite mensual de la empresa
         ├─ chequea limite por usuario y hora
         ├─ lee configuracion_ia (modelo, precios, calibracion)
         ├─ llama a OpenAI con structured outputs
         ├─ registra el consumo en uso_ia
         └─ aplica la calibracion y devuelve el numero
   └─► RevisionConteoCard            la persona revisa y CORRIGE
   └─► useConteoAlta.guardar()
         sube la foto original a Storage + inserta la fila
```

### Por que el prompt es asi

El schema tiene un campo `analisis` **antes** de `count_total`. Los structured
outputs de OpenAI generan los campos en el orden del schema, asi que un campo
de texto libre antes del numero fuerza al modelo a razonar en texto antes de
comprometerse. Eso volvio el resultado mucho mas consistente.

Se llego ahi despues de descartar tres enfoques (todos documentados en el
archivo): pedir coordenadas por garrapata degradaba el conteo; texto libre sin
schema contaba mejor pero a veces el modelo **se negaba** a responder; y pedirle
una grilla explicita lo hacia alucinar una grilla que no existia en la foto.

### La calibracion

El numero crudo tiene un sesgo que **no** es un multiplicador: en fotos densas
subestima y en fotos con pocas garrapatas sobreestima. Por eso se corrige con
una recta y no con un factor:

```
final = redondear(crudo × calibracion_slope + calibracion_intercept)
```

Ambos valores viven en `configuracion_ia` y los edita el super_admin desde
`/admindrpcs/configuracion-ia`, que muestra el resultado en vivo. Los valores
actuales (1.35 / −2.5) se ajustaron sobre tres pares crudo/real con **gpt-4o**.

> ⚠️ **La calibracion es especifica del modelo.** Medido sobre la misma foto:
> gpt-4o dio 30 crudo y gpt-5.6-luna dio 115 — casi 4×. Si se cambia el modelo
> desde el panel, hay que recalibrar o el numero se dispara.
>
> Y aun con el mismo modelo hay variacion real entre llamadas (la misma foto
> dio 15 y 30 crudo en dos momentos distintos). **El numero es una estimacion
> asistida, no una medicion**: por eso la pantalla de revision existe y por eso
> el total se puede corregir tambien despues de guardado.

### Los dos limites de consumo

- **Mensual por empresa** (`empresas.limite_tokens_mensual`, `null` = sin tope):
  lo pone el super_admin en la ficha de la empresa.
- **Por usuario y hora** (`configuracion_ia.limite_tokens_usuario_hora`): existe
  porque el limite mensual por si solo no impide que una sola persona cargando
  cientos de fotos deje sin cupo al resto de su empresa en minutos.

Cada llamada deja una fila en `uso_ia` con tokens y costo estimado. Los tokens
servidos desde el cache de OpenAI se cuentan aparte porque se cobran mas
baratos: contarlos como plenos inflaria el costo que muestra el panel.

---

## 6. Mapa de archivos

### Base de datos — `supabase/migrations/`

Se corren en orden en el SQL Editor. `005` va aparte (ver README).

| Archivo | Que hace |
| --- | --- |
| `001_schema.sql` | Las cinco tablas del dominio y el trigger de `updated_at`. |
| `002_rls.sql` | Los helpers `mi_empresa_id()` / `es_super_admin()` y todas las politicas. |
| `003_storage.sql` | Bucket `fotos` privado, limites de peso/tipo y su politica. |
| `004_uso_ia.sql` | `uso_ia` (registro de consumo) y `configuracion_ia` (singleton). |
| `005_super_admin.sql` | Alta del primer super_admin. Se corre a mano, una sola vez. |

### Funciones serverless — `api/`

| Archivo | Que hace |
| --- | --- |
| `_lib/http.ts` | Tipos y helpers minimos. No usa `@vercel/node` para no arrastrar cien dependencias por dos interfaces. `conManejoDeErrores` garantiza que toda excepcion termine en JSON y no en la pagina de error de Vercel, que romperia el parseo del cliente. |
| `_lib/auth.ts` | Valida el JWT **del lado del servidor** y devuelve el perfil. `exigeUsuario` / `exigeGestorDeUsuarios` / `exigeSuperAdmin` son los tres niveles. |
| `contar.ts` | El conteo por IA (seccion 5). |
| `admin/usuarios.ts` | Alta, edicion, borrado y cambio de contrasena de otros. El alcance de un `admin` —solo usuarios comunes de su propia empresa— **se fuerza en el servidor**: el `empresa_id` y el `rol` que mande el cliente se ignoran. |
| `cuenta/password.ts` | Cambiar la contrasena propia. El id sale del token, nunca del body. |

### Frontend — `src/`

**Rutas** ([`App.tsx`](../src/App.tsx))

| Ruta | Pagina |
| --- | --- |
| `/login` | `Login.tsx` |
| `/` | `Inicio.tsx` — saludo, totales y accesos |
| `/fincas` | `Fincas.tsx` — tabla con buscador |
| `/fincas/:id` | `FincaDetalle.tsx` — animales de la finca con sus totales |
| `/animales/:id` | `AnimalDetalle.tsx` — conteos del animal |
| `/animales/:id/cargar` | `conteos/Cargar.tsx` — carga por lote |
| `/empresa` | `Empresa.tsx` — datos de la empresa (solo lectura) |
| `/usuarios` | `Usuarios.tsx` — no la ve el rol `usuario` |
| `/admindrpcs` | `admin/Empresas.tsx` |
| `/admindrpcs/:id` | `admin/EmpresaDetalle.tsx` — usuarios y consumo de IA |
| `/admindrpcs/configuracion-ia` | `admin/ConfiguracionIA.tsx` |

**Hooks** — cada uno encapsula una consulta y sus mutaciones

| Hook | Nota |
| --- | --- |
| `useAuth` | Sesion, perfil, empresa. Ver seccion 4. |
| `useFincas` / `useFinca` | Traduce el error de clave duplicada a "ya existe una finca con ese nombre". |
| `useAnimales` / `useAnimal` | Arma el resumen por animal (total, cantidad, ultimo) con **dos selects planos** en vez de una vista o un rpc: evita mantener una funcion en la base sincronizada con el esquema. |
| `useConteos` | Al borrar, elimina **primero la fila y despues la foto**: un archivo huerfano en Storage es menos grave que una fila apuntando a una foto que no existe. |
| `useConteoAlta` | Las dos mitades del alta: `contar` y `guardar`. Si el insert falla despues de subir la foto, la borra — si no, quedaria ocupando lugar sin nada que la referencie. |
| `useUsuarios` | Lista por RLS; las operaciones sensibles pasan por `/api`. |
| `useEmpresas`, `useConfiguracionIA` | Solo utiles para el super_admin (RLS). |

**Librerias** — `src/lib/`

| Archivo | Nota |
| --- | --- |
| `supabase.ts` | El cliente y `apiFetch`, que adjunta el JWT a las llamadas a `/api/*`. Traduce el `413` de Vercel a un mensaje util: cuando Vercel corta un request grande responde HTML, no JSON, y no hay error propio que mostrar. |
| `database.types.ts` | Tipos escritos a mano (afinan uniones que el generador no puede saber) **con un chequeo contra el esquema real** al final: si una migracion renombra o borra una columna, el build falla nombrando la tabla. |
| `database.generated.ts` | Generado con `npm run tipos`. Solo lo consume ese chequeo. |
| `archivos.ts` | Validacion y reduccion de la imagen. Usa **2048 px**, mas que un lector de documentos: las garrapatas son manchas de pocos pixeles y bajar la resolucion las funde entre si. |
| `conteo.ts` | El estado del formulario de revision y su validacion. |
| `storage.ts` | Subida, borrado y URLs firmadas del bucket privado. |
| `format.ts` | Fechas, numeros y RUC (con digito verificador que **avisa pero nunca bloquea**). |
| `version.ts` | La version, inyectada desde `package.json` en el build. |

**Componentes** — `src/components/`

`ui/` son piezas genericas (button, modal, field, badge, card, combobox,
estado, image-lightbox). El resto esta agrupado por dominio: `fincas/`,
`animales/`, `conteos/`, `usuarios/`, `cuenta/`, `admin/`, `layout/`.

De `conteos/` vale la pena mirar:

- **`CapturaFoto.tsx`** — dos botones, no uno. La diferencia es el atributo
  `capture="environment"`: con el, el celular abre directo la camara; sin el,
  el selector de fotos. Un solo input no puede hacer las dos cosas, por eso son
  dos inputs ocultos.
- **`RevisionConteoCard.tsx`** — la tarjeta de revision. Muestra el numero
  crudo al lado del calibrado cuando difieren, para entender de donde salio.
- **`ConteoDetalleModal.tsx`** — la ficha de un conteo guardado, con la foto y
  todos los campos editables.

---

## 7. PWA y versionado

Subir el campo `version` de `package.json` es el **unico** paso para una
release. El plugin `swVersionado` de [`vite.config.ts`](../vite.config.ts)
genera `dist/sw.js` desde `scripts/sw-template.js` con la version ya inyectada,
y el nombre del cache la incluye. No hay dos archivos que sincronizar a mano.

El service worker **no** vive en `public/` a proposito: ahi Vite lo copiaria tal
cual, sin la version real, que es justo lo que se quiere evitar.

Que cachea:

- `/assets/*` (con hash de contenido, inmutables) → **cache-first**.
- Todo lo demas: HTML, `/api/*`, Supabase → **siempre red primero**, para que
  los conteos nunca queden desactualizados.

Los iconos se generan con `node scripts/generate-icons.mjs` (necesita
`npm install --no-save sharp`). Si cambia el logo, se edita el SVG dentro de ese
script y se vuelve a correr.

---

## 8. Convenciones

- **Todo en castellano**: nombres de tablas, columnas, funciones, variables,
  componentes y comentarios. Es consistente de punta a punta.
- **Los comentarios explican el porque, no el que.** Casi todos los comentarios
  largos del codigo estan donde algo parece raro y tiene una razon: un orden de
  operaciones, un parametro que no se manda, una decision que ya fallo de otra
  forma antes.
- **La logica de permisos vive en la base.** El frontend esconde botones por
  comodidad, pero nunca es lo que protege los datos.
- **Nunca se confia en lo que manda el cliente** en las funciones serverless: el
  animal, la empresa y el rol se leen siempre de la base.
