import { createExternalVideoId, type YoutubeVideo } from "../../domain";
import type { YoutubeApiVideo } from "./youtube-client";

/**
 * Toda traducción entre las formas crudas de YouTube API y el dominio
 * vive exclusivamente aquí -- funciones puras, sin I/O. Mismo reparto
 * de responsabilidad que `gmail-mapper.ts`.
 */

function thumbnailUrl(snippet: YoutubeApiVideo["snippet"]): string | undefined {
  return snippet?.thumbnails?.high?.url ?? snippet?.thumbnails?.medium?.url ?? snippet?.thumbnails?.default?.url;
}

/**
 * `YoutubeApiVideo` -> `YoutubeVideo`. `null` si falta algo que el
 * dominio exige y que ningún valor por defecto razonable puede
 * reemplazar (`title`, `channelId`/`channelTitle`, o `publishedAt`) --
 * se descarta en vez de inventar un valor, mismo criterio que
 * `mapGmailMessageToDomain`.
 */
export function mapYoutubeVideoToDomain(video: YoutubeApiVideo): YoutubeVideo | null {
  const snippet = video.snippet;
  if (!snippet?.title || !snippet.channelId || !snippet.channelTitle || !snippet.publishedAt) {
    return null;
  }

  const publishedAt = new Date(snippet.publishedAt);
  if (Number.isNaN(publishedAt.getTime())) {
    return null;
  }

  return {
    id: createExternalVideoId(video.id),
    title: snippet.title,
    channelId: snippet.channelId,
    channelTitle: snippet.channelTitle,
    publishedAt,
    thumbnailUrl: thumbnailUrl(snippet),
    url: `https://www.youtube.com/watch?v=${video.id}`,
  };
}

/**
 * Un lote de videos crudos -> dominio, aislado por registro -- un video
 * individual malformado no aborta el resto del lote, mismo principio
 * que `mapGmailMessagesToDomain`.
 */
export function mapYoutubeVideosToDomain(videos: readonly YoutubeApiVideo[]): YoutubeVideo[] {
  const mapped: YoutubeVideo[] = [];

  for (const video of videos) {
    try {
      const domainVideo = mapYoutubeVideoToDomain(video);
      if (domainVideo) {
        mapped.push(domainVideo);
      }
    } catch (error) {
      console.error(`youtube-mapper: se descartó el video "${video.id}" por un error inesperado al mapearlo.`, error);
    }
  }

  return mapped;
}
