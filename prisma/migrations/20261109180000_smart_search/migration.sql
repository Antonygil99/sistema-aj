CREATE FUNCTION public.aj_search_fold(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
 SELECT trim(regexp_replace(regexp_replace(lower(normalize(coalesce(value, ''), NFD)), U&'[\0300-\036f]', '', 'g'), '[^a-z0-9]+', ' ', 'g'))
$$;
CREATE FUNCTION public.aj_search_compact(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT replace(public.aj_search_fold(value), ' ', '') $$;
