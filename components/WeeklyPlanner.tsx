import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, CalendarDays, Check, GripVertical, Plus, ShoppingCart, X } from 'lucide-react';
import { DEFAULT_RECIPE_IMAGE, getRecipeImageSource, Recipe, WeeklyPlan } from '../types';
import { useLanguage } from '../i18n';
import { collectPlannerIngredients, preparePlannerIngredientsForBring } from '../services/bringService';

interface WeeklyPlannerProps {
  recipes: Recipe[];
  plan: WeeklyPlan;
  dayOrder: string[];
  onUpdatePlan: (day: string, recipeIds: string[]) => void;
  onMoveRecipe: (fromDay: string, toDay: string, recipeId: string) => Promise<void>;
}

interface DragPayload {
  recipeId: string;
  fromDay: string;
}

const BRING_LINK_REFRESH_MS = 8 * 60 * 1000;

const WeeklyPlanner: React.FC<WeeklyPlannerProps> = ({ recipes, plan, dayOrder, onUpdatePlan, onMoveRecipe }) => {
  const { t, dayName } = useLanguage();
  const [activeDayForAdd, setActiveDayForAdd] = useState<string | null>(null);
  const [moveRecipe, setMoveRecipe] = useState<{ day: string; recipeId: string } | null>(null);
  const [dragTargetDay, setDragTargetDay] = useState<string | null>(null);
  const [bringStatus, setBringStatus] = useState<'idle' | 'preparing' | 'opened' | 'sign-in-required' | 'not-configured' | 'error'>('idle');
  const [bringLink, setBringLink] = useState<string | null>(null);
  const [bringLinkRevision, setBringLinkRevision] = useState(0);

  const getRecipe = (id: string) => recipes.find(recipe => recipe.id === id);
  const plannedCount = Object.values(plan).reduce((total, ids) => total + ids.length, 0);
  const plannerIngredients = useMemo(
    () => collectPlannerIngredients(recipes, plan, dayOrder),
    [recipes, plan, dayOrder],
  );
  const plannerIngredientsKey = useMemo(
    () => JSON.stringify(plannerIngredients),
    [plannerIngredients],
  );
  const plannerShoppingTitle = t('plannerShoppingTitle');

  useEffect(() => {
    let cancelled = false;
    let refreshTimer: number | undefined;
    if (plannerIngredients.length === 0) {
      setBringLink(null);
      setBringStatus('idle');
      return () => { cancelled = true; };
    }

    setBringLink(null);
    setBringStatus('preparing');
    void preparePlannerIngredientsForBring(plannerShoppingTitle, plannerIngredients)
      .then(link => {
        if (cancelled) return;
        setBringLink(link);
        setBringStatus('idle');
        refreshTimer = window.setTimeout(
          () => setBringLinkRevision(revision => revision + 1),
          BRING_LINK_REFRESH_MS,
        );
      })
      .catch(error => {
        if (cancelled) return;
        console.error('Could not prepare Bring import', error);
        const message = error instanceof Error ? error.message : '';
        setBringStatus(
          message === 'bring/sign-in-required'
            ? 'sign-in-required'
            : message === 'bring/not-configured'
              ? 'not-configured'
              : 'error',
        );
      });

    return () => {
      cancelled = true;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
    };
  }, [plannerIngredientsKey, plannerShoppingTitle, bringLinkRevision]);

  const handleBringLinkClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (import.meta.env.DEV && window.__PIPLATE_BRING_TEST__) event.preventDefault();
    setBringStatus('opened');
    window.setTimeout(() => setBringStatus('idle'), 5000);
  };

  const addRecipeToDay = (day: string, recipeId: string) => {
    const current = plan[day] || [];
    if (!current.includes(recipeId)) onUpdatePlan(day, [...current, recipeId]);
    setActiveDayForAdd(null);
  };

  const removeRecipeFromDay = (day: string, recipeId: string) => {
    onUpdatePlan(day, (plan[day] || []).filter(id => id !== recipeId));
  };

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, day: string, recipeId: string) => {
    const payload: DragPayload = { recipeId, fromDay: day };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/json', JSON.stringify(payload));
  };

  const handleDrop = async (event: React.DragEvent<HTMLElement>, day: string) => {
    event.preventDefault();
    setDragTargetDay(null);
    const raw = event.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as DragPayload;
      await onMoveRecipe(payload.fromDay, day, payload.recipeId);
    } catch (error) {
      console.error('Failed to move recipe', error);
    }
  };

  const handleTouchMove = async (targetDay: string) => {
    if (!moveRecipe || moveRecipe.day === targetDay) return;
    await onMoveRecipe(moveRecipe.day, targetDay, moveRecipe.recipeId);
    setMoveRecipe(null);
  };

  return (
    <div className="app-container pb-32 md:pb-16 pt-6 md:pt-10">
      <div data-testid="planner-header" className="planner-header">
        <h1 className="display-title min-w-0">{t('weeklyPlanner')}</h1>
        <div className="planner-actions">
          <div className="planner-count rounded-2xl bg-[#E2E8D7] px-5 py-3 text-right">
            <span className="block text-2xl font-display text-[#35402D]">{plannedCount}</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#69745F]">{t('mealsPlanned')}</span>
          </div>
          {bringLink ? (
            <a
              href={bringLink}
              onClick={handleBringLinkClick}
              rel="external"
              data-bring-status={bringStatus}
              className="bring-compact active:scale-95 transition"
              aria-label={t('sendWeekToBring')}
            >
              {bringStatus === 'opened' ? <Check size={16} /> : <ShoppingCart size={16} />}
              <span>Bring</span>
            </a>
          ) : (
            <button
              onClick={() => setBringLinkRevision(revision => revision + 1)}
              disabled={plannerIngredients.length === 0 || bringStatus === 'preparing' || bringStatus === 'sign-in-required' || bringStatus === 'not-configured'}
              data-bring-status={bringStatus}
              className="bring-compact active:scale-95 transition disabled:opacity-40"
              aria-label={t('sendWeekToBring')}
            >
              <ShoppingCart size={16} />
              <span>{bringStatus === 'preparing' ? 'Bring…' : 'Bring'}</span>
            </button>
          )}
        </div>
      </div>

      {bringStatus === 'error' && (
        <p className="mt-3 text-sm font-semibold text-[#9E4938]" role="alert">{t('bringShareError')}</p>
      )}
      {bringStatus === 'sign-in-required' && (
        <p className="mt-3 text-sm font-semibold text-[#9E4938]" role="alert">{t('bringSignInRequired')}</p>
      )}
      {bringStatus === 'not-configured' && (
        <p className="mt-3 text-sm font-semibold text-[#9E4938]" role="alert">{t('bringNotConfigured')}</p>
      )}

      <div className="mt-7 md:mt-10 space-y-4 md:space-y-5">
        {dayOrder.map((day, dayIndex) => {
          const dayRecipes = (plan[day] || []).map(getRecipe).filter(Boolean) as Recipe[];
          const isAdding = activeDayForAdd === day;
          const isDropTarget = dragTargetDay === day;

          return (
            <section
              key={day}
              data-planner-day={day}
              data-today={dayIndex === 0 ? 'true' : undefined}
              onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDragTargetDay(day); }}
              onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragTargetDay(null); }}
              onDrop={event => void handleDrop(event, day)}
              className={`relative overflow-hidden rounded-[1.75rem] border bg-white/80 shadow-[0_14px_45px_rgba(47,43,37,0.06)] transition ${isDropTarget ? 'border-[#D95D39] ring-4 ring-[#D95D39]/10' : 'border-[#DED8CD]'}`}
            >
              <div className="min-h-[70px] px-4 md:px-6 flex items-center gap-3 border-b border-[#EEE8DD]">
                <span className="h-10 w-10 rounded-full grid place-items-center bg-[#F2ECE3] text-sm font-semibold text-[#756E64]">{String(dayIndex + 1).padStart(2, '0')}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl md:text-2xl text-[#2D2A26]">{dayName(day)}</h2>
                    {dayIndex === 0 && <span className="rounded-full bg-[#E2E8D7] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#526647]">{t('today')}</span>}
                  </div>
                  <p className="text-xs text-[#958D80]">{dayRecipes.length === 0 ? t('noMeals') : dayRecipes.length === 1 ? t('oneMeal') : t('manyMeals', { count: dayRecipes.length })}</p>
                </div>
                <button
                  onClick={() => { setMoveRecipe(null); setActiveDayForAdd(day); }}
                  className="h-11 w-11 rounded-full bg-[#2D2A26] text-white grid place-items-center shadow-md active:scale-90 transition"
                  aria-label={t('addRecipeToDay', { day: dayName(day) })}
                ><Plus size={20} /></button>
              </div>

              <div className={`min-h-[150px] md:min-h-[180px] ${isDropTarget ? 'bg-[#F8EDE6]' : 'bg-[#FAF7F1]'}`}>
                {dayRecipes.length === 0 ? (
                  <button onClick={() => setActiveDayForAdd(day)} className="w-full min-h-[150px] md:min-h-[180px] flex flex-col items-center justify-center text-[#AAA195] active:bg-[#F2ECE3]">
                    <CalendarDays size={26} strokeWidth={1.4} />
                    <span className="mt-2 text-sm font-medium">{t('planSomething')}</span>
                  </button>
                ) : (
                  <div className="flex gap-3 overflow-x-auto no-scrollbar p-3 md:p-4 snap-x">
                    {dayRecipes.map((recipe, index) => (
                      <div
                        key={`${day}-${recipe.id}-${index}`}
                        draggable
                        onDragStart={event => handleDragStart(event, day, recipe.id)}
                        onDragEnd={() => setDragTargetDay(null)}
                        className="relative min-w-0 w-[150px] max-w-full sm:w-[180px] md:w-[210px] shrink-0 aspect-[4/3] rounded-[1.2rem] overflow-hidden bg-[#DDD5C8] snap-start shadow-sm group"
                      >
                        <img src={getRecipeImageSource(recipe.imageUri)} onError={event => { event.currentTarget.src = DEFAULT_RECIPE_IMAGE; }} alt="" className="block h-full w-full max-w-full object-cover" style={{ width: '100%', maxWidth: '100%' }} loading="lazy" decoding="async" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/10" />
                        <div className="absolute top-2 left-2 hidden md:flex h-8 w-8 rounded-full bg-white/85 items-center justify-center cursor-grab"><GripVertical size={15} /></div>
                        <div className="absolute top-2 right-2 flex gap-1">
                          <button onClick={() => setMoveRecipe({ day, recipeId: recipe.id })} className="h-9 w-9 rounded-full bg-white/90 grid place-items-center text-[#2D2A26] active:scale-90" aria-label={t('moveRecipe', { title: recipe.title })}><ArrowRightLeft size={15} /></button>
                          <button onClick={() => removeRecipeFromDay(day, recipe.id)} className="h-9 w-9 rounded-full bg-white/90 grid place-items-center text-[#8B4333] active:scale-90" aria-label={t('removeRecipeFromDay', { title: recipe.title, day: dayName(day) })}><X size={16} /></button>
                        </div>
                        <h3 className="absolute inset-x-0 bottom-0 p-3 text-white font-semibold text-sm leading-tight line-clamp-2">{recipe.title}</h3>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isAdding && (
                <div className="absolute inset-0 z-30 bg-[#FFFDF8]/98 backdrop-blur-xl flex flex-col">
                  <div className="min-h-[66px] px-4 md:px-6 flex items-center border-b border-[#EEE8DD]">
                    <div className="flex-1">
                      <p className="eyebrow">{t('addToDay', { day: dayName(day) })}</p>
                      <h3 className="font-semibold">{t('chooseRecipe')}</h3>
                    </div>
                    <button onClick={() => setActiveDayForAdd(null)} className="touch-button bg-[#EEE8DD]" aria-label={t('closeRecipePicker')}><X size={19} /></button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {recipes.map(recipe => (
                      <button key={recipe.id} onClick={() => addRecipeToDay(day, recipe.id)} className="min-h-[58px] flex items-center gap-3 rounded-2xl p-2 text-left bg-[#F5F0E7] active:bg-[#E8DED1]">
                        <img src={getRecipeImageSource(recipe.imageUri)} onError={event => { event.currentTarget.src = DEFAULT_RECIPE_IMAGE; }} alt="" className="h-11 w-11 rounded-xl object-cover" loading="lazy" decoding="async" />
                        <span className="font-semibold text-sm line-clamp-2">{recipe.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {moveRecipe && (
        <div className="fixed inset-0 z-50 bg-black/35 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setMoveRecipe(null)}>
          <div className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] bg-[#FFFDF8] p-5 safe-bottom shadow-2xl" onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div><p className="eyebrow">{t('moveMeal')}</p><h3 className="font-display text-2xl mt-1">{t('chooseAnotherDay')}</h3></div>
              <button onClick={() => setMoveRecipe(null)} className="touch-button bg-[#EEE8DD]" aria-label={t('closeMoveMenu')}><X size={19} /></button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {dayOrder.filter(day => day !== moveRecipe.day).map(day => (
                <button key={day} onClick={() => void handleTouchMove(day)} className="min-h-12 rounded-2xl bg-[#F2ECE3] px-4 text-left font-semibold active:bg-[#D95D39] active:text-white">{dayName(day)}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WeeklyPlanner;
