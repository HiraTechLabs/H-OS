# @h-os/ui — Design System & Component Primitives

Foundational design tokens, theme engine, accessible React primitives, and operating system chrome for H-OS applications.

---

## Contrast Validation Matrix (WCAG 2.2 AA)

As required by `DEC-0004` and `DEC-0010`, all foreground and background pairings are mathematically evaluated using the relative luminance formula `(L1 + 0.05) / (L2 + 0.05)`. Every combination deployed for normal body copy meets the minimum 4.5:1 ratio, large text/headings meet 3:1, and active UI controls/focus rings meet 3:1.

### 1. Default Brand & Semantic Pairs (Obsidian / Classic Palette)

| Foreground Color | Background Color | Calculated Ratio | WCAG 2.2 Level | Intended Usage & State |
|---|---|---|---|---|
| Text Strong `#0F172A` | Light Canvas `#F8FAFC` | **17.06:1** | AAA (Normal Text) | Light mode page titles, primary headers |
| Text Body `#334155` | Light Canvas `#F8FAFC` | **9.90:1** | AAA (Normal Text) | Light mode body copy, labels |
| Text Muted `#64748B` | Light Canvas `#F8FAFC` | **4.55:1** | AA (Normal Text) | Light mode secondary descriptions, timestamps |
| Text Strong `#0F172A` | Light Surface `#FFFFFF` | **17.85:1** | AAA (Normal Text) | Light mode card and table text |
| Text Body `#334155` | Light Surface `#FFFFFF` | **10.35:1** | AAA (Normal Text) | Light mode table cells, form inputs |
| Text Muted `#64748B` | Light Surface `#FFFFFF` | **4.76:1** | AA (Normal Text) | Light mode table headers, helper text |
| Brand Obsidian `#0B132B` | Light Surface `#FFFFFF` | **18.38:1** | AAA (Normal Text) | Light mode brand text, links |
| Brand Button `#FFFFFF` | Brand Obsidian `#0B132B` | **18.38:1** | AAA (Normal Text) | Primary solid button (Resting state) |
| Brand Button Hover `#FFFFFF` | Brand Midnight `#1C2541` | **12.63:1** | AAA (Normal Text) | Primary solid button (Hover state) |
| Focus Ring `#0F766E` | Light Canvas `#F8FAFC` | **5.23:1** | AA (UI Component) | Light mode focus outline (2px solid) |
| Focus Ring `#00F0FF` | Dark Canvas `#090D16` | **13.79:1** | AAA (UI Component) | Dark mode high-visibility focus ring |
| Text Strong `#F8FAFC` | Dark Canvas `#090D16` | **18.57:1** | AAA (Normal Text) | Dark mode page titles, headers |
| Text Body `#CBD5E1` | Dark Canvas `#090D16` | **13.09:1** | AAA (Normal Text) | Dark mode body text |
| Text Muted `#94A3B8` | Dark Canvas `#090D16` | **7.58:1** | AAA (Normal Text) | Dark mode captions, secondary info |
| Text Strong `#F8FAFC` | Dark Surface `#111827` | **16.96:1** | AAA (Normal Text) | Dark mode card and tile headings |
| Text Body `#CBD5E1` | Dark Surface `#111827` | **11.95:1** | AAA (Normal Text) | Dark mode table cells, form fields |
| Text Muted `#94A3B8` | Dark Surface `#111827` | **6.92:1** | AAA (Normal Text) | Dark mode table headers, helper text |

---

### 2. Teal Accent & Button Evaluation (Crucial Validation)

> [!IMPORTANT]
> **Teal Correction Note:** Pure Teal `#0D9488` against pure White `#FFFFFF` yields **3.74:1**. While acceptable for large headings (>24px) or non-text UI graphical components under WCAG 2.2, it **fails** the 4.5:1 requirement for normal text.
> 
> Therefore, `@h-os/ui` establishes the following rules:
> 1. When White text is rendered on a solid Teal button, the background token is set to **`#0F766E` (Teal-700)** yielding **5.47:1** (Pass AA) or **`#115E59` (Teal-800)** on hover yielding **7.58:1** (Pass AA).
> 2. When Teal text is rendered directly on a light surface (`#FFFFFF`/`#F8FAFC`), the text token is set to **`#0F766E`** yielding **5.47:1** (Pass AA).
> 3. Bright Teal `#0D9488` is strictly reserved for non-text borders, badge outlines, and decorative graphical accents.
> 4. In Dark Mode, Teal-400 `#2DD4BF` against Dark Surface `#111827` yields **9.53:1** (Pass AAA).

