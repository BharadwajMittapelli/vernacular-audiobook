\# 1\. Product Requirements Document (PRD)

\*\*Project Name:\*\* eKithab Audio (Indic Read-Along Engine)  
\*\*Objective:\*\* Enable eKithab creators to convert text-based vernacular guides into synchronized, code-switched Indic audiobooks using Gnani.ai, catering to Tier-2/3 Indian demographics.

\*\*User Personas:\*\*  
1\. \*\*The Creator:\*\* Domain expert who writes in vernacular languages and needs an instant, high-quality audio version of their eBook to upsell.  
2\. \*\*The Consumer:\*\* Tier-2/3 end-user who prefers listening to native speech (with UI text highlighting) over reading static PDFs on mobile.

\*\*Core Scope (MVP):\*\*  
\* Text-to-Speech synthesis using Gnani.ai \`timbre-v2.5\`.  
\* Support for 5 languages: Hindi, Telugu, Tamil, Kannada, Indian English (Hinglish, Tenglish).  
\* Synchronized Read-Along web player (±100ms precision).  
\* Credit deduction mechanism mapped to audio duration/character count.

\*\*Out of Scope (MVP):\*\*  
\* User account creation (assume hardcoded or passed via JWT from eKithab).  
\* PDF/DOCX native parsing (assume plain Markdown/text input).  
\* Voice cloning (using pre-set Gnani personas only).  
