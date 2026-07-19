import React, { useState } from 'react';
import { CalendarPlus, Check, Flame, Users, X } from 'lucide-react';
import { DEFAULT_RECIPE_IMAGE, getRecipeImageSource, getTodayFirstDayOrder, Recipe } from '../types';
import { useLanguage } from '../i18n';

interface DishCardProps {
  recipe: Recipe;
  onClick: () => void;
  onAddToDay: (day: string, recipeId: string) => Promise<void>;
  prioritizeImage?: boolean;
}

const DishCard: React.FC<DishCardProps> = ({ recipe, onClick, onAddToDay, prioritizeImage = false }) => {
  const { t, dayName } = useLanguage();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [savedDay, setSavedDay] = useState<string | null>(null);
  const dayOrder = getTodayFirstDayOrder();
  const caloriesPerPortion = Math.round(recipe.nutrition.calories / Math.max(1, recipe.portions));

  const handleAddToDay = async (event: React.MouseEvent<HTMLButtonElement>, day: string) => {
    event.stopPropagation();
    await onAddToDay(day, recipe.id);
    setSavedDay(day);
    setIsPickerOpen(false);
    window.setTimeout(() => setSavedDay(current => (current === day ? null : current)), 1600);
  };

  const togglePicker = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setIsPickerOpen(current => !current);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className="recipe-card group relative min-w-0 w-full cursor-pointer rounded-[1.35rem] md:rounded-[1.75rem] overflow-hidden bg-white shadow-[0_12px_32px_rgba(47,43,37,0.10)] transition duration-300 md:hover:-translate-y-1 md:hover:shadow-[0_20px_45px_rgba(47,43,37,0.16)] focus:outline-none focus:ring-4 focus:ring-[#D95D39]/25"
      aria-label={t('openRecipe', { title: recipe.title })}
    >
      <div className="recipe-card-image relative overflow-hidden bg-[#DED8CD]">
        <img
          src={getRecipeImageSource(recipe.imageUri)}
          onError={event => { event.currentTarget.src = DEFAULT_RECIPE_IMAGE; }}
          alt=""
          className="block h-full w-full max-w-full object-cover transition duration-700 md:group-hover:scale-[1.04]"
          style={{ width: '100%', maxWidth: '100%' }}
          decoding="async"
          loading={prioritizeImage ? 'eager' : 'lazy'}
          fetchPriority={prioritizeImage ? 'high' : 'low'}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />

        <button
          onClick={togglePicker}
          className={`absolute right-2.5 top-2.5 md:right-4 md:top-4 h-11 w-11 rounded-full grid place-items-center backdrop-blur-md border border-white/30 shadow-lg transition active:scale-90 ${savedDay ? 'bg-[#A8B79A] text-[#263020]' : 'bg-white/90 text-[#2D2A26]'}`}
          aria-label={savedDay ? t('addedToDay', { day: dayName(savedDay) }) : t('addToPlanner')}
        >
          {savedDay ? <Check size={19} /> : <CalendarPlus size={19} />}
        </button>
      </div>

      <div className="recipe-card-copy text-[#2D2A26]">
        <h3 className="recipe-card-title font-display text-lg leading-[1.15] sm:text-xl md:text-2xl">{recipe.title}</h3>
        <div className="recipe-card-stats flex items-center gap-3 text-[11px] sm:text-xs text-[#756E64]">
          <span className="flex items-center gap-1"><Users size={13} /> {recipe.portions}</span>
          <span className="h-1 w-1 rounded-full bg-[#B7AFA3]" />
          <span className="flex min-w-0 items-center gap-1"><Flame size={13} className="shrink-0" /> {t('caloriesPerPortion', { count: caloriesPerPortion })}</span>
        </div>
      </div>

      {isPickerOpen && (
        <div
          className="absolute inset-2 md:inset-4 z-30 rounded-[1.1rem] md:rounded-[1.35rem] bg-[#FFFDF8]/95 backdrop-blur-xl border border-white shadow-2xl p-3 md:p-4 flex flex-col"
          onClick={event => event.stopPropagation()}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div>
              <p className="text-[9px] md:text-[10px] uppercase tracking-[0.18em] text-[#958D80]">{t('addToPlannerShort')}</p>
              <p className="text-xs md:text-sm font-semibold text-[#2D2A26] truncate">{t('chooseDay')}</p>
            </div>
            <button onClick={togglePicker} className="h-9 w-9 shrink-0 rounded-full grid place-items-center bg-[#EEE8DD]" aria-label={t('closeDayPicker')}><X size={16} /></button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 md:gap-2 flex-1">
            {dayOrder.map(day => (
              <button
                key={day}
                onClick={event => void handleAddToDay(event, day)}
                className="min-h-[34px] rounded-xl bg-[#F2ECE3] px-2 text-left text-[11px] md:text-sm font-semibold text-[#5F584F] transition active:bg-[#D95D39] active:text-white md:hover:bg-[#E5DDD1]"
              >
                {dayName(day)}
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
};

export default DishCard;
