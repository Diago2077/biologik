import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Cargando, ErrorBox } from '@/components/ui/estado'
import { Field, Input, Select } from '@/components/ui/field'
import { useConfiguracionIA } from '@/hooks/useConfiguracionIA'
import type { ReasoningEffort } from '@/lib/database.types'

const MODELOS_CONOCIDOS = ['gpt-4o', 'gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol']

interface Form {
  modelo: string
  precioInput: string
  precioOutput: string
  precioCache: string
  reasoningEffort: '' | ReasoningEffort
  maxTokens: string
  limiteUsuarioHora: string
  calibracionSlope: string
  calibracionIntercept: string
}

export default function ConfiguracionIA() {
  const { data: config, loading, error, refetch, actualizar } = useConfiguracionIA()
  const [form, setForm] = useState<Form | null>(null)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const [modoOtro, setModoOtro] = useState(false)

  useEffect(() => {
    if (!config) return
    setForm({
      modelo: config.modelo,
      precioInput: String(config.precio_input_por_1m),
      precioOutput: String(config.precio_output_por_1m),
      precioCache: String(config.precio_cache_por_1m),
      reasoningEffort: config.reasoning_effort ?? '',
      maxTokens: String(config.max_tokens),
      limiteUsuarioHora:
        config.limite_tokens_usuario_hora != null ? String(config.limite_tokens_usuario_hora) : '',
      calibracionSlope: String(config.calibracion_slope),
      calibracionIntercept: String(config.calibracion_intercept),
    })
    setModoOtro(!MODELOS_CONOCIDOS.includes(config.modelo))
  }, [config])

  function campo<K extends keyof Form>(key: K, valor: Form[K]) {
    setForm((f) => (f ? { ...f, [key]: valor } : f))
  }

  async function onGuardar() {
    if (!form) return
    if (!form.modelo.trim()) return setErrorForm('Falta el modelo.')

    const precioInput = Number(form.precioInput)
    const precioOutput = Number(form.precioOutput)
    const precioCache = Number(form.precioCache)
    const maxTokens = Number(form.maxTokens)
    if (!Number.isFinite(precioInput) || precioInput < 0) return setErrorForm('El precio de input no es valido.')
    if (!Number.isFinite(precioOutput) || precioOutput < 0) return setErrorForm('El precio de output no es valido.')
    if (!Number.isFinite(precioCache) || precioCache < 0) return setErrorForm('El precio de cache no es valido.')
    if (!Number.isInteger(maxTokens) || maxTokens < 1) return setErrorForm('max_tokens no es valido.')

    const limiteUsuarioHora = form.limiteUsuarioHora.trim() === '' ? null : Number(form.limiteUsuarioHora)
    if (limiteUsuarioHora !== null && (!Number.isInteger(limiteUsuarioHora) || limiteUsuarioHora < 1)) {
      return setErrorForm('El limite por usuario y hora no es valido.')
    }

    const slope = Number(form.calibracionSlope)
    const intercept = Number(form.calibracionIntercept)
    if (!Number.isFinite(slope) || slope <= 0) return setErrorForm('La pendiente tiene que ser mayor que cero.')
    if (!Number.isFinite(intercept)) return setErrorForm('La ordenada de la calibracion no es valida.')

    setGuardando(true)
    setErrorForm(null)
    const { error: err } = await actualizar({
      modelo: form.modelo.trim(),
      precio_input_por_1m: precioInput,
      precio_output_por_1m: precioOutput,
      precio_cache_por_1m: precioCache,
      reasoning_effort: form.reasoningEffort || null,
      max_tokens: maxTokens,
      limite_tokens_usuario_hora: limiteUsuarioHora,
      calibracion_slope: slope,
      calibracion_intercept: intercept,
    })
    setGuardando(false)
    if (err) {
      setErrorForm(err)
      return
    }
    toast.success('Configuracion actualizada')
    refetch()
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-lg font-semibold text-foreground">Configuracion de IA</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Modelo y parámetros que usa el conteo de garrapatas (api/contar.ts). Se aplica al toque, sin deploy.
        </p>
      </div>

      {loading || !form ? (
        <Cargando />
      ) : error ? (
        <ErrorBox mensaje={error} />
      ) : (
        <div className="max-w-lg space-y-4 rounded-lg border border-border bg-card p-5">
          <Field label="Modelo *">
            <Select
              value={modoOtro ? 'otro' : form.modelo}
              onChange={(e) => {
                const valor = e.target.value
                if (valor === 'otro') {
                  setModoOtro(true)
                  campo('modelo', '')
                } else {
                  setModoOtro(false)
                  campo('modelo', valor)
                }
              }}
            >
              {MODELOS_CONOCIDOS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
              <option value="otro">Otro…</option>
            </Select>
            {modoOtro && (
              <Input
                className="mt-2"
                value={form.modelo}
                onChange={(e) => campo('modelo', e.target.value)}
                placeholder="Id exacto del modelo en la API de OpenAI"
                autoComplete="off"
                autoFocus
              />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio input (USD / 1M tokens) *">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.precioInput}
                onChange={(e) => campo('precioInput', e.target.value)}
              />
            </Field>
            <Field label="Precio output (USD / 1M tokens) *">
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.precioOutput}
                onChange={(e) => campo('precioOutput', e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Precio cache (USD / 1M tokens) *"
            hint="OpenAI reusa el prefijo de los prompts largos y lo cobra mas barato. En gpt-4o es la mitad del input."
          >
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.precioCache}
              onChange={(e) => campo('precioCache', e.target.value)}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Reasoning effort"
              hint="Solo lo usan los modelos gpt-5.x; en gpt-4o y similares se ignora."
            >
              <Select
                value={form.reasoningEffort}
                onChange={(e) => campo('reasoningEffort', e.target.value as Form['reasoningEffort'])}
              >
                <option value="">Sin especificar (medium)</option>
                <option value="none">none</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
                <option value="xhigh">xhigh</option>
                <option value="max">max</option>
              </Select>
            </Field>
            <Field label="Max tokens de la respuesta *">
              <Input
                type="number"
                min={1}
                value={form.maxTokens}
                onChange={(e) => campo('maxTokens', e.target.value)}
              />
            </Field>
          </div>

          <Field
            label="Limite de tokens por usuario y hora"
            hint="Evita que una sola persona agote el cupo mensual de la empresa de una sentada. Vacio = sin tope."
          >
            <Input
              type="number"
              min={1}
              placeholder="Sin tope"
              value={form.limiteUsuarioHora}
              onChange={(e) => campo('limiteUsuarioHora', e.target.value)}
            />
          </Field>

          <div className="border-t border-border pt-5">
            <h2 className="text-sm font-semibold text-foreground">Calibracion del conteo</h2>
            <p className="mt-1 mb-4 text-xs leading-relaxed text-muted-foreground">
              El numero crudo del modelo se corrige con una recta:{' '}
              <span className="font-medium text-foreground">
                final = redondear(crudo x pendiente + ordenada)
              </span>
              . Hace falta porque el sesgo no es proporcional: en fotos con garrapatas apinadas el
              modelo se queda corto, y en fotos con pocas se pasa. Ajustala a medida que sumes fotos
              con conteo manual real.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pendiente (slope) *">
                <Input
                  type="number"
                  step="0.01"
                  min={0.01}
                  value={form.calibracionSlope}
                  onChange={(e) => campo('calibracionSlope', e.target.value)}
                />
              </Field>
              <Field label="Ordenada (intercept) *">
                <Input
                  type="number"
                  step="0.1"
                  value={form.calibracionIntercept}
                  onChange={(e) => campo('calibracionIntercept', e.target.value)}
                />
              </Field>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Con los valores actuales, un conteo crudo de 60 queda en{' '}
              <span className="font-medium text-foreground">
                {Math.max(
                  0,
                  Math.round(60 * (Number(form.calibracionSlope) || 0) + (Number(form.calibracionIntercept) || 0)),
                )}
              </span>
              .
            </p>
          </div>

          {errorForm && <ErrorBox mensaje={errorForm} />}

          <div className="flex justify-end">
            <Button onClick={onGuardar} disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
