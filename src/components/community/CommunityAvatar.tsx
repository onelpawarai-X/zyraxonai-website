const PALETTE = [
  "#06b6d4",
  "#7c3aed",
  "#2563eb",
  "#059669",
  "#d97706",
  "#db2777",
  "#0ea5e9",
  "#a855f7",
  "#16a34a",
  "#ea580c",
];

export function colorFor(seed: string) {
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n + seed.charCodeAt(i)) % 997;
  return PALETTE[n % PALETTE.length];
}

type Props = {
  name: string;
  seed?: string;
  src?: string | null;
  size?: number;
  className?: string;
};

export function CommunityAvatar({ name, seed, src, size = 44, className = "" }: Props) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        loading="lazy"
        style={style}
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{ ...style, background: colorFor(seed || name) }}
      className={`grid shrink-0 place-items-center rounded-full font-bold text-white ${className}`}
    >
      {(name.trim().charAt(0) || "?").toUpperCase()}
    </span>
  );
}
