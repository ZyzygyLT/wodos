import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import Providers from "@/components/Providers";
import PushRegistration from "@/components/push/PushRegistration";
import CronPoller from "@/components/CronPoller";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ironhold",
  description: "Juego RPG por navegador",
};

const onesignalAppId = process.env.ONESIGNAL_APP_ID || ""

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>
          <PushRegistration />
          <CronPoller />
          {children}
        </Providers>
        {onesignalAppId && (
          <>
            <Script
              src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
              strategy="beforeInteractive"
            />
            <Script
              id="onesignal-init"
              strategy="beforeInteractive"
              dangerouslySetInnerHTML={{
                __html: `
                  window.OneSignalDeferred = window.OneSignalDeferred || [];
                  OneSignalDeferred.push(async function(OneSignal) {
                    await OneSignal.init({ appId: "${onesignalAppId}" });
                  });
                `,
              }}
            />
          </>
        )}
      </body>
    </html>
  );
}
