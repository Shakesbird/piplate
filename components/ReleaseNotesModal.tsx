import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
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
    <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-stretch sm:items-center justify-center sm:p-4" style={{ zIndex: 1000 }} role="dialog" aria-modal="true" aria-labelledby="release-notes-title">
      <div className="relative flex max-h-[100dvh] w-full flex-col overflow-hidden bg-[#FFFDF8] shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-lg sm:rounded-[2rem]">
        <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-5 pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8 sm:pt-8">
          <div className="flex items-center justify-between gap-4">
            <h2 id="release-notes-title" className="font-display text-4xl leading-tight">{t('changelog')}</h2>
            <button onClick={onClose} className="touch-button shrink-0 bg-[#EEE8DD] text-[#5F584F]" aria-label={t('closeChangelog')}><X size={19} /></button>
          </div>

          <div className="mt-6 space-y-2">
            {release.lines.map(line => (
              <p key={line} data-changelog-line className="text-base leading-relaxed text-[#5F584F]">
                {line}
              </p>
            ))}
          </div>
        </div>

        <div className="shrink-0 border-t border-[#E8E1D6] bg-[#FFFDF8] px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-8 sm:pb-6">
          <button onClick={onClose} className="min-h-12 w-full rounded-full bg-[#2D2A26] px-5 text-sm font-semibold text-white active:scale-[0.98] transition">{t('gotIt')}</button>
        </div>
      </div>
    </div>
  );
};

export default ReleaseNotesModal;
