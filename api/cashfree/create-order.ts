import { getApps, initializeApp, getApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";
import { Cashfree } from "cashfree-pg";

// Embedded default fallback config for serverless environments
const DEFAULT_FIREBASE_CONFIG = {
  projectId: "khel-galli-49b03",
  appId: "1:975078214004:web:7eb2b340d559ed4ae34421",
  apiKey: "AIzaSyCaMCsb7uh_O4JIhxp5ElxVRXf9KXYbQb8",
  authDomain: "khel-galli-49b03.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-77efbb54-a595-4a00-a189-15e356a65ecc",
  storageBucket: "khel-galli-49b03.firebasestorage.app",
  messagingSenderId: "975078214004"
};

export function getFirebaseAdmin() {
  let firebaseConfig: any = { ...DEFAULT_FIREBASE_CONFIG };

  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const fileData = JSON.parse(fs.readFileSync(configPath, "utf8"));
      firebaseConfig = { ...firebaseConfig, ...fileData };
    }
  } catch (e) {}

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const projectId = 
    process.env.GOOGLE_CLOUD_PROJECT || 
    process.env.FIREBASE_PROJECT_ID || 
    firebaseConfig.projectId || 
    "khel-galli-49b03";

  const databaseId = 
    process.env.FIRESTORE_DATABASE_ID || 
    firebaseConfig.firestoreDatabaseId || 
    "ai-studio-77efbb54-a595-4a00-a189-15e356a65ecc";

  let app: any;
  if (getApps().length === 0) {
    try {
      if (serviceAccountKey) {
        let parsedKey = serviceAccountKey;
        if (typeof serviceAccountKey === "string" && (serviceAccountKey.startsWith("{") || serviceAccountKey.startsWith("["))) {
          parsedKey = JSON.parse(serviceAccountKey);
        }
        app = initializeApp({
          credential: cert(parsedKey),
          projectId: projectId
        });
      } else {
        app = initializeApp({ projectId: projectId });
      }
    } catch (error: any) {
      try {
        app = initializeApp({ projectId: projectId });
      } catch (e2: any) {
        app = getApps()[0] || null;
      }
    }
  } else {
    app = getApp();
  }

  let db: any;
  try {
    db = getFirestore(app, databaseId);
  } catch (err) {
    try {
      db = getFirestore(app);
    } catch (e3) {}
  }
  
  return { app, db, databaseId, FieldValue };
}

export default async function handler(req: any, res: any) {
  // CORS support
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  console.log("[Cashfree Create Order] Route hit");
  
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  let db: any = null;
  try {
    const admin = getFirebaseAdmin();
    db = admin.db;
  } catch (adminErr: any) {
    console.warn("[Cashfree Create Order] Firebase Admin init notice:", adminErr?.message);
  }

  try {
    const { amount, userId, customerName, customerEmail, customerPhone } = req.body || {};
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Invalid amount" });
    }

    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }

    // Try to get config from Firestore
    let clientId = process.env.CASHFREE_CLIENT_ID;
    let clientSecret = process.env.CASHFREE_CLIENT_SECRET;
    let isProdEnv = process.env.CASHFREE_ENV === "PRODUCTION";

    if (db) {
      try {
        const configDoc = await db.collection('paymentSettings').doc('cashfree').get();
        if (configDoc.exists && configDoc.data()?.isActive) {
          clientId = configDoc.data()?.apiKey || clientId;
          clientSecret = configDoc.data()?.secretKey || clientSecret;
          isProdEnv = configDoc.data()?.isProduction ?? isProdEnv;
        }
      } catch (e) {}
    }

    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "Cashfree credentials are missing. Please configure CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET." });
    }

    const isProd = isProdEnv || (clientId && !clientId.includes('TEST'));

    (Cashfree as any).XClientId = clientId;
    (Cashfree as any).XClientSecret = clientSecret;
    (Cashfree as any).XEnvironment = isProd ? (Cashfree as any).Environment.PRODUCTION : (Cashfree as any).Environment.SANDBOX;

    const orderId = `order_${Date.now()}_${userId}`;
    
    // Determine base URL
    let baseUrlFull = process.env.APP_URL;
    if (!baseUrlFull) {
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      baseUrlFull = `${protocol}://${host}`;
    }
    baseUrlFull = baseUrlFull.replace(/\/$/, "");

    const requestData = {
      order_amount: Number(amount),
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: String(userId),
        customer_phone: customerPhone || "9999999999",
        customer_name: customerName || "Khel Galli User",
        customer_email: customerEmail || "user@khelgalli.com"
      },
      order_meta: {
        return_url: `${baseUrlFull}/wallet?order_id={order_id}`,
        notify_url: `${baseUrlFull}/api/cashfree/webhook`
      }
    };

    console.log(`[Cashfree Create Order] Processing order: ${orderId}`);
    const response = await (Cashfree as any).PGCreateOrder("2023-08-01", requestData);
    res.json(response.data);
  } catch (error: any) {
    console.error("[Cashfree Create Order] Error:", error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.message || error.message });
  }
}
