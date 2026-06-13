import config from '@payload-config'
import {
  REST_DELETE,
  REST_GET,
  REST_OPTIONS,
  REST_PATCH,
  REST_POST,
  REST_PUT,
} from '@payloadcms/next/routes'
import { NextResponse } from 'next/server'

function withErrorHandler(handler: Function) {
  return async (...args: any[]) => {
    try {
      return await handler(...args)
    } catch (error: any) {
      console.error('Payload REST API error:', error)
      return NextResponse.json(
        { error: error?.message || 'Internal server error' },
        { status: 500 }
      )
    }
  }
}

export const GET = withErrorHandler(REST_GET(config))
export const POST = withErrorHandler(REST_POST(config))
export const PUT = withErrorHandler(REST_PUT(config))
export const PATCH = withErrorHandler(REST_PATCH(config))
export const DELETE = withErrorHandler(REST_DELETE(config))
export const OPTIONS = withErrorHandler(REST_OPTIONS(config))
