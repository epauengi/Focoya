export const AMBIENT_PRESETS = {
  rain: { label: 'Tiếng mưa', frequency: 1800, highpass: 220, level: 0.55, swell: 0 },
  library: { label: 'Không gian thư viện', frequency: 480, highpass: 45, level: 0.28, swell: 0 },
  forest: { label: 'Gió trong rừng', frequency: 850, highpass: 100, level: 0.48, swell: 0.13 },
  ocean: { label: 'Tiếng sóng biển', frequency: 650, highpass: 65, level: 0.65, swell: 0.19 },
} as const;

export type AmbientPreset = keyof typeof AMBIENT_PRESETS;
export type Playback = 'paused' | 'starting' | 'playing' | 'error';
export const AMBIENT_VOLUME_KEY = 'focoya:room-audio:volume:v1';

export function readAmbientVolume(value: string | null) {
  if (value === null || !value.trim()) return 35;
  const volume = Number(value);
  return Number.isInteger(volume) && volume >= 0 && volume <= 100 ? volume : 35;
}

export function createAmbientAudio(
  onPlayback: (state: Playback) => void,
  createContext = () => new AudioContext(),
) {
  let context: AudioContext | undefined;
  let graph: ReturnType<typeof makeGraph> | undefined;
  let version = 0;
  let wantsPlayback = false;
  let playing = false;
  let disposed = false;
  let volume = 35;
  let muted = false;

  function setOutput() {
    graph?.output.gain.setTargetAtTime(muted || !playing ? 0 : (volume / 100) ** 2, context!.currentTime, 0.02);
  }

  function release() {
    wantsPlayback = playing = false;
    if (!context) return;
    context.onstatechange = null;
    graph?.disconnect();
    void context.close().catch(() => {});
    context = undefined;
    graph = undefined;
  }

  return {
    setVolume(value: number, isMuted: boolean) {
      volume = value;
      muted = isMuted;
      setOutput();
    },
    setPreset(preset: AmbientPreset) {
      graph?.tune(preset);
    },
    async play(preset: AmbientPreset) {
      if (disposed || wantsPlayback) return;
      const request = ++version;
      wantsPlayback = true;
      onPlayback('starting');
      try {
        if (!context) {
          context = createContext();
          graph = makeGraph(context);
          context.onstatechange = () => {
            if (playing && context?.state !== 'running') {
              wantsPlayback = playing = false;
              setOutput();
              onPlayback('paused');
            }
          };
        }
        graph!.tune(preset);
        // Called within the user's click; never resume audio on mount.
        await context.resume();
        if (request !== version || !wantsPlayback) return;
        if (context.state !== 'running') throw new Error('Audio did not start');
        playing = true;
        setOutput();
        onPlayback('playing');
      } catch {
        if (request !== version) return;
        release();
        onPlayback('error');
      }
    },
    pause() {
      ++version;
      wantsPlayback = playing = false;
      setOutput();
      void context?.suspend().catch(() => {});
      onPlayback('paused');
    },
    dispose() {
      ++version;
      disposed = true;
      release();
    },
  };
}

function makeGraph(context: AudioContext) {
  const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
  const samples = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  const noise = context.createBufferSource();
  const highpass = context.createBiquadFilter();
  const lowpass = context.createBiquadFilter();
  const texture = context.createGain();
  const output = context.createGain();
  const swell = context.createOscillator();
  const depth = context.createGain();

  noise.buffer = buffer;
  noise.loop = true;
  highpass.type = 'highpass';
  lowpass.type = 'lowpass';
  highpass.Q.value = lowpass.Q.value = 0;
  output.gain.value = depth.gain.value = 0;
  noise.connect(highpass).connect(lowpass).connect(texture).connect(output).connect(context.destination);
  swell.connect(depth).connect(texture.gain);
  noise.start();
  swell.start();

  return {
    output,
    tune(preset: AmbientPreset) {
      const { frequency, highpass: floor, level, swell: rate } = AMBIENT_PRESETS[preset];
      const now = context.currentTime;
      lowpass.frequency.setTargetAtTime(frequency, now, 0.09);
      highpass.frequency.setTargetAtTime(floor, now, 0.09);
      texture.gain.setTargetAtTime(level, now, 0.09);
      depth.gain.setTargetAtTime(rate ? level * 0.55 : 0, now, 0.09);
      swell.frequency.setTargetAtTime(rate, now, 0.09);
    },
    disconnect() {
      noise.stop();
      swell.stop();
      for (const node of [noise, highpass, lowpass, texture, output, swell, depth]) node.disconnect();
    },
  };
}
