# MINGO Enhanced Design System

## Visión General

Sistema de diseño mejorado con inspiración Tailwind CSS para la plataforma educativa MINGO LMS. Este sistema mantiene la identidad visual existente mientras introduce mejoras en interactividad, animaciones y utilidades.

## Paleta de Colores Mejorada

### Colores Base
| Variable | Hex | Usage | Tailwind Equivalente |
|----------|-----|-------|---------------------|
| `--mingo-bg` | `#060B18` | Fondo principal de la app | `bg-slate-950` |
| `--mingo-surface` | `#0A1128` | Tarjetas y contenedores | `bg-slate-900` |
| `--mingo-surface-hover` | `#0D1530` | Estados hover | - |
| `--mingo-border` | `#1E293B` | Bordes y divisores | `border-slate-800` |
| `--mingo-text` | `#FFFFFF` | Texto principal | `text-white` |
| `--mingo-text-muted` | `#94A3B8` | Texto secundario | `text-slate-400` |

### Colores Semánticos
| Variable | Hex | Usage | Tailwind Clase |
|----------|-----|-------|----------------|
| `--mingo-primary` | `#2563EB` | Color primario/marca | `text-blue-600` |
| `--mingo-ai` | `#38BDF8` | Componentes IA | `text-sky-400` |
| `--mingo-success` | `#10B981` | Estados éxito | `text-emerald-500` |
| `--mingo-danger` | `#F87171` | Estados error | `text-red-400` |
| `--mingo-warning` | `#FBBF24` | Estados advertencia | `text-amber-400` |

## Sistema de Espaciado (Tailwind-like)

### Padding & Margin
```css
.p-1 { padding: 0.25rem; }    /* 4px */
.p-2 { padding: 0.5rem; }     /* 8px */
.p-3 { padding: 0.75rem; }    /* 12px */
.p-4 { padding: 1rem; }       /* 16px */
.p-6 { padding: 1.5rem; }     /* 24px */
.p-8 { padding: 2rem; }       /* 32px */

/* Variantes X/Y */
.px-1, .py-1, .px-2, .py-2, etc.

/* Margin */
.m-1, .m-2, .m-3, .m-4, .m-6
```

### Border Radius
```css
.rounded-sm    /* 0.5rem / 8px */
.rounded       /* 0.75rem / 12px */
.rounded-md    /* 1rem / 16px */
.rounded-lg    /* 1.25rem / 20px */
.rounded-xl    /* 1.5rem / 24px */
.rounded-2xl   /* 2rem / 32px */
.rounded-full  /* 9999px */
```

## Sistema de Tarjetas Mejorado

### Base Card
```html
<div class="app-card p-4">
  <!-- Contenido -->
</div>
```

### Variaciones
```html
<!-- Tarjeta estándar con hover -->
<div class="app-card app-card--hover p-4">
  <!-- Contenido -->
</div>

<!-- Tarjeta elevada (más sombra) -->
<div class="app-card app-card--elevated p-4">
  <!-- Contenido -->
</div>

<!-- Efecto glass morphism -->
<div class="app-card app-card--glass p-4">
  <!-- Contenido -->
</div>

<!-- Tarjeta IA (glow azul) -->
<div class="app-card app-card--ai p-4">
  <!-- Contenido -->
</div>
```

### Estados
```html
<!-- Seleccionada -->
<div class="app-card app-card--selected p-4">

<!-- Deshabilitada -->
<div class="app-card app-card--disabled p-4">
```

## Sistema de Iconos

### Badges de Iconos
```html
<!-- Tamaños -->
<div class="icon-badge icon-badge--sm">
  <i class="bi bi-chat"></i>
</div>

<div class="icon-badge icon-badge--md">
  <i class="bi bi-chat"></i>
</div>

<div class="icon-badge icon-badge--lg">
  <i class="bi bi-chat"></i>
</div>

<div class="icon-badge icon-badge--xl">
  <i class="bi bi-chat"></i>
</div>

<!-- Variantes -->
<div class="icon-badge icon-badge--primary">
<div class="icon-badge icon-badge--ai">
<div class="icon-badge icon-badge--success">
<div class="icon-badge icon-badge--danger">
<div class="icon-badge icon-badge--gradient">

<!-- Formas -->
<div class="icon-badge icon-badge--circle">
<div class="icon-badge icon-badge--square">

<!-- Efectos -->
<div class="icon-badge icon-badge--glow">
<div class="icon-badge icon-badge--pulse">
```

## Sistema de Badges

### Badges Semánticos
```html
<span class="badge badge-primary">Estudiante</span>
<span class="badge badge-success">Activo</span>
<span class="badge badge-warning">Pendiente</span>
<span class="badge badge-danger">Error</span>
<span class="badge badge-info">IA</span>

<!-- Tamaños -->
<span class="badge badge-sm">Pequeño</span>
<span class="badge badge-md">Mediano</span>
<span class="badge badge-lg">Grande</span>
```

### Badges de IA
```html
<span class="ai-badge">
  <i class="bi bi-stars"></i>
  Asistente IA
</span>

<span class="ai-badge ai-badge--sparkle">
  Procesando...
</span>
```

