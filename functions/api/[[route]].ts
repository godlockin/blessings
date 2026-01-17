import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { handle } from 'hono/cloudflare-pages'
import { Buffer } from 'node:buffer'
import { OSSService } from '../lib/services/oss'
import { AIService } from '../lib/services/ai'

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

const app = new Hono<{ Bindings: Bindings }>().basePath('/api')

app.use('/*', cors())

app.onError((err, c) => {
    console.error(`[Global Error] ${err.name}: ${err.message}`, err.stack)
    return c.json({
        error: 'Internal Server Error',
        message: err.message
    }, 500)
})

app.notFound((c) => {
    return c.json({ error: 'Not Found', path: c.req.path }, 404)
})

app.get('/', (c) => {
    return c.text('Blessings API is running!')
})

app.get('', (c) => {
    return c.text('Blessings API is running!')
})

// Synchronous processing - wait for completion and return result directly
app.post('/upload', async (c) => {
    try {
        const body = await c.req.parseBody()
        const image = body['image']
        const inviteCode = body['invite_code'] as string | undefined

        if (c.env.INVITE_CODE) {
            if (!inviteCode || inviteCode !== c.env.INVITE_CODE) {
                return c.json({ error: 'Invalid or missing invite code' }, 403)
            }
        }

        if (!(image instanceof File)) {
            return c.json({ error: 'Image file is required' }, 400)
        }

        const sessionId = crypto.randomUUID()
        const oss = new OSSService(c.env)
        const ai = new AIService(c.env)
        const imageBuffer = await image.arrayBuffer()

        const now = new Date()
        const timeStr = now.toISOString().replace(/[-:T]/g, '').slice(0, 14)
        const sessionDir = `${timeStr}_${sessionId}`

        const prefix = c.env.OSS_PREFIX ? c.env.OSS_PREFIX.replace(/\/+$/, '') + '/' : ''
        const imagePath = `${prefix}sessions/${sessionDir}/original.jpg`

        // Upload original image
        await oss.putObject(imagePath, imageBuffer, image.type)
        console.log('Original image uploaded:', imagePath)

        // AI Analysis
        console.log('Starting AI analysis...')
        const analysisResult = await ai.analyzeImage(imageBuffer, image.type)
        let analysisJson: any = {}
        try {
            const jsonStr = analysisResult.replace(/```json/g, '').replace(/```/g, '').trim()
            analysisJson = JSON.parse(jsonStr)
        } catch (e) {
            analysisJson = { raw_analysis: analysisResult }
        }
        console.log('Analysis complete')

        // Build generation prompt
        const prompt = `Generate a Chinese New Year blessing photo based on this analysis: ${JSON.stringify(analysisJson)}`

        // Generate with expert review (synchronous)
        console.log('Starting image generation with expert review...')
        const { imageBuffer: generatedImageBuffer, finalReview, attempts } = await ai.generateWithReview(
            prompt,
            imageBuffer,
            3
        )
        console.log(`Generation complete after ${attempts} attempts`)

        // Upload generated image
        const generatedPath = `${prefix}sessions/${sessionDir}/generated.jpg`
        await oss.putObject(generatedPath, generatedImageBuffer, 'image/jpeg')
        console.log('Generated image uploaded:', generatedPath)

        // Return result directly
        return c.json({
            success: true,
            sessionId,
            imageUrl: `data:image/jpeg;base64,${Buffer.from(generatedImageBuffer).toString('base64')}`,
            analysis: {
                ...analysisJson,
                expert_review: finalReview,
                generation_attempts: attempts
            }
        })
    } catch (error: any) {
        console.error('Processing error:', error)
        return c.json({ error: error.message }, 500)
    }
})

export const onRequest = handle(app)
