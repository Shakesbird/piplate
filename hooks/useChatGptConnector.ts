import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';

const SETTINGS_KEY = 'chatGptHandoffEnabled';

export const useChatGptConnector = () => {
  const setting = useLiveQuery(() => db.settings.get(SETTINGS_KEY));
  const enabled = setting?.value !== false;

  const setEnabled = async (nextEnabled: boolean) => {
    await db.settings.put({ key: SETTINGS_KEY, value: nextEnabled });
  };

  return { enabled, setEnabled };
};
