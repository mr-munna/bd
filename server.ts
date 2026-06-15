import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";
import admin from "firebase-admin";
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf-8'));
const targetProjectId = firebaseConfig.projectId || "gen-lang-client-0163892992";

// CRITICAL: Set the project ID in environment variables to avoid cross-project API errors
process.env.GOOGLE_CLOUD_PROJECT = targetProjectId;
process.env.GCLOUD_PROJECT = targetProjectId;

console.log(`Initializing Firebase Admin for project: ${targetProjectId}`);

let firebaseApp: any;
try {
  // Use default app initialization with explicit projectId
  if (admin.apps.length === 0) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: targetProjectId,
    });
  } else {
    firebaseApp = admin.app();
  }
  console.log("Firebase initialized successfully.");
} catch (err: any) {
  console.error("Error initializing Firebase Admin:", err);
  throw err;
}

let db: any;
try {
  if (firebaseConfig.firestoreDatabaseId) {
    console.log(`Connecting to Firestore database: ${firebaseConfig.firestoreDatabaseId}`);
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
  } else {
    console.log("Connecting to default Firestore database");
    db = getFirestore(firebaseApp);
  }
  console.log("Firestore targeting project:", targetProjectId);
} catch (err) {
  console.error("Error connecting to Firestore:", err);
  throw err;
}

const app = express();
app.use(express.json());

const PORT = 3000;

