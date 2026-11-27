import type { Metadata } from 'next'
import { SignInForm } from '@/components/auth-forms'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string; created?: string }> }) {
  const sp = await searchParams
  return <SignInForm next={sp.next} linkError={sp.error === 'link'} deactivated={sp.error === 'deactivated'} created={sp.created === '1'} />
}
