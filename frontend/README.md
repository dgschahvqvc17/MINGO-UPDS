# MINGO Frontend

Interfaz web de MINGO desarrollada con Angular 21, TypeScript y Bootstrap 5.

## Tecnologias

| Tecnologia | Uso |
|---|---|
| Angular 21 | Framework principal |
| TypeScript | Tipado y desarrollo |
| Bootstrap 5 + Bootstrap Icons | Componentes y diseno responsivo |
| RxJS | Operaciones asincronas |
| Angular Router | Navegacion y lazy loading por modulo |
| Angular Reactive Forms | Formularios y validaciones |
| HttpClient + interceptores | Consumo de la API REST y envio del JWT |
| Supabase JS | Autenticacion con Supabase Auth |
| FullCalendar 7 | Calendario academico (dia/semana/mes) |
| Chart.js + ng2-charts | Graficos de progreso academico |

## Estructura

```text
src/app/
├── core/
│   ├── guards/          auth.guard.ts, role.guard.ts
│   ├── interceptors/    auth.interceptor.ts
│   ├── models/          modelos del dominio y respuestas de API
│   └── services/        api.service.ts, auth.service.ts, supabase.service.ts
├── shared/
│   ├── components/      componentes reutilizables
│   ├── pipes/
│   └── directives/
├── features/
│   ├── auth/login/      inicio de sesion con Supabase Auth
│   ├── dashboard/
│   ├── materias/
│   ├── tareas/
│   ├── calendario/
│   ├── biblioteca/
│   ├── centro-estudio/
│   ├── asistente-ia/
│   └── administracion/
├── layout/              shell con navegacion lateral
├── app.config.ts
└── app.routes.ts
```

Cada modulo de `features/` se carga de forma diferida (lazy loading).

## Configuracion

1. Editar `src/environments/environment.ts`:

```ts
export const environment = {
  production: false,
  apiUrl: '/api',
  supabaseUrl: 'https://TU-PROYECTO.supabase.co',
  supabaseAnonKey: 'TU_ANON_KEY',
};
```

2. Editar `src/environments/environment.production.ts` con las credenciales publicas de produccion.

La `supabaseAnonKey` es publica; la seguridad depende de Row Level Security. Nunca incluir la `service_role` key en el frontend.

El backend debe estar en `http://localhost:4000`. El archivo `proxy.conf.json` redirige `/api` hacia ese puerto en desarrollo.

## Comandos

```bash
npm install
npm start          # http://localhost:4200
npm run build      # build de produccion en dist/frontend
npm test           # Vitest + Angular TestBed
npm run format     # Prettier
```

## Notas

- Angular 21 se eligio por compatibilidad con Node.js 24.11.1. Angular CLI 22 requiere Node >= 24.15.
- Si Supabase no esta configurado, el guard de autenticacion permite el acceso en desarrollo para revisar la interfaz; en produccion siempre exige sesion.
- El interceptor agrega `Authorization: Bearer <token>` a las solicitudes dirigidas a la API.
