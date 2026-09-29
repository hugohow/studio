/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // Photos des salles (jusqu'à 5 Mo en source) : redimensionnées par l'optimiseur Next/Vercel.
    remotePatterns: [
      { protocol: "https", hostname: "studio-bleu-images-production.s3.eu-west-3.amazonaws.com", pathname: "/studios/**" },
      { protocol: "https", hostname: "wackedlive.fr", pathname: "/wp-content/uploads/**" },
      { protocol: "http", hostname: "www.studiohbs.com", pathname: "/img/**" },
      { protocol: "https", hostname: "fgo-barbara.fr", pathname: "/sites/default/files/fgosite/ged/**" },
    ],
  },
};

export default nextConfig;
