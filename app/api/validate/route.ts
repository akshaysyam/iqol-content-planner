// app/api/validate/route.ts
import { NextResponse } from 'next/server';
import { load } from 'cheerio';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { content, minWords, maxWords, targetKeywords, scrapedKeywords } = body;

    // Remove HTML tags to get pure text
    const $ = load(content || "");
    const plainText = $.text().trim();
    
    const words = plainText.split(/\s+/).filter(w => w.length > 0);
    const wordCount = words.length;

    const lowercaseText = plainText.toLowerCase();
    let totalKeywordCount = 0;
    const errors: string[] = [];
    const keywordDetails: any = { target: [], scraped: [] };

    // 1. Check Primary Target Keywords (Must be used at least once)
    if (Array.isArray(targetKeywords) && targetKeywords.length > 0) {
      for (const kw of targetKeywords) {
        if (!kw) continue;
        const keywordLower = kw.toLowerCase();
        const kwCount = lowercaseText.split(keywordLower).length - 1;
        totalKeywordCount += kwCount;
        keywordDetails.target.push({ word: kw, count: kwCount, required: 1 });

        if (kwCount === 0) {
          errors.push(`Target keyword "${kw}" not found. Must be used at least once.`);
        }
      }
    } else {
      // Fallback for older tasks that used a single string
      const singleKwLower = (body.targetKeyword || "").toLowerCase();
      if (singleKwLower) {
        const kwCount = lowercaseText.split(singleKwLower).length - 1;
        totalKeywordCount = kwCount;
        keywordDetails.target.push({ word: body.targetKeyword, count: kwCount, required: 1 });
        if (kwCount === 0) {
          errors.push(`Target keyword "${body.targetKeyword}" not found. Must be used at least once.`);
        }
      }
    }

    // 2. Check Scraped Keywords and their required frequencies
    if (Array.isArray(scrapedKeywords) && scrapedKeywords.length > 0) {
      for (const sk of scrapedKeywords) {
        if (!sk.word) continue;
        const keywordLower = sk.word.toLowerCase();
        const kwCount = lowercaseText.split(keywordLower).length - 1;
        
        keywordDetails.scraped.push({ word: sk.word, count: kwCount, required: sk.requiredCount });

        if (kwCount < sk.requiredCount) {
          errors.push(`Meta keyword "${sk.word}" used ${kwCount}/${sk.requiredCount} times. Please add more.`);
        }
      }
    }

    // 3. AI Detection Parsing (Using Gemini instead of mock generation)
    let aiScore = 0;
    
    if (wordCount > 50) {
      try {
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const prompt = `
        Act as an Expert Content Analyst. 
        Analyze the text for "AI Fluff" vs "Expert Density".
        
        Classify 4 metrics (HIGH=AI, LOW=Human):

        1. STRUCTURE: 
           - HIGH: Generic 5-paragraph essay format.
           - LOW: Highly fragmented, list-heavy, or technical formatting.
           
        2. TONE: 
           - HIGH: "Preachy" moralizing ("It is important to note", "In the landscape of").
           - LOW: Direct, dry, instructional, or opinionated.

        3. DEPTH (The Key): 
           - HIGH: Vague summaries ("Costs vary by location").
           - LOW: Specific hard data ("₹7,000", "Section 80C", "August 2025").

        4. COHERENCE:
           - HIGH: Robotically smooth transitions.
           - LOW: Abrupt headers or direct jumps between topics.

        Text: "${plainText.slice(0, 50000)}"
        
        Return JSON:
        {
          "metrics": { 
             "structure_level": "HIGH" | "MEDIUM" | "LOW", 
             "tone_level": "HIGH" | "MEDIUM" | "LOW", 
             "depth_level": "HIGH" | "MEDIUM" | "LOW",
             "coherence_level": "HIGH" | "MEDIUM" | "LOW"
          },
          "suspect_sentences": ["sentence 1", "sentence 2"],
          "brief_critique": "Verdict summary"
        }
      `;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.0,
            topP: 0.1
          }
        });

        const rawText = response.text || "{}";
        console.log("=== GEMINI RAW RESPONSE ===", rawText);
        const cleanJson = rawText.replace(/```json|```/g, '').trim();
        const jsonResponse = JSON.parse(cleanJson);

        const toScore = (level: string) => {
          if (level === "HIGH") return 100;
          if (level === "MEDIUM") return 65;
          return 0;
        };

        const m = jsonResponse.metrics || {};
        const s = toScore(m.structure_level);
        const t = toScore(m.tone_level);
        const d = toScore(m.depth_level);
        const c = toScore(m.coherence_level);

        // --- THE FACT DENSITY SCANNER ---
        const factPatterns = /₹|\$|%|202[0-9]|Section \d+|Act \d+/g;
        const factCount = (plainText.match(factPatterns) || []).length;
        
        console.log("=== PARSED METRICS ===", { s, t, d, c, factCount, jsonResponse });
        
        let factDiscount = 0;
        if (factCount > 3) factDiscount = 20; 
        if (factCount > 7) factDiscount = 40; 

        let finalScore = Math.round(
          (d * 0.45) + 
          (s * 0.25) + 
          (t * 0.20) + 
          (c * 0.10)
        );

        finalScore = Math.max(finalScore - factDiscount, 0);
        aiScore = finalScore;
        
        if (isNaN(aiScore)) {
          aiScore = 0; // Fallback safely if AI hallucinates text instead of number
        }
      } catch (aiErr: any) {
        console.error("AI Scoring Failed (likely missing API key):", aiErr);
        errors.push(`Gemini SDK Error: ${aiErr.message || String(aiErr)}`);
        
        // Deterministic Fallback Heuristic
        const aiBuzzwords = ['furthermore', 'consequently', 'in conclusion', 'delve', 'unlock', 'seamless', 'robust', 'tapestry', 'testament', 'crucial', 'pivotal'];
        let buzzwordCount = 0;
        for (const word of aiBuzzwords) {
          if (lowercaseText.includes(word)) {
            buzzwordCount++;
          }
        }
        
        // Base score of 5, plus 15 for every buzzword found. Max 95.
        aiScore = Math.min(95, 5 + (buzzwordCount * 15));
      }
    } else {
       // Too short to accurately predict
       aiScore = 0;
    }

    // Rules validation
    if (wordCount < minWords) {
      errors.push(`Content is too short (${wordCount} words). Minimum required is ${minWords}.`);
    }
    if (wordCount > maxWords) {
      errors.push(`Content is too long (${wordCount} words). Maximum allowed is ${maxWords}.`);
    }

    if (aiScore >= 40) {
      errors.push(`AI Detection failed. Score: ${aiScore}%. Must be under 40%.`);
    }

    const passed = errors.length === 0;

    return NextResponse.json({
      passed,
      errors,
      metrics: {
        wordCount,
        totalKeywordCount,
        aiScore,
        aiFactCount: aiScore !== 0 ? (plainText.match(/₹|\$|%|202[0-9]|Section \d+|Act \d+/g) || []).length : 0,
        keywordDetails
      }
    });

  } catch (error: any) {
    return NextResponse.json({ passed: false, errors: [error.message] }, { status: 500 });
  }
}
