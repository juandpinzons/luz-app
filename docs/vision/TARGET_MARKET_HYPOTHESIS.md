# Target Market Hypothesis and Prioritization Criterion

Document ID: LUZ-MKT-001\
Status: Active Hypothesis — explicitly provisional, to be revised with
real user evidence, not treated as settled segmentation\
Owner: Founder\
Date: 2026-07-27

This document is part of the product philosophy layer, alongside
`VISION.md`, `BEHAVIORAL_PRINCIPLES.md`, and `NORTH_STAR_EXPERIENCE.md`
— see `docs/governance/DOCUMENT_CLASSIFICATION.md` for how this layer
relates to architecture and engineering. It answers a question none of
the existing vision documents answer directly: **who is LUZ for, and
what question should decide what gets built next.**

It is not the same "North Star" as `NORTH_STAR_EXPERIENCE.md`. That
document defines the felt destination — what a person should feel
after 10 minutes, 1 day, 1 month with LUZ (recognition, peace, no
attachment). This document defines a different thing: the market this
version of LUZ is being built for, and the question used to prioritize
*what to build* for that market. The two are not in tension — this one
answers "for whom, and what matters right now"; that one answers "what
should it feel like once we're there."

------------------------------------------------------------------------

## Founder Notes (Raw)

The following words are from the founder of LUZ, given directly as a
product constraint to apply from this point forward. Reproduced here
exactly as given — not corrected, not rewritten, not summarized.
Treated as primary evidence, the same way `FOUNDER_INTENT.md` and
`NORTH_STAR_EXPERIENCE.md` treat founder notes.

> A partir de ahora, asume como hipótesis que el primer mercado de LUZ
> está compuesto por personas entre 22 y 40 años que utilizan la
> tecnología y la IA como herramientas para mejorar su vida.
>
> Más que una edad o nivel educativo, lo que las define es su
> comportamiento: tienen una mentalidad de crecimiento y buscan
> desarrollar la mejor versión de sí mismas. Ya utilizan o desean
> utilizar la IA como parte de su vida cotidiana, no solo para resolver
> preguntas puntuales.
>
> Buscan una inteligencia personal que les ofrezca continuidad,
> personalización, acompañamiento y contexto a lo largo del tiempo.
>
> Sus intereses suelen incluir: actividad física y salud; nutrición y
> buenos hábitos; mejorar el sueño; organización personal y
> productividad; metas, objetivos y planificación de vida; crecimiento
> profesional; organización financiera; aprendizaje continuo (idiomas,
> lectura, investigación, nuevas habilidades); fortalecer relaciones
> personales; superar obstáculos y crecer emocionalmente.
>
> LUZ se posiciona dentro de Personal Intelligence y Wellness Tech, en
> la intersección entre inteligencia artificial, bienestar, desarrollo
> personal y gestión del conocimiento.
>
> A partir de ahora, quiero que toda decisión de arquitectura, UX y
> producto se evalúe con esta pregunta: ¿Esta decisión ayuda a que LUZ
> conozca mejor al usuario y pueda acompañarlo de forma más
> personalizada a lo largo del tiempo? Si la respuesta es no,
> probablemente no es prioritaria para esta etapa.
>
> La misión de LUZ no es responder más preguntas que otras IA. Su
> misión es convertirse en la inteligencia personal que mejor conoce al
> usuario, conectando memoria, conocimiento, razonamiento y presencia
> para ayudarle a pensar, recordar, crecer y tomar mejores decisiones
> durante años.

------------------------------------------------------------------------

## The Decision Criterion (North Star Question)

From this point forward, every architecture, UX, and product decision
should be evaluated against:

**¿Esta decisión ayuda a que LUZ conozca mejor al usuario y pueda
acompañarlo de forma más personalizada a lo largo del tiempo?**

If the honest answer is no, the decision is probably not a priority
for this stage — independent of how technically interesting, elegant,
or easy it would be to build. This is a filter for *this stage*, not a
permanent ban: something that fails this filter today can become
correct later if the market hypothesis or the evidence changes.

LUZ's mission, restated directly from the Founder's words: **not to
answer more questions than other AI — to become the personal
intelligence that knows the user best**, by connecting memory,
knowledge, reasoning, and presence to help them think, remember, grow,
and make better decisions over years.

