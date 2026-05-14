require("dotenv").config();
const { google } = require("googleapis");
const { createClient } = require("@supabase/supabase-js");
const { PDFDocument } = require("pdf-lib");
const fs = require("fs");
const path = require("path");
const http = require("http");

const TEMPLATE_DOC_ID = "1DDihQ73j5A-mBwOBkdS6zk8u--MBXZ6xfjnHGeU5VZ8";
const CREDENTIALS_PATH = path.join(__dirname, "../cse-toolkit-f193b980977c.json");
const TOKEN_PATH = path.join(__dirname, ".oauth-token.json");
const SUPABASE_URL = "https://knzvfdksnhxvrucejdms.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const OUTPUT_FILE = path.join(__dirname, "../factures_vente_cse.pdf");

const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "https://www.googleapis.com/auth/documents",
];

function formatEur(amount) {
  return amount.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

function formatDateTime(isoString) {
  return new Date(isoString).toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

async function getOAuthClient() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));

  // Utilise les infos du compte de service pour créer un client OAuth2 desktop
  // Le vrai client_id/secret doit venir d'un OAuth2 Desktop App créé dans Google Cloud Console
  const { client_id, client_secret } = process.env.GOOGLE_CLIENT_ID
    ? { client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET }
    : (() => { throw new Error("GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET manquants dans .env"); })();

  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, "http://localhost:3456");

  // Token déjà sauvegardé ?
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
    oAuth2Client.setCredentials(token);
    oAuth2Client.on("tokens", (tokens) => {
      const saved = JSON.parse(fs.readFileSync(TOKEN_PATH));
      fs.writeFileSync(TOKEN_PATH, JSON.stringify({ ...saved, ...tokens }));
    });
    return oAuth2Client;
  }

  // Première fois : flow OAuth navigateur
  const authUrl = oAuth2Client.generateAuthUrl({ access_type: "offline", scope: SCOPES });
  console.log("\n🔐 Connexion Google requise. Ouverture du navigateur...\n");
  const { exec } = require("child_process");
  exec(`open "${authUrl}"`);

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost:3456");
      const code = url.searchParams.get("code");
      res.end("<html><body><h2>✓ Authentification réussie, vous pouvez fermer cet onglet.</h2></body></html>");
      server.close();
      resolve(code);
    });
    server.listen(3456);
    setTimeout(() => { server.close(); reject(new Error("Timeout OAuth")); }, 120000);
  });

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
  console.log("✓ Token sauvegardé\n");
  return oAuth2Client;
}

async function main() {
  if (!SUPABASE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY manquant dans scripts/.env");

  const auth = await getOAuthClient();
  const drive = google.drive({ version: "v3", auth });
  const docs = google.docs({ version: "v1", auth });

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data: reservations, error } = await supabase
    .from("reservations")
    .select("*")
    .eq("status", "paid")
    .order("created_at");

  if (error) throw new Error(`Supabase: ${error.message}`);
  if (!reservations.length) {
    console.log("Aucune réservation payée trouvée.");
    return;
  }
  console.log(`${reservations.length} réservations payées trouvées.\n`);

  // Dossier temporaire dans le Drive de l'utilisateur
  const folderRes = await drive.files.create({
    requestBody: {
      name: `[TEMP] Factures CSE Lyra ${new Date().toLocaleDateString("fr-FR")}`,
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });
  const folderId = folderRes.data.id;

  const pdfBuffers = [];

  for (let i = 0; i < reservations.length; i++) {
    const r = reservations[i];
    const num = String(i + 1).padStart(3, "0");
    console.log(`[${i + 1}/${reservations.length}] ${r.last_name} ${r.first_name} — ${r.model}`);

    const montantTTC = Math.round(parseFloat(r.price) * 100) / 100;
    const montantHT = Math.round((montantTTC / 1.2) * 100) / 100;
    const tva = Math.round((montantTTC - montantHT) * 100) / 100;

    const variables = {
      "{{ Nom de famille }}": r.last_name,
      "{{ Prénom }}": r.first_name,
      "{{ Email pour l'envoi du lien de paiement }}": r.email,
      "{{ Numéro facture }}": `FAC-2026-${num}`,
      "{{ Génération de la facture }}": formatDate(new Date().toISOString()),
      "{{ Montant }}": formatEur(montantTTC),
      "{{ HT }}": formatEur(montantHT),
      "{{ TVA }}": formatEur(tva),
      "{{ Modèle machine }}": r.model,
      "{{ Référence unique de la machine }}": r.serial_number,
      "{{ Mode de paiement choisi }}": r.payment_method ?? "Inconnu",
      "{{ Date et heure formatée }}": formatDateTime(r.created_at),
    };

    const copy = await drive.files.copy({
      fileId: TEMPLATE_DOC_ID,
      requestBody: { name: `Facture_${r.last_name}_${r.first_name}`, parents: [folderId] },
      fields: "id",
    });
    const copyId = copy.data.id;

    await docs.documents.batchUpdate({
      documentId: copyId,
      requestBody: {
        requests: Object.entries(variables).map(([find, replace]) => ({
          replaceAllText: {
            containsText: { text: find, matchCase: true },
            replaceText: replace,
          },
        })),
      },
    });

    const pdfRes = await drive.files.export(
      { fileId: copyId, mimeType: "application/pdf" },
      { responseType: "arraybuffer" }
    );
    pdfBuffers.push(Buffer.from(pdfRes.data));

    await drive.files.delete({ fileId: copyId });
  }

  await drive.files.delete({ fileId: folderId });

  console.log("\nFusion des PDFs...");
  const merged = await PDFDocument.create();
  for (const buffer of pdfBuffers) {
    const pdf = await PDFDocument.load(buffer);
    const pages = await merged.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }

  const bytes = await merged.save();
  fs.writeFileSync(OUTPUT_FILE, bytes);
  console.log(`\n✓ ${reservations.length} factures générées → factures_vente_cse.pdf`);
}

main().catch((err) => {
  console.error("Erreur :", err.message);
  process.exit(1);
});
