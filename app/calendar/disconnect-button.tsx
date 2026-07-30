"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Único fragmento cliente de `/calendar` -- el resto de la pantalla es un server component puro, esto necesita `onClick` + `fetch`. */
export function DisconnectButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleClick() {
    setIsSubmitting(true);
    try {
      await fetch("/api/calendar/disconnect", { method: "POST" });
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isSubmitting}
      className="text-sm text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
    >
      {isSubmitting ? "Desconectando..." : "Desconectar"}
    </button>
  );
}
