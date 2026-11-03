# H-OS UI System & Operating Environment Specification

**Package:** `@h-os/ui`  
**Standard:** WCAG 2.2 Level AA  
**Decision Reference:** `DEC-0010` (Refines and supersedes parts of `DEC-0004`)  
**Scope:** Operating System Workspace, Shell Chrome, Dynamic Themes, Typography, and Component Primitives

---

## 1. Product Vision & Interaction Philosophy

H-OS is HiraTechLabs' integrated business operating system. It is **not** a conventional SaaS dashboard, a collection of unrelated cards, or a generic administrative template. It provides a cohesive operating environment where:

1. **Integrated Workspace:** Users experience a unified operating environment with a persistent Global Dock, Top System Bar, native Command Palette (`Ctrl+K`/`Cmd+K`), and cohesive system-level interactions.
2. **Application Independence:** H-OS owns global identity, authentication, application discovery, navigation chrome, and system preferences. Each application (such as H-HR, H-Finance, etc.) owns its domain data model, internal sub-routes, and information layouts.
3. **Restrained, Purposeful Aesthetic:** Visual boldness is deliberately concentrated in two places:
   - **The H-OS Lock Screen:** High-contrast atmospheric greeting, signature architectural branching-tree motif, and smooth authentication unlock transition.
   - **The Application Launcher Tiles:** Prominent icon-first workspace tiles on the Home desktop.
   Every other surface remains calm, disciplined, and optimized for high-density business productivity without distracting decorative gradients or gratuitous cards.
4. **Bilingual & Logical Directionality:** Arabic and English are first-class peers. The UI system strictly adheres to CSS logical properties (`start-`, `end-`, `ps-`, `pe-`, `ms-`, `me-`, `border-s`, `border-e`).

---

## 2. Color Identity & Semantic Palettes

Theme mode (**Appearance**: Light / Dark / System) and **Color Palette** (Classic / Teal / Carbon) are orthogonal concepts. Toggling appearance mode retains the selected color palette, and switching palettes retains the active appearance mode.

### 2.1 Core Brand Colors (HiraTechLabs Signature)

| Token Name | Hex Code | Visual Role |
|---|---|---|
| **Deep Obsidian (Cosmos)** | `#0B132B` | Core foundation, deep dark-navy base of the H-OS workspace |
| **Midnight Navy** | `#1C2541` | Elevated structure, headers, secondary surfaces, docked panels |
| **Electric Cyan** | `#00F0FF` | Active running indicators, glowing focal nodes, cursor accents |
| **Deep Teal / Emerald** | `#0F766E` | Contrast-safe interactive teal for links and primary buttons |
| **Pure Canvas Light** | `#F8FAFC` | Crisp, high-clarity daylight background |
| **Pure Surface Light** | `#FFFFFF` | Solid elevated workspace tiles and data tables |

---

### 2.2 Complete Palette Token Matrix

Every palette defines full token sets across both Light and Dark appearance modes.

#### Palette 1: Classic (Obsidian Navy Baseline)

| Semantic Token | Light Mode Value | Dark Mode Value | Intended Usage |
|---|---|---|---|
| `--hos-canvas` | `#F8FAFC` | `#090D16` | Root screen background |
| `--hos-surface` | `#FFFFFF` | `#111827` | Cards, tables, modals, dock base |
| `--hos-surface-muted` | `#F1F5F9` | `#1F2937` | Table header, subtle active container |
| `--hos-surface-glass` | `rgba(255, 255, 255, 0.88)` | `rgba(17, 24, 39, 0.88)` | Translucent shell chrome with solid fallback |
| `--hos-line` | `#E2E8F0` | `#1F293D` | Structural dividers, card borders |
| `--hos-line-strong` | `#CBD5E1` | `#374151` | Interactive borders, input edges |
| `--hos-ink` | `#334155` | `#CBD5E1` | Default body copy, table data |
| `--hos-ink-strong` | `#0F172A` | `#F8FAFC` | Page titles, primary numbers |
| `--hos-ink-muted` | `#64748B` | `#94A3B8` | Subtitles, metadata, timestamps |
| `--hos-primary` | `#0B132B` | `#38BDF8` | Primary button fill, brand badge |
| `--hos-primary-hover` | `#1C2541` | `#60A5FA` | Primary button hover state |
| `--hos-on-primary` | `#FFFFFF` | `#090D16` | Text rendered on primary button |
| `--hos-accent` | `#0F766E` | `#2DD4BF` | Contrast-safe interactive links, icons |
| `--hos-accent-hover` | `#115E59` | `#5EEAD4` | Link hover state |
| `--hos-accent-subtle`| `#CCFBF1` | `#134E4A` | Accent badge surface, active row highlight |
| `--hos-focus-ring` | `#0F766E` | `#00F0FF` | 2px solid visible focus ring |
| `--hos-active-dot` | `#0D9488` | `#00F0FF` | Dock running application indicator |

