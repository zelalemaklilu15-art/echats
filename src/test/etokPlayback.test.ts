import { afterEach, describe, expect, it, vi } from "vitest";
import { createVideoTapHandler } from "@/lib/etokPlayback";
import { chooseRecordingMimeType, hasRecordingAudio } from "@/lib/recordingMedia";
afterEach(() => vi.useRealTimers());
describe("eTok controls", () => {
  it("double tap likes without pausing at either tap", () => {
    vi.useFakeTimers(); const pause = vi.fn(), like = vi.fn();
    const handler = createVideoTapHandler(pause, like);
    handler.tap(); expect(pause).not.toHaveBeenCalled(); vi.advanceTimersByTime(100); handler.tap();
    vi.advanceTimersByTime(500); expect(like).toHaveBeenCalledTimes(1); expect(pause).not.toHaveBeenCalled();
  });
  it("single tap toggles playback after the double-tap window", () => {
    vi.useFakeTimers(); const pause = vi.fn(); const handler = createVideoTapHandler(pause, vi.fn());
    handler.tap(); vi.advanceTimersByTime(279); expect(pause).not.toHaveBeenCalled(); vi.advanceTimersByTime(1); expect(pause).toHaveBeenCalledTimes(1);
  });
  it("cancels taps when leaving the video", () => {
    vi.useFakeTimers(); const pause = vi.fn(); const handler = createVideoTapHandler(pause, vi.fn());
    handler.tap(); handler.cancel(); vi.advanceTimersByTime(500); expect(pause).not.toHaveBeenCalled();
  });
});
describe("camera recording audio", () => {
  it("prefers an explicit Opus audio codec", () => expect(chooseRecordingMimeType(() => true)).toBe("video/webm;codecs=vp8,opus"));
  it("uses AAC when only explicit MP4 is supported", () => expect(chooseRecordingMimeType(type => type.includes("mp4a"))).toBe("video/mp4;codecs=avc1.42E01E,mp4a.40.2"));
  it("lets the browser choose if no MIME option is supported", () => expect(chooseRecordingMimeType(() => false)).toBeUndefined());
  it.each([{tracks:[]}, {tracks:[{readyState:"ended",enabled:true,muted:false}]}, {tracks:[{readyState:"live",enabled:false,muted:false}]}, {tracks:[{readyState:"live",enabled:true,muted:true}]}])("rejects unavailable microphone tracks $tracks", ({tracks}) => {
    expect(hasRecordingAudio({getAudioTracks:()=>tracks} as unknown as MediaStream)).toBe(false);
  });
  it("accepts an enabled live microphone", () => expect(hasRecordingAudio({getAudioTracks:()=>[{readyState:"live",enabled:true,muted:false}]} as unknown as MediaStream)).toBe(true));
});