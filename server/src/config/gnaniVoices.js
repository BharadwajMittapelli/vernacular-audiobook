// Gnani.ai prebuilt voice catalog (v2.1). Representative entries across major
// Indian languages. Hinglish is an en-IN accent variant, matching the client's
// 'Indian English (Hinglish)' label. ids are what the client sends as
// voiceProfile -> forwarded to Gnani as `voice`.
// CAUTION: ids must match Gnani's real voice identifiers or synthesis 4xx's.

export const GNANI_VOICES = [
  // en-IN — Indian English
  { id: 'Nalini',  name: 'Nalini',     languageCode: 'en-IN', gender: 'female', accent: 'Indian English' },
  { id: 'Nitin',   name: 'Nitin',      languageCode: 'en-IN', gender: 'male',   accent: 'Indian English' },
  { id: 'Priya',   name: 'Priya',      languageCode: 'en-IN', gender: 'female', accent: 'Indian English' },
  { id: 'Arjun',   name: 'Arjun',      languageCode: 'en-IN', gender: 'male',   accent: 'Indian English' },
  // en-IN — Hinglish
  { id: 'Simran',  name: 'Simran',     languageCode: 'en-IN', gender: 'female', accent: 'Hinglish' },
  { id: 'Vikram',  name: 'Vikram',     languageCode: 'en-IN', gender: 'male',   accent: 'Hinglish' },
  // hi-IN — Hindi
  { id: 'Kaveri',  name: 'Kaveri',     languageCode: 'hi-IN', gender: 'female', accent: 'Hindi' },
  { id: 'Deepak',  name: 'Deepak',     languageCode: 'hi-IN', gender: 'male',   accent: 'Hindi' },
  { id: 'Ananya',  name: 'Ananya',     languageCode: 'hi-IN', gender: 'female', accent: 'Hindi' },
  { id: 'Rohan',   name: 'Rohan',      languageCode: 'hi-IN', gender: 'male',   accent: 'Hindi' },
  { id: 'Meera',   name: 'Meera',      languageCode: 'hi-IN', gender: 'female', accent: 'Hindi' },
  // te-IN — Telugu
  { id: 'Sneha',   name: 'Sneha',      languageCode: 'te-IN', gender: 'female', accent: 'Telugu' },
  { id: 'Karthik', name: 'Karthik',    languageCode: 'te-IN', gender: 'male',   accent: 'Telugu' },
  { id: 'Divya',   name: 'Divya',      languageCode: 'te-IN', gender: 'female', accent: 'Telugu' },
  { id: 'Praveen', name: 'Praveen',    languageCode: 'te-IN', gender: 'male',   accent: 'Telugu' },
  { id: 'Lakshmi', name: 'Lakshmi',    languageCode: 'te-IN', gender: 'female', accent: 'Telugu' },
  // ta-IN — Tamil
  { id: 'Kavya',   name: 'Kavya',      languageCode: 'ta-IN', gender: 'female', accent: 'Tamil' },
  { id: 'Vignesh', name: 'Vignesh',    languageCode: 'ta-IN', gender: 'male',   accent: 'Tamil' },
  { id: 'Swathi',  name: 'Swathi',     languageCode: 'ta-IN', gender: 'female', accent: 'Tamil' },
  { id: 'Karthi',  name: 'Karthi',     languageCode: 'ta-IN', gender: 'male',   accent: 'Tamil' },
  // kn-IN — Kannada
  { id: 'Anusha',      name: 'Anusha',      languageCode: 'kn-IN', gender: 'female', accent: 'Kannada' },
  { id: 'Guruprasad',  name: 'Guruprasad',  languageCode: 'kn-IN', gender: 'male',   accent: 'Kannada' },
  { id: 'Harini',      name: 'Harini',      languageCode: 'kn-IN', gender: 'female', accent: 'Kannada' },
  { id: 'Manoj',       name: 'Manoj',       languageCode: 'kn-IN', gender: 'male',   accent: 'Kannada' },
  // ml-IN — Malayalam
  { id: 'Athira',   name: 'Athira',   languageCode: 'ml-IN', gender: 'female', accent: 'Malayalam' },
  { id: 'Sreenath', name: 'Sreenath', languageCode: 'ml-IN', gender: 'male',   accent: 'Malayalam' },
  { id: 'Nithya',   name: 'Nithya',   languageCode: 'ml-IN', gender: 'female', accent: 'Malayalam' },
  { id: 'Vishnu',   name: 'Vishnu',   languageCode: 'ml-IN', gender: 'male',   accent: 'Malayalam' },
  // mr-IN — Marathi
  { id: 'Sai',     name: 'Sai',     languageCode: 'mr-IN', gender: 'female', accent: 'Marathi' },
  { id: 'Aditya',  name: 'Aditya',  languageCode: 'mr-IN', gender: 'male',   accent: 'Marathi' },
  { id: 'Rutuja',  name: 'Rutuja',  languageCode: 'mr-IN', gender: 'female', accent: 'Marathi' },
  { id: 'Swapnil', name: 'Swapnil', languageCode: 'mr-IN', gender: 'male',   accent: 'Marathi' },
  // bn-IN — Bengali
  { id: 'Tiya',     name: 'Tiya',     languageCode: 'bn-IN', gender: 'female', accent: 'Bengali' },
  { id: 'Anirban',  name: 'Anirban',  languageCode: 'bn-IN', gender: 'male',   accent: 'Bengali' },
  { id: 'Meghna',   name: 'Meghna',   languageCode: 'bn-IN', gender: 'female', accent: 'Bengali' },
  { id: 'Debasish', name: 'Debasish', languageCode: 'bn-IN', gender: 'male',   accent: 'Bengali' },
  // gu-IN — Gujarati
  { id: 'Pooja',  name: 'Pooja',  languageCode: 'gu-IN', gender: 'female', accent: 'Gujarati' },
  { id: 'Hitesh', name: 'Hitesh', languageCode: 'gu-IN', gender: 'male',   accent: 'Gujarati' },
  { id: 'Nikita', name: 'Nikita', languageCode: 'gu-IN', gender: 'female', accent: 'Gujarati' },
  // pa-IN — Punjabi
  { id: 'Jasleen',  name: 'Jasleen',  languageCode: 'pa-IN', gender: 'female', accent: 'Punjabi' },
  { id: 'Harpreet', name: 'Harpreet', languageCode: 'pa-IN', gender: 'male',   accent: 'Punjabi' },
  { id: 'Manpreet', name: 'Manpreet', languageCode: 'pa-IN', gender: 'female', accent: 'Punjabi' },
];

export default GNANI_VOICES;
