export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  size: string;
  brand: string;
  category: ProductCategory;
  condition: ProductCondition;
  images: string[];
  sellerId: string;
  sellerName: string;
  sellerAvatar: string;
  // Reputation data (replaces sellerRating)
  sellerReviewsCount: number;
  sellerReviewsSum: number;
  sellerPlanType?: string | null;
  distance: number; // in km
  city: string;
  createdAt: Date;
  isFavorite?: boolean;
  isBoosted?: boolean;
}

export type ProductCategory = 
  | 'camiseta'
  | 'calca'
  | 'vestido'
  | 'jaqueta'
  | 'saia'
  | 'shorts'
  | 'blazer'
  | 'casaco'
  | 'acessorios'
  | 'calcados'
  | 'camisa'
  | 'bolsas_carteiras'
  | 'bodies'
  | 'roupas_intimas'
  | 'moda_praia'
  | 'roupas_esportivas'
  | 'bones_chapeus'
  | 'oculos'
  | 'lencos_cachecois'
  | 'roupas_infantis'
  | 'outros';

export type ProductCondition = 'novo' | 'usado';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  city: string;
  rating: number;
  totalSales: number;
  totalPurchases: number;
  memberSince: Date;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  productId: string;
  content: string;
  createdAt: Date;
  read: boolean;
}

export interface Conversation {
  id: string;
  productId: string;
  productTitle: string;
  productImage: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string;
  lastMessage: string;
  lastMessageAt: Date;
  unreadCount: number;
}

export type SortOption = 'distance' | 'price_asc' | 'price_desc' | 'newest';

export type ProductGender = 'M' | 'F' | 'U';

export interface FilterOptions {
  category?: ProductCategory;
  sizes?: string[];
  brands?: string[];
  priceMin?: number;
  priceMax?: number;
  condition?: ProductCondition[];
  maxDistance?: number;
  gender?: ProductGender;
}
