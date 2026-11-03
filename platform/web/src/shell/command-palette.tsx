import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { ApplicationDefinition } from '@h-os/contracts';
import { getAppIcon } from './icons.js';

export interface CommandPaletteProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly apps: readonly ApplicationDefinition[];
}

interface PaletteItem {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly path: string;
  readonly icon: string;
  readonly badge?: string;
  readonly isAvailable: boolean;
}

export function CommandPalette({ isOpen, onClose, apps }: CommandPaletteProps): ReactNode {
  const { i18n } = useTranslation();
  const router = useRouter();
  const lang = i18n.language.startsWith('ar') ? 'ar' : 'en';
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Synchronize native HTML5 dialog with isOpen state
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
        setQuery('');
        setSelectedIndex(0);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  // Construct search items from registered apps and sub-navigation
  const items: readonly PaletteItem[] = apps.flatMap((app) => {
    const displayName = app.displayName[lang] || app.displayName.en || app.name;
    const description = app.description[lang] || app.description.en || '';
    const isAvailable = app.availability === 'available';

    const mainItem: PaletteItem = {
      id: app.id,
      title: displayName,
      description,
      path: app.id === 'hr' ? '/employees' : app.route,
      icon: app.icon,
      badge: isAvailable ? undefined : (lang === 'ar' ? 'قيد التطوير' : 'In Dev'),
      isAvailable,
    };

    // Include permitted sub-navigation if implemented (H-HR)
    const subItems: PaletteItem[] =
      app.id === 'hr' && isAvailable
        ? [
            {
              id: 'hr-employees',
              title: `${displayName} → ${lang === 'ar' ? 'الموظفون' : 'Employees'}`,
              description: lang === 'ar' ? 'دليل وسجلات الموظفين' : 'Employee records and directory',
              path: '/employees',
              icon: 'hr',
              isAvailable: true,
            },
            {
              id: 'hr-organization',
              title: `${displayName} → ${lang === 'ar' ? 'الهيكل التنظيمي' : 'Organization'}`,
              description: lang === 'ar' ? 'الوحدات والفروع والمسميات' : 'Units, branches, and job titles',
              path: '/organization',
              icon: 'hr',
              isAvailable: true,
            },
            {
              id: 'hr-profile',
              title: `${displayName} → ${lang === 'ar' ? 'ملفي الوظيفي' : 'My Profile'}`,
              description: lang === 'ar' ? 'بياناتي والتعيين الحالي' : 'Personal employment details',
              path: '/me',
              icon: 'hr',
              isAvailable: true,
            },
          ]
        : [];

    return [mainItem, ...subItems];
  });

  const filteredItems = items.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return item.title.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
  });

  const handleSelect = (item: PaletteItem) => {
    if (!item.isAvailable) return;
    onClose();
    void router.navigate({ to: item.path });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = filteredItems[selectedIndex];
      if (selected) {
        handleSelect(selected);
      }
    } else if (event.key === 'Escape') {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onKeyDown={handleKeyDown}
      className="backdrop:bg-black/60 backdrop:backdrop-blur-xs fixed inset-0 z-50 m-auto w-full max-w-xl rounded-2xl border border-line bg-surface p-0 shadow-raised text-ink overflow-hidden"
      aria-label={lang === 'ar' ? 'لوحة الأوامر والتطبيقات' : 'Command Palette'}
    >
      <div className="flex flex-col">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <span className="text-ink-muted">
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-autocomplete="list"
            aria-controls="palette-results"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={lang === 'ar' ? 'ابحث عن تطبيق أو قسم (اكتب للتصفية)...' : 'Search applications and modules...'}
            className="flex-1 bg-transparent text-sm text-ink-strong placeholder:text-ink-muted focus:outline-none"
          />
          <kbd className="hos-kbd text-[10px] hidden sm:inline">ESC</kbd>
        </div>

        {/* Results List */}
        <div id="palette-results" role="listbox" className="max-h-80 overflow-y-auto p-2">
          {filteredItems.length === 0 ? (
            <p className="p-6 text-center text-xs text-ink-muted">
              {lang === 'ar' ? 'لا توجد نتائج مطابقة لبحثك' : 'No matching applications or actions found.'}
            </p>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                    isSelected ? 'bg-primary/10 text-primary' : 'text-ink hover:bg-surface-muted'
                  } ${!item.isAvailable ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-ink-muted">
                      {getAppIcon(item.icon)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink-strong truncate">{item.title}</p>
                      <p className="text-xs text-ink-muted truncate">{item.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge ? (
                      <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-ink-muted">
                        {item.badge}
                      </span>
                    ) : null}
                    {item.isAvailable ? (
                      <kbd className="hos-kbd text-[10px] hidden sm:inline">↵</kbd>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-line/60 bg-surface-muted/40 px-4 py-2 text-[11px] text-ink-muted">
          <span>{lang === 'ar' ? 'استخدم الأسهم للتنقل و Enter للاختيار' : 'Use arrows to navigate, Enter to select'}</span>
          <span className="font-mono text-[10px]">H-OS Workspace</span>
        </div>
      </div>
    </dialog>
  );
}
