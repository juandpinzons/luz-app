"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckIcon, CopyIcon, ImageIcon, MicIcon } from "@/components/ui/icons";
import { triggerLightHaptic } from "@/features/native/haptics";
import { Skeleton } from "@/components/ui/skeleton";
import { TypingIndicator } from "@/components/ui/typing-indicator";
import { ConversationOpeningRitual } from "@/features/chat/components/conversation-opening-ritual";
import type { OrbVisualState } from "@/features/orb/domain/orb-visual-state";
import { readDraft, writeDraft } from "@/features/chat/draft-storage";
import type { AvatarMoodSignal } from "@/features/avatar";
import { FloatingAvatar } from "@/features/avatar/components/floating-avatar";
import type { GetWelcomeResponse } from "@/app/api/chat/welcome/route";
import type {
  GetLatestConversationResponse,
  SendMessageErrorResponse,
} from "@/features/chat/types";

/** Sin llamada de red -- se usa solo al reanudar una conversación histórica puntual, donde el gesto es "volver a algo", nunca la bienvenida completa generada por IA (esa es solo para empezar de cero). */
const RESUME_CUE = "De vuelta";

/** Ver `showOpeningRitual` en `ChatPageContent`: una sola vez por navegador, nunca por servidor (no hay campo de cuenta para esto, y no hace falta uno -- ver el mismo docblock). */
const CHAT_RITUAL_SEEN_KEY = "luz:chat-ritual-seen";

/**
 * Avatar V1 -- `/chat` recibe la capa de interacción en vivo completa
 * (respiración/parpadeo/listen/think/sleep, todos reales), pero NO el
 * `mood` de fondo de los cuatro motores (Presence+Experience+Narrative+
 * Identity): ese cálculo ya existe en este mismo repo
 * (`assembleReconnectionContext.ts`) y está deliberadamente gateado
 * detrás de `isFirstContact` + un vacío real de horas -- "caro
 * comparado con el resto del turno", en sus propias palabras --
 * precisamente para no pagarlo en cada apertura/mensaje de chat. Traer
 * ese mismo costo aquí, sin ese gate, sería exactamente la latencia que
 * `features/orb/README.md` ya documentó evitar para esta misma
 * pantalla. Mood rico en `/chat` puede ser un fast-follow real
 * reutilizando ese mismo gate -- fuera de alcance de V1.
 */
const NEUTRAL_AVATAR_MOOD: AvatarMoodSignal = {
  emotion: "calm",
  intensity: 0.25,
  gaze: "user",
  focusRef: null,
  reason: "Sin mood de fondo en /chat todavía (V1) -- la interacción en vivo sigue completamente activa.",
  asOf: new Date(),
};

type Message = {
  role: "user" | "assistant";
  content: string;
  /** Data URI completa de una imagen adjunta a este mensaje -- ver `core/db/schema/conversations.ts`. */
  imageData?: string | null;
};

/**
 * Distingue "el servidor respondió y explicó qué pasó" (mensaje seguro
 * para mostrar tal cual — límite de mensajes, sesión expirada, etc.,
 * ya escritos con cuidado en app/api/chat/route.ts) de una falla real
 * de red (fetch nunca llegó a responder), cuyo mensaje de navegador
 * nunca debería llegar a la persona tal cual.
 */
class ChatRequestError extends Error {}

/**
 * Un evento Server-Sent Events ya separado en `event:`/`data:` (ver
 * `sseMessage` en app/api/chat/route.ts) — `data` siempre viaja como
 * JSON, así que se parsea aquí, no se deja como string crudo.
 */
interface ParsedSSEEvent {
  event: string;
  data: unknown;
}

function parseSSEMessage(raw: string): ParsedSSEEvent | null {
  let event = "message";
  let dataLine: string | undefined;

  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
    } else if (line.startsWith("data:")) {
      dataLine = line.slice("data:".length).trim();
    }
  }

  if (dataLine === undefined) return null;

  try {
    return { event, data: JSON.parse(dataLine) };
  } catch {
    return null;
  }
}

/**
 * `startedAt` llega como ISO string en la URL (ver `?startedAt=` en el
 * enlace "Continuar esta conversación" de `/conversations/[id]`) — la
 * única fuente de esa fecha, ya que ni `GET /api/chat` ni
 * `GET /api/conversations/[id]` la exponen (este sprint no toca la
 * API). Si falta o no se puede parsear, `null` — el indicador cae al
 * texto genérico en vez de romperse.
 */
/** Qué tan cerca del fondo (en px) cuenta como "ya estaba abajo" para el autoscroll inteligente. */
const NEAR_BOTTOM_THRESHOLD_PX = 120;

/** Techo del textarea que crece con el mensaje -- pasado esto, scroll interno en vez de seguir empujando la conversación hacia arriba. ~6 líneas a este tamaño de fuente. */
const MESSAGE_INPUT_MAX_HEIGHT_PX = 160;

/** Corte duro de una nota de voz -- defensa en profundidad junto al límite de tamaño del lado del servidor (`MAX_AUDIO_BYTES`, `/api/chat/transcribe`), nunca la única barrera. 2 min es generoso para hablar en voz alta, no para grabar por accidente y olvidar la grabación prendida. */
const MAX_RECORDING_MS = 2 * 60 * 1000;

