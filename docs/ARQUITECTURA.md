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
empresas                       ← el limite de aislamiento
  ├── usuarios                 super_admin / admin / usuario
  └── fincas                   los establecimientos
        └── animales           identificados por numero de caravana
              ├── conteos      una foto + el total de garrapatas de una zona
              └── vacunaciones una dosis aplicada, con su fecha
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

## 6. El muestreo: la unidad con la que se mide

Un `conteo` es **una foto de una zona**. El indicador sanitario no es esa fila
suelta ni la suma de todas: es el **muestreo**, o sea lo que se le conto a un
animal en **una fecha**, sumando las zonas que se le fotografiaron ese dia.

```
carga(animal, fecha)   = suma de las zonas de ese animal ese dia
promedio(animal)       = promedio de sus cargas entre fechas
promedio(finca, fecha) = promedio de la carga de los animales medidos ESE dia
```

Esta distincion no es cosmetica. Al principio la app mostraba el acumulado
historico, y con una sola visita cargada daba el mismo numero. Pero ese total
**solo crece con cada visita**: en la segunda medicion habria mostrado la suma
de las dos, asi que nunca podria haber mostrado que la carga bajo despues de
vacunar — que es justamente para lo que se usa el sistema.

Dos detalles del calculo, en
[`src/hooks/useAnimales.ts`](../src/hooks/useAnimales.ts):

- **Se agrupa por animal y fecha ANTES de promediar.** Promediar las filas
  sueltas daria el promedio por foto, no por animal.
- **Los animales que no se midieron ese dia no entran en el promedio.**
  Contarlos como cero lo hundiria y haria parecer que la carga bajo.

---

## 7. Vacunacion y su cronograma

El plan, contado desde la primera dosis: **0, 30, 180, 360, 540…** dias. O
sea, la 2da a los 30 dias, la 3ra a los 180 de la primera, y de ahi en mas cada
180.

Esos numeros son **configurables por empresa** (`dias_segunda_dosis`,
`dias_refuerzo`, `dias_aviso_vacunacion`): el prospecto de Gavac indica la 2da a
la semana 4 —28 dias— y refuerzos cada 6 meses, pero el veterinario puede
trabajar con otros. `planDeEmpresa(empresa)` arma el plan y todo el calculo lo
recibe como parametro; los valores de fabrica viven en `PLAN_POR_DEFECTO`.

**El cronograma no se guarda.** Se calcula desde las dosis efectivamente
aplicadas, en [`src/lib/vacunacion.ts`](../src/lib/vacunacion.ts). Guardar las
fechas previstas obligaria a reescribir filas cada vez que una dosis se aplica
fuera de termino, y la fila que quedara sin actualizar mostraria una fecha
mentirosa.

### Que pasa cuando una dosis se aplica tarde

Es una decision sanitaria, no tecnica, asi que la elige cada empresa
(`empresas.modo_cronograma_vacunacion`, editable por el super_admin en la ficha
de la empresa):

| Modo | Que hace | Ejemplo: 1ra el 01/01, 2da tarde el 15/02 |
| --- | --- | --- |
| `reajustar` | Cuenta desde la fecha **real** de la anterior, respetando el intervalo. | 3ra el **15/07** (15/02 + 150) |
| `anclar` | Cuenta siempre desde la 1ra dosis; el calendario no se mueve. | 3ra el **30/06** (01/01 + 180) |

Como el intervalo nominal entre la 2da y la 3ra es de 150 dias (para que la 3ra
caiga a los 180 de la primera), con todo en fecha los dos modos dan lo mismo:
solo se separan cuando hay atraso.

La logica esta cubierta por
[`vacunacion.test.ts`](../src/lib/vacunacion.test.ts): los dos modos, los dias
configurables, el cruce de fin de anio, el anio bisiesto y la carga imperfecta
(dosis desordenadas, o una 3ra cargada sin la 1ra).

### Estados y alertas

`vencida` (la fecha ya paso) · `por_vencer` (dentro de `diasAviso`) · `al_dia` ·
`sin_iniciar` (todavia no recibio la 1ra).

El panel `/vacunaciones` lista todos los animales de la empresa ordenados por
urgencia, e Inicio muestra un aviso cuando hay algo vencido o por vencer. Las
dosis se registran desde la finca con **“Registrar vacunacion”**: una jornada
sobre varios animales a la vez, con los que corresponden ya premarcados. Usa
`upsert` para que recargar una jornada (porque faltaba un animal) no rompa
contra el unique `(animal_id, numero_dosis)`.

### Notificaciones push

El panel del navegador no sirve de nada si nadie lo mira. El boton de
campana en el header (oculto si el navegador no soporta push, o si es
`super_admin` -- no tiene empresa con vacunaciones) suscribe **este
dispositivo** via `PushManager` y guarda el endpoint en
`push_subscripciones` ([`src/lib/notificaciones.ts`](../src/lib/notificaciones.ts)).
Es por dispositivo, no por usuario: activarlo en el celular no lo activa en
la PC. En iOS, Safari solo entrega `PushManager` con la app instalada a la
pantalla de inicio.

El envio lo hace **un cron de Vercel, una vez al dia**
([`api/cron/vacunaciones.ts`](../api/cron/vacunaciones.ts), programado en
`vercel.json`): recorre las empresas, calcula el cronograma de cada animal
reusando `calcularCronograma`/`planDeEmpresa` de `src/lib/vacunacion.ts` (se
importa directo por ruta relativa; es TS puro, sin nada de navegador), y si
hay vencidas o por vencer manda un resumen con `web-push` a todas las
suscripciones activas de esa empresa. Las suscripciones que el navegador ya
no reconoce (404/410 -- se desinstalo la app, se borraron datos del sitio)
se borran solas ese mismo dia.

