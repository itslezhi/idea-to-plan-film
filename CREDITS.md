# Credits & provenance

- Original film: **A Little Order** (2026), published by **itslezhi**.
- Original character: **Pip**, a teal courier with a cream face plate, soft feet and an amber badge. Modeled procedurally in Three.js.
- Original scene, UI, printed graphics, choreography, camera and render pipeline: this repository. MIT licensed.
- Original sound: synthesized deterministically by `scripts/audio.py`; no external recording, song or sample. MIT licensed.
- Three.js `0.180.0`: MIT, https://github.com/mrdoob/three.js/blob/r180/LICENSE . Includes RoundedBoxGeometry, RoomEnvironment and postprocessing helpers.
- Playwright `1.56.1`: Apache-2.0, https://github.com/microsoft/playwright/blob/v1.56.1/LICENSE . Used as a development/render tool.
- Python NumPy/Pillow and imageio-ffmpeg: development/render dependencies; respective upstream licenses apply. FFmpeg is an external tool, not source authored by this repository. Check the license of the binary/build you use.
- Typography: system Arial and Georgia fallbacks. No proprietary font file is redistributed. Linux may substitute compatible system faces, so typography may vary slightly by OS.

## Reference and independence

The reference study is Patrick / feitangyuan's **Clawd desktop** short:

https://github.com/feitangyuan/onetake/tree/main/cases/clawd-desktop-19s

The reference informed the high-level idea of a character causing interface reactions through its body. The reference film's actual HTML composition, Blender model and audio sources are not public. This project does not contain the reference video, Clawd model, Apple or Anthropic logos, the reference soundtrack, or onetake source code.

The reconstructed reference prompt is an analytical reconstruction, **not** the creator's unpublished exact prompt. onetake has its own PolyForm Noncommercial license, independent of this repository's MIT-licensed original implementation. Installing or copying onetake is not required to run this project.


## V2 · Codex Glass Desktop

The revised macOS glass desktop scene is in `variants/codex-glass/`. Its choreography, camera, procedural wallpaper, glass setup, UI, and synthesized sound are independently authored. The Codex-themed animated character extrudes the blue-purple cloud outline and uses the white `>_` artwork from the installed Codex app icon. It is a project-specific animation, not an official mascot.

The nine native Apple/OpenAI icon PNG files and Codex-derived outline are identified separately in `variants/codex-glass/docs/assets.md` and `assets/icons/sources.json`. Those third-party brand artworks and their derived outline are excluded from the project's MIT grant. The MIT license applies to our original code, animation and sound. The earlier independence paragraph above describes V1; V2 intentionally depicts native software icons following the user's revised direction.
