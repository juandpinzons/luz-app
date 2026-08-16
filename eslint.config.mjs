import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Permite prefijar con "_" los parámetros de stubs de interfaz
      // (ej. core/knowledge/pipeline/*) que aún no tienen implementación.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // core/ nunca depende de features/ (regla repetida en docblocks por
    // todo core/, nunca antes exigida por herramienta alguna -- 3
    // misiones distintas (Calendar/Gmail/Wearable, 2026-07-30..08-14)
    // la violaron de forma independiente, encontrado por un auditor
    // externo, corregido 2026-08-16. Esta regla existe para que la
    // siguiente violación falle en `npm run lint`, no dependa de que
    // alguien la note meses después.
    files: ["core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/features/**", "@/features/**"],
              message:
                "core/ no puede importar de features/ -- la dependencia va al revés (features/ puede depender de core/, nunca lo contrario). Si core/ necesita un tipo que hoy vive en features/, muévelo a core/ (ver commits 060d40b/ded736f/b6d5ecf para el patrón: domain/ + shim de re-export).",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Artefacto de verificación de build, no forma parte del código fuente.
    "tmp/**",
  ]),
]);

export default eslintConfig;
