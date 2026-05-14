-- AlterTable
ALTER TABLE "SteamPlaytimeSnapshot" ADD COLUMN     "playtimeDeckMinutes" INTEGER,
ADD COLUMN     "playtimeLinuxMinutes" INTEGER,
ADD COLUMN     "playtimeMacMinutes" INTEGER,
ADD COLUMN     "playtimeWindowsMinutes" INTEGER;
