import { GoogleGenerativeAI } from '@google/generative-ai'
import { Bindings } from '../index'
import { EXPERT_SYSTEM_PROMPT } from '../prompts'

export class AIService {
  private genAI: GoogleGenerativeAI

  constructor(env: Bindings) {
    this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY)
  }

  async analyzeImage(imageBuffer: ArrayBuffer, mimeType: string) {
    const model = this.genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' })
    
    // Convert ArrayBuffer to Base64
    const base64Data = Buffer.from(imageBuffer).toString('base64')

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType
      }
    }

    const result = await model.generateContent([
      EXPERT_SYSTEM_PROMPT,
      imagePart
    ])

    return result.response.text()
  }

  async generateImage(prompt: string): Promise<ArrayBuffer> {
     // Note: As of now, image generation via 'gemini-3-pro-image-preview' might differ.
     // If it's not supported by standard generateContent, we might need a different approach.
     // However, for the sake of this structure, we assume it returns an image blob or url.
     // If the model returns a base64 string in text, we parse it.
     
     // PROVISIONAL IMPLEMENTATION:
     // Assuming the model returns a JSON with image_url or base64.
     // OR if it's a real image generation model, it might return binary.
     
     const model = this.genAI.getGenerativeModel({ model: 'gemini-3-pro-image-preview' })
     const result = await model.generateContent(prompt)
     
     // Mocking response extraction for now as 'gemini-3-pro-image-preview' API details are hypothetical/preview.
     // In a real scenario, we would check result.response.candidates[0].content...
     
     const text = result.response.text()
     // Assume text contains a URL or Base64 (Instructions should ensure this)
     // If it's base64:
     return Buffer.from(text, 'base64') 
  }
}
