import { Scene } from 'phaser';

export class Boot extends Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // Load minimal assets needed for the preloader (e.g. loading bar background)
    // Keep this scene lightweight — heavy assets go in Preloader
  }

  create() {
    this.scene.start('Preloader');
  }
}