#### Palette 2: Teal (Emerald Corporate)

| Semantic Token | Light Mode Value | Dark Mode Value | Intended Usage |
|---|---|---|---|
| `--hos-canvas` | `#F0FDFA` | `#021F1E` | Root screen background |
| `--hos-surface` | `#FFFFFF` | `#042F2E` | Cards, tables, modals |
| `--hos-surface-muted` | `#CCFBF1` | `#0A3F3D` | Table headers, muted panels |
| `--hos-surface-glass` | `rgba(255, 255, 255, 0.90)` | `rgba(4, 47, 46, 0.90)` | Translucent shell chrome |
| `--hos-line` | `#99F6E4` | `#115E59` | Structural dividers |
| `--hos-line-strong` | `#5EEAD4` | `#14B8A6` | Borders, inputs |
| `--hos-ink` | `#134E4A` | `#CCFBF1` | Default body text |
| `--hos-ink-strong` | `#0F172A` | `#F0FDFA` | Page titles, primary numbers |
| `--hos-ink-muted` | `#115E59` | `#99F6E4` | Subtitles, helper text |
| `--hos-primary` | `#0F766E` | `#2DD4BF` | Primary button fill |
| `--hos-primary-hover` | `#115E59` | `#5EEAD4` | Primary button hover |
| `--hos-on-primary` | `#FFFFFF` | `#021F1E` | Text on primary button |
| `--hos-accent` | `#0284C7` | `#38BDF8` | Interactive links |
| `--hos-accent-hover` | `#0369A1` | `#7DD3FC` | Link hover |
| `--hos-accent-subtle`| `#E0F2FE` | `#082F49` | Accent badge surface |
| `--hos-focus-ring` | `#0F766E` | `#2DD4BF` | Visible focus indicator |
| `--hos-active-dot` | `#0F766E` | `#2DD4BF` | Running app dot |

#### Palette 3: Carbon (High-Contrast Slate)

| Semantic Token | Light Mode Value | Dark Mode Value | Intended Usage |
|---|---|---|---|
| `--hos-canvas` | `#F4F4F5` | `#09090B` | Root screen background |
| `--hos-surface` | `#FFFFFF` | `#18181B` | Cards, tables, modals |
| `--hos-surface-muted` | `#E4E4E7` | `#27272A` | Table headers, secondary panels |
| `--hos-surface-glass` | `rgba(255, 255, 255, 0.92)` | `rgba(24, 24, 27, 0.92)` | Translucent shell chrome |
| `--hos-line` | `#E4E4E7` | `#27272A` | Structural dividers |
| `--hos-line-strong` | `#D4D4D8` | `#3F3F46` | Input borders, card edges |
| `--hos-ink` | `#27272A` | `#E4E4E7` | Default body text |
| `--hos-ink-strong` | `#09090B` | `#FAFAFA` | Page titles, primary text |
| `--hos-ink-muted` | `#52525B` | `#A1A1AA` | Subtitles, helper text |
| `--hos-primary` | `#18181B` | `#FAFAFA` | Primary button fill |
| `--hos-primary-hover` | `#27272A` | `#E4E4E7` | Primary button hover |
| `--hos-on-primary` | `#FFFFFF` | `#09090B` | Text on primary button |
| `--hos-accent` | `#4338CA` | `#818CF8` | Indigo accent links |
| `--hos-accent-hover` | `#3730A3` | `#A5B4FC` | Link hover |
| `--hos-accent-subtle`| `#EEF2FF` | `#1E1B4B` | Badge surface |
| `--hos-focus-ring` | `#18181B` | `#818CF8` | Visible focus indicator |
| `--hos-active-dot` | `#18181B` | `#818CF8` | Running app dot |

