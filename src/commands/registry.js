import { commitCommand } from './commit.js';
import { greetCommand } from './greet.js';
import { unwatchCourseCommand } from './unwatchCourse.js';
import { watchCourseCommand } from './watchCourse.js';

export const commands = [greetCommand, watchCourseCommand, unwatchCourseCommand, commitCommand];
