# Device checklist: phone · iPad · desktop

Twelve steps, about ten minutes per device. Run it on a **real** phone (≈390pt), a
**real** iPad (≈820pt, portrait), and a desktop browser ≥1280px. Do every step in
**light and dark** (the moon button in the top bar flips it).

Open the app with `?debug=1` appended, e.g. `https://<deployment>/?debug=1`. The
overlay sits bottom-left.

1. **First paint.** Load Home cold. The layout must be right on the very first frame:
   bottom tab bar on the phone, sidebar on iPad and desktop. No flash of the wrong one.
2. **No sideways scroll.** On Home, try to drag the page left or right. Nothing should
   move. The overlay should show `docOverflowX: false` in the report.
3. **Header.** The search bar, theme toggle and the three header buttons all fit, and
   none of them is clipped.
4. **Bottom bar (phone only).** Tap Home, Learn, Skills and Research, then More. Each
   one responds on the first tap, and the More sheet opens and closes.
5. **Mode chips.** In Learn, swipe the mode-chip row sideways. It scrolls inside itself,
   not the page.
6. **Books.** Learn → Books → open a book → open its study guide. Section jumps work:
   the outline rail on iPad and desktop, the chip row on the phone. Tables scroll inside
   their own frame.
7. **Loading and error states.** Pull a guide or a deep dive. While it loads you see a
   skeleton, not a blank. If it fails you get one compact row reading `Couldn't load … ·
   Retry`, and Retry re-runs only that section.
8. **Ask.** Tap "Ask anything". The panel opens without covering the bottom bar's
   targets and closes cleanly.
9. **Scroll stability.** Scroll Home top to bottom and back, slowly. Nothing jumps. The
   overlay's `scroll jumps` stays 0 and `CLS` stays under 0.05.
10. **Tap targets.** Watch the overlay's `controls <44px`. Note the number. Open
    `/design` and toggle **Tap targets**: anything outlined red is too small.
11. **Theme.** Flip the theme on Home, a study guide and `/design`. Every surface
    re-tints. Nothing stays light in dark mode, and no text is unreadable.
12. **Copy report.** Tap **Copy report** in the overlay and **paste the blob back to
    Claude**, together with which device it came from. That one JSON object is the
    bug report.
