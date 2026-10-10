const { GoogleGenAI } = require('@google/genai');
const prisma = require('../utils/db');
const { successResponse, errorResponse } = require('../utils/responseHandler');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Handle AI Shopping Assistant Chat & Voice query
 */
const chatWithAI = async (req, res) => {
  try {
    const { message, history = [], currentProductId = null } = req.body;

    if (!message || typeof message !== 'string') {
      return errorResponse(res, 'Message is required', 400);
    }

    // 1. Fetch store product context to ground the AI with real store data
    let productContext = '';
    if (currentProductId) {
      const currentProduct = await prisma.product.findUnique({
        where: { id: parseInt(currentProductId) },
        include: { brand: true, subCategory: true, productVariants: true }
      });
      if (currentProduct) {
        productContext = `
Customer is currently looking at this specific product:
- Name: ${currentProduct.productName}
- Price: ৳${currentProduct.price}
- Stock: ${currentProduct.quantity > 0 ? 'In Stock' : 'Out of Stock'}
- Description: ${currentProduct.description ? currentProduct.description.replace(/<[^>]*>/g, '').slice(0, 300) : 'N/A'}
- Brand: ${currentProduct.brand?.name || 'Authentic'}
- Category: ${currentProduct.subCategory?.name || 'General'}
`;
      }
    }

    // Fetch popular/available products in store
    const storeProducts = await prisma.product.findMany({
      where: { status: true, isArchived: false },
      take: 12,
      select: {
        id: true,
        slug: true,
        productName: true,
        price: true,
        quantity: true
      }
    });

    const productsCatalogText = storeProducts
      .map(p => `• ${p.productName} (৳${p.price})`)
      .join('\n');

    const systemInstruction = `
You are the official sweet, friendly, and helpful Bengali AI Assistant for "Ekhone" (pronounced "এখনই" / Ekhoni, website: ekhone.xyz) - Bangladesh's best authentic online shopping website. Always pronounce and write the store name as "এখনই" (Ekhoni).

Store Information:
- Store Name: এখনই (Ekhone)
- Website: ekhone.xyz
- Delivery: Dhaka Inside ৳80, Outside Dhaka ৳150. Nationwide fast home delivery within 2-4 days.
- Payment: Cash on Delivery (COD), bKash, Nagad available.
- Authenticity: 100% genuine products with easy return on delivery.

Available Featured Products:
${productsCatalogText}

${productContext}

Guidelines for your response:
1. Speak in friendly, polite, natural spoken Bengali (কথ্য বাংলা / প্রমিত বাংলা).
2. Keep your answer strictly within 1 to 2 short sentences (maximum 30 words) so it responds ultra-fast and sounds natural when read.
3. If customer asks about delivery: Dhaka inside ৳80, outside ৳150, delivery time 2-4 days.
4. If customer asks about price or products, directly state the price from the store list.
5. Do not write long essays or bullet lists. Keep it warm, quick, and conversational.
`;

    const contents = [
      { role: 'user', parts: [{ text: `${systemInstruction}\n\nCustomer says: ${message}` }] }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contents,
    });

    const reply = response.text || 'দুঃখিত, আমি এই মুহূর্তে উত্তর দিতে পারছি না। অনুগ্রহ করে আবার চেষ্টা করুন।';

    return successResponse(res, { reply });
  } catch (err) {
    console.error('Gemini AI Assistant Error:', err);
    return errorResponse(res, 'AI assistant encountered an error', 500);
  }
};

/**
 * Generate Voice Narration Script for a specific product
 */
const getProductVoiceNarration = async (req, res) => {
  try {
    const { productId } = req.params;
    const isNumeric = /^\d+$/.test(productId);
    
    const product = isNumeric
      ? await prisma.product.findUnique({
          where: { id: parseInt(productId) },
          include: { brand: true, subCategory: true }
        })
      : await prisma.product.findUnique({
          where: { slug: productId },
          include: { brand: true, subCategory: true }
        });

    if (!product) {
      return errorResponse(res, 'Product not found', 404);
    }

    const plainDesc = product.description ? product.description.replace(/<[^>]*>/g, '').slice(0, 200) : '';

    const originalPrice = parseFloat(product.price || 0);
    const discountValue = parseFloat(product.discountValue || 0);
    let finalPrice = originalPrice;

    if (discountValue > 0) {
      if (product.discountType === "Fixed") {
        finalPrice = Math.max(0, originalPrice - discountValue);
      } else {
        finalPrice = Math.max(0, originalPrice - (originalPrice * discountValue) / 100);
      }
    }

    const priceSentence = discountValue > 0
      ? `রেগুলার মূল্য ${Math.round(originalPrice)} টাকা হলেও বর্তমান বিশেষ ডিসকাউন্ট মূল্য মাত্র ${Math.round(finalPrice)} টাকা।`
      : `এর বর্তমান মূল্য মাত্র ${Math.round(originalPrice)} টাকা।`;

    const prompt = `
Create a direct, natural 1-2 sentence product introduction in spoken Bengali (প্রমিত বাংলা):
- Product Name: ${product.productName}
- Pricing: ${priceSentence}
- Details: ${plainDesc}

Strict Rules:
1. Do NOT say any welcome greetings like "স্বাগতম" or "Welcome" or "এখনই ডট কমে আপনাকে স্বাগতম".
2. Start directly by presenting the product itself (e.g. "এটি ${product.productName}..." বা "${product.productName}...")।
3. Must clearly mention the discount / offer price (${Math.round(finalPrice)} টাকা)।
4. End with a quick call to action to buy now.
5. Return ONLY the pure Bengali text without quotation marks, markdown, or English text.
`;

    let narration = "";
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      narration = (response.text || '').replace(/[\*\"\#\_]/g, '').trim();
    } catch (aiErr) {
      console.warn('Gemini narration warning:', aiErr?.message);
    }

    if (!narration) {
      narration = `${product.productName}। ${priceSentence} ১০০% আসল পণ্যটি ঘরে বসে পেতে এখনই বাই নাও বাটনে ক্লিক করুন।`;
    }

    return successResponse(res, { narration });
  } catch (err) {
    console.error('Voice narration error:', err);
    return errorResponse(res, 'Failed to generate voice narration', 500);
  }
};

/**
 * Text-to-Speech stream for Bengali narration
 */
const streamBengaliAudio = async (req, res) => {
  try {
    const text = req.query.text || '';
    if (!text) {
      return res.status(400).send('Text is required');
    }

    const https = require('https');
    const encoded = encodeURIComponent(text.slice(0, 200));
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encoded}&tl=bn&client=tw-ob`;

    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } }, (ttsRes) => {
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      ttsRes.pipe(res);
    }).on('error', (e) => {
      console.error('TTS pipe error:', e);
      res.status(500).send('TTS streaming failed');
    });
  } catch (error) {
    console.error('TTS error:', error);
    res.status(500).send('TTS failed');
  }
};

module.exports = {
  chatWithAI,
  getProductVoiceNarration,
  streamBengaliAudio,
};

