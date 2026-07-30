import type {
  DueLifeItem,
  LifeDomainSnapshot,
  LifeTotals,
  RelationshipsSnapshot,
} from "../../dashboard/services/build-life-dashboard-snapshot";
import type { DashboardAction, FollowUpRecommendation } from "../../dashboard/services/build-follow-up-recommendations";
import type { PresenceFocusItem, PresenceUrgencyLevel } from "../../presence/domain/presence-state";
import type {
  CalendarEvent,
  CalendarSyncState,
  FreeTimeBlock,
  RecurringCommitment,
} from "../../reality/domain";

/**
 * Forma general de la vida activa ahora mismo -- lo único que
 * `HomeState` deriva directamente del `LifeDashboardSnapshot` en vez de
 * `PresenceState`, porque Presence nunca resumió "estado general",
 * solo señales puntuales (foco/recomendaciones, ya acotadas a 2-3).
 * Reusa tipos ya existentes de `features/dashboard/` en vez de
 * inventar una segunda forma de contar lo mismo.
 *
 * Nombrado `LifeContext` (no `CurrentContext`) a propósito: evita
 * confundirse con `currentFocus`, que es la sección que sí viene de
 * Presence.
 */
export interface HomeLifeContext {
  /** Passthrough exacto de `snapshot.totals`. */
  totals: LifeTotals;
  /** Passthrough exacto de `snapshot.domains` -- una entrada por cada `LifeDomainType`, incluye dominios en 0. */
  domains: LifeDomainSnapshot[];
  /** Passthrough exacto de `snapshot.relationships`. */
  relationships: RelationshipsSnapshot;
  /** Total real de observaciones generadas -- `PresenceState` solo expone las 2 de mayor prioridad (`currentFocus`); este conteo permite mostrar "+N más" sin volver a rankear nada. */
  observationCount: number;
  /** Total real de recomendaciones generadas -- `PresenceState` solo expone hasta 3 por categoría (`attentionNeeded`/`recentProgress`); mismo criterio que `observationCount`. */
  recommendationCount: number;
}

/**
 * Sección "Current Focus": las 1-2 observaciones que Presence ya
 * decidió que son lo más importante ahora mismo. Un solo objeto en vez
 * de dos campos sueltos (`primaryFocus`/`secondaryFocus`) porque
 * conceptualmente es una sola decisión con dos niveles, no dos
 * decisiones independientes.
 */
export interface HomeCurrentFocus {
  /** Passthrough exacto de `PresenceState.primaryFocus`. */
  primary: PresenceFocusItem | null;
  /** Passthrough exacto de `PresenceState.secondaryFocus`. */
  secondary: PresenceFocusItem | null;
}

/** Sección "Recent Progress": passthrough agrupado de `PresenceState.recentProgress` + `PresenceState.encouragement` -- misma fuente, empaquetada como una sola sección para Home. */
export interface HomeRecentProgress {
  encouragement: string | null;
  items: FollowUpRecommendation[];
}

/** Una acción rápida por cada recomendación accionable -- proyección directa de `suggestedAction`, nunca una decisión nueva sobre qué mostrar ni en qué orden. */
export interface HomeQuickAction {
  /** Enlaza de vuelta a la recomendación de origen en `attentionNeeded` (mismo `id`). */
  recommendationId: string;
  /** Igual al `title` de la recomendación de origen. */
  label: string;
  action: DashboardAction;
}

export const HOME_MEETING_MOMENT_KINDS = ["starting_soon", "in_progress", "recently_ended"] as const;
export type HomeMeetingMomentKind = (typeof HOME_MEETING_MOMENT_KINDS)[number];

/**
 * Cubre las secciones sugeridas "Meeting preparation" y "Post-meeting
 * follow-up": un evento de `calendar.today` categorizado según su
 * posición en el tiempo respecto a `calendar` (`generatedAt` como
 * "ahora", igual instante que ya usó Calendar Foundation para calcular
 * `today`/`upcoming` -- nunca un segundo "ahora" independiente).
 * Ninguna puntuación, ningún ranking: solo tres cubetas por umbral fijo
 * (`build-calendar-context.ts`), el mismo tipo de decisión que ya toma
 * `timeOfDayGreeting` en Presence -- categorización, no un motor nuevo.
 */
export interface HomeMeetingMoment {
  kind: HomeMeetingMomentKind;
  event: CalendarEvent;
}

/**
 * Todo lo que Calendar Foundation (`features/reality/`) ya decidió,
 * proyectado para Home -- cubre "Busy Today", "Free Time", "Upcoming
 * events", "Calendar status", "Meeting preparation" y "Post-meeting
 * follow-up". Passthrough puro salvo dos derivaciones deliberadas y
 * mínimas (`upcomingEvents`, `meetingMoments`), documentadas en cada
 * campo -- ninguna reinterpreta ni reordena lo que
 * `getCalendarSnapshot` ya calculó. Ver `features/home/README.md`
 * ("Integración con Calendar Foundation") para el razonamiento
 * completo, incluyendo por qué Calendar Foundation en sí no se tocó.
 */
