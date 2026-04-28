import { ImageResponse } from "next/og";

export const size = {
  width: 64,
  height: 64,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0B0F14",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "18px",
        }}
      >
        <div
          style={{
            width: 50,
            height: 50,
            borderRadius: "16px",
            background: "#3B82F6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
            fontSize: 34,
            fontWeight: 800,
          }}
        >
          N
        </div>
      </div>
    ),
    size
  );
}