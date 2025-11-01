# Next.js Migration Guide

This frontend has been successfully migrated from Vite.js to Next.js 14 with App Router.

## Key Changes Made

### 1. Project Structure
- **Old**: `src/main.tsx` + `src/App.tsx` + React Router
- **New**: `app/` directory with App Router structure
  - `app/layout.tsx` - Root layout with providers
  - `app/page.tsx` - Home page
  - `app/dashboard/page.tsx` - Dashboard page
  - `app/preferences/page.tsx` - Preferences page
  - `app/manage-wallets/page.tsx` - Manage wallets page
  - `app/auth/page.tsx` - Authentication page

### 2. Routing Changes
- **Old**: React Router (`react-router-dom`)
- **New**: Next.js App Router
  - `useNavigate()` → `useRouter()` from `next/navigation`
  - `useLocation()` → `usePathname()` from `next/navigation`
  - `useSearchParams()` → `useSearchParams()` from `next/navigation`
  - `<Link to="...">` → `<Link href="...">` from `next/link`

### 3. Configuration Files
- **Added**: `next.config.js` - Next.js configuration with webpack polyfills
- **Updated**: `package.json` - Next.js dependencies and scripts
- **Updated**: `tsconfig.json` - Next.js TypeScript configuration
- **Updated**: `tailwind.config.ts` - Added Next.js content paths
- **Removed**: `vite.config.ts`, `index.html`, `main.tsx`, `App.tsx`

### 4. Docker Configuration
- **Updated**: `Dockerfile` - Next.js build and runtime stages
- **Updated**: `docker-compose.yml` - Port mapping (3000:3000)

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Environment Variables

Create a `.env.local` file with:

```env
NEXT_PUBLIC_WEB3AUTH_CLIENT_ID=your_web3auth_client_id_here
NEXT_PUBLIC_WEB3AUTH_VERIFIER=your_verifier_name_here
NEXT_PUBLIC_ALCHEMY_API_KEY=your_alchemy_api_key_here
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## Docker Development

```bash
# Start development stack
docker-compose --profile dev up

# Start production stack
docker-compose --profile prod up
```

## Key Features Preserved

- ✅ Web3Auth integration
- ✅ Wagmi wallet connection
- ✅ React Query for data fetching
- ✅ Tailwind CSS styling
- ✅ Shadcn/ui components
- ✅ All existing functionality

## Migration Benefits

1. **Better SEO**: Server-side rendering capabilities
2. **Performance**: Automatic code splitting and optimization
3. **Developer Experience**: Built-in TypeScript support, hot reloading
4. **Production Ready**: Optimized builds and deployment
5. **Future Proof**: Latest React features and Next.js ecosystem

## Notes

- All components are now client-side rendered (`'use client'` directive)
- The app maintains the same user experience as before
- API routes can be added in `app/api/` directory if needed
- Static assets go in `public/` directory
