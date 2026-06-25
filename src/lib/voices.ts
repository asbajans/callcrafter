export interface Voice {
  id: string;
  name: string;
  language: string;
  gender?: string;
  builtIn: boolean;
  modelFile?: string;
}

export const DEFAULT_VOICES: Voice[] = [
  { id: 'en_US-lessac-medium', name: 'English (US) - Lessac', language: 'EN', gender: 'Female', builtIn: true },
  { id: 'en_US-amy-medium', name: 'English (US) - Amy', language: 'EN', gender: 'Female', builtIn: true },
  { id: 'en_US-ryan-medium', name: 'English (US) - Ryan', language: 'EN', gender: 'Male', builtIn: true },
  { id: 'en_US-kathleen-medium', name: 'English (US) - Kathleen', language: 'EN', gender: 'Female', builtIn: true },
  { id: 'en_GB-alan-medium', name: 'English (UK) - Alan', language: 'EN', gender: 'Male', builtIn: true },
  { id: 'en_GB-semaine-medium', name: 'English (UK) - Semaine', language: 'EN', gender: 'Female', builtIn: true },
  { id: 'tr_TR-dfki-medium', name: 'Türkçe - DFKI', language: 'TR', gender: 'Female', builtIn: true },
  { id: 'tr_TR-ismail-medium', name: 'Türkçe - Ismail', language: 'TR', gender: 'Male', builtIn: false },
  { id: 'de_DE-eva-medium', name: 'Deutsch - Eva', language: 'DE', gender: 'Female', builtIn: true },
  { id: 'de_DE-karl-medium', name: 'Deutsch - Karl', language: 'DE', gender: 'Male', builtIn: true },
  { id: 'fr_FR-siwis-medium', name: 'Français - Siwis', language: 'FR', gender: 'Female', builtIn: true },
  { id: 'es_ES-davefx-medium', name: 'Español - Davefx', language: 'ES', gender: 'Male', builtIn: true },
];

export function getVoicesByLanguage(lang: string): Voice[] {
  return DEFAULT_VOICES.filter(v => v.language === lang);
}

export function getVoiceById(id: string): Voice | undefined {
  return DEFAULT_VOICES.find(v => v.id === id);
}
