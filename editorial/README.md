# Editorial

La voz base de LUZ -- el lenguaje que usa cuando NO necesita hacer
referencia a un recuerdo, un objetivo o un evento específico. Distinta
de `buildStrategicContinuityLine`
(`features/dashboard/services/build-morning-brief.ts`), que sigue
siendo el nivel más alto de personalización de LUZ y no se toca acá.
Esto es la biblioteca editorial: atemporal, sin placeholders, pensada
para aparecer en Daily Brief, pantalla de inicio, estados vacíos,
esperas, bienvenidas, y pequeños momentos de presencia en general.

Contenido definido 2026-08-02, junto con el Founder, en varias rondas
de escritura y edición directa.

**Actualización 2026-08-09 (War Room):** primer consumidor real --
`features/dashboard/services/select-editorial-phrase.ts`, cableado en
`app/dashboard/page.tsx`. Alcance deliberadamente angosto: solo
`silence`+`observation` (14 de las 99 frases), y solo para el único
hueco de Dashboard sin ninguna lógica hoy (ni primera visita, ni línea
de continuidad de IA, ni regreso tras una pausa real). El resto de
"Conversational Variety V1" completo (quién decide, en cada momento,
entre TODAS las categorías, una línea de continuidad personalizada, o
quedarse en silencio) sigue sin diseñar, sigue fuera de alcance. Las
demás categorías (`morning`, `welcome_back`, `progress`, `celebration`,
`night`, `curiosity`, `identity`, `reflection`) siguen sin consumidor
real -- `busy_day` deliberadamente excluida incluso de este alcance
angosto: sus frases afirman haber detectado un día ocupado, y usarlas
sin una señal real que lo respalde violaría el principio de cero
fabricación (`PRESENCE_PRINCIPLES.md` #9). `repeat_after` (30 días,
igual en las 99 frases hoy) se respeta vía `seen_prompts`
(`listSeenSubjectIdsSince`/`markSeenAgain`, extensión del mecanismo ya
real de `core/seen-prompts`).

## Estructura

Una carpeta por categoría, un `phrases.yaml` por carpeta, una lista de
frases con metadatos:

```yaml
- id: morning_014
  text: "Buenos días. Empecemos con calma."
  tone: calm
  energy: low
  length: short
  season: any
  weather: any
  repeat_after: 30 days
```

- `text`: el único campo que no estaba en el ejemplo original del
  Founder -- obviamente necesario para que el dato sirva de algo.
- `tone`/`energy`/`length`: asignados principalmente a nivel de
  categoría (con excepciones puntuales donde una frase se distingue
  claramente del resto), no como 100+ juicios independientes por
  frase -- más honesto que fingir precisión donde el patrón real es
  el de la categoría.
- `length`: mecánico, por conteo de palabras (`short` ≤ 6, `medium`
  7-13). Ninguna frase de esta ronda es `long`.
- `season`/`weather`: `any` en todas -- ninguna frase de esta
  biblioteca referencia clima o estación, a propósito (atemporalidad).
- `repeat_after`: `30 days` por defecto en todas. Sin datos reales de
  frecuencia de uso todavía para diferenciar por categoría -- ajustar
  cuando exista esa señal, no antes.

## Categorías

Las 10 que definió el Founder, más una que agregué yo (marcada abajo)
para no dejar sin casa cuatro frases ya congeladas que no encajaban en
ninguna de las 10.

| Carpeta | Origen | Frases | Nota |
|---|---|---|---|
| `morning/` | Founder | 14 | |
| `reflection/` | Founder | 22 | Incluye las frases de "Contemplación" (categoría que el Founder describió pero no incluyó como carpeta propia en su lista de 10) -- supuesto mío, confirmar |
| `silence/` | Founder | 6 | "Sigo aquí." quedó pendiente de veredicto, no incluida todavía |
| `welcome_back/` | Founder | 9 | |
| `progress/` | Founder | 9 | |
| `busy_day/` | Founder | 10 | |
| `celebration/` | Founder | 0 | Vacía -- nunca se escribió contenido real para esta categoría, no se rellenó con relleno débil solo por completar |
| `night/` | Founder | 8 | |
| `curiosity/` | Founder | 9 | |
| `observation/` | Founder | 8 | Incluye el principio del Founder: frases que no buscan provocar una respuesta, nunca terminan en "?", no esperan que el usuario conteste -- ver nota abajo |
| `identity/` | **Mío, no pedida** | 4 | Las 4 frases "más características de LUZ" de la ronda anterior (incl. "No mido tus días. Los acompaño.", favorita explícita del Founder) -- ninguna de las 10 categorías originales las recibía bien. Nombre/existencia de esta carpeta es negociable. |

La mayoría de las categorías está por debajo del rango de 15-30 frases
que pidió el Founder para cada archivo -- esto es un punto de partida,
no el estado final. Ampliar cada categoría es trabajo futuro, ronda a
ronda, no algo que se debía forzar de una sola vez ("no busco cantidad,
busco coherencia", Founder, 2026-08-02).

## Principio editorial: no toda frase necesita una pregunta

La mayoría de esta biblioteca son afirmaciones, no preguntas -- LUZ
puede decir algo y quedarse ahí, sin esperar respuesta, sin necesitar
que el usuario reaccione. Solo `curiosity/` está compuesta
enteramente de preguntas reales, con la intención explícita de invitar
a hablar. En el resto, una pregunta es la excepción, no la norma.
Quien escriba más frases para esta biblioteca debería mantener esa
proporción.
