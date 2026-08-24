// EventBus: Cầu nối sự kiện hai chiều giữa Phaser Canvas và HTML Dashboard UI
class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return () => this.off(event, listener);
  }

  off(event, listener) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }

  emit(event, ...args) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(...args));
  }
}

export const EventBus = new EventEmitter();

export const GAME_EVENTS = {
  STAGE_LOADED: 'STAGE_LOADED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  ENERGY_CHANGED: 'ENERGY_CHANGED',
  TIMER_TICK: 'TIMER_TICK',
  VOICE_OR_TEXT_SUBMITTED: 'VOICE_OR_TEXT_SUBMITTED',
  NPC_DIALOGUE_TRIGGERED: 'NPC_DIALOGUE_TRIGGERED',
  HERO_SWITCHED: 'HERO_SWITCHED',
  MAP_SHARD_COLLECTED: 'MAP_SHARD_COLLECTED',
  INTERACTION_TRIGGERED: 'INTERACTION_TRIGGERED',
  PLAY_SFX: 'PLAY_SFX'
};
