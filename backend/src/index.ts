import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { v4 as uuidv4 } from 'uuid'
import { OSSService } from './services/oss'
import { AIService } from './services/ai'

export type Bindings = {
  DB: D1Database
  GEMINI_API_KEY: string
  OSS_ACCESS_KEY_ID: string
  OSS_ACCESS_KEY_SECRET: string
  OSS_BUCKET: string
  OSS_REGION: string
  OSS_ENDPOINT: string
  OSS_PREFIX?: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', cors())

app.get('/', (c) => {
  return c.text('Blessings API is running!')
})

app.post('/api/upload', async (c) => {
  try {
    const body = await c.req.parseBody()
    const image = body['image']
    // const refObject = body['ref_object'] // Optional

    if (!(image instanceof File)) {
        return c.json({ error: 'Image file is required' }, 400)
    }

    const sessionId = uuidv4()
    const taskId = uuidv4()
    const userId = 'anonymous' // Or from auth

    const oss = new OSSService(c.env)
    
    // Convert File to ArrayBuffer
    const imageBuffer = await image.arrayBuffer()
    
    // Construct OSS Path with Prefix
    const prefix = c.env.OSS_PREFIX ? c.env.OSS_PREFIX.replace(/\/+$/, '') + '/' : ''
    const imagePath = `${prefix}sessions/${sessionId}/original.jpg`

    // Create Task in DB
    try {
        await c.env.DB.prepare(
        `INSERT INTO tasks (id, session_id, user_id, original_image_path, status) VALUES (?, ?, ?, ?, 'PENDING')`
        ).bind(taskId, sessionId, userId, imagePath).run()
    } catch (e) {
        console.error("DB Error:", e)
        return c.json({ error: 'Failed to create task in DB' }, 500)
    }

    // Async processing
    c.executionCtx.waitUntil((async () => {
        try {
            // 1. Upload Original Image
            await oss.putObject(imagePath, imageBuffer, image.type)

            // 2. Update Status to ANALYZING
            await c.env.DB.prepare(`UPDATE tasks SET status = 'ANALYZING' WHERE id = ?`).bind(taskId).run()

            // 3. AI Analysis
            const ai = new AIService(c.env)
            const analysisResult = await ai.analyzeImage(imageBuffer, image.type)
            
            // Check if feasible (parsing JSON from analysisResult)
            let analysisJson: any = {}
            try {
                // Basic cleanup of code blocks if Gemini returns markdown
                const jsonStr = analysisResult.replace(/```json/g, '').replace(/```/g, '').trim()
                analysisJson = JSON.parse(jsonStr)
            } catch (e) {
                console.error("Failed to parse analysis result", e)
            }

            await c.env.DB.prepare(`UPDATE tasks SET analysis_result = ? WHERE id = ?`).bind(JSON.stringify(analysisJson), taskId).run()

            if (analysisJson.is_feasible === false) {
                await c.env.DB.prepare(`UPDATE tasks SET status = 'FAILED' WHERE id = ?`).bind(taskId).run()
                return
            }

            // 4. Update Status to GENERATING
            await c.env.DB.prepare(`UPDATE tasks SET status = 'GENERATING' WHERE id = ?`).bind(taskId).run()

            // 5. Generate Image
            // Construct Prompt based on analysis
            const prompt = `
            Create a Chinese New Year Blessing Photo.
            Subject Description: ${analysisJson.description || 'A person'}
            Style: ${analysisJson.style_tags?.join(', ') || 'Festive, Red, Gold'}
            Creative Direction: Enhance festivity, add dragon/snake elements, red background.
            Retouching: Skin smoothing, bright eyes.
            Ensure Identity Consistency.
            `
            
            const generatedImageBuffer = await ai.generateImage(prompt)
            const generatedPath = `${prefix}sessions/${sessionId}/generated.jpg`

            // 6. Upload Generated Image
            await oss.putObject(generatedPath, generatedImageBuffer, 'image/jpeg')

            // 7. Update Status to COMPLETED
            await c.env.DB.prepare(`UPDATE tasks SET status = 'COMPLETED', generated_image_path = ? WHERE id = ?`)
                .bind(generatedPath, taskId).run()

        } catch (error) {
            console.error('Task processing failed:', error)
            await c.env.DB.prepare(`UPDATE tasks SET status = 'FAILED' WHERE id = ?`).bind(taskId).run()
        }
    })())

    return c.json({
        task_id: taskId,
        session_id: sessionId,
        status: 'PENDING'
    })
  } catch (e: any) {
      return c.json({ error: e.message }, 500)
  }
})

app.get('/api/status/:taskId', async (c) => {
    const taskId = c.req.param('taskId')
    const task = await c.env.DB.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(taskId).first()
    
    if (!task) {
        return c.json({ error: 'Task not found' }, 404)
    }

    return c.json(task)
})

app.get('/api/result/:taskId', async (c) => {
    const taskId = c.req.param('taskId')
    const task = await c.env.DB.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(taskId).first()

    if (!task) {
        return c.json({ error: 'Task not found' }, 404)
    }

    if (task.status !== 'COMPLETED') {
        return c.json({ error: 'Task not completed yet' }, 400)
    }

    const oss = new OSSService(c.env)
    const url = await oss.getSignedUrl(task.generated_image_path as string)

    return c.json({
        url,
        task
    })
})

export default app
