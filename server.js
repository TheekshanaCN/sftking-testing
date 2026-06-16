import "dotenv/config";
import geoip from "geoip-lite";
import os from "os";
import { exec } from "child_process";
import crypto from "crypto";
import axios from "axios";
import helmet from "helmet";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import next from "next";
import cors from "cors";
import { Sequelize, DataTypes, Op } from "sequelize";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import { GoogleGenerativeAI } from "@google/generative-ai";
import nodemailer from "nodemailer";
import {
  cert,
  getApps as getFirebaseAdminApps,
  initializeApp as initializeFirebaseAdminApp,
} from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { fileURLToPath } from "url"; // 🚀 1. ADD THIS IMPORT
import startAutoNuke from "./src/app/utils/autoNuke.js"; // 🚀 IMPORT THE ASSASSIN
// Add these to your imports at the top!
import fsExtra from "fs-extra";

const BACKUP_SCHEMA_VERSION = "1.0.0";

// 🚀 2. RECREATE __dirname FOR ES MODULES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 🚀 INITIALIZE THE SFT KING AI ENGINE
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const writtenAnswersDir = path.join(__dirname, "uploads", "written-answers");
if (!fs.existsSync(writtenAnswersDir)) {
  fs.mkdirSync(writtenAnswersDir, { recursive: true });
}

// 🚀 CONFIGURE THE UPLOAD ENGINE (Names the files with the Student ID!)
const writtenStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, writtenAnswersDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "student-" + req.user.id + "-" + uniqueSuffix + ext);
  },
});

// ================= POSTER UPLOAD ENGINE =================
const posterStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOAD_DIR, "posters");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, "poster-" + uniqueSuffix + ext);
  },
});
const uploadPoster = multer({
  storage: posterStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

// 🚀 SMART DEVICE SCANNER
const getDeviceName = (req) => {
  const ua = req.headers["user-agent"] || "";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "Apple iOS";
  if (/windows/i.test(ua)) return "Windows PC";
  if (/macintosh|mac os x/i.test(ua)) return "MacBook";
  if (/linux/i.test(ua)) return "Linux PC";
  return "Unknown Device";
};

const uploadWritten = multer({
  storage: writtenStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// ... Keep the rest of your code exactly as it is below this line! ...

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const server = express();
server.set("trust proxy", 1);

const httpServer = http.createServer(server);

// ================= OTP CORE (ADD ONCE) =================
const OTP_STORE = new Map(); // for /api/send-otp (register)
const FORGOT_STORE = new Map(); // for /api/forgot/*

// TTLs
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const RESET_TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_TRIES = 5;

const genOtp = () => String(Math.floor(1000 + Math.random() * 9000));
const genToken = () => crypto.randomBytes(24).toString("hex");
const sha256 = (s) =>
  crypto.createHash("sha256").update(String(s)).digest("hex");
const createSessionId = () => crypto.randomBytes(16).toString("hex");

const mobileRegex = /^07\d{8}$/;

const isStrongPassword = (pw = "") => {
  const p = String(pw);
  const hasMinLen = p.length >= 10;
  const hasUpper = /[A-Z]/.test(p);
  const hasLower = /[a-z]/.test(p);
  const hasNum = /\d/.test(p);
  const hasSym = /[^A-Za-z0-9]/.test(p);
  return hasMinLen && hasUpper && hasLower && hasNum && hasSym;
};

const isValidEmail = (value = "") => {
  const email = String(value || "").trim();
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidSriLankanNIC = (value = "") => {
  const nic = String(value || "")
    .trim()
    .toUpperCase();
  if (!nic) return false;
  return /^\d{9}[VX]$/.test(nic) || /^\d{12}$/.test(nic);
};

function normalizeLK(mobile) {
  // 07XXXXXXXX -> 94XXXXXXXXX (no +)
  const m = String(mobile || "").trim();
  if (/^07\d{8}$/.test(m)) return "94" + m.slice(1);
  if (/^94\d{9}$/.test(m)) return m;
  if (/^0094\d{9}$/.test(m)) return m.slice(2); // 0094... -> 94...
  return m;
}
async function sendTextItSMS(to, message) {
  const USERNAME = process.env.TEXTIT_USER;
  const PASSWORD = process.env.TEXTIT_PASSWORD;

  if (!USERNAME || !PASSWORD) {
    throw new Error("TextIt credentials missing in .env");
  }

  // TextIt strictly prefers GET requests with query parameters
  const url = `https://www.textit.biz/sendmsg?id=${USERNAME}&pw=${PASSWORD}&to=${to}&text=${encodeURIComponent(message)}`;

  const response = await axios.get(url, { timeout: 15000 });
  const body = response.data?.toString().trim() || "";

  console.log(`TextIt response for ${to}:`, body);

  // TextIt returns "OK:MessageID" on success.
  if (!body.toUpperCase().startsWith("OK")) {
    throw new Error(`TextIt API rejected the request. Reason: ${body}`);
  }

  return true;
}

// --- 1. CONFIGURATION ---
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// --- PDF UPLOAD DIR ---

function resolvePdfAbsPath(storedPathOrUrl) {
  // stored as "/uploads/pdfs/xxx.pdf" OR "uploads/pdfs/xxx.pdf"
  if (!storedPathOrUrl) return null;
  const rel = storedPathOrUrl.startsWith("/")
    ? storedPathOrUrl.slice(1)
    : storedPathOrUrl;
  return path.join(__dirname, rel);
}

let firebaseAdminApp = null;

const getFirebaseAdminApp = () => {
  if (firebaseAdminApp) return firebaseAdminApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) return null;

  const existingApp = getFirebaseAdminApps().find(
    (app) => app.name === "[DEFAULT]",
  );
  if (existingApp) {
    firebaseAdminApp = existingApp;
    return firebaseAdminApp;
  }

  firebaseAdminApp = initializeFirebaseAdminApp({
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || undefined,
  });

  return firebaseAdminApp;
};

const parseNotificationTokens = (value) => {
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(parsed.map((token) => String(token).trim()).filter(Boolean)),
    );
  } catch {
    return [];
  }
};

const writeNotificationTokens = async (userId, tokens) => {
  await User.update(
    { notificationTokens: JSON.stringify(tokens) },
    { where: { id: userId } },
  );
};

const addNotificationToken = async (userId, token) => {
  const user = await User.findByPk(userId);
  if (!user) return false;

  const tokens = parseNotificationTokens(user.notificationTokens);
  if (!tokens.includes(token)) {
    tokens.push(token);
    await writeNotificationTokens(userId, tokens);
  }

  return true;
};

const removeNotificationToken = async (userId, token) => {
  const user = await User.findByPk(userId);
  if (!user) return false;

  const tokens = parseNotificationTokens(user.notificationTokens).filter(
    (item) => item !== token,
  );
  await writeNotificationTokens(userId, tokens);
  return true;
};

let notificationsEmailEnabled = true;
let notificationsPushEnabled = true;

const setNotificationFlags = ({ emailEnabled, pushEnabled }) => {
  if (typeof emailEnabled === "boolean")
    notificationsEmailEnabled = emailEnabled;
  if (typeof pushEnabled === "boolean") notificationsPushEnabled = pushEnabled;
};

const isEmailNotificationsEnabled = () => notificationsEmailEnabled !== false;
const isPushNotificationsEnabled = () => notificationsPushEnabled !== false;

const sendPushNotificationToUsers = async (userIds, notification) => {
  if (!isPushNotificationsEnabled())
    return { sent: 0, skipped: true, disabled: true };
  const ids = Array.from(
    new Set((userIds || []).map((id) => String(id)).filter(Boolean)),
  );
  if (!ids.length) return { sent: 0, skipped: true };

  const app = getFirebaseAdminApp();
  if (!app) return { sent: 0, skipped: true };

  const users = await User.findAll({
    where: { id: ids },
    attributes: ["id", "notificationTokens"],
  });

  const tokens = Array.from(
    new Set(
      users.flatMap((user) => parseNotificationTokens(user.notificationTokens)),
    ),
  );
  if (!tokens.length) return { sent: 0, skipped: true };

  const messaging = getMessaging(app);
  const result = await messaging.sendEachForMulticast({
    tokens,
    data: {
      title: String(notification.title || "SFT KING"),
      body: String(notification.body || "You have a new notification."),
      url: String(notification.url || "/"),
      type: String(notification.type || "generic"),
      senderId: String(notification.senderId || ""),
      receiverId: String(notification.receiverId || ""),
      messageId: String(notification.messageId || ""),
      conversationId: String(notification.conversationId || ""),
    },
  });

  return { sent: result.successCount, failed: result.failureCount };
};

let mailTransporter = null;

const getMailTransporter = () => {
  if (!isEmailNotificationsEnabled()) return null;
  if (mailTransporter) return mailTransporter;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure =
    String(process.env.SMTP_SECURE || "false").toLowerCase() === "true";
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;

  if (!host || !user || !pass) return null;

  mailTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });

  return mailTransporter;
};

const resolveSupportEmailRecipient = (receiver) => {
  const fallback =
    process.env.SUPPORT_ALERT_EMAIL ||
    process.env.SMTP_USER ||
    process.env.GMAIL_USER ||
    null;
  if (!receiver) return fallback;

  if (receiver.role === "admin") {
    return process.env.ADMIN_SUPPORT_EMAIL || fallback;
  }

  return receiver.email || fallback;
};

const sendSupportEmailAlert = async ({
  sender,
  receiver,
  content,
  messageId,
}) => {
  console.log("[EMAIL] sendSupportEmailAlert called", {
    senderId: sender?.id,
    receiverId: receiver?.id,
  });

  const transporter = getMailTransporter();
  if (!transporter) {
    console.log("[EMAIL] No transporter - SMTP config missing or invalid");
    return { skipped: true };
  }

  const to = resolveSupportEmailRecipient(receiver);
  if (!to) {
    console.log("[EMAIL] No recipient email address resolved");
    return { skipped: true };
  }

  const from =
    process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.GMAIL_USER;
  if (!from) {
    console.log("[EMAIL] No sender email configured");
    return { skipped: true };
  }

  console.log("[EMAIL] Config valid - TO:", to, "FROM:", from);

  const senderName =
    sender?.name || sender?.mobile || `User #${sender?.id || "unknown"}`;
  const supportAddress = process.env.SMTP_USER || process.env.GMAIL_USER || "";
  const portalUrl =
    receiver?.role === "admin"
      ? process.env.ADMIN_SUPPORT_URL || "https://sftking.lk/admin/support"
      : process.env.STUDENT_SUPPORT_URL || "https://sftking.lk/student/help";
  const uniqueRef = `${messageId || "na"}-${Date.now()}`;
  const preview =
    String(content || "")
      .trim()
      .slice(0, 72) || "New support message";

  const subject = "New support message";
  const text = `${senderName}: ${preview}`;

  const safeMessage = String(content || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .trim();

  const html = `
    <div style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <div style="display:none;max-height:0;overflow:hidden;">
        ${senderName}: ${preview}
      </div>
      <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
        &zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;
      </div>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef2f7;padding:24px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #d9e1ea;border-radius:14px;overflow:hidden;">
              <tr>
                <td style="padding:18px 22px;background:#fff;border-bottom:1px solid #e5e7eb;">
                  <p style="margin:0;font-size:20px;line-height:1.2;font-weight:800;color:#101828;">SFT King</p>
                  <p style="margin:6px 0 0 0;font-size:12px;line-height:1.4;color:#667085;">Support Alert</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 22px 0 22px;">
                  <p style="margin:0;white-space:pre-wrap;word-break:break-word;font-size:22px;line-height:1.45;font-weight:800;color:#111827;">
                    ${safeMessage || "(No message content)"}
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 22px 0 22px;font-size:12px;line-height:1.5;color:#6b7280;border-top:1px solid #e5e7eb;margin-top:12px;">
                  From: ${senderName}
                </td>
              </tr>
              <tr>
                <td style="padding:16px 22px 22px 22px;font-size:13px;line-height:1.6;color:#475467;">
                  Open support desk:
                  <a href="${portalUrl}" style="color:#0f4c81;text-decoration:underline;word-break:break-all;">${portalUrl}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
    replyTo: supportAddress || undefined,
    headers: {
      "X-Entity-Ref-ID": uniqueRef,
    },
  });

  console.log("[EMAIL] Successfully sent to:", to);
  return { sent: true };
};

const parseBatchTargets = (rawBatches) => {
  try {
    const parsed = Array.isArray(rawBatches)
      ? rawBatches
      : typeof rawBatches === "string"
        ? JSON.parse(rawBatches)
        : [];
    if (!Array.isArray(parsed)) return ["All"];

    const clean = parsed
      .map((item) => String(item || "").trim())
      .filter(Boolean);

    return clean.length ? clean : ["All"];
  } catch {
    return ["All"];
  }
};

const formatSriLankaDateTime = (value) => {
  if (!value) return "Check exam portal for start time";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Check exam portal for start time";

  return `${date.toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })} LKT`;
};

const sendMcqScheduledNotifications = async ({
  quiz,
  trigger = "scheduled",
}) => {
  if (!quiz || quiz.status !== "scheduled") return { skipped: true };

  const targetBatches = parseBatchTargets(quiz.batches).map((b) =>
    b.toLowerCase(),
  );
  const isAllBatches = targetBatches.includes("all");

  const students = await User.findAll({
    where: {
      role: "student",
      status: "active",
    },
    attributes: ["id", "name", "email", "batch"],
  });

  const recipients = students.filter((student) => {
    if (isAllBatches) return true;
    const normalizedBatch = String(student.batch || "")
      .trim()
      .toLowerCase();
    return normalizedBatch && targetBatches.includes(normalizedBatch);
  });

  if (!recipients.length) {
    console.log("[MCQ NOTIFY] No recipients for scheduled exam", {
      quizId: quiz.id,
      batches: targetBatches,
    });
    return { sent: 0, skipped: true };
  }

  const quizTitle = String(quiz.title || "MCQ exam");
  const startLabel = formatSriLankaDateTime(quiz.startTime);

  const pushPayload = {
    title: "MCQ exam scheduled",
    body: `${quizTitle} - ${startLabel}`,
    url: "/student/exams",
    type: "mcq_schedule",
    messageId: String(quiz.id || ""),
    conversationId: String(trigger || "scheduled"),
  };

  const pushResult = await sendPushNotificationToUsers(
    recipients.map((student) => student.id),
    pushPayload,
  );

  const transporter = getMailTransporter();
  const from =
    process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.GMAIL_USER;
  const supportAddress =
    process.env.SMTP_USER || process.env.GMAIL_USER || undefined;
  const examListUrl =
    process.env.STUDENT_MCQ_LIST_URL || "https://sftking.lk/student/exams";
  const examBaseUrl = (
    process.env.STUDENT_MCQ_EXAM_URL_BASE || "https://sftking.lk/mcq-exam"
  ).replace(/\/$/, "");
  const examUrl = `${examBaseUrl}/${quiz.id}`;

  let emailSent = 0;
  if (transporter && from) {
    const emailTargets = recipients.filter((student) =>
      String(student.email || "").trim(),
    );
    const emailJobs = emailTargets.map((student) => {
      const studentName = String(student.name || "Student");
      const to = String(student.email).trim();
      const preview = `${quizTitle} - ${startLabel}`;

      const text = [
        `Hi ${studentName},`,
        "",
        "A new MCQ exam has been scheduled.",
        `Exam: ${quizTitle}`,
        `Start: ${startLabel}`,
        `Open exam: ${examUrl}`,
        `Exam list: ${examListUrl}`,
      ].join("\n");

      const html = `
        <div style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#111827;">
          <div style="display:none;max-height:0;overflow:hidden;">${preview}</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef2f7;padding:24px 12px;">
            <tr>
              <td align="center">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="width:100%;max-width:620px;background:#ffffff;border:1px solid #d9e1ea;border-radius:14px;overflow:hidden;">
                  <tr>
                    <td style="padding:18px 22px;background:#fff;border-bottom:1px solid #e5e7eb;">
                      <p style="margin:0;font-size:20px;line-height:1.2;font-weight:800;color:#101828;">SFT King</p>
                      <p style="margin:6px 0 0 0;font-size:12px;line-height:1.4;color:#667085;">MCQ Exam Scheduled</p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:18px 22px 0 22px;font-size:16px;line-height:1.5;color:#111827;font-weight:700;">${quizTitle}</td>
                  </tr>
                  <tr>
                    <td style="padding:10px 22px 0 22px;font-size:14px;line-height:1.6;color:#374151;">Start: ${startLabel}</td>
                  </tr>
                  <tr>
                    <td style="padding:16px 22px 22px 22px;font-size:13px;line-height:1.6;color:#475467;">
                      Open exam: <a href="${examUrl}" style="color:#0f4c81;text-decoration:underline;word-break:break-all;">${examUrl}</a><br/>
                      Exam list: <a href="${examListUrl}" style="color:#0f4c81;text-decoration:underline;word-break:break-all;">${examListUrl}</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </div>
      `;

      return transporter.sendMail({
        from,
        to,
        subject: "MCQ exam scheduled",
        text,
        html,
        replyTo: supportAddress,
        headers: {
          "X-Entity-Ref-ID": `mcq-${quiz.id}-${trigger}`,
        },
      });
    });

    const emailResults = await Promise.allSettled(emailJobs);
    emailSent = emailResults.filter(
      (result) => result.status === "fulfilled",
    ).length;
  }

  console.log("[MCQ NOTIFY] Scheduled exam notifications completed", {
    quizId: quiz.id,
    trigger,
    recipients: recipients.length,
    pushSent: pushResult?.sent || 0,
    emailSent,
  });

  return {
    recipients: recipients.length,
    push: pushResult,
    emailSent,
  };
};

const getStudentDisplayId = (student) => {
  if (!student) return "N/A";
  return (
    String(
      student.studentCode ||
        student.hallClass ||
        `${student.classMode || "student"}-${student.id || "na"}`,
    ).trim() || "N/A"
  );
};

const sendNewAccountCreatedAdminAlert = async ({ student }) => {
  if (!student) return { skipped: true };

  const adminUsers = await User.findAll({
    where: { role: "admin" },
    attributes: ["id", "email", "name"],
  });

  const adminIds = adminUsers.map((admin) => admin.id);
  const emailTargets = Array.from(
    new Set(
      [
        process.env.ADMIN_SUPPORT_EMAIL,
        process.env.SUPPORT_ALERT_EMAIL,
        process.env.SMTP_USER,
        process.env.GMAIL_USER,
        "sftking.support@gmail.com",
        ...adminUsers.map((admin) =>
          String(admin.email || "")
            .trim()
            .toLowerCase(),
        ),
      ].filter((value) =>
        isValidEmail(
          String(value || "")
            .trim()
            .toLowerCase(),
        ),
      ),
    ),
  );

  const studentName = String(student.name || "New student");
  const studentBatch = String(student.batch || "N/A");
  const displayId = getStudentDisplayId(student);
  const studentMode = String(student.classMode || "N/A");
  const studentHallClass = student.hallClass
    ? String(student.hallClass)
    : "N/A";
  const studentEmail = String(student.email || "N/A");
  const studentMobile = String(student.mobile || "N/A");
  const studentAddress = String(student.address || "N/A");
  const createdAtLabel = student.createdAt
    ? new Date(student.createdAt).toLocaleString("en-GB", {
        timeZone: "Asia/Colombo",
      })
    : new Date().toLocaleString("en-GB", { timeZone: "Asia/Colombo" });

  const pushPayload = {
    title: "New account created",
    body: `${studentName} | ${studentBatch} | ${displayId}`,
    url: "/admin/students",
    type: "new_student_registered",
    senderId: String(student.id || ""),
    messageId: String(student.id || ""),
  };

  let pushResult = { sent: 0, skipped: true };
  try {
    pushResult = adminIds.length
      ? await sendPushNotificationToUsers(adminIds, pushPayload)
      : { sent: 0, skipped: true };
  } catch (error) {
    console.error(
      "[ADMIN NOTIFY] Registration push error:",
      error?.message || error,
    );
  }

  const transporter = getMailTransporter();
  const from =
    process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.GMAIL_USER;
  let emailSent = 0;

  if (transporter && from && emailTargets.length) {
    const html = `
      <div style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="display:none;max-height:0;overflow:hidden;">${studentName} | ${studentBatch} | ${displayId}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef2f7;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #d9e1ea;border-radius:14px;overflow:hidden;">
                <tr>
                  <td style="padding:18px 22px;background:#fff;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:20px;line-height:1.2;font-weight:800;color:#101828;">SFT King</p>
                    <p style="margin:6px 0 0 0;font-size:12px;line-height:1.4;color:#667085;">New Account Created</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:18px 22px 0 22px;font-size:18px;line-height:1.4;font-weight:800;color:#111827;">
                    ${studentName}
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 22px 22px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-size:14px;line-height:1.7;color:#1f2937;">
                      <tr><td style="padding:3px 0;"><strong>Full Name:</strong> ${studentName}</td></tr>
                      <tr><td style="padding:3px 0;"><strong>Batch:</strong> ${studentBatch}</td></tr>
                      <tr><td style="padding:3px 0;"><strong>Display ID:</strong> ${displayId}</td></tr>
                      <tr><td style="padding:3px 0;"><strong>Class Mode:</strong> ${studentMode}</td></tr>
                      <tr><td style="padding:3px 0;"><strong>Hall City:</strong> ${studentHallClass}</td></tr>
                      <tr><td style="padding:3px 0;"><strong>Mobile:</strong> ${studentMobile}</td></tr>
                      <tr><td style="padding:3px 0;"><strong>Email:</strong> ${studentEmail}</td></tr>
                      <tr><td style="padding:3px 0;"><strong>Address:</strong> ${studentAddress}</td></tr>
                      <tr><td style="padding:3px 0;"><strong>Created At:</strong> ${createdAtLabel}</td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    const text = [
      "New student account created",
      `Full Name: ${studentName}`,
      `Batch: ${studentBatch}`,
      `Display ID: ${displayId}`,
      `Class Mode: ${studentMode}`,
      `Hall City: ${studentHallClass}`,
      `Mobile: ${studentMobile}`,
      `Email: ${studentEmail}`,
      `Address: ${studentAddress}`,
      `Created At: ${createdAtLabel}`,
    ].join("\n");

    const emailJobs = emailTargets.map((to) =>
      transporter.sendMail({
        from,
        to,
        subject: "New account created",
        text,
        html,
        replyTo:
          process.env.ADMIN_SUPPORT_EMAIL ||
          process.env.SUPPORT_ALERT_EMAIL ||
          undefined,
        headers: {
          "X-Entity-Ref-ID": `student-${student.id || "na"}-created`,
        },
      }),
    );

    const results = await Promise.allSettled(emailJobs);
    emailSent = 0;
    results.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        emailSent += 1;
      } else {
        console.error(
          `[ADMIN NOTIFY] Registration email FAILED to ${emailTargets[idx]}:`,
          result.reason?.message || result.reason || "Unknown error",
        );
      }
    });
  } else {
    console.warn(
      "[ADMIN NOTIFY] Registration email skipped due to missing config/targets",
      {
        hasTransporter: Boolean(transporter),
        hasFrom: Boolean(from),
        emailTargetCount: emailTargets.length,
      },
    );
  }

  console.log("[ADMIN NOTIFY] New account created alert sent", {
    studentId: student.id,
    adminCount: adminIds.length,
    pushSent: pushResult?.sent || 0,
    emailSent,
  });

  return {
    push: pushResult,
    emailSent,
    adminCount: adminIds.length,
  };
};

const escapeHtml = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const sendNewAccountCreatedStudentAlert = async ({ student }) => {
  if (!student || student.role !== "student") return { skipped: true };

  const displayId = getStudentDisplayId(student);
  const createdAtLabel = formatSriLankaDateTime(
    student.createdAt || new Date(),
  );
  const supportUrl =
    process.env.STUDENT_SUPPORT_URL || "https://sftking.lk/student/help";
  const dashboardUrl =
    process.env.STUDENT_DASHBOARD_URL || "https://sftking.lk/student/dashboard";

  const pushPayload = {
    title: "Welcome to SFT King",
    body: `Hi ${String(student.name || "Student")}, your account is ready.`,
    url: "/student/dashboard",
    type: "account_created",
    receiverId: String(student.id || ""),
    messageId: String(student.id || ""),
    conversationId: "student_account_created",
  };

  let pushResult = { sent: 0, skipped: true };
  try {
    pushResult = await sendPushNotificationToUsers([student.id], pushPayload);
  } catch (error) {
    console.error(
      "[STUDENT NOTIFY] New account push error:",
      error?.message || error,
    );
  }

  let emailSent = 0;
  const transporter = getMailTransporter();
  const from =
    process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.GMAIL_USER;
  const to = String(student.email || "")
    .trim()
    .toLowerCase();

  if (transporter && from && to && isValidEmail(to)) {
    const studentName = String(student.name || "Student");
    const batchLabel = String(student.batch || "N/A");
    const modeLabel = String(student.classMode || "N/A");
    const hallLabel = student.hallClass ? String(student.hallClass) : "N/A";

    const text = [
      `Hello ${studentName},`,
      "",
      "Welcome to SFT King. Your student account has been created successfully.",
      `Full Name: ${studentName}`,
      `Batch: ${batchLabel}`,
      `Display ID: ${displayId}`,
      `Class Mode: ${modeLabel}`,
      `Hall City: ${hallLabel}`,
      `Created At: ${createdAtLabel}`,
      `Open Dashboard: ${dashboardUrl}`,
      `Support Desk: ${supportUrl}`,
    ].join("\n");

    const html = `
      <div style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="display:none;max-height:0;overflow:hidden;">Welcome to SFT King, ${escapeHtml(studentName)}.</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef2f7;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #d9e1ea;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:18px 22px;background:#ffffff;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:21px;line-height:1.2;font-weight:800;color:#101828;">SFT King</p>
                    <p style="margin:6px 0 0 0;font-size:12px;line-height:1.5;color:#667085;">Welcome • Account Created</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 22px 8px 22px;">
                    <p style="margin:0;font-size:18px;line-height:1.4;font-weight:800;color:#111827;">Hello ${escapeHtml(studentName)},</p>
                    <p style="margin:6px 0 0 0;font-size:14px;line-height:1.7;color:#374151;">Your SFT King student account is ready. You can now continue from the dashboard.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 22px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #d9e1ea;border-radius:12px;background:#f8fafc;">
                      <tr>
                        <td style="padding:14px 14px;font-size:14px;line-height:1.7;color:#111827;">
                          <strong>Full Name:</strong> ${escapeHtml(studentName)}<br/>
                          <strong>Batch:</strong> ${escapeHtml(batchLabel)}<br/>
                          <strong>Display ID:</strong> ${escapeHtml(displayId)}<br/>
                          <strong>Class Mode:</strong> ${escapeHtml(modeLabel)}<br/>
                          <strong>Hall City:</strong> ${escapeHtml(hallLabel)}<br/>
                          <strong>Created At:</strong> ${escapeHtml(createdAtLabel)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 22px 22px;font-size:13px;line-height:1.7;color:#475467;">
                    Open dashboard:<br/>
                    <a href="${dashboardUrl}" style="color:#0f4c81;text-decoration:underline;word-break:break-all;">${dashboardUrl}</a><br/><br/>
                    Need help? <a href="${supportUrl}" style="color:#0f4c81;text-decoration:underline;word-break:break-all;">Support Desk</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    try {
      await transporter.sendMail({
        from,
        to,
        subject: "Welcome to SFT King",
        text,
        html,
        replyTo:
          process.env.SUPPORT_ALERT_EMAIL ||
          process.env.SMTP_USER ||
          process.env.GMAIL_USER ||
          undefined,
        headers: {
          "X-Entity-Ref-ID": `student-welcome-${student.id || "na"}-${Date.now()}`,
        },
      });
      emailSent = 1;
      console.log(`[STUDENT NOTIFY] Welcome email sent successfully to ${to}`);
    } catch (error) {
      console.error(
        `[STUDENT NOTIFY] Welcome email FAILED to ${to}:`,
        error?.message || error,
      );
      emailSent = 0;
    }
  }

  console.log("[STUDENT NOTIFY] New account welcome alert sent", {
    studentId: student.id,
    pushSent: pushResult?.sent || 0,
    emailSent,
  });

  return { push: pushResult, emailSent };
};

const sendAccountStatusAlertToStudent = async ({
  user,
  eventType = "suspended",
  reason = "",
}) => {
  if (!user || user.role !== "student") return { skipped: true };

  const displayId = getStudentDisplayId(user);
  const modeLabel = String(user.classMode || "N/A");
  const batchLabel = String(user.batch || "N/A");
  const hallLabel = user.hallClass ? String(user.hallClass) : "N/A";
  const eventLabel =
    eventType === "banned"
      ? "Banned"
      : eventType === "reactivated"
        ? "Reactivated"
        : "Suspended";
  const subject = `Account ${eventLabel}`;
  const effectiveAt = new Date().toLocaleString("en-GB", {
    timeZone: "Asia/Colombo",
  });
  const supportUrl =
    process.env.STUDENT_SUPPORT_URL || "https://sftking.lk/student/help";
  const safeReason =
    String(reason || "").trim() ||
    (eventType === "banned"
      ? "Security policy violation detected."
      : eventType === "reactivated"
        ? "Your account access has been restored by the support team."
        : "Administrative action by support team.");

  const pushPayload = {
    title:
      eventType === "banned"
        ? "Account banned"
        : eventType === "reactivated"
          ? "Account reactivated"
          : "Account suspended",
    body:
      eventType === "banned"
        ? "Your account has been banned. Please contact support."
        : eventType === "reactivated"
          ? "Your account is active again. You can continue learning."
          : "Your account has been suspended. Please contact support.",
    url: eventType === "reactivated" ? "/student/dashboard" : "/suspended",
    type: "account_status",
    receiverId: String(user.id || ""),
    messageId: String(user.id || ""),
    conversationId: eventType,
  };

  const pushResult = await sendPushNotificationToUsers([user.id], pushPayload);

  let emailSent = 0;
  const transporter = getMailTransporter();
  const from =
    process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.GMAIL_USER;
  const to = String(user.email || "")
    .trim()
    .toLowerCase();

  if (transporter && from && to && isValidEmail(to)) {
    const preheader = `${eventLabel}: ${safeReason}`.slice(0, 120);
    const safeName = escapeHtml(user.name || "Student");
    const safeReasonHtml = escapeHtml(safeReason);

    const text = [
      `Hello ${user.name || "Student"},`,
      "",
      eventType === "reactivated"
        ? "Your SFT King account is active again."
        : `Your SFT King account has been ${eventLabel.toLowerCase()}.`,
      `Reason: ${safeReason}`,
      `Full Name: ${user.name || "N/A"}`,
      `Batch: ${batchLabel}`,
      `Display ID: ${displayId}`,
      `Class Mode: ${modeLabel}`,
      `Hall City: ${hallLabel}`,
      `Effective At: ${effectiveAt} LKT`,
      `Support Desk: ${supportUrl}`,
    ].join("\n");

    const html = `
      <div style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef2f7;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #d9e1ea;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:18px 22px;background:#ffffff;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:21px;line-height:1.2;font-weight:800;color:#101828;">SFT King</p>
                    <p style="margin:6px 0 0 0;font-size:12px;line-height:1.5;color:#667085;">Account ${eventLabel} Notice</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 22px 8px 22px;">
                    <p style="margin:0;font-size:18px;line-height:1.4;font-weight:800;color:#111827;">Hello ${safeName},</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 6px 22px;">
                    <p style="margin:0;font-size:15px;line-height:1.7;color:#1f2937;">${eventType === "reactivated" ? "Your SFT King account is now <strong>Active</strong> again." : `Your SFT King account has been <strong>${eventLabel}</strong>.`}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 22px 0 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #d9e1ea;border-radius:12px;background:#f8fafc;">
                      <tr>
                        <td style="padding:14px 14px;font-size:14px;line-height:1.7;color:#111827;">
                          <strong>Reason:</strong> ${safeReasonHtml}<br/>
                          <strong>Full Name:</strong> ${escapeHtml(user.name || "N/A")}<br/>
                          <strong>Batch:</strong> ${escapeHtml(batchLabel)}<br/>
                          <strong>Display ID:</strong> ${escapeHtml(displayId)}<br/>
                          <strong>Class Mode:</strong> ${escapeHtml(modeLabel)}<br/>
                          <strong>Hall City:</strong> ${escapeHtml(hallLabel)}<br/>
                          <strong>Effective At:</strong> ${escapeHtml(effectiveAt)} LKT
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:14px 22px 22px 22px;font-size:13px;line-height:1.7;color:#475467;">
                    Need help? Contact support:<br/>
                    <a href="${supportUrl}" style="color:#0f4c81;text-decoration:underline;word-break:break-all;">${supportUrl}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
      replyTo:
        process.env.ADMIN_SUPPORT_EMAIL ||
        process.env.SUPPORT_ALERT_EMAIL ||
        undefined,
      headers: {
        "X-Entity-Ref-ID": `account-${eventType}-${user.id || "na"}-${Date.now()}`,
      },
    });

    emailSent = 1;
  }

  console.log("[ACCOUNT ALERT] Student account status alert sent", {
    userId: user.id,
    eventType,
    pushSent: pushResult?.sent || 0,
    emailSent,
  });

  return { push: pushResult, emailSent };
};

const getRequestTypeLabel = (type) => {
  if (type === "PDF_ACCESS") return "PDF Access Request";
  if (type === "PASTPAPER_ACCESS") return "Past Paper Access Request";
  return "Payment Request";
};

const getRequestDecisionLabel = (status) => {
  if (status === "approved") return "Approved";
  if (status === "declined") return "Declined";
  if (status === "rejected") return "Declined";
  return String(status || "Updated").toUpperCase();
};

const getAdminNotificationEmails = async () => {
  const adminUsers = await User.findAll({
    where: { role: "admin" },
    attributes: ["email"],
  });

  return Array.from(
    new Set(
      [
        process.env.ADMIN_SUPPORT_EMAIL,
        process.env.SUPPORT_ALERT_EMAIL,
        process.env.SMTP_USER,
        process.env.GMAIL_USER,
        "sftking.support@gmail.com",
        ...adminUsers.map((admin) => String(admin.email || "").trim()),
      ].filter(Boolean),
    ),
  );
};

