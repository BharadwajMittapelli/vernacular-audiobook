import React from 'react';
import { Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';

export function MainLayout({
  book,
  activeChapterIdx,
  chapter,
  onChapterSelect,
  onNavClick,
  onLoadNewBook,
  children,
  bottomBar,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        book={book}
        activeChapterIdx={activeChapterIdx}
        onChapterSelect={(idx) => {
          onChapterSelect(idx);
          setMobileMenuOpen(false);
        }}
        onNavClick={onNavClick}
        isMobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <TopBar
          book={book}
          chapter={chapter}
          activeIdx={activeChapterIdx}
          onMenuClick={() => setMobileMenuOpen(true)}
          onLoadNewBook={onLoadNewBook}
        />

        <main className="flex-1 overflow-hidden">{children}</main>

        {bottomBar && (
          <div className="shrink-0">{bottomBar}</div>
        )}
      </div>
    </div>
  );
}
