import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(request: NextRequest) {
  return NextResponse.json({ ok: true, route: '/api/_debug/simulate-confirmed' })
}
