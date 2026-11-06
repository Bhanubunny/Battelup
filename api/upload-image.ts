import axios from "axios";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "50mb"
    }
  }
};

export default async function handler(req: any, res: any) {
  // Enable CORS
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

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { imageBase64, filename } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ success: false, error: "Missing imageBase64 data" });
    }

    // 1. Read ImgBB API key from production environment
    const imgbbKey = 
      process.env.IMGBB_API_KEY || 
      process.env.VITE_IMGBB_API_KEY || 
      process.env.IMAGEBB_API_KEY;

    if (imgbbKey) {
      try {
        const rawBase64 = imageBase64.includes(",") 
          ? imageBase64.split(",")[1] 
          : imageBase64;

        const formData = new URLSearchParams();
        formData.append("image", rawBase64);
        if (filename) {
          formData.append("name", filename.replace(/\.[^/.]+$/, ""));
        }

        console.log(`[Upload Image] Uploading full resolution image to ImgBB...`);
        const imgbbRes = await axios.post(
          `https://api.imgbb.com/1/upload?key=${imgbbKey}`,
          formData.toString(),
          {
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            timeout: 30000
          }
        );

        if (imgbbRes.data?.data?.url) {
          const directUrl = imgbbRes.data.data.url;
          console.log(`[Upload Image] ImgBB upload succeeded: ${directUrl}`);
          return res.status(200).json({ 
            success: true, 
            url: directUrl,
            data: imgbbRes.data.data 
          });
        } else {
          console.warn("[Upload Image] ImgBB responded without URL:", imgbbRes.data);
        }
      } catch (imgbbErr: any) {
        console.error("[Upload Image] Server ImgBB upload error:", imgbbErr.response?.data || imgbbErr.message);
        return res.status(502).json({ 
          success: false, 
          error: "ImgBB upload service failed: " + (imgbbErr.response?.data?.error?.message || imgbbErr.message)
        });
      }
    }

    // If no ImgBB API key configured on server, return error indicating missing key or direct base64 fallback
    console.warn("[Upload Image] No IMGBB_API_KEY found in server environment.");
    return res.status(200).json({
      success: true,
      url: imageBase64,
      note: "Stored as direct DataURL. Add IMGBB_API_KEY to environment variables for hosted storage."
    });
  } catch (error: any) {
    console.error("[Upload Image] Internal handler exception:", error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || "Failed to upload image" 
    });
  }
}
