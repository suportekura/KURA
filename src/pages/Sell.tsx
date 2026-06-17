import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, Plus, X, Loader2, MapPin, AlertCircle, CheckCircle, ArrowLeft, Save, ShieldAlert, Zap, ChevronRight, Info, Clock, Flame, Rocket } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { categories, conditions, getSizesForCategory, isSizeOptional } from '@/data/mockProducts';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/hooks/use-toast';
import { useBoostCredits, type BoostType } from '@/hooks/useBoostCredits';
import { supabase } from '@/integrations/supabase/client';
import { ImageModerationModal } from '@/components/products/ImageModerationModal';

// Régua de 2 níveis do modal de revisão (calibrável). Nota: roupa de banho,
// lingerie e moda praia pontuam `sexual` MODERADO — por isso o bloqueio só
// dispara em altíssima confiança. Ajustar aqui se necessário.
const SEXUAL_BLOCK_THRESHOLD = 0.90;

interface ImageUpload {
  id: string;
  file?: File;
  preview: string;
  uploading: boolean;
  uploaded: boolean;
  url?: string;
  error?: string;
  moderated?: boolean;
  moderationPassed?: boolean;
}

interface ModerationResult {
  imageApproved: boolean;
  moderationFlagged: boolean;
  moderationCategories: Record<string, boolean>;
  confidenceScore?: number;
  needsManualReview?: boolean;
  moderationReason?: string;
  reason?: string;
  error?: string;
  // Presentes só no caminho de flag de conteúdo (ausentes no fail-safe de erro).
  categoryScores?: Record<string, number>;
  category?: string;
}

// Helper function to get user-friendly error message based on moderation category
const getModerationErrorMessage = (categories: Record<string, boolean>, reason?: string): { title: string; description: string } => {
  // Check marketplace-specific categories first
  if (categories.screenshot) {
    return {
      title: 'Screenshot detectado',
      description: 'Não aceitamos capturas de tela. Por favor, envie uma foto real do produto.',
    };
  }
  
  if (categories.heavily_edited) {
    return {
      title: 'Imagem muito editada',
      description: 'A imagem parece ter muitos filtros ou edições. Envie uma foto natural do produto.',
    };
  }
  
  if (categories.not_product) {
    return {
      title: 'Imagem inválida',
      description: 'A foto deve mostrar uma peça de vestuário ou acessório. Envie uma imagem do produto que está vendendo.',
    };
  }
  
  if (categories.low_quality) {
    return {
      title: 'Qualidade insuficiente',
      description: 'A imagem está muito escura, borrada ou o produto não está visível. Tire uma foto mais clara.',
    };
  }
  
  // Check safety categories
  if (categories.sexual || categories['sexual/minors']) {
    return {
      title: 'Conteúdo inadequado',
      description: 'A imagem contém conteúdo não permitido. Por favor, escolha outra foto.',
    };
  }
  
  if (categories.violence || categories['violence/graphic']) {
    return {
      title: 'Conteúdo violento',
      description: 'A imagem contém conteúdo violento não permitido.',
    };
  }
  
  if (categories.hate || categories['hate/threatening']) {
    return {
      title: 'Conteúdo ofensivo',
      description: 'A imagem contém conteúdo ofensivo ou de ódio não permitido.',
    };
  }
  
  if (categories.illicit || categories['illicit/violent']) {
    return {
      title: 'Conteúdo ilícito',
      description: 'A imagem contém conteúdo ilegal não permitido.',
    };
  }
  
  // Default message with reason if available
  return {
    title: 'Imagem não aprovada',
    description: reason || 'A imagem não atende às nossas diretrizes. Por favor, escolha outra foto.',
  };
};

interface TextModerationResult {
  textApproved: boolean;
  moderationFlagged: boolean;
  moderationCategories: Record<string, boolean>;
  flaggedField?: 'title' | 'description' | 'both';
  confidenceScore?: number;
  needsManualReview?: boolean;
  moderationReason?: string;
  error?: string;
}

