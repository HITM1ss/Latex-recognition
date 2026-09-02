---
name: OpenTeX
colors:
  surface: '#f8f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f8f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f6'
  surface-container: '#edeef0'
  surface-container-high: '#e7e8ea'
  surface-container-highest: '#e1e2e4'
  on-surface: '#191c1e'
  on-surface-variant: '#3f4942'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f3'
  outline: '#6f7a71'
  outline-variant: '#bec9bf'
  surface-tint: '#066c43'
  primary: '#16744a'
  on-primary: '#ffffff'
  primary-container: '#16744a'
  on-primary-container: '#9ff7c2'
  inverse-primary: '#82d8a6'
  secondary: '#4f5f7b'
  on-secondary: '#ffffff'
  secondary-container: '#cdddff'
  on-secondary-container: '#51617e'
  tertiary: '#8f2735'
  on-tertiary: '#ffffff'
  tertiary-container: '#af3f4b'
  on-tertiary-container: '#ffdcdc'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9ef5c0'
  primary-fixed-dim: '#82d8a6'
  on-primary-fixed: '#002111'
  on-primary-fixed-variant: '#005231'
  secondary-fixed: '#d6e3ff'
  secondary-fixed-dim: '#b7c7e8'
  on-secondary-fixed: '#091c35'
  on-secondary-fixed-variant: '#374763'
  tertiary-fixed: '#ffdada'
  tertiary-fixed-dim: '#ffb3b6'
  on-tertiary-fixed: '#40000c'
  on-tertiary-fixed-variant: '#85202f'
  background: '#f8f9fb'
  on-background: '#191c1e'
  surface-variant: '#e1e2e4'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  formula-preview:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  formula-sm:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.5rem
  2xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  2xl: 64px
  gutter: 16px
---

## Brand & Style
The design system is engineered for high-precision academic and professional workflows. The personality is **intelligent, clinical, and efficient**, prioritizing cognitive ease over decorative flair.

The aesthetic leans into **Modern Minimalism** with a focus on data density and visual clarity. It utilizes a structured "Clean Slate" workspace philosophy, where the interface recedes to let the user's mathematical formulas take center stage. The emotional response should be one of absolute reliability—a tool that thinks as precisely as the mathematician using it.

## Colors
This design system utilizes a high-contrast palette to ensure legibility during long sessions of technical work.

- **Primary (Forest Logic Green):** `#16744A`. Used for critical actions, active states, and focus indicators. It represents growth, stability, and mathematical correctness.
- **Secondary (Steel Gray):** Reserved for structural elements like sidebar icons, secondary labels, and inactive tab states.
- **Tertiary (Oxblood Red):** Used for specialized highlighting, distinct semantic groupings, or alternative data paths.
- **Neutral (Clean Slate):** A tiered system of cool grays used to differentiate the workspace from navigation and utility panels.
- **Semantic Colors:** Success states leverage the primary green, while Error Red (`#BA1A1A`) is used exclusively for formula validation feedback and critical system status.
- **Icon/Image Surface:** Light gray preview surface `#F8F9FA` with a dot-grid latex preview background (`#E1E2E4`, 24px lattice).
- **Nav/Model states:** Active sidebar items and checked radio rows use a 10%/5% primary tint over the neutral surface (`rgba(22,116,74,.10)` / `.05`) with `#16744A` icon/text.

## Typography
The typography strategy is bifurcated: **Inter** handles the UI logic, providing a neutral, highly legible sans-serif for navigation and controls. **JetBrains Mono** is utilized for the "Output Layer," where LaTeX, code snippets, and raw formula data are displayed.

- Panels use `text-[13px]`/`text-[14px]` semibold headers with 18px Material Symbols icons.
- Badge text uses `text-[11px]` medium with rounded-full pill containers.
- All UI labels use standard sentence case, except for `label-caps`, reserved for small metadata or section headers in sidebars.
- Iconography uses **Material Symbols Outlined** (variable weight); sidebar specialty icons use inline SVG (gear/upgrade) so they can carry micro-animations.

## Layout & Spacing
**Fixed Narrow Icon Sidebar / Fluid Workspace** model. The left sidebar is an **80px (`w-20`) icon rail** (visible `md+` only, hidden on mobile). The main content area is a scrolling region (`main`, `scrollbar-gutter: stable` + `overflow-x: hidden` so the presence of the scrollbar never shifts content) hosting **two full-width views** (`max-w-[1000px]`, interchangeable via animated transitions):

- **Workspace View** — single-column flow: Upload Zone → Original Image card → Preview card → LaTeX Source panel → Floating Action Bar.
- **Settings View** — a list of setting cards: 识别模型 (model selector) plus four placeholder cards (设置项 2–5, content TBD), all sharing the same card pattern for consistent cascade animation.

Spacing is based on a **4px baseline grid**. Card bodies use `p-lg` (24px) padding; between sections use `gap-md` (16px). Panel headers are unified at `h-11` (44px) with `px-5` and a bottom hairline divider.

## Elevation & Depth
Elevation is handled through **Tonal Layering** supplemented by **Ambient Shadows**.

- **Level 0 (Base):** The main application background (`#F4F5F7`).
- **Level 1 (Cards/Workspace):** `surface-container-lowest` (`#FFFFFF`) cards with 1px `outline-variant/40` border and `shadow-sm`; hover elevates to `shadow-md`.
- **Level 2 (Floating):** The action bar uses a frosted `glass-panel` (white 80% + backdrop blur 12px), subtle border, and `shadow-lg`.

