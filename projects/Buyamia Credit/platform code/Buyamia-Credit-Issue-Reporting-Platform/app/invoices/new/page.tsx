'use client'

import { useState, useRef, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { ArrowLeft, Upload, FileText, X, CheckCircle, AlertCircle, Download, Plus, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatCurrency, getUserTypeFromUserId } from '@/lib/utils'

type InvoiceInputMode = 'manual' | 'csv' | 'image'

interface ParsedInvoice {
  buyerId: string
  invoiceDate?: string
  dueDate: string
  paymentMethod?: string
  orderId?: string
  items?: string // JSON string or comma-separated items
  vatRate?: string
  paymentProcessingFeeRate?: string
  notes?: string
  amount?: string // Calculated total (optional, will be calculated if items provided)
  errors?: string[]
  rowNumber: number
}

interface Buyer {
  userId: string
  businessName: string
}

export default function NewInvoicePage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string>('')
  const [availableBuyers, setAvailableBuyers] = useState<Buyer[]>([])
  const [isLoadingBuyers, setIsLoadingBuyers] = useState(false)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('userId')
      if (storedUserId) {
        setUserId(storedUserId)
      }
    }
  }, [])
  
  // Fetch available buyers
  useEffect(() => {
    const fetchBuyers = async () => {
      setIsLoadingBuyers(true)
      try {
        const response = await fetch('/api/users/search?type=BUYER')
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.users) {
            setAvailableBuyers(data.users.map((user: any) => ({
              userId: user.userId,
              businessName: user.businessName || user.userId,
            })))
          }
        }
      } catch (error) {
        console.error('Error fetching buyers:', error)
      } finally {
        setIsLoadingBuyers(false)
      }
    }
    
    fetchBuyers()
  }, [])
  
  const [inputMode, setInputMode] = useState<InvoiceInputMode>('manual')
  const [formData, setFormData] = useState({
    buyerId: '',
    invoiceDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    paymentMethod: 'Debit/Credit Card',
    orderId: '',
    notes: '',
  })
  const [items, setItems] = useState<Array<{ item: string; quantity: number; unitPrice: number }>>([
    { item: '', quantity: 1, unitPrice: 0 }
  ])
  const [vatRate, setVatRate] = useState(9) // 9% VAT
  const [paymentProcessingFeeRate, setPaymentProcessingFeeRate] = useState(4) // 4% of subtotal (can be adjusted)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Calculate invoice totals
  const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0)
  const vatAmount = (subtotal * vatRate) / 100
  const paymentProcessingFee = Math.round((subtotal * paymentProcessingFeeRate) / 100) // Auto-calculated, rounded
  const platformFee = null // Fixed as N/A
  const total = subtotal + vatAmount + paymentProcessingFee
  
  // CSV upload state
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [parsedInvoices, setParsedInvoices] = useState<ParsedInvoice[]>([])
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Image upload state
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [imagePreview, setImagePreview] = useState<string[]>([])
  const [extractedInvoices, setExtractedInvoices] = useState<Array<{
    image: string
    data: ParsedInvoice | null
    error?: string
  }>>([])
  const [isProcessingImages, setIsProcessingImages] = useState(false)
  const imageInputRef = useRef<HTMLInputElement>(null)
  
  // Handle image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    
    // Filter only image files
    const imageFiles = files.filter(file => file.type.startsWith('image/'))
    if (imageFiles.length !== files.length) {
      alert('Please select only image files (JPG, PNG, etc.)')
    }
    
    setImageFiles(prev => [...prev, ...imageFiles])
    
    // Create preview URLs
    imageFiles.forEach(file => {
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(prev => [...prev, e.target?.result as string])
      }
      reader.readAsDataURL(file)
    })
  }
  
  // Remove image
  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index))
    setImagePreview(prev => prev.filter((_, i) => i !== index))
    setExtractedInvoices(prev => prev.filter((_, i) => i !== index))
  }
  
  // Process images to extract invoice data
  const processImages = async () => {
    if (imageFiles.length === 0) {
      alert('Please select at least one image')
      return
    }
    
    setIsProcessingImages(true)
    const results: Array<{ image: string; data: ParsedInvoice | null; error?: string }> = []
    
    try {
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i]
        const formData = new FormData()
        formData.append('image', file)
        
        try {
          const response = await fetch('/api/invoices/extract', {
            method: 'POST',
            body: formData,
          })
          
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to process image' }))
            results.push({
              image: imagePreview[i],
              data: null,
              error: errorData.error || 'Failed to extract invoice data',
            })
            continue
          }
          
          const extractedData = await response.json()
          
          if (extractedData.success) {
            if (extractedData.invoice) {
              // OCR extracted data successfully
              results.push({
                image: imagePreview[i],
                data: extractedData.invoice,
              })
            } else {
              // OCR not available - show manual entry form
              // Create empty invoice structure for manual entry
              results.push({
                image: imagePreview[i],
                data: {
                  buyerId: '',
                  dueDate: '',
                  amount: '',
                  invoiceDate: new Date().toISOString().split('T')[0],
                  paymentMethod: 'Debit/Credit Card',
                  orderId: '',
                  items: '',
                  vatRate: '9',
                  paymentProcessingFeeRate: '4',
                  notes: '',
                  rowNumber: i + 1,
                },
              })
            }
          } else {
            results.push({
              image: imagePreview[i],
              data: null,
              error: extractedData.error || 'Could not extract invoice data',
            })
          }
        } catch (error) {
          results.push({
            image: imagePreview[i],
            data: null,
            error: error instanceof Error ? error.message : 'Failed to process image',
          })
        }
      }
      
      setExtractedInvoices(results)
    } catch (error) {
      console.error('Error processing images:', error)
      alert('Failed to process images. Please try again.')
    } finally {
      setIsProcessingImages(false)
    }
  }
  
  // Handle image invoice submission
  const handleImageSubmit = async () => {
    // Validate all invoices before submission
    const validatedInvoices = extractedInvoices.map(ext => {
      if (!ext.data) return null
      
      const errors: string[] = []
      
      // Required fields
      if (!ext.data.buyerId || ext.data.buyerId.trim() === '') {
        errors.push('Buyer ID is required')
      }
      if (!ext.data.dueDate) {
        errors.push('Due Date is required')
      }
      if (!ext.data.amount || parseFloat(ext.data.amount) <= 0) {
        errors.push('Amount is required and must be greater than 0')
      }
      
      // Validate items if provided
      if (ext.data.items && ext.data.items.trim() !== '') {
        try {
          const itemsData = JSON.parse(ext.data.items)
          if (!Array.isArray(itemsData)) {
            errors.push('Items must be a JSON array')
          } else if (itemsData.length === 0) {
            errors.push('Items array cannot be empty')
          } else {
            itemsData.forEach((item: any, idx: number) => {
              if (!item.item || typeof item.item !== 'string') {
                errors.push(`Item ${idx + 1}: item name is required`)
              }
              if (!item.quantity || item.quantity <= 0) {
                errors.push(`Item ${idx + 1}: quantity must be greater than 0`)
              }
              if (!item.unitPrice || item.unitPrice <= 0) {
                errors.push(`Item ${idx + 1}: unit price must be greater than 0`)
              }
            })
          }
        } catch (e) {
          errors.push('Items must be valid JSON array format')
        }
      }
      
      if (errors.length > 0) {
        ext.data.errors = errors
        return null
      }
      
      return ext
    }).filter((ext): ext is NonNullable<typeof ext> => ext !== null)
    
    if (validatedInvoices.length === 0) {
      alert('No valid invoices to submit. Please fill in all required fields and fix any errors.')
      setExtractedInvoices([...extractedInvoices]) // Trigger re-render to show errors
      return
    }
    
    if (!userId) {
      alert('Please log in to create invoices.')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const results = await Promise.allSettled(
        validatedInvoices.map(async (ext) => {
          const inv = ext.data!
          
          // Parse items if provided
          let itemsData: Array<{ item: string; quantity: number; unitPrice: number; total: number }> = []
          let subtotal = 0
          let vatAmount = 0
          let paymentProcessingFee = 0
          let calculatedTotal = 0
          
          // Get extracted total amount (preferred - this is what's on the invoice)
          const extractedAmount = parseFloat(inv.amount || '0')
          
          if (inv.items) {
            try {
              itemsData = JSON.parse(inv.items).map((item: any) => ({
                item: item.item,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.quantity * item.unitPrice,
              }))
              subtotal = itemsData.reduce((sum, item) => sum + item.total, 0)
              
              const vatRate = parseFloat(inv.vatRate || '9')
              vatAmount = (subtotal * vatRate) / 100
              
              const processingFeeRate = parseFloat(inv.paymentProcessingFeeRate || '4')
              paymentProcessingFee = Math.round((subtotal * processingFeeRate) / 100)
              
              calculatedTotal = subtotal + vatAmount + paymentProcessingFee
            } catch (e) {
              console.error('Error parsing items:', e)
            }
          }
          
          // Use extracted amount if available (from invoice), otherwise use calculated total
          // The extracted amount is more reliable as it's what's actually on the invoice
          const finalAmount = extractedAmount > 0 ? extractedAmount : calculatedTotal
          
          // Prepare invoice details
          const invoiceDetails = inv.items ? {
            invoiceDate: inv.invoiceDate || new Date().toISOString().split('T')[0],
            paymentMethod: inv.paymentMethod || 'Debit/Credit Card',
            items: itemsData,
            subtotal,
            vatRate: parseFloat(inv.vatRate || '9'),
            vatAmount,
            paymentProcessingFeeRate: parseFloat(inv.paymentProcessingFeeRate || '4'),
            paymentProcessingFee,
            platformFee: null,
            total: finalAmount, // Use the final amount (extracted or calculated)
          } : null
          
          const response = await fetch('/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              buyerId: inv.buyerId,
              amount: finalAmount, // Always use the final amount
              dueDate: inv.dueDate,
              orderId: inv.orderId || null,
              notes: invoiceDetails ? JSON.stringify(invoiceDetails) : (inv.notes || null),
              supplierId: userId,
            }),
          })
          
          // Check if response is successful
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            const errorMessage = errorData.error || `HTTP ${response.status}`
            
            // Provide helpful message for buyer not found
            if (errorMessage.includes('Buyer not found') && availableBuyers.length > 0) {
              const buyerIds = availableBuyers.map(b => b.userId).join(', ')
              throw new Error(`Buyer not found. Available buyers: ${buyerIds}`)
            }
            
            throw new Error(errorMessage)
          }
          
          const result = await response.json()
          return result
        })
      )
      
      // Count successful and failed invoices
      const successful = results.filter(r => r.status === 'fulfilled')
      const failed = results.filter(r => r.status === 'rejected')
      
      const successCount = successful.length
      const failedCount = failed.length
      
      // Log errors for debugging
      if (failed.length > 0) {
        console.error('Failed invoice creations:', failed.map(f => f.status === 'rejected' ? f.reason : 'Unknown error'))
      }
      
      if (failedCount > 0) {
        alert(`${successCount} invoices created, ${failedCount} failed. Please check the console for details.`)
      } else {
        alert(`${successCount} invoice(s) created successfully!`)
      }
      
      // Only redirect if at least one invoice was created successfully
      if (successCount > 0) {
        // Small delay to ensure database transaction is committed
        setTimeout(() => {
          router.push(`/invoices?success=invoices_created&count=${successCount}`)
        }, 500)
      }
    } catch (error) {
      console.error('Error creating invoices:', error)
      alert('Failed to create invoices. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // Parse CSV line handling quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = []
    let current = ''
    let inQuotes = false
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      
      if (char === '"') {
        inQuotes = !inQuotes
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
    
    result.push(current.trim())
    return result
  }
  
  // Parse CSV file
  const parseCSV = (file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)
      
      if (lines.length < 2) {
        setCsvErrors(['CSV file must have at least a header row and one data row'])
        return
      }
      
      // Parse header
      const header = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/"/g, '').trim())
      const requiredHeaders = ['buyerid', 'duedate']
      const missingHeaders = requiredHeaders.filter(h => !header.includes(h))
      
      if (missingHeaders.length > 0) {
        setCsvErrors([`Missing required columns: ${missingHeaders.join(', ')}. Found: ${header.join(', ')}`])
        return
      }
      
      // Check if using new format (with items) or old format (with amount)
      const hasItems = header.includes('items')
      const hasAmount = header.includes('amount')
      
      if (!hasItems && !hasAmount) {
        setCsvErrors(['CSV must include either "items" (new format) or "amount" (old format) column'])
        return
      }
      
      // Parse data rows
      const invoices: ParsedInvoice[] = []
      const errors: string[] = []
      
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, '').trim())
        const invoice: ParsedInvoice = {
          buyerId: '',
          dueDate: '',
          rowNumber: i + 1,
        }
        const rowErrors: string[] = []
        
        // Map values to fields
        header.forEach((col, idx) => {
          const value = values[idx] || ''
          
          if (col === 'buyerid') {
            invoice.buyerId = value
            if (!value) rowErrors.push('Buyer ID is required')
            else if (!value.startsWith('BJ')) rowErrors.push('Buyer ID must start with BJ')
          } else if (col === 'invoicedate' || col === 'invoice_date') {
            invoice.invoiceDate = value
            if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
              rowErrors.push('Invoice Date must be in YYYY-MM-DD format')
            }
          } else if (col === 'duedate' || col === 'due_date') {
            invoice.dueDate = value
            if (!value) rowErrors.push('Due Date is required')
            else if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
              rowErrors.push('Due Date must be in YYYY-MM-DD format')
            }
          } else if (col === 'paymentmethod' || col === 'payment_method') {
            invoice.paymentMethod = value || 'Debit/Credit Card'
          } else if (col === 'orderid' || col === 'order_id') {
            invoice.orderId = value || undefined
          } else if (col === 'items') {
            invoice.items = value
            if (hasItems && !value) {
              rowErrors.push('Items are required when using items column')
            }
          } else if (col === 'vatrate' || col === 'vat_rate') {
            invoice.vatRate = value || '9'
            if (value && (isNaN(parseFloat(value)) || parseFloat(value) < 0 || parseFloat(value) > 100)) {
              rowErrors.push('VAT Rate must be a number between 0 and 100')
            }
          } else if (col === 'paymentprocessingfeerate' || col === 'payment_processing_fee_rate' || col === 'processingfeerate' || col === 'processing_fee_rate') {
            invoice.paymentProcessingFeeRate = value || '4'
            if (value && (isNaN(parseFloat(value)) || parseFloat(value) < 0 || parseFloat(value) > 100)) {
              rowErrors.push('Payment Processing Fee Rate must be a number between 0 and 100')
            }
          } else if (col === 'amount') {
            // Support old format with direct amount
            invoice.amount = value
            if (!hasItems && !value) rowErrors.push('Amount is required when not using items')
            else if (value && (isNaN(parseFloat(value)) || parseFloat(value) <= 0)) {
              rowErrors.push('Amount must be a positive number')
            }
          } else if (col === 'notes') {
            invoice.notes = value || undefined
          }
        })
        
        // Validate items format if provided
        if (invoice.items) {
          try {
            // Try to parse as JSON first
            const itemsData = JSON.parse(invoice.items)
            if (!Array.isArray(itemsData)) {
              rowErrors.push('Items must be a JSON array')
            } else if (itemsData.length === 0) {
              rowErrors.push('Items array cannot be empty')
            } else {
              // Validate each item
              itemsData.forEach((item: any, idx: number) => {
                if (!item.item || typeof item.item !== 'string') {
                  rowErrors.push(`Item ${idx + 1}: item name is required`)
                }
                if (!item.quantity || item.quantity <= 0) {
                  rowErrors.push(`Item ${idx + 1}: quantity must be greater than 0`)
                }
                if (!item.unitPrice || item.unitPrice <= 0) {
                  rowErrors.push(`Item ${idx + 1}: unit price must be greater than 0`)
                }
              })
            }
          } catch (e) {
            rowErrors.push('Items must be valid JSON array format')
          }
        }
        
        if (rowErrors.length > 0) {
          invoice.errors = rowErrors
          errors.push(`Row ${i + 1}: ${rowErrors.join(', ')}`)
        }
        
        invoices.push(invoice)
      }
      
      setParsedInvoices(invoices)
      setCsvErrors(errors)
    }
    
    reader.readAsText(file)
  }
  
  // Handle CSV file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    if (!file.name.endsWith('.csv')) {
      alert('Please select a CSV file')
      return
    }
    
    setCsvFile(file)
    setCsvErrors([])
    setParsedInvoices([])
    parseCSV(file)
  }
  
  // Remove CSV file
  const handleRemoveFile = () => {
    setCsvFile(null)
    setParsedInvoices([])
    setCsvErrors([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }
  
  // Add item row
  const addItem = () => {
    setItems([...items, { item: '', quantity: 1, unitPrice: 0 }])
  }
  
  // Remove item row
  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index))
    }
  }
  
  // Update item
  const updateItem = (index: number, field: 'item' | 'quantity' | 'unitPrice', value: string | number) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], [field]: value }
    setItems(newItems)
  }
  
  // Handle manual form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate items
    if (items.some(item => !item.item || item.quantity <= 0 || item.unitPrice <= 0)) {
      alert('Please fill in all item fields with valid values')
      return
    }
    
    if (total <= 0) {
      alert('Total amount must be greater than 0')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Prepare invoice details as JSON
      const invoiceDetails = {
        invoiceDate: formData.invoiceDate,
        paymentMethod: formData.paymentMethod,
        items: items.map(item => ({
          item: item.item,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice,
        })),
        subtotal,
        vatRate,
        vatAmount,
        paymentProcessingFee,
        platformFee,
        total,
      }
      
      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerId: formData.buyerId,
          amount: total, // Use calculated total
          dueDate: formData.dueDate,
          orderId: formData.orderId || null,
          notes: JSON.stringify(invoiceDetails), // Store invoice details as JSON in notes
          supplierId: userId, // Current user (supplier)
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create invoice')
      }
      
      const result = await response.json()
      
      // Redirect to invoices page to see the new invoice
      // Small delay to ensure database transaction is committed
      setTimeout(() => {
        router.push('/invoices?success=invoice_created')
      }, 500)
    } catch (error) {
      console.error('Error creating invoice:', error)
      alert(error instanceof Error ? error.message : 'Failed to create invoice. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  // Download CSV template
  const downloadTemplate = () => {
    const template = `buyerId,invoiceDate,dueDate,paymentMethod,orderId,items,vatRate,paymentProcessingFeeRate,notes
BJ1045,2024-12-10,2024-12-15,Debit/Credit Card,ORD1022,"[{""item"":""Mouse"",""quantity"":1,""unitPrice"":50000},{""item"":""Keyboard Gaming"",""quantity"":1,""unitPrice"":20000}]",9,4,Monthly order
BJ1123,2024-12-10,2024-12-20,Bank Transfer,ORD1101,"[{""item"":""Chair"",""quantity"":1,""unitPrice"":30000}]",9,4,
BJ1089,2024-12-10,2024-12-25,Debit/Credit Card,,"[{""item"":""Desk"",""quantity"":2,""unitPrice"":40000}]",9,4,Special discount`
    
    const blob = new Blob([template], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'invoice_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }
  
  // Handle CSV bulk submit
  const handleBulkSubmit = async () => {
    const validInvoices = parsedInvoices.filter(inv => !inv.errors || inv.errors.length === 0)
    
    if (validInvoices.length === 0) {
      alert('No valid invoices to submit. Please fix errors in your CSV file.')
      return
    }
    
    if (!userId) {
      alert('Please log in to create invoices.')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      // Create invoices one by one (or implement bulk endpoint later)
      const results = await Promise.allSettled(
        validInvoices.map(async (inv) => {
          // Parse items if provided
          let itemsData: Array<{ item: string; quantity: number; unitPrice: number; total: number }> = []
          let subtotal = 0
          let vatAmount = 0
          let paymentProcessingFee = 0
          let calculatedTotal = 0
          
          // Get extracted/direct amount if provided (preferred - this is what's on the invoice)
          const extractedAmount = parseFloat(inv.amount || '0')
          
          if (inv.items) {
            try {
              itemsData = JSON.parse(inv.items).map((item: any) => ({
                item: item.item,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                total: item.quantity * item.unitPrice,
              }))
              subtotal = itemsData.reduce((sum, item) => sum + item.total, 0)
              
              const vatRate = parseFloat(inv.vatRate || '9')
              vatAmount = (subtotal * vatRate) / 100
              
              const processingFeeRate = parseFloat(inv.paymentProcessingFeeRate || '4')
              paymentProcessingFee = Math.round((subtotal * processingFeeRate) / 100)
              
              calculatedTotal = subtotal + vatAmount + paymentProcessingFee
            } catch (e) {
              console.error('Error parsing items:', e)
            }
          }
          
          // Use extracted amount if available (from invoice), otherwise use calculated total
          // The extracted amount is more reliable as it's what's actually on the invoice
          const finalAmount = extractedAmount > 0 ? extractedAmount : calculatedTotal
          
          // Prepare invoice details
          const invoiceDetails = inv.items ? {
            invoiceDate: inv.invoiceDate || new Date().toISOString().split('T')[0],
            paymentMethod: inv.paymentMethod || 'Debit/Credit Card',
            items: itemsData,
            subtotal,
            vatRate: parseFloat(inv.vatRate || '9'),
            vatAmount,
            paymentProcessingFeeRate: parseFloat(inv.paymentProcessingFeeRate || '4'),
            paymentProcessingFee,
            platformFee: null,
            total: finalAmount, // Use the final amount (extracted or calculated)
          } : null
          
          const response = await fetch('/api/invoices', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              buyerId: inv.buyerId,
              amount: finalAmount, // Always use the final amount
              dueDate: inv.dueDate,
              orderId: inv.orderId || null,
              notes: invoiceDetails ? JSON.stringify(invoiceDetails) : (inv.notes || null),
              supplierId: userId,
            }),
          })
          
          // Check if response is successful
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            const errorMessage = errorData.error || `HTTP ${response.status}`
            
            // Provide helpful message for buyer not found
            if (errorMessage.includes('Buyer not found') && availableBuyers.length > 0) {
              const buyerIds = availableBuyers.map(b => b.userId).join(', ')
              throw new Error(`Buyer not found. Available buyers: ${buyerIds}`)
            }
            
            throw new Error(errorMessage)
          }
          
          const result = await response.json()
          return result
        })
      )

      // Count successful and failed invoices
      const successful = results.filter(r => r.status === 'fulfilled')
      const failed = results.filter(r => r.status === 'rejected')
      
      const successCount = successful.length
      const failedCount = failed.length
      
      // Log errors for debugging
      if (failed.length > 0) {
        console.error('Failed invoice creations:', failed.map(f => f.status === 'rejected' ? f.reason : 'Unknown error'))
      }

      if (failedCount > 0) {
        alert(`${successCount} invoices created, ${failedCount} failed. Please check the console for details.`)
      } else {
        alert(`${successCount} invoice(s) created successfully!`)
      }
      
      // Only redirect if at least one invoice was created successfully
      if (successCount > 0) {
        // Small delay to ensure database transaction is committed
        setTimeout(() => {
          router.push(`/invoices?success=invoices_created&count=${successCount}`)
        }, 500)
      }
    } catch (error) {
      console.error('Error creating invoices:', error)
      alert('Failed to create invoices. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const userType = getUserTypeFromUserId(userId) // Detect from userId (BJ = buyer, SP = supplier)
  
  return (
    <div className="min-h-screen bg-cream-white">
      <Navbar userId={userId} userType={userType} />
      
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/invoices" className="inline-flex items-center gap-2 text-primary-green hover:underline mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Invoices
          </Link>
          <h1 className="text-3xl font-bold text-text-dark mb-2">Create New Invoice</h1>
          <p className="text-text-dark/60">Add a new invoice or upload multiple invoices via CSV</p>
        </div>
        
        {/* Input Mode Tabs */}
        <div className="card mb-6">
          <div className="flex gap-2 border-b border-cream-grey">
            <button
              type="button"
              onClick={() => setInputMode('manual')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                inputMode === 'manual'
                  ? 'border-primary-green text-primary-green'
                  : 'border-transparent text-text-dark/60 hover:text-text-dark'
              }`}
            >
              Manual Entry
            </button>
            <button
              type="button"
              onClick={() => setInputMode('csv')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                inputMode === 'csv'
                  ? 'border-primary-green text-primary-green'
                  : 'border-transparent text-text-dark/60 hover:text-text-dark'
              }`}
            >
              CSV Upload
            </button>
            <button
              type="button"
              onClick={() => setInputMode('image')}
              className={`px-4 py-2 font-medium transition-colors border-b-2 ${
                inputMode === 'image'
                  ? 'border-primary-green text-primary-green'
                  : 'border-transparent text-text-dark/60 hover:text-text-dark'
              }`}
            >
              Image Upload
            </button>
          </div>
        </div>
        
        {/* Manual Entry Form */}
        {inputMode === 'manual' && (
          <form onSubmit={handleSubmit} className="card">
          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="buyerId" className="block text-sm font-medium text-text-dark mb-2">
                  Buyer <span className="text-status-error">*</span>
                </label>
                {isLoadingBuyers ? (
                  <div className="input-field text-text-dark/60">Loading buyers...</div>
                ) : availableBuyers.length > 0 ? (
                  <select
                    id="buyerId"
                    required
                    value={formData.buyerId}
                    onChange={(e) => setFormData({ ...formData, buyerId: e.target.value })}
                    className="input-field"
                  >
                    <option value="">Select a buyer</option>
                    {availableBuyers.map((buyer) => (
                      <option key={buyer.userId} value={buyer.userId}>
                        {buyer.userId} - {buyer.businessName}
                      </option>
                    ))}
                  </select>
                ) : (
                  <>
                    <input
                      type="text"
                      id="buyerId"
                      required
                      value={formData.buyerId}
                      onChange={(e) => setFormData({ ...formData, buyerId: e.target.value })}
                      placeholder="BJ1045"
                      className="input-field"
                    />
                    <p className="text-xs text-status-warning mt-1">
                      Could not load buyers. Enter buyer ID manually (e.g., BJ1045, BJ1089, BJ1123)
                    </p>
                  </>
                )}
                <p className="text-xs text-text-dark/60 mt-1">
                  {availableBuyers.length > 0 
                    ? `Select from ${availableBuyers.length} available buyers`
                    : 'Enter the buyer\'s unique ID (BJ####)'}
                </p>
              </div>
              
              <div>
                <label htmlFor="invoiceDate" className="block text-sm font-medium text-text-dark mb-2">
                  Invoice Date <span className="text-status-error">*</span>
                </label>
                <input
                  type="date"
                  id="invoiceDate"
                  required
                  value={formData.invoiceDate}
                  onChange={(e) => setFormData({ ...formData, invoiceDate: e.target.value })}
                  className="input-field"
                />
              </div>
              
              <div>
                <label htmlFor="dueDate" className="block text-sm font-medium text-text-dark mb-2">
                  Due Date <span className="text-status-error">*</span>
                </label>
                <input
                  type="date"
                  id="dueDate"
                  required
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="input-field"
                />
              </div>
              
              <div>
                <label htmlFor="paymentMethod" className="block text-sm font-medium text-text-dark mb-2">
                  Payment Method <span className="text-status-error">*</span>
                </label>
                <select
                  id="paymentMethod"
                  required
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                  className="input-field"
                >
                  <option value="Debit/Credit Card">Debit/Credit Card</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="orderId" className="block text-sm font-medium text-text-dark mb-2">
                  Order ID (Optional)
                </label>
                <input
                  type="text"
                  id="orderId"
                  value={formData.orderId}
                  onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                  placeholder="ORD1022"
                  className="input-field"
                />
              </div>
            </div>
            
            {/* Invoice Items */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-text-dark">
                  Invoice Items <span className="text-status-error">*</span>
                </label>
                <button
                  type="button"
                  onClick={addItem}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-green hover:text-primary-olive transition-colors border border-primary-green/30 rounded-button hover:bg-primary-green/5"
                >
                  <Plus className="w-4 h-4" />
                  Add Item
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full border border-cream-grey rounded-lg">
                  <thead>
                    <tr className="bg-cream-beige/50 border-b border-cream-grey">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-text-dark">Item</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-text-dark">Quantity</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-text-dark">Unit Price (Rp)</th>
                      <th className="text-right py-3 px-4 text-sm font-semibold text-text-dark">Total (Rp)</th>
                      <th className="text-center py-3 px-4 text-sm font-semibold text-text-dark w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => (
                      <tr key={index} className="border-b border-cream-grey/50">
                        <td className="py-3 px-4">
                          <input
                            type="text"
                            required
                            value={item.item}
                            onChange={(e) => updateItem(index, 'item', e.target.value)}
                            placeholder="Item name"
                            className="w-full px-3 py-2 border border-cream-grey rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-green"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            required
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                            className="w-full px-3 py-2 border border-cream-grey rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-green text-center"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <input
                            type="number"
                            required
                            min="0"
                            step="1000"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-3 py-2 border border-cream-grey rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-green text-right"
                          />
                        </td>
                        <td className="py-3 px-4 text-right font-medium text-text-dark">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="p-1 hover:bg-status-error/10 rounded transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-status-error" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Summary of Charges */}
            <div className="bg-cream-beige/30 rounded-lg p-6 space-y-3">
              <h3 className="text-lg font-semibold text-text-dark mb-4">Summary of Charges</h3>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-text-dark/60">Subtotal:</span>
                  <span className="font-medium text-text-dark">{formatCurrency(subtotal)}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-text-dark/60">VAT ({vatRate}%):</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={vatRate}
                      onChange={(e) => setVatRate(parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-cream-grey rounded text-center text-xs"
                    />
                  </div>
                  <span className="font-medium text-text-dark">{formatCurrency(vatAmount)}</span>
                </div>
                
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-text-dark/60">Payment Processing Fee ({paymentProcessingFeeRate}%):</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={paymentProcessingFeeRate}
                      onChange={(e) => setPaymentProcessingFeeRate(parseFloat(e.target.value) || 0)}
                      className="w-20 px-2 py-1 border border-cream-grey rounded text-center text-xs"
                      title="Percentage of subtotal"
                    />
                  </div>
                  <span className="font-medium text-text-dark">{formatCurrency(paymentProcessingFee)}</span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-text-dark/60">Platform Fee:</span>
                  <span className="font-medium text-text-dark">N/A</span>
                </div>
                
                <div className="border-t border-cream-grey pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-semibold text-text-dark">Total:</span>
                    <span className="text-2xl font-bold text-primary-green">{formatCurrency(total)}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-text-dark mb-2">
                Notes (Optional)
              </label>
              <textarea
                id="notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional information about this invoice..."
                className="input-field resize-none"
              />
            </div>
            
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={isSubmitting || total <= 0}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Invoice'}
              </button>
              <Link href="/invoices" className="btn-secondary">
                Cancel
              </Link>
            </div>
          </div>
        </form>
        )}
        
        {/* CSV Upload Form */}
        {inputMode === 'csv' && (
          <div className="space-y-6">
            {/* CSV Upload Section */}
            <div className="card">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-text-dark mb-2">Upload CSV File</h2>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-sm text-text-dark/60 mb-1">
                      Upload a CSV file with multiple invoices. Required columns: <strong>buyerId, dueDate</strong>.
                    </p>
                    <p className="text-sm text-text-dark/60 mb-1">
                      For detailed invoices: Include <strong>items</strong> (JSON array), <strong>vatRate</strong>, <strong>paymentProcessingFeeRate</strong>.
                    </p>
                    <p className="text-sm text-text-dark/60">
                      Optional columns: <strong>invoiceDate, paymentMethod, orderId, notes</strong>. 
                      Or use <strong>amount</strong> for simple invoices (old format).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-green hover:text-primary-olive transition-colors border border-primary-green/30 rounded-button hover:bg-primary-green/5"
                  >
                    <Download className="w-4 h-4" />
                    Download Template
                  </button>
                </div>
                
                {/* CSV Format Example */}
                <div className="p-4 bg-cream-beige/50 rounded-lg mb-4">
                  <p className="text-xs font-medium text-text-dark mb-2">CSV Format Example (New Format with Items):</p>
                  <code className="text-xs text-text-dark/70 block whitespace-pre overflow-x-auto">
{`buyerId,invoiceDate,dueDate,paymentMethod,orderId,items,vatRate,paymentProcessingFeeRate,notes
BJ1045,2024-12-10,2024-12-15,Debit/Credit Card,ORD1022,"[{""item"":""Mouse"",""quantity"":1,""unitPrice"":50000}]",9,4,Monthly order`}
                  </code>
                  <p className="text-xs text-text-dark/60 mt-2">
                    <strong>Items format:</strong> JSON array with item, quantity, unitPrice. Example: <code>[{`{"item":"Mouse","quantity":1,"unitPrice":50000}`}]</code>
                  </p>
                  <p className="text-xs text-text-dark/60 mt-1">
                    <strong>Simple format:</strong> Use <code>buyerId,amount,dueDate</code> for basic invoices (old format still supported)
                  </p>
                </div>
                
                {!csvFile ? (
                  <div className="border-2 border-dashed border-cream-grey rounded-lg p-8 text-center">
                    <Upload className="w-12 h-12 text-cream-grey mx-auto mb-4" />
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label
                      htmlFor="csv-upload"
                      className="btn-primary inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      Choose CSV File
                    </label>
                    <p className="text-xs text-text-dark/60 mt-2">CSV files only</p>
                  </div>
                ) : (
                  <div className="p-4 bg-primary-green/5 rounded-lg border border-primary-green/20">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-primary-green" />
                        <div>
                          <p className="font-medium text-text-dark">{csvFile.name}</p>
                          <p className="text-xs text-text-dark/60">
                            {(csvFile.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        className="p-2 hover:bg-status-error/10 rounded transition-colors"
                      >
                        <X className="w-5 h-5 text-status-error" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            {/* CSV Errors */}
            {csvErrors.length > 0 && (
              <div className="card border-status-error/20 bg-status-error/5">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-status-error flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-status-error mb-2">CSV Validation Errors</h3>
                    <ul className="space-y-1">
                      {csvErrors.map((error, idx) => (
                        <li key={idx} className="text-sm text-text-dark">{error}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            
            {/* Parsed Invoices Preview */}
            {parsedInvoices.length > 0 && (
              <div className="card">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-text-dark mb-2">Invoice Preview</h2>
                  <p className="text-sm text-text-dark/60">
                    {parsedInvoices.filter(inv => !inv.errors || inv.errors.length === 0).length} valid,{' '}
                    {parsedInvoices.filter(inv => inv.errors && inv.errors.length > 0).length} with errors
                  </p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-cream-grey">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-dark">Row</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-dark">Buyer ID</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-dark">Invoice Date</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-dark">Due Date</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-dark">Payment Method</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-dark">Items</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-text-dark">Total</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-text-dark">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedInvoices.map((invoice, idx) => {
                        const isValid = !invoice.errors || invoice.errors.length === 0
                        
                        // Calculate total if items provided
                        let displayTotal = invoice.amount
                        if (invoice.items) {
                          try {
                            const itemsData = JSON.parse(invoice.items)
                            const subtotal = itemsData.reduce((sum: number, item: any) => 
                              sum + (item.quantity * item.unitPrice), 0)
                            const vatRate = parseFloat(invoice.vatRate || '9')
                            const processingFeeRate = parseFloat(invoice.paymentProcessingFeeRate || '4')
                            const vatAmount = (subtotal * vatRate) / 100
                            const processingFee = Math.round((subtotal * processingFeeRate) / 100)
                            displayTotal = (subtotal + vatAmount + processingFee).toString()
                          } catch (e) {
                            // If parsing fails, use amount if available
                          }
                        }
                        
                        // Count items
                        let itemsCount = 0
                        if (invoice.items) {
                          try {
                            const itemsData = JSON.parse(invoice.items)
                            itemsCount = Array.isArray(itemsData) ? itemsData.length : 0
                          } catch (e) {
                            itemsCount = 0
                          }
                        }
                        
                        return (
                          <tr
                            key={idx}
                            className={`border-b border-cream-grey/50 ${
                              isValid ? 'bg-white' : 'bg-status-error/5'
                            }`}
                          >
                            <td className="py-3 px-3 text-sm text-text-dark">{invoice.rowNumber}</td>
                            <td className="py-3 px-3 text-sm text-text-dark font-medium">{invoice.buyerId}</td>
                            <td className="py-3 px-3 text-sm text-text-dark">{invoice.invoiceDate || '-'}</td>
                            <td className="py-3 px-3 text-sm text-text-dark">{invoice.dueDate}</td>
                            <td className="py-3 px-3 text-sm text-text-dark">{invoice.paymentMethod || '-'}</td>
                            <td className="py-3 px-3 text-sm text-text-dark">
                              {itemsCount > 0 ? `${itemsCount} item(s)` : (invoice.amount ? 'Simple' : '-')}
                            </td>
                            <td className="py-3 px-3 text-sm text-right font-medium">
                              {displayTotal ? formatCurrency(parseFloat(displayTotal)) : '-'}
                            </td>
                            <td className="py-3 px-3">
                              {isValid ? (
                                <span className="inline-flex items-center gap-1 text-xs text-status-success">
                                  <CheckCircle className="w-4 h-4" />
                                  Valid
                                </span>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <span className="inline-flex items-center gap-1 text-xs text-status-error">
                                    <AlertCircle className="w-4 h-4" />
                                    Error
                                  </span>
                                  <div className="text-xs text-status-error max-w-xs">
                                    {invoice.errors?.join(', ')}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                
                <div className="flex gap-4 pt-6 mt-6 border-t border-cream-grey">
                  <button
                    type="button"
                    onClick={handleBulkSubmit}
                    disabled={isSubmitting || parsedInvoices.filter(inv => !inv.errors || inv.errors.length === 0).length === 0}
                    className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting
                      ? 'Creating...'
                      : `Create ${parsedInvoices.filter(inv => !inv.errors || inv.errors.length === 0).length} Invoice${parsedInvoices.filter(inv => !inv.errors || inv.errors.length === 0).length !== 1 ? 's' : ''}`}
                  </button>
                  <Link href="/invoices" className="btn-secondary">
                    Cancel
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Image Upload Form */}
        {inputMode === 'image' && (
          <div className="space-y-6">
            {/* Image Upload Section */}
            <div className="card">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-text-dark mb-2">Upload Invoice Images</h2>
                <p className="text-sm text-text-dark/60 mb-4">
                  Upload one or more invoice images (JPG, PNG, etc.). The system will extract invoice data from the images.
                </p>
                
                <div className="flex items-center gap-4 mb-4">
                  <input
                    ref={imageInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <ImageIcon className="w-4 h-4" />
                    Select Images
                  </button>
                  
                  {imageFiles.length > 0 && (
                    <button
                      type="button"
                      onClick={processImages}
                      disabled={isProcessingImages}
                      className="btn-primary flex items-center gap-2 disabled:opacity-50"
                    >
                      {isProcessingImages ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4" />
                          Extract Invoice Data
                        </>
                      )}
                    </button>
                  )}
                </div>
                
                {/* Image Previews */}
                {imageFiles.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                    {imageFiles.map((file, index) => (
                      <div key={index} className="relative border border-cream-grey rounded-lg overflow-hidden">
                        <img
                          src={imagePreview[index]}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-48 object-contain bg-cream-grey"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-2 right-2 bg-status-error text-white rounded-full p-1 hover:bg-status-error/80"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="p-2 bg-white">
                          <p className="text-xs text-text-dark/60 truncate">{file.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Extracted Invoice Data */}
            {extractedInvoices.length > 0 && (
              <div className="card">
                <h2 className="text-lg font-semibold text-text-dark mb-4">Extracted Invoice Data</h2>
                
                <div className="space-y-6">
                  {extractedInvoices.map((ext, index) => (
                    <div key={index} className="border border-cream-grey rounded-lg p-4">
                      <div className="flex items-start gap-4 mb-4">
                        <img
                          src={ext.image}
                          alt={`Invoice ${index + 1}`}
                          className="w-32 h-32 object-contain border border-cream-grey rounded"
                        />
                        <div className="flex-1">
                          {ext.error ? (
                            <div className="flex items-center gap-2 text-status-error">
                              <AlertCircle className="w-5 h-5" />
                              <span className="font-medium">Error: {ext.error}</span>
                            </div>
                          ) : ext.data ? (
                            <div className="space-y-3">
                              {ext.data.buyerId ? (
                                <div className="flex items-center gap-2 text-primary-green">
                                  <CheckCircle className="w-5 h-5" />
                                  <span className="font-medium">Data extracted successfully</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 text-text-dark/60">
                                  <FileText className="w-5 h-5" />
                                  <span className="font-medium">Please enter invoice details manually</span>
                                </div>
                              )}
                              
                              {ext.data.errors && ext.data.errors.length > 0 && (
                                <div className="mt-2 p-2 bg-status-error/10 border border-status-error/20 rounded">
                                  <p className="text-sm font-medium text-status-error mb-1">Validation Errors:</p>
                                  <ul className="text-xs text-status-error list-disc list-inside">
                                    {ext.data.errors.map((err, errIdx) => (
                                      <li key={errIdx}>{err}</li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-2 gap-3 mt-3">
                                <div>
                                  <label className="block text-xs font-medium text-text-dark/60 mb-1">Buyer *</label>
                                  {availableBuyers.length > 0 ? (
                                    <select
                                      value={ext.data.buyerId || ''}
                                      onChange={(e) => {
                                        const updated = [...extractedInvoices]
                                        updated[index].data!.buyerId = e.target.value
                                        setExtractedInvoices(updated)
                                      }}
                                      className="input-field text-sm"
                                      required
                                    >
                                      <option value="">Select a buyer</option>
                                      {availableBuyers.map((buyer) => (
                                        <option key={buyer.userId} value={buyer.userId}>
                                          {buyer.userId} - {buyer.businessName}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      value={ext.data.buyerId || ''}
                                      onChange={(e) => {
                                        const updated = [...extractedInvoices]
                                        updated[index].data!.buyerId = e.target.value
                                        setExtractedInvoices(updated)
                                      }}
                                      className="input-field text-sm"
                                      placeholder="e.g., BJ1045"
                                      required
                                    />
                                  )}
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-text-dark/60 mb-1">Due Date *</label>
                                  <input
                                    type="date"
                                    value={ext.data.dueDate || ''}
                                    onChange={(e) => {
                                      const updated = [...extractedInvoices]
                                      updated[index].data!.dueDate = e.target.value
                                      setExtractedInvoices(updated)
                                    }}
                                    className="input-field text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-text-dark/60 mb-1">Invoice Date</label>
                                  <input
                                    type="date"
                                    value={ext.data.invoiceDate || ''}
                                    onChange={(e) => {
                                      const updated = [...extractedInvoices]
                                      updated[index].data!.invoiceDate = e.target.value
                                      setExtractedInvoices(updated)
                                    }}
                                    className="input-field text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-text-dark/60 mb-1">Amount *</label>
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={ext.data.amount || ''}
                                    onChange={(e) => {
                                      const updated = [...extractedInvoices]
                                      updated[index].data!.amount = e.target.value
                                      setExtractedInvoices(updated)
                                    }}
                                    className="input-field text-sm"
                                    placeholder="0.00"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-text-dark/60 mb-1">Order ID</label>
                                  <input
                                    type="text"
                                    value={ext.data.orderId || ''}
                                    onChange={(e) => {
                                      const updated = [...extractedInvoices]
                                      updated[index].data!.orderId = e.target.value
                                      setExtractedInvoices(updated)
                                    }}
                                    className="input-field text-sm"
                                    placeholder="Optional"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-text-dark/60 mb-1">Payment Method</label>
                                  <select
                                    value={ext.data.paymentMethod || 'Debit/Credit Card'}
                                    onChange={(e) => {
                                      const updated = [...extractedInvoices]
                                      updated[index].data!.paymentMethod = e.target.value
                                      setExtractedInvoices(updated)
                                    }}
                                    className="input-field text-sm"
                                  >
                                    <option>Debit/Credit Card</option>
                                    <option>Bank Transfer</option>
                                    <option>Cash</option>
                                    <option>Other</option>
                                  </select>
                                </div>
                              </div>
                              
                              <div className="mt-3">
                                <label className="block text-xs font-medium text-text-dark/60 mb-1">
                                  Items (JSON format) - Optional
                                </label>
                                <textarea
                                  value={ext.data.items || ''}
                                  onChange={(e) => {
                                    const updated = [...extractedInvoices]
                                    updated[index].data!.items = e.target.value
                                    setExtractedInvoices(updated)
                                  }}
                                  className="input-field text-xs font-mono"
                                  rows={3}
                                  placeholder='[{"item":"Product Name","quantity":1,"unitPrice":1000}]'
                                />
                                <p className="text-xs text-text-dark/60 mt-1">
                                  JSON array format: {`[{"item":"Name","quantity":1,"unitPrice":1000}]`}
                                </p>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 mt-3">
                                <div>
                                  <label className="block text-xs font-medium text-text-dark/60 mb-1">VAT Rate (%)</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={ext.data.vatRate || '9'}
                                    onChange={(e) => {
                                      const updated = [...extractedInvoices]
                                      updated[index].data!.vatRate = e.target.value
                                      setExtractedInvoices(updated)
                                    }}
                                    className="input-field text-sm"
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-medium text-text-dark/60 mb-1">Processing Fee Rate (%)</label>
                                  <input
                                    type="number"
                                    step="0.1"
                                    value={ext.data.paymentProcessingFeeRate || '4'}
                                    onChange={(e) => {
                                      const updated = [...extractedInvoices]
                                      updated[index].data!.paymentProcessingFeeRate = e.target.value
                                      setExtractedInvoices(updated)
                                    }}
                                    className="input-field text-sm"
                                  />
                                </div>
                              </div>
                              
                              <div className="mt-3">
                                <label className="block text-xs font-medium text-text-dark/60 mb-1">Notes (Optional)</label>
                                <textarea
                                  value={ext.data.notes || ''}
                                  onChange={(e) => {
                                    const updated = [...extractedInvoices]
                                    updated[index].data!.notes = e.target.value
                                    setExtractedInvoices(updated)
                                  }}
                                  className="input-field text-sm"
                                  rows={2}
                                  placeholder="Additional notes..."
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="text-text-dark/60">Processing...</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex gap-4 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={handleImageSubmit}
                    disabled={isSubmitting || extractedInvoices.filter(ext => {
                      if (!ext.data) return false
                      const hasRequiredFields = ext.data.buyerId && ext.data.dueDate && ext.data.amount && parseFloat(ext.data.amount) > 0
                      const hasNoErrors = !ext.data.errors || ext.data.errors.length === 0
                      return hasRequiredFields && hasNoErrors
                    }).length === 0}
                    className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Creating Invoices...' : `Create ${extractedInvoices.filter(ext => {
                      if (!ext.data) return false
                      const hasRequiredFields = ext.data.buyerId && ext.data.dueDate && ext.data.amount && parseFloat(ext.data.amount) > 0
                      const hasNoErrors = !ext.data.errors || ext.data.errors.length === 0
                      return hasRequiredFields && hasNoErrors
                    }).length} Invoice(s)`}
                  </button>
                  <Link href="/invoices" className="btn-secondary">
                    Cancel
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

