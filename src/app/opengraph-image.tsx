import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          background: "#0B0F14",
          color: "#F9FAFB",
          display: "flex",
          padding: "64px",
          fontFamily: "Arial, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative background */}
        <div
          style={{
            position: "absolute",
            top: "-120px",
            right: "-100px",
            width: "420px",
            height: "420px",
            borderRadius: "420px",
            background: "rgba(59,130,246,0.22)",
            display: "flex",
          }}
        />

        <div
          style={{
            position: "absolute",
            bottom: "-140px",
            left: "-100px",
            width: "420px",
            height: "420px",
            borderRadius: "420px",
            background: "rgba(34,197,94,0.16)",
            display: "flex",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "22px",
                background: "linear-gradient(135deg, #3B82F6, #22C55E)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "44px",
                fontWeight: 900,
                color: "#FFFFFF",
              }}
            >
              N
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: "34px",
                  fontWeight: 800,
                  color: "#FFFFFF",
                }}
              >
                Nexora Home
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: "20px",
                  color: "#9CA3AF",
                }}
              >
                Premium Smart IoT Dashboard
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: "72px",
                lineHeight: 1.02,
                fontWeight: 850,
                letterSpacing: "-4px",
                maxWidth: "880px",
                color: "#FFFFFF",
              }}
            >
              Intelligent control for a calmer, safer home.
            </div>

            <div
              style={{
                display: "flex",
                marginTop: "28px",
                fontSize: "25px",
                lineHeight: 1.45,
                color: "#9CA3AF",
                maxWidth: "820px",
              }}
            >
              Manage rooms, devices, automation, security, analytics, alerts,
              and energy optimization from one modern interface.
            </div>
          </div>

          <div style={{ display: "flex", gap: "16px" }}>
            {[
              "42 Devices",
              "18 Automations",
              "12% Energy Saved",
              "96% Uptime",
            ].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: "999px",
                  padding: "12px 20px",
                  fontSize: "18px",
                  color: "#F9FAFB",
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  );
}