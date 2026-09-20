/**
 * Utilities for Live Baseball Score Notifications & Synthesized Audio Chimes
 */

export const playBaseballScoreChime = (soundEnabled = true): void => {
  if (!soundEnabled || typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // First tone (G5 - 783.99 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0.08, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second harmonic tone (C6 - 1046.50 Hz) - iconic stadium chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1046.5, now + 0.12);
    gain2.gain.setValueAtTime(0.1, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.55);
  } catch (e) {
    // Gracefully handle any browser audio policies without breaking UI
    console.debug('Audio playback note:', e);
  }
};

export interface SimulatedRunResult {
  title: string;
  description: string;
  runs: number;
  playType: 'homerun' | 'hit' | 'sacrifice' | 'walk' | 'standard';
}

const PLAY_TEMPLATES: Record<number, SimulatedRunResult[]> = {
  1: [
    {
      title: '¡JONRÓN SOLITARIO!',
      description: 'Cuadrangular imponente que desaparece por el jardín izquierdo.',
      runs: 1,
      playType: 'homerun',
    },
    {
      title: '¡SENCILLO REMOLCADOR!',
      description: 'Línea sólida al jardín central que impulsa una carrera desde la intermedia.',
      runs: 1,
      playType: 'hit',
    },
    {
      title: '¡ELEVADO DE SACRIFICIO!',
      description: 'Profundo elevado al bosque derecho permitiendo pisar y correr hacia la goma.',
      runs: 1,
      playType: 'sacrifice',
    },
    {
      title: '¡DOBLE OPORTUNO!',
      description: 'Batazo ajustado a la raya del right field que anota la carrera de la ventaja.',
      runs: 1,
      playType: 'hit',
    },
  ],
  2: [
    {
      title: '¡DOBLETE DE 2 CARRERAS!',
      description: 'Conexión candente entre left y center field que limpia las almohadillas con 2 anotaciones.',
      runs: 2,
      playType: 'hit',
    },
    {
      title: '¡JONRÓN DE 2 CARRERAS!',
      description: 'Bombazo con hombre en base que estremece las gradas con 2 carreras.',
      runs: 2,
      playType: 'homerun',
    },
    {
      title: '¡IMPARABLE CLAVE (+2)!',
      description: 'Hit oportuno con corredores en posición anotadora impulsando dos carreras.',
      runs: 2,
      playType: 'hit',
    },
  ],
  3: [
    {
      title: '¡JONRÓN DE 3 CARRERAS!',
      description: 'Batazo descomunal con dos hombres en circulación para traer 3 carreras.',
      runs: 3,
      playType: 'homerun',
    },
    {
      title: '¡TRIPLETE CON BASES LLENAS!',
      description: 'Batazo al callejón de poder que vacía las bases con 3 impulsadas.',
      runs: 3,
      playType: 'hit',
    },
  ],
};

export const getRandomPlayDescription = (
  teamShort: string,
  runs: number,
  playerName?: string
): SimulatedRunResult => {
  const list = PLAY_TEMPLATES[runs] || PLAY_TEMPLATES[1];
  const template = list[Math.floor(Math.random() * list.length)];
  const name = playerName || `${teamShort}`;

  return {
    ...template,
    description: `${name}: ${template.description}`,
  };
};
