# MINGO Design System

## Color Palette

| Variable | Hex | Usage |
|----------|-----|-------|
| `--mingo-bg` | `#060B18` | Main application background |
| `--mingo-surface` | `#0A1128` | Card backgrounds, containers |
| `--mingo-surface-strong` | `#0D1530` | Darker surface variations |
| `--mingo-border` | `#1E293B` | Borders and dividers |
| `--mingo-border-soft` | `rgba(148, 163, 184, 0.16)` | Subtle borders |
| `--mingo-text` | `#FFFFFF` | Primary text |
| `--mingo-muted` | `#94A3B8` | Secondary/placeholder text |
| `--mingo-primary` | `#2563EB` | Brand color (blue-600) |
| `--mingo-primary-strong` | `#1D4ED8` | Darker primary |
| `--mingo-primary-soft` | `rgba(37, 99, 235, 0.16)` | Light primary |
| `--mingo-ai` | `#38BDF8` | AI/cyan color (blue-400) |
| `--mingo-ai-soft` | `rgba(56, 189, 248, 0.14)` | Light AI |
| `--mingo-success` | `#10B981` | Success/emerald |
| `--mingo-success-soft` | `rgba(16, 185, 129, 0.14)` | Light success |
| `--mingo-danger` | `#F87171` | Error/danger |
| `--mingo-danger-soft` | `rgba(248, 113, 113, 0.12)` | Light danger |

## Typography

- **Primary Font**: Segoe UI, system-ui, Helvetica Neue, Arial, sans-serif
- **Text Color**: `--mingo-text` (#FFFFFF) for dark mode
- **Hierarchy**:
  - Headings: Bold weight, tight letter-spacing
  - Subtitles: Regular weight, muted color
  - Labels: Uppercase, smaller size

## UI Components

### Cards
- **Border Radius**: `--mingo-radius-lg` (1rem)
- **Border**: 1px solid `--mingo-border`
- **Background**: `--mingo-surface`
- **Shadow**: `--mingo-shadow-card`
- **Hover Effect**: Subtle blue glow on border and shadow
- **Border on Hover**: `rgba(37, 99, 235, 0.5)`

### Icon Badges
- **Container**: Rounded square (border-radius: `--mingo-radius-sm`)
- **Background**: `--mingo-primary-soft` or `--mingo-ai-soft`
- **Border**: 1px solid `rgba(37, 99, 235, 0.35)`
- **Color**: White or `--mingo-ai`
- **Size**: 2.75rem × 2.75rem (lg) or 3.5rem × 3.5rem (lg)

### AI Indicators
- **Badge**: Rounded pill (border-radius: 999px)
- **Background**: `--mingo-ai-soft`
- **Border**: 1px solid `rgba(56, 189, 248, 0.35)`
- **Color**: `--mingo-ai`
- **Shadow**: `0 0 18px rgba(56, 189, 248, 0.18)`
- **Icon**: Bootstrap "stars" icon

### Status Dots
- **Size**: 0.5rem diameter
- **Color**: `--mingo-success`
- **Shadow**: `0 0 10px rgba(16, 185, 129, 0.7)`

### Buttons
- **Primary**: `--mingo-primary` background, white text
- **Outline**: Muted color with subtle border
- **Danger**: `--mingo-danger` with white text
- **Icon Buttons**: 2.5rem × 2.5rem, padded, with hover states

## Layout Structure

### Sidebar
- **Width**: 280px (mobile: hidden)
- **Background**: Linear gradient from `--mingo-surface` to darker shade
- **Border**: 1px solid `--mingo-border`
- **Animation**: Smooth translateX transition

### Topbar
- **Background**: `rgba(6, 11, 24, 0.78)`
- **Border**: 1px solid `--mingo-border`
- **Spacing**: 1rem padding
- **Actions**: Right-aligned user chip and action buttons

### Main Content
- **Padding**: 1.25rem (mobile), 1.75-3rem (desktop)
- **Grid System**: Bootstrap 5 grid with gutter classes

## Implementation Notes

1. All components should use the CSS variables defined in `styles.css`
2. Use Bootstrap Icons for all icons (loaded in `angular.json`)
3. Follow the card hover pattern: subtle blue glow effect
4. AI components should use the cyan/blue color scheme consistently
5. Maintain dark mode compatibility throughout