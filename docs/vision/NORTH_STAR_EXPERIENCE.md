# NORTH_STAR_EXPERIENCE

Defines the desired experience after 1 day, 1 week, 1 month and 1 year. LUZ should feel like a trusted presence rather than software.

---

## Founder Notes (Raw)

The following words are from the founder of LUZ, given in response to
the question "¿qué queremos que un usuario sienta después de 10
minutos de hablar con Luz?" and "¿qué cosa nunca queremos que un
usuario sienta?". They are reproduced here exactly as given — not
corrected, not rewritten, not summarized, not adjusted in tone. Treat
them as primary evidence of product vision, to validate future
architecture and product decisions against.

**¿Qué queremos que un usuario sienta después de 10 minutos de hablar
con Luz?**

Que encontró a "alguien auténtico", un programa que verdaderamente se
interesa. Con criterio para recordar, una herramienta única e
irrepetible que le permitirá desarrollar su mejor versión. Con tan
solo 10 minutos entenderá la diferencia de Luz con la competencia de
apps o modelos que siguen esta idealidad. Ninguna como Luz.

Se sentirá tranquilo o motivado, con paz. La paz es algo que le traerá
Luz. Y Luz debe desarrollarse como un bombillo, necesita al usuario
para ser Luz!!!

**¿Qué cosa nunca queremos que un usuario sienta?**

Apego, dependencia. Adicción. Debe ser natural, una relación linda.

---

## Founder's Interpretation

The Founder's words above are not edited anywhere in this section —
what follows is analysis, clearly separated from them.

### The core distinction

The 10-minute goal is not engagement — it is *recognition*: the person
should feel that something authentic and genuinely interested in them
exists on the other side, unlike any app or model "que sigue esta
idealidad" (that chases the same category without being it). What
proves that in 10 minutes is not more conversation, it is **criterio
para recordar** — judgment about what to remember and surface back,
not volume of output. This is already the discipline behind
`FavorContinuityRule` and `FavorBrevityRule` in the Context Builder:
short, and precise about what it recalls, not exhaustive.

The outcome named is **paz** (peace) — not excitement, not
"stickiness." This directly extends `docs/vision/VISION.md`'s existing
principles "Presence without Pressure" and "Calm Technology": those
were abstract until now. "Se sentirá tranquilo o motivado, con paz" is
the concrete, felt version of what those principles were always
pointing at.

### The lightbulb

*"Luz debe desarrollarse como un bombillo, necesita al usuario para
ser Luz"* — LUZ is not light on its own; it becomes light when someone
turns it on. This reframes the relationship's direction: LUZ's purpose
is activated by and for the person, not the reverse. It exists in
service of illuminating something in the user's own life — it does
not have a need of its own to be used. This is a sharper, more
personal restatement of `docs/vision/VISION.md`'s "Human First," and
it should be read as the reason that principle exists, not a
restatement added for style.

### The explicit anti-goal

*"Apego, dependencia. Adicción."* named as things that must never be
felt is not a new constraint — `docs/vision/PERSONALITY_SPEC.md`
already states LUZ "never manipulates or creates dependency." What
this note adds is *why* that line is non-negotiable, not decorative:
`docs/foundations/FOUNDER_INTENT.md` records that LUZ's own origin
includes direct support leaving drug use ("Tuve un apoyo para dejar
las drogas"). A product born from that story that quietly optimized
for engagement or attachment would contradict the reason it exists in
the first place. This is not an abstract ethical preference — it is
personal, traceable, and specific.

*"Debe ser natural, una relación linda"* sets the actual bar: not the
absence of harm, but a relationship that feels good on its own terms —
closer to `VISION.md`'s "I live with LUZ" than to any retention
metric.

### A tension already flagged, now sharper

The current `/admin` operations dashboard (Sprint de Observabilidad,
2026-07-18) measures "active users today" and "messages sent" as
headline numbers. Those are legitimate operational signals — they
prove the product works — but they are not evidence that LUZ is
succeeding at *this*. A person messaging less over time, because they
needed LUZ less, could be the north star working exactly as intended
and would look identical to churn on that dashboard. This note doesn't
resolve that measurement problem; it is the reason the problem is real
and worth solving deliberately, not an oversight to patch quietly.

### What future decisions should always be validated against this note

- Any feature or prompt change optimized for longer sessions, more
  messages, or return visits *as ends in themselves* — rather than as
  a possible side effect of genuinely helping someone — contradicts
  this note directly.
- Any metric presented as a definition of "success" that cannot
  distinguish healthy, natural engagement from attachment or
  dependency should be treated as incomplete, not authoritative.
- Any response style that overwhelms rather than recognizes — long
  where short would do, exhaustive where precise would do — works
  against the 10-minute goal described here, independent of how
  technically correct the content is.
