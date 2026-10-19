import { useState } from "react";
import type { OpenVsxExtension } from "@/lib/openvsx";

/** Publisher icon, falling back to the extension's initial when there is none. */
export function ExtensionIcon({ ext, size }: { ext: OpenVsxExtension; size: number }) {
  const [broken, setBroken] = useState(false);
  if (!ext.iconUrl || broken) {
    return (
      <span
        className="zx-glass grid shrink-0 place-items-center rounded-xl text-lg font-bold text-primary"
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        {ext.displayName.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={ext.iconUrl}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)}
      className="shrink-0 rounded-xl border border-border object-cover"
      style={{ width: size, height: size }}
    />
  );
}
