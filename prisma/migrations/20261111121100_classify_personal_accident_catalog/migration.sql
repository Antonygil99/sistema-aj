-- The explicit catalog category is authoritative; do not mix these products with GMM.
UPDATE "Product" SET line='ACCIDENT'
WHERE line='OTHER' AND upper(name) LIKE 'ACCIDENTES Y ENFERMEDADES%ACCIDENTES PERSONALES%';
UPDATE "Policy" p SET line='ACCIDENT' FROM "Product" c
WHERE p."productId"=c.id AND c.line='ACCIDENT' AND p.line='OTHER';
