// Full field-of-view camera capture. Phone sensors are 4:3; requesting a tall
// 9:16 frame makes the device crop the sides, which looks zoomed in. We ask for
// the native 4:3 frame, then remove digital zoom and enable auto exposure/focus.
export async function openPortraitCamera(facingMode: "user" | "environment", audio = true): Promise<MediaStream> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, aspectRatio: { ideal: 4 / 3 }, width: { ideal: 1280 } },
      audio,
    });
  } catch {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio });
  }
  const track = stream.getVideoTracks()[0];
  const caps: any = track?.getCapabilities?.() ?? {};
  const apply = async (c: any) => { try { await track.applyConstraints({ advanced: [c] } as any); } catch { /* unsupported */ } };
  if (caps.zoom && typeof caps.zoom.min === "number") await apply({ zoom: caps.zoom.min });
  if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes("continuous")) await apply({ exposureMode: "continuous" });
  if (Array.isArray(caps.focusMode) && caps.focusMode.includes("continuous")) await apply({ focusMode: "continuous" });
  return stream;
}

/** Mirror a video's stream into a blurred background video element. */
export function syncBackdrop(main: HTMLVideoElement | null, backdrop: HTMLVideoElement | null) {
  if (!main || !backdrop) return;
  if (backdrop.srcObject !== main.srcObject) {
    backdrop.srcObject = main.srcObject;
    void backdrop.play().catch(() => {});
  }
}
