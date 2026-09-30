CREATE OR REPLACE FUNCTION public.reserve_stock(p_product_id UUID, p_qty INT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_updated INT;
BEGIN
  UPDATE public.product_stock
  SET reserved_stock = reserved_stock + p_qty
  WHERE product_id = p_product_id AND available_stock >= p_qty;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END; $$;
