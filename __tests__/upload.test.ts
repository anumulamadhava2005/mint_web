import { describe, it, expect, vi } from 'vitest'
import { uploadToMintApiFetch } from '../lib/upload'

describe('uploadToMintApiFetch', () => {
  it('returns high quality variant when present', async () => {
    const fakeUrl = 'https://cdn.example.com/high.jpg'
    const mockRes = {
      ok: true,
      json: async () => ({ variants: [{ quality: 'low', url: 'https://x/low.jpg' }, { quality: 'high', url: fakeUrl }] }),
    }
    // @ts-ignore
    global.fetch = vi.fn(async () => mockRes)

    // create a dummy File
    const blob = new Blob(['hello'], { type: 'image/jpeg' })
    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' })

    const res = await uploadToMintApiFetch(file)
    expect(res).toBe(fakeUrl)
  })
})
