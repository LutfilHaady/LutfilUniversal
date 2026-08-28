'use client'

import { useState, useEffect } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { ArrowLeft, Image as ImageIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getUserTypeFromUserId } from '@/lib/utils'

const issueTypes = [
  { value: 'NOT_RECEIVED', label: 'Not Received' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'DELAYED', label: 'Delayed' },
  { value: 'WRONG_ITEMS', label: 'Wrong Items' },
  { value: 'PAYMENT_ISSUE', label: 'Payment Issue' },
  { value: 'OTHER', label: 'Other' },
]

export default function NewIssuePage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string>('')
  const [orders, setOrders] = useState<any[]>([])
  const [isLoadingOrders, setIsLoadingOrders] = useState(true)
  const [formData, setFormData] = useState({
    orderId: '',
    type: '',
    description: '',
    image: null as File | null,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUserId = localStorage.getItem('userId')
      if (storedUserId) {
        setUserId(storedUserId)
      }
    }
  }, [])
  
  useEffect(() => {
    if (userId) {
      fetchOrders()
    }
  }, [userId])
  
  const fetchOrders = async () => {
    setIsLoadingOrders(true)
    try {
      const userType = getUserTypeFromUserId(userId)
      const response = await fetch(`/api/invoices?userId=${userId}&userType=${userType}`)
      if (response.ok) {
        const invoices = await response.json()
        // Convert invoices to orders format
        const ordersList = invoices.map((inv: any) => ({
          id: inv.orderId || inv.invoiceNumber,
          buyerId: inv.buyerId,
          buyerName: inv.buyerName,
          supplierId: inv.supplierId,
          supplierName: inv.supplierName,
          date: inv.issueDate || inv.createdAt,
        }))
        setOrders(ordersList)
      }
    } catch (error) {
      console.error('Error fetching orders:', error)
    } finally {
      setIsLoadingOrders(false)
    }
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    try {
      // Get selected order to find buyer/supplier IDs
      const selectedOrder = orders.find(o => o.id === formData.orderId)
      if (!selectedOrder) {
        throw new Error('Selected order not found')
      }
      
      // Determine buyer and supplier based on user type
      const userType = getUserTypeFromUserId(userId)
      const buyerId = userType === 'BUYER' ? userId : selectedOrder.buyerId
      const supplierId = userType === 'SUPPLIER' ? userId : selectedOrder.supplierId
      const createdBy = userType // 'BUYER' or 'SUPPLIER' - who is creating the issue
      
      // Handle image upload if provided - convert to base64 data URL
      let imageUrl = null
      if (formData.image) {
        // Convert image to base64 data URL
        const reader = new FileReader()
        imageUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(formData.image!)
        })
      }
      
      const requestBody = {
        orderId: formData.orderId,
        buyerId,
        supplierId,
        type: formData.type,
        description: formData.description,
        imageUrl: imageUrl,
        createdBy, // Track who created the issue
      }
      
      console.log('Creating issue with data:', requestBody)
      
      const response = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        console.error('API Error:', errorData)
        const errorMessage = errorData.details 
          ? `${errorData.error}: ${errorData.details}`
          : errorData.error || 'Failed to create issue'
        throw new Error(errorMessage)
      }
      
      router.push('/issues?success=issue_created')
    } catch (error) {
      console.error('Error creating issue:', error)
      alert(error instanceof Error ? error.message : 'Failed to create issue. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const userType = getUserTypeFromUserId(userId)
  
  return (
    <div className="min-h-screen bg-cream-white">
      <Navbar userId={userId} userType={userType} />
      
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Header */}
        <div className="mb-8">
          <Link href="/issues" className="inline-flex items-center gap-2 text-primary-green hover:underline mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Issues
          </Link>
          <h1 className="text-3xl font-bold text-text-dark mb-2">Report Issue</h1>
          <p className="text-text-dark/60">Report an issue with an order</p>
        </div>
        
        {/* Web Form */}
        <form onSubmit={handleSubmit} className="card">
          
          <div className="space-y-6">
            <div>
              <label htmlFor="orderId" className="block text-sm font-medium text-text-dark mb-2">
                Select Order <span className="text-status-error">*</span>
              </label>
              <select
                id="orderId"
                required
                value={formData.orderId}
                onChange={(e) => setFormData({ ...formData, orderId: e.target.value })}
                className="input-field"
                disabled={isLoadingOrders}
              >
                <option value="">{isLoadingOrders ? 'Loading orders...' : 'Choose an order...'}</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.id} - {userType === 'SUPPLIER' ? order.buyerName : order.supplierName} ({new Date(order.date).toLocaleDateString()})
                  </option>
                ))}
              </select>
              {orders.length === 0 && !isLoadingOrders && (
                <p className="text-xs text-text-dark/60 mt-1">No orders found. Create an invoice first.</p>
              )}
            </div>
            
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-text-dark mb-2">
                Issue Type <span className="text-status-error">*</span>
              </label>
              <select
                id="type"
                required
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="input-field"
              >
                <option value="">Select issue type...</option>
                {issueTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-text-dark mb-2">
                Description <span className="text-status-error">*</span>
              </label>
              <textarea
                id="description"
                required
                rows={4}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the issue in detail..."
                className="input-field resize-none"
              />
            </div>
            
            <div>
              <label htmlFor="image" className="block text-sm font-medium text-text-dark mb-2">
                Image (Optional)
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="file"
                  id="image"
                  accept="image/*"
                  onChange={(e) => setFormData({ ...formData, image: e.target.files?.[0] || null })}
                  className="input-field"
                />
                {formData.image && (
                  <div className="flex items-center gap-2 text-sm text-text-dark/60">
                    <ImageIcon className="w-4 h-4" />
                    <span>{formData.image.name}</span>
                  </div>
                )}
              </div>
              {formData.image && (
                <div className="mt-3">
                  <img
                    src={URL.createObjectURL(formData.image)}
                    alt="Preview"
                    className="max-w-full h-auto max-h-64 rounded-lg border border-cream-grey"
                  />
                </div>
              )}
              <p className="text-xs text-text-dark/60 mt-1">
                Upload an image to support your issue report (e.g., photo of damaged items).
              </p>
            </div>
            
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Issue'}
              </button>
              <Link href="/issues" className="btn-secondary">
                Cancel
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

