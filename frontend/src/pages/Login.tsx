'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<{[key: string]: string}>({})
  const [showVerificationMessage, setShowVerificationMessage] = useState(false)

  // Form validation
  const validateForm = () => {
    const newErrors: {[key: string]: string} = {}

    // Email validation
    if (!email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Please enter a valid email address'
    }

    // Password validation
    if (!password) {
      newErrors.password = 'Password is required'
    } else if (mode === 'signup') {
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/
      if (!passwordRegex.test(password)) {
        newErrors.password = 'Password must be 8+ chars with uppercase, lowercase, number & special character'
      }
    }

    // Name validation for signup
    if (mode === 'signup' && !name.trim()) {
      newErrors.name = 'Full name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Get user-friendly error messages
  const getErrorMessage = (error: any) => {
    switch (error.message) {
      case 'Invalid login credentials':
        return 'Incorrect email or password'
      case 'User already registered':
        return 'An account with this email already exists'
      case 'Email not confirmed':
        return 'Please check your email and confirm your account'
      case 'Signup disabled':
        return 'New registrations are currently disabled'
      case 'Password should be at least 6 characters':
        return 'Password must be at least 6 characters long'
      case 'Unable to validate email address: invalid format':
        return 'Please enter a valid email address'
      default:
        return error.message || 'An unexpected error occurred'
    }
  }

  // Reset form
  const resetForm = () => {
    setEmail('')
    setPassword('')
    setName('')
    setErrors({})
  }

  // Handle form submission
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setLoading(true)
    
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ 
          email: email.trim(), 
          password 
        })
        
        if (error) throw error
        
        toast.success('Login successful!')
        resetForm()
        window.location.href = '/dashboard'
        
        // Handle successful login (redirect, etc.)
        // window.location.href = '/dashboard' // Example
        
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name.trim()
            }
          }
        })
        
        if (error) throw error
        
        if (data.user && !data.user.email_confirmed_at) {
          toast.success('Account created! Please check your email to confirm your account.')
          setShowVerificationMessage(true)
          resetForm()
        } else {
          toast.success('Account created successfully!')
          resetForm()
          setMode('login')
        }
      }
    } catch (err: any) {
      const errorMessage = getErrorMessage(err)
      toast.error(errorMessage)
      
      // Clear password on login failure for security
      if (mode === 'login') {
        setPassword('')
      }
    } finally {
      setLoading(false)
    }
  }

  // Handle mode switch
  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login')
    setErrors({}) // Clear errors when switching modes
    setShowVerificationMessage(false) // Clear verification message
    // Don't clear form data - better UX
  }

  // Handle keyboard submission
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {showVerificationMessage ? (
            <div className="text-center space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2">Check Your Email</h3>
                <p className="text-sm text-blue-700">
                  We've sent a verification link to your email address. Please verify your email, then return here to sign in.
                </p>
              </div>
              <Button 
                onClick={() => {
                  setShowVerificationMessage(false)
                  setMode('login')
                }}
                className="w-full"
              >
                Continue to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value)
                      if (errors.name) {
                        setErrors(prev => ({...prev, name: ''}))
                      }
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter your full name"
                    disabled={loading}
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errors.email) {
                      setErrors(prev => ({...prev, email: ''}))
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter your email"
                  disabled={loading}
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (errors.password) {
                      setErrors(prev => ({...prev, password: ''}))
                    }
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter your password"
                  disabled={loading}
                  className={errors.password ? 'border-red-500' : ''}
                />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password}</p>
                )}
                {mode === 'signup' && (
                  <p className="text-xs text-gray-500">
                    Must include uppercase, lowercase, number & special character
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading}
              >
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </Button>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
                </p>
                <Button
                  type="button"
                  variant="link"
                  onClick={switchMode}
                  disabled={loading}
                  className="p-0 text-blue-600 hover:text-blue-800"
                >
                  {mode === 'login' ? 'Create Account' : 'Sign In'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}