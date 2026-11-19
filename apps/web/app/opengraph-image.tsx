import { ImageResponse } from "next/og";

// The social card for links to the demo and the repository.
export const alt = "ClearLoop: your customer should never have to ask “any update?”";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#faf9f6",
          color: "#1d2127",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "#007b7c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 34, border: "6px solid #ffffff" }} />
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>ClearLoop</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.08, maxWidth: 960 }}>
            Your customer should never have to ask &ldquo;any update?&rdquo;
          </div>
          <div style={{ fontSize: 30, color: "#5b616b", maxWidth: 980 }}>
            Update debt, business-time SLAs for the GCC, Postgres row-level security. Every claim has a test.
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, fontSize: 24, color: "#5b616b" }}>
          <span style={{ color: "#6a4fc2", fontWeight: 700 }}>2 updates behind</span>
          <span>·</span>
          <span style={{ color: "#007b7c", fontWeight: 700 }}>Sent, read, loop closed</span>
        </div>
      </div>
    ),
    size,
  );
}
