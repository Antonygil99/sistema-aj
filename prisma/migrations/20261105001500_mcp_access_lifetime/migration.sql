-- Provider resource seeding is insert-only. Upgrade the existing AJ policy as well as new installations.
UPDATE "OauthResource"
SET "accessTokenTtl" = 3600,
    "policyVersion" = COALESCE("policyVersion", 1) + 1,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "identifier" = 'https://crm.segurosaleyjoel.com/mcp'
  AND "accessTokenTtl" = 300;