/** Lado más largo tras reescalar -- de sobra para que LUZ vea lo relevante de una foto real, lejos de la resolución nativa de una cámara de celular. */
const MAX_IMAGE_DIMENSION_PX = 1600;
/** JPEG, no PNG -- el formato de salida es siempre este, sin importar el original (HEIC de iPhone incluido). 0.82 es el punto donde el ojo ya no nota la diferencia pero el archivo sí baja bastante. */
const IMAGE_JPEG_QUALITY = 0.82;
/** Techo sobre el ARCHIVO ORIGINAL, antes de comprimir -- solo para no intentar procesar algo absurdo; el límite real que le llega al servidor es `MAX_IMAGE_DATA_URI_LENGTH` (`features/chat/types.ts`), ya sobre la versión comprimida. */
const MAX_IMAGE_FILE_SIZE_BYTES = 20 * 1024 * 1024;

function parseStartedAtParam(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Fecha en formato humano, nunca timestamp — "hoy"/"ayer"/"hace N
 * días" hasta una semana, después la fecha absoluta ("15 de julio",
 * con año solo si es distinto del actual). A partir de dos meses, el
 * tono cambia: no es lo mismo retomar algo de la semana pasada que
 * abrir un hilo que llevaba tiempo cerrado — esto último merece
 * sentirse como encontrar algo, no solo continuarlo.
 */
function formatHistoricalLabel(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays <= 0) return "Retomando una conversación de hoy";
  if (diffDays === 1) return "Retomando una conversación de ayer";
  if (diffDays < 7) {
    return `Retomando una conversación de hace ${diffDays} días`;
  }

  const formatted = new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    timeZone: "America/Bogota",
  }).format(date);

  if (diffDays >= 60) {
    return `Volviendo a algo que hablamos hace tiempo, el ${formatted}`;
  }

  return `Retomando una conversación del ${formatted}`;
}

/** Cuánto se queda el ✓ visible antes de volver al ícono de copiar. */
const COPY_CONFIRMATION_MS = 1500;

/**
 * Debajo de cada burbuja, propia o de LUZ -- copia el texto tal cual
 * (con sus saltos de línea reales, ver `whitespace-pre-wrap` en la
 * burbuja) al portapapeles. `navigator.clipboard` exige un contexto
 * seguro (https, o localhost en dev) -- ya garantizado, la app entera
 * corre sobre eso.
 */
function CopyMessageButton({ content, align }: { content: string; align: "left" | "right" }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_CONFIRMATION_MS);
    } catch {
      // Silencioso a propósito -- un fallo al copiar no es un error real
      // de la conversación, solo un permiso de navegador denegado.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? "Mensaje copiado" : "Copiar mensaje"}
      className={`mt-1 flex items-center gap-1 rounded px-1 text-xs text-zinc-600 transition hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz ${align === "right" ? "self-end" : "self-start"}`}
    >
      {copied ? (
        <>
          <CheckIcon className="h-3.5 w-3.5" />
          Copiado
        </>
      ) : (
        <>
          <CopyIcon className="h-3.5 w-3.5" />
          Copiar
        </>
      )}
    </button>
  );
}

/**
 * `useSearchParams` exige un boundary `<Suspense>` para no romper el
 * build de producción (verificado en la documentación de Next.js de
 * este proyecto) — de ahí la separación entre este wrapper y
 * `ChatPageContent`, que tiene toda la lógica real.
 */
