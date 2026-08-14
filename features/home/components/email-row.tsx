import type { EmailMessage } from "@/features/reality/domain";

/** Compartido entre `/gmail` y la sección de correo de `/dashboard` -- una sola forma de mostrar un mensaje, nunca dos plantillas que puedan divergir. Mismo criterio que `event-row.tsx`. */

export function EmailRow({ message }: { message: EmailMessage }) {
  return (
    <li className="rounded-lg border border-zinc-800 px-4 py-3 text-sm">
      <div className="flex items-center justify-between gap-2">
        <p className={`truncate ${message.unread ? "font-medium text-zinc-100" : "text-zinc-300"}`}>
          {message.sender.displayName ?? message.sender.email}
        </p>
        {message.unread && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-luz" />}
      </div>
      <p className="mt-0.5 truncate text-zinc-400">{message.subject || "(sin asunto)"}</p>
      <p className="mt-0.5 truncate text-xs text-zinc-600">{message.snippet}</p>
    </li>
  );
}
