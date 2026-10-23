// Browser Audio Notification Utility using Web Audio API (No external assets required)

export function playBeepNotification(durationSeconds = 3) {
  if (typeof window === "undefined") return;

  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const startTime = ctx.currentTime;
    const endTime = startTime + durationSeconds;

    // Pulsed rhythmic alert tone: 250ms interval (160ms sound + 90ms pause)
    const beepInterval = 0.25;
    const beepLength = 0.16;

    for (let t = startTime; t < endTime; t += beepInterval) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      // Alternating B5 (987.7Hz) and G5 (784Hz) pleasant attention tone
      const step = Math.floor((t - startTime) / beepInterval);
      osc.frequency.setValueAtTime(step % 2 === 0 ? 987.77 : 783.99, t);

      gain.gain.setValueAtTime(0.35, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + beepLength);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + beepLength);
    }
  } catch (err) {
    console.warn("Audio notification playback warning:", err);
  }
}