export default function ChatPage() {
  return (
    <Suspense
      fallback={<main className="flex h-full flex-col bg-black text-white" />}
    >
      <ChatPageContent />
    </Suspense>
  );
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Sprint de conversaciones persistentes: presente cuando se llega
  // desde "Continuar esta conversación" (/conversations/[id]) o desde
  // una tarjeta de conversación reciente del Dashboard — ausente en el
  // uso normal, que sigue cargando la más reciente exactamente igual
  // que antes.
  const conversationIdParam = searchParams.get("conversationId");
  const startedAtParam = searchParams.get("startedAt");

  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isSending, setIsSending] = useState(false);
  /**
   * Distinto de `isSending`: solo cubre la espera ANTES de que llegue
   * el primer fragmento real de la respuesta (ADR-0017) — controla
   * únicamente el indicador "LUZ está escribiendo…", que debe
   * desaparecer en cuanto el texto empieza a crecer, no cuando termina
   * de generarse por completo.
   */
  const [isThinking, setIsThinking] = useState(false);
  /**
   * Nunca se decide solo por si `conversationIdParam` existe (ver el
   * efecto de abajo): un enlace puede apuntar a la conversación que
   * de todas formas ya es la más reciente, y en ese caso el encabezado
   * debe quedar limpio igual que en el uso normal.
   */
  const [isHistoricalConversation, setIsHistoricalConversation] =
    useState(false);
  const [historicalLabel, setHistoricalLabel] = useState<string | null>(null);
  const [welcomeCue, setWelcomeCue] = useState<string | undefined>();
  const [welcomeGreeting, setWelcomeGreeting] = useState<string | null>(null);
  const [orbSignature, setOrbSignature] = useState<OrbVisualState | undefined>();
  /** Avatar V1 -- última actividad real (tecla presionada, mensaje enviado), nunca decorativa: alimenta `msSinceLastActivity` (`usePresenceAvatarState`), la misma métrica que decide `sleep`. */
  const [lastActivityAt, setLastActivityAt] = useState(() => new Date());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  /**
   * Nota de voz -- transcripción real (Whisper, `/api/chat/transcribe`),
   * nunca la persona enviando audio a ciegas: el texto aparece en el
   * input para que lo revise antes de "Enviar", igual que si lo hubiera
   * escrito. `micSupported` arranca en `false` (mismo criterio que
   * `showOpeningRitual`/`floating-avatar.tsx`: `navigator`/`MediaRecorder`
   * no existen en el servidor) y se corrige en el efecto de abajo --
   * nunca se muestra un botón roto en un navegador sin soporte real.
   */
  const [micSupported, setMicSupported] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Imagen adjunta al PRÓXIMO mensaje -- data URI ya comprimida del lado
   * del cliente (`compressImageFile`), lista para enviar tal cual. La
   * persona la ve en una vista previa antes de "Enviar", igual que la
   * transcripción de voz aparece en el input antes de enviarse -- nunca
   * algo que se manda a ciegas.
   */
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  /** Evita que el efecto de carga de historial reponga la conversación anterior justo después de "Nueva conversación" (ver `startNewConversation`). */
  const suppressNextLoadRef = useRef(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  /**
   * Beta-critical polish (rendimiento, mismo mandato que ya corrigió
   * Dashboard): el ritual de apertura (~1.9s) se reproducía en TODA
   * visita a /chat, no solo la primera vez -- a diferencia de Dashboard,
   * que ya lo gatea con `isFirstVisit` (`app/dashboard/page.tsx`) desde
   * antes de este cambio. Arranca en `true` (mismo valor en servidor y
   * en el primer render del cliente -- sin esto, `localStorage` no
   * existe en el servidor y un mismatch de hidratación sería real) y se
   * corrige, si corresponde, en el `useLayoutEffect` de abajo --
   * *antes* de pintar, para que quien ya lo vio nunca vea ni un frame
   * del velo. `null` no hace falta aquí (a diferencia de
   * `floating-avatar.tsx`): no hay una posición que calcular, solo un
   * booleano que ya tiene un valor por defecto seguro.
   */
  const [showOpeningRitual, setShowOpeningRitual] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  /**
   * Arranca en `true`: abrir el chat siempre ancla abajo, igual que
   * antes de este cambio. Un `ref` y no un `state` porque no debe
   * disparar un re-render — solo se lee dentro del efecto de scroll de
   * abajo y se escribe desde el handler de scroll y desde `sendMessage`.
   */
  const isNearBottomRef = useRef(true);
  /**
   * Espejo en `state` de `!isNearBottomRef`, solo para pintar el botón
   * "volver al final" — a diferencia del ref, esto sí debe disparar un
   * re-render, pero solo cuando cruza el umbral (nunca en cada pixel de
   * scroll: la actualización funcional de abajo evita el re-render si
   * el valor no cambió).
   */
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // `useLayoutEffect`, no `useEffect`: corre antes de que el navegador
  // pinte, así que quien ya vio el ritual nunca ve el velo aparecer y
  // desaparecer en el mismo frame -- a diferencia de un `useEffect`
  // normal, que corre después del primer pintado real.
  useLayoutEffect(() => {
    const seen = window.localStorage.getItem(CHAT_RITUAL_SEEN_KEY) === "true";
    if (seen) {
      // `window`/`localStorage` no existen durante SSR -- el estado
      // tiene que arrancar en `true` (mismo output en servidor y en el
      // primer render del cliente) y corregirse aquí, después de
      // montar, mismo criterio ya establecido en `floating-avatar.tsx`.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowOpeningRitual(false);
    } else {
      window.localStorage.setItem(CHAT_RITUAL_SEEN_KEY, "true");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMicSupported(
      typeof navigator !== "undefined" &&
        typeof window.MediaRecorder !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia,
    );
  }, []);

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isNear = distanceFromBottom <= NEAR_BOTTOM_THRESHOLD_PX;
    isNearBottomRef.current = isNear;
    setShowScrollToBottom((prev) => (prev === !isNear ? prev : !isNear));
  }

  function scrollToBottom() {
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }

  useEffect(() => {
    // Solo sigue el streaming si la persona ya estaba abajo — si scrolleó
    // arriba para releer algo, un chunk nuevo no debe secuestrar su
    // posición (autoscroll inteligente).
    if (isNearBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages, isSending, isThinking]);

  /** Evita hidratar el borrador dos veces, y evita escribir en localStorage antes de que la hidratación haya corrido una vez (ver `hydrateDraft` y el efecto de más abajo). */
  const hasHydratedDraftRef = useRef(false);

  /**
   * Se llama desde dentro de `loadConversation` (abajo), nunca desde un
   * efecto síncrono: recién ahí se conoce el `conversationId` real que
   * resolvió esta carga (puede diferir del state si ya había una
   * conversación en curso, ver los comentarios de cada rama). Usa la
   * forma funcional de `setMessage` para nunca pisar texto que la
   * persona ya haya escrito mientras el historial cargaba.
   */
  function hydrateDraft(resolvedConversationId: string | undefined) {
    if (hasHydratedDraftRef.current) return;
    hasHydratedDraftRef.current = true;

    setMessage((current) => {
      if (current.trim() !== "") return current;
      return readDraft(resolvedConversationId) || current;
    });
  }

  useEffect(() => {
    // `conversationId` no está en las dependencias a propósito: este
    // efecto solo debe reaccionar a texto nuevo, nunca a que
    // `conversationId` se resuelva de forma asíncrona (vía el evento
    // `meta` del stream) — para cuando eso pasa, `sendMessage` ya dejó
    // `message` en "", así que no habría nada real que escribir, y
    // escribir en ese momento arriesgaría pisar un borrador recién
    // hidratado con un valor todavía desactualizado de este render.
    if (!hasHydratedDraftRef.current) return;
    writeDraft(conversationId, message);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  useEffect(() => {
    let cancelled = false;

    async function loadConversation() {
      // "Nueva conversación" ya dejó el estado exactamente como debe
      // quedar — este disparo del efecto es solo el eco de haber
      // limpiado la URL, no debe volver a traer nada.
      if (suppressNextLoadRef.current) {
        suppressNextLoadRef.current = false;
        setIsLoadingHistory(false);
        hydrateDraft(undefined);
        return;
      }

      // Guarda el id que esta carga efectivamente resolvió, para
      // hidratar el borrador con la misma llave — nunca se lee de vuelta
      // el `conversationId` del state porque puede haber quedado
      // desactualizado por una carrera con un envío ya en curso (ver
      // los comentarios de cada rama de abajo).
      let resolvedConversationId: string | undefined;

      try {
        if (conversationIdParam) {
          // Reanudar un hilo puntual es un gesto distinto de "empezar
          // de cero" -- nunca dispara la bienvenida generada por IA
          // (eso costaría una llamada real sin aportar nada: ya se
          // sabe exactamente a qué se está volviendo). Solo un trazo
          // corto y fijo para el ritual de apertura.
          setWelcomeCue(RESUME_CUE);
          setWelcomeGreeting(null);
          setOrbSignature(undefined);
          // Se piden en paralelo la conversación solicitada Y la
          // realmente más reciente (GET /api/chat, sin parámetros, sin
          // tocar nada del backend) — comparar sus ids es el único
          // criterio para decidir "isHistoricalConversation". Nunca se
          // decide solo por la presencia de `conversationIdParam`: un
          // enlace puede apuntar a la conversación que de todas formas
          // ya es la más reciente (ej. desde una tarjeta del Dashboard),
          // y en ese caso no es histórica.
          const [detailResponse, latestResponse] = await Promise.all([
            fetch(`/api/conversations/${conversationIdParam}`),
            fetch("/api/chat"),
          ]);

          if (!detailResponse.ok) {
            throw new Error("No se pudo recuperar la conversación.");
          }

          const detailData: GetLatestConversationResponse | null =
            await detailResponse.json();
          const latestData: GetLatestConversationResponse | null =
            latestResponse.ok ? await latestResponse.json() : null;

          if (!cancelled && detailData) {
            const historical =
              !latestData ||
              latestData.conversationId !== detailData.conversationId;

            setConversationId((prev) => prev ?? detailData.conversationId);
            setMessages((prev) =>
              prev.length === 0 ? detailData.messages : prev,
            );
            setIsHistoricalConversation(historical);
            resolvedConversationId = detailData.conversationId;

            const startedAt = parseStartedAtParam(startedAtParam);
            setHistoricalLabel(
              historical
                ? formatHistoricalLabel(startedAt ?? new Date())
                : null,
            );
          }
        } else {
          // Abrir LUZ ya no reabre el historial completo de la
          // conversación más reciente -- cada visita empieza en blanco
          // (Priority 3: "no cargar automáticamente todo el
          // historial"). Las conversaciones anteriores siguen enteras
          // en /conversations; esto solo decide qué aparece al entrar.
          // `conversationId` se queda `undefined` a propósito: el
          // primer mensaje real crea una conversación nueva
          // (`getOrCreateConversation`).
          setIsHistoricalConversation(false);
          setHistoricalLabel(null);

          // Fire-and-forget, nunca `await` -- el saludo/orbe generado por
          // IA (`generate-welcome.ts`) es una mejora sobre la apertura,
          // nunca un requisito para poder escribir. Antes este `await`
          // dejaba la esfera del ritual (`ready={!isLoadingHistory}`)
          // esperando lo que tardara esa llamada real a IA, contradiciendo
          // su propio diseño ("nunca depende de cuánto tarde una petición
          // real", ver `conversation-opening-ritual.tsx`) -- mismo
          // criterio que `startNewConversation` ya usa más abajo. Sin
          // datos todavía, el render ya tiene un respaldo sensato
          // (`welcomeGreeting ?? "Aquí estoy."`), nunca un placeholder
          // roto.
          fetch("/api/chat/welcome")
            .then((response) => (response.ok ? response.json() : null))
            .then((data: GetWelcomeResponse | null) => {
              if (cancelled || !data) return;
              setWelcomeCue(data.cue);
              setWelcomeGreeting(data.greeting);
              setOrbSignature(data.orb);
            })
            .catch(() => {
              // Silencioso a propósito, mismo criterio que `startNewConversation`.
            });
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
          hydrateDraft(resolvedConversationId);
        }
      }
    }

    loadConversation();

    return () => {
      cancelled = true;
    };
  }, [conversationIdParam, startedAtParam]);

  function startNewConversation() {
    suppressNextLoadRef.current = true;
    setMessages([]);
    setMessage("");
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);
    // Se re-arma para que el efecto de hidratación vuelva a correr con
    // la llave "new" — si había un borrador sin enviar de una sesión
    // "nueva" anterior, se recupera; si no, no hace nada.
    hasHydratedDraftRef.current = false;
    setConversationId(undefined);
    setIsHistoricalConversation(false);
    setHistoricalLabel(null);
    router.replace("/chat");
    inputRef.current?.focus();

    // La misma bienvenida generada fresca que ya recibe una visita
    // normal a /chat -- "nueva conversación" es exactamente eso, un
    // nuevo inicio, nunca un texto reciclado del hilo que se acaba de
    // dejar atrás. Se limpia primero para que nunca se muestre un
    // saludo que en realidad pertenecía al hilo anterior.
    setWelcomeCue(undefined);
    setWelcomeGreeting(null);
    setOrbSignature(undefined);
    fetch("/api/chat/welcome")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: GetWelcomeResponse | null) => {
        if (!data) return;
        setWelcomeCue(data.cue);
        setWelcomeGreeting(data.greeting);
        setOrbSignature(data.orb);
      })
      .catch(() => {
        // Silencioso a propósito: el estado vacío ya tiene un texto de
        // respaldo (ver el render) si esto nunca llega a resolver.
      });
  }

  /**
   * Crece con el contenido hasta `MESSAGE_INPUT_MAX_HEIGHT_PX`, después
   * scroll interno -- `height: auto` primero para que achicar el texto
   * también achique la caja, no solo agrandarla. Corre en un efecto (no
   * llamado a mano en cada sitio que cambia `message`) para cubrir los
   * cuatro caminos reales con un solo lugar: escribir, enviar (vuelve a
   * ""), "Nueva conversación" (vuelve a ""), y la hidratación de un
   * borrador guardado (`hydrateDraft`, puede llegar con saltos de línea).
   */
  function resizeMessageInput() {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MESSAGE_INPUT_MAX_HEIGHT_PX)}px`;
  }

  useEffect(() => {
    resizeMessageInput();
  }, [message]);

  /**
   * Sube la grabación completa y transcribe -- nunca en vivo palabra por
   * palabra (eso exigiría `SpeechRecognition` nativo, sin soporte real en
   * Firefox y poco confiable en Safari/iOS, justo los navegadores de una
   * audiencia real en celular). El texto se AGREGA al mensaje, nunca lo
   * reemplaza -- la persona pudo haber escrito algo antes de grabar.
   */
  async function transcribeAudio(blob: Blob) {
    setIsTranscribing(true);
    setMicError(null);

    try {
      const formData = new FormData();
      formData.append("audio", blob, "nota-de-voz.webm");

      const response = await fetch("/api/chat/transcribe", { method: "POST", body: formData });
      const data: { text?: string; error?: string } = await response.json().catch(() => ({}));

      if (!response.ok || !data.text) {
        throw new Error(data.error ?? "No se pudo transcribir el audio.");
      }

      setMessage((current) => (current.trim() === "" ? data.text! : `${current} ${data.text}`));
      setLastActivityAt(new Date());
      inputRef.current?.focus();
    } catch (error) {
      setMicError(error instanceof Error ? error.message : "No se pudo transcribir el audio.");
    } finally {
      setIsTranscribing(false);
    }
  }

  async function startRecording() {
    setMicError(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMicError("No pude acceder al micrófono -- revisa los permisos.");
      return;
    }

    const recorder = new MediaRecorder(stream);
    audioChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      if (recordingStopTimerRef.current) {
        clearTimeout(recordingStopTimerRef.current);
        recordingStopTimerRef.current = null;
      }
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      audioChunksRef.current = [];
      if (blob.size > 0) {
        transcribeAudio(blob);
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    setLastActivityAt(new Date());

    recordingStopTimerRef.current = setTimeout(() => {
      recorder.stop();
      setIsRecording(false);
    }, MAX_RECORDING_MS);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  /**
   * Comprime del lado del cliente ANTES de convertir a base64 -- una
   * foto de celular real (12-48MP) puede pesar varios MB crudos; sin
   * esto, cada imagen viajaría entera en el cuerpo del POST y en cada
   * lectura de historial de la conversación para siempre. Reescala al
   * lado más largo (nunca recorta), siempre a JPEG -- el formato de
   * salida no depende del original (HEIC de iPhone incluido, que ni
   * OpenAI acepta directo), `canvas.toDataURL` ya lo resuelve.
   */
  async function compressImageFile(file: File): Promise<string> {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_DIMENSION_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo procesar la imagen.");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    return canvas.toDataURL("image/jpeg", IMAGE_JPEG_QUALITY);
  }

  async function handleImageSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite adjuntar el mismo archivo dos veces seguidas
    if (!file) return;

    if (file.size > MAX_IMAGE_FILE_SIZE_BYTES) {
      setImageError("La imagen es demasiado grande (máximo 20MB).");
      return;
    }

    setImageError(null);
    setIsProcessingImage(true);
    try {
      const dataUri = await compressImageFile(file);
      setPendingImage(dataUri);
      setLastActivityAt(new Date());
    } catch {
      setImageError("No se pudo procesar esa imagen.");
    } finally {
      setIsProcessingImage(false);
    }
  }

  // Suelta el micrófono si la persona navega fuera de /chat a mitad de una
  // grabación -- sin esto, el indicador de "micrófono en uso" del navegador
  // se queda prendido hasta recargar la página.
  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      if (recordingStopTimerRef.current) clearTimeout(recordingStopTimerRef.current);
    };
  }, []);

  async function sendMessage() {
    // Un mensaje solo-imagen (sin texto) es un caso real -- mismo criterio
    // que `sendMessageRequestSchema` en el servidor.
    if ((message.trim() === "" && !pendingImage) || isSending) return;

    // Toque nativo (misión "shell nativo iOS") -- no-op fuera de la app, nunca bloquea el envío.
    void triggerLightHaptic();

    setLastActivityAt(new Date());
    const userMessage = message;
    const userImage = pendingImage;

    // Enviar siempre ancla abajo, sin importar dónde estaba el scroll —
    // misma convención que cualquier app de mensajería: la persona debe
    // ver su propio mensaje aterrizar.
    isNearBottomRef.current = true;
    setShowScrollToBottom(false);

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
        imageData: userImage,
      },
    ]);

    setMessage("");
    setPendingImage(null);
    setImageError(null);
    setIsSending(true);
    setIsThinking(true);

    // Visible también en el catch: si el stream ya entregó texto real
    // antes de fallar, el mensaje de error se agrega a lo que ya llegó
    // en vez de reemplazarlo — nunca se descarta una respuesta parcial
    // real por un fallo posterior (ADR-0017).
    let receivedAnyChunk = false;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // ADR-0017: pide explícitamente la capacidad de streaming —
          // sin este header, /api/chat responde JSON como siempre.
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          message: userMessage,
          image: userImage ?? undefined,
          conversationId,
        }),
      });

      if (!response.ok) {
        const errorMessage = await response
          .json()
          .then((data: SendMessageErrorResponse) => data.error)
          .catch(() => undefined);

        throw new ChatRequestError(
          errorMessage ??
            "No se pudo procesar el mensaje. Intenta de nuevo en unos segundos.",
        );
      }

      if (!response.body) {
        throw new ChatRequestError(
          "No se pudo procesar el mensaje. Intenta de nuevo en unos segundos.",
        );
      }

      const reader = response.body.getReader();
      // `stream: true` evita partir un carácter UTF-8 multibyte (á, ñ,
      // é...) a la mitad si el límite de un chunk cae justo en medio.
      const decoder = new TextDecoder();
      // Los eventos SSE no siempre llegan alineados con los límites de
      // cada `read()` — se acumulan aquí hasta tener al menos un "\n\n"
      // completo antes de parsear.
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const raw = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);

          const parsed = parseSSEMessage(raw);
          if (parsed?.event === "meta") {
            const meta = parsed.data as { conversationId?: string };
            if (meta.conversationId) {
              setConversationId(meta.conversationId);
            }
          } else if (parsed?.event === "chunk") {
            const chunkText = parsed.data as string;

            if (!receivedAnyChunk) {
              receivedAnyChunk = true;
              setIsThinking(false);
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: chunkText },
              ]);
            } else {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                next[next.length - 1] = {
                  ...last,
                  content: last.content + chunkText,
                };
                return next;
              });
            }
          } else if (parsed?.event === "image") {
            // Llega DESPUÉS de todo el texto (ver docblock de `imageReady`,
            // `send-message.ts`) -- siempre se adjunta al último mensaje de
            // LUZ ya en curso, nunca crea uno nuevo por su cuenta.
            const { imageData } = parsed.data as { imageData: string };
            setIsThinking(false);
            setMessages((prev) => {
              if (prev.length === 0 || prev[prev.length - 1].role !== "assistant") {
                return [...prev, { role: "assistant", content: "", imageData }];
              }
              const next = [...prev];
              const last = next[next.length - 1];
              next[next.length - 1] = { ...last, imageData };
              return next;
            });
          }

          boundary = buffer.indexOf("\n\n");
        }
      }
    } catch (error) {
      console.error(error);

      const fallback =
        error instanceof ChatRequestError
          ? error.message
          : "Algo no salió bien de mi lado. ¿Lo intentamos de nuevo?";

      if (receivedAnyChunk) {
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = {
            ...last,
            content: `${last.content}\n\n${fallback}`,
          };
          return next;
        });
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: fallback },
        ]);
      }
    } finally {
      setIsSending(false);
      setIsThinking(false);
    }
  }

  // Extraído a una variable (mismo patrón que `pageContent` en
  // `app/dashboard/page.tsx`) para poder envolverlo condicionalmente
  // abajo -- `showOpeningRitual` decide si aparece dentro de
  // `ConversationOpeningRitual` o directo, sin duplicar este árbol.
  const pageContent = (
    <>
      {/*
          Header — el wordmark "LUZ" ahora vive en el AppShell (Sprint 1);
          este header solo aporta lo específico de /chat: retomar/empezar de
          nuevo, y (Auditoría de Experiencia V1, hallazgo H3) un camino de
          vuelta al historial. Antes, "Historial" solo existía condicionado
          a `isHistoricalConversation` -- una visita normal a /chat no tenía
          NINGÚN enlace hacia `/conversations` en ningún lado de la pantalla,
          y el nav global (`app-shell.tsx`) tampoco lo tiene. Siempre visible
          ahora, nunca solo en el caso histórico -- es la única prueba de que
          "lo anterior sigue intacto" es real y no solo una promesa en un
          comentario de código.
        */}
        {!isLoadingHistory && (
          <header className="flex-shrink-0 border-b border-zinc-800 px-8 py-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {historicalLabel && (
                  <p className="text-sm text-zinc-500">{historicalLabel}</p>
                )}
              </div>

              <div className="flex flex-shrink-0 items-center gap-3">
                {isHistoricalConversation && (
                  <button
                    onClick={startNewConversation}
                    className="rounded-full border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
                  >
                    Nueva conversación
                  </button>
                )}

                <Link
                  href="/conversations"
                  className="rounded-full px-3 py-1.5 text-sm text-zinc-500 transition hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
                >
                  Historial
                </Link>
              </div>
            </div>
          </header>
        )}

        {/* Conversación */}
        <div className="relative min-h-0 flex-1">
          <section
            ref={scrollContainerRef}
            onScroll={handleScroll}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Conversación con LUZ"
            tabIndex={0}
            className="h-full overflow-y-auto px-6 py-8 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-zinc-700"
          >
            <div className="mx-auto w-full max-w-3xl">
              {isLoadingHistory ? (
                // Misma geometría que las burbujas reales (rounded-2xl,
                // max-w-[80%]) para que no haya salto de layout al llegar
                // el historial de verdad.
                <div className="space-y-4">
                  <Skeleton className="ml-auto h-11 w-40" />
                  <Skeleton className="mr-auto h-16 w-64" />
                  <Skeleton className="ml-auto h-11 w-52" />
                </div>
              ) : messages.length === 0 ? (
                <div className="animate-fade-in mt-32 text-center">
                  <p className="text-2xl leading-relaxed font-light text-white sm:text-3xl">
                    {welcomeGreeting ?? "Aquí estoy."}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={
                        msg.role === "user"
                          ? "ml-auto flex w-fit max-w-[80%] flex-col items-end"
                          : "mr-auto flex w-fit max-w-[80%] flex-col items-start"
                      }
                    >
                      <div
                        className={
                          msg.role === "user"
                            ? "animate-fade-in w-fit overflow-hidden rounded-2xl bg-white text-black"
                            : "animate-fade-in w-fit overflow-hidden rounded-2xl bg-zinc-800 text-white"
                        }
                      >
                        {msg.imageData && (
                          // eslint-disable-next-line @next/next/no-img-element -- data URI, `next/image` no optimiza esto y exige dimensiones fijas que no tenemos.
                          <img
                            src={msg.imageData}
                            alt="Imagen adjunta"
                            className="max-h-80 w-full object-cover"
                          />
                        )}
                        {msg.content && <div className="px-5 py-3 whitespace-pre-wrap">{msg.content}</div>}
                      </div>
                      <CopyMessageButton content={msg.content} align={msg.role === "user" ? "right" : "left"} />
                    </div>
                  ))}

                  {isThinking && <TypingIndicator />}

                  <div ref={bottomRef} />
                </div>
              )}
            </div>
          </section>

          {showScrollToBottom && (
            <button
              onClick={scrollToBottom}
              aria-label="Ir al final de la conversación"
              className="animate-fade-in absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 shadow-lg transition hover:border-zinc-500 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
            >
              ↓ Ir al final
            </button>
          )}
        </div>

        {/* Input */}
        <footer className="flex-shrink-0 border-t border-zinc-800 px-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-6">
          {micError && (
            <p className="mx-auto mb-2 max-w-4xl text-xs text-red-400">{micError}</p>
          )}
          {imageError && (
            <p className="mx-auto mb-2 max-w-4xl text-xs text-red-400">{imageError}</p>
          )}

          {pendingImage && (
            <div className="mx-auto mb-2 max-w-4xl">
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URI local, mismo criterio que la burbuja de mensaje. */}
                <img src={pendingImage} alt="Vista previa" className="h-20 w-20 rounded-lg object-cover ring-1 ring-zinc-700" />
                <button
                  type="button"
                  onClick={() => setPendingImage(null)}
                  aria-label="Quitar imagen"
                  className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-white ring-1 ring-zinc-700 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <div className="mx-auto flex max-w-4xl items-end gap-2 sm:gap-3">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={isSending || isProcessingImage}
              aria-label="Adjuntar imagen"
              className="flex-shrink-0 rounded-xl bg-zinc-900 px-3 py-3 text-zinc-300 ring-1 ring-zinc-800 transition hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz disabled:opacity-50 sm:px-4 sm:py-4"
            >
              {isProcessingImage ? (
                <span className="block h-5 w-5 animate-spin rounded-full border-2 border-zinc-500 border-t-white" />
              ) : (
                <ImageIcon className="h-5 w-5" />
              )}
            </button>

            {micSupported && (
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isSending || isTranscribing}
                aria-label={isRecording ? "Detener grabación" : "Grabar nota de voz"}
                aria-pressed={isRecording}
                className={
                  isRecording
                    ? "flex-shrink-0 animate-pulse-soft rounded-xl bg-red-600 px-3 py-3 text-white transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz disabled:opacity-50 sm:px-4 sm:py-4"
                    : "flex-shrink-0 rounded-xl bg-zinc-900 px-3 py-3 text-zinc-300 ring-1 ring-zinc-800 transition hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz disabled:opacity-50 sm:px-4 sm:py-4"
                }
              >
                {isTranscribing ? (
                  <span className="block h-5 w-5 animate-spin rounded-full border-2 border-zinc-500 border-t-white" />
                ) : (
                  <MicIcon className="h-5 w-5" />
                )}
              </button>
            )}

            <textarea
              ref={inputRef}
              rows={1}
              autoFocus
              placeholder="Escribe un mensaje..."
              aria-label="Escribe un mensaje para LUZ"
              value={message}
              disabled={isSending}
              onChange={(e) => {
                setMessage(e.target.value);
                setLastActivityAt(new Date());
              }}
              onKeyDown={(e) => {
                // Enter solo (sin Shift/Cmd/Ctrl) inserta un salto de línea --
                // comportamiento nativo de un textarea, no se intercepta. Cmd/Ctrl+Enter
                // envía como atajo, mismo criterio que Slack/Discord -- nunca Enter solo,
                // a propósito: LUZ es un espacio para escribir en voz alta, un mensaje de
                // varias líneas no debe partirse en varios envíos por accidente.
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              className="min-w-0 flex-1 resize-none rounded-xl bg-zinc-900 px-3 py-3 outline-none ring-1 ring-zinc-800 focus:ring-white focus-visible:ring-luz disabled:opacity-50 sm:px-5 sm:py-4"
              style={{ maxHeight: MESSAGE_INPUT_MAX_HEIGHT_PX }}
            />

            <button
              onClick={sendMessage}
              disabled={isSending}
              aria-label="Enviar mensaje"
              aria-busy={isSending}
              className="flex-shrink-0 rounded-xl bg-white px-4 text-black transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz disabled:opacity-50 disabled:hover:bg-white sm:px-6"
            >
              {isSending ? "..." : "Enviar"}
            </button>
          </div>
        </footer>
    </>
  );

  return (
    <main className="h-full bg-black text-white">
      {/*
        Beta-critical polish (feedback directo de Juan, 2026-08-03): "el
        avatar en conversación debe ser de mínimo 3cm... que tenga vida y
        se desplace por la pantalla". Vive fuera de `ConversationOpeningRitual`
        a propósito -- ese componente anima su contenido con transforms
        propios mientras se asienta, y un hijo `position: fixed` dentro de
        un ancestro con `transform` activo deja de posicionarse contra el
        viewport (se vuelve relativo a ese ancestro en su lugar) -- exactamente
        el tipo de bug de layout que no se puede verificar visualmente sin
        una cuenta real. Como hermano directo aquí, el flotante siempre es
        relativo a la pantalla completa, sin ambigüedad.
      */}
      {!isLoadingHistory && (
        <FloatingAvatar
          mood={NEUTRAL_AVATAR_MOOD}
          isAiResponding={isThinking}
          isUserTyping={message.trim() !== ""}
          lastActivityAt={lastActivityAt}
        />
      )}
      {/*
        Rendimiento (mismo mandato que ya corrigió Dashboard): el ritual
        completo (~1.9s) solo se justifica la primera vez que esta
        persona habla con LUZ alguna vez, nunca en cada visita --
        `showOpeningRitual` (arriba) ya lo decidió antes del primer
        pintado. Sin el ritual, el mismo `contentClassName` por defecto
        que `ConversationOpeningRitual` ya usaba (`flex h-full flex-col`)
        para que el layout no salte entre un camino y el otro.
      */}
      {showOpeningRitual ? (
        <ConversationOpeningRitual ready={!isLoadingHistory} cue={welcomeCue} orb={orbSignature}>
          {pageContent}
        </ConversationOpeningRitual>
      ) : (
        <div className="flex h-full flex-col">{pageContent}</div>
      )}
    </main>
  );
}
