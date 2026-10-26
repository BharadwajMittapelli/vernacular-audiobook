import React, { useRef, useState } from 'react';
import {
  BookOpen,
  Play,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Users,
  FileText,
  Waves,
  Upload,
  Mic,
  Headphones,
  Building2,
  Landmark,
  Feather,
  BookMarked,
  Twitter,
  Facebook,
  Youtube,
  X,
} from 'lucide-react';
import { useNavigate } from '../context/NavigateContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const scrollTo = (id) => {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
};

export default function LandingPage() {
  const navigate = useNavigate();
  const { signIn, signUp, signInWithGoogle } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const navLink = (id, fn) => ({
    className:
      'text-sm text-foreground/70 hover:text-terracotta transition-colors cursor-pointer',
    onClick: (e) => {
      e.preventDefault();
      fn?.() ?? scrollTo(id);
    },
  });

  const Waveform = ({ count = 14, active = false }) => (
    <div className="flex items-end gap-px h-6">
      {Array.from({ length: count }).map((_, i) => {
        const h = active
          ? [3, 5, 8, 10, 12, 10, 8, 5, 3, 4, 7, 9, 6, 4][i]
          : [2, 4, 3, 5, 4, 6, 5, 3, 4, 2, 5, 4, 3, 2][i];
        return (
          <span
            key={i}
            className={`w-1 rounded-full ${active ? 'bg-terracotta' : 'bg-foreground/20'}`}
            style={{ height: `${h}px` }}
          />
        );
      })}
    </div>
  );

  const VoiceCard = ({ name, emotion, lang, featured }) => (
    <div
      className={`rounded-2xl border p-4 flex flex-col gap-3 transition-colors ${
        featured
          ? 'border-terracotta/30 bg-terracotta/10'
          : 'border-border bg-background'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-serif ${
              featured ? 'bg-terracotta text-terracotta-foreground' : 'bg-muted text-foreground'
            }`}
          >
            {name[0]}
          </div>
          <div>
            <div className="font-medium text-sm">{name}</div>
            <div className="text-xs text-muted-foreground">
              {emotion} · {lang}
            </div>
          </div>
        </div>
        <button className="text-muted-foreground hover:text-terracotta transition-colors">
          <Play size={16} fill="currentColor" />
        </button>
      </div>
      <Waveform active={featured} />
    </div>
  );

  return (
    <div className="min-h-screen bg-background font-sans text-foreground scroll-smooth">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-serif text-xl font-semibold tracking-tight">
            <div className="w-8 h-8 rounded-lg bg-terracotta flex items-center justify-center shadow-sm">
              <BookOpen className="text-terracotta-foreground" size={18} />
            </div>
            <span className="text-foreground">Ekithab AI</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm">
            <a {...navLink('production')} className="cursor-pointer">
              Features
            </a>
            <a {...navLink('voices')} className="cursor-pointer">
              Voice Library
            </a>
            <a {...navLink('publishing')} className="cursor-pointer">
              Publisher Program
            </a>
            <a
              className="text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              Pricing
            </a>
          </div>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-terracotta text-terracotta-foreground rounded-full text-sm px-4 py-2 hover:bg-terracotta/90 transition-colors"
          >
            Start Creating Free
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-12 text-center">
        <h1 className="font-serif tracking-tight text-5xl md:text-6xl mb-6">
          Create studio-quality audiobooks in days, not months.
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
          Transform your manuscripts into immersive audio experiences with lifelike Indic and global AI voices,
          synchronized text-to-speech, and global distribution.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-terracotta text-terracotta-foreground rounded-full px-6 py-3 font-medium hover:bg-terracotta/90 transition-colors"
          >
            Upload a Book
          </button>
          <button
            onClick={(e) => e.preventDefault()}
            className="border border-border bg-background rounded-full px-6 py-3 flex items-center gap-2 hover:bg-muted transition-colors"
          >
            <Play size={16} /> Watch Demo
          </button>
        </div>
        <p className="text-xs text-muted-foreground mt-4">Supported formats: PDF, EPUB, DOCX, TXT, MD</p>
      </section>

      {/* Hero Mockup */}
      <section className="max-w-5xl mx-auto px-6 mb-20">
        <img
          src="/hero-mockup.png"
          alt="Ekithab AI audiobook creation interface showing synchronized reading with voice controls"
          className="w-full h-auto rounded-3xl border border-border shadow-sm"
        />
      </section>

      {/* Social Proof */}
      <section className="max-w-6xl mx-auto px-6 mb-20 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground mb-6">
          Trusted by leading publishers, authors, &amp; indie creators
        </p>
        <div className="flex flex-wrap justify-center items-center gap-8 opacity-40 grayscale">
          {[
            { Icon: Building2, label: 'AudioBiz' },
            { Icon: Landmark, label: 'Literary Co' },
            { Icon: Feather, label: 'LITERARY' },
            { Icon: BookMarked, label: 'Bonsai Agencies' },
            { Icon: Headphones, label: 'Spotify' },
          ].map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-2 text-sm text-foreground">
              <Icon size={18} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Production */}
      <section id="production" className="max-w-6xl mx-auto px-6 mb-24">
        <div className="text-center mb-12">
          <h2 className="font-serif text-4xl tracking-tight mb-3">Frictionless AI Audiobook Production</h2>
          <p className="text-muted-foreground">The complete toolkit for authors, publishers, and platforms.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-10 items-start">
          <div className="rounded-2xl bg-[#16213e] text-white/80 p-5 shadow-lg border border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-3 h-3 rounded-full bg-red-400/70" />
              <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
              <div className="w-3 h-3 rounded-full bg-green-400/70" />
              <span className="ml-2 text-xs text-white/40">Frostbound — Chapter 1</span>
            </div>
            <div className="flex gap-4">
              <div className="w-32 space-y-2">
                {['Sidebar', 'Outline', 'Cast', 'Audio'].map((item) => (
                  <div key={item} className="h-3 bg-white/10 rounded w-full" />
                ))}
              </div>
              <div className="flex-1 space-y-3">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className={`rounded px-3 py-2 text-xs flex items-center justify-between ${
                      n === 2 ? 'bg-terracotta/20 border border-terracotta/30' : 'bg-white/5'
                    }`}
                  >
                    <span>Chapter {n} — The {['Winter', 'Fire', 'Echo', 'Return'][n - 1]}</span>
                    <span className="bg-terracotta/80 text-terracotta-foreground text-[10px] rounded-full px-2 py-0.5">
                      {n === 2 ? 'Editing' : 'Ready'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-8">
            {[
              {
                Icon: FileText,
                title: 'Smart Manuscript Parsing',
                desc: 'Auto-detects chapters, characters, and dialogues, inferring age/gender from their text.',
              },
              {
                Icon: Users,
                title: 'Multi-Voice Dialogue Generation',
                desc: 'Assigns distinctive, context-aware Indic and global voices to different characters in a single file.',
              },
              {
                Icon: Waves,
                title: 'Sovereign Indic Language Voice Engine',
                desc: 'Immersive, emotionally rich, natural-sounding multi-dialect narration for Hindi, Telugu, Tamil, Kannada, and English (en-IN).',
              },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="flex gap-4">
                <div className="w-12 h-12 rounded-xl bg-terracotta/10 text-terracotta flex items-center justify-center shrink-0">
                  <Icon size={22} />
                </div>
                <div>
                  <div className="font-medium mb-1">{title}</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Voices */}
      <section id="voices" className="max-w-6xl mx-auto px-6 mb-24">
        <div className="text-center mb-10">
          <h2 className="font-serif text-4xl tracking-tight mb-3">
            Natural-Sounding Voices that Perform, Not Just Read
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Choose from 10,000+ voices or clone a distinct style in seconds. Adjust pace, tone, and accent.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <VoiceCard name="Kaveri" emotion="Natural" lang="Hindi" featured />
          <VoiceCard name="Deepak" emotion="Conversational" lang="Telugu" />
          <VoiceCard name="Nalini" emotion="Warm" lang="Tamil" />
          <VoiceCard name="Ananya" emotion="Warm" lang="Tamil" />
        </div>
        <div className="text-center mt-8">
          <button
            onClick={() => navigate('/audio-library')}
            className="text-terracotta font-medium hover:underline"
          >
            Browse Voice Library
          </button>
        </div>
      </section>

      {/* Bento sub-grid */}
      <section className="max-w-6xl mx-auto px-6 mb-24">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-border bg-muted/30 shadow-sm p-6 flex flex-col gap-4">
            <div className="w-10 h-10 rounded-xl bg-terracotta/10 text-terracotta flex items-center justify-center">
              <Users size={20} />
            </div>
            <div>
              <div className="font-medium mb-1">Multi-character dialog</div>
              <div className="text-sm text-muted-foreground">
                Highlighting distinct overlapping speaker tracks.
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              {['Narrator', 'Character A'].map((p) => (
                <span
                  key={p}
                  className="text-xs bg-terracotta/15 text-terracotta rounded-full px-3 py-1 border border-terracotta/20"
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 shadow-sm p-6 flex flex-col gap-4">
            <div className="w-10 h-10 rounded-xl bg-terracotta/10 text-terracotta flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <div className="font-medium mb-1">Synchronized reading</div>
              <div className="text-sm text-muted-foreground">
                Visual highlighting of matching text transcripts as the audio plays.
              </div>
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-2 bg-border rounded w-full" />
              <div className="h-2 bg-terracotta/20 rounded w-4/5" />
              <div className="h-2 bg-border rounded w-3/5" />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 shadow-sm p-6 flex flex-col gap-4">
            <div className="w-10 h-10 rounded-xl bg-terracotta/10 text-terracotta flex items-center justify-center">
              <Mic size={20} />
            </div>
            <div>
              <div className="font-medium mb-1">Granular Speed &amp; Control</div>
              <div className="text-sm text-muted-foreground">Speed slider 0.5x–2.0x and credit estimator.</div>
            </div>
            <div className="pt-2 space-y-3">
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full w-1/2 bg-terracotta rounded-full" />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                {['0.5x', '1.0x', '1.5x', '2.0x'].map((v) => (
                  <span key={v} className={v === '1.0x' ? 'text-terracotta font-semibold' : ''}>
                    {v}
                  </span>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Credit estimator</span>
                <span className="text-xs text-terracotta border border-terracotta/30 rounded-full px-2 py-0.5">
                  120 credits
                </span>
              </div>
              <span className="text-xs text-muted-foreground">Based on 10 min of audio</span>
            </div>
          </div>
        </div>
      </section>

      {/* Publishing */}
      <section id="publishing" className="max-w-6xl mx-auto px-6 mb-24">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="font-serif text-4xl tracking-tight mb-4">
              Publish directly to the Ekithab Reader App
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Launch globally instantly. Earn industry-leading royalties while maintaining 100% intellectual
              property. Analyze listener insights on a unified publisher dashboard.
            </p>
          </div>
          <div className="flex items-center justify-center relative">
            {[0, 1].map((i) => (
              <div
                key={i}
                className={`rounded-[2rem] border-4 border-foreground bg-[#16213e] p-3 w-36 h-64 ${
                  i === 0 ? 'rotate-[-6deg] translate-y-4' : 'rotate-[4deg]'
                }`}
              >
                <div className="w-full h-32 bg-white/10 rounded-xl mb-3 flex items-center justify-center">
                  <BookOpen className="text-white/30" size={24} />
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-2 bg-white/15 rounded w-3/4" />
                  <div className="h-2 bg-white/10 rounded w-1/2" />
                </div>
                <div className="h-1 bg-white/10 rounded-full mb-4">
                  <div
                    className={`h-full bg-terracotta rounded-full ${i === 1 ? 'w-3/4' : 'w-1/2'}`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-terracotta flex items-center justify-center">
                    <Play size={12} fill="currentColor" className="text-terracotta-foreground" />
                  </div>
                  <span className="text-xs text-white/60">Playing...</span>
                </div>
              </div>
            ))}
            <div className="absolute text-xs bg-terracotta text-terracotta-foreground rounded-full px-3 py-1 mt-20">
              Published on Spotify & Ekithab Reader
            </div>
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="max-w-5xl mx-auto px-6 mb-24">
        <h2 className="font-serif text-4xl tracking-tight text-center mb-12">Step-by-Step Workflow</h2>
        <div className="flex flex-col md:flex-row gap-10">
          {[
            {
              num: '1',
              title: 'Upload Your Book',
              desc: 'Drag and drop PDF/EPUB',
              Icon: Upload,
            },
            {
              num: '2',
              title: 'Confirm Cast & Settings',
              desc: 'Specify narration and character voices.',
              Icon: Mic,
            },
            {
              num: '3',
              title: 'Preview, Edit & Review',
              desc: 'Dynamic edits and visual validation.',
              Icon: FileText,
            },
            {
              num: '4',
              title: 'Generate & Publish',
              desc: 'Instantly export MP3 or publish to digital reader storefronts.',
              Icon: Headphones,
            },
          ].map(({ num, title, desc, Icon }, idx, arr) => (
            <div key={num} className="flex-1 flex flex-col items-center text-center relative">
              <div className="absolute top-5 left-1/2 w-full h-px bg-border -z-10 hidden md:block" />
              <div className="w-10 h-10 rounded-full bg-terracotta text-terracotta-foreground flex items-center justify-center font-serif mb-4">
                {num}
              </div>
              <div className="rounded-2xl border border-border bg-muted/30 shadow-sm p-6 w-full">
                <div className="w-12 h-12 rounded-xl bg-terracotta/10 text-terracotta flex items-center justify-center mx-auto mb-3">
                  <Icon size={22} />
                </div>
                <div className="font-medium mb-1">{title}</div>
                <div className="text-sm text-muted-foreground">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Dark CTA + Footer */}
      <footer className="bg-foreground text-background py-20">
        <div className="max-w-4xl mx-auto px-6 text-center mb-16">
          <h2 className="font-serif text-4xl md:text-5xl tracking-tight leading-tight mb-8">
            Great stories deserve to be heard.
            <br />
            Bring your book to life now.
          </h2>
          <button
            onClick={() => setShowAuthModal(true)}
            className="bg-terracotta text-terracotta-foreground rounded-full px-8 py-4 font-medium hover:bg-terracotta/90 transition-colors"
          >
            Upload Your Document
          </button>
        </div>
        <div className="max-w-6xl mx-auto px-6">
          <div className="h-px bg-white/10 mb-8" />
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-background/60">
            <div className="flex gap-8">
              <a href="#" className="hover:text-background transition-colors">
                Site
              </a>
              <a href="#" className="hover:text-background transition-colors">
                Site
              </a>
              <a href="#" className="hover:text-background transition-colors">
                Copyrights
              </a>
            </div>
            <div className="flex items-center gap-4">
              <a aria-label="X" href="#" className="hover:text-background transition-colors">
                <Twitter size={18} />
              </a>
              <a href="#" className="hover:text-background transition-colors">
                <Facebook size={18} />
              </a>
              <a href="#" className="hover:text-background transition-colors">
                <Youtube size={18} />
              </a>
            </div>
          </div>
          <div className="text-xs text-background/40 mt-6 text-center">
            © 2026 Ekithab AI
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowAuthModal(false); }}
          role="dialog"
          aria-modal="true"
        >
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />
          <div className="relative bg-background border border-border rounded-2xl shadow-xl w-full max-w-md p-8">
            <button
              onClick={() => { setShowAuthModal(false); setAuthMode('signin'); setEmail(''); setPassword(''); setConfirmPassword(''); setAuthError(''); }}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-12 h-12 rounded-xl bg-terracotta/10 text-terracotta flex items-center justify-center mb-4">
                <BookOpen size={24} />
              </div>
              <h2 className="font-serif text-2xl tracking-tight">
                {authMode === 'signin' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="text-sm text-muted-foreground mt-2">
                {authMode === 'signin'
                  ? 'Log in to access your audiobooks.'
                  : 'Sign up to start building your audiobooks.'}
              </p>
            </div>

            {authError && (
              <div className="text-red-500 text-xs text-center mb-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {authError}
              </div>
            )}

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSubmitting(true);
                setAuthError('');

                if (authMode === 'signup' && password !== confirmPassword) {
                  setAuthError('Passwords do not match');
                  setSubmitting(false);
                  return;
                }

                let result;
                if (authMode === 'signin') {
                  result = await signIn(email, password);
                } else {
                  result = await signUp(email, password);
                }

                if (result.error) {
                  const msg = result.error.message || 'Authentication failed';
                  if (msg.toLowerCase().includes('confirm')) {
                    setAuthError(msg + ' Please check your inbox.');
                  } else {
                    setAuthError(msg);
                  }
                } else {
                  setShowAuthModal(false);
                  navigate('/my-books');
                }
                setSubmitting(false);
              }}
              className="space-y-3 mb-4"
            >
              <input
                type="email"
                placeholder="Email"
                className="w-full p-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <input
                type="password"
                placeholder="Password"
                className="w-full p-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
              />
              {authMode === 'signup' && (
                <input
                  type="password"
                  placeholder="Confirm Password"
                  className="w-full p-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-terracotta/40 focus:border-terracotta"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              )}
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-terracotta text-terracotta-foreground rounded-lg py-3 font-medium hover:bg-terracotta/90 transition-colors disabled:opacity-50"
              >
                {submitting
                  ? 'Please wait…'
                  : authMode === 'signin' ? 'Log in' : 'Create account'}
              </button>
            </form>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full h-px bg-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wider">
                <span className="bg-background px-3 text-muted-foreground">or continue with</span>
              </div>
            </div>

            <button
              onClick={() => {
                setShowAuthModal(false);
                signInWithGoogle();
              }}
              className="w-full border border-border bg-background rounded-lg py-3 font-medium text-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2 mb-4"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Continue with Google
            </button>

            <p className="text-center text-sm text-muted-foreground">
              {authMode === 'signin' ? "Don't have an account?" : 'Already have an account?'}{' '}
              <button
                type="button"
                onClick={() => { setAuthMode(authMode === 'signin' ? 'signup' : 'signin'); setAuthError(''); }}
                className="text-terracotta hover:underline font-medium"
              >
                {authMode === 'signin' ? 'Sign up' : 'Log in'}
              </button>
            </p>

            <p className="text-xs text-muted-foreground text-center mt-4">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
