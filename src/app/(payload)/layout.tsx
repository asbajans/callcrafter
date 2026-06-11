import configPromise from '@payload-config'
import { handleServerFunctions, RootLayout } from '@payloadcms/next/layouts'
import { importMap } from './admin/importMap'
import '@payloadcms/next/css'
import './custom.css'

const serverFunction = async (args: any) => {
  'use server'
  const { name, args: functionArgs } = args
  return handleServerFunctions({
    config: configPromise,
    importMap,
    name,
    args: functionArgs,
  })
}

const Layout = ({ children }: { children: React.ReactNode }) => (
  <RootLayout config={configPromise} importMap={importMap} serverFunction={serverFunction}>
    {children}
  </RootLayout>
)

export default Layout
