import { FavoritesList } from '@/components/FavoritesList'
import { BackLink } from '@/components/BackLink'

export const metadata = { title: 'Favoriti' }

export default function FavoritiPage() {
  return (
    <main className="min-h-dvh bg-black px-5 pb-20 pt-[max(4.5rem,env(safe-area-inset-top))]">
      <BackLink />
      <h1 className="meta mb-6 text-center text-white/40">Favoriti</h1>
      <FavoritesList />
    </main>
  )
}
