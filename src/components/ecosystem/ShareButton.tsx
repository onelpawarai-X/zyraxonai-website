import React, { useEffect, useRef, useState } from "react";
import {
  IconShare,
  IconCopy,
  IconFacebook,
  IconTelegram,
  IconTiktok,
  IconTwitter,
  IconLinkedIn,
  IconReddit,
  IconDiscord,
  IconEmail,
  IconCheck,
} from "./Icons";

interface ShareButtonProps {
  itemId: string;
  itemName: string;
  itemUrl?: string;
}

interface ShareOption {
  id: string;
  label: string;
  icon: React.FC<{ size?: number; className?: string }>;
  color: string;
  action: (url: string, name: string) => void;
}

export const ShareButton: React.FC<ShareButtonProps> = ({ itemId, itemName, itemUrl }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const shareUrl = itemUrl || `https://zyraxonai.lovable.app/ecosystem/item/${itemId}`;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignored */
    }
  };

  const shareOptions: ShareOption[] = [
    {
      id: "copy",
      label: "Copy Link",
      icon: copied ? IconCheck : IconCopy,
      color: copied ? "#10b981" : "#6b7280",
      action: () => copyToClipboard(),
    },
    {
      id: "facebook",
      label: "Facebook",
      icon: IconFacebook,
      color: "#1877f2",
      action: (url, name) => {
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
          "_blank",
          "width=600,height=400",
        );
      },
    },
    {
      id: "telegram",
      label: "Telegram",
      icon: IconTelegram,
      color: "#0088cc",
      action: (url, name) => {
        window.open(
          `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(name)}`,
          "_blank",
          "width=600,height=400",
        );
      },
    },
    {
      id: "tiktok",
      label: "TikTok",
      icon: IconTiktok,
      color: "#ff0050",
      action: (url) => {
        copyToClipboard();
      },
    },
    {
      id: "twitter",
      label: "Twitter/X",
      icon: IconTwitter,
      color: "#1da1f2",
      action: (url, name) => {
        window.open(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(name)}&url=${encodeURIComponent(url)}`,
          "_blank",
          "width=600,height=400",
        );
      },
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      icon: IconLinkedIn,
      color: "#0a66c2",
      action: (url, name) => {
        window.open(
          `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
          "_blank",
          "width=600,height=400",
        );
      },
    },
    {
      id: "reddit",
      label: "Reddit",
      icon: IconReddit,
      color: "#ff4500",
      action: (url, name) => {
        window.open(
          `https://reddit.com/submit?url=${encodeURIComponent(url)}&title=${encodeURIComponent(name)}`,
          "_blank",
          "width=600,height=400",
        );
      },
    },
    {
      id: "discord",
      label: "Discord",
      icon: IconDiscord,
      color: "#5865f2",
      action: (url, name) => {
        copyToClipboard();
      },
    },
    {
      id: "email",
      label: "Email",
      icon: IconEmail,
      color: "#6b7280",
      action: (url, name) => {
        window.location.href = `mailto:?subject=${encodeURIComponent(name)}&body=${encodeURIComponent(url)}`;
      },
    },
    {
      id: "native",
      label: "Native Share",
      icon: IconShare,
      color: "#6366f1",
      action: async (url, name) => {
        if (navigator.share) {
          try {
            await navigator.share({ title: name, url });
          } catch {
            /* ignored */
          }
        }
      },
    },
  ];

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: "6px 12px",
          background: "transparent",
          border: "1px solid rgba(0,0,0,0.06)",
          borderRadius: "8px",
          color: "#6b7280",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: "500",
          transition: "all 0.2s ease",
          fontFamily: "inherit",
          outline: "none",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#6366f150";
          e.currentTarget.style.color = "#6366f1";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "#f3f4f6";
          e.currentTarget.style.color = "#6b7280";
        }}
      >
        <IconShare size={14} />
        Share
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "4px",
            width: "220px",
            background: "rgba(243,244,246,0.55)",
            backdropFilter: "blur(20px)",
            border: "1px solid rgba(0,0,0,0.1)",
            borderRadius: "10px",
            padding: "6px",
            zIndex: 50,
            boxShadow: "0 16px 32px rgba(0,0,0,0.06)",
          }}
        >
          {shareOptions.map((option) => (
            <button
              key={option.id}
              onClick={(e) => {
                e.stopPropagation();
                option.action(shareUrl, itemName);
                if (option.id !== "copy") setOpen(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                width: "100%",
                padding: "8px 10px",
                background: "transparent",
                border: "none",
                borderRadius: "6px",
                color: option.color,
                cursor: "pointer",
                fontSize: "13px",
                fontFamily: "inherit",
                textAlign: "left",
                outline: "none",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f3f4f6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <option.icon size={16} />
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
