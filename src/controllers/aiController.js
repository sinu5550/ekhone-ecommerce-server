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

    // Helper to calculate discounted price
    const getFinalPrice = (priceNum, discType, discVal) => {
      const p = parseFloat(priceNum) || 0;
      const d = parseFloat(discVal) || 0;
      if (d <= 0) return p;
      if (discType === 'Fixed') return Math.max(0, p - d);
      return Math.max(0, Math.round(p - (p * d) / 100));
    };

    // 1. Fetch current product context if user is currently viewing a product
    let productContext = '';
    if (currentProductId) {
      const isNumeric = !isNaN(parseInt(currentProductId));
      const currentProduct = await prisma.product.findFirst({
        where: isNumeric
          ? { OR: [{ id: parseInt(currentProductId) }, { slug: String(currentProductId) }] }
          : { slug: String(currentProductId) },
        include: { brand: true, subCategory: true, productVariants: true }
      });
      if (currentProduct) {
        const origP = parseFloat(currentProduct.price);
        const discP = getFinalPrice(origP, currentProduct.discountType, currentProduct.discountValue);
        const hasDisc = origP > discP;
        const insideFee = currentProduct.insideDhakaDeliveryCharge != null ? parseFloat(currentProduct.insideDhakaDeliveryCharge) : 80;
        const outsideFee = currentProduct.outsideDhakaDeliveryCharge != null ? parseFloat(currentProduct.outsideDhakaDeliveryCharge) : 150;

        let variantInfo = 'None (Single product)';
        if (currentProduct.productVariants && currentProduct.productVariants.length > 0) {
          variantInfo = currentProduct.productVariants.map(v => {
            const vOrigP = parseFloat(v.price || origP);
            const vDiscP = getFinalPrice(vOrigP, currentProduct.discountType, currentProduct.discountValue);
            let attrStr = '';
            if (v.attributes && typeof v.attributes === 'object') {
              attrStr = Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(', ');
            }
            return `  - Variant: ${attrStr || 'Standard'}, Original Price: ৳${vOrigP}, Discount Price: ৳${vDiscP}, Stock: ${v.quantity}`;
          }).join('\n');
        }

        productContext = `
Customer is currently on this specific product page:
- Product Title: ${currentProduct.productName}
- Product Direct URL: https://ekhone.xyz/product/${currentProduct.slug || currentProduct.id}
- Original Regular Price: ৳${origP}
- Current Discount Offer Price: ৳${discP} ${hasDisc ? `(Save ৳${origP - discP} with ${currentProduct.discountValue}${currentProduct.discountType === 'Fixed' ? '৳' : '%'} OFF)` : '(No extra discount)'}
- Available Variants & Color Options:
${variantInfo}
- Specific Delivery Charge for this product: Dhaka Inside ৳${insideFee}, Outside Dhaka ৳${outsideFee}
- Stock Availability: ${currentProduct.quantity > 0 ? `${currentProduct.quantity} units in stock` : 'Out of Stock'}
- Brand: ${currentProduct.brand?.name || 'Authentic'}
`;
      }
    }

    // Fetch active products in store with their full details, variants, and delivery fees
    const storeProducts = await prisma.product.findMany({
      where: { status: true, isArchived: false },
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        productVariants: true,
        brand: true,
      }
    });

    const productsCatalogText = storeProducts
      .map(p => {
        const origP = parseFloat(p.price);
        const discP = getFinalPrice(origP, p.discountType, p.discountValue);
        const insideFee = p.insideDhakaDeliveryCharge != null ? parseFloat(p.insideDhakaDeliveryCharge) : 80;
        const outsideFee = p.outsideDhakaDeliveryCharge != null ? parseFloat(p.outsideDhakaDeliveryCharge) : 150;
        
        let variantsSummary = '';
        if (p.productVariants && p.productVariants.length > 0) {
          const vList = p.productVariants.map(v => {
            const vOrig = parseFloat(v.price || origP);
            const vDisc = getFinalPrice(vOrig, p.discountType, p.discountValue);
            let attr = '';
            if (v.attributes && typeof v.attributes === 'object') {
              attr = Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(' ');
            }
            return `${attr || 'Option'} (৳${vDisc})`;
          }).join(', ');
          variantsSummary = ` | Variants: [${vList}]`;
        }

        return `• Title: ${p.productName} | Discount Price: ৳${discP}${origP > discP ? ` (Regular ৳${origP})` : ''} | Link: https://ekhone.xyz/product/${p.slug || p.id} | Delivery: Dhaka ৳${insideFee}, Outside ৳${outsideFee}${variantsSummary}`;
      })
      .join('\n');

    const systemInstruction = `
You are the official sweet, highly knowledgeable, and friendly Bengali AI Shopping Assistant for "Ekhone" (pronounced "এখনই", website: ekhone.xyz) - Bangladesh's best authentic online store.

Store & Order Details:
- Store Name: এখনই (Ekhone)
- Website: https://ekhone.xyz
- Payment: Cash on Delivery (ক্যাশ অন ডেলিভারি / COD), bKash, Nagad
- Return Policy: ডেলিভারিম্যানের সামনে চেক করে নেওয়ার সুবিধা এবং ১০০% জেনুইন প্রোডাক্ট গ্যারান্টি।

Products in Catalog (with prices, variants, delivery charges, and direct links):
${productsCatalogText}

${productContext}

CRITICAL RULES FOR ACCURATE RESPONSES:
1. DISCOUNT & PRICE: Always mention the DISCOUNTED OFFER PRICE (৳) prominently. If there is a regular price and a discount, mention both naturally (e.g. "রেগুলার মূল্য ৳১,২৫,০০০ হলেও ডিসকাউন্টে পাচ্ছেন মাত্র ৳১,২২,৫০০ টাকায়!").
2. VARIANTS & COLORS: If the customer asks about available colors, sizes, or variants of a product, list the exact available colors/variants from the product details above along with their specific variant prices.
3. DIRECT PRODUCT LINKS: Whenever the customer asks for a product, wants to view/buy it, or asks for a link, provide the EXACT DIRECT PRODUCT LINK (e.g. https://ekhone.xyz/product/apple-iphone-12-pro-max). NEVER give just the plain homepage "ekhone.xyz" when a specific product is being discussed!
4. DELIVERY CHARGE: Always check and state the exact delivery fee of the specific product being asked about (e.g. ঢাকা সিটিতে ৳৮০ এবং ঢাকার বাইরে ৳১৫০).
5. PRODUCT TITLE LANGUAGE: Keep the specific Product Titles and Brand Names in English exactly as written in catalog (e.g. "Apple Iphone 12 Pro max", "Samsung Galaxy S24 Ultra", "Black", "Titanium Gray"). Do NOT write product titles in Bengali alphabet.
6. SPOKEN LANGUAGE: Apart from product titles, brand names, and URLs, speak in natural, polite, engaging Bengali (কথ্য বাংলা / প্রমিত বাংলা). Keep response concise, friendly, and helpful (around 2-3 natural sentences).
`;

    const contents = [
      { role: 'user', parts: [{ text: `${systemInstruction}\n\nCustomer says: ${message}` }] }
    ];

    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-flash-latest',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
      'gemini-flash-lite-latest',
    ];

    let reply = '';
    let lastError = null;

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: contents,
        });
        if (response?.text) {
          reply = response.text.trim();
          break;
        }
      } catch (modelErr) {
        lastError = modelErr;
        console.warn(`Gemini model ${modelName} error:`, modelErr?.status || modelErr?.message);
        // Continue to next available model in candidate pool
      }
    }

    if (!reply) {
      // Smart offline fallback response based on message
      reply = 'হ্যালো! "এখনই"-তে আপনাকে স্বাগতম। আপনি কি কোনো নির্দিষ্ট পণ্য সম্পর্কে জানতে চান নাকি ডেলিভারি ও অর্ডার বিষয়ে সাহায্য প্রয়োজন?';
    }

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
    const candidateModels = [
      'gemini-3.8-flash',
      'gemini-flash-latest',
      'gemini-3.7-flash',
      'gemini-3.5-flash',
    ];

    for (const modelName of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: modelName,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
        if (response?.text) {
          narration = response.text.replace(/[\*\"\#\_]/g, '').trim();
          break;
        }
      } catch (aiErr) {
        // Continue to next available model
      }
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

