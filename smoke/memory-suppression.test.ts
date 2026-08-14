import { db } from "../core/db/client";
import {
  DrizzleMemoryRepository,
  StructuredMemoryRetrievalStrategy,
  type Memory,
} from "../core/memory-engine";
import { createEntityId } from "../core/life/value-objects/entity-id";
import { searchMemories } from "../features/memories/services/search-memories";
import { smokeFetch } from "./utils/http";
import type { SmokeContext, SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const CONTROL_CONTENT = "Memoria de smoke test CONTROL -- debe seguir siendo visible siempre";
const SUPPRESSED_CONTENT = "Memoria de smoke test SUPRIMIDA -- nunca debe salir en retrieval ni UI";

function newMemory(content: string, suppressed: boolean, lifeGraphId: Memory["lifeGraphId"]): Memory {
  const now = new Date();
  return {
    id: createEntityId(crypto.randomUUID()),
    lifeGraphId,
    type: "fact",
    content,
    source: "manual",
    status: "active",
    suppressed,
    occurredAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Verifica la bandera `suppressed` (2026-08-13, demo Colombia Tech Week
 * -- protección de contenido sensible en la cuenta real del Founder,
 * sin sesgar el resto de las respuestas). Cubre las tres lecturas
 * `content`-facing más expuestas en una demo en vivo: retrieval de
 * chat (`StructuredMemoryRetrievalStrategy`), `/memories` vía HTTP real
 * (no solo la función), y `DrizzleMemoryRepository.listActive` (de la
 * que depende `assemble-reality-snapshot.ts`). Un control no-suprimido
 * corre en paralelo para probar que el filtro no es sobre-amplio.
 */
export const memorySuppressionFlow: SmokeFlow = {
  name: "memory-suppression",
  async run(ctx: SmokeContext) {
    const repository = new DrizzleMemoryRepository(db);
    const control = newMemory(CONTROL_CONTENT, false, ctx.lifeGraphContext.lifeGraphId);
    const suppressed = newMemory(SUPPRESSED_CONTENT, true, ctx.lifeGraphContext.lifeGraphId);
    await repository.save(ctx.lifeGraphContext, control);
    await repository.save(ctx.lifeGraphContext, suppressed);

    const retrieved = await new StructuredMemoryRetrievalStrategy(db).retrieve(
      ctx.lifeGraphContext,
      { limit: 100 },
    );
    const retrievedContents = retrieved.map((m) => m.content);
    assert(
      retrievedContents.includes(CONTROL_CONTENT),
      "StructuredMemoryRetrievalStrategy no devolvió el control -- el filtro quedó sobre-amplio",
    );
    assert(
      !retrievedContents.includes(SUPPRESSED_CONTENT),
      "StructuredMemoryRetrievalStrategy devolvió una memoria suprimida -- fuga en el camino de retrieval de chat",
    );

    const active = await repository.listActive(ctx.lifeGraphContext);
    const activeContents = active.map((m) => m.content);
    assert(
      activeContents.includes(CONTROL_CONTENT),
      "listActive no devolvió el control -- el filtro quedó sobre-amplio",
    );
    assert(
      !activeContents.includes(SUPPRESSED_CONTENT),
      "listActive devolvió una memoria suprimida -- fuga hacia assemble-reality-snapshot.ts",
    );

    const searched = await searchMemories(db, ctx.lifeGraphContext, {});
    const searchedContents = searched.map((m) => m.content);
    assert(
      searchedContents.includes(CONTROL_CONTENT),
      "searchMemories no devolvió el control -- el filtro quedó sobre-amplio",
    );
    assert(
      !searchedContents.includes(SUPPRESSED_CONTENT),
      "searchMemories devolvió una memoria suprimida -- fuga hacia /memories",
    );

    // `?view=all` -- el landing por defecto de `/memories` es Highlights
    // (filtrado por `rank.score`, ver `app/memories/page.tsx`), y estas
    // memorias de smoke test nacen sin rank; `view=all` es la vista
    // cronológica que sí muestra todo lo que devuelve `searchMemories`.
    const memoriesRes = await smokeFetch("/memories?view=all", ctx.sessionCookie);
    assert(
      memoriesRes.status === 200,
      `/memories devolvió ${memoriesRes.status}, se esperaba 200`,
    );
    const memoriesHtml = await memoriesRes.text();
    assert(
      memoriesHtml.includes(CONTROL_CONTENT),
      "/memories?view=all no renderiza el control -- posible falso positivo del filtro en la página real",
    );
    assert(
      !memoriesHtml.includes(SUPPRESSED_CONTENT),
      "/memories?view=all renderiza contenido suprimido -- fuga real en la UI que vería el público",
    );
  },
};
