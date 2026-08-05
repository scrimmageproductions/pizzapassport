interface CheckeredBandProps {
  className?: string;
}

/** A thin red/cream checkerboard ribbon — the classic pizzeria
 * tablecloth/pizza-box border accent, used only as a slim divider. */
export default function CheckeredBand({ className = "" }: CheckeredBandProps) {
  return <div aria-hidden="true" className={`h-2 w-full bg-checkered-band ${className}`} />;
}