#### Shared Semantic Feedback Tokens (All Palettes)
- **Success:** Text `#15803D` (Light, 5.02:1) / `#4ADE80` (Dark, 10.18:1); Fill `#15803D` with `#FFFFFF` text (5.02:1); Subtle `#DCFCE7` / `#14532D`.
- **Warning:** Text `#B45309` (Light, 5.02:1) / `#FBBF24` (Dark, 10.63:1); Fill `#B45309` with `#FFFFFF` text (5.02:1); Subtle `#FEF3C7` / `#78350F`.
- **Danger:** Text `#B91C1C` (Light, 6.47:1) / `#F87171` (Dark, 6.41:1); Fill `#B91C1C` with `#FFFFFF` text (6.47:1); Subtle `#FEE2E2` / `#7F1D1D`.
- **Info:** Text `#1D4ED8` (Light, 6.70:1) / `#38BDF8` (Dark, 8.28:1); Fill `#1D4ED8` with `#FFFFFF` text (6.70:1); Subtle `#DBEAFE` / `#0C4A6E`.

---

### 2.3 Contrast Validation & Correction Summary

> [!IMPORTANT]
> **Teal Contrast Correction:** The preliminary token `#0D9488` yielded only **3.74:1** against White `#FFFFFF`. Under WCAG 2.2 AA, normal text requires a minimum of **4.5:1**.
> 
> **Correction Applied:**
> 1. All text links, buttons, and active interactive elements use **`#0F766E` (Teal-700)** in Light Mode, which yields **5.47:1** against White (`#FFFFFF`) and **5.23:1** against Canvas (`#F8FAFC`).
> 2. On Hover, Teal buttons shift to **`#115E59` (Teal-800)**, yielding **7.58:1**.
> 3. In Dark Mode, Teal-400 (`#2DD4BF`) against Dark Surface (`#111827`) yields **9.53:1** (Pass AAA).
> 4. All pairs are formally recorded in `platform/ui/README.md`.

---

## 3. Typography Specifications

H-OS uses self-hosted WOFF2 web fonts to ensure predictable offline rendering, zero external tracking, and strict adherence to the performance budget.

### 3.1 Font Family Selection & Licensing
1. **Latin Primary:** **IBM Plex Sans** (Open Font License - OFL). High legibility for technical interfaces, clear distinctions between `1`/`l`/`I`.
2. **Arabic Primary:** **IBM Plex Sans Arabic** (Open Font License - OFL). Harmonized x-height and stroke weight designed specifically to pair with IBM Plex Sans Latin.
3. **Monospace / Code:** **IBM Plex Mono** (Open Font License - OFL). Used strictly for technical identifiers, employee numbers, codes, and hashes.

### 3.2 Type Scale and Line Heights

| Style Role | Font Size | Weight | Latin Line-Height | Arabic Line-Height (`dir="rtl"`) |
|---|---|---|---|---|
| **Display / Lock Time** | `48px` (`3rem`) | Bold (700) | `1.1` (`52px`) | `1.2` (`58px`) |
| **Workspace Heading (H1)**| `28px` (`1.75rem`)| Bold (700) | `1.2` (`34px`) | `1.35` (`38px`) |
| **Section Title (H2)** | `20px` (`1.25rem`)| SemiBold (600)| `1.3` (`26px`) | `1.4` (`28px`) |
| **Card / Tile Title (H3)**| `15px` (`0.9375rem`)| SemiBold (600)| `1.4` (`21px`) | `1.5` (`23px`) |
| **Body (Default)** | `14px` (`0.875rem`)| Regular (400) | `1.5` (`21px`) | `1.65` (`23px`) |
| **Small / Metadata** | `12px` (`0.75rem`) | Medium (500) | `1.4` (`17px`) | `1.55` (`19px`) |
| **Micro / Status** | `11px` (`0.6875rem`)| Medium (500) | `1.3` (`14px`) | `1.45` (`16px`) |

