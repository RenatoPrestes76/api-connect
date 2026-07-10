'use client';
import { useState } from 'react';
import { History, Loader2, RotateCcw, Plus } from 'lucide-react';
import { useVersions, useSaveVersion, useRollback } from '@/hooks/use-workflow-builder';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface VersionSidebarProps {
  workflowId: string;
}

export function VersionSidebar({ workflowId }: VersionSidebarProps) {
  const [note, setNote] = useState('');
  const [showInput, setShowInput] = useState(false);
  const { data: versions, isLoading } = useVersions(workflowId);
  const saveVersion = useSaveVersion(workflowId);
  const rollback = useRollback(workflowId);

  const handleSave = () => {
    saveVersion.mutate(
      { note: note.trim() || undefined },
      {
        onSuccess: () => {
          setNote('');
          setShowInput(false);
        },
      }
    );
  };

  const handleRollback = (version: number) => {
    if (!confirm(`Restaurar para a versão ${version}? O estado atual será salvo automaticamente.`))
      return;
    rollback.mutate(version);
  };

  return (
    <div className="flex flex-col gap-3 p-4 h-full overflow-y-auto">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-purple-500" />
        <h3 className="font-semibold text-sm">Versões</h3>
        <button
          onClick={() => setShowInput(!showInput)}
          className="ml-auto rounded-md border px-2 py-1 text-xs hover:bg-muted transition-colors flex items-center gap-1"
        >
          <Plus className="h-3 w-3" />
          Salvar
        </button>
      </div>

      {showInput && (
        <div className="flex flex-col gap-2 rounded-lg border p-3">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota desta versão (opcional)"
            className="rounded-md border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500/40"
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saveVersion.isPending}
              className="flex-1 flex items-center justify-center gap-1 rounded-md bg-purple-600 px-3 py-1.5 text-xs text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {saveVersion.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Salvar Versão
            </button>
            <button
              onClick={() => setShowInput(false)}
              className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !versions?.length ? (
        <p className="text-xs text-muted-foreground text-center py-6">
          Nenhuma versão salva. Clique em "Salvar" para criar um checkpoint.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {versions.map((v) => (
            <div key={v.id} className="rounded-lg border p-3 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">v{v.version}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(v.createdAt), { addSuffix: true, locale: ptBR })}
                </span>
              </div>
              {v.note && <p className="text-xs text-muted-foreground">{v.note}</p>}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{v.author}</span>
                <button
                  onClick={() => handleRollback(v.version)}
                  disabled={rollback.isPending}
                  className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  Restaurar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
