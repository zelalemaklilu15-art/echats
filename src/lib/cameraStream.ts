// Portrait-friendly camera capture: let the device pick a supported size,
// then remove digital zoom and enable auto exposure/focus where supported.
export async function openPortraitCamera(facingMode: "user" | "environment", audio = true): Promise<MediaStream> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode, aspectRatio: { ideal: 9 / 16 }, height: { ideal: 1280 } },
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

/** Wide frames are shown whole (contain); tall frames fill the screen (cover). */
export function fitForVideo(v: HTMLVideoElement | null): "contain" | "cover" {
  if (!v || !v.videoWidth || !v.videoHeight) return "cover";
  return v.videoWidth > v.videoHeight ? "contain" : "cover";
}