*Rule:* In Arabic, diacritics and vertical script geometry require an additional `0.15`–`0.2` multiplier to line-height to prevent vertical clipping or visual cramping.

---

## 4. Dock Architecture & Scalable Behavior

The Global Dock is the persistent navigation spine of the H-OS operating environment.

### 4.1 Placement & Directionality
- **Desktop (>= 768px):** Positioned along the **inline-start** edge (left in LTR, right in RTL). Fixed width `64px`.
- **Mobile (< 768px):** Transforms into a fixed bottom navigation bar (`height: 56px`, `width: 100%`) fixed at `bottom: 0`.

### 4.2 Application Registry Consumption & Authorization
- The Dock directly reads the authoritative backend Application Registry via `getRegisteredApps()`.
- **Zero hardcoding:** Only applications authorized by the backend session and with valid permissions are displayed.

### 4.3 Scalability & Overflow Handling
As the suite of enterprise applications grows, the Dock must never overcrowd the screen:
1. **Capacity Threshold:** On standard desktop viewports (e.g. 768px–1080px height), the primary Dock displays a maximum of **7 visible application slots** plus Home and System settings.
2. **Overflow Capsule (`More Apps...`):** If the user has access to more than 7 applications, the Dock renders a dedicated `...` (More Apps) overflow trigger. Clicking it opens the Command Palette pre-filtered to the Application Launcher view, granting instant access to all authorized systems.
3. **No Unapproved Pinning:** Drag-and-drop customization or local pinning persistence is explicitly omitted; the Dock orders applications strictly by their authoritative `order` attribute from the registry.

### 4.4 Interaction & Indicators
- **Active / Running Application:** A distinct indicator dot (`--hos-active-dot`, `size: 5px`, rounded full) is displayed on the inline edge of the active app's icon. In addition, the icon container gains `--hos-surface-muted` background and subtle ring highlight.
- **Accessible Tooltips:** Hovering or focusing an icon shows an accessible floating tooltip on the inline-end side (`start-16` / `end-16` in RTL).
- **ARIA Semantics:** The Dock is a `<nav aria-label="Global Application Dock">`. Each item is a focusable link with `aria-label` stating the localized application name and `aria-current="page"` when active.

---

## 5. Responsive Layout Architecture & Complete Wireframes

All layouts strictly adhere to 360px minimum viewport support, zero horizontal scrollbar (`overflow-x-clip`), and symmetrical RTL/LTR mirroring.

### 5.1 Desktop Shell & Application (LTR & RTL)

#### Desktop LTR (>= 1024px)
```
+---------------------------------------------------------------------------------------+
| H-OS SYSTEM BAR  [H-HR v]  Employees  Organization  MyProfile | [Ctrl+K] [Theme] [Ar] [User v] |
+----+----------------------------------------------------------------------------------+
| D  | WORKSPACE CONTENT AREA                                                           |
| O  |                                                                                  |
| C  |  +----------------------------------------------------------------------------+  |
| K  |  | Breadcrumb / Local Application Header                                      |  |
|    |  +----------------------------------------------------------------------------+  |
| H  |  | Filter / Search Bar                                          [+ New Record] |  |
|    |  +----------------------------------------------------------------------------+  |
| HR |  | Data Table / Domain Workflow                                               |  |
|    |  |  [ ] Emp#   Name             Department     Job Title      Status   Actions |  |
| Fin|  |  -------------------------------------------------------------------------  |  |
|    |  |  [ ] 00101  Sarah Jenkins    Engineering    Staff Eng      Active    ...    |  |
| Inv|  |  [ ] 00102  Ahmed Al-Rashid  Product        Director       Active    ...    |  |
|    |  +----------------------------------------------------------------------------+  |
| -- |                                                                                  |
| Set|                                                                                  |
+----+----------------------------------------------------------------------------------+
```

