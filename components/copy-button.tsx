'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

interface CopyButtonProps {
  text: string
}

export function CopyButton({ text }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast.success('Invite code copied to clipboard!')
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      toast.error('Failed to copy code.')
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleCopy}
      className="border border-border text-foreground hover:bg-muted h-8 w-8 rounded-sm shrink-0"
      title="Copy Invite Code"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-owed" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  )
}
