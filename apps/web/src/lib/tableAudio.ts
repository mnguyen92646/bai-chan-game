import { voiceClips, type VoicePack, type SoundPreferences, type TableSoundEvent } from "./tableSoundEvents";

const ROOT = "/audio/table-v3/";
const commonClips = ["draw", "discard", "claim", "four", "celebrate", ...["male", "female"].flatMap(voice => ["boc", "an", "chiu", "win", "chiu-win"].map(name => `${voice}/${name}`))];

/** One short-effects channel and one interruptible voice channel. No speech backlog. */
export class TableAudio {
  private context?: AudioContext;
  private gain?: GainNode;
  private cache = new Map<string, Promise<AudioBuffer>>();
  private playing = new Set<AudioBufferSourceNode>();
  private voice = new Set<AudioBufferSourceNode>();
  private generation = 0;
  private voiceGeneration = 0;
  private protectedUntil = 0;
  private voicePriority = 0;
  private envelopes = new Map<AudioBufferSourceNode, GainNode>();
  private disposed = false;
  private primed = false;

  constructor(private readonly onReadyChange: (ready: boolean) => void = () => {}) {}

  get ready() { return !this.disposed && this.context?.state === "running"; }

  async unlock(volume: number) {
    if (this.disposed) return;
    // iPhone Web Audio defaults to ambient audio, which obeys the ringer switch.
    // Request media playback only when the player has chosen to enable sound.
    try {
      const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
      if (session) session.type = "playback";
    } catch { /* Older browsers keep their normal audio routing. */ }
    if (!this.context) {
      this.context = new AudioContext();
      this.context.onstatechange = () => {
        if (!this.ready) this.primed = false;
        this.onReadyChange(this.ready);
      };
      this.gain = this.context.createGain();
      this.gain.connect(this.context.destination);
    }
    this.setVolume(volume);
    // Call directly inside a pointer/click handler, before any fetch or timer.
    const resumed = this.context.state !== "running" ? this.context.resume() : Promise.resolve();
    // Start a silent buffer synchronously inside the gesture, before fetching
    // clips or awaiting resume. Safari may otherwise leave the output locked.
    if (!this.primed) {
      const primer = this.context.createBufferSource();
      primer.buffer = this.context.createBuffer(1, 1, this.context.sampleRate);
      primer.connect(this.context.destination);
      primer.onended = () => primer.disconnect();
      primer.start();
      this.primed = true;
    }
    await resumed;
    this.onReadyChange(this.ready);
    void Promise.all(commonClips.map(name => this.load(name))).catch(() => {});
  }

  setVolume(volume: number) {
    if (this.gain && this.context) this.gain.gain.setTargetAtTime(volume, this.context.currentTime, 0.02);
  }

  private load(name: string, pack: VoicePack = "edge"): Promise<AudioBuffer> {
    const spoken = /^(male|female)\//.test(name);
    const clip = name.replace(/^(male|female)\//, "");
    const url = !spoken ? `${ROOT}${name}.mp3`
      : pack === "edge" ? `/audio/table-edge-v1/${name}.mp3`
      : pack === "google" ? `/audio/table-google-v1/shared/${clip}.mp3`
      : pack === "mac" ? `/audio/table-v1/${clip}.mp3`
      : `${/^(win|chiu-win)$/.test(clip) ? "/audio/table-v4/" : ROOT}${name}.mp3`;
    const cached = this.cache.get(url);
    if (cached) return cached;
    const context = this.context!;
    const pending = fetch(url).then(response => {
      if (!response.ok) throw new Error("Sound unavailable");
      return response.arrayBuffer();
    }).then(bytes => context.decodeAudioData(bytes)).catch(error => {
      this.cache.delete(url);
      throw error;
    });
    this.cache.set(url, pending);
    return pending;
  }

  private start(buffer: AudioBuffer, time: number, spoken = false, level = 1) {
    const source = this.context!.createBufferSource();
    const envelope = this.context!.createGain();
    source.buffer = buffer;
    source.connect(envelope);
    envelope.connect(this.gain!);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + .008);
    envelope.gain.setValueAtTime(level, time + Math.max(.008, buffer.duration - .02));
    envelope.gain.linearRampToValueAtTime(0, time + buffer.duration);
    this.envelopes.set(source, envelope);
    this.playing.add(source);
    if (spoken) this.voice.add(source);
    source.onended = () => { this.playing.delete(source); this.voice.delete(source); this.envelopes.delete(source); source.disconnect(); envelope.disconnect(); };
    source.start(time);
  }

  private fadeOut(source: AudioBufferSourceNode) {
    const now = this.context!.currentTime;
    const gain = this.envelopes.get(source)?.gain;
    if (gain) {
      gain.cancelScheduledValues(now);
      gain.setTargetAtTime(0, now, .006);
    }
    try { source.stop(now + .035); } catch {}
  }

  async play(event: TableSoundEvent, preferences: SoundPreferences) {
    const context = this.context;
    if (!context || context.state !== "running" || preferences.mode === "off" || this.disposed || document.hidden) return;
    this.setVolume(preferences.volume);
    const generation = this.generation;
    const started = performance.now();
    const celebration = event.kind === "win" || event.kind === "chiu-win";
    const effect = celebration ? "celebrate" : event.kind === "chiu" ? "four" : event.kind === "an" ? "claim" : event.kind;
    // Slow downloads and background/reconnect events must not produce belated reactions.
    const valid = () => !this.disposed && generation === this.generation && !document.hidden && context.state === "running" && performance.now() - started < 1500;
    const effectPromise = this.load(effect).then(buffer => {
      if (valid()) this.start(buffer, context.currentTime, false, preferences.mode === "effects" ? 1 : celebration ? .10 : .28);
    }).catch(() => {});
    const names = voiceClips(event, preferences.mode);
    const priority = celebration ? 3 : event.kind === "chiu" ? 2 : 1;
    if (names.length && (priority > this.voicePriority || performance.now() >= this.protectedUntil)) {
      const voiceGeneration = ++this.voiceGeneration;
      this.voicePriority = priority;
      this.protectedUntil = performance.now() + (celebration ? 4000 : 1600);
      for (const source of this.voice) this.fadeOut(source);
      this.voice.clear();
      try {
        const buffers = await Promise.all(names.map(name => this.load(`${event.voice ?? "male"}/${name}`, preferences.voicePack)));
        if (valid() && voiceGeneration === this.voiceGeneration) {
          let time = context.currentTime + 0.045;
          for (const buffer of buffers) { this.start(buffer, time, true); time += buffer.duration + 0.06; }
          this.protectedUntil = performance.now() + Math.max(celebration ? 4000 : 0, (time - context.currentTime) * 1000);
        }
      } catch {
        if (voiceGeneration === this.voiceGeneration) this.protectedUntil = 0;
        // Effects still work if a voice clip fails to load.
      }
    }
    await effectPromise;
  }

  stop() {
    this.generation++;
    this.voiceGeneration++;
    this.protectedUntil = 0;
    this.voicePriority = 0;
    for (const source of this.playing) this.fadeOut(source);
    this.playing.clear();
    this.voice.clear();
  }

  dispose() {
    this.stop();
    this.disposed = true;
    if (this.context) this.context.onstatechange = null;
    void this.context?.close().catch(() => {});
    this.cache.clear();
  }
}
