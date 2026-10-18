const paths: Record<string, string> = {
  monitor: "M3 4.5h18v10.5H3zM8 19.5h8M12 15v4.5",
  code: "M9 7.5L4.5 12 9 16.5M15 7.5L19.5 12 15 16.5",
  bolt: "M13 2.5L4.5 13.5H11l-1 8 8.5-11H12z",
  wrench:
    "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94z",
  cpu: "M6.5 6.5h11v11h-11zM9.5 9.5h5v5h-5zM9.5 3v3.5M14.5 3v3.5M9.5 17.5V21M14.5 17.5V21M3 9.5h3.5M3 14.5h3.5M17.5 9.5H21M17.5 14.5H21",
  eye: "M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5z",
  database: "M12 3c4.97 0 9 1.34 9 3s-4.03 3-9 3-9-1.34-9-3 4.03-3 9-3zM21 12c0 1.66-4.03 3-9 3s-9-1.34-9-3M3 6v12c0 1.66 4.03 3 9 3s9-1.34 9-3V6",
  layout: "M3 3.5h18v17H3zM3 9.5h18M9.5 9.5v11",
  layers: "M12 2.5L2.5 7.5 12 12.5l9.5-5zM2.5 12.5L12 17.5l9.5-5M2.5 17L12 22l9.5-5",
  shield: "M12 2.5l8 3.5v6c0 5-3.4 8.4-8 9.5-4.6-1.1-8-4.5-8-9.5V6zM9 12l2 2 4-4",
  book: "M4 4.5h6a3 3 0 013 3v12a2.5 2.5 0 00-2.5-2.5H4zM20 4.5h-6a3 3 0 00-3 3v12a2.5 2.5 0 012.5-2.5H20z",
  plug: "M9 2.5v6M15 2.5v6M6.5 8.5h11v3a5.5 5.5 0 01-11 0zM12 17v4.5",
  spark: "M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.9z",
  rocket:
    "M12 2.5c3.5 2 5.5 5.5 5.5 9.5l-2 6h-7l-2-6c0-4 2-7.5 5.5-9.5zM9.5 18l-2.5 3.5M14.5 18l2.5 3.5M12 9.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z",
  users:
    "M8.5 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM2.5 20.5c0-3.3 2.7-6 6-6s6 2.7 6 6M17 4.5a3.5 3.5 0 010 7M18.5 14.8c1.8.8 3 2.5 3 4.7",
  message:
    "M21 12a8 8 0 01-8 8H8l-4.5 3V12a8 8 0 018-8h1.5a8 8 0 018 8z",
};

export function Icon({
  name,
  size = 20,
  className = "",
  strokeWidth = 1.7,
}: {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const d = paths[name] ?? paths.spark;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
