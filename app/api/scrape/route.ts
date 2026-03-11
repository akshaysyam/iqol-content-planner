import { NextResponse } from 'next/server';
import * as cheerio from 'cheerio';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini
// Ensure you have GEMINI_API_KEY in your .env.local file
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      }
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch URL. Status: ${res.status}`);
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Extract meta description and meta keywords
    const metaDescription = $('meta[name="description"]').attr('content') || '';
    let metaKeywords = $('meta[name="keywords"]').attr('content') || '';
    
    // Extract H1 for context
    const h1 = $('h1').first().text().trim();
    const title = $('title').first().text().trim();

    // If the website didn't provide meta keywords, we'll ask Gemini to generate them!
    if (!metaKeywords || metaKeywords.trim() === '') {
      // Get the first few paragraphs to give Gemini context about the page
      const bodyText = $('p').map((i, el) => $(el).text()).get().join(' ').substring(0, 3000);
      
      const prompt = `Analyze this webpage text and return EXACTLY 4-6 highly relevant SEO keywords or short keyphrases that summarize its core topic. 
      Only return the keywords separated by commas. No intro, no extra text.
      
      Page Title: ${title}
      H1: ${h1}
      Content Snippet: ${bodyText}`;

      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
        });

        // The AI returns a comma-separated string based on our prompt
        metaKeywords = response.text || "";
      } catch (aiError) {
        console.error("Gemini Extraction Failed:", aiError);
        // Fallback to title keywords if AI fails
        metaKeywords = title.split(" ").filter(w => w.length > 4).slice(0, 4).join(",");
      }
    }

    return NextResponse.json({
      metaDescription,
      metaKeywords,
      h1
    });

  } catch (error: any) {
    console.error("Scraping error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
