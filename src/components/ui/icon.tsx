import * as React from 'react';
import {
  ArrowRight, Banknote, BadgeCheck, Camera, Check, CheckCheck, CheckCircle2,
  CalendarDays, ChevronLeft, ChevronRight, Clock, CreditCard, Download, Fingerprint, History,
  Home, Lock, Menu, MousePointerClick, Package, PlusCircle, QrCode, ReceiptText,
  RefreshCw, RotateCcw, ScanLine, ShieldCheck, ShoppingCart, Sparkles, Star, Store,
  Ticket, Timer, Trophy, User, UserRound, Wallet, Wand2, X, Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Ícones das telas do Stitch.
 *
 * O Stitch usa Material Symbols carregado do Google Fonts. Aqui o mesmo
 * conjunto é servido pelo lucide-react, que já está no bundle. O motivo é
 * concreto: Material Symbols é uma fonte de ícones por ligadura — se a CDN
 * estiver lenta ou bloqueada (o que acontece em rede corporativa, e aconteceu
 * no ambiente onde este protótipo foi testado), cada ícone vira a palavra
 * literal, e "account_balance_wallet" no lugar de um ícone de 20px destrói o
 * layout. Um ícone que sempre aparece vale mais que um pixel-perfect que some.
 *
 * Os nomes abaixo são os do Stitch, para que a correspondência com os HTMLs em
 * design/stitch/ continue óbvia na hora de comparar.
 */
const ICONS = {
  account_balance_wallet: Wallet,
  add_circle: PlusCircle,
  arrow_back_ios_new: ChevronLeft,
  arrow_forward: ArrowRight,
  auto_fix_high: Wand2,
  badge: UserRound,
  bolt: Zap,
  calendar_month: CalendarDays,
  check: Check,
  check_circle: CheckCircle2,
  chevron_right: ChevronRight,
  close: X,
  confirmation_number: Ticket,
  credit_card: CreditCard,
  document_scanner: ScanLine,
  done_all: CheckCheck,
  download: Download,
  emoji_events: Trophy,
  encrypted: Lock,
  fingerprint: Fingerprint,
  history: History,
  // O Stitch usa `casino` (dado de cassino) para "Início". Trocado por `home`:
  // o briefing pede estética fintech, explicitamente não de cassino.
  home: Home,
  inventory_2: Package,
  lock: Lock,
  menu: Menu,
  payments: Banknote,
  person: User,
  photo_camera: Camera,
  progress_activity: RefreshCw,
  qr_code_2: QrCode,
  receipt_long: ReceiptText,
  restart_alt: RotateCcw,
  schedule: Clock,
  shield_lock: ShieldCheck,
  shopping_cart: ShoppingCart,
  star: Star,
  stars: Sparkles,
  storefront: Store,
  sync: RefreshCw,
  timer: Timer,
  touch_app: MousePointerClick,
  verified: BadgeCheck,
  verified_user: ShieldCheck,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export interface SymProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref' | 'name'> {
  name: IconName;
  /** Lado do ícone em px. O Stitch escreve `text-[20px]`; aqui é `size={20}`. */
  size?: number;
  /** Rótulo acessível. Sem ele o ícone é decorativo e fica oculto ao leitor. */
  label?: string;
}

export function Sym({ name, size = 20, label, className, ...props }: SymProps) {
  const Component = ICONS[name];
  return (
    <Component
      width={size}
      height={size}
      strokeWidth={2}
      className={cn('shrink-0', className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      {...props}
    />
  );
}
