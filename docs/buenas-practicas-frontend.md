# Buenas prácticas de frontend — MINGO

**Versión:** 1.0
**Fecha:** 2026-11-07
**Stack:** Angular 21, componentes standalone, signals, RxJS, Bootstrap 5, Supabase Auth, Vitest
**Objetivo:** una SPA clara, accesible, tipada, rápida y mantenible.

> Antes de leer este documento, aplica las reglas generales de [buenas-practicas.md](buenas-practicas.md) y las reglas de AWS de [reglas-aws-agente.md](reglas-aws-agente.md).

---

## 1. Estructura del proyecto

```text
frontend/src/app/
├── core/
│   ├── guards/          authGuard, roleGuard
│   ├── interceptors/    authInterceptor, errorInterceptor
│   ├── models/          modelos de API y dominio
│   └── services/        ApiService, AuthService, SupabaseService
├── shared/
│   ├── components/      componentes reutilizables sin lógica de negocio
│   ├── directives/
│   └── pipes/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── materias/
│   ├── tareas/
│   ├── calendario/
│   ├── biblioteca/
│   ├── centro-estudio/
│   ├── asistente-ia/
│   └── administracion/
├── layout/              shell, navegación, header
├── app.config.ts
├── app.routes.ts
└── app.ts
```

### Reglas de organización

- `core/`: servicios singleton, guards, interceptores y modelos globales. Nunca componentes visuales.
- `shared/`: componentes, pipes y directivas reutilizables. No dependen de una feature.
- `features/`: una carpeta por funcionalidad, con sus páginas, componentes, servicios y modelos.
- `layout/`: estructura visual de la aplicación.
- Un componente por archivo.
- Sin imports circulares entre features.
- Una feature no importa directamente de otra feature; lo compartido se mueve a `shared/` o `core/`.

### Estructura de una feature

```text
features/tareas/
├── tareas.routes.ts
├── pages/
│   ├── lista/
│   └── detalle/
├── components/
│   ├── tarea-card/
│   └── tarea-form/
├── services/
│   └── tarea.service.ts
└── models/
    └── tarea.model.ts
```

---

## 2. Nombres y estilo

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componentes | `PascalCase` + `Component` o `Page` | `TareaCardComponent`, `TareasPage` |
| Archivos | `kebab-case` | `tarea-card.component.ts` |
| Servicios | `PascalCase` + `Service` | `TareaService` |
| Guards | `camelCase` + `Guard` | `authGuard` |
| Interceptores | `camelCase` + `Interceptor` | `authInterceptor` |
| Interfaces y tipos | `PascalCase`, sin prefijo `I` | `Tarea`, `EstadoTarea` |
| Signals | sustantivo descriptivo | `tareas`, `isLoading`, `errorMessage` |
| Rutas | `kebab-case` | `/centro-estudio` |
| Selectores | prefijo `app-` | `app-tarea-card` |

- Un identificador no mezcla idiomas (`getTareaById` está prohibido).
- Nombres de modelos alineados con la API: `usuario_id` es UUID; los IDs de dominio son enteros.
- No usar `any`. Si el tipo es desconocido, usar `unknown` y estrechar.
- Sin `console.log` en código de producción.
- Sin estilos inline; usar clases de Bootstrap o el CSS del componente.

---

## 3. Componentes

### 3.1. Reglas

- **Standalone** siempre. No usar `NgModule` para nuevas features.
- **Una responsabilidad:** presentar datos y emitir eventos, o coordinar una página.
- **`ChangeDetectionStrategy.OnPush`** en todos los componentes nuevos.
- **`inject()`** en lugar de inyección por constructor cuando sea posible.
- Usar `input()`, `output()` y `model()` en lugar de decoradores `@Input`, `@Output` cuando aplique.
- Sin lógica de negocio en el componente: delegar en servicios.
- Sin llamadas HTTP directas desde el componente.
- Sin acceso directo a `localStorage` para el token; lo maneja `AuthService`/Supabase.
- Plantillas cortas; si superan ~150 líneas, dividir en componentes.

