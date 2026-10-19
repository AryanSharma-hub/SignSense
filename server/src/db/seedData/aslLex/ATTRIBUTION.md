# ASL-LEX 2.0 attribution

The handshape, location and movement categories for the large majority of this app's
gestures (everything except the 16 hand-authored "curated" signs and a smaller leftover
placeholder set) are derived from:

> Caselli, N. K., Sehyr, Z. S., Cohen-Goldberg, A. M., & Emmorey, K. (2017). ASL-LEX: A
> lexical database of American Sign Language. *Behavior Research Methods*, 49(2), 784-801.
>
> ASL-LEX 2.0 — https://asl-lex.org/ — 2,723 signs, 60+ properties. Downloaded from the
> project's OSF repository (https://osf.io/zpha4/), files `signdata.csv` / `signdataKEY.csv`.

Licensed **CC BY-NC 4.0** (https://creativecommons.org/licenses/by-nc/4.0/) — free to use
and adapt with attribution, **non-commercial only**. Keep that in mind before any
commercial use of this project.

## What is derived, and how it is checked

ASL-LEX documents each sign's phonological categories (e.g. handshape `curved_5`, sign type
`AsymmetricalDifferentHandshape`, minor location `Forehead` → second location `HeadAway`,
movement shape `Straight`, repeated or not, handshape change). SignSense imports, per sign
meaning (lemma × lexical class): both hands' handshapes, which hands move, the movement shape
and repetition, the start and end locations, the handshape change, the lexical class (part of
speech), high-agreement English translations, and the sign frequency used to pick the most
familiar variant.

Translating those category names into this app's rendering parameters (finger-curl arrays,
body anchor coordinates) is this project's own work. `npm run seed:validate -w server`
re-derives every ASL-LEX-sourced sign from its source row (by ASL-LEX's unique `Code`) and
fails on any mismatch; `npm run seed:report -w server` writes `../../VOCABULARY_REPORT.md`.

Not in ASL-LEX and therefore not invented: movement direction, palm orientation, facial
grammar. Every row still carries `needs_review: true` — matching the published coding is
not the same as review by a fluent signer.
