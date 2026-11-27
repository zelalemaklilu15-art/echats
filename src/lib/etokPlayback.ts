/** Delay single taps so a double tap never pauses playback first. */
export function createVideoTapHandler(single: () => void, double: () => void, delay = 280) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    tap() {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
        double();
      } else {
        timer = setTimeout(() => { timer = undefined; single(); }, delay);
      }
    },
    cancel() { clearTimeout(timer); timer = undefined; },
  };
}