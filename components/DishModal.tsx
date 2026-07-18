import React, { useEffect, useRef, useState } from 'react';
import {
  Edit2,
  Flame,
  Plus,
  Save,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { DEFAULT_RECIPE_IMAGE, NutritionalValue, Recipe } from '../types';
import { useLanguage } from '../i18n';

interface DishModalProps {
  recipe: Recipe | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (recipe: Recipe) => void;
  onDelete: (id: string) => void;
}

const compressImage = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = event => {
    const image = new Image();
    image.src = event.target?.result as string;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const maxSize = 900;
      const ratio = Math.min(1, maxSize / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * ratio);
      canvas.height = Math.round(image.height * ratio);
      const context = canvas.getContext('2d');
      if (!context) return reject(new Error('Canvas context is unavailable'));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      let quality = 0.72;
      let compressed = canvas.toDataURL('image/jpeg', quality);
      while (compressed.length > 600_000) {
        if (quality > 0.4) quality -= 0.08;
        else {
          canvas.width = Math.max(320, Math.round(canvas.width * 0.8));
          canvas.height = Math.max(240, Math.round(canvas.height * 0.8));
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
        }
        compressed = canvas.toDataURL('image/jpeg', quality);
        if (canvas.width <= 320 && canvas.height <= 240) break;
      }
      resolve(compressed);
    };
    image.onerror = reject;
  };
  reader.onerror = reject;
});

