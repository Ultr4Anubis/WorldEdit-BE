import { Player } from 'mojang-minecraft';
import { Server } from '@library/Minecraft.js';
import { assertBuilder } from '@modules/assert.js';
import { RawText } from '@modules/rawtext.js';

import { getSession } from '../../sessions.js';
import { commandList } from '../command_list.js';

const registerInformation = {
    name: 'undo',
    description: 'commands.wedit:undo.description',
    usage: [
        {
            name: 'times',
            type: 'int',
            range: [1, null] as [number, null],
            default: 1
        }
    ]
};

commandList['undo'] = [registerInformation, (session, builder, args) => {
    const times = args.get('times') as number;
    const history = session.getHistory();
    for(var i = 0; i < times; i++) {
        if (history.undo()) {
                break;
        }
    }
    return RawText.translate(i == 0 ? 'worldedit.undo.none' : 'worldedit.undo.undone').with(`${i}`);
}];
