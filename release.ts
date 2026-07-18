export const CURRENT_RELEASE = {
  id: '2026-07-18-scrollable-release-notes',
  version: '1.2.1',
  en: {
    eyebrow: 'New PiPlate patch',
    title: 'Your kitchen, safely updated',
    summary: 'This message appears once for each installed patch. You can reopen it from Settings.',
    notes: [
      'The changelog now starts at the top and scrolls correctly on the Galaxy S24 and other phones.',
      'App updates no longer modify existing recipe titles, pictures, ingredients, or instructions.',
      'The initial recipe collection is added only on the very first launch and never restored after you delete it.',
      'The confirmation button stays reachable while you read longer patch notes.',
    ],
  },
  de: {
    eyebrow: 'Neuer PiPlate-Patch',
    title: 'Sicher aktualisiert',
    summary: 'Dieser Hinweis erscheint einmal pro installiertem Patch. In den Einstellungen kannst du ihn erneut öffnen.',
    notes: [
      'Die Änderungsübersicht beginnt jetzt oben und lässt sich auf dem Galaxy S24 und anderen Handys vollständig scrollen.',
      'App-Updates verändern keine vorhandenen Rezepttitel, Bilder, Zutaten oder Zubereitungsschritte mehr.',
      'Die mitgelieferten Startrezepte werden nur beim allerersten Start angelegt und nach dem Löschen nicht wiederhergestellt.',
      'Der Bestätigen-Button bleibt beim Lesen längerer Patch-Hinweise immer erreichbar.',
    ],
  },
} as const;
