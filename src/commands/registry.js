import { commitCommand } from './commit.js';
import { pingCommand } from './ping.js';
import { unwatchCourseCommand } from './unwatchCourse.js';
import { watchCourseCommand } from './watchCourse.js';

export const commands = [pingCommand, watchCourseCommand, unwatchCourseCommand, commitCommand];
