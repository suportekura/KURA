import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Camera, Plus, X, Loader2, MapPin, AlertCircle, CheckCircle, ArrowLeft, Save, ShieldAlert, Zap, ChevronRight, Info } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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

  // Moderate image using Google AI
  const moderateImage = async (imageUrl: string): Promise<ModerationResult> => {
    try {
      const { data, error } = await supabase.functions.invoke('moderate-image', {
        body: { imageUrl },
      });

      if (error) {
        console.error('[Sell] Moderation API error:', error);
        return {
          imageApproved: false,
          moderationFlagged: true,
          moderationCategories: {},
          error: error.message || 'Erro ao verificar imagem',
        };
      }

      return data as ModerationResult;
    } catch (error) {
      console.error('[Sell] Moderation error:', error);
      return {
        imageApproved: false,
        moderationFlagged: true,
        moderationCategories: {},
        error: 'Erro ao conectar com o serviço de moderação',
      };
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
      // Step 1: Upload only new images (those without url)
      const uploadedUrls: string[] = [];
      const newImageUrls: string[] = [];
      
      for (const img of images) {
        if (img.url) {
          // Already uploaded image (from edit mode)
          uploadedUrls.push(img.url);
          // Only moderate if not previously moderated
          if (!img.moderated) {
            newImageUrls.push(img.url);
          }
        } else if (img.file) {
          // New image to upload
          setImages((prev) =>
            prev.map((i) => (i.id === img.id ? { ...i, uploading: true } : i))
          );

          try {
            const url = await uploadImage(img);
            if (url) {
              uploadedUrls.push(url);
              newImageUrls.push(url);
              setImages((prev) =>
                prev.map((i) =>
                  i.id === img.id ? { ...i, uploading: false, uploaded: true, url } : i
                )
              );
            }
          } catch (err) {
            setImages((prev) =>
              prev.map((i) =>
                i.id === img.id
                  ? { ...i, uploading: false, error: 'Erro no upload' }
                  : i
              )
            );
            throw err;
          }
        }
      }

      if (uploadedUrls.length === 0) {
        throw new Error('Nenhuma imagem foi carregada com sucesso');
      }

      // Step 2: Moderate new images
      let needsManualReview = false;
      const moderationReasons: string[] = [];
      
      if (newImageUrls.length > 0) {
        console.log('[Sell] Moderating', newImageUrls.length, 'images...');
        
        for (const imageUrl of newImageUrls) {
          const moderationResult = await moderateImage(imageUrl);
          
          // Check for hard rejection (flagged content)
          if (moderationResult.moderationFlagged) {
            setModerating(false);
            setSubmitting(false);
            
            // Get specific error message based on category
            const errorMessage = getModerationErrorMessage(
              moderationResult.moderationCategories,
              moderationResult.reason
            );
            
            toast({
              title: errorMessage.title,
              description: errorMessage.description,
              variant: 'destructive',
            });
            
            // Get short error label for image overlay
            const shortError = moderationResult.moderationCategories.screenshot ? 'Screenshot'
              : moderationResult.moderationCategories.heavily_edited ? 'Muito editada'
              : moderationResult.moderationCategories.not_product ? 'Não é produto'
              : moderationResult.moderationCategories.low_quality ? 'Baixa qualidade'
              : 'Não permitido';
            
            setImages((prev) =>
              prev.map((i) =>
                i.url === imageUrl
                  ? { ...i, moderated: true, moderationPassed: false, error: shortError }
                  : i
              )
            );
            
            return;
          }
          
          // Check for low confidence (needs manual review)
          if (moderationResult.needsManualReview) {
            needsManualReview = true;
            if (moderationResult.moderationReason) moderationReasons.push(moderationResult.moderationReason);
            console.log('[Sell] Image needs manual review due to low confidence:', moderationResult.confidenceScore);
          }
          
          // Mark image as passed moderation
          setImages((prev) =>
            prev.map((i) =>
              i.url === imageUrl
                ? { ...i, moderated: true, moderationPassed: true }
                : i
            )
          );
        }
        
        console.log('[Sell] Image moderation complete, needsManualReview:', needsManualReview);
      }

      // Step 2.5: Moderate text (title and description)
      console.log('[Sell] Moderating text content...');
      const textModerationResult = await moderateText(
        formData.title.trim(),
        formData.description.trim()
      );

      // Check for hard rejection
      if (textModerationResult.moderationFlagged) {
        setModerating(false);
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

      // Check for low confidence on text
      if (textModerationResult.needsManualReview) {
        needsManualReview = true;
        if (textModerationResult.moderationReason) moderationReasons.push(textModerationResult.moderationReason);
        console.log('[Sell] Text needs manual review due to low confidence:', textModerationResult.confidenceScore);
      }

      console.log('[Sell] Text content passed moderation');
      setModerating(false);

      // Step 3: Save product to database
      type ProductCategory = 'camiseta' | 'calca' | 'vestido' | 'jaqueta' | 'saia' | 'shorts' | 'blazer' | 'casaco' | 'acessorios' | 'calcados' | 'outros';
      type ProductCondition = 'novo' | 'usado';

      // Determine the product status based on moderation results
      const productStatus = needsManualReview ? 'pending_review' : 'active';

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
        status: productStatus,
        moderation_status: needsManualReview ? 'pending' : 'approved',
        moderated_at: new Date().toISOString(),
        // Clear rejection notes when resubmitting
        review_notes: null,
        reviewed_by: null,
        moderation_reason: moderationReasons.length > 0 ? moderationReasons.join(' | ') : null,
      };

      // Add gender field if it exists in DB (migration may not be applied yet)
      if (formData.gender) {
        productData.gender = formData.gender;
      }

      if (isEditMode) {
        // Update existing product
        const { error: updateError } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editProductId)
          .eq('seller_id', user.id);

        if (updateError) {
          console.error('[Sell] Update error:', updateError);
          throw new Error('Erro ao atualizar produto');
        }

        if (needsManualReview) {
          toast({
            title: 'Anúncio enviado para revisão',
            description: 'Seu anúncio será revisado pela nossa equipe antes de ser publicado.',
          });
        } else {
          toast({
            title: 'Anúncio atualizado! ✓',
            description: 'As alterações foram salvas.',
          });
        }
      } else {
        // Create new product
        const insertData = {
          ...productData,
          seller_id: user.id,
          seller_latitude: location?.latitude,
          seller_longitude: location?.longitude,
          seller_city: location?.city,
          seller_state: location?.state,
        };
        
        const { error: insertError } = await supabase.from('products').insert(insertData as any);

        if (insertError) {
          console.error('[Sell] Insert error:', insertError);
          throw new Error('Erro ao publicar produto');
        }

        if (needsManualReview) {
          toast({
            title: 'Anúncio enviado para revisão 🔍',
            description: 'Seu anúncio será revisado pela nossa equipe e ficará disponível em breve.',
          });
        } else {
          toast({
            title: 'Produto publicado! 🎉',
            description: 'Seu anúncio já está disponível.',
          });
        }
      }

      // Clear draft and navigate back
      clearDraft();
      navigate(isEditMode ? '/my-listings' : '/');
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
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
            {images.map((img, index) => (
              <div
                key={img.id}
                className={cn(
                  "relative flex-shrink-0 w-28 h-28 rounded-xl overflow-hidden",
                  img.moderationPassed === false && "ring-2 ring-destructive"
                )}
              >
                <img src={img.preview} alt="" className="w-full h-full object-cover" />
                
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
                    onClick={() => removeImage(img.id)}
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
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <p className="text-xs text-muted-foreground">
            Adicione até 5 fotos. A primeira será a principal. Máx. 5MB por foto.
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

        {/* Boost Nudge - subtle upsell */}
        {!isEditMode && (
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
    </AppLayout>
  );
}
