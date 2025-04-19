import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { toast } from '../components/ui/use-toast'
import { Button } from '../components/ui/button'

export default function ValidatePage() {
  const [searchParams] = useSearchParams()
  const code = searchParams.get('code')
  const { isAuthenticated } = useAuth()
  const token = localStorage.getItem('authToken')
  const navigate = useNavigate()
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [validationResult, setValidationResult] = useState<any>(null)

  useEffect(() => {
    if (!code) {
      toast({
        title: 'Invalid QR Code',
        description: 'The QR code is missing validation data',
        variant: 'destructive'
      })
      navigate('/validations#validation-history')
      return
    }

    if (!isAuthenticated || !token) {
      navigate('/login', { state: { from: `/validate?code=${code}` } })
      toast({
        title: 'Authentication Required',
        description: 'Please login to validate this device',
        variant: 'destructive'
      })
      return
    }

    validateCode()
  }, [code, token])

  const validateCode = async () => {
    if (!code || !token) return
    
    setStatus('loading')
    try {
      const response = await fetch(`/api/validate/${encodeURIComponent(code)}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        throw new Error(await response.text())
      }

      const result = await response.json()
      setValidationResult(result)
      setStatus('success')
      navigate('/validations?from_validation=true#validation-history')
      toast({
        title: "Validation Successful",
        description: "Location validation completed successfully",
        variant: "default"
      })
    } catch (error) {
      console.error('Validation failed:', error)
      setStatus('error')
      navigate('/validations?from_validation=true#validation-history')
      toast({
        title: 'Validation Failed',
        //description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive'
      })
    }
  }

  return (
    <div className="container mx-auto p-4">
      {status === 'loading' && <div>Validating...</div>}
      {status === 'error' && (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">Validation Failed</h1>
          <Button onClick={() => navigate('/validations#validation-history')}>
            View Validation History
          </Button>
        </div>
      )}
    </div>
  )
}
