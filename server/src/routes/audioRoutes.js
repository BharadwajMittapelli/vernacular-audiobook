import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { chunkText, calculateCredits } from '../services/textProcessor.js';
import { synthesizeSpeechChunks } from '../config/gnani.js';
import { uploadAudio } from '../services/storageService.js';
import { calculateAlignment } from '../services/alignmentCalculator.js';
import { supabase } from '../config/supabase.js';

const router = express.Router();

router.post('/synthesize', async (req, res) => {
  try {
    const { chapterId, text, language, voiceProfile, speed } = req.body;

    if (!chapterId || !text || !language || !voiceProfile || !speed) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: chapterId, text, language, voiceProfile, speed',
      });
    }

    const creditsNeeded = calculateCredits(text);
    
    const chunks = chunkText(text);
    
    const { audioBuffers, allTimestamps, totalDuration } = await synthesizeSpeechChunks(
      chunks,
      language,
      voiceProfile,
      speed
    );

    const audioUrl = await uploadAudio(audioBuffers, chapterId);

    const alignment = calculateAlignment(text, allTimestamps, totalDuration);

    const generationId = uuidv4();
    const userId = '00000000-0000-0000-0000-000000000001';

    await supabase.from('audio_generations').insert({
      id: generationId,
      user_id: userId,
      chapter_id: chapterId,
      language,
      audio_url: audioUrl,
      duration: totalDuration,
      credits_used: creditsNeeded,
    });

    const response = {
      success: true,
      audioUrl,
      durationSeconds: totalDuration,
      alignment,
    };

    res.json(response);
  } catch (error) {
    console.error('Synthesis error:', error);
    res.status(502).json({
      success: false,
      error: error.message || 'Audio synthesis failed',
    });
  }
});

export default router;