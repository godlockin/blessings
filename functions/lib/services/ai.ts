import { GoogleGenerativeAI } from '@google/generative-ai'
import { EXPERT_SYSTEM_PROMPT, EXPERT_REVIEW_PROMPT } from '../prompts'
import { Buffer } from 'node:buffer'

export type Bindings = {
  GEMINI_API_KEY: string
  OSS_ACCESS_KEY_ID: string
  OSS_ACCESS_KEY_SECRET: string
  OSS_BUCKET: string
  OSS_REGION: string
  OSS_ENDPOINT: string
  OSS_PREFIX?: string
  INVITE_CODE?: string
}

export interface ReviewResult {
  approved: boolean
  overall_score: number
  scores: {
    face_match: number
    outfit: number
    pose: number
    full_body: number
    quality: number
    cultural: number
    realism: number
  }
  issues: string[]
  suggestions: string[]
}

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

  /**
   * Generate image using Gemini's native image generation with original image as reference
   * This preserves the person's face identity by using the original image as input
   */
  async generateImage(prompt: string, originalImageBuffer?: ArrayBuffer): Promise<ArrayBuffer> {
    try {
      // Use Gemini for image generation with original image as reference
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-3-pro-image-preview',
        generationConfig: {
          // @ts-ignore - responseModalities may not be in types yet
          responseModalities: ['image', 'text'],
        }
      })

      // Build the generation prompt
      const generationPrompt = `
You are a professional portrait photographer. Create a NEW image based on the person in the reference photo.

CRITICAL INSTRUCTION: The person in the generated image MUST be the EXACT SAME PERSON as in the reference photo. 
Preserve their face, facial features, skin tone, and overall appearance EXACTLY.

TRANSFORMATION REQUIREMENTS:
1. FULL BODY SHOT - Show the complete person from head to toe
2. OUTFIT: Dress them in an elegant traditional red Chinese Qipao (for women) or Tang suit (for men) with gold embroidery
3. POSE: Traditional Chinese New Year blessing gesture - hands clasped together in front of chest (拱手礼), warm genuine smile
4. BACKGROUND: Festive Chinese New Year scene with red lanterns, golden decorations
5. STYLE: Professional portrait photography, natural lighting, photorealistic

THE FACE MUST BE:
- Exactly the same person as the reference
- Sharp and clearly recognizable
- The focal point of the image
- High detail on eyes, nose, lips

Generate a beautiful Chinese New Year blessing photo of this exact person.
`

      const contentParts: any[] = [generationPrompt]

      // Add original image as reference if provided
      if (originalImageBuffer) {
        const base64Data = Buffer.from(originalImageBuffer).toString('base64')
        contentParts.push({
          inlineData: {
            data: base64Data,
            mimeType: 'image/jpeg'
          }
        })
        contentParts.push("This is the reference photo. Generate a Chinese New Year blessing photo of this EXACT SAME PERSON.")
      }

      console.log("Generating image with Gemini (image-to-image)...")

      const result = await model.generateContent(contentParts)
      const response = result.response

      // Extract image from response
      const candidates = response.candidates
      if (!candidates || candidates.length === 0) {
        throw new Error('No candidates in Gemini response')
      }

      const parts = candidates[0].content?.parts
      if (!parts) {
        throw new Error('No parts in Gemini response')
      }

      // Find the image part in the response
      for (const part of parts) {
        // @ts-ignore - inlineData may contain image
        if (part.inlineData && part.inlineData.data) {
          // @ts-ignore
          const imageData = part.inlineData.data
          const imageBuffer = Buffer.from(imageData, 'base64')
          console.log("Successfully generated image with Gemini")
          return imageBuffer.buffer.slice(imageBuffer.byteOffset, imageBuffer.byteOffset + imageBuffer.byteLength)
        }
      }

      // If no image in response, fall back to Pollinations.ai
      console.warn("Gemini did not return an image, falling back to Pollinations.ai")
      return await this.generateImageFallback(prompt)

    } catch (e) {
      console.error("Gemini Image Generation Failed:", e)
      console.log("Falling back to Pollinations.ai")
      return await this.generateImageFallback(prompt)
    }
  }

  /**
   * Fallback image generation using Pollinations.ai (text-to-image only)
   */
  private async generateImageFallback(prompt: string): Promise<ArrayBuffer> {
    const faceMatch = prompt.match(/FACE IDENTITY \(MUST PRESERVE EXACTLY\):\s*([\s\S]*?)(?:Hair:|OUTFIT|$)/);
    const hairMatch = prompt.match(/Hair:\s*(.*?)(?:\n|OUTFIT|$)/);
    const faceDescription = faceMatch ? faceMatch[1].trim() : "person with natural features";
    const hairDescription = hairMatch ? hairMatch[1].trim() : "natural hair";

    const enhancedPrompt = `A photorealistic full body shot of a person with ${faceDescription}, ${hairDescription}. Wearing elegant red Chinese Qipao or Tang suit, traditional blessing gesture (拱手礼), Chinese New Year celebration background with red lanterns, professional photography, 8k resolution`;
    const encodedPrompt = encodeURIComponent(enhancedPrompt);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&width=768&height=1024`;

    console.log("Fetching fallback image from Pollinations.ai");

    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from Pollinations.ai: ${response.statusText}`);
    }

    return await response.arrayBuffer();
  }

  /**
   * Expert panel reviews the generated image against the original
   */
  async reviewGeneratedImage(
    generatedImageBuffer: ArrayBuffer,
    originalImageBuffer: ArrayBuffer
  ): Promise<ReviewResult> {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' })

      const originalBase64 = Buffer.from(originalImageBuffer).toString('base64')
      const generatedBase64 = Buffer.from(generatedImageBuffer).toString('base64')

      const originalImagePart = {
        inlineData: {
          data: originalBase64,
          mimeType: 'image/jpeg'
        }
      }

      const generatedImagePart = {
        inlineData: {
          data: generatedBase64,
          mimeType: 'image/jpeg'
        }
      }

      const result = await model.generateContent([
        EXPERT_REVIEW_PROMPT,
        "ORIGINAL PHOTO (reference for face identity):",
        originalImagePart,
        "GENERATED BLESSING PHOTO (to evaluate):",
        generatedImagePart
      ])

      const responseText = result.response.text()

      // Parse JSON response
      try {
        const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim()
        const reviewResult = JSON.parse(jsonStr) as ReviewResult
        console.log("Expert Review Result:", reviewResult)
        return reviewResult
      } catch (parseError) {
        console.error("Failed to parse review result:", parseError)
        // Return a default "not approved" result if parsing fails
        return {
          approved: false,
          overall_score: 0,
          scores: { face_match: 0, outfit: 0, pose: 0, full_body: 0, quality: 0, cultural: 0, realism: 0 },
          issues: ["Failed to parse expert review response"],
          suggestions: ["Retry generation"]
        }
      }
    } catch (e) {
      console.error("Expert Review Failed:", e)
      // On error, return not approved to trigger retry
      return {
        approved: false,
        overall_score: 0,
        scores: { face_match: 0, outfit: 0, pose: 0, full_body: 0, quality: 0, cultural: 0, realism: 0 },
        issues: ["Expert review process failed"],
        suggestions: ["Retry generation"]
      }
    }
  }

  /**
   * Generate image with optional expert review loop
   * Will retry up to maxRetries times if experts don't approve
   * @param skipReview If true, skips the review step entirely for faster processing
   */
  async generateWithReview(
    prompt: string,
    originalImageBuffer: ArrayBuffer,
    maxRetries: number = 3,
    onStatusUpdate?: (status: string, attempt: number, review?: ReviewResult) => Promise<void>,
    skipReview: boolean = false
  ): Promise<{ imageBuffer: ArrayBuffer; finalReview: ReviewResult; attempts: number }> {
    let lastGeneratedBuffer: ArrayBuffer | null = null
    let lastReview: ReviewResult | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`Generation attempt ${attempt}/${maxRetries}`)

      if (onStatusUpdate) {
        await onStatusUpdate('GENERATING', attempt)
      }

      // Generate image with original as reference for face preservation
      const generatedBuffer = await this.generateImage(prompt, originalImageBuffer)
      lastGeneratedBuffer = generatedBuffer

      // Skip review if disabled
      if (skipReview) {
        console.log('Review disabled, skipping expert review')
        const autoApproveReview: ReviewResult = {
          approved: true,
          overall_score: 10,
          scores: { face_match: 10, outfit: 10, pose: 10, full_body: 10, quality: 10, cultural: 10, realism: 10 },
          issues: [],
          suggestions: []
        }
        return {
          imageBuffer: generatedBuffer,
          finalReview: autoApproveReview,
          attempts: attempt
        }
      }

      if (onStatusUpdate) {
        await onStatusUpdate('REVIEWING', attempt)
      }

      // Expert review
      const review = await this.reviewGeneratedImage(generatedBuffer, originalImageBuffer)
      lastReview = review

      console.log(`Attempt ${attempt} - Approved: ${review.approved}, Score: ${review.overall_score}`)

      if (review.approved) {
        console.log(`Image approved on attempt ${attempt}!`)
        return {
          imageBuffer: generatedBuffer,
          finalReview: review,
          attempts: attempt
        }
      }

      // Not approved - log issues and suggestions for next attempt
      console.log(`Attempt ${attempt} rejected. Issues:`, review.issues)
      console.log(`Suggestions for improvement:`, review.suggestions)

      if (onStatusUpdate) {
        await onStatusUpdate('REGENERATING', attempt, review)
      }
    }

    // Max retries reached, return the last generated image
    console.log(`Max retries (${maxRetries}) reached. Returning last generated image.`)
    return {
      imageBuffer: lastGeneratedBuffer!,
      finalReview: lastReview!,
      attempts: maxRetries
    }
  }
}