------------------------------------------------------------------------

## Interpretation

### The ICP is behavioral, not demographic

22–40 is a proxy, not the definition. The Founder is explicit: what
actually defines this market is a growth mindset and an existing or
desired relationship with AI as a daily-life tool, not a single
punctual-question tool. This matters for how the ICP should be used:
age-gating or demographic targeting in the product would misread this
note. The behavioral signal — does this person already treat AI (or
want to treat AI) as an ongoing companion, not a search box — is the
real filter.

### Continuity, personalization, accompaniment, context — over time

The four things this market is stated to want (continuidad,
personalización, acompañamiento, contexto a lo largo del tiempo) are
not new to LUZ's architecture — they are, almost word for word, what
`VISION.md`'s principles ("Long-Term Memory", "Context Before
Answers", "Continuous Learning") and the six-layer response pipeline
(`docs/adr/ADR-0018_ARCHITECTURE_V1_FROZEN.md`) already exist to
deliver. This note does not introduce a new capability requirement —
it confirms that the direction already built (Memory, Knowledge,
Context, Conversation Strategy, Reasoning, Presence, Voice) is aimed
at the right market, and gives a sharper reason to keep investing in
depth there over breadth elsewhere.

### The nine interest areas, against what already exists

The interests named map, mostly, onto `core/life`'s existing
`LifeDomainType` taxonomy (`health`, `career`, `finances`,
`relationships`, `personal_growth`, `leisure`, `home`, `spirituality`):

- actividad física y salud, nutrición, sueño → `health`
- crecimiento profesional → `career`
- organización financiera → `finances`
- fortalecer relaciones personales → `relationships`
- superar obstáculos y crecer emocionalmente → `personal_growth`

Two named interests do not map as cleanly:

- **organización personal y productividad** — no existing domain names
  this directly; closest today is `personal_growth`, which flattens it
  with emotional growth.
- **aprendizaje continuo** (idiomas, lectura, investigación, nuevas
  habilidades) — also folds into `personal_growth` today, but
  `docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md`'s Dashboard V2 design
  already treats "Learning" as its own top-level area, ahead of the
  domain model catching up.

This is **an observation, not a decision**: per
`ADR-0018_ARCHITECTURE_V1_FROZEN.md`, the domain/engine shape does not
change on architectural taste — it changes when real user evidence
shows a real gap. Flagged here so that if productivity or learning
keeps showing up as a real, distinct need once there is real usage
data, this is the place that already anticipated it — not a new
discovery each time.

### Relationship to ADR-0018

`ADR-0018_ARCHITECTURE_V1_FROZEN.md` names "Problem validation — ICP,
problem, JTBD, value proposition" as priority 1 of the post-freeze
redirect, and states explicitly that it is "Founder-led; not an
engineering task." This document is that priority, delivered. The
ADR's remaining priorities (response quality, onboarding, visible
memory, proactive insights) are the ones this hypothesis and this
criterion should now be applied to, in that order, until real evidence
says otherwise.

------------------------------------------------------------------------

## What Future Decisions Should Always Be Validated Against This Note

- Any proposed feature, engine change, or UX decision should be able
  to answer the North Star Question directly — not with a plausible
  story, with a real mechanism for how it makes LUZ know the person
  better or accompany them more personally over time.
- A technically impressive capability that does not improve what LUZ
  knows about the person or how personally it accompanies them is not
  a priority for this stage, even if it is easy to build.
- The nine named interest areas are the working set of "what this
  market cares about" until real usage says otherwise — new
  domain/engine work motivated by "this seems useful" rather than one
  of these areas, or real user evidence, should be treated as
  off-hypothesis and flagged, not built by default.
- This hypothesis is explicitly provisional. When real user evidence
  (from actual pilot usage, not assumption) contradicts it — a
  different age range, a different behavioral pattern, interests
  outside the nine listed — this document should be updated to match
  reality, not defended past the evidence.

------------------------------------------------------------------------

## Related

- `docs/vision/VISION.md`
- `docs/vision/NORTH_STAR_EXPERIENCE.md` (the felt-experience North
  Star — distinct from the decision-criterion North Star Question
  defined here)
- `docs/foundations/FOUNDER_INTENT.md`
- `docs/adr/ADR-0018_ARCHITECTURE_V1_FROZEN.md`