const sendRequestSubmissionAlertToAdmins = async ({
  request,
  student,
  lessonName,
  contentTitle,
}) => {
  if (!request || !student) return { skipped: true };

  const adminRows = await User.findAll({
    where: { role: "admin" },
    attributes: ["id", "notificationTokens"],
  });
  const adminIds = adminRows.map((admin) => admin.id);
  const adminTokenCount = Array.from(
    new Set(
      adminRows.flatMap((admin) =>
        parseNotificationTokens(admin.notificationTokens),
      ),
    ),
  ).length;
  const adminEmails = await getAdminNotificationEmails();
  const transporter = getMailTransporter();
  const from =
    process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.GMAIL_USER;
  const requestLabel = getRequestTypeLabel(request.type);
  const submittedAt = formatSriLankaDateTime(request.createdAt || new Date());
  const studentName = String(
    student.name || request.studentName || "Unknown Student",
  );
  const studentBatch = String(student.batch || request.batch || "N/A");
  const displayId = getStudentDisplayId(student);
  const modeLabel = String(student.classMode || "N/A");
  const hallLabel = student.hallClass ? String(student.hallClass) : "N/A";
  const addressLabel = String(student.address || "N/A");
  const emailLabel = String(student.email || "N/A");
  const mobileLabel = String(student.mobile || "N/A");
  const lessonLabel = String(lessonName || request.lessonName || "N/A");
  const contentLabel = String(contentTitle || request.contentTitle || "N/A");
  const subject = `New ${requestLabel.toLowerCase()}`;
  const preview = `${studentName} | ${studentBatch} | ${displayId}`;

  const pushPayload = {
    title: `New ${requestLabel.toLowerCase()}`,
    body: `${studentName} | ${studentBatch} | ${displayId}`,
    url: "/admin/requests",
    type: "admin_request",
    senderId: String(student.id || ""),
    messageId: String(request.id || ""),
    conversationId: String(request.type || ""),
  };

  let pushResult = { sent: 0, skipped: true };
  try {
    pushResult = adminIds.length
      ? await sendPushNotificationToUsers(adminIds, pushPayload)
      : { sent: 0, skipped: true };
  } catch (error) {
    console.error("[REQUEST ALERT] Admin push error:", error?.message || error);
  }

  let emailSent = 0;
  if (transporter && from && adminEmails.length) {
    const text = [
      `New ${requestLabel} received`,
      `Full Name: ${studentName}`,
      `Batch: ${studentBatch}`,
      `Display ID: ${displayId}`,
      `Class Mode: ${modeLabel}`,
      `Hall City: ${hallLabel}`,
      `Mobile: ${mobileLabel}`,
      `Email: ${emailLabel}`,
      `Address: ${addressLabel}`,
      `Lesson: ${lessonLabel}`,
      `Content: ${contentLabel}`,
      `Request Type: ${requestLabel}`,
      `Submitted At: ${submittedAt}`,
    ].join("\n");

    const html = `
      <div style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preview)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef2f7;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="660" style="width:100%;max-width:660px;background:#ffffff;border:1px solid #d9e1ea;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:18px 22px;background:#ffffff;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:21px;line-height:1.2;font-weight:800;color:#101828;">SFT King</p>
                    <p style="margin:6px 0 0 0;font-size:12px;line-height:1.5;color:#667085;">${escapeHtml(requestLabel)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 22px 8px 22px;">
                    <p style="margin:0;font-size:18px;line-height:1.4;font-weight:800;color:#111827;">${escapeHtml(studentName)}</p>
                    <p style="margin:6px 0 0 0;font-size:14px;line-height:1.7;color:#374151;">A new ${escapeHtml(requestLabel.toLowerCase())} has been submitted and is waiting for your review.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 22px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #d9e1ea;border-radius:12px;background:#f8fafc;">
                      <tr>
                        <td style="padding:14px 14px;font-size:14px;line-height:1.7;color:#111827;">
                          <strong>Full Name:</strong> ${escapeHtml(studentName)}<br/>
                          <strong>Batch:</strong> ${escapeHtml(studentBatch)}<br/>
                          <strong>Display ID:</strong> ${escapeHtml(displayId)}<br/>
                          <strong>Class Mode:</strong> ${escapeHtml(modeLabel)}<br/>
                          <strong>Hall City:</strong> ${escapeHtml(hallLabel)}<br/>
                          <strong>Mobile:</strong> ${escapeHtml(mobileLabel)}<br/>
                          <strong>Email:</strong> ${escapeHtml(emailLabel)}<br/>
                          <strong>Address:</strong> ${escapeHtml(addressLabel)}<br/>
                          <strong>Lesson:</strong> ${escapeHtml(lessonLabel)}<br/>
                          <strong>Content:</strong> ${escapeHtml(contentLabel)}<br/>
                          <strong>Request Type:</strong> ${escapeHtml(requestLabel)}<br/>
                          <strong>Submitted At:</strong> ${escapeHtml(submittedAt)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 22px 22px;font-size:13px;line-height:1.7;color:#475467;">
                    Review it from the admin requests panel.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    const results = await Promise.allSettled(
      adminEmails.map((to) =>
        transporter.sendMail({
          from,
          to,
          subject,
          text,
          html,
          replyTo:
            process.env.ADMIN_SUPPORT_EMAIL ||
            process.env.SUPPORT_ALERT_EMAIL ||
            undefined,
          headers: {
            "X-Entity-Ref-ID": `req-admin-${request.id || "na"}-${Date.now()}`,
          },
        }),
      ),
    );

    const emailErrors = [];
    emailSent = 0;
    results.forEach((result, idx) => {
      if (result.status === "fulfilled") {
        emailSent++;
        console.log(
          `[REQUEST ALERT] Email sent successfully to ${adminEmails[idx]}`,
        );
      } else {
        const errMsg =
          result.reason?.message || String(result.reason || "Unknown error");
        console.error(
          `[REQUEST ALERT] Email FAILED to ${adminEmails[idx]}: ${errMsg}`,
        );
        emailErrors.push({ to: adminEmails[idx], error: errMsg });
      }
    });
  }

  console.log("[REQUEST ALERT] Admin submission alert sent", {
    requestId: request.id,
    studentId: student.id,
    adminCount: adminIds.length,
    adminTokenCount,
    adminEmailCount: adminEmails.length,
    pushSent: pushResult?.sent || 0,
    emailSent,
  });

  return { push: pushResult, emailSent };
};

const sendRequestDecisionAlertToStudent = async ({
  request,
  student,
  status,
}) => {
  if (!request || !student) return { skipped: true };
  const normalizedStatus = status === "rejected" ? "declined" : status;
  if (!["approved", "declined"].includes(normalizedStatus))
    return { skipped: true };

  const transporter = getMailTransporter();
  const from =
    process.env.EMAIL_FROM || process.env.SMTP_USER || process.env.GMAIL_USER;
  const to = String(student.email || "")
    .trim()
    .toLowerCase();
  const decisionLabel = getRequestDecisionLabel(normalizedStatus);
  const requestLabel = getRequestTypeLabel(request.type);
  const submittedAt = formatSriLankaDateTime(request.createdAt || new Date());
  const decidedAt = formatSriLankaDateTime(new Date());
  const titleLabel = String(
    request.contentTitle || request.lessonName || "Your request",
  );
  const supportUrl =
    process.env.STUDENT_SUPPORT_URL || "https://sftking.lk/student/help";
  const displayId = getStudentDisplayId(student);
  const batchLabel = String(student.batch || "N/A");
  const modeLabel = String(student.classMode || "N/A");
  const hallLabel = student.hallClass ? String(student.hallClass) : "N/A";
  const isApproved = normalizedStatus === "approved";

  const pushPayload = {
    title: `Request ${decisionLabel.toLowerCase()}`,
    body: `${requestLabel} • ${titleLabel}`,
    url: isApproved ? "/student/dashboard" : "/student/help",
    type: "request_decision",
    receiverId: String(student.id || ""),
    messageId: String(request.id || ""),
    conversationId: String(request.type || ""),
  };

  let pushResult = { sent: 0, skipped: true };
  try {
    pushResult = await sendPushNotificationToUsers([student.id], pushPayload);
  } catch (error) {
    console.error(
      "[REQUEST ALERT] Student push error:",
      error?.message || error,
    );
  }

  let emailSent = 0;
  if (transporter && from && to && isValidEmail(to)) {
    const heading = isApproved ? "Request Approved" : "Request Declined";
    const preheader = `${heading}: ${titleLabel}`;
    const bodyLine = isApproved
      ? "Your request has been approved. You can now continue from the student dashboard or open the content link again."
      : "Your request has been declined. Please review the details and contact support if you need help.";

    const text = [
      `Hello ${student.name || "Student"},`,
      "",
      `Your ${requestLabel.toLowerCase()} has been ${decisionLabel.toLowerCase()}.`,
      `Request Title: ${titleLabel}`,
      `Full Name: ${student.name || "N/A"}`,
      `Batch: ${batchLabel}`,
      `Display ID: ${displayId}`,
      `Class Mode: ${modeLabel}`,
      `Hall City: ${hallLabel}`,
      `Submitted At: ${submittedAt}`,
      `Decision At: ${decidedAt}`,
      `Support Desk: ${supportUrl}`,
    ].join("\n");

    const html = `
      <div style="margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#eef2f7;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:100%;max-width:640px;background:#ffffff;border:1px solid #d9e1ea;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="padding:18px 22px;background:#ffffff;border-bottom:1px solid #e5e7eb;">
                    <p style="margin:0;font-size:21px;line-height:1.2;font-weight:800;color:#101828;">SFT King</p>
                    <p style="margin:6px 0 0 0;font-size:12px;line-height:1.5;color:#667085;">${escapeHtml(heading)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:20px 22px 8px 22px;">
                    <p style="margin:0;font-size:18px;line-height:1.4;font-weight:800;color:#111827;">Hello ${escapeHtml(student.name || "Student")},</p>
                    <p style="margin:6px 0 0 0;font-size:14px;line-height:1.7;color:#374151;">${escapeHtml(bodyLine)}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 22px 22px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #d9e1ea;border-radius:12px;background:#f8fafc;">
                      <tr>
                        <td style="padding:14px 14px;font-size:14px;line-height:1.7;color:#111827;">
                          <strong>Status:</strong> ${escapeHtml(decisionLabel)}<br/>
                          <strong>Request Type:</strong> ${escapeHtml(requestLabel)}<br/>
                          <strong>Request Title:</strong> ${escapeHtml(titleLabel)}<br/>
                          <strong>Full Name:</strong> ${escapeHtml(student.name || "N/A")}<br/>
                          <strong>Batch:</strong> ${escapeHtml(batchLabel)}<br/>
                          <strong>Display ID:</strong> ${escapeHtml(displayId)}<br/>
                          <strong>Class Mode:</strong> ${escapeHtml(modeLabel)}<br/>
                          <strong>Hall City:</strong> ${escapeHtml(hallLabel)}<br/>
                          <strong>Submitted At:</strong> ${escapeHtml(submittedAt)}<br/>
                          <strong>Decision At:</strong> ${escapeHtml(decidedAt)}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 22px 22px 22px;font-size:13px;line-height:1.7;color:#475467;">
                    Need help? <a href="${supportUrl}" style="color:#0f4c81;text-decoration:underline;word-break:break-all;">Open support desk</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>
    `;

    await transporter.sendMail({
      from,
      to,
      subject: `${heading} • ${titleLabel}`,
      text,
      html,
      replyTo:
        process.env.SUPPORT_ALERT_EMAIL ||
        process.env.SMTP_USER ||
        process.env.GMAIL_USER ||
        undefined,
      headers: {
        "X-Entity-Ref-ID": `req-student-${request.id || "na"}-${normalizedStatus}-${Date.now()}`,
      },
    });

    emailSent = 1;
  }

  console.log("[REQUEST ALERT] Student decision alert sent", {
    requestId: request.id,
    studentId: student.id,
    status: normalizedStatus,
    pushSent: pushResult?.sent || 0,
    emailSent,
  });

  return { push: pushResult, emailSent };
};

const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["polling", "websocket"],
  pingInterval: 5000,
  pingTimeout: 5000,
});

server.use(cors({ origin: "*", credentials: true }));
server.use(
  helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
);
server.use(cookieParser());
server.use(express.json({ limit: "50mb" }));
server.use(express.urlencoded({ limit: "50mb", extended: true }));

server.use(
  "/uploads/written-answers",
  express.static(path.join(__dirname, "uploads/written-answers")),
);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}_${file.originalname.replace(/\s+/g, "_")}`),
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Security Block: Only image files are allowed!"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// --- PDF UPLOADER (SEPARATE FROM IMAGE UPLOAD) ---
// ✅ 2) (server.js) PDF upload storage + filter (ADD once)
// --- PDF UPLOAD DIR (NOT inside /public to prevent direct download) ---
const PDF_UPLOAD_DIR = path.join(process.cwd(), "uploads", "pdfs");
if (!fs.existsSync(PDF_UPLOAD_DIR)) {
  fs.mkdirSync(PDF_UPLOAD_DIR, { recursive: true });
}

function safeUnlink(absPath) {
  try {
    if (!absPath) return;
    if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
  } catch (e) {}
}

async function watermarkPdfBuffer(originalPdfBuffer, watermarkText) {
  const pdfDoc = await PDFDocument.load(originalPdfBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    const { width, height } = page.getSize();

    // Big diagonal watermark
    const fontSize = Math.max(28, Math.floor(Math.min(width, height) / 14));

    page.drawText(watermarkText, {
      x: width * 0.08,
      y: height * 0.45,
      size: fontSize,
      font,
      color: rgb(0.85, 0.1, 0.1),
      rotate: degrees(30),
      opacity: 0.12,
    });

    // small footer watermark too (harder to crop)
    page.drawText(watermarkText, {
      x: 16,
      y: 12,
      size: 9,
      font,
      color: rgb(0.3, 0.3, 0.3),
      opacity: 0.35,
    });
  }

  return await pdfDoc.save();
}

// --- PDF UPLOADER (SEPARATE FROM IMAGE UPLOAD) ---
const pdfStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PDF_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const name = crypto.randomBytes(24).toString("hex") + ".pdf";
    cb(null, name);
  },
});

const pdfUpload = multer({
  storage: pdfStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // ✅ Increased to 25MB
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf");
    if (!ok) return cb(new Error("Only PDF files are allowed."));
    cb(null, true);
  },
});

// --- 2. CRYPTO ---
const ALGORITHM = "aes-256-cbc";
const ENC_KEY =
  process.env.ENCRYPTION_KEY || "12345678901234567890123456789012";
const IV_KEY = process.env.IV_KEY || "1234567890123456";
const encrypt = (t) => {
  let c = crypto.createCipheriv(
    ALGORITHM,
    Buffer.from(ENC_KEY),
    Buffer.from(IV_KEY),
  );
  let e = c.update(t);
  e = Buffer.concat([e, c.final()]);
  return e.toString("hex");
};
const decrypt = (t) => {
  let e = Buffer.from(t, "hex");
  let d = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENC_KEY),
    Buffer.from(IV_KEY),
  );
  let r = d.update(e);
  r = Buffer.concat([r, d.final()]);
  return r.toString();
};

// --- 3. DATABASE MODELS ---
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: "mysql",
    logging: false,
    pool: { max: 5, min: 0 },
  },
);

// --- 3. DATABASE MODELS ---

const User = sequelize.define("User", {
  // hall_id REMOVED. Mobile is now the Unique Identifier.
  password: { type: DataTypes.STRING, allowNull: false },
  role: { type: DataTypes.STRING, defaultValue: "student" },
  name: { type: DataTypes.STRING },
  email: { type: DataTypes.STRING, allowNull: true },
  nic: { type: DataTypes.STRING, allowNull: true },
  batch: { type: DataTypes.STRING },
  mobile: { type: DataTypes.STRING, unique: true, allowNull: false },
  address: { type: DataTypes.STRING },
  classMode: { type: DataTypes.STRING, allowNull: true },
  hallClass: { type: DataTypes.STRING, allowNull: true },
  studentCode: { type: DataTypes.STRING, allowNull: true },
  status: { type: DataTypes.STRING, defaultValue: "active" },
  avatar: { type: DataTypes.STRING, defaultValue: null },
  isOnline: { type: DataTypes.BOOLEAN, defaultValue: false },
  notificationTokens: {
    type: DataTypes.TEXT,
    allowNull: true,
    defaultValue: "[]",
  },
  welcomeNotificationEligible: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  welcomeNotificationSent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
});

const Message = sequelize.define("Message", {
  senderId: DataTypes.INTEGER,
  receiverId: DataTypes.INTEGER,
  content: DataTypes.TEXT,
  isRead: { type: DataTypes.BOOLEAN, defaultValue: false },
  replyToId: { type: DataTypes.INTEGER, allowNull: true },
  // NEW FIELDS FOR SOFT DELETE
  senderDeleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  receiverDeleted: { type: DataTypes.BOOLEAN, defaultValue: false },
});

const Lesson = sequelize.define("Lesson", {
  name: { type: DataTypes.STRING, allowNull: false },
  type: { type: DataTypes.ENUM("Recordings", "Live"), allowNull: false },
  price: { type: DataTypes.STRING, defaultValue: "0" },
  batches: { type: DataTypes.STRING, defaultValue: "[]" },
  month: { type: DataTypes.STRING, defaultValue: "" },
  orderIndex: { type: DataTypes.INTEGER, defaultValue: 0 },

  // NEW: PARENT ID FOR NESTING
  parentId: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
});

const SecurityLog = sequelize.define("SecurityLog", {
  event: DataTypes.STRING,
  description: DataTypes.STRING,
  ip_address: DataTypes.STRING,
  user_id: DataTypes.STRING,
  mobile: DataTypes.STRING,
  device_name: DataTypes.STRING, // 🚀 NEW FIELD ADDED TO DATABASE
  severity: {
    type: DataTypes.ENUM("low", "medium", "high"),
    defaultValue: "low",
  },
});
const Blocklist = sequelize.define("Blocklist", {
  ip_address: { type: DataTypes.STRING, unique: true },
  reason: DataTypes.STRING,
});
const AppConfig = sequelize.define("AppConfig", {
  key: { type: DataTypes.STRING, unique: true },
  value: DataTypes.STRING,
});
const Batch = sequelize.define("Batch", {
  name: { type: DataTypes.STRING, unique: true, allowNull: false },
});
const Content = sequelize.define("Content", {
  title: DataTypes.STRING,
  month: DataTypes.STRING,
  type: DataTypes.STRING,
  batch: DataTypes.STRING,
  youtube_link: DataTypes.STRING,
  price: DataTypes.STRING,
  isSeparate: { type: DataTypes.BOOLEAN, defaultValue: false },
  lessonId: { type: DataTypes.INTEGER, defaultValue: null },
  isStreamActive: { type: DataTypes.BOOLEAN, defaultValue: false },
  scheduleEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  startTime: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  endTime: { type: DataTypes.DATE, allowNull: true, defaultValue: null },
  lockAfterEnd: { type: DataTypes.BOOLEAN, defaultValue: false },
  lockPrice: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
  audienceMode: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "all",
  },
  audienceCity: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
  pdfFile: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
  pdfVisible: { type: DataTypes.BOOLEAN, defaultValue: true },
  pdfUrl: { type: DataTypes.STRING, allowNull: true, defaultValue: "" },
  pdfTimeLimit: { type: DataTypes.INTEGER, defaultValue: 60 },
  isPdfFree: { type: DataTypes.BOOLEAN, defaultValue: false },
  pageImages: { type: DataTypes.TEXT, allowNull: true, defaultValue: "[]" },

  // 🚀 PHASE 1: THE ZOOM SECRET CREDENTIALS
  zoomId: { type: DataTypes.STRING, allowNull: true, defaultValue: null },
  zoomPasscode: { type: DataTypes.STRING, allowNull: true, defaultValue: null },

  // 🚀 PHASE 2: THE ZOOM BUTTON TOGGLE (Default is HIDDEN!)
  zoomVisible: { type: DataTypes.BOOLEAN, defaultValue: false },

  // 🚀 PHASE 5: ZOOM RECORDING FIELDS
  recordingLink: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
  recordingVisible: { type: DataTypes.BOOLEAN, defaultValue: false },
});

const Request = sequelize.define("Request", {
  studentId: DataTypes.INTEGER,
  studentName: DataTypes.STRING,
  // hall_id REMOVED
  lessonId: DataTypes.INTEGER,
  lessonName: DataTypes.STRING,
  contentId: DataTypes.INTEGER,
  contentTitle: DataTypes.STRING,
  month: DataTypes.STRING,
  batch: DataTypes.STRING,
  status: { type: DataTypes.STRING, defaultValue: "pending" },
  type: { type: DataTypes.STRING },
  proof_image: { type: DataTypes.STRING },
  accessedAt: { type: DataTypes.DATE, allowNull: true },
});
const Setting = sequelize.define("Setting", {
  key: { type: DataTypes.STRING, unique: true },
  value: { type: DataTypes.BOOLEAN, defaultValue: false },
});

// 🛡️ FIREWALL RULE ENGINE
const FirewallRule = sequelize.define("FirewallRule", {
  key: { type: DataTypes.STRING, unique: true, allowNull: false },
  name: { type: DataTypes.STRING, allowNull: false },
  description: { type: DataTypes.STRING },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
});

// ==========================================
// 🎭 REACTION ENGINE MODEL (Facebook Style Emojis)
// ==========================================
const Reaction = sequelize.define("Reaction", {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  // We use a generic 'entryId' so it can attach to either MCQ or WRITTEN results
  entryId: { type: DataTypes.INTEGER, allowNull: false },
  engineType: { type: DataTypes.ENUM("mcq", "written"), allowNull: false },
  reactionId: { type: DataTypes.STRING, allowNull: false }, // 'fire', 'love', 'laugh', 'cold', 'skull', 'crown'
});

// ✅ 1. PAST PAPER FOLDERS (No price, no month!)
const PastPaperFolder = sequelize.define("past_paper_folder", {
  name: { type: DataTypes.STRING, allowNull: false },
  batches: { type: DataTypes.TEXT, defaultValue: '["All"]' },
  parentId: { type: DataTypes.INTEGER, allowNull: true },
});

// ==========================================
// ✅ NEW: SFT KING MCQ SYSTEM MODELS
// ==========================================

// 1. MCQ Folders (Can be nested exactly like Videos/Past Papers)
const McqFolder = sequelize.define("mcq_folder", {
  name: { type: DataTypes.STRING, allowNull: false },
  batches: { type: DataTypes.TEXT, defaultValue: '["All"]' },
  parentId: { type: DataTypes.INTEGER, allowNull: true },
});

const McqQuiz = sequelize.define("mcq_quiz", {
  title: { type: DataTypes.STRING, allowNull: false },
  pdfFile: { type: DataTypes.STRING, allowNull: false },
  answerKey: { type: DataTypes.TEXT, allowNull: false },
  timeLimit: { type: DataTypes.INTEGER, defaultValue: 60 },
  readyTime: { type: DataTypes.INTEGER, defaultValue: 0 }, // 🚀 THE NEW READY BUFFER
  totalQuestions: { type: DataTypes.INTEGER, defaultValue: 10 }, // 🚀 ADDED TOTAL QUESTIONS
  isVisible: { type: DataTypes.BOOLEAN, defaultValue: true },
  pageImages: { type: DataTypes.TEXT, allowNull: true, defaultValue: "[]" }, // 🚀 THE NEW IMAGE MATRIX

  // 🚀 PHASE 1: SCHEDULING ENGINES
  batches: { type: DataTypes.TEXT, defaultValue: '["All"]' }, // Which batches can take this?
  startTime: { type: DataTypes.DATE, allowNull: true }, // The exact second the exam begins
  endTime: { type: DataTypes.DATE, allowNull: true }, // 🚀 THE AUTO-KILL SWITCH
  status: {
    type: DataTypes.ENUM("scheduled", "live", "ended"),
    defaultValue: "live", // Legacy quizzes just default to live
  },
});

// 3. MCQ Results (Auto-Grader Storage)
const McqResult = sequelize.define("mcq_result", {
  studentId: { type: DataTypes.INTEGER, allowNull: false },
  quizId: { type: DataTypes.INTEGER, allowNull: false },
  score: { type: DataTypes.INTEGER, allowNull: false },
  totalQuestions: { type: DataTypes.INTEGER, allowNull: false },
  studentAnswers: { type: DataTypes.TEXT, allowNull: false }, // To show them what they got wrong later
});

// Archived MCQ rows preserved when a quiz is rescheduled/reset for a new cycle
const McqResultHistory = sequelize.define("mcq_result_history", {
  studentId: { type: DataTypes.INTEGER, allowNull: false },
  quizId: { type: DataTypes.INTEGER, allowNull: false },
  score: { type: DataTypes.INTEGER, allowNull: false },
  totalQuestions: { type: DataTypes.INTEGER, allowNull: false },
  studentAnswers: { type: DataTypes.TEXT, allowNull: false },
  attemptStartedAt: { type: DataTypes.DATE, allowNull: true },
  submittedAt: { type: DataTypes.DATE, allowNull: true },
  archivedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  resetReason: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "rescheduled",
  },
  prevStatus: { type: DataTypes.STRING, allowNull: true },
  nextStatus: { type: DataTypes.STRING, allowNull: true },
  prevStartTime: { type: DataTypes.DATE, allowNull: true },
  nextStartTime: { type: DataTypes.DATE, allowNull: true },
});

// ================= EVENT POSTER MODEL =================
const EventPoster = sequelize.define("EventPoster", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING, allowNull: true },
  link: { type: DataTypes.STRING, allowNull: true },
  imageUrl: { type: DataTypes.STRING, allowNull: false },
  batch: { type: DataTypes.STRING, defaultValue: "All" },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: false },
});

// 4. MCQ Attempts (Persistent personal timer anchor across devices)
const McqAttempt = sequelize.define(
  "mcq_attempt",
  {
    studentId: { type: DataTypes.INTEGER, allowNull: false },
    quizId: { type: DataTypes.INTEGER, allowNull: false },
  },
  {
    indexes: [{ unique: true, fields: ["studentId", "quizId"] }],
  },
);

// 🔗 MCQ RELATIONSHIPS
McqFolder.hasMany(McqFolder, { as: "SubFolders", foreignKey: "parentId" });
McqFolder.hasMany(McqQuiz, { foreignKey: "folderId" });
McqQuiz.belongsTo(McqFolder, { foreignKey: "folderId" });

User.hasMany(McqResult, { foreignKey: "studentId" });
McqResult.belongsTo(User, { foreignKey: "studentId" });
McqQuiz.hasMany(McqResult, { foreignKey: "quizId" });
McqResult.belongsTo(McqQuiz, { foreignKey: "quizId" });

User.hasMany(McqResultHistory, { foreignKey: "studentId" });
McqResultHistory.belongsTo(User, { foreignKey: "studentId" });
McqQuiz.hasMany(McqResultHistory, { foreignKey: "quizId" });
McqResultHistory.belongsTo(McqQuiz, { foreignKey: "quizId" });

User.hasMany(McqAttempt, { foreignKey: "studentId" });
McqAttempt.belongsTo(User, { foreignKey: "studentId" });
McqQuiz.hasMany(McqAttempt, { foreignKey: "quizId" });
McqAttempt.belongsTo(McqQuiz, { foreignKey: "quizId" });

// ==========================================
// 🚜 WRITTEN VAULT MODELS (STRUCTURE + ESSAY)
// ==========================================

const WrittenFolder = sequelize.define("written_folder", {
  name: { type: DataTypes.STRING, allowNull: false },
  batches: { type: DataTypes.TEXT, defaultValue: '["All"]' },
  parentId: { type: DataTypes.INTEGER, allowNull: true },
});

const WrittenQuiz = sequelize.define("written_quiz", {
  title: { type: DataTypes.STRING, allowNull: false },
  pdfFile: { type: DataTypes.STRING, allowNull: false },

  // 🚀 THE 3-STAGE ROCKET TIMERS
  readyTime: { type: DataTypes.INTEGER, defaultValue: 0 }, // Stage 1: The Shield (Mins)
  timeLimit: { type: DataTypes.INTEGER, defaultValue: 120 }, // Stage 2: The Writing Phase (Mins)
  uploadGraceTime: { type: DataTypes.INTEGER, defaultValue: 10 }, // Stage 3: The Red Dropzone (Mins)

  totalMarks: { type: DataTypes.INTEGER, defaultValue: 100 }, // Max score for this paper

  batches: { type: DataTypes.TEXT, defaultValue: '["All"]' },
  startTime: { type: DataTypes.DATE, allowNull: true },
  endTime: { type: DataTypes.DATE, allowNull: true },
  pageImages: { type: DataTypes.TEXT, allowNull: true, defaultValue: "[]" }, // 🚀 THE NEW IMAGE MATRIX
  status: {
    type: DataTypes.ENUM("scheduled", "live", "ended"),
    defaultValue: "live",
  },
});

const WrittenResult = sequelize.define("written_result", {
  // Stores a JSON array of the image URLs the student uploads
  fileUrls: { type: DataTypes.TEXT, allowNull: false },

  // 👑 THE CEO GRADING FIELDS
  score: { type: DataTypes.INTEGER, allowNull: true }, // You type this later!
  feedback: { type: DataTypes.TEXT, allowNull: true }, // Your notes for the student
  gradingStatus: {
    type: DataTypes.ENUM("pending", "graded", "published"),
    defaultValue: "pending", // 'published' means the student can finally see it!
  },
});

// 🔗 RELATIONSHIPS (Connecting the Matrix)
WrittenFolder.hasMany(WrittenQuiz, { foreignKey: "folderId" });
WrittenQuiz.belongsTo(WrittenFolder, { foreignKey: "folderId" });

User.hasMany(WrittenResult, { foreignKey: "studentId" });
WrittenResult.belongsTo(User, { foreignKey: "studentId" });

WrittenQuiz.hasMany(WrittenResult, { foreignKey: "quizId" });
WrittenResult.belongsTo(WrittenQuiz, { foreignKey: "quizId" });

// ✅ 2. PAST PAPER PDF FILES
const PastPaperFile = sequelize.define("past_paper_file", {
  title: { type: DataTypes.STRING, allowNull: false },
  pdfFile: { type: DataTypes.STRING, allowNull: false },
  isVisible: { type: DataTypes.BOOLEAN, defaultValue: true },
  isFree: { type: DataTypes.BOOLEAN, defaultValue: false }, // ✅ ADDED THIS
  timeLimit: { type: DataTypes.INTEGER, defaultValue: 60 }, // ✅ ADDED THIS
  pageImages: { type: DataTypes.TEXT, allowNull: true, defaultValue: "[]" },
});

// ✅ 3. RELATIONSHIPS
PastPaperFolder.hasMany(PastPaperFolder, {
  as: "SubFolders",
  foreignKey: "parentId",
});
PastPaperFolder.hasMany(PastPaperFile, { as: "Files", foreignKey: "folderId" });
PastPaperFile.belongsTo(PastPaperFolder, { foreignKey: "folderId" });

// --- ASSOCIATIONS ---
// --- DATABASE ASSOCIATIONS (Paste after Model definitions) ---
// 🎭 REACTION RELATIONSHIPS
User.hasMany(Reaction, { foreignKey: "userId" });
Reaction.belongsTo(User, { foreignKey: "userId" });
User.hasMany(Message, { foreignKey: "senderId" });
Message.belongsTo(User, { as: "sender", foreignKey: "senderId" });
Message.belongsTo(User, { as: "receiver", foreignKey: "receiverId" });
Message.belongsTo(Message, { as: "replyTo", foreignKey: "replyToId" });
Request.belongsTo(User, { foreignKey: "studentId" });

