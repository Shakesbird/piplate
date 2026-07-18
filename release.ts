export const CURRENT_RELEASE = {
  id: '2026-07-18-today-first-planner',
  version: '1.2.3',
  en: {
    eyebrow: 'New PiPlate patch',
    title: 'Today comes first',
    summary: 'This message appears once for each installed patch. You can reopen it from Settings.',
    notes: [
      'The planner now starts with today automatically, so the current day is always at the top.',
    ],
  },
  de: {
    eyebrow: 'Neuer PiPlate-Patch',
    title: 'Heute steht an erster Stelle',
    summary: 'Dieser Hinweis erscheint einmal pro installiertem Patch. In den Einstellungen kannst du ihn erneut öffnen.',
    notes: [
      'Der Wochenplan beginnt jetzt automatisch mit dem heutigen Tag.',
    ],
  },
} as const;
