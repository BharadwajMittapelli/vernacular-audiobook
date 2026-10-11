export const synthesizeAudio = async (text, language) => {
  const response = await fetch('http://localhost:3001/api/audio/synthesize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
  });
  if (!response.ok) throw new Error('Failed to synthesize audio');
  return await response.json();
};