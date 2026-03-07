import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { Npc } from '@/hooks/use-npcs';

interface NpcCardProps {
  npc: Npc;
  onDelete?: (id: string) => void;
}

export function NpcCard({ npc, onDelete }: NpcCardProps) {
  return (
    <div className="relative group">
      <Link href={`/npcs/${npc.id}`}>
        <Card className="p-0 gap-0 overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="p-0">
            <div className="w-full h-24 bg-muted flex items-center justify-center">
              <span className="text-2xl font-bold text-muted-foreground/40">
                {npc.name.charAt(0).toUpperCase()}
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <CardTitle className="text-sm truncate">{npc.name}</CardTitle>
            <div className="flex items-center gap-1 mt-1">
              <Badge variant="secondary" className="text-xs">
                {npc.skin}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {npc.role || 'No role'}
              {npc.age != null && `, ${npc.age}y`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(npc.createdAt).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </Link>
      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete(npc.id);
          }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full w-7 h-7 flex items-center justify-center hover:bg-destructive/90"
          title="Delete NPC"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
