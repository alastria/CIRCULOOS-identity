import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'

export interface VCPDFData {
  id?: string
  type: string | string[]
  issuer: string | { id: string }
  issuanceDate: string
  expirationDate?: string
  credentialSubject: any
  proof?: any
}

export async function generateVCPDF(vc: VCPDFData, baseUrl?: string): Promise<Uint8Array> {
  // REQUIRED: baseUrl must be provided or come from environment
  const appUrl = baseUrl || process.env.NEXT_PUBLIC_APP_URL
  if (!appUrl) {
    throw new Error('NEXT_PUBLIC_APP_URL is required for PDF generation')
  }
  
  // Create PDF document
  const pdfDoc = await PDFDocument.create()
  const page = pdfDoc.addPage([595.28, 841.89]) // A4 Portrait

  // Load fonts
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const courier = await pdfDoc.embedFont(StandardFonts.Courier)

  // Colors
  const black = rgb(0, 0, 0)
  const primary = rgb(0.2, 0.4, 0.8) // Alastria blue
  const gray = rgb(0.42, 0.45, 0.50)
  const lightGray = rgb(0.90, 0.91, 0.92)

  let y = 800

  // Header
  page.drawText('ALASTRIA', {
    x: 50,
    y,
    size: 24,
    font: helveticaBold,
    color: primary,
  })

  page.drawText('Verifiable Credential', {
    x: 50,
    y: y - 30,
    size: 16,
    font: helvetica,
    color: gray,
  })

  y -= 70

  // Separator
  page.drawLine({
    start: { x: 50, y },
    end: { x: 545, y },
    thickness: 1,
    color: lightGray,
  })

  y -= 30

  // Credential Type
  const credentialType = Array.isArray(vc.type) ? vc.type[1] || vc.type[0] : vc.type
  page.drawText('Tipo de Credencial:', {
    x: 50,
    y,
    size: 10,
    font: helvetica,
    color: gray,
  })
  page.drawText(credentialType || 'VerifiableCredential', {
    x: 50,
    y: y - 18,
    size: 14,
    font: helveticaBold,
    color: black,
  })

  y -= 50

  // Issuer
  const issuerStr = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer?.id || 'Unknown'
  page.drawText('Emisor:', {
    x: 50,
    y,
    size: 10,
    font: helvetica,
    color: gray,
  })
  page.drawText(issuerStr, {
    x: 50,
    y: y - 18,
    size: 12,
    font: helvetica,
    color: black,
  })

  y -= 40

  // Holder
  const holderAddress = vc.credentialSubject?.id || vc.credentialSubject?.holderAddress || 'Unknown'
  page.drawText('Titular:', {
    x: 50,
    y,
    size: 10,
    font: helvetica,
    color: gray,
  })
  page.drawText(holderAddress, {
    x: 50,
    y: y - 18,
    size: 12,
    font: courier,
    color: black,
  })

  y -= 40

  // Issue Date
  const issueDate = new Date(vc.issuanceDate).toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  page.drawText('Fecha de Emisión:', {
    x: 50,
    y,
    size: 10,
    font: helvetica,
    color: gray,
  })
  page.drawText(issueDate, {
    x: 50,
    y: y - 18,
    size: 12,
    font: helvetica,
    color: black,
  })

  y -= 40

  // Expiration Date (if exists)
  if (vc.expirationDate) {
    const expDate = new Date(vc.expirationDate).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    page.drawText('Válida hasta:', {
      x: 50,
      y,
      size: 10,
      font: helvetica,
      color: gray,
    })
    page.drawText(expDate, {
      x: 50,
      y: y - 18,
      size: 12,
      font: helvetica,
      color: black,
    })
    y -= 40
  }

  // Additional attributes
  if (vc.credentialSubject) {
    y -= 20
    page.drawText('Atributos:', {
      x: 50,
      y,
      size: 10,
      font: helvetica,
      color: gray,
    })
    y -= 20

    for (const [key, value] of Object.entries(vc.credentialSubject)) {
      if (key === 'id' || key === 'holderAddress') continue
      if (typeof value === 'object') continue

      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
      page.drawText(`${label}:`, {
        x: 50,
        y,
        size: 9,
        font: helvetica,
        color: gray,
      })
      page.drawText(String(value), {
        x: 50,
        y: y - 16,
        size: 11,
        font: helvetica,
        color: black,
      })
      y -= 35
    }
  }

  // QR Code for verification
  // SECURITY: Use VC ID instead of full VC to prevent data exposure in QR codes
  // The verifier will fetch the full VC from the backend using this ID
  const vcId = vc.id || 'unknown'
  const verifyUrl = `${appUrl}/verify?id=${encodeURIComponent(vcId)}`
  try {
    const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 150 })
    const qrImageBytes = await fetch(qrDataUrl).then((res) => res.arrayBuffer())
    const qrImage = await pdfDoc.embedPng(qrImageBytes)

    page.drawImage(qrImage, {
      x: 400,
      y: 150,
      width: 120,
      height: 120,
    })

    page.drawText('Escanear para verificar', {
      x: 415,
      y: 135,
      size: 9,
      font: helvetica,
      color: gray,
    })
  } catch (err) {
    console.error('Error generating QR code:', err)
  }

  // Footer
  page.drawText(
    'Documento firmado criptográficamente. Válido solo en su forma digital. Generado por Alastria.',
    {
      x: 50,
      y: 50,
      size: 8,
      font: helvetica,
      color: lightGray,
    }
  )

  // Embed VC JSON in PDF metadata for verification
  const vcJsonString = JSON.stringify(vc)
  // Use browser-compatible base64 encoding
  const vcBase64 = btoa(unescape(encodeURIComponent(vcJsonString)))

  pdfDoc.setSubject(vcBase64) // Store VC in subject metadata
  pdfDoc.setTitle('Verifiable Credential - Alastria')
  pdfDoc.setAuthor('Alastria Consortium')
  pdfDoc.setCreator('Alastria VC Platform')
  pdfDoc.setProducer('pdf-lib')
  pdfDoc.setKeywords(['Verifiable Credential', 'W3C', 'Alastria', 'Blockchain'])

  // Save PDF
  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}

