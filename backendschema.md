# 5. Backend Schema Document

**Database:** Supabase PostgreSQL.

**Table 1: users** (Mocked for MVP)  
* `id` (UUID, PK) - eKithab user ID  
* `email` (String, Unique) - User email  
* `credits` (Integer) - Balance for audio generation (Default: 500)

**Table 2: audio_generations**  
* `id` (UUID, PK) - Unique generation ID  
* `user_id` (UUID, FK) - Creator ID  
* `chapter_id` (String, Index) - Reference to eKithab chapter  
* `language` (String) - e.g., 'hi-IN'  
* `audio_url` (String) - Supabase public bucket URL  
* `duration` (Float) - Total audio duration in seconds  
* `credits_used` (Integer) - Cost of this generation  
* `alignment` (JSONB) - Sentence-level timestamps `[{ sentenceIndex, text, startTime, endTime }]`  
* `idempotency_key` (UUID, Unique) - Client-provided key for deduplication  
* `status` (Enum) - 'pending' | 'completed' | 'failed'  
* `created_at` (Timestamp) - Generation timestamp

**Table 3: credit_transactions**  
* `id` (UUID, PK) - Transaction ID  
* `user_id` (UUID, FK) - User ID  
* `amount` (Integer) - Credits deducted (negative) or refunded (positive)  
* `reason` (String) - 'generation' | 'refund' | 'adjustment'  
* `ref_id` (UUID) - Reference to audio_generations.id  
* `created_at` (Timestamp) - Transaction timestamp