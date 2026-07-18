export const CURRENT_RELEASE = {
  id: '2026-07-18-remove-unfinished-ai',
  version: '1.2.2',
  en: {
    eyebrow: 'New PiPlate patch',
    title: 'A cleaner recipe editor',
    summary: 'This message appears once for each installed patch. You can reopen it from Settings.',
    notes: [
      'The unfinished picture generator and AI recipe-fill controls have been removed for now.',
    ],
  },
  de: {
    eyebrow: 'Neuer PiPlate-Patch',
    title: 'Ein aufgeräumter Rezepteditor',
    summary: 'Dieser Hinweis erscheint einmal pro installiertem Patch. In den Einstellungen kannst du ihn erneut öffnen.',
    notes: [
      'Der unfertige Bildgenerator und die KI-Rezeptbefüllung wurden vorerst entfernt.',
    ],
  },
} as const;
