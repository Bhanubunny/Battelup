import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { Cashfree } from "cashfree-pg";
import { initializeApp as initializeFrontendApp } from "firebase/app";
import { 
  getFirestore as getFrontendFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc 
} from "firebase/firestore";
import { initializeApp, getApps, getApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import fs from "fs";
import axios from "axios";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf8"));

// Set project ID in environment if not present
const preferredProjectId = firebaseConfig.projectId;
if (!process.env.GOOGLE_CLOUD_PROJECT && preferredProjectId) {
  process.env.GOOGLE_CLOUD_PROJECT = preferredProjectId;
}

// Initialize Firebase Admin
let app: any;
try {
  if (getApps().length === 0) {
    app = initializeApp({
      projectId: preferredProjectId
    });
    console.log(`[Firebase Admin] Initialized with Project ID: ${preferredProjectId}`);
  } else {
    app = getApp();
  }
} catch (e: any) {
  console.warn("[Firebase Admin] Initialization failed, falling back to default:", e.message);
  try {
    app = initializeApp();
  } catch (e2: any) {
    console.error("[Firebase Admin] Critical: All initialization attempts failed:", e2.message);
  }
}

// Initialize Frontend/Client SDK as Fallback (Subject to rules, but bypasses IAM issues)
const frontendApp = initializeFrontendApp(firebaseConfig);
const frontendFirestore = getFrontendFirestore(frontendApp, firebaseConfig.firestoreDatabaseId);

// Get reference to the specific Firestore database
let firestore: any;
const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
try {
  // Use the app and databaseId explicitly
  firestore = getFirestore(app, databaseId);
  console.log(`[Firebase Admin] Firestore instance created for database: ${databaseId}`);
} catch (e: any) {
  console.error("[Firebase Admin] Critical Firestore Init Error:", e.message);
  // Last ditch attempt
  try {
    firestore = getFirestore();
  } catch (e2) {
    console.error("[Firebase Admin] Firestore fallback failed");
  }
}

// Self-seeding Admins and Initial Config
async function seedInitialData() {
  if (!firestore) {
    console.warn("[Firebase Admin] Skipping seeding: Firestore not initialized");
    return;
  }

  try {
    // Basic connectivity test
    console.log(`[Firebase Admin] Testing connectivity to database: ${databaseId}...`);
    // Attempt a lightweight read
    await firestore.collection('paymentSettings').limit(1).get();
    console.log("[Firebase Admin] Connectivity successful.");
  } catch (err: any) {
    // Fail gracefully if permissions are missing
    if (err.message.includes('PERMISSION_DENIED')) {
      console.info("[Firebase Admin] DB connectivity restricted (Permission Denied). Environment variable fallbacks will be used.");
    } else {
      console.warn(`[Firebase Admin] Connectivity test suppressed:`, err.message);
    }
    return; // Stop seeding if connectivity fails
  }
  
  try {
    const adminEmails = [
      'ksbooyah9@gmail.com',
      'mahendrathakur9009@gmail.com',
      'qupagaming@gmail.com',
      'mahendrar9009@gmail.com'
    ];
    
    const adminUids = [
      'XoXyXcnrlzOaMIKKolXnU3mT9xn1'
    ];

    console.log("[Firebase Admin] Seeding admin permissions...");
    
    // Seed by Email
    for (const email of adminEmails) {
      await firestore.collection('admins').doc(email).set({ 
        role: 'super_admin', 
        updatedAt: FieldValue.serverTimestamp() 
      }, { merge: true });
    }

    // Seed by UID (more reliable for rules)
    for (const uid of adminUids) {
      await firestore.collection('admins').doc(uid).set({ 
        role: 'super_admin', 
        updatedAt: FieldValue.serverTimestamp() 
      }, { merge: true });
    }

    // Ensure Cashfree structure exists
    const cashfreeDoc = await firestore.collection('paymentSettings').doc('cashfree').get();
    if (!cashfreeDoc.exists) {
      await firestore.collection('paymentSettings').doc('cashfree').set({
        name: 'Cashfree PG',
        id: 'cashfree',
        isActive: false, // Deactivated in favor of ZapUPI
        isProduction: process.env.CASHFREE_ENV === 'PRODUCTION',
        apiKey: process.env.CASHFREE_CLIENT_ID || '',
        secretKey: process.env.CASHFREE_CLIENT_SECRET || '',
        webhookSecret: process.env.CASHFREE_WEBHOOK_SECRET || '',
        updatedAt: FieldValue.serverTimestamp()
      });
      console.log("[Firebase Admin] Seeded default Cashfree setting (Inactive)");
    }

    const zapupiDoc = await firestore.collection('paymentSettings').doc('zapupi').get();
    if (!zapupiDoc.exists) {
      await firestore.collection('paymentSettings').doc('zapupi').set({
        name: 'ZapUPI',
        id: 'zapupi',
        isActive: true, // Activated by default
        isProduction: process.env.ZAPUPI_ENV === 'LIVE',
        apiKey: process.env.ZAPUPI_API_KEY || '',
        updatedAt: FieldValue.serverTimestamp()
      });
      console.log("[Firebase Admin] Seeded default ZapUPI setting (Active)");
    } else {
      // If it exists, ensure it's active as requested
      await firestore.collection('paymentSettings').doc('zapupi').update({
        isActive: true,
        updatedAt: FieldValue.serverTimestamp()
      });
      // Deactivate Cashfree to ensure ZapUPI is the only active one
      await firestore.collection('paymentSettings').doc('cashfree').update({
        isActive: false
      }).catch(() => {});
    }
  } catch (err) {
    console.error("[Firebase Admin] Seeding failed:", err);
  }
}

seedInitialData();

async function startServer() {
  const serverApp = express();
  const PORT = 3000;

  serverApp.use(cors());
  
  // API Request Logger
  serverApp.use("/api/*", (req, res, next) => {
    console.log(`[API Request] ${req.method} ${req.path}`);
    next();
  });
  
  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadsDir)) {
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
    } catch (e) {
      console.warn("[Uploads] Could not create public/uploads folder:", e);
    }
  }

  // Serve uploads statically
  serverApp.use("/uploads", express.static(uploadsDir));
  serverApp.use("/public/uploads", express.static(uploadsDir));
  
  // Middleware to capture raw body for webhook verification and support large uncompressed image uploads
  serverApp.use(express.json({
    limit: "50mb",
    verify: (req: any, res, buf) => {
      req.rawBody = buf.toString();
    }
  }));
  serverApp.use(express.urlencoded({ limit: "50mb", extended: true }));

