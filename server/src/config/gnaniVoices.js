// Gnani.ai Timbre v2.5 voice catalog — verified against docs.gnani.ai
// (api/TTS/available-voices) and the live API's own voice list (2026-10).
// ids are what the client sends as voiceProfile -> forwarded to Gnani as `voice`.
// CAUTION: ids must match Gnani's real voice identifiers or synthesis 4xx's.
// Each v2.5 voice has one preferred language; ttsProvider sends model timbre-v2.5.

export const GNANI_VOICES = [
  // en-IN — English
  { id: 'Kaveri',  name: 'Kaveri',  languageCode: 'en-IN', gender: 'female', accent: 'English' },
  { id: 'Trupti',  name: 'Trupti',  languageCode: 'en-IN', gender: 'female', accent: 'English' },
  { id: 'Devika',  name: 'Devika',  languageCode: 'en-IN', gender: 'female', accent: 'English' },
  { id: 'Pranav',  name: 'Pranav',  languageCode: 'en-IN', gender: 'male',   accent: 'English' },
  { id: 'Shlok',   name: 'Shlok',   languageCode: 'en-IN', gender: 'male',   accent: 'English' },
  { id: 'Girish',  name: 'Girish',  languageCode: 'en-IN', gender: 'male',   accent: 'English' },
  // hi-IN — Hindi
  { id: 'Nalini',  name: 'Nalini',  languageCode: 'hi-IN', gender: 'female', accent: 'Hindi' },
  { id: 'Bhavna',  name: 'Bhavna',  languageCode: 'hi-IN', gender: 'female', accent: 'Hindi' },
  { id: 'Yashvi',  name: 'Yashvi',  languageCode: 'hi-IN', gender: 'female', accent: 'Hindi' },
  { id: 'Urmila',  name: 'Urmila',  languageCode: 'hi-IN', gender: 'female', accent: 'Hindi' },
  { id: 'Jwala',   name: 'Jwala',   languageCode: 'hi-IN', gender: 'female', accent: 'Hindi' },
  { id: 'Chitra',  name: 'Chitra',  languageCode: 'hi-IN', gender: 'female', accent: 'Hindi' },
  { id: 'Ambuja',  name: 'Ambuja',  languageCode: 'hi-IN', gender: 'female', accent: 'Hindi' },
  { id: 'Deepak',  name: 'Deepak',  languageCode: 'hi-IN', gender: 'male',   accent: 'Hindi' },
  { id: 'Roopesh', name: 'Roopesh', languageCode: 'hi-IN', gender: 'male',   accent: 'Hindi' },
  { id: 'Vikrant', name: 'Vikrant', languageCode: 'hi-IN', gender: 'male',   accent: 'Hindi' },
  { id: 'Hemraj',  name: 'Hemraj',  languageCode: 'hi-IN', gender: 'male',   accent: 'Hindi' },
  { id: 'Jalaj',   name: 'Jalaj',   languageCode: 'hi-IN', gender: 'male',   accent: 'Hindi' },
  { id: 'Omkar',   name: 'Omkar',   languageCode: 'hi-IN', gender: 'male',   accent: 'Hindi' },
  // hi-en — Hinglish
  { id: 'Poorvi',  name: 'Poorvi',  languageCode: 'hi-en', gender: 'female', accent: 'Hinglish' },
  // ta-IN — Tamil
  { id: 'Asmita',  name: 'Asmita',  languageCode: 'ta-IN', gender: 'female', accent: 'Tamil' },
  { id: 'Trisha',  name: 'Trisha',  languageCode: 'ta-IN', gender: 'female', accent: 'Tamil' },
  { id: 'Brinda',  name: 'Brinda',  languageCode: 'ta-IN', gender: 'female', accent: 'Tamil' },
  { id: 'Vedika',  name: 'Vedika',  languageCode: 'ta-IN', gender: 'female', accent: 'Tamil' },
  { id: 'Noopur',  name: 'Noopur',  languageCode: 'ta-IN', gender: 'female', accent: 'Tamil' },
  // te-IN — Telugu
  { id: 'Suhana',  name: 'Suhana',  languageCode: 'te-IN', gender: 'female', accent: 'Telugu' },
  { id: 'Lehara',  name: 'Lehara',  languageCode: 'te-IN', gender: 'female', accent: 'Telugu' },
  { id: 'Lavanya', name: 'Lavanya', languageCode: 'te-IN', gender: 'female', accent: 'Telugu' },
  { id: 'Yukti',   name: 'Yukti',   languageCode: 'te-IN', gender: 'female', accent: 'Telugu' },
  { id: 'Varuni',  name: 'Varuni',  languageCode: 'te-IN', gender: 'female', accent: 'Telugu' },
  // kn-IN — Kannada
  { id: 'Saanvi',  name: 'Saanvi',  languageCode: 'kn-IN', gender: 'female', accent: 'Kannada' },
  { id: 'Kavin',   name: 'Kavin',   languageCode: 'kn-IN', gender: 'male',   accent: 'Kannada' },
  // ml-IN — Malayalam
  { id: 'Reshma',  name: 'Reshma',  languageCode: 'ml-IN', gender: 'female', accent: 'Malayalam' },
  { id: 'Riyaan',  name: 'Riyaan',  languageCode: 'ml-IN', gender: 'male',   accent: 'Malayalam' },
  // mr-IN — Marathi
  { id: 'Zahira',  name: 'Zahira',  languageCode: 'mr-IN', gender: 'female', accent: 'Marathi' },
  { id: 'Ishaan',  name: 'Ishaan',  languageCode: 'mr-IN', gender: 'male',   accent: 'Marathi' },
  // bn-IN — Bengali
  { id: 'Kirra',   name: 'Kirra',   languageCode: 'bn-IN', gender: 'female', accent: 'Bengali' },
  { id: 'Dhruva',  name: 'Dhruva',  languageCode: 'bn-IN', gender: 'male',   accent: 'Bengali' },
  // gu-IN — Gujarati
  { id: 'Falak',   name: 'Falak',   languageCode: 'gu-IN', gender: 'female', accent: 'Gujarati' },
  { id: 'Veera',   name: 'Veera',   languageCode: 'gu-IN', gender: 'male',   accent: 'Gujarati' },
  // pa-IN — Punjabi
  { id: 'Mehuli',  name: 'Mehuli',  languageCode: 'pa-IN', gender: 'female', accent: 'Punjabi' },
  { id: 'Zayan',   name: 'Zayan',   languageCode: 'pa-IN', gender: 'male',   accent: 'Punjabi' },
];

export default GNANI_VOICES;
