import { canvasCommand } from './canvas/index.js';
import { commitCommand } from './commit.js';
import { helpCommand } from './help.js';
import { pingCommand } from './ping.js';
import { purgeCommand } from './purge.js';
import { remindmeCommand } from './remindme.js';

export const commands = [helpCommand, pingCommand, remindmeCommand, purgeCommand, canvasCommand, commitCommand];
