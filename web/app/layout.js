import "./globals.css";

export const metadata = {
  title: "StudioTonight",
  description: "Trouve un studio de répétition libre à Paris ce soir",
};

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
