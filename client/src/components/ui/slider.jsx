import React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cn } from '../../lib/utils.js';

function Slider({ className, value, defaultValue, ...props }) {
  // ponytail: Radix Slider destructures `value`/`defaultValue` internally;
  // if a caller ever passes a bare number (e.g. `value={1}`), V8 throws
  // "number 1 is not iterable". Coerce primitives into single-element arrays.
  const safeValue = Array.isArray(value)
    ? value
    : value === undefined
      ? undefined
      : [value];
  const safeDefault = Array.isArray(defaultValue)
    ? defaultValue
    : defaultValue === undefined
      ? undefined
      : [defaultValue];
  return (
    <SliderPrimitive.Root
      className={cn('relative flex w-full touch-none select-none items-center', className)}
      value={safeValue}
      defaultValue={safeDefault}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-border">
        <SliderPrimitive.Range className="absolute h-full bg-foreground transition-[width] duration-75" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block h-3.5 w-3.5 rounded-full border-2 border-foreground bg-background ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer" />
    </SliderPrimitive.Root>
  );
}

export { Slider };