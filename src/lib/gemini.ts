import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Global processing queue to prevent concurrent API floods (serializes all AI requests)
class TaskQueue {
  private queue: (() => Promise<any>)[] = [];
  private processing = false;

  async add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift();
      if (task) {
        await task();
        // Increased breather for extreme quota safety
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    this.processing = false;
  }
}

const globalQueue = new TaskQueue();

/**
 * Helper to call Gemini with exponential backoff for 429 errors
 */
async function callGeminiWithRetry(fn: () => Promise<any>, maxRetries = 10) {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Use the global queue to ensure we never hit concurrent limits
      return await globalQueue.add(fn);
    } catch (error: any) {
      lastError = error;
      const errorMsg = JSON.stringify(error)?.toLowerCase() || "";
      // Catch 429s, resource exhaustion, and specific "quota" messages
      const isRateLimit = 
        errorMsg.includes("429") || 
        errorMsg.includes("resource_exhausted") || 
        errorMsg.includes("quota") ||
        errorMsg.includes("limit_exceeded") ||
        error?.status === 429;
      
      if (isRateLimit && i < maxRetries - 1) {
        // Progressive backoff: 5s, 10s, 20s...
        const baseDelay = 5000;
        const delay = Math.pow(2, i) * baseDelay + Math.random() * 2000;
        console.warn(`Gemini Rate Limit/Quota. Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

const MODEL_NAME = "gemini-flash-latest";

export async function matchCandidate(
  cvText: string,
  jobDescription: string,
  keywords: string = ""
) {
  const prompt = `
    You are an expert talent recruiter. Match the following candidate CV against the job description and additional keywords.
    
    Job Description:
    ${jobDescription}
    
    Additional Keywords:
    ${keywords}
    
    Candidate CV Content:
    ${cvText}
    
    Provide a match score (0-100), a brief explanation of why they match, and a list of matched skills.
    Be objective and highlight both strengths and potential gaps.
  `;

  try {
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            score: { type: Type.NUMBER },
            explanation: { type: Type.STRING },
            matchedSkills: { 
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["score", "explanation", "matchedSkills"]
        }
      }
    }));

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Gemini Matching Error:", error);
    return {
      score: 0,
      explanation: "AI model capacity reached. Retrying manually later is recommended.",
      matchedSkills: []
    };
  }
}

export async function generateJobSummary(title: string, description: string) {
  const prompt = `
    Act as an expert recruiter. Summarize the following job role in exactly 1-2 concise, professional lines.
    Highlight the primary responsibilities and the most critical 2-3 areas of expertise required.
    
    Job Title: ${title}
    Job Description: ${description}
    
    Concise Summary:
  `;

  try {
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt
    }));

    return response.text.trim();
  } catch (error) {
    console.error("Gemini Summary Error:", error);
    return description.substring(0, 150) + "...";
  }
}

export async function extractCVData(text: string) {
  const prompt = `
    Analyze the following CV text and extract key professional metadata with high precision.
    
    CRITICAL RULES:
    1. Candidate Name: Look for the name at the very top of the text. It is usually the most prominent text. Avoid generic labels like "CV" or "Resume". 
    2. Candidate Email: Extract the primary email address.
    3. Most Recent Job Title: Identify the most current role mentioned in the experience section.
    4. Field / Specialization: Identify the primary industry or technical domain.
    
    If any field is missing, provide a professional inference rather than "Unknown" for Name, Title and Field. For Email, return an empty string if not found.
    
    CV TEXT:
    ${text}
  `;

  try {
    const response = await callGeminiWithRetry(() => ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            email: { type: Type.STRING },
            recentTitle: { type: Type.STRING },
            field: { type: Type.STRING }
          },
          required: ["name", "email", "recentTitle", "field"]
        }
      }
    }));

    const data = JSON.parse(response.text);
    if (!data.name || data.name.toLowerCase() === "unknown") data.name = "Candidate Name";
    if (!data.recentTitle || data.recentTitle.toLowerCase() === "unknown") data.recentTitle = "Professional";
    if (!data.field || data.field.toLowerCase() === "unknown") data.field = "General Industry";
    
    return data;
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    return {
      name: "Candidate Name",
      email: "",
      recentTitle: "Professional",
      field: "General Industry"
    };
  }
}
