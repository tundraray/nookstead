import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ObjectCardProps {
  gameObject: {
    id: string;
    name: string;
    category?: string | null;
    objectType?: string | null;
    layers: Array<{
      frameId: string;
      spriteId: string;
      xOffset: number;
      yOffset: number;
      layerOrder: number;
    }>;
    tags: string[] | null;
    createdAt: string;
  };
  onDelete?: (id: string) => void;
}

export function ObjectCard({ gameObject, onDelete }: ObjectCardProps) {
  return (
    <div className="relative group">
      <Link href={`/objects/${gameObject.id}`}>
        <Card className="p-0 gap-0 overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
          <CardHeader className="p-0">
            <div className="w-full h-32 bg-muted flex items-center justify-center text-muted-foreground text-sm">
              {gameObject.layers.length > 0
                ? `${gameObject.layers.length} layer${gameObject.layers.length !== 1 ? 's' : ''}`
                : 'Empty object'}
            </div>
          </CardHeader>
          <CardContent className="p-3">
            <CardTitle className="text-sm truncate">
              {gameObject.name}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              {gameObject.layers.length} layer
              {gameObject.layers.length !== 1 ? 's' : ''}
              {gameObject.category && ` · ${gameObject.category}`}
              {gameObject.objectType && ` · ${gameObject.objectType}`}
            </p>
            {gameObject.tags && gameObject.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {gameObject.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(gameObject.createdAt).toLocaleDateString()}
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
            onDelete(gameObject.id);
          }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive text-destructive-foreground rounded-full w-7 h-7 flex items-center justify-center hover:bg-destructive/90"
          title="Delete object"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