Avoid heavy blurs; depth should feel structural and crisp, not decorative.

## Shapes
Cards and panels use **Soft (0.75rem / `rounded-2xl`)** corners; buttons use `rounded-xl` (0.5rem); small icon buttons use `rounded-md`; badges use full pill (`rounded-full`).

- **Cards / Panels:** 16px radius.
- **Buttons (primary / secondary):** 12px radius.
- **Drag-and-drop zone:** 16px radius with 2px dashed primary border.

## Motion & Transitions

### View switching (cascade flight)
Both views swap with a **staggered, cascading flight** — no opacity blending, pure `translateY`. Container sets `--fly-y`, each child animates individually via `.view-fly-out > *` / `.view-fly-in > *`.

| Property | Value |
|---|---|
| Fly-out duration / ease / fill | `.24s ease forwards` |
| Fly-in duration / ease / fill | `.32s ease backwards` |
| Travel distance | `±110vh` (fully exits/enters the viewport) |
| Cascade base interval | `75ms` |
| Interval decay | `×0.8` per step (75 → 60 → 48 → 38 …) |
| Trigger | `showView('workspace' \| 'settings')` |

Direction & order rules:
- **Workspace → Settings:** workspace children cascade out **top-first** flying **up**; settings children fly **in from below** in normal order.
- **Settings → Workspace:** settings children cascade out **bottom-first** flying **down** (mirror of entry); workspace children fly **in from above** with **bottom-first** landing order.
- Safety: a "switching busy lock" captures the last requested target during an animation and performs it after the current one finishes, so rapid clicking can never blank the UI.

### Sidebar micro-animations
- **Settings (cog):** inline Lucide-style gear SVG rotates `0 → 180deg` on hover (`.5s cubic-bezier(.2,1.2,.3,1)` spring-like overshoot), returns on leave.
- **Upgrade (arrow circle):** inline SVG with three stroke-draw `<animate>` steps (ring 0.4s → shaft 0.13s → head 0.13s, delays 0.47/0.6s). Re-triggered by reinserting the node on `mouseenter`.

## Components

### Buttons
- **Primary:** Solid `#16744A`, white text, `px-5 py-2.5`, `rounded-xl`, soft primary-tinted shadow. High emphasis for "复制 LaTeX".
- **Secondary:** `surface-container-lowest` fill, `border outline-variant/30`, `px-4 py-2.5`, `rounded-xl`. "导出为图片 / 发送至 Word / 保存".
- **Icon-only:** hover `text-primary` + `bg-primary/10`, `p-1.5 rounded-md`. Panel-header copy buttons.

### Sidebar Navigation (80px icon rail)
Icon rail on `surface-container-lowest` with: brand mark (Σ, primary), two nav buttons (工作区 `edit_square`; 设置 with animated gear SVG), and a bottom upgrade button (animated arrow-circle SVG). Active nav state carries `nav-btn-item.active` (primary tint + green icon + semibold); hover shows neutral `surface-container` tint.

### Upload Drag-and-Drop Zone
Rounded-2xl dashed zone (`border-primary/30 → hover:border-primary/60`), gradient from `surface-container-lowest` to `surface-container-low`, two decorative blurred circles. Content: **"+" icon only** (`text-[40px] text-primary/60`, Material Symbols `add`), headline "粘贴或拖拽图片", and a muted support line.

### Cards: Original Image & Preview
Identical header (`px-5 h-11`, `bg-surface-container-lowest/50`, hairline, title = 18px icon + 13px semibold label, right utility slot).

- **Original Image:** size badge header (`142 × 48 px`, `text-primary bg-primary/10 rounded-full`); body `#F8F9FA`, image capped at `max-h-[120px]` inside `min-h-[160px]` area.
- **Preview:** copy icon-button header slot; white dot-grid body (`min-h-[120px]`) centering the serif formula render.

### LaTeX Source Panel
Full-width panel, 44px header ("LaTeX 源码" + green "语法有效" pill), editor body **light theme** (`background:#ffffff`), `min-h-[170px]`, VS Code Light+ syntax colors: keyword `#AF00DB`, function `#0000FF`, number `#098658`, string `#A31515`, text `#1F1F1F`.

### Status & Metric Badges
Pill `rounded-full`, `text-[11px] font-medium`, `text-primary` on `bg-primary/10`, `px-2.5 py-1`, with optional 14px icon. Shared by "语法有效", image-size tags, and settings-card number tags (2–5).

### Settings View (识别模型 + placeholders)
Each card follows the standard panel pattern. The model card uses **radio rows** (`role=radiogroup`): 标准识别 / 高精度识别 / 快速识别 with leading icon, title + description, and a right radio dot (checked = green border + filled dot, row tinted `rgba(22,116,74,.05)`, header badge mirrors the selected model). Four additional placeholder cards (设置项 2–5) keep identical structure for later content, and all five cards cascade in page transitions.

### Floating Action Bar
Frosted glass bar (`glass-panel`, `z-30`, `rounded-2xl`) at the bottom of the workspace: primary 复制 LaTeX on the left; 导出为图片 / 发送至 Word / 保存 on the right (labels collapse to icons below `sm`).

### Mobile TopNavBar
Absolute, transparent, `pointer-events-none` top bar (64px) shown only below `md`; its brand chip ("Σ OpenTeX") restores pointer events for tappability without blocking the workspace.