### 3.2. Componente de presentación

```ts
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Tarea } from '../../models/tarea.model';

@Component({
  selector: 'app-tarea-card',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card h-100">
      <div class="card-body">
        <h3 class="h6 card-title">{{ tarea().titulo }}</h3>
        <p class="card-text text-muted small">{{ tarea().descripcion }}</p>
        <span class="badge" [class]="badgeClass()">{{ tarea().estado }}</span>
      </div>
      <div class="card-footer d-flex gap-2">
        <button type="button" class="btn btn-sm btn-outline-primary" (click)="edit.emit(tarea())">
          Editar
        </button>
        <button type="button" class="btn btn-sm btn-outline-danger" (click)="remove.emit(tarea().id)">
          Eliminar
        </button>
      </div>
    </article>
  `,
})
export class TareaCardComponent {
  readonly tarea = input.required<Tarea>();
  readonly edit = output<Tarea>();
  readonly remove = output<number>();

  badgeClass(): string {
    const classes = {
      pendiente: 'bg-warning text-dark',
      en_progreso: 'bg-info text-dark',
      completada: 'bg-success',
    };
    return classes[this.tarea().estado];
  }
}
```

### 3.3. Componente de página (contenedor)

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TareaService } from '../../services/tarea.service';
import { Tarea } from '../../models/tarea.model';
import { TareaCardComponent } from '../../components/tarea-card/tarea-card.component';

@Component({
  selector: 'app-tareas-page',
  imports: [TareaCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isLoading()) {
      <div class="text-center py-5" role="status">Cargando tareas...</div>
    } @else if (errorMessage()) {
      <div class="alert alert-danger" role="alert">{{ errorMessage() }}</div>
    } @else if (tareas().length === 0) {
      <div class="alert alert-info">No tienes tareas registradas.</div>
    } @else {
      <div class="row g-3">
        @for (tarea of tareas(); track tarea.id) {
          <div class="col-12 col-md-6 col-lg-4">
            <app-tarea-card [tarea]="tarea" (remove)="remove($event)" />
          </div>
        }
      </div>
    }
  `,
})
export class TareasPage {
  private readonly tareaService = inject(TareaService);

  readonly tareas = signal<Tarea[]>([]);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.load();
  }

  private load(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.tareaService.getAll().subscribe({
      next: (tareas) => {
        this.tareas.set(tareas);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar las tareas.');
        this.isLoading.set(false);
      },
    });
  }

  remove(id: number): void {
    this.tareaService.remove(id).subscribe({
      next: () => this.tareas.update((tareas) => tareas.filter((t) => t.id !== id)),
      error: () => this.errorMessage.set('No se pudo eliminar la tarea.'),
    });
  }
}
```

---

## 4. Estado con signals

### 4.1. Reglas

- **Signals para estado local y derivado.** `signal()` para estado mutable, `computed()` para derivados.
- No usar `effect()` para sincronizar estado que se puede derivar con `computed()`.
- `effect()` solo para efectos secundarios reales (integrarse con APIs imperativas, logging, sincronización con almacenamiento).
- No mutar signals desde la plantilla.
- Exponer signals de solo lectura hacia fuera: `readonly tareas = this.tareasSignal.asReadonly()`.
- Actualizar con `set`, `update` o `mutate`; nunca modificar el array/objeto en sitio y asumir que se detecta.

```ts
// Mal
this.tareas().push(tarea);

