const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4001';

export async function synthesizeAudio({ chapterId, text, language, voiceProfile, speed }) {
  const idempotencyKey = crypto.randomUUID();
  const response = await fetch(`${API_BASE}/api/audio/synthesize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ chapterId, text, language, voiceProfile, speed }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Synthesis failed (${response.status})`);
  }
  return data;
}