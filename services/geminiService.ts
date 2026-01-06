
import { GoogleGenAI, Type } from "@google/genai";
import { Card } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const fullMindMapSchema = {
  type: Type.OBJECT,
  properties: {
    message: { type: Type.STRING },
    children: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          message: { type: Type.STRING },
          children: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                message: { type: Type.STRING },
                children: { type: Type.ARRAY, items: { type: Type.OBJECT } }
              }
            }
          }
        }
      }
    }
  },
  required: ["message", "children"],
};

export const generateMindMap = async (topic: string): Promise<Card> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Create a comprehensive mind map for: "${topic}". 
    The output must be a deeply nested JSON object. Each node must have a 'message' and a 'children' array.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: fullMindMapSchema,
      tools: [{ googleSearch: {} }]
    },
  });

  const rawJson = JSON.parse(response.text);
  const addIds = (node: any): Card => ({
    id: Math.random().toString(36).substr(2, 9),
    message: node.message || "New Topic",
    children: (node.children || []).map((child: any) => addIds(child)),
  });

  return addIds(rawJson);
};

export const expandNode = async (parentMessage: string, context: string, fullTreeString: string): Promise<Card[]> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `The user is expanding the node "${parentMessage}" in a mind map about "${context}".
    The existing map structure is: ${fullTreeString}.
    Provide 3 to 5 new, unique sub-topics that don't already exist in the tree.
    Return as a JSON array of objects with 'message' and 'children' (empty array).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            children: { type: Type.ARRAY, items: { type: Type.OBJECT } }
          },
          required: ["message", "children"]
        }
      },
    },
  });

  const rawJson = JSON.parse(response.text);
  return rawJson.map((node: any) => ({
    id: Math.random().toString(36).substr(2, 9),
    message: node.message || "New Sub-topic",
    children: [],
  }));
};

export const analyzeMap = async (fullTree: Card, query: string): Promise<string> => {
  const treeText = JSON.stringify(fullTree);
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are an expert strategist. Below is a JSON representation of a user's mind map:
    ${treeText}
    
    The user is asking: "${query}"
    Provide a professional, insightful response based strictly on the content of the map. Use Markdown for formatting.`,
  });
  return response.text || "I couldn't analyze the map at this time.";
};
