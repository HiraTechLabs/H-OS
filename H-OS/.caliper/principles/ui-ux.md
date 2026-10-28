# UI and UX Principles (UX)

H-OS looks and behaves like an operating system: one shell, many apps, one design language.

### UX-001 [must|review] ui
All apps render inside the H-OS shell (top bar, launcher, command palette, notifications, user menu). Apps never build their own chrome.

### UX-002 [must|test] ui, permissions
The launcher shows only the apps the user may open, computed from the server's permission list. The server enforces access regardless.

### UX-003 [must|test] ui, perf
Switching apps is seamless: no full page reload, no second login, shell state preserved. App code is lazy-loaded and prefetched on intent.

### UX-004 [must|review] ui, org-tree
Any mention of an entity from another app renders as an entity link with a hover card that opens inside the shell. Deep links work for every entity.

### UX-005 [must|lint] ui
One design system: shadcn/ui with Tailwind tokens in `@h-os/ui`. No hardcoded colors, spacing, fonts or shadows. No other component library.

### UX-006 [must|lint] ui, i18n
All user-facing strings go through i18n keys with `en` and `ar` catalogs. Use logical CSS properties only (`ms-`, `ps-`, `start-`, `end-`); physical `left` and `right` are forbidden. Dates, numbers and currency use locale formatting.

### UX-007 [must|test] ui, a11y
WCAG 2.2 AA: full keyboard operation, visible focus, labels on every control, sufficient contrast, reduced-motion respected.

### UX-008 [must|review] ui
Every screen defines loading (skeleton), empty, error and no-permission states. No blank screens, no endless spinners.

### UX-009 [must|review] ui
Destructive or irreversible actions state their consequence and ask for confirmation, or offer undo. Forms keep user input on error and show inline, plain-language validation.

### UX-010 [should|review] ui
Data tables follow one pattern: server-side pagination, sort and filter, column chooser, saved views, export, keyboard navigation.

### UX-011 [should|review] ui
Copy is short and action-oriented with consistent verbs. No filler sentences. Icons come from the icon set, not emoji.

### UX-012 [should|review] ui
Motion is purposeful and under 200 ms.

### UX-013 [must|review] ui
Each app documents its screens, navigation and states in its own UI spec before implementation, following the H-OS shell and design system.

### UX-014 [must|review] ui, perf, a11y, i18n
Dashboards and visualizations are first-class product capabilities. H-OS provides a unified, professional, responsive design system across all applications. Dashboards prioritize information hierarchy, readable KPIs, trends, comparisons and actionable insights over decorative graphics. Charts and diagrams use clear titles, labels, units, legends where needed, appropriate scales, and explicit empty, loading and error states. Visualizations are accessible and understandable in both Arabic and English; they do not rely on color alone to communicate meaning. Hierarchical structures, reporting lines, workflows and approval chains use appropriate visual forms with search, expansion/collapse, and detail inspection when large datasets require it.

The following initial visual direction is a proposal for evaluation and documentation only and does not constitute an approved architectural decision: Deep Navy `#172554`, Teal `#0D9488`, Background `#F8FAFC`, Main text `#334155`, Warning `#D97706`. Semantic success, warning, error and informational colors must be defined separately, and color contrast must be validated for intended use. Light mode is the default baseline; the dark-mode path is documented without expanding the initial scope unnecessarily.

### UX-015 [must|review] ui, perf, a11y
Switching apps does not trigger a full page reload or unnecessary reauthentication. Shell state, browser history and deep links remain predictable; transitions are purposeful, brief and under 200 ms, with reduced-motion support and no decorative motion. Navigation is responsive for desktop, tablet and phone, with consistent behavior for menus, dialogs, forms, tables, notifications, search and keyboard interactions. Critical navigation journeys and perceived performance must have measurable or automated acceptance criteria. Avoid animations or effects that add no product value.

### UX-016 [must|test] ui, i18n, a11y, testing
H-OS is a responsive web application that works well on desktop computers, tablets and mobile phones. Supported viewport ranges are tested at representative narrow, medium and wide breakpoints. Content, forms, tables, dashboards, charts, navigation, dialogs and hierarchical diagrams remain usable on small screens. Complex tables and diagrams use deliberate mobile behavior such as responsive columns, horizontal scrolling where justified, alternate card views or focused detail views. Controls are touch-friendly and never depend on hover. Horizontal page overflow, clipped actions and unreadable text are not allowed. Arabic RTL and English LTR layouts are both validated on phone-sized viewports.
