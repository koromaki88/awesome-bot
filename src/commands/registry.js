import { canvasCommand } from './canvas/index.js';
import { commitCommand } from './commit.js';
import { helpCommand } from './help.js';
import { pingCommand } from './ping.js';

export const commands = [helpCommand, pingCommand, canvasCommand, commitCommand];