// Bien
this.tareas.update((tareas) => [...tareas, tarea]);
```

### 4.2. Estado derivado

```ts
readonly pendingCount = computed(
  () => this.tareas().filter((tarea) => tarea.estado === 'pendiente').length,
);
```

### 4.3. Estado de una página

Toda pantalla que carga datos debe manejar explícitamente:

| Estado | Signal | UI |
|---|---|---|
| Cargando | `isLoading` | Spinner o mensaje con `role="status"`. |
| Vacío | `items().length === 0` | Mensaje informativo. |
| Error | `errorMessage` | `alert alert-danger` con `role="alert"`. |
| Con datos | `items` | Lista o tabla. |

### 4.4. Signals vs RxJS

| Uso | Herramienta |
|---|---|
| Estado local de UI | Signal |
| Estado derivado | `computed` |
| Formularios | Reactive Forms |
| HTTP y flujos asíncronos | RxJS |
| Convertir observable a signal | `toSignal` |
| Convertir signal a observable | `toObservable` |

No reescribir RxJS con signals por moda. Usar cada herramienta donde corresponde.

---

## 5. Servicios y HTTP

### 5.1. Reglas

- Un servicio por dominio (`TareaService`, `MateriaService`, `DocumentoService`).
- `providedIn: 'root'` para servicios singleton.
- Centralizar la URL base en `environment.apiUrl`.
- Usar `ApiService` para el sobre `{ success, data }`.
- Tipar todas las respuestas: `Observable<Tarea[]>`, no `Observable<any>`.
- Los interceptores manejan token y errores globales.
- No duplicar llamadas; cachear cuando corresponda.
- No llamar a Supabase directamente desde componentes de dominio; usar servicios.
- No exponer el cliente de Supabase fuera de `SupabaseService`.

```ts
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { Tarea } from '../models/tarea.model';

export interface CreateTareaInput {
  subjectId: number;
  title: string;
  description?: string;
  priority: 'baja' | 'media' | 'alta';
  dueDate?: string;
}

@Injectable({ providedIn: 'root' })
export class TareaService {
  private readonly api = inject(ApiService);

  getAll(): Observable<Tarea[]> {
    return this.api.get<Tarea[]>('/tareas');
  }

  create(input: CreateTareaInput): Observable<Tarea> {
    return this.api.post<Tarea>('/tareas', input);
  }

  remove(id: number): Observable<void> {
    return this.api.delete<void>(`/tareas/${id}`);
  }
}
```

### 5.2. Interceptores

- `authInterceptor`: agrega el token solo a las solicitudes de la API de MINGO.
- Agregar un `errorInterceptor` que traduzca `401`, `403`, `404`, `5xx` y errores de red a mensajes claros.
- No mostrar el mensaje crudo del backend sin revisar.
- En `401`, cerrar sesión y redirigir al login con `returnUrl`.
- Evitar bucles de redirección.

### 5.3. Suscripciones

- Preferir `async` pipe o `toSignal` en la plantilla.
- Si se suscribe manualmente, desuscribirse con `takeUntilDestroyed(inject(DestroyRef))`.
- No anidar suscripciones; usar `switchMap`, `concatMap`, `mergeMap` o `forkJoin`.
- `switchMap` para búsquedas y cambios de filtro.
- No usar `subscribe` dentro de `subscribe`.

```ts
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

this.route.paramMap
  .pipe(
    map((params) => Number(params.get('id'))),
    switchMap((id) => this.tareaService.getById(id)),
    takeUntilDestroyed(),
  )
  .subscribe({
    next: (tarea) => this.tarea.set(tarea),
    error: () => this.errorMessage.set('No se pudo cargar la tarea.'),
  });
```

---

## 6. Rutas

- Todas las features se cargan con `loadComponent` (lazy loading).
- Rutas privadas protegidas con `authGuard`.
- Rutas administrativas protegidas con `roleGuard` y `data: { roles: ['administrador'] }`.
- Título de página con `title` en la ruta.
- `**` redirige a una ruta segura, no a una página en blanco.
- No usar lógica pesada en guards; solo verificar sesión y rol.
- El `returnUrl` se conserva al redirigir al login.

```ts
{
  path: 'tareas/:id',
  title: 'Detalle de tarea | MINGO',
  canActivate: [authGuard],
  loadComponent: () => import('./pages/detalle/tarea-detalle').then((m) => m.TareaDetallePage),
}
```

---

## 7. Formularios

- **Reactive Forms** tipados. Evitar `ngModel` en formularios complejos.
- Un `FormGroup` por formulario, con tipos explícitos.
- Validadores síncronos para formato y longitud; asíncronos para disponibilidad.
- Mensajes de error junto al campo, en español y asociados con `aria-describedby`.
- Deshabilitar el botón mientras se envía; evitar doble submit.
- Mostrar errores del backend de forma general o por campo cuando corresponda.
- No confiar solo en la validación del cliente: el backend valida igual.

```ts
readonly form = this.formBuilder.nonNullable.group({
  title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
  subjectId: [0, [Validators.required, Validators.min(1)]],
  priority: ['media' as const, Validators.required],
  dueDate: [''],
});

