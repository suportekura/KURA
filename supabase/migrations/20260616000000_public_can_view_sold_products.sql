-- Permite que qualquer um (anon/authenticated) veja produtos VENDIDOS de
-- vendedores nao suspensos.
--
-- Bug: a aba "Vendidos" no perfil publico voltava sempre vazia/zerada e sem
-- imagens. As policies de products so liberavam SELECT para status 'active' e
-- 'reserved' ao publico; nada permitia 'sold' para visitantes. Logo, tanto a
-- contagem (count) quanto a listagem de produtos vendidos eram bloqueadas pela
-- RLS para quem nao fosse o proprio vendedor.
--
-- Espelha exatamente as policies "Public can view active/reserved products":
-- esconde produtos de vendedores suspensos.
DROP POLICY IF EXISTS "Public can view sold products" ON public.products;
CREATE POLICY "Public can view sold products"
ON public.products FOR SELECT
USING (
  status = 'sold'
  AND NOT EXISTS (
    SELECT 1 FROM public.profiles pr
    WHERE pr.user_id = products.seller_id
      AND pr.suspended_at IS NOT NULL
  )
);