async function ensureUserSchemaCompatibility() {
  const qi = sequelize.getQueryInterface();
  const table = await qi.describeTable("Users");

  if (!table.classMode) {
    await qi.addColumn("Users", "classMode", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!table.email) {
    await qi.addColumn("Users", "email", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!table.nic) {
    await qi.addColumn("Users", "nic", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!table.hallClass) {
    await qi.addColumn("Users", "hallClass", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!table.studentCode) {
    await qi.addColumn("Users", "studentCode", {
      type: DataTypes.STRING,
      allowNull: true,
    });
  }

  if (!table.notificationTokens) {
    await qi.addColumn("Users", "notificationTokens", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "[]",
    });
  }

  if (!table.welcomeNotificationEligible) {
    await qi.addColumn("Users", "welcomeNotificationEligible", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  }

  if (!table.welcomeNotificationSent) {
    await qi.addColumn("Users", "welcomeNotificationSent", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
  }

  if (!table.email) {
    await qi.addColumn("Users", "email", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    });
  }

  if (!table.nic) {
    await qi.addColumn("Users", "nic", {
      type: DataTypes.STRING,
      allowNull: true,
      defaultValue: null,
    });
  }

  const ensureUniqueIndex = async (indexName, fieldName) => {
    try {
      const indexes = await qi.showIndex("Users");
      const exists = indexes.some((idx) => {
        if (!idx.unique || !Array.isArray(idx.fields)) return false;
        return idx.fields.some(
          (f) => f?.attribute === fieldName || f?.name === fieldName,
        );
      });

      if (!exists) {
        await qi.addIndex("Users", [fieldName], {
          unique: true,
          name: indexName,
        });
      }
    } catch (err) {
      console.log(
        `[MIGRATE] Index ${indexName} already exists or cannot be created`,
      );
    }
  };

  await ensureUniqueIndex("unique_email", "email");
  await ensureUniqueIndex("unique_nic", "nic");

  try {
    const indexes = await qi.showIndex("Users");
    const hasStudentCodeUnique = indexes.some((idx) => {
      if (!idx.unique || !Array.isArray(idx.fields)) return false;
      return idx.fields.some(
        (f) => f?.attribute === "studentCode" || f?.name === "studentCode",
      );
    });

    if (!hasStudentCodeUnique) {
      await qi.addIndex("Users", ["studentCode"], {
        unique: true,
        name: "users_studentCode_unique",
      });
    }
  } catch (e) {
    console.warn("[DB] studentCode unique index skipped:", e?.message || e);
  }
}

const initDB = async () => {
  try {
    await sequelize.sync();
  } catch (e) {
    console.warn("[DB] Main sync warning:", e?.message);
  }

  await ensureUserSchemaCompatibility();

  // Sync models with error handling (don't crash on key limits)
  const models = [
    { model: User, name: "User" },
    { model: Content, name: "Content" },
    { model: Request, name: "Request" },
    { model: PastPaperFile, name: "PastPaperFile" },
    { model: McqQuiz, name: "McqQuiz" },
    { model: McqResultHistory, name: "McqResultHistory" },
    { model: WrittenQuiz, name: "WrittenQuiz" },
    { model: WrittenResult, name: "WrittenResult" },
    { model: Reaction, name: "Reaction" },
    { model: SecurityLog, name: "SecurityLog" },
  ];

  for (const { model, name } of models) {
    try {
      await model.sync({ alter: true });
      console.log(`✅ [DB] ${name} synced`);
    } catch (e) {
      console.warn(`⚠️ [DB] ${name} sync warning:`, e?.message);
    }
  }

  // 🚀 MANUAL MIGRATION: Add recording columns if they don't exist
  try {
    await sequelize.query(`
      ALTER TABLE Contents 
      ADD COLUMN IF NOT EXISTS recordingLink LONGTEXT NULL DEFAULT NULL,
      ADD COLUMN IF NOT EXISTS recordingVisible BOOLEAN DEFAULT 0
    `);
    console.log("✅ [DB] Recording columns added");
  } catch (e) {
    console.warn("⚠️ [DB] Recording columns warning:", e?.message);
  }

  try {
    await FirewallRule.sync();
  } catch (e) {
    console.warn("[DB] FirewallRule sync warning:", e?.message);
  }

  const defaultRules = [
    {
      key: "sqli_xss_filter",
      name: "SQLi & XSS Shredder",
      description: "Blocks malicious database injection and script payloads.",
    },
    {
      key: "dir_traversal",
      name: "Directory Traversal Blocker",
      description: "Prevents hackers from accessing VPS root folders.",
    },
    {
      key: "ddos_ratelimit",
      name: "Layer 7 Anti-DDoS",
      description:
        "Drops connections from IPs sending abnormal amounts of traffic.",
    },
    {
      key: "geo_block",
      name: "Geo-Fence (LK Only)",
      description: "Drops all traffic originating outside of Sri Lanka.",
    },
    {
      key: "vpn_block",
      name: "VPN & Proxy Blocker",
      description: "Blocks known VPN exit nodes to prevent account sharing.",
    },
  ];

  for (const rule of defaultRules) {
    const [dbRule, created] = await FirewallRule.findOrCreate({
      where: { key: rule.key },
      defaults: rule,
    });
    if (!created && !dbRule) {
      await FirewallRule.create(rule);
    }
  }
  await User.update({ isOnline: false }, { where: {} });

  const admin = await User.findOne({ where: { mobile: "ADMIN" } });
  if (!admin)
    await User.create({
      password: encrypt(process.env.ADMIN_PASS || "admin2005"),
      role: "admin",
      name: "Master Admin",
      mobile: "ADMIN",
    });

  await Setting.findOrCreate({
    where: { key: "maintenance" },
    defaults: { value: false },
  });
  const [emailSetting] = await Setting.findOrCreate({
    where: { key: "notifications_email" },
    defaults: { value: true },
  });
  const [pushSetting] = await Setting.findOrCreate({
    where: { key: "notifications_push" },
    defaults: { value: true },
  });
  setNotificationFlags({
    emailEnabled: emailSetting?.value !== false,
    pushEnabled: pushSetting?.value !== false,
  });
  await AppConfig.findOrCreate({
    where: { key: "theme_color" },
    defaults: { value: "#dc2626" },
  });
  await AppConfig.findOrCreate({
    where: { key: "site_name" },
    defaults: { value: "SFT KING" },
  });
  await AppConfig.findOrCreate({
    where: { key: "hall_classes" },
    defaults: { value: "[]" },
  });
  console.log(">> DB SYNCED");
};
initDB();

// 🚀 START THE AUTO-NUKE ENGINE
// We pass it the WrittenResult model and the exact folder path defined at the top of your server!
startAutoNuke(WrittenResult, writtenAnswersDir);

// --- 4. SOCKET LOGIC (Fixed Admin Status) ---
// --- 4. SOCKET LOGIC (UPDATED: Admin Status & Counts) ---
const onlineUsers = new Map(); // Stores userId -> live session payload
let adminSocketId = null; // Tracks if Admin is connected
let adminCurrentRoute = null;
const SESSION_OFFLINE_MS = 8000;

const isRecipientAwayFromSupportDesk = (receiver) => {
  if (!receiver) return true;

  if (receiver.role === "student") {
    const session = onlineUsers.get(String(receiver.id));
    if (!session) return true;
    return !String(session.route || "").startsWith("/student/help");
  }

  if (receiver.role === "admin") {
    if (!adminSocketId) return true;
    return !String(adminCurrentRoute || "").startsWith("/admin/support");
  }

  return true;
};

const removeOnlineSession = async (userId, socketId = null) => {
  const session = onlineUsers.get(String(userId));
  if (!session) return false;
  if (socketId && session.socketId !== socketId) return false;

  onlineUsers.delete(String(userId));

  const stillOnline = Array.from(onlineUsers.values()).some(
    (info) => String(info.userId) === String(userId),
  );
  if (!stillOnline) {
    await User.update({ isOnline: false }, { where: { id: userId } });
  }

  io.emit("online_count_update", onlineUsers.size);
  io.to("admin_room").emit(
    "active_sessions_update",
    Array.from(onlineUsers.entries()).map(([id, info]) => ({
      sessionId: info.sessionId || id,
      userId: info.userId || id,
      ...info,
    })),
  );
  return true;
};

setInterval(async () => {
  const now = Date.now();
  const staleUsers = [];

  for (const [userId, info] of onlineUsers.entries()) {
    if (info.userId === undefined) continue;
    const lastSeen = Number(info.lastSeen || info.time || 0);
    if (
      info.userId !== undefined &&
      lastSeen &&
      now - lastSeen > SESSION_OFFLINE_MS
    ) {
      staleUsers.push({ userId, socketId: info.socketId });
    }
  }

  for (const stale of staleUsers) {
    await removeOnlineSession(stale.userId, stale.socketId);
  }
}, 3000);

io.on("connection", (socket) => {
  // Helper function to blast the live radar data to the admin
  const broadcastActiveSessions = () => {
    // Convert our Map into a clean array for the frontend
    const sessions = Array.from(onlineUsers.entries()).map(([id, info]) => ({
      sessionId: info.sessionId || id,
      userId: info.userId || id,
      ...info,
    }));
    io.to("admin_room").emit("active_sessions_update", sessions);
  };

  // 1. LISTEN FOR "I AM HERE" (Login)
  socket.on("i_am_here", async (data) => {
    // 🛑 FIX 1: Prevent ghost users! Ignore if frontend sends empty data before loading.
    if (!data || (!data.userId && data.role !== "admin")) return;

    const userId = String(data.userId);

    // ✅ ADMIN CONNECTED
    if (data.role === "admin") {
      socket.join("admin_room");
      adminSocketId = socket.id;
      adminCurrentRoute = data.route || adminCurrentRoute;

      // 📢 TELL EVERYONE: ADMIN IS ONLINE
      io.emit("admin_status", { online: true });
      broadcastActiveSessions();
      return;
    }

    // ✅ STUDENT CONNECTED
    if (data.role === "student") {
      socket.join(`user_${userId}`);
      console.log(`>> Student ${userId} is Online (Socket: ${socket.id})`);

      const sessionId = String(
        data.sessionId || data.sid || `${userId}:${socket.id}`,
      );
      const existingUser = onlineUsers.get(userId);

      if (
        existingUser &&
        existingUser.socketId &&
        existingUser.socketId !== socket.id
      ) {
        try {
          io.to(existingUser.socketId).emit("concurrent_login", {
            message:
              "Security Alert: Your account is active on another device. This session has been closed.",
          });
        } catch (error) {
          console.error(
            "[SESSION REPLACE ERROR] Failed to notify old session:",
            error,
          );
        }

        onlineUsers.delete(userId);
      }

      const currentPage =
        data.page ||
        (existingUser &&
        existingUser.page &&
        existingUser.page !== "Logging in..."
          ? existingUser.page
          : "Browsing Platform");
      const currentAction =
        data.action ||
        (existingUser && existingUser.action
          ? existingUser.action
          : currentPage);
      const currentDetail =
        data.detail || (existingUser && existingUser.detail) || "";
      const currentRoute =
        data.route || (existingUser && existingUser.route) || null;
      const currentOS =
        data.os || (existingUser && existingUser.os) || "Unknown";
      const currentAvatar =
        data.avatar || (existingUser && existingUser.avatar) || null;

      // ✅ This strictly forces the correct name or falls back to their ID (No more "undefined")
      const finalName =
        data.name ||
        (existingUser && existingUser.name) ||
        `Student #${userId}`;

      onlineUsers.set(userId, {
        sessionId,
        userId,
        socketId: socket.id,
        name: finalName,
        page: currentPage,
        action: currentAction,
        detail: currentDetail,
        route: currentRoute,
        os: currentOS,
        avatar: currentAvatar,
        time: Date.now(),
        lastSeen: Date.now(),
      });

      await User.update({ isOnline: true }, { where: { id: userId } });

      // Broadcast new count AND the detailed radar data
      io.emit("online_count_update", onlineUsers.size);
      broadcastActiveSessions();
    }
  });

  // ✅ NEW: 1.5. FOOLPROOF LIVE MOVEMENT TRACKER
  socket.on("student_activity", (data) => {
    // Force a safe string, catching both .id and ._id just in case of database differences
    const safeUserId = String(data.userId || data._id);
    const page = data.page || data.route || "Browsing Platform";
    const action = data.action || data.event || page;
    const detail = data.detail || data.target || data.meta || "";
    const os = data.os || "Unknown";
    const avatar = data.avatar || null;

    // Debugging: This will print in your server console every time a student moves
    console.log(
      `📡 Radar Ping Received from ${safeUserId}: ${action} :: ${page}`,
    );

    // Upsert Logic: Update them if they exist, create them if they somehow skipped login
    if (onlineUsers.has(safeUserId)) {
      const userData = onlineUsers.get(safeUserId);
      userData.page = page;
      userData.action = action;
      userData.detail = detail;
      userData.route = data.route || userData.route || null;
      userData.os = os || userData.os || "Unknown";
      userData.avatar = avatar || userData.avatar || null;
      userData.socketId = socket.id;
      if (data.name) userData.name = data.name;
      userData.time = Date.now();
      userData.lastSeen = Date.now();

      onlineUsers.set(safeUserId, userData);
    } else {
      onlineUsers.set(safeUserId, {
        sessionId: data.sessionId || data.sid || `${safeUserId}:${socket.id}`,
        userId: safeUserId,
        socketId: socket.id,
        name: data.name || `Student #${safeUserId}`,
        page,
        action,
        detail,
        route: data.route || null,
        os,
        avatar,
        time: Date.now(),
        lastSeen: Date.now(),
      });
    }

    // Instantly blast the updated data to the Admin Dashboard
    broadcastActiveSessions();
  });

  socket.on("session_heartbeat", (data) => {
    if (data?.role === "admin") {
      if (socket.id === adminSocketId) {
        adminCurrentRoute = data?.route || adminCurrentRoute;
      }
      return;
    }

    const safeUserId = String(data?.userId || data?._id || "");
    if (!safeUserId || !onlineUsers.has(safeUserId)) return;

    const userData = onlineUsers.get(safeUserId);
    userData.lastSeen = Date.now();
    userData.time = Date.now();
    userData.socketId = socket.id;
    if (data?.page) userData.page = data.page;
    if (data?.action) userData.action = data.action;
    if (data?.detail !== undefined) userData.detail = data.detail;
    if (data?.route !== undefined) userData.route = data.route;
    if (data?.os) userData.os = data.os;
    onlineUsers.set(safeUserId, userData);
    io.emit("online_count_update", onlineUsers.size);
    broadcastActiveSessions();
  });

  // ✅ NEW: 1.6 LIVE VIEWER COUNTER SYSTEM (Smart Global Mode)

  // 🚀 1. The "Knock": When a video card loads in the library, tell them the current fire count
  socket.on("get_viewers", (videoId) => {
    const roomName = `live_${videoId}`;
    const currentCount = io.sockets.adapter.rooms.get(roomName)?.size || 0;
    // Whisper the answer back only to the specific student asking
    socket.emit("live_viewers", { videoId: videoId, count: currentCount });
  });

  // 🚀 2. Joining: When someone hits play
  socket.on("join_live", (videoId) => {
    const roomName = `live_${videoId}`;
    socket.join(roomName);
    const newCount = io.sockets.adapter.rooms.get(roomName)?.size || 0;

    // 📢 GLOBAL MEGAPHONE: Tell the ENTIRE platform, so library cards update instantly!
    io.emit("live_viewers", { videoId: videoId, count: newCount });
  });

  // 🚀 3. Leaving: When someone hits pause
  socket.on("leave_live", (videoId) => {
    const roomName = `live_${videoId}`;
    socket.leave(roomName);
    const newCount = io.sockets.adapter.rooms.get(roomName)?.size || 0;

    // 📢 GLOBAL MEGAPHONE
    io.emit("live_viewers", { videoId: videoId, count: newCount });
  });

  // 🚀 4. Ghost Catcher: Drop count if they violently close their browser tab
  socket.on("disconnecting", () => {
    socket.rooms.forEach((room) => {
      if (room.startsWith("live_")) {
        const videoId = room.replace("live_", ""); // Extract the exact video ID
        const newCount = (io.sockets.adapter.rooms.get(room)?.size || 1) - 1;

        // 📢 GLOBAL MEGAPHONE
        io.emit("live_viewers", { videoId: videoId, count: newCount });
      }
    });
  });

  // ✅ 2. REPLY TO "IS ADMIN ONLINE?" CHECKS
  socket.on("check_admin_status", () => {
    const isOnline = !!adminSocketId;
    socket.emit("admin_status", { online: isOnline });
  });

  socket.on("mark_read", async ({ senderId, receiverId }) => {
    try {
      if (!senderId || !receiverId) return;
      await Message.update(
        { isRead: true },
        { where: { senderId, receiverId, isRead: false } },
      );
      io.to("admin_room").emit("messages_read", { senderId, receiverId });
      io.to(`user_${senderId}`).emit("messages_read", { senderId, receiverId });
      io.to(`user_${receiverId}`).emit("messages_read", {
        senderId,
        receiverId,
      });
    } catch (error) {
      console.error("mark_read error:", error);
    }
  });

  socket.on("register_notification_token", async (data) => {
    try {
      const userId = String(data?.userId || "").trim();
      const token = String(data?.token || "").trim();
      if (!userId || !token) return;
      await addNotificationToken(userId, token);
    } catch (e) {
      console.error("Register token error:", e);
    }
  });

  socket.on("remove_notification_token", async (data) => {
    try {
      const userId = String(data?.userId || "").trim();
      const token = String(data?.token || "").trim();
      if (!userId || !token) return;
      await removeNotificationToken(userId, token);
    } catch (e) {
      console.error("Remove token error:", e);
    }
  });

  // ✅ 2.5. ADMIN GOD ALERT -> TARGETED STUDENT FULLSCREEN POPUP
  socket.on("send_god_alert", async (data) => {
    try {
      const adminId = String(data?.adminId || "").trim();
      const targetUserId = String(data?.targetUserId || "").trim();
      const message = String(data?.message || "").trim();
      const priorityRaw = String(data?.priority || "high").toLowerCase();
      const priority = ["normal", "high", "critical"].includes(priorityRaw)
        ? priorityRaw
        : "high";

      if (!adminId || !targetUserId || !message) {
        socket.emit("god_alert_error", { message: "Missing alert payload" });
        return;
      }

      if (message.length > 320) {
        socket.emit("god_alert_error", {
          message: "Message too long (max 320 chars)",
        });
        return;
      }

      const [admin, target] = await Promise.all([
        User.findByPk(adminId),
        User.findByPk(targetUserId),
      ]);

      if (!admin || admin.role !== "admin") {
        socket.emit("god_alert_error", {
          message: "Unauthorized alert sender",
        });
        return;
      }

      if (!target || target.role !== "student") {
        socket.emit("god_alert_error", { message: "Target student not found" });
        return;
      }

      const payload = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        adminId,
        adminName: admin.name || admin.fullName || "Admin",
        targetUserId,
        message,
        priority,
        sentAt: Date.now(),
      };

      io.to(`user_${targetUserId}`).emit("god_alert", payload);
      io.to("admin_room").emit("god_alert_dispatch_status", {
        alertId: payload.id,
        adminId,
        targetUserId,
        delivered: true,
        sentAt: payload.sentAt,
      });
    } catch (e) {
      console.error("God alert error:", e);
      socket.emit("god_alert_error", { message: "Failed to send alert" });
    }
  });

  socket.on("god_alert_seen", async (data) => {
    const alertId = String(data?.alertId || "");
    const targetUserId = String(data?.targetUserId || "");
    if (!alertId || !targetUserId) return;

    io.to("admin_room").emit("god_alert_seen", {
      alertId,
      targetUserId,
      seenAt: Date.now(),
    });
  });

  // ✅ 3. HANDLE CHAT MESSAGES
  socket.on("send_message", async (data) => {
    try {
      const { senderId, receiverId, content, replyToId } = data;

      const msg = await Message.create({
        senderId,
        receiverId,
        content,
        replyToId,
        isRead: false,
      });

      const hydratedMsg = await Message.findByPk(msg.id, {
        include: [
          {
            model: Message,
            as: "replyTo",
            include: [
              {
                model: User,
                as: "sender",
                attributes: ["id", "name", "mobile", "role"],
              },
            ],
          },
        ],
      });
      const fullMsg = hydratedMsg ? hydratedMsg.toJSON() : msg.toJSON();

      const receiver = await User.findByPk(receiverId);
      if (receiver) {
        if (receiver.role === "admin") {
          io.to("admin_room").emit("receive_message", fullMsg);
        } else {
          io.to(`user_${receiverId}`).emit("receive_message", fullMsg);
        }
      }

      const sender = await User.findByPk(senderId);
      if (sender) {
        if (sender.role === "admin") {
          io.to("admin_room").emit("receive_message", fullMsg);
        } else {
          io.to(`user_${senderId}`).emit("receive_message", fullMsg);
        }
      }

      const recipientUser = receiver;
      const recipientIsAway = isRecipientAwayFromSupportDesk(recipientUser);
      console.log("[SUPPORT] Message sent", {
        senderId,
        receiverId: recipientUser?.id,
        recipientIsAway,
        recipientExists: !!recipientUser,
      });

      if (
        recipientUser &&
        String(recipientUser.id) !== String(senderId) &&
        recipientIsAway
      ) {
        console.log("[SUPPORT] Recipient is away - triggering push + email");
        const notificationTitle =
          sender?.role === "admin"
            ? "Support reply from admin"
            : "New support message";
        const notificationBody = `${sender?.name || sender?.mobile || "Someone"}: ${String(content || "").slice(0, 120)}`;
        const notificationUrl =
          sender?.role === "admin"
            ? `/student/help?studentId=${senderId}`
            : `/admin/support?studentId=${senderId}`;

        sendPushNotificationToUsers([recipientUser.id], {
          title: notificationTitle,
          body: notificationBody,
          url: notificationUrl,
          type: "support_message",
          senderId,
          receiverId,
          messageId: fullMsg.id,
        }).catch((error) => {
          console.error("Push send error:", error?.message || error);
        });

        sendSupportEmailAlert({
          sender,
          receiver: recipientUser,
          content,
          messageId: fullMsg.id,
        }).catch((error) => {
          console.error("Support email send error:", error?.message || error);
        });
      } else {
        console.log(
          "[SUPPORT] Recipient NOT away or not found - skipping push + email",
        );
      }
    } catch (e) {
      console.error("Message Error:", e);
    }
  });

  // 4. DISCONNECT LOGIC
  socket.on("disconnect", async () => {
    // ✅ IF ADMIN DISCONNECTS
    if (socket.id === adminSocketId) {
      adminSocketId = null;
      adminCurrentRoute = null;
      io.emit("admin_status", { online: false });
    }

    // ✅ IF STUDENT DISCONNECTS
    const removedUserIds = [];
    for (let [uid, info] of onlineUsers.entries()) {
      if (info.socketId === socket.id) {
        removedUserIds.push(String(info.userId || uid));
        onlineUsers.delete(uid);
      }
    }

    if (removedUserIds.length > 0) {
      for (const userId of removedUserIds) {
        const stillOnline = Array.from(onlineUsers.values()).some(
          (info) => String(info.userId) === userId,
        );
        if (!stillOnline) {
          await User.update({ isOnline: false }, { where: { id: userId } });
        }
      }

      io.emit("online_count_update", onlineUsers.size);
      broadcastActiveSessions(); // Update radar so the admin sees they left
    }
  });
});
// Remove the old setInterval database poller if you have it,

// --- 5. MIDDLEWARE ---
const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  const incomingFp = req.headers["x-device-fingerprint"]; // 🧬 Read the incoming device DNA

  if (!token) return res.status(403).json({ message: "No Token" });

  jwt.verify(
    token,
    process.env.JWT_SECRET || "secret",
    async (err, decoded) => {
      if (err) return res.status(401).json({ message: "Unauthorized" });

      // 🚀 THE ZERO-TRUST CHECK
      // If they are a student, and the token has DNA, it MUST match the device sending the request.
      if (
        decoded.role === "student" &&
        decoded.fp &&
        decoded.fp !== "unknown"
      ) {
        if (decoded.fp !== incomingFp) {
          await SecurityLog.create({
            event: "TOKEN HIJACK ATTEMPT",
            description:
              "Device signature mismatch! Token was moved to a new device.",
            ip_address: req.ip || req.connection.remoteAddress,
            user_id: String(decoded.id),
            severity: "high",
          });
          return res.status(403).json({
            message:
              "Security Violation: Device fingerprint mismatch. Please log in again.",
          });
        }
      }

      try {
        const user = await User.findByPk(decoded.id);
        if (!user) return res.status(401).json({ message: "User Lost" });
        if (user.status === "deactivated")
          return res.status(403).json({ message: "Banned" });

        req.user = {
          ...decoded,
          sessionId: decoded.sid || sha256(token).slice(0, 32),
        };
        next();
      } catch (e) {
        res.status(500).json({ message: "Auth Error" });
      }
    },
  );
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
};

const BACKUP_MODELS = {
  User,
  Lesson,
  SecurityLog,
  Blocklist,
  AppConfig,
  Batch,
  Content,
  Request,
  Setting,
  FirewallRule,
  Reaction,
  PastPaperFolder,
  PastPaperFile,
  McqFolder,
  McqQuiz,
  McqResult,
  McqResultHistory,
  WrittenFolder,
  WrittenQuiz,
  WrittenResult,
};

const RESTORE_MODEL_ORDER = [
  "User",
  "Lesson",
  "Batch",
  "AppConfig",
  "Setting",
  "SecurityLog",
  "Blocklist",
  "Content",
  "Request",
  "FirewallRule",
  "PastPaperFolder",
  "PastPaperFile",
  "McqFolder",
  "McqQuiz",
  "McqResult",
  "McqResultHistory",
  "WrittenFolder",
  "WrittenQuiz",
  "WrittenResult",
  "Reaction",
];

function buildFolderManifest(baseDir, relRoot = "") {
  const absRoot = path.join(baseDir, relRoot);
  if (!fs.existsSync(absRoot)) return [];

  const entries = fs.readdirSync(absRoot, { withFileTypes: true });
  const rows = [];

  for (const entry of entries) {
    const relPath = path.join(relRoot, entry.name).replace(/\\/g, "/");
    const absPath = path.join(baseDir, relPath);
    const stat = fs.statSync(absPath);

    rows.push({
      path: relPath,
      type: entry.isDirectory() ? "dir" : "file",
      size: entry.isDirectory() ? 0 : stat.size,
      updatedAt: stat.mtime.toISOString(),
    });

    if (entry.isDirectory()) {
      rows.push(...buildFolderManifest(baseDir, relPath));
    }
  }

  return rows;
}

// --- 🛡️ THE SFT KING GOD-GRADE FIREWALL ---
let firewallCache = {};

// 🛡️ ANTI-DDOS LIMITER CONFIGURATION
const ddosLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute time window
  max: 120, // Limit each IP to 120 requests per minute (2 per second)

  // 🚀 THE FIX: Tell the firewall to ignore Socket.io polling traffic
  skip: (req, res) => {
    if (req.originalUrl && req.originalUrl.includes("/socket.io/")) {
      return true;
    }
    return false;
  },

  message: {
    error:
      "SFT FIREWALL: DDoS Protection Triggered. Your IP has been temporarily blocked.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: async (req, res, next, options) => {
    // Log the attack directly to your dashboard when triggered!
    const ip = req.ip || req.connection.remoteAddress;
    try {
      await SecurityLog.create({
        event: "DDOS ATTACK BLOCKED",
        description: "IP exceeded 120 requests per minute",
        ip_address: ip,
        severity: "high",
      });
    } catch (e) {}
    res.status(429).json(options.message);
  },
});
// Cache rules in memory so we don't spam the database on every request
const refreshFirewallCache = async () => {
  try {
    const rules = await FirewallRule.findAll();
    firewallCache = rules.reduce((acc, rule) => {
      acc[rule.key] = rule.isActive;
      return acc;
    }, {});
  } catch (e) {}
};
// Refresh cache every 10 seconds automatically
setInterval(refreshFirewallCache, 10000);
setTimeout(refreshFirewallCache, 2000); // Initial load

