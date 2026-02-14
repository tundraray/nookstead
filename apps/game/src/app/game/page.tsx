'use client';

import dynamic from 'next/dynamic';

const GameApp = dynamic(
  () =>
    import('@/components/game/GameApp').then((mod) => mod.GameApp),
  { ssr: false }
);

export default function GamePage() {
  return <GameApp />;
}
