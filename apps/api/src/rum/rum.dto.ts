import {
  RUM_FORM_FACTORS,
  RUM_MAX_SAMPLES,
  type RumBeacon,
  WEB_VITAL_NAMES,
  WEB_VITAL_NAVIGATION_TYPES,
  WEB_VITAL_RATINGS,
  type WebVitalSample,
} from "@vyoh/shared";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

// web-vitals' id: `v<major>-<epoch ms>-<13 random digits>`. Pinned because it
// becomes the row's primary key and an anonymous caller supplies it.
const METRIC_ID = /^v\d{1,2}-\d{13}-\d{13}$/;

// The reporter sends a route template (`/`, `/lol/$accountSlug/matches`). This
// enforces only what a template is made of: no query, no hash, no
// percent-encoding, at most 120 characters. A real pathname within that
// charset still passes, which is why the read side lists known routes only.
const ROUTE_ID = /^\/[A-Za-z0-9$_/-]{0,119}$/;

// Milliseconds for every metric but CLS, which is unitless. Ten minutes is far
// past any genuine reading.
const MAX_VALUE = 600_000;

export class WebVitalSampleDto implements WebVitalSample {
  @Matches(METRIC_ID)
  id!: string;

  @IsIn(WEB_VITAL_NAMES)
  name!: WebVitalSample["name"];

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_VALUE)
  value!: number;

  @IsIn(WEB_VITAL_RATINGS)
  rating!: WebVitalSample["rating"];
}

export class RumBeaconDto implements RumBeacon {
  @Matches(ROUTE_ID)
  route!: string;

  @IsIn(RUM_FORM_FACTORS)
  formFactor!: RumBeacon["formFactor"];

  @IsIn(WEB_VITAL_NAVIGATION_TYPES)
  navigationType!: RumBeacon["navigationType"];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(RUM_MAX_SAMPLES)
  @ValidateNested({ each: true })
  @Type(() => WebVitalSampleDto)
  samples!: WebVitalSampleDto[];
}
