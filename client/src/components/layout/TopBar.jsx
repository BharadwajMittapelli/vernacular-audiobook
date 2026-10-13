import React from 'react';
import { Upload, Settings, Menu, LogOut as LogoutIcon } from 'lucide-react';
import { Button } from '../ui/button.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export function TopBar({
  book,
  chapter,
  activeIdx,
  onMenuClick,
  onLoadNewBook,
  onOpenConfig,
}) {
  const { signOut } = useAuth();
  return (
    <header className="h-14 border-b border-border bg-sidebar/50 backdrop-blur-sm flex items-center px-4 gap-3 shrink-0">
      <button
        className="lg:hidden p-1.5 rounded-md hover:bg-elevated"
        onClick={onMenuClick}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0">
        {book ? (
          <div className="flex items-baseline gap-2 overflow-hidden">
            <span className="text-sm font-semibold truncate">{book.title}</span>
            <span className="text-muted-foreground text-xs shrink-0">
              Ch. {activeIdx + 1} · {chapter?.title}
            </span>
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">No book loaded</span>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0">
{book && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onLoadNewBook}
                aria-label="Load new book"
              >
                <Upload className="h-4 w-4 mr-1.5" />
                New
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenConfig}
                disabled={!book}
                aria-label="Open audio configuration"
              >
                <Settings className="h-4 w-4 mr-1.5" />
                Configure
              </Button>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await signOut();
            }}
            aria-label="Sign out"
          >
            <LogoutIcon className="h-4 w-4" />
            Logout
          </Button>
        </div>
    </header>
  );
}
