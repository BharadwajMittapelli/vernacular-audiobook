import React from 'react';
import { Upload, BookOpen, Clock, Settings, ChevronRight } from 'lucide-react';

const ACTIONS = [
  {
    icon: Upload,
    title: 'Upload a Book',
    description: 'Start with a new document',
    route: '/my-books',
  },
  {
    icon: BookOpen,
    title: 'Browse My Books',
    description: 'View your library',
    route: '/my-books',
  },
  {
    icon: Clock,
    title: 'Recent Activity',
    description: 'Continue where you left off',
    route: '/home',
  },
  {
    icon: Settings,
    title: 'Settings',
    description: 'Manage your preferences',
    route: '/settings',
  },
];

export function QuickActions({ onAction }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {ACTIONS.map(({ icon: Icon, title, description, route }) => (
        <button
          key={title}
          onClick={() => onAction?.(route)}
          className="w-full text-left rounded-xl border border-border bg-card p-5 transition-all duration-150 hover:shadow-md hover:border-terracotta/30 flex items-start gap-4 group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-lg bg-terracotta/10 flex items-center justify-center text-terracotta shrink-0">
            <Icon className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-terracotta transition-colors shrink-0 mt-1" />
        </button>
      ))}
    </div>
  );
}
