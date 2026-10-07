\# 5\. Backend Schema Document

\*\*Database:\*\* Supabase PostgreSQL.

\*\*Table 1: users\*\* (Mocked for MVP)  
\* \`id\` (UUID, PK) \- eKithab user ID  
\* \`email\` (String, Unique) \- User email  
\* \`credits\` (Integer) \- Balance for audio generation (Default: 500\)

\*\*Table 2: audio\_generations\*\*  
\* \`id\` (UUID, PK) \- Unique generation ID  
\* \`user\_id\` (UUID, FK) \- Creator ID  
\* \`chapter\_id\` (String, Index) \- Reference to eKithab chapter  
\* \`language\` (String) \- e.g., 'hi-IN'  
\* \`audio\_url\` (String) \- Supabase public bucket URL  
\* \`duration\` (Float) \- Total audio duration in seconds  
\* \`credits\_used\` (Integer) \- Cost of this generation  
\* \`created\_at\` (Timestamp) \- Generation timestamp  
