import React from 'react';
import { AppLayout } from './AppLayout.jsx';
import { ChapterListPanel } from './ChapterListPanel.jsx';

export function StudioLayout({ book, activeChapterIdx, chapter, onChapterSelect, onNavClick, activePath, children, bottomBar }) {
  const contextualSidebar = (
    <ChapterListPanel
      book={book}
      activeChapterIdx={activeChapterIdx}
      onChapterSelect={onChapterSelect}
    />
  );

  return (
    <AppLayout activePath="/" onNavClick={onNavClick} contextualSidebar={contextualSidebar}>
      <div className="flex-1 flex flex-col overflow-hidden h-full">
        <main className="flex-1 overflow-hidden">{children}</main>
        {bottomBar && <div className="shrink-0">{bottomBar}</div>}
      </div>
    </AppLayout>
  );
}
