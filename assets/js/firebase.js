import { firebaseConfig, FUNCTIONS_REGION, isFirebaseConfigured } from './firebase-config.js';

export let firebaseReady = false;
export let app = null, auth = null, db = null, functions = null;
export let fAuth = {}, fDb = {}, fFunctions = {};

if (isFirebaseConfigured()) {
  try {
    const appMod = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js');
    const authMod = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js');
    const dbMod = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js');
    const fnMod = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-functions.js');
    app = appMod.initializeApp(firebaseConfig);
    auth = authMod.getAuth(app);
    await authMod.setPersistence(auth, authMod.browserLocalPersistence);
    db = dbMod.getDatabase(app, firebaseConfig.databaseURL);
    functions = fnMod.getFunctions(app, FUNCTIONS_REGION);
    fAuth = authMod; fDb = dbMod; fFunctions = fnMod;
    firebaseReady = true;
  } catch (err) {
    console.error('Firebase init failed:', err);
  }
}
