/** Material properties for game runtime (movement, collision). */
export interface MaterialProperties {
  key: string;
  walkable: boolean;
  speedModifier: number;
  swimRequired: boolean;
  damaging: boolean;
}
