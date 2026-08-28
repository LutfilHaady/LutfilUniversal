import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

/**
 * API endpoint to extract invoice data from uploaded images
 * 
 * This endpoint accepts image files and extracts invoice information using OpenAI Vision API.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!imageFile.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'File must be an image' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (imageFile.size > maxSize) {
      return NextResponse.json(
        { error: 'Image file size must be less than 10MB' },
        { status: 400 }
      )
    }

    // Check for OpenAI API key
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      console.warn('OPENAI_API_KEY not configured, returning manual entry form')
      return NextResponse.json({
        success: true,
        message: 'OCR not configured. Please enter invoice details manually.',
        invoice: null,
      })
    }

    // Convert image to base64
    const arrayBuffer = await imageFile.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const base64Image = buffer.toString('base64')
    const mimeType = imageFile.type || 'image/jpeg'

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey: openaiApiKey })

    // Use OpenAI Vision API to extract invoice data
    const prompt = `Extract invoice data from this image and return it as a JSON object with the following structure:
{
  "buyerId": "buyer ID if visible (e.g., BJ9436), or empty string",
  "invoiceDate": "invoice date in format YYYY-MM-DD or DD/MM/YYYY",
  "dueDate": "due date in format YYYY-MM-DD or DD/MM/YYYY (if not visible, leave empty)",
  "paymentMethod": "payment method (e.g., Debit/Credit Card, Bank Transfer, etc.)",
  "orderId": "order ID if visible, or empty string",
  "items": [{"item": "item name", "quantity": number, "unitPrice": number}],
  "subtotal": number (sum of all item totals before VAT),
  "vatRate": number (VAT percentage, e.g., 9 for 9%),
  "vatAmount": number (VAT amount),
  "paymentProcessingFee": number (payment processing fee amount),
  "total": number (final total amount),
  "notes": "any additional notes or information"
}

Important:
- Extract all itemized products with their quantities and unit prices
- Calculate subtotal as sum of (quantity * unitPrice) for all items
- Extract VAT rate as percentage (e.g., 9 for 9%)
- Extract VAT amount and payment processing fee amounts
- Extract total amount (the final amount to be paid)
- For Indonesian Rupiah amounts: "Rp 132.869,00" means 132869.00 (dots are thousands, comma is decimal)
- Convert all amounts to numbers without currency symbols (e.g., "Rp 50.000,00" becomes 50000)
- For unitPrice in items, use the same format (e.g., "Rp 50.000,00" becomes 50000)
- Convert dates to YYYY-MM-DD format if possible
- If buyer ID is not visible, leave it as empty string
- Return ONLY valid JSON, no additional text or explanation`

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o', // or 'gpt-4-vision-preview' if available
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: prompt,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64Image}`,
                },
              },
            ],
          },
        ],
        max_tokens: 2000,
      })

      const extractedText = response.choices[0]?.message?.content
      if (!extractedText) {
        throw new Error('No response from OpenAI')
      }

      // Parse the JSON response
      let extractedData
      try {
        // Try to extract JSON from the response (in case there's extra text)
        const jsonMatch = extractedText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          extractedData = JSON.parse(jsonMatch[0])
        } else {
          extractedData = JSON.parse(extractedText)
        }
      } catch (parseError) {
        console.error('Error parsing OpenAI response:', extractedText)
        throw new Error('Failed to parse extracted data')
      }

      // Normalize numeric values (handle Indonesian format)
      const normalizeAmount = (value: any): number => {
        if (typeof value === 'number') return value
        if (typeof value === 'string') {
          let cleaned = value.replace(/[Rp\s]/g, '')
          cleaned = cleaned.replace(/\./g, '').replace(',', '.')
          return parseFloat(cleaned) || 0
        }
        return 0
      }

      const subtotal = normalizeAmount(extractedData.subtotal)
      const vatAmount = normalizeAmount(extractedData.vatAmount)
      const paymentProcessingFee = normalizeAmount(extractedData.paymentProcessingFee)

      // Calculate payment processing fee rate if we have subtotal and fee amount
      let paymentProcessingFeeRate = '4' // default
      if (subtotal > 0 && paymentProcessingFee > 0) {
        const rate = (paymentProcessingFee / subtotal) * 100
        paymentProcessingFeeRate = rate.toFixed(2)
      }

      // Format items as JSON string for the form
      // Also normalize item prices (handle Indonesian format)
      let items = extractedData.items || []
      if (Array.isArray(items)) {
        items = items.map((item: any) => ({
          ...item,
          unitPrice: normalizeAmount(item.unitPrice),
          quantity: typeof item.quantity === 'number' ? item.quantity : parseFloat(item.quantity) || 1,
        }))
      }
      const itemsJson = JSON.stringify(items)

      // Format dates
      let invoiceDate = extractedData.invoiceDate || ''
      let dueDate = extractedData.dueDate || ''

      // Convert DD/MM/YYYY to YYYY-MM-DD if needed
      if (invoiceDate && invoiceDate.includes('/')) {
        const parts = invoiceDate.split('/')
        if (parts.length === 3) {
          invoiceDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
        }
      }
      if (dueDate && dueDate.includes('/')) {
        const parts = dueDate.split('/')
        if (parts.length === 3) {
          dueDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
        }
      }

      // Format amount - use normalized total or calculate from subtotal + VAT + fees
      let totalAmount = normalizeAmount(extractedData.total)
      if (totalAmount === 0 && subtotal > 0) {
        // Calculate total if not provided: subtotal + VAT + processing fee
        totalAmount = subtotal + vatAmount + paymentProcessingFee
      }
      const amountString = totalAmount.toFixed(2)

      // Return structured invoice data
      return NextResponse.json({
        success: true,
        invoice: {
          buyerId: extractedData.buyerId || '',
          invoiceDate: invoiceDate || new Date().toISOString().split('T')[0],
          dueDate: dueDate || '',
          paymentMethod: extractedData.paymentMethod || 'Debit/Credit Card',
          orderId: extractedData.orderId || '',
          items: itemsJson,
          vatRate: String(extractedData.vatRate || 9),
          paymentProcessingFeeRate: paymentProcessingFeeRate,
          amount: amountString,
          notes: extractedData.notes || '',
        },
      })
    } catch (openaiError) {
      console.error('OpenAI API error:', openaiError)
      // If OpenAI fails, return manual entry form
      return NextResponse.json({
        success: true,
        message: 'Could not extract invoice data automatically. Please enter details manually.',
        invoice: null,
      })
    }

  } catch (error) {
    console.error('Error processing image:', error)
    return NextResponse.json(
      { error: 'Failed to process image' },
      { status: 500 }
    )
  }
}

