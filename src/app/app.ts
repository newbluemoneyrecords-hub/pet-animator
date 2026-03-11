import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { GoogleGenAI } from '@google/genai';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatIconModule],
  templateUrl: './app.html',
})
export class App {
  form = new FormGroup({
    breed: new FormControl(''),
    furColor: new FormControl(''),
    accessories: new FormControl(''),
    script: new FormControl('Hello there! I am ready to dance!'),
    voice: new FormControl('Puck'),
    soundEffect: new FormControl('none')
  });

  // Image state
  imagePreview = signal<string | null>(null);
  imageBase64 = signal<string | null>(null);
  imageMimeType = signal<string | null>(null);

  // Avatar state
  avatarPreview = signal<string | null>(null);
  isGeneratingAvatar = signal<boolean>(false);

  // Speech & Dance state
  isGeneratingSpeech = signal<boolean>(false);
  audioUrl = signal<string | null>(null);
  isPlaying = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  // Dance Choreography
  availableMoves = ['sway', 'disco', 'robot', 'hiphop', 'spin', 'jump', 'wiggle', 'nod', 'shake', 'bounce'];
  danceSequence = signal<string[]>(['bounce', 'sway']);
  activeDanceMove = signal<string>('');
  danceInterval: any;

  audioElement: HTMLAudioElement | null = null;

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        this.imagePreview.set(result);
        this.avatarPreview.set(null); // Reset avatar when new image uploaded

        const match = result.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
        if (match) {
          this.imageMimeType.set(match[1]);
          this.imageBase64.set(match[2]);
        }
      };
      reader.readAsDataURL(file);
    }
  }

  async generateAvatar() {
    if (!this.imageBase64()) return;

    this.isGeneratingAvatar.set(true);
    this.errorMessage.set(null);

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
      const prompt = `A cute 3D Pixar-style avatar of this pet. Breed: ${this.form.value.breed || 'unknown'}, Fur Color: ${this.form.value.furColor || 'match original'}, Accessories: ${this.form.value.accessories || 'none'}. High quality 3D render, solid background.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: this.imageBase64()!,
                mimeType: this.imageMimeType()!
              }
            },
            { text: prompt }
          ]
        }
      });

      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          this.avatarPreview.set(`data:image/png;base64,${part.inlineData.data}`);
          foundImage = true;
          break;
        }
      }

      if (!foundImage) throw new Error('Failed to generate avatar image.');

    } catch (error: any) {
      console.error('Error generating avatar:', error);
      this.errorMessage.set(error.message || 'Failed to generate avatar. Please try again.');
    } finally {
      this.isGeneratingAvatar.set(false);
    }
  }

  addToSequence(move: string) {
    this.danceSequence.update(seq => [...seq, move]);
  }

  removeFromSequence(index: number) {
    this.danceSequence.update(seq => seq.filter((_, i) => i !== index));
  }

  async generateSpeechAndPlay() {
    if (!this.form.value.script) return;

    this.isGeneratingSpeech.set(true);
    this.errorMessage.set(null);
    this.stopPlayback();

    try {
      const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

      const audioResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: this.form.value.script }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: this.form.value.voice || 'Puck' }
            }
          }
        }
      });

      const base64Audio = audioResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audioDataUrl = `data:audio/wav;base64,${base64Audio}`;
        this.audioUrl.set(audioDataUrl);
        this.startPlayback(audioDataUrl);
      } else {
        throw new Error('Failed to generate audio');
      }
    } catch (error: any) {
      console.error('Error generating speech:', error);
      this.errorMessage.set(error.message || 'Failed to generate speech. Please try again.');
    } finally {
      this.isGeneratingSpeech.set(false);
    }
  }

  playPetSound(type: string) {
    if (type === 'none') return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      if (type === 'bark') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
        gain.gain.setValueAtTime(1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      } else if (type === 'meow') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.5);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.5, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      } else if (type === 'chirp') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2000, now);
        osc.frequency.linearRampToValueAtTime(3000, now + 0.1);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.3, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
      }
    } catch (e) {
      console.warn('AudioContext not supported or blocked', e);
    }
  }

  startPlayback(url: string) {
    this.stopPlayback();

    // Play sound effect first
    this.playPetSound(this.form.value.soundEffect || 'none');

    // Delay speech slightly if there's a sound effect
    const delay = this.form.value.soundEffect !== 'none' ? 500 : 0;

    setTimeout(() => {
      this.audioElement = new Audio(url);
      this.audioElement.onplay = () => {
        this.isPlaying.set(true);
        this.startDanceSequence();
      };
      this.audioElement.onended = () => this.stopPlayback();
      this.audioElement.onerror = () => this.stopPlayback();
      this.audioElement.play();
    }, delay);
  }

  startDanceSequence() {
    const seq = this.danceSequence();
    if (seq.length === 0) return;

    let currentIndex = 0;
    this.activeDanceMove.set(seq[currentIndex]);

    // Change move every 1 second
    this.danceInterval = setInterval(() => {
      currentIndex = (currentIndex + 1) % seq.length;
      this.activeDanceMove.set(seq[currentIndex]);
    }, 1000);
  }

  stopPlayback() {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }
    this.isPlaying.set(false);
    this.activeDanceMove.set('');
    if (this.danceInterval) {
      clearInterval(this.danceInterval);
      this.danceInterval = null;
    }
  }

  togglePlay() {
    if (this.isPlaying()) {
      this.stopPlayback();
    } else if (this.audioUrl()) {
      this.startPlayback(this.audioUrl()!);
    }
  }
}
