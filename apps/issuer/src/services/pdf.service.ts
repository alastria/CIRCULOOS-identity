import { PDFDocument, rgb, StandardFonts } from 'pdf-lib'
import QRCode from 'qrcode'
import { config } from '../config'
import fs from 'fs'
import path from 'path'

export interface VCPDFData {
  id: string
  type: string | string[]
  issuer: string | { id: string }
  issuanceDate: string
  expirationDate?: string
  credentialSubject: any
  proof?: any
}

export class PDFService {
  private logoImageBytes: Uint8Array | null = null

  constructor() {
    // Try to load logo image at startup
    this.loadLogo()
  }

  private loadLogo(): void {
    try {
      // Try multiple paths for the logo
      const possiblePaths = [
        path.join(__dirname, '../../public/circuloos.png'),
        path.join(process.cwd(), 'public/circuloos.png'),
        path.join(process.cwd(), 'backend/issuer/public/circuloos.png'),
      ]

      for (const logoPath of possiblePaths) {
        if (fs.existsSync(logoPath)) {
          this.logoImageBytes = fs.readFileSync(logoPath)
          // console.log(`[PDFService] Logo loaded from: ${logoPath}`)
          return
        }
      }
      // console.warn('[PDFService] Logo not found in any expected path')
    } catch (err) {
      // console.warn('[PDFService] Could not load logo:', err)
    }
  }

