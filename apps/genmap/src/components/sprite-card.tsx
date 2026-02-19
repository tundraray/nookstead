import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface SpriteCardProps {
  sprite: {
    id: string;
    name: string;
    s3Url: string;
    width: number;
    height: number;
    fileSize: number;
    createdAt: string;
  };
}

export function SpriteCard({ sprite }: SpriteCardProps) {
  return (
    <Link href={`/sprites/${sprite.id}`}>
      <Card className="p-0 gap-0 overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="p-0">
          <img
            src={sprite.s3Url}
            alt={sprite.name}
            className="pixelated w-full h-32 object-contain bg-muted"
          />
        </CardHeader>
        <CardContent className="p-3">
          <CardTitle className="text-sm truncate">{sprite.name}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {sprite.width} x {sprite.height} px
          </p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(sprite.fileSize)}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(sprite.createdAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
