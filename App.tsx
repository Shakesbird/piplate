import React, { useEffect, useState } from 'react';
import {
  CalendarDays,
  Download,
  History,
  LayoutGrid,
  Minus,
  Plus,
  Search,
  Settings,
  Smartphone,
  Square,
  RefreshCw,
  Share2,
  SquarePlus,
  X,
} from 'lucide-react';
import { useRecipes } from './hooks/useRecipes';
import { ViewState } from './types';
import DishModal from './components/DishModal';
import WeeklyPlanner from './components/WeeklyPlanner';
import DishCard from './components/DishCard';
import { useLanguage } from './i18n';
import { usePwa } from './hooks/usePwa';
import ReleaseNotesModal from './components/ReleaseNotesModal';
import { CURRENT_RELEASE } from './release';
import { useHouseholdSync } from './hooks/useHouseholdSync';
import SyncSettings from './components/SyncSettings';

type RecipeSort = 'newest' | 'oldest' | 'name-asc' | 'name-desc';

const getInitialRecipeSort = (): RecipeSort => {
  const savedSort = localStorage.getItem('piplate-recipe-sort');
  return savedSort === 'oldest' || savedSort === 'name-asc' || savedSort === 'name-desc'
    ? savedSort
    : 'newest';
};

type ElectronIpcRenderer = {
  invoke: (channel: string) => Promise<boolean | void>;
};

type WindowWithElectron = Window & {
  process?: { type?: string };
  require?: (moduleName: string) => { ipcRenderer?: ElectronIpcRenderer };
};

