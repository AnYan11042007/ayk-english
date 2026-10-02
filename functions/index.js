const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { GoogleGenAI, Type } = require('@google/genai');

initializeApp();
const db = getFirestore();
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

exports.lookupVocabulary = onCall(
  { region: 'asia-southeast1', secrets: [GEMINI_API_KEY], timeoutSeconds: 30, memory: '256MiB' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Bạn cần đăng nhập.');
    const userDoc = await db.doc(`users/${request.auth.uid}`).get();
    if (!userDoc.exists || userDoc.data().role !== 'admin') {
      throw new HttpsError('permission-denied', 'Chỉ Admin được dùng AI thêm từ vựng.');
    }

    const word = String(request.data?.word || '').trim();
    const pos = String(request.data?.pos || '').trim();
    if (!word || !['n','v','adj','adv'].includes(pos)) {
      throw new HttpsError('invalid-argument', 'Thiếu từ hoặc loại từ không hợp lệ.');
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY.value() });
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Bạn là trợ lý tạo dữ liệu từ vựng Anh-Việt cho sinh viên Việt Nam.\nTừ: ${word}\nLoại từ bắt buộc: ${pos}\nHãy trả nghĩa phổ biến, IPA, 1 câu ví dụ tiếng Anh ngắn dễ hiểu, và cụm từ khóa tiếng Anh ngắn để tìm một ảnh minh họa rõ nghĩa. Không giải thích thêm.`,
      config: {
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            meaning: { type: Type.STRING },
            ipa: { type: Type.STRING },
            example: { type: Type.STRING },
            imageSearchKeyword: { type: Type.STRING }
          },
          required: ['meaning','ipa','example','imageSearchKeyword']
        }
      }
    });

    let parsed;
    try { parsed = JSON.parse(response.text); }
    catch { throw new HttpsError('internal', 'AI trả dữ liệu không đúng định dạng.'); }
    return { word, pos, ...parsed };
  }
);
