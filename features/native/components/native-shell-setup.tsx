"use client";

import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { useEffect } from "react";

/**
 * Sin UI propia -- un solo efecto de montaje, montado una vez en
 * `app/layout.tsx` (corre en TODA la app, autenticada o no). Sincroniza
 * la barra de estado nativa con `themeColor: "#000000"` (ya seteado en
 * `app/layout.tsx` para el navegador -- esto es el equivalente nativo
 * de lo mismo, nunca un color nuevo inventado aparte).
 */
export function NativeShellSetup() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    StatusBar.setBackgroundColor({ color: "#000000" }).catch(() => {});
  }, []);

  return null;
}