export interface HomeCalendarContext {
  /** Passthrough exacto de `CalendarSnapshot.syncStatus.state` -- Home nunca reinterpreta el estado de sincronización, solo lo expone. */
  status: CalendarSyncState;
  /** Sección "Busy Today". Passthrough exacto de `CalendarSnapshot.today`. */
  today: readonly CalendarEvent[];
  /**
   * Sección "Upcoming events". `CalendarSnapshot.upcoming` incluye
   * eventos de HOY (la ventana de Calendar Foundation empieza en
   * `todayStart`, no después) -- passarlo tal cual habría mostrado
   * cada evento de hoy dos veces (una en `today`, otra en
   * `upcomingEvents`). Este campo resta por `id` lo que ya está en
   * `today`: la única derivación de esta sección, nunca una
   * reordenación ni un recorte adicional.
   */
  upcomingEvents: readonly CalendarEvent[];
  /** Sección "Free Time". Passthrough exacto de `CalendarSnapshot.freeBlocks` (abarca toda la ventana, no solo hoy -- Calendar Foundation no expone por separado "libre hoy" vs "libre después", y este cimiento no reimplementa esa frontera). */
  freeBlocks: readonly FreeTimeBlock[];
  /** Passthrough exacto de `CalendarSnapshot.recurringCommitments` -- la mitigación de producto para la limitación de `RRULE` sin expandir (ver README, "Compromisos recurrentes"): una serie sin fecha concreta sincronizada para hoy/pronto sigue siendo visible aquí, aunque no aparezca en `today`/`upcomingEvents`. */
  recurringCommitments: readonly RecurringCommitment[];
  /** Secciones "Meeting preparation" / "Post-meeting follow-up". Derivado solo de `today` (ver `HomeMeetingMoment`). */
  meetingMoments: readonly HomeMeetingMoment[];
}

/**
 * Representación canónica de backend de lo que LUZ debería mostrar al
 * abrir la aplicación. Responde una sola pregunta: "¿qué debería
 * mostrarle LUZ a esta persona ahora mismo?". Determinístico, sin IA,
 * sin repositorios ni base de datos -- ver `buildHomeState`
 * (`application/build-home-state.ts`).
 *
 * Regla de composición, sin excepciones: todo campo que `PresenceState`
 * ya decidió (saludo, foco, urgencia, accionables, celebraciones)
 * llega aquí por passthrough exacto, nunca recalculado -- Home no es
 * un segundo motor de decisión, es la forma que toma la decisión de
 * Presence para una pantalla. `lifeContext`/`upcoming` se derivan
 * directamente del `LifeDashboardSnapshot`, y `calendar` de un
 * `CalendarSnapshot` de Calendar Foundation (`features/reality/`) --
 * ninguno de los dos pasa por Presence porque Presence nunca los cubrió
 * (Life Graph general y calendario real son datos que Presence V1
 * jamás recibió). Mismo principio en los tres casos: Home nunca
 * reinterpreta lo que otro módulo ya decidió, solo lo compone. Ver
 * `features/home/README.md` para el razonamiento completo de esta
 * división, incluyendo por qué `features/reality/` en sí no se tocó.
 */
export interface HomeState {
  /** Mismo valor que `PresenceState.asOf` -- único timestamp de referencia para todo el objeto. */
  asOf: Date;

  /** Sección "Greeting". Passthrough exacto de `PresenceState.greeting`. */
  greeting: string;

  /** Sección "Current Context" (implícita, no listada como sección propia): forma general de la vida activa, ver `HomeLifeContext`. */
  lifeContext: HomeLifeContext;

  /** Sección "Current Focus". */
  currentFocus: HomeCurrentFocus;

  /**
   * Secciones "Attention Needed" y "Recommendations". Passthrough
   * exacto de `PresenceState.attentionNeeded` (mismo nombre a
   * propósito, mismo dato). Ambas secciones sugeridas por la misión
   * apuntan al mismo arreglo: recomendaciones accionables ya
   * priorizadas por Presence (nunca `CELEBRATE_PROGRESS`, nunca
   * `NO_ACTION`). Exponerlas dos veces bajo nombres distintos habría
   * sido la "lógica de ranking duplicada" que la Tarea 3 pide evitar
   * -- un cliente que necesite dos presentaciones visuales distintas
   * (banner urgente + lista completa) las arma a partir de este mismo
   * arreglo y de `urgency`, sin que Home tenga que decidir nada dos
   * veces.
   */
  attentionNeeded: FollowUpRecommendation[];

  /** Sección "Recent Progress". */
  recentProgress: HomeRecentProgress;

  /** Passthrough exacto de `PresenceState.urgency` -- Home nunca recalcula urgencia, solo la expone para que un futuro cliente decida el énfasis visual (banner, color, orden). No es una sección propia: es la señal transversal que matiza a `currentFocus` y `attentionNeeded`. */
  urgency: PresenceUrgencyLevel;

  /** Sección "Quick Actions". Una acción por cada entrada de `attentionNeeded`, mismo orden. */
  quickActions: HomeQuickAction[];

  /**
   * Passthrough exacto de `snapshot.upcoming` (Goals/Projects del Life
   * Graph con fecha objetivo/límite dentro de la ventana de 14 días que
   * ya define `build-life-dashboard-snapshot.ts`). **No confundir con
   * `calendar.upcomingEvents`**: esto son compromisos del Life Graph
   * (un Goal con `targetDate`, un Project con `dueDate`) declarados por
   * la persona; `calendar` son eventos reales del calendario externo
   * (Apple/Google/Outlook). Dos dominios distintos, con vocabulario
   * distinto (`DueLifeItem` vs. `CalendarEvent`) -- fusionarlos en un
   * solo arreglo habría perdido esa distinción real, y ninguno es un
   * subconjunto del otro (un Goal puede no tener ningún evento de
   * calendario asociado, y viceversa).
   */
  upcoming: DueLifeItem[];

  /**
   * Todo lo que Calendar Foundation aporta -- `null` cuando la persona
   * nunca conectó un calendario (`CalendarConnection` no existe
   * todavía; Calendar Foundation no persiste nada, así que esa
   * ausencia es responsabilidad de quien llama a `buildHomeState`, ver
   * `application/build-home-state.ts`). Cuando no es `null`, `status`
   * distingue conectado/sincronizando/error/desconectado -- ver
   * `HomeCalendarContext`.
   */
  calendar: HomeCalendarContext | null;
}
