-- V2: JIT transcript normalization columns on chapters.
-- raw_text keeps the original extracted document text permanently (retry
-- source for normalization; manual edits never overwrite it).
-- normalized=false blocks synthesis for Indic-language chapters until the
-- Groq transcript normalizer (or the needsNormalization skip path) runs.
-- Default true keeps legacy rows and en-IN books synthesis-eligible.
-- Safe to run repeatedly.

alter table public.chapters
  add column if not exists raw_text text,
  add column if not exists normalized boolean not null default true,
  add column if not exists normalized_words jsonb;

update public.chapters set raw_text = text_content where raw_text is null;
