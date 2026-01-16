import { AwsClient } from 'aws4fetch'

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
export class OSSService {
  private client: AwsClient
  private bucket: string
  private endpoint: string

  constructor(env: Bindings) {
    this.bucket = env.OSS_BUCKET
    this.endpoint = env.OSS_ENDPOINT
    this.client = new AwsClient({
      accessKeyId: env.OSS_ACCESS_KEY_ID,
      secretAccessKey: env.OSS_ACCESS_KEY_SECRET,
      service: 'oss',
      region: env.OSS_REGION,
    })
  }

  async putObject(key: string, data: ReadableStream | ArrayBuffer | string | Blob, contentType: string) {
    // Aliyun OSS virtual-hosted style: https://{bucket}.{endpoint}/{key}
    // Assumes endpoint is like "oss-cn-hangzhou.aliyuncs.com"
    const host = `${this.bucket}.${this.endpoint}`.replace('https://', '')
    const url = `https://${host}/${key}`

    const response = await this.client.fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD', // Required for OSS S3 compatibility
      },
      body: data,
    })

    if (!response.ok) {
      throw new Error(`Failed to upload to OSS: ${response.status} ${await response.text()}`)
    }

    return url
  }

  async getSignedUrl(key: string, method: 'GET' | 'PUT' = 'GET', expiresIn: number = 3600) {
    const host = `${this.bucket}.${this.endpoint}`.replace('https://', '')
    const url = `https://${host}/${key}`

    const signed = await this.client.sign(url, {
      method: method,
      aws: { signQuery: true },
    })

    return signed.url
  }

  async getObject(key: string): Promise<ArrayBuffer> {
    const host = `${this.bucket}.${this.endpoint}`.replace('https://', '')
    const url = `https://${host}/${key}`

    // OSS might require signing for GET requests if the bucket is private
    // Using aws4fetch to sign the GET request
    const signed = await this.client.sign(url, {
      method: 'GET',
      headers: {
        'x-amz-content-sha256': 'UNSIGNED-PAYLOAD'
      }
    })

    const response = await fetch(signed.url, {
      method: signed.method,
      headers: signed.headers
    })

    if (!response.ok) {
      throw new Error(`Failed to get object from OSS: ${response.status}`)
    }

    return await response.arrayBuffer()
  }
}
