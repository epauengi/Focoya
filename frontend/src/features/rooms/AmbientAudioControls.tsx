import { memo, useEffect, useRef, useState } from 'react';
import { AMBIENT_PRESETS, AMBIENT_VOLUME_KEY, createAmbientAudio, readAmbientVolume, type AmbientPreset, type Playback } from './ambientAudio';
import './ambient-audio.css';

const playbackLabels: Record<Playback, string> = {
  paused: 'Đang tắt', starting: 'Đang khởi động…', playing: 'Đang phát', error: 'Không thể phát âm thanh. Hãy thử lại.',
};

export const AmbientAudioControls = memo(function AmbientAudioControls({ defaultPreset }: { defaultPreset: AmbientPreset }) {
  const [selection, setSelection] = useState<AmbientPreset | null>(null);
  const [playback, setPlayback] = useState<Playback>('paused');
  const [volume, setVolume] = useState(() => {
    try { return readAmbientVolume(localStorage.getItem(AMBIENT_VOLUME_KEY)); } catch { return 35; }
  });
  const [muted, setMuted] = useState(false);
  const engine = useRef<ReturnType<typeof createAmbientAudio> | null>(null);
  const disclosure = useRef<HTMLDetailsElement>(null);
  const preset = selection ?? defaultPreset;
  const active = playback === 'playing' || playback === 'starting';

  useEffect(() => {
    const audio = createAmbientAudio(setPlayback);
    engine.current = audio;
    return () => {
      engine.current = null;
      audio.dispose();
    };
  }, []);
  useEffect(() => { engine.current?.setPreset(preset); }, [preset]);
  useEffect(() => { engine.current?.setVolume(volume, muted); }, [volume, muted]);

  return (
    <details ref={disclosure} className="focus-audio" onKeyDown={(event) => {
      if (event.key !== 'Escape' || !disclosure.current?.open) return;
      disclosure.current.open = false;
      disclosure.current.querySelector('summary')?.focus();
      event.stopPropagation();
    }}>
      <summary className="focus-tool" aria-label="Âm thanh tự nhiên" title="Âm thanh tự nhiên" data-playing={playback === 'playing' && !muted && volume > 0}>
        <img src="/room-assets/cloud.svg" alt="" width="20" height="20" />
      </summary>
      <section className="focus-audio__panel" aria-label="Âm thanh tự nhiên">
        <h2>Âm thanh tự nhiên</h2>
        <p role="status">{playbackLabels[playback]}</p>
        <label>
          Âm thanh
          <select value={selection ?? ''} onChange={(event) => setSelection((event.target.value || null) as AmbientPreset | null)}>
            <option value="">Theo cảnh · {AMBIENT_PRESETS[defaultPreset].label}</option>
            {Object.entries(AMBIENT_PRESETS).map(([key, sound]) => <option key={key} value={key}>{sound.label}</option>)}
          </select>
        </label>
        <label className="focus-audio__volume">
          <span>Âm lượng <span aria-hidden="true">{volume}%</span></span>
          <input type="range" min="0" max="100" value={volume} aria-valuetext={`${volume}%`} onChange={(event) => {
            const value = event.target.valueAsNumber;
            setVolume(value);
            try { localStorage.setItem(AMBIENT_VOLUME_KEY, String(value)); } catch { /* Optional preference. */ }
          }} />
        </label>
        <div className="focus-audio__actions">
          <button type="button" onClick={() => {
            if (active) engine.current?.pause();
            else void engine.current?.play(preset);
          }}>{active ? 'Tạm dừng' : playback === 'error' ? 'Thử lại' : 'Phát'}</button>
          <button type="button" aria-pressed={muted} onClick={() => setMuted((value) => !value)}>Tắt tiếng</button>
        </div>
      </section>
    </details>
  );
});
