import React from 'react';
import { ChapterListPanel } from './ChapterListPanel.jsx';
import { TopBar } from './TopBar.jsx';

export function MainLayout({
  book,
  activeChapterIdx,
  chapter,
  onChapterSelect,
  onNavClick,
  activePath,
  children,
  bottomBar,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div
        className={`
          fixed top-0 left-0 z-50 h-full w-64
          bg-sidebar border-r border-border
          transition-transform duration-200 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-0
        `}
        role="navigation"
        aria-label="Chapter navigation"
      >
        <ChapterListPanel
          book={book}
          activeChapterIdx={activeChapterIdx}
          onChapterSelect={onChapterSelect}
        />
      </div>

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopBar
          chapter={chapter}
          activeIdx={activeChapterIdx}
          onMenuClick={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 overflow-hidden">{children}</main>

        {bottomBar && (
          <div className="shrink-0">{bottomBar}</div>
        )}
      </div>
    </div>
  );
}
