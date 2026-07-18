import React, { useEffect, useRef } from 'react';
import { Check, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useLanguage } from '../i18n';
import { CURRENT_RELEASE } from '../release';

interface ReleaseNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ReleaseNotesModal: React.FC<ReleaseNotesModalProps> = ({ isOpen, onClose }) => {
  const { language, t } = useLanguage();
  const release = CURRENT_RELEASE[language];
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    scrollContainerRef.current?.scrollTo({ top: 0 });
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="release-notes-title">
      <div className="relative flex max-h-[100dvh] w-full flex-col overflow-hidden bg-[#FFFDF8] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-[2rem]">
        <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-5 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:pt-8">
          <div className="flex items-start justify-between gap-4">
            <span className="h-14 w-14 shrink-0 rounded-2xl bg-[#F8E9E4] text-[#D95D39] grid place-items-center"><Sparkles size={25} /></span>
            <button onClick={onClose} className="touch-button shrink-0 bg-[#EEE8DD] text-[#5F584F]" aria-label={t('closeChangelog')}><X size={19} /></button>
          </div>
          <p className="eyebrow mt-6">{release.eyebrow} · v{CURRENT_RELEASE.version}</p>
          <h2 id="release-notes-title" className="font-display text-4xl mt-2 leading-tight">{release.title}</h2>
          <p className="mt-3 text-sm leading-relaxed text-[#756E64]">{release.summary}</p>

          <div className="mt-6 space-y-3">
            {release.notes.map(note => (
              <div key={note} className="flex items-start gap-3 rounded-2xl bg-[#F7F3EB] p-4">
                <span className="mt-0.5 h-7 w-7 shrink-0 rounded-full bg-[#E2E8D7] text-[#526647] grid place-items-center"><Check size={15} /></span>
                <p className="text-sm leading-relaxed text-[#5F584F]">{note}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-start gap-2 text-xs text-[#6C7464]"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><span>{t('recipesStayLocal')}</span></div>
        </div>

        <div className="shrink-0 border-t border-[#E8E1D6] bg-[#FFFDF8] px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-8 sm:pb-6">
          <button onClick={onClose} className="min-h-12 w-full rounded-full bg-[#2D2A26] px-5 text-sm font-semibold text-white active:scale-[0.98] transition">{t('gotIt')}</button>
        </div>
      </div>
    </div>
  );
};

export default ReleaseNotesModal;
