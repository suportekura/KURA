-- orders.product_id era NOT NULL, mas a FK usa ON DELETE SET NULL.
-- A contradição impedia excluir qualquer produto que já tivesse pedido
-- (o SET NULL violava a constraint NOT NULL).
-- O histórico do pedido permanece preservado no snapshot de order_items.

ALTER TABLE public.orders ALTER COLUMN product_id DROP NOT NULL;
