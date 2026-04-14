import mammoth from "mammoth"

function normalizeExtractedText(text: string | null | undefined) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

// pdfjs-dist v5 (used by pdf-parse v2) executes `new DOMMatrix()` at module
// evaluation time to initialise a rendering constant (SCALE_MATRIX). DOMMatrix
// is a browser Canvas API absent in Node.js. We install a spec-compliant 2-D
// affine-matrix polyfill on globalThis *before* the dynamic import so pdfjs
// can evaluate safely. The dynamic import also ensures Next.js's serverless
// bundler hasn't already evaluated pdfjs before the polyfill is in place.
function ensureDOMMatrix() {
  if (typeof globalThis.DOMMatrix !== "undefined") return

  class DOMMatrixPolyfill {
    a: number; b: number; c: number; d: number; e: number; f: number
    m11: number; m12: number; m13: number; m14: number
    m21: number; m22: number; m23: number; m24: number
    m31: number; m32: number; m33: number; m34: number
    m41: number; m42: number; m43: number; m44: number
    is2D: boolean
    isIdentity: boolean

    constructor(init?: string | number[]) {
      this.m11 = 1; this.m12 = 0; this.m13 = 0; this.m14 = 0
      this.m21 = 0; this.m22 = 1; this.m23 = 0; this.m24 = 0
      this.m31 = 0; this.m32 = 0; this.m33 = 1; this.m34 = 0
      this.m41 = 0; this.m42 = 0; this.m43 = 0; this.m44 = 1
      this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0
      this.is2D = true
      this.isIdentity = true

      if (Array.isArray(init)) {
        if (init.length === 6) {
          ;[this.a, this.b, this.c, this.d, this.e, this.f] = init
          this.m11 = this.a;  this.m12 = this.b
          this.m21 = this.c;  this.m22 = this.d
          this.m41 = this.e;  this.m42 = this.f
        } else if (init.length === 16) {
          ;[
            this.m11, this.m12, this.m13, this.m14,
            this.m21, this.m22, this.m23, this.m24,
            this.m31, this.m32, this.m33, this.m34,
            this.m41, this.m42, this.m43, this.m44,
          ] = init
          this.a = this.m11; this.b = this.m12
          this.c = this.m21; this.d = this.m22
          this.e = this.m41; this.f = this.m42
          this.is2D = false
        }
      }
      this.isIdentity =
        this.a === 1 && this.b === 0 && this.c === 0 && this.d === 1 &&
        this.e === 0 && this.f === 0
    }

    private multiply(other: DOMMatrixPolyfill): DOMMatrixPolyfill {
      return new DOMMatrixPolyfill([
        this.a * other.a + this.c * other.b,
        this.b * other.a + this.d * other.b,
        this.a * other.c + this.c * other.d,
        this.b * other.c + this.d * other.d,
        this.a * other.e + this.c * other.f + this.e,
        this.b * other.e + this.d * other.f + this.f,
      ])
    }

    multiplySelf(other: DOMMatrixPolyfill): this {
      return Object.assign(this, this.multiply(other))
    }

    preMultiplySelf(other: DOMMatrixPolyfill): this {
      return Object.assign(this, other.multiply(this))
    }

    invertSelf(): this {
      const det = this.a * this.d - this.b * this.c
      if (det === 0) return this
      const i = 1 / det
      return Object.assign(
        this,
        new DOMMatrixPolyfill([
          this.d * i,
          -this.b * i,
          -this.c * i,
          this.a * i,
          (this.c * this.f - this.d * this.e) * i,
          (this.b * this.e - this.a * this.f) * i,
        ])
      )
    }

    translate(tx: number, ty: number): DOMMatrixPolyfill {
      return this.multiply(new DOMMatrixPolyfill([1, 0, 0, 1, tx, ty]))
    }

    scale(sx: number, sy = sx): DOMMatrixPolyfill {
      return this.multiply(new DOMMatrixPolyfill([sx, 0, 0, sy, 0, 0]))
    }

    transformPoint(p: { x?: number; y?: number }): { x: number; y: number; z: number; w: number } {
      const x = p.x ?? 0
      const y = p.y ?? 0
      return {
        x: this.a * x + this.c * y + this.e,
        y: this.b * x + this.d * y + this.f,
        z: 0,
        w: 1,
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).DOMMatrix = DOMMatrixPolyfill
}

export async function extractResumeText(
  file: File
): Promise<{ extractedText: string | null; normalizedText: string | null; status: "ready" | "failed" }> {
  try {
    let extractedText: string | null = null

    if (file.type === "application/pdf") {
      ensureDOMMatrix()
      const { PDFParse } = await import("pdf-parse")

      const parser = new PDFParse({
        data: new Uint8Array(await file.arrayBuffer()),
      })
      try {
        const result = await parser.getText()
        extractedText = result.text ?? null
      } finally {
        await parser.destroy().catch(() => undefined)
      }
    } else if (
      file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({
        buffer: Buffer.from(await file.arrayBuffer()),
      })
      extractedText = result.value ?? null
    } else if (file.type.startsWith("text/")) {
      extractedText = await file.text()
    }

    const normalizedText = normalizeExtractedText(extractedText)
    if (!normalizedText) {
      return { extractedText: null, normalizedText: null, status: "failed" }
    }

    return {
      extractedText: extractedText?.trim() ?? normalizedText,
      normalizedText,
      status: "ready",
    }
  } catch (err) {
    console.error("[extractResumeText]", err)
    return { extractedText: null, normalizedText: null, status: "failed" }
  }
}
