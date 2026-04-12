import mammoth from "mammoth"
import { PDFParse } from "pdf-parse"

function normalizeExtractedText(text: string | null | undefined) {
  return String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

export async function extractResumeText(
  file: File
): Promise<{ extractedText: string | null; normalizedText: string | null; status: "ready" | "failed" }> {
  try {
    let extractedText: string | null = null

    if (file.type === "application/pdf") {
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
      return {
        extractedText: null,
        normalizedText: null,
        status: "failed",
      }
    }

    return {
      extractedText: extractedText?.trim() ?? normalizedText,
      normalizedText,
      status: "ready",
    }
  } catch {
    return {
      extractedText: null,
      normalizedText: null,
      status: "failed",
    }
  }
}