| Foreground Color | Background Color | Calculated Ratio | WCAG 2.2 Level | Status & Rule |
|---|---|---|---|---|
| White Text `#FFFFFF` | Raw Teal `#0D9488` | **3.74:1** | Fail (<4.5:1 normal) | **CORRECTED:** Restricted to UI components only |
| White Text `#FFFFFF` | Deep Teal `#0F766E` | **5.47:1** | AA (Normal Text) | **PASSED:** Primary Teal Button (Resting) |
| White Text `#FFFFFF` | Dark Teal `#115E59` | **7.58:1** | AA (Normal Text) | **PASSED:** Primary Teal Button (Hover) |
| Deep Teal Text `#0F766E` | Light Surface `#FFFFFF` | **5.47:1** | AA (Normal Text) | **PASSED:** Teal text links on light background |
| Dark Surface `#111827` | Teal-400 `#2DD4BF` | **9.53:1** | AAA (Normal Text) | **PASSED:** Dark mode Teal primary button |
| Teal-400 `#2DD4BF` | Dark Surface `#111827` | **9.53:1** | AAA (Normal Text) | **PASSED:** Dark mode Teal text links & icons |

---

### 3. Semantic Status Pairs (Success, Warning, Danger, Info)

| Status | Foreground | Background | Calculated Ratio | WCAG 2.2 Level | Context |
|---|---|---|---|---|---|
| **Success** | `#15803D` | `#FFFFFF` | **5.02:1** | AA (Normal Text) | Light mode success text |
| **Success** | `#FFFFFF` | `#15803D` | **5.02:1** | AA (Normal Text) | Light mode success badge/button |
| **Success Dark**| `#4ADE80` | `#111827` | **10.18:1** | AAA (Normal Text) | Dark mode success text |
| **Warning** | `#B45309` | `#FFFFFF` | **5.02:1** | AA (Normal Text) | Light mode warning text |
| **Warning** | `#FFFFFF` | `#B45309` | **5.02:1** | AA (Normal Text) | Light mode warning badge/button |
| **Warning Dark**| `#FBBF24` | `#111827` | **10.63:1** | AAA (Normal Text) | Dark mode warning text |
| **Danger** | `#B91C1C` | `#FFFFFF` | **6.47:1** | AAA (Normal Text) | Light mode error text |
| **Danger** | `#FFFFFF` | `#B91C1C` | **6.47:1** | AAA (Normal Text) | Light mode error badge/button |
| **Danger Dark** | `#F87171` | `#111827` | **6.41:1** | AA (Normal Text) | Dark mode error text |
| **Info** | `#1D4ED8` | `#FFFFFF` | **6.70:1** | AAA (Normal Text) | Light mode info text |
| **Info** | `#FFFFFF` | `#1D4ED8` | **6.70:1** | AAA (Normal Text) | Light mode info badge/button |
| **Info Dark** | `#38BDF8` | `#111827` | **8.28:1** | AAA (Normal Text) | Dark mode info text |

---

### 4. Alternative Color Palettes (Teal & Carbon)

#### Palette: Teal (Emerald Corporate)
- **Light:** Surface `#FFFFFF`, Canvas `#F0FDFA`, Text Strong `#0F172A`, Text Body `#134E4A` (8.9:1), Primary Action `#0F766E` with White Text (5.47:1), Accent `#0284C7` (5.1:1).
- **Dark:** Surface `#042F2E`, Canvas `#021F1E`, Text Strong `#F0FDFA` (17.2:1), Text Body `#CCFBF1` (14.5:1), Primary Action `#2DD4BF` with Dark Text `#021F1E` (10.2:1), Accent `#38BDF8` (8.5:1).

#### Palette: Carbon (High-Contrast Slate)
- **Light:** Surface `#FFFFFF`, Canvas `#F4F4F5`, Text Strong `#09090B` (19.8:1), Text Body `#27272A` (14.9:1), Primary Action `#18181B` with White Text (17.7:1), Accent `#4338CA` (7.9:1).
- **Dark:** Surface `#18181B`, Canvas `#09090B`, Text Strong `#FAFAFA` (19.4:1), Text Body `#E4E4E7` (14.6:1), Primary Action `#FAFAFA` with Dark Text `#09090B` (19.4:1), Accent `#818CF8` on Surface (5.8:1).

---

## Token Reference
All tokens are defined in `platform/ui/src/styles.css` and consumed via Tailwind CSS variables. Direct raw hex codes or physical coordinate properties (`left`/`right`/`ml`/`mr`) are forbidden in application packages.