No hay usuario logueado disparando el cron -- lo llama Vercel -- asi que se
autentica distinto al resto de `/api`: exige el header
`Authorization: Bearer $CRON_SECRET` que Vercel manda solo en sus propias
invocaciones programadas, no un JWT de Supabase.

> **Sobre el "grupo control":** el protocolo del PCIG exige *inmunizar toda la
> masa bovina de la propiedad* y *no introducir animales sin inmunizar*, asi
> que **no puede haber un grupo testigo sin vacunar dentro de la misma finca**.
> Lo que se aparta es una **muestra centinela** sobre la que se cuentan las
> garrapatas, porque contarlas en todo el rodeo no es practico. El modelo ya lo
> soporta sin cambios: el animal que no se midio en una fecha simplemente no
> entra en el promedio de ese muestreo (ver §6).

---

## 8. Baños acaricidas: la metrica del programa

El sistema no existe para contar garrapatas sino para demostrar que la
vacunacion **reduce los tratamientos quimicos**. Los resultados publicados del
programa se expresan siempre asi: en Venezuela los baños por animal/año bajaron
83.7 %; en Colombia el intervalo entre baños paso de 120 a 244 dias.

Por eso se registran los baños (`banos`, una fila por finca y jornada) y de
ahi salen, en [`src/lib/banos.ts`](../src/lib/banos.ts):

- **intervalo entre baños consecutivos** y su promedio,
- **baños del ultimo año**,
- **tendencia**: el promedio de los intervalos recientes contra el de los
  previos. Si crece, cada vez hace falta bañar menos seguido — que es el ahorro
  concreto que ve el productor.

El baño es un evento de **finca**, no de animal: el rodeo entero pasa por el
baño en la misma jornada, y guardarlo por animal multiplicaria las filas sin
agregar informacion.

### El umbral de infestacion

El programa no baña por calendario sino **por nivel de infestacion**,
justamente para espaciar los tratamientos todo lo que la carga real permita.
`empresas.umbral_garrapatas` (20 por defecto) es la carga a partir de la cual un
animal se marca como que necesita tratamiento; en la ficha de la finca aparece
un aviso con cuantos animales lo superan y la columna de carga se pinta segun el
nivel ([`src/lib/umbral.ts`](../src/lib/umbral.ts)). Al 70 % del umbral ya avisa
en amarillo, para poder planificar el baño en vez de descubrirlo el dia que ya
hay que hacerlo.

---

## 9. Mapa de archivos

### Base de datos — `supabase/migrations/`

Se corren en orden en el SQL Editor. `005` va aparte (ver README).

| Archivo | Que hace |
| --- | --- |
| `001_schema.sql` | Las cinco tablas del dominio y el trigger de `updated_at`. |
| `002_rls.sql` | Los helpers `mi_empresa_id()` / `es_super_admin()` y todas las politicas. |
| `003_storage.sql` | Bucket `fotos` privado, limites de peso/tipo y su politica. |
| `004_uso_ia.sql` | `uso_ia` (registro de consumo) y `configuracion_ia` (singleton). |
| `005_super_admin.sql` | Alta del primer super_admin. Se corre a mano, una sola vez. |
| `006_vacunaciones.sql` | `vacunaciones` (una fila por animal y dosis) y el modo de cronograma de la empresa. |
| `007_banos.sql` | `banos` (baños acaricidas por finca) y los parametros del programa: umbral y dias entre dosis. |
| `008_notificaciones.sql` | `push_subscripciones`: el endpoint que cada dispositivo entrega al suscribirse a push. |

### Funciones serverless — `api/`

| Archivo | Que hace |
| --- | --- |
| `_lib/http.ts` | Tipos y helpers minimos. No usa `@vercel/node` para no arrastrar cien dependencias por dos interfaces. `conManejoDeErrores` garantiza que toda excepcion termine en JSON y no en la pagina de error de Vercel, que romperia el parseo del cliente. |
| `_lib/auth.ts` | Valida el JWT **del lado del servidor** y devuelve el perfil. `exigeUsuario` / `exigeGestorDeUsuarios` / `exigeSuperAdmin` son los tres niveles. |
| `contar.ts` | El conteo por IA (seccion 5). |
| `admin/usuarios.ts` | Alta, edicion, borrado y cambio de contrasena de otros. El alcance de un `admin` —solo usuarios comunes de su propia empresa— **se fuerza en el servidor**: el `empresa_id` y el `rol` que mande el cliente se ignoran. |
| `cuenta/password.ts` | Cambiar la contrasena propia. El id sale del token, nunca del body. |
| `cron/vacunaciones.ts` | Cron diario (seccion 8): manda push de vacunaciones pendientes. Se autentica con `CRON_SECRET`, no con un JWT. |

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
| `/vacunaciones` | `Vacunaciones.tsx` — panel de alertas, ordenado por urgencia |
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
| `useVacunaciones` | Dosis de un animal. `useVacunacionMasiva` carga una jornada entera de una vez, con `upsert` para poder recargarla sin romper contra el unique. |
| `useVacunacionesPendientes` | Todos los animales de la empresa con su cronograma, ordenados por urgencia. Alimenta el panel de alertas. |
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
| `vacunacion.ts` | El calculo del cronograma, en funciones puras y con tests (`vacunacion.test.ts`). Ver seccion 6. |
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

## 10. PWA y versionado

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

## 11. Convenciones

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
