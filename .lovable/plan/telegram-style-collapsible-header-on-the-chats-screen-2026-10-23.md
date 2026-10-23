# Telegram-style collapsible header on the Chats screen

## What changes
- The top of the Chats screen gets two parts:
  - **Always visible (pinned):** the Echat title row (avatar + unread badge, search icon, menu) and the folder tabs row (All Chats + your folders).
  - **Collapsible:** the Search chats bar and the Stories row.
- **Scrolling up through the list (reading further down):** the Search bar and Stories slide up and fade out smoothly, so the chat list gets almost the full screen.
- **Scrolling back down / pulling down at the top:** they slide back in. Reaching the very top always shows them fully.
- Small finger jitters are ignored, so the header doesn't flicker.
- Tag chips, badges, colors, bottom navigation and every chat action stay exactly as they are.

## Layout order (new)
```text
[ Echat title row ]        <- pinned
[ Search chats bar ]       <- collapses
[ Stories row ]            <- collapses
[ Folder tabs / tag chips ]<- pinned
[ Chat list ... ]
```
(Stories moves from below the folder tabs to just under Search, like Telegram.)

## Technical details
- `src/pages/Chats.tsx` only. Wrap Search bar + `<StoriesBar />` in a collapsible block inside the sticky header; move folder tabs and tag chips into the sticky header below it.
- Track `window.scrollY` with a passive scroll listener throttled via `requestAnimationFrame`; direction threshold ~8px; force expanded when `scrollY < 24`.
- Animate with a measured height (ResizeObserver) using CSS `transition: height, opacity, transform` (~220ms, GPU-friendly `transform`), honoring `prefers-reduced-motion`.
- Keep the collapsible content mounted (no remount of StoriesBar, so no refetch).
- Verify with Playwright at 384×800: scroll down hides Search/Stories, scroll up restores, no layout jump in chat rows; build stays clean.
