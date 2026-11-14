"use client";

import React, { useState } from "react";
import "./globals.css";
import { TopBar } from "@/components/TopBar";
import { Footer } from "@/components/Footer";
import { PrivacyInspector, PrivacyContextData } from "@/components/PrivacyInspector";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [inspectorData] = useState<PrivacyContextData>({});

  return (
    <html lang="en" className="dark">
      <head>
        <title>Veil Health | Your Health, Your Key</title>
        <meta
          name="description"
          content="Pay for care, share records, and get insurance claims paid without anyone seeing more than they need to."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen bg-background text-veil-text antialiased selection:bg-primary selection:text-black flex flex-col justify-between">
        <div>
          <TopBar
            onToggleInspector={() => setIsInspectorOpen((prev) => !prev)}
            isInspectorOpen={isInspectorOpen}
          />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </main>
        </div>
        <Footer />
        <PrivacyInspector
          isOpen={isInspectorOpen}
          onClose={() => setIsInspectorOpen(false)}
          data={inspectorData}
        />
      </body>
    </html>
  );
}
