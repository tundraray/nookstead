import type { Scene } from 'phaser';
import type {
  SerializedObjectLayer,
  SerializedPlacedObject,
  GameObjectLayerDef,
  GameObjectDefinition,
} from '@nookstead/shared';
import type { GameObjectCache } from '../services/game-object-cache';

/**
 * Renders placed game objects from object layers as Phaser Containers.
 *
 * Each placed object becomes a Container positioned at its grid cell,
 * with child Sprites for each render layer (sorted by layerOrder).
 * Supports flipX, rotation, and y-sorted depth ordering.
 *
 * Collision zones of type 'collision' produce invisible static physics
 * bodies grouped in a StaticGroup for collider registration.
 * Zones of type 'walkable' are skipped (handled at the walkability
 * grid level on the server).
 */
export class ObjectRenderer {
  private readonly containers: Phaser.GameObjects.Container[] = [];
  private readonly collisionGroup: Phaser.Physics.Arcade.StaticGroup;

  constructor(
    private readonly scene: Scene,
    objectLayers: SerializedObjectLayer[],
    private readonly cache: GameObjectCache,
    private readonly tileSize: number,
  ) {
    this.collisionGroup = this.scene.physics.add.staticGroup();

    for (const layer of objectLayers) {
      for (const placedObject of layer.objects) {
        const container = this.createObjectContainer(placedObject);
        if (container) {
          this.containers.push(container);
        }
      }
    }
  }

  /** Return all created containers for external access (e.g., collision setup). */
  getContainers(): Phaser.GameObjects.Container[] {
    return this.containers;
  }

  /** Return the static group containing all collision zone bodies. */
  getCollisionGroup(): Phaser.Physics.Arcade.StaticGroup {
    return this.collisionGroup;
  }

  /** Clean up all containers, their children, and the collision group. */
  destroy(): void {
    for (const container of this.containers) {
      container.destroy(true);
    }
    this.containers.length = 0;
    this.collisionGroup.destroy(true);
  }

  /**
   * Create a Container for a single placed object.
   * Returns null if the object definition is not found in the cache.
   */
  private createObjectContainer(
    placedObject: SerializedPlacedObject,
  ): Phaser.GameObjects.Container | null {
    const definition = this.cache.getObjectDefinition(placedObject.objectId);
    if (!definition) {
      console.warn(
        `[ObjectRenderer] No definition found for objectId="${placedObject.objectId}" ` +
          `(name="${placedObject.objectName}"), skipping.`,
      );
      return null;
    }

    const x = placedObject.gridX * this.tileSize;
    const y = placedObject.gridY * this.tileSize;
    const container = this.scene.add.container(x, y);

    // Sort layers by layerOrder ascending before creating sprites
    const sortedLayers = [...definition.layers].sort(
      (a, b) => a.layerOrder - b.layerOrder,
    );

    for (const layerDef of sortedLayers) {
      this.addLayerSprite(container, layerDef);
    }

    // Apply flipX via negative scaleX
    if (placedObject.flipX) {
      container.scaleX = -1;
    }

    // Apply rotation (in radians)
    if (placedObject.rotation !== 0) {
      container.rotation = placedObject.rotation;
    }

    // Y-sorted depth: objects lower on the screen render in front
    container.setDepth(y + this.tileSize);

    // Create invisible static physics bodies for collision zones
    this.createCollisionBodies(definition, x, y);

    return container;
  }

  /**
   * Create invisible static physics bodies for each collision zone
   * of type 'collision' on the game object definition.
   *
   * Each body is positioned at the center of the zone's pixel footprint
   * relative to the object's grid position. Zones of type 'walkable'
   * are skipped -- they are handled at the walkability grid level.
   */
  private createCollisionBodies(
    definition: GameObjectDefinition,
    objectPixelX: number,
    objectPixelY: number,
  ): void {
    for (const zone of definition.collisionZones) {
      if (zone.type !== 'collision') {
        continue;
      }

      const bodyX = objectPixelX + zone.x + zone.width / 2;
      const bodyY = objectPixelY + zone.y + zone.height / 2;

      const body = this.collisionGroup.create(
        bodyX,
        bodyY,
        undefined,
      ) as Phaser.Physics.Arcade.Sprite;

      body.body!.setSize(zone.width, zone.height);
      body.setVisible(false);
      body.setActive(true);
    }
  }

  /**
   * Create a child Sprite for a single render layer and add it to the container.
   * Skips the sprite if the texture or frame is not loaded.
   */
  private addLayerSprite(
    container: Phaser.GameObjects.Container,
    layerDef: GameObjectLayerDef,
  ): void {
    const { spriteId, frameId, xOffset, yOffset } = layerDef;

    // Verify the texture exists in the scene's texture manager
    if (!this.scene.textures.exists(spriteId)) {
      console.warn(
        `[ObjectRenderer] Texture "${spriteId}" not loaded, skipping layer.`,
      );
      return;
    }

    // Verify the frame exists within the texture
    const texture = this.scene.textures.get(spriteId);
    if (!texture.has(frameId)) {
      console.warn(
        `[ObjectRenderer] Frame "${frameId}" not found in texture "${spriteId}", skipping layer.`,
      );
      return;
    }

    const sprite = this.scene.add.sprite(xOffset, yOffset, spriteId, frameId);
    sprite.setOrigin(0, 0);
    container.add(sprite);
  }
}
