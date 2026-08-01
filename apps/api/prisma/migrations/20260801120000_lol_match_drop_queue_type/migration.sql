-- `Match.queueType` held a rendered label. Every read path now matches on the
-- numeric `queueId` backfilled by 20260801000000_lol_match_queue_id, which is
-- also the column the label was derived from in the first place — so this drop
-- loses no information that `queueLabel(queueId)` cannot reproduce.
--
-- The one exception is deliberate: rows whose id the label map did not know
-- were storing the literal `Queue 3130` placeholder. Those are the rows this
-- migration exists to stop producing, and re-deriving them from the id is the
-- point rather than a loss.
ALTER TABLE "Match" DROP COLUMN "queueType";