get titleControl(): FormControl<string> {
  return this.form.controls.title;
}

submit(): void {
  if (this.form.invalid || this.isSaving()) return;

  this.isSaving.set(true);
  this.tareaService.create(this.form.getRawValue()).subscribe({
    next: () => this.router.navigate(['/tareas']),
    error: () => {
      this.errorMessage.set('No se pudo guardar la tarea.');
      this.isSaving.set(false);
    },
  });
}
```

```html
<label for="titulo" class="form-label">Título</label>
<input
  id="titulo"
  type="text"
  class="form-control"
  [class.is-invalid]="titleControl.invalid && titleControl.touched"
  formControlName="title"
  aria-describedby="titulo-error"
/>
@if (titleControl.invalid && titleControl.touched) {
  <div id="titulo-error" class="invalid-feedback">
    El título debe tener entre 3 y 200 caracteres.
  </div>
}
```

---

## 8. Plantillas

- Usar la sintaxis de control de flujo de Angular: `@if`, `@for`, `@switch`. No `*ngIf`/`*ngFor` en código nuevo.
- `@for` **siempre** con `track` por identificador estable.
- Sin lógica compleja en la plantilla. Mover a `computed()` o al componente.
- Sin llamadas a funciones costosas desde la plantilla.
- Sin `innerHTML` con contenido de usuario o IA. Si es imprescindible, sanitizar con `DomSanitizer` y justificar.
- Toda imagen con `alt`.
- Todo botón con `type="button"` o `submit` explícito.
- Estados de carga, vacío y error en toda lista.
- Fechas y números formateados con pipes (`date`, `number`, `currency`).
- No mostrar IDs internos al usuario salvo que aporten.

```html
@for (materia of materias(); track materia.id) {
  <li class="list-group-item">{{ materia.nombre }}</li>
} @empty {
  <li class="list-group-item text-muted">No hay materias registradas.</li>
}
```

---

## 9. Estilos y Bootstrap

- Usar **Bootstrap 5** antes de escribir CSS propio.
- Sin estilos inline (`style="..."`), salvo valores dinámicos calculados.
- Clases utilitarias para espaciado, grid y tipografía.
- El CSS del componente debe ser pequeño y específico.
- Evitar `!important` salvo justificación.
- Tema y colores en variables CSS cuando se repitan.
- Diseño responsive: mobile first, grid de Bootstrap, sin anchos fijos en píxeles.
- No romper la accesibilidad por estética (contraste, foco visible, tamaños táctiles).

---

## 10. Accesibilidad (WCAG 2.1 AA)

- Todo input tiene `label` asociado con `for`/`id`.
- Errores con `aria-describedby` y `role="alert"` cuando aparecen.
- Navegación completa por teclado.
- Foco visible; no eliminarlo con `outline: none` sin reemplazo.
- Contraste mínimo 4.5:1 en texto normal.
- Imágenes con `alt`; decorativas con `alt=""`.
- Iconos dentro de botones con texto o `aria-label`.
- Enlaces con texto descriptivo; evitar "clic aquí".
- Modales con foco atrapado y cierre con `Esc`.
- Tablas con `thead`, `th` y `scope`.
- Mensajes de estado con `role="status"` o `aria-live="polite"`.
- No transmitir información solo por color.

```html
<button type="button" class="btn btn-outline-secondary" aria-label="Eliminar tarea">
  <i class="bi bi-trash" aria-hidden="true"></i>