  async generateVCPDF(vc: VCPDFData, baseUrl: string = config.appPublicUrl): Promise<Uint8Array> {
    // Create PDF document
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595.28, 841.89]) // A4 Portrait

    // Load fonts
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const courierBold = await pdfDoc.embedFont(StandardFonts.CourierBold)

    // Colors
    const black = rgb(0, 0, 0)
    const primary = rgb(0.2, 0.4, 0.8) // Alastria blue
    const gray = rgb(0.42, 0.45, 0.50)
    const lightGray = rgb(0.90, 0.91, 0.92)
    const darkGray = rgb(0.3, 0.3, 0.3)

    let y = 800

    // ============ HEADER WITH LOGO ============
    // Try to embed the Circuloos logo
    if (this.logoImageBytes) {
      try {
        const logoImage = await pdfDoc.embedPng(this.logoImageBytes)
        // Scale logo to fit nicely (original is very wide)
        const logoWidth = 150
        const logoHeight = (logoImage.height / logoImage.width) * logoWidth

        page.drawImage(logoImage, {
          x: 50,
          y: y - logoHeight + 15,
          width: logoWidth,
          height: logoHeight,
        })

        // Adjust position for text to be after logo
        y -= logoHeight + 10
      } catch (err) {
        // console.warn('[PDFService] Could not embed logo:', err)
        // Fallback to text header
        page.drawText('CIRCULOOS', {
          x: 50,
          y,
          size: 24,
          font: helveticaBold,
          color: primary,
        })
        y -= 35
      }
    } else {
      // Text fallback if no logo
      page.drawText('CIRCULOOS', {
        x: 50,
        y,
        size: 24,
        font: helveticaBold,
        color: primary,
      })
      y -= 35
    }

    page.drawText('Verifiable Credential', {
      x: 50,
      y,
      size: 16,
      font: helvetica,
      color: gray,
    })

    y -= 40

    // Separator
    page.drawLine({
      start: { x: 50, y },
      end: { x: 545, y },
      thickness: 1,
      color: lightGray,
    })

    y -= 30

    // ============ CREDENTIAL TYPE ============
    const credentialType = Array.isArray(vc.type) ? vc.type[1] || vc.type[0] : vc.type
    page.drawText('Credential Type', {
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

    y -= 55

    // ============ ISSUER (unified format) ============
    const issuerStr = typeof vc.issuer === 'string' ? vc.issuer : vc.issuer?.id || 'Unknown'
    page.drawText('Issuer', {
      x: 50,
      y,
      size: 10,
      font: helvetica,
      color: gray,
    })
    // Use courierBold for DID to match holder format
    page.drawText(issuerStr, {
      x: 50,
      y: y - 18,
      size: 10,
      font: courierBold,
      color: darkGray,
    })

    y -= 55

    // ============ HOLDER (unified format) ============
    const holderAddress = vc.credentialSubject?.id || vc.credentialSubject?.holderAddress || 'Unknown'
    page.drawText('Holder', {
      x: 50,
      y,
      size: 10,
      font: helvetica,
      color: gray,
    })
    // Use same font as issuer for consistency
    page.drawText(holderAddress, {
      x: 50,
      y: y - 18,
      size: 10,
      font: courierBold,
      color: darkGray,
    })

    y -= 55

    // ============ DATES ============
    // Issue Date
    const issueDate = new Date(vc.issuanceDate).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
    page.drawText('Issue Date', {
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

    // Expiration Date (side by side if exists)
    if (vc.expirationDate) {
      const expDate = new Date(vc.expirationDate).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
      page.drawText('Valid Until', {
        x: 300,
        y,
        size: 10,
        font: helvetica,
        color: gray,
      })
      page.drawText(expDate, {
        x: 300,
        y: y - 18,
        size: 12,
        font: helvetica,
        color: black,
      })
    }

    y -= 55

    // ============ ADDITIONAL ATTRIBUTES ============
    if (vc.credentialSubject) {
      const attrs = Object.entries(vc.credentialSubject).filter(
        ([key]) => key !== 'id' && key !== 'holderAddress'
      )

      if (attrs.length > 0) {
        page.drawText('Attributes', {
          x: 50,
          y,
          size: 10,
          font: helvetica,
          color: gray,
        })
        y -= 20

        for (const [key, value] of attrs) {
          if (typeof value === 'object') continue

          const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')
          page.drawText(`${label}:`, {
            x: 60,
            y,
            size: 9,
            font: helvetica,
            color: gray,
          })
          page.drawText(String(value), {
            x: 180,
            y,
            size: 10,
            font: helvetica,
            color: black,
          })
          y -= 22
        }
      }
    }

    // ============ QR CODE FOR VERIFICATION ============
    // The QR points to /vc/[id] which shows the verified credential
    const verifyUrl = `${baseUrl}/vc/${encodeURIComponent(vc.id)}`
    try {
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
        margin: 1,
        width: 180,
        errorCorrectionLevel: 'M'
      })
      const qrImageBytes = await fetch(qrDataUrl).then((res) => res.arrayBuffer())
      const qrImage = await pdfDoc.embedPng(qrImageBytes)

      // Position QR at bottom right
      page.drawImage(qrImage, {
        x: 410,
        y: 120,
        width: 130,
        height: 130,
      })

      page.drawText('Scan to verify', {
        x: 420,
        y: 105,
        size: 9,
        font: helvetica,
        color: gray,
      })

      // Small URL text below QR
      page.drawText(verifyUrl.length > 50 ? verifyUrl.substring(0, 47) + '...' : verifyUrl, {
        x: 410,
        y: 90,
        size: 6,
        font: helvetica,
        color: lightGray,
      })
    } catch (err) {
      // console.error('[PDFService] Error generating QR code:', err)
    }

    // ============ FOOTER ============
    page.drawLine({
      start: { x: 50, y: 70 },
      end: { x: 545, y: 70 },
      thickness: 0.5,
      color: lightGray,
    })

    page.drawText(
      'Cryptographically signed document. Valid only in digital form.',
      {
        x: 50,
        y: 55,
        size: 8,
        font: helvetica,
        color: gray,
      }
    )

    page.drawText(
      `Generado por Circuloos • ID: ${vc.id.substring(0, 40)}...`,
      {
        x: 50,
        y: 42,
        size: 7,
        font: helvetica,
        color: lightGray,
      }
    )

    // ============ EMBED VC JSON IN PDF METADATA ============
    const vcJsonString = JSON.stringify(vc)
    const vcBase64 = Buffer.from(vcJsonString).toString('base64')

    pdfDoc.setSubject(vcBase64) // Store VC in subject metadata
    pdfDoc.setTitle('Verifiable Credential - Circuloos')
    pdfDoc.setAuthor('Circuloos - Alastria Consortium')
    pdfDoc.setCreator('Circuloos VC Platform')
    pdfDoc.setProducer('pdf-lib')
    pdfDoc.setKeywords(['Verifiable Credential', 'W3C', 'Alastria', 'Circuloos', 'Blockchain'])

    // Save PDF
    const pdfBytes = await pdfDoc.save()
    return pdfBytes
  }
}

