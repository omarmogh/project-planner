// A short, soft two-note chime (and a buzz on phones) when a Pomodoro focus or break ends.
// WebAudio, no sound file. Fails silently: a missing chime must never break the timer.

let ctx: AudioContext | null = null

export function chime() {
  try {
    navigator.vibrate?.([120, 80, 120])
  } catch { /* not supported */ }
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return
    ctx ??= new AC()
    void ctx.resume?.()
    const t = ctx.currentTime
    for (const [i, freq] of [660, 880].entries()) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      const at = t + i * 0.18
      gain.gain.setValueAtTime(0, at)
      gain.gain.linearRampToValueAtTime(0.18, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.9)
      osc.connect(gain).connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 1)
    }
  } catch { /* audio blocked */ }
}