// Email Transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// API Routes
app.get("/api/test-email", async (req, res) => {
  console.log("Test email request received.");
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return res.status(400).json({ success: false, error: "Email credentials missing in Settings." });
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: 'bijoymahmudmunna@gmail.com',
      subject: "Test Email from Inventory System",
      text: "This is a test email to verify your configuration. If you receive this, your email settings are correct!",
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`Test email sent. MessageId: ${info.messageId}`);
    res.json({ success: true, message: "Test email sent successfully to bijoymahmudmunna@gmail.com" });
  } catch (error: any) {
    console.error("Test email failed:", error);
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

app.post("/api/welcome-email", async (req, res) => {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, error: "Email is required." });
  }

  const displayName = name || email.split('@')[0];

  try {
    const subject = "Welcome to BAROBI DESIGN!";
    const welcomeHtml = `
      <div style="font-family: 'Inter', helvetica, sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;">
        <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          <div style="background-color: #064e3b; padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 2px;">BAROBI DESIGN</h1>
          </div>
          <div style="padding: 40px 32px;">
            <h2 style="font-size: 22px; font-weight: 700; color: #0f172a; margin-top: 0; margin-bottom: 20px;">Welcome to the Family, ${displayName}!</h2>
            <p style="font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 24px;">
              Thank you for registering an account with <strong>BAROBI DESIGN</strong>. We are thrilled to welcome you to our official Inventory Management System.
            </p>
            <div style="background-color: #f1f5f9; border-left: 4px solid #064e3b; padding: 16px; border-radius: 4px 12px 12px 4px; margin-bottom: 24px;">
              <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.5;">
                <strong>Next Step:</strong> Since we keep our system highly secure, one of our administrators will review your registration details. Your account is currently in <strong>Pending Review</strong> status. Once approved, you will receive full access.
              </p>
            </div>
            <p style="font-size: 15px; line-height: 1.6; color: #475569; margin-bottom: 32px;">
              If you haven't verified your email yet, please use the verification link sent during registration. Doing so will ensure our administrators can fast-track your approval process.
            </p>
            <div style="text-align: center; margin-bottom: 32px;">
              <a href="https://ais-pre-o6xlfm6viyk4ykxe62ziev-672751479638.asia-southeast1.run.app" style="display: inline-block; background-color: #064e3b; color: #ffffff; padding: 14px 28px; border-radius: 9999px; text-decoration: none; font-weight: bold; font-size: 15px;">
                Go to Dashboard
              </a>
            </div>
            <p style="font-size: 14px; color: #94a3b8; margin: 0; border-top: 1px solid #e2e8f0; padding-top: 24px;">
              If you did not sign up for this account, please ignore this email or contact us immediately.
            </p>
          </div>
          <div style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #f1f5f9; font-size: 12px; color: #64748b;">
            <p style="margin: 0 0 8px 0;">&copy; ${new Date().getFullYear()} BAROBI DESIGN. All rights reserved.</p>
            <p style="margin: 0;">Inventory Management & Design Systems Division</p>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: subject,
      html: welcomeHtml,
    };

    console.log(`Sending welcome email to ${email}...`);
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const info = await transporter.sendMail(mailOptions);
      console.log(`Welcome email successfully sent to ${email}. MessageId: ${info.messageId}`);
      res.json({ success: true, message: `Welcome email sent successfully to ${email}` });
    } else {
      console.warn("Unable to send welcome email: EMAIL_USER or EMAIL_PASS environment variables are missing.");
      res.json({ success: false, error: "Email transporter credentials missing in environment settings." });
    }
  } catch (error: any) {
    console.error("Welcome email failed:", error);
    res.status(500).json({ success: false, error: error.message || String(error) });
  }
});

app.post("/api/notify", async (req, res) => {
  const { action, category, itemName, details } = req.body;
  console.log(`Received notification request: ${action} ${category} ${itemName}`);

  try {
    // Get all approved users
    console.log("Fetching approved users...");
    // If client provided emails directly, use those to bypass Firebase Admin rules
    let approvedEmails: string[] = [];
    if (req.body.notifyEmails && Array.isArray(req.body.notifyEmails)) {
      approvedEmails = req.body.notifyEmails;
    } else {
      let usersSnapshot;
      try {
        usersSnapshot = await db.collection('users').where('status', '==', 'approved').get();
        console.log(`Found ${usersSnapshot.size} approved users.`);
      } catch (dbErr: any) {
        console.error("Firestore query failed:", dbErr.message || dbErr);
        if (dbErr.code === 7) {
          console.error("Permission Denied. This service account may not have access to the database.");
        }
        // Fallback: only notify supreme admin if DB fails
        usersSnapshot = { docs: [], size: 0 };
      }
      
      approvedEmails = usersSnapshot.docs.map((doc: any) => doc.data().email).filter((email: string) => !!email);
    }
    
    // Always include supreme admin if not already present
    const supremeAdminEmail = 'bijoymahmudmunna@gmail.com';
    if (!approvedEmails.includes(supremeAdminEmail)) {
      approvedEmails.push(supremeAdminEmail);
      console.log(`Added supreme admin ${supremeAdminEmail} to notification list.`);
    }

    console.log(`Final notification list: ${approvedEmails.join(', ')}`);

    if (approvedEmails.length === 0) {
      console.log("No emails to notify.");
      return res.json({ success: true, message: "No users to notify." });
    }

    const isMaster = details?.isMasterSheet;
    const userEmail = details?.userEmail || 'Unknown';
    const userName = details?.userName || 'Unknown User';

    const subject = `${isMaster ? '[MASTER SHEET] ' : ''}Inventory Update: ${action.toUpperCase()} - ${category.toUpperCase()}`;
    const text = `
      Inventory Notification:
      ${isMaster ? 'CRITICAL: Action performed in MASTER SHEET' : ''}
      
      Action: ${action}
      Category: ${category}
      Item Name: ${itemName}
      Performed By: ${userName} (${userEmail})
      
      Details:
      ${JSON.stringify(details, null, 2)}
      
      Time: ${new Date().toLocaleString()}
      
      This is an automated notification from the Inventory Management System.
    `;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: approvedEmails.join(', '),
      subject: subject,
      text: text,
    };

    console.log("Attempting to send email...");
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const info = await transporter.sendMail(mailOptions);
      console.log(`Notification email sent. MessageId: ${info.messageId}`);
      res.json({ success: true });
    } else {
      console.warn("Email credentials missing (EMAIL_USER or EMAIL_PASS). Notification not sent.");
      res.json({ success: false, error: "Email credentials missing" });
    }
  } catch (error) {
    console.error("Error sending notification:", error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

app.get("/api/proxy-image", async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    return res.status(400).send("Missing URL parameter");
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type") || "image/jpeg";
    
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Content-Type", contentType);
    // Cache control to speed up subsequent requests
    res.set("Cache-Control", "public, max-age=31536000");
    
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    console.error("Proxy image error:", error);
    res.status(500).send(error.message || "Failed to proxy image");
  }
});

async function startServer() {
  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
