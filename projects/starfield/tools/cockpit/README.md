# Cutting the glass out of a cockpit photograph

Turns a reference image of a cockpit into a canopy overlay: the struts and
console kept as photography, the panes cut to full transparency so the real
sky renders through them.

    python3 cut-canopy.py canopies.json

Writes `<name>.png` (RGBA) plus `<name>_ongreen.png` — the same cut composited
over green, which is the thing to actually look at. Nebula left behind at a
strut edge is invisible against black and unmissable against green.

Convert the results for the game with WebP at quality 86; the alpha channel
survives and the files drop from ~1.7 MB to ~90 KB.

## Why it is shaped this way

`canopies.json` describes the frame as **strut centre-lines with a width**,
not as pane outlines. A band only has to *contain* the real strut, which is
far more forgiving than tracing edges — and edges are exactly what a
gradient-following segmentation gets wrong here, because the strongest edge
in the reference is the limb of a painted planet.

GrabCut then decides, inside that band, which pixels are metal and which are
painted space, fitting colour models to each with a smoothness term.

The cockpit is symmetric, so only the **left half** is traced; `struts` and
`solids_m` are mirrored automatically. Nothing hand-placed can drift out of
symmetry.

## Tuning

Work from `<name>_ongreen.png`, and change one thing at a time.

| Symptom | Fix |
|---|---|
| Nebula fringing one side of a strut | The centre-line is offset. Move it, do not widen it. |
| Nebula either side of a strut | `w` is too large. |
| Strut breaking into fragments | `w` is too small, or `halo` is large enough for GrabCut to eat it. |
| Whole panes surviving | A strut band is covering them — check `w` and `solids_m`. |

`erase` rectangles are inpainted **before** anything else. They are for the
HUD painted into the reference: readouts have to go, because nothing in the
simulation can back them up. Stencilled equipment markings stay — they label
hardware rather than report a value.

Verify numerically as well as by eye: sample the alpha over regions that
should be glass and regions that should be structure. Reading a downscaled
composite is unreliable, and a region that looks dark is often already cut.
