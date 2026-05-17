-- PN4: rename ChampionPatchChange -> PatchChange, rename championKey -> subject,
-- add section column (default 'champion' so existing PN1-PN3 rows are preserved).
-- Hand-written to use RENAME instead of Prisma's auto-generated DROP/CREATE, so
-- the patch data synced under PN1 isn't lost.

-- Drop existing FK + index so they can be reapplied under the new names.
ALTER TABLE "ChampionPatchChange" DROP CONSTRAINT "ChampionPatchChange_patchVersion_fkey";
DROP INDEX "ChampionPatchChange_patchVersion_championKey_idx";

-- Rename table.
ALTER TABLE "ChampionPatchChange" RENAME TO "PatchChange";

-- Rename pkey constraint + sequence to follow the new table name.
ALTER TABLE "PatchChange" RENAME CONSTRAINT "ChampionPatchChange_pkey" TO "PatchChange_pkey";
ALTER SEQUENCE "ChampionPatchChange_id_seq" RENAME TO "PatchChange_id_seq";

-- Rename column + add the section discriminator.
ALTER TABLE "PatchChange" RENAME COLUMN "championKey" TO "subject";
ALTER TABLE "PatchChange" ADD COLUMN "section" TEXT NOT NULL DEFAULT 'champion';

-- Recreate FK + index against the new names.
ALTER TABLE "PatchChange" ADD CONSTRAINT "PatchChange_patchVersion_fkey" FOREIGN KEY ("patchVersion") REFERENCES "PatchVersion"("version") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PatchChange_patchVersion_section_subject_idx" ON "PatchChange"("patchVersion", "section", "subject");
