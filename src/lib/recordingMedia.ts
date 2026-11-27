export const RECORDING_MIME_TYPES = [
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9,opus",
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm",
];

export function chooseRecordingMimeType(supported: (type: string) => boolean): string | undefined {
  return RECORDING_MIME_TYPES.find(supported);
}

export function hasRecordingAudio(stream: MediaStream): boolean {
  return stream.getAudioTracks().some(track => track.readyState === "live" && track.enabled && !track.muted);
}