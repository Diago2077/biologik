import { Badge, type TonoBadge } from '@/components/ui/badge'
import { ESTADO_LABEL, type EstadoVacunacion } from '@/lib/vacunacion'

const TONO: Record<EstadoVacunacion, TonoBadge> = {
  sin_iniciar: 'neutral',
  al_dia: 'success',
  por_vencer: 'warning',
  vencida: 'danger',
}

export function EstadoVacunacionBadge({ estado }: { estado: EstadoVacunacion }) {
  return <Badge tono={TONO[estado]}>{ESTADO_LABEL[estado]}</Badge>
}
