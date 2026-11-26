-- Unify branch vehicle-type vocabulary: legacy 'bike' -> 'motorcycle'.
-- Machines and wash packages already use 'motorcycle'; this aligns branches with them.
UPDATE "branches" SET "type" = 'motorcycle' WHERE "type" = 'bike';

-- Also normalize any machines that may have used the legacy 'bike' value.
UPDATE "machines" SET "type" = 'motorcycle' WHERE "type" = 'bike';
