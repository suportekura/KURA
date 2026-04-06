import { Check, X, Tag, Clock, ArrowRight, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Offer } from '@/hooks/useOffers';

interface OfferCardProps {
  offer: Offer;
  isOwn: boolean;
  onAccept?: () => void;
  onReject?: () => void;
  onCounter?: () => void;
  productPrice: number;
}

export function OfferCard({
  offer,
  isOwn,
  onAccept,
  onReject,
  onCounter,
  productPrice,
}: OfferCardProps) {
  const isPending = offer.status === 'pending';
  const isExpired = new Date(offer.expires_at) < new Date() && isPending;
  const discount = ((productPrice - offer.amount) / productPrice) * 100;
  const isCounterOffer = !!offer.parent_offer_id;

  const getStatusBadge = () => {
    if (isExpired) {
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <Clock className="w-3 h-3 mr-1" />
          Expirada
        </Badge>
      );
    }

    switch (offer.status) {
      case 'accepted':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-500 border-emerald-500/30">
            <CheckCircle className="w-3 h-3 mr-1" />
            Aceita
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="outline" className="text-destructive border-destructive/30">
            <XCircle className="w-3 h-3 mr-1" />
            Recusada
          </Badge>
        );
      case 'countered':
        return (
          <Badge variant="outline" className="text-amber-500 border-amber-500/30">
            <ArrowRight className="w-3 h-3 mr-1" />
            Contra-oferta
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-primary border-primary/30">
            <Clock className="w-3 h-3 mr-1" />
            Aguardando
          </Badge>
        );
    }
  };

  return (
    <div
      className={cn(
        'w-full max-w-[280px] rounded-xl border p-4',
        isOwn
          ? 'bg-primary/5 border-primary/20 ml-auto'
          : 'bg-card border-border'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium">
            {isCounterOffer ? 'Contra-oferta' : 'Oferta'}
          </span>
        </div>
        {getStatusBadge()}
      </div>

      {/* Amount */}
      <div className="mb-3">
        <p className="text-2xl font-bold text-primary">
          R$ {offer.amount.toFixed(2)}
        </p>
        {discount > 0 && (
          <p className="text-xs text-muted-foreground">
            {discount.toFixed(0)}% abaixo do preço original
          </p>
        )}
      </div>

      {/* Actions for pending offers (only for receiver) */}
      {isPending && !isExpired && !isOwn && (
        <div className="flex gap-2 mb-3">
          <Button
            size="sm"
            onClick={onAccept}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
          >
            <Check className="w-4 h-4 mr-1" />
            Aceitar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onReject}
            className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            <X className="w-4 h-4 mr-1" />
            Recusar
          </Button>
        </div>
      )}

      {/* Counter offer button */}
      {isPending && !isExpired && !isOwn && onCounter && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onCounter}
          className="w-full text-xs text-muted-foreground hover:text-primary"
        >
          <ArrowRight className="w-3 h-3 mr-1" />
          Fazer contra-oferta
        </Button>
      )}

      {/* Timestamp */}
      <p className="text-[10px] text-muted-foreground text-right mt-2">
        {formatDistanceToNow(new Date(offer.created_at), {
          addSuffix: true,
          locale: ptBR,
        })}
      </p>
    </div>
  );
}
