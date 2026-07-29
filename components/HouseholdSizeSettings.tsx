import React from 'react';
import { Minus, Plus, Users } from 'lucide-react';
import { useLanguage } from '../i18n';

interface HouseholdSizeSettingsProps {
  householdSize: number;
  onChange: (size: number) => void;
}

const HouseholdSizeSettings: React.FC<HouseholdSizeSettingsProps> = ({ householdSize, onChange }) => {
  const { t } = useLanguage();
  const setSize = (size: number) => onChange(Math.min(20, Math.max(1, Math.round(size) || 1)));

  return (
    <section
      data-testid="household-size-settings"
      className="mt-4 rounded-[2rem] border border-[#DED8CD] bg-white/80 p-5 shadow-[0_18px_60px_rgba(47,43,37,0.06)] sm:p-6"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#E2E8D7] text-[#526647]">
            <Users size={23} />
          </span>
          <div>
            <h2 className="font-display text-2xl">{t('householdSize')}</h2>
            <p className="mt-1 max-w-lg text-sm text-[#756E64]">{t('householdSizeDescription')}</p>
          </div>
        </div>

        <div
          className="flex shrink-0 items-center justify-between gap-2 rounded-full bg-[#EEE8DD] p-1"
          role="group"
          aria-label={t('householdSize')}
        >
          <button
            type="button"
            onClick={() => setSize(householdSize - 1)}
            disabled={householdSize <= 1}
            className="grid h-11 w-11 place-items-center rounded-full text-[#5F584F] active:bg-white disabled:opacity-35"
            aria-label={t('decreaseHouseholdSize')}
          >
            <Minus size={18} />
          </button>
          <label>
            <span className="sr-only">{t('householdSize')}</span>
            <input
              data-testid="household-size-input"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={householdSize}
              onChange={event => setSize(Number(event.target.value))}
              className="h-11 w-16 rounded-full border-0 bg-white text-center text-lg font-bold text-[#2D2A26] outline-none focus:ring-4 focus:ring-[#D95D39]/15"
              aria-label={t('householdSize')}
            />
          </label>
          <button
            type="button"
            onClick={() => setSize(householdSize + 1)}
            disabled={householdSize >= 20}
            className="grid h-11 w-11 place-items-center rounded-full text-[#5F584F] active:bg-white disabled:opacity-35"
            aria-label={t('increaseHouseholdSize')}
          >
            <Plus size={18} />
          </button>
        </div>
      </div>
      <p className="mt-4 rounded-2xl bg-[#F7F3EB] px-4 py-3 text-sm text-[#5F584F]">
        {t('householdSizeExample', { count: householdSize })}
      </p>
    </section>
  );
};

export default HouseholdSizeSettings;
