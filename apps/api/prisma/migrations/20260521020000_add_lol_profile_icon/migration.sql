-- Profile icons sourced from wiki `Module:IconData/data`. Title is the
-- editorial key from the module and doubles as the image filename slug
-- (`{Title}_profileicon.png` on wiki).

CREATE TABLE "LolProfileIcon" (
    "id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "availability" TEXT,
    "release" INTEGER,
    "wikiSyncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LolProfileIcon_pkey" PRIMARY KEY ("id")
);