// Helper to get active gateway config with environment variable fallback
  let lastAdminErrorTime = 0;
  async function getActiveGateway() {
    // 1. Prepare fallback config from environment variables
    const fallbackConfig = {
      id: "cashfree",
      name: "Cashfree (Fallback)",
      isActive: true,
      apiKey: process.env.CASHFREE_CLIENT_ID,
      secretKey: process.env.CASHFREE_CLIENT_SECRET,
      webhookSecret: process.env.CASHFREE_WEBHOOK_SECRET || process.env.CASHFREE_CLIENT_SECRET,
      isProduction: process.env.CASHFREE_ENV === "PRODUCTION"
    };

    const zapupiConfig = {
      id: "zapupi",
      name: "ZapUPI",
      isActive: true,
      apiKey: process.env.ZAPUPI_API_KEY,
      isProduction: process.env.ZAPUPI_ENV === "LIVE"
    };

    try {
      // Try Admin SDK first (using the specific databaseId reference)
      // If we are getting PERMISSION_DENIED, the service account lacks rights to this specific DB instance
      const snap = await firestore.collection('paymentSettings').where('isActive', '==', true).limit(1).get();
      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
      }
      
      const zapupiDoc = await firestore.collection('paymentSettings').doc('zapupi').get();
      if (zapupiDoc.exists && zapupiDoc.data()?.apiKey && zapupiDoc.data()?.isActive) {
        return { id: 'zapupi', ...zapupiDoc.data() } as any;
      }
    } catch (adminErr: any) {
      if (adminErr.message?.includes('PERMISSION_DENIED')) {
        // Expected if service account is restricted
      } else {
        const now = Date.now();
        if (now - lastAdminErrorTime > 300000) { // Log once per 5 minutes
           console.warn("[Firebase Admin] Payment settings fetch restricted:", adminErr.message);
           lastAdminErrorTime = now;
        }
      }
    }

    // Try Client SDK as last ditch effort
    try {
      const q = query(collection(frontendFirestore, 'paymentSettings'), where('isActive', '==', true));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
      }
    } catch (clientErr) {
      // Still failing? Use the environment variables if they exist
    }

    // Final fallback: Use environment variables if at least client ID exists
    if (zapupiConfig.apiKey && process.env.ZAPUPI_API_KEY) {
      console.log("[ZapUPI] Using environment variable fallback for configuration.");
      return zapupiConfig;
    }

    if (fallbackConfig.apiKey && fallbackConfig.secretKey) {
      console.log("[Cashfree] Using environment variable fallback for configuration.");
      return fallbackConfig;
    }

    return null;
  }

  // Uncompressed Original-Quality Image Upload Endpoint
  serverApp.post("/api/upload-image", async (req, res) => {
    try {
      const { imageBase64, filename } = req.body;
      if (!imageBase64) {
        return res.status(400).json({ error: "Missing image data" });
      }

      // If ImgBB API Key is configured, upload original high-res image to ImgBB
      const imgbbKey = process.env.IMGBB_API_KEY || process.env.IMAGEBB_API_KEY || process.env.VITE_IMGBB_API_KEY;
      if (imgbbKey) {
        try {
          const rawBase64 = imageBase64.includes(",") ? imageBase64.split(",")[1] : imageBase64;
          const formData = new URLSearchParams();
          formData.append("image", rawBase64);
          
          const imgbbRes = await axios.post(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, formData.toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 30000
          });
          if (imgbbRes.data?.data?.url) {
            console.log(`[Upload] Image uploaded to ImgBB at full original quality: ${imgbbRes.data.data.url}`);
            return res.json({ url: imgbbRes.data.data.url });
          }
        } catch (imgbbErr: any) {
          console.warn("[Upload] ImgBB upload failed, saving to local static storage:", imgbbErr.message);
        }
      }

      // Save raw uncompressed image directly to uploads folder
      let ext = "png";
      let base64Data = imageBase64;
      if (imageBase64.startsWith("data:")) {
        const match = imageBase64.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
        if (match) {
          ext = match[1] === "jpeg" ? "jpg" : match[1];
          base64Data = match[2];
        }
      } else if (filename && filename.includes(".")) {
        ext = filename.split(".").pop().toLowerCase();
      }

      const safeName = `match_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const filePath = path.join(uploadsDir, safeName);
      
      fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
      const directUrl = `/uploads/${safeName}`;
      console.log(`[Upload] Image saved locally at 100% original quality: ${directUrl}`);
      
      return res.json({ url: directUrl });
    } catch (error: any) {
      console.error("[Upload] Error saving uncompressed image:", error.message);
      return res.status(500).json({ error: "Failed to upload image" });
    }
  });

  // Cashfree Order Creation
  serverApp.post("/api/cashfree/create-order", async (req, res) => {
    try {
      console.log("Creating Cashfree order - Route hit successfully");
      const { amount, userId, customerName, customerEmail, customerPhone } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const config: any = await getActiveGateway();
      
      const isCashfree = config && (config.id === 'cashfree' || config.name?.toLowerCase().includes('cashfree'));
      
      if (!config || !isCashfree) {
        return res.status(400).json({ error: "Cashfree is not configured or active. Go to Admin -> Payment -> Activate Cashfree." });
      }

      const clientId = config.apiKey || process.env.CASHFREE_CLIENT_ID;
      const clientSecret = config.secretKey || process.env.CASHFREE_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        console.error("[Cashfree] Missing credentials in Firestore config!");
        return res.status(500).json({ error: "Cashfree credentials are missing in Admin settings." });
      }

      const isProd = config.isProduction || (clientId && !clientId.includes('TEST'));
      const environment = isProd ? "PRODUCTION" : "SANDBOX";

      (Cashfree as any).XClientId = clientId;
      (Cashfree as any).XClientSecret = clientSecret;
      (Cashfree as any).XEnvironment = isProd ? (Cashfree as any).Environment.PRODUCTION : (Cashfree as any).Environment.SANDBOX;

      // Determine base URL, prioritizing APP_URL then Vercel's x-forwarded-host
      let baseUrlFull = process.env.APP_URL;
      
      if (!baseUrlFull) {
        const publicHost = req.headers['x-forwarded-host'] || req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        baseUrlFull = `${protocol}://${publicHost}`;
      }
      
      // Ensure no trailing slash
      baseUrlFull = baseUrlFull.replace(/\/$/, "");

      const orderId = `order_${Date.now()}_${userId}`;
      
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

      console.log(`[Cashfree V5] Creating order: ${orderId} | Env: ${environment}`);
      const response = await (Cashfree as any).PGCreateOrder("2023-08-01", requestData);
      console.log(`[Cashfree V5] Order created successfully.`);
      res.json(response.data);
    } catch (error: any) {
      console.error("[Cashfree] Order Creation Error:", error.response?.data || error.message);
      res.status(500).json({ error: error.response?.data?.message || error.message || "Failed to create order" });
    }
  });

  // ZapUPI Order Creation
  serverApp.post("/api/zapupi/create-order", async (req, res) => {
    console.log("Creating ZapUPI order");
    console.log("Route hit successfully");
    try {
      const { amount, userId } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ success: false, error: "Invalid amount" });
      }

      const config: any = await getActiveGateway();
      
      if (!config || config.id !== 'zapupi') {
        return res.status(400).json({ error: "ZapUPI is not configured or active." });
      }

      const apiKey = config.apiKey || process.env.ZAPUPI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "ZapUPI API key is missing." });
      }

      // Fetch user profile from Firestore for accurate metadata
      let customerName = "Khel Galli User";
      let customerEmail = "user@khelgalli.com";
      let customerPhone = "9999999999";

      try {
        const userDoc = await firestore.collection('users').doc(userId).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          customerName = userData.username || customerName;
          customerEmail = userData.email || customerEmail;
          customerPhone = userData.mobile || userData.phone || customerPhone;
        }
      } catch (err) {
        console.warn(`[ZapUPI] Could not fetch user doc for ${userId}, using defaults.`);
      }

      const orderId = `zap_${Date.now()}_${userId}`;
      const isProd = config.isProduction || process.env.ZAPUPI_ENV === 'LIVE';
      
      // Determine base URL, prioritizing APP_URL then Vercel's x-forwarded-host
      let baseUrlFull = process.env.APP_URL;
      
      if (!baseUrlFull) {
        const publicHost = req.headers['x-forwarded-host'] || req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        baseUrlFull = `${protocol}://${publicHost}`;
      }
      
      // Ensure no trailing slash
      baseUrlFull = baseUrlFull.replace(/\/$/, "");

      const payload = {
        zap_key: apiKey,
        api_key: apiKey, // Backwards compatibility
        order_id: orderId,
        client_order_id: orderId, // Some versions use this
        amount: String(amount),
        customer_name: customerName,
        customer_email: customerEmail,
        customer_mobile: (customerPhone).slice(-10),
        webhook_url: `${baseUrlFull}/api/zapupi/webhook`,
        callback_url: `${baseUrlFull}/wallet?payment=success&order_id=${orderId}`,
        success_url: `${baseUrlFull}/wallet?payment=success&order_id=${orderId}`,
        failed_url: `${baseUrlFull}/wallet?payment=failed&order_id=${orderId}`,
        timeout_url: `${baseUrlFull}/wallet?payment=timeout&order_id=${orderId}`,
        redirect_url: `${baseUrlFull}/wallet?payment=success&order_id=${orderId}`,
        return_url: `${baseUrlFull}/wallet?payment=success&order_id=${orderId}`,
        description: `Wallet Deposit - ${userId}`
      };

      console.log(`[ZapUPI] [Redirect] Creating order: ${orderId} | Redirect Path: /wallet?order_id=${orderId}`);
      console.log(`[ZapUPI] Using Production URL for Webhook: ${baseUrlFull}/api/zapupi/webhook`);
      console.log(`[ZapUPI] Callback/Redirect URL set to: ${baseUrlFull}/wallet?order_id=${orderId}`);
      
      // Use verified base URL as priority, then environment, then fallback
      let baseUrl = (process.env.ZAPUPI_BASE_URL || "https://pay.zapupi.com").replace(/\/$/, "");
      if (baseUrl.includes("api.zapupi.com")) {
        baseUrl = baseUrl.replace("api.zapupi.com", "pay.zapupi.com");
      }
      
      const zapUrl = `${baseUrl}/api/create-order`;

      let result: any = null;
      try {
        console.log(`[ZapUPI] Requesting verified endpoint: ${zapUrl}`);
        const response = await axios.post(zapUrl, payload, {
          headers: { 
            'Content-Type': 'application/json',
            'User-Agent': 'KhelGalli-Server/1.6',
            'Accept': 'application/json'
          },
          timeout: 15000,
          transformResponse: [(data) => data] // Keep raw to check type
        });

        const responseData = response.data;
        const contentTypeHeader = response.headers['content-type'];
        const contentType = Array.isArray(contentTypeHeader) ? contentTypeHeader[0] : (contentTypeHeader ? String(contentTypeHeader) : "");

        if (contentType && contentType.includes("application/json")) {
          try {
            const json = JSON.parse(responseData);
            if (json.status === 'success' || json.status === 'SUCCESS' || json.redirect_url || json.payment_url) {
              result = json;
              console.log(`[ZapUPI] Order created successfully. Redirect URL: ${json.redirect_url || json.payment_url}`);
            } else {
              console.error(`[ZapUPI] API returned business error:`, JSON.stringify(json));
              return res.status(400).json({ error: json.msg || json.message || "Payment initiation failed" });
            }
          } catch (pErr) {
            console.error(`[ZapUPI] JSON parse failed at ${zapUrl}. Body snippet:`, responseData.substring(0, 200));
            return res.status(502).json({ error: "Invalid JSON response from gateway" });
          }
        } else {
          console.error(`[ZapUPI] Non-JSON response (HTML?) from ${zapUrl}. Content-Type: ${contentType}. Body snippet:`, responseData.substring(0, 500));
          return res.status(502).json({ error: "Gateway returned unexpected text/HTML response (maybe maintenance?)" });
        }
      } catch (err: any) {
        const status = err.response?.status;
        const errMsg = err.response?.data || err.message;
        console.error(`[ZapUPI] Request to ${zapUrl} failed (${status || 'No Status'}):`, typeof errMsg === 'string' ? errMsg.substring(0, 200) : err.message);
        return res.status(502).json({ error: `ZapUPI gateway unreachable: ${err.message}` });
      }
      
      res.json({ 
        order_id: orderId,
        payment_url: result.redirect_url || result.payment_url || result.paymentUrl,
        ...result 
      });
    } catch (error: any) {
      console.error("[ZapUPI] Order Creation Exception:", error.message);
      res.status(400).json({ error: `Internal server error: ${error.message}` });
    }
  });

