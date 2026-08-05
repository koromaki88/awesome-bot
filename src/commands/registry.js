import { canvasCommand } from './canvas.js';
import { commitCommand } from './commit.js';
import { pingCommand } from './ping.js';

export const commands = [pingCommand, canvasCommand, commitCommand];
