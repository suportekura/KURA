-- Marca o(s) produto(s) de um pedido como 'sold' quando o pedido e entregue.
--
-- Bug: em "Meus Anuncios" o produto ficava preso em 'reserved' ("Em negociacao")
-- mesmo apos a venda concluida. O fluxo so transicionava active -> reserved (ao
-- pedir) e reserved -> active (ao cancelar); nada nunca marcava reserved -> sold
-- quando o pedido era entregue.

CREATE OR REPLACE FUNCTION public.handle_order_delivered_mark_sold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Ao entregar o pedido, todos os produtos do pedido (order_items) viram vendidos.
  IF NEW.status = 'delivered' AND OLD.status IS DISTINCT FROM 'delivered' THEN
    UPDATE public.products p
    SET status = 'sold', updated_at = now()
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
      AND p.id = oi.product_id
      AND p.status <> 'sold';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_order_delivered_mark_sold ON public.orders;
CREATE TRIGGER on_order_delivered_mark_sold
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_delivered_mark_sold();

-- Backfill: corrige produtos ja entregues que ficaram presos em 'reserved'.
-- A notificacao "item favorito foi vendido" e desativada durante o backfill para
-- nao disparar avisos retroativos de vendas antigas. O clear_queue segue ativo.
ALTER TABLE public.products DISABLE TRIGGER on_product_sold_notify_favorites;

UPDATE public.products p
SET status = 'sold', updated_at = now()
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
WHERE p.id = oi.product_id
  AND o.status = 'delivered'
  AND p.status = 'reserved';

ALTER TABLE public.products ENABLE TRIGGER on_product_sold_notify_favorites;
