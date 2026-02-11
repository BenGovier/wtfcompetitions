import { Suspense } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import LoginClient from './LoginClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { redirect?: string }
}) {
  const redirect = searchParams?.redirect ?? '/me'

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Suspense
          fallback={
            <Card>
              <CardHeader>
                <div className="h-8 w-32 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Loading...</p>
              </CardContent>
            </Card>
          }
        >
          <LoginClient redirect={redirect} />
        </Suspense>
      </div>
    </div>
  )
}
