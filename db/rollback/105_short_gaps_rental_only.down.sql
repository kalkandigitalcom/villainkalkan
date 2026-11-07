-- ===============================================================
-- 105 GERİ ALMA — refresh_villa_short_gaps() 055 gövdesine döner
-- ===============================================================
-- listed_for_rent koşulunu kaldırır (055 ile BİREBİR gövde).
-- ⚠️ 103 geri alınacaksa bu dosya ÖNCE uygulanmalıdır; aksi hâlde
--    fonksiyon çalışırken listed_for_rent kolonunu bulamaz.
-- Tablolara dokunmaz; villa_short_gaps bir sonraki cron'da yenilenir.
-- ===============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.refresh_villa_short_gaps()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_today date := current_date;
  v_horizon date := (current_date + interval '6 months')::date;
  v_count integer;
BEGIN
  -- Tam yeniden hesap: önce temizle, sonra doldur (tek transaction).
  -- 055 FIX: WHERE'siz DELETE sql_safe_updates ile reddediliyordu →
  -- TRUNCATE (safe-updates'ten muaf + bloat-free full rebuild).
  TRUNCATE TABLE public.villa_short_gaps;

  WITH blocks AS (
    SELECT r.villa_id, r.start_date, r.end_date
      FROM public.reservations r
     WHERE r.status IN ('pending','confirmed')
       AND r.end_date   > v_today
       AND r.start_date < v_horizon
    UNION ALL
    SELECT m.villa_id, m.start_date, m.end_date
      FROM public.manual_reservations m
     WHERE m.end_date   > v_today
       AND m.start_date < v_horizon
    UNION ALL
    SELECT e.villa_id, e.start_date, e.end_date
      FROM public.external_calendar_events e
     WHERE e.is_active = true
       AND e.end_date   > v_today
       AND e.start_date < v_horizon
  ),
  -- Ada başlangıcı işaretle: önceki tüm satırların max(end) >= start ise
  -- aynı ada (örtüşme/bitişiklik), değilse yeni ada.
  flagged AS (
    SELECT villa_id, start_date, end_date,
      CASE WHEN max(end_date) OVER (
             PARTITION BY villa_id
             ORDER BY start_date, end_date
             ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
           ) >= start_date
        THEN 0 ELSE 1 END AS is_new_island
    FROM blocks
  ),
  islanded AS (
    SELECT villa_id, start_date, end_date,
      sum(is_new_island) OVER (
        PARTITION BY villa_id
        ORDER BY start_date, end_date
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS island_id
    FROM flagged
  ),
  islands AS (
    SELECT villa_id, island_id,
           min(start_date) AS island_start,
           max(end_date)   AS island_end
      FROM islanded
     GROUP BY villa_id, island_id
  ),
  gaps AS (
    SELECT villa_id,
           island_end AS gap_start,
           lead(island_start) OVER (
             PARTITION BY villa_id ORDER BY island_start
           ) AS gap_end
      FROM islands
  )
  INSERT INTO public.villa_short_gaps
    (villa_id, gap_start, gap_end, gap_nights, bucket_month)
  SELECT g.villa_id, g.gap_start, g.gap_end,
         (g.gap_end - g.gap_start) AS gap_nights,
         date_trunc('month', g.gap_start)::date AS bucket_month
    FROM gaps g
    JOIN public.villa v ON v.id = g.villa_id
   WHERE g.gap_end IS NOT NULL                       -- iki tarafı da ada → iç boşluk
     AND (g.gap_end - g.gap_start) BETWEEN 2 AND 6   -- kova 2..6
     AND g.gap_start >= v_today                      -- geçmiş boşluk yok
     AND g.gap_end   <= v_horizon                    -- ufuk içi
     AND v.is_active = true                          -- yalnız yayında villalar
     AND v.deleted_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.refresh_villa_short_gaps() IS NULL;

COMMIT;
