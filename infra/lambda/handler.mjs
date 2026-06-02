// Lambda StudioTonight : exécute fetchAll (scrape des salles) et écrit data/slots.json sur S3.
// Déclenchée par EventBridge (toutes les 15 min). Aucune dépendance externe :
// `fetch` est global (Node 20) et @aws-sdk/client-s3 est fourni par le runtime Lambda.
import { fetchAll } from "./src/adapters/index.js";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({});
const BUCKET = process.env.FEED_BUCKET;
const KEY = process.env.FEED_KEY || "slots.json";
const durationH = parseInt(process.env.DURATION_H || "1", 10);
const monthsLoad = parseInt(process.env.MONTHS || "1", 10);

export const handler = async () => {
  const venues = await fetchAll({ durationH, monthsLoad });
  const payload = { generatedAt: new Date().toISOString(), durationH, monthsLoad, venues };
  const body = JSON.stringify(payload);

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: KEY,
      Body: body,
      ContentType: "application/json",
      CacheControl: "public, max-age=60",
    })
  );

  const ok = venues.filter((v) => !v.error).length;
  return { ok: true, venues: venues.length, sains: ok, bytes: body.length, key: KEY };
};
