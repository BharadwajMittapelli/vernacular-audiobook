import React from 'react';
import { BookOpen, ChevronRight, Radio, FileText, Smartphone, Globe } from 'lucide-react';

export function Hero({ userName, onUpload }) {
  return (
    <section className="relative bg-[#FFFBF5] py-16 px-6 overflow-hidden">
      <div className="max-w-7xl mx-auto grid lg:grid-cols-[43%_57%] gap-12 items-center">
        <div className="flex-1 min-w-0">
          <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#FFF1E8] text-terracotta mb-6">
            <span className="text-2xl">👋</span>
            <div>
              <p className="text-lg font-semibold leading-tight">Welcome back, {userName}!</p>
              <p className="text-sm text-terracotta/80">Ready to listen to something amazing today?</p>
            </div>
          </div>

          <h1 className="font-serif text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-[1.1] mb-6">
            Turn your reading<br />
            <span className="text-terracotta">into listening</span>
          </h1>

          <p className="text-base text-muted-foreground mb-8 leading-relaxed max-w-xl">
            Upload your books, choose a voice, and enjoy high-quality audio in your language — powered by AI.
          </p>

          <button
            onClick={onUpload}
            className="inline-flex items-center gap-3 bg-terracotta text-terracotta-foreground rounded-xl px-7 py-4 font-medium hover:bg-terracotta/90 transition-colors shadow-sm hover:shadow"
            aria-label="Upload a Book"
          >
            <BookOpen className="h-5 w-5" />
            <span>Upload a Book</span>
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="flex items-center gap-4 mt-8">
            <div className="flex -space-x-3">
              {['A','M','S','K'].map((i, idx) => (
                <div key={idx} className="h-9 w-9 rounded-full bg-muted border-2 border-[#FFFBF5] flex items-center justify-center text-xs font-semibold text-muted-foreground">
                  {i}
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">Join readers turning their books into beautiful audio experiences.</p>
          </div>
        </div>

        <div className="relative w-full min-h-[520px] lg:min-h-[600px] flex items-center justify-center">
          <div className="absolute inset-0 bg-gradient-to-br from-terracotta/[0.06] via-transparent to-transparent rounded-[3rem] blur-2xl" />
          <div className="relative w-full max-w-xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-terracotta/15 bg-white">
            <img
              src="/hero-mockup.png"
              alt="Audiobook Hero"
              className="w-full h-auto object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          <div className="absolute top-6 left-6 bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-border px-4 py-3 flex items-center gap-3">
            <Radio className="h-5 w-5 text-terracotta" />
            <div>
              <p className="text-sm font-semibold">Natural AI Voices</p>
              <p className="text-xs text-muted-foreground">High-quality multilingual voices</p>
            </div>
          </div>

          <div className="absolute top-6 right-6 bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-border px-4 py-3 flex items-center gap-3">
            <FileText className="h-5 w-5 text-terracotta" />
            <div>
              <p className="text-sm font-semibold">Multiple Formats</p>
              <p className="text-xs text-muted-foreground">PDF, EPUB, DOCX & more</p>
            </div>
          </div>

          <div className="absolute bottom-24 left-4 bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-border px-4 py-3 flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-terracotta" />
            <div>
              <p className="text-sm font-semibold">Listen Anywhere</p>
              <p className="text-xs text-muted-foreground">On web, mobile or offline</p>
            </div>
          </div>

          <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur rounded-2xl shadow-lg border border-border px-4 py-3 flex items-center gap-3">
            <Globe className="h-5 w-5 text-terracotta" />
            <div>
              <p className="text-sm font-semibold">Multi-language Support</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
