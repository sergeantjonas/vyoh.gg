import { Controller, Get } from "@nestjs/common";
import type { RecapChaptersResponse } from "@vyoh/shared";

import { RecapSubjectsService } from "./recap-subjects.service";

/**
 * Cross-source landing-page chapter stream consumed by `useChapters()` on
 * `/`. R-4a emits only Steam subjects; R-6/R-7 will plug LoL-moment and
 * Steam-moment candidates into the same selector without controller churn.
 */
@Controller("recap")
export class RecapController {
  constructor(private readonly subjects: RecapSubjectsService) {}

  @Get("chapters")
  async getChapters(): Promise<RecapChaptersResponse> {
    const chapters = await this.subjects.getChapters();
    return { chapters };
  }
}
