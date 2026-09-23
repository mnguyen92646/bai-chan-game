import { test } from "node:test";
import assert from "node:assert/strict";
import { TableAudio } from "./tableAudio";

test("speech uses actor voice, softens effects, protects Chíu, and lets Ù interrupt", async t => {
  const started: { path: string; stopped: boolean; level: number }[] = [];
  class Gain {
    level = 0;
    gain = { setTargetAtTime: () => {}, cancelScheduledValues: () => {}, setValueAtTime: () => {},
      linearRampToValueAtTime: (value: number) => { if (value) this.level = value; } };
    connect() {} disconnect() {}
  }
  class Context {
    currentTime = 0; state = "running"; destination = {}; sampleRate = 44100;
    createBuffer() { return { path: "", duration: 0 }; }
    createGain() { return new Gain(); }
    async resume() {} async close() {}
    async decodeAudioData(bytes: ArrayBuffer) { return { duration: 1, path: new TextDecoder().decode(bytes) }; }
    createBufferSource() {
      const record = { path: "", stopped: false, level: 0 };
      let gain: Gain;
      return {
        buffer: { path: "" }, onended: undefined,
        connect(node: Gain) { gain = node; }, disconnect() {},
        start() { record.path = this.buffer.path; record.level = gain?.level ?? 0; started.push(record); },
        stop() { record.stopped = true; },
      };
    }
  }
  for (const [key, value] of Object.entries({ AudioContext: Context, document: { hidden: false }, fetch: async (path: string) => new Response(path) })) {
    const old = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
    t.after(() => { if (old) Object.defineProperty(globalThis, key, old); else Reflect.deleteProperty(globalThis, key); });
  }
  const player = new TableAudio();
  const preferences = { mode: "calls" as const, volume: .65 };
  await player.unlock(.65);
  await player.play({ kind: "chiu", seat: 2, voice: "female" }, preferences);
  const chiu = started.find(s => s.path.endsWith("female/chiu.mp3"));
  assert.ok(chiu);
  assert.equal(chiu.level, 1);
  assert.equal(started.find(s => s.path.endsWith("four.mp3"))?.level, .28);
  await player.play({ kind: "draw", seat: 3, voice: "male" }, preferences);
  assert.equal(chiu.stopped, false);
  assert.equal(started.some(s => s.path.endsWith("male/boc.mp3")), false);
  await player.play({ kind: "win", seat: 3, voice: "male" }, preferences);
  assert.equal(chiu.stopped, true);
  assert.ok(started.some(s => s.path.endsWith("male/win.mp3")));
  player.stop();
  const before = started.length;
  await player.play({ kind: "an", seat: 2, voice: "female" }, { ...preferences, mode: "off" });
  assert.equal(started.length, before);
  await player.play({ kind: "an", seat: 2, voice: "female" }, { ...preferences, mode: "effects" });
  assert.equal(started.at(-1)?.path, "/audio/table-v3/claim.mp3");
  assert.equal(started.at(-1)?.level, 1);
  player.dispose();
});

test("Safari activation primes output before awaiting resume and recovers interrupted audio", async t => {
  const events: string[] = [], readiness: boolean[] = [];
  let finishResume: () => void = () => {};
  const contexts: Context[] = [];
  class Context {
    state = "suspended"; currentTime = 0; sampleRate = 48000; destination = {};
    onstatechange: (() => void) | null = null;
    constructor() { contexts.push(this); }
    createGain() { return {connect() {}, gain: {setTargetAtTime() {}}}; }
    createBuffer(channels: number, length: number, rate: number) { assert.equal(channels,1);assert.equal(length,1);assert.equal(rate,48000);return {}; }
    createBufferSource() { return {buffer: null, connect() {}, disconnect() {}, onended: null, start() {events.push('prime');}}; }
    resume() {
      events.push('resume');
      return new Promise<void>(resolve => {finishResume=()=>{this.state='running';this.onstatechange?.();resolve();};});
    }
    decodeAudioData() { return Promise.resolve({duration:1}); }
    close() { events.push('close'); return Promise.resolve(); }
  }
  const session = { set type(value: string) { assert.equal(value,'playback');events.push('playback'); } };
  for (const [key,value] of Object.entries({AudioContext:Context,navigator:{audioSession:session},document:{hidden:false},fetch:async()=>{events.push('fetch');return new Response(new ArrayBuffer(1));}})) {
    const old=Object.getOwnPropertyDescriptor(globalThis,key);
    Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
    t.after(()=>{if(old)Object.defineProperty(globalThis,key,old);else Reflect.deleteProperty(globalThis,key);});
  }
  const player=new TableAudio(ready=>readiness.push(ready));
  assert.equal(player.ready,false);
  const initial=player.unlock(.65);
  assert.deepEqual(events,['playback','resume','prime'],'media routing and primer run synchronously in the user gesture');
  finishResume();await initial;assert.equal(player.ready,true);assert.equal(readiness.at(-1),true);
  const primers=events.filter(e=>e==='prime').length;
  await player.unlock(.65);assert.equal(events.filter(e=>e==='prime').length,primers,'ordinary taps do not reprime output');
  contexts[0].state='interrupted';contexts[0].onstatechange?.();assert.equal(readiness.at(-1),false);
  const recovery=player.unlock(.65);assert.equal(events.filter(e=>e==='prime').length,primers+1);
  finishResume();await recovery;assert.equal(player.ready,true);
  player.dispose();assert.equal(player.ready,false);assert.equal(contexts[0].onstatechange,null);
});
