import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blueway Travel - Công cụ tạo hồ sơ",
  description:
    "Công cụ quét dữ liệu và tạo hồ sơ DOCX, XLSX cho Blueway Travel.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
