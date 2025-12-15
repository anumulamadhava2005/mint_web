/* upload helper: supports progress callbacks, retries, and optional proxy endpoint */
export type UploadOptions = {
  onProgress?: (p: number) => void
  retries?: number
  endpoint?: string // override endpoint (default Mint API)
}

const DEFAULT_ENDPOINT = "https://api.mintit.pro/upload/"

// XHR-based uploader so we can report progress in browsers
export async function uploadToMintApi(file: File, opts: UploadOptions = {}): Promise<string | null> {
  const { onProgress, retries = 0, endpoint = DEFAULT_ENDPOINT } = opts

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const url = await doUpload(file, { onProgress, endpoint })
      if (url) return url
      // else throw to retry
      throw new Error("no-url")
    } catch (err) {
      if (attempt === retries) {
        return null
      }
      // small backoff
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)))
    }
  }
  return null
}

function doUpload(file: File, opts: { onProgress?: (p: number) => void; endpoint: string }): Promise<string | null> {
  const { onProgress, endpoint } = opts
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("POST", endpoint)
    const fd = new FormData()
    fd.append("file", file, file.name || "photo.jpg")
    fd.append("user_id", "9198e3fb-4c22-11f0-906d-080027fda028")
    fd.append("is_public", "true")

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        const p = Math.round((e.loaded / e.total) * 100)
        onProgress(p)
      }
    }

    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText)
          // Accept Mint/proxy responses with variants, url, imageUrl, link, or data.url
          if (data.variants && data.variants.length > 0) {
            const high = data.variants.find((v: any) => v.quality === "high")
            resolve((high && high.url) || data.variants[0].url)
            return
          }
          // Accept alternate shapes
          const url = data.url || data.imageUrl || data.link || (data.data && data.data.url)
          if (typeof url === "string" && url.length > 0) {
            resolve(url)
            return
          }
        } catch (e) {
          // fallthrough
        }
        resolve(null)
      } else {
        reject(new Error(`upload-failed:${xhr.status}`))
      }
    }

    xhr.onerror = () => reject(new Error("upload-network-error"))
    try {
      xhr.send(fd)
    } catch (e) {
      reject(e)
    }
  })
}

// A small fetch-based helper used for tests (mockable)
export async function uploadToMintApiFetch(file: File, endpoint = DEFAULT_ENDPOINT): Promise<string | null> {
  const fd = new FormData()
  fd.append("file", file, file.name || "photo.jpg")
  fd.append("user_id", "9198e3fb-4c22-11f0-906d-080027fda028")
  fd.append("is_public", "true")
  const res = await fetch(endpoint, { method: "POST", body: fd })
  const data = await res.json()
  if (res.ok) {
    if (data.variants?.length > 0) {
      const highQualityUrl = data.variants.find((v: any) => v.quality === "high")?.url
      return highQualityUrl || data.variants[0].url
    }
    // Accept alternate shapes
    const url = data.url || data.imageUrl || data.link || (data.data && data.data.url)
    if (typeof url === "string" && url.length > 0) {
      return url
    }
  }
  return null
}

export default uploadToMintApi
