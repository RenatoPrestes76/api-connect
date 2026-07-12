import {
  LayoutDashboard,
  Landmark,
  Building2,
  Layers,
  ServerCog,
  Plug,
  ToggleLeft,
  Rocket,
  ShieldAlert,
  KeyRound,
  Users,
  ScrollText,
  Gauge,
  Activity,
  Settings,
} from 'lucide-react';
import type { MenuItem } from '@/types';

export const APP_NAME = 'Atlas Control Plane';

export const NAV_ITEMS: MenuItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/fleet', label: 'Fleet Overview', icon: Gauge },
  { href: '/tenants', label: 'Tenants', icon: Landmark },
  { href: '/companies', label: 'Organizations', icon: Building2 },
  { href: '/environments', label: 'Ambientes', icon: Layers },
  { href: '/runtimes', label: 'Runtimes', icon: ServerCog },
  { href: '/marketplace', label: 'Connectors', icon: Plug },
  { href: '/deployments', label: 'Deploy Center', icon: Rocket },
  { href: '/feature-flags', label: 'Feature Flags', icon: ToggleLeft },
  { href: '/alerts', label: 'Alert Center', icon: ShieldAlert },
  { href: '/licenses', label: 'Licenças', icon: KeyRound },
  { href: '/users', label: 'Usuários', icon: Users },
  { href: '/audit', label: 'Auditoria', icon: ScrollText },
  { href: '/monitoring', label: 'Operations Dashboard', icon: Activity },
  { href: '/settings', label: 'Configurações', icon: Settings },
];
