# Biologik S.A.

Conteo de garrapatas (teleoginas de *Rhipicephalus microplus*) en ganado a
partir de fotos, usando un modelo de vision de OpenAI. Reemplaza al sistema
anterior hecho en Next.js (`D:\CLAUDE\Gavac`), que era de una sola empresa y
sin roles.

## Como esta armado

```
empresas                          ← el limite de aislamiento
  ├── usuarios                    ← super_admin / admin / usuario
  └── fincas
        └── animales              ← identificados por numero de caravana
              └── conteos         ← foto + total de garrapatas por zona
```

Un usuario **solo ve datos de su empresa**. Eso no depende del frontend: lo
garantiza Row Level Security en Postgres. El unico que atraviesa empresas es
el `super_admin`, que las gestiona desde `/admindrpcs`.

**Stack:** React + TypeScript + Vite · Tailwind v4 · React Router · Supabase
(Postgres + Auth + Storage) · Vercel Serverless Functions · OpenAI Vision.

## Roles

| Rol | Alcance |
| --- | --- |
| `super_admin` | Todas las empresas. Las crea, las activa/desactiva, da de alta sus usuarios y configura el modelo de IA. No tiene empresa propia. |
| `admin` | Su empresa. Ademas de operar, da de alta usuarios comunes de su empresa. |
| `usuario` | Su empresa. Carga fincas, animales y conteos; no ve la gestion de usuarios. |

## Puesta en marcha

### 1. Supabase

Crear un proyecto y correr, en orden, todo `supabase/migrations/*.sql` en el
**SQL Editor**. `005_super_admin.sql` es la unica que no se corre de una: hay
que crear antes el usuario super admin en **Authentication → Users → Add user**
(marcando *Auto Confirm User*) y recien ahi correrla, cambiando el email por
el que se uso.

### 2. Variables de entorno

Copiar `.env.example` a `.env` y completar con los valores de
**Project Settings → API**.

Las `VITE_*` viajan al navegador y estan pensadas para eso. Las otras tres son
**solo del servidor**: si a alguna se le pone el prefijo `VITE_`, la clave
termina publicada dentro del bundle.

### 3. Correr

```bash
npm install
npm run dev
```

## Deploy

Vercel autodetecta Vite. Hay que cargar las cinco variables de entorno en
**Settings → Environment Variables** (las tres del servidor sin prefijo).

El `vercel.json` reescribe todo hacia `index.html` **menos** `/api/*`, para que
recargar con F5 en una ruta profunda no de 404 y las funciones sigan andando.

## PWA y versionado

La app es instalable (manifest + service worker) y cachea de forma segura:
los assets de Vite (`/assets/*`) llevan hash de contenido y se sirven
cache-first; todo lo demas (HTML, `/api/*`, Supabase) es siempre red primero,
para que los conteos nunca queden desactualizados.

El nombre del cache del service worker incluye la version de `package.json`,
asi que **hacer una release es un solo paso**: subir el campo `"version"` de
`package.json` (o `npm version patch`) y desplegar. El build (`vite.config.ts`,
plugin `swVersionado`) genera `dist/sw.js` con esa version ya inyectada.

Los iconos (`public/icons/`, `public/favicon*`, `public/logo.svg`) se generan
con `node scripts/generate-icons.mjs` (necesita `npm install --no-save sharp`
antes de correrlo). Si se cambia el logo, se edita el SVG dentro de ese script
y se vuelve a correr.

## El conteo por IA

La foto se reduce a 2048 px de lado y se manda a OpenAI con *structured
outputs*. El schema tiene un campo `analisis` **antes** de `count_total`: como
los structured outputs generan los campos en orden, eso fuerza al modelo a
razonar en texto antes de comprometerse con un numero, lo que volvio el
resultado muy consistente entre llamadas.

El numero crudo tiene un sesgo sistematico que **no** es un simple
multiplicador: en fotos densas subestima y en fotos con pocas garrapatas
sobreestima. Por eso se corrige con una recta:

```
final = round(crudo * calibracion_slope + calibracion_intercept)
```

Ambos valores viven en `configuracion_ia` y los edita el super_admin desde
`/admindrpcs` a medida que se sumen mas fotos con conteo manual real. El
historial completo de los intentos de prompt esta comentado en `api/contar.ts`.

**El numero que propone la IA siempre es corregible a mano** antes de guardar
(y despues, desde la ficha del conteo): la IA propone, la persona decide.