</button>
```

---

## 11. Seguridad en el frontend

- **Nunca** poner claves de AWS, `service_role` de Supabase ni claves de IA en el frontend.
- Solo la `anon key` de Supabase puede estar en el cliente.
- El token se obtiene de Supabase Auth; no se guarda en variables globales ni se imprime.
- No confiar en el rol del cliente para seguridad real; el backend valida.
- Evitar `innerHTML`, `bypassSecurityTrustHtml` y `eval`.
- Sanitizar cualquier contenido enriquecido.
- No guardar datos sensibles en `localStorage` más allá de lo que Supabase maneja.
- CORS y CSP se configuran en el servidor/hosting, no en el cliente.
- No incluir información interna en mensajes de error de la UI.
- Validar en el cliente es UX; la seguridad está en el backend y RLS.

---

## 12. Rendimiento

- `OnPush` en todos los componentes.
- `@for` con `track` estable.
- Lazy loading por ruta.
- `@defer` para bloques pesados que no se ven al inicio (calendario, gráficos, editor).
- Evitar imports de librerías completas; importar solo lo necesario.
- No cargar datos que no se muestran.
- Paginar listas grandes.
- Cancelar búsquedas anteriores con `switchMap`.
- Optimizar imágenes (tamaño, formato, `loading="lazy"`).
- Revisar los budgets de Angular en `angular.json`; no subirlos sin justificar.
- Medir con Lighthouse o DevTools antes de optimizar.

```html
@defer (on viewport) {
  <app-calendario [eventos]="eventos()" />
} @placeholder {
  <div class="text-muted py-5">Cargando calendario...</div>
}
```

---

## 13. Pruebas

### 13.1. Reglas

- Vitest + TestBed para componentes y servicios.
- Probar comportamiento, no implementación.
- Un test por comportamiento relevante.
- Mocks de `ApiService`, `AuthService` y Supabase.
- Sin llamadas HTTP reales.
- Probar guards e interceptores con casos de sesión válida, inválida y expirada.
- Probar estados de carga, vacío y error.
- Probar accesibilidad básica: labels, roles y navegación por teclado cuando aplique.

### 13.2. Ejemplo de servicio

```ts
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../../core/services/api.service';
import { TareaService } from './tarea.service';

describe('TareaService', () => {
  it('obtiene las tareas del endpoint correcto', () => {
    const api = { get: vi.fn().mockReturnValue(of([{ id: 1, titulo: 'Tarea' }])) };

    TestBed.configureTestingModule({
      providers: [TareaService, { provide: ApiService, useValue: api }],
    });

    const service = TestBed.inject(TareaService);
    service.getAll().subscribe((tareas) => {
      expect(tareas).toHaveLength(1);
    });

    expect(api.get).toHaveBeenCalledWith('/tareas');
  });
});
```

### 13.3. Comandos

```bash
cd frontend
npm run build
npm test -- --watch=false
npm run format
```

No hay script de lint en `package.json`; si se agrega Angular ESLint, actualizar este documento y los comandos de `AGENTS.md`.

---

## 14. Checklist de frontend

- [ ] Componente standalone y `OnPush`.
- [ ] `inject()` y signals donde corresponde.
- [ ] Sin lógica de negocio en el componente.
- [ ] Servicio tipado usando `ApiService`.
- [ ] Suscripciones cerradas o con `async`/`toSignal`.
- [ ] Ruta lazy y protegida si es privada.
- [ ] Formulario reactivo tipado con validaciones y mensajes.
- [ ] Estados de carga, vacío y error.
- [ ] `@for` con `track`.
- [ ] Sin `innerHTML` con contenido de usuario o IA.
- [ ] Accesibilidad: labels, foco, teclado, contraste, `alt`.
- [ ] Sin secretos ni claves en el cliente.
- [ ] Responsive y con Bootstrap antes de CSS propio.
- [ ] Pruebas del comportamiento nuevo.
- [ ] `npm run build` y `npm test -- --watch=false` pasan.
- [ ] Documentación afectada actualizada.