// Tile de imagem reordenável por drag and drop (mouse, toque com press-and-hold, teclado)
function SortableImageTile({
  img,
  index,
  submitting,
  onRemove,
}: {
  img: ImageUpload;
  index: number;
  submitting: boolean;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: img.id,
    disabled: submitting,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // 'manipulation' mantém o scroll horizontal nativo; o press-and-hold
        // (delay do TouchSensor) é que inicia o drag no toque
        touchAction: 'manipulation',
      }}
      {...attributes}
      {...listeners}
      className={cn(
        'relative flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden select-none cursor-grab active:cursor-grabbing',
        img.moderationPassed === false && 'ring-2 ring-destructive',
        isDragging && 'z-10 opacity-90 shadow-elevated ring-2 ring-primary'
      )}
    >
      <img src={img.preview} alt={`Foto ${index + 1} do produto`} className="w-full h-full object-cover pointer-events-none" />

      {/* Upload status overlay */}
      {img.uploading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {/* Moderation failed overlay */}
      {img.moderationPassed === false && (
        <div className="absolute inset-0 bg-destructive/30 flex flex-col items-center justify-center gap-1">
          <ShieldAlert className="w-6 h-6 text-destructive" />
          <span className="text-[9px] text-destructive font-medium px-1 text-center">
            Não permitido
          </span>
        </div>
      )}

      {img.uploaded && img.moderationPassed !== false && (
        <div className="absolute top-2 left-2">
          <CheckCircle className="w-5 h-5 text-primary" />
        </div>
      )}

      {img.error && img.moderationPassed !== false && (
        <div className="absolute inset-0 bg-destructive/20 flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-destructive" />
        </div>
      )}

      {!submitting && (
        <button
          onClick={() => onRemove(img.id)}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Remover foto"
          className="absolute top-2 right-2 w-6 h-6 rounded-full bg-background/80 flex items-center justify-center"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {index === 0 && img.moderationPassed !== false && (
        <span className="absolute bottom-2 left-2 text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded">
          Principal
        </span>
      )}
    </div>
  );
}

export default function Sell() {
  const { user } = useAuth();
  const { location, hasLocation, requestLocation, loading: locationLoading } = useGeolocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editProductId = searchParams.get('edit');
  const isEditMode = !!editProductId;

  const DRAFT_KEY = 'sell_form_draft';
  const DRAFT_IMAGES_KEY = 'sell_form_draft_images';

  // Restore draft from sessionStorage (only for new listings)
  const getInitialFormData = () => {
    if (editProductId) return { title: '', description: '', price: '', originalPrice: '', size: '', brand: '', category: '', condition: '', gender: '' };
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { title: '', description: '', price: '', originalPrice: '', size: '', brand: '', category: '', condition: '', gender: '' };
  };

  const getInitialImages = (): ImageUpload[] => {
    if (editProductId) return [];
    try {
      const saved = sessionStorage.getItem(DRAFT_IMAGES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Array<{ id: string; preview: string; url: string }>;
        return parsed.map(img => ({ ...img, uploading: false, uploaded: true }));
      }
    } catch {}
    return [];
  };

  const [images, setImages] = useState<ImageUpload[]>(getInitialImages);
  const [submitting, setSubmitting] = useState(false);
  const [moderating, setModerating] = useState(false);
  const [showPhotoTips, setShowPhotoTips] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [formData, setFormData] = useState(getInitialFormData);
  const [selectedBoost, setSelectedBoost] = useState<BoostType | null>(null);
  const { credits: boostCredits, totalCredits, refetch: refetchBoostCredits } = useBoostCredits();

  // Modal de revisão de imagem (decisão consciente antes da revisão silenciosa).
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    mode: 'block' | 'confirm';
    category?: string;
  }>({ open: false, mode: 'confirm' });
  // Contexto guardado para o "Enviar mesmo assim" concluir o submit (upload + insert).
  const pendingSubmitRef = useRef<{ forceReview: boolean; reasons: string[] } | null>(null);

  const boostOptions: Array<{ type: BoostType; label: string; icon: typeof Clock }> = [
    { type: '24h', label: '24 horas', icon: Clock },
    { type: '3d', label: '3 dias', icon: Flame },
    { type: '7d', label: '7 dias', icon: Rocket },
  ];

  // Persist form data to sessionStorage on change (only for new listings)
  useEffect(() => {
    if (isEditMode) return;
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
    } catch {}
  }, [formData, isEditMode]);

  // Persist uploaded images to sessionStorage (only URLs, not files)
  useEffect(() => {
    if (isEditMode) return;
    try {
      const serializableImages = images
        .filter(img => img.uploaded && img.url)
        .map(img => ({ id: img.id, preview: img.url, url: img.url }));
      sessionStorage.setItem(DRAFT_IMAGES_KEY, JSON.stringify(serializableImages));
    } catch {}
  }, [images, isEditMode]);

  const clearDraft = () => {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
      sessionStorage.removeItem(DRAFT_IMAGES_KEY);
    } catch {}
  };

  const genderOptions = [
    { id: 'M', label: 'Masculino' },
    { id: 'F', label: 'Feminino' },
    { id: 'U', label: 'Unissex' },
  ];

  // Load product data if editing
  useEffect(() => {
    if (!editProductId || !user) return;

    const fetchProduct = async () => {
      setLoadingProduct(true);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', editProductId)
          .eq('seller_id', user.id)
          .maybeSingle();

        if (error) throw error;
        
        if (!data) {
          toast({
            title: 'Produto não encontrado',
            description: 'O anúncio não existe ou você não tem permissão para editá-lo.',
            variant: 'destructive',
          });
          navigate('/my-listings');
          return;
        }

        // Populate form with existing data
        const productData = data as any; // Use any to handle new gender field not yet in generated types
        setFormData({
          title: productData.title || '',
          description: productData.description || '',
          price: productData.price?.toString() || '',
          originalPrice: productData.original_price?.toString() || '',
          size: productData.size || '',
          brand: productData.brand || '',
          category: productData.category || '',
          condition: productData.condition || '',
          gender: productData.gender || 'U',
        });

        // Set existing images
        if (data.images && data.images.length > 0) {
          const existingImages: ImageUpload[] = data.images.map((url: string, index: number) => ({
            id: `existing-${index}`,
            preview: url,
            url: url,
            uploading: false,
            uploaded: true,
          }));
          setImages(existingImages);
        }
      } catch (err) {
        console.error('[Sell] Error fetching product:', err);
        toast({
          title: 'Erro ao carregar anúncio',
          description: 'Tente novamente.',
          variant: 'destructive',
        });
      } finally {
        setLoadingProduct(false);
      }
    };

    fetchProduct();
  }, [editProductId, user, toast, navigate]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const remainingSlots = 5 - images.length;
    const filesToProcess = Array.from(files).slice(0, remainingSlots);

    const newImages: ImageUpload[] = filesToProcess.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: URL.createObjectURL(file),
      uploading: false,
      uploaded: false,
    }));

    setImages((prev) => [...prev, ...newImages]);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (imageUpload: ImageUpload): Promise<string | null> => {
    if (!user || !imageUpload.file) return null;

    const fileExt = imageUpload.file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const fileName = `${user.id}/${crypto.randomUUID()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(fileName, imageUpload.file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      console.error('[Sell] Upload error:', uploadError);
      throw new Error('Erro ao fazer upload da imagem');
    }

    const { data: { publicUrl } } = supabase.storage
      .from('product-images')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  // Timeout por chamada de moderação: em vez de travar o fluxo, o anúncio
  // cai em revisão manual (pending_review) e o crédito do usuário é preservado
  const MODERATION_TIMEOUT_MS = 30_000;

  const withModerationTimeout = <T,>(promise: Promise<T>, fallback: T): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), MODERATION_TIMEOUT_MS)),
    ]);

  // Versão reduzida da imagem só para a IA (a original em alta segue no storage).
  // 768px é suficiente para classificar screenshot/qualidade/conteúdo e corta o
  // payload enviado ao Gemini de ~MB para ~100KB.
  const MODERATION_MAX_DIMENSION = 768;

  const prepareImageForModeration = async (file: File): Promise<string | null> => {
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = objectUrl;
      await image.decode();

      const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
      const scale = Math.min(1, MODERATION_MAX_DIMENSION / largestSide);
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(image, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch (err) {
      // Sem versão reduzida a edge function baixa a original pela URL (fallback)
      console.warn('[Sell] Failed to downscale image for moderation:', err);
      return null;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  // Modera a imagem via OpenAI. Aceita base64-only (moderação pré-upload) ou URL.
  const moderateImage = async (imageUrl: string | null, imageBase64?: string | null): Promise<ModerationResult> => {
    // Erros de infra (rede, 5xx, rate limit) não são um veredito sobre o conteúdo:
    // o anúncio vai para revisão manual em vez de ser bloqueado como "não aprovado"
    const infraErrorResult: ModerationResult = {
      imageApproved: false,
      moderationFlagged: false,
      moderationCategories: {},
      needsManualReview: true,
      moderationReason: 'Verificação automática indisponível. Revisão manual necessária.',
    };

    try {
      const { data, error } = await supabase.functions.invoke('moderate-image', {
        body: { imageUrl: imageUrl ?? undefined, imageBase64: imageBase64 ?? undefined },
      });

      if (error) {
        console.error('[Sell] Moderation API error:', error);
        return infraErrorResult;
      }

      return data as ModerationResult;
    } catch (error) {
      console.error('[Sell] Moderation error:', error);
      return infraErrorResult;
    }
  };

  // Moderate text (title and description) using Google AI
  const moderateText = async (title: string, description: string): Promise<TextModerationResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('moderate-text', {
        body: { title, description },
      });

      if (error) {
        console.warn('[Sell] Text moderation API error, auto-approving:', error);
        return {
          textApproved: true,
          moderationFlagged: false,
          moderationCategories: {},
          needsManualReview: false,
        };
      }

      return data as TextModerationResult;
    } catch (error) {
      console.warn('[Sell] Text moderation error, auto-approving:', error);
      return {
        textApproved: true,
        moderationFlagged: false,
        moderationCategories: {},
        needsManualReview: false,
      };
    }
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const image = prev.find((img) => img.id === id);
      if (image?.preview && !image.url) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter((img) => img.id !== id);
    });
  };

  // Drag and drop: mouse exige 6px de movimento (preserva o clique nos botões);
  // toque exige press-and-hold de 200ms (preserva o scroll horizontal da faixa)
  const dndSensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleImageDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setImages((prev) => {
      const oldIndex = prev.findIndex((img) => img.id === active.id);
      const newIndex = prev.findIndex((img) => img.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  // Conclui a publicação: faz o UPLOAD (agora, após a decisão de moderação) e
  // grava o produto. Chamado pelo caminho "aprovado" e pelo "Enviar mesmo assim".
  const finishSubmit = async ({ forceReview, reasons }: { forceReview: boolean; reasons: string[] }) => {
    if (!user) return;
    setSubmitting(true);
    try {
      // Upload das imagens (preservando a ordem). Só agora a foto vai ao Storage.
      const uploadResults = await Promise.all(
        images.map(async (img) => {
          if (img.url) return { url: img.url };
          if (!img.file) return null;
          setImages((prev) => prev.map((i) => (i.id === img.id ? { ...i, uploading: true } : i)));
          try {
            const url = await uploadImage(img);
            if (!url) return null;
            setImages((prev) =>
              prev.map((i) => (i.id === img.id ? { ...i, uploading: false, uploaded: true, url } : i)),
            );
            return { url };
          } catch (err) {
            setImages((prev) =>
              prev.map((i) => (i.id === img.id ? { ...i, uploading: false, error: 'Erro no upload' } : i)),
            );
            throw err;
          }
        }),
      );

      const uploadedUrls = uploadResults
        .filter((r): r is { url: string } => !!r)
        .map((r) => r.url);

      if (uploadedUrls.length === 0) {
        throw new Error('Nenhuma imagem foi carregada com sucesso');
      }

      type ProductCategory = 'camiseta' | 'calca' | 'vestido' | 'jaqueta' | 'saia' | 'shorts' | 'blazer' | 'casaco' | 'acessorios' | 'calcados' | 'outros';
      type ProductCondition = 'novo' | 'usado';

      const productData: Record<string, unknown> = {
        title: formData.title.trim(),
        description: formData.description.trim() || 'Sem descrição',
        price: parseFloat(formData.price),
        original_price: formData.originalPrice ? parseFloat(formData.originalPrice) : null,
        size: formData.size || 'Único',
        brand: formData.brand.trim() || 'Sem marca',
        category: formData.category as ProductCategory,
        condition: formData.condition as ProductCondition,
        images: uploadedUrls,
        status: forceReview ? 'pending_review' : 'active',
        moderation_status: forceReview ? 'pending' : 'approved',
        moderated_at: new Date().toISOString(),
        review_notes: null,
        reviewed_by: null,
        moderation_reason: reasons.length > 0 ? reasons.join(' | ') : null,
      };

      if (formData.gender) {
        productData.gender = formData.gender;
      }

      if (isEditMode) {
        const { error: updateError } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editProductId)
          .eq('seller_id', user.id);
        if (updateError) {
          console.error('[Sell] Update error:', updateError);
          throw new Error('Erro ao atualizar produto');
        }
        toast(
          forceReview
            ? { title: 'Anúncio enviado para revisão', description: 'Seu anúncio será revisado pela nossa equipe antes de ser publicado.' }
            : { title: 'Anúncio atualizado! ✓', description: 'As alterações foram salvas.' },
        );
      } else {
        const insertData = {
          ...productData,
          seller_id: user.id,
          seller_latitude: location?.latitude,
          seller_longitude: location?.longitude,
          seller_city: location?.city,
          seller_state: location?.state,
        };
        const { data: createdProduct, error: insertError } = await supabase
          .from('products')
          .insert(insertData as any)
          .select('id')
          .single();
        if (insertError) {
          console.error('[Sell] Insert error:', insertError);
          throw new Error('Erro ao publicar produto');
        }

        // Impulso só em status 'active' — anúncio em revisão preserva o crédito.
        let boostApplied = false;
        if (selectedBoost && createdProduct?.id && !forceReview) {
          const { data: boostData, error: boostError } = await supabase.rpc('activate_product_boost', {
            p_product_id: createdProduct.id,
            p_boost_type: selectedBoost,
          });
          const boostResult = boostData as unknown as { success: boolean; error?: string } | null;
          if (boostError || !boostResult?.success) {
            console.error('[Sell] Boost activation error:', boostError || boostResult?.error);
            toast({ title: 'Anúncio publicado, mas o impulso não foi aplicado', description: 'Seu crédito não foi debitado. Você pode impulsionar em Meus Anúncios.' });
          } else {
            boostApplied = true;
            refetchBoostCredits();
          }
        }

        if (forceReview) {
          toast({
            title: 'Anúncio enviado para revisão 🔍',
            description: selectedBoost
              ? 'Seu anúncio será revisado pela nossa equipe. O impulso não foi debitado — aplique em Meus Anúncios após a aprovação.'
              : 'Seu anúncio será revisado pela nossa equipe e ficará disponível em breve.',
          });
        } else if (boostApplied) {
          toast({ title: 'Produto publicado e impulsionado! 🚀', description: 'Seu anúncio já está disponível no topo dos resultados.' });
        } else {
          toast({ title: 'Produto publicado! 🎉', description: 'Seu anúncio já está disponível.' });
        }
      }

      clearDraft();
      navigate(isEditMode ? '/my-listings' : '/');
    } catch (err) {
      console.error('[Sell] Finish submit error:', err);
      toast({
        title: isEditMode ? 'Erro ao atualizar' : 'Erro ao publicar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      toast({
        title: 'Erro',
        description: 'Você precisa estar logado para publicar.',
        variant: 'destructive',
      });
      return;
    }

    if (!hasLocation && !isEditMode) {
      toast({
        title: 'Localização necessária',
        description: 'Ative sua localização para publicar produtos.',
        variant: 'destructive',
      });
      return;
    }

    if (images.length === 0) {
      toast({
        title: 'Foto obrigatória',
        description: 'Adicione pelo menos uma foto do produto.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    setModerating(true);

    try {
      // Modera ANTES de subir ao Storage (privacidade): usa a versão reduzida
      // (data URL) que já geramos no client. A foto só vai ao Storage depois da
      // decisão — foto trocada nunca é persistida.
      const imageTimeoutFallback: ModerationResult = {
        imageApproved: false,
        moderationFlagged: false,
        moderationCategories: {},
        needsManualReview: true,
        moderationReason: 'Tempo limite na verificação automática da imagem. Revisão manual necessária.',
      };

      // Texto segue a semântica atual de falha do moderateText: auto-aprova
      const textTimeoutFallback: TextModerationResult = {
        textApproved: true,
        moderationFlagged: false,
        moderationCategories: {},
        needsManualReview: false,
      };

      console.log('[Sell] Moderating images (pre-upload) + text in parallel...');

      const [imageModerations, textModerationResult] = await Promise.all([
        Promise.all(
          images.map(async (img) => {
            // Imagens já no Storage e já moderadas (edição) não re-moderam.
            if (img.url && img.moderated) {
              return {
                img,
                result: {
                  imageApproved: true,
                  moderationFlagged: false,
                  moderationCategories: {},
                  needsManualReview: false,
                } as ModerationResult,
              };
            }
            // Novas: gera o base64 reduzido e modera SEM subir. Edição não-moderada: via URL.
            const downscaled = img.file ? await prepareImageForModeration(img.file) : null;
            const result = await withModerationTimeout(
              moderateImage(img.url ?? null, downscaled),
              imageTimeoutFallback,
            );
            return { img, result };
          }),
        ),
        withModerationTimeout(
          moderateText(formData.title.trim(), formData.description.trim()),
          textTimeoutFallback,
        ),
      ]);

      setModerating(false);

      // Texto reprovado (hard-reject) — aborta antes de qualquer upload.
      if (textModerationResult.moderationFlagged) {
        setSubmitting(false);
        const fieldMessage = textModerationResult.flaggedField === 'title'
          ? 'O título do anúncio'
          : textModerationResult.flaggedField === 'description'
            ? 'A descrição do anúncio'
            : 'O título ou descrição do anúncio';
        toast({
          title: 'Texto não aprovado',
          description: `${fieldMessage} não atende às nossas diretrizes de conteúdo. Por favor, revise e tente novamente.`,
          variant: 'destructive',
        });
        return;
      }

      // Destaca a imagem sinalizada para a pessoa trocar.
      const flagImage = (id: string) =>
        setImages((prev) =>
          prev.map((i) =>
            i.id === id ? { ...i, moderated: true, moderationPassed: false, error: 'Revise esta foto' } : i,
          ),
        );

      // Régua de decisão da imagem.
      // TODO: hash-matching (ex. PhotoDNA) neste ponto se o volume justificar —
      // conteúdo claramente explícito não deve ser persistido nem encaminhado.
      const blockEntry = imageModerations.find(
        ({ result }) =>
          result.needsManualReview && (result.categoryScores?.sexual ?? 0) >= SEXUAL_BLOCK_THRESHOLD,
      );
      if (blockEntry) {
        // Sexual de altíssima confiança: NÃO sobe ao Storage, NÃO vai a revisão. Só trocar.
        flagImage(blockEntry.img.id);
        setSubmitting(false);
        setReviewModal({ open: true, mode: 'block', category: blockEntry.result.category });
        return;
      }

      // Agrega motivos / decide se vai para revisão.
      const reasons: string[] = [];
      let forceReview = false;
      for (const { result } of imageModerations) {
        if (result.needsManualReview) {
          forceReview = true;
          if (result.moderationReason) reasons.push(result.moderationReason);
        }
      }
      if (textModerationResult.needsManualReview) {
        forceReview = true;
        if (textModerationResult.moderationReason) reasons.push(textModerationResult.moderationReason);
      }

      // Flag de CONTEÚDO na imagem (tem categoryScores) — distinta do fail-safe de
      // erro (que não traz categoryScores e segue silencioso para revisão).
      const contentReviewEntry = imageModerations.find(
        ({ result }) => result.needsManualReview && !!result.categoryScores,
      );
      if (contentReviewEntry) {
        // Decisão consciente: trocar a foto OU enviar mesmo assim (-> revisão humana).
        flagImage(contentReviewEntry.img.id);
        pendingSubmitRef.current = { forceReview: true, reasons };
        setSubmitting(false);
        setReviewModal({ open: true, mode: 'confirm', category: contentReviewEntry.result.category });
        return;
      }

      // Sem flag de conteúdo (aprovado, revisão por erro/timeout, ou texto em
      // revisão): segue. Erro de moderação NÃO bloqueia — vai p/ revisão silenciosa.
      await finishSubmit({ forceReview, reasons });
    } catch (err) {
      console.error('[Sell] Submit error:', err);
      toast({
        title: isEditMode ? 'Erro ao atualizar' : 'Erro ao publicar',
        description: err instanceof Error ? err.message : 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
      setModerating(false);
    }
  };

  const sizeOptional = formData.category ? isSizeOptional(formData.category) : false;
  const isFormValid =
    images.length > 0 &&
    formData.title.trim() &&
    formData.price &&
    parseFloat(formData.price) > 0 &&
    (formData.size || sizeOptional) &&
    formData.category &&
    formData.condition &&
    formData.gender &&
    (hasLocation || isEditMode);

  const locationDisplay = hasLocation && location
    ? `${location.city || 'Sua região'}${location.state ? `, ${location.state}` : ''}`
    : null;

  if (loadingProduct) {
    return (
      <AppLayout showHeader={false}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout showHeader={false}>
      <div className="px-4 py-6 pb-28 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          {isEditMode && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
          )}
          <div className="space-y-1">
            <h1 className="font-display text-3xl font-semibold text-foreground">
              {isEditMode ? 'Editar Anúncio' : 'Vender'}
            </h1>
            <p className="text-muted-foreground">
              {isEditMode ? 'Atualize os dados do seu anúncio' : 'Publique sua peça em minutos'}
            </p>
          </div>
        </div>

        {/* Location Status - Only show for new listings */}
        {!isEditMode && (
          <div className={cn(
            'p-4 rounded-xl flex items-start gap-3',
            hasLocation ? 'bg-primary/5 border border-primary/20' : 'bg-destructive/5 border border-destructive/20'
          )}>
            <MapPin className={cn(
              'w-5 h-5 flex-shrink-0 mt-0.5',
              hasLocation ? 'text-primary' : 'text-destructive'
            )} />
            <div className="flex-1 space-y-2">
              {hasLocation ? (
                <>
                  <p className="text-sm font-medium text-foreground">
                    Localização detectada
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {locationDisplay} — Seu produto será exibido para compradores próximos.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">
                    Localização necessária
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Ative sua localização para publicar. Isso ajuda compradores próximos a encontrar seu produto.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => requestLocation()}
                    disabled={locationLoading}
                    className="mt-1"
                  >
                    {locationLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Obtendo...
                      </>
                    ) : (
                      'Ativar localização'
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Image Upload */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-base font-medium">
              Fotos <span className="text-destructive">*</span>
            </Label>
            <button
              type="button"
              onClick={() => setShowPhotoTips(prev => !prev)}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
              aria-label="Dicas de foto"
            >
              <Info className="w-3.5 h-3.5" />
              Dicas para boas fotos
            </button>
          </div>
          
          {showPhotoTips && (
            <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/15 space-y-2 animate-fade-up">
              <p className="text-xs font-semibold text-foreground">📸 Dicas para boas fotos:</p>
              <ul className="text-[11px] text-muted-foreground space-y-1.5 list-none">
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Use <strong>luz natural</strong> — evite flash e ambientes escuros</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Fotografe sobre um <strong>fundo limpo</strong> (parede branca, mesa organizada)</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Mostre a <strong>peça inteira</strong> — frente, costas e detalhes (etiqueta, defeitos)</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">✓</span>
                  <span>Mantenha a câmera <strong>estável e alinhada</strong> — evite fotos tortas ou borradas</span>
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-destructive mt-0.5">✗</span>
                  <span>Não envie <strong>screenshots</strong>, fotos de catálogo ou imagens com filtros pesados</span>
                </li>
              </ul>
            </div>
          )}
          <DndContext
            sensors={dndSensors}
            collisionDetection={closestCenter}
            onDragEnd={handleImageDragEnd}
          >
            <SortableContext items={images.map((img) => img.id)} strategy={horizontalListSortingStrategy}>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
                {images.map((img, index) => (
                  <SortableImageTile
                    key={img.id}
                    img={img}
                    index={index}
                    submitting={submitting}
                    onRemove={removeImage}
                  />
                ))}

                {images.length < 5 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={submitting}
                    className="flex-shrink-0 w-28 h-28 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-olive-warm/50 transition-colors disabled:opacity-50"
                  >
                    <Camera className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Adicionar</span>
                  </button>
                )}
              </div>
            </SortableContext>
          </DndContext>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <p className="text-xs text-muted-foreground">
            Adicione até 5 fotos e arraste para reordenar — a primeira será a capa. Máx. 5MB por foto.
          </p>
        </div>

        {/* Form Fields */}
        <div className="space-y-5">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">
              Nome da peça <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Blazer Vintage Linho"
              className="input-premium"
              maxLength={100}
              disabled={submitting}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva os detalhes da peça, materiais, medidas..."
              className="input-premium min-h-[100px] resize-none"
              maxLength={1000}
              disabled={submitting}
            />
          </div>

          {/* Price */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">
                Preço <span className="text-destructive">*</span>
              </Label>
              <CurrencyInput
                id="price"
                value={formData.price}
                onChange={(value) => setFormData({ ...formData, price: value })}
                placeholder="0,00"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="originalPrice">Preço original</Label>
              <CurrencyInput
                id="originalPrice"
                value={formData.originalPrice}
                onChange={(value) => setFormData({ ...formData, originalPrice: value })}
                placeholder="0,00"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Category - Must be selected first to determine sizes */}
          <div className="space-y-2">
            <Label>
              Categoria <span className="text-destructive">*</span>
            </Label>
            <Select
              value={formData.category}
              onValueChange={(value) => setFormData({ ...formData, category: value, size: '' })}
              disabled={submitting}
            >
              <SelectTrigger className="input-premium">
                <SelectValue placeholder="Selecionar categoria" />
              </SelectTrigger>
              <SelectContent className="bg-popover">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  return (
                    <SelectItem key={cat.id} value={cat.id}>
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {cat.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Size and Brand */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Tamanho {!sizeOptional && <span className="text-destructive">*</span>}
                {sizeOptional && <span className="text-xs text-muted-foreground ml-1">(opcional)</span>}
              </Label>
              <Select
                value={formData.size}
                onValueChange={(value) => setFormData({ ...formData, size: value })}
                disabled={submitting || !formData.category}
              >
                <SelectTrigger className="input-premium">
                  <SelectValue placeholder={formData.category ? "Selecionar" : "Escolha a categoria"} />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {(formData.category ? getSizesForCategory(formData.category) : []).map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Marca</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="Ex: Zara"
                className="input-premium"
                maxLength={50}
                disabled={submitting}
              />
            </div>
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <Label>
              Gênero <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {genderOptions.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setFormData({ ...formData, gender: g.id })}
                  disabled={submitting}
                  className={cn(
                    'p-3 rounded-xl text-sm font-medium text-center transition-all disabled:opacity-50',
                    formData.gender === g.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border/50 hover:border-primary/50'
                  )}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Condition */}
          <div className="space-y-2">
            <Label>
              Estado <span className="text-destructive">*</span>
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {conditions.map((cond) => (
                <button
                  key={cond.id}
                  onClick={() => setFormData({ ...formData, condition: cond.id })}
                  disabled={submitting}
                  className={cn(
                    'p-3 rounded-xl text-sm font-medium text-center transition-all disabled:opacity-50',
                    formData.condition === cond.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border/50 hover:border-primary/50'
                  )}
                >
                  {cond.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Boost: aplicar crédito do saldo ou upsell quando não há créditos */}
        {!isEditMode && (
          totalCredits > 0 && boostCredits ? (
            <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.04] to-transparent p-4 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug">
                    Impulsionar este anúncio
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Você tem {totalCredits} {totalCredits === 1 ? 'impulso disponível' : 'impulsos disponíveis'}. Use um agora e apareça no topo.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {boostOptions.map((option) => {
                  const available = boostCredits[option.type];
                  const hasCredit = available > 0;
                  const isSelected = selectedBoost === option.type;
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.type}
                      type="button"
                      disabled={submitting}
                      // Sem crédito desse tipo: leva para a compra do impulso (aba já selecionada)
                      onClick={() =>
                        hasCredit
                          ? setSelectedBoost(isSelected ? null : option.type)
                          : navigate(`/boosts?type=${option.type}`)
                      }
                      aria-label={hasCredit
                        ? `Impulsionar por ${option.label}`
                        : `Comprar impulso de ${option.label}`}
                      className={cn(
                        'p-3 rounded-xl text-center transition-all disabled:opacity-40 tap-feedback',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-card border border-border/50 hover:border-primary/50'
                      )}
                    >
                      <Icon className={cn('w-4 h-4 mx-auto mb-1', isSelected ? 'text-primary-foreground' : 'text-primary')} />
                      <p className="text-xs font-medium leading-tight">{option.label}</p>
                      {hasCredit ? (
                        <p className={cn('text-[10px] mt-0.5', isSelected ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
                          {available}× {available === 1 ? 'disponível' : 'disponíveis'}
                        </p>
                      ) : (
                        <p className="text-[10px] mt-0.5 text-primary font-medium">Comprar</p>
                      )}
                    </button>
                  );
                })}
              </div>
              {selectedBoost && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  O impulso de {boostOptions.find(o => o.type === selectedBoost)?.label} será debitado do seu saldo e aplicado assim que o anúncio for publicado.
                </p>
              )}
            </div>
          ) : (
            <div
              className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.04] to-transparent p-4 cursor-pointer group transition-all hover:border-primary/25"
              onClick={() => navigate('/boosts')}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Zap className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug">
                    Quer vender mais rápido?
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Anúncios com destaque recebem até 5x mais visualizações. Conheça nossos planos de impulso.
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground/60 flex-shrink-0 mt-1 group-hover:text-primary transition-colors" />
              </div>
            </div>
          )
        )}

        {/* Submit Button */}
        <div className="fixed bottom-20 left-0 right-0 p-4 glass-effect border-t border-border/30">
          <Button
            className="w-full btn-primary h-14"
            disabled={!isFormValid || submitting || moderating}
            onClick={handleSubmit}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {moderating ? 'Verificando imagens...' : (isEditMode ? 'Salvando...' : 'Publicando...')}
              </>
            ) : (
              <>
                {isEditMode ? (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Salvar alterações
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5 mr-2" />
                    Publicar anúncio
                  </>
                )}
              </>
            )}
          </Button>
        </div>
      </div>

      <ImageModerationModal
        open={reviewModal.open}
        mode={reviewModal.mode}
        category={reviewModal.category}
        onOpenChange={(o) => setReviewModal((m) => ({ ...m, open: o }))}
        onReplace={() => {
          // Não envia: a foto sinalizada já está destacada para a pessoa trocar.
          pendingSubmitRef.current = null;
          setReviewModal((m) => ({ ...m, open: false }));
        }}
        onSendAnyway={async () => {
          const ctx = pendingSubmitRef.current;
          pendingSubmitRef.current = null;
          setReviewModal((m) => ({ ...m, open: false }));
          if (ctx) await finishSubmit(ctx);
        }}
      />
    </AppLayout>
  );
}
