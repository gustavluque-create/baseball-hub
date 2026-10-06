import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

const projectId = process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY
  ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
  : undefined;

let appOptions: any = { projectId };
if (clientEmail && privateKey) {
  try {
    appOptions.credential = cert({
      projectId,
      clientEmail,
      privateKey,
    });
  } catch (err) {
    console.warn('[Firebase Admin] Warning loading explicit cert credential, falling back to projectId:', err);
  }
}

const app = !getApps().length ? initializeApp(appOptions) : getApps()[0];

export const adminAuth = getAuth(app);
export const adminMessaging = getMessaging(app);

