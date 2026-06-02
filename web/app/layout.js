import "./globals.css";

export const metadata = {
  title: "StudioTonight",
  description: "Les créneaux dispo des studios de répétition du nord-est parisien",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
