// Audio glue between OpenAI Realtime (24 kHz, PCM16 mono) and Simli (16 kHz).
// Linear-interpolation downsample is good enough for a children's game and
// avoids the bundle weight of a full DSP library.

export function downsamplePcm24kTo16k(input: Int16Array): Int16Array {
  const ratio = 24000 / 16000; // 1.5
  const outLen = Math.floor(input.length / ratio);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const srcIdx = i * ratio;
    const lo = Math.floor(srcIdx);
    const hi = Math.min(lo + 1, input.length - 1);
    const frac = srcIdx - lo;
    out[i] = (input[lo]! * (1 - frac) + input[hi]! * frac) | 0;
  }
  return out;
}
