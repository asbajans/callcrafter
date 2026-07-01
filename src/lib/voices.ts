export interface Voice {
  id: string;
  name: string;
  language: string;
  gender?: string;
  builtIn: boolean;
  modelFile?: string;
  provider?: string;
}

export const DEFAULT_VOICES: Voice[] = [
  { id: 'en_US-lessac-medium', name: 'English (US) - Lessac', language: 'EN', gender: 'Female', builtIn: true, provider: 'piper' },
  { id: 'en_US-amy-medium', name: 'English (US) - Amy', language: 'EN', gender: 'Female', builtIn: true, provider: 'piper' },
  { id: 'en_US-ryan-medium', name: 'English (US) - Ryan', language: 'EN', gender: 'Male', builtIn: true, provider: 'piper' },
  { id: 'en_US-kathleen-medium', name: 'English (US) - Kathleen', language: 'EN', gender: 'Female', builtIn: true, provider: 'piper' },
  { id: 'en_GB-alan-medium', name: 'English (UK) - Alan', language: 'EN', gender: 'Male', builtIn: true, provider: 'piper' },
  { id: 'en_GB-semaine-medium', name: 'English (UK) - Semaine', language: 'EN', gender: 'Female', builtIn: true, provider: 'piper' },
  { id: 'tr_TR-dfki-medium', name: 'Türkçe - DFKI', language: 'TR', gender: 'Female', builtIn: true, provider: 'piper' },
  { id: 'tr_TR-ismail-medium', name: 'Türkçe - Ismail', language: 'TR', gender: 'Male', builtIn: false, provider: 'piper' },
  { id: 'de_DE-eva-medium', name: 'Deutsch - Eva', language: 'DE', gender: 'Female', builtIn: true, provider: 'piper' },
  { id: 'de_DE-karl-medium', name: 'Deutsch - Karl', language: 'DE', gender: 'Male', builtIn: true, provider: 'piper' },
  { id: 'fr_FR-siwis-medium', name: 'Français - Siwis', language: 'FR', gender: 'Female', builtIn: true, provider: 'piper' },
  { id: 'es_ES-davefx-medium', name: 'Español - Davefx', language: 'ES', gender: 'Male', builtIn: true, provider: 'piper' },
];

export const EDGE_TTS_VOICES: Voice[] = [
  { id: 'tr-TR-EmelNeural', name: 'Türkçe - Emel (Kadın)', language: 'TR', gender: 'Female', builtIn: true, provider: 'edge-tts' },
  { id: 'tr-TR-AhmetNeural', name: 'Türkçe - Ahmet (Erkek)', language: 'TR', gender: 'Male', builtIn: true, provider: 'edge-tts' },
  { id: 'en-US-JennyNeural', name: 'English (US) - Jenny', language: 'EN', gender: 'Female', builtIn: true, provider: 'edge-tts' },
  { id: 'en-US-GuyNeural', name: 'English (US) - Guy', language: 'EN', gender: 'Male', builtIn: true, provider: 'edge-tts' },
  { id: 'en-US-AriaNeural', name: 'English (US) - Aria', language: 'EN', gender: 'Female', builtIn: true, provider: 'edge-tts' },
  { id: 'en-US-DavisNeural', name: 'English (US) - Davis', language: 'EN', gender: 'Male', builtIn: true, provider: 'edge-tts' },
  { id: 'en-GB-SoniaNeural', name: 'English (UK) - Sonia', language: 'EN', gender: 'Female', builtIn: true, provider: 'edge-tts' },
  { id: 'en-GB-RyanNeural', name: 'English (UK) - Ryan', language: 'EN', gender: 'Male', builtIn: true, provider: 'edge-tts' },
  { id: 'de-DE-KatjaNeural', name: 'Deutsch - Katja', language: 'DE', gender: 'Female', builtIn: true, provider: 'edge-tts' },
  { id: 'de-DE-ConradNeural', name: 'Deutsch - Conrad', language: 'DE', gender: 'Male', builtIn: true, provider: 'edge-tts' },
  { id: 'fr-FR-DeniseNeural', name: 'Français - Denise', language: 'FR', gender: 'Female', builtIn: true, provider: 'edge-tts' },
  { id: 'fr-FR-HenriNeural', name: 'Français - Henri', language: 'FR', gender: 'Male', builtIn: true, provider: 'edge-tts' },
  { id: 'es-ES-ElviraNeural', name: 'Español - Elvira', language: 'ES', gender: 'Female', builtIn: true, provider: 'edge-tts' },
  { id: 'es-ES-AlvaroNeural', name: 'Español - Alvaro', language: 'ES', gender: 'Male', builtIn: true, provider: 'edge-tts' },
];

export function getVoicesByLanguage(lang: string): Voice[] {
  return DEFAULT_VOICES.filter(v => v.language === lang);
}

export function getVoiceById(id: string): Voice | undefined {
  return DEFAULT_VOICES.find(v => v.id === id) || EDGE_TTS_VOICES.find(v => v.id === id);
}

export function getEdgeTTSVoicesByLanguage(lang: string): Voice[] {
  return EDGE_TTS_VOICES.filter(v => v.language === lang);
}
