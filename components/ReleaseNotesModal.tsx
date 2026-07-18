import React, { useEffect } from 'react';
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="release-notes-title">
      <div className="relative w-full sm:max-w-lg rounded-t-[2rem] sm:rounded-[2rem] bg-[#FFFDF8] p-6 sm:p-8 safe-bottom shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 touch-button bg-[#EEE8DD] text-[#5F584F]" aria-label={t('closeChangelog')}><X size={19} /></button>
        <span className="h-14 w-14 rounded-2xl bg-[#F8E9E4] text-[#D95D39] grid place-items-center"><Sparkles size={25} /></span>
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

        <div className="mt-5 flex items-center gap-2 text-xs text-[#6C7464]"><ShieldCheck size={16} /><span>{t('recipesStayLocal')}</span></div>
        <button onClick={onClose} className="mt-6 min-h-12 w-full rounded-full bg-[#2D2A26] px-5 text-sm font-semibold text-white active:scale-[0.98] transition">{t('gotIt')}</button>
      </div>
    </div>
  );
};

export default ReleaseNotesModal;
