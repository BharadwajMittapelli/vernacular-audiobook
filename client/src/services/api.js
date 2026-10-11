-export const synthesizeAudio = async (text, language) => {
  const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:4001';
  const response = await fetch(`${baseUrl}/api/audio/synthesize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
  });
  if (!response.ok) throw new Error('Failed to synthesize audio');
  return await response.json();
};