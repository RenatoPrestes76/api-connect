'use client';
import { GraduationCap, BookOpen, Users, Cpu, Wrench, TrendingUp } from 'lucide-react';

interface Course {
  id: string;
  title: string;
  description: string;
  audience: string;
  modules: string[];
  duration: string;
  icon: React.ReactNode;
}

const COURSES: Course[] = [
  {
    id: 'admin',
    title: 'Administrador',
    description: 'Instalação, configuração e governança da plataforma Atlas Connect.',
    audience: 'IT Admins, DevOps',
    duration: '4h',
    icon: <Wrench className="h-5 w-5" />,
    modules: [
      'Instalação (Docker Compose / Kubernetes)',
      'Configuração de tenant e planos',
      'Gestão de usuários e permissões',
      'SSO e MFA enterprise',
      'Backup e Disaster Recovery',
      'Monitoramento e alertas',
    ],
  },
  {
    id: 'operator',
    title: 'Operador',
    description: 'Criação de workflows, conectores e monitoramento operacional.',
    audience: 'Integradores, Desenvolvedores',
    duration: '6h',
    icon: <Cpu className="h-5 w-5" />,
    modules: [
      'Criação de workflows (Visual Builder)',
      'Configuração de conectores ERP',
      'AI Copilot para mapeamento semântico',
      'Depuração de execuções (Observatory)',
      'Feature flags e circuit breakers',
      'Marketplace de conectores',
    ],
  },
  {
    id: 'executive',
    title: 'Executivo',
    description: 'Dashboards, KPIs, custos e governança para tomada de decisão.',
    audience: 'C-Suite, Gestores',
    duration: '1h',
    icon: <TrendingUp className="h-5 w-5" />,
    modules: [
      'Dashboard executivo — KPIs em tempo real',
      'SLAs e disponibilidade',
      'Custos e ROI de integração',
      'Relatórios de compliance (LGPD/GDPR)',
      'Roadmap e planos de expansão',
    ],
  },
  {
    id: 'developer',
    title: 'Desenvolvedor de Conectores',
    description: 'Desenvolvimento e publicação de conectores no Marketplace.',
    audience: 'Desenvolvedores',
    duration: '8h',
    icon: <BookOpen className="h-5 w-5" />,
    modules: [
      'ConnectorSDK — interfaces e contexto',
      'Implementando entidades e mapeamentos',
      'Testes com MockConnectorContext',
      'Publicação no Marketplace',
      'Versionamento e compatibilidade',
      'Workflow Builder IA + AI Copilot APIs',
    ],
  },
  {
    id: 'customer-success',
    title: 'Customer Success',
    description: 'Processo de onboarding e sucesso do cliente com Atlas Connect.',
    audience: 'CS, Support',
    duration: '2h',
    icon: <Users className="h-5 w-5" />,
    modules: [
      'Fluxo de onboarding (6 etapas)',
      'Provisionamento de tenant',
      'Primeiro conector em produção',
      'Primeiro workflow executado',
      'Gestão de planos e billing',
      'Escalação de suporte (P1–P4)',
    ],
  },
];

const ONBOARDING_STEPS = [
  { step: 1, label: 'Cadastro', desc: 'Criação da conta e tenant' },
  { step: 2, label: 'Provisionamento', desc: 'Configuração de plano e agentes' },
  { step: 3, label: 'Conector', desc: 'Instalação do primeiro conector' },
  { step: 4, label: 'Workflow', desc: 'Criação do primeiro workflow' },
  { step: 5, label: 'Execução', desc: 'Primeira integração executada' },
  { step: 6, label: 'Produção', desc: 'Go-live oficial' },
];

export default function AcademyPage() {
  return (
    <div className="space-y-8 p-6">
      <div className="flex items-start gap-3">
        <GraduationCap className="mt-0.5 h-6 w-6 shrink-0 text-blue-400" />
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Atlas Academy</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Materiais de treinamento oficiais para todos os perfis de usuário da plataforma Atlas
            Connect v1.0
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
        <h2 className="mb-4 text-sm font-medium text-slate-300">Fluxo de Onboarding — 6 Etapas</h2>
        <div className="flex items-center gap-0">
          {ONBOARDING_STEPS.map((s, i) => (
            <div key={s.step} className="flex flex-1 flex-col items-center">
              <div className="flex w-full items-center">
                {i > 0 && <div className="h-px flex-1 bg-slate-600" />}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {s.step}
                </div>
                {i < ONBOARDING_STEPS.length - 1 && <div className="h-px flex-1 bg-slate-600" />}
              </div>
              <p className="mt-1.5 text-center text-xs font-medium text-slate-300">{s.label}</p>
              <p className="mt-0.5 text-center text-xs text-slate-600 hidden sm:block">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-4 text-sm font-medium text-slate-400">Trilhas de Treinamento</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {COURSES.map((course) => (
            <div key={course.id} className="rounded-lg border border-slate-700 bg-slate-800 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-slate-700 p-2 text-blue-400">{course.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-medium text-slate-200">{course.title}</h3>
                    <span className="shrink-0 text-xs text-slate-600">{course.duration}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">{course.audience}</p>
                  <p className="mt-1.5 text-xs text-slate-400">{course.description}</p>
                </div>
              </div>
              <ul className="mt-3 space-y-1 border-t border-slate-700 pt-3">
                {course.modules.map((m, i) => (
                  <li key={i} className="flex items-baseline gap-2 text-xs text-slate-400">
                    <span className="shrink-0 text-slate-700">›</span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800 p-5">
        <h2 className="mb-3 text-sm font-medium text-slate-300">Kit Comercial</h2>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {[
            'Pitch Deck (PDF)',
            'One Pager',
            'ROI Calculator',
            'Pricing Guide',
            'Battle Cards',
            'FAQ Comercial',
          ].map((item) => (
            <div
              key={item}
              className="flex items-center gap-2 rounded border border-slate-700 px-3 py-2 text-xs text-slate-400"
            >
              <span className="text-slate-600">📄</span>
              {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
