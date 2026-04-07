import { CommandRegistry } from './registry.js';
import { register as registerSystem } from './system.js';
import { register as registerWorld } from './world.js';
import { register as registerModel } from './model.js';
import { register as registerSession } from './session.js';
import { register as registerMemory } from './memory.js';
import { register as registerNotes } from './notes.js';
import { register as registerSettings } from './settings.js';
import { register as registerExport } from './export.js';
import { register as registerKeys } from './keys.js';

const registry = new CommandRegistry();

registerSystem(registry);
registerWorld(registry);
registerModel(registry);
registerSession(registry);
registerMemory(registry);
registerNotes(registry);
registerSettings(registry);
registerExport(registry);
registerKeys(registry);

export default registry;
