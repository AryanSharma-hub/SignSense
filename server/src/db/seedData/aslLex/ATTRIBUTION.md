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

## What was actually derived vs. what's new here

ASL-LEX documents each sign's *real* phonological category (e.g. handshape `curved_5`,
major/minor location `Head`/`Forehead`, movement shape `Straight`, repeated or not). The
translation of those standard category names into this app's own rendering parameters
(finger-curl arrays, compass directions, viewBox anchor coordinates) is new work done for
this project — a best-effort mapping, not something ASL-LEX itself specifies, and not
independently checked by an ASL-fluent reviewer. That's why every row still carries
`needs_review: true`, same as the rest of the dataset. The difference from the
hash-based placeholder entries is that the *source category* per word is now a real,
published linguistic fact instead of an arbitrary function of the English spelling.

No facial expression or head-motion data is included — ASL-LEX covers manual phonology
only, so these entries use the neutral citation-form face/head; sentence-level grammar
(question, negation, …) is still layered on by `client/src/lib/nonManual.js` the same way
it is for every other gesture.
