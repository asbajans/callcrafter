import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'
import { CreditService } from '@/billing/CreditService'

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await getPayload({ config })
    const creditService = new CreditService()

    // Find all tenant credits where earliestExpiry is in the past and balance > 0
    const expiredCredits = await payload.find({
      collection: 'tenant-credits' as any,
      where: {
        and: [
          { earliestExpiry: { less_than: new Date().toISOString() } },
          { balance: { greater_than: 0 } },
        ],
      },
      limit: 500,
    })

    let totalExpired = 0
    let processedCount = 0

    for (const record of expiredCredits.docs) {
      const rec = record as any
      const tenantId = typeof rec.tenant === 'object' ? rec.tenant.id : rec.tenant
      const expired = await creditService.expireCredits(tenantId)
      totalExpired += expired
      if (expired > 0) processedCount++
    }

    return NextResponse.json({
      processed: processedCount,
      totalExpired,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Credit expiry cron error:', error)
    return NextResponse.json({ error: 'Cron job failed' }, { status: 500 })
  }
}
