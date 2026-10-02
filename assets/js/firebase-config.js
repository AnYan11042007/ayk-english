// 1) Firebase Console > Project settings > Your apps > Web app
// 2) Dán firebaseConfig của bạn vào đây.
// LƯU Ý: Firebase web config không phải secret. KHÔNG đặt Gemini API key ở file này.
export const firebaseConfig = {
  apiKey: "AIzaSyAQjC7QY4nnx5B4kvpvSavMOjoi2v9tmsU",
  authDomain: "english-ayk.firebaseapp.com",
  projectId: "english-ayk",
  storageBucket: "english-ayk.firebasestorage.app",
  messagingSenderId: "300549155647",
  appId: "1:300549155647:web:57e906f8b6909cade2018a",
  measurementId: "G-N52C94JQZ5"
};

export const FUNCTIONS_REGION = "asia-southeast1";

export function isFirebaseConfigured(){
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("PASTE_") &&
    firebaseConfig.projectId && !firebaseConfig.projectId.startsWith("PASTE_");
}
