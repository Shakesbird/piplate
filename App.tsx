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
  const [isMaximized, setIsMaximized] = useState(false);
  const [showReleaseNotes, setShowReleaseNotes] = useState(() => localStorage.getItem('piplate-seen-release') !== CURRENT_RELEASE.id);
  const { applyUpdate, canInstall, install, isInstalled, isUpdating, updateAvailable } = usePwa();
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

  const filteredRecipes = recipes.filter(recipe =>
    recipe.title.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const renderGallery = () => (
    <div className="app-container pb-32 md:pb-16">
      <section className="pt-5 md:pt-10">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{t('galleryEyebrow')}</p>
            <h1 className="display-title mt-2">{t('galleryTitle')}</h1>
          </div>
          <div className="hidden sm:flex h-16 w-16 rounded-full bg-[#D95D39] text-white items-center justify-center font-semibold">
            {recipes.length}
          </div>
        </div>

        <div className="mt-6 md:mt-8 flex flex-col md:flex-row md:items-center gap-3">
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
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0">
            <span className="filter-chip bg-[#2D2A26] text-white">{t('allDishes')}</span>
            <span className="filter-chip">{t('saved', { count: recipes.length })}</span>
            <span className="filter-chip">{t('readyToPlan')}</span>
          </div>
        </div>
      </section>

      <section className="mt-7 md:mt-10">
        <div className="flex items-center justify-between mb-4 md:mb-5">
          <h2 className="font-semibold text-lg md:text-xl text-[#2D2A26]">
            {searchQuery ? t('searchResults') : t('recentlySaved')}
          </h2>
          <span className="text-sm text-[#8E887E]">{t('recipeCount', { count: filteredRecipes.length })}</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
          {filteredRecipes.map(recipe => (
            <DishCard
              key={recipe.id}
              recipe={recipe}
              onClick={() => handleOpenRecipe(recipe.id)}
              onAddToDay={handleAddRecipeToDay}
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

        {recipes.length === 0 && !searchQuery && (
          <button onClick={handleAddNew} className="w-full rounded-[2rem] border border-dashed border-[#CFC6B9] bg-white/60 py-16 text-[#756E64] active:scale-[0.99] transition">
            <Plus size={34} className="mx-auto" />
            <span className="mt-3 block font-semibold">{t('addFirstRecipe')}</span>
          </button>
        )}
      </section>
    </div>
  );

  const renderSettings = () => (
    <div className="app-container pb-32 md:pb-16 pt-6 md:pt-10 max-w-4xl">
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

      <section className="mt-4 rounded-[2rem] border border-[#DED8CD] bg-white/80 p-5 sm:p-6 shadow-[0_18px_60px_rgba(47,43,37,0.06)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="h-12 w-12 shrink-0 rounded-2xl bg-[#F8E9E4] text-[#D95D39] grid place-items-center">
              <Smartphone size={23} />
            </span>
            <div>
              <h2 className="font-display text-2xl">{t('installApp')}</h2>
              <p className="mt-1 text-sm text-[#756E64] max-w-lg">
                {isInstalled ? t('installedDescription') : canInstall ? t('installDescription') : t('installUnavailableDescription')}
              </p>
            </div>
          </div>
          {isInstalled ? (
            <span className="self-start sm:self-auto rounded-full bg-[#E8F1E8] px-4 py-2.5 text-sm font-semibold text-[#4E6B4E]">{t('installed')}</span>
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
      </section>

      <section className="mt-4 rounded-[2rem] border border-[#DED8CD] bg-white/80 p-5 sm:p-6 shadow-[0_18px_60px_rgba(47,43,37,0.06)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="h-12 w-12 shrink-0 rounded-2xl bg-[#EEE7F4] text-[#775A8C] grid place-items-center"><History size={22} /></span>
            <div>
              <h2 className="font-display text-2xl">{t('currentPatch')}</h2>
              <p className="mt-1 text-sm text-[#756E64]">{t('currentPatchDescription', { version: CURRENT_RELEASE.version })}</p>
            </div>
          </div>
          <button onClick={() => setShowReleaseNotes(true)} className="self-start sm:self-auto min-h-11 rounded-full bg-[#EEE8DD] px-5 text-sm font-semibold text-[#4F4941] active:scale-95 transition">{t('showChangelog')}</button>
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
        <header className="sticky top-0 z-40 border-b border-[#DED8CD]/80 bg-[#F7F3EB]/90 backdrop-blur-xl safe-top">
          <div className="app-container h-[70px] flex items-center justify-between">
            <button onClick={() => setView('GALLERY')} className="flex items-center gap-3" aria-label={t('openGallery')}>
              <span className="h-10 w-10 rounded-[14px] bg-[#D95D39] text-white grid place-items-center font-display text-xl shadow-[0_8px_18px_rgba(217,93,57,0.22)]">P</span>
              <span className="font-display text-[1.35rem] tracking-tight">PiPlate</span>
            </button>

            <nav className="hidden md:flex items-center rounded-full bg-[#EEE8DD] p-1" aria-label={t('primaryNavigation')}>
              <button onClick={() => setView('GALLERY')} className={`desktop-nav ${view === 'GALLERY' ? 'desktop-nav-active' : ''}`}>{t('recipes')}</button>
              <button onClick={() => setView('PLANNER')} className={`desktop-nav ${view === 'PLANNER' ? 'desktop-nav-active' : ''}`}>{t('planner')}</button>
            </nav>

            <div className="flex items-center gap-2">
              <button onClick={() => setView('SETTINGS')} className={`hidden sm:grid touch-button ${view === 'SETTINGS' ? 'bg-[#2D2A26] text-white' : 'bg-white text-[#5F584F] border border-[#DED8CD]'}`} aria-label={t('settings')}><Settings size={20} /></button>
              <button onClick={handleAddNew} className="h-11 px-4 rounded-full bg-[#2D2A26] text-white flex items-center gap-2 font-semibold text-sm shadow-[0_9px_24px_rgba(45,42,38,0.18)] active:scale-95 transition" aria-label={t('addRecipe')}>
                <Plus size={20} /> <span className="hidden sm:inline">{t('newRecipe')}</span>
              </button>
            </div>
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

      <nav className="mobile-nav md:hidden" style={{ pointerEvents: showReleaseNotes || isModalOpen ? 'none' : 'auto' }} aria-label={t('mobileNavigation')} aria-hidden={showReleaseNotes || isModalOpen}>
        <button onClick={() => setView('GALLERY')} className={`mobile-nav-item ${view === 'GALLERY' ? 'mobile-nav-active' : ''}`}><LayoutGrid size={21} /><span>{t('recipes')}</span></button>
        <button onClick={() => setView('PLANNER')} className={`mobile-nav-item ${view === 'PLANNER' ? 'mobile-nav-active' : ''}`}><CalendarDays size={21} /><span>{t('planner')}</span></button>
        <button onClick={handleAddNew} className="mobile-add" aria-label={t('addRecipe')}><Plus size={26} /></button>
        <button onClick={() => setView('SETTINGS')} className={`mobile-nav-item ${view === 'SETTINGS' ? 'mobile-nav-active' : ''}`}><Settings size={21} /><span>{t('settings')}</span></button>
      </nav>

      <DishModal
        recipe={selectedRecipe}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={updated => { void saveRecipe(updated); }}
        onDelete={handleDeleteRecipe}
      />

      <ReleaseNotesModal isOpen={showReleaseNotes} onClose={dismissReleaseNotes} />

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
