# eTok camera: stop the zoom and dark face (recording + Live)

## What is wrong
- The eTok recording camera and the Live camera ask the phone for a tall picture at a set size (1080x1920 and 720x1280). Many Android phones can't give that exact size, so they send a wide picture instead.
- The screen then fills the tall frame by cutting off both sides of that wide picture. That's why everything looks zoomed in and only your face shows.
- Because the picture is cut down to your face, the phone sets brightness from the brighter background it can still see, so your face comes out dark.

## The fix
1. Ask the camera for a tall shape and let the phone choose the closest size it supports, instead of demanding an exact size.
2. After the camera starts, check the shape it actually gives. If it's wide, show the whole picture without cutting it, with a soft blurred fill above and below. If it's tall, fill the screen as it does now.
3. Where the phone allows it, set the camera to no zoom and to automatic brightness and focus, so faces aren't dark.
4. Recorded videos and Live use the same full picture you see on screen, so what you record matches what you see.
5. The selfie camera stays mirrored on screen only. Saved videos and Live aren't mirrored.

## Where this applies
- The eTok record screen, with both the front and back cameras and when you switch between them.
- Going Live on eTok.
- The website stays as it is.

## How I'll check
- I'll test in a phone-sized browser with a fake wide camera and a fake tall camera to confirm the picture is no longer cut down.
- Real phone cameras can't be tested from here, so please try it on your phone after the update. The phone app will need to be rebuilt.

## Technical details
- `src/pages/EtokCamera.tsx` (getUserMedia around line 148) and `src/hooks/useEtokLiveBroadcast.ts` (line 24): replace the exact width/height with `aspectRatio: {ideal: 9/16}` and `height: {ideal: 1280}`. If the request fails, try again with just `facingMode`.
- After the camera starts, read `track.getSettings()` and set `object-contain` or `object-cover` from the real aspect ratio. Add a blurred background copy of the video behind it, using semantic tokens.
- Use `track.getCapabilities()` to apply `zoom: min` and set `exposureMode`/`focusMode` to `continuous` when supported, with each step wrapped in try/catch.
- Check that the canvas/MediaRecorder path draws the full frame with no center crop.
