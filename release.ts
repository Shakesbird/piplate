export const CURRENT_RELEASE = {
  id: '2026-07-18-safe-updates-chatgpt',
  version: '1.2.0',
  en: {
    eyebrow: 'New PiPlate patch',
    title: 'Your kitchen, safely updated',
    summary: 'This message appears once for each installed patch. You can reopen it from Settings.',
    notes: [
      'A short changelog now appears once after every new patch.',
      'App updates no longer modify existing recipe titles, pictures, ingredients, or instructions.',
      'The initial recipe collection is added only on the very first launch and never restored after you delete it.',
      'A key-free ChatGPT Plus handoff can now create picture prompts without exposing credentials in GitHub.',
    ],
  },
  de: {
    eyebrow: 'Neuer PiPlate-Patch',
    title: 'Sicher aktualisiert',
    summary: 'Dieser Hinweis erscheint einmal pro installiertem Patch. In den Einstellungen kannst du ihn erneut öffnen.',
    notes: [
      'Nach jedem neuen Patch erscheint einmalig eine kurze Änderungsübersicht.',
      'App-Updates verändern keine vorhandenen Rezepttitel, Bilder, Zutaten oder Zubereitungsschritte mehr.',
      'Die mitgelieferten Startrezepte werden nur beim allerersten Start angelegt und nach dem Löschen nicht wiederhergestellt.',
      'Eine schlüsselfreie Übergabe an ChatGPT Plus erstellt jetzt Bild-Prompts, ohne Zugangsdaten in GitHub offenzulegen.',
    ],
  },
} as const;