## Estados y Feedback

### Status Dots
```html
<span class="status-dot status-dot--active"></span> <!-- Activo -->
<span class="status-dot status-dot--inactive"></span> <!-- Inactivo -->
<span class="status-dot status-dot--warning"></span> <!-- Advertencia -->
<span class="status-dot status-dot--error"></span> <!-- Error -->
```

### Utilidades de Color
```css
.text-primary    /* Color primario */
.text-ai         /* Color IA */
.text-success    /* Color éxito */
.text-danger     /* Color peligro */
.text-warning    /* Color advertencia */
.text-muted      /* Texto secundario */
.text-disabled   /* Texto deshabilitado */
.text-white      /* Blanco puro */

.bg-surface      /* Fondo superficie */
.bg-surface-hover /* Fondo hover */
.bg-primary-soft /* Fondo primario suave */
.bg-ai-soft      /* Fondo IA suave */
.bg-success-soft /* Fondo éxito suave */
.bg-danger-soft  /* Fondo peligro suave */
```

## Efectos Visuales

### Sombras y Glows
```css
.shadow-sm       /* Sombra pequeña */
.shadow          /* Sombra estándar */
.shadow-md       /* Sombra media */
.shadow-lg       /* Sombra grande */
.shadow-xl       /* Sombra extra grande */

.shadow-glow      /* Glow primario */
.shadow-glow-ai   /* Glow IA */
.shadow-glow-success /* Glow éxito */
```

### Efectos Glass
```css
.glass {
  background: rgba(10, 17, 40, 0.7);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.glass-strong {
  background: rgba(10, 17, 40, 0.85);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.15);
}
```

### Transiciones
```css
.transition-fast   /* 150ms */
.transition-normal /* 250ms */
.transition-slow   /* 350ms */

.hover-scale:hover { transform: scale(1.05); }
.hover-lift:hover { transform: translateY(-2px); }
```

## Tipografía Mejorada

### Encabezados
```html
<h1 class="page-title">Título Principal</h1>
<h2 class="h2">Subtítulo</h2>
<h3 class="h3">Sección</h3>
<h4 class="h4">Subsección</h4>

<span class="page-eyebrow">Etiqueta superior</span>
<p class="page-subtitle">Descripción o subtítulo</p>
```

### Gradientes de Texto
```css
/* Aplicado automáticamente a .page-title */
background: linear-gradient(135deg, var(--mingo-text), var(--mingo-ai));
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

## Componentes de IA

### Tarjeta IA Especial
```html
<div class="app-card app-card--ai p-4">
  <div class="icon-badge icon-badge--ai icon-badge--lg">
    <i class="bi bi-stars"></i>
  </div>
  <h3>Asistente IA</h3>
  <span class="ai-badge ai-badge--sparkle">Procesando RAG</span>
</div>
```

### Indicadores de IA
- `--mingo-ai`: Color principal de IA (#38BDF8)
- `--mingo-ai-soft`: Fondo suave para elementos IA
- `--mingo-ai-glow`: Glow específico para efectos IA
- `ai-badge`: Badge con icono de estrellas
- `icon-badge--ai`: Badge de icono con color IA

## Diseño Responsivo

### Grid System (Bootstrap 5 + Utilidades)
```html
<div class="container">
  <div class="row g-4">
    <div class="col-12 col-sm-6 col-md-4 col-lg-3">
      <!-- Contenido -->
    </div>
  </div>
</div>
```

### Utilidades Responsivas
```css
/* Aplicadas automáticamente en media queries */
@media (min-width: 992px) {
  .sidebar { transform: none; visibility: visible; }
  .main-area { margin-left: 280px; }
}
```

## Implementación en Angular

### Componente de Ejemplo
```typescript
import { Component } from '@angular/core';

@Component({
  selector: 'app-example',
  template: `
    <div class="app-card app-card--hover p-4">
      <div class="icon-badge icon-badge--primary mb-3">
        <i class="bi bi-card-text"></i>
      </div>
      <h3 class="h5 mb-2">Título</h3>
      <p class="text-muted mb-3">Descripción</p>
      <span class="badge badge-success">Estado</span>
    </div>
  `,
  styles: [`
    /* Estilos específicos del componente */
    :host { display: block; }
  `]
})
export class ExampleComponent {}
```

## Mejores Prácticas

1. **Usar clases de utilidad**: Preferir clases como `.text-primary`, `.bg-surface`, `.rounded-lg`
2. **Mantener consistencia**: Seguir la paleta de colores oficial
3. **Usar efectos con moderación**: Aplicar hover y animaciones solo donde añadan valor
4. **Priorizar accesibilidad**: Asegurar contraste adecuado y soporte para teclado
5. **Mobile-first**: Diseñar primero para móvil y luego adaptar a pantallas grandes
6. **Performance**: Minimizar animaciones complejas en elementos múltiples

## Comandos de Validación

```bash
# Lint
npm run lint

# Build
npm run build

# Tests
npm test -- --watch=false
```

---

*Este sistema de diseño está diseñado específicamente para MINGO LMS y mantiene todas las reglas del proyecto definidas en AGENTS.md.*