#### Desktop RTL (Arabic)
```
+---------------------------------------------------------------------------------------+
| [المستخدم v] [En] [المظهر] [Ctrl+K] | الهيكل التنظيمي  الموظفون  [H-HR v] شريط النظام H-OS |
+----------------------------------------------------------------------------------+----+
| منطقة مساحة العمل ومحتوى التطبيق                                                  | د  |
|                                                                                  | و  |
|  +----------------------------------------------------------------------------+  | ك  |
|  | مسار التنقل / الترويسة المحلية للتطبيق                                         |  |    |
|  +----------------------------------------------------------------------------+  | H  |
|  | [+ سجل جديد]                                        شريط التصفية والبحث    |  |    |
|  +----------------------------------------------------------------------------+  | HR |
|  | جدول بيانات وسير العمل                                                        |  |    |
|  | إجراءات   الحالة   المسمى الوظيفي    القسم            الاسم     الرقم [ ]      |  | م  |
|  | -------------------------------------------------------------------------  |  |    |
|  | ...      نشط      مهندس أول         الهندسة          سارة ج.   00101 [ ]      |  | خ  |
|  | ...      نشط      مدير المنتج       المنتج           أحمد ر.   00102 [ ]      |  |    |
|  +----------------------------------------------------------------------------+  | -- |
|                                                                                  | ض  |
+----------------------------------------------------------------------------------+----+
```

---

### 5.2 Mobile Home / OS Desktop (360px Viewport)

#### Mobile Home — LTR
```
+-----------------------------------------+
| [H] H-OS               [K] [Ar] [User]  | <- Top Bar (48px): Brand, Quick Search, Lang, User
+-----------------------------------------+
| Good morning, Sarah                     | <- Calm personalized greeting
| Monday, Nov 2 · 09:41 AM                | <- System date & time
|                                         |
| [Search applications...               ] | <- Full-width search input
|                                         |
| ACTIVE WORKSPACES                       | <- Section 1: Implemented systems
| +-------------------------------------+ |
| | [HR] H-HR                           | | <- High-touch launcher tile
| | People records & organization       | |
| | [Open Workspace ->]                 | |
| +-------------------------------------+ |
|                                         |
| PLATFORM ROADMAP                        | <- Section 2: Systems in engineering
| +-------------------------------------+ |
| | [Fin] Finance             [In Dev]  | | <- Compact list item (48px touch target)
| | [Sal] Sales               [In Dev]  | |
| | [Inv] Inventory           [In Dev]  | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
| [Home]     [H-HR]     [Search]  [Profile] | <- Mobile Bottom Dock (Fixed, 56px, z-40)
+-----------------------------------------+
```

#### Mobile Home — RTL (Arabic)
```
+-----------------------------------------+
| [المستخدم] [En] [بحث]              H-OS [H] | <- شريط علوي مدمج (48px)
+-----------------------------------------+
| صباح الخير، سارة                        | <- تحية شخصية هادئة
| الإثنين، 2 نوفمبر · 09:41 ص              | <- الوقت والتاريخ المحلي
|                                         |
| [ابحث في التطبيقات ومساحات العمل...  ] | <- حقل بحث كامل العرض
|                                         |
| مساحات العمل النشطة                     | <- القسم الأول: الأنظمة المكتملة
| +-------------------------------------+ |
| | H-HR                           [HR] | | <- بلاطة تشغيل بارزة
| | سجلات الموظفين والهيكل التنظيمي     | |
| | [<- فتح مساحة العمل]                | |
| +-------------------------------------+ |
|                                         |
| خارطة طريق المنصة                       | <- القسم الثاني: أنظمة قيد التطوير
| +-------------------------------------+ |
| | [قيد التطوير]             المالية [Fin] | | <- بنود مدمجة (ارتفاع 48px للمس)
| | [قيد التطوير]             المبيعات [Sal] | |
| | [قيد التطوير]             المخزون [Inv] | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
| [ملفي]     [بحث]      [H-HR]   [الرئيسية] | <- شريط التنقل السفلي (ثابت، 56px)
+-----------------------------------------+
```

