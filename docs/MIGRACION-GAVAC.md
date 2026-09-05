# Migracion desde Gavac — que se hizo y por que

Registro del reemplazo del sistema anterior, hecho el **4 de septiembre de
2026**. Sirve para dos cosas: entender por que el sistema quedo como quedo, y
saber donde estan los respaldos si algo hay que recuperar.

---

## 1. De donde viene

**Gavac** (`D:\CLAUDE\Gavac\gavac-app`, repo
[Diago2077/gavac](https://github.com/Diago2077/gavac)) era una app en Next.js
16 que hacia lo mismo —contar garrapatas en fotos— pero con limitaciones de
fondo:

- **Una sola empresa.** No habia concepto de empresa: todas las fincas eran de
  todos.
- **Sin roles.** Todo usuario aprobado podia hacer todo.
- **Aprobacion manual por metadata.** Para habilitar a alguien habia que editar
  a mano el JSON de `user_metadata` en el dashboard de Supabase (despues se paso
  a una columna `approved` en una tabla `perfiles`).
- **Una foto por vez**, sin revision: el numero de la IA se guardaba tal cual.
- **Fotos en un bucket publico**, sin aislamiento.

El pedido fue rehacerlo copiando la estructura del sistema contable
(`D:\CLAUDE\contable`), que ya resolvia todo eso, y renombrarlo a
**Biologik S.A.**

---

## 2. El mapeo de conceptos

El sistema contable tenia esta forma:

```
empresas (estudio contable) → contribuyentes → facturas
                                            └→ plan_cuentas
```

Y quedo asi:

| Sistema contable | Biologik | Nota |
| --- | --- | --- |
| `empresas` (el estudio) | `empresas` | Ahora es la empresa ganadera. "Gavac" es una de ellas. |
| `usuarios` | `usuarios` | Sin cambios: mismos tres roles. |
| `contribuyentes` (clientes) | `fincas` | Mismo lugar en la jerarquia: lo que cuelga de la empresa y tiene ficha propia. |
| — | `animales` | **Nivel nuevo**, propio del dominio. No existia en contable. |
| `facturas` | `conteos` | Una foto contada. La carga por lote con revision es exactamente el flujo de carga de facturas. |
| `factura_detalles` | — | Se elimino. |
| `plan_cuentas` | — | Se elimino: no habia nada que categorizar. |
| `uso_ia`, `configuracion_ia` | igual | Se conservaron enteras, mas dos columnas de calibracion. |

Las 17 migraciones incrementales de contable se consolidaron en **5 limpias**,
ya con todas las correcciones de seguridad que aquellas fueron agregando con el
tiempo (bloqueo de inactivos en la RLS, limites de bucket, tope por usuario).

---

## 3. Que se conservo de Gavac

No todo era peor en el sistema viejo. Se trajo tal cual:

- **El prompt de conteo**, con el campo `analisis` antes del numero para forzar
  el razonamiento previo, y el historial completo de los cuatro enfoques
  probados (esta comentado en `api/contar.ts`).
- **La calibracion lineal** `crudo × 1.35 − 2.5`, ajustada sobre tres pares
  crudo/real. En Gavac vivia en variables de entorno; ahora es una fila de
  `configuracion_ia`, editable desde el panel sin redeploy.
- **Los botones separados de camara y galeria**, que se habian afinado para el
  uso en el campo.
- **La PWA instalable**.

Lo que **no** se trajo: el escaneo de QR.

---

## 4. La base de datos

Se reutilizo el mismo proyecto de Supabase (`emgbjopkpmpnsvacizfo`), no se creo
uno nuevo. Los pasos, en orden:

1. **Respaldo completo** (seccion 6).
2. Las tablas viejas se **renombraron** a `_old_fincas`, `_old_animales`,
   `_old_conteos`, `_old_perfiles`. No se borro nada: quedan como segundo
   respaldo dentro de la propia base. Se elimino tambien el trigger
   `on_auth_user_created`, que creaba filas en `perfiles`.
3. Se aplico el esquema nuevo (las cinco migraciones).
4. Se migraron los datos a una empresa **Gavac**:

   | | Cantidad |
   | --- | --- |
   | Empresas | 1 (Gavac) |
   | Usuarios | 3 |
   | Fincas | 2 |
   | Animales | 13 |
   | Conteos | 21 |
   | Fotos | 21 |

5. **Las fotos se volvieron a subir**, no se renombraron. Estaban en el bucket
   publico `fotos-garrapatas` bajo `{animal_id}/{archivo}`, y el bucket nuevo es
   privado y espera `{empresa_id}/{animal_id}/{archivo}`. Como cambia el primer
   segmento —que es justamente lo que la politica de Storage compara— no
   alcanzaba con moverlas. Lo hizo `scripts/migrar-fotos.mjs` desde el respaldo
   local.

### Los roles que quedaron

| Usuario | Rol |
| --- | --- |
| `diagorr@gmail.com` | `super_admin` (sin empresa) |
| `pathros66@gmail.com` (Edgar Cuevas) | `admin` de Gavac |
| `chulechena@outlook.com` | `admin` de Gavac |

### Datos que se perdieron a proposito

- `conteos.detecciones` quedo vacio: el sistema viejo ya lo guardaba vacio.
- `fecha_conteo` se completo con la fecha de creacion del registro viejo, que
  no tenia un campo de fecha propio.

---

## 5. Consecuencia esperada: Gavac dejo de funcionar

Al cambiar el esquema de la base que la app vieja seguia usando, **el Gavac
desplegado en Vercel dejo de funcionar**. Estaba previsto y fue aceptado antes
de aplicar el cambio: el sistema nuevo lo reemplaza.

En el momento del cambio habia trabajo real cargado —la finca "El Retorno", con
13 animales y 21 conteos, cargada el 31 de agosto— y por eso se migro todo en
vez de arrancar de cero.

---

## 6. Donde estan los respaldos

**Codigo de Gavac**

- Tag `respaldo-gavac-completo-v1.14.0` en el repo
  [Diago2077/gavac](https://github.com/Diago2077/gavac) (pusheado).
- Copia de la carpeta en `D:\CLAUDE\_respaldo_gavac_2026-09-04\`.

**Datos**

- `D:\CLAUDE\_respaldo_gavac_2026-09-04\base-de-datos\`
  - `fincas.json`, `animales.json`, `conteos.json`, `perfiles.json`, `todo.json`
  - `fotos\` — las 21 fotos originales (3,9 MB)

**Dentro de la propia base**

- Tablas `_old_fincas`, `_old_animales`, `_old_conteos`, `_old_perfiles`.
  Se pueden borrar cuando ya no hagan falta.

---

## 7. Un bug que se encontro en el camino

Verificando el sistema nuevo aparecio una condicion de carrera en `useAuth`
que hacia que entrar directo a `/admindrpcs` **siempre** rebotara a `/`, aunque
el usuario fuera super_admin. Al abrir la app se disparan dos cargas de perfil
casi simultaneas; la que perdia se descartaba a si misma pero igual apagaba el
`loading`, dejando `loading=false` con el perfil todavia en `null`.

Esta explicado en detalle en [ARQUITECTURA.md](ARQUITECTURA.md#4-autenticacion-y-roles).

> **Este mismo bug existe en el sistema contable** (`D:\CLAUDE\contable`,
> `src/hooks/useAuth.tsx`), de donde se copio el hook. Ahi todavia no esta
> corregido.

---

## 8. Lo que se aprendio sobre el conteo

Al verificar en produccion se midio la misma foto (caravana 47, cuello) en tres
momentos:

| | Crudo | Calibrado |
| --- | --- | --- |
| Guardado por Gavac el 31/8 (gpt-4o) | ~15 | **18** |
| gpt-4o, 4/9 | 30 | **38** |
| gpt-5.6-luna, 4/9 | 115 | **153** |

Dos conclusiones que conviene no olvidar:

1. **La calibracion es especifica del modelo.** gpt-5.6-luna cuenta casi 4×
   mas que gpt-4o. Cambiar el modelo desde el panel sin recalibrar dispara el
   numero. El sistema quedo configurado en **gpt-4o**, que es para el que se
   ajustaron los valores actuales.
2. **Hay variacion real entre llamadas** aun con el mismo modelo. Por eso el
   flujo obliga a revisar antes de guardar y permite corregir despues: el
   numero es una estimacion asistida, no una medicion.

Para apretar esto hace falta juntar fotos con conteo manual real y reajustar la
recta desde `/admindrpcs/configuracion-ia`.

---

## 9. Estado al cerrar

- Repo: [Diago2077/biologik](https://github.com/Diago2077/biologik)
- Produccion: https://biologik-g.vercel.app
- Verificado end-to-end en produccion: login, panel de super admin, fotos
  sirviendose desde el bucket privado con URL firmada, conteo por IA real y
  registro de consumo.
- Verificado en seguridad: un `admin` no ve otra empresa, no puede crear
  empresas, no puede escribir fincas ajenas y no puede promoverse a
  `super_admin`.

**Pendientes menores:** quedan dos llamadas de prueba en el consumo de IA
(US$ 0,01) y las tablas `_old_*` en la base.
