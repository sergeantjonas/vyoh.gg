-- CreateTable
CREATE TABLE "WebVitalSample" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "rating" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "formFactor" TEXT NOT NULL,
    "navigationType" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebVitalSample_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebVitalSample_recordedAt_idx" ON "WebVitalSample"("recordedAt");

-- CreateIndex
CREATE INDEX "WebVitalSample_name_recordedAt_idx" ON "WebVitalSample"("name", "recordedAt");
