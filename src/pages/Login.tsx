import { Loader2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { ErrorBox } from '@/components/ui/estado'
import { Field, Input } from '@/components/ui/field'
import { useAuth } from '@/hooks/useAuth'
import { pedirPermisoPushSiEsLaPrimeraVez } from '@/lib/notificaciones'
import { isSupabaseConfigured } from '@/lib/supabase'
import { APP_VERSION } from '@/lib/version'

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!loading && user) navigate('/', { replace: true })
  }, [user, loading, navigate])

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (enviando) return
    setError(null)
    setEnviando(true)
    const { error: err } = await signIn(email, password)
    setEnviando(false)
    if (err) {
      setError(err)
      return
    }
    // Todavia dentro del gesto de "Ingresar": es el unico momento en que se
    // puede pedir el permiso sin que el navegador lo trate como spam. La
    // suscripcion en si (guardar el endpoint) la completa useNotificaciones
    // solo cuando el perfil termine de cargar.
    void pedirPermisoPushSiEsLaPrimeraVez()
    navigate('/', { replace: true })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <img src="/logo.svg" alt="" className="mx-auto mb-3 size-12" />
          <h1 className="text-lg font-semibold text-foreground">Biologik S.A.</h1>
          <p className="mt-1 text-sm text-muted-foreground">Ingresá con tu cuenta de la empresa</p>
        </div>

        {!isSupabaseConfigured && (
          <div className="mb-4">
            <ErrorBox mensaje="Falta configurar VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el archivo .env" />
          </div>
        )}

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-xs"
        >
          <Field label="Email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vos@empresa.com.py"
              autoComplete="email"
              required
              autoFocus
            />
          </Field>

          <Field label="Contrasena">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
            />
          </Field>

          {error && <ErrorBox mensaje={error} />}

          <Button type="submit" className="w-full" disabled={enviando || !isSupabaseConfigured}>
            {enviando ? (
              <>
                <Loader2 className="animate-spin" /> Ingresando…
              </>
            ) : (
              'Ingresar'
            )}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Las cuentas las crea el administrador del sistema.
        </p>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
          Desarrollado por DRPCS E.A.S. · v{APP_VERSION}
        </p>
      </div>
    </div>
  )
}
