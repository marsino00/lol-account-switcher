import { useCallback, useEffect, useState } from "react";

export type Lang = "es" | "en";

const STORAGE_KEY = "lol-switcher.lang";

const translations = {
  en: {
    appTitle: "LoL Account Switcher",
    killAll: "Kill all",
    killAllTitle: "Close Riot Client and League",
    settingsTitle: "Settings",
    addAccount: "+ Add account",
    inGame: "ACTIVE",

    // Settings panel
    riotClient: "Riot Client:",
    notConfigured: "Not configured",
    change: "Change",
    referenceProfile: "Reference profile:",
    none: "None",
    language: "Language:",

    // Empty state
    noProfiles: "No profiles yet",
    noProfilesHint: "Add your first account to get started",

    // Card
    play: "▶  PLAY",
    launching: "Launching...",
    refBadgeTitle: "Reference profile",
    useAsReference: "Use as reference",
    deleteTitle: "Delete",
    renameTitle: "Rename",

    // Setup screen
    setupSubtitle: "Select the Riot Client folder to get started",
    setupHint: "Usually at C:\\Riot Games\\Riot Client",
    autoDetect: "Auto-detect",
    selectManually: "Select manually",
    selectFolderTitle: "Select the Riot Client folder",

    // Adding screen
    back: "← Back",
    addAccountTitle: "Add account",
    profileName: "Profile name",
    profileNamePlaceholder: "e.g. main, smurf, tryhard...",
    openRiotClient: "Open Riot Client",
    openRiotDesc1:
      "It will open with a clean session. Log in with your account and check",
    staySignedIn: ' "Stay signed in"',
    openRiotBtn:
      "Open Riot Client and click Play and open League of Legends client",
    saveProfile: "Save profile",
    saveProfileDesc:
      "Close the League client (don't log out, just close the window). Then close the Riot Client and make sure it's not running in the system tray.",

    // Modal
    deleteProfileQ: "Delete profile",
    cancel: "Cancel",
    delete: "Delete",
    renameProfileTitle: "Rename profile",
    newName: "New name",
    rename: "Rename",

    // Toasts
    pathSaved: "Path saved",
    detected: (p: string) => `Detected: ${p}`,
    riotDetectedAt: (p: string) => `Riot Client detected at ${p}`,
    notFound: "Not found.  Select it manually.",
    launched: (n: string) => `Launched: ${n}`,
    closed: "Closed",
    deleted: (n: string) => `Deleted: ${n}`,
    renamed: (o: string, n: string) => `Renamed: ${o} → ${n}`,
    referenceSet: (n: string) => `Reference profile: ${n}`,
    riotOpened: "Riot Client opened. Log in with 'Stay signed in'.",
    profileSaved: (n: string) => `Profile '${n}' saved`,
    error: (e: unknown) => `Error: ${e}`,
  },
  es: {
    appTitle: "LoL Account Switcher",
    killAll: "Cerrar todo",
    killAllTitle: "Cerrar Riot Client y League",
    settingsTitle: "Ajustes",
    addAccount: "+ Añadir cuenta",
    inGame: "ACTIVO",

    // Settings panel
    riotClient: "Riot Client:",
    notConfigured: "No configurado",
    change: "Cambiar",
    referenceProfile: "Perfil de referencia:",
    none: "Ninguno",
    language: "Idioma:",

    // Empty state
    noProfiles: "No hay perfiles",
    noProfilesHint: "Añade tu primera cuenta para empezar",

    // Card
    play: "▶  JUGAR",
    launching: "Iniciando...",
    refBadgeTitle: "Perfil de referencia",
    useAsReference: "Usar como referencia",
    deleteTitle: "Eliminar",
    renameTitle: "Renombrar",

    // Setup screen
    setupSubtitle: "Selecciona la carpeta del Riot Client para empezar",
    setupHint: "Normalmente en C:\\Riot Games\\Riot Client",
    autoDetect: "Detectar automáticamente",
    selectManually: "Seleccionar manualmente",
    selectFolderTitle: "Selecciona la carpeta del Riot Client",

    // Adding screen
    back: "← Atrás",
    addAccountTitle: "Añadir cuenta",
    profileName: "Nombre del perfil",
    profileNamePlaceholder: "p. ej. main, smurf, tryhard...",
    openRiotClient: "Abrir Riot Client",
    openRiotDesc1:
      "Se abrirá con una sesión limpia. Inicia sesión con tu cuenta y marca",
    staySignedIn: ' "Mantener sesión iniciada"',
    openRiotBtn:
      "Abrir Riot Client, pulsar Jugar y abrir el cliente de League of Legends",
    saveProfile: "Guardar perfil",
    saveProfileDesc:
      "Cierra el cliente de League (no cierres sesión, solo la ventana). Luego cierra el Riot Client y asegúrate de que no siga en la bandeja del sistema.",

    // Modal
    deleteProfileQ: "¿Eliminar el perfil",
    cancel: "Cancelar",
    delete: "Eliminar",
    renameProfileTitle: "Renombrar perfil",
    newName: "Nuevo nombre",
    rename: "Renombrar",

    // Toasts
    pathSaved: "Ruta guardada",
    detected: (p: string) => `Detectado: ${p}`,
    riotDetectedAt: (p: string) => `Riot Client detectado en ${p}`,
    notFound: "No encontrado.  Selecciónalo manualmente.",
    launched: (n: string) => `Iniciado: ${n}`,
    closed: "Cerrado",
    deleted: (n: string) => `Eliminado: ${n}`,
    renamed: (o: string, n: string) => `Renombrado: ${o} → ${n}`,
    referenceSet: (n: string) => `Perfil de referencia: ${n}`,
    riotOpened:
      "Riot Client abierto. Inicia sesión con 'Mantener sesión iniciada'.",
    profileSaved: (n: string) => `Perfil '${n}' guardado`,
    error: (e: unknown) => `Error: ${e}`,
  },
} as const;

export type Dictionary = typeof translations.en;

function detectInitialLang(): Lang {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "es" || stored === "en") return stored;
  return "en";
}

export function useI18n() {
  const [lang, setLangState] = useState<Lang>(detectInitialLang);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggleLang = useCallback(
    () => setLangState((l) => (l === "es" ? "en" : "es")),
    [],
  );

  return { lang, setLang, toggleLang, t: translations[lang] };
}
