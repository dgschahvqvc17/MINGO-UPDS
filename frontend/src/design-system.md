# Sistema de diseño MINGO — Pizarra + ámbar

Lienzo gris pizarra claro, tinta carbón, azul petróleo **solo en navegación** y ámbar
como acento de acciones. Todas las variables se definen en `styles.css`.

## 1. Paleta

| Variable | Valor | Uso |
|---|---|---|
| `--mingo-bg` | `#e9edf1` | Fondo de la aplicación |
| `--mingo-bg-gradient` | `#f3f6f8 → #e9edf1` | Degradado suave del lienzo |
| `--mingo-surface` | `#ffffff` | Tarjetas y contenedores |
| `--mingo-surface-alt` | `#f5f7f9` | Superficies secundarias |
| `--mingo-surface-hover` | `#eef2f5` | Estado hover de superficies |
| `--mingo-border` | `#c5cfd8` | Bordes y divisores |
| `--mingo-border-hover` | `#94a3b1` | Bordes en hover |
| `--mingo-border-soft` | `rgba(28, 39, 51, 0.12)` | Bordes sutiles y rejillas |
| `--mingo-text` | `#1c2733` | Texto principal (carbón) |
| `--mingo-text-muted` | `#4c5b6b` | Texto secundario (contraste ≥ 4.5:1) |
| `--mingo-text-disabled` | `#778595` | Texto deshabilitado |
| `--mingo-nav` | `#103f4c` | Azul petróleo de la navegación |
| `--mingo-nav-deep` | `#0a2f39` | Extremo oscuro del degradado lateral |
| `--mingo-nav-text` | `#eef5f7` | Texto sobre navegación |
| `--mingo-nav-text-muted` | `#b6ccd2` | Texto secundario sobre navegación |
| `--mingo-accent` | `#b45309` | Ámbar: botones primarios y acentos |
| `--mingo-accent-hover` | `#92400e` | Ámbar oscurecido en hover |
| `--mingo-accent-soft` | `rgba(180, 83, 9, 0.1)` | Fondos de acento |
| `--mingo-ai` | `#8a5a12` | Ámbar profundo para elementos de IA |
| `--mingo-success` | `#15803d` | Estado correcto |
| `--mingo-warning` | `#a16207` | Estado de advertencia |
| `--mingo-danger` | `#b91c1c` | Estado de error |

Los alias `--mingo-primary*`, `--mingo-muted`, `--color-*`, `--app-bg` y `--mat-color`
apuntan a estos tokens para no romper las features heredadas.

## 2. Tipografía

- **Fuente**: `Segoe UI`, `system-ui`, `-apple-system`, `Helvetica Neue`, Arial, sans-serif.
- **Tinta**: `--mingo-text` sobre fondo claro; blanco sobre navegación petróleo.
- **Jerarquía**: encabezados en negrita con interletrado negativo; `h1` 1.85 rem,
  `h2` 1.4 rem, `h3` 1.15 rem. Los títulos de página son carbón, sin degradados de texto.
- **Monoespacio**: `JetBrains Mono`, `Cascadia Code`, `Fira Code`, monospace.

## 3. Componentes

### Tarjetas
- Fondo `--mingo-surface`, borde `1px solid --mingo-border`, radio `--mingo-radius-lg`.
- Sombra neutra `--mingo-shadow`; en hover, borde ámbar suave. Sin resplandores azules.

### Insignias de icono
- Contenedor redondeado con fondo `--mingo-accent-soft` o `--mingo-ai-soft`.
- Borde tenue y color `--mingo-accent-hover` o `--mingo-ai`.

### Indicadores de IA
- Píldora con fondo `--mingo-ai-soft`, borde y texto `--mingo-ai`.
- Sin cian ni glow: el acento es ámbar profundo para distinguirse de las acciones.

### Puntos de estado
- 0.5 rem de diámetro, colores `--mingo-success`, `--mingo-warning`, `--mingo-danger`.
- Animación de pulso desactivada con `prefers-reduced-motion`.

### Botones
- **Primario**: fondo `--mingo-accent`, texto blanco; hover `--mingo-accent-hover`.
- **Secundario**: texto carbón, borde `--mingo-border-hover`, hover gris pizarra.
- **Peligro**: `--mingo-danger` sobre fondo claro.
- Todos conservan el foco visible (`outline: 2px solid --mingo-nav`).

## 4. Estructura

### Barra lateral
- 280 px en escritorio; oculta y deslizable en móvil; riel colapsado de 84 px.
- Fondo degradado `--mingo-nav → --mingo-nav-deep`, texto claro.
- Elemento activo: fondo `--mingo-nav-soft` con barra interior ámbar.

### Barra superior
- Fondo `--mingo-surface`, borde inferior `--mingo-border`, posición sticky.
- Título de sección en carbón, sin `h1` duplicado: cada página aporta su propio `h1`.

### Contenido
- Padding 1.25 rem en móvil y 1.75–3 rem en escritorio.
- Grid de Bootstrap 5 con gutters estándar.

## 5. Accesibilidad

- Todos los campos con `label` asociado por `for`/`id`.
- Errores de validación con `id`, `role="alert"` y `aria-describedby`/`aria-invalid`.
- Botones de icono con `aria-label` y `type` explícito.
- Navegación móvil con `aria-controls` y `aria-expanded`.
- Foco visible nunca se elimina; se respeta `prefers-reduced-motion`.
- `data-bs-theme="light"` y `theme-color` pizarra en `index.html`.

## 6. Notas de implementación

1. Usar siempre los tokens de `styles.css`; evitar literales de color en componentes.
2. Bootstrap Icons se carga en `angular.json`.
3. Preferir Bootstrap 5 antes que CSS propio.
4. El azul petróleo queda confinado a la navegación; el ámbar a las acciones.
5. No introducir librerías nuevas ni cambios funcionales en este rediseño.
