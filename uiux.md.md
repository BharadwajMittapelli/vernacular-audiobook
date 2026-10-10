# 4. UI/UX Design Brief

**Design System:** Tailwind CSS + Shadcn/UI + Lucide React Icons.  
**Theme Strategy:** Minimalist, content-first. Default to eKithab's existing palette.

**Core Components:**  
* **AudioConfigModal:** Glassmorphism overlay (`bg-background/80 backdrop-blur-sm`). Use Shadcn Select, Slider, and Button components.  
* **ReadAlongPlayer:**  
  * Inactive Text: `text-muted-foreground`.  
  * Active Spoken Text: `text-primary font-bold bg-primary/10 rounded-sm px-1`.  
* **PlaybackControls:** Minimalist pill-shaped floating action bar containing Play/Pause, 15s Rewind, and Speed (1x, 1.5x, 2x) buttons controlling `HTMLAudioElement.playbackRate`.

**Accessibility (a11y):**  
* All interactive elements must be keyboard navigable (`tabIndex={0}`).  
* Contrast ratio minimum 4.5:1 for active text highlights.