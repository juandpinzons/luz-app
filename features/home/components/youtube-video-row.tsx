import type { YoutubeVideo } from "@/features/reality/domain";

/** Compartido entre `/youtube` y la sección de YouTube de `/dashboard` -- mismo criterio que `email-row.tsx`. */

export function YoutubeVideoRow({ video }: { video: YoutubeVideo }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-zinc-800 px-4 py-3 text-sm">
      {video.thumbnailUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- thumbnail remoto de YouTube, sin dominio propio que optimizar con next/image.
        <img src={video.thumbnailUrl} alt="" className="h-12 w-20 flex-shrink-0 rounded object-cover" />
      )}
      <div className="min-w-0 flex-1">
        <a
          href={video.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-zinc-100 hover:underline"
        >
          {video.title}
        </a>
        <p className="mt-0.5 truncate text-xs text-zinc-500">{video.channelTitle}</p>
      </div>
    </li>
  );
}