const DishModal: React.FC<DishModalProps> = ({ recipe, isOpen, onClose, onSave, onDelete }) => {
  const { t } = useLanguage();
  const [formData, setFormData] = useState<any>({});
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setShowDeleteConfirm(false);
    if (recipe) {
      setFormData({ ...recipe, nutrition: { ...recipe.nutrition } });
      setIsEditing(false);
    } else {
      setFormData({
        id: crypto.randomUUID(),
        title: '',
        ingredients: [''],
        instructions: [''],
        portions: 2,
        nutrition: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        imageUri: DEFAULT_RECIPE_IMAGE,
        createdAt: Date.now(),
      });
      setIsEditing(true);
    }
  // Depend on the identity of the opened recipe, not the object reference. The
  // IndexedDB hydration can replace recipe objects after the modal opens; that
  // must not cancel an edit that the user has just started.
  }, [isOpen, recipe?.id]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    setFormData((current: any) => ({ ...current, [name]: value }));
  };

  const handleNutritionChange = (name: keyof NutritionalValue, value: string) => {
    setFormData((current: any) => ({
      ...current,
      nutrition: { ...(current.nutrition || {}), [name]: value },
    }));
  };

  const updateListItem = (field: 'ingredients' | 'instructions', index: number, value: string) => {
    setFormData((current: any) => {
      const next = [...(current[field] || [])];
      next[index] = value;
      return { ...current, [field]: next };
    });
  };

  const addListItem = (field: 'ingredients' | 'instructions') => {
    setFormData((current: any) => ({ ...current, [field]: [...(current[field] || []), ''] }));
  };

  const removeListItem = (field: 'ingredients' | 'instructions', index: number) => {
    setFormData((current: any) => ({
      ...current,
      [field]: (current[field] || []).filter((_: string, itemIndex: number) => itemIndex !== index),
    }));
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imageUri = await compressImage(file);
      setFormData((current: any) => ({ ...current, imageUri }));
    } catch (error) {
      console.error('Image processing failed', error);
      alert(t('imageProcessingError'));
    }
  };

  const save = () => {
    if (!formData.title?.trim() || !formData.id) return;
    const recipeToSave: Recipe = {
      ...formData,
      title: formData.title.trim(),
      ingredients: (formData.ingredients || []).filter((item: string) => item.trim()),
      instructions: (formData.instructions || []).filter((item: string) => item.trim()),
      portions: Number(formData.portions) || 0,
      nutrition: {
        calories: Number(formData.nutrition?.calories) || 0,
        protein: Number(formData.nutrition?.protein) || 0,
        carbs: Number(formData.nutrition?.carbs) || 0,
        fat: Number(formData.nutrition?.fat) || 0,
      },
    };
    onSave(recipeToSave);
    if (!recipe) onClose();
    else {
      setFormData(recipeToSave);
      setIsEditing(false);
    }
  };

  const cancelEdit = () => {
    if (recipe) {
      setFormData({ ...recipe, nutrition: { ...recipe.nutrition } });
      setIsEditing(false);
    } else onClose();
  };

  const macroFields: Array<{ label: string; key: keyof NutritionalValue }> = [
    { label: t('protein'), key: 'protein' },
    { label: t('carbs'), key: 'carbs' },
    { label: t('fat'), key: 'fat' },
  ];

  return (
    <div className="fixed inset-0 z-[100] overflow-x-hidden bg-black/55 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4" role="dialog" aria-modal="true" aria-label={recipe ? recipe.title : t('newRecipe')}>
      <div className="relative min-w-0 bg-[#FFFDF8] w-full max-w-6xl h-[100dvh] sm:h-[94dvh] sm:rounded-[2rem] overflow-hidden flex flex-col shadow-2xl" style={{ width: '100%', maxWidth: '72rem' }}>
        <header className="shrink-0 min-h-[68px] safe-top px-4 sm:px-6 flex items-center gap-3 border-b border-[#E8E1D6] bg-[#FFFDF8]/95 backdrop-blur-xl z-30">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-[0.2em] text-[#958D80] font-semibold">
              {isEditing ? (recipe ? t('editingRecipe') : t('createRecipe')) : t('recipeDetails')}
            </p>
            <p className="truncate text-sm font-semibold text-[#2D2A26]">{formData.title || t('untitledRecipe')}</p>
          </div>

          {recipe && !isEditing && (
            <button onClick={() => setShowDeleteConfirm(true)} className="touch-button text-[#9E4938] bg-[#F8E9E4]" aria-label={t('deleteRecipe')}><Trash2 size={18} /></button>
          )}
          {isEditing ? (
            <>
              {recipe && <button onClick={cancelEdit} className="touch-button bg-[#F2ECE3] text-[#5F584F]" aria-label={t('cancelEditing')}><X size={19} /></button>}
              <button onClick={save} disabled={!formData.title?.trim()} className="h-11 px-4 rounded-full bg-[#D95D39] text-white flex items-center gap-2 font-semibold text-sm shadow-lg disabled:opacity-40 active:scale-95 transition">
                <Save size={17} /><span>{t('save')}</span>
              </button>
            </>
          ) : (
            recipe && <button onClick={() => setIsEditing(true)} className="h-11 px-4 rounded-full bg-[#2D2A26] text-white flex items-center gap-2 font-semibold text-sm active:scale-95 transition" aria-label={t('editRecipe')}><Edit2 size={17} /><span className="hidden sm:inline">{t('edit')}</span></button>
          )}
          <button onClick={onClose} className="touch-button bg-[#F2ECE3] text-[#5F584F]" aria-label={t('closeRecipe')}><X size={20} /></button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <section className="grid min-w-0 lg:grid-cols-[1.08fr_.92fr] border-b border-[#E8E1D6]">
            <div className="relative min-w-0 max-w-full min-h-[260px] sm:min-h-[330px] lg:min-h-[430px] bg-[#E3DCCF] overflow-hidden group">
              <img src={formData.imageUri || DEFAULT_RECIPE_IMAGE} onError={event => { event.currentTarget.src = DEFAULT_RECIPE_IMAGE; }} alt={formData.title || 'Recipe'} className="absolute inset-0 block h-full w-full max-w-full object-cover" style={{ width: '100%', maxWidth: '100%' }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
              {isEditing && (
                <>
                  <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
                    <button onClick={() => fileInputRef.current?.click()} className="h-12 px-4 rounded-full bg-white/95 text-[#2D2A26] flex items-center gap-2 font-semibold text-sm shadow-lg active:scale-95 transition">
                      <Upload size={18} /> {t('changePicture')}
                    </button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </>
              )}
            </div>

            <div className="p-5 sm:p-8 lg:p-10 flex flex-col justify-center bg-[#FFFDF8]">
              <p className="eyebrow">{t('fromYourKitchen')}</p>
              {isEditing ? (
                <input name="title" value={formData.title} onChange={handleInputChange} placeholder={t('recipeName')} autoFocus={!recipe} className="mt-3 w-full bg-transparent border-b-2 border-[#D7D0C4] focus:border-[#D95D39] outline-none py-2 font-display text-3xl sm:text-4xl leading-tight" />
              ) : (
                <h1 className="mt-3 font-display text-4xl sm:text-5xl leading-[0.98] text-[#2D2A26]">{formData.title}</h1>
              )}

              <div className="mt-7 grid grid-cols-2 gap-3">
                <div className="stat-card">
                  <Users size={19} className="text-[#D95D39]" />
                  <div><span className="stat-label">{t('portions')}</span>{isEditing ? <input name="portions" inputMode="numeric" value={formData.portions} onChange={handleInputChange} className="stat-input" /> : <span className="stat-value">{formData.portions}</span>}</div>
                </div>
                <div className="stat-card">
                  <Flame size={19} className="text-[#D95D39]" />
                  <div><span className="stat-label">{t('calories')}</span>{isEditing ? <input inputMode="numeric" value={formData.nutrition?.calories ?? ''} onChange={event => handleNutritionChange('calories', event.target.value)} className="stat-input" /> : <span className="stat-value">{formData.nutrition?.calories} kcal</span>}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                {macroFields.map(({ label, key }) => (
                  <div key={key} className="rounded-2xl border border-[#E8E1D6] bg-white px-3 py-3">
                    <span className="stat-label">{label}</span>
                    {isEditing ? (
                      <div className="flex items-baseline"><input inputMode="numeric" value={formData.nutrition?.[key] ?? ''} onChange={event => handleNutritionChange(key, event.target.value)} className="w-full min-w-0 bg-transparent outline-none font-semibold" /><span className="text-xs text-[#958D80]">g</span></div>
                    ) : <span className="stat-value">{formData.nutrition?.[key] || 0}g</span>}
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid lg:grid-cols-2">
            <div className="p-5 sm:p-8 lg:p-10 bg-[#F7F3EB] border-b lg:border-b-0 lg:border-r border-[#E8E1D6]">
              <div className="flex items-center justify-between gap-3 mb-6">
                <div><p className="eyebrow">{t('whatYouNeed')}</p><h2 className="font-display text-3xl mt-1">{t('ingredients')}</h2></div>
              </div>

              {isEditing ? (
                <div className="space-y-2">
                  {(formData.ingredients || []).map((ingredient: string, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="h-6 w-6 shrink-0 rounded-full bg-[#E7DED0] text-[#756E64] grid place-items-center text-[10px] font-semibold">{index + 1}</span>
                      <input value={ingredient} onChange={event => updateListItem('ingredients', index, event.target.value)} placeholder={t('ingredientExample')} className="flex-1 min-w-0 h-12 rounded-xl border border-[#DED8CD] bg-white px-3 outline-none focus:border-[#D95D39]" />
                      <button onClick={() => removeListItem('ingredients', index)} className="touch-button shrink-0 text-[#9E4938]" aria-label={t('removeIngredient', { number: index + 1 })}><X size={17} /></button>
                    </div>
                  ))}
                  <button onClick={() => addListItem('ingredients')} className="mt-3 h-11 px-4 rounded-full bg-[#EAE2D6] flex items-center gap-2 text-sm font-semibold"><Plus size={17} /> {t('addIngredient')}</button>
                </div>
              ) : (
                <ul className="space-y-4">
                  {(formData.ingredients || []).map((ingredient: string, index: number) => (
                    <li key={index} className="flex items-start gap-3 text-[#5F584F] leading-relaxed"><span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#D95D39]" />{ingredient}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-5 sm:p-8 lg:p-10 bg-[#FFFDF8] safe-content-bottom">
              <div className="mb-6"><p className="eyebrow">{t('stepByStep')}</p><h2 className="font-display text-3xl mt-1">{t('preparation')}</h2></div>
              {isEditing ? (
                <div className="space-y-3">
                  {(formData.instructions || []).map((instruction: string, index: number) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="h-8 w-8 mt-1 shrink-0 rounded-full bg-[#2D2A26] text-white grid place-items-center text-xs font-semibold">{index + 1}</span>
                      <textarea value={instruction} onChange={event => updateListItem('instructions', index, event.target.value)} rows={3} placeholder={t('step', { number: index + 1 })} className="flex-1 min-w-0 rounded-xl border border-[#DED8CD] bg-white p-3 outline-none focus:border-[#D95D39] resize-y" />
                      <button onClick={() => removeListItem('instructions', index)} className="touch-button shrink-0 text-[#9E4938]" aria-label={t('removeStep', { number: index + 1 })}><X size={17} /></button>
                    </div>
                  ))}
                  <button onClick={() => addListItem('instructions')} className="mt-3 h-11 px-4 rounded-full bg-[#EAE2D6] flex items-center gap-2 text-sm font-semibold"><Plus size={17} /> {t('addStep')}</button>
                </div>
              ) : (
                <ol className="space-y-6">
                  {(formData.instructions || []).map((instruction: string, index: number) => (
                    <li key={index} className="flex gap-4"><span className="h-8 w-8 shrink-0 rounded-full bg-[#2D2A26] text-white grid place-items-center text-xs font-semibold">{index + 1}</span><p className="pt-1 text-[#5F584F] leading-relaxed">{instruction}</p></li>
                  ))}
                </ol>
              )}
            </div>
          </section>
        </div>

        {showDeleteConfirm && recipe && (
          <div className="absolute inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setShowDeleteConfirm(false)}>
            <div className="w-full sm:max-w-md rounded-t-[2rem] sm:rounded-[2rem] bg-[#FFFDF8] p-6 safe-bottom shadow-2xl" onClick={event => event.stopPropagation()}>
              <span className="h-12 w-12 rounded-full bg-[#F8E9E4] text-[#9E4938] grid place-items-center"><Trash2 size={21} /></span>
              <h2 className="font-display text-3xl mt-5">{t('deleteThisRecipe')}</h2>
              <p className="mt-2 text-[#756E64]">{t('deleteWarning', { title: recipe.title })}</p>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <button onClick={() => setShowDeleteConfirm(false)} className="h-12 rounded-full bg-[#EEE8DD] font-semibold">{t('keepIt')}</button>
                <button onClick={() => onDelete(recipe.id)} className="h-12 rounded-full bg-[#B84935] text-white font-semibold">{t('delete')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DishModal;