// Helper to handle ZapUPI Wallet Credit
async function processZapUPIPayment(orderId: string, verifiedAmount: any, transactionId: string, utr: string, environment?: string) {
  const parts = orderId.split('_');
  const userId = parts[parts.length - 1];

  if (!userId) {
    console.error(`[ZapUPI] Could not identify User for Order: ${orderId}`);
    return { success: false, error: "User identification failed" };
  }

  const transRef = firestore.collection('transactions').doc(orderId);
  const userRef = firestore.collection('users').doc(userId);

  return await firestore.runTransaction(async (t: any) => {
    const transDoc = await t.get(transRef);
    
    if (transDoc.exists && transDoc.data()?.status === 'completed') {
      return { alreadyProcessed: true };
    }

    const depositAmount = Number(verifiedAmount);
    if (isNaN(depositAmount) || depositAmount <= 0) {
      throw new Error("Invalid deposit amount");
    }

    t.set(transRef, {
      userId: userId,
      type: 'deposit',
      amount: depositAmount,
      status: 'completed',
      title: 'Deposit via ZapUPI',
      paymentId: transactionId || orderId,
      utr: utr || '',
      gateway: 'zapupi',
      environment: environment || 'production',
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: transDoc.exists ? transDoc.data()?.createdAt : FieldValue.serverTimestamp()
    }, { merge: true });

    t.update(userRef, {
      'wallet.deposit': FieldValue.increment(depositAmount),
      'stats.totalDeposited': FieldValue.increment(depositAmount)
    });

    return { success: true };
  });
}

  // ZapUPI Status Check Pole API
  serverApp.post("/api/zapupi/check-status", async (req, res) => {
    try {
      const { order_id } = req.body;
      if (!order_id) return res.status(400).json({ error: "Missing order_id" });

      const config: any = await getActiveGateway();
      const apiKey = config?.apiKey || process.env.ZAPUPI_API_KEY;
      
      const customBase = process.env.ZAPUPI_BASE_URL ? process.env.ZAPUPI_BASE_URL.replace(/\/$/, "") : null;
      const hosts = [
        customBase,
        "https://pay.zapupi.com",
        "https://api.zapupi.com",
        "https://p1.zapupi.com"
      ].filter(Boolean);

      const paths = [
        "/api/get_order",
        "/api/get-order",
        "/api/v2/get_order",
        "/api/v1/get_order",
        "/api/v1/check_order"
      ];

      let status = 'pending';
      let verifiedData: any = null;

      console.log(`[ZapUPI Status Check] Polling for Order: ${order_id}`);

      outer: for (const host of hosts) {
        for (const path of paths) {
          const verifyUrl = `${host}${path}`;
          try {
            const verifyRes = await axios.post(verifyUrl, {
              zap_key: apiKey,
              order_id: order_id
            }, { timeout: 6000 });

            const vData = verifyRes.data;
            console.log(`[ZapUPI Status Check] Response from ${verifyUrl}:`, JSON.stringify(vData));

            // Detection for success variants
            const rawStatus = String(vData.status || vData.order_status || vData.orderStatus || '').toLowerCase();
            
            if (rawStatus === 'success' || rawStatus === 'completed' || rawStatus === 'paid') {
              status = 'success';
              verifiedData = vData;
              break outer;
            } else if (rawStatus === 'failed' || rawStatus === 'failure' || rawStatus === 'canceled' || rawStatus === 'cancelled') {
              status = 'failed';
              break outer;
            }
          } catch (err: any) {
            // Silently try next combination unless it's a non-404/non-DNS error
            if (!err.message.includes('404') && !err.message.includes('ENOTFOUND')) {
               console.log(`[ZapUPI Status Check] ${verifyUrl} gave unexpected error: ${err.message}`);
            }
          }
        }
      }

      if (status === 'success' && verifiedData) {
        console.log(`[ZapUPI Status Check] Successful status confirmed for ${order_id}`);
        const amount = verifiedData.amount || verifiedData.order_amount || verifiedData.pay_amount;
        const txId = verifiedData.txn_id || verifiedData.tx_id || order_id;
        const utr = verifiedData.utr || '';
        
        const result = await processZapUPIPayment(order_id, amount, txId, utr);
        return res.json({ status: 'success', alreadyProcessed: result.alreadyProcessed, detail: verifiedData });
      }

      res.json({ status, detail: verifiedData });
    } catch (error: any) {
      console.error("[ZapUPI Status Check] Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ZapUPI Webhook
  serverApp.post("/api/zapupi/webhook", async (req, res) => {
    try {
      console.log(`[ZapUPI Webhook] Raw Headers:`, JSON.stringify(req.headers));
      console.log(`[ZapUPI Webhook] Body Received:`, JSON.stringify(req.body));
      
      const { 
        status, 
        order_id, 
        amount, 
        pay_amount, 
        txn_id, 
        utr, 
        environment 
      } = req.body;

      const orderIdFinal = order_id || req.body.orderId;
      const amountFinal = pay_amount || amount || req.body.amount;
      const statusFinal = status || req.body.orderStatus;
      const transactionId = txn_id || req.body.tx_id;
      const utrFinal = utr || '';

      if (!orderIdFinal) {
        return res.status(400).json({ success: false, error: "Missing order_id" });
      }

      const config: any = await getActiveGateway();
      const apiKey = config?.apiKey || process.env.ZAPUPI_API_KEY;

      let isVerified = false;
      let verifiedAmount = amountFinal;
      let zapTransactionData: any = null;

      const customBase = process.env.ZAPUPI_BASE_URL ? process.env.ZAPUPI_BASE_URL.replace(/\/$/, "") : null;
      const hosts = [
        customBase,
        "https://pay.zapupi.com",
        "https://api.zapupi.com"
      ].filter(Boolean);

      const paths = [
        "/api/get_order",
        "/api/get-order",
        "/api/v2/get_order",
        "/api/v1/get_order"
      ];

      outer: for (const host of hosts) {
        for (const path of paths) {
          const verifyUrl = `${host}${path}`;
          try {
            const verifyRes = await axios.post(verifyUrl, {
              zap_key: apiKey,
              order_id: orderIdFinal
            }, { timeout: 8000 });

            const vData = verifyRes.data;
            const s = String(vData.status || vData.order_status || vData.orderStatus || '').toLowerCase();
            if (s === 'success' || s === 'completed' || s === 'paid') {
              isVerified = true;
              verifiedAmount = vData.amount || vData.order_amount || amountFinal;
              zapTransactionData = vData;
              console.log(`[ZapUPI Webhook] Verified via ${verifyUrl}`);
              break outer;
            }
          } catch (err) {}
        }
      }

      const isSuccess = isVerified || 
                        ['success', 'completed', 'paid'].includes(String(statusFinal).toLowerCase());
      
      if (isSuccess) {
        const result = await processZapUPIPayment(
          orderIdFinal, 
          verifiedAmount, 
          transactionId || zapTransactionData?.txn_id || orderIdFinal, 
          utrFinal || zapTransactionData?.utr || '',
          environment
        );
        
        if (result.success) console.log(`[ZapUPI Webhook] Wallet updated for ${orderIdFinal}`);
      }

      res.status(200).send("OK");
    } catch (error: any) {
      console.error("[ZapUPI Webhook] CRITICAL ERROR:", error.message);
      res.status(500).send("Internal Server Error");
    }
  });

  // Cashfree Webhook
  serverApp.post("/api/cashfree/webhook", async (req, res) => {
    try {
      const signature = req.headers["x-webhook-signature"] as string;
      const timestamp = req.headers["x-webhook-timestamp"] as string;
      const rawBody = (req as any).rawBody;

      if (!signature || !timestamp || !rawBody) {
        return res.status(400).json({ success: false, error: "Missing webhook headers" });
      }

      const config: any = await getActiveGateway();
      
      // Use env variables as fallback if Firestore is not yet configured
      const clientId = config?.apiKey || process.env.CASHFREE_CLIENT_ID;
      const clientSecret = config?.secretKey || process.env.CASHFREE_CLIENT_SECRET;
      const webhookSecret = config?.webhookSecret || process.env.CASHFREE_WEBHOOK_SECRET || clientSecret;
      
      if (!clientId || !clientSecret) {
         console.error("[Cashfree Webhook] No credentials found to verify signature!");
         return res.status(400).json({ success: false, error: "Gateway unconfigured" });
      }

      const isProd = (config?.isProduction) || (clientId && !clientId.includes('TEST'));
      const environment = isProd ? "PRODUCTION" : "SANDBOX";
      
      const { data: eventData, type } = req.body;
      const orderId = eventData?.order?.order_id;
      
      (Cashfree as any).XClientId = clientId;
      (Cashfree as any).XClientSecret = clientSecret;
      (Cashfree as any).XEnvironment = isProd ? (Cashfree as any).Environment.PRODUCTION : (Cashfree as any).Environment.SANDBOX;

      try {
        console.log(`[Cashfree Webhook] Verifying signature for Order: ${orderId || 'Unknown'}...`);
        // V5 webhook verification is often static
        (Cashfree as any).PGVerifyWebhookSignature(signature, rawBody, timestamp);
        console.log(`[Cashfree Webhook] Signature verified.`);
      } catch (err) {
        console.warn("[Cashfree Webhook] Signature verification failed");
        return res.status(401).json({ success: false, error: "Invalid signature" });
      }
      
      if (!orderId) {
        return res.status(200).json({ success: true, message: "OK - No Order ID" });
      }

      console.log(`[Cashfree Webhook] Event: ${type} | Order: ${orderId}`);
      
      const userId = eventData.customer_details.customer_id;
      const amount = Number(eventData.payment.payment_amount);
      const paymentId = eventData.payment.cf_payment_id;

      const transRef = firestore.collection('transactions').doc(orderId);
      const userRef = firestore.collection('users').doc(userId);

      if (type === "PAYMENT_SUCCESS_WEBHOOK") {
        await firestore.runTransaction(async (t) => {
          const transDoc = await t.get(transRef);
          
          if (transDoc.exists && transDoc.data()?.status === 'completed') {
            console.log(`[Cashfree Webhook] Order ${orderId} already completed. skipping.`);
            return;
          }

          t.set(transRef, {
            userId: userId,
            type: 'deposit',
            amount: amount,
            status: 'completed',
            title: 'Deposit via Cashfree',
            paymentId: paymentId,
            gateway: 'cashfree',
            updatedAt: FieldValue.serverTimestamp(),
            createdAt: transDoc.exists ? transDoc.data()?.createdAt : FieldValue.serverTimestamp()
          }, { merge: true });

          t.update(userRef, {
            'wallet.deposit': FieldValue.increment(amount),
            'stats.totalDeposited': FieldValue.increment(amount)
          });
        });
        console.log(`[Cashfree Webhook] Wallet updated for user ${userId} | Amount: ${amount}`);
      } else {
        // Record non-success events too
        const status = type === "PAYMENT_FAILED_WEBHOOK" ? 'failed' : 
                       (type === "PAYMENT_USER_DROPPED_WEBHOOK" ? 'abandoned' : 'pending');
        
        await transRef.set({
          userId: userId,
          type: 'deposit',
          amount: amount,
          status: status,
          title: `Deposit ${status} via Cashfree`,
          paymentId: paymentId,
          gateway: 'cashfree',
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        console.log(`[Cashfree Webhook] Order ${orderId} status set to ${status}`);
      }

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("[Cashfree Webhook] Internal Error:", error);
      res.status(500).json({ success: false, error: "Internal Server Error", detail: error.message });
    }
  });

  // API Catch-all for undefined routes
  serverApp.all("/api/*", (req, res) => {
    res.status(404).json({ success: false, error: `API route ${req.method} ${req.originalUrl} not found` });
  });

  // Global error handler for API routes
  serverApp.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith("/api/")) {
      console.error(`[API Error] ${req.method} ${req.path}:`, err);
      return res.status(500).json({ 
        success: false, 
        error: "Internal Server Error", 
        message: err.message 
      });
    }
    next(err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    serverApp.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    serverApp.use(express.static(distPath));
    serverApp.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  serverApp.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
