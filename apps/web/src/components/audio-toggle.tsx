import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TOOLTIP_CONTENT_COMPACT } from "@/lib/tooltip";
import { useAudio } from "@/lib/use-audio";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Volume2, VolumeX } from "lucide-react";
import { type ChangeEvent, useState } from "react";

export function AudioToggle() {
  const { enabled, volume, setEnabled, setVolume, play } = useAudio();
  const [open, setOpen] = useState(false);

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    if (next) {
      // Confirmation sample — let the user hear what they just turned on.
      play("palette.select");
    }
  };

  const handleVolumeChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = Number(event.target.value);
    setVolume(next);
  };

  const Icon = enabled ? Volume2 : VolumeX;
  const tooltipLabel = enabled ? `Sound on (${Math.round(volume * 100)}%)` : "Sound off";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={tooltipLabel}
              className="cursor-pointer rounded border bg-muted/50 px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon className="size-4" aria-hidden />
            </button>
          </PopoverTrigger>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="bottom"
            sideOffset={6}
            className={TOOLTIP_CONTENT_COMPACT}
          >
            {tooltipLabel}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
      <PopoverContent align="end" className="p-4">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Sound</span>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              aria-label={enabled ? "Disable sound" : "Enable sound"}
              onClick={handleToggle}
              className={`relative inline-flex h-5 w-9 cursor-pointer items-center rounded-full border transition-colors ${
                enabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                aria-hidden
                className={`inline-block size-3.5 transform rounded-full bg-background transition-transform ${
                  enabled ? "translate-x-[18px]" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label htmlFor="audio-volume" className="text-sm text-muted-foreground">
                Volume
              </label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <input
              id="audio-volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={handleVolumeChange}
              disabled={!enabled}
              aria-label="Sound volume"
              className="w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Procedural Web Audio UI tones. Off by default; preference saved locally.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
