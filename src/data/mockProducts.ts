import {
  Shirt,
  ShoppingBag,
  Sparkles,
  Umbrella,
  CircleDot,
  Scissors,
  Award,
  CloudSnow,
  Gem,
  Footprints,
  BookOpen,
  Briefcase,
  Heart,
  Shield,
  Waves,
  Dumbbell,
  Crown,
  Glasses,
  Ribbon,
  Baby
} from 'lucide-react';

// Categories with Lucide icons (no emojis)
export const categories = [
  { id: 'acessorios', label: 'Acessórios', icon: Gem },
  { id: 'blazer', label: 'Blazers', icon: Award },
  { id: 'bodies', label: 'Bodies', icon: Heart },
  { id: 'bolsas_carteiras', label: 'Bolsas & Carteiras', icon: Briefcase },
  { id: 'bones_chapeus', label: 'Bonés & Chapéus', icon: Crown },
  { id: 'calcados', label: 'Calçados', icon: Footprints },
  { id: 'calca', label: 'Calças', icon: CircleDot },
  { id: 'camisa', label: 'Camisas', icon: BookOpen },
  { id: 'camiseta', label: 'Camisetas', icon: Shirt },
  { id: 'casaco', label: 'Casacos', icon: CloudSnow },
  { id: 'jaqueta', label: 'Jaquetas', icon: Umbrella },
  { id: 'lencos_cachecois', label: 'Lenços & Cachecóis', icon: Ribbon },
  { id: 'moda_praia', label: 'Moda Praia', icon: Waves },
  { id: 'oculos', label: 'Óculos', icon: Glasses },
  { id: 'outros', label: 'Outros', icon: ShoppingBag },
  { id: 'roupas_esportivas', label: 'Roupas Esportivas', icon: Dumbbell },
  { id: 'roupas_infantis', label: 'Roupas Infantis', icon: Baby },
  { id: 'roupas_intimas', label: 'Roupas Íntimas', icon: Shield },
  { id: 'saia', label: 'Saias', icon: Scissors },
  { id: 'shorts', label: 'Shorts', icon: CircleDot },
  { id: 'vestido', label: 'Vestidos', icon: Sparkles },
];

// Size mappings per category
export const sizesByProductCategory: Record<string, string[]> = {
  camiseta: ['PP', 'P', 'M', 'G', 'GG', 'XGG', 'G1', 'G2', 'G3', 'Baby Look'],
  camisa: ['PP', 'P', 'M', 'G', 'GG', 'XGG', 'G1', 'G2', 'G3'],
  calca: ['36', '38', '40', '42', '44', '46', '48', '50', '52', 'Plus Size'],
  vestido: ['PP', 'P', 'M', 'G', 'GG', 'XGG', 'Plus Size', 'Gestante'],
  jaqueta: ['PP', 'P', 'M', 'G', 'GG', 'XGG', 'G1', 'G2', 'G3'],
  saia: ['PP', 'P', 'M', 'G', 'GG', 'XGG', 'Plus Size'],
  shorts: ['PP', 'P', 'M', 'G', 'GG', 'XGG', '36', '38', '40', '42', '44', '46'],
  blazer: ['PP', 'P', 'M', 'G', 'GG', 'XGG', '36', '38', '40', '42', '44', '46', '48'],
  casaco: ['PP', 'P', 'M', 'G', 'GG', 'XGG', 'G1', 'G2', 'G3'],
  bodies: ['PP', 'P', 'M', 'G', 'GG', 'XGG'],
  roupas_intimas: ['PP', 'P', 'M', 'G', 'GG', 'XGG'],
  moda_praia: ['PP', 'P', 'M', 'G', 'GG', 'XGG', 'Plus Size'],
  roupas_esportivas: ['PP', 'P', 'M', 'G', 'GG', 'XGG', 'G1', 'G2'],
  bolsas_carteiras: ['Único'],
  bones_chapeus: ['Único', 'P', 'M', 'G'],
  oculos: ['Único'],
  lencos_cachecois: ['Único'],
  acessorios: ['Único', 'PP', 'P', 'M', 'G', 'GG'],
  calcados: ['33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45'],
  roupas_infantis: ['RN', '1-3m', '3-6m', '6-9m', '9-12m', '1ano', '2anos', '3anos', '4anos', '6anos', '8anos', '10anos', '12anos', '14anos', '16anos'],
};

// Categories where size is optional
export const optionalSizeCategories = ['bolsas_carteiras', 'oculos', 'lencos_cachecois', 'bones_chapeus'];

// Helper to get sizes for a given category
export function getSizesForCategory(categoryId: string): string[] {
  return sizesByProductCategory[categoryId] || ['PP', 'P', 'M', 'G', 'GG', 'XGG'];
}

// Check if size is optional for a category
export function isSizeOptional(categoryId: string): boolean {
  return optionalSizeCategories.includes(categoryId);
}

// Universal sizes (when no category is selected in filters)
export const sizes = ['PP', 'P', 'M', 'G', 'GG', 'XGG'];

export const conditions = [
  { id: 'novo', label: 'Novo' },
  { id: 'usado', label: 'Usado' },
];