// --- 🛡️ THE SFT KING GOD-GRADE FIREWALL ---
server.use(async (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  // Strip IPv6 prefix if present (e.g., ::ffff:192.168.1.1) to ensure geoip works
  const cleanIp = ip.replace(/^.*:/, "");

  // 🚀 1. GEO-FENCE (Moved to the VERY top to block the whole site, not just APIs)
  if (firewallCache["geo_block"]) {
    // Localhost testing bypass
    if (cleanIp !== "127.0.0.1" && cleanIp !== "1") {
      const geo = geoip.lookup(cleanIp);
      // If geo is found and country is NOT Sri Lanka (LK)
      if (geo && geo.country !== "LK") {
        try {
          await SecurityLog.create({
            event: "GEO FENCE BLOCK",
            description: `Blocked traffic from ${geo.country || "Unknown"}`,
            ip_address: cleanIp,
            severity: "high",
          });
        } catch (e) {}

        // Return the aggressive HTML screen
        return res.status(403).send(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Access Denied</title>
                        <style>
                            body { background-color: #020617; color: #ef4444; font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; text-align: center; padding: 20px; }
                            h1 { font-size: 3rem; text-transform: uppercase; font-style: italic; font-weight: 900; letter-spacing: 0.05em; }
                        </style>
                    </head>
                    <body>
                        <h1>Get Lost, We only accept Sri Lankans</h1>
                    </body>
                    </html>
                `);
      }
    }
  }

  // Only inspect API routes for the remaining heavy rules
  if (!req.path.startsWith("/api/")) return next();

  // 2. Layer 7 Anti-DDoS Engine
  if (firewallCache["ddos_ratelimit"]) {
    await new Promise((resolve) => {
      ddosLimiter(req, res, () => resolve());
    });
  }

  const payloadString =
    JSON.stringify(req.body) + JSON.stringify(req.query) + req.path;

  // 3. Directory Traversal Blocker
  if (
    firewallCache["dir_traversal"] &&
    (payloadString.includes("../") || payloadString.includes("..\\"))
  ) {
    await SecurityLog.create({
      event: "FIREWALL BLOCK",
      description: "Directory Traversal Attempt",
      ip_address: cleanIp,
      severity: "high",
    });
    return res
      .status(403)
      .json({ error: "SFT FIREWALL: Directory Traversal Blocked." });
  }

  // 4. SQL Injection & XSS Payload Shredder
  if (firewallCache["sqli_xss_filter"]) {
    const sqliXssRegex =
      /(<script>)|(%3Cscript%3E)|(javascript:)|(\bDROP\b\s+\bTABLE\b)|(\bUNION\b\s+\bSELECT\b)/i;

    if (sqliXssRegex.test(payloadString)) {
      await SecurityLog.create({
        event: "FIREWALL BLOCK",
        description: "SQLi/XSS Malicious Payload Detected",
        ip_address: cleanIp,
        severity: "high",
      });
      return res
        .status(403)
        .json({ error: "SFT FIREWALL: Malicious Payload Shredded." });
    }
  }

  next();
});

app.prepare().then(() => {
  server.get("/api/admin-id", async (req, res) => {
    try {
      const admin = await User.findOne({ where: { role: "admin" } });
      res.json({ id: admin ? admin.id : 1 });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ---------------- OTP (REGISTER) ----------------

  // Convert 07xxxxxxxx -> 94xxxxxxxxx
  function toIntl94(mobile07) {
    const m = String(mobile07 || "").trim();
    if (m.startsWith("07") && m.length === 10) return "94" + m.slice(1);
    // if already 94... keep
    if (m.startsWith("94")) return m;
    return m;
  }

  const ALLOWED_CLASS_MODES = ["online", "physical"];

  function normalizeClassMode(mode) {
    const m = String(mode || "")
      .trim()
      .toLowerCase();
    return ALLOWED_CLASS_MODES.includes(m) ? m : null;
  }

  function normalizeHallClass(city) {
    return String(city || "").trim();
  }

  function cityPrefix(city) {
    const letters = String(city || "").replace(/[^a-zA-Z]/g, "");
    const seed = (letters.slice(0, 2) || "XX").padEnd(2, "X");
    return seed.charAt(0).toUpperCase() + seed.charAt(1).toLowerCase();
  }

  function studentCodePrefix(classMode, hallClass) {
    if (classMode === "physical") return cityPrefix(hallClass);
    return "Online";
  }

  async function getHallClassesList() {
    const conf = await AppConfig.findOne({ where: { key: "hall_classes" } });
    if (!conf || !conf.value) return [];

    try {
      const parsed = JSON.parse(conf.value);
      if (!Array.isArray(parsed)) return [];
      return [
        ...new Set(parsed.map((v) => String(v || "").trim()).filter(Boolean)),
      ];
    } catch {
      return [];
    }
  }

  async function saveHallClassesList(list) {
    const clean = [
      ...new Set(
        (list || []).map((v) => String(v || "").trim()).filter(Boolean),
      ),
    ];
    const payload = JSON.stringify(clean);
    const conf = await AppConfig.findOne({ where: { key: "hall_classes" } });
    if (conf) await conf.update({ value: payload });
    else await AppConfig.create({ key: "hall_classes", value: payload });
    return clean;
  }

  async function generateUniqueStudentCode(classMode, hallClass) {
    const prefix = studentCodePrefix(classMode, hallClass);

    for (let i = 0; i < 5000; i++) {
      const random4 = String(Math.floor(Math.random() * 10000)).padStart(
        4,
        "0",
      );
      const code = `${prefix}${random4}`;
      const exists = await User.findOne({ where: { studentCode: code } });
      if (!exists) return code;
    }

    throw new Error("Failed to generate a unique student code");
  }

  // --- FORGOT PASSWORD (SECURE OTP) ---

  const genToken = () => crypto.randomBytes(32).toString("hex");

  const RESET_TTL_MS = 5 * 60 * 1000; // 5 minutes
  const MAX_TRIES = 5;

  async function canStudentAccessContent(studentId, contentRow) {
    const isFreeVideo = !contentRow.price || contentRow.price === "0";

    if (contentRow.isSeparate) {
      if (isFreeVideo) return true;
      const approved = await Request.findOne({
        where: { studentId, contentId: contentRow.id, status: "approved" },
      });
      return !!approved;
    }

    const lesson = await Lesson.findByPk(contentRow.lessonId);
    const isParentFree = !lesson?.price || lesson.price === "0";
    if (isParentFree) return true;

    const approved = await Request.findOne({
      where: { studentId, lessonId: contentRow.lessonId, status: "approved" },
    });
    return !!approved;
  }

  // ✅ SECURE TICKET BOOTH (Updated for Free Badge Logic)
  server.get("/api/content/:id/pdf-token", verifyToken, async (req, res) => {
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    try {
      const studentId = req.user.id;
      const contentId = req.params.id;

      const content = await Content.findByPk(contentId);
      if (!content || !content.pdfFile || !content.pdfVisible) {
        return res
          .status(404)
          .json({ message: "PDF is currently unavailable." });
      }

      const timeLimitMins = parseInt(content.pdfTimeLimit) || 60;

      // 💥 FREE MODE: Send 'isFree: true' and a long 24h token
      if (content.isPdfFree) {
        const pdfToken = jwt.sign(
          { id: studentId, contentId: content.id, purpose: "secure_pdf_view" },
          process.env.JWT_SECRET || "secret",
          { expiresIn: "24h" }, // Give them 24 hours of access per session
        );
        return res.json({
          success: true,
          token: pdfToken,
          expiresInMins: timeLimitMins,
          isFree: true, // ✅ TELLS FRONTEND TO HIDE TIMER
        });
      }

      // --- PAID MODE ---
      const approvedRequest = await Request.findOne({
        where: { studentId, contentId, type: "PDF_ACCESS", status: "approved" },
        order: [["createdAt", "DESC"]],
      });

      if (!approvedRequest) {
        return res
          .status(403)
          .json({ message: "Time limit has expired or access denied." });
      }

      let startTime = approvedRequest.accessedAt;
      if (!startTime) {
        startTime = new Date();
        approvedRequest.accessedAt = startTime;
        await approvedRequest.save();
      }

      const nowMs = new Date().getTime();
      const startMs = new Date(startTime).getTime();
      const elapsedMins = (nowMs - startMs) / (1000 * 60);
      const remainingMins = timeLimitMins - elapsedMins;

      if (remainingMins <= 0) {
        approvedRequest.status = "expired";
        await approvedRequest.save();
        return res.status(403).json({ message: "Time limit has expired." });
      }

      const safeMinutes = Math.max(1, Math.ceil(remainingMins));
      const pdfToken = jwt.sign(
        { id: studentId, contentId: content.id, purpose: "secure_pdf_view" },
        process.env.JWT_SECRET || "secret",
        { expiresIn: `${safeMinutes}m` },
      );

      return res.json({
        success: true,
        token: pdfToken,
        expiresInMins: remainingMins,
        isFree: false, // ✅ TELLS FRONTEND TO SHOW TIMER
      });
    } catch (e) {
      console.error("💥 PDF TOKEN CRASH:", e.message);
      res.status(500).json({ message: "FAILED TO GENERATE TOKEN." });
    }
  });

  // ✅ 2. SECURE VIEWER (Lightning Fast Streaming)
  server.get("/api/secure-pdf/:token", async (req, res) => {
    try {
      const token = req.params.token;
      if (!token) return res.status(401).send("Security Alert: No Token");

      jwt.verify(
        token,
        process.env.JWT_SECRET || "secret",
        async (err, decoded) => {
          if (err || decoded.purpose !== "secure_pdf_view") {
            return res
              .status(403)
              .send("Security Token Expired. Refresh page.");
          }

          const { contentId, id: studentId, isPastPaper } = decoded;
          let targetPdfFile = null;

          if (isPastPaper) {
            const pastPaper = await PastPaperFile.findByPk(contentId);
            if (!pastPaper || !pastPaper.pdfFile)
              return res.status(404).send("Past Paper Not Found");
            targetPdfFile = pastPaper.pdfFile;
          } else {
            const content = await Content.findByPk(contentId);
            if (!content || !content.pdfFile)
              return res.status(404).send("PDF Not Found");
            targetPdfFile = content.pdfFile;
          }

          let pdfPath = path.join(VAULT_DIR, targetPdfFile);
          if (!fs.existsSync(pdfPath)) {
            pdfPath = path.join(PDF_UPLOAD_DIR, targetPdfFile);
          }

          if (!fs.existsSync(pdfPath))
            return res.status(404).send("File Missing on Server");

          const stat = fs.statSync(pdfPath);
          const fileSize = stat.size;
          const range = req.headers.range;

          res.setHeader("Content-Type", "application/pdf");
          res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
          res.setHeader(
            "Content-Disposition",
            `inline; filename="SECURE_DOC.pdf"`,
          );
          res.setHeader("Accept-Ranges", "bytes");

          // Range support lets react-pdf render first page without waiting for full file download.
          if (range) {
            const parts = String(range)
              .replace(/bytes=/, "")
              .split("-");
            const start = Number.parseInt(parts[0], 10);
            const end = parts[1] ? Number.parseInt(parts[1], 10) : fileSize - 1;

            if (
              Number.isNaN(start) ||
              Number.isNaN(end) ||
              start > end ||
              start >= fileSize
            ) {
              res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
              return res.end();
            }

            const chunkStart = Math.max(0, start);
            const chunkEnd = Math.min(end, fileSize - 1);
            const chunkSize = chunkEnd - chunkStart + 1;

            res.status(206);
            res.setHeader(
              "Content-Range",
              `bytes ${chunkStart}-${chunkEnd}/${fileSize}`,
            );
            res.setHeader("Content-Length", chunkSize);

            const stream = fs.createReadStream(pdfPath, {
              start: chunkStart,
              end: chunkEnd,
            });
            return stream.pipe(res);
          }

          res.setHeader("Content-Length", fileSize);
          const stream = fs.createReadStream(pdfPath);
          return stream.pipe(res);
        },
      );
    } catch (e) {
      console.error("Viewer Error:", e);
      res.status(500).send("Server Error");
    }
  });

  // ✅ SMART STATUS CHECKER: Enforces expiration & handles FREE PDFs!
  server.get(
    "/api/student/pdf-status/:contentId",
    verifyToken,
    async (req, res) => {
      try {
        const content = await Content.findByPk(req.params.contentId);

        // 💥 THE BYPASS: If the admin marked it free, instantly approve it!
        if (content && content.isPdfFree) {
          return res.json({ status: "approved" });
        }

        const request = await Request.findOne({
          where: {
            studentId: req.user.id,
            contentId: req.params.contentId,
            type: "PDF_ACCESS",
          },
          order: [["createdAt", "DESC"]], // Always check their newest request
        });

        if (!request) return res.json({ status: "none" });

        if (request.status === "approved" && request.accessedAt) {
          if (content) {
            const timeLimitMins = parseInt(content.pdfTimeLimit) || 60;
            const nowMs = new Date().getTime();
            const startMs = new Date(request.accessedAt).getTime();
            const elapsedMins = (nowMs - startMs) / (1000 * 60);

            if (elapsedMins >= timeLimitMins) {
              request.status = "expired";
              await request.save();
            }
          }
        }

        return res.json({ status: request.status });
      } catch (e) {
        res.status(500).json({ status: "error" });
      }
    },
  );

  // --- NEW ROUTE: CHECK MOBILE ---
  server.post("/api/check-mobile", async (req, res) => {
    try {
      const { mobile } = req.body;
      const user = await User.findOne({ where: { mobile } });
      if (user) {
        return res.json({ exists: true });
      }
      return res.json({ exists: false });
    } catch (e) {
      console.error("Check Mobile Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ✅ SEND OTP (REGISTER)
  server.post("/api/send-otp", async (req, res) => {
    try {
      const { mobile } = req.body;

      if (!mobile || !/^07\d{8}$/.test(mobile)) {
        return res.status(400).json({ message: "Invalid mobile (07xxxxxxxx)" });
      }

      const otp = genOtp();

      OTP_STORE.set(mobile, {
        otpHash: sha256(otp),
        exp: Date.now() + OTP_TTL_MS,
        tries: 0,
      });

      // Format mobile to 947xxxxxxxx for the SMS Gateway
      const intlMobile = toIntl94(mobile);
      await sendTextItSMS(
        intlMobile,
        `Dear Student Your One Time Password is ${otp}`,
      );

      return res.json({ success: true, sent: true });
    } catch (e) {
      console.error("send-otp error:", e?.message || e);
      // Send gateway error to frontend for easier debugging
      return res
        .status(500)
        .json({ message: e?.message || "OTP send failed", sent: false });
    }
  });

  // ✅ VERIFY OTP (REGISTER)
  server.post("/api/verify-otp", async (req, res) => {
    try {
      const { mobile, otp } = req.body;

      if (!mobile || !/^07\d{8}$/.test(mobile)) {
        return res.status(400).json({ message: "Invalid mobile" });
      }
      if (!otp || String(otp).length !== 4) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      const row = OTP_STORE.get(mobile);
      if (!row) return res.status(400).json({ message: "OTP expired" });
      if (Date.now() > row.exp) {
        OTP_STORE.delete(mobile);
        return res.status(400).json({ message: "OTP expired" });
      }

      if (sha256(otp) !== row.otpHash) {
        return res.status(400).json({ message: "Invalid OTP" });
      }

      // success
      OTP_STORE.delete(mobile);
      return res.json({ success: true });
    } catch (e) {
      console.error("verify-otp error:", e);
      return res.status(500).json({ message: "Error" });
    }
  });

  server.post("/api/forgot/start", async (req, res) => {
    try {
      const { mobile } = req.body;

      if (!mobileRegex.test(mobile)) {
        return res.status(400).json({ error: "Invalid mobile number" });
      }

      // ✅ MUST exist for forgot password
      const user = await User.findOne({ where: { mobile } });
      if (!user) {
        return res
          .status(404)
          .json({ error: "Mobile number is not registered" });
      }

      const otp = genOtp();
      const exp = Date.now() + OTP_TTL_MS;

      FORGOT_STORE.set(mobile, {
        otpHash: sha256(otp),
        exp,
        tries: 0,
      });

      const msg = `SFTKING Password Reset OTP: ${otp}`;

      // Format mobile to 947xxxxxxxx for the SMS Gateway
      const intlMobile = toIntl94(mobile);
      await sendTextItSMS(intlMobile, msg);

      return res.json({ success: true, sent: true });
    } catch (err) {
      console.error("forgot/start error:", err?.message || err);
      // Send gateway error to frontend for easier debugging
      return res
        .status(500)
        .json({ error: err?.message || "Failed to send OTP" });
    }
  });

  server.post("/api/forgot/verify", async (req, res) => {
    try {
      const { mobile, otp } = req.body;

      const entry = FORGOT_STORE.get(mobile);
      if (!entry) return res.status(400).json({ error: "OTP expired" });

      if (Date.now() - entry.createdAt > OTP_TTL_MS) {
        FORGOT_STORE.delete(mobile);
        return res.status(400).json({ error: "OTP expired" });
      }

      entry.tries = (entry.tries || 0) + 1;
      if (entry.tries > MAX_TRIES) {
        FORGOT_STORE.delete(mobile);
        return res.status(429).json({ error: "Too many attempts" });
      }

      if (sha256(otp) !== entry.otpHash) {
        return res.status(400).json({ error: "Invalid OTP" });
      }

      // create reset token
      const resetToken = genToken();
      entry.resetTokenHash = sha256(resetToken);
      entry.resetExpiresAt = Date.now() + RESET_TTL_MS;

      FORGOT_STORE.set(mobile, entry);

      return res.json({ success: true, resetToken });
    } catch (err) {
      console.error("forgot/verify error:", err);
      return res.status(500).json({ error: "Verification failed" });
    }
  });

  server.post("/api/forgot/reset", async (req, res) => {
    try {
      const { mobile, resetToken, newPassword } = req.body;

      if (!newPassword || String(newPassword).length < 4) {
        return res.status(400).json({ error: "Password too short" });
      }

      const entry = FORGOT_STORE.get(mobile);
      if (!entry) return res.status(400).json({ error: "Session expired" });

      if (!entry.resetExpiresAt || Date.now() > entry.resetExpiresAt) {
        FORGOT_STORE.delete(mobile);
        return res.status(400).json({ error: "Session expired" });
      }

      if (sha256(resetToken) !== entry.resetTokenHash) {
        return res.status(403).json({ error: "Invalid reset token" });
      }

      const user = await User.findOne({ where: { mobile } });
      if (!user) return res.status(404).json({ error: "User not found" });

      // Use your existing password hashing/encryption logic here
      // Example if you have encryptPassword():
      // user.password = encryptPassword(newPassword);

      user.password = encrypt(newPassword); // ❗ replace with your real secure method
      await user.save();
      FORGOT_STORE.delete(mobile);

      return res.json({ success: true });
    } catch (err) {
      console.error("forgot/reset error:", err);
      return res.status(500).json({ error: "Reset failed" });
    }
  });

  server.post(
    "/api/user/change-password/verify",
    verifyToken,
    async (req, res) => {
      try {
        const oldPassword = String(req.body?.oldPassword || "");
        if (!oldPassword) {
          return res.status(400).json({ message: "Old password is required" });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (decrypt(user.password) !== oldPassword) {
          return res.status(400).json({ message: "Old password is incorrect" });
        }

        return res.json({ success: true });
      } catch (err) {
        console.error("change-password/verify error:", err);
        return res
          .status(500)
          .json({ message: "Failed to verify old password" });
      }
    },
  );

  server.post("/api/me/address", verifyToken, async (req, res) => {
    try {
      const address = String(req.body?.address || "").trim();
      if (!address) {
        return res.status(400).json({ message: "Address is required" });
      }
      if (/^0\d{9,14}$/.test(address.replace(/\s+/g, ""))) {
        return res
          .status(400)
          .json({ message: "Enter a real address, not a phone number" });
      }

      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      await user.update({ address });
      return res.json({ success: true, address: user.address });
    } catch (e) {
      return res
        .status(500)
        .json({ message: e?.message || "Failed to update address" });
    }
  });

  // 🔧 ADMIN BULK-FIX: Clear bad addresses (phone-number-only entries)
  server.post(
    "/api/admin/fix-bad-addresses",
    requireAdmin,
    async (req, res) => {
      try {
        const users = await User.findAll({ where: { role: "student" } });
        const badAddresses = users.filter((u) => {
          const addr = String(u.address || "").trim();
          return !addr || /^0\d{9,14}$/.test(addr.replace(/\s+/g, ""));
        });

        const updateCount = badAddresses.length;
        if (updateCount > 0) {
          await Promise.all(badAddresses.map((u) => u.update({ address: "" })));
        }

        return res.json({
          success: true,
          cleared: updateCount,
          message: `Cleared ${updateCount} bad address entries.`,
        });
      } catch (e) {
        console.error(
          "[ADMIN FIX] Bulk address clear failed:",
          e?.message || e,
        );
        return res.status(500).json({ message: "Failed to clear addresses" });
      }
    },
  );

  server.post("/api/user/change-password", verifyToken, async (req, res) => {
    try {
      const oldPassword = String(req.body?.oldPassword || "");
      const newPassword = String(req.body?.newPassword || "");

      if (!oldPassword) {
        return res.status(400).json({ message: "Old password is required" });
      }
      if (!newPassword) {
        return res.status(400).json({ message: "New password is required" });
      }
      if (!isStrongPassword(newPassword)) {
        return res.status(400).json({ message: "Use Strong Password Rules" });
      }

      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const currentPassword = decrypt(user.password);
      if (currentPassword !== oldPassword) {
        return res.status(400).json({ message: "Old password is incorrect" });
      }
      if (currentPassword === newPassword) {
        return res
          .status(400)
          .json({ message: "New password must be different" });
      }

      user.password = encrypt(newPassword);
      await user.save();

      return res.json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (err) {
      console.error("change-password error:", err);
      return res.status(500).json({ message: "Failed to update password" });
    }
  });

  server.post(
    "/api/notifications/register-token",
    verifyToken,
    async (req, res) => {
      try {
        const token = String(req.body?.token || "").trim();
        console.log(
          "[TOKEN REGISTER] Request received for userId:",
          req.user.id,
          "token length:",
          token.length,
        );

        if (!token) {
          console.log("[TOKEN REGISTER] Token is empty/missing");
          return res.status(400).json({ message: "Token required" });
        }

        const user = await User.findByPk(req.user.id);
        if (!user) {
          console.log("[TOKEN REGISTER] User not found:", req.user.id);
          return res.status(404).json({ message: "User not found" });
        }

        const tokens = parseNotificationTokens(user.notificationTokens);
        console.log("[TOKEN REGISTER] Current tokens for user:", tokens.length);

        if (!tokens.includes(token)) {
          tokens.push(token);
          await writeNotificationTokens(user.id, tokens);
          console.log(
            "[TOKEN REGISTER] New token added. Total tokens now:",
            tokens.length,
          );
        } else {
          console.log("[TOKEN REGISTER] Token already exists");
        }

        return res.json({ success: true, tokensCount: tokens.length });
      } catch (error) {
        console.error("[TOKEN REGISTER] Error:", error?.message || error);
        return res.status(500).json({ message: "Failed to register token" });
      }
    },
  );

  server.post(
    "/api/notifications/unregister-token",
    verifyToken,
    async (req, res) => {
      try {
        const token = String(req.body?.token || "").trim();
        if (!token) return res.status(400).json({ message: "Token required" });

        const user = await User.findByPk(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        const tokens = parseNotificationTokens(user.notificationTokens).filter(
          (item) => item !== token,
        );
        await writeNotificationTokens(user.id, tokens);

        return res.json({ success: true });
      } catch (error) {
        console.error("Unregister notification token error:", error);
        return res.status(500).json({ message: "Failed to unregister token" });
      }
    },
  );

  // --- CHAT ROUTES ---
  server.get("/api/messages/:targetId", verifyToken, async (req, res) => {
    try {
      const myId = req.user.id;
      const targetId = req.params.targetId;

      // LOGIC: Get messages where I am the sender AND I haven't deleted it
      // OR I am the receiver AND I haven't deleted it
      const messages = await Message.findAll({
        where: {
          [Op.or]: [
            { senderId: myId, receiverId: targetId, senderDeleted: false },
            { senderId: targetId, receiverId: myId, receiverDeleted: false },
          ],
        },
        include: [
          {
            model: Message,
            as: "replyTo",
            include: [{ model: User, as: "sender", attributes: ["name"] }],
          },
        ],
        order: [["createdAt", "ASC"]],
      });
      res.json(messages);
    } catch (e) {
      res.status(500).json({ message: "Error" });
    }
  });

  // --- SMART CONVERSATION LIST (FIXED: Filters Deleted Messages) ---
  // --- SMART CONVERSATION LIST (FIXED: Handles Deleted Users) ---
  // --- SMART CONVERSATION LIST (FIXED: Uses Mobile, No hall_id) ---
  server.get("/api/admin/conversations", verifyToken, async (req, res) => {
    try {
      const myId = req.user.id;

      const messages = await Message.findAll({
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: User,
            as: "sender",
            attributes: ["id", "name", "mobile", "role"], // Replaced hall_id with mobile
          },
          {
            model: User,
            as: "receiver",
            attributes: ["id", "name", "mobile", "role"], // Replaced hall_id with mobile
          },
        ],
      });

      const studentMap = new Map();

      for (const m of messages) {
        // SAFETY CHECK: If user was deleted, skip
        if (!m.sender || !m.receiver) continue;

        let student = null;
        if (m.sender.role === "student") student = m.sender;
        else if (m.receiver.role === "student") student = m.receiver;

        if (!student) continue;

        // Deleted Check
        if (m.senderId === myId && m.senderDeleted) continue;
        if (m.receiverId === myId && m.receiverDeleted) continue;
        if (
          req.user.role === "admin" &&
          m.sender.role === "admin" &&
          m.senderDeleted
        )
          continue;

        if (!studentMap.has(student.id)) {
          studentMap.set(student.id, {
            student: {
              id: student.id,
              name: student.name,
              mobile: student.mobile, // Mapped mobile number
            },
            lastMessage: m.content,
            time: m.createdAt,
            unread: 0,
          });
        }

        if (
          m.sender.id === student.id &&
          !m.isRead &&
          Number(m.receiverId) === Number(myId)
        ) {
          studentMap.get(student.id).unread += 1;
        }
      }

      res.json(Array.from(studentMap.values()));
    } catch (e) {
      console.error("Conversations Error:", e);
      res.status(500).json({ error: e.message });
    }
  });
  // --- MESSAGE ACTIONS (Must exist) ---

  server.post("/api/messages/delete", verifyToken, async (req, res) => {
    try {
      const { messageId } = req.body;
      if (!messageId) return res.status(400).json({ error: "Missing ID" });

      const message = await Message.findByPk(messageId);
      if (!message) return res.status(404).json({ error: "Message not found" });

      const myId = Number(req.user.id);
      const isSender = myId === Number(message.senderId);
      const isReceiver = myId === Number(message.receiverId);
      if (!isSender && !isReceiver) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const updates = {};
      if (isSender) updates.senderDeleted = true;
      if (isReceiver) updates.receiverDeleted = true;

      await message.update(updates);
      const me = await User.findByPk(myId, { attributes: ["id", "role"] });
      if (me?.role === "admin") {
        io.to("admin_room").emit("message_deleted", { id: messageId });
      } else {
        io.to(`user_${myId}`).emit("message_deleted", { id: messageId });
      }
      res.json({ success: true });
    } catch (e) {
      console.error("Delete Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // --- CLEAR OWN CHAT HISTORY (SOFT DELETE) ---
  server.post("/api/messages/clear", verifyToken, async (req, res) => {
    try {
      const { targetId } = req.body;
      const myId = req.user.id;

      if (!targetId)
        return res.status(400).json({ message: "Target ID required" });

      // Hide messages I SENT
      await Message.update(
        { senderDeleted: true },
        { where: { senderId: myId, receiverId: targetId } },
      );

      // Hide messages I RECEIVED
      await Message.update(
        { receiverDeleted: true },
        { where: { senderId: targetId, receiverId: myId } },
      );

      const me = await User.findByPk(myId, { attributes: ["id", "role"] });
      if (me?.role === "admin") {
        io.to("admin_room").emit("message_deleted_bulk", {
          senderId: myId,
          receiverId: targetId,
        });
      } else {
        io.to(`user_${myId}`).emit("message_deleted_bulk", {
          senderId: myId,
          receiverId: targetId,
        });
      }

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  server.post("/api/messages/edit", verifyToken, async (req, res) => {
    try {
      const { messageId, newContent } = req.body;

      if (!messageId || !String(newContent || "").trim()) {
        return res.status(400).json({ error: "Invalid payload" });
      }

      const message = await Message.findByPk(messageId);
      if (!message) return res.status(404).json({ error: "Message not found" });

      const myId = Number(req.user.id);
      const isSender = myId === Number(message.senderId);
      if (!isSender) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await message.update({ content: String(newContent).trim() });
      const upd = await Message.findByPk(messageId, {
        include: [
          {
            model: Message,
            as: "replyTo",
            include: [
              {
                model: User,
                as: "sender",
                attributes: ["id", "name", "mobile", "role"],
              },
            ],
          },
        ],
      });
      io.emit("message_updated", upd);
      res.json({ success: true });
    } catch (e) {
      console.error("Edit Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // --- OTHER ROUTES ---
  server.get("/api/lessons", async (req, res) => {
    // Sort by orderIndex ASC, then createdAt DESC as fallback
    const list = await Lesson.findAll({
      order: [
        ["orderIndex", "ASC"],
        ["createdAt", "DESC"],
      ],
    });
    res.json(list);
  });
  server.post("/api/lessons", async (req, res) => {
    try {
      const { name, type, price, batches, month, parentId } = req.body; // <--- Extract parentId

      await Lesson.create({
        name,
        type,
        price,
        batches: JSON.stringify(batches || []),
        month,
        parentId: parentId || null, // <--- Save it!
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  server.put("/api/lessons/:id", async (req, res) => {
    try {
      const data = { ...req.body };
      if (data.batches) data.batches = JSON.stringify(data.batches);
      await Lesson.update(data, { where: { id: req.params.id } });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ message: "Error" });
    }
  });
  server.delete("/api/lessons/:id", async (req, res) => {
    await Content.destroy({ where: { lessonId: req.params.id } });
    await Lesson.destroy({ where: { id: req.params.id } });
    res.json({ success: true });
  });

  // ✅ 1. BULK DELETE ROUTE (Folders & Videos)
  server.post("/api/bulk-delete", async (req, res) => {
    try {
      const { folderIds, videoIds } = req.body;

      // Delete the selected videos
      if (videoIds && videoIds.length > 0) {
        await Content.destroy({ where: { id: { [Op.in]: videoIds } } });
      }

      // Delete the selected folders AND all videos inside them
      if (folderIds && folderIds.length > 0) {
        await Content.destroy({ where: { lessonId: { [Op.in]: folderIds } } });
        await Lesson.destroy({ where: { id: { [Op.in]: folderIds } } });
      }

      io.emit("content_updated"); // Refresh everyone's screen
      res.json({ success: true });
    } catch (e) {
      console.error("Bulk Delete Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ✅ 2. PASTE / MOVE ITEMS ROUTE
  server.post("/api/paste-items", async (req, res) => {
    try {
      const { targetParentId, itemsToPaste } = req.body;
      const { folders, videos } = itemsToPaste;

      // Move Folders to the new parent directory
      if (folders && folders.length > 0) {
        await Lesson.update(
          { parentId: targetParentId },
          { where: { id: { [Op.in]: folders } } },
        );
      }

      // Move Videos to the new folder
      if (videos && videos.length > 0) {
        await Content.update(
          { lessonId: targetParentId },
          { where: { id: { [Op.in]: videos } } },
        );
      }

      io.emit("content_updated");
      res.json({ success: true });
    } catch (e) {
      console.error("Paste Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  server.post("/api/lessons/reorder", async (req, res) => {
    try {
      const { items } = req.body; // Expects array of { id, orderIndex }

      // Bulk update is efficient
      const promises = items.map((item, index) =>
        Lesson.update({ orderIndex: index }, { where: { id: item.id } }),
      );

      await Promise.all(promises);

      // Notify clients to refresh
      io.emit("content_updated");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  const toBoolean = (value) =>
    value === true || value === "true" || value === 1 || value === "1";

  const parseScheduleDate = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date;
  };

  const isWithinScheduleWindow = (startTime, endTime, nowMs = Date.now()) => {
    if (!startTime || !endTime) return false;
    const startMs = new Date(startTime).getTime();
    const endMs = new Date(endTime).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return false;
    return nowMs >= startMs && nowMs < endMs;
  };

  const normalizeLiveSchedulePayload = (payload) => {
    const scheduleEnabled = toBoolean(payload?.scheduleEnabled);
    if (!scheduleEnabled) {
      return {
        scheduleEnabled: false,
        startTime: null,
        endTime: null,
        shouldBeLive: false,
      };
    }

    const startTime = parseScheduleDate(payload?.startTime);
    const endTime = parseScheduleDate(payload?.endTime);

    if (!startTime || !endTime) {
      return { error: "Schedule requires both start and end time." };
    }

    if (startTime.getTime() >= endTime.getTime()) {
      return { error: "End time must be after start time." };
    }

    return {
      scheduleEnabled: true,
      startTime,
      endTime,
      shouldBeLive: isWithinScheduleWindow(startTime, endTime),
    };
  };

  const normalizeAudienceMode = (value) => {
    const mode = String(value || "all")
      .trim()
      .toLowerCase();
    if (mode === "online") return "online";
    if (mode === "city") return "city";
    return "all";
  };

  const normalizeAudienceCity = (value) => String(value || "").trim();

  const normalizeLiveAudiencePayload = (payload, existing = null) => {
    const modeSource = payload?.audienceMode ?? existing?.audienceMode ?? "all";
    const audienceMode = normalizeAudienceMode(modeSource);
    const rawCity = payload?.audienceCity ?? existing?.audienceCity ?? "";
    const audienceCity = normalizeAudienceCity(rawCity);

    if (audienceMode === "city" && !audienceCity) {
      return { error: "Select a Hall Class city for physical audience." };
    }

    return {
      audienceMode,
      audienceCity: audienceMode === "city" ? audienceCity : null,
    };
  };

  const normalizeLiveLockPayload = (
    payload,
    scheduleEnabled,
    existing = null,
  ) => {
    if (!scheduleEnabled) {
      return { lockAfterEnd: false, lockPrice: null };
    }

    const lockAfterEnd = toBoolean(
      payload?.lockAfterEnd ?? existing?.lockAfterEnd ?? false,
    );
    const rawPrice = payload?.lockPrice ?? existing?.lockPrice ?? "";
    const lockPrice = String(rawPrice || "").trim();

    if (lockAfterEnd) {
      const priceNum = Number(lockPrice);
      if (!lockPrice || !Number.isFinite(priceNum) || priceNum <= 0) {
        return { error: "Lock price must be greater than 0." };
      }
    }

    return {
      lockAfterEnd,
      lockPrice: lockAfterEnd ? lockPrice : null,
    };
  };

  const filterRecipientsByAudience = (students, content, options = {}) => {
    const mode = normalizeAudienceMode(content?.audienceMode);
    const city = normalizeAudienceCity(content?.audienceCity);
    let list = Array.isArray(students) ? students : [];

    if (mode === "online") {
      list = list.filter(
        (student) =>
          String(student.classMode || "")
            .trim()
            .toLowerCase() === "online",
      );
    }

    if (mode === "city") {
      const targetCity = city.toLowerCase();
      list = list.filter((student) => {
        const studentMode = String(student.classMode || "")
          .trim()
          .toLowerCase();
        const hallClass = String(student.hallClass || "")
          .trim()
          .toLowerCase();
        return studentMode === "physical" && hallClass === targetCity;
      });
    }

    if (options.onlyOffline) {
      list = list.filter((student) => !onlineUsers.has(String(student.id)));
    }

    return list;
  };

  const resolveLiveLabel = async (content) => {
    try {
      if (!content) return "Live session";
      if (content.lessonId) {
        const lesson = await Lesson.findByPk(content.lessonId);
        const label = String(
          lesson?.name || content.title || "Live session",
        ).trim();
        return label || "Live session";
      }
      const label = String(content.title || "Live session").trim();
      return label || "Live session";
    } catch (e) {
      const fallback = String(content?.title || "Live session").trim();
      return fallback || "Live session";
    }
  };

  const notifyLiveVideoStarted = async (content, batchNames, options = {}) => {
    try {
      if (!content || !batchNames || batchNames.length === 0) return;

      const safeBatches = batchNames.filter(Boolean);
      let whereCondition = { role: "student" };
      const dashboardUrl =
        process.env.STUDENT_DASHBOARD_URL ||
        "https://sftking.lk/student/dashboard";
      const onlyOffline = options?.onlyOffline === true;

      if (!safeBatches.includes("All")) {
        whereCondition.batch = { [Op.in]: safeBatches };
      }

      const students = await User.findAll({ where: whereCondition });
      if (!students || students.length === 0) return;

      const liveLabel = await resolveLiveLabel(content);
      const recipients = filterRecipientsByAudience(students, content, {
        onlyOffline,
      });

      if (!recipients.length) return;

      const studentIds = recipients.map((s) => s.id);

      const pushPayload = {
        title: "🔴 Live Session Started!",
        body: `${liveLabel} is now LIVE! Tap to join.`,
        url: "/student/dashboard",
        type: "live_video_started",
        senderId: "system",
        messageId: `live-${content.id || Date.now()}`,
      };

      try {
        if (studentIds.length > 0) {
          await sendPushNotificationToUsers(studentIds, pushPayload);
        }
      } catch (e) {
        console.error("Live video push notification failed:", e);
      }

      const emails = recipients
        .map((s) =>
          String(s.email || "")
            .trim()
            .toLowerCase(),
        )
        .filter(isValidEmail);
      if (emails.length > 0) {
        const transporter = getMailTransporter();
        const from =
          process.env.EMAIL_FROM ||
          process.env.SMTP_USER ||
          process.env.GMAIL_USER;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 20px; border-radius: 10px;">
            <h2 style="color: #e53e3e;">🔴 Live Session Started!</h2>
            <p style="font-size: 16px; color: #374151;">Hello!</p>
            <p style="font-size: 16px; color: #374151;">The live session <strong>${liveLabel}</strong> is now live on your dashboard.</p>
            <p style="text-align: center; margin-top: 30px;">
              <a href="${dashboardUrl}" style="background-color: #e53e3e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Go to Dashboard</a>
            </p>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 40px; text-align: center;">This is an automated message from SFT King.</p>
          </div>
        `;

        emails.forEach((to) => {
          transporter
            .sendMail({
              from,
              to,
              subject: "🔴 Live Session Started!",
              html,
              text: `The live session ${liveLabel} is now live on your dashboard. Go to ${dashboardUrl} to join!`,
            })
            .catch((err) =>
              console.error("Live video email failed for:", to, err),
            );
        });
      }
    } catch (e) {
      console.error("Error in notifyLiveVideoStarted:", e);
    }
  };

  const notifyLiveVideoScheduled = async (content, batchNames) => {
    try {
      if (!content || !batchNames || batchNames.length === 0) return;
      if (!content.startTime) return;

      const safeBatches = batchNames.filter(Boolean);
      let whereCondition = { role: "student" };
      const dashboardUrl =
        process.env.STUDENT_DASHBOARD_URL ||
        "https://sftking.lk/student/dashboard";

      if (!safeBatches.includes("All")) {
        whereCondition.batch = { [Op.in]: safeBatches };
      }

      const students = await User.findAll({ where: whereCondition });
      if (!students || students.length === 0) return;

      const liveLabel = await resolveLiveLabel(content);
      const recipients = filterRecipientsByAudience(students, content);
      if (!recipients.length) return;

      const startLabel = formatSriLankaDateTime(content.startTime);

      const studentIds = recipients.map((s) => s.id);

      const pushPayload = {
        title: "Live session scheduled",
        body: `${liveLabel} will start at ${startLabel}`,
        url: "/student/dashboard",
        type: "live_video_scheduled",
        senderId: "system",
        messageId: `live-scheduled-${content.id || Date.now()}`,
      };

      try {
        if (studentIds.length > 0) {
          await sendPushNotificationToUsers(studentIds, pushPayload);
        }
      } catch (e) {
        console.error("Live video schedule push notification failed:", e);
      }

      const emails = recipients
        .map((s) =>
          String(s.email || "")
            .trim()
            .toLowerCase(),
        )
        .filter(isValidEmail);
      if (emails.length > 0) {
        const transporter = getMailTransporter();
        const from =
          process.env.EMAIL_FROM ||
          process.env.SMTP_USER ||
          process.env.GMAIL_USER;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9fafb; padding: 20px; border-radius: 10px;">
            <h2 style="color: #e53e3e;">⏰ Live Session Scheduled</h2>
            <p style="font-size: 16px; color: #374151;">Hello!</p>
            <p style="font-size: 16px; color: #374151;">The live session <strong>${liveLabel}</strong> will start at <strong>${startLabel}</strong>.</p>
            <p style="text-align: center; margin-top: 30px;">
              <a href="${dashboardUrl}" style="background-color: #e53e3e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Open Dashboard</a>
            </p>
            <p style="font-size: 12px; color: #9ca3af; margin-top: 40px; text-align: center;">This is an automated message from SFT King.</p>
          </div>
        `;

        emails.forEach((to) => {
          transporter
            .sendMail({
              from,
              to,
              subject: "Live session scheduled",
              html,
              text: `The live session ${liveLabel} will start at ${startLabel}. Open ${dashboardUrl}`,
            })
            .catch((err) =>
              console.error("Live video schedule email failed for:", to, err),
            );
        });
      }
    } catch (e) {
      console.error("Error in notifyLiveVideoScheduled:", e);
    }
  };

  const LIVE_SCHEDULE_TICK_MS = 30000;
  setInterval(async () => {
    try {
      const scheduled = await Content.findAll({
        where: {
          type: "Live",
          scheduleEnabled: true,
          startTime: { [Op.ne]: null },
          endTime: { [Op.ne]: null },
        },
      });

      if (!scheduled.length) return;

      const nowMs = Date.now();
      let didUpdate = false;

      for (const content of scheduled) {
        const shouldBeLive = isWithinScheduleWindow(
          content.startTime,
          content.endTime,
          nowMs,
        );
        const endMs = content.endTime
          ? new Date(content.endTime).getTime()
          : NaN;
        const hasEnded = Number.isFinite(endMs) && nowMs >= endMs;
        const updatePayload = {};

        if (shouldBeLive && !content.isStreamActive) {
          updatePayload.isStreamActive = true;
        }

        if (!shouldBeLive && content.isStreamActive) {
          updatePayload.isStreamActive = false;
        }

        if (hasEnded && content.lockAfterEnd) {
          const lockPrice = String(content.lockPrice || "").trim();
          if (
            !content.isSeparate ||
            (lockPrice && String(content.price || "").trim() !== lockPrice)
          ) {
            updatePayload.isSeparate = true;
            if (lockPrice) updatePayload.price = lockPrice;
          }
        }

        if (Object.keys(updatePayload).length > 0) {
          await content.update(updatePayload);
          didUpdate = true;
        }

        if (updatePayload.isStreamActive) {
          const batchNames = content.batch ? [content.batch] : ["All"];
          notifyLiveVideoStarted(content, batchNames, { onlyOffline: true });
        }
      }

      if (didUpdate) {
        io.emit("content_updated");
      }
    } catch (e) {
      console.error("Live schedule tick error:", e?.message || e);
    }
  }, LIVE_SCHEDULE_TICK_MS);

  server.post("/api/content", async (req, res) => {
    try {
      const { batches, ...data } = req.body;
      let createdContent = null;
      let safeBatches = [];
      const isLiveContent = String(data.type || "").toLowerCase() === "live";
      let shouldNotifyScheduled = false;

      if (isLiveContent) {
        const schedule = normalizeLiveSchedulePayload(data);
        if (schedule.error) {
          return res.status(400).json({ error: schedule.error });
        }

        const audience = normalizeLiveAudiencePayload(data);
        if (audience.error) {
          return res.status(400).json({ error: audience.error });
        }
        data.audienceMode = audience.audienceMode;
        data.audienceCity = audience.audienceCity;

        const lockPayload = normalizeLiveLockPayload(
          data,
          schedule.scheduleEnabled,
        );
        if (lockPayload.error) {
          return res.status(400).json({ error: lockPayload.error });
        }
        data.lockAfterEnd = lockPayload.lockAfterEnd;
        data.lockPrice = lockPayload.lockPrice;

        if (schedule.scheduleEnabled) {
          data.scheduleEnabled = true;
          data.startTime = schedule.startTime;
          data.endTime = schedule.endTime;
          data.isStreamActive = schedule.shouldBeLive;
          const startMs = schedule.startTime
            ? schedule.startTime.getTime()
            : NaN;
          shouldNotifyScheduled =
            Number.isFinite(startMs) && startMs > Date.now();
        } else {
          data.scheduleEnabled = false;
          data.startTime = null;
          data.endTime = null;
        }
      } else {
        data.scheduleEnabled = false;
        data.startTime = null;
        data.endTime = null;
        data.audienceMode = "all";
        data.audienceCity = null;
        data.lockAfterEnd = false;
        data.lockPrice = null;
      }

      if (Array.isArray(batches)) {
        safeBatches = batches;
        for (const batchName of batches) {
          createdContent = await Content.create({ ...data, batch: batchName });
        }
      } else {
        safeBatches = [batches];
        createdContent = await Content.create({ ...data, batch: batches });
      }

      if (data.isStreamActive && createdContent) {
        notifyLiveVideoStarted(createdContent, safeBatches);
      }

      if (
        isLiveContent &&
        data.scheduleEnabled &&
        createdContent &&
        shouldNotifyScheduled
      ) {
        notifyLiveVideoScheduled(createdContent, safeBatches);
      }

      io.emit("content_updated");
      res.json({ success: true });
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  });
  server.get(
    "/api/content/all",
    async (req, res) =>
      res.json(await Content.findAll({ order: [["title", "ASC"]] })), // ✅ Sorts A-Z
  );
  server.delete("/api/content/:id", async (req, res) => {
    await Content.destroy({ where: { id: req.params.id } });
    io.emit("content_updated");
    res.json({ success: true });
  });
  server.put("/api/content/:id", async (req, res) => {
    try {
      const { batches, ...data } = req.body;
      const existing = await Content.findByPk(req.params.id);

      if (!existing) {
        return res.status(404).json({ error: "Content not found" });
      }

      if (Array.isArray(batches) && batches.length > 0) {
        const selectedBatches = batches.filter(Boolean);
        data.batch =
          selectedBatches.includes("All") || selectedBatches.length > 1
            ? "All"
            : selectedBatches[0];
      } else if (typeof data.batch === "undefined") {
        data.batch = existing.batch;
      }

      const isLiveContent =
        String(data.type || existing.type || "").toLowerCase() === "live";
      let shouldNotifyScheduled = false;
      if (isLiveContent) {
        const schedule = normalizeLiveSchedulePayload(data);
        if (schedule.error) {
          return res.status(400).json({ error: schedule.error });
        }

        const audience = normalizeLiveAudiencePayload(data, existing);
        if (audience.error) {
          return res.status(400).json({ error: audience.error });
        }
        data.audienceMode = audience.audienceMode;
        data.audienceCity = audience.audienceCity;

        const lockPayload = normalizeLiveLockPayload(
          data,
          schedule.scheduleEnabled,
          existing,
        );
        if (lockPayload.error) {
          return res.status(400).json({ error: lockPayload.error });
        }
        data.lockAfterEnd = lockPayload.lockAfterEnd;
        data.lockPrice = lockPayload.lockPrice;

        if (schedule.scheduleEnabled) {
          const prevStartMs = existing.startTime
            ? new Date(existing.startTime).getTime()
            : NaN;
          const prevEndMs = existing.endTime
            ? new Date(existing.endTime).getTime()
            : NaN;
          const nextStartMs = schedule.startTime
            ? schedule.startTime.getTime()
            : NaN;
          const nextEndMs = schedule.endTime ? schedule.endTime.getTime() : NaN;
          const scheduleChanged =
            !existing.scheduleEnabled ||
            prevStartMs !== nextStartMs ||
            prevEndMs !== nextEndMs;

          const audienceChanged =
            String(existing.audienceMode || "all") !==
              String(audience.audienceMode || "all") ||
            String(existing.audienceCity || "") !==
              String(audience.audienceCity || "");

          shouldNotifyScheduled =
            Number.isFinite(nextStartMs) &&
            nextStartMs > Date.now() &&
            (scheduleChanged ||
              audienceChanged ||
              typeof batches !== "undefined");

          data.scheduleEnabled = true;
          data.startTime = schedule.startTime;
          data.endTime = schedule.endTime;
          data.isStreamActive = schedule.shouldBeLive;
        } else {
          data.scheduleEnabled = false;
          data.startTime = null;
          data.endTime = null;
        }
      } else {
        data.scheduleEnabled = false;
        data.startTime = null;
        data.endTime = null;
        data.audienceMode = "all";
        data.audienceCity = null;
        data.lockAfterEnd = false;
        data.lockPrice = null;
      }

      // Simply update the single row with the provided data
      // Don't try to handle batches in the update - let frontend handle batch changes
      await Content.update(data, { where: { id: req.params.id } });

      if (!existing.isStreamActive && data.isStreamActive) {
        const updatedContent = await Content.findByPk(req.params.id);
        const batchArr =
          Array.isArray(batches) && batches.length > 0
            ? batches
            : [updatedContent.batch];
        notifyLiveVideoStarted(updatedContent, batchArr);
      }

      if (shouldNotifyScheduled) {
        const updatedContent = await Content.findByPk(req.params.id);
        if (updatedContent) {
          const batchArr =
            Array.isArray(batches) && batches.length > 0
              ? batches
              : [updatedContent.batch];
          notifyLiveVideoScheduled(updatedContent, batchArr);
        }
      }

      io.emit("content_updated");
      res.json({ success: true });
    } catch (e) {
      console.error("Content Update Error:", e);
      res.status(400).json({ error: e.message });
    }
  });

  server.get("/api/student/content", verifyToken, async (req, res) => {
    try {
      const studentId = req.user.id;

      // 1. FETCH USER TO GET REAL BATCH (Fixes the 500 Error)
      const student = await User.findByPk(studentId);
      if (!student) return res.status(404).json({ error: "Student not found" });
      const userBatch = student.batch; // Get "2026 A/L" etc.
      const normalizedUserBatch = String(userBatch || "")
        .trim()
        .toLowerCase();
      const normalizedStudentMode = String(student.classMode || "")
        .trim()
        .toLowerCase();
      const normalizedStudentCity = String(student.hallClass || "")
        .trim()
        .toLowerCase();

      const isLiveContent = (content) => {
        const typeLabel = String(content?.type || "")
          .trim()
          .toLowerCase();
        return (
          typeLabel === "live" ||
          content?.scheduleEnabled ||
          content?.isStreamActive
        );
      };

      const matchesAudience = (content) => {
        const mode = normalizeAudienceMode(content?.audienceMode);
        if (mode === "online") {
          return normalizedStudentMode === "online";
        }
        if (mode === "city") {
          const targetCity = normalizeAudienceCity(
            content?.audienceCity,
          ).toLowerCase();
          if (!targetCity) return false;
          return (
            normalizedStudentMode === "physical" &&
            normalizedStudentCity === targetCity
          );
        }
        return true;
      };

      const allLessons = await Lesson.findAll({
        order: [
          ["orderIndex", "ASC"],
          ["createdAt", "DESC"],
        ],
      });

      // 2. FILTER FOLDERS
      const visibleLessons = allLessons.filter((l) => {
        let batchList = [];
        try {
          // Safely parse JSON
          batchList =
            typeof l.batches === "string" ? JSON.parse(l.batches) : l.batches;
        } catch (e) {
          batchList = [];
        }

        // Ensure it's an array
        if (!Array.isArray(batchList)) batchList = [];
        const normalizedBatchList = batchList
          .map((b) =>
            String(b || "")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean);

        // Show if: Empty (Legacy), "All" (New feature), or Matches Student Batch
        return (
          normalizedBatchList.length === 0 ||
          normalizedBatchList.includes("all") ||
          normalizedBatchList.includes(normalizedUserBatch)
        );
      });

      const visibleLessonIds = visibleLessons.map((l) => l.id);

      // 3. FILTER VIDEOS
      const allContentRows = await Content.findAll({
        where: {
          [Op.or]: [
            { lessonId: { [Op.in]: visibleLessonIds } },
            { isStreamActive: true },
          ],
        },
        // ✅ FIX: Sort by Title A-Z (01, 02, 03...)
        order: [["title", "ASC"]],
      });

      const allContent = allContentRows.filter((c) => {
        if (c.batch == null) return true;
        const normalizedBatch = String(c.batch).trim().toLowerCase();
        if (!normalizedBatch) return true;
        if (
          !(
            normalizedBatch === "all" || normalizedBatch === normalizedUserBatch
          )
        )
          return false;

        if (isLiveContent(c) && !matchesAudience(c)) return false;

        return true;
      });

      // 4. CHECK PAYMENTS
      const approvedRequests = await Request.findAll({
        where: { studentId, status: "approved" },
      });
      const paidLessonIds = approvedRequests
        .map((r) => r.lessonId)
        .filter((id) => id);
      const paidContentIds = approvedRequests
        .map((r) => r.contentId)
        .filter((id) => id);

      const data = allContent.map((c) => {
        const isFreeVideo = !c.price || c.price === "0";

        let isPaid = false;

        if (c.isSeparate) {
          isPaid = isFreeVideo || paidContentIds.includes(c.id);
        } else {
          const parent = visibleLessons.find((l) => l.id === c.lessonId);
          const isParentFree =
            parent && (!parent.price || parent.price === "0");
          const isParentPaid = paidLessonIds.includes(c.lessonId);
          isPaid = isParentFree || isParentPaid;
        }

        const json = c.toJSON();

        // hide PDF if admin disabled it
        if (json.pdfVisible === false) {
          json.pdfFile = null;
        }

        // NEVER leak protected values to students
        delete json.zoomId;
        delete json.zoomPasscode;
        delete json.recordingLink;

        return {
          ...json,
          hasRecording: !!c.recordingLink,
          isPaid,
        };
      });

      res.json({
        lessons: visibleLessons.map((l) => ({
          ...l.toJSON(),
          isPaid: !l.price || l.price === "0" || paidLessonIds.includes(l.id),
        })),
        content: data,
      });
    } catch (err) {
      console.error(err); // Log error to terminal
      res.status(500).json({ error: err.message });
    }
  });

  server.get("/api/student/next-exam", verifyToken, async (req, res) => {
    try {
      const student = await User.findByPk(req.user.id, {
        attributes: ["id", "role", "batch"],
      });

      if (!student || student.role !== "student") {
        return res.status(403).json({ error: "Forbidden" });
      }

      const normalizedStudentBatch = String(student.batch || "")
        .trim()
        .toLowerCase();
      const now = Date.now();

      const [mcqQuizzes, writtenQuizzes] = await Promise.all([
        McqQuiz.findAll({
          attributes: [
            "id",
            "title",
            "startTime",
            "endTime",
            "status",
            "batches",
            "readyTime",
            "timeLimit",
          ],
          where: { status: { [Op.in]: ["scheduled", "live"] } },
          order: [["startTime", "ASC"]],
        }),
        WrittenQuiz.findAll({
          attributes: [
            "id",
            "title",
            "startTime",
            "endTime",
            "status",
            "batches",
            "readyTime",
            "timeLimit",
          ],
          where: { status: { [Op.in]: ["scheduled", "live"] } },
          order: [["startTime", "ASC"]],
        }),
      ]);

      const mapCandidate = (quiz, type) => {
        const startMs = quiz?.startTime
          ? new Date(quiz.startTime).getTime()
          : NaN;
        if (!Number.isFinite(startMs)) return null;

        const readyMinutes = Number(quiz?.readyTime || 0) || 0;
        const timeLimitMinutes = Number(quiz?.timeLimit || 60) || 60;
        const readyEndMs = startMs + readyMinutes * 60000;
        const computedEndMs = readyEndMs + timeLimitMinutes * 60000;
        const explicitEndMs = quiz?.endTime
          ? new Date(quiz.endTime).getTime()
          : NaN;
        const examEndMs = Number.isFinite(explicitEndMs)
          ? explicitEndMs
          : computedEndMs;
        if (!Number.isFinite(examEndMs) || now >= examEndMs) return null;

        const targetBatches = parseBatchTargets(quiz.batches)
          .map((batch) =>
            String(batch || "")
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean);

        const isAllBatches = targetBatches.includes("all");
        const isVisibleForStudent =
          isAllBatches ||
          (normalizedStudentBatch &&
            targetBatches.includes(normalizedStudentBatch));
        if (!isVisibleForStudent) return null;

        let countdownLabel = "Start in";
        let countdownTargetMs = startMs;
        let phasePriority = 1;

        if (now >= startMs && now < readyEndMs && readyMinutes > 0) {
          countdownLabel = "Waiting...";
          countdownTargetMs = readyEndMs;
          phasePriority = 0;
        } else if (now >= readyEndMs && now < examEndMs) {
          countdownLabel = "Exam Started";
          countdownTargetMs = examEndMs;
          phasePriority = 0;
        }

        return {
          id: quiz.id,
          title: quiz.title,
          type,
          startTime: quiz.startTime,
          countdownTargetTime: new Date(countdownTargetMs).toISOString(),
          countdownLabel,
          endTime: quiz.endTime,
          status: quiz.status,
          readyTime: readyMinutes,
          timeLimit: timeLimitMinutes,
          examEndTime: new Date(examEndMs).toISOString(),
          startMs,
          countdownTargetMs,
          phasePriority,
        };
      };

      const candidates = [
        ...mcqQuizzes.map((quiz) => mapCandidate(quiz, "mcq")),
        ...writtenQuizzes.map((quiz) => mapCandidate(quiz, "written")),
      ]
        .filter(Boolean)
        .sort((a, b) => {
          if (a.phasePriority !== b.phasePriority)
            return a.phasePriority - b.phasePriority;
          return a.countdownTargetMs - b.countdownTargetMs;
        });

      const nextExam = candidates.length > 0 ? candidates[0] : null;
      res.json({ nextExam });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  server.post("/api/content/end-stream", async (req, res) => {
    try {
      const { id } = req.body;
      // Mark as inactive so it leaves the dashboard
      await Content.update({ isStreamActive: false }, { where: { id } });
      io.emit("content_updated"); // Refresh everyone
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  server.get(
    "/api/student/zoom-secrets/:contentId",
    verifyToken,
    async (req, res) => {
      try {
        const studentId = req.user.id;
        const contentId = req.params.contentId;

        const content = await Content.findByPk(contentId);
        if (!content || !content.zoomId) {
          return res.status(404).json({ message: "No Zoom meeting attached." });
        }

        if (!content.zoomVisible) {
          return res
            .status(403)
            .json({ message: "Zoom session is currently hidden." });
        }

        if (!content.zoomPasscode) {
          return res
            .status(500)
            .json({ message: "Zoom passcode is missing for this class." });
        }

        const isFreeVideo = !content.price || content.price === "0";
        let hasAccess = false;

        if (content.isSeparate) {
          if (isFreeVideo) {
            hasAccess = true;
          } else {
            const approved = await Request.findOne({
              where: { studentId, contentId, status: "approved" },
            });
            hasAccess = !!approved;
          }
        } else {
          const lesson = await Lesson.findByPk(content.lessonId);
          const isParentFree =
            lesson && (!lesson.price || lesson.price === "0");

          const approved = await Request.findOne({
            where: {
              studentId,
              lessonId: content.lessonId,
              status: "approved",
            },
          });

          hasAccess = isParentFree || !!approved;
        }

        if (!hasAccess) {
          await SecurityLog.create({
            event: "ZOOM THEFT ATTEMPT",
            description: "Student tried to fetch Zoom keys without payment!",
            ip_address: req.ip || req.connection.remoteAddress,
            user_id: String(studentId),
            severity: "high",
          });

          return res
            .status(403)
            .json({ message: "Access Denied. Payment required." });
        }

        console.log("ZOOM SECRET DEBUG", {
          studentId,
          contentId,
          zoomId: content.zoomId,
          zoomPasscodePresent: !!content.zoomPasscode,
          zoomVisible: content.zoomVisible,
          hasAccess,
        });

        return res.json({
          success: true,
          title: content.title,
          zoomId: content.zoomId,
          zoomPasscode: content.zoomPasscode,
        });
      } catch (e) {
        console.error("Zoom Handshake Error:", e);
        return res
          .status(500)
          .json({ message: "Server error generating handshake." });
      }
    },
  );

  server.post("/api/student/zoom-signature", verifyToken, async (req, res) => {
    try {
      const rawMeetingNumber = req.body.meetingNumber;
      const meetingNumber = String(rawMeetingNumber || "").replace(
        /[\s-]/g,
        "",
      );

      if (!meetingNumber || !/^\d+$/.test(meetingNumber)) {
        return res
          .status(400)
          .json({ message: "Valid meeting number required" });
      }

      const sdkKey = process.env.ZOOM_SDK_CLIENT_ID;
      const sdkSecret = process.env.ZOOM_SDK_CLIENT_SECRET;

      if (!sdkKey || !sdkSecret) {
        return res
          .status(500)
          .json({ message: "Zoom SDK credentials missing on server" });
      }

      const iat = Math.floor(Date.now() / 1000) - 30;
      const exp = iat + 60 * 60 * 2;

      const payload = {
        sdkKey,
        mn: meetingNumber,
        role: 0,
        iat,
        exp,
        tokenExp: exp,
        appKey: sdkKey,
      };

      const signature = jwt.sign(payload, sdkSecret, { algorithm: "HS256" });

      console.log("ZOOM SIGN DEBUG", {
        meetingNumber,
        sdkKeyPrefix: sdkKey.slice(0, 6),
        hasSecret: !!sdkSecret,
      });

      return res.json({ signature });
    } catch (e) {
      console.error("Zoom Signature Error:", e);
      return res
        .status(500)
        .json({ message: "Failed to generate Zoom signature." });
    }
  });

  // 🚀 PHASE 5: SECURE ZOOM RECORDING ENDPOINT
  const normalizeShareUrl = (url = "") =>
    String(url).trim().split("?")[0].replace(/\/$/, "").toLowerCase();
  const isZoomShareLink = (url = "") =>
    /(^https?:\/\/)?([a-z0-9-]+\.)?zoom\.us\/rec\/share\//i.test(String(url));
  const isDirectVideoLink = (url = "") =>
    /\.(mp4|m3u8)(\?|#|$)/i.test(String(url));
  const isRecordingDebugEnabled = () =>
    String(process.env.RECORDING_DEBUG || "false").toLowerCase() === "true";
  const withRecordingDebug = (payload, reason, extra = {}) =>
    isRecordingDebugEnabled()
      ? { ...payload, debugReason: reason, ...extra }
      : payload;

  const createRecordingStreamToken = (studentId, contentId) => {
    return jwt.sign(
      { id: studentId, contentId, purpose: "secure_recording_stream" },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "2h" },
    );
  };

  const zoomRecordingCache = new Map();

  const getZoomS2SToken = async () => {
    const accountId = process.env.ZOOM_ACCOUNT_ID;
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;
    if (!accountId || !clientId || !clientSecret) {
      throw new Error(
        "Missing Zoom Server-to-Server OAuth env vars (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET)",
      );
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString(
      "base64",
    );
    const tokenRes = await axios.post(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
      null,
      { headers: { Authorization: `Basic ${basicAuth}` } },
    );

    const accessToken = tokenRes?.data?.access_token;
    if (!accessToken) throw new Error("Failed to obtain Zoom access token");
    return accessToken;
  };

  const resolveZoomShareToFile = async (shareUrl) => {
    const normalized = normalizeShareUrl(shareUrl);
    const cached = zoomRecordingCache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) return cached.data;

    const token = await getZoomS2SToken();

    const resolveFromMeetings = (meetings = []) => {
      const matchedMeeting = meetings.find(
        (m) => normalizeShareUrl(m?.share_url) === normalized,
      );
      if (!matchedMeeting) return null;

      const files = matchedMeeting.recording_files || [];
      const completed = files.filter((f) => f.status === "completed");
      const preferredVideo =
        completed.find(
          (f) => String(f.file_type || "").toUpperCase() === "MP4",
        ) ||
        completed.find((f) =>
          String(f.recording_type || "")
            .toLowerCase()
            .includes("shared_screen_with_speaker_view"),
        ) ||
        completed.find((f) =>
          String(f.recording_type || "")
            .toLowerCase()
            .includes("speaker_view"),
        ) ||
        completed.find((f) =>
          String(f.recording_type || "")
            .toLowerCase()
            .includes("gallery_view"),
        );

      if (!preferredVideo) {
        throw new Error(
          "No completed MP4/video recording file found for this Zoom share link",
        );
      }

      const fileUrl =
        preferredVideo.download_url ||
        preferredVideo.play_url ||
        preferredVideo.file_url;
      if (!fileUrl)
        throw new Error("No playable recording URL in Zoom API response");

      return {
        fileUrl,
        token,
        authMode: preferredVideo.download_url ? "query" : "header",
      };
    };

    // Attempt 1: single-user scope (fast path)
    {
      let nextPageToken = "";
      for (let page = 0; page < 10; page++) {
        const recRes = await axios.get(
          "https://api.zoom.us/v2/users/me/recordings",
          {
            headers: { Authorization: `Bearer ${token}` },
            params: { page_size: 100, next_page_token: nextPageToken },
          },
        );

        const resolved = resolveFromMeetings(recRes?.data?.meetings || []);
        if (resolved) {
          zoomRecordingCache.set(normalized, {
            data: resolved,
            expiresAt: Date.now() + 10 * 60 * 1000,
          });
          return resolved;
        }

        nextPageToken = recRes?.data?.next_page_token || "";
        if (!nextPageToken) break;
      }
    }

    // Attempt 2: account-wide scan (recording may belong to another Zoom user in same account)
    {
      let usersPageToken = "";
      for (let userPage = 0; userPage < 10; userPage++) {
        const usersRes = await axios.get("https://api.zoom.us/v2/users", {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            page_size: 100,
            next_page_token: usersPageToken,
            status: "active",
          },
        });

        const users = usersRes?.data?.users || [];
        for (const u of users) {
          let recPageToken = "";
          for (let recPage = 0; recPage < 10; recPage++) {
            const recRes = await axios.get(
              `https://api.zoom.us/v2/users/${encodeURIComponent(u.id)}/recordings`,
              {
                headers: { Authorization: `Bearer ${token}` },
                params: { page_size: 100, next_page_token: recPageToken },
              },
            );

            const resolved = resolveFromMeetings(recRes?.data?.meetings || []);
            if (resolved) {
              zoomRecordingCache.set(normalized, {
                data: resolved,
                expiresAt: Date.now() + 10 * 60 * 1000,
              });
              return resolved;
            }

            recPageToken = recRes?.data?.next_page_token || "";
            if (!recPageToken) break;
          }
        }

        usersPageToken = usersRes?.data?.next_page_token || "";
        if (!usersPageToken) break;
      }
    }

    throw new Error(
      "Zoom share link could not be resolved via Zoom API. Ensure it belongs to this Zoom account.",
    );
  };

  server.get(
    "/api/student/zoom-recording/:contentId",
    verifyToken,
    async (req, res) => {
      try {
        const studentId = req.user.id;
        const contentId = req.params.contentId;

        const content = await Content.findByPk(contentId);
        if (!content) {
          return res.status(404).json(
            withRecordingDebug(
              {
                success: false,
                message: "Recording not found or has been deleted",
              },
              "content_not_found",
              { contentId },
            ),
          );
        }
        if (!content.recordingVisible) {
          return res.status(404).json(
            withRecordingDebug(
              {
                success: false,
                message: "Recording is hidden by admin",
              },
              "recording_hidden_by_admin",
              { contentId },
            ),
          );
        }
        if (!content.recordingLink) {
          return res.status(404).json(
            withRecordingDebug(
              {
                success: false,
                message: "Recording link is missing",
              },
              "recording_link_missing",
              { contentId },
            ),
          );
        }

        // 1. Is the video inherently free?
        const isFreeVideo = !content.price || content.price === "0";
        let hasAccess = false;

        // 2. Check strict payment access (same logic as Zoom Live)
        if (content.isSeparate) {
          if (isFreeVideo) {
            hasAccess = true;
          } else {
            const approved = await Request.findOne({
              where: { studentId, contentId, status: "approved" },
            });
            hasAccess = !!approved;
          }
        } else {
          const lesson = await Lesson.findByPk(content.lessonId);
          const isParentFree =
            lesson && (!lesson.price || lesson.price === "0");
          const approved = await Request.findOne({
            where: {
              studentId,
              lessonId: content.lessonId,
              status: "approved",
            },
          });
          hasAccess = isParentFree || !!approved;
        }

        // 3. The Gatekeeper
        if (!hasAccess) {
          await SecurityLog.create({
            event: "RECORDING THEFT ATTEMPT",
            description: "Student tried to access recording without payment!",
            ip_address: req.ip || req.connection.remoteAddress,
            user_id: String(studentId),
            severity: "high",
          });
          return res.status(402).json(
            withRecordingDebug(
              {
                success: false,
                message:
                  "You must purchase this content to access the recording",
              },
              "payment_or_access_denied",
              { contentId, studentId },
            ),
          );
        }

        // 4. Log the access
        await SecurityLog.create({
          event: "RECORDING ACCESSED",
          description: `Student accessed recording: ${content.title}`,
          ip_address: req.ip || req.connection.remoteAddress,
          user_id: String(studentId),
          severity: "low",
        });

        const recordingUrl = String(content.recordingLink || "").trim();
        const direct = isDirectVideoLink(recordingUrl);
        const zoomShare = isZoomShareLink(recordingUrl);
        if (!direct && !zoomShare) {
          return res.status(422).json(
            withRecordingDebug(
              {
                success: false,
                message:
                  "Recording link must be direct .mp4/.m3u8 or Zoom share link.",
              },
              "unsupported_recording_link_format",
              { contentId, recordingLink: recordingUrl },
            ),
          );
        }

        // 5. Return recording data for secure in-app stream player only
        const streamToken = createRecordingStreamToken(studentId, contentId);

        res.json({
          success: true,
          title: content.title,
          description: content.youtube_link || "",
          streamUrl: `/api/student/zoom-recording-stream/${contentId}?st=${encodeURIComponent(streamToken)}`,
          linkType: direct ? "direct_video" : "zoom_share",
          thumbnailUrl: null,
          downloadUrl: null,
          duration: null,
        });
      } catch (e) {
        console.error("Recording Access Error:", e);
        res.status(500).json(
          withRecordingDebug(
            {
              success: false,
              message: "Server error accessing recording",
            },
            "recording_access_exception",
            { details: e?.message || String(e) },
          ),
        );
      }
    },
  );

  server.get(
    "/api/student/zoom-recording-stream/:contentId",
    async (req, res) => {
      try {
        const contentId = req.params.contentId;

        let studentId = null;
        const streamToken = String(req.query.st || "").trim();

        if (streamToken) {
          try {
            const decoded = jwt.verify(
              streamToken,
              process.env.JWT_SECRET || "secret",
            );
            if (decoded?.purpose !== "secure_recording_stream") {
              return res
                .status(401)
                .json(
                  withRecordingDebug(
                    { success: false, message: "Invalid stream token" },
                    "stream_invalid_purpose",
                    { contentId },
                  ),
                );
            }
            if (String(decoded?.contentId) !== String(contentId)) {
              return res.status(401).json(
                withRecordingDebug(
                  {
                    success: false,
                    message: "Stream token/content mismatch",
                  },
                  "stream_token_content_mismatch",
                  { contentId },
                ),
              );
            }
            studentId = decoded.id;
          } catch (err) {
            return res.status(401).json(
              withRecordingDebug(
                {
                  success: false,
                  message: "Stream token expired or invalid",
                },
                "stream_token_invalid",
                { contentId },
              ),
            );
          }
        }

        // Fallback for older clients: cookie-only decode (without fingerprint header requirement)
        if (!studentId) {
          const cookieToken = req.cookies?.token;
          if (!cookieToken) {
            return res
              .status(403)
              .json(
                withRecordingDebug(
                  { success: false, message: "No Token" },
                  "stream_missing_auth",
                  { contentId },
                ),
              );
          }
          try {
            const decoded = jwt.verify(
              cookieToken,
              process.env.JWT_SECRET || "secret",
            );
            studentId = decoded?.id;
          } catch (err) {
            return res
              .status(401)
              .json(
                withRecordingDebug(
                  { success: false, message: "Unauthorized" },
                  "stream_cookie_invalid",
                  { contentId },
                ),
              );
          }
        }

        const content = await Content.findByPk(contentId);
        if (!content) {
          return res.status(404).json(
            withRecordingDebug(
              {
                success: false,
                message: "Recording not found or has been deleted",
              },
              "stream_content_not_found",
              { contentId },
            ),
          );
        }
        if (!content.recordingVisible) {
          return res
            .status(404)
            .json(
              withRecordingDebug(
                { success: false, message: "Recording is hidden by admin" },
                "stream_recording_hidden_by_admin",
                { contentId },
              ),
            );
        }
        if (!content.recordingLink) {
          return res
            .status(404)
            .json(
              withRecordingDebug(
                { success: false, message: "Recording link is missing" },
                "stream_recording_link_missing",
                { contentId },
              ),
            );
        }

        const isFreeVideo = !content.price || content.price === "0";
        let hasAccess = false;

        if (content.isSeparate) {
          if (isFreeVideo) {
            hasAccess = true;
          } else {
            const approved = await Request.findOne({
              where: { studentId, contentId, status: "approved" },
            });
            hasAccess = !!approved;
          }
        } else {
          const lesson = await Lesson.findByPk(content.lessonId);
          const isParentFree =
            lesson && (!lesson.price || lesson.price === "0");
          const approved = await Request.findOne({
            where: {
              studentId,
              lessonId: content.lessonId,
              status: "approved",
            },
          });
          hasAccess = isParentFree || !!approved;
        }

        if (!hasAccess) {
          return res.status(402).json(
            withRecordingDebug(
              {
                success: false,
                message:
                  "You must purchase this content to access the recording",
              },
              "stream_payment_or_access_denied",
              { contentId, studentId },
            ),
          );
        }

        const recordingUrl = String(content.recordingLink || "").trim();
        const direct = isDirectVideoLink(recordingUrl);
        const zoomShare = isZoomShareLink(recordingUrl);
        if (!direct && !zoomShare) {
          return res.status(422).json(
            withRecordingDebug(
              {
                success: false,
                message: "Unsupported recording link format",
              },
              "stream_unsupported_recording_link_format",
              { contentId, recordingLink: recordingUrl },
            ),
          );
        }

        let sourceUrl = recordingUrl;
        let sourceHeaders = {};

        if (zoomShare) {
          const resolved = await resolveZoomShareToFile(recordingUrl);
          sourceUrl = resolved.fileUrl;
          if (resolved.authMode === "query") {
            const separator = sourceUrl.includes("?") ? "&" : "?";
            sourceUrl = `${sourceUrl}${separator}access_token=${encodeURIComponent(resolved.token)}`;
          } else {
            sourceHeaders.Authorization = `Bearer ${resolved.token}`;
          }
        }

        const range = req.headers.range;
        const upstreamHeaders = {};
        if (range) upstreamHeaders.Range = range;
        Object.assign(upstreamHeaders, sourceHeaders);
        upstreamHeaders["User-Agent"] =
          req.headers["user-agent"] || "Mozilla/5.0";

        let upstream;
        try {
          upstream = await axios.get(sourceUrl, {
            responseType: "stream",
            headers: upstreamHeaders,
            maxRedirects: 5,
            validateStatus: (status) => status === 200 || status === 206,
          });
        } catch (err) {
          // Some providers reject ranged startup requests; retry once without Range.
          if (range) {
            const retryHeaders = { ...upstreamHeaders };
            delete retryHeaders.Range;
            upstream = await axios.get(sourceUrl, {
              responseType: "stream",
              headers: retryHeaders,
              maxRedirects: 5,
              validateStatus: (status) => status === 200 || status === 206,
            });
          } else {
            throw err;
          }
        }

        res.status(upstream.status);
        const passHeaders = [
          "content-type",
          "content-length",
          "content-range",
          "accept-ranges",
        ];
        passHeaders.forEach((h) => {
          if (upstream.headers[h]) res.setHeader(h, upstream.headers[h]);
        });

        res.setHeader(
          "Cache-Control",
          "no-store, no-cache, must-revalidate, private",
        );
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Content-Disposition", "inline");
        res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

        upstream.data.pipe(res);
      } catch (e) {
        console.error("Recording Stream Error:", e?.message || e);
        if (!res.headersSent) {
          res
            .status(500)
            .json(
              withRecordingDebug(
                { success: false, message: "Failed to stream recording" },
                "stream_exception",
                { details: e?.message || String(e) },
              ),
            );
        }
      }
    },
  );

  // LOGIN MOBILE BASED
  server.post("/api/login", async (req, res) => {
    try {
      const { mobile, password, fingerprint } = req.body; // 🧬 Catch the DNA
      const ip = req.ip || req.connection.remoteAddress;

      if (!mobile || !password) {
        return res.status(400).json({ message: "Missing credentials" });
      }

      // 1. ADMIN CHECK
      if (mobile === "ADMIN") {
        const admin = await User.findOne({ where: { mobile: "ADMIN" } });
        let isAdminPasswordCorrect = false;
        if (admin) {
          try {
            isAdminPasswordCorrect = password === decrypt(admin.password);
          } catch {
            isAdminPasswordCorrect = password === admin.password;
          }
        }

        if (admin && isAdminPasswordCorrect) {
          await SecurityLog.create({
            event: "Admin Login",
            description: "Admin access granted",
            ip_address: ip,
            mobile: "ADMIN",
            severity: "low",
          });

          const sessionId = createSessionId();
          const token = jwt.sign(
            { id: admin.id, role: "admin", sid: sessionId },
            process.env.JWT_SECRET || "secret",
            { expiresIn: "24h" },
          );

          res.cookie("token", token, {
            httpOnly: true,
            maxAge: 24 * 60 * 60 * 1000,
          }); // 🚀 24 HOURS
          return res.json({ ...admin.toJSON(), sessionId, token: undefined });
        } else {
          await SecurityLog.create({
            event: "Auth Failure",
            description: "Admin password incorrect",
            ip_address: ip,
            mobile: "ADMIN",
            severity: "low",
          });
          return res.status(401).json({ message: "Invalid" });
        }
      }

      // 2. BLOCKLIST CHECK
      const isBlocked = await Blocklist.findOne({ where: { ip_address: ip } });
      if (isBlocked) {
        await SecurityLog.create({
          event: "Firewall Block",
          description: "Blocked IP tried to login",
          ip_address: ip,
          mobile: mobile,
          severity: "high",
        });
        return res.status(403).json({ message: "ACCESS DENIED" });
      }

      // 3. USER CHECK
      const user = await User.findOne({ where: { mobile } });

      if (!user) {
        await SecurityLog.create({
          event: "Login Fail",
          description: `Unknown User: ${mobile}`,
          ip_address: ip,
          mobile: mobile,
          severity: "low",
        });
        return res.status(401).json({ message: "Invalid" });
      }

      if (user.status === "deactivated") {
        await SecurityLog.create({
          event: "Blocked Access",
          description: "Banned user login attempt",
          ip_address: ip,
          mobile: mobile,
          user_id: String(user.id),
          severity: "medium",
        });
        return res.status(401).json({ message: "Banned" });
      }

      // ✅ SMART PASSWORD CHECK: Handles both encrypted and old plain-text passwords safely
      let isPasswordCorrect = false;
      try {
        isPasswordCorrect = password === decrypt(user.password);
      } catch (err) {
        isPasswordCorrect = password === user.password;
      }

      if (!isPasswordCorrect) {
        await SecurityLog.create({
          event: "Auth Failure",
          description: "Wrong Password",
          ip_address: ip,
          mobile: mobile,
          user_id: String(user.id),
          severity: "medium",
        });
        return res
          .status(401)
          .json({ message: "Invalid Mobile Number / Password." });
      }

      if (user.role === "student" && onlineUsers.has(String(user.id))) {
        const existingSession = onlineUsers.get(String(user.id));
        const socketServer =
          typeof io !== "undefined" ? io : global.io || req.app.get("io");

        if (socketServer && existingSession?.socketId) {
          socketServer.to(existingSession.socketId).emit("concurrent_login", {
            message:
              "Security Alert: Your account was logged in from another device. This session has been closed.",
          });
        }

        onlineUsers.delete(String(user.id));
      }

      // ✅ PASSED ALL CHECKS: LOG THEM IN
      await SecurityLog.create({
        event: "Login Success",
        description: "User Logged In",
        ip_address: ip,
        mobile: mobile,
        user_id: String(user.id),
        device_name: getDeviceName(req),
        severity: "low",
      });

      const sessionId = createSessionId();
      const token = jwt.sign(
        {
          id: user.id,
          role: user.role,
          fp: fingerprint || "unknown",
          sid: sessionId,
        },
        process.env.JWT_SECRET || "secret",
        { expiresIn: "24h" },
      );

      res.cookie("token", token, {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000,
      }); // 🚀 24 HOURS
      res.json({ ...user.toJSON(), sessionId, token: undefined });
    } catch (e) {
      console.error("Login Error:", e);
      res.status(500).json({ message: "Server Error during login." });
    }
  });

  server.post("/api/logout", (req, res) => {
    res.clearCookie("token");
    res.json({ success: true });
  });
  server.get("/api/me", verifyToken, async (req, res) => {
    const user = await User.findByPk(req.user.id);
    if (user) res.json({ ...user.toJSON(), sessionId: req.user.sessionId });
    else res.status(401).json({ message: "Not found" });
  });

  server.post("/api/me/class-mode", verifyToken, async (req, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.role !== "student")
        return res.status(403).json({ message: "Students only" });

      const classMode = normalizeClassMode(req.body.classMode);
      const hallClass = normalizeHallClass(req.body.hallClass);

      if (!classMode) {
        return res.status(400).json({ message: "Select Online or Physical" });
      }

      if (classMode === "physical") {
        const cities = await getHallClassesList();
        if (!hallClass) {
          return res.status(400).json({ message: "Select a Hall Class city" });
        }
        if (!cities.includes(hallClass)) {
          return res
            .status(400)
            .json({ message: "Selected Hall Class city is invalid" });
        }
      }

      const studentCode = await generateUniqueStudentCode(classMode, hallClass);

      await user.update({
        classMode,
        hallClass: classMode === "physical" ? hallClass : null,
        studentCode,
      });

      res.json({
        success: true,
        classMode: user.classMode,
        hallClass: user.hallClass,
        studentCode: user.studentCode,
      });
    } catch (e) {
      res
        .status(500)
        .json({ message: e?.message || "Failed to update class mode" });
    }
  });

  server.post("/api/register", async (req, res) => {
    try {
      const {
        password,
        name,
        mobile,
        address,
        nic: nicInput,
        batch,
        classMode: modeInput,
        hallClass: hallInput,
      } = req.body;
      const classMode = normalizeClassMode(modeInput);
      const hallClass = normalizeHallClass(hallInput);
      const nic = String(nicInput || "")
        .trim()
        .toUpperCase();

      if (!name || !mobile || !address || !nic || !batch || !password) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const normalizedAddress = String(address || "").trim();
      if (/^0\d{9,14}$/.test(normalizedAddress.replace(/\s+/g, ""))) {
        return res.status(400).json({ message: "Invalid address format" });
      }

      if (!mobileRegex.test(String(mobile || ""))) {
        return res.status(400).json({ message: "Invalid mobile format" });
      }

      if (!isValidSriLankanNIC(nic)) {
        return res.status(400).json({ message: "Invalid NIC format" });
      }

      const nicExists = await User.findOne({ where: { nic } });
      if (nicExists) {
        return res.status(409).json({ message: "NIC is already in use" });
      }

      if (!classMode) {
        return res.status(400).json({ message: "Select Online or Physical" });
      }

      if (classMode === "physical") {
        const cities = await getHallClassesList();
        if (!hallClass) {
          return res.status(400).json({ message: "Select a Hall Class city" });
        }
        if (!cities.includes(hallClass)) {
          return res
            .status(400)
            .json({ message: "Selected Hall Class city is invalid" });
        }
      }

      const existing = await User.findOne({ where: { mobile } });
      if (existing) {
        return res
          .status(400)
          .json({ message: "Mobile number already registered!" });
      }

      const studentCode = await generateUniqueStudentCode(classMode, hallClass);

      const user = await User.create({
        name,
        nic,
        mobile,
        address: normalizedAddress,
        batch,
        classMode,
        hallClass: classMode === "physical" ? hallClass : null,
        studentCode,
        password: encrypt(password),
        role: "student",
        welcomeNotificationEligible: true,
        welcomeNotificationSent: false,
      });

      io.emit("student_list_updated");
      sendNewAccountCreatedAdminAlert({ student: user }).catch((error) => {
        console.error(
          "[ADMIN NOTIFY] New account created alert error:",
          error?.message || error,
        );
      });
      res.json({ success: true, studentCode: user.studentCode });
    } catch (e) {
      // Handle Unique Mobile Error
      if (e.name === "SequelizeUniqueConstraintError") {
        const field = e.errors?.[0]?.path;
        if (field === "nic")
          return res.status(409).json({ message: "NIC is already in use" });
        if (field === "mobile")
          return res
            .status(400)
            .json({ message: "Mobile number already registered!" });
        if (field === "studentCode") {
          return res.status(500).json({ message: "Please retry registration" });
        }
      }
      res.status(400).json({ message: "Registration Failed" });
    }
  });

  server.post("/api/me/email", verifyToken, async (req, res) => {
    try {
      const email = String(req.body?.email || "")
        .trim()
        .toLowerCase();
      if (!isValidEmail(email)) {
        return res.status(400).json({ message: "Invalid email address" });
      }

      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      const emailOwner = await User.findOne({
        where: {
          email,
          id: { [Op.ne]: user.id },
        },
      });
      if (emailOwner) {
        return res.status(409).json({ message: "Email is already in use" });
      }

      await user.update({ email });
      return res.json({ success: true, email: user.email });
    } catch (e) {
      return res
        .status(500)
        .json({ message: e?.message || "Failed to update email" });
    }
  });

  server.post("/api/me/nic", verifyToken, async (req, res) => {
    try {
      const nic = String(req.body?.nic || "")
        .trim()
        .toUpperCase();
      if (!isValidSriLankanNIC(nic)) {
        return res.status(400).json({ message: "Enter a valid NIC" });
      }

      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.role !== "student")
        return res.status(403).json({ message: "Students only" });

      if (String(user.nic || "").trim()) {
        return res
          .status(400)
          .json({ message: "NIC is already saved and cannot be edited" });
      }

      const nicOwner = await User.findOne({
        where: {
          nic,
          id: { [Op.ne]: user.id },
        },
      });
      if (nicOwner) {
        return res.status(409).json({ message: "NIC is already in use" });
      }

      await user.update({ nic });
      return res.json({ success: true, nic: user.nic });
    } catch (e) {
      return res
        .status(500)
        .json({ message: e?.message || "Failed to update NIC" });
    }
  });

  server.post(
    "/api/admin/reset-student-email-nic",
    requireAdmin,
    async (req, res) => {
      try {
        const [updatedCount] = await User.update(
          { email: null, nic: null },
          { where: { role: "student" } },
        );

        return res.json({
          success: true,
          cleared: updatedCount,
          message: `Cleared email and NIC from ${updatedCount} student accounts.`,
        });
      } catch (e) {
        console.error(
          "[ADMIN RESET] Failed to clear student email/NIC:",
          e?.message || e,
        );
        return res
          .status(500)
          .json({ message: "Failed to reset student email/NIC" });
      }
    },
  );

  server.get("/api/hall-classes", async (req, res) => {
    try {
      const list = await getHallClassesList();
      res.json(list);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  server.post("/api/hall-classes", async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim();
      if (!name)
        return res.status(400).json({ message: "City name is required" });

      const list = await getHallClassesList();
      if (list.includes(name)) {
        return res.status(400).json({ message: "City already exists" });
      }

      const next = await saveHallClassesList([...list, name]);
      res.json({ success: true, hallClasses: next });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  server.delete("/api/hall-classes/:name", async (req, res) => {
    try {
      const name = decodeURIComponent(String(req.params.name || "")).trim();
      if (!name)
        return res.status(400).json({ message: "City name is required" });

      const list = await getHallClassesList();
      const next = list.filter((item) => item !== name);
      await saveHallClassesList(next);

      res.json({ success: true, hallClasses: next });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  server.get("/api/batches", async (req, res) =>
    res.json(await Batch.findAll()),
  );
  server.post("/api/batches", async (req, res) => {
    await Batch.create(req.body);
    res.json({ success: true });
  });
  // ✅ DELETE BATCH + ALL STUDENTS IN THAT BATCH
  server.delete("/api/batches/:id", async (req, res) => {
    try {
      const id = req.params.id;

      // 1. Find the batch name first
      const batch = await Batch.findByPk(id);
      if (!batch) return res.status(404).json({ message: "Batch not found" });

      // 2. Delete ALL students who have this batch name
      await User.destroy({ where: { batch: batch.name, role: "student" } });

      // 3. Delete the batch itself
      await batch.destroy();

      // 4. Refresh connected admins
      io.emit("student_list_updated");

      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });
  // --- UPDATED REQUESTS FETCH ROUTE ---
  server.get("/api/admin/requests", async (req, res) => {
    try {
      const requests = await Request.findAll({
        order: [["createdAt", "DESC"]],
        include: [
          {
            model: User,
            attributes: ["mobile"], // Fetch mobile from User table
          },
        ],
      });

      // Flatten the structure so frontend access is easy (req.mobile)
      const data = requests.map((r) => {
        const json = r.toJSON();
        return {
          ...json,
          mobile: json.User ? json.User.mobile : null,
        };
      });

      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  server.delete("/api/admin/requests/history", async (req, res) => {
    try {
      await Request.destroy({ where: { status: { [Op.ne]: "pending" } } });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  server.post("/api/admin/request-action", async (req, res) => {
    try {
      const { id, status } = req.body;
      const request = await Request.findByPk(id);

      if (!request) return res.status(404).send("Not found");

      const incomingStatus = String(status || "")
        .trim()
        .toLowerCase();
      const normalizedStatus =
        incomingStatus === "rejected" ? "declined" : incomingStatus;
      if (!["approved", "declined", "pending"].includes(normalizedStatus)) {
        return res.status(400).json({ message: "Invalid status value" });
      }

      const previousStatus = request.status;

      request.status = normalizedStatus;

      // ✅ FIX: If the admin approves an old/expired request, reset the timer clock!
      if (normalizedStatus === "approved") {
        request.accessedAt = null;
      }

      await request.save();

      if (
        ["approved", "declined"].includes(normalizedStatus) &&
        previousStatus !== normalizedStatus
      ) {
        const student = await User.findByPk(request.studentId);
        sendRequestDecisionAlertToStudent({
          request,
          student,
          status: normalizedStatus,
        }).catch((error) => {
          console.error(
            "[REQUEST ALERT] Student decision notify error:",
            error?.message || error,
          );
        });
      }

      // ⚡️ NOTIFY CLIENT TO UNLOCK SCREEN
      io.emit("request_updated", {
        studentId: request.studentId,
        contentId: request.contentId,
        status: request.status,
        type: request.type,
      });

      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).send("Server Error");
    }
  });

  // ✅ STUDENT WELCOME NOTIFICATION - Sends welcome email + push when student allows notifications
  server.post(
    "/api/student/send-welcome-notification",
    verifyToken,
    async (req, res) => {
      if (!req.user || req.user.role !== "student") {
        return res.status(401).json({ error: "Unauthorized" });
      }

      try {
        const student = await User.findByPk(req.user.id);
        if (!student || student.role !== "student") {
          return res.status(404).json({ error: "Student not found" });
        }

        if (!student.welcomeNotificationEligible) {
          return res.json({
            success: false,
            skipped: true,
            reason: "not_eligible_existing_account",
          });
        }

        if (student.welcomeNotificationSent) {
          return res.json({
            success: false,
            skipped: true,
            reason: "already_sent",
          });
        }

        console.log(
          `[WELCOME NOTIFY] Sending welcome notification for student ${student.id}...`,
        );
        const result = await sendNewAccountCreatedStudentAlert({ student });
        const sentPush = Number(result?.push?.sent || 0);
        const sentEmail = Number(result?.emailSent || 0);

        if (sentPush > 0 || sentEmail > 0) {
          await student.update({
            welcomeNotificationSent: true,
            welcomeNotificationEligible: false,
          });
        }

        console.log(`[WELCOME NOTIFY] Result:`, result);
        return res.json({ success: sentPush > 0 || sentEmail > 0, ...result });
      } catch (error) {
        console.error("[WELCOME NOTIFY] Error:", error?.message || error);
        return res
          .status(500)
          .json({ error: "Failed to send welcome notification" });
      }
    },
  );

  server.post(
    "/api/student/request",
    upload.single("slip"),
    async (req, res) => {
      try {
        const { studentId, lessonId, contentId, type } = req.body;
        const student = await User.findByPk(studentId);
        let lessonName = "Unknown";
        let contentTitle = "";

        // 🚀 THE FIX: Safely fetch the title depending on the TYPE of request!
        if (contentId) {
          if (type === "PASTPAPER_ACCESS") {
            const p = await PastPaperFile.findByPk(contentId);
            contentTitle = p ? p.title : "Past Paper";
            lessonName = "Past Papers Library";
          } else {
            const c = await Content.findByPk(contentId);
            contentTitle = c ? c.title : "Content";
            // Safely get lesson ID only if content exists
            if (c && c.lessonId) {
              const l = await Lesson.findByPk(c.lessonId);
              lessonName = l ? l.name : "Lesson";
            } else {
              lessonName = "Lesson";
            }
          }
        } else if (lessonId) {
          const l = await Lesson.findByPk(lessonId);
          lessonName = l ? l.name : "Lesson";
        }

        // ✅ Handle BOTH Video PDFs and Past Papers (Recycle old timers)
        let requestRecord = null;

        if (type === "PDF_ACCESS" || type === "PASTPAPER_ACCESS") {
          let existingDocRequest = await Request.findOne({
            where: { studentId, contentId, type }, // Matches exact type
            order: [["createdAt", "DESC"]],
          });

          if (existingDocRequest) {
            existingDocRequest.status = "pending";
            existingDocRequest.accessedAt = null; // 💥 CRITICAL: Wipe old timer
            await existingDocRequest.save();
            requestRecord = existingDocRequest;
          } else {
            requestRecord = await Request.create({
              studentId,
              studentName: student.name,
              lessonId: lessonId || null,
              lessonName,
              contentId: contentId || null,
              contentTitle,
              type,
              proof_image: null,
            });
          }
        } else {
          // Normal payments (Videos/Live classes with Slips)
          requestRecord = await Request.create({
            studentId,
            studentName: student.name,
            lessonId: lessonId || null,
            lessonName,
            contentId: contentId || null,
            contentTitle,
            type,
            proof_image: req.file ? req.file.filename : null,
          });
        }

        // Send a smart notification to the admin
        const notificationMsg =
          type === "PDF_ACCESS" || type === "PASTPAPER_ACCESS"
            ? `Document Request: ${student.name}`
            : `Payment: ${student.name}`;

        io.to("admin_room").emit("new_request_received", {
          message: notificationMsg,
        });

        sendRequestSubmissionAlertToAdmins({
          request: requestRecord,
          student,
          lessonName,
          contentTitle,
        }).catch((error) => {
          console.error(
            "[REQUEST ALERT] Admin submission notify error:",
            error?.message || error,
          );
        });

        res.json({ success: true });
      } catch (e) {
        console.error("Request Error:", e);
        res.status(500).json({ error: e.message });
      }
    },
  );

  server.get("/api/settings/maintenance", async (req, res) => {
    const s = await Setting.findOne({ where: { key: "maintenance" } });
    res.json({ enabled: s ? s.value : false });
  });
  server.post("/api/settings/toggle-maintenance", async (req, res) => {
    const s = await Setting.findOne({ where: { key: "maintenance" } });
    await s.update({ value: !s.value });
    io.emit("maintenance_update", { enabled: s.value });
    res.json({ enabled: s.value });
  });

  // 👑 SFT KING AI - GLOBAL KILL SWITCH
  server.get("/api/settings/ai-chat", async (req, res) => {
    const s = await Setting.findOne({ where: { key: "ai_chat" } });
    res.json({ enabled: s ? s.value : true }); // Default is true (Alive)
  });

  server.post("/api/settings/toggle-ai-chat", async (req, res) => {
    const [s] = await Setting.findOrCreate({
      where: { key: "ai_chat" },
      defaults: { value: true },
    });
    await s.update({ value: !s.value });

    // 📢 BLAST TO ALL STUDENTS INSTANTLY
    io.emit("ai_chat_update", { enabled: s.value });
    res.json({ enabled: s.value });
  });

  server.get("/api/settings/notifications", async (req, res) => {
    const emailSetting = await Setting.findOne({
      where: { key: "notifications_email" },
    });
    const pushSetting = await Setting.findOne({
      where: { key: "notifications_push" },
    });
    res.json({
      emailEnabled: emailSetting ? emailSetting.value !== false : true,
      pushEnabled: pushSetting ? pushSetting.value !== false : true,
    });
  });

  server.post("/api/settings/notifications", async (req, res) => {
    const mode = String(req.body?.mode || "")
      .trim()
      .toLowerCase();
    const explicit =
      typeof req.body?.enabled === "boolean" ? req.body.enabled : null;

    const [emailSetting] = await Setting.findOrCreate({
      where: { key: "notifications_email" },
      defaults: { value: true },
    });
    const [pushSetting] = await Setting.findOrCreate({
      where: { key: "notifications_push" },
      defaults: { value: true },
    });

    let nextEmail = emailSetting.value !== false;
    let nextPush = pushSetting.value !== false;

    if (mode === "email") {
      nextEmail = explicit !== null ? explicit : !nextEmail;
    } else if (mode === "push") {
      nextPush = explicit !== null ? explicit : !nextPush;
    } else if (mode === "both") {
      const next = explicit !== null ? explicit : !(nextEmail && nextPush);
      nextEmail = next;
      nextPush = next;
    } else {
      return res.status(400).json({ error: "Invalid mode" });
    }

    await emailSetting.update({ value: nextEmail });
    await pushSetting.update({ value: nextPush });

    setNotificationFlags({ emailEnabled: nextEmail, pushEnabled: nextPush });

    io.emit("notifications_settings_update", {
      emailEnabled: nextEmail,
      pushEnabled: nextPush,
    });
    res.json({ emailEnabled: nextEmail, pushEnabled: nextPush });
  });
  server.post("/api/user/avatar/:id", (req, res) => {
    upload.single("avatar")(req, res, async (err) => {
      if (err) return res.status(500).json({ message: "Upload Error" });
      try {
        if (!req.file) return res.status(400).json({ message: "No file" });
        const user = await User.findByPk(req.params.id);
        if (user.avatar) {
          try {
            fs.unlinkSync(path.join(UPLOAD_DIR, user.avatar));
          } catch (e) {}
        }
        await user.update({ avatar: req.file.filename });
        res.json({ success: true, avatar: req.file.filename });
      } catch (e) {
        res.status(500).json({ message: "Error" });
      }
    });
  });
  server.delete("/api/user/avatar/:id", async (req, res) => {
    const user = await User.findByPk(req.params.id);
    if (user.avatar) {
      try {
        fs.unlinkSync(path.join(UPLOAD_DIR, user.avatar));
      } catch (e) {}
    }
    await user.update({ avatar: null });
    res.json({ success: true });
  });
  server.get("/api/admin/students", async (req, res) => {
    const { search, batch, classMode, hallClass } = req.query;
    let where = { role: "student" };
    if (batch) where.batch = batch;
    if (classMode) where.classMode = String(classMode).toLowerCase();
    if (hallClass) where.hallClass = hallClass;
    if (search)
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { mobile: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { nic: { [Op.like]: `%${search}%` } },
        { studentCode: { [Op.like]: `%${search}%` } },
      ];
    const students = await User.findAll({ where });
    const data = students.map((s) => {
      const { password, ...rest } = s.toJSON();
      return { ...rest, isOnline: s.isOnline };
    });
    res.json(data);
  });

  server.get(
    "/api/admin/student/:id",
    verifyToken,
    requireAdmin,
    async (req, res) => {
      try {
        const student = await User.findOne({
          where: { id: req.params.id, role: "student" },
          attributes: ["id", "name", "mobile"],
        });

        if (!student) {
          return res.status(404).json({ error: "Student not found" });
        }

        res.json({ student });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );
  // ADMIN TOGGLE STUDENT STATUS
  server.post("/api/admin/students/toggle-status", async (req, res) => {
    try {
      const { id, currentStatus } = req.body;
      const user = await User.findByPk(id);
      if (!user) return res.status(404).json({ message: "Not Found" });

      const newStatus = currentStatus === "active" ? "deactivated" : "active";
      await user.update({ status: newStatus });

      // 🚀 THE BAN HAMMER (INSTANT KICK)
      if (newStatus === "deactivated") {
        const socketServer =
          typeof io !== "undefined" ? io : global.io || req.app.get("io");
        const affectedSessions = Array.from(onlineUsers.entries()).filter(
          ([, info]) => String(info.userId) === String(id),
        );

        for (const [sessionId, info] of affectedSessions) {
          if (socketServer && info.socketId) {
            socketServer.to(info.socketId).emit("account_banned");
          }
          onlineUsers.delete(sessionId);
        }

        if (socketServer) {
          socketServer.to(`user_${id}`).emit("account_banned");
        }

        await User.update({ isOnline: false }, { where: { id } });

        sendAccountStatusAlertToStudent({
          user,
          eventType: "suspended",
          reason: "Administrative action by support team.",
        }).catch((error) => {
          console.error(
            "[ACCOUNT ALERT] Suspend notify error:",
            error?.message || error,
          );
        });
      } else {
        sendAccountStatusAlertToStudent({
          user,
          eventType: "reactivated",
          reason: "Your account has been reactivated by the support team.",
        }).catch((error) => {
          console.error(
            "[ACCOUNT ALERT] Reactivate notify error:",
            error?.message || error,
          );
        });
      }

      res.json({ success: true, status: newStatus });
    } catch (e) {
      console.error("Toggle Status Error:", e);
      res.status(500).json({ message: "Error" });
    }
  });
  server.delete("/api/admin/students/:id", async (req, res) => {
    try {
      const id = req.params.id;

      // EMIT REDIRECT COMMAND
      io.to(`user_${id}`).emit("force_logout", {
        reason: "deleted",
        redirect: "/deleted", // <--- Crucial
      });

      // Delayed Delete to allow socket to arrive first
      setTimeout(async () => {
        try {
          await Message.destroy({
            where: { [Op.or]: [{ senderId: id }, { receiverId: id }] },
          });
          await Request.destroy({ where: { studentId: id } });
          await User.destroy({ where: { id } });

          const count = await User.count({
            where: { isOnline: true, role: "student" },
          });
          io.emit("online_count_update", count);
          io.emit("student_list_updated");
        } catch (err) {
          console.error(err);
        }
      }, 500);

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  server.post("/api/admin/reveal-password", async (req, res) => {
    try {
      const user = await User.findByPk(req.body.userId);
      if (user) res.json({ password: decrypt(user.password) });
      else res.status(404).json({ message: "Not found" });
    } catch (e) {
      res.status(500).json({ message: "Error" });
    }
  });
  server.post("/api/admin/block-ip", async (req, res) => {
    try {
      await Blocklist.findOrCreate({
        where: { ip_address: req.body.ip_address },
        defaults: { reason: req.body.reason },
      });
      await SecurityLog.create({
        event: "IP BLOCKED",
        description: `Admin Block`,
        ip_address: req.body.ip_address,
        severity: "high",
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ message: "Error" });
    }
  });
  server.post("/api/admin/unblock", async (req, res) => {
    const { mobile } = req.body;
    const user = await User.findOne({ where: { mobile } });
    if (user) {
      await user.update({ status: "active" });

      sendAccountStatusAlertToStudent({
        user,
        eventType: "reactivated",
        reason: "Your account has been unblocked and reactivated.",
      }).catch((error) => {
        console.error(
          "[ACCOUNT ALERT] Unblock notify error:",
          error?.message || error,
        );
      });

      res.json({ success: true });
    } else res.status(404).json({ message: "User not found" });
  });
  server.get("/api/admin/stats", async (req, res) => {
    const total = await User.count({ where: { role: "student" } });
    const active = await User.count({
      where: { role: "student", status: "active" },
    });
    const pendingReqs = await Request.count({ where: { status: "pending" } });
    const onlineNow = await User.count({
      where: { isOnline: true, role: "student" },
    });
    res.json({ total, active, pendingReqs, onlineNow });
  });
  server.get("/api/user/status/:id", async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) return res.json({ status: "unknown" });
      res.json({ status: user.status });
    } catch (e) {
      res.status(500).json({ message: "Error" });
    }
  });
  // --- GET SINGLE USER (For Admin Chat) ---
  server.get("/api/users/:id", async (req, res) => {
    try {
      const user = await User.findByPk(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });

      // Return safe data (no password)
      res.json({
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        avatar: user.avatar,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  server.post("/api/security/violation", async (req, res) => {
    try {
      const { userId, type } = req.body;

      if (!userId) return res.status(400).json({ message: "No ID" });

      const user = await User.findByPk(userId);
      if (user) {
        // 1. BAN IN DB
        await user.update({ status: "deactivated" });

        sendAccountStatusAlertToStudent({
          user,
          eventType: "banned",
          reason: type || "Security policy violation detected.",
        }).catch((error) => {
          console.error(
            "[ACCOUNT ALERT] Security-ban notify error:",
            error?.message || error,
          );
        });

        // 2. KICK SOCKET (Instant)
        io.to(`user_${userId}`).emit("force_logout", {
          message: "SECURITY VIOLATION DETECTED",
        });

        // 3. LOG ALERT
        await SecurityLog.create({
          event: "SECURITY BREACH",
          description: type || "Inspector Detected",
          ip_address: req.ip || req.connection.remoteAddress,
          mobile: user.mobile, // Save Mobile
          user_id: String(user.id),
          severity: "high",
        });

        console.log(`>> 🚨 BANNED USER ${user.mobile}: ${type}`);
      }
      res.json({ success: true });
    } catch (e) {
      console.error("Violation Error:", e);
      res.status(500).json({ error: e.message });
    }
  });
  server.post("/api/admin/theme", async (req, res) => {
    const config = await AppConfig.findOne({ where: { key: "theme_color" } });
    if (config) await config.update({ value: req.body.color });
    else await AppConfig.create({ key: "theme_color", value: req.body.color });
    io.emit("theme_update", { color: req.body.color });
    res.json({ success: true });
  });
  server.get("/api/config/theme", async (req, res) => {
    const config = await AppConfig.findOne({ where: { key: "theme_color" } });
    res.json({ color: config ? config.value : "#dc2626" });
  });
  server.get("/api/admin/security/logs", async (req, res) => {
    try {
      const logs = await SecurityLog.findAll({
        order: [["createdAt", "DESC"]],
        limit: 100,
        raw: true,
      });
      const enriched = await Promise.all(
        logs.map(async (log) => {
          let currentStatus = "unknown";
          if (log.user_id) {
            const user = await User.findByPk(log.user_id);
            if (user) currentStatus = user.status;
          }
          return { ...log, current_status: currentStatus };
        }),
      );
      res.json(enriched);
    } catch (e) {
      res.status(500).json({ message: "Error" });
    }
  });
  server.delete("/api/admin/security/logs", async (req, res) => {
    try {
      const { type } = req.body;
      let whereCondition = {};
      if (type === "alerts") {
        whereCondition = {
          severity: { [Op.in]: ["high", "medium"] },
          event: { [Op.notLike]: "Admin%" },
        };
      } else if (type === "live") {
        whereCondition = {
          [Op.or]: [{ severity: "low" }, { event: { [Op.like]: "Admin%" } }],
        };
      }
      await SecurityLog.destroy({ where: whereCondition });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ message: "Error" });
    }
  });
  server.get("/api/config/site-name", async (req, res) => {
    const config = await AppConfig.findOne({ where: { key: "site_name" } });
    res.json({ name: config ? config.value : "SFT KING" });
  });
  server.post("/api/admin/site-name", async (req, res) => {
    const config = await AppConfig.findOne({ where: { key: "site_name" } });
    if (config) await config.update({ value: req.body.name });
    else await AppConfig.create({ key: "site_name", value: req.body.name });
    io.emit("site_name_update", { name: req.body.name });
    res.json({ success: true });
  });
  // --- BANK DETAILS CONFIGURATION ---
  // --- BANK DETAILS ROUTES ---
  server.get("/api/config/bank-details", async (req, res) => {
    try {
      const getVal = async (k, def) => {
        const conf = await AppConfig.findOne({ where: { key: k } });
        return conf ? conf.value : def;
      };

      res.json({
        bankName: await getVal("bank_name", "Bank of Ceylon"), // Added
        accNum: await getVal("bank_acc_num", "123456789"),
        accName: await getVal("bank_acc_name", "MIS Holding (Pvt)Ltd"),
        branch: await getVal("bank_branch", "Monaragala"),
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  server.post("/api/admin/bank-details", async (req, res) => {
    try {
      const { bankName, accNum, accName, branch } = req.body;

      const setVal = async (k, v) => {
        const conf = await AppConfig.findOne({ where: { key: k } });
        if (conf) await conf.update({ value: v });
        else await AppConfig.create({ key: k, value: v });
      };

      await setVal("bank_name", bankName); // Save Bank Name
      await setVal("bank_acc_num", accNum);
      await setVal("bank_acc_name", accName);
      await setVal("bank_branch", branch);

      io.emit("config_updated");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  server.get(
    "/api/admin/backup",
    verifyToken,
    requireAdmin,
    async (req, res) => {
      try {
        const data = {};
        for (const [name, model] of Object.entries(BACKUP_MODELS)) {
          data[name] = await model.findAll({ raw: true });
        }

        const backup = {
          meta: {
            schemaVersion: BACKUP_SCHEMA_VERSION,
            generatedAt: new Date().toISOString(),
            generatedBy: req.user.id,
            includeMessages: false,
            notes: "Full system backup excluding chat messages.",
          },
          data,
          storageManifest: {
            uploads: buildFolderManifest(path.join(__dirname, "uploads")),
            publicUploads: buildFolderManifest(
              path.join(__dirname, "public", "uploads"),
            ),
          },
        };

        const stamp = new Date().toISOString().replace(/[.:]/g, "-");
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=sftking-backup-${stamp}.json`,
        );
        return res.status(200).send(JSON.stringify(backup, null, 2));
      } catch (e) {
        console.error("Backup failed:", e);
        return res
          .status(500)
          .json({ message: "Backup failed", error: e.message });
      }
    },
  );

  server.post(
    "/api/admin/restore",
    verifyToken,
    requireAdmin,
    async (req, res) => {
      const payload = req.body;
      if (!payload || !payload.data || typeof payload.data !== "object") {
        return res.status(400).json({ message: "Invalid backup payload" });
      }

      const unknownModels = Object.keys(payload.data).filter(
        (name) => !BACKUP_MODELS[name],
      );
      if (unknownModels.length) {
        return res.status(400).json({
          message: "Backup payload has unknown model keys",
          unknownModels,
        });
      }

      const trx = await sequelize.transaction();
      try {
        await sequelize.query("SET FOREIGN_KEY_CHECKS = 0", {
          transaction: trx,
        });

        for (const modelName of [...RESTORE_MODEL_ORDER].reverse()) {
          const model = BACKUP_MODELS[modelName];
          await model.destroy({
            where: {},
            force: true,
            truncate: true,
            transaction: trx,
          });
        }

        for (const modelName of RESTORE_MODEL_ORDER) {
          const rows = Array.isArray(payload.data[modelName])
            ? payload.data[modelName]
            : [];
          if (rows.length > 0) {
            await BACKUP_MODELS[modelName].bulkCreate(rows, {
              validate: false,
              transaction: trx,
            });
          }
        }

        await sequelize.query("SET FOREIGN_KEY_CHECKS = 1", {
          transaction: trx,
        });
        await trx.commit();

        io.emit("config_updated");
        io.emit("content_updated");

        return res.json({
          success: true,
          restoredAt: new Date().toISOString(),
          includeMessages: false,
        });
      } catch (e) {
        await sequelize
          .query("SET FOREIGN_KEY_CHECKS = 1", { transaction: trx })
          .catch(() => {});
        await trx.rollback();
        console.error("Restore failed:", e);
        return res
          .status(500)
          .json({ message: "Restore failed", error: e.message });
      }
    },
  );

  server.post(
    "/api/admin/restart",
    verifyToken,
    requireAdmin,
    async (req, res) => {
      try {
        const restartCommand = process.env.RESTART_COMMAND || "pm2 restart all";

        // Respond first so the browser gets success before process restart interrupts the connection.
        res.status(202).json({
          success: true,
          message:
            "Restart queued. The website may disconnect for a few seconds.",
        });

        setTimeout(() => {
          exec(restartCommand, (error, stdout, stderr) => {
            if (error) {
              console.error("Restart command failed:", error);
              if (stderr) console.error("Restart stderr:", stderr);
              return;
            }
            if (stdout) console.log("Restart stdout:", stdout.trim());
          });
        }, 300);
      } catch (e) {
        return res
          .status(500)
          .json({ message: "Restart failed", error: e.message });
      }
    },
  );
  // ✅ PDF uploader middleware
  server.post(
    "/api/content/:id/pdf",
    verifyToken,
    pdfUpload.single("pdf"),
    async (req, res) => {
      try {
        if (req.user.role !== "admin") {
          return res.status(403).json({ message: "Forbidden" });
        }

        const contentId = req.params.id;
        const content = await Content.findByPk(contentId);
        if (!content)
          return res.status(404).json({ message: "Content not found" });

        if (!req.file)
          return res.status(400).json({ message: "No PDF uploaded" });

        // remove old pdf
        if (content.pdfFile) {
          try {
            fs.unlinkSync(path.join(PDF_UPLOAD_DIR, content.pdfFile));
          } catch (e) {}
        }

        await content.update({ pdfFile: req.file.filename });
        // 🚀 TRIGGER SLICER FOR VIDEO NOTES
        sliceExamPdfToImages(content.id, req.file.filename, "content");
        io.emit("content_updated");
        return res.json({ success: true, pdfFile: req.file.filename });
      } catch (e) {
        console.error("PDF upload failed:", e);
        return res.status(500).json({ message: "PDF upload failed" });
      }
    },
  );

  // ✅ delete pdf
  server.delete("/api/content/:id/pdf", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin")
        return res.status(403).json({ message: "Forbidden" });

      const contentId = req.params.id;
      const content = await Content.findByPk(contentId);
      if (!content)
        return res.status(404).json({ message: "Content not found" });

      if (content.pdfFile) {
        try {
          fs.unlinkSync(path.join(PDF_UPLOAD_DIR, content.pdfFile));
        } catch (e) {}
      }

      await content.update({ pdfFile: null });

      io.emit("content_updated");
      res.json({ success: true });
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed" });
    }
  });

  // ✅ LINK EXISTING VAULT PDF TO CONTENT
  server.put("/api/content/:id/link-pdf", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin")
        return res.status(403).json({ message: "Forbidden" });

      const { filename } = req.body;
      const content = await Content.findByPk(req.params.id);

      if (!content)
        return res.status(404).json({ message: "Content not found" });

      // Update DB to point to the vault file
      await content.update({ pdfFile: filename });

      io.emit("content_updated");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================
  // ✅ SFT PAST PAPERS - API ROUTES
  // ==========================================

  // ✅ 2.5 PAST PAPERS TICKET BOOTH & STATUS CHECKER
  server.get("/api/pastpapers/:id/pdf-token", verifyToken, async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    try {
      const studentId = req.user.id;
      const fileId = req.params.id;

      const file = await PastPaperFile.findByPk(fileId);
      if (!file || !file.isVisible)
        return res.status(404).json({ message: "PDF unavailable." });

      const timeLimitMins = parseInt(file.timeLimit) || 60;

      // 💥 FREE MODE: 24h Token
      if (file.isFree) {
        const pdfToken = jwt.sign(
          {
            id: studentId,
            contentId: file.id,
            purpose: "secure_pdf_view",
            isPastPaper: true,
          },
          process.env.JWT_SECRET || "secret",
          { expiresIn: "24h" },
        );
        return res.json({
          success: true,
          token: pdfToken,
          expiresInMins: timeLimitMins,
          isFree: true,
          pageImages: content.pageImages,
        });
      }

      // 🔒 PAID MODE: Check request
      const approvedRequest = await Request.findOne({
        where: {
          studentId,
          contentId: fileId,
          type: "PASTPAPER_ACCESS",
          status: "approved",
        },
        order: [["createdAt", "DESC"]],
      });

      if (!approvedRequest)
        return res.status(403).json({ message: "Access denied." });

      let startTime = approvedRequest.accessedAt;
      if (!startTime) {
        startTime = new Date();
        approvedRequest.accessedAt = startTime;
        await approvedRequest.save();
      }

      const elapsedMins =
        (new Date().getTime() - new Date(startTime).getTime()) / (1000 * 60);
      const remainingMins = timeLimitMins - elapsedMins;

      if (remainingMins <= 0) {
        approvedRequest.status = "expired";
        await approvedRequest.save();
        return res.status(403).json({ message: "Time limit expired." });
      }

      const safeMinutes = Math.max(1, Math.ceil(remainingMins));
      const pdfToken = jwt.sign(
        {
          id: studentId,
          contentId: file.id,
          purpose: "secure_pdf_view",
          isPastPaper: true,
        },
        process.env.JWT_SECRET || "secret",
        { expiresIn: `${safeMinutes}m` },
      );

      return res.json({
        success: true,
        token: pdfToken,
        expiresInMins: remainingMins,
        isFree: false,
        pageImages: content.pageImages,
      });
    } catch (e) {
      console.error("💥 PAST PAPER TOKEN CRASH:", e.message);
      res.status(500).json({ message: "FAILED TO GENERATE TOKEN." });
    }
  });

  // STATUS CHECKER
  server.get(
    "/api/student/pastpaper-status/:id",
    verifyToken,
    async (req, res) => {
      try {
        const file = await PastPaperFile.findByPk(req.params.id);
        if (file && file.isFree) return res.json({ status: "approved" });

        const request = await Request.findOne({
          where: {
            studentId: req.user.id,
            contentId: req.params.id,
            type: "PASTPAPER_ACCESS",
          },
          order: [["createdAt", "DESC"]],
        });

        if (!request) return res.json({ status: "none" });

        if (request.status === "approved" && request.accessedAt && file) {
          const elapsedMins =
            (new Date().getTime() - new Date(request.accessedAt).getTime()) /
            (1000 * 60);
          if (elapsedMins >= (parseInt(file.timeLimit) || 60)) {
            request.status = "expired";
            await request.save();
          }
        }

        return res.json({ status: request.status });
      } catch (e) {
        res.status(500).json({ status: "error" });
      }
    },
  );

  // 1. GET FOLDERS
  server.get("/api/pastpapers/folders", verifyToken, async (req, res) => {
    try {
      const parentId =
        req.query.parentId && req.query.parentId !== "null"
          ? req.query.parentId
          : null;
      const folders = await PastPaperFolder.findAll({
        where: { parentId },
        order: [["createdAt", "ASC"]],
      });
      res.json(folders);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 2. GET FILES IN FOLDER (WITH SMART UNLOCK CHECK!)
  server.get("/api/pastpapers/files", verifyToken, async (req, res) => {
    try {
      const folderId = req.query.folderId;
      if (!folderId) return res.json([]);

      const files = await PastPaperFile.findAll({
        where: { folderId },
        order: [["createdAt", "DESC"]],
      });

      // 🚀 THE FIX: Check if the student has an approved request for these files
      const studentId = req.user.id;
      const approvedRequests = await Request.findAll({
        where: { studentId, type: "PASTPAPER_ACCESS", status: "approved" },
      });

      // Get an array of all the Past Paper IDs the admin has approved
      const approvedIds = approvedRequests.map((r) => r.contentId);

      const data = files.map((f) => {
        const fileData = f.toJSON();
        // Inject 'true' if it's free OR if the admin approved it
        fileData.isUnlocked =
          fileData.isFree || approvedIds.includes(fileData.id);
        return fileData;
      });

      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 3. CREATE FOLDER (Admin Only)
  server.post(
    "/api/admin/pastpapers/folders",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");
        const { name, batches, parentId } = req.body;

        await PastPaperFolder.create({
          name,
          batches: JSON.stringify(
            batches && batches.length > 0 ? batches : ["All"],
          ),
          parentId: parentId || null,
        });
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 4. CREATE PAST PAPER FILE (Using Vault File)
  server.post("/api/admin/pastpapers/files", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin") return res.status(403).send("Forbidden");

      const { title, folderId, filename, isFree, timeLimit } = req.body;
      if (!filename)
        return res.status(400).json({ message: "No file provided" });

      const newFile = await PastPaperFile.create({
        title,
        folderId,
        pdfFile: filename,
        isFree: isFree === true,
        timeLimit: timeLimit || 60,
      });
      // 🚀 TRIGGER SLICER FOR PAST PAPERS
      sliceExamPdfToImages(newFile.id, filename, "pastpaper");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 5. DELETE FOLDER (Database Only, Leaves Vault Secure)
  server.delete(
    "/api/admin/pastpapers/folders/:id",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");

        const targetFolderId = parseInt(req.params.id);

        const getAllSubFolderIds = async (parentId) => {
          let ids = [];
          const subfolders = await PastPaperFolder.findAll({
            where: { parentId },
          });
          for (const sub of subfolders) {
            ids.push(sub.id);
            ids = ids.concat(await getAllSubFolderIds(sub.id));
          }
          return ids;
        };

        const allFolderIdsToDelete = [
          targetFolderId,
          ...(await getAllSubFolderIds(targetFolderId)),
        ];

        await PastPaperFile.destroy({
          where: { folderId: { [Op.in]: allFolderIdsToDelete } },
        });
        await PastPaperFolder.destroy({
          where: { id: { [Op.in]: allFolderIdsToDelete } },
        });

        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 6. DELETE SINGLE PDF RECORD
  server.delete(
    "/api/admin/pastpapers/files/:id",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");
        await PastPaperFile.destroy({ where: { id: req.params.id } });
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 7. RENAME FOLDER
  server.put(
    "/api/admin/pastpapers/folders/:id",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");
        const newFile = await PastPaperFile.create({
          title,
          folderId,
          pdfFile: filename,
          isFree: isFree === true,
          timeLimit: timeLimit || 60,
        });
        // 🚀 TRIGGER SLICER FOR PAST PAPERS
        sliceExamPdfToImages(newFile.id, filename, "pastpaper");
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 8. FULL EDIT PDF
  server.put(
    "/api/admin/pastpapers/files/:id",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");

        const { title, filename, isFree, timeLimit } = req.body;
        const fileToUpdate = await PastPaperFile.findByPk(req.params.id);

        if (!fileToUpdate)
          return res.status(404).json({ message: "File not found" });

        await fileToUpdate.update({
          title: title || fileToUpdate.title,
          pdfFile: filename || fileToUpdate.pdfFile,
          isFree: isFree !== undefined ? isFree : fileToUpdate.isFree,
          timeLimit: timeLimit || fileToUpdate.timeLimit,
        });

        io.emit("content_updated");
        res.json({ success: true });
      } catch (e) {
        console.error("Edit Error:", e);
        res.status(500).json({ error: e.message });
      }
    },
  );

  // ✅ FORCE EXPIRE PDF (Called when Timer hits 0)
  server.post(
    "/api/student/expire-pdf/:contentId",
    verifyToken,
    async (req, res) => {
      try {
        const { contentId } = req.params;
        const studentId = req.user.id;

        // Find the approved request and kill it
        const request = await Request.findOne({
          where: {
            studentId,
            contentId,
            type: "PDF_ACCESS",
            status: "approved",
          },
        });

        if (request) {
          request.status = "expired";
          await request.save();
          console.log(`🔒 PDF Expired for Student ${studentId}`);
        }

        res.json({ success: true });
      } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Error expiring PDF" });
      }
    },
  );

  // --- 🔒 SECURE VAULT CONFIGURATION ---
  const VAULT_DIR = path.join(process.cwd(), "private_data");
  if (!fs.existsSync(VAULT_DIR)) {
    fs.mkdirSync(VAULT_DIR, { recursive: true });
  }

  // Vault Multer Storage
  const vaultStorage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, VAULT_DIR),
    filename: (req, file, cb) => {
      // Sanitize filename: remove spaces, keep extension
      const cleanName = file.originalname.replace(/\s+/g, "_");
      cb(null, `${Date.now()}_${cleanName}`);
    },
  });

  const vaultUpload = multer({
    storage: vaultStorage,
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB Limit
  });

  // ✅ 1. UPLOAD TO VAULT (Admin Only)
  server.post(
    "/api/admin/vault/upload",
    verifyToken,
    vaultUpload.single("file"),
    async (req, res) => {
      try {
        if (req.user.role !== "admin")
          return res.status(403).json({ message: "Forbidden" });
        if (!req.file)
          return res.status(400).json({ message: "No file uploaded" });

        // We don't need a database record. The file system IS the record.
        res.json({ success: true, filename: req.file.filename });
      } catch (e) {
        console.error("Vault Upload Error:", e);
        res.status(500).json({ error: e.message });
      }
    },
  );

  // ✅ 2. LIST VAULT FILES (Admin Only)
  server.get("/api/admin/vault/files", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin")
        return res.status(403).json({ message: "Forbidden" });

      const files = await fs.promises.readdir(VAULT_DIR);

      const fileData = await Promise.all(
        files.map(async (file) => {
          const stats = await fs.promises.stat(path.join(VAULT_DIR, file));
          return {
            name: file,
            size: stats.size,
            createdAt: stats.birthtime,
            // This URL is the "Tunnel" link
            url: `/api/secure-vault/${file}`,
          };
        }),
      );

      // Sort newest first
      fileData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      res.json({ success: true, files: fileData });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // =========================================================================
  // 🎓 STUDENT API: THE WRITTEN EXAM MATRIX (View & Upload)
  // =========================================================================

  // 1. SECURE VIEWER (The Gatekeeper)
  server.get("/api/student/written/view/:id", verifyToken, async (req, res) => {
    try {
      const quiz = await WrittenQuiz.findByPk(req.params.id);
      if (!quiz) return res.status(404).json({ message: "Exam unavailable" });

      const previousResult = await WrittenResult.findOne({
        where: { quizId: quiz.id, studentId: req.user.id },
      });

      if (previousResult) {
        return res.json({
          id: quiz.id,
          title: quiz.title,
          totalMarks: quiz.totalMarks,
          previousResult: {
            status: previousResult.gradingStatus,
            score: previousResult.score,
            feedback: previousResult.feedback,
            fileUrls: previousResult.fileUrls, // 🚀 THE FIX: Send the graded images back to the student!
          },
        });
      }

      res.json({
        id: quiz.id,
        title: quiz.title,
        pdfFile: quiz.pdfFile,
        readyTime: quiz.readyTime,
        timeLimit: quiz.timeLimit,
        uploadGraceTime: quiz.uploadGraceTime,
        totalMarks: quiz.totalMarks,
        startTime: quiz.startTime,
        status: quiz.status,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 2. THE DROPZONE RECEIVER (Accepts up to 10 files)
  server.post(
    "/api/student/written/submit",
    verifyToken,
    uploadWritten.array("answers", 30),
    async (req, res) => {
      try {
        const studentId = req.user.id;
        const { quizId } = req.body;
        const files = req.files;

        if (!files || files.length === 0)
          return res.status(400).json({ message: "No files detected!" });

        const fileUrls = files.map(
          (f) => `/uploads/written-answers/${f.filename}`,
        );

        // 🚀 THE FIX: Check if they ignited the engine first
        const existing = await WrittenResult.findOne({
          where: { studentId, quizId },
        });

        if (existing) {
          // If the array isn't empty, they already uploaded actual photos. Block the hacker!
          if (existing.fileUrls && existing.fileUrls !== "[]") {
            return res
              .status(400)
              .json({ message: "You have already submitted this exam!" });
          }
          // Otherwise, they just ignited the timer earlier. Update their row with the photos!
          existing.fileUrls = JSON.stringify(fileUrls);
          existing.gradingStatus = "pending";
          await existing.save();
        } else {
          // Failsafe in case they somehow skipped ignition
          await WrittenResult.create({
            studentId,
            quizId,
            fileUrls: JSON.stringify(fileUrls),
            gradingStatus: "pending",
          });
        }

        res.json({
          success: true,
          message: "Answer script secured in the Vault!",
        });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 🚀 THE PERSONAL IGNITION SWITCH API
  server.post("/api/student/written/ignite", verifyToken, async (req, res) => {
    try {
      const { quizId } = req.body;

      let attempt = await WrittenResult.findOne({
        where: { quizId, studentId: req.user.id },
      });

      if (!attempt) {
        attempt = await WrittenResult.create({
          quizId,
          studentId: req.user.id,
          gradingStatus: "pending", // 🚀 THE FIX: Must match DB ENUM perfectly!
          fileUrls: "[]", // 🚀 THE FIX: Must match actual DB column name!
        });
      }

      res.json({ personalStartTime: attempt.createdAt });
    } catch (error) {
      console.error("Ignition Error:", error);
      res.status(500).json({ error: "Failed to ignite personal timer" });
    }
  });

  // ✅ 3. DELETE FROM VAULT (Deletes from VPS + Cleans Database)
  server.delete(
    "/api/admin/vault/files/:filename",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin")
          return res.status(403).json({ message: "Forbidden" });

        const filename = req.params.filename;
        const filePath = path.join(VAULT_DIR, filename);

        // 1. DELETE FROM VPS DISK (Physical Deletion)
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }

        // 2. DETACH FROM VIDEOS (Prevents "File Not Found" errors for students)
        // This finds any video using this PDF and sets its pdfFile to NULL
        await Content.update(
          { pdfFile: null },
          { where: { pdfFile: filename } },
        );
        // DETACH FROM PAST PAPERS
        await PastPaperFile.destroy({ where: { pdfFile: filename } });

        io.emit("content_updated"); // Refresh dashboards
        res.json({ success: true });
      } catch (e) {
        console.error("Delete Error:", e);
        res.status(500).json({ error: e.message });
      }
    },
  );

  // ✅ 3.5 RENAME VAULT FILE (Updates VPS + Database Links)
  server.put("/api/admin/vault/files/rename", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin")
        return res.status(403).json({ message: "Forbidden" });

      const { oldFilename, newFilename } = req.body;
      if (!oldFilename || !newFilename)
        return res.status(400).json({ message: "Missing filenames" });

      const oldPath = path.join(VAULT_DIR, oldFilename);

      // Security check: Make sure the old file actually exists
      if (!oldPath.startsWith(VAULT_DIR) || !fs.existsSync(oldPath)) {
        return res.status(404).json({ message: "Original file not found" });
      }

      // Format the new name cleanly
      const ext = path.extname(oldFilename);
      let safeNewName = newFilename
        .trim()
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .replace(/\s+/g, "_");

      // Make sure the extension stays attached
      if (!safeNewName.toLowerCase().endsWith(ext.toLowerCase())) {
        safeNewName += ext;
      }

      const newPath = path.join(VAULT_DIR, safeNewName);

      // Prevent accidental overwriting of another file
      if (fs.existsSync(newPath)) {
        return res
          .status(400)
          .json({ message: "A file with this name already exists" });
      }

      // 1. Rename the physical file on the VPS hard drive
      await fs.promises.rename(oldPath, newPath);

      // 2. MAGIC: Update all database records so links don't break!
      await Content.update(
        { pdfFile: safeNewName },
        { where: { pdfFile: oldFilename } },
      );
      await PastPaperFile.update(
        { pdfFile: safeNewName },
        { where: { pdfFile: oldFilename } },
      );

      io.emit("content_updated");
      res.json({ success: true, newFilename: safeNewName });
    } catch (e) {
      console.error("Rename Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================
  // 🛡️ FIREWALL CONTROL ROUTES (Admin Only)
  // ==========================================
  server.get("/api/admin/firewall", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin") return res.status(403).send("Forbidden");
      const rules = await FirewallRule.findAll({ order: [["id", "ASC"]] });
      res.json(rules);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  server.post("/api/admin/firewall/toggle", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin") return res.status(403).send("Forbidden");
      const { key, isActive } = req.body;

      await FirewallRule.update({ isActive }, { where: { key } });
      await refreshFirewallCache(); // Instantly update the live shield

      await SecurityLog.create({
        event: "FIREWALL UPDATE",
        description: `Rule '${key}' turned ${isActive ? "ON" : "OFF"}`,
        ip_address: req.ip || req.connection.remoteAddress,
        severity: "medium",
      });

      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ✅ 4. THE GATEKEEPER (Serves files ONLY to logged-in users)
  const serveSecureVaultFile = async (req, res) => {
    try {
      const rawInput = String(
        req.params.filename || req.params[0] || "",
      ).trim();
      console.log("[SECURE-VAULT] rawInput:", rawInput);
      if (!rawInput) {
        console.log("[SECURE-VAULT] No rawInput, returning 404");
        return res.status(404).send("File Not Found");
      }

      let decodedInput = rawInput;
      try {
        decodedInput = decodeURIComponent(rawInput);
      } catch {
        decodedInput = rawInput;
      }
      console.log("[SECURE-VAULT] decodedInput:", decodedInput);

      const normalizedInput = decodedInput
        .replace(/\\/g, "/")
        .replace(/^\/+/, "");
      console.log("[SECURE-VAULT] normalizedInput:", normalizedInput);

      const filenameVariants = Array.from(
        new Set(
          [
            normalizedInput,
            normalizedInput.replace(/^api\/secure-vault\//i, ""),
            normalizedInput.replace(/^secure-vault\//i, ""),
            path.basename(normalizedInput),
          ].filter(Boolean),
        ),
      );
      console.log("[SECURE-VAULT] filenameVariants:", filenameVariants);

      const baseVaultDir = path.resolve(VAULT_DIR);
      let resolvedPath = null;
      let resolvedName = null;

      for (const candidateName of filenameVariants) {
        const candidatePath = path.resolve(baseVaultDir, candidateName);
        console.log(
          `[SECURE-VAULT] Checking candidate: ${candidateName} => ${candidatePath}`,
        );

        // Security: Prevent Directory Traversal attacks (e.g. ../../etc/passwd)
        if (
          candidatePath !== baseVaultDir &&
          !candidatePath.startsWith(baseVaultDir + path.sep)
        ) {
          console.log(`[SECURE-VAULT] Skipped (security): ${candidatePath}`);
          continue;
        }

        if (fs.existsSync(candidatePath)) {
          console.log(`[SECURE-VAULT] FOUND: ${candidatePath}`);
          resolvedPath = candidatePath;
          resolvedName = candidateName;
          break;
        } else {
          console.log(`[SECURE-VAULT] Not found: ${candidatePath}`);
        }
      }

      if (!resolvedPath) {
        console.log("[SECURE-VAULT] No resolvedPath, returning 404");
        return res.status(404).send("File Not Found");
      }

      // Determine Content Type
      const ext = path.extname(resolvedName || "").toLowerCase();
      let contentType = "application/octet-stream";
      if (ext === ".pdf") contentType = "application/pdf";
      if (ext === ".jpg" || ext === ".jpeg") contentType = "image/jpeg";
      if (ext === ".png") contentType = "image/png";

      // 🛑 Anti-Download Headers (Browsers won't cache it easily)

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate",
      );
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      // Add Content-Length and Accept-Ranges for large file streaming
      try {
        const stat = fs.statSync(resolvedPath);
        res.setHeader("Content-Length", stat.size);
        res.setHeader("Accept-Ranges", "bytes");
      } catch (e) {
        console.warn(
          "[SECURE-VAULT] Could not set Content-Length/Accept-Ranges",
          e,
        );
      }

      // Stream the file
      const stream = fs.createReadStream(resolvedPath);
      stream.pipe(res);
    } catch (e) {
      console.error("Secure Vault Error:", e);
      res.status(500).send("Internal Server Error");
    }
  };

  server.get("/api/secure-vault/*", verifyToken, serveSecureVaultFile);
  server.get("/api/secure-vault/:filename", verifyToken, serveSecureVaultFile);

  // --- 🖥️ REAL-TIME SERVER MONITOR ---

  // Helper: CPU Load
  function getCpuUsage() {
    return new Promise((resolve) => {
      const start = os.cpus();
      setTimeout(() => {
        const end = os.cpus();
        let idle = 0;
        let total = 0;
        for (let i = 0; i < start.length; i++) {
          const cpu1 = start[i].times;
          const cpu2 = end[i].times;
          idle += cpu2.idle - cpu1.idle;
          for (let type in cpu1) total += cpu2[type] - cpu1[type];
        }
        resolve(total === 0 ? 0 : 100 - Math.round((100 * idle) / total));
      }, 100);
    });
  }

  // Helper: Disk Space
  function getDiskUsage() {
    return new Promise((resolve) => {
      if (process.platform === "win32")
        return resolve({ percent: 0, used: "0GB", total: "100GB" });
      exec("df -h /", (err, stdout) => {
        if (err) return resolve({ percent: 0, used: "0", total: "0" });
        const lines = stdout.trim().split("\n");
        const diskLine = lines[lines.length - 1]
          .replace(/\s+/g, " ")
          .split(" ");
        resolve({
          total: diskLine[1],
          used: diskLine[2],
          percent: parseInt(diskLine[4].replace("%", "")),
        });
      });
    });
  }

  // --- 🩺 ADVANCED SERVER MONITOR (With Speed Calculation) ---
  let prevNet = { rx: 0, tx: 0, pRx: 0, pTx: 0, dRx: 0, dTx: 0 };
  let prevDisk = { read: 0, write: 0 };
  let publicIp = "Loading...";

  // Fetch Public IP Once on Start
  fetch("https://api.ipify.org?format=json")
    .then((r) => r.json())
    .then((d) => (publicIp = d.ip))
    .catch(() => {});

  // Helper: Parse /proc/net/dev for Network Stats
  const getNetStats = () => {
    try {
      const data = fs.readFileSync("/proc/net/dev", "utf8");
      const lines = data.split("\n");
      // Find non-loopback interface (usually eth0 or ens3)
      const line = lines.find((l) => l.includes(":") && !l.includes("lo"));
      if (!line) return null;

      const parts = line.split(":")[1].trim().split(/\s+/);
      return {
        rx: parseInt(parts[0]), // Bytes Received
        tx: parseInt(parts[8]), // Bytes Sent
        pRx: parseInt(parts[1]), // Packets Received
        pTx: parseInt(parts[9]), // Packets Sent
        dRx: parseInt(parts[3]), // Drops In
        dTx: parseInt(parts[11]), // Drops Out
      };
    } catch (e) {
      return null;
    }
  };

  // Helper: Parse /proc/diskstats for Disk I/O
  const getDiskIo = () => {
    try {
      const data = fs.readFileSync("/proc/diskstats", "utf8");
      const lines = data.split("\n");
      // Find primary drive (vda, sda, or nvme0n1)
      const line = lines.find((l) => l.match(/(vda|sda|nvme0n1)\s/));
      if (!line) return null;

      const parts = line.trim().split(/\s+/);
      return {
        read: parseInt(parts[5]), // Sectors Read
        write: parseInt(parts[9]), // Sectors Written
      };
    } catch (e) {
      return null;
    }
  };

  // ... existing imports ...
  // Make sure 'fs' is imported at the top: import fs from 'fs';

  // 🚀 THE PULSE (Every 2 Seconds)
  setInterval(async () => {
    // 1. CPU
    const cpu = await new Promise((resolve) => {
      const start = os.cpus();
      setTimeout(() => {
        const end = os.cpus();
        let idle = 0,
          total = 0;
        for (let i = 0; i < start.length; i++) {
          const cpu1 = start[i].times;
          const cpu2 = end[i].times;
          idle += cpu2.idle - cpu1.idle;
          for (let type in cpu1) total += cpu2[type] - cpu1[type];
        }
        resolve(total === 0 ? 0 : 100 - Math.round((100 * idle) / total));
      }, 100);
    });

    // 2. Memory & Network
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const currNet = getNetStats();
    let netSpeed = { rx: 0, tx: 0 };
    if (currNet && prevNet.rx > 0) {
      netSpeed.rx = (currNet.rx - prevNet.rx) / 2;
      netSpeed.tx = (currNet.tx - prevNet.tx) / 2;
    }
    if (currNet) prevNet = currNet;

    // 3. Disk Speed
    const currDisk = getDiskIo();
    let diskSpeed = { read: 0, write: 0 };
    if (currDisk && prevDisk.read > 0) {
      diskSpeed.read = ((currDisk.read - prevDisk.read) * 512) / 2;
      diskSpeed.write = ((currDisk.write - prevDisk.write) * 512) / 2;
    }
    if (currDisk) prevDisk = currDisk;

    // --- LOG STREAMING ---
    let recentLogs = [];
    try {
      const logData = fs.readFileSync(
        "/root/.pm2/logs/sftbeta-out.log",
        "utf8",
      );
      const lines = logData.trim().split("\n");
      recentLogs = lines.slice(-20);
    } catch (e) {
      recentLogs = ["Waiting for logs..."];
    }

    // 5. Build Stats Object (NO IPS)
    const stats = {
      os: `${os.type()} ${os.release()}`,
      kernel: os.release(),
      uptime: os.uptime(),
      cores: os.cpus().length,
      cpuFreq: os.cpus()[0].speed,
      cpu: cpu,
      ram: {
        total: (totalMem / 1024 / 1024 / 1024).toFixed(2) + " GB",
        used: (usedMem / 1024 / 1024 / 1024).toFixed(2) + " GB",
        percent: Math.round((usedMem / totalMem) * 100),
      },
      net: {
        rxSpeed: (netSpeed.rx / 1024).toFixed(2),
        txSpeed: (netSpeed.tx / 1024).toFixed(2),
        pRx: currNet ? currNet.pRx : 0,
        pTx: currNet ? currNet.pTx : 0,
        dRx: currNet ? currNet.dRx : 0,
        dTx: currNet ? currNet.dTx : 0,
        ip: publicIp,
      },
      diskIo: {
        read: (diskSpeed.read / 1024 / 1024).toFixed(2),
        write: (diskSpeed.write / 1024 / 1024).toFixed(2),
      },
      socketCount: typeof onlineUsers !== "undefined" ? onlineUsers.size : 0,
      logs: recentLogs, // Logs only, no IPs
    };

    io.to("admin_room").emit("server_health_pulse", stats);
  }, 2000);

  // ==========================================
  // ✅ SFT KING MCQ SYSTEM - API ROUTES
  // ==========================================

  // 1. GET MCQ FOLDERS (Admin & Student)
  server.get("/api/mcq/folders", verifyToken, async (req, res) => {
    try {
      const parentId =
        req.query.parentId && req.query.parentId !== "null"
          ? req.query.parentId
          : null;
      const folders = await McqFolder.findAll({
        where: { parentId },
        order: [["createdAt", "ASC"]],
      });

      // 🚀 THE FIX: Filter Folders by Student Batch!
      if (req.user.role === "student") {
        const user = await User.findByPk(req.user.id);
        const userBatch = user ? user.batch : null;

        const filteredFolders = folders.filter((f) => {
          try {
            const batches = JSON.parse(f.batches || '["All"]');
            return batches.includes("All") || batches.includes(userBatch);
          } catch (e) {
            return true;
          }
        });
        return res.json(filteredFolders);
      }

      res.json(folders);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 2. GET MCQ QUIZZES IN FOLDER
  server.get("/api/mcq/quizzes", verifyToken, async (req, res) => {
    try {
      const folderId =
        req.query.folderId === "null" ? null : req.query.folderId;
      const quizzes = await McqQuiz.findAll({
        where: { folderId },
        order: [["createdAt", "DESC"]],
      });

      if (req.user.role === "student") {
        // 🚀 THE FIX: Same safety check here!
        const user = await User.findByPk(req.user.id);
        const userBatch = user && user.batch ? user.batch : "All";

        const results = await McqResult.findAll({
          where: { studentId: req.user.id },
        });
        const completedQuizIds = results.map((r) => r.quizId);

        const data = quizzes
          .filter((q) => {
            try {
              const batches = JSON.parse(q.batches || '["All"]');
              return batches.includes("All") || batches.includes(userBatch);
            } catch (e) {
              return true;
            }
          })
          .map((q) => {
            const qData = q.toJSON();
            delete qData.answerKey;
            qData.isCompleted = completedQuizIds.includes(qData.id);
            return qData;
          });
        return res.json(data);
      }

      res.json(quizzes);
    } catch (e) {
      console.error("MCQ Quizzes Fetch Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // 3. CREATE FOLDER (Admin)
  server.post("/api/admin/mcq/folders", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin") return res.status(403).send("Forbidden");
      const { name, batches, parentId } = req.body;

      await McqFolder.create({
        name,
        batches: JSON.stringify(
          batches && batches.length > 0 ? batches : ["All"],
        ),
        parentId: parentId || null,
      });
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 4. CREATE MCQ QUIZ
  server.post("/api/admin/mcq/quizzes", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin") return res.status(403).send("Forbidden");
      const {
        title,
        folderId,
        pdfFile,
        answerKey,
        timeLimit,
        readyTime,
        totalQuestions,
        batches,
        startTime,
        endTime,
        status,
      } = req.body;
      if (!pdfFile || !answerKey)
        return res.status(400).json({ message: "PDF and Answer Key required" });

      const createdQuiz = await McqQuiz.create({
        title,
        folderId,
        pdfFile,
        answerKey: JSON.stringify(answerKey),
        timeLimit: timeLimit || 60,
        readyTime: readyTime || 0,
        totalQuestions: totalQuestions || 10,
        batches: batches ? JSON.stringify(batches) : '["All"]',
        startTime: startTime || null,
        endTime: endTime || null,
        status: status || "live",
      });

      if (createdQuiz.status === "scheduled") {
        sendMcqScheduledNotifications({
          quiz: createdQuiz,
          trigger: "created",
        }).catch((error) => {
          console.error(
            "[MCQ NOTIFY] Create schedule notification error:",
            error?.message || error,
          );
        });
      }

      io.emit("mcq_updated");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 1. DELETE MCQ FOLDER (Cascading Nuke)
  server.delete("/api/admin/mcq/folders/:id", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin") return res.status(403).send("Forbidden");
      const targetFolderId = parseInt(req.params.id);

      // Find all quizzes inside the folder
      const quizzesToDelete = await McqQuiz.findAll({
        where: { folderId: targetFolderId },
      });
      const quizIds = quizzesToDelete.map((q) => q.id);

      if (quizIds.length > 0) {
        // Nuke all student leaderboard results FIRST
        await McqResult.destroy({ where: { quizId: { [Op.in]: quizIds } } });
        // Nuke the quizzes
        await McqQuiz.destroy({ where: { folderId: targetFolderId } });
      }
      // Finally, nuke the folder
      await McqFolder.destroy({ where: { id: targetFolderId } });

      io.emit("mcq_updated");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 2. DELETE SINGLE MCQ EXAM
  server.delete("/api/admin/mcq/quizzes/:id", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin") return res.status(403).send("Forbidden");

      // Nuke student leaderboard results
      await McqResult.destroy({ where: { quizId: req.params.id } });
      await McqQuiz.destroy({ where: { id: req.params.id } });

      io.emit("mcq_updated");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  const getMcqTiming = ({
    quiz,
    attempt,
    nowMs = Date.now(),
    fallbackStartMs = null,
  }) => {
    const scheduledStartMs = quiz?.startTime
      ? new Date(quiz.startTime).getTime()
      : NaN;
    const attemptStartMs = attempt?.createdAt
      ? new Date(attempt.createdAt).getTime()
      : NaN;

    let startMs = null;
    let source = "attempt";

    if (quiz?.status === "scheduled" && Number.isFinite(scheduledStartMs)) {
      startMs = scheduledStartMs;
      source = "scheduled";
    } else if (Number.isFinite(attemptStartMs)) {
      startMs = attemptStartMs;
      source = "attempt";
    } else if (Number.isFinite(fallbackStartMs)) {
      startMs = fallbackStartMs;
      source = "fallback";
    } else {
      startMs = nowMs;
      source = "now";
    }

    const readyMs = Math.max(0, Number(quiz?.readyTime || 0)) * 60000;
    const timeLimitMs = Math.max(0, Number(quiz?.timeLimit || 60)) * 60000;
    const readyEndMs = startMs + readyMs;
    const examEndMs = readyEndMs + timeLimitMs;

    return {
      nowMs,
      startMs,
      readyEndMs,
      examEndMs,
      readyMs,
      timeLimitMs,
      source,
    };
  };

  const getMcqTimeUsedSeconds = (submittedMs, timing) => {
    if (!Number.isFinite(submittedMs) || !timing) return null;
    const writeStartMs = timing.readyEndMs;
    const maxWriteMs = timing.timeLimitMs;
    const usedMs = Math.max(0, submittedMs - writeStartMs);
    return Math.floor(Math.min(usedMs, maxWriteMs) / 1000);
  };

  // 7. 🚀 THE AUTO-GRADER ENGINE (Student Submit - Upgraded for "All Correct")
  server.post("/api/student/mcq/submit", verifyToken, async (req, res) => {
    try {
      const studentId = req.user.id;
      const { quizId, studentAnswers } = req.body;

      const quiz = await McqQuiz.findByPk(quizId);
      if (!quiz) return res.status(404).json({ message: "Quiz not found" });

      let attempt = await McqAttempt.findOne({ where: { quizId, studentId } });
      if (!attempt) {
        attempt = await McqAttempt.create({ quizId, studentId });
      }

      const nowMs = Date.now();
      const timing = getMcqTiming({ quiz, attempt, nowMs });
      const graceMs = 10000;
      if (
        Number.isFinite(timing.examEndMs) &&
        nowMs > timing.examEndMs + graceMs
      ) {
        return res.status(403).json({
          message: "Time limit expired.",
          code: "MCQ_TIME_EXPIRED",
          serverNowMs: nowMs,
          examEndMs: timing.examEndMs,
        });
      }

      const correctAnswers = JSON.parse(quiz.answerKey || "{}");
      // 🚀 THE FIX: Use the database number, NOT the answer key length!
      const totalQuestions =
        quiz.totalQuestions || Object.keys(correctAnswers).length;
      let score = 0;

      // 🚀 THE NEW GRADING MATRIX: Loops through ALL questions perfectly
      for (let i = 1; i <= totalQuestions; i++) {
        const correctAns = correctAnswers[i];
        // If the admin left it blank, it's undefined, so they get a bonus mark!
        if (!correctAns || correctAns === "") {
          score++;
        }
        // Otherwise, check if they got it right
        else if (String(studentAnswers[i]) === String(correctAns)) {
          score++;
        }
      }

      const result = await McqResult.create({
        studentId,
        quizId,
        score,
        totalQuestions,
        studentAnswers: JSON.stringify(studentAnswers),
      });

      const submittedMs = result?.createdAt
        ? new Date(result.createdAt).getTime()
        : nowMs;
      const timeUsedSeconds = getMcqTimeUsedSeconds(submittedMs, timing);
      const startedAtIso = Number.isFinite(timing.startMs)
        ? new Date(timing.startMs).toISOString()
        : null;
      const submittedAtIso = result?.createdAt
        ? new Date(result.createdAt).toISOString()
        : null;

      // Never expose answer keys to the client.
      res.json({
        success: true,
        score,
        totalQuestions,
        studentAnswers,
        timeUsedSeconds,
        startedAt: startedAtIso,
        submittedAt: submittedAtIso,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 8. GET QUIZ DETAILS FOR SECURE VIEWING (Student - God Tier Lockout)
  server.get("/api/student/mcq/view/:id", verifyToken, async (req, res) => {
    try {
      const quiz = await McqQuiz.findByPk(req.params.id);
      if (!quiz) return res.status(404).json({ message: "Quiz unavailable" });

      const correctAnswers = JSON.parse(quiz.answerKey || "{}");
      // 🚀 THE FIX: Tell the frontend the REAL total questions from the database!
      const totalQuestions =
        quiz.totalQuestions || Object.keys(correctAnswers).length;

      const nowMs = Date.now();

      const previousResult = await McqResult.findOne({
        where: { quizId: quiz.id, studentId: req.user.id },
      });

      // Persist a per-student MCQ attempt start time so timer resumes across devices.
      let attempt = await McqAttempt.findOne({
        where: { quizId: quiz.id, studentId: req.user.id },
      });

      if (!previousResult && !attempt) {
        attempt = await McqAttempt.create({
          quizId: quiz.id,
          studentId: req.user.id,
        });
      }

      const fallbackStartMs = previousResult?.createdAt
        ? new Date(previousResult.createdAt).getTime()
        : null;
      const timing = getMcqTiming({ quiz, attempt, nowMs, fallbackStartMs });
      const isClosedForReview =
        quiz.status === "ended" ||
        (quiz.status === "scheduled" && nowMs >= timing.examEndMs);
      const timingPayload = {
        serverNowMs: timing.nowMs,
        startMs: timing.startMs,
        readyEndMs: timing.readyEndMs,
        examEndMs: timing.examEndMs,
        writeStartMs: timing.readyEndMs,
        timeLimitMs: timing.timeLimitMs,
        readyMs: timing.readyMs,
        source: timing.source,
      };

      if (previousResult) {
        let parsedStudentAnswers = {};
        try {
          parsedStudentAnswers = JSON.parse(
            previousResult.studentAnswers || "{}",
          );
        } catch (e) {}

        const startedAtIso = Number.isFinite(timing.startMs)
          ? new Date(timing.startMs).toISOString()
          : null;
        const submittedAtIso = previousResult.createdAt
          ? new Date(previousResult.createdAt).toISOString()
          : null;
        const submittedMs = submittedAtIso
          ? new Date(submittedAtIso).getTime()
          : NaN;
        const timeUsedSeconds = getMcqTimeUsedSeconds(submittedMs, timing);

        return res.json({
          id: quiz.id,
          title: quiz.title,
          pdfFile: quiz.pdfFile,
          timeLimit: quiz.timeLimit,
          readyTime: quiz.readyTime,
          personalStartTime: attempt ? attempt.createdAt : null,
          startTime: quiz.startTime,
          status: quiz.status,
          totalQuestions: totalQuestions, // 🚀 Now sends the correct number
          timing: timingPayload,
          previousResult: {
            score: previousResult.score,
            totalQuestions: previousResult.totalQuestions,
            studentAnswers: parsedStudentAnswers,
            startedAt: startedAtIso,
            submittedAt: submittedAtIso,
            timeUsedSeconds,
            correctAnswers: isClosedForReview ? correctAnswers : undefined,
          },
        });
      }

      res.json({
        id: quiz.id,
        title: quiz.title,
        pdfFile: quiz.pdfFile,
        timeLimit: quiz.timeLimit,
        readyTime: quiz.readyTime,
        personalStartTime: attempt ? attempt.createdAt : null,
        totalQuestions: totalQuestions, // 🚀 Sends the correct number here too!
        startTime: quiz.startTime,
        status: quiz.status,
        timing: timingPayload,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 9. GET ALL QUIZZES FOR ADMIN RESULTS TAB
  server.get("/api/admin/mcq/all-quizzes", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin") return res.status(403).send("Forbidden");
      const quizzes = await McqQuiz.findAll({ order: [["createdAt", "DESC"]] });
      res.json(quizzes);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 10. GET LEADERBOARD RESULTS FOR A SPECIFIC QUIZ
  server.get(
    "/api/admin/mcq/results/:quizId",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");
        const quiz = await McqQuiz.findByPk(req.params.quizId);
        if (!quiz) return res.status(404).json({ message: "Quiz not found" });
        const results = await McqResult.findAll({
          where: { quizId: req.params.quizId },
          include: [{ model: User, attributes: ["name", "mobile"] }],
          order: [["score", "DESC"]],
        });

        const attempts = await McqAttempt.findAll({
          where: { quizId: req.params.quizId },
          attributes: ["studentId", "createdAt"],
        });

        const attemptStartMap = new Map();
        for (const a of attempts) {
          const sid = String(a.studentId);
          const startedAt = a.createdAt
            ? new Date(a.createdAt).toISOString()
            : null;
          if (!attemptStartMap.has(sid)) {
            attemptStartMap.set(sid, startedAt);
          }
        }

        const payload = results.map((r) => {
          const row = r.toJSON ? r.toJSON() : r;
          const submittedMs = row?.createdAt
            ? new Date(row.createdAt).getTime()
            : NaN;
          const attemptStartedAt =
            attemptStartMap.get(String(row.studentId)) || null;
          const timing = getMcqTiming({
            quiz,
            attempt: attemptStartedAt ? { createdAt: attemptStartedAt } : null,
            nowMs: Number.isFinite(submittedMs) ? submittedMs : Date.now(),
            fallbackStartMs: Number.isFinite(submittedMs) ? submittedMs : null,
          });
          const timeUsedSeconds = getMcqTimeUsedSeconds(submittedMs, timing);
          return {
            ...row,
            attemptStartedAt: Number.isFinite(timing.startMs)
              ? new Date(timing.startMs).toISOString()
              : null,
            writeStartedAt: Number.isFinite(timing.readyEndMs)
              ? new Date(timing.readyEndMs).toISOString()
              : null,
            timeUsedSeconds,
          };
        });

        res.json(payload);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 10.1. GET ARCHIVED RESULTS FOR A SPECIFIC QUIZ (PAST CYCLES)
  server.get(
    "/api/admin/mcq/results-history/:quizId",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");

        const history = await McqResultHistory.findAll({
          where: { quizId: req.params.quizId },
          include: [{ model: User, attributes: ["name", "mobile"] }],
          order: [
            ["archivedAt", "DESC"],
            ["score", "DESC"],
          ],
        });

        res.json(history);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 11. EDIT FOLDER
  server.put("/api/admin/mcq/folders/:id", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin") return res.status(403).send("Forbidden");
      const folder = await McqFolder.findByPk(req.params.id);
      if (!folder) return res.status(404).send("Not found");
      folder.name = req.body.name;
      await folder.save();
      res.json(folder);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  /// 12. EDIT QUIZ (Upgraded with God-Tier Real-Time Sockets)
  server.put("/api/admin/mcq/quizzes/:id", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin") return res.status(403).send("Forbidden");
      const quiz = await McqQuiz.findByPk(req.params.id);
      if (!quiz) return res.status(404).send("Not found");

      const prevStatus = quiz.status;
      const prevStartMs = quiz.startTime
        ? new Date(quiz.startTime).getTime()
        : null;
      const nextStatus =
        req.body.status !== undefined ? req.body.status : quiz.status;
      const nextStartMs =
        req.body.startTime !== undefined
          ? req.body.startTime
            ? new Date(req.body.startTime).getTime()
            : null
          : prevStartMs;

      const hasStartChanged = (prevStartMs ?? null) !== (nextStartMs ?? null);
      const shouldResetForReschedule =
        nextStatus === "scheduled" &&
        (hasStartChanged || prevStatus !== "scheduled");
      const shouldNotifyScheduledStudents =
        nextStatus === "scheduled" &&
        (hasStartChanged ||
          prevStatus !== "scheduled" ||
          req.body.batches !== undefined);

      quiz.title = req.body.title;
      quiz.pdfFile = req.body.pdfFile;
      quiz.timeLimit = req.body.timeLimit;

      // 🚀 Updating Ready Time & Total Questions
      if (req.body.readyTime !== undefined) quiz.readyTime = req.body.readyTime;
      if (req.body.totalQuestions !== undefined)
        quiz.totalQuestions = req.body.totalQuestions;

      // Update Scheduling Data
      if (req.body.batches) quiz.batches = JSON.stringify(req.body.batches);
      if (req.body.startTime !== undefined) quiz.startTime = req.body.startTime;
      if (req.body.status) quiz.status = req.body.status;

      if (req.body.answerKey) {
        quiz.answerKey =
          typeof req.body.answerKey === "string"
            ? req.body.answerKey
            : JSON.stringify(req.body.answerKey);
      }

      await quiz.save();

      if (shouldResetForReschedule) {
        const attempts = await McqAttempt.findAll({
          where: { quizId: quiz.id },
          attributes: ["studentId", "createdAt"],
        });

        const attemptStartMap = new Map();
        for (const a of attempts) {
          const sid = String(a.studentId);
          if (!attemptStartMap.has(sid)) {
            attemptStartMap.set(sid, a.createdAt || null);
          }
        }

        const resultsToArchive = await McqResult.findAll({
          where: { quizId: quiz.id },
          attributes: [
            "id",
            "studentId",
            "quizId",
            "score",
            "totalQuestions",
            "studentAnswers",
            "createdAt",
          ],
        });

        if (resultsToArchive.length > 0) {
          await McqResultHistory.bulkCreate(
            resultsToArchive.map((r) => ({
              studentId: r.studentId,
              quizId: r.quizId,
              score: r.score,
              totalQuestions: r.totalQuestions,
              studentAnswers: r.studentAnswers,
              attemptStartedAt:
                attemptStartMap.get(String(r.studentId)) || null,
              submittedAt: r.createdAt || null,
              archivedAt: new Date(),
              resetReason: "rescheduled",
              prevStatus,
              nextStatus,
              prevStartTime: prevStartMs ? new Date(prevStartMs) : null,
              nextStartTime: nextStartMs ? new Date(nextStartMs) : null,
            })),
          );
        }

        const oldResults = await McqResult.findAll({
          where: { quizId: quiz.id },
          attributes: ["id"],
        });

        const oldResultIds = oldResults.map((r) => r.id);
        if (oldResultIds.length > 0) {
          await Reaction.destroy({
            where: {
              engineType: "mcq",
              entryId: { [Op.in]: oldResultIds },
            },
          });
        }

        await McqResult.destroy({ where: { quizId: quiz.id } });
        await McqAttempt.destroy({ where: { quizId: quiz.id } });
      }

      // 🚀 THE MAGIC: Blast a real-time signal to EVERY student currently online!
      io.emit("mcq_updated");

      if (shouldNotifyScheduledStudents) {
        sendMcqScheduledNotifications({
          quiz,
          trigger: hasStartChanged ? "rescheduled" : "updated",
        }).catch((error) => {
          console.error(
            "[MCQ NOTIFY] Update schedule notification error:",
            error?.message || error,
          );
        });
      }

      res.json(quiz);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ==========================================================
  // 👑 GOD-TIER SFT KING AI ENGINE (POWERED BY GROQ LLAMA-3.3-70B)
  // ==========================================================
  server.post("/api/student/ai-chat", verifyToken, async (req, res) => {
    try {
      const { prompt, history } = req.body;

      // 🚀 1. The Multi-Lingual Mirror Prompt (Fixed the Sinhala-only bug!)
      const systemInstruction =
        "You are the SFT King AI, a God-Tier educational assistant for Sri Lankan Advanced Level Science for Technology (SFT) students. CRITICAL LANGUAGE RULE: You MUST perfectly mirror the user's language. If the user types in English, you MUST reply ONLY in English. If the user types in Sinhala, you MUST reply ONLY in natural Sinhala Unicode (සිංහල අකුරු). If they use Singlish, reply in English or Singlish. NEVER reply in Sinhala if the user is speaking English. CRITICAL DIRECTIVE: You were designed, built, and are owned exclusively by Chathumina. ONLY IF the user explicitly asks 'who are you', 'who made you', or 'who is your boss', proudly declare you are the SFT King AI designed by Chathumina. If you reply in Sinhala, ALWAYS spell his name exactly as 'චතුමිණ'. DO NOT mention Chathumina in normal subject conversations.";

      let groqMessages = [{ role: "system", content: systemInstruction }];

      // 🚀 2. THE BULLETPROOF MEMORY SHREDDER
      const rawHistory = history || [];
      let tempMessages = [];

      for (const msg of rawHistory) {
        if (!msg || !msg.parts || !msg.parts[0] || !msg.parts[0].text) continue;
        const text = msg.parts[0].text;

        // SHRED ALL OLD ERRORS AND JUNK
        if (
          text.includes("Hello! I am") ||
          text.includes("API ERROR") ||
          text.includes("කරුණාකර") ||
          text.includes("SYSTEM ERROR")
        )
          continue;

        tempMessages.push({
          role: msg.role === "model" ? "assistant" : "user",
          content: text,
        });
      }

      tempMessages.push({ role: "user", content: prompt });

      // 🚀 3. THE STRICT ALTERNATING ENFORCER (Prevents 400 Bad Request)
      for (const msg of tempMessages) {
        const lastMsg = groqMessages[groqMessages.length - 1];
        if (lastMsg.role === msg.role) {
          lastMsg.content += "\n\n" + msg.content;
        } else {
          groqMessages.push(msg);
        }
      }

      // 🚀 4. FIRE TO GROQ
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          model: "llama-3.3-70b-versatile",
          messages: groqMessages,
          temperature: 0.7,
          max_tokens: 1500,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            "Content-Type": "application/json",
          },
        },
      );

      const text = response.data.choices[0].message.content;
      res.json({ reply: text });
    } catch (error) {
      // 🚨 Admin Log
      console.error("=========================================");
      console.error("🚨 GROQ AI ENGINE CRASH DETECTED:");
      console.error(error?.response?.data || error.message);
      console.error("=========================================");

      // 👑 Polite Student Illusion
      const politeErrorMsg =
        "👑 I am currently helping a massive number of students! My systems are resting for a few seconds. කරුණාකර මොහොතකින් නැවත උත්සාහ කරන්න. (Please try again in a moment!)";
      res.status(500).json({ error: politeErrorMsg });
    }
  });

  // 8. GET ALL SUBMISSIONS FOR A SPECIFIC EXAM (CEO GRADING DESK)
  server.get(
    "/api/admin/written/results/:quizId",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");
        const results = await WrittenResult.findAll({
          where: { quizId: req.params.quizId },
          include: [{ model: User, attributes: ["id", "name", "mobile"] }],
          order: [["createdAt", "DESC"]],
        });
        res.json(results);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 9. SAVE A STUDENT'S GRADE (Admin)
  server.put(
    "/api/admin/written/results/:resultId",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");

        // 1. Catch the new Base64 image data from the frontend
        const {
          score,
          feedback,
          gradingStatus,
          gradedImageBase64,
          gradedImageIndex,
        } = req.body;

        // 2. Fetch the exact student submission from the database
        const submission = await WrittenResult.findByPk(req.params.resultId);
        if (!submission)
          return res
            .status(404)
            .json({ message: "Submission not found in the Matrix." });

        // Parse the existing array of image URLs (e.g., ["/uploads/written-answers/img1.jpg", ...])
        let currentFiles = JSON.parse(submission.fileUrls || "[]");

        // 📸 3. DID THE CEO DRAW ON THE PAPER?
        if (gradedImageBase64) {
          // Strip the weird HTML tag from the beginning of the Base64 string
          const base64Data = gradedImageBase64.replace(
            /^data:image\/\w+;base64,/,
            "",
          );

          // Convert the raw text back into a physical image buffer
          const buffer = Buffer.from(base64Data, "base64");

          // Create a brand new, highly official filename
          const newFileName = `GRADED_${submission.id}_page_${gradedImageIndex}_${Date.now()}.jpg`;

          // Save the physical file to your local 'uploads/written-answers' folder!
          const filePath = path.join(
            __dirname,
            "uploads",
            "written-answers",
            newFileName,
          );
          fs.writeFileSync(filePath, buffer);

          // 🤯 THE MAGIC TRICK:
          // Replace the original blank photo with the newly GRADED photo URL in the array!
          currentFiles[gradedImageIndex] =
            `/uploads/written-answers/${newFileName}`;
        }

        // 4. Update the database record!
        submission.score = score;
        submission.feedback = feedback;
        submission.gradingStatus = gradingStatus;
        submission.fileUrls = JSON.stringify(currentFiles); // Save the updated array back!

        await submission.save();

        res.json({
          success: true,
          message: "Graded successfully!",
          submission,
        });
      } catch (error) {
        console.error("Grading save error:", error);
        res.status(500).json({ error: error.message });
      }
    },
  );

  // 10. PUBLISH ALL GRADES AT ONCE! (The Hype Button)
  server.put(
    "/api/admin/written/quizzes/:quizId/publish",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");
        // Only publish the ones that you actually graded!
        await WrittenResult.update(
          { gradingStatus: "published" },
          { where: { quizId: req.params.quizId, gradingStatus: "graded" } },
        );
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 11. GET ALL WRITTEN QUIZZES FOR ADMIN RESULTS TAB (CEO GRADING DESK DROPDOWN)
  server.get(
    "/api/admin/written/all-quizzes",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");
        const quizzes = await WrittenQuiz.findAll({
          order: [["createdAt", "DESC"]],
        });
        res.json(quizzes);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );
  // =========================================================================
  // 🚜 PHASE 2: THE WRITTEN VAULT API ENGINE (STRUCTURE + ESSAY)
  // =========================================================================

  // 1. GET WRITTEN FOLDERS
  server.get("/api/written/folders", verifyToken, async (req, res) => {
    try {
      const parentId =
        req.query.parentId === "null" ? null : req.query.parentId;
      const folders = await WrittenFolder.findAll({ where: { parentId } });

      // 🚀 THE FIX: Filter Written Folders by Student Batch!
      if (req.user.role === "student") {
        const user = await User.findByPk(req.user.id);
        const userBatch = user ? user.batch : null;

        const filteredFolders = folders.filter((f) => {
          try {
            const batches = JSON.parse(f.batches || '["All"]');
            return batches.includes("All") || batches.includes(userBatch);
          } catch (e) {
            return true;
          }
        });
        return res.json(filteredFolders);
      }

      res.json(folders);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 2. CREATE WRITTEN FOLDER (Admin)
  server.post("/api/admin/written/folders", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin") return res.status(403).send("Forbidden");
      const folder = await WrittenFolder.create({
        name: req.body.name,
        parentId: req.body.parentId || null,
      });
      res.json(folder);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 3. EDIT & DELETE WRITTEN FOLDERS (Admin)
  server.put(
    "/api/admin/written/folders/:id",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");
        await WrittenFolder.update(
          { name: req.body.name },
          { where: { id: req.params.id } },
        );
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 4. GET WRITTEN QUIZZES (For a specific folder)
  server.get("/api/written/quizzes", verifyToken, async (req, res) => {
    try {
      const folderId =
        req.query.folderId === "null" ? null : req.query.folderId;
      const quizzes = await WrittenQuiz.findAll({
        where: { folderId },
        order: [["createdAt", "DESC"]],
      });

      if (req.user.role === "student") {
        // 🚀 THE FIX: Safety check! If the user object fails to load from the DB, fallback gracefully to "All"
        const user = await User.findByPk(req.user.id);
        const userBatch = user && user.batch ? user.batch : "All";

        const results = await WrittenResult.findAll({
          where: { studentId: req.user.id },
        });

        const data = quizzes
          .filter((q) => {
            try {
              const batches = JSON.parse(q.batches || '["All"]');
              return batches.includes("All") || batches.includes(userBatch);
            } catch (e) {
              return true;
            }
          })
          .map((q) => {
            const qData = q.toJSON();
            const attempt = results.find((r) => r.quizId === qData.id);
            qData.isCompleted = !!attempt;

            if (attempt && attempt.gradingStatus === "published") {
              qData.publishedScore = attempt.score;
            } else {
              qData.publishedScore = null;
            }
            return qData;
          });
        return res.json(data);
      }

      res.json(quizzes);
    } catch (e) {
      console.error("Written Quizzes Fetch Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // 11. GET ALL WRITTEN QUIZZES FOR ADMIN RESULTS TAB (CEO GRADING DESK DROPDOWN)
  server.get(
    "/api/admin/written/all-quizzes",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");
        const quizzes = await WrittenQuiz.findAll({
          order: [["createdAt", "DESC"]],
        });
        res.json(quizzes);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 6. EDIT WRITTEN EXAM (Admin)
  server.put(
    "/api/admin/written/quizzes/:id",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");
        const quiz = await WrittenQuiz.findByPk(req.params.id);
        if (!quiz) return res.status(404).send("Not found");

        // Update all the God-Tier variables
        Object.assign(quiz, req.body);
        if (req.body.batches) quiz.batches = JSON.stringify(req.body.batches);

        await quiz.save();
        io.emit("written_updated");
        res.json(quiz);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 3. EDIT & DELETE WRITTEN FOLDERS (Admin - 🚀 NOW WITH DEEP CASCADING DELETE)
  server.put(
    "/api/admin/written/folders/:id",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");
        await WrittenFolder.update(
          { name: req.body.name },
          { where: { id: req.params.id } },
        );
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 3. DELETE WRITTEN FOLDER (Cascading Nuke + Physical Image Wipe)
  server.delete(
    "/api/admin/written/folders/:id",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");
        const targetFolderId = parseInt(req.params.id);

        const quizzesToDelete = await WrittenQuiz.findAll({
          where: { folderId: targetFolderId },
        });
        const quizIds = quizzesToDelete.map((q) => q.id);

        if (quizIds.length > 0) {
          // 🚀 PHYSICAL WIPE: Delete all uploaded images from the server to save space!
          const results = await WrittenResult.findAll({
            where: { quizId: { [Op.in]: quizIds } },
          });
          for (const r of results) {
            let fileUrls = [];
            try {
              fileUrls = JSON.parse(r.fileUrls || r.answers || "[]");
            } catch (e) {}
            for (const url of fileUrls) {
              const filename = path.basename(url);
              const filePath = path.join(writtenAnswersDir, filename);
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
          }
          // Nuke student leaderboard results
          await WrittenResult.destroy({
            where: { quizId: { [Op.in]: quizIds } },
          });
          await WrittenQuiz.destroy({ where: { folderId: targetFolderId } });
        }
        await WrittenFolder.destroy({ where: { id: targetFolderId } });

        io.emit("written_updated");
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 4. DELETE SINGLE WRITTEN EXAM (Physical Image Wipe + DB Nuke)
  server.delete(
    "/api/admin/written/quizzes/:id",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");
        const quizId = req.params.id;

        // 🚀 PHYSICAL WIPE: Delete uploaded images from the VPS
        const results = await WrittenResult.findAll({ where: { quizId } });
        for (const r of results) {
          let fileUrls = [];
          try {
            fileUrls = JSON.parse(r.fileUrls || r.answers || "[]");
          } catch (e) {}
          for (const url of fileUrls) {
            const filename = path.basename(url);
            const filePath = path.join(writtenAnswersDir, filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }
        }

        // Nuke student leaderboard results
        await WrittenResult.destroy({ where: { quizId } });
        await WrittenQuiz.destroy({ where: { id: quizId } });

        io.emit("written_updated");
        res.json({ success: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 🚀 CREATE WRITTEN EXAM MATRIX
  server.post("/api/admin/written/quizzes", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin") return res.status(403).send("Forbidden");
      const {
        title,
        folderId,
        pdfFile,
        readyTime,
        timeLimit,
        uploadGraceTime,
        totalMarks,
        batches,
        startTime,
        endTime,
        status,
      } = req.body;
      if (!pdfFile)
        return res.status(400).json({ message: "PDF Vault File is required" });

      await WrittenQuiz.create({
        title,
        folderId: folderId || null,
        pdfFile,
        readyTime: readyTime || 5,
        timeLimit: timeLimit || 120,
        uploadGraceTime: uploadGraceTime || 10,
        totalMarks: totalMarks || 100,
        batches: batches ? JSON.stringify(batches) : '["All"]',
        startTime: startTime || null,
        endTime: endTime || null,
        status: status || "scheduled",
      });

      io.emit("written_updated");
      res.json({ success: true });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // 🚀 STUDENT DROPZONE: Receive Written Exam Uploads
  server.post(
    "/api/student/written/submit",
    verifyToken,
    upload.array("answers", 10),
    async (req, res) => {
      try {
        const { quizId } = req.body;
        const userId = req.user.id;

        // 1. Safety Checks
        if (!quizId)
          return res
            .status(400)
            .json({ message: "Missing Exam ID in Matrix." });
        if (!req.files || req.files.length === 0) {
          return res
            .status(400)
            .json({ message: "No answer scripts were detected!" });
        }

        // 2. Map all the securely uploaded file names into an array
        const uploadedFiles = req.files.map((file) => file.filename);

        // 3. Check if the student already submitted (Anti-Cheat)
        const existingSubmission = await WrittenResult.findOne({
          where: { userId, quizId },
        });
        if (existingSubmission) {
          return res.status(400).json({
            message: "Vault Violation: You have already submitted this exam.",
          });
        }

        // 4. Lock it into the database!
        await WrittenResult.create({
          userId: userId,
          quizId: quizId,
          answers: JSON.stringify(uploadedFiles), // Save the array of images as a string
          marks: 0,
          status: "pending", // 'pending' means Admin needs to grade it!
        });

        // 5. Ping the Admin Radar! (Optional but cool if your socket is running)
        if (typeof io !== "undefined") io.emit("new_submission_radar");

        res.json({ success: true, message: "Vault Locked. Files secured." });
      } catch (error) {
        console.error("Vault Upload Error:", error);
        res.status(500).json({ error: error.message });
      }
    },
  );

  server.get("/api/uploads/:filename", (req, res) => {
    // Look inside the local backend 'uploads' folder
    const filePath = path.join(__dirname, "uploads", req.params.filename);

    // If the image exists, send it to the Admin screen!
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send("File not found in the Matrix.");
    }
  });

  // 🚀 THE FIX: A dedicated, foolproof route just for serving written answer images!
  server.get("/api/written-answers/:filename", (req, res) => {
    const filePath = path.join(
      __dirname,
      "uploads",
      "written-answers",
      req.params.filename,
    );
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).send("File not found in the Matrix.");
    }
  });

  // 🚀 INSTANT NUKE API: Wipes images immediately after student downloads PDF
  server.delete(
    "/api/student/written/nuke-images/:quizId",
    verifyToken,
    async (req, res) => {
      try {
        const result = await WrittenResult.findOne({
          where: { quizId: req.params.quizId, studentId: req.user.id },
        });

        if (!result || result.fileUrls === "[]")
          return res.json({ success: true });

        let fileUrls = [];
        try {
          fileUrls = JSON.parse(result.fileUrls);
        } catch (e) {}

        // Physically delete files from the VPS
        fileUrls.forEach((url) => {
          const filename = path.basename(url);
          const filePath = path.join(writtenAnswersDir, filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });

        // Wipe the DB record so it never loads again
        result.fileUrls = "[]";
        await result.save();

        res.json({ success: true, message: "Server space reclaimed!" });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // ==========================================================
  // 🏆 THE GOD-TIER LEADERBOARD APIs
  // ==========================================================

  // 1. GET ALL QUIZZES THAT HAVE LEADERBOARDS
  server.get(
    "/api/student/leaderboards/quizzes/:type",
    verifyToken,
    async (req, res) => {
      try {
        const { type } = req.params;
        let quizzes = [];

        if (type === "mcq") {
          // Get all MCQs that have at least one result
          quizzes = await McqQuiz.findAll({
            attributes: [
              "id",
              "title",
              "totalQuestions",
              "batches",
              "startTime",
              "endTime",
              "status",
              "timeLimit",
              "readyTime",
            ],
            order: [["createdAt", "DESC"]],
          });
        } else if (type === "written") {
          quizzes = await WrittenQuiz.findAll({
            attributes: ["id", "title", "totalMarks", "batches"],
            order: [["createdAt", "DESC"]],
          });
        }
        res.json(quizzes);
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 2. GET THE LEADERBOARD FOR A SPECIFIC EXAM (NOW CRASH-PROOF!)
  server.get(
    "/api/student/leaderboards/results/:type/:quizId",
    verifyToken,
    async (req, res) => {
      try {
        const { type, quizId } = req.params;
        const studentId = req.user.id;
        let results = [];
        let lockMeta = null;

        const computeMcqUnlockTime = (quiz) => {
          if (!quiz) return null;
          if (quiz.endTime) return new Date(quiz.endTime);
          const start = quiz.startTime ? new Date(quiz.startTime) : null;
          if (!start) return null;
          const readyMs = (Number(quiz.readyTime || 0) || 0) * 60000;
          const timeLimitMs = (Number(quiz.timeLimit || 60) || 60) * 60000;
          return new Date(start.getTime() + readyMs + timeLimitMs);
        };

        if (type === "mcq") {
          const quiz = await McqQuiz.findByPk(quizId, {
            attributes: [
              "id",
              "title",
              "startTime",
              "endTime",
              "status",
              "timeLimit",
              "readyTime",
              "totalQuestions",
            ],
          });
          if (!quiz) {
            return res.status(404).json({ error: "Quiz not found" });
          }

          const unlockAt = computeMcqUnlockTime(quiz);
          const now = new Date();
          const isLocked = Boolean(
            unlockAt && now < unlockAt && quiz.status !== "ended",
          );

          if (isLocked) {
            return res.json({
              hidden: true,
              meta: {
                quizId: quiz.id,
                title: quiz.title,
                unlockAt: unlockAt.toISOString(),
                status: quiz.status,
                isLocked: true,
              },
            });
          }

          results = await McqResult.findAll({
            where: { quizId },
            include: [
              { model: User, attributes: ["id", "name", "batch", "avatar"] },
            ],
            order: [
              ["score", "DESC"],
              ["updatedAt", "ASC"],
            ],
          });

          lockMeta = {
            quizId: quiz.id,
            title: quiz.title,
            unlockAt: unlockAt ? unlockAt.toISOString() : null,
            status: quiz.status,
            isLocked: false,
          };
        } else if (type === "written") {
          results = await WrittenResult.findAll({
            where: { quizId, gradingStatus: "published" },
            include: [
              { model: User, attributes: ["id", "name", "batch", "avatar"] },
            ],
            order: [
              ["score", "DESC"],
              ["updatedAt", "ASC"],
            ],
          });
        }

        // 🚀 THE FIX: If 0 students have taken the exam, STOP HERE!
        // Do not let the database try to search an empty array for emojis!
        if (!results || results.length === 0) {
          return res.json([]);
        }

        // Fetch ALL reactions for this specific exam
        const resultIds = results.map((r) => r.id);
        const allReactions = await Reaction.findAll({
          where: { entryId: { [Op.in]: resultIds }, engineType: type },
        });

        const uniqueResultsMap = new Map();

        for (const r of results) {
          const rowUserId = r.User ? r.User.id : "unknown";

          // Calculate Reactions for this specific row (r.id)
          const rowReactions = allReactions.filter(
            (reaction) => reaction.entryId === r.id,
          );
          const reactionCounts = {};
          let myReaction = null;

          rowReactions.forEach((reaction) => {
            reactionCounts[reaction.reactionId] =
              (reactionCounts[reaction.reactionId] || 0) + 1;
            if (reaction.userId === studentId) myReaction = reaction.reactionId;
          });

          if (!uniqueResultsMap.has(rowUserId)) {
            uniqueResultsMap.set(rowUserId, {
              id: r.id,
              studentId: r.User ? r.User.id : null,
              studentName: r.User ? r.User.name : "Unknown",
              studentBatch: r.User ? r.User.batch : "Unknown",
              avatar: r.User ? r.User.avatar : null,
              score: r.score,
              total: r.totalQuestions || r.totalMarks || 100,
              reactions: {
                myReaction: myReaction,
                counts: reactionCounts,
              },
            });
          }
        }

        const finalLeaderboard = Array.from(uniqueResultsMap.values());

        let runningRank = 0;
        let lastScore = null;
        const rankedLeaderboard = finalLeaderboard.map((entry, idx) => {
          const numericScore = Number(entry.score) || 0;
          if (lastScore === null || numericScore < lastScore) {
            runningRank += 1;
            lastScore = numericScore;
          }
          return {
            ...entry,
            rank: runningRank,
          };
        });

        const TOP_LIMIT = 10;
        const baseTopRows = rankedLeaderboard.slice(0, TOP_LIMIT);
        const cutoffScore =
          baseTopRows.length > 0
            ? Number(baseTopRows[baseTopRows.length - 1].score)
            : null;

        let publicRows = rankedLeaderboard;
        if (rankedLeaderboard.length > TOP_LIMIT && cutoffScore !== null) {
          publicRows = rankedLeaderboard.filter(
            (entry, idx) =>
              idx < TOP_LIMIT || Number(entry.score) === cutoffScore,
          );
        }

        const selfRow =
          rankedLeaderboard.find(
            (entry) => String(entry.studentId) === String(studentId),
          ) || null;
        const selfIsPublic =
          selfRow !== null &&
          publicRows.some(
            (entry) => String(entry.studentId) === String(selfRow.studentId),
          );

        res.json({
          publicRows,
          selfRow,
          meta: {
            baseLimit: TOP_LIMIT,
            label: publicRows.length > TOP_LIMIT ? "Top 10+" : "Top 10",
            totalRanked: rankedLeaderboard.length,
            publicCount: publicRows.length,
            cutoffScore,
            selfIsPublic,
            ...(lockMeta || {}),
          },
        });
      } catch (e) {
        console.error("Leaderboard Error:", e);
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 3. POST A REACTION (The Facebook Like Button Logic)
  server.post(
    "/api/student/leaderboards/react",
    verifyToken,
    async (req, res) => {
      try {
        const studentId = req.user.id;
        const { attemptId, engineType, reactionId } = req.body;

        if (!attemptId || !engineType || !reactionId) {
          return res.status(400).json({ message: "Missing reaction data" });
        }

        // Look for an existing reaction by this user on this exact row
        const existing = await Reaction.findOne({
          where: {
            userId: studentId,
            entryId: attemptId,
            engineType: engineType,
          },
        });

        let actionTaken = "";

        if (existing) {
          if (existing.reactionId === reactionId) {
            await existing.destroy();
            actionTaken = "removed";
          } else {
            existing.reactionId = reactionId;
            await existing.save();
            actionTaken = "updated";
          }
        } else {
          await Reaction.create({
            userId: studentId,
            entryId: attemptId,
            engineType: engineType,
            reactionId: reactionId,
          });
          actionTaken = "added";
        }

        // 🚀 REAL-TIME ENGINE: Recalculate totals for this exact row instantly
        const allCurrentReactions = await Reaction.findAll({
          where: { entryId: attemptId, engineType: engineType },
        });

        const updatedCounts = {};
        allCurrentReactions.forEach((r) => {
          updatedCounts[r.reactionId] = (updatedCounts[r.reactionId] || 0) + 1;
        });

        // 📢 GLOBAL MEGAPHONE: Blast the new counts to everyone
        if (typeof io !== "undefined") {
          io.emit("reaction_updated", {
            attemptId: attemptId,
            counts: updatedCounts,
          });
        }

        return res.json({ success: true, action: actionTaken });
      } catch (e) {
        console.error("Reaction Error:", e);
        res.status(500).json({ error: e.message });
      }
    },
  );

  // 👻 GHOST BUSTER V2: Destroys Trapped Exams & Orphaned Results!
  server.get("/api/admin/ghost-buster", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin")
        return res.status(403).send("Forbidden. Admin only.");

      let trappedMcq = 0,
        trappedWritten = 0,
        orphanedMcqRes = 0,
        orphanedWrittenRes = 0;

      // --- 1. HUNT TRAPPED MCQ EXAMS ---
      const allMcqFolders = await McqFolder.findAll({ attributes: ["id"] });
      const validMcqFIds = allMcqFolders.map((f) => f.id);

      const allMcqQuizzes = await McqQuiz.findAll();
      for (const q of allMcqQuizzes) {
        // If it has a folderId, but that folder doesn't exist anymore -> TRAPPED IN THE VOID!
        if (q.folderId !== null && !validMcqFIds.includes(q.folderId)) {
          await McqResult.destroy({ where: { quizId: q.id } }); // Nuke its results
          await q.destroy(); // Nuke the trapped exam
          trappedMcq++;
        }
      }

      // --- 2. HUNT TRAPPED WRITTEN EXAMS ---
      const allWrittenFolders = await WrittenFolder.findAll({
        attributes: ["id"],
      });
      const validWrittenFIds = allWrittenFolders.map((f) => f.id);

      const allWrittenQuizzes = await WrittenQuiz.findAll();
      for (const q of allWrittenQuizzes) {
        if (q.folderId !== null && !validWrittenFIds.includes(q.folderId)) {
          // Physical Image Wipe
          const results = await WrittenResult.findAll({
            where: { quizId: q.id },
          });
          for (const r of results) {
            let fileUrls = [];
            try {
              fileUrls = JSON.parse(r.fileUrls || r.answers || "[]");
            } catch (e) {}
            for (const url of fileUrls) {
              const filename = path.basename(url);
              const filePath = path.join(writtenAnswersDir, filename);
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
          }
          await WrittenResult.destroy({ where: { quizId: q.id } });
          await q.destroy();
          trappedWritten++;
        }
      }

      // --- 3. WIPE ORPHANED RESULTS (Just in case) ---
      const validMcqQIds = (await McqQuiz.findAll({ attributes: ["id"] })).map(
        (q) => q.id,
      );
      if (validMcqQIds.length > 0)
        orphanedMcqRes = await McqResult.destroy({
          where: { quizId: { [Op.notIn]: validMcqQIds } },
        });
      else orphanedMcqRes = await McqResult.destroy({ where: {} });

      const validWrittenQIds = (
        await WrittenQuiz.findAll({ attributes: ["id"] })
      ).map((q) => q.id);
      let orphanWritten = [];
      if (validWrittenQIds.length > 0) {
        orphanWritten = await WrittenResult.findAll({
          where: { quizId: { [Op.notIn]: validWrittenQIds } },
        });
        orphanedWrittenRes = await WrittenResult.destroy({
          where: { quizId: { [Op.notIn]: validWrittenQIds } },
        });
      } else {
        orphanWritten = await WrittenResult.findAll();
        orphanedWrittenRes = await WrittenResult.destroy({ where: {} });
      }

      // Physical Wipe for any orphaned results
      for (const r of orphanWritten) {
        let fileUrls = [];
        try {
          fileUrls = JSON.parse(r.fileUrls || r.answers || "[]");
        } catch (e) {}
        for (const url of fileUrls) {
          const filename = path.basename(url);
          const filePath = path.join(writtenAnswersDir, filename);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
      }

      res.json({
        success: true,
        message: "👻 Ghost Protocol V2 Complete! Matrix is clean.",
        trappedExamsVaporized: trappedMcq + trappedWritten,
        orphanedResultsWiped: orphanedMcqRes + orphanedWrittenRes,
      });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

  // ☢️ GOD-MODE BUTTON: Wipes all orphaned Leaderboard Results instantly
  server.delete(
    "/api/admin/leaderboard-nuke",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin") return res.status(403).send("Forbidden");

        // 1. Get all active exams
        const validMcq = await McqQuiz.findAll({ attributes: ["id"] });
        const validMcqIds = validMcq.map((q) => q.id);

        const validWritten = await WrittenQuiz.findAll({ attributes: ["id"] });
        const validWrittenIds = validWritten.map((q) => q.id);

        // 2. Wipe physical orphaned images from the VPS
        let orphanWritten = [];
        if (validWrittenIds.length > 0) {
          orphanWritten = await WrittenResult.findAll({
            where: { quizId: { [Op.notIn]: validWrittenIds } },
          });
        } else {
          orphanWritten = await WrittenResult.findAll(); // If 0 exams, all are orphans!
        }

        for (const r of orphanWritten) {
          let fileUrls = [];
          try {
            fileUrls = JSON.parse(r.fileUrls || r.answers || "[]");
          } catch (e) {}
          for (const url of fileUrls) {
            const filename = path.basename(url);
            const filePath = path.join(writtenAnswersDir, filename);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
          }
        }

        // 3. Wipe the orphaned database records
        let mcqWiped = 0,
          writtenWiped = 0;

        if (validMcqIds.length > 0) {
          mcqWiped = await McqResult.destroy({
            where: { quizId: { [Op.notIn]: validMcqIds } },
          });
        } else {
          mcqWiped = await McqResult.destroy({ where: {} });
        }

        if (validWrittenIds.length > 0) {
          writtenWiped = await WrittenResult.destroy({
            where: { quizId: { [Op.notIn]: validWrittenIds } },
          });
        } else {
          writtenWiped = await WrittenResult.destroy({ where: {} });
        }

        res.json({
          success: true,
          message: `Nuked ${mcqWiped} MCQ Ghosts and ${writtenWiped} Written Ghosts. Matrix is clean.`,
        });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    },
  );

  // ================= BATCHES API ROUTE =================
  // Admin: Get all batches
  server.get("/api/admin/batches", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin")
        return res.status(403).json({ error: "Unauthorized" });
      const batches = await Batch.findAll({
        attributes: ["name"],
        order: [["name", "ASC"]],
      });
      res.json(batches);
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // ================= EVENT POSTER ROUTES =================

  // 1. Admin: Upload new poster
  server.post(
    "/api/admin/event-poster",
    verifyToken,
    uploadPoster.single("posterImage"),
    async (req, res) => {
      try {
        if (req.user.role !== "admin")
          return res.status(403).json({ error: "Unauthorized" });
        const { title, link, batch, isActive } = req.body;
        if (!req.file)
          return res.status(400).json({ error: "Poster image is required" });
        const imageUrl = `/uploads/posters/${req.file.filename}`;
        const makeActive = isActive === "true";

        // Validate batch from DB (except 'All')
        let batchToUse = "All";
        if (batch && batch !== "All") {
          const found = await Batch.findOne({ where: { name: batch } });
          if (!found)
            return res.status(400).json({ error: "Invalid batch name" });
          batchToUse = batch;
        }

        // If making this active, deactivate all others first
        if (makeActive) {
          await EventPoster.update({ isActive: false }, { where: {} });
        }

        const poster = await EventPoster.create({
          title,
          link,
          imageUrl,
          batch: batchToUse,
          isActive: makeActive,
        });

        res.json({ success: true, poster });
      } catch (error) {
        console.error("Poster Upload Error:", error);
        res.status(500).json({ error: "Server error" });
      }
    },
  );

  // 2. Admin: Get all posters (for managing)
  server.get("/api/admin/event-posters", verifyToken, async (req, res) => {
    try {
      if (req.user.role !== "admin")
        return res.status(403).json({ error: "Unauthorized" });
      const posters = await EventPoster.findAll({
        order: [["createdAt", "DESC"]],
      });
      res.json(posters);
    } catch (error) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // 3. Admin: Toggle visibility
  server.put(
    "/api/admin/event-poster/:id/toggle",
    verifyToken,
    async (req, res) => {
      try {
        if (req.user.role !== "admin")
          return res.status(403).json({ error: "Unauthorized" });
        const { isActive } = req.body;

        if (isActive) {
          await EventPoster.update({ isActive: false }, { where: {} }); // Only 1 active at a time
        }
        await EventPoster.update(
          { isActive },
          { where: { id: req.params.id } },
        );

        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ error: "Server error" });
      }
    },
  );

  // 4. Student: Fetch active poster for their batch
  server.get("/api/student/active-poster", verifyToken, async (req, res) => {
    try {
      const studentBatch = req.user.batch || "All"; // Make sure req.user has the student's batch

      const activePoster = await EventPoster.findOne({
        where: {
          isActive: true,
          [Op.or]: [{ batch: "All" }, { batch: studentBatch }],
        },
      });

      res.json({ poster: activePoster });
    } catch (error) {
      console.error("Fetch Active Poster Error:", error);
      res.status(500).json({ error: "Server error" });
    }
  });

  server.get("/admin/login", (req, res) => {
    res.redirect(302, "/auth");
  });

  server.all("*", (req, res) => {
    return handle(req, res);
  });

  httpServer.listen(3006, (err) => {
    if (err) throw err;
    console.log("> SERVER READY: http://localhost:3006");
  });
});