const App: React.FC = () => {
  const { language, setLanguage, t } = useLanguage();
  const {
    recipes,
    recipesLoading,
    weeklyPlan,
    dayOrder,
    saveRecipe,
    deleteRecipe,
    updateWeeklyPlan,
    moveRecipeBetweenDays,
  } = useRecipes();
  const [view, setView] = useState<ViewState>('GALLERY');
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recipeSort, setRecipeSort] = useState<RecipeSort>(getInitialRecipeSort);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(() => localStorage.getItem('piplate-seen-release') !== CURRENT_RELEASE.id);
  const [showIosInstallGuide, setShowIosInstallGuide] = useState(false);
  const { applyUpdate, canInstall, install, isInstalled, isIos, isIosSafari, isUpdating, updateAvailable } = usePwa();
  const householdSync = useHouseholdSync();

  const dismissReleaseNotes = () => {
    localStorage.setItem('piplate-seen-release', CURRENT_RELEASE.id);
    setShowReleaseNotes(false);
  };

  const electronIpc = (window as WindowWithElectron).require?.('electron')?.ipcRenderer;
  const selectedRecipe = recipes.find(recipe => recipe.id === selectedRecipeId) || null;

  const handleOpenRecipe = (id: string) => {
    setSelectedRecipeId(id);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setSelectedRecipeId(null);
    setIsModalOpen(true);
  };

  const handleDeleteRecipe = (id: string) => {
    setIsModalOpen(false);
    setSelectedRecipeId(null);
    void deleteRecipe(id);
  };

  const handleAddRecipeToDay = async (day: string, recipeId: string) => {
    const current = weeklyPlan[day] || [];
    if (!current.includes(recipeId)) {
      await updateWeeklyPlan(day, [...current, recipeId]);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const syncWindowState = async () => {
      const nextState = await electronIpc?.invoke('window:is-maximized');
      if (isMounted && typeof nextState === 'boolean') setIsMaximized(nextState);
    };
    void syncWindowState();
    return () => { isMounted = false; };
  }, [electronIpc]);

  useEffect(() => {
    localStorage.setItem('piplate-recipe-sort', recipeSort);
  }, [recipeSort]);

  const filteredRecipes = recipes
    .filter(recipe => recipe.title.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    .sort((left, right) => {
      if (recipeSort === 'name-asc') return left.title.localeCompare(right.title, language, { sensitivity: 'base', numeric: true });
      if (recipeSort === 'name-desc') return right.title.localeCompare(left.title, language, { sensitivity: 'base', numeric: true });

      const leftTimestamp = left.updatedAt ?? left.createdAt;
      const rightTimestamp = right.updatedAt ?? right.createdAt;
      return recipeSort === 'oldest' ? leftTimestamp - rightTimestamp : rightTimestamp - leftTimestamp;
    });

  const renderGallery = () => (
    <div className="app-container pb-32 md:pb-16">
      <section className="pt-5 md:pt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="display-title">{t('galleryTitle')}</h1>
          </div>
          <div className="hidden sm:flex h-16 w-16 rounded-full bg-[#D95D39] text-white items-center justify-center font-semibold">
            {recipes.length}
          </div>
        </div>

        <div className="mt-6 md:mt-8">
          <label className="relative flex-1 max-w-xl">
            <span className="sr-only">{t('searchRecipes')}</span>
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8E887E]" size={20} />
            <input
              type="search"
              value={searchQuery}
              onChange={event => setSearchQuery(event.target.value)}
              placeholder={t('searchRecipes')}
              className="w-full h-14 rounded-2xl border border-[#DED8CD] bg-white/80 pl-12 pr-12 outline-none transition focus:border-[#D95D39] focus:ring-4 focus:ring-[#D95D39]/10 shadow-[0_8px_30px_rgba(47,43,37,0.05)]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full grid place-items-center text-[#8E887E] active:bg-[#EEE8DD]"
                aria-label={t('clearSearch')}
              >
                <X size={18} />
              </button>
            )}
          </label>
        </div>
      </section>

      <section className="mt-7 md:mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 md:mb-5">
          <h2 className="font-semibold text-lg md:text-xl text-[#2D2A26]">
            {searchQuery ? t('searchResults') : t('recipes')}
          </h2>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="whitespace-nowrap text-xs sm:text-sm text-[#8E887E]">{t('recipeCount', { count: filteredRecipes.length })}</span>
            <label>
              <span className="sr-only">{t('sortRecipes')}</span>
              <select
                value={recipeSort}
                onChange={event => setRecipeSort(event.target.value as RecipeSort)}
                className="recipe-sort"
                aria-label={t('sortRecipes')}
              >
                <option value="newest">{t('sortNewest')}</option>
                <option value="oldest">{t('sortOldest')}</option>
                <option value="name-asc">{t('sortNameAsc')}</option>
                <option value="name-desc">{t('sortNameDesc')}</option>
              </select>
            </label>
          </div>
        </div>

        {recipesLoading && (
          <div className="mb-5 rounded-2xl bg-white/70 px-5 py-4 text-sm text-[#756E64]" role="status">
            {t('loadingRecipes')}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6" aria-busy={recipesLoading}>
          {filteredRecipes.map((recipe, index) => (
            <DishCard
              key={recipe.id}
              recipe={recipe}
              onClick={() => handleOpenRecipe(recipe.id)}
              onAddToDay={handleAddRecipeToDay}
              prioritizeImage={index < 4}
            />
          ))}
        </div>

        {searchQuery && filteredRecipes.length === 0 && (
          <div className="mt-8 rounded-[2rem] border border-dashed border-[#D5CEC2] bg-white/60 px-6 py-16 text-center">
            <Search size={34} strokeWidth={1.5} className="mx-auto text-[#B1A99C]" />
            <h3 className="mt-4 font-semibold text-[#2D2A26]">{t('nothingFound')}</h3>
            <p className="mt-1 text-sm text-[#8E887E]">{t('tryAnother')}</p>
          </div>
        )}

        {!recipesLoading && recipes.length === 0 && !searchQuery && (
          <button onClick={handleAddNew} className="w-full rounded-[2rem] border border-dashed border-[#CFC6B9] bg-white/60 py-16 text-[#756E64] active:scale-[0.99] transition">
            <Plus size={34} className="mx-auto" />
            <span className="mt-3 block font-semibold">{t('addFirstRecipe')}</span>
          </button>
        )}
      </section>
    </div>
  );

  const renderSettings = () => (
    <div className="app-container settings-page pt-6 md:pt-10 max-w-4xl">
      <p className="eyebrow">{t('settingsEyebrow')}</p>
      <h1 className="display-title mt-2">{t('settings')}</h1>
      <p className="mt-3 text-[#756E64] max-w-xl">{t('settingsDescription')}</p>

      <section className="mt-7 md:mt-10 rounded-[2rem] border border-[#DED8CD] bg-white/80 p-5 sm:p-6 shadow-[0_18px_60px_rgba(47,43,37,0.06)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl">{t('language')}</h2>
            <p className="mt-1 text-sm text-[#756E64]">{t('languageDescription')}</p>
          </div>
          <div className="grid grid-cols-2 rounded-full bg-[#EEE8DD] p-1 shrink-0" role="group" aria-label={t('language')}>
            {(['de', 'en'] as const).map(option => (
              <button
                key={option}
                onClick={() => setLanguage(option)}
                aria-pressed={language === option}
                className={`min-h-11 min-w-[104px] rounded-full px-4 text-sm font-semibold transition ${language === option ? 'bg-[#2D2A26] text-white shadow-md' : 'text-[#756E64]'}`}
              >
                {option === 'de' ? t('german') : t('english')}
              </button>
            ))}
          </div>
        </div>
      </section>

      <SyncSettings sync={householdSync} />

      {!isInstalled && <section data-testid="install-settings" className="mt-4 rounded-[2rem] border border-[#DED8CD] bg-white/80 p-5 sm:p-6 shadow-[0_18px_60px_rgba(47,43,37,0.06)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="h-12 w-12 shrink-0 rounded-2xl bg-[#F8E9E4] text-[#D95D39] grid place-items-center">
              <Smartphone size={23} />
            </span>
            <div>
              <h2 className="font-display text-2xl">{t('installApp')}</h2>
              <p className="mt-1 text-sm text-[#756E64] max-w-lg">
                {isIosSafari
                  ? t('iosInstallDescription')
                  : isIos
                    ? t('iosOpenInSafariDescription')
                    : canInstall
                      ? t('installDescription')
                      : t('installUnavailableDescription')}
              </p>
            </div>
          </div>
          {isIosSafari ? (
            <button
              onClick={() => setShowIosInstallGuide(true)}
              className="self-start sm:self-auto min-h-11 rounded-full bg-[#2D2A26] px-5 text-white flex items-center gap-2 font-semibold text-sm active:scale-95 transition"
            >
              <Share2 size={18} /> {t('showIosInstallGuide')}
            </button>
          ) : isIos ? (
            <span className="self-start sm:self-auto rounded-full bg-[#EEE8DD] px-4 py-2.5 text-sm font-semibold text-[#756E64]">{t('openInSafari')}</span>
          ) : canInstall ? (
            <button
              onClick={() => void install()}
              className="self-start sm:self-auto min-h-11 rounded-full bg-[#2D2A26] px-5 text-white flex items-center gap-2 font-semibold text-sm active:scale-95 transition"
            >
              <Download size={18} /> {t('install')}
            </button>
          ) : (
            <span className="self-start sm:self-auto rounded-full bg-[#EEE8DD] px-4 py-2.5 text-sm font-semibold text-[#756E64]">{t('installUnavailable')}</span>
          )}
        </div>
      </section>}

      <section data-testid="current-patch" className="mt-4 rounded-2xl border border-[#DED8CD] bg-white/70 px-4 py-3 shadow-[0_10px_35px_rgba(47,43,37,0.04)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5 text-[#4F4941]">
            <History size={18} className="shrink-0 text-[#775A8C]" />
            <span className="truncate text-sm font-semibold">{t('currentPatch')}</span>
            <span className="shrink-0 text-xs text-[#958D80]">v{CURRENT_RELEASE.version}</span>
          </div>
          <button onClick={() => setShowReleaseNotes(true)} className="min-h-11 shrink-0 rounded-full bg-[#EEE8DD] px-3.5 text-xs font-semibold text-[#4F4941] active:scale-95 transition">{t('showChangelog')}</button>
        </div>
      </section>

    </div>
  );

  return (
    <div className="h-[100dvh] w-full bg-[#F7F3EB] flex flex-col text-[#2D2A26] overflow-hidden">
      <div
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
        className="hidden md:flex h-9 shrink-0 items-center justify-between pl-4 bg-[#EEE8DD] border-b border-black/5"
      >
        <div className="text-[10px] uppercase tracking-[0.28em] font-semibold text-[#756E64]">PiPlate</div>
        <div className="flex self-stretch" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button onClick={() => void electronIpc?.invoke('window:minimize')} className="w-12 grid place-items-center hover:bg-black/5" aria-label={t('minimizeWindow')}><Minus size={15} /></button>
          <button onClick={async () => { const next = await electronIpc?.invoke('window:toggle-maximize'); if (typeof next === 'boolean') setIsMaximized(next); }} className="w-12 grid place-items-center hover:bg-black/5" aria-label={isMaximized ? t('restoreWindow') : t('maximizeWindow')}><Square size={13} /></button>
          <button onClick={() => void electronIpc?.invoke('window:close')} className="w-12 grid place-items-center hover:bg-[#D95D39] hover:text-white" aria-label={t('closeWindow')}><X size={16} /></button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden hover-scrollbar overscroll-contain">
        <header data-testid="app-header" className="sticky top-0 z-40 border-b border-[#DED8CD]/80 bg-[#F7F3EB]/90 backdrop-blur-xl safe-top">
          <div className="app-container h-[70px] flex items-center justify-between">
            <button onClick={() => setView('GALLERY')} className="flex items-center gap-3" aria-label={t('openGallery')}>
              <img src="./icons/piplate-192.png" alt="" className="h-10 w-10 rounded-[14px] shadow-[0_8px_18px_rgba(217,93,57,0.22)]" />
              <span className="font-display text-[1.35rem] tracking-tight">PiPlate</span>
            </button>

            <nav className="hidden md:flex items-center rounded-full bg-[#EEE8DD] p-1" aria-label={t('primaryNavigation')}>
              <button onClick={() => setView('GALLERY')} className={`desktop-nav ${view === 'GALLERY' ? 'desktop-nav-active' : ''}`}>{t('recipes')}</button>
              <button onClick={() => setView('PLANNER')} className={`desktop-nav ${view === 'PLANNER' ? 'desktop-nav-active' : ''}`}>{t('planner')}</button>
            </nav>

            <button onClick={() => setView('SETTINGS')} className={`grid touch-button ${view === 'SETTINGS' ? 'bg-[#2D2A26] text-white' : 'bg-white text-[#5F584F] border border-[#DED8CD]'}`} aria-label={t('settings')}><Settings size={20} /></button>
          </div>
        </header>

        <main>
          {view === 'GALLERY' && renderGallery()}
          {view === 'PLANNER' && (
            <WeeklyPlanner recipes={recipes} plan={weeklyPlan} dayOrder={dayOrder} onUpdatePlan={updateWeeklyPlan} onMoveRecipe={moveRecipeBetweenDays} />
          )}
          {view === 'SETTINGS' && renderSettings()}
        </main>
      </div>

      <nav className="mobile-nav md:hidden" style={{ pointerEvents: showReleaseNotes || showIosInstallGuide || isModalOpen ? 'none' : 'auto' }} aria-label={t('mobileNavigation')} aria-hidden={showReleaseNotes || showIosInstallGuide || isModalOpen}>
        <button onClick={() => setView('GALLERY')} className={`mobile-nav-item ${view === 'GALLERY' ? 'mobile-nav-active' : ''}`}><LayoutGrid size={21} /><span>{t('recipes')}</span></button>
        <button onClick={handleAddNew} className="mobile-add" aria-label={t('addRecipe')}><Plus size={26} /></button>
        <button onClick={() => setView('PLANNER')} className={`mobile-nav-item ${view === 'PLANNER' ? 'mobile-nav-active' : ''}`}><CalendarDays size={21} /><span>{t('planner')}</span></button>
      </nav>

      <DishModal
        recipe={selectedRecipe}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={updated => { void saveRecipe(updated); }}
        onDelete={handleDeleteRecipe}
      />

      <ReleaseNotesModal isOpen={showReleaseNotes} onClose={dismissReleaseNotes} />

      {showIosInstallGuide && (
        <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="ios-install-title">
          <section
            className="w-full overflow-y-auto rounded-t-[2rem] bg-[#FFFDF8] px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6 shadow-2xl sm:max-w-lg sm:rounded-[2rem] sm:p-8"
            style={{ maxHeight: 'calc(100dvh - env(safe-area-inset-top))' }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">iPhone · Safari</p>
                <h2 id="ios-install-title" className="mt-2 font-display text-3xl">{t('iosInstallTitle')}</h2>
              </div>
              <button onClick={() => setShowIosInstallGuide(false)} className="touch-button shrink-0 bg-[#EEE8DD] text-[#5F584F]" aria-label={t('closeIosInstallGuide')}><X size={19} /></button>
            </div>

            <ol className="mt-6 space-y-3">
              <li className="flex gap-3 rounded-2xl bg-[#F7F3EB] p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#D95D39] font-bold text-white">1</span>
                <div><Share2 size={20} className="mb-1 text-[#D95D39]" /><p className="font-semibold">{t('iosInstallStepShare')}</p></div>
              </li>
              <li className="flex gap-3 rounded-2xl bg-[#F7F3EB] p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#D95D39] font-bold text-white">2</span>
                <div><SquarePlus size={20} className="mb-1 text-[#D95D39]" /><p className="font-semibold">{t('iosInstallStepHomeScreen')}</p></div>
              </li>
              <li className="flex gap-3 rounded-2xl bg-[#F7F3EB] p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#D95D39] font-bold text-white">3</span>
                <p className="self-center font-semibold">{t('iosInstallStepWebApp')}</p>
              </li>
            </ol>

            <p className="mt-4 text-sm leading-relaxed text-[#756E64]">{t('iosInstallMissingAction')}</p>
            <button onClick={() => setShowIosInstallGuide(false)} className="mt-6 min-h-12 w-full rounded-full bg-[#2D2A26] px-5 text-sm font-semibold text-white">{t('gotIt')}</button>
          </section>
        </div>
      )}

      {updateAvailable && (
        <aside className="fixed z-[100] left-3 right-3 bottom-[5.75rem] md:left-auto md:right-5 md:bottom-5 md:w-[25rem] rounded-[1.5rem] border border-[#DED8CD] bg-[#FFFDF8] p-4 shadow-[0_22px_70px_rgba(45,42,38,0.24)]" role="status">
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 shrink-0 rounded-full bg-[#F8E9E4] text-[#D95D39] grid place-items-center"><RefreshCw size={20} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{t('updateReady')}</p>
              <p className="mt-0.5 text-xs text-[#756E64]">{t('updateDescription')}</p>
            </div>
            <button
              onClick={applyUpdate}
              disabled={isUpdating}
              className="min-h-10 shrink-0 rounded-full bg-[#2D2A26] px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isUpdating ? t('updating') : t('updateNow')}
            </button>
          </div>
        </aside>
      )}
    </div>
  );
};

export default App;