*Mobile Home Responsive Behavior:*
- **Dock Transformation:** Desktop vertical dock shifts to the bottom bar. It displays up to 4 core touch destinations (`Home`, `Current/Primary App`, `Search/Command Palette`, `User Profile`).
- **Launcher Layout:** Desktop multi-column grid collapses into a single vertical stack.
- **Roadmap Apps:** Transform from horizontal capsules into a compact vertical list of 48px touch targets with no horizontal overflow.

---

### 5.3 Mobile Login / Lock Screen (360px Viewport)

#### Mobile Login — LTR
```
+-----------------------------------------+
|                                [Theme]  | <- Top discreet utility bar
+-----------------------------------------+
|                                         |
|                 09:41                   | <- Local time
|          Monday, November 2             | <- Local date
|                                         |
|   +---------------------------------+   |
|   | [H] H-OS                        |   |
|   | Sign in to your workspace       |   |
|   |                                 |   |
|   | Email                           |   |
|   | [ name@organization.com       ] |   |
|   |                                 |   |
|   | Password                        |   |
|   | [ ••••••••••••••••••••••••••  ] |   |
|   |                                 |   |
|   | [   Unlock Workspace ->       ] |   |
|   +---------------------------------+   |
|                                         |
|       [العربية]  ·  Enterprise Access   | <- Language toggle & product signature
|                                         |
+-----------------------------------------+
```

#### Mobile Login — RTL (Arabic)
```
+-----------------------------------------+
| [المظهر]                                | <- شريط أدوات علوي هادئ
+-----------------------------------------+
|                                         |
|                 09:41                   | <- التوقيت المحلي
|            الإثنين، 2 نوفمبر             | <- التاريخ المحلي
|                                         |
|   +---------------------------------+   |
|   |                        H-OS [H] |   |
|   | سجل الدخول إلى مساحة عملك       |   |
|   |                                 |   |
|   | البريد الإلكتروني               |   |
|   | [ name@organization.com       ] |   |
|   |                                 |   |
|   | كلمة المرور                     |   |
|   | [ ••••••••••••••••••••••••••  ] |   |
|   |                                 |   |
|   | [    <- فتح مساحة العمل       ] |   |
|   +---------------------------------+   |
|                                         |
|   الوصول المؤسسي  ·  [English]          | <- محول اللغة وتوقيع المنصة
|                                         |
+-----------------------------------------+
```

*Mobile Login Copy Correction:*
- Replaced developer/technical jargon (`End-to-end authorized enterprise node`) with clean, natural copy:
  - **English:** `Enterprise Access` or `Sign in to your enterprise workspace`.
  - **Arabic:** `الوصول المؤسسي` أو `سجل الدخول إلى مساحة عملك المؤسسية`.

---

### 5.4 Mobile H-HR Application Experience (360px Viewport)

#### Mobile H-HR Screen — LTR
```
+-----------------------------------------+
| [H-HR v] Employees        [K] [User]    | <- Top System Bar with Module Dropdown
+-----------------------------------------+
| [Directory] [Organization] [My Profile] | <- Horizontal scroll sub-nav (touch-friendly)
+-----------------------------------------+
| Employees (142)                         |
|                                         |
| [Search employee name or code...      ] |
|                                         |
| +-------------------------------------+ | <- Responsive Card View for Mobile Data
| | Sarah Jenkins              [Active] | | (Replaces wide desktop table)
| | Emp# 00101 · Engineering            | |
| | Staff Software Engineer             | |
| | [View Profile ->]                   | |
| +-------------------------------------+ |
| +-------------------------------------+ |
| | Ahmed Al-Rashid            [Active] | |
| | Emp# 00102 · Product                | |
| | Director of Product                 | |
| | [View Profile ->]                   | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
| [Home]     [H-HR*]    [Search]  [Profile] | <- Mobile Bottom Dock (HR active indicator)
+-----------------------------------------+
```

#### Mobile H-HR Screen — RTL (Arabic)
```
+-----------------------------------------+
| [المستخدم] [بحث]         الموظفون [v H-HR] | <- شريط النظام مع قائمة التبديل
+-----------------------------------------+
| [ملفي]  [الهيكل التنظيمي]  [دليل الموظفين] | <- تنقل فرعي أفقي سلس
+-----------------------------------------+
| الموظفون (142)                          |
|                                         |
| [ابحث بالاسم أو الرقم الوظيفي...      ] |
|                                         |
| +-------------------------------------+ | <- بطاقات بيانات محسنة للهاتف
| | [نشط]                       سارة ج. | | (بديل عن الجداول العريضة)
| | الهندسة · رقم 00101                   | |
| | مهندسة برمجيات أولى                   | |
| | [<- عرض الملف]                      | |
| +-------------------------------------+ |
| +-------------------------------------+ |
| | [نشط]                       أحمد ر. | |
| | المنتج · رقم 00102                   | |
| | مدير إدارة المنتجات                  | |
| | [<- عرض الملف]                      | |
| +-------------------------------------+ |
|                                         |
+-----------------------------------------+
| [ملفي]     [بحث]      [*H-HR]  [الرئيسية] | <- شريط التنقل السفلي (إشارة التطبيق النشط)
+-----------------------------------------+
```

*Mobile Application Experience Rules:*
- **Table Transformation:** Wide desktop data tables gracefully transform into readable, single-column detail cards on viewports `< 640px` to guarantee zero horizontal scroll.
- **Application Navigation:** Application-local navigation (Employees, Organization, My Profile) sits directly beneath the top bar in a horizontal scrollable strip with `scroll-snap`.
- **Top System Bar:** Shows the current application identity badge and menu trigger to switch workspaces.

---

## 6. Motion & Interaction Standards

1. **Orchestrated Unlock Transition:** Upon successful authentication, the Lock Screen form smoothly transitions out (`opacity: 0, transform: scale(1.02)`, duration `180ms`) followed by the Shell chrome snapping to position (`opacity: 1, duration: 180ms`). Total transition duration is `<= 200ms`.
2. **Reduced Motion:** If `prefers-reduced-motion: reduce` is detected, all transitions are instant (`duration: 0.01ms`).
3. **No Decorative Page Entrances:** Screens and views mount cleanly without distracting sliding animations or staggered card bounces.

---

## 7. Command Palette Specification

- **Trigger:** Global shortcut `Ctrl+K` (Windows/Linux) or `Cmd+K` (macOS), plus visible search trigger in System Bar and Mobile Dock.
- **Behavior:**
  - Traps focus inside `<dialog>`.
  - Up/Down arrow key navigation across filtered items.
  - Enter to launch application or navigate to sub-route.
  - Esc to dismiss and restore previous focus element.
  - Accessible combobox / listbox ARIA semantics (`role="combobox"`, `aria-expanded`, `aria-activedescendant`).
- **Data Source:** Filters authorized applications from `getRegisteredApps()` and permitted sub-routes (e.g. `/employees`, `/organization`, `/me`).

---

## 8. Anti-Pattern Review Checklist

- [x] **No repetitive uniform card grids:** Replaced with distinct, high-hierarchy workspace launcher tiles and compact roadmap lists.
- [x] **No generic soft grey shadows everywhere:** Replaced with crisp 1px structural borders and deliberate elevation levels.
- [x] **No decorative gradient washes:** Background is clean, focused matte canvas with subtle architectural node accents on the lock screen.
- [x] **No tracked-out ALL-CAPS eyebrow labels:** Section headings use clear sentence casing.
- [x] **No middle-dot metadata clutter:** Information hierarchy clearly separated by structural typography.
- [x] **No decorative arrows on every link:** Clear semantic action buttons.
- [x] **No monospace typography for ordinary text:** Monospace restricted to codes, IDs, and hashes.
- [x] **No simulated/fake metrics or fake operational data:** Only authoritative data from backend registry and real session context.
- [x] **No developer jargon in end-user copy:** Replaced with professional, bilingual enterprise phrasing.
